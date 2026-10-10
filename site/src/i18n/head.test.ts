import { describe, expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { localeHead } from "./head";

describe("localeHead", () => {
  it("points the canonical at the page's own URL", () => {
    const { links } = localeHead({ locale: "fr", content: contentFor("fr") });
    expect(links.find((link) => link.rel === "canonical")?.href).toBe(
      "https://prosed.flauercase.dev/fr",
    );
  });

  it("lists five alternates and an x-default on the root", () => {
    const { links } = localeHead({ locale: "de", content: contentFor("de") });
    const alternates = links.filter((link) => link.rel === "alternate");
    expect(alternates.map((link) => link.hrefLang)).toEqual([
      "en",
      "fr",
      "de",
      "es",
      "it",
      "x-default",
    ]);
    expect(alternates.at(-1)?.href).toBe("https://prosed.flauercase.dev/");
  });

  it("uses the translated title", () => {
    const { meta } = localeHead({ locale: "es", content: contentFor("es") });
    expect(meta[0]).toEqual({ title: contentFor("es").meta.title });
  });
});
