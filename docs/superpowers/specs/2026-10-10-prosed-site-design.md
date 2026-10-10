# prosed: showcase site design

Date: 2026-10-10

## Why

The rebrand spec (`2026-10-03-prosed-rebrand-design.md`) left a note: "A site may come later to present the features." This is that site.

Its job is credibility. It shows the project to developers, recruiters and anyone who lands on it from a link, and it should read as a tool someone made with care. Downloads matter less: the page links to the GitHub releases, but it is not a funnel. The README stays the documentation.

Success looks like this. A visitor understands what prosed does from the first screen, watches it fix a sentence without installing anything, and finds the repo and the releases in one click.

## Decisions

| Topic | Decision |
|---|---|
| Location | `site/` at the repo root, a standalone project |
| Framework | TanStack Start, fully prerendered, no server code |
| Toolchain | Vite+ (`vp`), pnpm for packages |
| Hosting | Vercel, Git integration, production branch `main` |
| Domain | `prosed.flauercase.dev`, DNS at OVH |
| Languages | en, fr, de, es, it, the same five as `src/i18n/catalogs.ts:953` |
| Scope | One page, plus a 404 |
| Demo | Scripted HTML animation, no model call |
| Look | Editorial paper, from the rebrand spec |

Out of scope for this version: a docs section, a FAQ, screenshots, analytics, a newsletter, a version number on the page, a recorded video. A detailed video, made later with the `short-editing` skill, can take a slot next to the demo when it exists.

## The page

One scrolling page, six blocks in this order.

1. **Header.** The `prosed.svg` icon, `prosed` in Plex Mono, the language switcher, a GitHub link. No menu.
2. **Hero.** `sed for your prose.` large in Plex Mono, with `A grammar checker that runs on your machine.` under it in the page's language. The scripted demo takes half of the hero, so the first thing that moves is the product. Under it, two quiet links: the repo, and `/releases/latest`.
3. **What it does.** Three short blocks. Fixes, drawn red then green: an underline in the field, one click fixes one word. Rewrites, drawn violet: three variants, and a variant that drops a number or a name is never shown. What it remembers: the dictionary and ignored changes. Each block carries a small mark in its product color. This is the only place color shows outside the demo.
4. **On your machine.** The model backends, Ollama and Gemini Nano, and the optional personal API key. One sentence on privacy: with a local model the text never leaves the computer, linking to `PRIVACY.md`. The two hosts: the Chromium extension and the desktop app for macOS and Windows.
5. **Benchmark.** Real numbers only, taken from the README and `ROADMAP.md`: 24/24 on the benchmark, 0.4 to 0.6 s per check with `gemma4:e2b-it-qat` on an M2 Pro. Set like command output in Plex Mono.
6. **Footer.** MIT license, credit to the project it started from (nucleartux/ai-grammar, Igor Adrov), links to GitHub, the README and the CHANGELOG.

The text is written for the site. It does not copy the README verbatim, and it makes no claim the repo can't back.

## The scripted demo

A fake message field, styled like a chat or mail composer, in the page's language. The sequence loops:

1. The text types itself at a human pace. In French, for example: "Je pense que sa va marcher, on a tester hier soir."
2. After a 500 ms pause, the product's real debounce, two words get a red wavy underline.
3. A fake pointer hovers "sa". The fix card opens with "ça" in green. The click replaces that word and nothing else.
4. The badge in the field's corner shows 1. Hovering it opens the list with "Accept all", and "tester" becomes "testé".
5. A long sentence gets selected. The "Rewrite" button appears, then a card with three violet variants. One is picked and replaces the selection.
6. A pause, then the loop starts over.

The underline, card and badge copy the product's colors and shapes with the site's own CSS. The site does not import extension code, so the two builds stay independent.

There is no fake window chrome around the field: no title bar, no traffic-light dots. The field, the underlines and the cards are the product's own UI, which is what the demo shows.

**Data.** Each language file holds a `demo` object: the text, the fixes as `from` and `to` pairs, the sentence to rewrite and its three variants. The component only knows that shape and plays a fixed timeline over it.

**Accessibility and cost.**

