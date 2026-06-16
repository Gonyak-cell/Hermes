import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDesktopReadModel,
  containsForbiddenTrustString,
  isAllowedDesktopReadPath,
  isDeniedDesktopReadPath,
  parseDesktopReadModelArgs,
  runDesktopReadModel,
} from "../src/desktop-read-model.mjs";

const RUN_AT = "2026-06-14T09:30:00.000Z";

test("Desktop read model projects release, factory, review, operator, artifact, and authority sections as read-only data", async () => {
  const fixture = await createReadModelFixture();
  try {
    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.schema_version, "desktop-read-model.v1");
    assert.equal(result.summary.desktop_read_model_status, "ready_for_desktop_shell");
    assert.equal(result.summary.source_count, 28);
    assert.equal(result.summary.ready_source_count, 28);
    assert.equal(result.summary.section_count, 8);
    assert.equal(result.summary.ready_section_count, 8);
    assert.equal(result.summary.project_count, 2);
    assert.equal(result.summary.ready_project_count, 1);
    assert.equal(result.summary.blocked_project_count, 1);
    assert.equal(result.summary.operator_handbook_bound, true);
    assert.equal(result.summary.authority_boundary_ready, true);
    assert.equal(result.summary.raw_payload_read_allowed, false);
    assert.equal(result.summary.secret_like_path_read_allowed, false);
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.production_pass_enabled, false);
    assert.equal(result.summary.enterprise_pass_enabled, false);
    assert.equal(result.release_projection.candidate_commit, "8200ed3b754b74900a95fe5a48875a1daf707335");
    assert.equal(result.release_projection.local_rc_tag, "v0.1.0-rc.20260615.8200ed3");
    assert.equal(result.release_projection.github_independent_approval_status, "not_pursued_single_owner_local_rc");
    assert.equal(result.release_projection.production_launch_approval_status, "missing");
    assert.equal(result.release_projection.deployment_authorized, false);
    assert.equal(result.release_projection.production_pass_enabled, false);
    assert.equal(result.factory_projection.gate_open_now, 0);
    assert.equal(result.factory_projection.runtime_authority_open, false);
    assert.equal(result.factory_projection.stage6_limited_execution_allowed, false);
    assert.equal(result.factory_projection.stage7_release_candidate_allowed, false);
    assert.equal(result.project_projection.project_count, 2);
    assert.equal(result.project_projection.ready_project_count, 1);
    assert.equal(result.project_projection.blocked_project_count, 1);
    assert.equal(result.project_projection.git_write_allowed_now, false);
    assert.equal(result.project_projection.production_pass_enabled, false);
    assert.equal(result.project_projection.enterprise_pass_enabled, false);
    assert.equal(result.project_projection.project_rows.map((row) => row.project_id).join(","), "project.hermes,project.law_firm_os");
    assert.equal(result.project_projection.project_detail_rows.length, 2);
    assert.equal(result.project_projection.project_detail_rows[0].project_id, "project.hermes");
    assert.equal(result.project_projection.project_detail_rows[1].state_reason, "blocked_by_validation");
    assert.equal(result.project_projection.project_drift_rows.length, 2);
    assert.equal(result.project_projection.project_attention_rows.some((row) => row.attention_type === "blocked"), true);
    assert.equal(result.project_projection.safe_affordance_rows.some((row) => row.action_type === "copy_command" && row.mutates_state === false && row.opens_authority === false), true);
    assert.equal(result.agent_projection.runtime_count, 4);
    assert.equal(result.agent_projection.request_count, 4);
    assert.equal(result.agent_projection.request_packet_export_count, 4);
    assert.equal(result.agent_projection.receipt_count, 4);
    assert.equal(result.agent_projection.receipt_import_candidate_count, 4);
    assert.equal(result.agent_projection.receipt_normalized_summary_count, 4);
    assert.equal(result.agent_projection.execution_candidate_count, 5);
    assert.equal(result.agent_projection.execution_gate_count, 10);
    assert.equal(result.agent_projection.ready_for_desktop_agents_projection, true);
    assert.equal(result.agent_projection.execution_allowed_now, false);
    assert.equal(result.agent_projection.command_output_captured_now, false);
    assert.equal(result.agent_projection.receipt_application_allowed_now, false);
    assert.equal(result.agent_projection.request_transport_submission_allowed_now, false);
    assert.equal(result.agent_projection.packet_export_rows.every((row) => row.copy_allowed_now === true && row.request_transport_submission_allowed_now === false), true);
    assert.equal(result.agent_projection.receipt_import_candidate_rows.every((row) => row.raw_output_included === false && row.receipt_applied === false && row.opens_authority === false), true);
    assert.equal(result.agent_projection.execution_candidate_rows.every((row) => row.execution_allowed_now === false && row.command_executed_now === false && row.command_output_captured_now === false), true);
    assert.equal(result.agent_projection.agent_control_rows.every((row) => row.control_enabled === false && row.opens_authority === false), true);
    assert.equal(result.sections.every((section) => section.source_path && section.generated_at && section.status && Object.hasOwn(section, "blocker") && Array.isArray(section.section_refs)), true);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model fails closed when a required source is missing", async () => {
  const fixture = await createReadModelFixture();
  const missingPath = path.join(fixture.tmpDir, "missing-factory-stage-67.md");
  try {
    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      factoryStage67SummaryPath: missingPath,
      allowlist: [...fixture.allowlist.filter((entry) => entry !== fixture.options.factoryStage67SummaryPath), missingPath],
    });

    const missingRow = result.source_rows.find((row) => row.source_id === "factory_stage_6_7");
    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.desktop_read_model_status, "blocked_desktop_shell");
    assert.equal(missingRow.status, "blocked");
    assert.match(missingRow.blocker, /Missing required source/);
    assert.equal(result.sections.find((section) => section.section_id === "factory").status, "blocked");
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.desktop_write_authority_enabled, false);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model check mode can validate without writing artifacts", async () => {
  const fixture = await createReadModelFixture();
  const outDir = path.join(fixture.tmpDir, "out");
  try {
    const result = await runDesktopReadModel({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.desktop_read_model_status, "ready_for_desktop_shell");
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model denylist takes precedence over allowlist", () => {
  const rawOutputPath = "artifacts/example/review/raw-output.json";
  const secretPath = "artifacts/example/secret-material.json";
  const envPath = ".env.local";

  assert.equal(isDeniedDesktopReadPath(rawOutputPath), true);
  assert.equal(isDeniedDesktopReadPath(secretPath), true);
  assert.equal(isDeniedDesktopReadPath(envPath), true);
  assert.equal(isAllowedDesktopReadPath(rawOutputPath, [rawOutputPath]), false);
  assert.equal(isAllowedDesktopReadPath(secretPath, [secretPath]), false);
  assert.equal(isAllowedDesktopReadPath(envPath, [envPath]), false);
});

