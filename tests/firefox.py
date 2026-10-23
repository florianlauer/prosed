"""Exercise the Firefox build in an isolated headless profile, without Python dependencies."""

import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
ADDON_ID = "prosed@florianlauer.dev"
UUID = "adf60111-6c03-4b60-9200-10d792cba111"
OPTIONS = f"moz-extension://{UUID}/src/options/index.html"
PAGE = """<!doctype html><html lang="en"><meta charset="utf-8">
<title>Prosed Firefox verification</title><style>
body{padding:32px;font:18px sans-serif}textarea,[contenteditable]{display:block;
width:700px;min-height:140px;padding:14px;font:20px/1.6 sans-serif;
margin:20px 0;border:1px solid #999}iframe{width:780px;height:230px}</style>
<h1>Prosed Firefox verification</h1><textarea id="text" spellcheck="true"></textarea>
<div contenteditable="true" id="editor" spellcheck="true"></div>
<iframe id="blank" srcdoc='<textarea id="framed" spellcheck="true"
style="width:650px;height:120px;font:20px sans-serif"></textarea>'></iframe></html>"""
PROBE = """
window.addEventListener('message', async ({source, data}) => {
  if (source !== window || !data?.prosedProbe) return;
  let session;
  if (data.prosedProbe.type === 'probe.storage') {
    try { session = await chrome.storage.session?.get(null); } catch {}
  }
  const reply = data.prosedProbe.type === 'probe.storage'
    ? {local: await chrome.storage.local.get(null), sync: await chrome.storage.sync.get(null),
       session,
       databases: (await indexedDB.databases()).map(d => d.name)}
    : await chrome.runtime.sendMessage(data.prosedProbe);
  window.postMessage({prosedReply: reply}, '*');
});
"""


class Fixture(BaseHTTPRequestHandler):
    requests = []
    real_ollama = False
    status = 200

    def log_message(self, *_):
        pass

    def respond(self, value, status=200, content_type="application/json"):
        body = value.encode() if isinstance(value, str) else json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/tags":
            if self.real_ollama:
                with urlopen("http://127.0.0.1:11434/api/tags", timeout=10) as response:
                    return self.respond(json.load(response))
            return self.respond({"models": [{"name": "gemma4:e2b-it-qat"}, {"name": "firefox-fixture"}]})
        self.respond(PAGE, content_type="text/html; charset=utf-8")

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.requests.append((self.path, body, dict(self.headers)))
        if self.path == "/api/generate" and self.real_ollama:
            request = Request("http://127.0.0.1:11434/api/generate", json.dumps(body).encode(),
                              headers={"Content-Type": "application/json"})
            with urlopen(request, timeout=120) as response:
                return self.respond(json.load(response))
        if self.status != 200:
            return self.respond({"error": {"message": "firefox-test-key"}}, self.status)
        prompt = body["prompt"] if "prompt" in body else body["messages"][0]["content"]
        text = prompt.rsplit("Text:\n", 1)[-1]
        corrected = text.replace("prefere", "préfère").replace("recu", "reçu").replace("messsage", "message")
        if '"variants"' in prompt:
            answer = {"variants": ["Send the report today.", "Please send the report today."]}
        elif "Rate how formal" in prompt:
            answer = {"formality": 3}
        else:
            answer = {"correctedText": corrected}
        if self.path == "/api/generate":
            self.respond({"response": json.dumps(answer), "done": True})
        else:
            self.respond({"choices": [{"message": {"content": json.dumps(answer)}}]})


