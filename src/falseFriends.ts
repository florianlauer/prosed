// English words that native speakers of another language often use in that language's sense.
// A curated list, because gemma4 asked to find them missed "eventually" and "assisted to",
// and returned pairs like "actually" → "actually". Only French for now.
// ponytail: one language; add a list per language when someone needs it.

import { en } from "./i18n/catalogs.ts";
import { formatMessage } from "./i18n/index.ts";

type FalseFriend = { pattern: RegExp; note: (word: string) => string };

const french: FalseFriend[] = [
  {
    pattern: /\bactually\b/i,
    note: () => en.noteActually,
  },
  {
    pattern: /\beventually\b/i,
    note: () => en.noteEventually,
  },
  {
    pattern: /\bassist(?:s|ed|ing)? (?:to|at)\b/i,
    note: () => en.noteAssist,
  },
  {
    pattern: /\bprecise (?:the|me|it|your|my|our|this|that|if|whether|when)\b/i,
    note: () => en.notePrecise,
  },
  {
    // on its own, not "the planning phase"
    pattern:
      /\b(?:the|a|my|your|his|her|their|our|this) planning\b(?!\s+(?:phase|stage|process|meeting|session|team|tools?|permission|application|committee|department|period|board|cycle)\b)/i,
    note: () => en.notePlanning,
  },
  {
    pattern: /\bsympat?h?ic\b/i,
    note: () => en.noteSympathic,
  },
  {
    pattern: /\bdiscuss(?:ed|es|ing)? about\b/i,
    note: () => en.noteDiscuss,
  },
  {
    // not "since 2 weeks ago", which is right
    pattern:
      /\bsince (?:\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|a few|several) (?:minutes?|hours?|days?|weeks?|months?|years?)\b(?!\s+ago)/i,
    note: () => en.noteSince,
  },
  {
    pattern: /\b(?:a|the|this|my|our) formation\b/i,
    note: () => en.noteFormation,
  },
  {
    pattern: /\bdeceptions?\b/i,
    note: () => en.noteDeception,
  },
  {
    pattern: /\bprevent(?:s|ed|ing)? (?:you|him|her|them|me|us)\b(?!\s+from)/i,
    note: () => en.notePrevent,
  },
  {
    pattern: /\bdemand(?:s|ed|ing)? (?:you|him|her|them|if|whether)\b/i,
    note: () => en.noteDemand,
  },
  {
    pattern: /\b(?:the|an) occasion to\b/i,
    note: () => en.noteOccasion,
  },
  {
    pattern: /\b(?:my|your|his|her|their|our) coordinates\b/i,
    note: () => en.noteCoordinates,
  },
  {
    pattern: /\b(?:informations|advices|feedbacks)\b/gi,
    note: (word) => formatMessage(en.notePlural, { word, singular: word.slice(0, -1) }),
  },
  {
    pattern: /\bsensible\b/i,
    note: () => en.noteSensible,
  },
  {
    pattern: /\bpass(?:ed|ing)? (?:an?|the|my|your) (?:exam|test)\b/i,
    note: () => en.noteExam,
  },
  {
    pattern: /\bI(?:['’]m| am) agree\b/i,
    note: () => en.noteAgree,
  },
];

const lists = [{ language: "French", entries: french }];

// The false friends in an English text, and the language they give away. The text is the only
// clue to the writer's language: a French speaker may well run their browser in English.
export const findFalseFriends = (text: string) => {
  for (const { language, entries } of lists) {
    const notes = [
      // a /g pattern returns every match, so "informations and advices" gets a note each
      ...new Set(entries.flatMap(({ pattern, note }) => (text.match(pattern) ?? []).map(note))),
    ];
    if (notes.length) {
      return { language, notes };
    }
  }
  return { language: null, notes: [] };
};
