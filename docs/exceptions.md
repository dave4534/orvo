# Exceptions

A custom component is allowed only when no shadcn component, Studio or reui block, or composition of them can do the job. Ask first, then log it here.

| Component | Reason no shadcn part fits | shadcn parts used |
|---|---|---|
| chat-markdown | No shadcn part renders markdown. Needed so the AI chat can show bold and short lists. | none (wraps react-markdown, only p, ul, ol, li, strong, em allowed) |
| claude-logo | An icon, not an interface element: no shadcn or lucide part draws the Claude mark. | none (inline SVG) |