- With `prefers-reduced-motion: reduce`, nothing animates. The demo shows its middle state: words underlined, the fix card open.
- The animated part is `aria-hidden`. A visually hidden sentence tells screen readers what the demo shows.
- The loop pauses when the demo leaves the viewport (`IntersectionObserver`) or the tab is hidden.

The visitor can't type in the field. There is no replay button; the loop is enough.

**Translations need a native read.** The faulty sentences in German, Spanish and Italian must use mistakes a native writer actually makes. A fake mistake in a grammar checker's demo is the one error visitors will notice. Someone who speaks each language reviews them before launch.

## Languages and URLs

One route file, `site/src/routes/{-$locale}/index.tsx`, serves five pages.

| URL | Language |
|---|---|
| `/` | English |
| `/fr`, `/de`, `/es`, `/it` | the other four |

An unknown locale (`/pt`) throws `notFound()`. There is no `/en`: English lives at the root, so every language has one URL.

**Text.** `site/src/content/en.ts` exports the reference object and the `Content` type derived from it. `fr.ts`, `de.ts`, `es.ts` and `it.ts` are typed `Content`, so a missing or extra key fails `vp check`. The page component gets its language's `Content` as a prop and never looks up keys at runtime. No i18n library and no plurals: the page counts nothing.

French text follows French typography, with a narrow no-break space before `:`, `;`, `?` and `!`.

**Switcher.** Plain links (`<a href="/fr" hreflang="fr">`), each language named in itself: English, Français, Deutsch, Español, Italiano. With one page, switching never loses the visitor's place.

`/` does not redirect by browser language. A redirect needs server code and would hide the English page from crawlers.

**Head.** Each page's `head()` sets:

- `lang` on `<html>`, a translated `title` and `description`
- a canonical URL on `https://prosed.flauercase.dev`
- five `<link rel="alternate" hreflang>` and an `x-default` pointing at `/`
- Open Graph and Twitter tags with the translated title and description

**Share image.** One 1200×630 PNG in English, with the icon, `prosed` and both taglines on paper. Generated once from a small HTML template with the machine's headless Chromium, then committed. It is not built at deploy time.

**Static files.** `site/public/sitemap.xml`, written by hand (five URLs with their alternates), and `site/public/robots.txt`.

## 404

One static `404.html`, which Vercel serves for any unknown path. An unknown URL says nothing about the visitor's language, so the page says "Page not found" in all five languages, each line linking to its home page. No JavaScript, same paper look.

## Visual direction

The rebrand spec is the locked design system. The site does not pick a new palette or new fonts.

| Role | Value |
|---|---|
| Paper | `#ece7dc` |
| Ink | `#15181d` |
| Mistake | `oklch(66% 0.19 29)` |
| Fix | `oklch(72% 0.15 152)` |
| Rewrite | `oklch(70% 0.15 290)` |

IBM Plex Mono for the wordmark, the taglines and anything that reads like a command (the benchmark). IBM Plex Sans for running text. The fonts are self-hosted `woff2` files and nothing loads from a font CDN. The `latin` subset already in the repo covers all five languages.

The tone is editorial paper: a lot of white space, large Plex type, a page that could be printed. Color appears only where the product gives it meaning, in the demo and the three feature marks.

The page follows the system theme. In dark mode it is paper on ink, as the options page already does.

### Design skills for the front end

Every task that writes or changes UI in `site/` loads two skills before touching code. The implementation plan repeats this in each of those tasks, so a subagent that starts cold loads them too.

- **`impeccable:impeccable`.** Run its setup (`scripts/impeccable context`) once per session from `site/`. Mode: Persuade, since a tool's landing page is Persuade. Read `reference/craft-floor.md` right before each UI edit. At the end, run `audit` then `polish`, in bounded passes, and use the finish reviewer against this spec.
- **`hallmark`.** Run the pre-flight scan. Pick the macrostructure and the nav and footer archetypes, stated out loud with the reason. Run the 58-gate slop test after the build. Its disciplines hold: honest copy, locked tokens, no re-drawn chrome, roman headings, and checks at 320, 375, 414 and 768 px.

How the two fit together:

