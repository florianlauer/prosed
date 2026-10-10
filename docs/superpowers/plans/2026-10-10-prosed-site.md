# prosed showcase site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-page, five-language, fully prerendered showcase site for prosed in `site/`, deployed on Vercel at `prosed.flauercase.dev`.

**Architecture:** TanStack Start prerenders one route, `{-$locale}/index.tsx`, into five static HTML files. The text lives in typed TypeScript objects, one per language. The demo is a pure frame list (`buildFrames`) played by a small React component. Vercel serves `dist/client` as static files, with no Functions.

**Tech Stack:** Vite+ 1.1.0 (`vp`), pnpm 12.11.2, TanStack Start 1.168 / Router 1.170, React 19.3, TypeScript 7, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-10-prosed-site-design.md`. Read it before any task.

## Global Constraints

- Everything new lives in `site/`. At the repo root, only `.prettierignore` and `devenv.nix` change.
- `site/` is standalone, not a workspace of the root (which stays on npm). `site/package.json` has `"packageManager": "pnpm@12.11.2"`.
- No server code, no Function on Vercel. Output is static HTML in `site/dist/client`.
- Five locales, exactly: `en` at `/`, then `/fr`, `/de`, `/es`, `/it`. No `/en`. An unknown locale is a 404.
- No i18n library, no analytics, no request to a third party (fonts included). Fonts are the four Plex `woff2` files copied from `src/options/fonts/`.
- Brand tokens, unchanged: paper `#ece7dc`, ink `#15181d`, mistake `oklch(66% 0.19 29)`, fix `oklch(72% 0.15 152)`, rewrite `oklch(70% 0.15 290)`. Plex Mono for the wordmark, taglines and command-like text, Plex Sans for running text.
- `sed for your prose.` is never translated. `prosed` is always lowercase.
- Honest copy: every number on the page comes from `README.md` (benchmark section). No invented metric, testimonial or logo.
- Any task that writes or changes UI loads `impeccable:impeccable` and `hallmark` first (see "Design skills" below). Tasks 2, 5, 6 and 7 do.
- Code comments, identifiers and test names are in English. Comments say why, in one short line.
- TypeScript: functions taking an object parameter destructure it in the signature.
- **Never `git commit`.** Florian commits. Each task ends by staging its files with `git add` and proposing a commit message in English (conventional style, no Claude attribution).
- Prose written for the page follows the `unslop` skill. French uses a narrow no-break space (U+202F) before `:`, `;`, `?` and `!`.

### Design skills (Tasks 2, 5, 6, 7)

Before touching UI code:

1. Load `impeccable:impeccable`. Run its setup once per session from `site/`: `<skill-base-dir>/scripts/impeccable context`. Mode is **Persuade**. Read its `reference/craft-floor.md` right before each UI edit.
2. Load `hallmark`. Its pre-flight finds `site/DESIGN.md` (from Task 2) and defers to it. Its three questions are answered by the spec: audience = developers and recruiters landing from a link; use case = understand prosed and reach the repo; tone = editorial. Do not rotate a catalog theme; the brand is the theme.
3. When the two skills disagree, the stricter rule wins. If they truly conflict, stop and ask Florian.
4. Hallmark's disciplines hold: no invented numbers, colors and fonts only through tokens, no re-drawn window chrome around the demo, roman (non-italic) headings, layout checked at 320, 375, 414 and 768 px.

### Tooling on this machine

- `pnpm` comes from `devenv.nix` (Task 1). Run it as `devenv shell -- pnpm <args>` from `site/`, or inside an active devenv shell. pnpm switches itself to the `packageManager` version.
- Once `site/pnpm-lock.yaml` exists, Florian's global rule applies: if `nub` is installed, use `nub install`, `nub add`, `nub run <script>` in `site/`. If nub fails or behaves differently, rerun with pnpm and say so.
- Vercel CLI: `pnpm dlx vercel@63.1.2 <args>` from `site/`. Nothing global. (The spec said `devenv.nix`; a pinned `dlx` avoids depending on nixpkgs packaging the CLI.)
- Headless Chromium for screenshots: under `~/.cache/ms-playwright/`. Browser QA uses gstack `/browse`.

## Review Focus

1. **No JavaScript, or before hydration.** The prerendered HTML must show a meaningful demo (two underlined words and the open fix card), not an empty field. Pinned by the `renderToString` test in Task 5.
2. **Odd locale URLs.** `/en`, `/FR` and `/pt` must be 404s, and `/fr/` must redirect to `/fr`. Pinned by the `localeFromParam` test in Task 1 and the curl checks in Task 9.
3. **Long words and wide popups on a 320 px screen.** German `Umformulierungsfunktion` and the three-variant rewrite card must not cause horizontal scroll, in any frame of the loop. Pinned by the overflow sampling in Task 8.
4. **Demo off screen or tab hidden.** The loop must stop and resume where it was. Pinned by the `data-frame` check in Task 8.
5. **Dark mode.** The underline, fix and rewrite colors must stay readable on ink. Pinned by the dark-scheme screenshot and Hallmark's contrast gates in Task 8.

---

## File map

```
devenv.nix                         modify: add pkgs.pnpm
.prettierignore                    modify: add site
site/
  .gitignore                       node_modules, dist, .vercel, .tanstack, .output
  package.json                     scripts + deps
  pnpm-lock.yaml                   generated
  tsconfig.json                    from the template, plus scripts/ and .ts imports
  vite.config.ts                   vite-plus config, TanStack Start, prerender pages
  vercel.json                      static output, clean URLs, ignoreCommand
  DESIGN.md                        locked tokens (Task 2)
  PRODUCT.md                       Impeccable product context (Task 2)
  scripts/
    check-dist.ts                  post-build check of the HTML files (Task 7)
    og.html                        share image template (Task 7)
  public/
    fonts/*.woff2                  copied from src/options/fonts/
    brand/prosed.svg               copied from assets/brand/
    404.html                       static 404 (Task 7)
    og.png                         generated once (Task 7)
    sitemap.xml, robots.txt        (Task 7)
  src/
    router.tsx                     getRouter()
    routeTree.gen.ts               generated by the plugin, not edited
    routes/__root.tsx              document shell, <html lang>, global head
    routes/{-$locale}/index.tsx    the page, per locale
    i18n/locales.ts                LOCALES, localeFromParam, localePath, SITE_URL
    i18n/locales.test.ts
    i18n/head.ts                   localeHead(): title, meta, canonical, hreflang
    i18n/head.test.ts
    content/en.ts                  reference text + Content type
    content/fr.ts de.ts es.ts it.ts
    content/index.ts               contentFor(locale)
    content/content.test.ts
    demo/frames.ts                 buildFrames, findWord, segments, stillFrameIndex
    demo/frames.test.ts
    components/Demo.tsx            plays the frames
    components/Demo.test.tsx
    components/Page.tsx            header, hero, blocks, footer
    styles/tokens.css              every token
    styles/base.css                fonts, reset, page layout
    styles/demo.css                field, underlines, cards, badge
    styles.css                     imports the three files above
```

---

### Task 1: Tooling and walking skeleton, deployed to a Vercel preview

The point of this task is to prove the riskiest assumption first: a prerendered TanStack Start build served by Vercel as plain static files.

**Files:**
- Modify: `devenv.nix`, `.prettierignore`
- Create: `site/.gitignore`, `site/package.json`, `site/tsconfig.json`, `site/vite.config.ts`, `site/vercel.json`, `site/src/router.tsx`, `site/src/routes/__root.tsx`, `site/src/routes/{-$locale}/index.tsx`, `site/src/i18n/locales.ts`, `site/src/i18n/locales.test.ts`, `site/src/styles.css`
- Test: `site/src/i18n/locales.test.ts`

**Interfaces:**
- Produces: `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `SITE_URL`, `isLocale(value: unknown): value is Locale`, `localeFromParam(param: string | undefined): Locale | null`, `localePath(locale: Locale): string`, `LANGUAGE_NAMES: Record<Locale, string>`, all from `site/src/i18n/locales.ts`.

- [ ] **Step 1: Branch**

```bash
cd /home/ubuntu/perso/prosed && git switch -c feat/site
```

- [ ] **Step 2: Add pnpm to devenv and keep Prettier off the site**

In `devenv.nix`, add `pkgs.pnpm` to `packages`, right after `pkgs.nsis`:

```nix
    # the showcase site (site/) uses pnpm
    pkgs.pnpm
