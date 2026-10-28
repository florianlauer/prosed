# prosed for the desktop

The extension's grammar check, in every app on the machine. It is a [Tauri](https://tauri.app) app that reads the focused text field through the accessibility API (Accessibility on macOS, UI Automation on Windows) and sends its text to Ollama or the API provider selected in settings. It reuses the extension's prompts, diff and rewrite checks from `../src`.

Linux isn't supported yet. [LINUX.md](./LINUX.md) explains what is possible there and what isn't.

Tested by hand on macOS in TextEdit and in a Chromium `contenteditable` (the kind of field Slack and other Electron apps use), with two screens at different scales. The Windows build compiles and packages but hasn't run on a Windows machine yet.

## What it does

- **Underline mistakes as you type.** On by default. After an 800 ms pause, the app checks the focused field and draws the underlines in a transparent window over it, with the extension's styles. A badge in the corner of the field shows the number of mistakes, and clicking it accepts them all. Hover an underline to get the extension's card: the fix, "Add to dictionary" and "Ignore". Hover the badge to get its panel: the text with every fix to click, the long sentences, the tones for the whole text, and "Turn off in" the current app. Sentences over 30 words get the dashed violet underline and a "Rewrite this sentence" card.
- **Rewrite the selection with a shortcut.** Off by default, turned on in the settings. Select text in any app and press `Cmd+Alt+G` (`Ctrl+Alt+G` on Windows). A card shows the fixed text, three rewrites and the tone presets. Click one to replace the selection.
- **Choose the apps.** Every app you type in shows up in the settings with a checkbox, and "Add" lists the open apps to add one before typing in it. Browsers start unchecked, since the extension already covers them.

The settings window has the sections of the extension's options page (model, dictionary, style, ignored changes) and the app's own. The app keeps its own copy of these settings in `config.json`: it doesn't read the browser's.

The app has no Dock icon. Its settings open when it starts, when you open it again from the Finder or Spotlight, and from its menu bar icon, which the notch can hide on a crowded menu bar.

## Run it

