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

## Theme branch (theme/ramp-inspired): changes to stock files

Theme from shadcn preset `b6G3fhm1g` applied as theme only plus the Manrope font (`npx shadcn@latest apply --preset b6G3fhm1g --only theme`, then `--only font`), then adjusted by hand. Tokens live in `src/tailwind.css` (`--primary` deep green, `--highlight` lime, `--radius: 0`, `--radius-card` 8px, `--shadow-surface`).

| File | Change | Why |
|---|---|---|
| `src/components/ui/button.tsx` | Square buttons, five sizes (xs 24, sm 32, default 40, lg 48, xl 56 px), round icon sizes, new `light` variant (lime, black text), black-outline `outline` variant | Requested styling (Ramp-inspired) |
| `src/components/ui/badge.tsx` | `rounded-full` pills | Requested: all badges and chips are pills |
| `src/components/ui/dropdown-menu.tsx`, `select.tsx`, `tooltip.tsx`, `sonner.tsx` | Raised surfaces use `rounded-card` and `shadow-surface` | Requested: cards, menus, popovers, tooltips and toasts are 8px with a subtle shadow |
| `src/components/ui/input.tsx` | Height 40px | Matches the default button height |
| `src/components/ui/sidebar.tsx` | Active nav item is lime with black text and semibold; the count badge is a green pill | Polish pass: nav follows the theme (lime light colour, green main colour) |
| `src/tailwind.css` (base layer) | Text selection in lime, green caret, thin scrollbars | Polish pass: browser surfaces carry the palette |
