import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildWorkOsGoalDrilldownApiResponse,
  buildWorkOsGoalDrilldownSurface,
  runWorkOsGoalDrilldownSurface,
  startWorkOsGoalDrilldownApiServer,
} from "../src/work-os-goal-drilldown-surface.mjs";
import { buildWorkOsGoalExecutionView } from "../src/work-os-goal-execution-view.mjs";

const RUN_AT = "2026-06-06T04:10:00.000Z";

async function readySource() {
  return buildWorkOsGoalExecutionView({ runAt: RUN_AT, write: false });
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    workOsGoalExecutionView: await readySource(),
    ...overrides,
  };
}

test("Work OS goal drilldown surface consumes P9200 source", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P9201-P9400");
  assert.equal(result.source_program_range, "P9001-P9200");
  assert.equal(result.summary.work_os_goal_drilldown_surface_status, "ready_for_work_os_goal_drilldown_surface");
  assert.equal(result.summary.source_p9200_ready, true);
  assert.equal(result.summary.ready_for_p9401_handoff, true);
});

test("Work OS goal drilldown surface covers all P9201-P9400 phase rows", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());
  const phaseRanges = new Set(result.work_os_goal_drilldown_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P9201-P9220", "P9221-P9240", "P9241-P9260", "P9261-P9280", "P9281-P9300", "P9301-P9320", "P9321-P9340", "P9341-P9360", "P9361-P9380", "P9381-P9400"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.work_os_goal_drilldown_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Work OS drilldown routes are GET HEAD only and reject mutation", async () => {
  const source = await readySource();
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions({ workOsGoalExecutionView: source }));
  const paths = new Set(result.drilldown_api_route_rows.map((row) => row.api_path));

  for (const apiPath of ["/health", "/api/work-os/goals", "/api/work-os/goal-detail", "/api/work-os/project-drilldown", "/api/work-os/next-actions", "/api/work-os/commits", "/api/work-os/session-handoffs", "/api/work-os/combined-status", "/api/work-os/drilldown-boundary"]) {
    assert.equal(paths.has(apiPath), true);
  }
  assert.equal(result.drilldown_api_route_rows.every((row) => row.method_allowlist.includes("GET") && row.method_allowlist.includes("HEAD")), true);
  assert.equal(result.drilldown_api_route_rows.every((row) => row.write_methods_enabled === false && row.mutates_state === false), true);

  const postResponse = await buildWorkOsGoalDrilldownApiResponse("/api/work-os/goals", {
    runAt: RUN_AT,
    method: "POST",
    workOsGoalExecutionView: source,
  });
  assert.equal(postResponse.status, 405);
});

test("Work OS drilldown API response bodies are sanitized view models", async () => {
  const source = await readySource();

  for (const apiPath of ["/api/work-os/goals", "/api/work-os/goal-detail", "/api/work-os/project-drilldown", "/api/work-os/next-actions", "/api/work-os/commits", "/api/work-os/session-handoffs", "/api/work-os/combined-status", "/api/work-os/drilldown-boundary"]) {
    const response = await buildWorkOsGoalDrilldownApiResponse(apiPath, {
      runAt: RUN_AT,
      method: "GET",
      workOsGoalExecutionView: source,
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }
});

test("Work OS project and goal drilldown models preserve scope and refs", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());

  assert.equal(result.project_drilldown_rows.length >= 5, true);
  assert.equal(result.project_drilldown_rows.every((row) => row.hermes_product_identity === "general_project_workflow_control_plane"), true);
  assert.equal(result.project_drilldown_rows.every((row) => row.domain_pack_scope === "project_workflow_context"), true);
  assert.equal(result.project_drilldown_rows.every((row) => row.domain_pack_is_whole_product === false), true);
  assert.equal(result.goal_detail_rows.length, result.goal_api_projection_rows.length);
  assert.equal(result.goal_detail_rows.every((row) => row.claim_ref && row.evidence_ref && row.gate_ref && row.check_ref && row.review_receipt_ref), true);
});

test("Work OS next action commit and session APIs stay non-mutating and redacted", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());

  assert.equal(result.next_action_api_projection_rows.every((row) => row.protected_action === false && row.mutates_state === false), true);
  assert.equal(result.commit_checkpoint_api_projection_rows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false), true);
  assert.equal(result.commit_checkpoint_api_projection_rows.every((row) => row.push_enabled === false && row.merge_enabled === false), true);
  assert.equal(result.session_handoff_api_projection_rows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false), true);
  assert.equal(result.session_handoff_api_projection_rows.every((row) => row.source_cited === true && row.mutates_plan_state === false), true);
});

