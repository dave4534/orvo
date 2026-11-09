"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PartyPopper, SearchX, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import { buildDailyBrief, buildDoneBrief, briefSentence, doneBriefSentence } from "@/logic/brief";
import {
  applyFilters,
  DEFAULT_FILTERS,
  inTab,
  isFiltered,
  sortForTab,
  tabCounts,
  TABS,
  type ClaimFilters,
  type TabId,
} from "@/logic/claims";
import { isSpotCheck } from "@/logic/local";
import { sectionsFor } from "@/logic/sections";
import { buildChatContext } from "@/logic/chat-context";
import { claimSummary } from "@/logic/summary";
import { cn } from "@/lib/utils";
import { track } from "@/logic/track";
import { useClaims } from "@/store/claims-store";
import { LIST_SESSION, useWorkspace } from "@/store/workspace-store";
import { AiPanel } from "./ai-panel";
import { ClaimsFilters } from "./claims-filters";
import { ClaimsQueue } from "./claims-queue";
import { MoreInfoPanel } from "./more-info-panel";
import { PastClaimModal } from "./past-claim-modal";
import { ClaimsTable } from "./claims-table";
import { AiBriefBanner } from "./daily-brief";
import type { MoreTab } from "./panel-types";

const tabOfStatus = (status: Status): TabId =>
  TABS.find((t) => t.statuses?.includes(status))?.id ?? "all";

