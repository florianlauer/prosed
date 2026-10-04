# prosed for the desktop

The extension's grammar check, in every app on the machine. It is a [Tauri](https://tauri.app) app that reads the focused text field through the accessibility API (Accessibility on macOS, UI Automation on Windows) and sends its text to the same local Ollama server as the extension. It reuses the extension's prompts, diff and rewrite checks from `../src`.

Linux isn't supported yet. [LINUX.md](./LINUX.md) explains what is possible there and what isn't.

Tested by hand on macOS in TextEdit and in a Chromium `contenteditable` (the kind of field Slack and other Electron apps use), with two screens at different scales. The Windows build compiles and packages but hasn't run on a Windows machine yet.

## What it does

- **Underline mistakes as you type.** On by default. After an 800 ms pause, the app checks the focused field and draws the underlines in a transparent window over it, with the extension's styles. A badge in the corner of the field shows the number of mistakes, and clicking it accepts them all. Hover an underline to get the extension's card: the fix, "Add to dictionary" and "Ignore". Hover the badge to get its panel: the text with every fix to click, the long sentences, the tones for the whole text, and "Turn off in" the current app. Sentences over 30 words get the dashed violet underline and a "Rewrite this sentence" card.
- **Rewrite the selection with a shortcut.** Off by default, turned on in the settings. Select text in any app and press `Cmd+Alt+G` (`Ctrl+Alt+G` on Windows). A card shows the fixed text, three rewrites and the tone presets. Click one to replace the selection.
- **Choose the apps.** Every app you type in shows up in the settings with a checkbox, and "Add" lists the open apps to add one before typing in it. Browsers start unchecked, since the extension already covers them.

The settings window has the sections of the extension's options page (model, dictionary, style, ignored changes) and the app's own. The app keeps its own copy of these settings in `config.json`: it doesn't read the browser's.

The app has no Dock icon. Its settings open when it starts, when you open it again from the Finder or Spotlight, and from its menu bar icon, which the notch can hide on a crowded menu bar.

## Run it

Ollama must be running with the model picked in the settings (`gemma4:e2b-it-qat` by default), as for the extension.

The Rust toolchain and the Tauri CLI come from `devenv.nix` at the repo root:

```shell
npm install                      # at the repo root, for the shared TypeScript
cd desktop/src-tauri
devenv shell -- cargo tauri dev  # runs the app, reloads the web pages on change
devenv shell -- cargo tauri build
```

`cargo tauri build` makes `target/release/bundle/macos/prosed.app` and a `.dmg`.

On first launch, macOS asks for the Accessibility permission. The settings window shows a banner with a button to the right settings pane until it's granted. `cargo tauri dev` runs an unsigned binary, so macOS asks again after each rebuild that changes it. A release signed as in [Release](#release) keeps the permission from one update to the next.

### Windows

UI Automation needs no permission. To build the installer from a Mac:

