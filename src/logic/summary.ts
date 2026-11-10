import { NOW } from "@/data";
import { employeeName } from "./comparison";
import { claimStatusLabel } from "./format";
import { isWaitOver, type LocalClaim } from "./local";
import { assess } from "./recommendations";

export type TriageNote = {
  /** Who and which claim the note is about. */
  heading: string;
  /** Three short lines, each at most 8 words after its label. */
  text: string;
  /** Label of the recommended button. The chat shows it as a button under the text. */
  suggest: string | null;
};

const line = (label: string, value: string) => `**${label}:** ${value}`;

/**
 * The note the chat posts each time a new claim comes up. Three lines of at most 8 words each (policy gap, recommendation or
 * decision, reasoning), so it can be read at a glance. The recommended button shows below it. The words come from `assess`
 * in recommendations.ts, the same record the Policy tab and the assistant read, so the card never says something different. Pure.
 */
export function triageNote(claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): TriageNote {
  const heading = `${employeeName(claim)}, ${claim.id}`;
  const a = assess(claim, all, now);
  if (claim.status === "waiting_on_noa" || isWaitOver(claim, now)) {
    const label = a.recommendation.recommended?.label ?? null;
    return {
      heading,
      text: [line("Policy gap", a.gap), line("Recommendation", label ?? "None, it is a close call"), line("Why I recommend this", a.short)].join("\n\n"),
      suggest: label,
    };
  }
  return {
    heading,
    text: [line("Policy gap", a.gap), line("Decision", claimStatusLabel(claim)), line("Why it was decided", a.short)].join("\n\n"),
    suggest: null,
  };
}
