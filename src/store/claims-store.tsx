"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NOW } from "@/data";
import type { Status } from "@/data/types";
import { applyAction, isoLocal, type ActionInput } from "@/logic/actions";
import { bulkSummary, type BulkActionId } from "@/logic/bulk";
import { initialClaims, type LocalClaim } from "@/logic/local";
import { track } from "@/logic/track";
import { UNDO_MS, UndoToast } from "@/components/undo-toast";

type UndoEntry = { id: number; previous: LocalClaim[]; claimId: string };

/** Confirms a decision somewhere the user sees it. The chat registers itself here; with no listener the confirmation is a toast. */
export type DecisionNotice = { summary: string; entryId: number; claimId: string };
let decisionNotifier: ((notice: DecisionNotice) => void) | null = null;
export function setDecisionNotifier(run: ((notice: DecisionNotice) => void) | null) {
  decisionNotifier = run;
}

// How to undo each decision that can still be undone. The chat's Undo button uses these.
const undoers = new Map<number, () => void>();
export const undoDecision = (entryId: number) => undoers.get(entryId)?.();
export const isUndoable = (entryId: number) => undoers.has(entryId);

type PerformOptions = {
  /** Called after an undo so the UI can reopen the claim. */
  onUndo?: (claimId: string) => void;
  /** Skip the confirmation toast, for example for a spot check confirmation. */
  silent?: boolean;
};

export type PerformResult = { ok: true; summary: string; changedIds: string[]; status: Status } | { ok: false };

type ClaimsStore = {
  claims: LocalClaim[];
  /** The demo clock: `meta.now` plus the days skipped ahead. Waits end against this, never the real clock. */
  now: Date;
  /** Moves the demo clock forward so a wait can end and its claim return to the queue. Kept until the demo is reset. */
  skipAhead: (days: number) => void;
  /** Ids Noa has acted on this session, for the cleared-queue summary (PRD EMP-1). */
  sessionIds: string[];
  simulateError: boolean;
  setSimulateError: (on: boolean) => void;
  perform: (claimId: string, input: ActionInput, options?: PerformOptions) => PerformResult;
  /** Applies one action to several claims as a single step, with one notice and one Undo for the whole batch. */
  performBatch: (claimIds: string[], action: BulkActionId, input: ActionInput) => { ok: true; summary: string; changedIds: string[] } | { ok: false };
  /** Undoes the most recent decision, the same as the Undo button in the notice. Returns the claim id, or null if there is nothing to undo. */
  undoLast: (onUndo?: (claimId: string) => void) => string | null;
  /** Adds a message from the manager to the claim chat. Local only. */
  sendMessage: (claimId: string, text: string) => void;
  reset: () => void;
};