- **Theme.** The brand above is the theme. Hallmark does not rotate its catalog and Impeccable does not choose a new world. Both skills put the brief first, and this spec is the brief. Before the first UI code, `site/DESIGN.md` records these tokens, so Hallmark's pre-flight finds a locked system and defers to it.
- **Hallmark's three questions are answered here.** Audience: developers and recruiters who land on the page from a link. Use case: understand prosed and reach the repo. Tone: editorial.
- **When the two disagree, the stricter rule wins.** If they truly conflict, the task stops and asks.
- **Files they write.** `site/DESIGN.md`, `site/PRODUCT.md` and `site/.hallmark/` live in `site/`, not at the repo root, because the extension and the desktop app have their own look.

## Project layout

`site/` is not a workspace of the root project, which stays on npm.

```
site/
  package.json        packageManager pinned to the pnpm release current at scaffold time,
                      vite-plus in devDependencies,
                      scripts dev / build / test calling vp
  pnpm-lock.yaml
  vite.config.ts      TanStack Start, prerender of the five pages and 404.html
  vercel.json         ignoreCommand
  tsconfig.json
  DESIGN.md           the locked tokens, before any UI code
  src/
    routes/           {-$locale}/index.tsx, the root route, the 404
    content/          en.ts, fr.ts, de.ts, es.ts, it.ts
    components/       the demo and the page blocks
    styles.css
  public/
    fonts/            Plex woff2, copied from src/options/fonts/
    brand/            SVGs, copied from assets/brand/
    og.png, sitemap.xml, robots.txt
```

The fonts and icons are copies. The site's build then never reads outside its folder, and these files rarely change.

At the repo root, `site` goes into `.prettierignore`. Vite+ formats the site with Oxfmt, and the root `prettier --write '**/*'` must leave it alone. The root `tsconfig.json` includes only `src`, and the root Vite and test scripts only look at `src`, so nothing else changes.

This machine has neither `pnpm` nor `vp` nor the Vercel CLI. The plan adds `pnpm` and the Vercel CLI to `devenv.nix`. `vp` comes from the `vite-plus` dev dependency.

## Build and deploy

**Build.** `pnpm build` runs `vp check && vp build`. A translation with a missing key fails the build before it reaches production.

**Static output, checked on day one.** The research found no documented way to deploy a fully prerendered TanStack Start build to Vercel without Functions. Vercel's own TanStack page goes through Nitro, whose Vite plugin it calls "still under active development". So the first task of the plan is a walking skeleton: an empty prerendered page deployed to a Vercel preview URL, before any content. It settles the framework preset and the output directory. If static output doesn't work, the fallback is the Nitro preset, and the content doesn't change.

**Package manager detection.** The repo root has a `package-lock.json`, and Vite+ reads the package manager from the workspace root. The skeleton task confirms that `vp` inside `site/` picks pnpm because of the `packageManager` field.

**Vercel project.**

- Connected to `florianlauer/prosed` through the Vercel GitHub app, Root Directory `site`, production branch `main`.
- A merge to `main` deploys to production. Each pull request gets a preview, and the Vercel bot posts its URL on the PR.
- `ignoreCommand` in `site/vercel.json` runs `git diff --quiet HEAD^ HEAD -- .`, so a commit that doesn't touch `site/` doesn't redeploy.
- The domain `prosed.flauercase.dev` is added to the project. Florian creates the `prosed` CNAME at OVH, the same way as for the other `*.flauercase.dev` sites.
- Prerequisite on Florian's side: the Vercel GitHub app must have access to the `prosed` repo.

The last deploy task ends with a real test: a commit on `site/` merged to `main` shows up on `prosed.flauercase.dev`.

No GitHub Actions workflow for the site. Vercel builds every push and every PR.

## Checks

- `vp check`: types, lint, format, and completeness of the five languages.
- `vp test`: one test over the demo data. For every language, each fix's `from` and the sentence to rewrite appear in the demo text. It is the mistake most likely to slip in while editing a translation.
- After the build, a script checks that the five `index.html` files and `404.html` exist, each with the right `lang` and the `hreflang` links.
- Browser QA in headless Chromium with gstack `/browse`: each language loads with no console error, the demo loops, reduced motion shows the static state, the 404 answers, and the layout holds at 320, 375, 414 and 768 px. The screenshots are read during the review.
- The Hallmark slop test and Impeccable's `audit` run on the finished page, as described in "Design skills for the front end".
