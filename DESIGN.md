---
version: alpha
name: Calm Kids Learning
description: Warm, calm, tactile learning UI for children aged 3-7 — playful without being noisy, parent-approved, never slot-machine loud.
colors:
  primary: "#174A3A"
  secondary: "#F5E885"
  tertiary: "#3F8F62"
  neutral: "#FFF9EE"
  warm-white: "#FFFCF7"
  ink: "#26332D"
  muted-ink: "#5C665E"
  soft-green: "#DDEDE2"
  sage: "#A9C7B3"
  soft-blue: "#DDEAF5"
  soft-peach: "#F7DCCB"
  success: "#3F8F62"
  warning: "#C68A25"
  error: "#B85A52"
typography:
  h1:
    fontFamily: Nunito Sans
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 1.2
  h2:
    fontFamily: Nunito Sans
    fontSize: 1.875rem
    fontWeight: 700
    lineHeight: 1.2
  title-lg:
    fontFamily: Nunito Sans
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  sm: 14px
  md: 20px
  lg: 24px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-tertiary:
    backgroundColor: "{colors.soft-green}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  card-surface:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 24px
  surface-ivory:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 24px
  badge-success:
    backgroundColor: "{colors.soft-green}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-warning:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 4px
  error-note:
    backgroundColor: "{colors.soft-peach}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 12px
  info-note:
    backgroundColor: "{colors.soft-blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 16px
  text-muted:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.muted-ink}"
    typography: body-sm
    rounded: "{rounded.sm}"
    padding: 0px
  progress-fill:
    backgroundColor: "{colors.success}"
    rounded: 999px
    height: 8px
  status-dot-warning:
    backgroundColor: "{colors.warning}"
    rounded: 999px
    size: 8px
  status-dot-error:
    backgroundColor: "{colors.error}"
    rounded: 999px
    size: 8px
  decorative-pattern:
    backgroundColor: "{colors.sage}"
    rounded: "{rounded.lg}"
    size: 64px
---

## Overview

Calm Islamic Kids Learning UI. Design north star: *“Playful without being
noisy.”* The app must feel warm, safe, premium, calm, tactile,
child-friendly and parent-approved — and must NOT feel like a gambling game,
a social media feed, an AI-generated kids template, a generic cartoon app,
or a school administration dashboard.

This file (plus `src/styles/tokens.css`, which mirrors it) is the source of
truth for visual values. `docs/DESIGN-SYSTEM.md` holds the full rationale,
section by section; when the two disagree on a numeric token, this file wins
until they are reconciled.

Dials: `ENERGY 1` (calm, not noisy) · `RHYTHM 2` (consistent) ·
`MOTION 1` (subtle, functional only).

## Colors

- **Primary (#174A3A, Deep Green):** headings, primary buttons, focus
  identity. The only high-emphasis action color on a child screen.
- **Secondary (#F5E885, Warm Yellow):** single accent for emphasis and
  playful highlights — never a full-screen background.
- **Neutral (#FFF9EE, Ivory):** app background. Warm White (#FFFCF7) is the
  card/surface layer above it.
- **Ink (#26332D) / Muted Ink (#5C665E):** body text and secondary text;
  muted ink clears ≥4.5:1 on every surface it is used on — ivory, warm
  white, soft green and soft peach (verified by `test/color-contrast.test.ts`).
- **Semantic:** success #3F8F62, warning #C68A25, error #B85A52 — for status
  indicators (dots, icons, fills), **always paired with text or icon**; color
  is never the sole carrier of correctness.
- **Support tints:** soft green, sage, soft blue, soft peach — surfaces and
  decorative geometry only, never text colors.

## Typography

Nunito Sans (rounded humanist sans) for headings and numbers; Inter for body
and controls. Numerals use tabular figures where alignment matters. No
playful display fonts in body UI — the playfulness comes from shape, color
and motion, not from novelty type.

## Layout & Spacing

Spacing is a 4px scale (`xs 4` → `xl 48`). Child screens follow the template:
top progress indicator, middle one activity with a large visual and a
concise prompt, bottom a large answer area with generous spacing — never
crowded with secondary information. Parent screens may be denser but must
prioritize actionable insight (“what to practice next”), never vanity
metrics. Touch targets ≥44px (`--touch-min`).

Breakpoints: sm 430px (large phone), md 768px (tablet), lg 1024px (desktop).
Zero horizontal overflow at 390px is a hard gate.

## Elevation & Depth

Soft physical elevation: `0 1px 2px rgb(38 51 45 / 0.04), 0 4px 12px
rgb(38 51 45 / 0.06)` plus subtle 1px borders. Prefer borders over heavy
shadows; no glassmorphism as a default treatment.

## Shapes

Rounded but not excessive: 16–24px radius for major cards (`md 20px`,
`lg 24px`), 12–16px for controls (`sm 14px`), pills only for progress bars
and compact status chips. Consistent radii per role — no per-screen
invention.

## Components

- **`button-primary`** is the sole high-emphasis action per screen (Deep
  Green on Warm White). Hover darkens to Ink — no scale-jump, no bounce.
- **`button-secondary`** (Warm Yellow) is the one supporting action;
  **`button-tertiary`** is for low-emphasis navigation only.
- **Cards** use `card-surface` on the ivory `surface-ivory` canvas; avoid a
  grid of identical cards for every element — one visual hero per screen.
- **Status:** `badge-success` / `badge-warning` pair color with text;
  `error-note` carries error copy on a soft peach surface (never red body
  text on white for children).
- **Motion budget:** tap 150ms, card 240ms, page 280ms, success 500ms
  (120–700ms total), eased `cubic-bezier(0.22, 1, 0.36, 1)`; all animation
  durations collapse to 0 under `prefers-reduced-motion`.
- **Audio:** music OFF by default; every audio feature has a mute control.

## Do's and Don'ts

- Do: one hero, one primary action, generous whitespace, color used for
  hierarchy not decoration, bespoke geometric illustration (stars, books,
  numbers, moon, lantern, Islamic geometric patterns).
- Do: every screen ships loading / empty / success / error states; honest
  placeholders, never fake stats or invented testimonials.
- Don't: gradient-by-default backgrounds, bento grids, decorative blobs,
  pill overload, animating everything, inconsistent radii or spacing, huge
  hero text with no information.
- Don't: stock cartoon children, AI-looking mascots, human or animal
  characters, leaderboards, chat, slot-machine reward mechanics.
- Don't: ship a screen until the anti-slop checklist in
  `docs/DESIGN-SYSTEM.md` §12 is run against it (visual hierarchy, −20%
  decoration, touch targets, age appropriateness, parent trust, muted
  audio, reduced motion, 390px + tablet).
