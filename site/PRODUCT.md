# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start, fully prerendered to static HTML, built with Vite+ (`vp`) and pnpm, deployed on Vercel. No server code. Chosen by Florian in the spec `docs/superpowers/specs/2026-10-10-prosed-site-design.md`.

## Users

Developers and recruiters who land on the page from a link: a GitHub profile, a README, a message. They give the page a minute. They want to know what prosed is, see it work, and judge whether it was built with care.

## Product Purpose

The site shows prosed, a grammar checker that runs on a local model, as a browser extension for Chromium and a desktop app for macOS and Windows. Its job is credibility, not conversion. Success: the visitor understands prosed from the first screen, watches it fix a sentence without installing anything, and reaches the repo or the releases in one click.

## Positioning

Unlike Grammarly or LanguageTool, prosed runs on a local model (Ollama or Gemini Nano built into Chrome), is free, needs no account, is open source under MIT, and fixes one word at a time instead of rewriting the message. Rewrites exist, but only when the user asks, and a variant that drops a number, a name or a link is never shown.

## Operating Context

The product works inside the fields people already type in: text areas and rich editors in the browser, and any app on macOS and Windows through the desktop app. Mistakes are underlined in place; a hover card shows the fix; a badge lists every fix with "Accept all". An optional personal API key sends checks to a hosted provider instead.

## Capabilities and Constraints

- Five languages for the page: en (at `/`), fr, de, es, it, the same as the product's interface.
- One page plus a 404. The documentation stays in the repo README.
- No analytics, no third-party requests, fonts self-hosted.
- Distribution is GitHub releases only. There is no Chrome Web Store listing.

## Brand Commitments

- Name `prosed`, always lowercase. Taglines that go together: `sed for your prose.` (never translated) and `A grammar checker that runs on your machine.`
- Icon and wordmark sources in `public/brand/` (copied from `assets/brand/`).
- The visual identity is locked by `docs/superpowers/specs/2026-10-03-prosed-rebrand-design.md` and recorded in `site/DESIGN.md`.

## Evidence on Hand

- Benchmark from the README: with `gemma4:e2b-it-qat` on an M2 Pro (Ollama 0.34.4), 14/14 short sentences and 10/10 fast-typed messages fixed, median 0.40 s / 0.58 s; rewrites 30/30 variants kept, median 1.62 s.
- Product screenshots in the repo's `assets/` (English UI).
- No testimonials, user counts, logos or press. Do not invent any.

## Product Principles

- Show the product working before describing it.
- Every claim on the page can be checked in the repo.
- Quiet confidence: the page is made with care, it doesn't shout.
- Privacy is a fact to state plainly, with its one exception (the optional API key).

## Accessibility & Inclusion

The animated demo has a text equivalent for screen readers and freezes under `prefers-reduced-motion`. Contrast holds in light and dark schemes.
