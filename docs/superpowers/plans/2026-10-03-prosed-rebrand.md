# prosed rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project from "AI Grammar" to `prosed` and give it its own icon, colors and type, across the extension, the desktop app and the docs.

**Architecture:** Three SVG files in `assets/brand/` are the only hand-made art. Every PNG, `.icns` and `.ico` comes out of `cargo tauri icon`. The settings page (shared by the extension and the desktop app) gets the paper and ink palette and IBM Plex, bundled as `woff2`. Everything else is renames in config, code strings and docs.

**Tech Stack:** Vite 8 + @crxjs (extension), Tauri 2 + Rust (desktop), `cargo tauri icon` from `devenv shell`, IBM Plex from `@fontsource` packages (copied, not depended on).

**Spec:** `docs/superpowers/specs/2026-10-03-prosed-rebrand-design.md`

## Global Constraints

- Name: `prosed`, always lowercase.
- Taglines: `sed for your prose.` under the logo, `A grammar checker that runs on your machine.` as the description.
- Paper `#ece7dc`, ink `#15181d`. Mistake, fix and rewrite colors unchanged.
- Fonts: IBM Plex Mono (wordmark, taglines, commands), IBM Plex Sans (text). Bundled `woff2`, no request to Google Fonts or any CDN.
- The in-page overlays (`src/contentScript/overlay.css`) keep their look and the system font.
- Desktop identifier: `com.florianlauer.prosed`. No migration code.
- The `aig-` CSS prefix stays.
- Version `0.11.0` for the extension.
- Florian commits by hand: no commit per task. `/pr-create -sa` stages and commits everything at the end.
- Code comments and commit messages in English, short, saying why.

## Review Focus

- Icons at 16 px: the 16 and 32 px extension icons must come from `prosed-small.svg`, otherwise the toolbar shows a grey smudge. Check: inspect `public/img/icon16.png` rendered at 400%.
- Dark mode settings page: paper text on an ink background, with inputs, buttons and the spinner still visible. Check: dark screenshot in Task 2.
- French accents in Plex: `é è à ç œ` must render in Plex, not fall back. Check: the "Style" section of the screenshot shows "“du coup”" and the hint text in Plex.
- Old debug key: someone with `ai-grammar:debug` set no longer gets traces. This is accepted and goes in the CHANGELOG. Check: CHANGELOG entry in Task 4.
- Menu bar icon on macOS: must switch black/white with the menu bar. This can only be checked on the Mac, so it goes in the PR's manual checklist.

---

### Task 1: Brand art and generated icons