```

Append to `.prettierignore`:

```
# the showcase site is formatted by Vite+ (oxfmt)
site
```

Run: `devenv shell -- pnpm --version`. Expected: a version number.

- [ ] **Step 3: Scaffold with the Vite+ TanStack Start template**

```bash
cd /home/ubuntu/perso/prosed
devenv shell -- pnpm dlx --package=vite-plus@1.1.0 vp create @tanstack/start site
```

Answer the prompts: React, TypeScript, pnpm, no Tailwind, no add-ons, no git init, no agent or editor files. Then look at what it produced (`ls -R site | head -80`, `cat site/package.json site/vite.config.ts site/tsconfig.json site/src/router.tsx`). The template is the source of truth for how `vite-plus`, `vite` and the TanStack plugin are wired: keep its dependency set and its `router.tsx` (including any `Register` declaration), then strip it down:

- Delete the template's demo routes, components, images, Tailwind config and devtools packages if any (`pnpm remove <pkg>` for packages).
- Keep `src/router.tsx`, `src/routeTree.gen.ts` (it gets regenerated) and the `tsconfig.json` settings.

- [ ] **Step 4: Write `site/.gitignore`**

The root `.gitignore` only ignores `/node_modules` at the root.

```
node_modules
dist
.output
.tanstack
.vercel
```

- [ ] **Step 5: Set `site/package.json` fields and scripts**

Keep the dependencies the template installed. Set these fields (exact values):

```json
{
  "name": "prosed-site",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.11.2",
  "engines": { "node": "24.x" },
  "scripts": {
    "dev": "vp dev",
    "build": "vp check && vp build",
    "preview": "vp preview",
    "test": "vp test"
  }
}
```

Task 7 appends `&& node scripts/check-dist.ts` to `build`.

- [ ] **Step 6: Write the failing locale test**

`site/src/i18n/locales.test.ts`. If the template's example test imports its test API from somewhere other than `vite-plus/test`, use that import instead.

```ts
import { describe, expect, it } from "vite-plus/test";
import { LOCALES, localeFromParam, localePath } from "./locales";

describe("localeFromParam", () => {
  it("maps the root to English", () => {
    expect(localeFromParam(undefined)).toBe("en");
  });

  it("accepts the four prefixed locales", () => {
    for (const locale of ["fr", "de", "es", "it"]) expect(localeFromParam(locale)).toBe(locale);
  });

  it("rejects /en so English has a single URL", () => {
    expect(localeFromParam("en")).toBeNull();
  });

  it("rejects unknown and wrongly cased locales", () => {
    expect(localeFromParam("pt")).toBeNull();
    expect(localeFromParam("FR")).toBeNull();
    expect(localeFromParam("")).toBeNull();
  });
});

describe("localePath", () => {
  it("puts English at the root and the others under a prefix", () => {
    expect(LOCALES.map((locale) => localePath(locale))).toEqual(["/", "/fr", "/de", "/es", "/it"]);
  });
});
```

Run: `cd site && devenv shell -- pnpm test`. Expected: FAIL, cannot resolve `./locales`.

- [ ] **Step 7: Write `site/src/i18n/locales.ts`**

```ts
export const LOCALES = ["en", "fr", "de", "es", "it"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const SITE_URL = "https://prosed.flauercase.dev";

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

// English lives at "/", so "/en" would be a second URL for the same page.
export function localeFromParam(param: string | undefined): Locale | null {
  if (param === undefined) return DEFAULT_LOCALE;
  return param !== DEFAULT_LOCALE && isLocale(param) ? param : null;
}

export const localePath = (locale: Locale) => (locale === DEFAULT_LOCALE ? "/" : `/${locale}`);
```

Run: `devenv shell -- pnpm test`. Expected: PASS, 5 tests.

- [ ] **Step 8: Write the skeleton routes**

`site/src/styles.css` (filled in by Task 2):

```css
/* tokens, fonts and layout are imported here from Task 2 on */
```

`site/src/routes/__root.tsx`:

```tsx
/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { localeFromParam } from "../i18n/locales";
import css from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/brand/prosed.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  // Dev only: in production Vercel serves public/404.html.
  notFoundComponent: () => <p>Page not found. <a href="/">prosed</a></p>,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useParams({ strict: false });
  return (
    <html lang={localeFromParam(locale) ?? "en"}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

`site/src/routes/{-$locale}/index.tsx`:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { localeFromParam } from "../../i18n/locales";

export const Route = createFileRoute("/{-$locale}/")({
  beforeLoad: ({ params }) => {
    const locale = localeFromParam(params.locale);
    if (!locale) throw notFound();
    return { locale };
  },
  loader: ({ context }) => ({ locale: context.locale }),
  component: Home,
});

function Home() {
  const { locale } = Route.useLoaderData();
  return <h1>prosed · {locale}</h1>;
}
```

- [ ] **Step 9: Configure prerendering in `site/vite.config.ts`**

Keep the template's import of `defineConfig` (from `vite-plus`) and any plugin it adds that is needed to run. The resulting file has this shape:

```ts
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { LOCALES, localePath } from "./src/i18n/locales";

const generated = ["dist/**", "src/routeTree.gen.ts"];

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        // Only the five locale pages exist; nothing to discover or crawl.
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        failOnError: true,
      },
      pages: LOCALES.map((locale) => ({ path: localePath(locale), prerender: { enabled: true } })),
    }),
    // React's plugin must come after Start's.
    viteReact(),
  ],
  fmt: { ignorePatterns: generated },
  lint: { ignorePatterns: generated },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
```

- [ ] **Step 10: Build and inspect the output**

```bash
cd site && devenv shell -- pnpm build && find dist -name '*.html' | sort
```

Expected: `dist/client/index.html`, `dist/client/fr/index.html`, `dist/client/de/index.html`, `dist/client/es/index.html`, `dist/client/it/index.html`. Check `grep -o '<html lang="[a-z]*"' dist/client/fr/index.html` prints `<html lang="fr"`.

If the HTML lands somewhere other than `dist/client`, use that directory in Step 11 and in every later reference to `dist/client`. If `vp` picked npm instead of pnpm (look for a `package-lock.json` in `site/`), delete it and confirm `packageManager` is set; this is the package-manager risk the spec names.

- [ ] **Step 11: Write `site/vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist/client",
  "cleanUrls": true,
  "trailingSlash": false,
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
}
```

`framework: null` stops Vercel from treating the project as a TanStack Start server app.

- [ ] **Step 12: Deploy a preview (Florian approves the login)**

```bash
cd site
pnpm dlx vercel@63.1.2 login      # prints a URL; Florian approves it
pnpm dlx vercel@63.1.2 link       # new project "prosed-site" in Florian's account
pnpm dlx vercel@63.1.2 deploy     # preview deployment
```

Expected: a preview URL. Check `curl -s <url>/fr | grep -o '<html lang="fr"'` and `curl -sI <url>/pt` returns 404. In the Vercel dashboard, the deployment's "Functions" tab must be empty.

If the build fails on Vercel with a pnpm version error, add the environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` to the project and redeploy. If static output can't be made to work, stop and report: the fallback (Nitro preset) is Florian's call, per the spec.

