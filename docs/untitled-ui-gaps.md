# Untitled UI gaps (branch explore/untitled-ui-coverage)

What stays on shadcn or custom, and why.

| Part | Stays | Why |
|---|---|---|
| Alert | shadcn | `alerts` is a PRO component (paid licence not bought) |
| Toasts (sonner, undo-toast) | shadcn sonner | `notifications` is PRO |
| Sidebar shell | shadcn sidebar | Collapse state, shortcut and provider have no free Untitled UI counterpart |
| Resizable split panes | shadcn resizable | Not in the Untitled UI catalog |
| Chat composer shell | shadcn input-group | No AI chat composer (Send/Stop, auto-grow) in the catalog |
| Step folding in chat | shadcn collapsible, spinner | No collapsible in the free catalog |
| Skeleton | shadcn skeleton | Not in the catalog |
| Markdown, Claude logo, voice waveform | custom (docs/exceptions.md) | Not in the catalog |
| A few icons (PartyPopper, Utensils, BedDouble, Square, AudioLines, Sparkles) | lucide | No equivalent in @untitledui/icons |

Visible changes from the swap: brand colour is Tailwind indigo, tab count badges show on desktop only, "Date range:" is a text prefix beside its select, the receipt table in the document dialog is divs with table roles (raw `<table>` is lint-banned).

## Components left exactly as they were (no Untitled UI counterpart)

Restored to their shadcn versions after the first pass swapped parts inside them: `undo-toast`, the AI chat (`ai-panel`, `claim-chat`, `chat-composer`, `chat-steps`, `voice-chat`), `daily-brief` (built on the PRO-only Alert), `comparison-view`, `preview-list`.

Token note: Untitled UI redefines `bg-primary`, `text-primary`, `bg-secondary` and friends, which clashes with shadcn. In the shadcn files these utilities are pinned to the shadcn variables (`bg-(--primary)`), so they look as before. Use that form for any new shadcn-side code.
