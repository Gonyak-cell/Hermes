import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { buildFactoryStarterArtifactCorpus } from "../src/factory-starter-artifact-corpus.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

test("Factory Starter Artifact Corpus validates tracked starter templates as materialized", async () => {
  const result = await buildFactoryStarterArtifactCorpus({ runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_starter_artifact_corpus_status, "ready_factory_starter_artifact_corpus");
  assert.equal(result.summary.starter_artifact_corpus_materialized_now, true);
  assert.equal(result.summary.missing_artifact_count, 0);
  assert.equal(result.summary.materialized_artifact_count, result.summary.starter_artifact_count);
  assert.equal(result.starter_artifact_rows.length >= 19, true);
  assert.equal(result.starter_artifact_rows.every((row) => row.exists_now === true), true);
  assert.equal(result.starter_artifact_rows.every((row) => /^[a-f0-9]{64}$/.test(row.content_sha256)), true);
  assert.equal(result.starter_artifact_rows.every((row) => row.source_file_write_allowed_now === false), true);
  assert.equal(result.summary.apply_allowed_now, false);
});

test("Factory Starter Artifact Corpus blocks missing template roots", async () => {
  const templateRoot = await mkdtemp(path.join(os.tmpdir(), "factory-empty-templates-"));
  try {
    const result = await buildFactoryStarterArtifactCorpus({
      templateRoot,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_starter_artifact_corpus_status, "blocked_factory_starter_artifact_corpus");
    assert.equal(result.summary.starter_artifact_corpus_materialized_now, false);
    assert.equal(result.summary.missing_artifact_count > 0, true);
    assert.equal(result.validation.errors.some((item) => item.item_id === "artifacts.materialized"), true);
  } finally {
    await rm(templateRoot, { recursive: true, force: true });
  }
});

test("Factory Starter Artifact Corpus rejects unsafe template paths", async () => {
  await withTempPackAndTemplateRoots(async ({ packRoot, templateRoot }) => {
    await writePackManifest(packRoot, "unsafe-pack", ["templates/../outside.md"]);

    const result = await buildFactoryStarterArtifactCorpus({
      packRoot,
      templateRoot,
      runAt: RUN_AT,
    });
    const unsafeRow = result.starter_artifact_rows.find((row) => row.artifact_path === "templates/../outside.md");

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_starter_artifact_corpus_status, "blocked_factory_starter_artifact_corpus");
    assert.equal(unsafeRow.materialized_status, "blocked_unsafe_path");
    assert.equal(unsafeRow.path_within_template_root, false);
    assert.equal(result.validation.errors.some((item) => item.item_id === "paths.safe"), true);
  });
});

test("Factory Starter Artifact Corpus rejects starter templates with sensitive markers", async () => {
  await withTempPackAndTemplateRoots(async ({ packRoot, templateRoot }) => {
    await writePackManifest(packRoot, "secret-pack", ["templates/custom/secret.md"]);
    await mkdir(path.join(templateRoot, "custom"), { recursive: true });
    await writeFile(path.join(templateRoot, "custom", "secret.md"), "BEGIN PRIVATE KEY\nredacted\n", "utf8");

    const result = await buildFactoryStarterArtifactCorpus({
      packRoot,
      templateRoot,
      runAt: RUN_AT,
    });
    const secretRow = result.starter_artifact_rows.find((row) => row.artifact_path === "templates/custom/secret.md");

    assert.equal(result.validation.valid, false);
    assert.equal(secretRow.materialized_status, "blocked_sensitive_marker");
    assert.equal(secretRow.sensitive_marker_detected, true);
    assert.equal(result.validation.errors.some((item) => item.item_id === "artifacts.no_sensitive_markers"), true);
  });
});

test("Factory Starter Artifact Corpus rejects malformed JSON starter templates", async () => {
  await withTempPackAndTemplateRoots(async ({ packRoot, templateRoot }) => {
    await writePackManifest(packRoot, "json-pack", ["templates/custom/bad.json"]);
    await mkdir(path.join(templateRoot, "custom"), { recursive: true });
    await writeFile(path.join(templateRoot, "custom", "bad.json"), "{ not valid json", "utf8");

    const result = await buildFactoryStarterArtifactCorpus({
      packRoot,
      templateRoot,
      runAt: RUN_AT,
    });
    const badJsonRow = result.starter_artifact_rows.find((row) => row.artifact_path === "templates/custom/bad.json");

    assert.equal(result.validation.valid, false);
    assert.equal(badJsonRow.materialized_status, "blocked_invalid_json");
    assert.equal(badJsonRow.json_parse_valid, false);
    assert.equal(result.validation.errors.some((item) => item.item_id === "artifacts.json_valid"), true);
  });
});

test("Review API exposes starter artifact corpus rows as read-only data", async () => {
  const response = await buildReviewApiResponse("/api/factory/starter-artifacts?domain_pack_id=pack.law_firm", {
    runAt: RUN_AT,
  });
  const body = parseJsonResponse(response);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_starter_artifact_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.raw_confidential_material_visible, false);
  assert.equal(body.starter_artifact_corpus_materialized_now, true);
  assert.equal(body.count >= 4, true);
  assert.equal(body.items.every((row) => row.domain_pack_id === "pack.law_firm"), true);
  assert.equal(body.items.every((row) => row.materialized_status === "materialized_read_only"), true);
  assert.equal(body.items.some((row) => Object.hasOwn(row, "resolved_path")), false);
  assert.equal(body.items.every((row) => row.resolved_path_visible === false), true);
});

test("Review API supports HEAD for starter artifacts without a response body", async () => {
  const response = await buildReviewApiResponse("/api/factory/starter-artifacts?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body, "");
});

test("Review API rejects mutating starter artifact requests", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/starter-artifacts", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});

async function withTempPackAndTemplateRoots(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "factory-starter-corpus-"));
  const packRoot = path.join(root, "packs");
  const templateRoot = path.join(root, "templates");
  try {
    await mkdir(packRoot, { recursive: true });
    await cp(path.resolve("templates"), templateRoot, { recursive: true });
    return await fn({ packRoot, templateRoot });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writePackManifest(packRoot, packId, templates) {
  const packDir = path.join(packRoot, packId);
  await mkdir(packDir, { recursive: true });
  await writeFile(path.join(packDir, "pack.json"), `${JSON.stringify({
    schema_version: "domain-pack-manifest.v1",
    pack_id: packId,
    templates,
  }, null, 2)}\n`, "utf8");
}
