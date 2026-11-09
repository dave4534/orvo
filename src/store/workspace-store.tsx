"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type AiMessage = { id: number; role: "user" | "orvo"; text: string; action?: { label: string; kind: "documents" | "policy" } };

type WorkspaceStore = {
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  aiMessages: AiMessage[];
  addAiMessage: (message: Omit<AiMessage, "id">) => void;
  resetAi: () => void;
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

  const value = useMemo(
    () => ({ aiOpen, setAiOpen, aiMessages, addAiMessage, resetAi }),
    [aiOpen, aiMessages, addAiMessage, resetAi],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceStore {
  const store = useContext(Context);
  if (!store) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return store;
}
