import type { PersonId, Status } from "@/data/types";
import { isWaitOver, type LocalClaim } from "./local";
import { dataset, NOW } from "@/data";
import { matchesQuery } from "./search";
import { displayName } from "./format";

export type TabId = "needs_review" | "waiting" | "done" | "all";

export const TABS: { id: TabId; label: string; statuses: Status[] | null }[] = [
  { id: "needs_review", label: "Needs review", statuses: ["waiting_on_noa"] },
  { id: "waiting", label: "Waiting on others", statuses: ["waiting_on_employee", "waiting_on_finance"] },
  {
    id: "done",
    label: "Done",
    statuses: ["approved_by_agent", "approved_by_noa", "declined_by_agent", "declined_by_noa"],
  },
  { id: "all", label: "All", statuses: null },
];

export type RangeId = "this_week" | "last_3_days" | "last_24_hours";

export const RANGES: { id: RangeId; label: string; hours: number | null }[] = [
  { id: "this_week", label: "This week", hours: null },
  { id: "last_3_days", label: "Last 3 days", hours: 72 },
  { id: "last_24_hours", label: "Last 24 hours", hours: 24 },
];

export type ClaimFilters = {
  query: string;
  range: RangeId;
  employees: PersonId[];
  statuses: Status[];
};

export const DEFAULT_FILTERS: ClaimFilters = {
  query: "",
  range: "this_week",
  employees: [],
  statuses: [],
};

export const STATUS_FILTER_OPTIONS: Status[] = [
  "waiting_on_noa",
  "waiting_on_employee",
  "waiting_on_finance",
  "approved_by_agent",
  "declined_by_agent",
  "approved_by_noa",
  "declined_by_noa",
];

const people = new Map(dataset.people.map((p) => [p.id, p]));
export const personById = (id: PersonId) => people.get(id);
export const teamMembers = dataset.people.filter((p) => p.role === "team_member");

export const isFiltered = (f: ClaimFilters) =>
  f.query.trim() !== "" || f.range !== DEFAULT_FILTERS.range || f.employees.length > 0 || f.statuses.length > 0;

/** Search and filters, without the tab. Tab counts are computed over this set. PRD 4.3. */
export function applyFilters(claims: LocalClaim[], f: ClaimFilters, now: Date = NOW): LocalClaim[] {
  const range = RANGES.find((r) => r.id === f.range);
  const cutoff = range?.hours ? now.getTime() - range.hours * 3_600_000 : null;
  return claims.filter((c) => {
    if (f.employees.length > 0 && !f.employees.includes(c.employee_id)) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(c.status)) return false;
    if (cutoff !== null && new Date(c.submitted_at).getTime() < cutoff) return false;
    return matchesQuery(c, personById(c.employee_id), f.query);
  });
}

/** A claim whose wait has ended comes back to Needs review and leaves Waiting on others. */
export function inTab(claims: LocalClaim[], tab: TabId, now: Date = NOW): LocalClaim[] {
  if (tab === "needs_review") return claims.filter((c) => c.status === "waiting_on_noa" || isWaitOver(c, now));
  if (tab === "waiting") return claims.filter((c) => (c.status === "waiting_on_employee" || c.status === "waiting_on_finance") && !isWaitOver(c, now));
  const statuses = TABS.find((t) => t.id === tab)?.statuses;
  return statuses ? claims.filter((c) => statuses.includes(c.status)) : claims;
}

export type SortId = "wait" | "newest" | "amount" | "employee" | "declined";

export const SORTS: { id: SortId; label: string }[] = [
  { id: "wait", label: "Wait time" },
  { id: "newest", label: "Newest submitted" },
  { id: "amount", label: "Amount, highest first" },
  { id: "employee", label: "Employee, A to Z" },
  { id: "declined", label: "Declined first" },
];

/** Needs review sorts by wait time (PRD 6.6, the metric is time to approval). Done starts with declined claims. */
export const defaultSortFor = (tab: TabId): SortId => (tab === "done" ? "declined" : "wait");

/** Status filter options for a tab: only the statuses that can appear there. */
export const statusOptionsFor = (tab: TabId): Status[] => TABS.find((t) => t.id === tab)?.statuses ?? STATUS_FILTER_OPTIONS;

const time = (c: LocalClaim) => new Date(c.submitted_at).getTime();

export function sortClaims(claims: LocalClaim[], sort: SortId): LocalClaim[] {
  const byWait = (a: LocalClaim, b: LocalClaim) => time(a) - time(b);
  const rank = (c: LocalClaim) => (c.status === "declined_by_agent" || c.status === "declined_by_noa" ? 0 : 1);
  switch (sort) {
    case "wait":
      return [...claims].sort(byWait);
    case "newest":
      return [...claims].sort((a, b) => time(b) - time(a));
    case "amount":
      return [...claims].sort((a, b) => b.amount.usd_claimed - a.amount.usd_claimed || byWait(a, b));
    case "employee":
      return [...claims].sort((a, b) => displayName(personById(a.employee_id) ?? { name: "" }).localeCompare(displayName(personById(b.employee_id) ?? { name: "" })) || byWait(a, b));
    case "declined":
      return [...claims].sort((a, b) => rank(a) - rank(b) || byWait(a, b));
  }
}

export function tabCounts(claims: LocalClaim[], f: ClaimFilters, now: Date = NOW): Record<TabId, number> {
  const filtered = applyFilters(claims, f, now);
  return Object.fromEntries(TABS.map((t) => [t.id, inTab(filtered, t.id, now).length])) as Record<TabId, number>;
}
