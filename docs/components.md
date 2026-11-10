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

## Changes to stock files

| File | Change | Why |
|---|---|---|
| `src/components/ui/sheet.tsx` | Overlay is `bg-foreground/35` with a 2px blur instead of `bg-black/10` | The review panels open over the list with a visibly dimmed layer |
| `src/hooks/use-mobile.ts` | Rewritten with `useSyncExternalStore` | The stock hook fails the `react-hooks/set-state-in-effect` lint rule |
| resizable | shadcn (stock, base-nova), react-resizable-panels | 2026-11-09 |
| input-group | shadcn (stock, base-nova), used for the chat message box | 2026-11-09 |
| collapsible | shadcn (stock, base-nova), used for the folding steps in the chat | 2026-11-09 |
| spinner | shadcn (stock, base-nova), used for steps in progress | 2026-11-09 |

## Untitled UI (branch explore/untitled-ui-coverage)

Installed with `npx untitledui@latest add <name> --yes` into `src/components/base`, `application`, `foundations` and `shared-assets`. These folders are generated: never hand-edit beyond tokens, and they are not listed one by one. Theme: `src/styles/untitledui.css` (brand colour indigo). Used: buttons, badges, avatar, tooltip, input, textarea, checkbox, radio-buttons, select, dropdown, toggle, tabs, table, modals, empty-state. Unused installs were pruned.