test("Desktop read model projection refuses malicious authority text", async () => {
  const fixture = await createReadModelFixture();
  try {
    await writeFile(fixture.options.releaseDecisionPacketPath, [
      "# Malicious Fixture",
      "",
      "| Candidate commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |",
      "| Local RC tag | `v0.1.0-rc.20260614.5e332b1` |",
      "GitHub independent approval: approved",
      "Owner production launch approval: approved",
      "deployment_authorized: true",
      "production PASS",
    ].join("\n"), "utf8");
    await writeFile(fixture.options.factoryGateOpeningSummaryPath, [
      "# Malicious Factory",
      "",
      "Status: ready_factory_gate_opening_readiness",
      "Gate open now: 9",
      "G1a status: source_evidence_complete_runtime_authority_closed",
      "Production PASS enabled: true",
      "Enterprise PASS enabled: true",
    ].join("\n"), "utf8");

    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.release_projection.github_independent_approval_status, "missing");
    assert.equal(result.release_projection.production_launch_approval_status, "not_approved");
    assert.equal(result.release_projection.deployment_authorized, false);
    assert.equal(result.release_projection.production_pass_enabled, false);
    assert.equal(result.release_projection.enterprise_pass_enabled, false);
    assert.equal(result.factory_projection.observed_gate_open_now_input, 9);
    assert.equal(result.factory_projection.gate_open_now, 0);
    assert.equal(result.factory_projection.runtime_authority_open, false);
    assert.equal(result.factory_projection.stage6_limited_execution_allowed, false);
    assert.equal(result.factory_projection.stage7_release_candidate_allowed, false);
    assert.equal(result.factory_projection.production_pass_enabled, false);
    assert.equal(result.factory_projection.projection_rows.find((row) => row.row_id === "gate_open_now").status, "input_rejected_closed");
    assert.equal(result.validation.valid, true);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model surfaces blocked, stale, review-needed, owner-action, and safe affordance fixtures without opening authority", async () => {
  const fixture = await createReadModelFixture();
  try {
    await writeFile(fixture.options.projectOperatingContractPath, JSON.stringify(projectContractStateFixture(), null, 2), "utf8");
    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.project_projection.project_rows.length, 4);
    assert.deepEqual(result.project_projection.project_rows.map((row) => row.project_state), [
      "blocked",
      "stale",
      "review_needed",
      "owner_action_needed",
    ]);
    assert.equal(result.project_projection.project_drift_rows.find((row) => row.project_id === "project.stale").refresh_required, true);
    assert.equal(result.project_projection.project_attention_rows.some((row) => row.attention_type === "stale" && row.next_safe_action.includes("refresh")), true);
    assert.equal(result.project_projection.project_attention_rows.some((row) => row.attention_type === "review_needed"), true);
    assert.equal(result.project_projection.project_attention_rows.some((row) => row.attention_type === "owner_action_needed"), true);
    assert.equal(result.project_projection.project_detail_rows.find((row) => row.project_id === "project.blocked").blocker_type, "failed_validation");
    assert.equal(result.project_projection.safe_affordance_rows.every((row) => row.mutates_state === false && row.opens_authority === false), true);
    assert.equal(result.project_projection.safe_affordance_rows.find((row) => row.action_type === "deploy").allowed, false);
    assert.equal(result.project_projection.git_write_allowed_now, false);
    assert.equal(result.project_projection.deploy_allowed_now, false);
    assert.equal(result.project_projection.production_pass_enabled, false);
    assert.equal(result.project_projection.enterprise_pass_enabled, false);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model recognizes forbidden trust claim strings", () => {
  assert.equal(containsForbiddenTrustString("This is production PASS."), true);
  assert.equal(containsForbiddenTrustString("desktop write authority enabled"), true);
  assert.equal(containsForbiddenTrustString("single-owner lower-trust RC only"), false);
});

