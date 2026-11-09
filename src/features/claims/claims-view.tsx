"use client";

import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataset } from "@/data";
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
import { buildDailyBrief } from "@/logic/brief";
import { ClaimsFilters } from "./claims-filters";
import { ClaimsTable } from "./claims-table";
import { DailyBriefBanner } from "./daily-brief";

const claims = dataset.claims;

export function ClaimsView() {
  const [tab, setTab] = useState<TabId>("needs_review");
  const [filters, setFilters] = useState<ClaimFilters>(DEFAULT_FILTERS);
  const [briefDismissed, setBriefDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const brief = useMemo(() => buildDailyBrief(claims), []);
  const counts = useMemo(() => tabCounts(claims, filters), [filters]);
  const rows = useMemo(
    () => sortForTab(inTab(applyFilters(claims, filters), tab), tab),
    [filters, tab],
  );

  const filtered = isFiltered(filters);
  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "";
  const totalInTab = inTab(claims, tab).length;

  function changeFilters(next: ClaimFilters) {
    setFilters(next);
    setSelectedIds(new Set());
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
    setSelectedIds(checked ? new Set(rows.map((c) => c.id)) : new Set());
  }

  function reviewAll() {
    setTab("needs_review");
    setActiveId(sortForTab(inTab(applyFilters(claims, DEFAULT_FILTERS), "needs_review"), "needs_review")[0]?.id ?? null);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Claims</h1>

      {!briefDismissed ? (
        <DailyBriefBanner brief={brief} onDismiss={() => setBriefDismissed(true)} onReviewAll={reviewAll} />
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) => {
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

      <ClaimsFilters
        filters={filters}
        onChange={changeFilters}
        onReset={() => changeFilters(DEFAULT_FILTERS)}
        canReset={filtered}
        showStatus={tab === "all"}
      />

      {rows.length > 0 ? (
        <>
          <ClaimsTable
            claims={rows}
            selectedIds={selectedIds}
            activeId={activeId}
            onToggle={toggleOne}
            onToggleAll={toggleAll}
            onReview={setActiveId}
          />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {selectedIds.size > 0 ? `${selectedIds.size} selected. ` : ""}
            {rows.length} of {totalInTab} claims. {tab === "needs_review" ? "Oldest first." : "Newest first."}
          </p>
        </>
      ) : (
        <Empty className="rounded-xl border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>{filtered ? `No claims match in ${tabLabel}` : `Nothing in ${tabLabel}`}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try a different search or clear the filters. Other tabs may have matches."
                : "Claims will show up here when they reach this stage."}
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
  );
}
