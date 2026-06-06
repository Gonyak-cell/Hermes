import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildMultiProjectSaasApiResponse,
  buildMultiProjectSaasControlPlane,
  runMultiProjectSaasControlPlane,
  startMultiProjectSaasApiServer,
} from "../src/multi-project-saas-control-plane.mjs";
import { buildWorkOsGoalDrilldownSurface } from "../src/work-os-goal-drilldown-surface.mjs";

const RUN_AT = "2026-06-06T05:20:00.000Z";

async function readySource() {
  return buildWorkOsGoalDrilldownSurface({ runAt: RUN_AT, write: false });
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    workOsGoalDrilldownSurface: await readySource(),
    ...overrides,
  };
}

test("Multi-project SaaS control plane consumes P9400 source", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P9401-P9600");
  assert.equal(result.source_program_range, "P9201-P9400");
  assert.equal(result.summary.multi_project_saas_control_plane_status, "ready_for_multi_project_saas_control_plane");
  assert.equal(result.summary.source_p9400_ready, true);
  assert.equal(result.summary.ready_for_p9601_handoff, true);
});

test("Multi-project SaaS control plane covers all P9401-P9600 phase rows", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());
  const phaseRanges = new Set(result.multi_project_saas_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P9401-P9420", "P9421-P9440", "P9441-P9460", "P9461-P9480", "P9481-P9500", "P9501-P9520", "P9521-P9540", "P9541-P9560", "P9561-P9580", "P9581-P9600"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.multi_project_saas_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Multi-project SaaS registry keeps domain packs scoped below Hermes", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());

  assert.equal(result.saas_project_registry_rows.length >= 5, true);
  assert.equal(result.saas_project_registry_rows.every((row) => row.hermes_product_identity === "general_project_workflow_control_plane"), true);
  assert.equal(result.saas_project_registry_rows.every((row) => row.domain_pack_scope === "project_workflow_context"), true);
  assert.equal(result.saas_project_registry_rows.every((row) => row.domain_pack_is_whole_product === false), true);
  assert.equal(result.saas_project_registry_rows.every((row) => row.cross_project_data_mixed === false), true);
});

test("Multi-project SaaS repo inventory remains metadata-only and non-mutating", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());

  assert.equal(result.saas_repo_inventory_rows.length, result.saas_project_registry_rows.length);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.repo_status === "observed_metadata_only"), true);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.repo_write_enabled === false), true);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.git_stage_enabled === false), true);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.git_commit_enabled === false), true);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.git_push_enabled === false), true);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.merge_enabled === false), true);
  assert.equal(result.saas_repo_inventory_rows.every((row) => row.external_connector_write_enabled === false), true);
});

test("Multi-project SaaS goal risk and review aggregation do not create final authority", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());

  assert.equal(result.current_goal_risk_rows.length >= 5, true);
  assert.equal(result.current_goal_risk_rows.every((row) => row.validation_required === true), true);
  assert.equal(result.current_goal_risk_rows.every((row) => row.production_pass_enabled === false && row.enterprise_pass_enabled === false), true);
  assert.equal(result.validation_review_aggregation_rows.every((row) => row.validation_ready === true), true);
  assert.equal(result.validation_review_aggregation_rows.every((row) => row.review_boundary_ready === true), true);
  assert.equal(result.validation_review_aggregation_rows.every((row) => row.codex_final_approval_allowed === false), true);
  assert.equal(result.validation_review_aggregation_rows.every((row) => row.claude_final_approval_allowed === false), true);
});

test("Multi-project SaaS blocker matrix and operator summary stay read-only", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());

  assert.equal(result.blocker_next_action_rows.every((row) => row.blocker_count === 0), true);
  assert.equal(result.blocker_next_action_rows.every((row) => row.executes_action === false && row.mutates_state === false), true);
  assert.equal(result.operator_control_summary_rows.every((row) => row.read_only === true), true);
  assert.equal(result.operator_control_summary_rows.every((row) => row.claude_review_required_now === false), true);
  assert.equal(result.summary.claude_review_decision, "skipped_no_authority_expansion");
});