test("Work OS combined status does not create production or enterprise PASS", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());

  assert.equal(result.combined_status_rows.length >= 5, true);
  assert.equal(result.combined_status_rows.every((row) => row.validation_ready === true), true);
  assert.equal(result.combined_status_rows.every((row) => row.review_boundary_ready === true), true);
  assert.equal(result.combined_status_rows.every((row) => row.production_pass_enabled === false && row.enterprise_pass_enabled === false), true);
});

test("Work OS drilldown HTML binds routes without protected or git controls", async () => {
  const source = await readySource();
  const response = await buildWorkOsGoalDrilldownApiResponse("/work-os-drilldown.html", {
    runAt: RUN_AT,
    method: "GET",
    workOsGoalExecutionView: source,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("work-os-drilldown-root"), true);
  assert.equal(response.body.includes("window.WORK_OS_DRILLDOWN_API_PATHS"), true);
  for (const apiPath of ["/api/work-os/goals", "/api/work-os/goal-detail", "/api/work-os/project-drilldown", "/api/work-os/next-actions", "/api/work-os/commits", "/api/work-os/session-handoffs", "/api/work-os/combined-status"]) {
    assert.equal(response.body.includes(apiPath), true);
  }
  assert.equal(response.body.includes("data-protected-action"), false);
  assert.equal(response.body.includes("data-git-write"), false);
  assert.equal(response.body.includes("method: 'POST'"), false);
});

test("Work OS goal drilldown API server serves local artifact-backed routes", async () => {
  const source = await readySource();
  const started = await startWorkOsGoalDrilldownApiServer({
    runAt: RUN_AT,
    port: 0,
    workOsGoalExecutionView: source,
  });

  try {
    const goalsResponse = await fetch(`${started.url}/api/work-os/goals`);
    assert.equal(goalsResponse.status, 200);
    const goals = await goalsResponse.json();
    assert.equal(goals.collection, "goals");
    assert.equal(goals.count > 0, true);
    assert.equal(hasSensitiveKey(goals), false);

    const htmlResponse = await fetch(`${started.url}/work-os-drilldown.html`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.equal(html.includes("Hermes Work OS Drilldown"), true);
    assert.equal(html.includes("window.WORK_OS_DRILLDOWN_API_PATHS"), true);
  } finally {
    await new Promise((resolve, reject) => started.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Work OS goal drilldown surface freezes P9400 without authority expansion", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());
  const boundary = result.work_os_goal_drilldown_boundary;

  assert.equal(result.p9400_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p9401_handoff, true);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.raw_transcript_body_visible, false);
  assert.equal(boundary.secret_keys_returned, false);
  assert.equal(boundary.domain_pack_as_product_allowed, false);
  assert.equal(boundary.human_gate_completion_enabled, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
  assert.equal(boundary.single_owner_enterprise_trust_allowed, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.external_connector_write_enabled, false);
  assert.equal(boundary.ui_git_write_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Work OS goal drilldown negative fixtures block unsafe claims", async () => {
  const result = await buildWorkOsGoalDrilldownSurface(await buildOptions());
  const fixtureIds = new Set(result.work_os_goal_drilldown_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_p9200_source", "negative.non_get_method", "negative.raw_transcript_body", "negative.domain_pack_product_promotion", "negative.review_final_approval", "negative.ui_git_write", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.work_os_goal_drilldown_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.work_os_goal_drilldown_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Work OS goal drilldown surface blocks if P9200 source is not ready", async () => {
  const result = await buildWorkOsGoalDrilldownSurface({
    runAt: RUN_AT,
    write: false,
    workOsGoalExecutionView: {
      summary: {
        work_os_goal_execution_view_status: "blocked",
        ready_for_p9201_handoff: false,
      },
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p9200_ready, false);
  assert.equal(result.summary.work_os_goal_drilldown_surface_status, "blocked");
});

test("Work OS goal drilldown surface --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "work-os-goal-drilldown-surface-"));
  const sentinelPath = path.join(outDir, "work-os-goal-drilldown-surface.json");
  const sentinel = "{ \"sentinel\": \"work-os-goal-drilldown-surface\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runWorkOsGoalDrilldownSurface(await buildOptions({ outDir, check: true, write: false }));
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
