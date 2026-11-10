"use client";

import { FlagIcon } from "@/components/icons/flag";
import { Button } from "@/components/ui/button";
import { canRemoveFlag, flagLabel, flagsForEmployee } from "@/logic/flags";
import { formatSubmitted } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import { FLAG_DISPLAY_DAYS } from "@/logic/policy";
import { cn } from "@/lib/utils";
import { useClaims } from "@/store/claims-store";
import { SectionLabel } from "./claim-sections";

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  /** Opens another claim of the same employee, the same as a row in the past claims table. */
  onOpenClaim: (id: string) => void;
};

/**
 * The employee's flags under the past claims table: one row per flag, newest first. A row opens its claim. The agent's flags come with the
 * claims and cannot be removed. A flag the manager added can be removed for a while, in case it was a mistake or she learned more.
 */
export function FlagList({ claim, allClaims, onOpenClaim }: Props) {
  const { now, perform } = useClaims();
  const flags = flagsForEmployee(allClaims, claim.employee_id, now);
  const byId = new Map(allClaims.map((c) => [c.id, c]));

  return (
    <section aria-label="Flags" className="mt-8">
      <SectionLabel>Flags</SectionLabel>
      <p className="mb-3 text-xs text-muted-foreground">
        {flags.length === 0 ? "No flags" : `${flags.length} ${flags.length === 1 ? "flag" : "flags"}`} in the last {FLAG_DISPLAY_DAYS} days. A flag marks something worth seeing next to the other claims. It decides nothing.
      </p>
      {flags.length === 0 ? null : (
        <ul className="overflow-hidden rounded-lg border">
          {flags.map((f) => {
            const target = byId.get(f.claimId);
            const isCurrent = f.claimId === claim.id;
            const open = () => onOpenClaim(f.claimId);
            return (
              <li
                key={f.id}
                tabIndex={isCurrent ? undefined : 0}
                aria-label={isCurrent ? `${flagLabel(f.type)}, this claim` : `Open claim ${f.claimId}`}
                className={cn("flex items-start gap-3 border-b p-3 last:border-b-0", isCurrent ? "bg-muted/40" : "cursor-pointer hover:bg-muted/40")}
                onClick={isCurrent ? undefined : open}
                onKeyDown={
                  isCurrent
                    ? undefined
                    : (e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          open();
                        }
                      }
                }
              >
                <FlagIcon className="mt-0.5 size-5 shrink-0 text-gap" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{flagLabel(f.type)}</span>
                    {f.by === "agent" ? <span className="text-xs text-muted-foreground">Automatic</span> : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{f.note}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {target ? `${target.merchant}, ` : ""}
                    {f.claimId}, {formatSubmitted(f.at)}
                    {isCurrent ? ", this claim" : ""}
                  </div>
                </div>
                {canRemoveFlag(f, now) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      perform(f.claimId, { id: "unflag", flagId: f.id });
                    }}
                    aria-label={`Remove the flag on ${f.claimId}`}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
