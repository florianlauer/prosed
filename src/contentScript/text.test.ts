import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changeOf,
  diffHunks,
  dictionaryCandidate,
  fitFragment,
  isFragment,
  sentenceAround,
  keepUserText,
  keepVariants,
  languageOf,
  longSentences,
  rejectVariant,
  splitCheckable,
  wholeWords,
} from "./text.ts";

test("keeps dictionary words and still applies other fixes", () => {
  const from = "Sencrop cest top et jai testé";
  const to = "Sencrope c'est top et j'ai testé";
  assert.equal(keepUserText(from, to, ["Sencrop"]), "Sencrop c'est top et j'ai testé");
});

test("dictionary matches whole words with their exact case", () => {
  assert.equal(keepUserText("sencrop va bien", "Sencrop va bien", ["Sencrop"]), "Sencrop va bien");
  assert.equal(keepUserText("Sencropp va bien", "Sencrop va bien", ["Sencrop"]), "Sencrop va bien");
});

test("an insertion inside a dictionary word is refused", () => {
  assert.equal(keepUserText("le repo prosed", "le repo prossed", ["prosed"]), "le repo prosed");
});

test("typographic variants are not suggestions", () => {
  const from = "c’est “super” pour l’équipe";
  const to = "c'est \"super\" pour l'équipe";
  assert.deepEqual(diffHunks(from, keepUserText(from, to)), []);
});

test("dropped blank lines are not suggestions", () => {
  const from = "salut\n\n\nmerci";
  assert.deepEqual(diffHunks(from, keepUserText(from, "salut\nmerci")), []);
});

test("the signature and surrounding blank lines stay out of the check", () => {
  const { before, core, after } = splitCheckable("\n\nsalut jai recu\n\n\n--\nFlorian\n");
  assert.equal(core, "salut jai recu");
  assert.equal(before + core + after, "\n\nsalut jai recu\n\n\n--\nFlorian\n");
});

test("only a single word can be added to the dictionary", () => {
  assert.equal(dictionaryCandidate(" Sencrop, "), "Sencrop");
  assert.equal(dictionaryCandidate("c'est"), "c'est");
  assert.equal(dictionaryCandidate("tu peut"), null);
  assert.equal(dictionaryCandidate(" "), null);
});

test("an ignored change is kept out, everywhere it appears", () => {
  const from = "la review est faite, merci pour la review.";
  const to = "la révision est faite, merci pour la révision.";
  const ignored = [{ from: "review", to: "révision" }];
  assert.equal(keepUserText(from, to, [], ignored), from);
});

test("ignoring a change leaves the other fixes", () => {
  const from = "tu peut faire la review";
  const to = "tu peux faire la révision";
  assert.equal(keepUserText(from, to, [], [{ from: "review", to: "révision" }]), "tu peux faire la review");
});

test("an ignored insertion is tied to the word it follows", () => {
  const from = "merci bonne journée et merci encore";
  const [hunk] = diffHunks(from, "merci, bonne journée et merci encore");
  const change = changeOf(from, hunk);
  assert.deepEqual(change, { from: "merci", to: "merci," });
  // the same word elsewhere is ignored too, a comma after another word is not
  assert.equal(
    keepUserText("merci bonne journée, oui bien", "merci, bonne journée, oui, bien", [], [change]),
    "merci bonne journée, oui, bien",
  );
});

test("tells French from English", () => {
  assert.equal(languageOf("Je pense qu'il faudrait qu'on se voie la semaine prochaine"), "French");
  assert.equal(languageOf("Could you send me the report when you have time?"), "English");
  assert.equal(languageOf("OK"), null);
});

test("a rewrite must keep numbers, links, names and dictionary words", () => {
  const original = "On a déployé la v2.3 sur https://app.sencrop.com hier et depuis Paul voit 10 minutes de retard sur Sencrop";
  const good = "Depuis le déploiement de la v2.3 sur https://app.sencrop.com hier, Paul voit 10 minutes de retard sur Sencrop.";
  assert.equal(rejectVariant(original, good, ["Sencrop"]), null);
  assert.match(rejectVariant(original, good.replace("10", "onze"))!, /10/);
  assert.match(rejectVariant(original, good.replace("https://app.sencrop.com", "le site"))!, /https/);
  assert.match(rejectVariant(original, good.replace("Paul", "il"))!, /Paul/);
  assert.match(rejectVariant(original, good.replace(" sur Sencrop", ""), ["Sencrop"])!, /Sencrop/);
});

test("a small number spelled out is kept", () => {
  const original = "Actually I am working on this project since 2 weeks.";
  assert.equal(rejectVariant(original, "I've been working on this project for two weeks."), null);
  assert.equal(rejectVariant("Paul voit 10 minutes de retard", "Paul voit dix minutes de retard."), null);
  // a whole word only: "sixty" isn't 6
  assert.match(rejectVariant("It took 6 days", "It took sixty days.")!, /6/);
  assert.match(rejectVariant("It took 42 days", "It took forty-two days.")!, /42/);
});

