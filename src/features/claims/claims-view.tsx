"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper, SearchX, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import { buildDailyBrief, buildDoneBrief, briefSentence, doneBriefSentence } from "@/logic/brief";
import {
  applyFilters,
  DEFAULT_FILTERS,
  inTab,
  isFiltered,
  defaultSortFor,
  sortClaims,
  statusOptionsFor,
  tabCounts,
  TABS,
  type ClaimFilters,
  type SortId,
  type TabId,
} from "@/logic/claims";
import { bulkActionsFor, type BulkActionId } from "@/logic/bulk";
import { isSpotCheck, isWaitOver, type LocalClaim } from "@/logic/local";
import { sectionsFor } from "@/logic/sections";
import { buildChatContext } from "@/logic/chat-context";
import { isoLocal } from "@/logic/time";
import { triageNote } from "@/logic/summary";
import { firstName } from "@/logic/actions";
import { TABS_LIST, TABS_TRIGGER } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import { track } from "@/logic/track";
import { setDecisionNotifier, useClaims } from "@/store/claims-store";
import { useWorkspace } from "@/store/workspace-store";
import { notInPrototype } from "@/features/shell/not-in-prototype";
import { RANGES } from "@/logic/claims";
import { controlSummary, lookAtScreen, pressControl, typeInField } from "./screen-control";
import { AiPanel } from "./ai-panel";
import { BulkActions } from "./bulk-actions";
import { ClaimsFilters } from "./claims-filters";
import { ClaimsQueue } from "./claims-queue";
import { MoreInfoPanel } from "./more-info-panel";
import { PastClaimModal } from "./past-claim-modal";
import { ClaimsTable } from "./claims-table";
import { AiBriefBanner } from "./daily-brief";
import type { MoreTab } from "./panel-types";

/** The tab a claim belongs on right now. A claim whose wait ended is back in Needs review. */
const tabOfClaim = (claim: LocalClaim | undefined, now: Date): TabId =>
  claim ? (["needs_review", "waiting", "done"] as TabId[]).find((t) => inTab([claim], t, now).length > 0) ?? "all" : "needs_review";

