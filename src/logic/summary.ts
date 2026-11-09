import { employeeName } from "./comparison";
import { formatUsd } from "./format";
import { isAgentDecided, type LocalClaim } from "./local";
import { recommendationFor } from "./recommendations";

export type ClaimSummary = {
  /** Who and which claim the messages are about. */
  heading: string;
  /** The AI summary. For escalated claims: the gap, why it was escalated, and the next action (max 170 characters, 35 words). */
  summary: string;
  /** The recommended action, when there is one. Matches the primary action button. */
  recommendation: string | null;
};

/** Text the AI chat posts when a claim is opened. Pure. */
export function claimSummary(claim: LocalClaim): ClaimSummary {
  const heading = `${employeeName(claim)}, ${claim.id}`;
  const agent = claim.agent;
  const decidedByNoa = claim.status === "approved_by_noa" || claim.status === "declined_by_noa";

  if (claim.status === "waiting_on_noa") {
    const next = agent.needs_from_noa ? ` Next: ${agent.needs_from_noa}` : "";
    const label = recommendationFor(claim).recommended?.label;
    return { heading, summary: `${agent.headline}. ${agent.explanation}${next}`, recommendation: label ? `I recommend: ${label}.` : null };
  }

  if (decidedByNoa && claim.noa) {
    const approved = claim.noa.decision === "approved";
    const last = claim.events[claim.events.length - 1]?.text ?? "";
    const note = claim.noa.note ? ` Note: ${claim.noa.note}` : "";
    return { heading, summary: `${approved ? "Approved" : "Declined"} ${formatUsd(approved ? claim.noa.approved_amount_usd : claim.amount.usd_claimed)}. ${last}${note}`, recommendation: null };
  }

  if (isAgentDecided(claim)) {
    const verb = claim.status === "approved_by_agent" ? "Approved" : "Declined";
    return { heading, summary: `${verb} ${formatUsd(claim.amount.usd_claimed)} automatically. ${agent.explanation}`, recommendation: null };
  }

  return { heading, summary: `${agent.headline}. ${agent.explanation}`, recommendation: null };
}