export function ClaimsView() {
  const { claims, sessionIds, simulateError, setSimulateError, reset, undoLast } = useClaims();
  const { aiOpen, setAiOpen, setAiSession, addAiMessage, hasAiMessages, resetAi, setChatContext, setUiToolHandler, runAction, voiceOpen, homeRequest } = useWorkspace();
  const seenHome = useRef(homeRequest);

  const [tab, setTab] = useState<TabId>("needs_review");
  const [filters, setFilters] = useState<ClaimFilters>(DEFAULT_FILTERS);
  const [briefDismissed, setBriefDismissed] = useState<Set<TabId>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pastId, setPastId] = useState<string | null>(null);
  const [moreTab, setMoreTab] = useState<MoreTab>("overview");

  // Tells the AI chat where the user is and what changed this session, each time a question is sent.
  useEffect(() => {
    setChatContext(() => buildChatContext(claims, { tab, openClaimId: openId, detailsOpen: openId !== null && detailsOpen, detailsTab: moreTab, search: filters.query, voice: voiceOpen }));
    return () => setChatContext(null);
  });

  // The top bar logo asks for the Expenses list: close any open claim and return to the list.
  useEffect(() => {
    if (homeRequest !== seenHome.current) {
      seenHome.current = homeRequest;
      closeWorkspace();
    }
  });

  // The screen tools the chat can run. Registered on every render so they always see the current state.
  useEffect(() => {
    setUiToolHandler((name, input) => {
      switch (name) {
        case "openClaim": {
          const id = String(input.claimId ?? "");
          if (!claims.some((c) => c.id === id)) return { ok: false, error: `No claim ${id}.` };
          openClaimById(id);
          return { ok: true, opened: id };
        }
        case "showClaimsTab": {
          if (openId !== null) return { ok: false, error: "A claim is open. Go back to claims first." };
          setTab(String(input.tab) as TabId);
          return { ok: true, tab: input.tab };
        }
        case "nextClaim":
          if (scopeIndex >= scopeIds.length - 1) return { ok: false, error: "This is the last claim in the group." };
          step(1);
          return { ok: true };
        case "previousClaim":
          if (scopeIndex <= 0) return { ok: false, error: "This is the first claim in the group." };
          step(-1);
          return { ok: true };
        case "backToClaims":
          closeWorkspace();
          return { ok: true };
        case "openDetails":
          if (openId === null) return { ok: false, error: "No claim is open." };
          openMore(String(input.tab) as MoreTab);
          return { ok: true, tab: input.tab };
        case "closeDetails":
          setDetailsOpen(false);
          return { ok: true };
        case "undoLastDecision": {
          const id = undoLast(onReopen);
          return id ? { ok: true, undone: id } : { ok: false, error: "There is nothing to undo." };
        }
        case "takeAction": {
          if (openClaim?.status !== "waiting_on_noa") return { ok: false, error: "This claim is not waiting for review." };
          const done = runAction(String(input.buttonLabel ?? ""));
          return done ? { ok: true, done: input.buttonLabel } : { ok: false, error: "That button is not available." };
        }
        default:
          return { ok: false, error: `Unknown screen action ${name}.` };
      }
    });
    return () => setUiToolHandler(null);
  });

  const brief = useMemo(() => buildDailyBrief(claims), [claims]);
  const doneBrief = useMemo(() => buildDoneBrief(claims), [claims]);
  const counts = useMemo(() => tabCounts(claims, filters), [claims, filters]);
  const rows = useMemo(() => sortForTab(inTab(applyFilters(claims, filters), tab), tab), [claims, filters, tab]);
  const approvedTotal = claims.filter((c) => c.status === "approved_by_agent").length;
  const sections = useMemo(() => sectionsFor(tab, rows, approvedTotal), [tab, rows, approvedTotal]);

  const filtered = isFiltered(filters);
  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "";
  const totalInTab = inTab(claims, tab).length;

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

  // Opening a claim posts its summary and recommendation in the AI chat. The first claim of a visit also opens the chat with a greeting.
  function openClaimById(id: string) {
    track("claim_opened", { claim: id });
    const claim = claims.find((c) => c.id === id);
    const entering = openId === null;
    // Every claim has its own chat. A new one starts with the summary and the recommendation, in one message.
    if (claim && !hasAiMessages(id)) {
      const { summary, recommendation, recommendationLabel } = claimSummary(claim);
      const text = [entering ? "Let's review the open claims." : null, summary, recommendation].filter(Boolean).join("\n\n");
      addAiMessage(id, { role: "assistant", text, claimId: claim.id, suggest: recommendationLabel ?? undefined });
    }
    if (entering) setAiOpen(true);
    setAiSession(id);
    setOpenId(id);
  }

  function closeWorkspace() {
    setOpenId(null);
    setDetailsOpen(false);
    setPastId(null);
    // Going back to the claims list closes the chat pane.
    setAiOpen(false);
    setAiSession(LIST_SESSION);
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
    setTab(tabOfStatus(claim?.status ?? "waiting_on_noa"));
    setAiSession(claimId);
    setOpenId(claimId);
  }

  const step = (delta: number) => {
    const target = scopeIds[scopeIndex + delta];
    if (target) openClaimById(target);
  };

  function reviewAll() {
    setTab("needs_review");
    const first = sortForTab(inTab(applyFilters(claims, DEFAULT_FILTERS), "needs_review"), "needs_review")[0];
    if (first) openClaimById(first.id);
  }

  // The Done brief's review opens the Done queue, newest first.
  function reviewDone() {
    setTab("done");
    const first = sortForTab(inTab(applyFilters(claims, DEFAULT_FILTERS), "done"), "done")[0];
    if (first) openClaimById(first.id);
  }

  const dismissBrief = (id: TabId) => setBriefDismissed((prev) => new Set(prev).add(id));

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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Claims</h1>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Demo <ChevronDown data-icon="inline-end" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuCheckboxItem checked={simulateError} onCheckedChange={(c) => setSimulateError(c)}>
                Simulate a save error
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  reset();
                  resetAi();
                  closeWorkspace();
                  setTab("needs_review");
                  setFilters(DEFAULT_FILTERS);
                  setSelectedIds(new Set());
                  setBriefDismissed(new Set());
                }}
              >
                Reset demo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            track("tab_changed", { tab: value });
            setTab(value as TabId);
            setSelectedIds(new Set());
          }}
        >
          <TabsList variant="line" className="h-11 w-full justify-start border-b pb-0">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="flex-none px-3 text-base">
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
            title={`Daily brief, ${brief.dateLabel}`}
            text={briefSentence(brief)}
            reviewCount={brief.needsYou}
            onDismiss={() => dismissBrief("needs_review")}
            onReviewAll={reviewAll}
          />
        ) : null}

        <ClaimsFilters filters={filters} onChange={changeFilters} onReset={() => changeFilters(DEFAULT_FILTERS)} canReset={filtered} showStatus={tab === "all"} />

        {rows.length > 0 ? (
          <>
            <ClaimsTable
              sections={sections}
              expanded={expanded}
              onToggleSection={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              selectedIds={selectedIds}
              activeId={openId}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              onReview={openClaimById}
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {selectedIds.size > 0 ? `${selectedIds.size} selected. ` : ""}
              {rows.length} of {totalInTab} claims. {tab === "needs_review" ? "Oldest first." : "Newest first."}
            </p>
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
            <ResizablePanel id="ai" defaultSize={352} minSize={280} maxSize={560} groupResizeBehavior="preserve-pixel-size" style={{ overflow: "hidden" }}>
              <AiPanel
                key={openClaim?.id ?? LIST_SESSION}
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
