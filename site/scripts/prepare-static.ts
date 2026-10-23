import { readFileSync, writeFileSync } from "node:fs";

const base = process.env.SITE_BASE_PATH || "/";
const out = new URL("../dist/client/", import.meta.url);
// Public HTML is copied verbatim by Vite, so its 404 links need the deployment prefix too.
const notFound = readFileSync(new URL("../public/404.html", import.meta.url), "utf8");
writeFileSync(new URL("404.html", out), notFound.replaceAll('"/', `"${base}`));
writeFileSync(new URL(".nojekyll", out), "");
