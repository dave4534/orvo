import type { TabId } from "./claims";
import { isSpotCheck, type LocalClaim } from "./local";

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
export function sectionsFor(tab: TabId, rows: LocalClaim[], approvedByOrvoTotal: number): Section[] {
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
          ? [
              (() => {
                const spot = where((c) => c.status === "approved_by_agent" && isSpotCheck(c));
                const toReview = spot.filter((c) => !c.local?.spot_checked).length;
                return {
                  id: "spot",
                  label: `SPOT CHECK, ${spot.length} OF ${approvedByOrvoTotal} APPROVED BY ORVO${toReview > 0 && toReview < spot.length ? `, ${toReview} TO REVIEW` : ""}`,
                  noun: "spot checks",
                  claims: spot,
                };
              })(),
              { id: "declined", label: "DECLINED BY ORVO", noun: "declined by Orvo", claims: where((c) => c.status === "declined_by_agent") },
              { id: "decided", label: "DECIDED BY YOU", noun: "decided by you", claims: where((c) => c.status === "approved_by_noa" || c.status === "declined_by_noa") },
              {
                id: "approved",
                label: "APPROVED BY ORVO",
                noun: "approved by Orvo",
                claims: where((c) => c.status === "approved_by_agent" && !isSpotCheck(c)),
                collapsible: true,
              },
            ]
          : [{ id: "all", noun: "claims", claims: rows }];
  return sections.filter((s) => s.claims.length > 0);
}