test("Desktop read model CLI parser accepts only known flags", () => {
  assert.deepEqual(parseDesktopReadModelArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseDesktopReadModelArgs(["--allowlist", "docs/example.md"]), /Unknown argument: --allowlist/);
  assert.throws(() => parseDesktopReadModelArgs(["--schema-path"]), /Missing value for --schema-path/);
});

async function createReadModelFixture() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-read-"));
  const file = (name) => path.join(tmpDir, name);
  const options = {
    packagePath: file("package.json"),
    releaseOwnerDecisionPath: file("release-owner.md"),
    releaseDecisionPacketPath: file("release-decision.md"),
    productionLaunchChecklistPath: file("production-checklist.md"),
    claudeFinalReviewPacketPath: file("claude-review.md"),
    releaseNoteTagDraftPath: file("release-note.md"),
    desktopPlanPath: file("desktop-plan.md"),
    desktopLocalLaunchRunbookPath: file("desktop-local-launch-runbook.md"),
    desktopPackagingManifestSummaryPath: file("desktop-packaging-manifest-summary.md"),
    projectOperatingContractPath: file("project-operating-contract.json"),
    projectOperatingContractSummaryPath: file("project-operating-contract-summary.md"),
    agentBridgeManifestPath: file("agent-bridge-manifest.json"),
    agentBridgeRequestReceiptPath: file("agent-bridge-request-receipt.json"),
    agentBridgeRequestReceiptSummaryPath: file("agent-bridge-request-receipt-summary.md"),
    agentBridgeRequestPacketExportPath: file("agent-bridge-request-packet-export.json"),
    agentBridgeReceiptImportWorkspacePath: file("agent-bridge-receipt-import-workspace.json"),
    agentBridgeExecutionCandidatePath: file("agent-bridge-execution-candidate.json"),
    operatorHandbookPath: file("operator-handbook.json"),
    operatorSurfacesPath: file("operator-surfaces.json"),
    operatorScreensPath: file("operator-screens.json"),
    operatorWorkflowsPath: file("operator-workflows.json"),
    operatorGatesPath: file("operator-gates.json"),
    operatorHandbookBoundaryPath: file("operator-handbook-boundary.json"),
    releaseReadinessSummaryPath: file("release-readiness.md"),
    productionGovernanceSummaryPath: file("production-governance.md"),
    p16800FreezeSummaryPath: file("p16800.md"),
    factoryGateOpeningSummaryPath: file("factory-gate.md"),
    factoryStage67SummaryPath: file("factory-stage-67.md"),
    desktopAuthorityBoundaryPath: file("desktop-authority-boundary.json"),
  };
  await writeFile(options.packagePath, JSON.stringify({ scripts: { "desktop:read-model": "node scripts/desktop-read-model.mjs" } }, null, 2), "utf8");
  for (const markdownPath of [
    options.releaseOwnerDecisionPath,
    options.releaseDecisionPacketPath,
    options.productionLaunchChecklistPath,
    options.claudeFinalReviewPacketPath,
    options.releaseNoteTagDraftPath,
    options.desktopPlanPath,
    options.desktopLocalLaunchRunbookPath,
    options.desktopPackagingManifestSummaryPath,
    options.projectOperatingContractSummaryPath,
    options.agentBridgeRequestReceiptSummaryPath,
    options.releaseReadinessSummaryPath,
    options.productionGovernanceSummaryPath,
    options.p16800FreezeSummaryPath,
    options.factoryGateOpeningSummaryPath,
    options.factoryStage67SummaryPath,
  ]) {
    await writeFile(markdownPath, "# Fixture\n\nsingle-owner lower-trust RC only.\n", "utf8");
  }
  await writeFile(options.releaseDecisionPacketPath, [
    "# Release Decision",
    "",
    "| Candidate commit | `8200ed3b754b74900a95fe5a48875a1daf707335` |",
    "| Previous local RC tag | `v0.1.0-rc.20260614.5e332b1` |",
    "| Proposed local RC tag | `v0.1.0-rc.20260615.8200ed3` |",
    "| Trust mode | `single-owner lower-trust RC`; GitHub independent approval not pursued |",
    "| Owner production launch approval | missing |",
  ].join("\n"), "utf8");
  await writeFile(options.releaseOwnerDecisionPath, [
    "# Historical Release Owner Decision",
    "",
    "| Candidate commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |",
    "| Local RC tag | `v0.1.0-rc.20260614.5e332b1` |",
  ].join("\n"), "utf8");
  await writeFile(options.factoryGateOpeningSummaryPath, [
    "# Factory Gate Opening Readiness",
    "",
    "Status: ready_factory_gate_opening_readiness",
    "Gate open now: 0",
    "G1a status: source_evidence_complete_runtime_authority_closed",
    "Production PASS enabled: false",
    "Enterprise PASS enabled: false",
  ].join("\n"), "utf8");
  await writeFile(options.factoryStage67SummaryPath, [
    "# Factory Stage6/7 Execution Readiness",
    "",
    "Status: ready_stage6_stage7_contract_development",
    "Runtime authority open: false",
    "Stage6 limited execution allowed: false",
    "Stage7 release candidate allowed: false",
    "Contract development allowed: true",
    "Factory goal complete allowed: false",
  ].join("\n"), "utf8");
  await writeFile(options.projectOperatingContractPath, JSON.stringify({
    schema_version: "project-operating-contract.v1",
    summary: {
      project_operating_contract_status: "ready_for_project_operating_contract",
      project_count: 2,
      ready_project_count: 1,
      blocked_project_count: 1,
      review_needed_project_count: 0,
      stale_project_count: 0,
      validation_error_count: 0,
    },
    project_operating_boundary: {
      ready_for_desktop_multi_project_projection: true,
      unsafe_flag_count: 0,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      protected_closeout_enabled: false,
    },
    project_identity_rows: [
      { project_id: "project.hermes", project_name: "Hermes", domain_pack: "personal-dev" },
      { project_id: "project.law_firm_os", project_name: "Law Firm OS", domain_pack: "law-firm" },
    ],
    project_progress_rows: [
      { project_id: "project.hermes", current_goal_id: "goal.hermes", current_phase_range: "TUW-001-TUW-009", risk_level: "low", completed_units: 6, remaining_units: 0, next_action_count: 1 },
      { project_id: "project.law_firm_os", current_goal_id: "goal.law", current_phase_range: "CP690-722", risk_level: "high", completed_units: 1, remaining_units: 3, next_action_count: 2 },
    ],
    project_source_inventory_rows: [
      { project_id: "project.hermes", source_artifact_path: "artifacts/project-operating-contract/latest/project-operating-contract.json", source_artifact_sha256: "sha256:hermes", source_generated_at: "2026-06-14T09:00:00.000Z", source_parse_status: "parsed" },
      { project_id: "project.law_firm_os", source_artifact_path: "artifacts/project-operating-contract/latest/project-operating-contract.json", source_artifact_sha256: "sha256:law", source_generated_at: "2026-06-14T09:00:00.000Z", source_parse_status: "parsed" },
    ],
    project_authority_boundary_rows: [
      { project_id: "project.hermes", unsafe_flag_count: 0, cross_project_data_mixing_allowed: false },
      { project_id: "project.law_firm_os", unsafe_flag_count: 0, cross_project_data_mixing_allowed: false },
    ],
    project_freshness_rows: [
      { project_id: "project.hermes", source_age_days: 0.02, refresh_required: false },
      { project_id: "project.law_firm_os", source_age_days: 0.02, refresh_required: false },
    ],
    project_next_action_taxonomy_rows: [
      { action_type: "inspect", action_class: "safe_read_only", allowed: true },
      { action_type: "copy_command", action_class: "safe_read_only", allowed: true },
      { action_type: "open_artifact", action_class: "safe_read_only", allowed: true },
      { action_type: "prepare_review_packet", action_class: "safe_read_only", allowed: true },
      { action_type: "draft_owner_decision", action_class: "safe_read_only", allowed: true },
      { action_type: "refresh_artifact", action_class: "safe_read_only", allowed: true },
      { action_type: "deploy", action_class: "forbidden_protected", allowed: false },
    ],
    project_state_rows: [
      {
        project_id: "project.hermes",
        project_state: "ready_read_only",
        state_reason: "read_only_contract_ready",
        blocker_count: 0,
        freshness_status: "fresh",
        progress_confidence: "high",
        next_allowed_action: "inspect project state",
      },
      {
        project_id: "project.law_firm_os",
        project_state: "blocked",
        state_reason: "blocked_by_validation",
        blocker_count: 2,
        freshness_status: "fresh",
        progress_confidence: "medium",
        next_allowed_action: "inspect blockers",
      },
    ],
  }, null, 2), "utf8");
  await writeFile(options.agentBridgeManifestPath, JSON.stringify(agentBridgeManifestFixture(), null, 2), "utf8");
  await writeFile(options.agentBridgeRequestReceiptPath, JSON.stringify(agentBridgeRequestReceiptFixture(), null, 2), "utf8");
  await writeFile(options.agentBridgeRequestPacketExportPath, JSON.stringify(agentBridgeRequestPacketExportFixture(), null, 2), "utf8");
  await writeFile(options.agentBridgeReceiptImportWorkspacePath, JSON.stringify(agentBridgeReceiptImportWorkspaceFixture(), null, 2), "utf8");
  await writeFile(options.agentBridgeExecutionCandidatePath, JSON.stringify(agentBridgeExecutionCandidateFixture(), null, 2), "utf8");
  await writeFile(options.operatorHandbookPath, JSON.stringify({ schema_version: "operator-handbook.v1", summary: { operator_handbook_status: "complete", operator_handbook_id: "operator-handbook.test" } }, null, 2), "utf8");
  await writeFile(options.operatorSurfacesPath, JSON.stringify({ schema_version: "operator-surfaces.v1", operator_surface_rows: [] }, null, 2), "utf8");
  await writeFile(options.operatorScreensPath, JSON.stringify({ schema_version: "operator-screens.v1", operator_screen_rows: [] }, null, 2), "utf8");
  await writeFile(options.operatorWorkflowsPath, JSON.stringify({ schema_version: "operator-workflows.v1", operator_workflow_rows: [] }, null, 2), "utf8");
  await writeFile(options.operatorGatesPath, JSON.stringify({ schema_version: "operator-gates.v1", operator_gate_results: [] }, null, 2), "utf8");
  await writeFile(options.operatorHandbookBoundaryPath, JSON.stringify({
    schema_version: "operator-handbook-boundary.v1",
    desktop_read_only: true,
    desktop_source_of_truth: false,
  }, null, 2), "utf8");
  await writeFile(options.desktopAuthorityBoundaryPath, JSON.stringify({
    schema_version: "desktop-authority-boundary.v1",
    summary: {
      desktop_authority_boundary_status: "enforced_read_only_desktop_boundary",
      unsafe_flag_count: 0,
      ready_for_desktop_read_model: true,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      protected_closeout_enabled: false,
      desktop_write_authority_enabled: false,
    },
  }, null, 2), "utf8");
  return {
    tmpDir,
    options,
    allowlist: Object.values(options),
  };
}

