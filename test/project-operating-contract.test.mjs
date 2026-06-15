import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BLOCKER_TYPES,
  FORBIDDEN_ACTION_TYPES,
  SAFE_ACTION_TYPES,
  buildProjectOperatingContract,
  parseProjectOperatingContractArgs,
  runProjectOperatingContract,
} from "../src/project-operating-contract.mjs";
import { buildMultiProjectSaasControlPlane } from "../src/multi-project-saas-control-plane.mjs";
import { buildWorkOsGoalDrilldownSurface } from "../src/work-os-goal-drilldown-surface.mjs";

const RUN_AT = "2026-06-06T05:40:00.000Z";

async function readyMultiProjectSource() {
  const workOs = await buildWorkOsGoalDrilldownSurface({ runAt: RUN_AT, write: false });
  return buildMultiProjectSaasControlPlane({
    runAt: RUN_AT,
    write: false,
    workOsGoalDrilldownSurface: workOs,
  });
}

test("Project operating contract projects multi-project state into a local-only read-only contract", async () => {
  const source = await readyMultiProjectSource();
  const result = await buildProjectOperatingContract({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: source,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "project-operating-contract.v1");
  assert.equal(result.capability_id, "platform.project_operating_contract");
  assert.equal(result.summary.project_operating_contract_status, "ready_for_project_operating_contract");
  assert.equal(result.summary.project_count >= 5, true);
  assert.equal(result.summary.ready_project_count, result.summary.project_count);
  assert.equal(result.summary.blocked_project_count, 0);
  assert.equal(result.summary.stale_project_count, 0);
  assert.equal(result.project_identity_rows.length, result.project_state_rows.length);
  assert.equal(result.project_source_inventory_rows.every((row) => row.source_artifact_sha256?.startsWith("sha256:")), true);
  assert.equal(result.project_blocker_taxonomy_rows.length, BLOCKER_TYPES.length);
  assert.equal(result.project_next_action_taxonomy_rows.length, SAFE_ACTION_TYPES.length + FORBIDDEN_ACTION_TYPES.length);
  assert.equal(result.project_authority_boundary_rows.every((row) => row.unsafe_flag_count === 0), true);
  assert.equal(result.project_operating_boundary.ready_for_desktop_multi_project_projection, true);
  assert.equal(result.project_operating_boundary.git_write_allowed_now, false);
  assert.equal(result.project_operating_boundary.deploy_allowed_now, false);
  assert.equal(result.project_operating_boundary.production_pass_enabled, false);
  assert.equal(result.project_operating_boundary.enterprise_pass_enabled, false);
});

test("Project operating contract --check validates without overwriting artifacts", async () => {
  const source = await readyMultiProjectSource();
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-project-operating-contract-"));
  const sentinelPath = path.join(outDir, "project-operating-contract.json");
  const sentinel = "{ \"sentinel\": \"project-operating-contract\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runProjectOperatingContract({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
      multiProjectSaasControlPlane: source,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Project operating contract fails closed when the source projection is stale", async () => {
  const source = await readyMultiProjectSource();
  const staleSource = withGeneratedAt(source, "2026-06-01T00:00:00.000Z");
  const result = await buildProjectOperatingContract({
    runAt: "2026-06-20T00:00:00.000Z",
    write: false,
    multiProjectSaasControlPlane: staleSource,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.project_operating_contract_status, "blocked_project_operating_contract");
  assert.equal(result.summary.stale_project_count, result.summary.project_count);
  assert.equal(result.project_state_rows.every((row) => row.project_state === "stale"), true);
  assert.equal(result.project_state_rows.every((row) => row.ready_read_only === false), true);
  assert.equal(result.validation.errors.some((error) => error.path === "freshness.not_stale"), true);
});

test("Project operating contract does not mark low-confidence progress ready", async () => {
  const source = await readyMultiProjectSource();
  source.saas_project_registry_rows[0].progress_confidence = "low";
  const projectId = source.saas_project_registry_rows[0].project_id;
  const result = await buildProjectOperatingContract({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: source,
  });
  const state = result.project_state_rows.find((row) => row.project_id === projectId);

  assert.equal(result.validation.valid, true);
  assert.equal(state.project_state, "review_needed");
  assert.equal(state.ready_read_only, false);
  assert.equal(state.state_reason, "low_progress_confidence");
  assert.equal(result.summary.review_needed_project_count, 1);
});

test("Project operating contract blocks duplicate project ids", async () => {
  const source = await readyMultiProjectSource();
  source.saas_project_registry_rows[1].project_id = source.saas_project_registry_rows[0].project_id;
  const result = await buildProjectOperatingContract({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: source,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.validation.errors.some((error) => error.path === "project.identity.unique"), true);
});

test("Project operating contract blocks upstream repo write authority", async () => {
  const source = await readyMultiProjectSource();
  const projectId = source.saas_repo_inventory_rows[0].project_id;
  source.saas_repo_inventory_rows[0].repo_write_enabled = true;
  source.saas_repo_inventory_rows[0].git_push_enabled = true;
  const result = await buildProjectOperatingContract({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: source,
  });
  const authority = result.project_authority_boundary_rows.find((row) => row.project_id === projectId);
  const state = result.project_state_rows.find((row) => row.project_id === projectId);

  assert.equal(result.validation.valid, false);
  assert.equal(authority.unsafe_flag_count, 2);
  assert.equal(authority.current_verdict, "blocked");
  assert.equal(state.project_state, "blocked");
  assert.equal(state.blocker_type, "protected_action_required");
  assert.equal(result.project_operating_boundary.ready_for_desktop_multi_project_projection, false);
});

test("Project operating contract forbidden actions stay closed", async () => {
  const source = await readyMultiProjectSource();
  const result = await buildProjectOperatingContract({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: source,
  });
  const forbiddenRows = result.project_next_action_taxonomy_rows.filter((row) => row.action_class === "forbidden_protected_action");
  const forbiddenIds = new Set(forbiddenRows.map((row) => row.action_type));

  for (const actionType of FORBIDDEN_ACTION_TYPES) {
    assert.equal(forbiddenIds.has(actionType), true);
  }
  assert.equal(forbiddenRows.every((row) => row.allowed === false), true);
  assert.equal(forbiddenRows.every((row) => row.opens_authority === true), true);
});

test("Project operating contract CLI parser accepts only known flags", () => {
  assert.deepEqual(parseProjectOperatingContractArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseProjectOperatingContractArgs(["--allowlist", "docs/example.md"]), /Unknown argument: --allowlist/);
  assert.throws(() => parseProjectOperatingContractArgs(["--schema-path"]), /Missing value for --schema-path/);
});

function withGeneratedAt(source, generatedAt) {
  const cloned = JSON.parse(JSON.stringify(source));
  cloned.generated_at = generatedAt;
  for (const key of [
    "saas_project_registry_rows",
    "saas_repo_inventory_rows",
    "current_goal_risk_rows",
    "validation_review_aggregation_rows",
    "blocker_next_action_rows",
    "operator_control_summary_rows",
  ]) {
    for (const row of cloned[key] ?? []) row.generated_at = generatedAt;
  }
  return cloned;
}
