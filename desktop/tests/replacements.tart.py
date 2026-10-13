"""Run after starting the guest fixture and Prosed in the headless Tart VM."""

import json
import subprocess
import time
from pathlib import Path

ARTIFACTS = Path.home() / ".tart/artifacts/agent-macos"
(ARTIFACTS / "replacements").mkdir(parents=True, exist_ok=True)


def guest(*args, body=None):
    result = subprocess.run(
        ["tart", "exec", "-i", "agent-macos", *args],
        input=body or "", capture_output=True, text=True, timeout=20, check=True,
    )
    return result.stdout


assert guest("/usr/sbin/sysctl", "-n", "hw.model").startswith("VirtualMac")


def state(reset=None):
    return json.loads(guest("/opt/homebrew/bin/node", "-e", """
        const body = require('node:fs').readFileSync(0, 'utf8');
        fetch('http://127.0.0.1:1421', body ? {method:'POST',body} : {})
          .then(r=>r.text()).then(console.log);
    """, body=json.dumps(reset) if reset is not None else ""))


def move(x, y):
    mouse_event(5, x, y)
    time.sleep(2)


def click(x, y):
    mouse_event(5, x, y)
    mouse_event(1, x, y)
    mouse_event(2, x, y)
    time.sleep(2)


def capture(name):
    guest("/bin/zsh", "-c", f'screencapture -x /tmp/prosed-test.png && cat /tmp/prosed-test.png > "/Volumes/My Shared Files/artifacts/replacements/{name}.png"')


def mouse_event(kind, x, y):
    guest("/usr/bin/osascript", "-l", "JavaScript", "-e", f'ObjC.import("CoreGraphics"); const event=$.CGEventCreateMouseEvent(null,{kind},{{x:{x},y:{y}}},0); $.CGEventPost(0,event);')


def same_clipboard(before, after):
    assert after["clipboard"] == before["clipboard"]
    assert after["clipboardItems"] == before["clipboardItems"]


def undo():
    guest("/usr/bin/osascript", "-e", 'tell application "System Events" to keystroke "z" using command down')


before = state({})
move(511, 228)
capture("suggestion-before")
click(560, 294)
after = state()
assert after["text"] == before["text"].replace("prefere", "préfère"), after["text"]
same_clipboard(before, after)
capture("suggestion-after")
undo()
assert state()["text"] == before["text"]
print("PASS single suggestion, clipboard restoration and undo", flush=True)

original = before["original"]
for name, reset in [
    ("all-text", {}),
    ("all-badge", {}),
    ("all-empty", {"clipboardText": None}),
    ("all-image", {"clipboardKind": "image"}),
    ("all-html", {"clipboardKind": "html"}),
    ("all-unicode-multiline", {"text": f"👍 Avant\n{original}\nAprès 👩‍💻"}),
    ("all-rich-text", {"html": f'<div>{original.replace("mologue", "<b>mologue</b>")}</div><div>Après 👍</div>'}),
]:
    before = state(reset)
    move(894, 456)
    capture(f"{name}-before")
    click(894, 456) if name == "all-badge" else click(856, 493)
    after = state()
    assert after["text"] == before["corrected"], (name, after["text"])
    same_clipboard(before, after)
    capture(f"{name}-after")
    undo()
    assert state()["text"] == before["text"], f"{name} undo"
    print(f"PASS {name}, clipboard restoration and undo", flush=True)
