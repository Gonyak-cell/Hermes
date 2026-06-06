import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildWorkOsReadOnlyApiResponse,
  buildWorkOsReadOnlyApiUiSmoke,
  runWorkOsReadOnlyApiUiSmoke,
  startWorkOsReadOnlyApiServer,
} from "../src/work-os-read-only-api-ui-smoke.mjs";
import { buildWorkOsLiveControlSurface } from "../src/work-os-live-control-surface.mjs";

const RUN_AT = "2026-06-06T02:40:00.000Z";

async function readySource() {
  return buildWorkOsLiveControlSurface({ runAt: RUN_AT, write: false });
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    workOsLiveControlSurface: await readySource(),
    ...overrides,
  };
}

test("Work OS read-only API/UI smoke consumes P8800 source", async () => {
  const result = await buildWorkOsReadOnlyApiUiSmoke(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_read_only_api_ui_smoke_status, "ready_for_work_os_read_only_api_ui_smoke");
  assert.equal(result.program_range, "P8801-P9000");
  assert.equal(result.summary.source_p8800_ready, true);
  assert.equal(result.summary.ready_for_p9001_handoff, true);
});

test("Work OS read-only API/UI smoke covers all P8801-P9000 phase rows", async () => {
  const result = await buildWorkOsReadOnlyApiUiSmoke(await buildOptions());
  const phaseRanges = new Set(result.work_os_read_only_api_ui_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P8801-P8820", "P8821-P8840", "P8841-P8860", "P8861-P8880", "P8881-P8900", "P8901-P8920", "P8921-P8940", "P8941-P8960", "P8961-P8980", "P8981-P9000"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.work_os_read_only_api_ui_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Work OS read-only API routes are GET HEAD only and reject mutation", async () => {
  const source = await readySource();
  const result = await buildWorkOsReadOnlyApiUiSmoke(await buildOptions({ workOsLiveControlSurface: source }));
  const paths = new Set(result.read_only_api_route_projection_rows.map((row) => row.api_path));

  for (const apiPath of ["/health", "/api/work-os", "/api/work-os/summary", "/api/work-os/projects", "/api/work-os/phases", "/api/work-os/timeline", "/api/work-os/reviews", "/api/work-os/gates", "/api/work-os/session-sources", "/api/work-os/boundary", "/api/work-os/refresh"]) {
    assert.equal(paths.has(apiPath), true);
  }
  assert.equal(result.read_only_api_route_projection_rows.every((row) => row.method_allowlist.includes("GET") && row.method_allowlist.includes("HEAD")), true);
  assert.equal(result.read_only_api_route_projection_rows.every((row) => row.write_methods_enabled === false && row.mutates_state === false), true);

  const postResponse = await buildWorkOsReadOnlyApiResponse("/api/work-os/projects", {
    runAt: RUN_AT,
    method: "POST",
    workOsLiveControlSurface: source,
  });
  assert.equal(postResponse.status, 405);
});

test("Work OS read-only API response bodies are sanitized view models", async () => {
  const source = await readySource();

  for (const apiPath of ["/api/work-os", "/api/work-os/projects", "/api/work-os/phases", "/api/work-os/timeline", "/api/work-os/reviews", "/api/work-os/gates", "/api/work-os/session-sources", "/api/work-os/boundary", "/api/work-os/refresh"]) {
    const response = await buildWorkOsReadOnlyApiResponse(apiPath, {
      runAt: RUN_AT,
      method: "GET",
      workOsLiveControlSurface: source,
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }
});

test("Work OS UI HTML binds live surfaces to API paths without protected action controls", async () => {
  const source = await readySource();
  const response = await buildWorkOsReadOnlyApiResponse("/work-os.html", {
    runAt: RUN_AT,
    method: "GET",
    workOsLiveControlSurface: source,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("work-os-root"), true);
  assert.equal(response.body.includes("window.WORK_OS_API_PATHS"), true);
  for (const apiPath of ["/api/work-os/summary", "/api/work-os/projects", "/api/work-os/phases", "/api/work-os/timeline", "/api/work-os/reviews", "/api/work-os/gates", "/api/work-os/refresh"]) {
    assert.equal(response.body.includes(apiPath), true);
  }
  assert.equal(response.body.includes("data-protected-action"), false);
  assert.equal(response.body.includes("method: 'POST'"), false);
});

test("Work OS read-only API/UI smoke records API and browser smoke evidence", async () => {
  const result = await buildWorkOsReadOnlyApiUiSmoke(await buildOptions());

  assert.equal(result.api_projection_smoke_rows.length >= 12, true);
  assert.equal(result.browser_smoke_evidence_rows.length >= 6, true);
  assert.equal(result.api_projection_smoke_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.browser_smoke_evidence_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.api_projection_smoke_rows.every((row) => row.raw_payload_keys_present === false && row.secret_keys_present === false), true);
  assert.equal(result.browser_smoke_evidence_rows.every((row) => row.raw_payload_keys_present === false && row.secret_keys_present === false), true);
  assert.equal(result.api_projection_smoke_rows.some((row) => row.method === "POST" && row.observed_status === 405), true);
});

test("Work OS read-only API server serves local artifact-backed routes", async () => {
  const source = await readySource();
  const started = await startWorkOsReadOnlyApiServer({
    runAt: RUN_AT,
    port: 0,
    workOsLiveControlSurface: source,
  });

  try {
    const projectResponse = await fetch(`${started.url}/api/work-os/projects`);
    assert.equal(projectResponse.status, 200);
    const projects = await projectResponse.json();
    assert.equal(projects.collection, "projects");
    assert.equal(projects.count > 0, true);
    assert.equal(hasSensitiveKey(projects), false);

    const htmlResponse = await fetch(`${started.url}/work-os.html`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.equal(html.includes("Hermes Work OS"), true);
    assert.equal(html.includes("window.WORK_OS_API_PATHS"), true);
  } finally {
    await new Promise((resolve, reject) => started.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Work OS read-only API/UI smoke freezes P9000 without authority expansion", async () => {
  const result = await buildWorkOsReadOnlyApiUiSmoke(await buildOptions());
  const boundary = result.work_os_read_only_boundary;

  assert.equal(result.p9000_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p9001_handoff, true);
  assert.equal(boundary.raw_payload_keys_returned, false);
  assert.equal(boundary.secret_keys_returned, false);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.ui_protected_action_controls_enabled, false);
  assert.equal(boundary.refresh_mutates_state, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.external_connector_write_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Work OS read-only API/UI smoke negative fixtures block unsafe claims", async () => {
  const result = await buildWorkOsReadOnlyApiUiSmoke(await buildOptions());
  const fixtureIds = new Set(result.work_os_read_only_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_p8800_source", "negative.non_get_method", "negative.raw_payload_response", "negative.unsanitized_secret_key", "negative.refresh_mutates_state", "negative.ui_protected_action", "negative.ui_blank", "negative.production_enterprise_pass", "negative.runtime_write_connector"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.work_os_read_only_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.work_os_read_only_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Work OS read-only API/UI smoke blocks if P8800 source is not ready", async () => {
  const result = await buildWorkOsReadOnlyApiUiSmoke({
    runAt: RUN_AT,
    write: false,
    workOsLiveControlSurface: {
      summary: {
        work_os_live_control_surface_status: "blocked",
        ready_for_p8801_handoff: false,
      },
      project_control_surface_rows: [],
      phase_detail_surface_rows: [],
      redacted_timeline_projection_rows: [],
      review_finding_surface_rows: [],
      work_os_live_gate_rows: [],
      session_ingestion_adapter_rows: [],
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p8800_ready, false);
  assert.equal(result.summary.work_os_read_only_api_ui_smoke_status, "blocked");
});

test("Work OS read-only API/UI smoke --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "work-os-read-only-api-ui-smoke-"));
  const sentinelPath = path.join(outDir, "work-os-read-only-api-ui-smoke.json");
  const sentinel = "{ \"sentinel\": \"work-os-read-only-api-ui-smoke\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runWorkOsReadOnlyApiUiSmoke(await buildOptions({ outDir, check: true, write: false }));
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