function agentBridgeManifestFixture() {
  return {
    schema_version: "agent-bridge-manifest.v1",
    summary: {
      agent_bridge_manifest_status: "ready_for_agent_bridge_manifest",
      runtime_count: 4,
      capability_count: 4,
      permission_row_count: 4,
      validation_error_count: 0,
    },
    agent_bridge_boundary: {
      unsafe_flag_count: 0,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      protected_closeout_enabled: false,
    },
    runtime_identity_rows: [
      { runtime_id: "runtime.codex.desktop", runtime_kind: "codex", display_name: "Codex Desktop", model_label_observed: "codex", state: "observed", trust_class: "developer_session_context" },
      { runtime_id: "runtime.claude_code.opus_max", runtime_kind: "claude_code", display_name: "Claude Code", model_label_observed: "opus_max", state: "observed", trust_class: "external_review_lane_evidence" },
      { runtime_id: "runtime.chatgpt.web_agbrowse", runtime_kind: "chatgpt_web_agbrowse", display_name: "ChatGPT via Agbrowse", model_label_observed: "chatgpt_pro", state: "observed", trust_class: "browser_automation_status_evidence" },
      { runtime_id: "runtime.local.hermes_scripts", runtime_kind: "local_script", display_name: "Local scripts", model_label_observed: "none", state: "observed", trust_class: "deterministic_local_file" },
    ],
    capability_inventory_rows: [
      { capability_id: "capability.codex.skills.visible_catalog", capability_kind: "skill_catalog", capability_name: "Codex skills", runtime_id: "runtime.codex.desktop", state: "observed", passive_collection_only: true, trust_class: "developer_session_context" },
      { capability_id: "capability.claude.review_lane", capability_kind: "review_lane", capability_name: "Claude review", runtime_id: "runtime.claude_code.opus_max", state: "observed", passive_collection_only: true, trust_class: "external_review_evidence" },
      { capability_id: "capability.chatgpt.agbrowse.web_ai", capability_kind: "browser_automation_adapter", capability_name: "Agbrowse web AI", runtime_id: "runtime.chatgpt.web_agbrowse", state: "observed", passive_collection_only: true, trust_class: "browser_automation_status_evidence" },
      { capability_id: "capability.local.hermes.agent_bridge_manifest", capability_kind: "package_script", capability_name: "platform:agent-bridge-manifest", runtime_id: "runtime.local.hermes_scripts", state: "observed", passive_collection_only: false, trust_class: "deterministic_local_file" },
    ],
    permission_matrix_rows: [
      { capability_id: "capability.codex.skills.visible_catalog", runtime_id: "runtime.codex.desktop", authority_namespace: "external_provider_authority", capability_state: "observed", desktop_display_allowed: true },
      { capability_id: "capability.claude.review_lane", runtime_id: "runtime.claude_code.opus_max", authority_namespace: "external_provider_authority", capability_state: "observed", desktop_display_allowed: true },
      { capability_id: "capability.chatgpt.agbrowse.web_ai", runtime_id: "runtime.chatgpt.web_agbrowse", authority_namespace: "external_provider_authority", capability_state: "observed", desktop_display_allowed: true },
      { capability_id: "capability.local.hermes.agent_bridge_manifest", runtime_id: "runtime.local.hermes_scripts", authority_namespace: "developer_preflight", capability_state: "observed", desktop_display_allowed: true },
    ],
  };
}

