# Recommendation logic

One rule decides every recommended button: **approve only when every policy check passes. When a check fails, recommend the action that fixes it** (get the receipt, send to Finance, pay the amount the policy supports), never an approval that skips the check.

Where it lives:
- `src/logic/policy.ts` has every limit and the facts built on them (weekly total, same-day claims, receipt exception, wait days). All values are read from the dataset (`policy.rules` for the assignment's three rules, `policy.agent_settings` for our assumptions). Nothing is typed in the code.
- `src/logic/recommendations.ts` is the one table. For each reason type it gives the recommended action, the other actions, the policy gap, a short reason (8 words, for the triage note) and the full reasoning: why the recommended action is right and why each other action is weaker.
- The triage note in the chat, the Policy tab, the assistant's `getRecommendedAction` and the scripted replies all read that one record, so they never disagree.
- `src/logic/flags.ts` derives the agent's flags from the claims. The manager's flags are kept on the claim (`local.flags`).
- Data changes (new limits, labels) are made in `../Data Generation/_source/build.py`, then `npm run prep:data`.

## What the assignment says, and what is our assumption

The assignment has three rules: meals up to $60 per person, receipt above $25, Finance above $1,000. Everything else below is our assumption, listed in `policy.agent_settings` and in the dataset's `assumptions`.

| Assumption | Value | Why |
|---|---|---|
| Weekly total over the Finance limit | $1,000 over a rolling 7 days goes to Finance | The brief does not say whether $1,000 is per claim or per period. A weekly total means splitting a purchase no longer avoids Finance, so intent never has to be guessed. |
| Same-day allowance | $200 per person, same employee, same category, same day | Two or more claims over it are looked at. A single claim is never "over". Per person, so a team dinner is not counted as one person's spend. |
| Receipt exception ceiling | $100, needs a card statement and both requests unanswered | The most the manager can approve without a receipt. |
| Wait windows | receipt 14 days, unreadable 7, question 7, unusual amount 3, Finance 5 working days | A wait ends, the claim returns to Needs review, the manager decides. |
| Flags | shown for 90 days, a flag added by hand can be removed for 60 days | No count of flags triggers anything. |

## The table

| Reason type | Recommended | Why it is right | Why the others are weaker |
|---|---|---|---|
| Receipt still missing | Wait 14 days for receipt | Policy needs a receipt above $25, so approving now would break it. | Card statement: a statement proves the spend, not the receipt, allowed only up to $100. Decline: the spend is documented and a receipt may still arrive. |
| After that wait ends | Decline claim | The wait ended without a receipt. | Wait again: the days already passed. Card statement: skips the receipt. |
| Over the meal cap | Approve the cap | The policy allows $60 per person, so the cap is the most that passes. | Exception: pays what the policy does not allow. Decline: rejects the part that passes. |
| Over $1,000 | Approve and send to Finance | Every other check passes. Only Finance can clear the limit. | Decline: the claim is valid. Ask: nothing is unclear. |
| Week over $1,000 (two claims that may be one purchase) | Send both claims to Finance | The week's total is over the weekly limit, so Finance has to approve. Whether it was one purchase does not change that. | Ask: Finance is needed either way. Approve one: leaves the earlier claim out. |
| Currency gap | Within 3%: approve the claim. Above 3%: approve the receipt amount | The receipt supports the exchange-rate amount. | Card fees: not on the receipt. Decline: the spend is real. |
| Unusual amount | Approve if the receipt supports it, otherwise ask | An unusual amount is not a policy breach, it needs support. | Decline: no rule is broken. |
| No rule covers it | Ask | The claim cannot be checked against policy. | Approve: a guess. Decline: may reject an agreed event. |
| Possible duplicate | Ask | A question settles whether it is the same trip. | Approve: may pay twice. Decline: may be a second trip. |

## Flags

A flag is a mark on a claim that counts toward an employee's pattern. The agent raises them from failed checks (missing receipt after the requests, over the meal cap, week over the limit, same-day claims over the allowance, unusual amount, duplicate, unusual pattern), and an agent flag goes away when the thing behind it is corrected. The manager can add one from More options, with a reason, and remove one she added for 60 days. They show as a chip beside the employee's name and as a list under Past claims. A flag decides nothing.
