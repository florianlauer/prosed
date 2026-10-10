---
name: prosed site
description: Ink on paper, dark by default, where every claim sits next to a working miniature of the product.
colors:
  paper: "#15181d"
  ink: "#ece7dc"
  ink-soft: "oklch(69.8% 0.014 142)"
  rule: "oklch(33.8% 0.012 229)"
  tile: "oklch(22.7% 0.011 263)"
  card: "oklch(25% 0.012 265)"
  on-accent: "#15181d"
  mistake: "oklch(66% 0.19 29)"
  mistake-ink: "oklch(78% 0.14 29)"
  fix: "oklch(72% 0.15 152)"
  fix-ink: "oklch(82% 0.14 152)"
  fix-wash: "oklch(72% 0.15 152 / 0.2)"
  fix-wash-strong: "oklch(72% 0.15 152 / 0.34)"
  rewrite: "oklch(70% 0.15 290)"
  rewrite-ink: "oklch(82% 0.11 290)"
  rewrite-wash: "oklch(66% 0.15 290 / 0.2)"
  rewrite-wash-strong: "oklch(66% 0.15 290 / 0.34)"
typography:
  display:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(2.5rem, 1.4rem + 5vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  closing:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(1.75rem, 1rem + 3vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  tagline:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2rem)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  sm: "4px"
  md: "10px"
  lg: "14px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  "7": "3rem"
  "8": "4.5rem"
  "9": "7rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.tile}"
  header-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "999px"
    size: "36px"
  header-toggle-hover:
    backgroundColor: "{colors.tile}"
  panel:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  vignette:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  demo-field:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "1.5rem 1.5rem 3rem"
  popover:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
  mark-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "999px"
    padding: "0.25rem 0.75rem"
---

# Design System: prosed site

## Overview

**Creative North Star: "The Working Proof"**

The page shows prosed working instead of describing it. Ink on paper, set in IBM Plex, with the same fonts, paper and three marks as the product's options page (the identity comes from the rebrand spec; do not pick new fonts or a new palette). Every claim sits next to a miniature of the product: the live demo, three looping feature vignettes, real platform and provider logos, and the benchmark results as four figures.

Dark is the default. Light is the same world with paper and ink swapped, chosen from a header toggle and kept in `localStorage`. The paper stays flat; the only lift is the product's own popover shadow. Tiles are hairline-ruled rounded panels on a slightly lifted paper. Colour belongs to the product's meaning and nothing else.

Motion is part of the proof. The demo loops in script and the vignettes loop in CSS, autoplaying with no control. Only `prefers-reduced-motion` stops them, and nothing goes blank then: each piece holds its most telling frame.

**Key Characteristics:**

- Dark ink-on-paper by default, light by choice, never by system preference alone.
- Mono for the voice (wordmark, headings, tagline, numbers), Sans for reading and UI.
- Hue only on the product's three marks: mistake, fix, rewrite.
- Hairline rules and lifted-paper tiles, no decorative shadows.
- Every animation loops in place and has a still frame; nothing animates on scroll.

## Colors

A hueless ink-and-paper neutral set with three product accents that only appear where the product gives them meaning. Frontmatter values are the dark default; the light values sit in the sidecar (`.impeccable/design.json`, `lightValue`).

### Primary

- **Ink** (`ink`): text, the primary button's fill, focus outlines, icon fills, the demo caret. Actions and focus are ink, as on the options page.

### Tertiary

- **Mistake Red** (`mistake`, text variant `mistake-ink`): the 2px bar under a wrong word and the demo's count badge.
- **Fix Green** (`fix`, `fix-ink`, `fix-wash`, `fix-wash-strong`): the proposed word, the apply button, a newly learned dictionary word.
- **Rewrite Violet** (`rewrite`, `rewrite-ink`, `rewrite-wash`, `rewrite-wash-strong`): selected text, rewrite variants, the picked variant's outline, and the page's own text selection.
- **On Accent** (`on-accent`): text on a solid accent. In dark it equals the paper, because the dark accents are light.

### Neutral

- **Paper** (`paper`): the page background. In light mode it takes the ink's value and the ink takes the paper's.
- **Soft Ink** (`ink-soft`): ink mixed 68% into paper. Secondary text, inactive language links, the tagline, benchmark labels, unsupported-browser logos.
- **Hairline** (`rule`): ink mixed 18% into paper. Every border, divider and ghost outline.
- **Lifted Paper** (`tile`): card mixed 45% into paper. The fill of panels, vignettes, the demo field and toggle/ghost hovers.
- **Card** (`card`): the popover surface, matching the extension's overlay.

### Named Rules

**The Earned Hue Rule.** Mistake, fix and rewrite appear only in the demo, the vignettes and the page's text selection, each meaning what it means in the product. Buttons, links, focus and logos are ink or soft ink.

**The Swap Rule.** Light and dark are one palette: paper and ink trade places, and the accent text and wash variants retune for contrast. Never introduce a colour that exists in only one theme.

## Typography

**Display Font:** IBM Plex Mono 400 and 700 (with ui-monospace)
**Body Font:** IBM Plex Sans 400 and 600 (with system-ui)

**Character:** Mono is the tool's voice, so it carries the wordmark, every heading, the tagline, the benchmark figures and the colophon. Sans carries running text and controls. Self-hosted woff2, latin subset, enough for en, fr, de, es and it.

### Hierarchy

- **Display** (mono 700, fluid 2.5 to 5.5rem, 0.98): the hero h1 only, centred, allowed to break anywhere rather than overflow.
- **Closing** (mono 700, fluid 1.75 to 3rem, 1.05): the closing call above the last download button.
- **Headline** (mono 700, the xl step, 1.15): section headings.
- **Tagline** (mono 400, the xl step, 1.3, soft ink): the line under the h1, at most 30ch, balanced.
- **Title** (sans 600, 1.0625rem, 1.35): feature titles, panel titles, host names.
- **Body** (sans 400, 1.0625rem, 1.55 to 1.6, tabular figures): running text in soft ink; intros capped at `--measure` (62ch).
- **Figure** (mono 700, the xl step, 1.1, -0.02em): the four benchmark results, each above its label in sans 0.875rem soft ink.
- **Label** (mono 400, 0.875rem): the logo-row heading, the download detail line, chips, the footer.

### Named Rules

**The Command Voice Rule.** If it is a heading or a number, it is mono. If it is read as a sentence, names a figure or is pressed as a control, it is sans.

**The Upright Rule.** Headings are never italic; balance them and let them wrap.

## Layout

One centred column, `--page-width` (78rem) wide with `--page-gutter` (1.5 to 3rem fluid) on each side, frames the header, main and footer. Spacing follows a nine-step scale from 0.25rem to 7rem; sections end on step 8 (4.5rem), the page on step 9.

Order of the page: header (wordmark; languages; theme toggle and GitHub); a centred hero with the h1, tagline, an OS-aware primary download button beside a ghost GitHub button, a detail line and the other downloads; the compact demo (at most 52rem) with reserved space below it (9.5rem, 8.5rem under 40rem) so its popovers hang below the field without pushing the page; a centred row of platform logos; then content blocks. Each block stacks its heading above full-width content: a three-column feature grid whose vignette, title and text rows align through subgrid from 52rem; two ruled panels for hosts and models (7fr / 5fr from 52rem); the benchmark as one sentence and a link to the README's method, then four results between two hairlines (2 columns, 4 from 52rem). A centred closing call repeats the download button. The footer is a mono colophon under a hairline drawn inside the gutters.

Breakpoints in use: 24rem (compact header), 40rem (demo type and host rows), 48rem (header on one row), 52rem (grids go multi-column), 64rem (wider rewrite card).

### Named Rules

**The Unbroken Piece Rule.** A piece of text (a link, a language, a download, a chip, a figure) never breaks inside itself; rows of pieces may wrap. Separator dots ride with the piece after them. Below 24rem the languages show their codes and GitHub shows its mark only, so the header keeps one row for the wordmark and actions.

**The Reach Rule.** Small links get at least 24px of height through block padding; buttons are 48px tall; the theme toggle is 36px.

## Elevation & Depth

The page is flat. Depth comes from tone: tiles sit on lifted paper and are drawn with a 1px hairline. The only real shadow belongs to floating product UI, the demo's popovers, so they read as the extension's overlay. Ghost buttons and chips draw their outline as an inset hairline, which is a border, not a lift.

### Shadow Vocabulary

- **Pop** (`--shadow-pop`, dark: `0 12px 32px -8px oklch(8% 0.01 265 / 0.6), 0 2px 6px -2px oklch(8% 0.01 265 / 0.4)`): demo popovers only, paired with a 1px hairline ring.

### Named Rules

**The Floating-Only Rule.** A shadow means "this floats over the text", as the product's cards do. Panels, vignettes, buttons and the demo field never cast one.

## Shapes

Three radii. Gently rounded controls and fields (`md`, 10px): buttons, the demo field, popovers. Softer large tiles (`lg`, 14px): panels and vignettes. Small keycaps (`sm`, 4px). Round things are fully round (999px): the theme toggle, logo chips, dictionary chips, the demo badge and pointer. Inside the demo and vignettes, product replicas keep the overlay's own radii: 6px buttons and variants, 3px highlight washes. Borders are always 1px in the hairline colour.

## Components

### Buttons

Ink slabs, quiet and certain.

- **Shape:** gently rounded (10px), 48px tall, icon then label.
- **Primary:** ink fill, paper text; the download button names the detected OS and shows its logo.
- **Ghost:** transparent with an inset hairline; hover fills with lifted paper and darkens the hairline to soft ink.
- **Hover / Active:** primary hover mixes 14% paper into the ink; press moves down 1px. Transitions use `--dur-fast` (120ms) on `--ease-out`.
- **Focus:** a 2px ink outline, 3px offset, as everywhere on the page.

### Theme toggle

One round 36px button in the header, sun or moon, with `aria-pressed`. Hairline ring, lifted-paper hover, scale to 0.94 on press. It sets `data-theme="light"` on the root and keeps the choice in `localStorage` under `theme`; an inline head script applies it before first paint. The same script sets `data-motion="paused"` when `prefers-reduced-motion: reduce` matches. Motion has no control and nothing about it is stored.

### Chips and logo marks

Logos are monochrome brand marks on a 24px grid, filled with `currentColor`: ink in the logo row and host rows, soft ink for unsupported browsers. Labelled marks (local models, providers) are pill chips with an inset hairline in mono label type. Sources are credited in `Icon.tsx`: Simple Icons (CC0), Remix Icon (Apache-2.0), Lobe Icons (MIT).

### Panels

Lifted paper, 1px hairline, 14px corners, 1.5rem padding. Host rows inside are separated by top hairlines and put their logos on the right from 40rem.

### Navigation

Languages as soft-ink sans links at 0.875rem with a transparent underline; hover brings ink and the underline. The current language is ink, weight 600 and a 2px underline, so it is not marked by colour alone. Under 48rem the language row drops below the wordmark row.

### Demo (signature)

A replica of the extension's overlay in site tokens: a lifted-paper field with the mistake bar under a word, a blinking caret, and popovers on the card surface that hang below the field into the reserved space. The script loop pauses off screen, in a hidden tab, under the pointer and under reduced motion; servers, no-JS visitors and reduced-motion visitors get the still frame. Screen readers get a text equivalent.

### Feature vignettes (signature)

Three CSS-only loops on the demo's own parts, in lifted-paper tiles: fix (underline, card, press, swap, undo keys), rewrite (selection, three variants, one picked), memory (dictionary chips, an ignored fix struck through). Loops run 6 to 7s on `--ease-out`. Under reduced motion, fix holds on the open card, rewrite on the picked variant, memory on the end state. With reduced motion and no script they stop on the opening frame.

### Benchmark results

A one-sentence intro ("Graded on the default local model, on an M2 Pro.") and a link to the README's benchmark section, then a `dl` between two hairlines. Four results: 14/14, 10/10, 30/30 and a 0.4–0.6 s latency range written with locale decimals (a comma outside English). Each figure is mono 700 at the xl step, with its label under it in sans 0.875rem soft ink. Two columns on phones, four from 52rem.

## Do's and Don'ts

### Do:

- **Do** default to dark and let the visitor choose light; keep both themes in one swapped palette.
- **Do** put a working miniature next to each claim, built from the demo's own parts.
- **Do** let every loop autoplay with a still frame that shows its point, and stop motion only for `prefers-reduced-motion`, through `data-motion="paused"`.
- **Do** keep tiles to lifted paper, a 1px hairline and 14px corners.
- **Do** stack section headings above full-width content and align repeated tiles with subgrid.
- **Do** keep pieces of text whole and let their rows wrap.

### Don't:

- **Don't** use mistake, fix or rewrite outside the product meaning they carry; actions, links and focus stay ink.
- **Don't** cast a shadow from anything that does not float over text.
- **Don't** animate on scroll.
- **Don't** colour logos; marks are monochrome ink or soft ink.
- **Don't** print commands or `$` prompts on the page; the benchmark shows results, and the method lives in the README.
- **Don't** set headings in italic.
