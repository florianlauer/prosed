// Run with Electron, then pass the printed pid to the ignored macOS recovery test.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");

app.setPath("userData", process.env.PROSED_TEST_PROFILE);
app.whenReady().then(async () => {
  app.setActivationPolicy("prohibited");
  const window = new BrowserWindow({ show: false });
  await window.loadURL("data:text/html,<div contenteditable>Je suis aller au marché.</div>");
  createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(app.getAccessibilitySupportFeatures()));
  }).listen(1421, "127.0.0.1", () => console.log(`PROSED_TEST_APP_PID=${process.pid}`));
});
