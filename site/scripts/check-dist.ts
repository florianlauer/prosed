// Checks the prerendered output before Vercel ships it.
import { existsSync, readFileSync } from "node:fs";
import { LOCALES, localePath } from "../src/i18n/locales.ts";

const out = new URL("../dist/client/", import.meta.url);
const errors: string[] = [];

for (const locale of LOCALES) {
  const path =
    localePath(locale) === "/" ? "index.html" : `${localePath(locale).slice(1)}/index.html`;
  const file = new URL(path, out);
  if (!existsSync(file)) {
    errors.push(`missing ${path}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  if (!html.includes(`<html lang="${locale}"`)) errors.push(`${path}: no <html lang="${locale}">`);
  // Only <link> alternates: the language switcher's <a hreflang> don't count.
  const alternates = html.match(/<link[^>]*hreflang=/gi)?.length ?? 0;
  if (alternates !== LOCALES.length + 1)
    errors.push(`${path}: ${alternates} hreflang links, expected ${LOCALES.length + 1}`);
  if (!html.includes('class="demo-mistake"'))
    errors.push(`${path}: the demo's still frame is missing`);
}
for (const path of ["404.html", "og.png", "sitemap.xml", "robots.txt"]) {
  if (!existsSync(new URL(path, out))) errors.push(`missing ${path}`);
}
if (existsSync(new URL("en/index.html", out)))
  errors.push("en/index.html exists; English lives at /");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`dist ok: ${LOCALES.length} pages, 404, og.png, sitemap, robots`);
