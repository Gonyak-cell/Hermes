import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_OUT_DIR = "artifacts/implementation-patch-capture/latest";
export const DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  devLaneLedgerPath: "artifacts/dev-lane-ledger/latest/dev-lane-ledger.json",
  scopeFreezeGatePath: "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json",
  runtimeArtifactCapturePath: "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json",
};

const CONTRACT_ID = "implementation-patch-capture.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "dev_lane_runtime_diff_and_scope_file_boundary_records";
const DESKTOP_SURFACE_POLICY = "read_only_implementation_patch_capture_surface";

export async function runImplementationPatchCapture(options = {}) {
  const result = await buildImplementationPatchCapture(options);
  if (options.write !== false) await writeImplementationPatchCapture(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Implementation patch capture validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildImplementationPatchCapture(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const devLaneLedger = await readJsonOrError(inputs.dev_lane_ledger_path);
  const scopeFreezeGate = await readJsonOrError(inputs.scope_freeze_gate_path);
  const runtimeArtifactCapture = await readJsonOrError(inputs.runtime_artifact_capture_path);
  const devLaneArtifact = devLaneLedger.value ?? {};
  const scopeFreezeArtifact = scopeFreezeGate.value ?? {};
  const runtimeArtifact = runtimeArtifactCapture.value ?? {};
  const touchedFiles = buildTouchedFileRecords(scopeFreezeArtifact.scope_file_boundaries ?? [], generatedAt);
  const generatedArtifacts = buildGeneratedArtifacts(runtimeArtifact, generatedAt);
  const diffCaptures = buildImplementationDiffCaptures(runtimeArtifact.diff_capture_records ?? [], touchedFiles, generatedArtifacts, generatedAt);
  const patchRecords = buildImplementationPatchRecords(devLaneArtifact.dev_lanes ?? [], diffCaptures, touchedFiles, generatedArtifacts, generatedAt);
  const runLedgerBindings = buildRunLedgerBindings(patchRecords, diffCaptures, generatedArtifacts, generatedAt);
  const desktopBoundary = buildDesktopBoundary({ patchRecords, diffCaptures, touchedFiles, generatedArtifacts, runLedgerBindings, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    devLaneLedger: devLaneArtifact,
    devLaneLedgerError: devLaneLedger.error,
    scopeFreezeGate: scopeFreezeArtifact,
    scopeFreezeGateError: scopeFreezeGate.error,
    runtimeArtifactCapture: runtimeArtifact,
    runtimeArtifactCaptureError: runtimeArtifactCapture.error,
    patchRecords,
    diffCaptures,
    touchedFiles,
    generatedArtifacts,
    runLedgerBindings,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeImplementationPatchCapture({
    devLaneLedger: devLaneArtifact,
    scopeFreezeGate: scopeFreezeArtifact,
    runtimeArtifactCapture: runtimeArtifact,
    patchRecords,
    diffCaptures,
    touchedFiles,
    generatedArtifacts,
    runLedgerBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    implementation_patch_capture_id: `implementation-patch-capture.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    implementation_patch_capture_status: summary.implementation_patch_capture_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, devLaneLedger, scopeFreezeGate, runtimeArtifactCapture }),
    implementation_patch_capture_contract: buildContract(generatedAt),
    source_dev_lane_ledger: buildSourceDevLaneLedger(devLaneArtifact),
    source_scope_freeze_gate: buildSourceScopeFreezeGate(scopeFreezeArtifact),
    source_runtime_artifact_capture: buildSourceRuntimeArtifactCapture(runtimeArtifact),
    implementation_patch_records: patchRecords,
    implementation_diff_captures: diffCaptures,
    implementation_touched_files: touchedFiles,
    implementation_generated_artifacts: generatedArtifacts,
    implementation_run_ledger_bindings: runLedgerBindings,
    implementation_patch_desktop_boundary: desktopBoundary,
    implementation_patch_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderImplementationPatchCaptureMarkdown(result),
  };
}

export async function writeImplementationPatchCapture(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableImplementationPatchCapture(result);
  await writeJson(path.join(outDir, "implementation-patch-capture.json"), serializable);
  await writeJson(path.join(outDir, "implementation-patch-records.json"), {
    schema_version: "implementation-patch-records.v1",
    generated_at: result.generated_at,
    implementation_patch_record_count: result.implementation_patch_records.length,
    implementation_patch_records: result.implementation_patch_records,
  });
  await writeJson(path.join(outDir, "implementation-diff-captures.json"), {
    schema_version: "implementation-diff-captures.v1",
    generated_at: result.generated_at,
    implementation_diff_capture_count: result.implementation_diff_captures.length,
    implementation_diff_captures: result.implementation_diff_captures,
  });
  await writeJson(path.join(outDir, "implementation-touched-files.json"), {
    schema_version: "implementation-touched-files.v1",
    generated_at: result.generated_at,
    implementation_touched_file_count: result.implementation_touched_files.length,
    implementation_touched_files: result.implementation_touched_files,
  });
  await writeJson(path.join(outDir, "implementation-generated-artifacts.json"), {
    schema_version: "implementation-generated-artifacts.v1",
    generated_at: result.generated_at,
    implementation_generated_artifact_count: result.implementation_generated_artifacts.length,
    implementation_generated_artifacts: result.implementation_generated_artifacts,
  });
  await writeJson(path.join(outDir, "implementation-run-ledger-bindings.json"), {
    schema_version: "implementation-run-ledger-bindings.v1",
    generated_at: result.generated_at,
    implementation_run_ledger_binding_count: result.implementation_run_ledger_bindings.length,
    implementation_run_ledger_bindings: result.implementation_run_ledger_bindings,
  });
  await writeJson(path.join(outDir, "implementation-patch-desktop-boundary.json"), {
    schema_version: "implementation-patch-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    implementation_patch_desktop_boundary: result.implementation_patch_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "implementation-patch-capture-validation-report.v1",
    generated_at: result.generated_at,
    implementation_patch_capture_id: result.implementation_patch_capture_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runImplementationPatchCaptureCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runImplementationPatchCapture(args);
    console.log(`Implementation patch capture ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.implementation_patch_capture_status}`);
    console.log(`Patch records: ${result.summary.patch_record_count}`);
    console.log(`Diff captures: ${result.summary.diff_capture_count}`);
    console.log(`Touched files: ${result.summary.touched_file_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "implementation-patch-capture-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    capture_rule: "implementation_patch_records_bind_dev_lanes_to_runtime_diff_captures_without_applying_patches",
    touched_file_rule: "touched_files_are_projected_from_frozen_scope_file_boundaries",
    generated_artifact_rule: "generated_artifacts_are_projected_from_runtime_artifact_capture_records",
    run_ledger_rule: "each_patch_record_is_bound_to_agent_run_workflow_run_and_output_artifact_identifiers",
    execution_rule: "capture_does_not_run_git_commands_mutate_files_invoke_external_agents_accept_plans_or_apply_patches",
    desktop_companion_rule: "desktop_companion_reads_patch_diff_file_artifact_binding_and_validation_status_only",
    mutation_policy: "diff_review_canonical_tests_protected_scan_merge_release_and_client_facing_outputs_remain_follow_on_human_gated_actions",
    created_at: generatedAt,
  };
}

function buildSourceDevLaneLedger(devLaneLedger) {
  return {
    schema_version: "source-dev-lane-ledger.v1",
    dev_lane_ledger_id: devLaneLedger.dev_lane_ledger_id ?? null,
    dev_lane_ledger_status: devLaneLedger.summary?.dev_lane_ledger_status ?? devLaneLedger.dev_lane_ledger_status ?? "unknown",
    dev_lane_count: devLaneLedger.summary?.dev_lane_count ?? devLaneLedger.dev_lanes?.length ?? 0,
    provisioned_dev_lane_count: devLaneLedger.summary?.provisioned_dev_lane_count ?? (devLaneLedger.dev_lanes ?? []).filter((lane) => lane.lane_status === "provisioned").length,
    branch_record_count: devLaneLedger.summary?.branch_record_count ?? devLaneLedger.dev_lane_branch_records?.length ?? 0,
    worktree_record_count: devLaneLedger.summary?.worktree_record_count ?? devLaneLedger.dev_lane_worktree_records?.length ?? 0,
    git_command_executed_count: devLaneLedger.summary?.git_command_executed_count ?? 0,
    filesystem_mutation_performed_count: devLaneLedger.summary?.filesystem_mutation_performed_count ?? 0,
    patch_application_performed_count: devLaneLedger.summary?.patch_application_performed_count ?? 0,
    desktop_read_only: devLaneLedger.summary?.desktop_read_only ?? false,
    source_hash: hashObject({
      dev_lane_ledger_id: devLaneLedger.dev_lane_ledger_id ?? null,
      dev_lanes: devLaneLedger.dev_lanes ?? [],
      dev_lane_branch_records: devLaneLedger.dev_lane_branch_records ?? [],
      dev_lane_worktree_records: devLaneLedger.dev_lane_worktree_records ?? [],
    }),
  };
}

function buildSourceScopeFreezeGate(scopeFreezeGate) {
  return {
    schema_version: "source-scope-freeze-gate.v1",
    scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
    scope_freeze_gate_status: scopeFreezeGate.summary?.scope_freeze_gate_status ?? scopeFreezeGate.scope_freeze_gate_status ?? "unknown",
    selected_scope_status: scopeFreezeGate.summary?.selected_scope_status ?? scopeFreezeGate.selected_plan_scope?.selected_scope_status ?? "unknown",
    frozen_scope_item_count: scopeFreezeGate.summary?.frozen_scope_item_count ?? scopeFreezeGate.frozen_scope_items?.length ?? 0,
    scope_file_boundary_count: scopeFreezeGate.summary?.scope_file_boundary_count ?? scopeFreezeGate.scope_file_boundaries?.length ?? 0,
    in_scope_file_boundary_count: scopeFreezeGate.summary?.in_scope_file_boundary_count ?? (scopeFreezeGate.scope_file_boundaries ?? []).filter((boundary) => boundary.in_frozen_scope).length,
    protected_file_rule_count: scopeFreezeGate.summary?.protected_file_rule_count ?? scopeFreezeGate.scope_protected_file_rules?.length ?? 0,
    protected_file_write_allowed_without_approval: scopeFreezeGate.summary?.protected_file_write_allowed_without_approval ?? false,
    scope_freeze_performed_count: scopeFreezeGate.summary?.scope_freeze_performed_count ?? 0,
    source_hash: hashObject({
      scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
      scope_file_boundaries: scopeFreezeGate.scope_file_boundaries ?? [],
      scope_freeze_decision: scopeFreezeGate.scope_freeze_decision ?? null,
    }),
  };
}

function buildSourceRuntimeArtifactCapture(runtimeArtifactCapture) {
  return {
    schema_version: "source-runtime-artifact-capture.v1",
    runtime_artifact_capture_id: runtimeArtifactCapture.runtime_artifact_capture_id ?? null,
    runtime_artifact_capture_status: runtimeArtifactCapture.summary?.runtime_artifact_capture_status ?? "unknown",
    artifact_capture_record_count: runtimeArtifactCapture.summary?.artifact_capture_record_count ?? runtimeArtifactCapture.artifact_capture_records?.length ?? 0,
    diff_capture_record_count: runtimeArtifactCapture.summary?.diff_capture_record_count ?? runtimeArtifactCapture.diff_capture_records?.length ?? 0,
    bound_diff_capture_count: runtimeArtifactCapture.summary?.bound_diff_capture_count ?? (runtimeArtifactCapture.diff_capture_records ?? []).filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    output_artifact_capture_binding_count: runtimeArtifactCapture.summary?.output_artifact_capture_binding_count ?? runtimeArtifactCapture.output_artifact_capture_bindings?.length ?? 0,
    diff_apply_allowed: runtimeArtifactCapture.summary?.diff_apply_allowed ?? false,
    artifact_write_allowed: runtimeArtifactCapture.summary?.artifact_write_allowed ?? false,
    desktop_read_only: runtimeArtifactCapture.summary?.desktop_read_only ?? false,
    source_hash: hashObject({
      runtime_artifact_capture_id: runtimeArtifactCapture.runtime_artifact_capture_id ?? null,
      diff_capture_records: runtimeArtifactCapture.diff_capture_records ?? [],
      artifact_capture_records: runtimeArtifactCapture.artifact_capture_records ?? [],
    }),
  };
}

function buildImplementationPatchRecords(devLanes, diffCaptures, touchedFiles, generatedArtifacts, generatedAt) {
  const diffByRuntime = new Map(diffCaptures.map((record) => [record.runtime_id, record]));
  const generatedByOutput = groupBy(generatedArtifacts, "output_artifact_id");
  return devLanes.map((lane, index) => {
    const diffCapture = diffByRuntime.get(lane.agent) ?? {};
    const generatedArtifactIds = (generatedByOutput.get(diffCapture.output_artifact_id) ?? []).map((artifact) => artifact.generated_artifact_id);
    const record = {
      schema_version: "implementation-patch-record.v1",
      implementation_patch_record_id: `implementation-patch-record.${slugify(lane.agent)}.${slugify(lane.source_selected_scope_id ?? lane.dev_lane_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      agent: lane.agent ?? "unknown",
      runtime_id: lane.runtime_id ?? lane.agent ?? "unknown",
      adapter_id: lane.adapter_id ?? diffCapture.adapter_id ?? null,
      patch_record_status: diffCapture.diff_capture_status === "captured" ? "captured" : "blocked",
      patch_capture_kind: lane.agent === "codex" ? "codex_patch_capture" : "claude_code_diff_capture",
      patch_artifact_status: "captured_as_unapplied_artifact",
      source_dev_lane_id: lane.dev_lane_id ?? null,
      source_branch_record_id: lane.branch_record_id ?? null,
      source_worktree_record_id: lane.worktree_record_id ?? null,
      branch_name: lane.branch_name ?? null,
      worktree_path: lane.worktree_path ?? null,
      source_diff_capture_record_id: diffCapture.source_diff_capture_record_id ?? null,
      implementation_diff_capture_id: diffCapture.implementation_diff_capture_id ?? null,
      agent_run_id: diffCapture.agent_run_id ?? null,
      workflow_run_id: diffCapture.workflow_run_id ?? null,
      output_artifact_id: diffCapture.output_artifact_id ?? null,
      output_artifact_binding_status: diffCapture.output_artifact_binding_status ?? "missing_output_artifact",
      touched_file_count: touchedFiles.length,
      in_scope_touched_file_count: touchedFiles.filter((file) => file.in_frozen_scope).length,
      protected_touched_file_count: touchedFiles.filter((file) => file.protected_file_detected).length,
      generated_artifact_count: generatedArtifactIds.length,
      generated_artifact_ids: generatedArtifactIds,
      diff_review_gate_required: true,
      canonical_test_gate_required: true,
      protected_file_scan_gate_required: true,
      human_merge_approval_gate_required: true,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      protected_file_write_allowed_without_approval: false,
      human_review_required: true,
      runtime_self_report_trusted: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      human_review_note: "Implementation patch capture records diff and artifact references only. Diff review, canonical tests, protected file scan, patch application, merge, release, and legal/client-facing outputs remain human-gated.",
      captured_at: generatedAt,
    };
    return {
      ...record,
      patch_record_hash: hashObject(record),
    };
  });
}

function buildImplementationDiffCaptures(diffCaptureRecords, touchedFiles, generatedArtifacts, generatedAt) {
  const personalDevDiffs = diffCaptureRecords.filter((record) => ["claude_code", "codex"].includes(record.runtime_id));
  const generatedByOutput = groupBy(generatedArtifacts, "output_artifact_id");
  return personalDevDiffs.map((record, index) => {
    const generatedArtifactIds = (generatedByOutput.get(record.output_artifact_id) ?? []).map((artifact) => artifact.generated_artifact_id);
    const capture = {
      schema_version: "implementation-diff-capture.v1",
      implementation_diff_capture_id: `implementation-diff-capture.${slugify(record.diff_capture_record_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      agent: normalizeRuntimeAgent(record.runtime_id),
      runtime_id: record.runtime_id ?? "unknown",
      adapter_id: record.adapter_id ?? null,
      diff_capture_status: record.capture_status === "bound" && record.output_artifact_binding_status === "bound_to_output_artifact" ? "captured" : "blocked",
      diff_capture_kind: record.diff_capture_kind ?? "unknown",
      source_diff_capture_record_id: record.diff_capture_record_id ?? null,
      diff_gate_contract_id: record.diff_gate_contract_id ?? null,
      agent_run_id: record.agent_run_id ?? null,
      workflow_run_id: record.workflow_run_id ?? null,
      change_target: record.change_target ?? "unknown",
      patch_trust: record.patch_trust ?? "untrusted_until_verified",
      output_artifact_id: record.output_artifact_id ?? null,
      output_artifact_binding_status: record.output_artifact_binding_status ?? "missing_output_artifact",
      generated_artifact_ids: generatedArtifactIds,
      touched_file_count: touchedFiles.length,
      in_scope_touched_file_count: touchedFiles.filter((file) => file.in_frozen_scope).length,
      protected_touched_file_count: touchedFiles.filter((file) => file.protected_file_detected).length,
      direct_apply_allowed: false,
      direct_merge_allowed: false,
      patch_application_performed: false,
      protected_path_write_allowed: false,
      human_review_required: true,
      required_gates: unique([...(record.required_gates ?? []), "diff_review_gate", "canonical_test_gate", "protected_file_scan_gate", "human_merge_approval_gate"]),
      gate_binding_status: record.gate_binding_status ?? "ready",
      runtime_self_report_trusted: false,
      captured_at: generatedAt,
    };
    return {
      ...capture,
      diff_capture_hash: hashObject(capture),
    };
  });
}

function buildTouchedFileRecords(scopeFileBoundaries, generatedAt) {
  return scopeFileBoundaries.map((boundary, index) => {
    const record = {
      schema_version: "implementation-touched-file.v1",
      touched_file_id: `implementation-touched-file.${slugify(boundary.file_path)}`,
      source_scope_file_boundary_id: boundary.scope_file_boundary_id ?? null,
      sequence: index + 1,
      file_path: boundary.file_path ?? null,
      touched_file_status: boundary.in_frozen_scope ? "captured_in_scope" : "blocked_out_of_scope",
      file_boundary_status: boundary.file_boundary_status ?? "unknown",
      in_frozen_scope: Boolean(boundary.in_frozen_scope),
      protected_file_detected: Boolean(boundary.protected_file_detected),
      protected_write_requires_explicit_approval: Boolean(boundary.protected_write_requires_explicit_approval),
      write_allowed_before_approval: Boolean(boundary.write_allowed_before_approval),
      mutation_allowed_before_approval: Boolean(boundary.mutation_allowed_before_approval),
      diff_review_gate_required: Boolean(boundary.diff_review_gate_required ?? true),
      canonical_test_gate_required: Boolean(boundary.canonical_test_gate_required ?? true),
      human_merge_approval_gate_required: Boolean(boundary.human_merge_approval_gate_required ?? true),
      protected_action_executed: Boolean(boundary.protected_action_executed),
      captured_at: generatedAt,
    };
    return {
      ...record,
      touched_file_hash: hashObject(record),
    };
  });
}

function buildGeneratedArtifacts(runtimeArtifactCapture, generatedAt) {
  const records = (runtimeArtifactCapture.artifact_capture_records ?? []).filter((record) => record.capability_id === CAPABILITY_ID);
  const fallbackRecords = records.length > 0
    ? records
    : uniqueBy((runtimeArtifactCapture.diff_capture_records ?? []).filter((record) => ["claude_code", "codex"].includes(record.runtime_id)), "output_artifact_id").map((record) => ({
      artifact_capture_record_id: null,
      runtime_artifact_id: null,
      agent_run_id: record.agent_run_id ?? null,
      workflow_run_id: record.workflow_run_id ?? null,
      capability_id: CAPABILITY_ID,
      runtime_id: record.runtime_id ?? "unknown",
      artifact_id: record.output_artifact_id ?? null,
      artifact_type: "patch_artifact",
      artifact_uri: null,
      content_hash: null,
      output_artifact_id: record.output_artifact_id ?? null,
      output_artifact_binding_status: record.output_artifact_binding_status ?? "missing_output_artifact",
      delivery_state: "blocked_pending_approval",
      approval_status: "pending",
      blocking_gate_ids: record.required_gates ?? [],
    }));
  return fallbackRecords.map((record, index) => {
    const artifact = {
      schema_version: "implementation-generated-artifact.v1",
      generated_artifact_id: `implementation-generated-artifact.${slugify(record.artifact_capture_record_id ?? record.output_artifact_id ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      generated_artifact_status: record.output_artifact_binding_status === "bound_to_output_artifact" ? "captured" : "blocked",
      source_artifact_capture_record_id: record.artifact_capture_record_id ?? null,
      runtime_artifact_id: record.runtime_artifact_id ?? null,
      agent_run_id: record.agent_run_id ?? null,
      workflow_run_id: record.workflow_run_id ?? null,
      capability_id: record.capability_id ?? CAPABILITY_ID,
      runtime_id: record.runtime_id ?? "unknown",
      artifact_id: record.artifact_id ?? null,
      artifact_type: record.artifact_type ?? "unknown",
      artifact_uri: record.artifact_uri ?? null,
      content_hash: record.content_hash ?? null,
      output_artifact_id: record.output_artifact_id ?? null,
      output_artifact_binding_status: record.output_artifact_binding_status ?? "missing_output_artifact",
      delivery_state: record.delivery_state ?? "blocked_pending_approval",
      approval_status: record.approval_status ?? null,
      blocking_gate_ids: record.blocking_gate_ids ?? [],
      runtime_self_report_trusted: false,
      captured_at: generatedAt,
    };
    return {
      ...artifact,
      generated_artifact_hash: hashObject(artifact),
    };
  });
}

function buildRunLedgerBindings(patchRecords, diffCaptures, generatedArtifacts, generatedAt) {
  const diffById = new Map(diffCaptures.map((record) => [record.implementation_diff_capture_id, record]));
  const generatedByOutput = groupBy(generatedArtifacts, "output_artifact_id");
  return patchRecords.map((patchRecord, index) => {
    const diffCapture = diffById.get(patchRecord.implementation_diff_capture_id) ?? {};
    const generatedIds = (generatedByOutput.get(patchRecord.output_artifact_id) ?? []).map((artifact) => artifact.generated_artifact_id);
    const binding = {
      schema_version: "implementation-run-ledger-binding.v1",
      implementation_run_ledger_binding_id: `implementation-run-ledger-binding.${slugify(patchRecord.implementation_patch_record_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      run_ledger_binding_status: patchRecord.patch_record_status === "captured" && diffCapture.diff_capture_status === "captured" ? "bound" : "blocked",
      binding_kind: "dev_lane_patch_to_runtime_run_and_output_artifact",
      implementation_patch_record_id: patchRecord.implementation_patch_record_id,
      implementation_diff_capture_id: patchRecord.implementation_diff_capture_id,
      source_diff_capture_record_id: patchRecord.source_diff_capture_record_id,
      source_dev_lane_id: patchRecord.source_dev_lane_id,
      agent: patchRecord.agent,
      runtime_id: patchRecord.runtime_id,
      agent_run_id: patchRecord.agent_run_id,
      workflow_run_id: patchRecord.workflow_run_id,
      output_artifact_id: patchRecord.output_artifact_id,
      generated_artifact_ids: generatedIds,
      generated_artifact_count: generatedIds.length,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      human_review_required: true,
      bound_at: generatedAt,
    };
    return {
      ...binding,
      run_ledger_binding_hash: hashObject(binding),
    };
  });
}

function buildDesktopBoundary({ patchRecords, diffCaptures, touchedFiles, generatedArtifacts, runLedgerBindings, generatedAt }) {
  return {
    schema_version: "implementation-patch-desktop-boundary.v1",
    boundary_id: "implementation-patch-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    patch_application_allowed: false,
    git_command_allowed: false,
    filesystem_mutation_allowed: false,
    protected_file_write_allowed: false,
    runtime_execution_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    merge_allowed: false,
    release_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    visible_collections: ["implementation_patch_records", "implementation_diff_captures", "implementation_touched_files", "implementation_generated_artifacts", "implementation_run_ledger_bindings", "validation_items"],
    denied_actions: ["run_git_diff", "apply_patch", "write_file", "write_protected_file", "invoke_agent", "accept_plan", "merge_branch", "release"],
    patch_record_count: patchRecords.length,
    diff_capture_count: diffCaptures.length,
    touched_file_count: touchedFiles.length,
    generated_artifact_count: generatedArtifacts.length,
    run_ledger_binding_count: runLedgerBindings.length,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  devLaneLedger,
  devLaneLedgerError,
  scopeFreezeGate,
  scopeFreezeGateError,
  runtimeArtifactCapture,
  runtimeArtifactCaptureError,
  patchRecords,
  diffCaptures,
  touchedFiles,
  generatedArtifacts,
  runLedgerBindings,
  desktopBoundary,
}) {
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:patch-capture"]), "package.json exposes personal-dev:patch-capture."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P221") && String(roadmapText ?? "").includes("implementation patch capture"), "Final completion ledger declares P221 implementation patch capture."),
    checkpoint("dev_lane_ledger_available", !devLaneLedgerError && Boolean(devLaneLedger?.schema_version), "Dev Lane Ledger artifact is available."),
    checkpoint("dev_lane_ledger_complete", devLaneLedger?.summary?.dev_lane_ledger_status === "complete" && devLaneLedger?.summary?.validation_error_count === 0, "Dev Lane Ledger is complete before patch capture."),
    checkpoint("scope_freeze_gate_available", !scopeFreezeGateError && Boolean(scopeFreezeGate?.schema_version), "Scope Freeze Gate artifact is available."),
    checkpoint("scope_freeze_gate_complete", scopeFreezeGate?.summary?.scope_freeze_gate_status === "complete" && scopeFreezeGate?.summary?.validation_error_count === 0, "Scope Freeze Gate is complete before patch capture."),
    checkpoint("runtime_artifact_capture_available", !runtimeArtifactCaptureError && Boolean(runtimeArtifactCapture?.schema_version), "Runtime Artifact Capture artifact is available."),
    checkpoint("runtime_artifact_capture_complete", runtimeArtifactCapture?.summary?.runtime_artifact_capture_status === "complete" && runtimeArtifactCapture?.summary?.diff_apply_allowed === false && runtimeArtifactCapture?.summary?.validation_error_count === 0, "Runtime Artifact Capture provides human-gated diff captures."),
    checkpoint("patch_records_captured", patchRecords.length === 2 && patchRecords.every((record) => record.patch_record_status === "captured"), "Claude Code and Codex patch records are captured."),
    checkpoint("diff_captures_bound", diffCaptures.length === 2 && diffCaptures.every((record) => record.diff_capture_status === "captured" && record.output_artifact_binding_status === "bound_to_output_artifact" && record.direct_apply_allowed === false && record.direct_merge_allowed === false), "Diff captures are output-bound and cannot be applied directly."),
    checkpoint("touched_files_in_scope", touchedFiles.length > 0 && touchedFiles.every((record) => record.touched_file_status === "captured_in_scope" && record.write_allowed_before_approval === false), "Touched files are projected from frozen scope boundaries."),
    checkpoint("generated_artifacts_captured", generatedArtifacts.length > 0 && generatedArtifacts.every((record) => record.generated_artifact_status === "captured" && record.output_artifact_binding_status === "bound_to_output_artifact"), "Generated artifacts are captured and output-bound."),
    checkpoint("run_ledger_bindings_bound", runLedgerBindings.length === patchRecords.length && runLedgerBindings.every((record) => record.run_ledger_binding_status === "bound"), "Patch records are bound to run ledger identifiers."),
    checkpoint("no_patch_application_or_mutation", patchRecords.every((record) => record.patch_application_performed === false && record.git_command_executed === false && record.filesystem_mutation_performed === false && record.external_agent_invocation_performed === false && record.plan_acceptance_performed === false && record.protected_mutation_performed === false), "Patch capture does not apply patches, run git commands, invoke agents, accept plans, or mutate files."),
    checkpoint("protected_writes_blocked", patchRecords.every((record) => record.protected_file_write_allowed_without_approval === false) && touchedFiles.every((record) => record.mutation_allowed_before_approval === false), "Protected and pre-approval writes remain blocked."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.patch_application_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot apply patches."),
  ];
}

function summarizeImplementationPatchCapture({
  devLaneLedger,
  scopeFreezeGate,
  runtimeArtifactCapture,
  patchRecords,
  diffCaptures,
  touchedFiles,
  generatedArtifacts,
  runLedgerBindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    implementation_patch_capture_status: validation.valid ? "complete" : "blocked",
    implementation_patch_capture_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_dev_lane_ledger_id: devLaneLedger.dev_lane_ledger_id ?? null,
    source_dev_lane_ledger_status: devLaneLedger.summary?.dev_lane_ledger_status ?? devLaneLedger.dev_lane_ledger_status ?? "unknown",
    source_scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
    source_scope_freeze_gate_status: scopeFreezeGate.summary?.scope_freeze_gate_status ?? scopeFreezeGate.scope_freeze_gate_status ?? "unknown",
    source_runtime_artifact_capture_id: runtimeArtifactCapture.runtime_artifact_capture_id ?? null,
    source_runtime_artifact_capture_status: runtimeArtifactCapture.summary?.runtime_artifact_capture_status ?? "unknown",
    source_runtime_diff_capture_count: runtimeArtifactCapture.summary?.diff_capture_record_count ?? runtimeArtifactCapture.diff_capture_records?.length ?? 0,
    source_bound_runtime_diff_capture_count: runtimeArtifactCapture.summary?.bound_diff_capture_count ?? 0,
    source_generated_artifact_count: runtimeArtifactCapture.summary?.artifact_capture_record_count ?? runtimeArtifactCapture.artifact_capture_records?.length ?? 0,
    selected_scope_status: scopeFreezeGate.summary?.selected_scope_status ?? scopeFreezeGate.selected_plan_scope?.selected_scope_status ?? "unknown",
    scope_freeze_performed_count: scopeFreezeGate.summary?.scope_freeze_performed_count ?? 0,
    frozen_scope_item_count: scopeFreezeGate.summary?.frozen_scope_item_count ?? scopeFreezeGate.frozen_scope_items?.length ?? 0,
    scope_file_boundary_count: scopeFreezeGate.summary?.scope_file_boundary_count ?? scopeFreezeGate.scope_file_boundaries?.length ?? 0,
    protected_file_rule_count: scopeFreezeGate.summary?.protected_file_rule_count ?? scopeFreezeGate.scope_protected_file_rules?.length ?? 0,
    patch_record_count: patchRecords.length,
    captured_patch_record_count: patchRecords.filter((record) => record.patch_record_status === "captured").length,
    claude_code_patch_record_count: patchRecords.filter((record) => record.agent === "claude_code").length,
    codex_patch_record_count: patchRecords.filter((record) => record.agent === "codex").length,
    diff_capture_count: diffCaptures.length,
    captured_diff_capture_count: diffCaptures.filter((record) => record.diff_capture_status === "captured").length,
    output_bound_diff_capture_count: diffCaptures.filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    touched_file_count: touchedFiles.length,
    in_scope_touched_file_count: touchedFiles.filter((record) => record.in_frozen_scope).length,
    protected_touched_file_count: touchedFiles.filter((record) => record.protected_file_detected).length,
    write_allowed_before_approval_count: touchedFiles.filter((record) => record.write_allowed_before_approval).length,
    mutation_allowed_before_approval_count: touchedFiles.filter((record) => record.mutation_allowed_before_approval).length,
    generated_artifact_count: generatedArtifacts.length,
    captured_generated_artifact_count: generatedArtifacts.filter((record) => record.generated_artifact_status === "captured").length,
    output_bound_generated_artifact_count: generatedArtifacts.filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    run_ledger_binding_count: runLedgerBindings.length,
    bound_run_ledger_binding_count: runLedgerBindings.filter((record) => record.run_ledger_binding_status === "bound").length,
    patch_application_performed_count: patchRecords.filter((record) => record.patch_application_performed).length + diffCaptures.filter((record) => record.patch_application_performed).length + runLedgerBindings.filter((record) => record.patch_application_performed).length,
    git_command_executed_count: patchRecords.filter((record) => record.git_command_executed).length + runLedgerBindings.filter((record) => record.git_command_executed).length,
    filesystem_mutation_performed_count: patchRecords.filter((record) => record.filesystem_mutation_performed).length + runLedgerBindings.filter((record) => record.filesystem_mutation_performed).length,
    protected_file_write_allowed_without_approval: patchRecords.some((record) => record.protected_file_write_allowed_without_approval),
    protected_mutation_performed_count: patchRecords.filter((record) => record.protected_mutation_performed).length + runLedgerBindings.filter((record) => record.protected_mutation_performed).length,
    external_agent_invocation_performed_count: patchRecords.filter((record) => record.external_agent_invocation_performed).length + runLedgerBindings.filter((record) => record.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: patchRecords.filter((record) => record.plan_acceptance_performed).length + runLedgerBindings.filter((record) => record.plan_acceptance_performed).length,
    human_review_required: patchRecords.every((record) => record.human_review_required),
    runtime_self_report_trusted: patchRecords.some((record) => record.runtime_self_report_trusted),
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_filesystem_mutation_allowed: desktopBoundary.filesystem_mutation_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_merge_allowed: desktopBoundary.merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    raw_secret_material_exposed: desktopBoundary.raw_secret_material_exposed,
    provider_key_exposed: desktopBoundary.provider_key_exposed,
    installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_agent: countBy(patchRecords, "agent"),
    by_patch_record_status: countBy(patchRecords, "patch_record_status"),
    by_diff_capture_status: countBy(diffCaptures, "diff_capture_status"),
    by_touched_file_status: countBy(touchedFiles, "touched_file_status"),
    by_generated_artifact_status: countBy(generatedArtifacts, "generated_artifact_status"),
    by_run_ledger_binding_status: countBy(runLedgerBindings, "run_ledger_binding_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    implementation_patch_capture_performed: true,
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    protected_mutation_performed: false,
    task_state_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, devLaneLedger, scopeFreezeGate, runtimeArtifactCapture }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("dev_lane_ledger", "artifacts/dev-lane-ledger/latest/dev-lane-ledger.json", devLaneLedger),
    sourceContract("scope_freeze_gate", "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json", scopeFreezeGate),
    sourceContract("runtime_artifact_capture", "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json", runtimeArtifactCapture),
  ];
}

function sourceContract(sourceId, sourcePath, result) {
  const available = !result?.error;
  const value = result?.value ?? result;
  return {
    source_id: sourceId,
    source_path: sourcePath,
    available,
    source_status: available ? "available" : "missing",
    source_schema_version: value?.schema_version ?? null,
    source_hash: available ? hashObject(value) : null,
    error: result?.error ?? null,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "implementation-patch-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS.roadmapPath,
    dev_lane_ledger_path: path.resolve(options.devLaneLedgerPath ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS.devLaneLedgerPath),
    scope_freeze_gate_path: path.resolve(options.scopeFreezeGatePath ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS.scopeFreezeGatePath),
    runtime_artifact_capture_path: path.resolve(options.runtimeArtifactCapturePath ?? DEFAULT_IMPLEMENTATION_PATCH_CAPTURE_INPUTS.runtimeArtifactCapturePath),
  };
}

function serializableImplementationPatchCapture(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderImplementationPatchCaptureMarkdown(result) {
  const lines = [];
  lines.push("# Implementation Patch Capture");
  lines.push("");
  lines.push(`Status: ${result.summary.implementation_patch_capture_status}`);
  lines.push(`Patch records: ${result.summary.patch_record_count}`);
  lines.push(`Diff captures: ${result.summary.diff_capture_count}`);
  lines.push(`Touched files: ${result.summary.touched_file_count}`);
  lines.push(`Generated artifacts: ${result.summary.generated_artifact_count}`);
  lines.push(`Run ledger bindings: ${result.summary.run_ledger_binding_count}`);
  lines.push("");
  lines.push("## Patch Records");
  for (const record of result.implementation_patch_records) {
    lines.push(`- ${record.agent}: ${record.patch_record_status} -> ${record.output_artifact_id ?? "missing-output-artifact"}`);
  }
  lines.push("");
  lines.push("Human review note: implementation patch capture records diff, touched file, generated artifact, and run ledger references only. Diff review, canonical tests, protected file scan, patch application, merge, release, and legal/client-facing outputs remain human-gated.");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--dev-lane-ledger") parsed.devLaneLedgerPath = argv[++index];
    else if (arg === "--scope-freeze-gate") parsed.scopeFreezeGatePath = argv[++index];
    else if (arg === "--runtime-artifact-capture") parsed.runtimeArtifactCapturePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/implementation-patch-capture.mjs [options]

Options:
  --check                              Exit non-zero when validation fails.
  --out-dir <path>                     Output directory.
  --run-at <iso>                       Fixed generation timestamp.
  --dev-lane-ledger <path>             dev-lane-ledger.json path.
  --scope-freeze-gate <path>           scope-freeze-gate.json path.
  --runtime-artifact-capture <path>    runtime-artifact-capture.json path.
`);
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8") };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashObject(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeRuntimeAgent(value) {
  if (value === "claude-code") return "claude_code";
  return value;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "T");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function uniqueBy(items, key) {
  const seen = new Set();
  const uniqueItems = [];
  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

function groupBy(items, key) {
  return items.reduce((map, item) => {
    const value = item[key] ?? "unknown";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
    return map;
  }, new Map());
}

function countBy(items, key) {
  return items.reduce((accumulator, item) => {
    const value = item[key] ?? "unknown";
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
