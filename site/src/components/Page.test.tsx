import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { contentFor } from "../content";
import type { Target } from "../download";
import * as Download from "./Download";
import { Page } from "./Page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Homebrew availability", () => {
  for (const target of ["macos", "windows", "extension"] satisfies Target[]) {
    it(`shows Homebrew instructions only on macOS when the target is ${target}`, () => {
      vi.spyOn(Download, "useTarget").mockReturnValue(target);
      const html = renderToString(<Page locale="fr" content={contentFor("fr")} />);
      expect(html.includes('class="homebrew"')).toBe(target === "macos");
      expect(html.includes('class="homebrew-label"')).toBe(target === "macos");
    });
  }
});

describe("site deployment paths", () => {
  for (const base of ["/", "/prosed/"]) {
    it(`keeps navigation and brand assets under ${base}`, () => {
      vi.stubEnv("BASE_URL", base);
      const html = renderToString(<Page locale="fr" content={contentFor("fr")} />);
      expect(html).toContain(`href="${base}fr"`);
      expect(html).toContain(`href="${base}"`);
      expect(html).toContain(`src="${base}brand/prosed.svg"`);
      const localUrls = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
      expect(localUrls.length).toBeGreaterThan(5);
      expect(localUrls.every((url) => url.startsWith(base))).toBe(true);
    });
  }
});
