# Exceptions

A custom component is allowed only when no shadcn component, Studio or reui block, or composition of them can do the job. Ask first, then log it here.

| Component | Reason no shadcn part fits | shadcn parts used |
|---|---|---|
| chat-markdown | No shadcn part renders markdown. Needed so the AI chat can show bold and short lists. | none (wraps react-markdown, only p, ul, ol, li, strong, em allowed) |
| claude-logo | An icon, not an interface element: no shadcn or lucide part draws the Claude mark. | none (inline SVG) |
| warning-icon | No shadcn or lucide part gives the filled warning glyph the design calls for. Material Icons "Warning" (filled, Apache 2.0), drawn as inline SVG. | none (inline SVG) |
| sun-icon | No shadcn or lucide part gives the filled sun the daily brief uses. Material Icons "WbSunny" (filled, Apache 2.0), drawn as inline SVG. | none (inline SVG) |

## auto-awesome (src/components/icons/auto-awesome.tsx)

- **What:** the Ask Orvo AI sparkle, the Material "Auto awesome" icon, drawn as an inline SVG.
- **Why no shadcn part fits:** shadcn has no icon components; it uses lucide icons. Noa asked for this specific icon.
- **Built from:** nothing. It is one SVG path from Google Material Icons (Apache 2.0), used with currentColor.
