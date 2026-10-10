import type { Locale } from "../i18n/locales";
import { de } from "./de";
import { type Content, en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";

const contents: Record<Locale, Content> = { en, fr, de, es, it };

export const contentFor = (locale: Locale): Content => contents[locale];
export type { Content };
