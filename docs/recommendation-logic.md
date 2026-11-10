# Recommendation logic

One rule decides every recommended button: **approve only when every policy check passes. When a check fails, recommend the action that fixes it** (get the receipt, send to Finance, pay the amount the policy supports), never an approval that skips the check.

Where it lives:
- `src/logic/policy.ts` has every limit and the facts built on them (weekly total, same-day claims, receipt exception, wait days). All values are read from the dataset (`policy.rules` for the assignment's three rules, `policy.agent_settings` for our assumptions). Nothing is typed in the code.
- `src/logic/recommendations.ts` is the one table. For each reason type it gives the recommended action, the other actions, the policy gap, a short reason (8 words, for the triage note) and the full reasoning: why the recommended action is right and why each other action is weaker.
- The triage note in the chat, the Policy tab, the assistant's `getRecommendedAction` and the scripted replies all read that one record, so they never disagree.
- Data changes (new limits, labels) are made in `../Data Generation/_source/build.py`, then `npm run prep:data`.

## The three policies

There are three policies, the ones in the assignment, and every claim is read against one of them. The card names it under the money, as a small solid icon and a short label (Meals policy, Receipt policy, Finance policy). The labels are `enums.policy_label` in the dataset and the mapping from why a claim came to review to its policy is `policyOf` in `policy.ts`.

| Policy | Rule | Icon |
|---|---|---|
| Meals | Up to $60 per person, per meal | Restaurant |
| Receipt | A receipt is required for anything over $25 | Receipt |
| Finance | Over $1,000 also needs Finance approval | Account balance |

Two readings are ours, and they sit on the rules themselves, not as extra policies:

| Reading | Value | Why |
|---|---|---|
| Finance rule, per employee over a rolling window | 7 days (`window_days`) | The brief does not say whether $1,000 is per claim or per period. A weekly total means splitting a purchase no longer avoids Finance, so intent never has to be guessed. |
| Receipt rule, approving without one | Up to $100 on a card statement (`exception_ceiling_usd`) | The most the manager can approve without a receipt. |

How long a waiting claim waits before it returns to the queue is in `policy.agent_settings.wait_days`: 1 day for a receipt or a question, and 2 working days with Finance. The goal is 2 days to approval, so waits are short. The agent asks for a missing receipt every day until the employee replies, and a claim reaches the manager when the employee cannot supply it.

## Why a claim reaches the manager

The agent approves routine claims that pass all three policies and keeps asking for missing details. It cannot approve over the Finance limit, which needs a person and then Finance, accept a substitute for a receipt, or pay above the meal cap. So the claim reaches the manager, and the status bar of the card says which of these it is ("Over $1,000: a person approves, then Finance"). Waiting is the agent's job: the Wait action parks the claim for a day with one tap and writes nothing to the employee, and if the manager asks a question instead, the claim comes back the next day.

## The table

| Reason type | Recommended | Why it is right | Why the others are weaker |
|---|---|---|---|
| Receipt lost or still missing | Wait 1 day for receipt | Policy needs a receipt above $25, so approving now would break it. | Card statement: a statement proves the spend, not the receipt, allowed only up to $100. Decline: the spend is documented and a receipt may still arrive. |
| After that wait ends | Decline claim | The wait ended without a receipt. | Wait again: the days already passed. Card statement: skips the receipt. |
| Over the meal cap | Approve the cap | The policy allows $60 per person, so the cap is the most that passes. | Exception: pays what the policy does not allow. Decline: rejects the part that passes. |
| Over $1,000 | Approve and send to Finance | Every other check passes. Only Finance can clear the limit. | Decline: the claim is valid. Ask: nothing is unclear. |
| Week over $1,000 (two claims that may be one purchase) | Send both claims to Finance | The week's total is over the weekly limit, so Finance has to approve. Whether it was one purchase does not change that. | Ask: Finance is needed either way. Approve one: leaves the earlier claim out. |
| Currency gap | Within 3%: approve the claim. Above 3%: approve the receipt amount | The receipt supports the exchange-rate amount. | Card fees: not on the receipt. Decline: the spend is real. |
| Possible duplicate | Ask | A question settles whether it is the same trip. | Approve: may pay twice. Decline: may be a second trip. |
