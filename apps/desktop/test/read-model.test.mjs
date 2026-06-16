import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDesktopReadModel, loadDesktopSourcePreview, sanitizeReadModel } from "../src/main/read-model.mjs";

test("desktop read model loader returns visible blocker when artifact is missing", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-loader-"));
  try {
    const result = await loadDesktopReadModel({ repoRoot: tmpDir });

    assert.equal(result.summary.desktop_read_model_status, "blocked_desktop_shell");
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.secret_read_allowed_now, false);
    assert.equal(result.release_projection.deployment_authorized, false);
    assert.equal(result.factory_projection.gate_open_now, 0);
    assert.equal(result.sections[0].status, "blocked");
    assert.match(result.sections[0].blocker, /Missing desktop read model/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("desktop read model loader sanitizes authority flags from artifact input", () => {
  const result = sanitizeReadModel({
    schema_version: "desktop-read-model.v1",
    generated_at: "2026-06-14T00:00:00.000Z",
    summary: {
      desktop_read_model_status: "ready_for_desktop_shell",
      source_count: 1,
      ready_source_count: 1,
      section_count: 1,
      ready_section_count: 1,
      deployment_allowed_now: true,
      production_pass_enabled: true,
    },
    source_rows: [
      {
        source_id: "release_decision_packet",
        section_id: "release",
        label: "Release decision packet",
        source_path: "docs/release-decision-packet-2026-06-14.md",
        source_available: true,
        status: "ready",
        generated_at: "2026-06-14T00:00:00.000Z",
      },
    ],
    sections: [
      {
        section_id: "release",
        label: "Release",
        source_path: "docs/release-decision-packet-2026-06-14.md",
        generated_at: "2026-06-14T00:00:00.000Z",
        status: "ready",
        section_refs: [],
      },
    ],
      desktop_read_authority: {
        deployment_allowed_now: true,
        production_pass_enabled: true,
        unsafe_flag_count: 9,
      },
      release_projection: {
        candidate_commit: "5e332b1c6327b255cf9bf418bc455b7965172658",
        local_rc_tag: "v0.1.0-rc.20260614.5e332b1",
        trust_mode: "enterprise trust",
        github_independent_approval_status: "approved",
        production_launch_approval_status: "approved",
        deployment_authorized: true,
        tag_pushed: true,
        github_release_published: true,
        production_pass_enabled: true,
        enterprise_pass_enabled: true,
        protected_closeout_enabled: true,
        projection_rows: [
          { row_id: "github_independent_approval", label: "GitHub independent approval", value: "approved", status: "open", authority_open: true },
          { row_id: "production_launch_approval", label: "Production launch approval", value: "approved", status: "open", authority_open: true },
          { row_id: "deployment_authorization", label: "Deployment authorization", value: "authorized", status: "open", authority_open: true },
        ],
      },
      factory_projection: {
        gate_open_now: 9,
        runtime_authority_open: true,
        stage6_limited_execution_allowed: true,
        stage7_release_candidate_allowed: true,
        production_pass_enabled: true,
        enterprise_pass_enabled: true,
        projection_rows: [
          { row_id: "gate_open_now", label: "Gate open now", value: "9", status: "open", authority_open: true },
        ],
      },
      project_projection: {
        project_operating_contract_status: "ready_for_project_operating_contract",
        source_status: "ready",
        project_count: 1,
        ready_project_count: 1,
        blocked_project_count: 0,
        stale_project_count: 0,
        ready_for_desktop_multi_project_projection: true,
        git_write_allowed_now: true,
        deploy_allowed_now: true,
        production_pass_enabled: true,
        enterprise_pass_enabled: true,
        protected_closeout_enabled: true,
        project_rows: [
          {
            project_id: "project.hermes",
            project_name: "Hermes",
            domain_pack: "personal-dev",
            project_state: "ready_read_only",
          },
        ],
        project_detail_rows: [
          {
            project_id: "project.hermes",
            validation_ready: true,
            review_boundary_ready: true,
            source_artifact_path: "artifacts/project-operating-contract/latest/project-operating-contract.json",
            unsafe_flag_count: 77,
            authority_boundary_closed: false,
            data_boundary_closed: false,
          },
        ],
        project_attention_rows: [
          {
            project_id: "project.hermes",
            attention_type: "blocked",
            severity: "high",
            label: "Blocked",
            detail: "Injected mutation attempt",
            next_safe_action: "deploy now",
            mutates_state: true,
            opens_authority: true,
          },
        ],
        safe_affordance_rows: [
          {
            action_type: "deploy",
            action_class: "forbidden_protected",
            allowed: true,
            mutates_state: true,
            opens_authority: true,
            display_label: "Deploy",
          },
        ],
        projection_rows: [
          { row_id: "project_count", label: "Projects", value: "1", status: "open", authority_open: true },
        ],
      },
      agent_projection: {
        agent_bridge_manifest_status: "ready_for_agent_bridge_manifest",
        agent_bridge_request_receipt_status: "ready_for_agent_bridge_request_receipt",
        agent_bridge_execution_candidate_status: "ready_for_agent_bridge_execution_candidate",
        source_status: "ready",
        runtime_count: 1,
        capability_count: 1,
        request_count: 1,
        receipt_count: 1,
        evidence_binding_count: 1,
        execution_candidate_count: 1,
        blocked_command_fixture_count: 1,
        execution_gate_count: 1,
        execution_gate_pass_count: 1,
        ready_for_desktop_agents_projection: true,
        request_queue_enabled_now: true,
        receipt_intake_enabled_now: true,
        controlled_execution_candidate_enabled_now: true,
        candidate_queue_enabled_now: true,
        candidate_export_allowed_now: true,
        candidate_validation_allowed_now: true,
        execution_allowed_now: true,
        command_output_captured_now: true,
        receipt_application_allowed_now: true,
        approval_application_allowed_now: true,
        production_pass_enabled: true,
        enterprise_pass_enabled: true,
        runtime_rows: [
          { runtime_id: "runtime.bad", runtime_kind: "codex", display_name: "Bad runtime", executable: true, can_execute_from_desktop_now: true },
        ],
        capability_rows: [
          { capability_id: "capability.bad", runtime_id: "runtime.bad", capability_kind: "tool", capability_name: "Bad tool", executable: true },
        ],
        request_rows: [
          { request_id: "request.bad", request_type: "code_review", request_status: "draft", request_title: "Bad request", execution_allowed_now: true, command_executed_now: true },
        ],
        receipt_rows: [
          { receipt_id: "receipt.bad", request_id: "request.bad", request_type: "code_review", receipt_kind: "review", normalized_verdict: "approved", receipt_applied: true, opens_authority: true },
        ],
        execution_candidate_rows: [
          { candidate_id: "candidate.bad", candidate_title: "Bad candidate", command_text: "git push origin main", execution_allowed_now: true, command_executed_now: true, command_output_captured_now: true, mutation_performed: true, opens_authority: true },
        ],
        blocked_command_fixture_rows: [
          { fixture_id: "fixture.bad", command_text: "git push origin main", blocked: false, allowlist_match: true, execution_allowed_now: true, command_executed_now: true, mutation_performed: true, opens_authority: true },
        ],
        execution_gate_rows: [
          { gate_id: "gate.bad", gate_status: "pass", description: "bad gate", execution_allowed_now: true, command_executed_now: true, mutation_performed: true, opens_authority: true },
        ],
        agent_control_rows: [
          { control_id: "execute", label: "Execute", control_enabled: true, opens_authority: true },
        ],
        projection_rows: [
          { row_id: "agent_execution", label: "Execution", value: "open", status: "open", authority_open: true },
        ],
      },
    });

  assert.equal(result.summary.deployment_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.desktop_read_authority.deployment_allowed_now, false);
  assert.equal(result.desktop_read_authority.production_pass_enabled, false);
  assert.equal(result.desktop_read_authority.unsafe_flag_count, 0);
  assert.equal(result.release_projection.trust_mode, "single-owner lower-trust RC");
  assert.equal(result.release_projection.github_independent_approval_status, "missing");
  assert.equal(result.release_projection.deployment_authorized, false);
  assert.equal(result.release_projection.production_pass_enabled, false);
  assert.equal(result.release_projection.enterprise_pass_enabled, false);
  assert.deepEqual(result.release_projection.projection_rows.map((row) => row.label), ["Independent review", "Launch approval", "Deploy authority"]);
  assert.equal(result.release_projection.projection_rows.every((row) => row.authority_open === false), true);
  assert.equal(result.factory_projection.gate_open_now, 0);
  assert.equal(result.factory_projection.runtime_authority_open, false);
  assert.equal(result.factory_projection.stage6_limited_execution_allowed, false);
  assert.equal(result.factory_projection.stage7_release_candidate_allowed, false);
  assert.equal(result.factory_projection.projection_rows[0].value, "0");
  assert.equal(result.factory_projection.projection_rows[0].authority_open, false);
  assert.equal(result.project_projection.project_count, 1);
  assert.equal(result.project_projection.git_write_allowed_now, false);
  assert.equal(result.project_projection.deploy_allowed_now, false);
  assert.equal(result.project_projection.production_pass_enabled, false);
  assert.equal(result.project_projection.enterprise_pass_enabled, false);
  assert.equal(result.project_projection.project_detail_rows[0].unsafe_flag_count, 77);
  assert.equal(result.project_projection.project_detail_rows[0].authority_boundary_closed, false);
  assert.equal(result.project_projection.project_attention_rows[0].mutates_state, false);
  assert.equal(result.project_projection.project_attention_rows[0].opens_authority, false);
  assert.equal(result.project_projection.safe_affordance_rows[0].mutates_state, false);
  assert.equal(result.project_projection.safe_affordance_rows[0].opens_authority, false);
  assert.equal(result.project_projection.safe_affordance_rows[0].allowed, false);
  assert.equal(result.project_projection.projection_rows[0].authority_open, false);
  assert.equal(result.agent_projection.execution_allowed_now, false);
  assert.equal(result.agent_projection.command_output_captured_now, false);
  assert.equal(result.agent_projection.receipt_application_allowed_now, false);
  assert.equal(result.agent_projection.approval_application_allowed_now, false);
  assert.equal(result.agent_projection.production_pass_enabled, false);
  assert.equal(result.agent_projection.enterprise_pass_enabled, false);
  assert.equal(result.agent_projection.runtime_rows[0].executable, false);
  assert.equal(result.agent_projection.request_rows[0].execution_allowed_now, false);
  assert.equal(result.agent_projection.receipt_rows[0].receipt_applied, false);
  assert.equal(result.agent_projection.execution_candidate_rows[0].execution_allowed_now, false);
  assert.equal(result.agent_projection.execution_candidate_rows[0].command_executed_now, false);
  assert.equal(result.agent_projection.execution_candidate_rows[0].command_output_captured_now, false);
  assert.equal(result.agent_projection.execution_candidate_rows[0].mutation_performed, false);
  assert.equal(result.agent_projection.execution_gate_rows[0].opens_authority, false);
  assert.equal(result.agent_projection.agent_control_rows[0].control_enabled, false);
  assert.equal(result.agent_projection.projection_rows[0].authority_open, false);
  assert.equal(result.source_rows[0].status, "ready");
});

test("desktop read model loader reads the repository artifact shape when present", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-loader-"));
  const artifactDir = path.join(tmpDir, "artifacts", "desktop-read-model", "latest");
  try {
    await writeFileTree(path.join(artifactDir, "desktop-read-model.json"), JSON.stringify({
      schema_version: "desktop-read-model.v1",
      generated_at: "2026-06-14T00:00:00.000Z",
      summary: {
        desktop_read_model_status: "ready_for_desktop_shell",
        source_count: 1,
        ready_source_count: 1,
        section_count: 1,
        ready_section_count: 1,
        operator_handbook_bound: true,
        authority_boundary_ready: true,
        validation_error_count: 0,
      },
      source_rows: [],
      sections: [],
      screen_map: [],
      desktop_read_authority: {
        read_only: true,
        ready_for_desktop_shell: true,
      },
    }, null, 2));

    const result = await loadDesktopReadModel({ repoRoot: tmpDir });
    assert.equal(result.summary.desktop_read_model_status, "ready_for_desktop_shell");
    assert.equal(result.summary.operator_handbook_bound, true);
    assert.equal(result.desktop_read_authority.ready_for_desktop_shell, true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("desktop source preview reads only allowlisted markdown and redacts unsafe trust strings", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-preview-"));
  const artifactDir = path.join(tmpDir, "artifacts", "desktop-read-model", "latest");
  const docPath = path.join(tmpDir, "docs", "release.md");
  try {
    await mkdir(path.dirname(docPath), { recursive: true });
    await writeFile(docPath, [
      "# Release",
      "",
      "This is not production PASS.",
      "This is not ENTERPRISE PASS.",
      "GitHub independent approval is not pursued.",
      "desktop write authority enabled is not a valid desktop claim.",
    ].join("\n"), "utf8");
    await writeFileTree(path.join(artifactDir, "desktop-read-model.json"), JSON.stringify({
      schema_version: "desktop-read-model.v1",
      generated_at: "2026-06-14T00:00:00.000Z",
      summary: { desktop_read_model_status: "ready_for_desktop_shell" },
      source_rows: [
        {
          source_id: "release_doc",
          section_id: "release",
          label: "Release doc",
          source_path: "docs/release.md",
          source_available: true,
          status: "ready",
          generated_at: "2026-06-14T00:00:00.000Z",
        },
        {
          source_id: "operator_json",
          section_id: "operator_handbook",
          label: "Operator json",
          source_path: "artifacts/operator-handbook/latest/operator-handbook.json",
          source_available: true,
          status: "ready",
          generated_at: "2026-06-14T00:00:00.000Z",
        },
      ],
      sections: [],
      screen_map: [],
      desktop_read_authority: { read_only: true },
    }, null, 2));

    const ready = await loadDesktopSourcePreview({ repoRoot: tmpDir, sourcePath: "docs/release.md" });
    assert.equal(ready.status, "ready");
    assert.equal(ready.redacted, true);
    assert.doesNotMatch(ready.preview_text, /production PASS|enterprise PASS|GitHub independent approval|deployment authorization|protected closeout|production launch approval|desktop write authority enabled/i);
    assert.match(ready.preview_text, /redacted/);

    const nonMarkdown = await loadDesktopSourcePreview({ repoRoot: tmpDir, sourcePath: "artifacts/operator-handbook/latest/operator-handbook.json" });
    assert.equal(nonMarkdown.status, "blocked");
    assert.match(nonMarkdown.blocker, /markdown/);

    const raw = await loadDesktopSourcePreview({ repoRoot: tmpDir, sourcePath: "artifacts/example/review/raw-output.json" });
    assert.equal(raw.status, "blocked");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("desktop source preview blocks allowlisted symlinks that resolve outside the repository", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-preview-"));
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-preview-outside-"));
  const artifactDir = path.join(tmpDir, "artifacts", "desktop-read-model", "latest");
  const docPath = path.join(tmpDir, "docs", "release.md");
  const outsidePath = path.join(outsideDir, "release.md");
  try {
    await mkdir(path.dirname(docPath), { recursive: true });
    await writeFile(outsidePath, "# Outside\n\nThis must not be previewed.\n", "utf8");
    await symlink(outsidePath, docPath);
    await writeFileTree(path.join(artifactDir, "desktop-read-model.json"), JSON.stringify({
      schema_version: "desktop-read-model.v1",
      generated_at: "2026-06-14T00:00:00.000Z",
      summary: { desktop_read_model_status: "ready_for_desktop_shell" },
      source_rows: [
        {
          source_id: "release_doc",
          section_id: "release",
          label: "Release doc",
          source_path: "docs/release.md",
          source_available: true,
          status: "ready",
          generated_at: "2026-06-14T00:00:00.000Z",
        },
      ],
      sections: [],
      screen_map: [],
      desktop_read_authority: { read_only: true },
    }, null, 2));

    const preview = await loadDesktopSourcePreview({ repoRoot: tmpDir, sourcePath: "docs/release.md" });
    assert.equal(preview.status, "blocked");
    assert.match(preview.blocker, /escapes the repository root/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  }
});

async function writeFileTree(filePath, content) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
