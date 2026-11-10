---
name: Orvo claims triage
description: A square-cornered, white and green tool for clearing an expense queue, with a lime accent for the next step.
colors:
  page: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  stack-warm: "oklch(0.96 0.006 85)"
  forest-green: "oklch(0.4 0.1 152)"
  lime: "oklch(0.93 0.19 112)"
  gap-amber: "oklch(0.795 0.184 86)"
  warm-border: "oklch(0.9 0.006 85)"
  warm-grey: "oklch(0.955 0.006 85)"
  grey-text: "oklch(0.52 0.01 85)"
  alert-red: "oklch(0.577 0.245 27.325)"
  green-tint: "oklch(0.96 0.03 152)"
typography:
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  amount:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: "1"
  caption:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "1.25"
rounded:
  none: "0px"
  card: "8px"
  full: "9999px"
components:
  button-main:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.page}"
    rounded: "{rounded.none}"
    height: "40px"
  button-light:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "40px"
  button-icon:
    rounded: "{rounded.full}"
    size: "40px"
  card:
    backgroundColor: "{colors.page}"
    rounded: "{rounded.card}"
---

# Design System: Orvo claims triage

<!-- Scan mode, derived from src/tailwind.css and the shadcn components on branch theme/ramp-inspired. Creative language below is proposed from the styling answers the user gave on 2026-11-10 (Ramp-inspired, square, green and lime); it is not otherwise confirmed. No .impeccable/design.json sidecar was written. -->

## Overview

**Creative North Star: "The Clear Ledger"**

A working desk, not a showpiece. Surfaces are white and flat, divided by thin lines, with one warm grey zone behind the stack of claim cards so the card being decided lifts off the page. Colour is rationed: deep green means the decision itself, lime marks the prominent next step, amber marks a gap that needs a look. Everything else is black on white.

The system is square. Controls, inputs, tabs and table cells have sharp corners; only raised surfaces (cards, menus, tooltips, toasts) take an 8px radius and a soft shadow. Icon-only buttons and badges are fully round, which makes them read as marks rather than controls.

**Key Characteristics:**
- White everywhere except the warm zone behind the card stack.
- Black 1px outlines on secondary buttons; no grey outline buttons.
- One main action per screen in green with white text; lime for the step before it.
- Amber for gaps and warnings, always as a filled shape.

## Colors

Restrained: white and near-black carry the interface, green and lime do the signalling, amber flags a problem.

### Primary
- **Forest Green** (oklch(0.4 0.1 152)): the main action (Approve, Save), the green part of the scale bar, the sparkle and active accents. Also used as the success colour so Approve always matches the main button.

### Secondary
- **Lime** (oklch(0.93 0.19 112)): the light action (Review all, Ask a question, Continue waiting, Next in the fix flow). Always with black text, never with white.

### Tertiary
- **Gap Amber** (oklch(0.795 0.184 86)): the gap segment of the scale bar, its dot, and the filled warning icon.

### Neutral
- **Page White** (oklch(1 0 0)): page, header, sidebar, cards, panels, table header.
- **Ink** (oklch(0.145 0 0)): text and the 1px outline on secondary buttons.
- **Stack Warm** (oklch(0.96 0.006 85)): only the area behind the stacked claim cards.
- **Warm Border** (oklch(0.9 0.006 85)) and **Warm Grey** (oklch(0.955 0.006 85)): hairlines and hover fills.
- **Green Tint** (oklch(0.96 0.03 152)): selected rows and informational callouts.

### Named Rules
**The One Green Rule.** One green button per screen: the decision. Anything else that wants attention uses lime.
**The White Rule.** Backgrounds are white. The only tinted area is behind the stack of cards.
**The Filled Warning Rule.** A warning is a filled amber shape, never a pale tint with a thin glyph.

## Typography

**Display and Body Font:** Manrope (with ui-sans-serif, system-ui fallback)

**Character:** One geometric humanist family throughout. Weight and size carry hierarchy, not a second typeface.

### Hierarchy
- **Title** (600, 1.375rem, 1.75rem): the employee name on the card, page titles.
- **Body** (400, 0.875rem, 1.5): table cells, card details, chat.
- **Amount** (600, 2.125rem, 1): the Policy and Claim figures in the comparison.
- **Label** (500, 0.75rem): column headers, counts.
- **Caption** (400, 11px, 1.25): scale-bar ticks and small notes.

## Layout

Desktop only. A fixed left navigation, a header bar, and a working area that holds either the claims list or the queue (triage card centred on the warm stack zone, Details and Ask Orvo AI as side panels). Never horizontal scroll: tables use fixed layout and truncation. Controls align to a 4px grid; button heights follow the size scale below.

## Elevation & Depth

Flat by default. Depth is only for raised surfaces: cards, dropdown menus, selects, tooltips and toasts share one soft shadow (`0 1px 2px rgb(0 0 0 / 6%), 0 4px 12px rgb(0 0 0 / 5%)`). Dialogs and the Details panel are square and unshadowed; the dimmed overlay separates them.

### Shadow Vocabulary
- **Surface** (`shadow-surface`): raised cards, menus, tooltips, toasts.

### Named Rules
**The Flat Panel Rule.** Dialogs and side panels stay square and unshadowed. Only cards and floating menus lift.

## Shapes

Square corners by default (0px). Raised surfaces use 8px. Icon-only buttons, avatars and all badges and chips are fully round. Secondary controls are outlined with a 1px near-black line.

## Components

### Buttons
- **Shape:** square, five sizes: xs 24px, sm 32px, default 40px, lg 48px, xl 56px. Icon-only buttons are round at matching sizes.
- **Main:** forest green, white text.
- **Light:** lime, black text, slightly darker on hover.
- **Outline:** white fill, black 1px border, grey on hover.
- **Ghost, link, destructive:** unchanged from shadcn.

### Chips and badges
- Fully round pills. Status badges are tinted; removable chips (filters) carry a close mark.

### Cards / Containers
- 8px radius, white, 1px warm border; only the claim triage card takes the surface shadow.

### Inputs / Fields
- Square, 40px tall, 1px input border, white fill.

### Navigation
- Left rail on white, icon plus label, 48px rows. Active item and count styling follow the nav rules once confirmed.

## Do's and Don'ts

### Do:
- **Do** use the lime button for prominent steps that are not the decision itself.
- **Do** keep icon-only buttons round and labelled with an accessible name.
- **Do** keep every background white except behind the stack of cards.

### Don't:
- **Don't** put white text on lime or black text on forest green.
- **Don't** round buttons, inputs, tabs or table cells.
- **Don't** add shadows to dialogs or the Details panel.
- **Don't** use more than one green button on a screen.