- [ ] **Step 13: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add devenv.nix .prettierignore site
git status --short
```

Proposed message: `feat(site): scaffold the prerendered TanStack Start site`

---

### Task 2: Design system: DESIGN.md, tokens, fonts, base styles

**Load the design skills first** (see "Design skills" in Global Constraints).

**Files:**
- Create: `site/DESIGN.md`, `site/PRODUCT.md`, `site/src/styles/tokens.css`, `site/src/styles/base.css`, `site/public/fonts/*.woff2`, `site/public/brand/prosed.svg`
- Modify: `site/src/styles.css`, `site/src/routes/__root.tsx` (font preloads)

**Interfaces:**
- Produces: CSS custom properties used by every later task: `--color-paper`, `--color-ink`, `--color-ink-soft`, `--color-rule`, `--color-mistake`, `--color-fix`, `--color-rewrite`, `--color-focus`, `--font-mono`, `--font-sans`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-display`, `--space-1` to `--space-9`, `--radius-sm`, `--radius-md`, `--ease-out`, `--ease-in-out`, `--dur-fast`, `--dur-base`, `--measure`. A `.sr-only` utility class.

- [ ] **Step 1: Copy fonts and the icon**

```bash
cd /home/ubuntu/perso/prosed
mkdir -p site/public/fonts site/public/brand
cp src/options/fonts/*.woff2 site/public/fonts/
cp assets/brand/prosed.svg site/public/brand/
ls site/public/fonts
```

Expected: four files, `ibm-plex-mono-latin-{400,700}-normal.woff2` and `ibm-plex-sans-latin-{400,600}-normal.woff2`.

- [ ] **Step 2: Run Impeccable's context step and write PRODUCT.md**

From `site/`, run Impeccable's `context` command. If it asks for product context (`init`), answer from the spec's "Why" and "Decisions" sections: product = prosed, a grammar checker that runs on a local model; surface = one showcase page; mode = Persuade; audience = developers and recruiters; success = understand prosed, watch the demo, reach the repo. Save it as `site/PRODUCT.md`.

- [ ] **Step 3: Write `site/DESIGN.md`**

This file locks the system so Hallmark's pre-flight defers to it. Content (English):

```markdown
# prosed site: design system

Locked by `docs/superpowers/specs/2026-10-10-prosed-site-design.md`, which inherits the rebrand spec. Do not rotate a theme or pick new fonts.

## Color

| Token | Light | Dark |
|---|---|---|
| `--color-paper` | `#ece7dc` | `#15181d` |
| `--color-ink` | `#15181d` | `#ece7dc` |
| `--color-ink-soft` | ink at 68 % | paper at 68 % |
| `--color-rule` | ink at 18 % | paper at 18 % |
| `--color-mistake` | `oklch(66% 0.19 29)` | same |
| `--color-fix` | `oklch(72% 0.15 152)` | same |
| `--color-rewrite` | `oklch(70% 0.15 290)` | same |

The brand has no hue. Mistake, fix and rewrite only appear where the product gives them meaning: the demo and the three feature marks.

## Type

IBM Plex Mono (400, 700) for the wordmark, the taglines, the benchmark. IBM Plex Sans (400, 600) for running text. Self-hosted `woff2`, latin subset. Headings are never italic.

## Tone

Editorial paper. Large type, wide margins, one column of reading width, hairline rules. The page could be printed.

## Motion

Only the demo moves. Nothing else animates on scroll. `prefers-reduced-motion: reduce` freezes the demo on its still frame.
```

- [ ] **Step 4: Write `site/src/styles/tokens.css`**

The first line is Hallmark's stamp. Fill in the macrostructure name once Task 6 picks it; until then use `pending`.

```css
/* Hallmark · macrostructure: pending · tone: editorial · anchor hue: none (ink on paper) */
:root {
  --color-paper: #ece7dc;
  --color-ink: #15181d;
  --color-ink-soft: color-mix(in oklch, var(--color-ink) 68%, var(--color-paper));
  --color-rule: color-mix(in oklch, var(--color-ink) 18%, var(--color-paper));
  --color-mistake: oklch(66% 0.19 29);
  --color-fix: oklch(72% 0.15 152);
  --color-rewrite: oklch(70% 0.15 290);
  --color-focus: var(--color-ink);

  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;

  --text-sm: 0.875rem;
  --text-base: 1.0625rem;
  --text-lg: 1.25rem;
  --text-xl: clamp(1.5rem, 1.2rem + 1.2vw, 2rem);
  --text-display: clamp(2.5rem, 1.4rem + 5vw, 5.5rem);

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4.5rem;
  --space-9: 7rem;

  --radius-sm: 4px;
  --radius-md: 10px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;

  --measure: 62ch;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-paper: #15181d;
    --color-ink: #ece7dc;
  }
}
```

- [ ] **Step 5: Write `site/src/styles/base.css` and wire `styles.css`**

`base.css` holds the four `@font-face` rules (`font-display: swap`, `url("/fonts/<file>")`, weights 400/700 mono and 400/600 sans), a small reset, `html, body { overflow-x: clip; }`, `body` in `--font-sans` / `--text-base` on `--color-paper` with `--color-ink`, a visible `:focus-visible` outline in `--color-focus` (not animated), link styles, and `.sr-only`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

The page layout itself comes in Task 6. `site/src/styles.css`:

```css
@import "./styles/tokens.css";
@import "./styles/base.css";
```

- [ ] **Step 6: Preload the two fonts used above the fold**

In `__root.tsx`, add to `links`:

```tsx
      { rel: "preload", href: "/fonts/ibm-plex-mono-latin-400-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/ibm-plex-sans-latin-400-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
```

- [ ] **Step 7: Verify**

Run: `cd site && devenv shell -- pnpm build`. Expected: PASS. Then `grep -c 'font/woff2' dist/client/index.html` prints `2`, and `grep -rn 'googleapis\|gstatic' dist/client` prints nothing.

- [ ] **Step 8: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site
```

Proposed message: `feat(site): lock the brand tokens and self-hosted Plex fonts`

---

### Task 3: Content in five languages, head tags, the page route

**Files:**
- Create: `site/src/content/en.ts`, `fr.ts`, `de.ts`, `es.ts`, `it.ts`, `site/src/content/index.ts`, `site/src/content/content.test.ts`, `site/src/i18n/head.ts`, `site/src/i18n/head.test.ts`
- Modify: `site/src/routes/{-$locale}/index.tsx`

**Interfaces:**
- Consumes: `Locale`, `LOCALES`, `SITE_URL`, `localePath` from Task 1.
- Produces: `type Content` and `en` from `content/en.ts`; `contentFor(locale: Locale): Content` from `content/index.ts`; `localeHead({ locale, content }: { locale: Locale; content: Content })` returning `{ meta, links }` for TanStack's `head()`. `Content["demo"]` has the shape `{ label: string; text: string; fixes: { from: string; to: string }[]; rewrite: { sentence: string; variants: string[] }; ui: { fixes: string; acceptAll: string; rewrite: string; rewrites: string } }`, which Task 4's `Demo` type matches.

- [ ] **Step 1: Write `site/src/content/en.ts`**

Before writing, load `unslop` and Hallmark's `copy.md`. The text below is the reference; adjust wording if those rules demand it, but keep every fact and every key.

```ts
// The reference text. Every other language is typed against it.
export const en = {
  meta: {
    title: "prosed · a grammar checker that runs on your machine",
    description:
      "prosed underlines spelling and grammar mistakes as you type, in your browser and in every app on macOS and Windows. It runs on a local model by default. Free and open source.",
  },
  header: { github: "GitHub", language: "Language" },
  hero: {
    tagline: "A grammar checker that runs on your machine.",
    repo: "Source on GitHub",
    releases: "Latest release",
  },
  features: {
    title: "What it does",
    fix: {
      title: "Fixes one word at a time",
      body: "Mistakes are underlined inside the field you type in. Hover one, click the fix, and that word changes. Nothing else does, and Cmd+Z or Ctrl+Z undoes it.",
    },
    rewrite: {
      title: "Rewrites when you ask",
      body: "Select a sentence to get three versions of it. A version that drops a number, a name or a link is never shown.",
    },
    memory: {
      title: "Remembers what you refused",
      body: "Words in your dictionary are never changed. A fix you ignore once is never proposed again, on any site.",
    },
  },
  machine: {
    title: "On your machine",
    body: "Checks run on a local model by default: Ollama, or Gemini Nano built into Chrome. With either one, your text stays on your computer.",
    byok: "You can also add your own API key for OpenAI, Anthropic, Mistral or another provider. Checks then go straight from your computer to that provider.",
    privacy: "Privacy policy",
    extension: {
      title: "Browser extension",
      body: "For Chromium browsers such as Chrome and Arc. Works in text areas and rich editors.",
    },
    desktop: {
      title: "Desktop app",
      body: "Checks the text you type in any app on macOS and Windows.",
    },
  },
  benchmark: {
    title: "Measured",
    body: "The benchmark sends the extension's own prompt to local models and grades every answer. With the default model, gemma4:e2b-it-qat, on an M2 Pro:",
    basic: "short sentences fixed",
    handwritten: "fast-typed messages fixed",
    rewrites: "rewrite variants kept",
    latency: "median time per check",
  },
  footer: {
    license: "MIT license",
    // "{upstream}" is replaced by a link to the original project.
    credit: "prosed started as a fork of {upstream} by Igor Adrov.",
    readme: "README",
    changelog: "Changelog",
  },
  demo: {
    label:
      "Animated example: prosed underlines two mistakes in a message, fixes them, then rewrites a long sentence.",
    text: "I think their going to ship the release on friday. We spent most of the week testing the new rewrite feature with the team in Lyon, and it seems to work well enough for now.",
    fixes: [
      { from: "their", to: "they're" },
      { from: "friday", to: "Friday" },
    ],
    rewrite: {
      sentence:
        "We spent most of the week testing the new rewrite feature with the team in Lyon, and it seems to work well enough for now.",
      variants: [
        "We spent most of the week testing the new rewrite feature with the team in Lyon, and it works well so far.",
        "The team in Lyon and I tested the new rewrite feature for most of the week, and it works well for now.",
        "Most of our week went into testing the new rewrite feature with the team in Lyon. So far it works well.",
      ],
    },
    ui: { fixes: "Fixes", acceptAll: "Accept all", rewrite: "Rewrite", rewrites: "Rewrites" },
  },
};

export type Content = typeof en;
```

The benchmark numbers are not text and live in the page component (Task 6).

- [ ] **Step 2: Write the four translations**

`fr.ts`, `de.ts`, `es.ts`, `it.ts`, each:

```ts
import type { Content } from "./en";

export const fr: Content = {
  // every key of en, translated
};
```

Rules for the translated text:

- Translate meaning, not word for word, and keep each fact. `prosed`, `sed for your prose.`, `Ollama`, `Gemini Nano`, `gemma4:e2b-it-qat`, `M2 Pro`, `Cmd+Z`, `Ctrl+Z`, `GitHub`, `README` and `{upstream}` stay as they are.
- `demo.ui` must reuse the product's own strings from `src/i18n/catalogs.ts`:

| | fixes | acceptAll | rewrite | rewrites |
|---|---|---|---|---|
| fr | Corrections | Tout appliquer | Reformuler | Reformulations |
| de | Korrekturen | Alle anwenden | Umformulieren | Umformulierungen |
| es | Correcciones | Aplicar todo | Reformular | Reformulaciones |
| it | Correzioni | Applica tutto | Riformula | Riformulazioni |

- French: narrow no-break space (U+202F) before `:`, `;`, `?`, `!`, and `«` `»` with the same space inside if quotes are needed.
- `demo` objects, exactly:

```ts
// fr.ts
  demo: {
    label: "Exemple animé : prosed souligne deux fautes dans un message, les corrige, puis reformule une longue phrase.",
    text: "Je pense que sa va marcher, on a tester hier soir. On a passé presque toute la semaine sur la nouvelle fonction de reformulation avec l'équipe de Lyon, et pour l'instant elle a l'air de plutôt bien marcher.",
    fixes: [
      { from: "sa", to: "ça" },
      { from: "tester", to: "testé" },
    ],
    rewrite: {
      sentence: "On a passé presque toute la semaine sur la nouvelle fonction de reformulation avec l'équipe de Lyon, et pour l'instant elle a l'air de plutôt bien marcher.",
      variants: [
        "On a passé presque toute la semaine sur la nouvelle fonction de reformulation avec l'équipe de Lyon, et elle marche plutôt bien pour l'instant.",
        "Avec l'équipe de Lyon, on a consacré presque toute la semaine à la nouvelle fonction de reformulation, qui marche bien pour l'instant.",
        "La nouvelle fonction de reformulation nous a occupés presque toute la semaine avec l'équipe de Lyon. Pour l'instant, elle marche bien.",
      ],
    },
    ui: { fixes: "Corrections", acceptAll: "Tout appliquer", rewrite: "Reformuler", rewrites: "Reformulations" },
  },
```

(Write U+202F as the ` ` escape so it stays visible in review.)

```ts
// de.ts
  demo: {
    label: "Animiertes Beispiel: prosed unterstreicht zwei Fehler in einer Nachricht, korrigiert sie und formuliert dann einen langen Satz um.",
    text: "Ich glaube, das wir die Version am freitag veröffentlichen. Wir haben fast die ganze Woche mit dem Team in Lyon die neue Umformulierungsfunktion getestet, und bisher scheint sie ziemlich gut zu funktionieren.",
    fixes: [
      { from: "das", to: "dass" },
      { from: "freitag", to: "Freitag" },
    ],
    rewrite: {
      sentence: "Wir haben fast die ganze Woche mit dem Team in Lyon die neue Umformulierungsfunktion getestet, und bisher scheint sie ziemlich gut zu funktionieren.",
      variants: [
        "Wir haben die neue Umformulierungsfunktion fast die ganze Woche mit dem Team in Lyon getestet, und bisher funktioniert sie gut.",
        "Mit dem Team in Lyon haben wir fast die ganze Woche die neue Umformulierungsfunktion getestet. Bisher läuft sie gut.",
        "Fast die ganze Woche haben wir mit dem Team in Lyon die neue Umformulierungsfunktion geprüft, und sie funktioniert bisher gut.",
      ],
    },
    ui: { fixes: "Korrekturen", acceptAll: "Alle anwenden", rewrite: "Umformulieren", rewrites: "Umformulierungen" },
  },
```

```ts
// es.ts
  demo: {
    label: "Ejemplo animado: prosed subraya dos errores en un mensaje, los corrige y luego reformula una frase larga.",
    text: "Creo que la versión esta lista, ya hemos echo todas las pruebas. Pasamos casi toda la semana probando la nueva función de reformulación con el equipo de Lyon, y de momento parece funcionar bastante bien.",
    fixes: [
      { from: "esta", to: "está" },
      { from: "echo", to: "hecho" },
    ],
    rewrite: {
      sentence: "Pasamos casi toda la semana probando la nueva función de reformulación con el equipo de Lyon, y de momento parece funcionar bastante bien.",
      variants: [
        "Pasamos casi toda la semana probando la nueva función de reformulación con el equipo de Lyon, y de momento funciona bien.",
        "Con el equipo de Lyon, dedicamos casi toda la semana a probar la nueva función de reformulación, que de momento funciona bien.",
        "La nueva función de reformulación nos ocupó casi toda la semana de pruebas con el equipo de Lyon. De momento, funciona bien.",
      ],
    },
    ui: { fixes: "Correcciones", acceptAll: "Aplicar todo", rewrite: "Reformular", rewrites: "Reformulaciones" },
  },
```

```ts
// it.ts
  demo: {
    label: "Esempio animato: prosed sottolinea due errori in un messaggio, li corregge e poi riformula una frase lunga.",
    text: "La versione è quasi pronta, ma aspettiamo perchè manca ancora un pò di test. Abbiamo passato quasi tutta la settimana a provare la nuova funzione di riformulazione con il team di Lione, e per ora sembra funzionare abbastanza bene.",
    fixes: [
      { from: "perchè", to: "perché" },
      { from: "pò", to: "po'" },
    ],
    rewrite: {
      sentence: "Abbiamo passato quasi tutta la settimana a provare la nuova funzione di riformulazione con il team di Lione, e per ora sembra funzionare abbastanza bene.",
      variants: [
        "Abbiamo passato quasi tutta la settimana a provare la nuova funzione di riformulazione con il team di Lione, e per ora funziona bene.",
        "Con il team di Lione abbiamo dedicato quasi tutta la settimana alla nuova funzione di riformulazione, che per ora funziona bene.",
        "La nuova funzione di riformulazione ci ha tenuti occupati quasi tutta la settimana con il team di Lione. Per ora funziona bene.",
      ],
    },
    ui: { fixes: "Correzioni", acceptAll: "Applica tutto", rewrite: "Riformula", rewrites: "Riformulazioni" },
  },
```

The German, Spanish and Italian demo sentences need a native reader before launch (spec). Task 9 lists that as Florian's step.

- [ ] **Step 3: Write `site/src/content/index.ts`**

```ts
import type { Locale } from "../i18n/locales";
import { de } from "./de";
import { type Content, en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";

const contents: Record<Locale, Content> = { en, fr, de, es, it };

export const contentFor = (locale: Locale): Content => contents[locale];
export type { Content };
```

- [ ] **Step 4: Write the failing content test**

`site/src/content/content.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { LOCALES } from "../i18n/locales";
import { contentFor } from "./index";

const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : typeof value === "object" && value ? Object.values(value).flatMap(strings) : [];

describe.each(LOCALES)("content %s", (locale) => {
  const content = contentFor(locale);

  it("keeps exactly one {upstream} slot in the footer credit", () => {
    expect(content.footer.credit.split("{upstream}")).toHaveLength(2);
  });

  it("uses a narrow no-break space before French high punctuation", () => {
    if (locale !== "fr") return;
    for (const text of strings(content)) expect(text).not.toMatch(/[^ ][:;?!](\s|$)/u);
  });
});
```

The French check flags a `:`, `;`, `?` or `!` that ends a word or the string and isn't preceded by a narrow no-break space. URLs (`https://`) don't trip it because `/` follows the colon.

Run: `cd site && devenv shell -- pnpm test`. Expected: PASS once Steps 1-3 are written correctly; to see it fail first, temporarily remove `{upstream}` from `de.ts`, run, and restore it.

- [ ] **Step 5: Write the failing head test**

`site/src/i18n/head.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { localeHead } from "./head";

describe("localeHead", () => {
  it("points the canonical at the page's own URL", () => {
    const { links } = localeHead({ locale: "fr", content: contentFor("fr") });
    expect(links.find((link) => link.rel === "canonical")?.href).toBe("https://prosed.flauercase.dev/fr");
  });

  it("lists five alternates and an x-default on the root", () => {
    const { links } = localeHead({ locale: "de", content: contentFor("de") });
    const alternates = links.filter((link) => link.rel === "alternate");
    expect(alternates.map((link) => link.hrefLang)).toEqual(["en", "fr", "de", "es", "it", "x-default"]);
    expect(alternates.at(-1)?.href).toBe("https://prosed.flauercase.dev/");
  });

  it("uses the translated title", () => {
    const { meta } = localeHead({ locale: "es", content: contentFor("es") });
    expect(meta[0]).toEqual({ title: contentFor("es").meta.title });
  });
});
```

Run: `devenv shell -- pnpm test`. Expected: FAIL, cannot resolve `./head`.

- [ ] **Step 6: Write `site/src/i18n/head.ts`**

```ts
import type { Content } from "../content";
import { LOCALES, type Locale, SITE_URL, localePath } from "./locales";

const OG_LOCALES: Record<Locale, string> = { en: "en_US", fr: "fr_FR", de: "de_DE", es: "es_ES", it: "it_IT" };

const absolute = (locale: Locale) => SITE_URL + localePath(locale);

type HeadLink = { rel: string; href: string; hrefLang?: string };

export function localeHead({ locale, content }: { locale: Locale; content: Content }) {
  const url = absolute(locale);
  const links: HeadLink[] = [
    { rel: "canonical", href: url },
    ...LOCALES.map((alternate) => ({ rel: "alternate", hrefLang: alternate, href: absolute(alternate) })),
    { rel: "alternate", hrefLang: "x-default", href: absolute("en") },
  ];
  return {
    links,
    meta: [
      { title: content.meta.title },
      { name: "description", content: content.meta.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:title", content: content.meta.title },
      { property: "og:description", content: content.meta.description },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { property: "og:locale", content: OG_LOCALES[locale] },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
```

Run: `devenv shell -- pnpm test`. Expected: PASS.

- [ ] **Step 7: Use content and head in the route**

`site/src/routes/{-$locale}/index.tsx` becomes:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { contentFor } from "../../content";
import { localeHead } from "../../i18n/head";
import { localeFromParam } from "../../i18n/locales";

export const Route = createFileRoute("/{-$locale}/")({
  beforeLoad: ({ params }) => {
    const locale = localeFromParam(params.locale);
    if (!locale) throw notFound();
    return { locale };
  },
  loader: ({ context }) => ({ locale: context.locale }),
  head: ({ loaderData }) =>
    loaderData ? localeHead({ locale: loaderData.locale, content: contentFor(loaderData.locale) }) : {},
  component: Home,
});

function Home() {
  const { locale } = Route.useLoaderData();
  const content = contentFor(locale);
  return <h1>{content.hero.tagline}</h1>;
}
```

Task 6 replaces `Home`'s body with the page.

- [ ] **Step 8: Verify the build and the head**

```bash
cd site && devenv shell -- pnpm build
grep -o 'hreflang="[a-z-]*"' dist/client/it/index.html
grep -o '<title>[^<]*' dist/client/de/index.html
```

Expected: six `hreflang` values ending with `x-default`, and the German title. A missing key in any translation fails `vp check` before the build: try it once by deleting `hero.repo` from `it.ts`, confirm the error, restore.

- [ ] **Step 9: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site
```

Proposed message: `feat(site): add the five-language content and head tags`

---

### Task 4: The demo as a list of frames

Pure logic, no UI. The component in Task 5 only renders a frame.

**Files:**
- Create: `site/src/demo/frames.ts`, `site/src/demo/frames.test.ts`

**Interfaces:**
- Consumes: `Content["demo"]` from Task 3 (structurally compatible with `Demo`).
- Produces, from `site/src/demo/frames.ts`:

```ts
export type Fix = { from: string; to: string };
export type Demo = { text: string; fixes: Fix[]; rewrite: { sentence: string; variants: string[] } };
export type Range = { start: number; end: number };
export type Popup =
  | { kind: "fix"; on: Range; to: string }
  | { kind: "panel"; items: Fix[] }
  | { kind: "rewrite-button"; on: Range }
  | { kind: "rewrite"; on: Range; variants: string[]; picked: number | null };
export type Frame = { text: string; mistakes: Range[]; selection: Range | null; badge: number; popup: Popup | null; press: boolean; hold: number };
export type Segment = { text: string; start: number; mark: "mistake" | "selection" | null };
export const PICKED_VARIANT: number;
export function findWord(text: string, word: string): Range[];
export function buildFrames({ text, fixes, rewrite }: Demo): Frame[];
export function stillFrameIndex(frames: Frame[]): number;
export function segments({ text, mistakes, selection }: Pick<Frame, "text" | "mistakes" | "selection">): Segment[];
```

- [ ] **Step 1: Write the failing tests**

`site/src/demo/frames.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { LOCALES } from "../i18n/locales";
import { PICKED_VARIANT, buildFrames, findWord, segments, stillFrameIndex } from "./frames";

describe("findWord", () => {
  it("matches whole words only, accents included", () => {
    expect(findWord("esta está", "esta")).toEqual([{ start: 0, end: 4 }]);
    expect(findWord("passé sa", "sa")).toEqual([{ start: 6, end: 8 }]);
  });
});

describe.each(LOCALES)("demo data %s", (locale) => {
  const demo = contentFor(locale).demo;

  it("has every fix exactly once as a whole word", () => {
    for (const fix of demo.fixes) expect(findWord(demo.text, fix.from)).toHaveLength(1);
  });

  it("has at least two fixes, one for the card and one for the panel", () => {
    expect(demo.fixes.length).toBeGreaterThanOrEqual(2);
  });

  it("finds the sentence to rewrite once the fixes are applied", () => {
    let text = demo.text;
    for (const fix of demo.fixes) {
      const [range] = findWord(text, fix.from);
      if (range) text = text.slice(0, range.start) + fix.to + text.slice(range.end);
    }
    expect(text).toContain(demo.rewrite.sentence);
  });

  it("offers three variants that differ from the sentence", () => {
    expect(demo.rewrite.variants).toHaveLength(3);
    for (const variant of demo.rewrite.variants) expect(variant).not.toBe(demo.rewrite.sentence);
  });
});

describe("buildFrames", () => {
  const demo = contentFor("en").demo;
  const frames = buildFrames(demo);

  it("starts by typing the first character", () => {
    expect(frames[0]?.text).toBe(demo.text.charAt(0));
  });

  it("ends on the fixed text with the picked variant in place", () => {
    const expected = "I think they're going to ship the release on Friday. " + demo.rewrite.variants[PICKED_VARIANT];
    expect(frames.at(-1)?.text).toBe(expected);
  });

  it("keeps every range inside its frame's text", () => {
    for (const frame of frames) {
      for (const range of [...frame.mistakes, ...(frame.selection ? [frame.selection] : [])]) {
        expect(range.end).toBeLessThanOrEqual(frame.text.length);
      }
    }
  });

  it("holds every frame for a positive time", () => {
    expect(frames.every((frame) => frame.hold > 0)).toBe(true);
  });

  it("has a still frame with both mistakes underlined and the fix card open", () => {
    const still = frames[stillFrameIndex(frames)];
    expect(still?.popup?.kind).toBe("fix");
    expect(still?.mistakes).toHaveLength(2);
    expect(still?.press).toBe(false);
  });
});

describe("segments", () => {
  it("covers the whole text and marks the ranges", () => {
    const text = "a their b friday c";
    const parts = segments({ text, mistakes: findWord(text, "their").concat(findWord(text, "friday")), selection: null });
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.mark === "mistake").map((part) => part.text)).toEqual(["their", "friday"]);
  });

  it("marks a selection", () => {
    const parts = segments({ text: "one two", mistakes: [], selection: { start: 4, end: 7 } });
    expect(parts).toEqual([
      { text: "one ", start: 0, mark: null },
      { text: "two", start: 4, mark: "selection" },
    ]);
  });
});
```

Run: `cd site && devenv shell -- pnpm test`. Expected: FAIL, cannot resolve `./frames`.

- [ ] **Step 2: Write `site/src/demo/frames.ts`**

```ts
export type Fix = { from: string; to: string };
export type Demo = { text: string; fixes: Fix[]; rewrite: { sentence: string; variants: string[] } };
export type Range = { start: number; end: number };
export type Popup =
  | { kind: "fix"; on: Range; to: string }
  | { kind: "panel"; items: Fix[] }
  | { kind: "rewrite-button"; on: Range }
  | { kind: "rewrite"; on: Range; variants: string[]; picked: number | null };
export type Frame = {
  text: string;
  mistakes: Range[];
  selection: Range | null;
  badge: number;
  popup: Popup | null;
  press: boolean;
  // How long the frame stays on screen, in ms.
  hold: number;
};
export type Segment = { text: string; start: number; mark: "mistake" | "selection" | null };

export const PICKED_VARIANT = 0;

const LETTER = "[\\p{L}\\p{N}]";
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function findWord(text: string, word: string): Range[] {
  const pattern = new RegExp(`(?<!${LETTER})${escape(word)}(?!${LETTER})`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + word.length }));
}

function rangeOf(text: string, word: string): Range {
  const [range] = findWord(text, word);
  if (!range) throw new Error(`"${word}" is not in the demo text`);
  return range;
}

const replaceAt = (text: string, { start, end }: Range, by: string) => text.slice(0, start) + by + text.slice(end);

export function buildFrames({ text, fixes, rewrite }: Demo): Frame[] {
  const frames: Frame[] = [];
  const push = (frame: Partial<Frame> & Pick<Frame, "text" | "hold">) =>
    frames.push({ mistakes: [], selection: null, badge: 0, popup: null, press: false, ...frame });
  const marks = (current: string, list: Fix[]) => list.map((fix) => rangeOf(current, fix.from));

  for (let i = 1; i <= text.length; i++) {
    // Pause a little after punctuation, like a person typing.
    push({ text: text.slice(0, i), hold: /[.,!?]/.test(text.charAt(i - 1)) ? 220 : 38 });
  }
  // The product checks after 500 ms without typing.
  push({ text, hold: 500 });

  const [first, ...rest] = fixes;
  const picked = rewrite.variants[PICKED_VARIANT];
  if (!first || rest.length === 0 || picked === undefined) {
    throw new Error("The demo needs two fixes and a variant to pick");
  }
  const firstRange = rangeOf(text, first.from);
  const withCard = { text, mistakes: marks(text, fixes), badge: fixes.length };
  push({ ...withCard, hold: 900 });
  push({ ...withCard, popup: { kind: "fix", on: firstRange, to: first.to }, hold: 1400 });
  push({ ...withCard, popup: { kind: "fix", on: firstRange, to: first.to }, press: true, hold: 250 });

  let current = replaceAt(text, firstRange, first.to);
  const withPanel = { text: current, mistakes: marks(current, rest), badge: rest.length };
  push({ ...withPanel, hold: 700 });
  push({ ...withPanel, popup: { kind: "panel", items: rest }, hold: 1600 });
  push({ ...withPanel, popup: { kind: "panel", items: rest }, press: true, hold: 250 });

  for (const fix of rest) current = replaceAt(current, rangeOf(current, fix.from), fix.to);
  push({ text: current, hold: 800 });

  const start = current.indexOf(rewrite.sentence);
  if (start < 0) throw new Error("The sentence to rewrite is not in the fixed text");
  const on = { start, end: start + rewrite.sentence.length };
  const card = (picked: number | null): Popup => ({ kind: "rewrite", on, variants: rewrite.variants, picked });
  push({ text: current, selection: on, hold: 500 });
  push({ text: current, selection: on, popup: { kind: "rewrite-button", on }, hold: 900 });
  push({ text: current, selection: on, popup: { kind: "rewrite-button", on }, press: true, hold: 250 });
  push({ text: current, selection: on, popup: card(null), hold: 1800 });
  push({ text: current, selection: on, popup: card(PICKED_VARIANT), press: true, hold: 400 });
  push({ text: replaceAt(current, on, picked), hold: 2600 });

  return frames;
}

// Shown before hydration, without JavaScript and with reduced motion.
export const stillFrameIndex = (frames: Frame[]) =>
  frames.findIndex((frame) => frame.popup?.kind === "fix" && !frame.press);

export function segments({ text, mistakes, selection }: Pick<Frame, "text" | "mistakes" | "selection">): Segment[] {
  const ranges = [
    ...mistakes.map((range) => ({ ...range, mark: "mistake" as const })),
    ...(selection ? [{ ...selection, mark: "selection" as const }] : []),
  ].sort((a, b) => a.start - b.start);
  const parts: Segment[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start > at) parts.push({ text: text.slice(at, range.start), start: at, mark: null });
    parts.push({ text: text.slice(range.start, range.end), start: range.start, mark: range.mark });
    at = range.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), start: at, mark: null });
  return parts;
}
```

- [ ] **Step 3: Run the tests**

Run: `devenv shell -- pnpm test`. Expected: PASS for all locales. If a locale's demo data fails, fix the data in `content/<locale>.ts`, not the test.

- [ ] **Step 4: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site/src/demo
```

Proposed message: `feat(site): model the scripted demo as a list of frames`

---

### Task 5: The demo component

**Load the design skills first.** Look at the product's own overlay styles in `src/contentScript/overlay.css` (underline, card, badge, panel) and match their shapes with the site's tokens. Do not import that file.

**Files:**
- Create: `site/src/components/Demo.tsx`, `site/src/components/Demo.test.tsx`, `site/src/styles/demo.css`
- Modify: `site/src/styles.css` (import `demo.css`)

**Interfaces:**
- Consumes: `buildFrames`, `stillFrameIndex`, `segments`, `Frame`, `Popup` from Task 4; `Content["demo"]` from Task 3; tokens from Task 2.
- Produces: `Demo({ demo }: { demo: Content["demo"] })`, a React component. Its root element has `data-frame={index}` for browser QA.

- [ ] **Step 1: Write the failing render test**

`site/src/components/Demo.test.tsx`:

```tsx
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { Demo } from "./Demo";

describe("Demo", () => {
  it("prerenders the still frame: two underlined words and the open fix card", () => {
    const demo = contentFor("fr").demo;
    const html = renderToString(<Demo demo={demo} />);
    expect(html.match(/class="demo-mistake"/g)).toHaveLength(2);
    expect(html).toContain("ça");
    expect(html).toContain(demo.label);
  });
});
```

Run: `cd site && devenv shell -- pnpm test`. Expected: FAIL, cannot resolve `./Demo`.

- [ ] **Step 2: Write `site/src/components/Demo.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "../content";
import { type Frame, type Popup, buildFrames, segments, stillFrameIndex } from "../demo/frames";

type Ui = Content["demo"]["ui"];

export function Demo({ demo }: { demo: Content["demo"] }) {
  const frames = useMemo(() => buildFrames(demo), [demo]);
  const still = stillFrameIndex(frames);
  // The server, no-JS visitors and reduced motion all get the still frame.
  const [index, setIndex] = useState(still);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let next = 0;
    let visible = false;
    let timer: number | undefined;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const run = () => {
      if (timer !== undefined || !visible || document.hidden) return;
      setIndex(next);
      timer = window.setTimeout(() => {
        timer = undefined;
        next = (next + 1) % frames.length;
        run();
      }, frames[next]?.hold ?? 0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) run();
      else stop();
    });
    const onVisibility = () => (document.hidden ? stop() : run());
    observer.observe(root.current);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [frames]);

  const frame = frames[index];
  if (!frame) return null;
  return (
    <figure className="demo" ref={root} data-frame={index}>
      <figcaption className="sr-only">{demo.label}</figcaption>
      <div className="demo-field" aria-hidden="true">
        <p className="demo-text">
          {segments(frame).map((part) => (
            <span key={part.start} className={part.mark ? `demo-${part.mark}` : undefined}>
              {part.text}
              {frame.popup && "on" in frame.popup && frame.popup.on.start === part.start ? (
                <PopupView popup={frame.popup} frame={frame} ui={demo.ui} />
              ) : null}
            </span>
          ))}
          <span className="demo-caret" />
        </p>
        {frame.badge > 0 ? (
          <span className="demo-badge">
            {frame.badge}
            {frame.popup?.kind === "panel" ? <PopupView popup={frame.popup} frame={frame} ui={demo.ui} /> : null}
          </span>
        ) : null}
      </div>
    </figure>
  );
}

