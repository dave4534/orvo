# Components

Every component in `src/components` is listed here. Update this file every time one is added.

| Component | Source | Date added |
|---|---|---|
| theme-provider | shadcn init template (next-themes provider, no visible UI) | 2026-11-09 |
| button | shadcn (stock, base-nova) | 2026-11-09 |
| alert | shadcn (stock, base-nova) | 2026-11-09 |
| avatar | shadcn (stock, base-nova) | 2026-11-09 |
| badge | shadcn (stock, base-nova) | 2026-11-09 |
| checkbox | shadcn (stock, base-nova) | 2026-11-09 |
| dropdown-menu | shadcn (stock, base-nova) | 2026-11-09 |
| empty | shadcn (stock, base-nova) | 2026-11-09 |
| input | shadcn (stock, base-nova) | 2026-11-09 |
| select | shadcn (stock, base-nova) | 2026-11-09 |
| separator | shadcn (stock, base-nova) | 2026-11-09 |
| sheet | shadcn (pulled in by sidebar) | 2026-11-09 |
| sidebar | shadcn (stock, base-nova) | 2026-11-09 |
| skeleton | shadcn (pulled in by sidebar) | 2026-11-09 |
| sonner | shadcn (stock, base-nova) | 2026-11-09 |
| undo-toast | Composition of sonner (toast.custom) and button (stock), drains the Undo button over 10 s | 2026-11-10 |
| table | shadcn (stock, base-nova) | 2026-11-09 |
| tabs | shadcn (stock, base-nova) | 2026-11-09 |
| tooltip | shadcn (stock, base-nova) | 2026-11-09 |
| dialog | shadcn (stock, base-nova) | 2026-11-09 |
| label | shadcn (stock, base-nova) | 2026-11-09 |
| radio-group | shadcn (stock, base-nova) | 2026-11-09 |
| scroll-area | shadcn (stock, base-nova), installed, not used yet | 2026-11-09 |
| textarea | shadcn (stock, base-nova) | 2026-11-09 |
| badge-12 | shadcn-space block (`@shadcn-space/badge-12`, removable filter chip). Its pill classes are shared through `src/lib/blocks.ts`. Needs `motion`. | 2026-11-10 |
| tabs-26 | shadcn Studio block (`@ss-components/tabs-26`, underline tabs). Its classes are shared through `src/lib/blocks.ts`. | 2026-11-10 |
| alert-08 | shadcn-space block (`@shadcn-space/alert-08`, evaporate dismiss). Layout and motion reused by status-banner. Needs `motion`. | 2026-11-10 |
| status-banner | Composition of alert and button (stock) with the layout and evaporate motion of alert-08. Used for the brief banner and the inline alerts. | 2026-11-10 |

## Changes to stock files

| File | Change | Why |
|---|---|---|
| `src/components/ui/sheet.tsx` | Overlay is `bg-foreground/35` with a 2px blur instead of `bg-black/10` | The review panels open over the list with a visibly dimmed layer |
| `src/hooks/use-mobile.ts` | Rewritten with `useSyncExternalStore` | The stock hook fails the `react-hooks/set-state-in-effect` lint rule |
| resizable | shadcn (stock, base-nova), react-resizable-panels | 2026-11-09 |
| input-group | shadcn (stock, base-nova), used for the chat message box | 2026-11-09 |
| collapsible | shadcn (stock, base-nova), used for the folding steps in the chat | 2026-11-09 |
| kbd | shadcn (stock, base-nova), the Command and Enter hint on the recommended action button | 2026-11-10 |
| spinner | shadcn (stock, base-nova), used for steps in progress | 2026-11-09 |
