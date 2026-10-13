// Run inside the Tart guest with Electron and an isolated PROSED_TEST_PROFILE.
const {
  app,
  BrowserWindow,
  clipboard,
  ClipboardItem,
  nativeImage,
} = require("electron");
const { createServer } = require("node:http");
const { execFileSync } = require("node:child_process");

if (
  !execFileSync("sysctl", ["-n", "hw.model"], { encoding: "utf8" }).startsWith(
    "VirtualMac",
  )
)
  throw new Error("Run this fixture only in the Tart guest");
if (!process.env.PROSED_TEST_PROFILE)
  throw new Error("PROSED_TEST_PROFILE is required");
app.setPath("userData", process.env.PROSED_TEST_PROFILE);
let window;
const original =
  "Plutot que de refaire un quasi mologue je prefere attendre un peu et discuter avec toi demain pour savoir comment nous allons organiser le travail avec toute l'équipe et les personnes qui participent au projet.";
const corrected = (text) =>
  text
    .replaceAll("Plutot", "Plutôt")
    .replaceAll("mologue", "monologue")
    .replaceAll("prefere", "préfère");
app.whenReady().then(async () => {
  window = new BrowserWindow({
    x: 100,
    y: 100,
    width: 850,
    height: 480,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <style>body{background:#222529;color:#eee;padding:28px;font:18px system-ui}#editor{border:1px solid #555;padding:16px;min-height:240px;white-space:pre-wrap}h1{font-size:18px}</style>
    <h1>Prosed replacement regression</h1><div id="editor" contenteditable="true"></div>
    <script>const editor=document.getElementById('editor');editor.innerText=${JSON.stringify(original)};editor.focus();</script>`)}
  `);
  createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    if (request.method === "POST") {
      const {
        text = original,
        clipboardText = "clipboard sentinel",
        clipboardKind,
        html,
      } = JSON.parse(body);
      if (clipboardKind === "image") {
        const image = nativeImage.createFromBitmap(
          Buffer.from([0, 0, 255, 255]),
          { width: 1, height: 1 },
        );
        await clipboard.write([
          new ClipboardItem({
            "image/png": new Blob([image.toPNG()], { type: "image/png" }),
          }),
        ]);
      } else if (clipboardKind === "html")
        await clipboard.write([
          new ClipboardItem({
            "text/plain": clipboardText,
            "text/html": "<b>clipboard sentinel</b>",
          }),
        ]);
      else if (clipboardText === null) await clipboard.clear();
      else await clipboard.writeText(clipboardText);
      await window.webContents.executeJavaScript(
        `editor.${html ? "innerHTML" : "innerText"}=${JSON.stringify(html || text)};editor.focus();getSelection().selectAllChildren(editor);getSelection().collapseToEnd();`,
      );
      window.show();
      window.focus();
    }
    const state = await window.webContents.executeJavaScript(
      `({text:editor.innerText,html:editor.innerHTML,selection:getSelection().toString()})`,
    );
    const clipboardItems = [];
    for (const item of await clipboard.read()) {
      const data = {};
      for (const type of item.types)
        data[type] = Buffer.from(
          await (await item.getType(type)).arrayBuffer(),
        ).toString("base64");
      clipboardItems.push(data);
    }
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        ...state,
        clipboard: await clipboard.readText(),
        clipboardItems,
        pid: process.pid,
        original,
        corrected: corrected(state.text),
      }),
    );
  }).listen(1421, "127.0.0.1");
  createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body || "{}");
    const text = input.prompt?.split("\n\nText:\n").pop() || "";
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        request.url === "/api/tags"
          ? { models: [{ name: "fixture" }] }
          : {
              response: JSON.stringify(
                input.format?.properties?.formality
                  ? { formality: 3 }
                  : { correctedText: corrected(text) },
              ),
            },
      ),
    );
  }).listen(11434, "127.0.0.1");
});
