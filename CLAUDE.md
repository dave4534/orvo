@AGENTS.md

# Orvo claims triage (Noa's queue)

A working prototype for the Melio product design home assignment "Clear the expense claims queue". It is for Noa, a manager of nine, who reviews expense claims after an AI agent (Orvo) has reviewed them first. The prototype serves only Noa. Desktop only, no login, no backend, no mobile.

Source documents (outside this folder, in `..`):
- `../PRD.md` is the product spec. Where the PRD and the dataset disagree, the dataset wins for facts and the PRD wins for behavior.
- `../Data Generation/` holds the dataset (`data.json`, `types.ts`, `README.md`). Read its README before touching data.
- `../Assignment/` holds the brief.

## Decisions already made (do not re-litigate)

- Tabs follow the PRD: Needs review, Waiting on others, Done, All.
- **Spot checks are deferred.** The dataset no longer has `agent.audit_sample`. Do not build the spot-check group, "Confirm decision" or spot-check acceptance criteria. If something in the PRD depends on them, flag it to the user instead of improvising.
- The triage panel's comparison model may differ by situation (the user allows suggestions).
- Tier 1 of PRD section 1.1 comes first. No min or max widths until the user decides.
- Wireframes will be supplied by the user. Do not invent layout before they arrive.
- `ground_truth` in the data is the answer key for the planted agent mistakes. Never render it, never read it for logic. Strip it from the runtime data (see Data below).
- Nothing is pushed or deployed to Vercel unless the user says so.

## The rule

shadcn/ui on Base UI is the only UI source for this project. Not Radix, not Mondave, not any other component library, not hand-built components.

Order of preference for every UI element:
1. A stock shadcn component (https://ui.shadcn.com/docs/components), installed with the CLI.
2. A shadcn Studio (https://shadcnstudio.com) or reui (https://reui.io) block, installed with the CLI into src/components/ui. After install it is part of the system.
3. A composition of 1 and 2.
4. A custom component, only when 1 to 3 cannot do it, and only with an entry in docs/exceptions.md (what it is, why no shadcn part fits, which shadcn parts it is built from).

Never hand-build a button, input, select, dialog, toast, dropdown, date picker, table, tabs, tooltip or menu. Never write a wrapper around a shadcn component just to rename it. If the user names a Studio or reui block, install that exact one.

Tokens (color, type, radius, spacing) live in one place: src/tailwind.css, as shadcn CSS variables. No second token system and no CSS module libraries. Custom CSS only for layout and for bespoke components listed in docs/exceptions.md.

Never use horizontal scroll anywhere (pages, dialogs, tables). Use wrapping, truncation or fixed table layout.

### Registries

`components.json` registers `@ss-components` (shadcn Studio) and `@reui`, both with the `{style}` placeholder, on style `base-nova`. For any block the user asks for, check that it has a Base UI version before installing, and say so if it does not. Free items need no key. Premium items need a license key in `.env.local`, which the user must provide.

## Reporting rule

Never say a screen, feature or the app "uses shadcn", "is converted" or "is done" without running `npm run audit:ui` and pasting its output. If the output is not clean, say what is left and why. Before finishing any task, run the audit and lint, and fix what they report.

## How to work

- Start each feature by listing the shadcn components you will use. If you think you need a custom component, stop and ask first.
- Check every new screen in the running app, including interactive states (dialogs, menus, toasts, date pickers, empty and error states), before saying it is done.
- If a rule here conflicts with something the user asks for, tell them about the conflict and ask. Do not silently pick one.
- Fetch current docs (context7) before using any library API. Next.js in this repo is a newer version than training data: read `node_modules/next/dist/docs/` first (see AGENTS.md).
- Work in small steps. One feature or screen per change, run `npm run lint`, `npm run typecheck` and `npm run audit:ui` before reporting back.

## Architecture

```
src/
  app/            Next.js routes and layout only. No logic.
  components/ui/  shadcn components (CLI-installed). Never hand-edit beyond tokens.
  components/     Registered in docs/components.md.
  features/claims/  Screens and feature components that compose ui/ parts (list, triage panel, more-info, correction flow).
  logic/          Pure functions, no React: buildComparison, recommendationFor, actionPreview, routeAfterApproval, correctionTemplate.
  store/          Claims store (immutable base data plus local overlay), reducer, selectors.
  data/           Runtime dataset (ground_truth stripped) and types.
  mocks/          Scripted AI replies, error simulation, demo clock.
  tailwind.css    The only token file.
docs/             components.md, exceptions.md, and decision notes.
scripts/          audit-ui.mjs and the data prep script.
```

Rules:
- Components render specs. Claim-specific logic lives in `logic/` (and the recommendation table), never inside components (PRD 7.2, 9).
- Logic and reducers are pure and unit-tested (Vitest). Every derived value (age, counts, gaps) is a selector, never stored.
- "Now" is `meta.now` from the data. Never read the real clock.
- Keep files small and named for what they do. Prefer many small modules to one large one.
- Copy and microcopy: plain language, no em dashes, "Orvo" for the agent in claim copy, USD with two decimals (PRD 16.2).

## Data

- Source of truth: `../Data Generation/data.json`. Rebuild with `python3 _source/build.py && python3 _source/validate.py` in that folder.
- The runtime copy in `src/data/` must not contain `ground_truth`. A prep script in `scripts/` will produce it. Tests may read the original.
- Data is immutable. Actions apply to a local copy and append events (PRD D7).

## Commands

```
npm run dev        # local dev server
npm run lint
npm run typecheck
npm run audit:ui   # design system audit, must be clean before reporting done
npm run build
```
