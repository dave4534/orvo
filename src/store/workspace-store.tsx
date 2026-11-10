"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type ChatStatus, type UIMessage } from "ai";

import type { ChatContext } from "@/logic/chat-context";

import { isUiTool } from "@/logic/assistant-tools";

/** What a screen tool hands back to the model. It may take a moment when the tool has to wait for a panel to open. */
export type UiToolResult = Record<string, unknown>;
export type UiToolHandler = (name: string, input: Record<string, unknown>) => UiToolResult | Promise<UiToolResult>;
/** A control that lives inside one component (the employee chat, the document window). The component registers it while it is on screen. */
export type ControlHandler = (input: Record<string, unknown>) => UiToolResult;

/** A question to the employee that is typed in the Chat tab and waits for Noa to send it. Sending performs the Ask action. */
export type AskDraft = { claimId: string; text: string; send: (text: string) => boolean };

export type AiMeta = {
  /** Posted by the app itself (claim summary and recommendation, offline reply), not by the model. */
  note?: boolean;
  /** Small caption above the message, for example "Offline reply". */
  heading?: string;
  /** For a recommendation: the claim it is about and the button it suggests. */
  claimId?: string;
  suggest?: string;
  action?: { label: string; kind: "overview" | "policy" };
  /** The summary the app posts when a new claim comes up. */
  triage?: boolean;
  /** A decision the app confirms in the chat, with an Undo button. The id is the entry in the claims store's undo list. */
  undo?: { entryId: number };
};
export type AiMessage = UIMessage<AiMeta>;

export type NewMessage = { role: "user" | "assistant"; text: string } & AiMeta;

/** What a spoken or typed command can add to a button: the wording of a message, or an amount. */
export type ActionExtra = { message?: string; amount?: number; /** The button was clicked, so a missing amount opens the dialog instead of failing. */ interactive?: boolean };
export type ActionRunResult = { ok: boolean; error?: string; note?: string };
export type DialogControl = { confirm: () => ActionRunResult; cancel: () => ActionRunResult };

/** The one chat. It is continuous across the whole prototype: opening a claim, going back, deciding or undoing never starts another. */
export const LIST_SESSION = "chat";

type WorkspaceStore = {
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
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
  /** Adds a message from the app without calling the model, for example the summary posted when a claim comes up. While an answer is being written it waits until the answer is done, so it never lands inside it. */
  addAiMessage: (message: NewMessage) => void;
  /** The claim the last triage note was about, so the same claim is not summarized twice in a row. */
  lastTriageClaim: () => string | null;
  /** Clears every chat. */
  resetAi: () => void;
  /** The triage panel registers how to run its actions, so a button in the chat can run one by its label. Returns false if there is no such button. */
  setActionRunner: (run: ((label: string, extra?: ActionExtra) => ActionRunResult) | null) => void;
  runAction: (label: string, extra?: ActionExtra) => ActionRunResult;
  /** The claims view tells the chat where the user is and what changed this session. */
  setChatContext: (read: (() => ChatContext) | null) => void;
  /** The triage panel registers the open pop-up (for example the message to an employee) so the chat can send or cancel it. */
  setDialogControl: (control: DialogControl | null) => void;
  controlDialog: (action: "confirm" | "cancel") => ActionRunResult;
  /** The claims view runs screen tools for the chat. Returns the result sent back to the model. */
  setUiToolHandler: (run: UiToolHandler | null) => void;
  /** Components with their own state register what the assistant can do with them. Returns false when that control is not on screen. */
  /** The question waiting in the employee chat, if any. */
  askDraft: AskDraft | null;
  setAskDraft: (draft: AskDraft | null) => void;
  setControl: (key: string, handler: ControlHandler | null) => void;
  hasControl: (key: string) => boolean;
  callControl: (key: string, input?: Record<string, unknown>) => UiToolResult;
  /** The top bar logo asks the claims view to go back to the Expenses list. Each call bumps homeRequest. */
  homeRequest: number;
  goHome: () => void;
  /** Called when the live model can't answer, so scripted replies can step in. */
  setAiFallback: (run: ((prompt: string) => void) | null) => void;
};

const Context = createContext<WorkspaceStore | null>(null);