**Files:**
- Create: `assets/brand/prosed.svg`, `assets/brand/prosed-small.svg`, `assets/brand/prosed-tray.svg`
- Replace (generated): `public/img/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- Replace (generated): `desktop/src-tauri/icons/*` (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns`, `icon.ico`)
- Create (generated): `desktop/src-tauri/icons/tray.png`

**Interfaces:**
- Produces: `desktop/src-tauri/icons/tray.png` (44×44, black on transparent), used by Task 3. Extension PNG names stay `icon{16,32,48,128}.png`, so `src/manifest.ts` icon paths don't change.

- [ ] **Step 1: Write `assets/brand/prosed.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="225" fill="#15181d"/>
  <rect x="41" y="41" width="942" height="942" rx="195" fill="#ece7dc"/>
  <path d="M164 573 q87 -164 174 0 t174 0 t174 0 t174 0" fill="none" stroke="#15181d" stroke-width="123" stroke-linecap="round"/>
  <rect x="461" y="205" width="102" height="614" rx="31" fill="#ece7dc"/>
  <rect x="486" y="225" width="52" height="574" rx="20" fill="#15181d"/>
</svg>
```

- [ ] **Step 2: Write `assets/brand/prosed-small.svg`** (no outline, thicker wave and cursor, tighter margins)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="200" fill="#ece7dc"/>
  <path d="M120 580 q98 -190 196 0 t196 0 t196 0 t196 0" fill="none" stroke="#15181d" stroke-width="170" stroke-linecap="round"/>
  <rect x="440" y="150" width="144" height="724" rx="40" fill="#ece7dc"/>
  <rect x="472" y="170" width="80" height="684" rx="28" fill="#15181d"/>
</svg>
```

- [ ] **Step 3: Write `assets/brand/prosed-tray.svg`** (wave and cursor only, black on transparent; the cursor is cut out of the wave with a mask so it reads as a template image)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <mask id="cut">
    <rect width="1024" height="1024" fill="#fff"/>
    <rect x="432" y="80" width="160" height="864" rx="40" fill="#000"/>
  </mask>
  <path mask="url(#cut)" d="M70 560 q110 -210 220 0 t220 0 t220 0 t220 0" fill="none" stroke="#000" stroke-width="150" stroke-linecap="round"/>
  <rect x="472" y="110" width="80" height="804" rx="30" fill="#000"/>
</svg>
```

- [ ] **Step 4: Generate the desktop icons**

Run: `cd desktop/src-tauri && devenv shell -- cargo tauri icon ../../assets/brand/prosed.svg`
Expected: writes `icons/32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns`, `icon.ico` (plus extra Windows Store and mobile files).

Then delete what the bundle doesn't list in `tauri.conf.json` (`Square*Logo.png`, `StoreLogo.png`, `64x64.png`, `android/`, `ios/`) with `trash`, so the diff only replaces existing files.

- [ ] **Step 5: Generate the extension and tray PNGs**

```bash
tmp=$(mktemp -d)
devenv shell -- cargo tauri icon assets/brand/prosed-small.svg -o "$tmp/small" --png 16,32
devenv shell -- cargo tauri icon assets/brand/prosed.svg -o "$tmp/full" --png 48,128
devenv shell -- cargo tauri icon assets/brand/prosed-tray.svg -o "$tmp/tray" --png 44
cp "$tmp/small/16x16.png" public/img/icon16.png
cp "$tmp/small/32x32.png" public/img/icon32.png
cp "$tmp/full/48x48.png" public/img/icon48.png
cp "$tmp/full/128x128.png" public/img/icon128.png
cp "$tmp/tray/44x44.png" desktop/src-tauri/icons/tray.png
```

- [ ] **Step 6: Check sizes**

Run: `file public/img/icon*.png desktop/src-tauri/icons/*.png`
Expected: `icon16.png` 16 x 16, `icon32.png` 32 x 32, `icon48.png` 48 x 48, `icon128.png` 128 x 128, `tray.png` 44 x 44, all RGBA.

Then open `public/img/icon16.png` and `icon128.png` with the Read tool and confirm the wave and cursor are visible.

### Task 2: Settings page charte (fonts, palette, header)

**Files:**
- Create: `src/options/fonts/ibm-plex-mono-latin-400-normal.woff2`, `ibm-plex-mono-latin-700-normal.woff2`, `ibm-plex-sans-latin-400-normal.woff2`, `ibm-plex-sans-latin-600-normal.woff2`
- Modify: `src/options/options.css` (top of file: font faces, tokens, header)
- Modify: `src/options/index.html:6-17`
- Modify: `desktop/index.html:5-16`

**Interfaces:**
- Consumes: `public/img/icon128.png` and `desktop/src-tauri/icons/128x128.png` from Task 1.
- Produces: classes `.opt__brand`, `.opt__name`, `.opt__tagline`, used by both HTML pages.

- [ ] **Step 1: Copy the fonts**

```bash
tmp=$(mktemp -d) && cd "$tmp"
npm pack @fontsource/ibm-plex-mono @fontsource/ibm-plex-sans
for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done
cd - && mkdir -p src/options/fonts
cp "$tmp"/fontsource-ibm-plex-mono-*/files/ibm-plex-mono-latin-{400,700}-normal.woff2 src/options/fonts/
cp "$tmp"/fontsource-ibm-plex-sans-*/files/ibm-plex-sans-latin-{400,600}-normal.woff2 src/options/fonts/
cp "$tmp"/fontsource-ibm-plex-mono-*/LICENSE src/options/fonts/LICENSE
```

The `latin` subset covers French (`é è à ç ô œ`). The OFL asks for the license to travel with the fonts, hence the `LICENSE` copy.

- [ ] **Step 2: Add font faces and the palette to `src/options/options.css`**, replacing the comment and the `body`/`.opt` rules at the top:

```css
/* Reuses the overlay tokens from .aig-root, so the settings look like the suggestions.
 * The page itself carries the brand: ink on paper, IBM Plex, bundled so nothing loads from a CDN. */

@font-face {
  font-family: "IBM Plex Sans";
  font-weight: 400;
  font-display: swap;
  src: url("./fonts/ibm-plex-sans-latin-400-normal.woff2") format("woff2");
}

@font-face {
  font-family: "IBM Plex Sans";
  font-weight: 600;
  font-display: swap;
  src: url("./fonts/ibm-plex-sans-latin-600-normal.woff2") format("woff2");
}

@font-face {
  font-family: "IBM Plex Mono";
  font-weight: 400;
  font-display: swap;
  src: url("./fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2");
}

