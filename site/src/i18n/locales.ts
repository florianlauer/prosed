export const LOCALES = ["en", "fr", "de", "es", "it"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const SITE_URL = "https://prosed.flauercase.dev";

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

// English lives at "/", so "/en" would be a second URL for the same page.
export function localeFromParam(param: string | undefined): Locale | null {
  if (param === undefined) return DEFAULT_LOCALE;
  return param !== DEFAULT_LOCALE && isLocale(param) ? param : null;
}

export const localePath = (locale: Locale) => (locale === DEFAULT_LOCALE ? "/" : `/${locale}`);
