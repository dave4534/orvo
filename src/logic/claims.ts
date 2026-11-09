import type { Claim, PersonId, Status } from "@/data/types";
import { dataset, NOW } from "@/data";
import { matchesQuery } from "./search";

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
export function applyFilters(claims: Claim[], f: ClaimFilters, now: Date = NOW): Claim[] {
  const range = RANGES.find((r) => r.id === f.range);
  const cutoff = range?.hours ? now.getTime() - range.hours * 3_600_000 : null;
  return claims.filter((c) => {
    if (f.employees.length > 0 && !f.employees.includes(c.employee_id)) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(c.status)) return false;
    if (cutoff !== null && new Date(c.submitted_at).getTime() < cutoff) return false;
    return matchesQuery(c, personById(c.employee_id), f.query);
  });
}

export function inTab(claims: Claim[], tab: TabId): Claim[] {
  const statuses = TABS.find((t) => t.id === tab)?.statuses;
  return statuses ? claims.filter((c) => statuses.includes(c.status)) : claims;
}

/** Needs review: oldest first, because the metric is time to approval. Other tabs: newest first. PRD 6.6. */
export function sortForTab(claims: Claim[], tab: TabId): Claim[] {
  const dir = tab === "needs_review" ? 1 : -1;
  return [...claims].sort(
    (a, b) => dir * (new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()),
  );
}

export function tabCounts(claims: Claim[], f: ClaimFilters): Record<TabId, number> {
  const filtered = applyFilters(claims, f);
  return Object.fromEntries(TABS.map((t) => [t.id, inTab(filtered, t.id).length])) as Record<TabId, number>;
}