export function ClaimsView() {
  const { claims, now, skipAhead, sessionIds, undoLast, perform, performBatch, sendMessage } = useClaims();
  const { aiOpen, setAiOpen, addAiMessage, lastTriageClaim, setChatContext, setUiToolHandler, runAction, controlDialog, callControl, hasControl, setAiWidener, voiceOpen, homeRequest } = useWorkspace();
  const seenHome = useRef(homeRequest);
  const aiPanel = usePanelRef();

  // A card in the chat that needs room (the policy table) asks for a wider chat. It only ever widens, and never past the panel's limit.
  useEffect(() => {
    setAiWidener((px) => {
      const panel = aiPanel.current;
      if (panel && panel.getSize().inPixels < px) panel.resize(px);
    });
    return () => setAiWidener(null);
  });

  const [tab, setTab] = useState<TabId>("needs_review");
  const [filters, setFilters] = useState<ClaimFilters>(DEFAULT_FILTERS);
  // A sort chosen on a tab applies to that tab only. Until one is chosen, each tab uses its default.
  const [sortOverride, setSortOverride] = useState<{ tab: TabId; sort: SortId } | null>(null);
  const [briefDismissed, setBriefDismissed] = useState<Set<TabId>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pastId, setPastId] = useState<string | null>(null);
  const [moreTab, setMoreTab] = useState<MoreTab>("overview");
  const reopened = useRef<string | null>(null);

  // Tells the AI chat where the user is and what changed this session, each time a question is sent.
  useEffect(() => {
    setChatContext(() => {
      const f = [
        filters.range !== DEFAULT_FILTERS.range ? `date range ${RANGES.find((r) => r.id === filters.range)?.label}` : "",
        filters.employees.length ? `employees ${filters.employees.join(", ")}` : "",
        filters.statuses.length ? `statuses ${filters.statuses.join(", ")}` : "",
      ].filter(Boolean).join("; ");
      const unsent = callControl("employeeChat", { do: "read" }).draft;
      return buildChatContext(claims, {
        tab,
        openClaimId: openId,
        detailsOpen: openId !== null && detailsOpen,
        detailsTab: moreTab,
        search: filters.query,
        filters: f,
        pastClaimId: pastId,
        documentOpen: callControl("document", { do: "read" }).open === true,
        dialogOpen: hasControl("dialog"),
        unsentMessage: typeof unsent === "string" ? unsent : "",
        selectedCount: selectedIds.size,
        controls: controlSummary(),
        now: isoLocal(now),
        briefVisible: openId === null && tab !== "waiting" && !briefDismissed.has(tab === "done" ? "done" : "needs_review"),
        voice: voiceOpen,
      });
    });
    return () => setChatContext(null);
  });

  // The top bar logo asks for the Expenses list: close any open claim and return to the list.
  useEffect(() => {
    if (homeRequest !== seenHome.current) {
      seenHome.current = homeRequest;
      closeWorkspace();
    }
  });

  // The screen tools the chat can run (the list is src/logic/assistant-tools.ts). Registered on every render so they always see the current state.
  // Each one reports truthfully: ok only when the screen really changed, so the assistant never claims something that did not happen.
  useEffect(() => {
    const listOnly = { ok: false, error: "A claim is open. Go back to claims first." };
    const claimOnly = { ok: false, error: "No claim is open. Open one first." };
    const waitFor = async (ready: () => boolean) => {
      for (let i = 0; i < 30 && !ready(); i++) await new Promise((r) => setTimeout(r, 50));
      return ready();
    };
    // The claim a decision applies to: the past claim window if it is open, otherwise the open claim.
    const target = pastClaim ?? openClaim;

    setUiToolHandler(async (name, input) => {
      switch (name) {
        case "goToSection": {
          const section = String(input.section);
          if (section === "Home" || section === "Expenses") {
            closeWorkspace();
            return { ok: true, section };
          }
          notInPrototype(section);
          return { ok: false, error: `${section} is not in this prototype. Only Expenses is wired up, and a notice says so.` };
        }
        case "closeChat":
          setAiOpen(false);
          return { ok: true };
        case "openClaim": {
          const id = String(input.claimId ?? "");
          if (!claims.some((c) => c.id === id)) return { ok: false, error: `No claim ${id}.` };
          setPastId(null);
          openClaimById(id);
          return { ok: true, opened: id };
        }
        case "showClaimsTab": {
          if (openId !== null) return listOnly;
          setTab(String(input.tab) as TabId);
          setSelectedIds(new Set());
          return { ok: true, tab: input.tab };
        }
        case "searchClaims": {
          if (openId !== null) return listOnly;
          changeFilters({ ...filters, query: String(input.query ?? "") });
          return { ok: true, query: input.query };
        }
        case "setSort": {
          if (openId !== null) return listOnly;
          setSortOverride({ tab, sort: input.sort as SortId });
          return { ok: true, sort: input.sort };
        }
        case "setFilters": {
          if (openId !== null) return listOnly;
          const next = { ...filters };
          if (typeof input.dateRange === "string") next.range = input.dateRange as ClaimFilters["range"];
          if (Array.isArray(input.employees)) next.employees = input.employees as ClaimFilters["employees"];
          if (Array.isArray(input.statuses)) next.statuses = input.statuses as ClaimFilters["statuses"];
          changeFilters(next);
          return { ok: true, filters: { range: next.range, employees: next.employees, statuses: next.statuses } };
        }
        case "clearSearch":
          if (openId !== null) return listOnly;
          changeFilters(DEFAULT_FILTERS);
          return { ok: true };
        case "dismissBrief": {
          if (openId !== null) return listOnly;
          const id: TabId = tab === "done" ? "done" : "needs_review";
          if (tab === "waiting" || briefDismissed.has(id)) return { ok: false, error: "There is no brief banner showing." };
          dismissBrief(id);
          return { ok: true };
        }
        case "reviewAll":
          if (openId !== null) return listOnly;
          if (tab === "waiting") return { ok: false, error: "There is no brief banner on this tab." };
          if (tab === "done") reviewDone();
          else reviewAll();
          return { ok: true };
        case "selectClaims": {
          if (openId !== null) return listOnly;
          const visible = sections.flatMap((s) => (s.collapsible && !expanded.has(s.id) ? [] : s.claims.map((c) => c.id)));
          const mode = String(input.mode);
          if (mode === "all") setSelectedIds(new Set(visible));
          else if (mode === "none") setSelectedIds(new Set());
          else if (mode === "first") setSelectedIds(new Set(visible.slice(0, Number(input.count) || 1)));
          else {
            const ids = (Array.isArray(input.ids) ? input.ids : []).map(String);
            const missing = ids.filter((id) => !visible.includes(id));
            if (ids.length === 0 || missing.length > 0) return { ok: false, error: `Not visible in this list: ${missing.join(", ") || "no ids given"}.` };
            setSelectedIds(new Set(ids));
          }
          return { ok: true };
        }
        case "bulkAction": {
          if (openId !== null) return listOnly;
          const wanted = String(input.action) as BulkActionId;
          if (!bulkActionsFor(claims.filter((c) => selectedIds.has(c.id)), claims).some((a) => a.id === wanted)) {
            return { ok: false, error: `That bulk action is not available. It needs two or more selected claims that can all take it, and ${selectedIds.size} are selected.` };
          }
          return runBulk(wanted) ? { ok: true, action: wanted, count: selectedIds.size } : { ok: false, error: "The decisions could not be saved." };
        }
        case "toggleSection": {
          if (openId !== null) return listOnly;
          const id = String(input.sectionId);
          if (!sections.some((s) => s.id === id && s.collapsible)) return { ok: false, error: `No collapsible group ${id} on this tab.` };
          toggleSection(id);
          return { ok: true, group: id, expanded: !expanded.has(id) };
        }
        case "nextClaim":
          if (openId === null) return claimOnly;
          if (scopeIndex >= scopeIds.length - 1) return { ok: false, error: "This is the last claim in the group." };
          step(1);
          return { ok: true };
        case "previousClaim":
          if (openId === null) return claimOnly;
          if (scopeIndex <= 0) return { ok: false, error: "This is the first claim in the group." };
          step(-1);
          return { ok: true };
        case "backToClaims":
          if (openId === null) return { ok: false, error: "The claims list is already showing." };
          closeWorkspace();
          return { ok: true };
        case "openDetails":
          if (openId === null) return claimOnly;
          openMore(String(input.tab) as MoreTab);
          return { ok: true, tab: input.tab };
        case "closeDetails":
          if (openId === null || !detailsOpen) return { ok: false, error: "Details is not open." };
          setDetailsOpen(false);
          return { ok: true };
        case "viewDocument": {
          if (openId === null) return claimOnly;
          if (!detailsOpen || moreTab !== "overview") openMore("overview");
          if (!(await waitFor(() => hasControl("document")))) return { ok: false, error: "Details did not open." };
          return callControl("document", { do: "open", which: input.which, label: input.label });
        }
        case "closeDocument":
          return callControl("document", { do: "close" });
        case "skipAhead": {
          if (openId !== null) return listOnly;
          const days = Math.max(1, Math.min(60, Math.round(Number(input.days) || 1)));
          skipAhead(days);
          return { ok: true, days };
        }
        case "openPastClaim": {
          if (openId === null) return claimOnly;
          const id = String(input.claimId ?? "");
          if (!claims.some((c) => c.id === id)) return { ok: false, error: `No claim ${id}.` };
          if (id === openId) return { ok: false, error: "That is the claim already open." };
          setPastId(id);
          return { ok: true, opened: id };
        }
        case "closePastClaim":
          if (!pastId) return { ok: false, error: "No past claim is open." };
          setPastId(null);
          return { ok: true };
        case "lookAtScreen":
          return lookAtScreen();
        case "pressControl":
          return pressControl(String(input.label ?? ""));
        case "typeInField":
          return typeInField(String(input.field ?? ""), String(input.text ?? ""));
        case "messageEmployee": {
          // Sending needs no panel: the message goes straight to the claim's chat thread.
          if (input.send === true) {
            const target = claims.find((c) => c.id === (typeof input.claimId === "string" ? input.claimId : openId));
            const text = String(input.text ?? "").trim();
            if (!target) return claimOnly;
            if (!text) return { ok: false, error: "There was no text to send." };
            sendMessage(target.id, text);
            return { ok: true, sent: text, to: firstName(target), claimId: target.id, note: "The message is sent and the chat shows it as a card. Do not repeat it." };
          }
          if (openId === null) return claimOnly;
          setPastId(null);
          if (!detailsOpen || moreTab !== "chat") openMore("chat");
          if (!(await waitFor(() => hasControl("employeeChat")))) return { ok: false, error: "The employee chat did not open." };
          const typed = callControl("employeeChat", { do: "type", text: String(input.text ?? "") });
          if (typed.ok !== true || input.send !== true) return typed.ok === true ? { ...typed, sent: false, note: 'The message is typed in the chat box and not sent. Noa can say "send it" or "cancel".' } : typed;
          return callControl("employeeChat", { do: "send", text: String(input.text ?? "") });
        }
        case "undoLastDecision": {
          const id = undoLast(onReopen);
          return id ? { ok: true, undone: id } : { ok: false, error: "There is nothing to undo." };
        }
        case "takeAction": {
          if (!target) return claimOnly;
          const label = String(input.buttonLabel ?? "");
          if (target.status === "waiting_on_employee") {
            if (label === "Continue waiting") {
              if (pastId) {
                setPastId(null);
                return { ok: true };
              }
              if (scopeIndex >= scopeIds.length - 1) closeWorkspace();
              else step(1);
              return { ok: true, done: label };
            }
            if (label === "Decide now") {
              const result = perform(target.id, { id: "decide_now" }, { onUndo: onReopen });
              if (!result.ok) return { ok: false, error: "The decision could not be saved." };
              if (pastId) setPastId(null);
              else onDecided(target.id, result.status, "decide_now");
              return { ok: true, done: label };
            }
            return { ok: false, error: "That button is not available." };
          }
          if (pastId) return { ok: false, error: "That past claim is already decided. Use changeDecision, or close it first." };
          if (target.status !== "waiting_on_noa" && !isWaitOver(target, now)) return { ok: false, error: "This claim is not waiting for review. Use changeDecision to change it." };
          const result = runAction(label, {
            amount: typeof input.amount === "number" ? input.amount : undefined,
            message: typeof input.message === "string" ? input.message : undefined,
          });
          return result.ok ? { ok: true, done: label, ...(result.note ? { note: result.note } : {}) } : { ok: false, error: result.error ?? "That button is not available." };
        }
        case "changeDecision": {
          if (!target) return claimOnly;
          if (!(target.status.startsWith("approved") || target.status.startsWith("declined"))) return { ok: false, error: "This claim has no decision to change." };
          const to = input.decision === "approved" ? "approved" : "declined";
          const now = target.status.startsWith("approved") ? "approved" : "declined";
          if (to === now) return { ok: false, error: `It is already ${now}.` };
          const reason = typeof input.reason === "string" ? input.reason.trim() : "";
          if (to === "declined" && !reason) return { ok: false, error: "A reason is needed to decline. Ask Noa for one." };
          const note = typeof input.whatWentWrong === "string" ? input.whatWentWrong.trim() : "";
          const result = perform(
            target.id,
            { id: "correct", to, amount: to === "approved" ? target.amount.usd_claimed : undefined, feedback: note ? { option: "other", text: note } : null },
            { onUndo: onReopen },
          );
          if (!result.ok) return { ok: false, error: "The decision could not be saved." };
          if (to === "declined" && reason) sendMessage(target.id, reason);
          if (pastId) setPastId(null);
          else onDecided(target.id, result.status, "correct");
          return { ok: true, decision: to, ...(to === "declined" ? { note: "The reason was sent to the employee in the claim chat." } : {}) };
        }
        case "confirmDialog":
          return { ...controlDialog("confirm") };
        case "cancelDialog":
          return { ...controlDialog("cancel") };
        default:
          return { ok: false, error: `Unknown screen action ${name}.` };
      }
    });
    return () => setUiToolHandler(null);
  });

  const brief = useMemo(() => buildDailyBrief(claims, now), [claims, now]);
  const doneBrief = useMemo(() => buildDoneBrief(claims, now), [claims, now]);
  const counts = useMemo(() => tabCounts(claims, filters, now), [claims, filters, now]);
  const sort: SortId = sortOverride?.tab === tab ? sortOverride.sort : defaultSortFor(tab);
  const rows = useMemo(() => sortClaims(inTab(applyFilters(claims, filters, now), tab, now), sort), [claims, filters, tab, now, sort]);
  const sections = useMemo(() => sectionsFor(tab, rows), [tab, rows]);

  const filtered = isFiltered(filters);
  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "";

  // Triage panel scope: the group the open claim is in, so "2 of 5 spot checks" counts what the list shows.
  const openClaim = claims.find((c) => c.id === openId) ?? null;
  const section = openClaim ? sections.find((s) => s.claims.some((c) => c.id === openClaim.id)) : undefined;
  const scopeIds = section ? section.claims.map((c) => c.id) : openClaim ? [openClaim.id] : [];
  const scopeIndex = openClaim ? Math.max(0, scopeIds.indexOf(openClaim.id)) : 0;
  const position = openClaim ? { index: scopeIndex, total: scopeIds.length, noun: section?.noun ?? "claims" } : null;

  function changeFilters(next: ClaimFilters) {
    setFilters(next);
    setSelectedIds(new Set());
    if (next.query !== filters.query) track("search_used");
    else track("filter_used");
  }

  // The chat is one continuous conversation. Each time a new claim comes up it adds a short note (policy gap, recommendation, reasoning).
  function postTriageNote(claim: LocalClaim) {
    if (lastTriageClaim() === claim.id) return;
    const { heading, text, suggest } = triageNote(claim, claims, now);
    addAiMessage({ role: "assistant", text, heading, claimId: claim.id, suggest: suggest ?? undefined, triage: true });
  }

  function openClaimById(id: string) {
    track("claim_opened", { claim: id });
    const claim = claims.find((c) => c.id === id);
    const entering = openId === null;
    if (claim) postTriageNote(claim);
    if (entering) setAiOpen(true);
    setOpenId(id);
  }

  // After an undo, the claim comes back into the chat with a fresh note once its state is back.
  useEffect(() => {
    const id = reopened.current;
    const claim = id ? claims.find((c) => c.id === id) : null;
    if (claim) {
      reopened.current = null;
      postTriageNote(claim);
    }
  });

  // Decisions are confirmed in the chat, with an Undo button, instead of in a toast.
  useEffect(() => {
    setDecisionNotifier(({ summary, entryId, claimId }) => {
      addAiMessage({ role: "assistant", text: summary, claimId, undo: { entryId } });
      setAiOpen(true);
    });
    return () => setDecisionNotifier(null);
  });

  function closeWorkspace() {
    setOpenId(null);
    setDetailsOpen(false);
    setPastId(null);
    // Going back to the claims list closes the chat pane, unless voice mode is on: the conversation carries on there.
    if (!voiceOpen) setAiOpen(false);
  }

  function openMore(nextTab: MoreTab = "overview") {
    track("more_info_opened", { tab: nextTab });
    setMoreTab(nextTab);
    if (openId !== null) setDetailsOpen(true);
  }

  // A past claim opens in a modal over the review. Closing it, or deciding on it, leaves the review exactly as it was.
  const pastClaim = claims.find((c) => c.id === pastId) ?? null;

  // After a decision, move on: to the next claim in the group, or close when there is none (PRD FR-ACT-1).
  function onDecided(claimId: string, status: Status, action: ActionId) {
    const statuses = TABS.find((t) => t.id === tab)?.statuses;
    const leavesTab = statuses ? !statuses.includes(status) : false;
    if (!leavesTab && action !== "confirm") return;
    const index = scopeIds.indexOf(claimId);
    const next = scopeIds[index + 1] ?? scopeIds[index - 1] ?? null;
    if (next && next !== claimId) openClaimById(next);
    else closeWorkspace();
  }

  // After an undo, bring the claim back into view, on the tab it returned to.
  function onReopen(claimId: string) {
    const claim = claims.find((c) => c.id === claimId);
    setTab(tabOfClaim(claim, now));
    setOpenId(claimId);
    // The note is posted once the undone claim is in its new state, in the effect below.
    reopened.current = claimId;
  }

  const step = (delta: number) => {
    const target = scopeIds[scopeIndex + delta];
    if (target) openClaimById(target);
  };

  function reviewAll() {
    setTab("needs_review");
    const first = sortClaims(inTab(applyFilters(claims, DEFAULT_FILTERS, now), "needs_review", now), defaultSortFor("needs_review"))[0];
    if (first) openClaimById(first.id);
  }

  // The Done brief's review opens the Done queue, newest first.
  function reviewDone() {
    setTab("done");
    const first = sortClaims(inTab(applyFilters(claims, DEFAULT_FILTERS, now), "done", now), defaultSortFor("done"))[0];
    if (first) openClaimById(first.id);
  }

  const dismissBrief = (id: TabId) => setBriefDismissed((prev) => new Set(prev).add(id));

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedClaims = claims.filter((c) => selectedIds.has(c.id));
  const bulkActions = bulkActionsFor(selectedClaims, claims);

  function runBulk(id: BulkActionId): boolean {
    const action = bulkActions.find((a) => a.id === id);
    if (!action) return false;
    const result = performBatch(selectedClaims.map((c) => c.id), id, action.input);
    if (!result.ok) {
      toast.error("Decisions not saved", { description: "Nothing was changed. Try again." });
      return false;
    }
    setSelectedIds(new Set());
    return true;
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    const visible = sections.flatMap((s) => (s.collapsible && !expanded.has(s.id) ? [] : s.claims));
    setSelectedIds(checked ? new Set(visible.map((c) => c.id)) : new Set());
  }

  const inTriage = openClaim !== null && position !== null;

  // Cleared-queue summary from what was decided this session (PRD EMP-1).
  const sessionClaims = claims.filter((c) => sessionIds.includes(c.id));
  const decidedCount = sessionClaims.filter((c) => c.status === "approved_by_noa" || c.status === "declined_by_noa").length;
  const financeCount = sessionClaims.filter((c) => c.status === "waiting_on_finance").length;
  const waitingCount = sessionClaims.filter((c) => c.status === "waiting_on_employee").length;
  const cleared = tab === "needs_review" && !filtered && rows.length === 0;
  const hasSpotChecks = claims.some((c) => c.status === "approved_by_agent" && isSpotCheck(c));

  return (
    <div className={cn("w-full", inTriage ? "h-[calc(100svh-var(--header-height))] overflow-hidden" : "min-h-[calc(100svh-var(--header-height))]")}>
      <ResizablePanelGroup className={inTriage ? "h-full" : "h-auto min-h-[calc(100svh-var(--header-height))]"}>
        <ResizablePanel id="main" minSize={420} style={{ overflow: inTriage ? "hidden" : "visible" }}>
          {inTriage ? (
            <ClaimsQueue
              claim={openClaim}
              allClaims={claims}
              queueTitle={tab === "done" ? "Done Queue" : tab === "all" ? "All Claims" : tab === "waiting" ? "Waiting on others" : "Claims Queue"}
              position={position}
              onPrev={scopeIndex > 0 ? () => step(-1) : undefined}
              onNext={scopeIndex < scopeIds.length - 1 ? () => step(1) : undefined}
              onBack={closeWorkspace}
              onOpenDetails={() => openMore(moreTab)}
              onOpenMore={openMore}
              onDecided={onDecided}
              onReopen={onReopen}
            />
          ) : (
      <main className="mx-auto flex min-w-0 w-full max-w-[1400px] flex-1 flex-col gap-6 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Claims</h1>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            track("tab_changed", { tab: value });
            setTab(value as TabId);
            // Status choices belong to the tab they were made on, so they start over here.
            setFilters((f) => ({ ...f, statuses: [] }));
            setSelectedIds(new Set());
          }}
        >
          <TabsList variant="line" className={cn(TABS_LIST, "w-full justify-start gap-4")}>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className={cn(TABS_TRIGGER, "flex-none px-1.5")}>
                {t.label}
                <Badge variant="secondary" aria-label={`${counts[t.id]} claims`}>
                  {counts[t.id]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "done" ? (
          !briefDismissed.has("done") ? (
            <AiBriefBanner
              title={`Done brief, ${doneBrief.dateLabel}`}
              text={doneBriefSentence(doneBrief)}
              reviewCount={doneBrief.done}
              onDismiss={() => dismissBrief("done")}
              onReviewAll={reviewDone}
            />
          ) : null
        ) : tab !== "waiting" && !briefDismissed.has("needs_review") ? (
          <AiBriefBanner
            title="Good morning Noa, let's get started."
            text={briefSentence(brief)}
            reviewCount={brief.needsYou}
            onDismiss={() => dismissBrief("needs_review")}
            onReviewAll={reviewAll}
          />
        ) : null}

        <ClaimsFilters filters={filters} onChange={changeFilters} onReset={() => changeFilters(DEFAULT_FILTERS)} canReset={filtered}
          statusOptions={statusOptionsFor(tab)}
          sort={sort}
          onSortChange={(next) => setSortOverride({ tab, sort: next })}
          trailing={
            <>
              <BulkActions actions={bulkActions} onRun={runBulk} />
              {tab === "waiting" ? (
                // Demo clock: lets a wait end so its claim returns to Needs review. Not part of the product.
                <Button variant="outline" size="sm" onClick={() => skipAhead(1)}>
                  Skip ahead 1 day
                </Button>
              ) : null}
            </>
          }
        />

        {rows.length > 0 ? (
          <>
            <ClaimsTable
              tab={tab}
              sections={sections}
              expanded={expanded}
              onToggleSection={toggleSection}
              selectedIds={selectedIds}
              activeId={openId}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              onReview={openClaimById}
            />
            {selectedIds.size > 0 ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {selectedIds.size} selected.
              </p>
            ) : null}
          </>
        ) : cleared ? (
          <Empty className="rounded-xl border bg-card py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">{sessionIds.length > 0 ? <PartyPopper /> : <Sparkles />}</EmptyMedia>
              <EmptyTitle>{sessionIds.length > 0 ? "Queue cleared" : "Nothing needs review"}</EmptyTitle>
              <EmptyDescription>
                {sessionIds.length > 0
                  ? `Decided ${decidedCount}, sent ${financeCount} to Finance, ${waitingCount} waiting on employees.`
                  : `${brief.approvedByOrvo} claims were approved automatically. Nothing needs review.`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              {hasSpotChecks ? (
                <Button variant="outline" onClick={() => setTab("done")}>
                  Spot check automatic approvals
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setTab("done")}>
                  Look through automatic approvals
                </Button>
              )}
              <Button variant="outline" onClick={() => setTab("waiting")}>
                See waiting on others
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="rounded-xl border bg-card py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>{filtered ? `No claims match in ${tabLabel}` : `Nothing in ${tabLabel}`}</EmptyTitle>
              <EmptyDescription>
                {filtered ? "Try a different search or clear the filters. Other tabs may have matches." : "Claims will show up here when they reach this stage."}
              </EmptyDescription>
            </EmptyHeader>
            {filtered ? (
              <EmptyContent>
                <Button variant="outline" onClick={() => changeFilters(DEFAULT_FILTERS)}>
                  Clear search and filters
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </main>
          )}
        </ResizablePanel>
        {inTriage && detailsOpen ? (
          <>
            <ResizableHandle />
            <ResizablePanel id="details" defaultSize={520} minSize={420} maxSize={720} groupResizeBehavior="preserve-pixel-size" style={{ overflow: "hidden" }}>
              <MoreInfoPanel claim={openClaim} allClaims={claims} tab={moreTab} onTab={setMoreTab} onClose={() => setDetailsOpen(false)} onOpenPastClaim={setPastId} />
            </ResizablePanel>
          </>
        ) : null}
        {aiOpen ? (
          <>
            <ResizableHandle />
            <ResizablePanel id="ai" panelRef={aiPanel} defaultSize={352} minSize={280} maxSize={720} groupResizeBehavior="preserve-pixel-size" style={{ overflow: "hidden" }}>
              <AiPanel
                claim={openClaim}
                allClaims={claims}
                onClose={() => setAiOpen(false)}
                onOpenMore={openMore}
              />
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
      {pastClaim ? (
        <PastClaimModal claim={pastClaim} allClaims={claims} onClose={() => setPastId(null)} onDecided={() => setPastId(null)} onReopen={setPastId} />
      ) : null}
    </div>
  );
}