test("Multi-project SaaS API routes are GET HEAD only and sanitized", async () => {
  const source = await readySource();

  for (const apiPath of ["/api/saas/projects", "/api/saas/repos", "/api/saas/current-goals", "/api/saas/validation-review", "/api/saas/blockers", "/api/saas/operator-summary", "/api/saas/boundary"]) {
    const response = await buildMultiProjectSaasApiResponse(apiPath, {
      runAt: RUN_AT,
      method: "GET",
      workOsGoalDrilldownSurface: source,
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }

  const postResponse = await buildMultiProjectSaasApiResponse("/api/saas/projects", {
    runAt: RUN_AT,
    method: "POST",
    workOsGoalDrilldownSurface: source,
  });
  assert.equal(postResponse.status, 405);
});

test("Multi-project SaaS browser shell binds APIs without write controls", async () => {
  const source = await readySource();
  const response = await buildMultiProjectSaasApiResponse("/multi-project-control.html", {
    runAt: RUN_AT,
    method: "GET",
    workOsGoalDrilldownSurface: source,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("multi-project-control-root"), true);
  assert.equal(response.body.includes("window.MULTI_PROJECT_SAAS_API_PATHS"), true);
  for (const apiPath of ["/api/saas/projects", "/api/saas/repos", "/api/saas/current-goals", "/api/saas/validation-review", "/api/saas/blockers", "/api/saas/operator-summary", "/api/saas/boundary"]) {
    assert.equal(response.body.includes(apiPath), true);
  }
  assert.equal(response.body.includes("data-protected-action"), false);
  assert.equal(response.body.includes("data-git-write"), false);
  assert.equal(response.body.includes("data-connector-write"), false);
  assert.equal(response.body.includes("method: 'POST'"), false);
});

test("Multi-project SaaS API server serves local artifact-backed routes", async () => {
  const source = await readySource();
  const started = await startMultiProjectSaasApiServer({
    runAt: RUN_AT,
    port: 0,
    workOsGoalDrilldownSurface: source,
  });

  try {
    const projectsResponse = await fetch(`${started.url}/api/saas/projects`);
    assert.equal(projectsResponse.status, 200);
    const projects = await projectsResponse.json();
    assert.equal(projects.collection, "projects");
    assert.equal(projects.count > 0, true);
    assert.equal(hasSensitiveKey(projects), false);

    const htmlResponse = await fetch(`${started.url}/multi-project-control.html`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.equal(html.includes("Hermes Multi-Project SaaS Control"), true);
    assert.equal(html.includes("window.MULTI_PROJECT_SAAS_API_PATHS"), true);
  } finally {
    await new Promise((resolve, reject) => started.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Multi-project SaaS control plane freezes P9600 without authority expansion", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());
  const boundary = result.multi_project_saas_boundary;

  assert.equal(result.p9600_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p9601_handoff, true);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.repo_git_write_enabled, false);
  assert.equal(boundary.raw_transcript_body_visible, false);
  assert.equal(boundary.secret_keys_returned, false);
  assert.equal(boundary.domain_pack_as_product_allowed, false);
  assert.equal(boundary.cross_project_data_mixing_allowed, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.external_connector_write_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Multi-project SaaS negative fixtures block unsafe claims", async () => {
  const result = await buildMultiProjectSaasControlPlane(await buildOptions());
  const fixtureIds = new Set(result.multi_project_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_p9400_source", "negative.domain_pack_product_promotion", "negative.cross_project_data_mix", "negative.repo_git_write", "negative.review_final_approval", "negative.production_enterprise_pass", "negative.connector_write"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.multi_project_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.multi_project_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Multi-project SaaS control plane blocks if P9400 source is not ready", async () => {
  const result = await buildMultiProjectSaasControlPlane({
    runAt: RUN_AT,
    write: false,
    workOsGoalDrilldownSurface: {
      summary: {
        work_os_goal_drilldown_surface_status: "blocked",
        ready_for_p9401_handoff: false,
      },
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p9400_ready, false);
  assert.equal(result.summary.multi_project_saas_control_plane_status, "blocked");
});

test("Multi-project SaaS control plane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "multi-project-saas-control-plane-"));
  const sentinelPath = path.join(outDir, "multi-project-saas-control-plane.json");
  const sentinel = "{ \"sentinel\": \"multi-project-saas-control-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runMultiProjectSaasControlPlane(await buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some((item) => hasSensitiveKey(item));
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => /(^raw_|raw_|full_transcript|full_body|secret)/i.test(key))
    || Object.values(value).some((item) => hasSensitiveKey(item));
}
