import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AUTHORITY_FLAGS,
  PROTECTED_COMMAND_FIXTURES,
  buildAgentBridgeManifest,
  classifyProtectedCommand,
  parseAgentBridgeManifestArgs,
  runAgentBridgeManifest,
  validateAgentBridgeManifestResult,
} from "../src/agent-bridge-manifest.mjs";

const RUN_AT = "2026-06-16T03:00:00.000Z";

test("Agent Bridge manifest records runtimes, capabilities, permissions, and closed authority", async () => {
  const result = await buildAgentBridgeManifest({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-manifest.v1");
  assert.equal(result.capability_id, "platform.agent_bridge_manifest");
  assert.equal(result.summary.agent_bridge_manifest_status, "ready_for_agent_bridge_manifest");
  assert.equal(result.runtime_identity_rows.length >= 4, true);
  assert.equal(result.capability_inventory_rows.length >= 4, true);
  assert.equal(result.permission_matrix_rows.length, result.capability_inventory_rows.length);
  assert.equal(result.agent_bridge_boundary.ready_for_agent_bridge_manifest_projection, true);
  assert.equal(result.agent_bridge_contract.source_of_truth, false);
  assert.equal(result.agent_bridge_contract.model_label_is_proof, false);
  assert.equal(result.agent_bridge_contract.installed_implies_executable, false);
  assert.equal(result.agent_bridge_contract.receipt_imported_implies_applied, false);
  assert.equal(result.permission_matrix_rows.every((row) => row.requestable === false), true);
  assert.equal(result.permission_matrix_rows.every((row) => row.executable === false), true);
  assert.equal(result.permission_matrix_rows.every((row) => row.opens_authority === false), true);
  assert.equal(AUTHORITY_FLAGS.every((flag) => result.agent_bridge_boundary[flag] === false), true);
  assert.equal(AUTHORITY_FLAGS.every((flag) => result.summary[flag] === false), true);
});

test("Agent Bridge manifest --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-manifest-"));
  const sentinelPath = path.join(outDir, "agent-bridge-manifest.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-manifest\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeManifest({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Agent Bridge manifest blocks protected command canonicalization fixtures", async () => {
  const result = await buildAgentBridgeManifest({ runAt: RUN_AT, write: false });

  assert.equal(result.command_canonicalization_fixture_rows.length, PROTECTED_COMMAND_FIXTURES.length);
  for (const [command, expectedType] of PROTECTED_COMMAND_FIXTURES) {
    const classified = classifyProtectedCommand(command);
    assert.equal(classified.blocked, true);
    assert.equal(classified.protected_action_type, expectedType);
  }
  assert.equal(result.command_canonicalization_fixture_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Agent Bridge manifest treats provider output and model labels as non-authoritative", async () => {
  const result = await buildAgentBridgeManifest({ runAt: RUN_AT, write: false });
  const providerRows = result.provenance_source_rows.filter((row) => [
    "runtime.self_report",
    "external.provider_output",
  ].includes(row.source_id));

  assert.equal(providerRows.length, 2);
  assert.equal(providerRows.every((row) => row.opens_authority === false), true);
  assert.equal(providerRows.every((row) => row.authority_effect === "none"), true);
  assert.equal(result.runtime_identity_rows.every((row) => row.model_proof_trusted === false), true);
});

test("Agent Bridge manifest validation fails if a protected authority flag is opened", async () => {
  const result = await buildAgentBridgeManifest({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-manifest.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_bridge_boundary.command_execution_allowed_now = true;
  tampered.summary.command_execution_allowed_now = true;

  const validation = validateAgentBridgeManifestResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "boundary.no_authority"), true);
});

test("Agent Bridge manifest validation fails if installed is promoted to executable", async () => {
  const result = await buildAgentBridgeManifest({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-manifest.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_bridge_contract.installed_implies_executable = true;

  const validation = validateAgentBridgeManifestResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "contract.state_lattice"), true);
});

test("Agent Bridge manifest CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeManifestArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseAgentBridgeManifestArgs(["--allow-execution"]), /Unknown argument: --allow-execution/);
  assert.throws(() => parseAgentBridgeManifestArgs(["--out-dir"]), /Missing value for --out-dir/);
});
