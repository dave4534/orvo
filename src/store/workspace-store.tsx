"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type ChatStatus, type UIMessage } from "ai";

import type { ChatContext } from "@/logic/chat-context";

/** Screen tools the browser runs. Must match src/server/ui-tools.ts. */
const UI_TOOLS = new Set(["openClaim", "nextClaim", "previousClaim", "backToClaims", "openDetails", "closeDetails", "showClaimsTab", "takeAction", "undoLastDecision"]);

export type AiMeta = {
  /** Posted by the app itself (claim summary and recommendation, offline reply), not by the model. */
  note?: boolean;
  /** Small caption above the message, for example "Offline reply". */
  heading?: string;
  /** For a recommendation: the claim it is about and the button it suggests. */
  claimId?: string;
  suggest?: string;
  action?: { label: string; kind: "overview" | "policy" };
};
export type AiMessage = UIMessage<AiMeta>;

type NewMessage = { role: "user" | "assistant"; text: string } & AiMeta;

/** Which chat is shown: one per claim, plus one for the claims list. */
export const LIST_SESSION = "list";

type WorkspaceStore = {
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  /** The chat that is shown. Every claim has its own. */
  aiSession: string;
  setAiSession: (session: string) => void;
  aiMessages: AiMessage[];
  aiStatus: ChatStatus;
  /** Sends a question to the live model, in the chat that is shown. */
  askAi: (text: string) => void;
  /** Voice mode is on. Kept here, so moving between claims does not end it. */
  voiceOpen: boolean;
  setVoiceOpen: (open: boolean) => void;
  /** The voice bar registers to hear every finished reply, wherever it was written. */
  setReplyListener: (run: ((text: string) => void) | null) => void;
  /** Stops the answer that is being written. */
  stopAi: () => void;
  /** Writes the last answer again. */
  regenerateAi: () => void;
  /** Adds a message to one chat without calling the model, for example the summary posted when a claim opens. */
  addAiMessage: (session: string, message: NewMessage) => void;
  /** True when that chat already has messages. */
  hasAiMessages: (session: string) => boolean;
  /** Clears every chat. */
  resetAi: () => void;
  /** The triage panel registers how to run its actions, so a button in the chat can run one by its label. Returns false if there is no such button. */
  setActionRunner: (run: ((label: string) => boolean) | null) => void;
  runAction: (label: string) => boolean;
  /** The claims view tells the chat where the user is and what changed this session. */
  setChatContext: (read: (() => ChatContext) | null) => void;
  /** The claims view runs screen tools for the chat. Returns the result sent back to the model. */
  setUiToolHandler: (run: ((name: string, input: Record<string, unknown>) => Record<string, unknown>) | null) => void;
  /** Called when the live model can't answer, so scripted replies can step in. */
  setAiFallback: (run: ((prompt: string, session: string) => void) | null) => void;
};

const Context = createContext<WorkspaceStore | null>(null);

const EMPTY_CONTEXT: ChatContext = { ui: { tab: "needs_review", openClaimId: null, detailsOpen: false, detailsTab: "overview", search: "", voice: false }, overlay: [] };

// Module level, so the chat transport and the chats do not depend on rendering.
const chatContextSource: { read: (() => ChatContext) | null } = { read: null };
const chatHooks: {
  fallback: ((prompt: string, session: string) => void) | null;
  lastPrompt: string;
  ui: ((name: string, input: Record<string, unknown>) => Record<string, unknown>) | null;
  reply: ((text: string) => void) | null;
} = { fallback: null, lastPrompt: "", ui: null, reply: null };
const transport = new DefaultChatTransport<AiMessage>({ api: "/api/chat", body: () => ({ context: chatContextSource.read?.() ?? EMPTY_CONTEXT }) });
const chats = new Map<string, Chat<AiMessage>>();