```shell
cd desktop/src-tauri
XWIN_ACCEPT_LICENSE=1 devenv shell -- cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

It writes `target/x86_64-pc-windows-msvc/release/bundle/nsis/prosed_0.1.0_x64-setup.exe`. `cargo-xwin` downloads the Windows SDK headers the first time, which is why it asks to accept Microsoft's license. The installer isn't signed, so SmartScreen warns before running it.

### Checking the accessibility layer alone

`probe` reads the focused field of an app and finds a word in it, without the UI:

```shell
devenv shell -- cargo run --example probe -- <pid> <word> [replacement]
```

It prints the field's text, frame, selection and the word's bounds, and replaces the word if you pass a replacement.

## Release

The macOS app is signed with a self-signed certificate. Gatekeeper doesn't accept it, but the signature stays the same from one build to the next, so macOS keeps the Accessibility permission across updates. An unsigned or ad hoc signed build looks like a new app every time.

Create the certificate once, in Keychain Access: Certificate Assistant > Create a Certificate…, named `AI Grammar Self-Signed`, with the identity type "Self Signed Root" and the certificate type "Code Signing". Export it to a `.p12` and keep it: a build signed with another certificate loses the permission on every Mac. The certificate keeps its original name after the rename to prosed; use the name shown in your keychain.

Bump `version` in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, then build and check:

```shell
cd desktop/src-tauri
APPLE_SIGNING_IDENTITY="AI Grammar Self-Signed" devenv shell -- cargo tauri build --bundles app,dmg
# certificate leaf = H"…", the same hash for every build
codesign -d -r- "target/release/bundle/macos/prosed.app"
# /usr/lib/libiconv.2.dylib
otool -L "target/release/bundle/macos/prosed.app/Contents/MacOS/prosed" | grep iconv
```

The `otool` line checks what `build.rs` takes care of. The Nix linker of devenv links its own `libiconv` by its `/nix/store` path, and the signed app then dies at launch because macOS refuses a library signed by someone else.

Build the Windows installer as in [Windows](#windows), then publish both under a `desktop-v` tag, apart from the extension's releases:

```shell
gh release create desktop-v0.1.0 \
  "target/release/bundle/dmg/prosed_0.1.0_aarch64.dmg" \
  "target/x86_64-pc-windows-msvc/release/bundle/nsis/prosed_0.1.0_x64-setup.exe" \
  --title "Desktop 0.1.0" --notes "…"
```

Nothing is notarized, so the first launch takes a few clicks:

- macOS blocks the downloaded app. In System Settings > Privacy & Security, "Open Anyway" at the bottom lets it run. `xattr -dr com.apple.quarantine "/Applications/prosed.app"` does the same.
- The settings window then asks for the Accessibility permission, and its button opens the right pane.
- On Windows, SmartScreen warns about the installer: "More info", then "Run anyway".

## How it works

- `src-tauri/src/platform/` reads and edits the focused field: `macos.rs` with `AXUIElement`, `windows.rs` with `IUIAutomationTextPattern`. Offsets are UTF-16 code units on both, like JavaScript strings, so the ranges from `diffHunks` work unchanged. Chromium and Electron only give the screen position of text on the text leaves inside a `contenteditable`, and ignore a new `AXSelectedText`, so on macOS the app measures the leaf and types the fix over the selection.
- `src-tauri/src/worker.rs` is the one thread that makes accessibility calls. It polls the focused field every 200 ms and gets commands (apply a fix, read the selection) through a channel.
- `src-tauri/src/lib.rs` places the windows: the overlay over the field, and the card next to the hovered mark or the selection. The card never takes focus (a non-activating `NSPanel` on macOS, `WS_EX_NOACTIVATE` on Windows), so the field keeps the caret while you click it.
- `src-tauri/src/ollama.rs` calls Ollama from Rust, so requests don't depend on which origins Ollama allows, and a new check cancels the one still running.
- `src/overlay.ts`, `src/card.ts` and `src/settings.ts` are the three web pages. They use the extension's CSS (`src/contentScript/overlay.css`, `src/options/options.css`) and build the same DOM, so a change to the extension's design shows up here too. `src/chrome.ts` answers the few `chrome.*` calls of `src/settings.ts` and the options page, which the settings window loads as they are. The check, rewrites and formality meter come from the extension's `src/check.ts`; `src/api.ts` gives it the `generate` that goes through Rust.
- The settings live in `config.json` in the app's config folder (`~/Library/Application Support/com.florianlauer.prosed/` on macOS, `%APPDATA%\com.florianlauer.prosed\` on Windows).

## Limits

- A fix is typed over the selected range, so it goes into the app's undo history. Fields that refuse a selection get their whole value replaced, which some apps don't undo.
- The shortcut falls back to the clipboard in apps that don't expose their selection. It restores the clipboard afterwards, but only its text: an image on the clipboard is lost.
- A mistake that spans two lines gets one underline per line when the app reports its lines, as TextEdit does. Otherwise one underline covers both lines.
- The rewrite cards have a "Close" button the extension doesn't need: the app can't see a click outside the card.
- The overlay stays on top when another window covers part of the field.
- Web views that don't report a text role (some of Mail, some Electron apps) aren't checked. Terminals aren't either.
- Password fields are skipped on both systems.
