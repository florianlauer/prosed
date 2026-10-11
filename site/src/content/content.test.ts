import { describe, expect, it } from "vite-plus/test";
import { LOCALES } from "../i18n/locales";
import { contentFor } from "./index";

const strings = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "object" && value
      ? Object.values(value).flatMap(strings)
      : [];

describe.each(LOCALES)("content %s", (locale) => {
  const content = contentFor(locale);

  it("keeps exactly one {upstream} slot in the footer credit", () => {
    expect(content.footer.credit.split("{upstream}")).toHaveLength(2);
  });

  it("uses a narrow no-break space before French high punctuation", () => {
    if (locale !== "fr") return;
    for (const text of strings(content)) expect(text).not.toMatch(/[^ ][:;?!](\s|$)/u);
  });
});
