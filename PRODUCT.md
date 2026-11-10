# Product

<!-- impeccable:product-schema 1 -->

<!-- Drafted from PRD.md, Personas.md, CLAUDE.md and the dataset in this project on 2026-11-10. Not confirmed in an interview; the user asked for it to be established so the polish command could use it. Facts marked (inferred) are not stated in those sources. -->

## Platform

web

## Users

Noa, a manager of a team of nine at a small-to-midsize software company (about 50 to 200 people, an assumption in the personas). She is often out of the office (client meetings, trips, conferences) and approves her team's expense claims in the gaps between meetings. She is accountable for every approval: each one is a real payment, and a wrong one costs money and breaks policy. The prototype serves only Noa, on desktop, with no login.

## Product Purpose

An AI agent (Orvo) reviews every expense claim first and decides most of them on its own. The product clears Noa's review queue: it shows only the claims that need her judgment, says why each one reached her, lets her decide quickly, and lets her see, trust and correct what the agent decided without her. Success is a cleared queue without rubber-stamping and without her team waiting weeks for their money.

## Positioning

The agent has already done the review, so Noa works from escalations with clear reasons and a recommended next step with its reasoning, not from a raw list of claims. An assistant (Ask Orvo AI) can answer questions about claims and policy and can do everything she can click or type, by text or voice, and reports truthfully what it did.

## Operating Context

- Claim volume rose from about 10 a week to about 40, handled one at a time (open it, check the receipt, check the policy, approve, go back), roughly 1 to 2 minutes each.
- Policy checked against: meals up to $60 per person per meal, receipt required over $25, Finance approval also required over $1,000.
- Typical claims: client meals, rideshare and parking, ad-hoc software, conference fees, team dinners.
- Decisions apply at once, with an Undo toast. Messages to employees stay in the local claim chat (no Slack).

## Capabilities and Constraints

- Tabs: Needs review, Waiting on others, Done, All. A queue view steps through claims one at a time with a triage card, a Details panel (overview, policy, past claims, chat) and the Ask Orvo AI panel.
- Spot checks are deferred and must not be built.
- Data comes only from the dataset in `../Data Generation`; `ground_truth` is never rendered or read for logic.
- No backend except the chat route that calls Claude.
- Desktop only, no login, no mobile.
- Product copy: no second person ("you"), no naming the agent or the manager as actors, no em dashes, USD with two decimals, action labels start with a verb. See CLAUDE.md for the full rules.

## Brand Commitments

The product name is Orvo. The text voice is relaxed and positive, not overexcited, never formal; the assistant never refers to itself as Orvo. The prototype is a Melio product design home assignment ("Clear the expense claims queue").

## Evidence on Hand

PRD.md, Personas.md, Terminology.md, the generated dataset and the wireframes in `..`. There are no real customers, usage metrics, testimonials or benchmarks. Do not invent any.

## Product Principles

1. The decision stays with Noa; the agent recommends and shows its reasoning.
2. Always say why: every escalation and every recommendation carries its reason.
3. Autonomy must be verifiable and reversible: what the agent decided is visible, and an override is fast.
4. Speed matters more than completeness per claim; show the facts that decide it and nothing else.
5. Tools and the assistant report only what actually happened.

## Accessibility & Inclusion

No product-specific standard was established (inferred: standard web accessibility for a desktop tool; undecided).
