import assert from "node:assert/strict";
import { test } from "node:test";
import { siteHostname } from "./site.ts";

test("regular frames use their own site instead of their embedder", () => {
  assert.equal(siteHostname({ href: "https://editor.example/input", ancestorOrigins: ["https://mail.google.com"], referrer: "https://mail.google.com/" }), "editor.example");
});

test("blank editors inherit the closest ancestor site", () => {
  assert.equal(siteHostname({ href: "about:blank", ancestorOrigins: ["https://mail.google.com", "https://outer.example"], referrer: "" }), "mail.google.com");
});

test("nested blank frames skip opaque ancestors", () => {
  assert.equal(siteHostname({ href: "about:srcdoc#editor", ancestorOrigins: ["null", "https://mail.google.com"], referrer: "" }), "mail.google.com");
});

test("blank editors fall back to the referrer when ancestor origins are absent", () => {
  assert.equal(siteHostname({ href: "about:blank?editor", ancestorOrigins: [], referrer: "https://mail.google.com/mail/" }), "mail.google.com");
});

test("unknown origins do not inherit a referrer outside blank frames", () => {
  assert.equal(siteHostname({ href: "data:text/html,test", ancestorOrigins: ["https://mail.google.com"], referrer: "https://mail.google.com/" }), "");
  assert.equal(siteHostname({ href: "about:blank", ancestorOrigins: ["null"], referrer: "invalid" }), "");
});