class Browser:
    def __init__(self, base):
        self.base = base
        self.session = ""

    def call(self, path, data=None, method="POST"):
        request = Request(self.base + (f"/session/{self.session}" if self.session else "") + path,
                          None if data is None else json.dumps(data).encode(),
                          headers={"Content-Type": "application/json"}, method=method)
        try:
            with urlopen(request, timeout=150) as response:
                return json.load(response)["value"]
        except HTTPError as error:
            raise AssertionError(error.read().decode()) from error

    def js(self, script, *args):
        return self.call("/execute/sync", {"script": script, "args": list(args)})

    def visit(self, url):
        self.call("/url", {"url": url})

    def wait(self, script, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            value = self.js("return " + script)
            if value:
                return value
            time.sleep(0.1)
        raise AssertionError(f"Timed out: {script}\n{self.js('return document.body.innerText;')}")

    def click(self, selector):
        element = self.call("/element", {"using": "css selector", "value": selector})
        self.call(f"/element/{element['element-6066-11e4-a52e-4f735466cecf']}/click", {})

    def select(self, selector, value):
        self.js("const e=document.querySelector(arguments[0]);e.value=arguments[1];"
                "e.dispatchEvent(new Event('change',{bubbles:true}));", selector, value)

    def fill(self, selector, value):
        self.js("const e=document.querySelector(arguments[0]);e.value=arguments[1];"
                "e.dispatchEvent(new Event('input',{bubbles:true}));", selector, value)

    def edit(self, selector, text):
        self.js("const e=document.querySelector(arguments[0]);e.focus();"
                "if(e instanceof HTMLTextAreaElement)e.select();"
                "else {const r=document.createRange();r.selectNodeContents(e);"
                "const s=getSelection();s.removeAllRanges();s.addRange(r);}"
                "document.execCommand('insertText',false,arguments[1]);", selector, text)

    def screenshot(self, path):
        path.write_bytes(base64.b64decode(self.call("/screenshot", method="GET")))

    def probe(self, request):
        self.js("window.prosedReply=null;window.addEventListener('message',e=>{if(e.data?.prosedReply)window.prosedReply=e.data.prosedReply;});window.postMessage({prosedProbe:arguments[0]},'*');", request)
        self.wait("window.prosedReply")
        return self.js("return window.prosedReply;")


def exercise(browser, origin, artifacts, real_ollama, private_mode):
    browser.visit(OPTIONS)
    browser.wait("document.querySelector('#provider')")
    assert browser.js("return chrome.extension.inIncognitoContext;") == private_mode
    browser.select("#ui-locale", "en")
    browser.wait("document.documentElement.lang === 'en'")
    browser.wait("document.querySelector('#model option')")
    assert browser.js("return [...document.querySelector('#model').options].every(o=>!o.value.startsWith('chrome:'));")
    assert browser.js("return document.querySelector('#gemini-download').hidden;")
    if not real_ollama:
        browser.select("#model", "firefox-fixture")
        browser.wait("document.querySelector('#model-load').dataset.state === 'ready'")
        browser.select("#model", "gemma4:e2b-it-qat")
        browser.wait("document.querySelector('#model-load').dataset.state === 'ready'")
        switches = [body for path, body, _ in Fixture.requests if path == "/api/generate"]
        assert [body["keep_alive"] for body in switches] == [0, -1, 0, -1]
        print("PASS model switching unloads and preloads Ollama models", flush=True)

    browser.visit(origin)
    browser.edit("#text", "Je prefere attendre demain.")
    browser.wait("document.querySelector('.aig-trigger[data-state=wrong]')", timeout=120)
    browser.screenshot(artifacts / "ollama-suggestions.png")
    browser.click(".aig-trigger")
    assert browser.js("return document.querySelector('#text').value;") == "Je préfère attendre demain."
    print("PASS Ollama grammar and replacement" + (" with real inference through an isolated proxy" if real_ollama else " with fixture"), flush=True)

    browser.visit(OPTIONS)
    browser.wait("document.querySelector('#provider')")
    browser.select("#provider", "custom")
    browser.wait("!document.querySelector('#cloud-form').hidden")
    browser.fill("#cloud-model", "firefox-test-model")
    browser.fill("#cloud-url", origin + "/v1")
    browser.fill("#cloud-key", "firefox-test-key")
    browser.click("#cloud-test")
    browser.wait("document.querySelector('#cloud-result').textContent.includes('Connection successful')")
    browser.click("#cloud-form button[type=submit]")
    browser.wait("document.querySelector('#cloud-result').textContent.includes('is selected')")
    assert browser.js("return document.querySelector('#cloud-key').value;") == ""
    assert browser.js("return Promise.all([chrome.storage.local.get(null),chrome.storage.sync.get(null)]).then(s=>!JSON.stringify(s).includes('firefox-test-key'));")
    browser.visit(OPTIONS)
    browser.wait("document.querySelector('#cloud-key-status')?.textContent.includes('An API key is saved')")
    status = browser.js("return chrome.runtime.sendMessage({type:'cloud.keyStatus',provider:'custom'});")
    assert status == {"configured": True, "temporary": private_mode}
    hint = browser.js("return document.querySelector('#cloud-storage').textContent;")
    assert ("cleared when Firefox closes" in hint) == private_mode
    print("PASS cloud test/save, key retention hint and credentials surviving page reloads", flush=True)

    browser.visit(origin)
    browser.edit("#text", "Je prefere ce messsage recu hier.")
    browser.wait("document.querySelectorAll('.aig-change').length === 3")
    browser.js("document.querySelector('.aig-trigger').dispatchEvent(new MouseEvent('mouseenter'));")
    browser.click(".aig-change")
    assert browser.js("return document.querySelector('#text').value;") == "Je préfère ce messsage recu hier."
    browser.click(".aig-trigger")
    assert browser.js("return document.querySelector('#text').value;") == "Je préfère ce message reçu hier."
    assert browser.js("return document.execCommand('undo');")
    assert browser.js("return document.querySelector('#text').value;") != "Je préfère ce message reçu hier."
    print("PASS single suggestion, accept all and native undo", flush=True)

    browser.edit("#editor", "Bonjour 👋\n\nJe prefere ce messsage recu hier.")
    browser.wait("document.querySelectorAll('.aig-change').length === 3")
    browser.click(".aig-trigger")
    assert browser.js("return document.querySelector('#editor').innerText;") == "Bonjour 👋\n\nJe préfère ce message reçu hier."
    print("PASS multiline contenteditable and UTF-16 offsets", flush=True)

    # The parent panel can cover the iframe until its hover delay expires.
    browser.click("h1")
    browser.wait("!document.querySelector('.aig-panel[data-open]')")
    frame = browser.call("/element", {"using": "css selector", "value": "#blank"})
    browser.call("/frame", {"id": frame})
    browser.edit("#framed", "Je prefere attendre demain.")
    browser.wait("document.querySelector('.aig-trigger[data-state=wrong]')")
    browser.click(".aig-trigger")
    browser.wait("document.querySelector('#framed').value === 'Je préfère attendre demain.'")
    browser.call("/frame", {"id": None})
    print("PASS about:srcdoc frame injection and replacement", flush=True)

    browser.edit("#text", "Please send the report today.")
    browser.wait("document.querySelector('.aig-trigger[data-state=correct]')")
    browser.js("document.querySelector('#text').setSelectionRange(0,28);document.querySelector('#text').dispatchEvent(new Event('select'));")
    browser.wait("document.querySelector('.aig-rewrite-button[data-open]')")
    browser.click(".aig-rewrite-button")
    browser.wait("document.querySelector('.aig-card__variant')")
    browser.wait("document.querySelector('.aig-meter:not([hidden])')")
    browser.screenshot(artifacts / "rewrite.png")
    browser.click(".aig-chip[data-tone=shorter]")
    browser.wait("document.querySelector('.aig-chip[data-tone=shorter][aria-pressed=true]')")
    browser.wait("document.querySelector('.aig-card__variant')")
    browser.click(".aig-card__variant")
    assert browser.js("return document.querySelector('#text').value;") == "Send the report today."
    print("PASS selection rewrite, tone presets, formality meter and replacement", flush=True)
    browser.edit("#text", "Please send the report today.")
    browser.wait("document.querySelector('.aig-trigger[data-state=correct]')")
    browser.js("document.querySelector('.aig-trigger').dispatchEvent(new MouseEvent('mouseenter'));")
    browser.click(".aig-panel .aig-chip:nth-child(5)")
    browser.wait("document.querySelector('.aig-card__variant')")
    browser.click(".aig-card__variant")
    assert browser.js("return document.querySelector('#text').value;") == "Send the report today."
    print("PASS whole-field tone shortcuts", flush=True)

    browser.visit(OPTIONS)
    browser.wait("document.querySelector('#provider')")
    browser.fill("#dictionary-form input", "prefere")
    browser.click("#dictionary-form button")
    browser.wait("document.querySelector('#dictionary').textContent.includes('prefere')")
    browser.select("#style select[name=english]", "uk")
    browser.visit(origin)
    browser.edit("#text", "Je prefere attendre demain.")
    browser.wait("document.querySelector('.aig-trigger[data-state=correct]')")
    assert any('In English, use British spelling' in str(body) for _, body, _ in Fixture.requests)
    print("PASS dictionary and writing style", flush=True)

    for kind in ("cloud.keySave", "cloud.keyStatus", "cloud.keyRemove", "cloud.test"):
        reply = browser.probe({"type": kind, "provider": "custom", "apiKey": "attacker-key", "config": {"model": "test", "baseUrl": origin + "/attacker"}})
        assert "settings" in reply["error"]
    storage = browser.probe({"type": "probe.storage"})
    assert "firefox-test-key" not in json.dumps(storage)
    assert "prosed-credentials" not in storage["databases"]
    print("PASS content scripts cannot access credentials or test arbitrary endpoints", flush=True)

    browser.edit("#text", "Le messsage est recu.")
    browser.wait("document.querySelectorAll('.aig-change').length === 2")
    browser.js("const r=document.querySelector('.aig-layer[data-kind=fix] .aig-mark').getBoundingClientRect();"
               "document.dispatchEvent(new MouseEvent('mousemove',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true}));")
    browser.wait("document.querySelector('.aig-card[data-open] [data-i18n=ignore]')")
    browser.click(".aig-card[data-open] [data-i18n=ignore]")
    browser.wait("document.querySelectorAll('.aig-change').length === 1")
    browser.visit(origin)
    browser.edit("#text", "Le messsage est recu.")
    browser.wait("document.querySelectorAll('.aig-change').length === 1")
    print("PASS ignored corrections persist across reloads", flush=True)

    page = browser.call("/window", method="GET")
    options = browser.call("/window/new", {"type": "tab"})["handle"]
    browser.call("/window", {"handle": options})
    browser.visit(OPTIONS)
    browser.wait("document.querySelector('#ignored button')")
    browser.click("#ignored button")
    browser.select("#ui-locale", "fr")
    browser.call("/window", {"handle": page})
    browser.edit("#text", "Le messsage est recu.")
    browser.wait("document.querySelectorAll('.aig-change').length === 2")
    browser.wait("document.querySelector('.aig-trigger')?.lang === 'fr'")
    browser.js("document.querySelector('.aig-trigger').dispatchEvent(new MouseEvent('mouseenter'));")
    browser.click(".aig-panel [data-i18n=turnOffSite]")
    browser.wait("!document.querySelector('.aig-trigger')")
    browser.edit("#text", "Je prefere ce messsage recu hier.")
    assert not browser.js("return !!document.querySelector('.aig-trigger');")
    browser.call("/frame", {"id": browser.call("/element", {"using": "css selector", "value": "#blank"})})
    browser.edit("#framed", "Je prefere attendre demain.")
    assert not browser.js("return !!document.querySelector('.aig-trigger');")
    browser.call("/frame", {"id": None})
    browser.call("/window", {"handle": options})
    browser.wait("document.querySelector('#sites button')")
    browser.click("#sites button")
    browser.select("#ui-locale", "en")
    browser.call("/window", {"handle": page})
    browser.edit("#text", "Le messsage est recu.")
    browser.wait("document.querySelectorAll('.aig-change').length === 2")
    print("PASS live language changes, restored corrections and site exclusion including frames", flush=True)

    Fixture.status = 401
    browser.edit("#text", "Je prefere attendre demain.")
    browser.wait("document.querySelector('.aig-trigger[data-state=error]')")
    error = browser.js("return document.querySelector('.aig-panel').textContent;")
    assert "401" in error and "firefox-test-key" not in error
    Fixture.status = 200
    browser.edit("#text", "Je prefere ce messsage recu hier.")
    browser.wait("document.querySelector('.aig-trigger[data-state=wrong]')")
    print("PASS provider errors do not expose keys and checks recover", flush=True)

    browser.visit(OPTIONS)
    browser.wait("document.querySelector('#cloud-remove') && !document.querySelector('#cloud-remove').disabled")
    browser.click("#cloud-remove")
    browser.wait("document.querySelector('#cloud-result').textContent.includes('was removed')")
    browser.select("#provider", "custom")
    browser.wait("document.querySelector('#cloud-key-status').textContent.includes('No API key saved')")
    browser.screenshot(artifacts / "settings.png")
    print("PASS key removal and return to local mode", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geckodriver", default=shutil.which("geckodriver"))
    parser.add_argument("--firefox", default=shutil.which("firefox") or "/Applications/Firefox.app/Contents/MacOS/firefox")
    parser.add_argument("--ollama", action="store_true", help="Use real Ollama on port 11434 through the isolated test proxy")
    parser.add_argument("--private", action="store_true", help="Exercise Firefox permanent private browsing with session-only API keys")
    parser.add_argument("--artifacts", type=Path)
    args = parser.parse_args()
    if not args.geckodriver:
        parser.error("Install geckodriver or pass --geckodriver /path/to/geckodriver")
    if args.artifacts is None:
        args.artifacts = Path(tempfile.mkdtemp(prefix="prosed-firefox-proof-"))
    args.artifacts.mkdir(parents=True, exist_ok=True)
    Fixture.real_ollama = args.ollama
    server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_port}"
    with tempfile.TemporaryDirectory(prefix="prosed-firefox-") as directory:
        addon = Path(directory) / "addon"
        shutil.copytree(ROOT / "build-firefox", addon)
        manifest = json.loads((addon / "manifest.json").read_text())
        assert manifest["background"]["type"] == "module"
        assert "service_worker" not in manifest["background"]
        assert manifest["browser_specific_settings"]["gecko"]["id"] == ADDON_ID
        # A separate endpoint keeps tests from changing the user's Ollama service or configuration.
        changed = 0
        for script in addon.glob("assets/*.js"):
            code = script.read_text()
            changed += code.count("`11434`")
            script.write_text(code.replace("`11434`", f"`{server.server_port}`"))
        assert changed == 1, f"Expected one Ollama endpoint, got {changed}"
        (addon / "probe.js").write_text(PROBE)
        manifest["content_scripts"][0]["js"].append("probe.js")
        (addon / "manifest.json").write_text(json.dumps(manifest))
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        with (args.artifacts / "geckodriver.log").open("w") as log:
            driver = subprocess.Popen([args.geckodriver, "--host", "127.0.0.1", "--port", str(port), "--allow-system-access"],
                                      stdout=log, stderr=log, env={**os.environ, "MOZ_HEADLESS": "1"})
            browser = Browser(f"http://127.0.0.1:{port}")
            try:
                for _ in range(100):
                    try:
                        browser.call("/status", method="GET")
                        break
                    except URLError:
                        time.sleep(0.1)
                session = browser.call("/session", {"capabilities": {"alwaysMatch": {
                    "browserName": "firefox", "moz:firefoxOptions": {
                        "binary": args.firefox, "args": ["-headless"], "env": {"MOZ_HEADLESS": "1"},
                        "prefs": {"extensions.webextensions.uuids": json.dumps({ADDON_ID: UUID}),
                                  "browser.privatebrowsing.autostart": args.private},
                    }}}})
                browser.session = session["sessionId"]
                print("Firefox " + session["capabilities"]["browserVersion"], flush=True)
                browser.call("/window/rect", {"width": 1200, "height": 1100})
                browser.call("/moz/addon/install", {"path": str(addon), "temporary": True,
                                                     "allowPrivateBrowsing": args.private})
                exercise(browser, origin, args.artifacts, args.ollama, args.private)
                print(f"Artifacts: {args.artifacts}", flush=True)
            except Exception:
                if browser.session:
                    try:
                        browser.screenshot(args.artifacts / "failure.png")
                    except Exception:
                        pass
                raise
            finally:
                try:
                    if browser.session:
                        browser.call("", method="DELETE")
                finally:
                    driver.terminate()
                    driver.wait(timeout=10)
                    server.shutdown()


if __name__ == "__main__":
    main()