const EMPTY_CONTEXT: ChatContext = { ui: { tab: "needs_review", openClaimId: null, detailsOpen: false, detailsTab: "overview", search: "", filters: "", pastClaimId: null, documentOpen: false, dialogOpen: false, unsentMessage: "", selectedCount: 0, controls: [], briefVisible: false, voice: false }, overlay: [] };

// Module level, so the chat transport and the chats do not depend on rendering.
const chatContextSource: { read: (() => ChatContext) | null } = { read: null };
const chatHooks: {
  fallback: ((prompt: string) => void) | null;
  lastPrompt: string;
  ui: UiToolHandler | null;
  reply: ((text: string) => void) | null;
} = { fallback: null, lastPrompt: "", ui: null, reply: null };
const transport = new DefaultChatTransport<AiMessage>({ api: "/api/chat", body: () => ({ context: chatContextSource.read?.() ?? EMPTY_CONTEXT }) });
const chats = new Map<string, Chat<AiMessage>>();
// How much of each assistant message was already passed on to voice mode. After a screen action the same message continues,
// so only the new part is read aloud, not the whole message again.
const spokenLength = new Map<string, number>();
const controls = new Map<string, ControlHandler>();

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
        if (toolCall.dynamic || !isUiTool(toolCall.toolName)) return;
        // Some tools wait for a panel to open first, so the result may arrive a moment later. A failure is reported to the model, never swallowed.
        const run = async (): Promise<UiToolResult> => {
          try {
            return (await chatHooks.ui?.(toolCall.toolName, (toolCall.input ?? {}) as Record<string, unknown>)) ?? { ok: false, error: "The screen is not ready." };
          } catch {
            return { ok: false, error: "That could not be done on the screen." };
          }
        };
        // Not awaited, so the chat is not blocked while the result is recorded.
        void run().then((output) => created.addToolOutput({ tool: toolCall.toolName as never, toolCallId: toolCall.toolCallId, output: output as never }));
      },
      // Each finished part of an answer is passed on, so voice mode can read it even if the view has moved to another claim.
      onFinish: ({ message }) => {
        const full = message.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n\n");
        const fresh = full.slice(spokenLength.get(message.id) ?? 0).trim();
        spokenLength.set(message.id, full.length);
        if (fresh) chatHooks.reply?.(fresh);
      },
      onError: () => {
        created.clearError();
        chatHooks.fallback?.(chatHooks.lastPrompt);
      },
    });
    chats.set(key, created);
    chat = created;
  }
  return chat;
}

/** Adds a message from the app to the end of a chat. */
function appendNote(chat: Chat<AiMessage>, { role, text, heading, action, claimId, suggest, triage, undo }: NewMessage) {
  chat.messages = [...chat.messages, { id: crypto.randomUUID(), role, parts: [{ type: "text", text }], metadata: { note: true, heading, action, claimId, suggest, triage, undo } }];
}

