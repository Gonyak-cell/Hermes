import assert from "node:assert/strict";
import test from "node:test";
import { LOCALE_STORAGE_KEY, getCopy } from "../src/renderer/i18n.js";
import { rowKey, rowsForNav, sectionForNav, summarizeRows } from "../src/renderer/view-model.js";
import { containsForbiddenDesktopTrustCopy, findForbiddenDesktopTrustCopy } from "../src/shared/shell-state.mjs";

test("renderer copy supports Korean default and English operator mode", () => {
  assert.equal(LOCALE_STORAGE_KEY, "hermes.locale");
  assert.equal(getCopy("ko").readOnly, "읽기 전용");
  assert.equal(getCopy("en").readOnly, "Read only");
  assert.equal(getCopy("missing").readOnly, "읽기 전용");
});

test("renderer navigation maps to read-model sections deterministically", () => {
  assert.equal(sectionForNav("queue"), "__queue__");
  assert.equal(sectionForNav("projects"), "operator_handbook");
  assert.equal(sectionForNav("requirements"), "release");
  assert.equal(sectionForNav("evidence"), "__all__");
  assert.equal(sectionForNav("release"), "release");
  assert.equal(sectionForNav("factory"), "factory");
  assert.equal(sectionForNav("reviews"), "reviews");
  assert.equal(sectionForNav("gates"), "factory");
  assert.equal(sectionForNav("conversations"), "__none__");
  assert.equal(sectionForNav("governance"), "authority_boundary");
  assert.equal(sectionForNav("sources"), "__all__");
  assert.equal(sectionForNav("artifacts"), "__all__");
  assert.equal(sectionForNav("settings"), "authority_boundary");
  assert.equal(sectionForNav("unknown"), "release");
});

test("renderer queue starts with blockers then falls back to active operating rows", () => {
  const readModel = {
    source_rows: [
      { source_id: "release", section_id: "release", status: "ready" },
      { source_id: "factory", section_id: "factory", status: "ready" },
      { source_id: "review", section_id: "reviews", status: "ready" },
      { source_id: "governance", section_id: "authority_boundary", status: "blocked" },
    ],
  };
  assert.deepEqual(rowsForNav("queue", readModel).map((row) => row.source_id), ["governance"]);
  assert.deepEqual(rowsForNav("sources", readModel).map((row) => row.source_id), ["release", "factory", "review", "governance"]);
  assert.deepEqual(rowsForNav("conversations", readModel), []);

  const allReady = { source_rows: readModel.source_rows.map((row) => ({ ...row, status: "ready" })) };
  assert.deepEqual(rowsForNav("queue", allReady).map((row) => row.source_id), ["release", "factory", "review"]);
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

test("renderer row keys are stable for source selection", () => {
  assert.equal(rowKey({ section_id: "release", source_id: "release_packet", source_path: "docs/release.md" }), "release.release_packet");
  assert.equal(rowKey({ section_id: "release", source_path: "docs/release.md" }), "release.docs/release.md");
});

test("desktop trust copy policy catches approval and production overclaims", () => {
  assert.equal(containsForbiddenDesktopTrustCopy("Independent review is not pursued."), false);
  assert.equal(containsForbiddenDesktopTrustCopy("Deploy authority is not authorized."), false);
  assert.deepEqual(findForbiddenDesktopTrustCopy("This screen claims production PASS and GitHub independent approval."), [
    "production PASS",
    "GitHub independent approval",
  ]);
});