function getChat(epoch: number, session: string): Chat<AiMessage> {
  const key = `${epoch}:${session}`;
  let chat = chats.get(key);
  if (!chat) {
    const created: Chat<AiMessage> = new Chat<AiMessage>({
      id: key,
      transport,
      // When every answer part is in, send the results of screen tools back to the model so it can finish its reply.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      // Screen tools have no server function. The browser runs them here and sends the result back.
      onToolCall: ({ toolCall }) => {
        if (toolCall.dynamic || !UI_TOOLS.has(toolCall.toolName)) return;
        const output = chatHooks.ui?.(toolCall.toolName, (toolCall.input ?? {}) as Record<string, unknown>) ?? { ok: false, error: "The screen is not ready." };
        // Not awaited, so the chat is not blocked while the result is recorded.
        void created.addToolOutput({ tool: toolCall.toolName as never, toolCallId: toolCall.toolCallId, output: output as never });
      },
      // Each finished part of an answer is passed on, so voice mode can read it even if the view has moved to another claim.
      onFinish: ({ message }) => {
        const text = message.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n\n").trim();
        if (text) chatHooks.reply?.(text);
      },
      onError: () => {
        created.clearError();
        chatHooks.fallback?.(chatHooks.lastPrompt, session);
      },
    });
    chats.set(key, created);
    chat = created;
  }
  return chat;
}

/** Holds the Ask Orvo AI chats so they survive panel changes and are reachable from the top bar (PRD FR-AI-8). Each claim has its own chat. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [aiSession, setAiSession] = useState(LIST_SESSION);
  const [epoch, setEpoch] = useState(0);
  const runner = useRef<((label: string) => boolean) | null>(null);

  const chat = useMemo(() => getChat(epoch, aiSession), [epoch, aiSession]);
  const { messages, sendMessage, status, stop, regenerate } = useChat<AiMessage>({ chat });

  const askAi = useCallback(
    (text: string) => {
      chatHooks.lastPrompt = text;
      void sendMessage({ text });
    },
    [sendMessage],
  );
  const addAiMessage = useCallback(
    (session: string, { role, text, heading, action, claimId, suggest }: NewMessage) => {
      const target = getChat(epoch, session);
      target.messages = [...target.messages, { id: crypto.randomUUID(), role, parts: [{ type: "text", text }], metadata: { note: true, heading, action, claimId, suggest } }];
    },
    [epoch],
  );
  const hasAiMessages = useCallback((session: string) => getChat(epoch, session).messages.length > 0, [epoch]);
  const resetAi = useCallback(() => {
    void stop();
    chats.clear();
    setEpoch((e) => e + 1);
  }, [stop]);
  const stopAi = useCallback(() => void stop(), [stop]);
  const regenerateAi = useCallback(() => void regenerate(), [regenerate]);
  const setActionRunner = useCallback((run: ((label: string) => boolean) | null) => {
    runner.current = run;
  }, []);
  const runAction = useCallback((label: string) => runner.current?.(label) ?? false, []);
  const setReplyListener = useCallback((run: ((text: string) => void) | null) => {
    chatHooks.reply = run;
  }, []);
  const setUiToolHandler = useCallback((run: ((name: string, input: Record<string, unknown>) => Record<string, unknown>) | null) => {
    chatHooks.ui = run;
  }, []);
  const setChatContext = useCallback((read: (() => ChatContext) | null) => {
    chatContextSource.read = read;
  }, []);
  const setAiFallback = useCallback((run: ((prompt: string, session: string) => void) | null) => {
    chatHooks.fallback = run;
  }, []);

  const value = useMemo(
    () => ({ aiOpen, setAiOpen, aiSession, setAiSession, aiMessages: messages, aiStatus: status, askAi, stopAi, regenerateAi, voiceOpen, setVoiceOpen, setReplyListener, addAiMessage, hasAiMessages, resetAi, setActionRunner, runAction, setChatContext, setUiToolHandler, setAiFallback }),
    [aiOpen, aiSession, messages, status, askAi, stopAi, regenerateAi, voiceOpen, setVoiceOpen, setReplyListener, addAiMessage, hasAiMessages, resetAi, setActionRunner, runAction, setChatContext, setUiToolHandler, setAiFallback],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceStore {
  const store = useContext(Context);
  if (!store) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return store;
}