const Context = createContext<ClaimsStore | null>(null);

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<LocalClaim[]>(initialClaims);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [simulateError, setSimulateError] = useState(false);
  const [daysSkipped, setDaysSkipped] = useState(0);
  // Each action moves the clock one minute, so the log has distinct times. `now` follows it, so a wait set by an action ends exactly when the skipped days are up.
  const [minutes, setMinutes] = useState(0);
  const skipped = useRef(0);
  const tick = useRef(0);
  const clock = () => new Date(NOW.getTime() + skipped.current * 86_400_000 + tick.current * 60_000);
  const now = useMemo(() => new Date(NOW.getTime() + daysSkipped * 86_400_000 + minutes * 60_000), [daysSkipped, minutes]);
  const skipAhead = useCallback((days: number) => {
    skipped.current += days;
    setDaysSkipped(skipped.current);
  }, []);
  const undoId = useRef(0);
  const undoStack = useRef<UndoEntry[]>([]);

  const undo = useCallback((entryId: number, onUndo?: (claimId: string) => void) => {
    const entry = undoStack.current.find((e) => e.id === entryId);
    if (!entry) return;
    setClaims((current) =>
      current.map((c) => entry.previous.find((p) => p.id === c.id) ?? c),
    );
    undoStack.current = undoStack.current.filter((e) => e.id !== entryId);
    undoers.delete(entryId);
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
      setMinutes(tick.current);
      const result = applyAction(claims, claimId, input, clock());
      const previous = claims.filter((c) => result.changed.some((r) => r.id === c.id));
      const entry: UndoEntry = { id: ++undoId.current, previous, claimId };
      undoStack.current.push(entry);

      setClaims((current) => current.map((c) => result.changed.find((r) => r.id === c.id) ?? c));
      if (input.id !== "confirm" && input.id !== "decide_now") {
        setSessionIds((ids) => (ids.includes(claimId) ? ids : [...ids, claimId]));
      }
      track("decision_made", { claim: claimId, action: input.id, amount: input.amount });

      undoers.set(entry.id, () => undo(entry.id, options?.onUndo));
      if (!options?.silent) {
        if (decisionNotifier) decisionNotifier({ summary: result.summary, entryId: entry.id, claimId });
        else toast.custom((id) => <UndoToast id={id} message={result.summary} onUndo={() => undo(entry.id, options?.onUndo)} />, { duration: UNDO_MS });
      }
      return { ok: true, summary: result.summary, changedIds: result.changed.map((c) => c.id), status: result.changed[0].status };
    },
    [claims, simulateError, undo],
  );

  const performBatch = useCallback(
    (claimIds: string[], action: BulkActionId, input: ActionInput) => {
      if (simulateError) {
        track("error_shown", { id: "ERR-1", claims: claimIds, action: input.id });
        return { ok: false as const };
      }
      tick.current += 1;
      setMinutes(tick.current);
      const at = clock();
      const changed = claimIds.flatMap((id) => applyAction(claims, id, input, at).changed);
      const previous = claims.filter((c) => changed.some((r) => r.id === c.id));
      const entry: UndoEntry = { id: ++undoId.current, previous, claimId: claimIds[0] };
      undoStack.current.push(entry);

      setClaims((current) => current.map((c) => changed.find((r) => r.id === c.id) ?? c));
      setSessionIds((ids) => [...ids, ...claimIds.filter((id) => !ids.includes(id))]);
      for (const id of claimIds) track("decision_made", { claim: id, action: input.id, bulk: true });

      const summary = bulkSummary(action, changed.filter((c) => claimIds.includes(c.id)));
      toast.custom((id) => <UndoToast id={id} message={summary} onUndo={() => undo(entry.id)} />, { duration: UNDO_MS });
      return { ok: true as const, summary, changedIds: changed.map((c) => c.id) };
    },
    [claims, simulateError, undo],
  );

  const sendMessage = useCallback((claimId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    tick.current += 1;
    setMinutes(tick.current);
    const at = isoLocal(clock());
    setClaims((current) =>
      current.map((c) => (c.id === claimId ? { ...c, local: { ...c.local, thread: [...(c.local?.thread ?? []), { at, from: "manager" as const, text: body }] } } : c)),
    );
  }, []);

  const undoLast = useCallback(
    (onUndo?: (claimId: string) => void) => {
      const entry = undoStack.current[undoStack.current.length - 1];
      if (!entry) return null;
      undo(entry.id, onUndo);
      return entry.claimId;
    },
    [undo],
  );

  const reset = useCallback(() => {
    setClaims(initialClaims());
    setSessionIds([]);
    undoStack.current = [];
    undoers.clear();
    tick.current = 0;
    setMinutes(0);
    skipped.current = 0;
    setDaysSkipped(0);
    toast("Demo reset to the start of Monday 16 Nov");
  }, []);

  const value = useMemo<ClaimsStore>(
    () => ({ claims, now, skipAhead, sessionIds, simulateError, setSimulateError, perform, performBatch, undoLast, sendMessage, reset }),
    [claims, now, skipAhead, sessionIds, simulateError, perform, performBatch, undoLast, sendMessage, reset],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useClaims(): ClaimsStore {
  const store = useContext(Context);
  if (!store) throw new Error("useClaims must be used inside ClaimsProvider");
  return store;
}