// Spans only: the popups sit inside a <p>.
function PopupView({ popup, frame, ui }: { popup: Popup; frame: Frame; ui: Ui }) {
  const pointer = <span className="demo-pointer" data-press={frame.press} />;
  switch (popup.kind) {
    case "fix":
      return (
        <span className="demo-card">
          <span className="demo-from">{frame.text.slice(popup.on.start, popup.on.end)}</span>
          <span className="demo-to">
            {popup.to}
            {pointer}
          </span>
        </span>
      );
    case "panel":
      return (
        <span className="demo-card demo-panel">
          <span className="demo-heading">{ui.fixes}</span>
          {popup.items.map((item) => (
            <span key={item.from} className="demo-row">
              <span className="demo-from">{item.from}</span> <span className="demo-to">{item.to}</span>
            </span>
          ))}
          <span className="demo-button">
            {ui.acceptAll}
            {pointer}
          </span>
        </span>
      );
    case "rewrite-button":
      return (
        <span className="demo-rewrite-button">
          {ui.rewrite}
          {pointer}
        </span>
      );
    case "rewrite":
      return (
        <span className="demo-card demo-rewrites">
          <span className="demo-heading">{ui.rewrites}</span>
          {popup.variants.map((variant, i) => (
            <span key={variant} className="demo-variant" data-picked={popup.picked === i}>
              {variant}
              {popup.picked === i ? pointer : null}
            </span>
          ))}
        </span>
      );
  }
}
```

Run: `devenv shell -- pnpm test`. Expected: PASS.

- [ ] **Step 3: Style the demo in `site/src/styles/demo.css`**

Import it from `styles.css` (`@import "./styles/demo.css";`). Requirements, all through tokens:

- `.demo-field`: a bordered writing surface (hairline `--color-rule`, `--radius-md`), `position: relative`, padding `--space-5`, `--font-sans`. No title bar, no dots, no fake app frame (Hallmark's re-drawn chrome rule).
- `.demo-text`: fixed `min-height` sized for the longest locale's full text, so the page doesn't jump while typing. `overflow-wrap: anywhere` so `Umformulierungsfunktion` wraps at 320 px.
- `.demo-mistake`: `text-decoration: underline wavy var(--color-mistake)`, `text-decoration-thickness: 1.5px`, `text-underline-offset: 3px`, and `position: relative` (popups anchor here).
- `.demo-selection`: background `color-mix(in oklch, var(--color-rewrite) 22%, transparent)`, `position: relative`.
- `.demo-card`: `position: absolute`, top just below the anchor, left 0, `z-index: 1`, `display: grid`, `--color-paper` background, hairline border, `--radius-md`, a soft shadow, `max-width: min(22rem, calc(100vw - 2 * var(--space-5)))`. `.demo-from` struck through in `--color-ink-soft`, `.demo-to` in `--color-fix` weight 600.
- `.demo-rewrites .demo-variant`: left border in `--color-rewrite`; `[data-picked="true"]` gets a `--color-rewrite` tinted background.
- `.demo-badge`: a small round counter at the field's bottom-right corner, `position: absolute`, `--color-mistake` background; its panel opens above it, aligned right.
- `.demo-rewrite-button`: a pill in `--color-rewrite` above the selection start.
- `.demo-pointer`: an inline SVG-like arrow drawn with CSS or a data-URI SVG, offset to the bottom-right of its parent; `[data-press="true"]` scales it to 0.88.
- `.demo-caret`: a 1.5 px bar in `--color-ink` that blinks with a `steps(1)` animation.
- Popups appear with a 120 ms opacity fade (`--dur-fast`, `--ease-out`). Animate only `opacity` and `transform`.
- `@media (prefers-reduced-motion: reduce)`: no caret blink, no fades.

- [ ] **Step 4: Look at it**

Temporarily render `<Demo demo={content.demo} />` in `Home` (Task 6 places it for real). Run `devenv shell -- pnpm dev`, open `/` and `/de` with gstack `/browse`, take screenshots at 1280 px and 320 px while the loop runs, and read them. Fix what looks wrong, in one batch (Impeccable's bounded passes).

- [ ] **Step 5: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site
```