test("a rewrite can't add placeholders or switch language", () => {
  const original = "Thanks for the update, I will look at it tomorrow.";
  assert.equal(rejectVariant(original, "Thanks for the update [optional: brief reason]."), "added brackets or markup");
  assert.equal(rejectVariant(original, "Merci pour la mise à jour, je regarde ça demain."), "switched to French");
  assert.equal(rejectVariant(original, original), "unchanged");
  assert.equal(rejectVariant(original, "Thanks for the update. I'll look at it tomorrow."), null);
});

test("the first word of a sentence isn't taken for a name", () => {
  const original = "merci pour ton retour. Je regarde demain.";
  assert.equal(rejectVariant(original, "Merci pour ton retour, je regarde ça demain."), null);
});

test("keeps the variants that pass, once each", () => {
  assert.deepEqual(keepVariants("tu peux venir à 10h ?", ["Tu peux venir à 10h ?", "Tu peux venir à 10h ? ", "Tu viens à 11h ?"]), [
    "Tu peux venir à 10h ?",
  ]);
});

test("finds sentences over 30 words", () => {
  const long = Array.from({ length: 32 }, (_, i) => `mot${i}`).join(" ") + ".";
  const text = `Une phrase courte. ${long} Une autre, sur la v2.3 de https://example.com.`;
  const ranges = longSentences(text);
  assert.equal(ranges.length, 1);
  assert.equal(text.slice(ranges[0].start, ranges[0].end), long);
  assert.deepEqual(longSentences("Short one.\nAnother short one"), []);
});

test("a selection that cuts a word is widened to the whole word", () => {
  const text = "on se voit la semaine prochaine.";
  // "oit la semaine proch"
  const { start, end } = wholeWords(text, 7, 27);
  assert.equal(text.slice(start, end), "voit la semaine prochaine");
  // starting on the space after "se" doesn't pull "se" in
  const around = wholeWords(text, 5, 10);
  assert.equal(text.slice(around.start, around.end), " voit");
});

test("finds the rest of the sentence around a selection", () => {
  const text = "Merci. Je voulais te demander si tu as le temps avant le 15. Bonne journée";
  const start = text.indexOf("voulais");
  const end = text.indexOf(" avant");
  assert.deepEqual(sentenceAround(text, start, end), { before: "Je ", after: " avant le 15." });
  assert.equal(isFragment(sentenceAround(text, 7, text.indexOf(" Bonne"))), false);
});

test("a rewritten part fits back between the words around it", () => {
  const context = { part: "voulais te demander si jamais tu avais le temps", before: "Merci. Je ", after: " de regarder." };
  assert.equal(fitFragment("je voulais savoir si tu avais le temps", context), "voulais savoir si tu avais le temps");
  assert.equal(fitFragment("Voulais savoir si tu as le temps.", context), "voulais savoir si tu as le temps");
  assert.equal(fitFragment("voulais savoir si tu as le temps de", context), "voulais savoir si tu as le temps");
  // a name from the original keeps its capital
  assert.equal(fitFragment("Paul could try to", { part: "maybe Paul could try to", before: "I think ", after: " ship it." }), "Paul could try to");
});

test("ignoring a deleted word doesn't store the word after it", () => {
  const from = "the the cat sat";
  const [hunk] = diffHunks(from, "the cat sat");
  const change = changeOf(from, hunk);
  assert.equal(change.from.trim(), "the");
  assert.equal(keepUserText("the the dog", "the dog", [], [change]), "the the dog");
});

test("a selection ending inside aujourd'hui or peut-être takes the whole word", () => {
  const text = "c'est bien aujourd'hui, peut-être demain";
  const a = wholeWords(text, 0, text.indexOf("'hui"));
  assert.equal(text.slice(a.start, a.end), "c'est bien aujourd'hui");
  const b = wholeWords(text, text.indexOf("peut"), text.indexOf("-être"));
  assert.equal(text.slice(b.start, b.end), "peut-être");
});

test("a rewrite of a sentence without its stop doesn't add a second one", () => {
  const text = "The cat sat on the mat. Then it left.";
  const part = "The cat sat on the mat";
  const context = sentenceAround(text, 0, part.length);
  assert.equal(fitFragment("The cat was sitting on the mat.", { part, ...context }), "The cat was sitting on the mat");
  assert.equal(
    fitFragment("the cat was on the mat.", { part: "the cat sat on the mat", before: "I think ", after: ", then it left." }),
    "the cat was on the mat",
  );
});

test("words at the start of a sentence, a quote or a bullet aren't names", () => {
  assert.equal(rejectVariant("Hmm… Je ne sais pas trop.", "Hmm… je ne suis pas sûr."), null);
  assert.equal(rejectVariant("- Envoyer le rapport\n- Relancer le client", "- Envoie le rapport\n- Relance le client"), null);
  assert.equal(rejectVariant('He said "no." Then he left.', 'He said "no" and left.'), null);
});