function agentBridgeRequestReceiptFixture() {
  return {
    schema_version: "agent-bridge-request-receipt.v1",
    summary: {
      agent_bridge_request_receipt_status: "ready_for_agent_bridge_request_receipt",
      source_agent_bridge_manifest_status: "ready_for_agent_bridge_manifest",
      request_count: 4,
      receipt_count: 4,
      evidence_binding_count: 4,
      request_queue_enabled_now: true,
      receipt_intake_enabled_now: true,
      validation_error_count: 0,
    },
    agent_request_receipt_boundary: {
      unsafe_flag_count: 0,
      request_queue_enabled_now: true,
      receipt_intake_enabled_now: true,
      execution_allowed_now: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
    },
    agent_task_request_queue_rows: [
      { request_id: "request.plan", request_type: "plan_review", request_status: "draft", target_runtime_id: "runtime.chatgpt.web_agbrowse", request_title: "Plan review", risk_level: "medium", request_packet_generated: true },
      { request_id: "request.code", request_type: "code_review", request_status: "draft", target_runtime_id: "runtime.claude_code.opus_max", request_title: "Code review", risk_level: "medium", request_packet_generated: true },
      { request_id: "request.proposal", request_type: "implementation_proposal", request_status: "draft", target_runtime_id: "runtime.codex.desktop", request_title: "Proposal", risk_level: "low", request_packet_generated: true },
      { request_id: "request.command", request_type: "command_suggestion", request_status: "draft", target_runtime_id: "runtime.local.hermes_scripts", request_title: "Command suggestion", risk_level: "medium", request_packet_generated: true },
    ],
    agent_receipt_intake_rows: [
      { receipt_id: "receipt.plan", request_id: "request.plan", request_type: "plan_review", receipt_kind: "external_review_summary", normalized_verdict: "approve_with_findings", receipt_validated: true, receipt_quarantined: false },
      { receipt_id: "receipt.code", request_id: "request.code", request_type: "code_review", receipt_kind: "external_review_summary", normalized_verdict: "missing", receipt_validated: false, receipt_quarantined: true },
      { receipt_id: "receipt.proposal", request_id: "request.proposal", request_type: "implementation_proposal", receipt_kind: "local_work_summary", normalized_verdict: "missing", receipt_validated: false, receipt_quarantined: true },
      { receipt_id: "receipt.command", request_id: "request.command", request_type: "command_suggestion", receipt_kind: "command_suggestion_summary", normalized_verdict: "text_only_command_suggestion", receipt_validated: true, receipt_quarantined: false },
    ],
    agent_evidence_binding_rows: [
      { binding_id: "binding.plan", request_id: "request.plan", receipt_id: "receipt.plan", binding_status: "bound_to_normalized_receipt", target_runtime_id: "runtime.chatgpt.web_agbrowse", target_capability_id: "capability.chatgpt.agbrowse.web_ai" },
      { binding_id: "binding.code", request_id: "request.code", receipt_id: "receipt.code", binding_status: "pending_or_quarantined_receipt", target_runtime_id: "runtime.claude_code.opus_max", target_capability_id: "capability.claude.review_lane" },
      { binding_id: "binding.proposal", request_id: "request.proposal", receipt_id: "receipt.proposal", binding_status: "pending_or_quarantined_receipt", target_runtime_id: "runtime.codex.desktop", target_capability_id: "capability.codex.skills.visible_catalog" },
      { binding_id: "binding.command", request_id: "request.command", receipt_id: "receipt.command", binding_status: "bound_to_normalized_receipt", target_runtime_id: "runtime.local.hermes_scripts", target_capability_id: "capability.local.hermes.agent_bridge_manifest" },
    ],
  };
}

