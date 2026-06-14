import assert from "node:assert/strict";
import test from "node:test";
import { LOCALE_STORAGE_KEY, getCopy } from "../src/renderer/i18n.js";
import { sectionForNav, summarizeRows } from "../src/renderer/view-model.js";

test("renderer copy supports Korean default and English operator mode", () => {
  assert.equal(LOCALE_STORAGE_KEY, "hermes.locale");
  assert.equal(getCopy("ko").readOnly, "읽기 전용");
  assert.equal(getCopy("en").readOnly, "Read only");
  assert.equal(getCopy("missing").readOnly, "읽기 전용");
});

test("renderer navigation maps to read-model sections deterministically", () => {
  assert.equal(sectionForNav("release"), "release");
  assert.equal(sectionForNav("factory"), "factory");
  assert.equal(sectionForNav("reviews"), "reviews");
  assert.equal(sectionForNav("artifacts"), "artifacts");
  assert.equal(sectionForNav("settings"), "authority_boundary");
  assert.equal(sectionForNav("unknown"), "release");
});

test("renderer row summaries keep ready and blocked evidence distinct", () => {
  assert.deepEqual(summarizeRows([
    { status: "ready" },
    { status: "blocked" },
    { status: "missing" },
  ]), {
    total: 3,
    ready: 1,
    blocked: 2,
  });
});
