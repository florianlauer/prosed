import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { contentFor } from "../content";
import { Page } from "./Page";

afterEach(() => vi.unstubAllEnvs());

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
