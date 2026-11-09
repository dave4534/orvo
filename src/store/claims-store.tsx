"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NOW } from "@/data";
import type { Status } from "@/data/types";
import { applyAction, isoLocal, type ActionInput } from "@/logic/actions";
import { initialClaims, type LocalClaim } from "@/logic/local";
import { track } from "@/logic/track";
import { UNDO_MS, UndoToast } from "@/components/undo-toast";

type UndoEntry = { id: number; previous: LocalClaim[]; claimId: string };

type PerformOptions = {
  /** Called after an undo so the UI can reopen the claim. */
  onUndo?: (claimId: string) => void;
  /** Skip the confirmation toast, for example for a spot check confirmation. */
  silent?: boolean;
};

export type PerformResult = { ok: true; summary: string; changedIds: string[]; status: Status } | { ok: false };

type ClaimsStore = {
  claims: LocalClaim[];
  /** Ids Noa has acted on this session, for the cleared-queue summary (PRD EMP-1). */
  sessionIds: string[];
  simulateError: boolean;
  setSimulateError: (on: boolean) => void;
  perform: (claimId: string, input: ActionInput, options?: PerformOptions) => PerformResult;
  /** Adds a message from the manager to the claim chat. Local only. */
  sendMessage: (claimId: string, text: string) => void;
  reset: () => void;
};

const Context = createContext<ClaimsStore | null>(null);

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<LocalClaim[]>(initialClaims);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [simulateError, setSimulateError] = useState(false);
  const tick = useRef(0);
  const undoId = useRef(0);
  const undoStack = useRef<UndoEntry[]>([]);

  const undo = useCallback((entryId: number, onUndo?: (claimId: string) => void) => {
    const entry = undoStack.current.find((e) => e.id === entryId);
    if (!entry) return;
    setClaims((current) =>
      current.map((c) => entry.previous.find((p) => p.id === c.id) ?? c),
    );
    undoStack.current = undoStack.current.filter((e) => e.id !== entryId);
    track("decision_undone", { claim: entry.claimId });
    onUndo?.(entry.claimId);
  }, []);

  const perform = useCallback(
    (claimId: string, input: ActionInput, options?: PerformOptions): PerformResult => {
      if (simulateError && input.id !== "confirm") {
        track("error_shown", { id: "ERR-1", claim: claimId, action: input.id });
        return { ok: false };
      }
      tick.current += 1;
      const now = new Date(NOW.getTime() + tick.current * 60_000);
      const result = applyAction(claims, claimId, input, now);
      const previous = claims.filter((c) => result.changed.some((r) => r.id === c.id));
      const entry: UndoEntry = { id: ++undoId.current, previous, claimId };
      undoStack.current.push(entry);

      setClaims((current) => current.map((c) => result.changed.find((r) => r.id === c.id) ?? c));
      if (input.id !== "confirm" && input.id !== "decide_now") {
        setSessionIds((ids) => (ids.includes(claimId) ? ids : [...ids, claimId]));
      }
      track("decision_made", { claim: claimId, action: input.id, amount: input.amount });

      if (!options?.silent) {
        toast.custom((id) => <UndoToast id={id} message={result.summary} onUndo={() => undo(entry.id, options?.onUndo)} />, { duration: UNDO_MS });
      }
      return { ok: true, summary: result.summary, changedIds: result.changed.map((c) => c.id), status: result.changed[0].status };
    },
    [claims, simulateError, undo],
  );

  const sendMessage = useCallback((claimId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    tick.current += 1;
    const at = isoLocal(new Date(NOW.getTime() + tick.current * 60_000));
    setClaims((current) =>
      current.map((c) => (c.id === claimId ? { ...c, local: { ...c.local, thread: [...(c.local?.thread ?? []), { at, from: "manager" as const, text: body }] } } : c)),
    );
  }, []);

  const reset = useCallback(() => {
    setClaims(initialClaims());
    setSessionIds([]);
    undoStack.current = [];
    tick.current = 0;
    toast("Demo reset to the start of Monday 16 Nov");
  }, []);

  const value = useMemo<ClaimsStore>(
    () => ({ claims, sessionIds, simulateError, setSimulateError, perform, sendMessage, reset }),
    [claims, sessionIds, simulateError, perform, sendMessage, reset],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useClaims(): ClaimsStore {
  const store = useContext(Context);
  if (!store) throw new Error("useClaims must be used inside ClaimsProvider");
  return store;
}
