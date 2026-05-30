import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const repoRoot = path.resolve(".");

test("release gate --check commands do not overwrite artifact outputs on failure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-release-gate-cli-"));
  try {
    const fixtureDir = path.join(root, "fixtures");
    const contractOutDir = path.join(root, "contract-validation-suite");
    const freezeOutDir = path.join(root, "v1-freeze");
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(contractOutDir, { recursive: true });
    await mkdir(freezeOutDir, { recursive: true });

    const sentinelContract = '{ "sentinel": "contract-validation-suite" }\n';
    const sentinelFreeze = '{ "sentinel": "v1-freeze" }\n';
    await writeFile(path.join(contractOutDir, "contract-validation-suite.json"), sentinelContract, "utf8");
    await writeFile(path.join(freezeOutDir, "v1-freeze.json"), sentinelFreeze, "utf8");

    const artifactPath = path.join(fixtureDir, "artifact.json");
    const schemaPath = path.join(fixtureDir, "artifact.schema.json");
    await writeFile(artifactPath, '{ "schema_version": "fixture.v1", "value": "actual" }\n', "utf8");
    await writeFile(schemaPath, '{ "type": "object", "additionalProperties": true }\n', "utf8");
    const goldenPath = path.join(fixtureDir, "contract-golden-fixtures.json");
    await writeFile(goldenPath, `${JSON.stringify({
      schema_version: "contract-golden-fixtures.v1",
      generated_at: "2026-05-30T00:00:00.000Z",
      golden_fixture_set_id: "contract-golden-fixtures.cli-no-write",
      golden_fixtures: [
        {
          golden_fixture_id: "golden-fixture.cli_no_write",
          fixture_id: "cli_no_write",
          artifact_id: "cli_no_write",
          fixture_scope: "test",
          owner_area: "test",
          artifact_path: artifactPath,
          schema_path: schemaPath,
          artifact_schema_version: "fixture.v1",
          fixture_status: "locked",
          schema_validation_status: "passed",
          regression_status: "locked",
          content_hash: "sha256:expected-mismatch",
          schema_hash: "sha256:expected-mismatch",
        },
      ],
      summary: {
        golden_fixture_status: "complete",
        fixture_count: 1,
        locked_regression_hash_count: 1,
      },
      validation: { valid: true, errors: [] },
    }, null, 2)}\n`, "utf8");

    const contractCheck = spawnSync("node", [
      "scripts/contract-validation-suite.mjs",
      "--check",
      "--contract-golden-fixtures",
      goldenPath,
      "--out-dir",
      contractOutDir,
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.notEqual(contractCheck.status, 0, contractCheck.stdout + contractCheck.stderr);
    assert.equal(await readFile(path.join(contractOutDir, "contract-validation-suite.json"), "utf8"), sentinelContract);

    const missingSourcePath = path.join(fixtureDir, "missing-source.json");
    const freezeCheck = spawnSync("node", [
      "scripts/v1-freeze.mjs",
      "--check",
      "--release-candidate-report-path",
      missingSourcePath,
      "--dashboard-path",
      missingSourcePath,
      "--dashboard-api-freeze-path",
      missingSourcePath,
      "--contract-golden-fixtures-path",
      missingSourcePath,
      "--contract-validation-suite-path",
      path.join(contractOutDir, "contract-validation-suite.json"),
      "--control-plane-goal-checkpoint-path",
      missingSourcePath,
      "--control-plane-loop-path",
      missingSourcePath,
      "--operator-handbook-path",
      missingSourcePath,
      "--out-dir",
      freezeOutDir,
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.notEqual(freezeCheck.status, 0, freezeCheck.stdout + freezeCheck.stderr);
    assert.equal(await readFile(path.join(freezeOutDir, "v1-freeze.json"), "utf8"), sentinelFreeze);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
