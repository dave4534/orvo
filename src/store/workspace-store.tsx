"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type AiMessage = {
  id: number;
  role: "user" | "orvo";
  text: string;
  /** Small label above the message, naming the claim the summary is about. */
  heading?: string;
  action?: { label: string; kind: "overview" | "policy" };
};

type WorkspaceStore = {
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  aiMessages: AiMessage[];
  addAiMessage: (message: Omit<AiMessage, "id">) => void;
  resetAi: () => void;
  /** The triage panel registers its recommended action so the AI chat can run it. */
  setPrimaryAction: (run: (() => void) | null) => void;
  runPrimaryAction: () => void;
};

const Context = createContext<WorkspaceStore | null>(null);

/** Holds the Ask Orvo AI panel state so it survives claim changes and is reachable from the top bar (PRD FR-AI-8). */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);

  const addAiMessage = useCallback(
    (message: Omit<AiMessage, "id">) => setAiMessages((list) => [...list, { ...message, id: list.length + 1 }]),
    [],
  );
  const resetAi = useCallback(() => setAiMessages([]), []);
  const primary = useRef<(() => void) | null>(null);
  const setPrimaryAction = useCallback((run: (() => void) | null) => {
    primary.current = run;
  }, []);
  const runPrimaryAction = useCallback(() => primary.current?.(), []);

  const value = useMemo(
    () => ({ aiOpen, setAiOpen, aiMessages, addAiMessage, resetAi, setPrimaryAction, runPrimaryAction }),
    [aiOpen, aiMessages, addAiMessage, resetAi, setPrimaryAction, runPrimaryAction],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceStore {
  const store = useContext(Context);
  if (!store) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return store;
}