Proposed message: `feat(site): play the scripted demo with the product's look`

---

### Task 6: The page

**Load the design skills first.** This is the task Hallmark and Impeccable shape the most. Before writing markup:

- Hallmark: state the macrostructure, nav archetype and footer archetype out loud, with the reason, respecting the spec's six blocks and their order. Update the stamp in `tokens.css` with the macrostructure name. Create `site/.hallmark/log.json` with the first entry.
- Impeccable: read `reference/craft-floor.md`.

The markup below fixes the content and semantics. Layout, spacing and the visual treatment of each block come from the design skills, in `base.css` (or a new `page.css` imported from `styles.css`), through tokens only.

**Files:**
- Create: `site/src/components/Page.tsx`, optionally `site/src/styles/page.css`
- Modify: `site/src/routes/{-$locale}/index.tsx`, `site/src/styles.css`, `site/src/styles/tokens.css` (stamp)

**Interfaces:**
- Consumes: `Content`, `contentFor` (Task 3), `Demo` (Task 5), `LOCALES`, `LANGUAGE_NAMES`, `localePath`, `Locale` (Task 1).
- Produces: `Page({ locale, content }: { locale: Locale; content: Content })`.

- [ ] **Step 1: Write `site/src/components/Page.tsx`**

```tsx
import type { Content } from "../content";
import { LANGUAGE_NAMES, LOCALES, type Locale, localePath } from "../i18n/locales";
import { Demo } from "./Demo";

const REPO = "https://github.com/florianlauer/prosed";
const UPSTREAM = "https://github.com/nucleartux/ai-grammar";

// From README.md, "Benchmark": gemma4:e2b-it-qat on an M2 Pro with Ollama 0.34.4.
const BENCH = { basic: "14/14", handwritten: "10/10", rewrites: "30/30", latency: "0.40 s / 0.58 s" };

export function Page({ locale, content }: { locale: Locale; content: Content }) {
  const [creditBefore, creditAfter] = content.footer.credit.split("{upstream}");
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href={localePath(locale)}>
          <img src="/brand/prosed.svg" alt="" width="32" height="32" />
          prosed
        </a>
        <nav aria-label={content.header.language}>
          <ul className="languages">
            {LOCALES.map((other) => (
              <li key={other}>
                <a href={localePath(other)} hrefLang={other} lang={other} aria-current={other === locale ? "page" : undefined}>
                  {LANGUAGE_NAMES[other]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href={REPO}>{content.header.github}</a>
      </header>

      <main>
        <section className="hero">
          <h1>sed for your prose.</h1>
          <p className="tagline">{content.hero.tagline}</p>
          <Demo demo={content.demo} />
          <p className="hero-links">
            <a href={REPO}>{content.hero.repo}</a>
            <a href={`${REPO}/releases/latest`}>{content.hero.releases}</a>
          </p>
        </section>

        <section className="features" aria-labelledby="features-title">
          <h2 id="features-title">{content.features.title}</h2>
          {(["fix", "rewrite", "memory"] as const).map((kind) => (
            <article key={kind} className="feature" data-kind={kind}>
              <h3>{content.features[kind].title}</h3>
              <p>{content.features[kind].body}</p>
            </article>
          ))}
        </section>

        <section className="machine" aria-labelledby="machine-title">
          <h2 id="machine-title">{content.machine.title}</h2>
          <p>{content.machine.body}</p>
          <p>{content.machine.byok}</p>
          <p>
            <a href={`${REPO}/blob/main/PRIVACY.md`}>{content.machine.privacy}</a>
          </p>
          {(["extension", "desktop"] as const).map((host) => (
            <article key={host} className="host">
              <h3>{content.machine[host].title}</h3>
              <p>{content.machine[host].body}</p>
            </article>
          ))}
        </section>

        <section className="benchmark" aria-labelledby="benchmark-title">
          <h2 id="benchmark-title">{content.benchmark.title}</h2>
          <p>{content.benchmark.body}</p>
          <dl>
            {(["basic", "handwritten", "rewrites", "latency"] as const).map((row) => (
              <div key={row}>
                <dt>{content.benchmark[row]}</dt>
                <dd>{BENCH[row]}</dd>
              </div>
            ))}
          </dl>
          <p>
            <code>node bench/grammar-bench.mjs gemma4:e2b-it-qat</code>
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          {creditBefore}
          <a href={UPSTREAM}>nucleartux/ai-grammar</a>
          {creditAfter}
        </p>
        <p>
          <a href={`${REPO}/blob/main/LICENSE`}>{content.footer.license}</a> ·{" "}
          <a href={`${REPO}#readme`}>{content.footer.readme}</a> ·{" "}
          <a href={`${REPO}/blob/main/CHANGELOG.md`}>{content.footer.changelog}</a>
        </p>
      </footer>
    </>
  );
}
```

The language links are plain `<a>`, so switching reloads the prerendered page of the other locale. That is intended.

- [ ] **Step 2: Render it from the route**

In `site/src/routes/{-$locale}/index.tsx`, replace `Home`:

```tsx
function Home() {
  const { locale } = Route.useLoaderData();
  return <Page locale={locale} content={contentFor(locale)} />;
}
```

and add `import { Page } from "../../components/Page";`.

- [ ] **Step 3: Design and style the blocks**

Following the macrostructure picked above and the spec's "The page" and "Visual direction":

- The hero puts `sed for your prose.` in `--font-mono` at `--text-display`, the tagline under it, and the demo beside it on wide screens (half the hero), under it on narrow ones.
- The three features carry a small mark in `--color-mistake` → `--color-fix` (fix), `--color-rewrite` (rewrite), `--color-ink` (memory), selected by `[data-kind]`. No other color outside the demo.
- The benchmark `<dl>` and the command are set in `--font-mono`, like command output, without a fake terminal window.
- `aria-current="page"` on the active language is visible (weight or underline, not color alone).
- Every link and the language switcher have hover, `:focus-visible` and active states. No link text wraps on two lines at 320 px.
- No horizontal scroll at 320, 375, 414 and 768 px.

- [ ] **Step 4: Check and look**

Run: `cd site && devenv shell -- pnpm build`. Expected: PASS (types, lint, format, tests). Then `devenv shell -- pnpm preview`, and with gstack `/browse` screenshot `/`, `/fr` and `/de` at 1280, 768, 375 and 320 px, light and dark (`prefers-color-scheme`). Read the screenshots. Fix everything they show in one batch, then confirm with at most one more round.

- [ ] **Step 5: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site
```

