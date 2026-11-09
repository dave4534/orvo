import type { Person } from "@/data/types";
import type { LocalClaim } from "./local";

/** Lower case, accent-insensitive, quotes and currency signs removed. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/["'’“”$,]/g, "");
}

const words = (text: string) => normalize(text).split(/[\s;:()/\-]+/).filter(Boolean);

/** Words a claim can be found by: employee, id, merchant, description, note, amounts. PRD FR-SRCH-1. */
export function searchWords(claim: LocalClaim, employee: Person | undefined): string[] {
  const amount = claim.amount.usd_claimed;
  return [
    ...words(employee?.name ?? ""),
    ...words(claim.id),
    ...words(claim.merchant),
    ...words(claim.description),
    ...words(claim.employee_note ?? ""),
    amount.toFixed(2),
    String(amount),
    amount.toLocaleString("en-US", { minimumFractionDigits: 2 }).replace(/,/g, ""),
  ].map(normalize);
}

/** Every typed word must match the start of some word. PRD FR-SRCH-2. */
export function matchesQuery(claim: LocalClaim, employee: Person | undefined, query: string): boolean {
  const terms = words(query);
  if (terms.length === 0) return true;
  const haystack = searchWords(claim, employee);
  return terms.every((term) => haystack.some((w) => w.startsWith(term)));
}