/** Holds the Ask Orvo AI chats so they survive panel changes and are reachable from the top bar (PRD FR-AI-8). Each claim has its own chat. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [askDraft, setAskDraft] = useState<AskDraft | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [homeRequest, setHomeRequest] = useState(0);
  const goHome = useCallback(() => setHomeRequest((n) => n + 1), []);
  const dialog = useRef<DialogControl | null>(null);
  const runner = useRef<((label: string, extra?: ActionExtra) => ActionRunResult) | null>(null);

  const chat = useMemo(() => getChat(epoch, LIST_SESSION), [epoch]);
  const { messages, sendMessage, status, stop, regenerate } = useChat<AiMessage>({ chat });

  const askAi = useCallback(
    (text: string) => {
      chatHooks.lastPrompt = text;
      void sendMessage({ text });
    },
    [sendMessage],
  );

  // Messages from the app wait while an answer is being written, then go in once it is done.
  const queued = useRef<NewMessage[]>([]);
  const statusRef = useRef(status);
  const append = useCallback((message: NewMessage) => appendNote(chat, message), [chat]);
  const isWorking = useCallback(() => {
    if (statusRef.current === "submitted" || statusRef.current === "streaming") return true;
    // A screen tool may be running, or its result may not be sent back yet.
    const last = chat.messages[chat.messages.length - 1];
    const running = last?.role === "assistant" && last.parts.some((p) => p.type.startsWith("tool-") && ["input-available", "input-streaming"].includes((p as { state?: string }).state ?? ""));
    return running || lastAssistantMessageIsCompleteWithToolCalls({ messages: chat.messages });
  }, [chat]);
  useEffect(() => {
    statusRef.current = status;
    if (queued.current.length > 0 && !isWorking()) {
      const waiting = queued.current;
      queued.current = [];
      for (const m of waiting) append(m);
    }
  }, [status, messages, isWorking, append]);
  const addAiMessage = useCallback(
    (message: NewMessage) => {
      if (isWorking()) queued.current.push(message);
      else append(message);
    },
    [isWorking, append],
  );
  const lastTriageClaim = useCallback((): string | null => {
    const all: { meta?: AiMeta }[] = [...chat.messages.map((m) => ({ meta: m.metadata })), ...queued.current.map((m) => ({ meta: m }))];
    for (let i = all.length - 1; i >= 0; i--) if (all[i].meta?.triage) return all[i].meta?.claimId ?? null;
    return null;
  }, [chat]);
  const resetAi = useCallback(() => {
    void stop();
    chats.clear();
    queued.current = [];
    setEpoch((e) => e + 1);
  }, [stop]);
  const stopAi = useCallback(() => void stop(), [stop]);
  const regenerateAi = useCallback(() => void regenerate(), [regenerate]);
  const setActionRunner = useCallback((run: ((label: string, extra?: ActionExtra) => ActionRunResult) | null) => {
    runner.current = run;
  }, []);
  const runAction = useCallback((label: string, extra?: ActionExtra): ActionRunResult => runner.current?.(label, extra) ?? { ok: false, error: "No claim is open." }, []);
  const setReplyListener = useCallback((run: ((text: string) => void) | null) => {
    chatHooks.reply = run;
  }, []);
  const setDialogControl = useCallback((control: DialogControl | null) => {
    dialog.current = control;
    // Lets the claims view tell the assistant that a pop-up is waiting.
    if (control) controls.set("dialog", () => ({ ok: true }));
    else controls.delete("dialog");
  }, []);
  const setControl = useCallback((key: string, handler: ControlHandler | null) => {
    if (handler) controls.set(key, handler);
    else controls.delete(key);
  }, []);
  const hasControl = useCallback((key: string) => controls.has(key), []);
  const callControl = useCallback((key: string, input: Record<string, unknown> = {}): UiToolResult => controls.get(key)?.(input) ?? { ok: false, error: "That is not on screen." }, []);
  // "Send" and "cancel" go to a pop-up if one is open, otherwise to a message typed in the employee chat.
  const controlDialog = useCallback(
    (action: "confirm" | "cancel"): ActionRunResult => {
      if (dialog.current) return dialog.current[action]();
      const chatResult = controls.get("employeeChat")?.({ do: action === "confirm" ? "send" : "clear" });
      if (chatResult) return chatResult as ActionRunResult;
      return { ok: false, error: "There is no pop-up or unsent message open." };
    },
    [],
  );
  const setUiToolHandler = useCallback((run: UiToolHandler | null) => {
    chatHooks.ui = run;
  }, []);
  const setChatContext = useCallback((read: (() => ChatContext) | null) => {
    chatContextSource.read = read;
  }, []);
  const setAiFallback = useCallback((run: ((prompt: string) => void) | null) => {
    chatHooks.fallback = run;
  }, []);

  const value = useMemo(
    () => ({ aiOpen, setAiOpen, aiMessages: messages, aiStatus: status, askAi, stopAi, regenerateAi, voiceOpen, setVoiceOpen, setReplyListener, addAiMessage, lastTriageClaim, resetAi, setActionRunner, runAction, setDialogControl, controlDialog, askDraft, setAskDraft, setControl, hasControl, callControl, setChatContext, setUiToolHandler, setAiFallback, homeRequest, goHome }),
    [aiOpen, messages, status, askAi, stopAi, regenerateAi, voiceOpen, setVoiceOpen, setReplyListener, addAiMessage, lastTriageClaim, resetAi, setActionRunner, runAction, setDialogControl, controlDialog, askDraft, setAskDraft, setControl, hasControl, callControl, setChatContext, setUiToolHandler, setAiFallback, homeRequest, goHome],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceStore {
  const store = useContext(Context);
  if (!store) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return store;
}