@font-face {
  font-family: "IBM Plex Mono";
  font-weight: 700;
  font-display: swap;
  src: url("./fonts/ibm-plex-mono-latin-700-normal.woff2") format("woff2");
}

body {
  margin: 0;
}

.opt {
  --aig-surface: #ece7dc;
  --aig-ink: #15181d;
  --aig-font: "IBM Plex Sans", system-ui, sans-serif;
  --opt-mono: "IBM Plex Mono", ui-monospace, monospace;

  display: block;
  min-height: 100vh;
  padding: 56px max(24px, calc(50vw - 280px)) 80px;
  background: var(--aig-surface);
  font: 400 15px/1.5 var(--aig-font);
}

.opt[data-theme="dark"] {
  --aig-surface: #15181d;
  --aig-ink: #ece7dc;
}
```

Remove the old `.opt h1` rule and replace it with the header pieces:

```css
.opt__brand {
  display: grid;
  gap: 2px;
}

.opt__name {
  margin: 0;
  font: 700 22px/1.1 var(--opt-mono);
  letter-spacing: -0.02em;
}

.opt__tagline {
  margin: 0;
  color: var(--aig-muted);
  font: 400 13px/1.4 var(--opt-mono);
}
```

Keep `.opt__head` and `.opt__meta` as they are.

- [ ] **Step 3: New header in `src/options/index.html`**

```html
    <title>prosed settings</title>
    <link rel="icon" href="/img/icon32.png" />
  </head>
  <body>
    <main class="aig-root opt">
      <header class="opt__head">
        <img src="/img/icon128.png" alt="" width="40" height="40" />
        <div class="opt__brand">
          <h1 class="opt__name">prosed</h1>
          <p class="opt__tagline">sed for your prose.</p>
          <p class="opt__meta" id="version"></p>
        </div>
      </header>
```

- [ ] **Step 4: Same header in `desktop/index.html`**, with the desktop icon path:

```html
    <title>prosed</title>
  </head>
  <body>
    <main class="aig-root opt">
      <header class="opt__head">
        <img src="/src-tauri/icons/128x128.png" alt="" width="40" height="40" />
        <div class="opt__brand">
          <h1 class="opt__name">prosed</h1>
          <p class="opt__tagline">sed for your prose.</p>
          <p class="opt__meta" id="version"></p>
        </div>
      </header>