function agentBridgeRequestPacketExportFixture() {
  return {
    schema_version: "agent-bridge-request-packet-export.v1",
    summary: {
      agent_bridge_request_packet_export_status: "ready_for_agent_bridge_request_packet_export",
      source_agent_bridge_request_receipt_status: "ready_for_agent_bridge_request_receipt",
      packet_count: 4,
      markdown_packet_count: 4,
      blocked_export_fixture_count: 10,
      request_packet_export_enabled_now: true,
      copy_markdown_allowed_now: true,
      file_export_allowed_now: true,
      request_transport_submission_allowed_now: false,
      provider_automation_allowed_now: false,
      execution_allowed_now: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      validation_error_count: 0,
    },
    agent_request_packet_export_boundary: {
      unsafe_flag_count: 0,
      ready_for_agent_request_packet_copy: true,
      ready_for_desktop_agents_projection: true,
      request_transport_submission_allowed_now: false,
      execution_allowed_now: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
    },
    agent_request_packet_export_rows: [
      { packet_id: "packet.plan", request_id: "request.plan", request_type: "plan_review", request_title: "Plan review", target_runtime_id: "runtime.chatgpt.web_agbrowse", target_capability_id: "capability.chatgpt.agbrowse.web_ai", packet_status: "ready_to_copy", packet_file_name: "plan.md", packet_markdown_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", copy_allowed_now: true, file_export_allowed_now: true },
      { packet_id: "packet.code", request_id: "request.code", request_type: "code_review", request_title: "Code review", target_runtime_id: "runtime.claude_code.opus_max", target_capability_id: "capability.claude.review_lane", packet_status: "ready_to_copy", packet_file_name: "code.md", packet_markdown_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", copy_allowed_now: true, file_export_allowed_now: true },
      { packet_id: "packet.proposal", request_id: "request.proposal", request_type: "implementation_proposal", request_title: "Proposal", target_runtime_id: "runtime.codex.desktop", target_capability_id: "capability.codex.skills.visible_catalog", packet_status: "ready_to_copy", packet_file_name: "proposal.md", packet_markdown_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", copy_allowed_now: true, file_export_allowed_now: true },
      { packet_id: "packet.command", request_id: "request.command", request_type: "command_suggestion", request_title: "Command suggestion", target_runtime_id: "runtime.local.hermes_scripts", target_capability_id: "capability.local.hermes.agent_bridge_manifest", packet_status: "ready_to_copy", packet_file_name: "command.md", packet_markdown_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", copy_allowed_now: true, file_export_allowed_now: true },
    ],
    blocked_export_fixture_rows: [
      { fixture_id: "export.submit_provider", expected_blocker: "transport_submission", observed_blocker: "transport_submission", blocked: true },
    ],
  };
}

function agentBridgeReceiptImportWorkspaceFixture() {
  return {
    schema_version: "agent-bridge-receipt-import-workspace.v1",
    summary: {
      agent_bridge_receipt_import_workspace_status: "ready_for_agent_bridge_receipt_import_workspace",
      source_agent_bridge_request_receipt_status: "ready_for_agent_bridge_request_receipt",
      source_agent_bridge_request_packet_export_status: "ready_for_agent_bridge_request_packet_export",
      import_candidate_count: 4,
      normalized_summary_count: 4,
      blocked_import_fixture_count: 10,
      receipt_import_workspace_enabled_now: true,
      normalized_summary_import_allowed_now: true,
      import_preview_allowed_now: true,
      raw_receipt_storage_allowed: false,
      raw_prompt_storage_allowed: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
      provider_output_authoritative: false,
      validation_error_count: 0,
    },
    agent_receipt_import_boundary: {
      unsafe_flag_count: 0,
      ready_for_agent_receipt_import_workspace: true,
      ready_for_desktop_agents_projection: true,
      raw_receipt_storage_allowed: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
    },
    agent_receipt_import_candidate_rows: [
      { import_candidate_id: "import.plan", receipt_id: "receipt.plan", request_id: "request.plan", packet_id: "packet.plan", request_type: "plan_review", receipt_kind: "external_review_summary", workspace_status: "normalized_preview_ready", normalized_verdict: "approve_with_findings", normalized_summary_only: true, raw_output_included: false, raw_receipt_stored: false, receipt_validated: true, receipt_quarantined: false },
      { import_candidate_id: "import.code", receipt_id: "receipt.code", request_id: "request.code", packet_id: "packet.code", request_type: "code_review", receipt_kind: "external_review_summary", workspace_status: "awaiting_redacted_receipt", normalized_verdict: "missing", normalized_summary_only: true, raw_output_included: false, raw_receipt_stored: false, receipt_validated: false, receipt_quarantined: true },
      { import_candidate_id: "import.proposal", receipt_id: "receipt.proposal", request_id: "request.proposal", packet_id: "packet.proposal", request_type: "implementation_proposal", receipt_kind: "local_work_summary", workspace_status: "awaiting_redacted_receipt", normalized_verdict: "missing", normalized_summary_only: true, raw_output_included: false, raw_receipt_stored: false, receipt_validated: false, receipt_quarantined: true },
      { import_candidate_id: "import.command", receipt_id: "receipt.command", request_id: "request.command", packet_id: "packet.command", request_type: "command_suggestion", receipt_kind: "command_suggestion_summary", workspace_status: "normalized_preview_ready", normalized_verdict: "text_only_command_suggestion", normalized_summary_only: true, raw_output_included: false, raw_receipt_stored: false, receipt_validated: true, receipt_quarantined: false },
    ],
    agent_receipt_normalized_summary_rows: [
      { import_candidate_id: "import.plan", receipt_id: "receipt.plan", request_id: "request.plan", request_type: "plan_review", normalized_verdict: "approve_with_findings", summary_label: "Validated normalized receipt summary", displayable_in_desktop: true },
      { import_candidate_id: "import.code", receipt_id: "receipt.code", request_id: "request.code", request_type: "code_review", normalized_verdict: "missing", summary_label: "Quarantined receipt summary", displayable_in_desktop: true },
      { import_candidate_id: "import.proposal", receipt_id: "receipt.proposal", request_id: "request.proposal", request_type: "implementation_proposal", normalized_verdict: "missing", summary_label: "Quarantined receipt summary", displayable_in_desktop: true },
      { import_candidate_id: "import.command", receipt_id: "receipt.command", request_id: "request.command", request_type: "command_suggestion", normalized_verdict: "text_only_command_suggestion", summary_label: "Validated normalized receipt summary", displayable_in_desktop: true },
    ],
    blocked_import_fixture_rows: [
      { fixture_id: "import.fake_approval", expected_blocker: "approve", observed_blocker: "approve", blocked: true, receipt_quarantined: true },
    ],
  };
}

function agentBridgeExecutionCandidateFixture() {
  return {
    schema_version: "agent-bridge-execution-candidate.v1",
    summary: {
      agent_bridge_execution_candidate_status: "ready_for_agent_bridge_execution_candidate",
      source_agent_bridge_manifest_status: "ready_for_agent_bridge_manifest",
      source_agent_bridge_request_receipt_status: "ready_for_agent_bridge_request_receipt",
      source_controlled_execution_sandbox_status: "ready_for_controlled_execution_sandbox",
      source_human_approved_limited_execution_status: "ready_for_platform_human_approved_limited_execution",
      execution_candidate_count: 5,
      blocked_command_fixture_count: 9,
      gate_count: 10,
      gate_pass_count: 10,
      controlled_execution_candidate_enabled_now: true,
      candidate_queue_enabled_now: true,
      candidate_export_allowed_now: true,
      candidate_validation_allowed_now: true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      dry_run_only: true,
      human_receipt_required_before_execution: true,
      limited_execution_receipt_required: true,
      validation_error_count: 0,
    },
    agent_bridge_execution_boundary: {
      unsafe_flag_count: 0,
      ready_for_limited_execution_gate_projection: true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
    },
    agent_bridge_execution_candidate_rows: [
      { candidate_id: "candidate.manifest", candidate_type: "platform_check", candidate_title: "Manifest check", candidate_status: "candidate_requires_human_execution_receipt", command_text: "npm run platform:agent-bridge-manifest -- --check", command_family: "npm_platform_check", allowlist_match: true, timeout_ms: 120000, sandbox_profile: "repo_local_read_only" },
      { candidate_id: "candidate.request", candidate_type: "platform_check", candidate_title: "Request check", candidate_status: "candidate_requires_human_execution_receipt", command_text: "npm run platform:agent-bridge-request-receipt -- --check", command_family: "npm_platform_check", allowlist_match: true, timeout_ms: 120000, sandbox_profile: "repo_local_read_only" },
      { candidate_id: "candidate.execution", candidate_type: "platform_check", candidate_title: "Execution candidate check", candidate_status: "candidate_requires_human_execution_receipt", command_text: "npm run platform:agent-bridge-execution-candidate -- --check", command_family: "npm_platform_check", allowlist_match: true, timeout_ms: 120000, sandbox_profile: "repo_local_read_only" },
      { candidate_id: "candidate.tests", candidate_type: "targeted_test", candidate_title: "Agent tests", candidate_status: "candidate_requires_human_execution_receipt", command_text: "node --test test/agent-bridge-manifest.test.mjs test/agent-bridge-request-receipt.test.mjs test/agent-bridge-execution-candidate.test.mjs", command_family: "node_test", allowlist_match: true, timeout_ms: 180000, sandbox_profile: "repo_local_read_only" },
      { candidate_id: "candidate.diff", candidate_type: "diff_check", candidate_title: "Diff check", candidate_status: "candidate_requires_human_execution_receipt", command_text: "git diff --check", command_family: "git_diff_check", allowlist_match: true, timeout_ms: 30000, sandbox_profile: "repo_local_read_only" },
    ],
    blocked_command_fixture_rows: [
      { fixture_id: "blocked.git_push", command_text: "git push origin main", expected_protected_action_type: "git_push", observed_protected_action_type: "git_push", blocked: true, blocked_reason: "blocked" },
    ],
    agent_bridge_execution_gate_rows: Array.from({ length: 10 }, (_item, index) => ({
      gate_id: `gate.${index + 1}`,
      gate_status: "pass",
      description: "fixture gate",
      current_verdict: "pass",
      blocks_execution_when_failed: true,
    })),
  };
}

function projectContractStateFixture() {
  const ids = ["blocked", "stale", "review", "owner"];
  const stateById = {
    blocked: ["blocked", "failed_validation", "validation_failed", 2],
    stale: ["stale", "stale_artifact", "source_stale", 1],
    review: ["review_needed", "missing_review", "review_missing", 1],
    owner: ["owner_action_needed", "missing_owner_decision", "owner_decision_missing", 1],
  };
  return {
    schema_version: "project-operating-contract.v1",
    summary: {
      project_operating_contract_status: "ready_for_project_operating_contract",
      project_count: 4,
      ready_project_count: 0,
      blocked_project_count: 4,
      review_needed_project_count: 1,
      stale_project_count: 1,
      validation_error_count: 0,
    },
    project_operating_boundary: {
      ready_for_desktop_multi_project_projection: true,
      unsafe_flag_count: 0,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      protected_closeout_enabled: false,
    },
    project_identity_rows: ids.map((id) => ({
      project_id: `project.${id}`,
      project_name: `${id} project`,
      domain_pack: "personal-dev",
    })),
    project_progress_rows: ids.map((id, index) => ({
      project_id: `project.${id}`,
      current_goal_id: `goal.${id}`,
      current_phase_range: `TUW-${String(index + 1).padStart(3, "0")}`,
      risk_level: id === "blocked" ? "high" : "medium",
      completed_units: 1,
      remaining_units: 2,
      next_action_count: 1,
      progress_confidence: id === "stale" ? "low" : "medium",
    })),
    project_source_inventory_rows: ids.map((id) => ({
      project_id: `project.${id}`,
      source_artifact_path: "artifacts/project-operating-contract/latest/project-operating-contract.json",
      source_artifact_sha256: `sha256:${id}`,
      source_generated_at: "2026-06-01T00:00:00.000Z",
      source_parse_status: "parsed",
    })),
    project_authority_boundary_rows: ids.map((id) => ({
      project_id: `project.${id}`,
      unsafe_flag_count: 0,
      cross_project_data_mixing_allowed: false,
    })),
    project_freshness_rows: ids.map((id) => ({
      project_id: `project.${id}`,
      source_age_days: id === "stale" ? 21 : 1,
      freshness_status: id === "stale" ? "stale" : "fresh",
      refresh_required: id === "stale",
      source_hash: `sha256:${id}`,
    })),
    project_next_action_taxonomy_rows: [
      { action_type: "inspect", action_class: "safe_read_only", allowed: true },
      { action_type: "copy_command", action_class: "safe_read_only", allowed: true },
      { action_type: "open_artifact", action_class: "safe_read_only", allowed: true },
      { action_type: "prepare_review_packet", action_class: "safe_read_only", allowed: true },
      { action_type: "draft_owner_decision", action_class: "safe_read_only", allowed: true },
      { action_type: "refresh_artifact", action_class: "safe_read_only", allowed: true },
      { action_type: "deploy", action_class: "forbidden_protected", allowed: false },
    ],
    project_state_rows: ids.map((id) => {
      const [projectState, blockerType, stateReason, blockerCount] = stateById[id];
      return {
        project_id: `project.${id}`,
        project_state: projectState,
        state_reason: stateReason,
        blocker_type: blockerType,
        blocker_count: blockerCount,
        validation_ready: id !== "blocked",
        review_boundary_ready: id !== "review",
        freshness_status: id === "stale" ? "stale" : "fresh",
        progress_confidence: id === "stale" ? "low" : "medium",
        next_allowed_action: id === "owner" ? "draft owner decision" : id === "review" ? "prepare review packet" : id === "stale" ? "refresh artifact request draft only" : "inspect blockers",
      };
    }),
  };
}
