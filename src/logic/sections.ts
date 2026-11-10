import type { TabId } from "./claims";
import type { LocalClaim } from "./local";

export type Section = {
  id: string;
  /** Group header. Absent for tabs that are one plain list. */
  label?: string;
  /** What "n of m" counts while the triage panel moves through this section. */
  noun: string;
  claims: LocalClaim[];
  /** Collapsed by default, with a toggle (PRD 6.6). */
  collapsible?: boolean;
};

/** Groups the visible rows of a tab. PRD 6.6. Empty groups are dropped. */
export function sectionsFor(tab: TabId, rows: LocalClaim[]): Section[] {
  const where = (fn: (c: LocalClaim) => boolean) => rows.filter(fn);
  const sections: Section[] =
    tab === "needs_review"
      ? [{ id: "needs_review", noun: "to review", claims: rows }]
      : tab === "waiting"
        ? [
            { id: "waiting_employee", label: "WAITING ON EMPLOYEE", noun: "waiting on employee", claims: where((c) => c.status === "waiting_on_employee") },
            { id: "waiting_finance", label: "WAITING ON FINANCE", noun: "with Finance", claims: where((c) => c.status === "waiting_on_finance") },
          ]
        : tab === "done"
          ? [{ id: "done", noun: "done", claims: rows }]
          : [{ id: "all", noun: "claims", claims: rows }];
  return sections.filter((s) => s.claims.length > 0);
}