```

Also replace "AI Grammar" with "prosed" in `desktop/index.html:20`, `:42`, `:112`.

- [ ] **Step 5: Build both front ends**

Run: `npm run build && npx vite build --config desktop/vite.config.ts`
Expected: both succeed. `ls build/assets/*.woff2` lists the four fonts.

- [ ] **Step 6: Screenshot light and dark**

Serve `build/` with `npx vite preview --outDir build --port 4173`, open `/src/options/index.html` with the headless browser (`/browse`), once as is and once with `prefers-color-scheme: dark` emulated. `chrome.*` is missing outside the extension, so the lists stay empty and a console error is expected. Check: header shows icon, `prosed` in Plex Mono, tagline; text in Plex Sans; dark variant is paper on ink with visible fields and buttons.

### Task 3: Code and config renames, menu bar icon

**Files:**
- Modify: `package.json:2-6`, `src/manifest.ts:20`
- Modify: `src/contentScript/index.ts:341-344`, `src/contentScript/index.ts:1666`
- Modify: `src/contentScript/text.test.ts:31`
- Modify: `desktop/src-tauri/tauri.conf.json:3,5`
- Modify: `desktop/src-tauri/Cargo.toml:2,4,8,15`
- Modify: `desktop/src-tauri/src/main.rs:5`, `desktop/src-tauri/examples/probe.rs:3`
- Modify: `desktop/src-tauri/src/keys.rs:38`
- Modify: `desktop/src-tauri/src/lib.rs:651,679,682-685`
- Regenerate: `package-lock.json`, `desktop/src-tauri/Cargo.lock`

**Interfaces:**
- Consumes: `desktop/src-tauri/icons/tray.png` from Task 1.

- [ ] **Step 1: Update the test fixture first** (`src/contentScript/text.test.ts:31`), so the dictionary example uses the new name:

```ts
  assert.equal(keepUserText("le repo prosed", "le repo prossed", ["prosed"]), "le repo prosed");
```

Run: `npm test`
Expected: PASS (the behavior under test, dictionary words kept, doesn't depend on the word).

- [ ] **Step 2: `package.json`**

```json
  "name": "prosed",
  "displayName": "prosed",
  "description": "A grammar checker that runs on your machine.",
  "version": "0.11.0",
  "author": "Florian Lauer",
```

`author` changes because the manifest and the zip now present Florian's project. Igor Adrov stays credited in the README and the LICENSE.

Run: `npm_config_node_linker=hoisted nub install` to refresh the lockfile's own name and version (fallback: `npm install --package-lock-only`).

- [ ] **Step 3: `src/manifest.ts:20`**

```ts
    default_title: "prosed settings",
```

- [ ] **Step 4: Debug key and help link in `src/contentScript/index.ts`**

```ts
// Set localStorage["prosed:debug"] = "1" on a site to trace why a field is or isn't checked.
...
  if (localStorage.getItem("prosed:debug")) {
    console.log("[prosed]", ...args);
```

and at line 1666: `"https://github.com/florianlauer/prosed#troubleshooting",`

- [ ] **Step 5: Tauri and Cargo**

`tauri.conf.json`: `"productName": "prosed"`, `"identifier": "com.florianlauer.prosed"`.

`Cargo.toml`:

```toml
[package]
name = "prosed"
version = "0.1.0"
description = "prosed, a grammar checker that runs on your machine, in every app"
edition = "2021"

[lib]
name = "prosed_lib"
```

and `tauri = { version = "2", features = ["tray-icon", "image-png", "macos-private-api"] }` (`image-png` lets the tray load `tray.png` at build time).

`main.rs:5`: `prosed_lib::run()`. `probe.rs:3`: `use prosed_lib::platform::{self, Platform};`. `keys.rs:38`: `const MARKER: &str = "\u{2063}prosed\u{2063}";`

- [ ] **Step 6: Window title, menu and tray in `lib.rs`**

Line 651: `.title("prosed")`. Line 679: `"Quit prosed"`. Replace lines 682-685:

```rust
            let tray = TrayIconBuilder::new();
            // a template image: macOS draws it black or white to match the menu bar
            #[cfg(target_os = "macos")]
            let tray = tray.icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?).icon_as_template(true);
            #[cfg(not(target_os = "macos"))]
            let tray = tray.icon(app.default_window_icon().expect("the bundle has an icon").clone());
            tray.tooltip("prosed")
                .menu(&menu)
```

The rest of the chain (`.on_menu_event`, `.build(app)?`) stays.

- [ ] **Step 7: Check everything builds**

Run: `npm test && npm run build && npm run zip`
Expected: tests pass, `package/prosed-0.11.0.zip` exists.

Run: `cd desktop/src-tauri && devenv shell -- cargo xwin check --target x86_64-pc-windows-msvc`
Expected: compiles (checks the non-macOS branch and the renamed crate; `Cargo.lock` updates).

Then try `devenv shell -- cargo check --target aarch64-apple-darwin`. If it fails for lack of the macOS SDK (C build scripts), note it: the macOS branch gets checked on the Mac before merge.

### Task 4: Docs, privacy policy, changelog

**Files:**
- Modify: `README.md` (lines 1-5, 80-102, 384, 477, 488-492 and the settings screenshot)
- Modify: `AGENT_INSTALL.md`, `desktop/README.md`, `desktop/LINUX.md:136`
- Rewrite: `PRIVACY.md`
- Modify: `CHANGELOG.md` (new 0.11.0 section)
- Replace: `assets/settings.png`

- [ ] **Step 1: README top.** Replace lines 1-5 with:

```markdown
<p align="center"><img src="./assets/brand/prosed.svg" alt="" width="96" height="96"></p>

# prosed

`sed for your prose.`

A grammar checker that runs on your machine. It works in Chromium browsers, and a desktop app brings it to every app on macOS and Windows. A language model on your own computer reads what you type, so the text never leaves it.

Mistakes are underlined in place, one click fixes one word, and the default model is small enough to leave running all day. It's free, open source, and has no account.
```

Move the sentence about the upstream fork and the Chrome Web Store link into "Credits and license" (see Step 3).

- [ ] **Step 2: README body.** Replace every `florianlauer/ai-grammar` with `florianlauer/prosed`, `~/Extensions/ai-grammar` with `~/Extensions/prosed`, `cd ai-grammar` with `cd prosed`, `AI-Grammar-Checker-<version>.zip` with `prosed-<version>.zip`, `ai-grammar:debug` with `prosed:debug`, and "the ai-grammar browser extension" with "the prosed browser extension". Rename the section "What this fork changes" to "Compared to the original extension" and keep its list.

- [ ] **Step 3: README credits** (end of file):

```markdown
## Credits and license

prosed started as a fork of [nucleartux/ai-grammar](https://github.com/nucleartux/ai-grammar) by Igor Adrov. The [Chrome Web Store version](https://chromewebstore.google.com/detail/free-ai-grammar-checker/jnkjkpapplndagboidnhphaciphgjeca) is that original extension and has none of the changes above. If you find prosed useful, consider [sponsoring the upstream project](https://github.com/sponsors/nucleartux). prosed keeps its MIT [license](./LICENSE).

Issues go [here](https://github.com/florianlauer/prosed/issues).
```

- [ ] **Step 4: `AGENT_INSTALL.md`.** Same replacements as Step 2, plus `/tmp/ai-grammar.zip` to `/tmp/prosed.zip`, `$env:TEMP\ai-grammar.zip` to `$env:TEMP\prosed.zip`, and the card name `"AI Grammar Checker"` to `"prosed"` (lines 89 and 92).

- [ ] **Step 5: `desktop/README.md` and `desktop/LINUX.md`.** Title `# prosed for the desktop`. `AI Grammar.app` to `prosed.app`, `AI Grammar_0.1.0_` to `prosed_0.1.0_`, binary `ai-grammar-desktop` to `prosed`, certificate `AI Grammar Self-Signed` to `prosed Self-Signed`, config paths to `com.florianlauer.prosed`. `LINUX.md:136`: `ai-grammar --trigger` to `prosed --trigger`. Line 176 ("Harper… grammar checker") is about another product and stays.

- [ ] **Step 6: Rewrite `PRIVACY.md`**

```markdown
# prosed privacy policy

prosed collects nothing. It has no account, no analytics and no server.

## Where your text goes

When you type, prosed sends the text of the field you're in to one place: the Ollama server on your own machine (`http://127.0.0.1:11434`), or Chrome's on-device model when you use that instead. Nothing else, nowhere else.

## Where your settings live

- Extension: in the browser's extension storage. When browser sync is on, the browser syncs it to your account like bookmarks.
- Desktop app: in `config.json` in the app's config folder (`~/Library/Application Support/com.florianlauer.prosed/` on macOS, `%APPDATA%\com.florianlauer.prosed\` on Windows).

## Third parties

prosed uses no third-party API. Its fonts ship inside the extension and the app, so opening the settings doesn't contact a font service either.

## Changes

If this policy changes, the new version ships with a release and the CHANGELOG says so.
```

- [ ] **Step 7: CHANGELOG.** Turn `## Unreleased` into `## 0.11.0 [2026.10.03]` and add above its existing items:

```markdown
- feat: the project is now called prosed, with its own icon, colors and type. The settings page uses IBM Plex, bundled with the extension
- breaking: install the extension again from `prosed-0.11.0.zip`, into a new folder such as `~/Extensions/prosed`. Chrome ties an unpacked extension's settings to its folder, so the dictionary, ignored changes and style choices start empty
- breaking: the desktop app's identifier is now `com.florianlauer.prosed`. To keep its settings on macOS, quit the app and run `mv ~/Library/Application\ Support/com.florianlauer.ai-grammar ~/Library/Application\ Support/com.florianlauer.prosed` before the first launch. macOS asks for the Accessibility permission again once
- breaking: the debug switch is now `localStorage["prosed:debug"] = "1"`
- feat: the desktop app's menu bar icon is monochrome and follows the menu bar's light or dark look on macOS
```

- [ ] **Step 8: Retake `assets/settings.png`** from the light screenshot of Task 2, Step 6, cropped to the page width like the current file.

- [ ] **Step 9: Check no old name is left**

Run: `grep -rniE 'ai.grammar|aigrammar' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=build --exclude-dir=package --exclude-dir=target --exclude-dir=docs .`
Expected: only old CHANGELOG entries (`## 0.10.0` and below) and the credits paragraph mentioning `nucleartux/ai-grammar`.

### Task 5: Pull request

- [ ] **Step 1:** Run `/pr-create -sa` from branch `feat/prosed-rebrand`. The PR body carries the manual checklist for the Mac: `cargo tauri build` gives `prosed.app`; the menu bar icon is monochrome and switches with the menu bar; the Accessibility prompt names prosed; the `mv` command brings the old settings back; `cargo check` for the macOS branch if it couldn't run on the VPS.
- [ ] **Step 2:** After Florian merges, rename the repo: `gh repo rename prosed --repo florianlauer/ai-grammar --yes`, set the description with `gh repo edit florianlauer/prosed --description "A grammar checker that runs on your machine."`, and update the local remote with `git remote set-url origin https://github.com/florianlauer/prosed.git`.
