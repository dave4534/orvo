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
