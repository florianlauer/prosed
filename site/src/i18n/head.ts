import type { Content } from "../content";
import { LOCALES, type Locale, SITE_URL, localePath } from "./locales";

const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  de: "de_DE",
  es: "es_ES",
  it: "it_IT",
};

const absolute = (locale: Locale) => SITE_URL + localePath(locale);

type HeadLink = { rel: string; href: string; hrefLang?: string };

export function localeHead({ locale, content }: { locale: Locale; content: Content }) {
  const url = absolute(locale);
  const links: HeadLink[] = [
    { rel: "canonical", href: url },
    ...LOCALES.map((alternate) => ({
      rel: "alternate",
      hrefLang: alternate,
      href: absolute(alternate),
    })),
    { rel: "alternate", hrefLang: "x-default", href: absolute("en") },
  ];
  return {
    links,
    meta: [
      { title: content.meta.title },
      { name: "description", content: content.meta.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:title", content: content.meta.title },
      { property: "og:description", content: content.meta.description },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { property: "og:locale", content: OG_LOCALES[locale] },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
