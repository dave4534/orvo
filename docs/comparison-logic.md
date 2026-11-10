# Comparison logic

The comparison in the triage card is built in `src/logic/comparison.ts`. Every case follows the same contract, so the halves, the sentence and the tiles always say one thing.

1. **Same attribute on both halves.** Amount against amount, ride ID against ride ID, one purchase against another. Never a claim against a status such as "Declined", and never claim numbers, which always differ.
2. **The sentence is about what the halves show.** It names that attribute and says in plain words whether it passes or fails. A pass has the green check, a fail has the amber warning.
3. **Status lives in the status bar.** "Declined" or "Approved" is shown in the bar and in the activity, never as a half. A claim the manager declined keeps the comparison of the reason it came to review, so it shows what the decision was about.
4. **Tiles hold supporting facts only.** One small card per fact (label above, value below), in a row that wraps. The amount is never a tile, because it is already at the top right of the card.
5. **The chat note reads the same facts.** `assess` in `recommendations.ts` builds the policy gap and the short reason from the same data, so the note never disagrees with the card.

| Reason | Left half | Right half | Sentence |
|---|---|---|---|
| Possible duplicate | Ride ID, earlier claim | Ride ID, this claim | "Same ride ID on both, so the trip is claimed twice." or "Ride IDs differ, so these look like two rides." |
| Repeat purchase | Earlier purchase and amount | This purchase and amount | "Second monitor in 34 days. No rule covers repeats." |
| Receipt missing | Policy limit | Claim | "$23.50 over the no-receipt limit." |
| Meal cap | Cap for the people on the receipt | Claim | "$45.00 over the meal cap in total." |
| Week over $1,000 | Finance limit | The week's total | "$296.71 over the weekly Finance limit." |
| Currency | Receipt, converted | Claim | "7.3% over the receipt (the limit is 3%)." |
