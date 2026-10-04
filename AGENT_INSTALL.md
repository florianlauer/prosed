# Installing prosed for a user

You are installing the prosed browser extension on the user's machine, with a local Ollama model behind it. Work through the steps in order. Each step ends on a check. Move to the next step only once the check passes.

The [README](https://raw.githubusercontent.com/florianlauer/prosed/main/README.md) is the source of truth for platform commands. Fetch it when a step points to one of its sections.

Ask the user before you install or upgrade software, run anything with `sudo`, or change how a background service starts. Say what you are about to run and why, then wait for a yes. Read-only checks need no confirmation.

## 1. Know the machine

Find the OS (macOS, Windows, Linux) and ask the user which browser they use: Chrome, Arc, Edge, Brave or another Chromium browser. Firefox and Safari can't run this extension. Tell the user that and stop.

Check: you know the OS and a supported browser.

## 2. Pick the model path

Use Ollama unless the user asks for Chrome's built-in model. The built-in model only works in Google Chrome 138+ on a machine with 16 GB of RAM or a GPU with more than 4 GB of VRAM, plus 22 GB of free disk. If the user picks it and meets those numbers, skip to step 5.

Check: the path is Ollama, or the user chose Chrome built-in and meets its requirements.

## 3. Ollama and the model

Run `ollama --version`. The extension needs 0.34 or newer.

- Not installed: install it with the README's "1. Install Ollama" commands for this OS.
- Older than 0.34: upgrade it the same way. Then restart the server. An upgraded binary does not replace a server that is already running, and `ollama --version` prints a warning while client and server versions differ.

Then download the model (4.3 GB):

```shell
ollama pull gemma4:e2b-it-qat
```

Check: `ollama --version` prints 0.34 or newer with no client/server warning, and `ollama list` shows `gemma4:e2b-it-qat`.

## 4. Allow the extension's origin

Ollama answers browser extensions with a 403 unless `OLLAMA_ORIGINS` includes `chrome-extension://*`, set on the process that runs the server. Find out how the server runs:

- macOS: the menu bar app runs if `/Applications/Ollama.app` exists and `pgrep -lf Ollama` lists it. A Homebrew or hand-made LaunchAgent shows up in `launchctl list | grep -i ollama`.
- Linux: the install script's service runs if `systemctl is-active ollama` prints `active`.
- Windows: the tray app is the default.
- Otherwise the user starts `ollama serve` by hand.

Apply the matching block from the README section "3. Let the extension talk to Ollama", then restart the server so it picks up the variable.

Make it survive a reboot. On macOS, `launchctl setenv` is forgotten at restart. Offer the user the README's LaunchAgent from "5. Optional: start Ollama at login" instead, and quit the menu bar app if they accept, since both use port 11434.

Run:

```shell
curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: chrome-extension://test" http://127.0.0.1:11434/api/tags
```

Check: it prints `200`. `403` means the running server doesn't have the variable: find the process that actually serves port 11434 and restart that one. No output means no server is running.

## 5. Download the extension

Put it in a folder the user will keep. The browser loads the extension from that folder on every start. Use `~/Extensions/prosed` on macOS and Linux, `%USERPROFILE%\Extensions\prosed` on Windows. If the folder exists, this is an update: replace its contents. Installs from before the rename live in `~/Extensions/ai-grammar` (`%USERPROFILE%\Extensions\ai-grammar`). If that folder exists, use it instead and keep its name: the browser ties the extension's settings to the folder, so a new folder starts with an empty dictionary.

macOS and Linux:

```shell
url=$(curl -s https://api.github.com/repos/florianlauer/prosed/releases/latest | grep -o '"browser_download_url": *"[^"]*\.zip"' | cut -d'"' -f4)
dest=~/Extensions/prosed
[ -d ~/Extensions/ai-grammar ] && dest=~/Extensions/ai-grammar
mkdir -p "$dest"
curl -sL "$url" -o /tmp/prosed.zip
unzip -o /tmp/prosed.zip -d "$dest"
```

Windows (PowerShell):

```powershell
$release = Invoke-RestMethod https://api.github.com/repos/florianlauer/prosed/releases/latest
$asset = $release.assets | Where-Object name -like '*.zip' | Select-Object -First 1
$dest = "$env:USERPROFILE\Extensions\prosed"
if (Test-Path "$env:USERPROFILE\Extensions\ai-grammar") { $dest = "$env:USERPROFILE\Extensions\ai-grammar" }
New-Item -ItemType Directory -Force $dest | Out-Null
Invoke-WebRequest $asset.browser_download_url -OutFile "$env:TEMP\prosed.zip"
Expand-Archive "$env:TEMP\prosed.zip" -DestinationPath $dest -Force
```

Check: `manifest.json` sits directly in that folder, not in a subfolder.

## 6. Load it in the browser

The browser keeps extension loading behind a manual switch, so the user does this part. Give them these steps with the real folder path filled in:

1. Open `chrome://extensions` (Arc: `arc://extensions`, Edge: `edge://extensions`, Brave: `brave://extensions`).
2. Turn on "Developer mode".
3. Click "Load unpacked" and pick the folder from step 5. On macOS, Cmd+Shift+G in the file picker accepts a typed path. On an update, click the reload icon on the existing card instead. A card from before the rename still says "AI Grammar Checker" until it is reloaded.
4. Reload any tab that was open before.

Check: the user confirms a "prosed" card is on the extensions page with no error.

## 7. Try it

Ask the user to open a page with a multi-line text field, such as a new email draft, and type:

```text
jai bien recu ton messsage, je regarde sa demain
```

Within a couple of seconds after they stop typing, the badge in the field's bottom right corner should show a red number and the mistakes should be underlined. If you have browser automation, you can run this test yourself.

Check: the user sees the red number, or you do. No badge at all usually means the site turned spell checking off on that field: try another site before debugging. If the badge is orange, have the user hover it and read you the error, then use the README's "Troubleshooting" section.

## 8. Report

Tell the user, briefly:

- what you installed or upgraded, and the Ollama version;
- where `OLLAMA_ORIGINS` is set, and whether that survives a reboot;
- that the model keeps 3.8 GB of memory while Ollama runs, and `ollama stop gemma4:e2b-it-qat` frees it;
- the extension folder, and that updating means repeating steps 5 and 6.

To undo: remove the extension card, delete the extension folder, `ollama rm gemma4:e2b-it-qat`, and revert the `OLLAMA_ORIGINS` change where you made it.
