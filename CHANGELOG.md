# CHANGELOG

## Unreleased

## Desktop 0.2.1 [2026.10.10]

- fix: run macOS clipboard keyboard commands on the main thread to prevent crashes when applying corrections or replacing a selection

## 0.12.0 / Desktop 0.2.0 [2026.10.10]

- feat: bring your own API key in the extension and desktop app for OpenAI, Anthropic, OpenRouter, Gemini API, Mistral, Groq, DeepSeek or an OpenAI-compatible endpoint. Settings can test the connection, save a model per provider and remove a key
- privacy: API mode sends checks and rewrites directly to the chosen provider and uses that account's credits. Local mode remains the default. Keys stay in local extension storage or the desktop system keychain and never sync
- feat: localize both interfaces in English, French, German, Spanish and Japanese
- feat: select and verify Gemini Nano in Chrome, with browser compatibility checks and download controls
- fix: keep page modals open when clicking extension suggestions
- fix: prevent duplicated text when replacing selections in macOS apps

## 0.11.0 [2026.10.03]

- feat: the project is now called prosed, with its own icon, colors and type. The settings page uses IBM Plex, bundled with the extension
- docs: the release zip is now `prosed-0.11.0.zip`. To update, unzip it over the folder the extension already loads from, even if it's called `ai-grammar`: Chrome ties an unpacked extension's settings to its folder, so a new folder starts with an empty dictionary, no ignored changes and default style choices
- docs: if you built the desktop app from source before this release, its identifier is now `com.florianlauer.prosed` and it starts with default settings. To keep yours, quit the old app and move its config folder before launching prosed. If prosed already ran once, delete its new config folder first, or the move nests the old one inside it:
  - macOS: `mv ~/Library/Application\ Support/com.florianlauer.ai-grammar ~/Library/Application\ Support/com.florianlauer.prosed`. macOS asks for the Accessibility permission again once
  - Windows: uninstall "AI Grammar" first, then `move "%APPDATA%\com.florianlauer.ai-grammar" "%APPDATA%\com.florianlauer.prosed"`
- breaking: the debug switch is now `localStorage["prosed:debug"] = "1"`
- feat: the desktop app's menu bar icon is monochrome and follows the menu bar's light or dark look on macOS
- feat: desktop app for macOS and Windows in `desktop/`: underlines mistakes in the focused field of any app, and rewrites the selection with a shortcut (off by default). Each app can be turned off in its settings
- docs: `desktop/LINUX.md`, what a Linux version could do on X11 and on Wayland
- fix: without Ollama, a Chrome that can't run Gemini Nano now says "AI is not supported" instead of "Make sure that Gemini is working"
- refactor: the extension, the desktop app and the benchmarks share one grammar check (`src/check.ts`) and one as-you-type check loop (`src/session.ts`). The grammar and tone benchmarks now grade what the user sees, after the same filters

## 0.10.0 [2026.09.29]

- feat: tone presets on the rewrite card: "More formal", "Friendlier", "More confident", "Shorter"
- feat: the rewrite card says how formal the text sounds, from "Very casual" to "Very formal"
- feat: the suggestions panel applies the tone presets to the whole field
- feat: `bench/tone-bench.mjs` grades the formality meter and each preset
- feat: "More natural" preset for English written as a second language
- feat: the rewrite card lists French false friends found in the text ("actually" for "actuellement") and passes them to the model, which then knows the writer is likely a French speaker
- fix: a rewrite that spells out a number up to twelve ("two weeks" for "2 weeks", "dix" for "10") is no longer dropped

## 0.9.0 [2026.09.29]

- feat: "Ignore" on a suggestion refuses that change on every site. The settings list ignored changes and can restore them
- feat: style settings: French "tu" or "vous", US or UK spelling, and whether informal words count as mistakes
- feat: rewrite a selection, or a sentence over 30 words, into three variants, shown in violet apart from the fixes
- feat: rewrite variants that drop a number, link, name or dictionary word, switch language, or add brackets are never shown
- feat: the suggestions panel lists "Fixes" and "Rewrites" under their own labels
- feat: `bench/rewrite-bench.mjs` grades rewrites with the same checks

## 0.8.0 [2026.09.29]

- feat: settings page, opened from the toolbar icon or the suggestions panel
- feat: pick the Ollama model in the settings instead of editing the source. Switching unloads the old model and preloads the new one
- feat: personal dictionary: "Add to dictionary" on a suggestion, and a word list in the settings
- feat: turn the extension off on a site, from the suggestions panel or the settings
- fix: show Ollama's own error message (for example "model not found") instead of a generic one

## 0.7.1 [2026.09.29]

- fix: recheck when an editor changes the text without an input event (deleting in Notion), so old suggestions don't linger
- fix: a check superseded by a newer one no longer shows an "Aborted" error
- feat: check after a 500 ms typing pause instead of 800 ms
- fix: ignore typographic variants (’ vs ', « » vs "", non-breaking spaces), which looped in editors that curl quotes as you type

## 0.7.0 [2026.09.29]

- fix: check Gmail's compose window, which turns native spell checking off
- fix: in editors where the whole page is editable (Notion), check the block around the caret instead of the page
- fix: say "reload this page" when the extension was updated after the tab loaded
- fix: leave email signatures (after a `-- ` line) and blank lines out of the check
- feat: debug traces in the console with `localStorage["ai-grammar:debug"] = "1"`
- fix: the error panel's docs link points to this fork's troubleshooting section

## 0.6.0 [2026.09.28]

- feat: underline suggestions in textarea and contenteditable fields
- feat: apply one suggestion at a time from a hover card or the suggestions panel
- feat: undoable edits through the browser's editing commands
- feat: wait 800 ms after typing before checking
- feat: switch the Ollama model to gemma4:e2b-it-qat and keep it loaded
- feat: new overlay styles with light and dark themes
- feat: add an Ollama grammar benchmark in `bench/`
- fix: pass a JSON schema to Ollama's `format` (the server returned 500)

## 0.3.1 [2024.10.17]

- fix: support latest chrome version

## 0.3.0 [2024.09.24]

- feat: add Ollama support

## 0.2.5 [2024.09.13]

- fix: fix z-index

## 0.2.4 [2024.09.04]

- fix: finally fix csp

## 0.2.3 [2024.09.03]

- fix: set minimum_chrome_version

## 0.2.2 [2024.09.03]

- fix: fix csp

## 0.2.1 [2024.08.22]

- fix: change title

## 0.2.0 [2024.08.21]

- feat: update to latest version of api
- fix: adjust prompt

## 0.1.0 [2024.08.19]

- feat: add contenteditable support
- fix: adjust position of the button

## 0.0.1 [2024.08.17]

- feat: initial
- feat: generator by ![create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext)
