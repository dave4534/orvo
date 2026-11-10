import { employeeName } from "./comparison";
import { formatUsd } from "./format";
import { isAgentDecided, type LocalClaim } from "./local";
import { recommendationFor, recommendationReason } from "./recommendations";

export type ClaimSummary = {
  /** Who and which claim the messages are about. */
  heading: string;
  /** The AI summary. For escalated claims: the gap, why it was escalated, and the next action (max 170 characters, 35 words). */
  summary: string;
  /** Short lead-in for the recommendation, when there is one. */
  recommendation: string | null;
  /** Label of the recommended button. The chat shows it as a button under the lead-in. */
  recommendationLabel: string | null;
};

/** Greeting at the top of the chat when a visit starts on this claim. It matches what the claim is, so a closed claim never gets "review the open claims". Pure. */
export function openingLine(claim: LocalClaim): string | null {
  if (claim.status === "waiting_on_noa") return "Let's review the open claims.";
  if (isAgentDecided(claim)) return "Here is what was decided automatically.";
  return null;
}

/** Text the AI chat posts when a claim is opened. Pure. */
export function claimSummary(claim: LocalClaim): ClaimSummary {
  const heading = `${employeeName(claim)}, ${claim.id}`;
  const agent = claim.agent;
  const decidedByNoa = claim.status === "approved_by_noa" || claim.status === "declined_by_noa";

  if (claim.status === "waiting_on_noa") {
    const next = agent.needs_from_noa ? ` Next: ${agent.needs_from_noa}` : "";
    const label = recommendationFor(claim).recommended?.label;
    const why = recommendationReason(claim);
    // Always says why: the reasoning for the recommended step and the weaker options, or that it is a toss-up and what it depends on.
    const recommendation = label ? `I recommend this next step because ${why.text}` : `There is no clear favorite. ${why.text.charAt(0).toUpperCase()}${why.text.slice(1)}`;
    return { heading, summary: `${agent.headline}. ${agent.explanation}${next}`, recommendation, recommendationLabel: label ?? null };
  }

  if (decidedByNoa && claim.noa) {
    const approved = claim.noa.decision === "approved";
    const last = claim.events[claim.events.length - 1]?.text ?? "";
    const note = claim.noa.note ? ` Note: ${claim.noa.note}` : "";
    return { heading, summary: `${approved ? "Approved" : "Declined"} ${formatUsd(approved ? claim.noa.approved_amount_usd : claim.amount.usd_claimed)}. ${last}${note}`, recommendation: null, recommendationLabel: null };
  }

  if (isAgentDecided(claim)) {
    const verb = claim.status === "approved_by_agent" ? "Approved" : "Declined";
    return { heading, summary: `${verb} ${formatUsd(claim.amount.usd_claimed)} automatically. ${agent.explanation}`, recommendation: null, recommendationLabel: null };
  }

  return { heading, summary: `${agent.headline}. ${agent.explanation}`, recommendation: null, recommendationLabel: null };
}