Proposed message: `feat(site): build the showcase page`

---

### Task 7: 404, share image, sitemap, robots, post-build check

**Load the design skills first** (the 404 and the share image are UI).

**Files:**
- Create: `site/public/404.html`, `site/scripts/og.html`, `site/public/og.png`, `site/public/sitemap.xml`, `site/public/robots.txt`, `site/scripts/check-dist.ts`
- Modify: `site/package.json` (build script), `site/tsconfig.json` (include `scripts`, allow `.ts` imports)

**Interfaces:**
- Consumes: `LOCALES`, `localePath` from `site/src/i18n/locales.ts`; brand tokens from Task 2.

- [ ] **Step 1: Write `site/public/404.html`**

A standalone HTML file with no JavaScript. It inlines the few tokens it needs in a `<style>` block, because the bundled stylesheet has a hashed name. Mark that copy in the file:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="robots" content="noindex" />
    <title>prosed · 404</title>
    <link rel="icon" href="/brand/prosed.svg" type="image/svg+xml" />
    <style>
      /* ponytail: copies tokens.css values, since the bundled CSS has a hashed name; keep in sync with src/styles/tokens.css */
      @font-face { font-family: "IBM Plex Mono"; src: url("/fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2"); font-display: swap; }
      :root { --color-paper: #ece7dc; --color-ink: #15181d; --font-mono: "IBM Plex Mono", ui-monospace, monospace; color-scheme: light dark; }
      @media (prefers-color-scheme: dark) { :root { --color-paper: #15181d; --color-ink: #ece7dc; } }
      html, body { overflow-x: clip; }
      body { margin: 0; min-height: 100vh; display: grid; place-content: center; gap: 2rem; padding: 2rem; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-mono); }
      ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
      a { color: inherit; text-underline-offset: 3px; }
      a:focus-visible { outline: 2px solid var(--color-ink); outline-offset: 3px; }
    </style>
  </head>
  <body>
    <img src="/brand/prosed.svg" alt="" width="48" height="48" />
    <ul>
      <li lang="en"><a href="/">Page not found. Back to prosed.</a></li>
      <li lang="fr"><a href="/fr">Page introuvable. Retour à prosed.</a></li>
      <li lang="de"><a href="/de">Seite nicht gefunden. Zurück zu prosed.</a></li>
      <li lang="es"><a href="/es">Página no encontrada. Volver a prosed.</a></li>
      <li lang="it"><a href="/it">Pagina non trovata. Torna a prosed.</a></li>
    </ul>
  </body>
</html>
```

- [ ] **Step 2: Write `site/public/sitemap.xml` and `site/public/robots.txt`**

`sitemap.xml`: five `<url>` entries (`https://prosed.flauercase.dev/`, `/fr`, `/de`, `/es`, `/it`). Each entry lists all five `<xhtml:link rel="alternate" hreflang="…" href="…"/>` plus `hreflang="x-default"` pointing at `/`. Root element:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://prosed.flauercase.dev/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://prosed.flauercase.dev/"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://prosed.flauercase.dev/fr"/>
    <xhtml:link rel="alternate" hreflang="de" href="https://prosed.flauercase.dev/de"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://prosed.flauercase.dev/es"/>
    <xhtml:link rel="alternate" hreflang="it" href="https://prosed.flauercase.dev/it"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://prosed.flauercase.dev/"/>
  </url>
  <!-- the same block four more times, with <loc> set to /fr, /de, /es and /it -->
</urlset>
```

Write out all five blocks in the file (the comment above is only for this plan).

`robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://prosed.flauercase.dev/sitemap.xml
```

- [ ] **Step 3: Generate the share image**

`site/scripts/og.html`: a 1200×630 page on `--color-paper` with the icon (`../public/brand/prosed.svg`), `prosed` in Plex Mono (`../public/fonts/…`), `sed for your prose.` and `A grammar checker that runs on your machine.`. Built to the same tokens; Hallmark rules apply. Then:

```bash
cd /home/ubuntu/perso/prosed/site
SHELL_BIN=$(find ~/.cache/ms-playwright -type f \( -name headless_shell -o -name chrome-headless-shell \) | head -1)
"$SHELL_BIN" --headless --hide-scrollbars --window-size=1200,630 --screenshot="$PWD/public/og.png" "file://$PWD/scripts/og.html"
file public/og.png
```

Expected: `PNG image data, 1200 x 630`. Read `public/og.png` and check it looks right.

- [ ] **Step 4: Write the post-build check**

`site/scripts/check-dist.ts` (run by Node 24's type stripping, so the import keeps its `.ts` extension):

```ts
// Checks the prerendered output before Vercel ships it.
import { existsSync, readFileSync } from "node:fs";
import { LOCALES, localePath } from "../src/i18n/locales.ts";

const out = new URL("../dist/client/", import.meta.url);
const errors: string[] = [];

for (const locale of LOCALES) {
  const path = localePath(locale) === "/" ? "index.html" : `${localePath(locale).slice(1)}/index.html`;
  const file = new URL(path, out);
  if (!existsSync(file)) {
    errors.push(`missing ${path}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  if (!html.includes(`<html lang="${locale}"`)) errors.push(`${path}: no <html lang="${locale}">`);
  // Only <link> alternates: the language switcher's <a hreflang> don't count.
  const alternates = html.match(/<link[^>]*hreflang=/gi)?.length ?? 0;
  if (alternates !== LOCALES.length + 1) errors.push(`${path}: ${alternates} hreflang links, expected ${LOCALES.length + 1}`);
  if (!html.includes('class="demo-mistake"')) errors.push(`${path}: the demo's still frame is missing`);
}
for (const path of ["404.html", "og.png", "sitemap.xml", "robots.txt"]) {
  if (!existsSync(new URL(path, out))) errors.push(`missing ${path}`);
}
if (existsSync(new URL("en/index.html", out))) errors.push("en/index.html exists; English lives at /");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`dist ok: ${LOCALES.length} pages, 404, og.png, sitemap, robots`);
```

In `site/tsconfig.json`, add `"scripts"` to `include` and set `"allowImportingTsExtensions": true` (with `"noEmit": true`, which the template likely sets already). In `site/package.json`, set `"build": "vp check && vp build && node scripts/check-dist.ts"`.

- [ ] **Step 5: Run it, then break it once**

Run: `cd site && devenv shell -- pnpm build`. Expected: ends with `dist ok: 5 pages, 404, og.png, sitemap, robots`.

Then move `public/robots.txt` aside, rebuild, confirm the build fails with `missing robots.txt`, and put it back.

- [ ] **Step 6: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site
```

Proposed message: `feat(site): add the 404, share image, sitemap and build check`

---

### Task 8: QA and the design finish

**Load the design skills first.**

**Files:**
- Modify: whatever the review finds, inside `site/`.

- [ ] **Step 1: Serve the production build**

```bash
cd site && devenv shell -- pnpm build && devenv shell -- pnpm preview
```

`vp preview` serves the client output. Note the port.

- [ ] **Step 2: Browser checks with gstack `/browse`**

For each of `/`, `/fr`, `/de`, `/es`, `/it`:

- No console errors.
- `document.documentElement.lang` is the locale.
- **Overflow over the whole loop (Review Focus 3).** At 320 px width, sample `document.documentElement.scrollWidth <= window.innerWidth` every 200 ms for 20 s (one loop is about 15 s) and record the worst value. Expected: never above `innerWidth`. Pay special attention to `/de`.
- **Pause and resume (Review Focus 4).** Read `document.querySelector('.demo').dataset.frame` twice, 1.5 s apart, while the demo is visible: the values differ. Scroll the demo out of view, read it twice 1.5 s apart: the values are equal. Scroll back: it changes again.
- **Reduced motion.** With `prefers-reduced-motion: reduce` emulated, `data-frame` stays at the still frame and the fix card is visible.
- **Dark mode (Review Focus 5).** Screenshot with `prefers-color-scheme: dark` at 1280 px and read it: underlines and cards are readable on ink.

Then: `/does-not-exist` serves the 404 page with five links, and every link on `/` resolves (no 404 except the deliberate one).

- [ ] **Step 3: Hallmark slop test and Impeccable audit**

Run Hallmark's 58-gate slop test on the built page, then Impeccable's `audit` and `polish`. Fix every failing gate and every audit finding in one batch. Confirm with one more round at most. Run Impeccable's finish reviewer against the spec.

- [ ] **Step 4: Record the design**

Update `site/DESIGN.md` if the build added tokens or rules (Impeccable's `document` can derive it from the shipped CSS). Make sure the Hallmark stamp in `tokens.css` names the macrostructure.

- [ ] **Step 5: Final local check**

Run: `cd site && devenv shell -- pnpm build`. Expected: PASS with `dist ok`.

- [ ] **Step 6: Stage**

```bash
cd /home/ubuntu/perso/prosed && git add site
```

Proposed message: `fix(site): address QA and design review findings`

---

### Task 9: Git deploys, domain, production check

Most steps here are Florian's. The agent prepares and verifies.

**Files:** none, unless a check fails.

- [ ] **Step 1: Connect the Vercel project to GitHub (Florian)**

- The Vercel GitHub app must have access to `florianlauer/prosed` (GitHub → Settings → Applications → Vercel → Repository access).
- In the Vercel project `prosed-site`: Settings → Build and Deployment → Root Directory = `site`. Settings → Git → connect `florianlauer/prosed`, production branch `main`. The CLI can do the connection: `pnpm dlx vercel@63.1.2 git connect`.

- [ ] **Step 2: Add the domain**

```bash
cd site && pnpm dlx vercel@63.1.2 domains add prosed.flauercase.dev
```

Florian creates the CNAME `prosed` → `cname.vercel-dns.com` at OVH (or the target Vercel prints), as for the other `*.flauercase.dev` sites. If Vercel asks for a TXT verification record, Florian adds that too.

- [ ] **Step 3: Open the pull request (with Florian's go-ahead)**

Florian commits the staged work (or asks for `/commit`). Then push `feat/site` and open the PR with `gh pr create`, body in English, without any Claude attribution. Register it with the t3-code `link_pull_request` tool if available. Expected: the Vercel bot posts a preview URL on the PR.

On the preview URL:

```bash
curl -sI <preview>/fr/ | head -3          # 308 redirect to /fr
curl -so /dev/null -w '%{http_code}\n' <preview>/en     # 404
curl -so /dev/null -w '%{http_code}\n' <preview>/FR     # 404
curl -so /dev/null -w '%{http_code}\n' <preview>/de     # 200
```

- [ ] **Step 4: Native read of the demo sentences (Florian)**

Before merging, someone who speaks German, Spanish and Italian reads `demo.text` and the variants in `de.ts`, `es.ts`, `it.ts`. Any change goes through `pnpm test` (Task 4's data tests).

- [ ] **Step 5: Merge and verify production**

After Florian merges to `main`:

```bash
curl -s https://prosed.flauercase.dev/ | grep -o '<html lang="en"'
curl -s https://prosed.flauercase.dev/it | grep -o '<html lang="it"'
curl -so /dev/null -w '%{http_code}\n' https://prosed.flauercase.dev/nope   # 404
```

Then check `ignoreCommand`: the next merge to `main` that touches nothing in `site/` shows as "Ignored" (skipped) in the Vercel deployments list.