In local mode, Ollama must be running with the model picked in settings, `gemma4:e2b-it-qat` by default. You can also choose an API provider and enter your own key and model ID. API requests go directly from Rust to the provider. Keys stay in the system keychain; the settings file contains only provider and model preferences. See [Bring your own key](../README.md#bring-your-own-key) for setup and billing details.

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

### Testing replacements in Tart

Use the headless `agent-macos` VM described in the [fleet Tart guide](https://github.com/florianlauer/fleet/blob/main/TART.md). Install the signed Prosed build in the guest and grant it Accessibility access. Keep all input and clipboard operations inside the guest.

Copy `src-tauri/examples/replacement_fixture.cjs` and an Electron 44.4.2 runtime into the guest. Run the fixture with `PROSED_TEST_PROFILE` pointing to a temporary guest directory, then launch Prosed. The fixture provides a contenteditable editor and a deterministic Ollama response on guest ports 1421 and 11434. It uses Electron's current `ClipboardItem` API. Leave both ports free before starting it.

With the guest desktop at 1440 × 900 and the fixture window at its default position, run from the repository root:

```shell
python3 desktop/tests/replacements.tart.py
```

The suite clicks the suggestion and Accept all through guest mouse events. It checks the exact text, undo, and clipboard contents for a long sentence, multiline Unicode, rich text, and empty, image and HTML clipboards. Individual suggestions also run after one or four paragraphs and mixed paragraph/line breaks, which previously turned `prefere attendre` into `prefpréfèreendre`. Screenshots go to `~/.tart/artifacts/agent-macos/replacements/`. The guest needs Node at `/opt/homebrew/bin/node` and permission for `osascript` to send input. It does not use Tart's experimental VNC server.

The ignored Rust test `keys::tests::restores_empty_image_and_rich_text_clipboards` also runs only in the VM. Copy the test executable produced by `cargo test --lib --no-run` into the guest, then run it with `--exact keys::tests::restores_empty_image_and_rich_text_clipboards --ignored`.

## Release

The macOS release script builds a universal app for Apple Silicon and Intel, signs it with Developer ID, and submits the DMG to Apple's notarization service. It generates `Casks/prosed.rb` only after notarization, ticket stapling and Gatekeeper checks succeed. The minimum macOS version is 12.

Apple certificates have an expiration date. A [secure timestamp](https://developer.apple.com/documentation/technotes/tn3161-inside-code-signing-certificates) lets a Developer ID release keep working after its certificate expires. New builds need a valid certificate. Developer ID distribution does not use a seven-day development provisioning profile.

### Set up Apple signing once

1. Enroll in the paid Apple Developer Program. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list), create a **Developer ID Application** certificate using a certificate signing request from your Mac. Import the downloaded certificate into the same Mac's keychain, where its private key lives. An Apple Development or Apple Distribution certificate cannot replace it for direct distribution.
2. Run `security find-identity -v -p codesigning` and copy the full `Developer ID Application: …` name. Keep a secure backup of the certificate and private key outside the repository.
3. Save notarization credentials in the keychain. Run this in your own terminal, replacing the Apple ID and team ID:

   ```shell
   env -u DEVELOPER_DIR -u SDKROOT /usr/bin/xcrun notarytool store-credentials prosed \
     --apple-id "your-apple-id@example.com" --team-id "YOURTEAMID"
   ```

   Enter an [app-specific password](https://support.apple.com/102654) at the secure prompt. Do not put it in a command, environment file or commit. The release script reads the saved keychain profile. `NOTARYTOOL_PROFILE` selects another profile if needed.

   An App Store Connect team API key with the Developer role can replace the app-specific password. Keep its downloaded `.p8` file outside the repository with mode `600`, then store it in the same profile:

   ```shell
   env -u DEVELOPER_DIR -u SDKROOT /usr/bin/xcrun notarytool store-credentials prosed \
     --key /secure/path/AuthKey_KEYID.p8 --key-id KEYID --issuer ISSUER_ID
   ```

### Build and verify

Bump `version` in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and the `prosed` entry in `src-tauri/Cargo.lock`. From the repository root:

```shell
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (YOURTEAMID)" \
  npm run desktop:release:macos
```

The script checks the signing identity and notarization access before building. It verifies both CPU architectures, the secure timestamp, the hardened runtime, and the absence of `/nix/store` library dependencies. `build.rs` links macOS's `libiconv` and `libcharset` to avoid dependencies on the build machine's Nix store and CPU architecture. The script then notarizes the DMG, staples the tickets to the app and DMG, and calculates Homebrew's checksum from the final DMG.

Outputs:

- `src-tauri/target/universal-apple-darwin/release/bundle/macos/prosed.app`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/prosed_<version>_universal.dmg`
- `../Casks/prosed.rb`, ready to commit with the release
- `release/notarization.json`, Apple's submission ID and status, ignored by git

Run `npm run desktop:test:release` to exercise the release checks with mocked Apple tools. It uses macOS's `trash` command to clean up its temporary fixtures. Test the built app in the Tart VM before publishing.

Desktop 0.2.2 and earlier used `AI Grammar Self-Signed`. The first update to Developer ID may require removing the old Accessibility entry and granting access again. Keep the bundle identifier `com.florianlauer.prosed` and the signing team stable for subsequent updates.

### Publish the DMG and Homebrew cask

Commit and push the reviewed source, version files and generated `Casks/prosed.rb`, then publish the exact verified DMG under a `desktop-v` tag. Use the pushed commit's SHA as the release target. Desktop tags are separate from extension tags.

```shell
gh release create desktop-v0.2.3 \
  desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/prosed_0.2.3_universal.dmg \
  --repo florianlauer/prosed --target "$(git rev-parse HEAD)" --latest=false \
  --title "Desktop 0.2.3" --notes-file /path/to/release-notes.md
```

Do not overwrite an existing release's DMG. Stapling or rebuilding it changes the checksum and requires regenerating the cask. Attach the Windows installer too if one was built as in [Windows](#windows). The Windows installer remains unsigned and may trigger SmartScreen.

Once the generated cask is pushed and its DMG is published, the repository itself can serve as a Homebrew tap:

```shell
brew tap florianlauer/prosed https://github.com/florianlauer/prosed
brew trust --cask florianlauer/prosed/prosed
brew install --cask florianlauer/prosed/prosed
```

Homebrew 7 requires the `brew trust` step for third-party casks. Skip that command on older Homebrew versions. For subsequent releases, run `brew update` followed by `brew upgrade --cask florianlauer/prosed/prosed`. Normal uninstall leaves settings and API keys intact. Grant Accessibility access on first launch and choose a cloud provider or install Ollama for local checks.

### Mac App Store

The current app cannot ship unchanged through the Mac App Store. Apple's [review guidelines](https://developer.apple.com/app-store/review/guidelines/#hardware-compatibility) require App Sandbox, while [App Sandbox forbids accessibility APIs in assistive apps](https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox). Prosed uses these APIs to read and edit fields in other apps. Its non-activating panels also use a private AppKit method, which conflicts with the public API requirement.

An App Store edition needs a separate interaction model, such as checking text in its own editor, and removal of private APIs. Enabling the sandbox or changing the certificate alone would leave the current app unable to perform its main function. The full app can use Developer ID notarization and Homebrew without an App Store listing.

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
