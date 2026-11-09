"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatStatus, type UIMessage } from "ai";

import type { ChatContext } from "@/logic/chat-context";

export type AiMeta = {
  /** Posted by the app itself (claim summary, recommendation, offline reply), not by the model. */
  note?: boolean;
  /** For a recommendation note: the claim it is about and the button it suggests. */
  claimId?: string;
  suggest?: string;
  /** Small label above the message, naming the claim the summary is about. */
  heading?: string;
  action?: { label: string; kind: "overview" | "policy" };
};
export type AiMessage = UIMessage<AiMeta>;

type NewMessage = { role: "user" | "assistant"; text: string } & AiMeta;

type WorkspaceStore = {
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  aiMessages: AiMessage[];
  aiStatus: ChatStatus;
  /** Sends a question to the live model. */
  askAi: (text: string) => void;
  /** Stops the answer that is being written. */
  stopAi: () => void;
  /** Writes the last answer again. */
  regenerateAi: () => void;
  /** Adds a message without calling the model, for example the summary posted when a claim opens. */
  addAiMessage: (message: NewMessage) => void;
  resetAi: () => void;
  /** The triage panel registers how to run its actions, so a button in the chat can run one by its label. */
  setActionRunner: (run: ((label: string) => void) | null) => void;
  runAction: (label: string) => void;
  /** The claims view tells the chat where the user is and what changed this session. */
  setChatContext: (read: (() => ChatContext) | null) => void;
  /** Called with the question when the live model can't answer, so scripted replies can step in. */
  setAiFallback: (run: ((prompt: string) => void) | null) => void;
};

const Context = createContext<WorkspaceStore | null>(null);

/** Read by the chat transport on every send. Module level, so reading it is not tied to rendering. */
const chatContextSource: { read: (() => ChatContext) | null } = { read: null };

const EMPTY_CONTEXT: ChatContext = { ui: { tab: "needs_review", openClaimId: null, detailsOpen: false, detailsTab: "overview", search: "" }, overlay: [] };

/** Holds the Ask Orvo AI chat so it survives claim changes and is reachable from the top bar (PRD FR-AI-8). */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const fallbackRef = useRef<((prompt: string) => void) | null>(null);
  const lastPrompt = useRef("");
  const runner = useRef<((label: string) => void) | null>(null);

  const transport = useMemo(
    () => new DefaultChatTransport<AiMessage>({ api: "/api/chat", body: () => ({ context: chatContextSource.read?.() ?? EMPTY_CONTEXT }) }),
    [],
  );
  const { messages, sendMessage, setMessages, status, clearError, stop, regenerate } = useChat<AiMessage>({
    transport,
    onError: () => {
      clearError();
      fallbackRef.current?.(lastPrompt.current);
    },
  });

  const askAi = useCallback(
    (text: string) => {
      lastPrompt.current = text;
      void sendMessage({ text });
    },
    [sendMessage],
  );
  const addAiMessage = useCallback(
    ({ role, text, heading, action, claimId, suggest }: NewMessage) =>
      setMessages((list) => [...list, { id: crypto.randomUUID(), role, parts: [{ type: "text", text }], metadata: { note: true, heading, action, claimId, suggest } }]),
    [setMessages],
  );
  const resetAi = useCallback(() => {
    void stop();
    setMessages([]);
  }, [stop, setMessages]);
  const stopAi = useCallback(() => void stop(), [stop]);
  const regenerateAi = useCallback(() => void regenerate(), [regenerate]);
  const setActionRunner = useCallback((run: ((label: string) => void) | null) => {
    runner.current = run;
  }, []);
  const runAction = useCallback((label: string) => runner.current?.(label), []);
  const setChatContext = useCallback((read: (() => ChatContext) | null) => {
    chatContextSource.read = read;
  }, []);
  const setAiFallback = useCallback((run: ((prompt: string) => void) | null) => {
    fallbackRef.current = run;
  }, []);

  const value = useMemo(
    () => ({ aiOpen, setAiOpen, aiMessages: messages, aiStatus: status, askAi, stopAi, regenerateAi, addAiMessage, resetAi, setActionRunner, runAction, setChatContext, setAiFallback }),
    [aiOpen, messages, status, askAi, stopAi, regenerateAi, addAiMessage, resetAi, setActionRunner, runAction, setChatContext, setAiFallback],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceStore {
  const store = useContext(Context);
  if (!store) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return store;
}
