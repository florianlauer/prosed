import { describe, expect, it } from "vite-plus/test";
import { LOCALES, localeFromParam, localePath } from "./locales";

describe("localeFromParam", () => {
  it("maps the root to English", () => {
    expect(localeFromParam(undefined)).toBe("en");
  });

  it("accepts the four prefixed locales", () => {
    for (const locale of ["fr", "de", "es", "it"]) expect(localeFromParam(locale)).toBe(locale);
  });

  it("rejects /en so English has a single URL", () => {
    expect(localeFromParam("en")).toBeNull();
  });

  it("rejects unknown and wrongly cased locales", () => {
    expect(localeFromParam("pt")).toBeNull();
    expect(localeFromParam("FR")).toBeNull();
    expect(localeFromParam("")).toBeNull();
  });
});

describe("localePath", () => {
  it("puts English at the root and the others under a prefix", () => {
    expect(LOCALES.map((locale) => localePath(locale))).toEqual(["/", "/fr", "/de", "/es", "/it"]);
  });
});
