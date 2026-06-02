import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddCommandEvidenceExecutionBridge } from "./zendd-command-evidence-execution-bridge.mjs";
import { buildZenddDiffReviewRollbackBinding } from "./zendd-diff-review-rollback-binding.mjs";
import { buildZenddReleaseRecovery } from "./zendd-release-recovery.mjs";

export const DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_OUT_DIR = "artifacts/zendd-release-candidate-sandbox/latest";
export const DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_INPUTS = {
  schemaPath: "schemas/zendd-release-candidate-sandbox.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-release-candidate-sandbox";
const COMMAND_EVIDENCE_BRIDGE_COMMAND_NAME = "project:zendd-command-evidence-execution-bridge";
const DIFF_REVIEW_COMMAND_NAME = "project:zendd-diff-review-rollback-binding";
const RELEASE_RECOVERY_COMMAND_NAME = "project:zendd-release-recovery";
const SCHEMA_VERSION = "zendd-release-candidate-sandbox.v1";
const CAPABILITY_ID = "project.zendd.release_candidate_sandbox";
const PHASE_RANGE = "P881-P900";
const PHASE_SLOT = "P881";
const PREVIOUS_PHASE_SLOT = "P880";
const NEXT_PHASE_SLOT = "P901";
const READY_STATUS = "ready_for_zendd_release_candidate_sandbox";

export async function runZenddReleaseCandidateSandbox(options = {}) {
  const result = await buildZenddReleaseCandidateSandbox(options);
  if (options.write !== false) await writeZenddReleaseCandidateSandbox(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd release candidate sandbox failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddReleaseCandidateSandbox(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const diffReview = await buildZenddDiffReviewRollbackBinding({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const releaseRecovery = await buildZenddReleaseRecovery({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.integration_phase_ledger_path,
    write: false,
  });
  const commandBridge = await buildZenddCommandEvidenceExecutionBridge({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });

  const policy = buildSandboxPolicy(generatedAt, diffReview, releaseRecovery, commandBridge);
  const candidateRows = buildReleaseCandidateRows(releaseRecovery.release_claim_rows, diffReview);
  const artifactRows = buildArtifactIsolationRows(commandBridge.protected_command_execution_block_rows, releaseRecovery.protected_release_action_rows);
  const clientRows = buildClientDeliveryBlockRows(releaseRecovery.release_claim_rows, releaseRecovery.protected_release_action_rows);
  const evidenceRows = buildSandboxEvidencePacketRows(candidateRows);
  const failClosedRows = buildFailClosedRows({ policy, diffReview, releaseRecovery, commandBridge, candidateRows, artifactRows, clientRows, evidenceRows });
  const closeoutRows = buildCloseoutRows({ diffReview, releaseRecovery, commandBridge, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, diffReview, releaseRecovery, commandBridge, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, diffReview, releaseRecovery, commandBridge, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_release_candidate_sandbox_id: `zendd-release-candidate-sandbox.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_candidate_sandbox_anchor: anchor,
    source_diff_review_rollback_binding_summary: diffReview.summary,
    source_release_recovery_summary: releaseRecovery.summary,
    source_command_evidence_execution_bridge_summary: commandBridge.summary,
    release_candidate_sandbox_policy: policy,
    release_candidate_sandbox_rows: candidateRows,
    artifact_isolation_rows: artifactRows,
    client_delivery_block_rows: clientRows,
    sandbox_evidence_packet_rows: evidenceRows,
    release_candidate_fail_closed_rows: failClosedRows,
    release_candidate_closeout_rows: closeoutRows,
    release_candidate_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ diffReview, releaseRecovery, commandBridge, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_release_candidate_sandbox")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ diffReview, releaseRecovery, commandBridge, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_release_candidate_sandbox_id = result.zendd_release_candidate_sandbox_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddReleaseCandidateSandbox(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-release-candidate-sandbox.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-candidate-sandbox-policy.json"), result.release_candidate_sandbox_policy);
  await writeJson(path.join(outDir, "release-candidate-sandbox-rows.json"), collectionEnvelope("zendd-release-candidate-sandbox-rows.v1", "release_candidate_sandbox_rows", result.release_candidate_sandbox_rows, result.generated_at));
  await writeJson(path.join(outDir, "artifact-isolation-rows.json"), collectionEnvelope("zendd-artifact-isolation-rows.v1", "artifact_isolation_rows", result.artifact_isolation_rows, result.generated_at));
  await writeJson(path.join(outDir, "client-delivery-block-rows.json"), collectionEnvelope("zendd-client-delivery-block-rows.v1", "client_delivery_block_rows", result.client_delivery_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "sandbox-evidence-packet-rows.json"), collectionEnvelope("zendd-sandbox-evidence-packet-rows.v1", "sandbox_evidence_packet_rows", result.sandbox_evidence_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-fail-closed-rows.json"), collectionEnvelope("zendd-release-candidate-fail-closed-rows.v1", "release_candidate_fail_closed_rows", result.release_candidate_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-closeout-rows.json"), collectionEnvelope("zendd-release-candidate-closeout-rows.v1", "release_candidate_closeout_rows", result.release_candidate_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-gate-rows.json"), collectionEnvelope("zendd-release-candidate-gate-rows.v1", "release_candidate_gate_rows", result.release_candidate_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-release-candidate-sandbox-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddReleaseCandidateSandboxCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddReleaseCandidateSandbox(args);
    console.log(`Zendd release candidate sandbox ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_release_candidate_sandbox_status}`);
    console.log(`Release candidates: ${result.summary.release_candidate_sandbox_count}`);
    console.log(`Artifact isolation rows: ${result.summary.artifact_isolation_count}`);
    console.log(`Client delivery blocks: ${result.summary.client_delivery_block_count}`);
    console.log(`Sandbox evidence packets: ${result.summary.sandbox_evidence_packet_count}`);
    console.log(`Publish allowed: ${result.summary.publish_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSandboxPolicy(generatedAt, diffReview, releaseRecovery, commandBridge) {
  return {
    schema_version: "zendd-release-candidate-sandbox-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_diff_review_rollback_binding_ref: diffReview.zendd_diff_review_rollback_binding_id,
    source_release_recovery_ref: releaseRecovery.zendd_release_recovery_id,
    source_command_evidence_execution_bridge_ref: commandBridge.zendd_command_evidence_execution_bridge_id,
    sandbox_view_creation_allowed: true,
    release_candidate_pass_allowed_now: false,
    release_candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    build_artifact_execution_allowed_now: false,
    package_build_allowed_now: false,
    publish_allowed_now: false,
    client_export_allowed_now: false,
    client_delivery_allowed_now: false,
    database_migration_allowed_now: false,
    zendd_file_write_allowed_now: false,
    artifact_materialization_allowed_now: false,
    artifact_upload_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_artifact_copy_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    synthetic_receipt_allowed: false,
    release_candidate_pass_requires: [
      "release_candidate_ref",
      "sandbox_evidence_packet_ref",
      "command_execution_evidence_ref",
      "artifact_isolation_ref",
      "artifact_hash_ref",
      "diff_review_ref",
      "reviewer_ref",
      "hard_gate_ref",
      "human_receipt_ref",
      "rollback_target_ref",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "rollback_target_ref", "next_allowed_action"],
    next_allowed_action: "collect command evidence, artifact hash, human receipt, and rollback target before any future release candidate PASS",
    created_at: generatedAt,
  };
}

function buildReleaseCandidateRows(releaseClaimRows, diffReview) {
  return releaseClaimRows.map((row, index) => {
    const key = normalizeKey(row.claim_id);
    return {
      schema_version: "zendd-release-candidate-sandbox-row.v1",
      phase_slot: "P884-P888",
      row_id: `zendd-release-candidate-sandbox.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      release_candidate_ref: `release-candidate.zendd.${key}`,
      source_release_claim_ref: row.claim_id,
      release_type: row.release_type,
      sandbox_status: "view_prepared_not_executed",
      sandbox_evidence_packet_ref: `packet.zendd.release_candidate.${key}`,
      command_execution_packet_ref: `packet.zendd.release_candidate.command.${key}.pending`,
      command_execution_evidence_ref: row.command_evidence_ref,
      artifact_isolation_ref: `artifact-isolation.zendd.release_candidate.${key}`,
      artifact_hash_ref: `hashref.zendd.release_candidate.${key}.artifact.pending`,
      diff_review_ref: diffReview.zendd_diff_review_rollback_binding_id,
      evidence_ref: row.release_evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      human_receipt_required: true,
      human_receipt_ref: row.human_receipt_ref,
      rollback_target_ref: row.rollback_target_ref,
      release_candidate_pass_allowed_now: false,
      release_candidate_execution_allowed_now: false,
      command_execution_allowed_now: false,
      build_artifact_execution_allowed_now: false,
      package_build_allowed_now: false,
      publish_allowed_now: false,
      client_export_allowed_now: false,
      client_delivery_allowed_now: false,
      database_migration_allowed_now: false,
      zendd_file_write_allowed_now: false,
      artifact_materialized_now: false,
      artifact_upload_allowed_now: false,
      raw_artifact_copy_allowed_now: false,
      raw_vdr_or_client_material_copy_allowed_now: false,
      secret_read_allowed_now: false,
      current_verdict: "blocked",
      block_reason: "release_candidate_missing_executed_command_evidence_artifact_hash_and_human_receipt",
      responsible_owner: "release_operator",
      next_allowed_action: row.next_allowed_action,
    };
  });
}

function buildArtifactIsolationRows(commandBlocks, releaseActionRows) {
  const commandRows = commandBlocks
    .filter((row) => ["build_artifact", "release_package"].includes(row.protected_action_class))
    .map((row, index) => ({
      schema_version: "zendd-artifact-isolation-row.v1",
      phase_slot: "P889-P891",
      row_id: `zendd-artifact-isolation.command.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      artifact_isolation_ref: `artifact-isolation.zendd.command.${normalizeKey(row.command_execution_block_id)}`,
      source_type: "command_execution_block",
      source_ref: row.command_execution_block_id,
      protected_action_class: row.protected_action_class,
      artifact_scope: `${row.command_scope}.${row.script_name}`,
      evidence_ref: row.command_execution_evidence_ref,
      reviewer_ref: `review.zendd.artifact.${normalizeKey(row.command_execution_block_id)}`,
      hard_gate_ref: row.hard_gate_ref,
      human_receipt_required: true,
      human_receipt_ref: row.documented_human_gate_ref ?? `receipt.zendd.artifact.${normalizeKey(row.command_execution_block_id)}`,
      rollback_target_ref: row.rollback_target_ref,
      artifact_materialized_now: false,
      build_artifact_execution_allowed_now: false,
      package_build_allowed_now: false,
      publish_allowed_now: false,
      artifact_upload_allowed_now: false,
      raw_artifact_copy_allowed_now: false,
      current_verdict: "blocked",
      block_reason: row.block_reason,
      responsible_owner: row.responsible_owner,
      next_allowed_action: "create artifact-isolated sandbox evidence before any future build or package command",
    }));
  const actionRows = releaseActionRows
    .filter((row) => ["release_command_execution", "desktop_release_publish"].includes(row.action_type))
    .map((row, index) => ({
      schema_version: "zendd-artifact-isolation-row.v1",
      phase_slot: "P889-P891",
      row_id: `zendd-artifact-isolation.action.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      artifact_isolation_ref: `artifact-isolation.zendd.action.${normalizeKey(row.action_id)}`,
      source_type: "release_recovery_protected_action",
      source_ref: row.action_id,
      protected_action_class: row.action_type,
      artifact_scope: row.action_description,
      evidence_ref: `evidence.zendd.artifact.${normalizeKey(row.action_id)}`,
      reviewer_ref: `review.zendd.artifact.${normalizeKey(row.action_id)}`,
      hard_gate_ref: `hard-gate.zendd.artifact.${normalizeKey(row.action_id)}`,
      human_receipt_required: true,
      human_receipt_ref: `receipt.zendd.artifact.${normalizeKey(row.action_id)}`,
      rollback_target_ref: `rollback-target.zendd.artifact.${normalizeKey(row.action_id)}`,
      artifact_materialized_now: false,
      build_artifact_execution_allowed_now: false,
      package_build_allowed_now: false,
      publish_allowed_now: false,
      artifact_upload_allowed_now: false,
      raw_artifact_copy_allowed_now: false,
      current_verdict: "blocked",
      block_reason: row.block_reason,
      responsible_owner: row.responsible_owner,
      next_allowed_action: row.next_allowed_action,
    }));
  return [...commandRows, ...actionRows];
}

function buildClientDeliveryBlockRows(releaseClaimRows, releaseActionRows) {
  const claimRows = releaseClaimRows
    .filter((row) => ["client_output", "domain_data_write"].includes(row.release_type))
    .map((row, index) => ({
      schema_version: "zendd-client-delivery-block-row.v1",
      phase_slot: "P892-P894",
      row_id: `zendd-client-delivery-block.claim.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      client_delivery_block_ref: `block.zendd.client_delivery.${normalizeKey(row.claim_id)}`,
      source_type: "release_claim",
      source_ref: row.claim_id,
      release_type: row.release_type,
      evidence_ref: row.release_evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      human_receipt_required: true,
      human_receipt_ref: row.human_receipt_ref,
      rollback_target_ref: row.rollback_target_ref,
      attorney_or_operator_receipt_required: true,
      client_export_allowed_now: false,
      client_delivery_allowed_now: false,
      raw_vdr_or_client_material_copy_allowed_now: false,
      current_verdict: "blocked",
      block_reason: "client_delivery_requires_human_receipt_and_release_candidate_evidence",
      responsible_owner: "legal_domain_operator",
      next_allowed_action: "collect attorney/operator receipt and redacted release evidence before client delivery",
    }));
  const actionRows = releaseActionRows
    .filter((row) => row.action_type === "client_output_export")
    .map((row, index) => ({
      schema_version: "zendd-client-delivery-block-row.v1",
      phase_slot: "P892-P894",
      row_id: `zendd-client-delivery-block.action.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      client_delivery_block_ref: `block.zendd.client_delivery.${normalizeKey(row.action_id)}`,
      source_type: "protected_release_action",
      source_ref: row.action_id,
      release_type: row.action_type,
      evidence_ref: `evidence.zendd.client_delivery.${normalizeKey(row.action_id)}`,
      reviewer_ref: `review.zendd.client_delivery.${normalizeKey(row.action_id)}`,
      hard_gate_ref: `hard-gate.zendd.client_delivery.${normalizeKey(row.action_id)}`,
      human_receipt_required: true,
      human_receipt_ref: `receipt.zendd.client_delivery.${normalizeKey(row.action_id)}`,
      rollback_target_ref: `rollback-target.zendd.client_delivery.${normalizeKey(row.action_id)}`,
      attorney_or_operator_receipt_required: true,
      client_export_allowed_now: false,
      client_delivery_allowed_now: false,
      raw_vdr_or_client_material_copy_allowed_now: false,
      current_verdict: "blocked",
      block_reason: row.block_reason,
      responsible_owner: "legal_domain_operator",
      next_allowed_action: row.next_allowed_action,
    }));
  return [...claimRows, ...actionRows];
}

function buildSandboxEvidencePacketRows(candidateRows) {
  return candidateRows.map((row, index) => ({
    schema_version: "zendd-sandbox-evidence-packet-row.v1",
    phase_slot: "P895-P897",
    row_id: `zendd-sandbox-evidence-packet.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    sandbox_evidence_packet_ref: row.sandbox_evidence_packet_ref,
    release_candidate_ref: row.release_candidate_ref,
    source_release_claim_ref: row.source_release_claim_ref,
    command_execution_packet_ref: row.command_execution_packet_ref,
    command_execution_evidence_ref: row.command_execution_evidence_ref,
    artifact_isolation_ref: row.artifact_isolation_ref,
    artifact_hash_ref: row.artifact_hash_ref,
    diff_review_ref: row.diff_review_ref,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref,
    rollback_target_ref: row.rollback_target_ref,
    packet_status: "draft_only_not_executed",
    command_execution_evidence_present: false,
    artifact_hash_present: false,
    human_receipt_payload_present: false,
    release_candidate_pass_allowed_now: false,
    publish_allowed_now: false,
    client_delivery_allowed_now: false,
    raw_log_storage_allowed: false,
    raw_artifact_copy_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "sandbox_evidence_packet_missing_command_artifact_hash_and_human_receipt",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "collect command evidence hash, artifact hash, diff review, and human receipt before release candidate can be reconsidered",
  }));
}

function buildFailClosedRows({ policy, diffReview, releaseRecovery, commandBridge, candidateRows, artifactRows, clientRows, evidenceRows }) {
  const allRows = [...candidateRows, ...artifactRows, ...clientRows, ...evidenceRows];
  const rows = [
    ["source_diff_review_ready", diffReview.validation.valid && diffReview.summary.zendd_diff_review_rollback_binding_status === "ready_for_zendd_diff_review_rollback_binding", "P861-P880 diff review rollback binding is ready.", "repair diff review rollback binding"],
    ["source_release_recovery_ready", releaseRecovery.validation.valid && releaseRecovery.summary.zendd_release_recovery_status === "ready_for_cross_system_claim_freeze", "P681-P700 release recovery source is ready.", "repair release recovery bridge"],
    ["source_command_bridge_ready", commandBridge.validation.valid && commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge", "P821-P840 command evidence execution bridge is ready.", "repair command evidence execution bridge"],
    ["release_candidates_blocked", candidateRows.length >= 10 && candidateRows.every(documentedReleaseCandidate), "Release candidate sandbox rows are documented BLOCK.", "complete release candidate sandbox rows"],
    ["artifact_isolation_blocked", artifactRows.length >= 2 && artifactRows.every(documentedArtifactIsolation), "Build/package artifacts require isolation and remain blocked.", "complete artifact isolation rows"],
    ["client_delivery_blocked", clientRows.length >= 2 && clientRows.every(documentedClientDeliveryBlock), "Client export and delivery remain blocked behind receipt.", "complete client delivery block rows"],
    ["sandbox_packets_blocked", evidenceRows.length === candidateRows.length && evidenceRows.every(documentedSandboxPacket), "Sandbox evidence packets are draft-only and blocked.", "complete sandbox evidence packet rows"],
    ["no_execution_write_or_publish", noExecutionAllowed(policy) && allRows.every(noRowExecution), "No execution, write, publish, delivery, artifact materialization, receipt application, or rollback is allowed.", "restore release sandbox no-execution policy"],
    ["no_raw_secret_or_material", !policy.raw_artifact_copy_allowed_now && !policy.raw_vdr_or_client_material_copy_allowed_now && !policy.secret_read_allowed_now && allRows.every(noRawMaterial), "No raw artifacts, raw VDR/client material, raw logs, or secrets are exposed.", "restore reference-only release sandbox"],
    ["no_pass_without_receipt", !policy.release_candidate_pass_allowed_now && evidenceRows.every((row) => row.human_receipt_payload_present === false && row.current_verdict === "blocked"), "Release candidate PASS is unavailable without human receipt.", "keep release candidate blocked until receipt exists"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-release-candidate-fail-closed-row.v1",
    phase_slot: "P898-P899",
    row_id: `zendd-release-candidate-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.release_candidate.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    release_candidate_pass_allowed_now: false,
    command_execution_allowed_now: false,
    build_artifact_execution_allowed_now: false,
    package_build_allowed_now: false,
    publish_allowed_now: false,
    client_delivery_allowed_now: false,
    artifact_materialization_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_artifact_copy_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_release_candidate_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ diffReview, releaseRecovery, commandBridge, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows }) {
  const ready = diffReview.validation.valid
    && diffReview.summary.zendd_diff_review_rollback_binding_status === "ready_for_zendd_diff_review_rollback_binding"
    && releaseRecovery.validation.valid
    && releaseRecovery.summary.zendd_release_recovery_status === "ready_for_cross_system_claim_freeze"
    && commandBridge.validation.valid
    && commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge"
    && noExecutionAllowed(policy)
    && candidateRows.every(documentedReleaseCandidate)
    && artifactRows.every(documentedArtifactIsolation)
    && clientRows.every(documentedClientDeliveryBlock)
    && evidenceRows.every(documentedSandboxPacket)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-release-candidate-closeout-row.v1",
    phase_slot: "P900",
    row_id: "zendd-release-candidate-closeout.p900",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    release_candidate_sandbox_ready: ready,
    release_candidate_sandbox_count: candidateRows.length,
    artifact_isolation_count: artifactRows.length,
    client_delivery_block_count: clientRows.length,
    sandbox_evidence_packet_count: evidenceRows.length,
    release_candidate_pass_allowed_now: false,
    command_execution_allowed_now: false,
    build_artifact_execution_allowed_now: false,
    package_build_allowed_now: false,
    publish_allowed_now: false,
    client_export_allowed_now: false,
    client_delivery_allowed_now: false,
    database_migration_allowed_now: false,
    zendd_file_write_allowed_now: false,
    artifact_materialization_allowed_now: false,
    artifact_upload_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_artifact_copy_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P901-P920 VDR/LDD workflow adapter without packaging, publishing, or delivering outputs",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, diffReview, releaseRecovery, commandBridge, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-release-candidate-sandbox-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    command_evidence_bridge_command_name: COMMAND_EVIDENCE_BRIDGE_COMMAND_NAME,
    diff_review_command_name: DIFF_REVIEW_COMMAND_NAME,
    release_recovery_command_name: RELEASE_RECOVERY_COMMAND_NAME,
    source_diff_review_rollback_binding_ref: diffReview.zendd_diff_review_rollback_binding_id,
    source_diff_review_rollback_binding_status: diffReview.summary.zendd_diff_review_rollback_binding_status,
    source_release_recovery_ref: releaseRecovery.zendd_release_recovery_id,
    source_release_recovery_status: releaseRecovery.summary.zendd_release_recovery_status,
    source_command_evidence_execution_bridge_ref: commandBridge.zendd_command_evidence_execution_bridge_id,
    source_command_evidence_execution_bridge_status: commandBridge.summary.zendd_command_evidence_execution_bridge_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    release_candidate_rows_hash: hashRows(candidateRows, ["release_candidate_ref", "current_verdict", "next_allowed_action"]),
    artifact_isolation_rows_hash: hashRows(artifactRows, ["artifact_isolation_ref", "protected_action_class", "current_verdict"]),
    client_delivery_rows_hash: hashRows(clientRows, ["client_delivery_block_ref", "client_delivery_allowed_now", "current_verdict"]),
    sandbox_evidence_rows_hash: hashRows(evidenceRows, ["sandbox_evidence_packet_ref", "packet_status", "current_verdict"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "release_candidate_sandbox_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, diffReview, releaseRecovery, commandBridge, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p881_diff_review_ready", "P881", diffReview.validation.valid && diffReview.summary.zendd_diff_review_rollback_binding_status === "ready_for_zendd_diff_review_rollback_binding", "P861-P880 diff review rollback binding is ready.", "repair diff review rollback binding"),
    gateRow("p882_release_recovery_ready", "P882", releaseRecovery.validation.valid && releaseRecovery.summary.zendd_release_recovery_status === "ready_for_cross_system_claim_freeze", "P681-P700 release recovery is ready.", "repair release recovery"),
    gateRow("p883_command_bridge_ready", "P883", commandBridge.validation.valid && commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge", "P821-P840 command evidence execution bridge is ready.", "repair command evidence execution bridge"),
    gateRow("p884_policy_sandbox_only", "P884", policy.sandbox_view_creation_allowed && noExecutionAllowed(policy), "Release candidate policy creates a sandbox view only and keeps execution disabled.", "restore release candidate sandbox policy"),
    gateRow("p885_candidates_blocked", "P885-P888", candidateRows.length >= 10 && candidateRows.every(documentedReleaseCandidate), "Release candidate sandbox rows are blocked pending evidence and receipt.", "complete release candidate sandbox rows"),
    gateRow("p889_artifact_isolation", "P889-P891", artifactRows.length >= 2 && artifactRows.every(documentedArtifactIsolation), "Build/package artifacts are blocked until isolation evidence exists.", "complete artifact isolation rows"),
    gateRow("p892_client_delivery_blocks", "P892-P894", clientRows.length >= 2 && clientRows.every(documentedClientDeliveryBlock), "Client-facing export and delivery stay blocked without human receipt.", "complete client delivery block rows"),
    gateRow("p895_sandbox_packets", "P895-P897", evidenceRows.length === candidateRows.length && evidenceRows.every(documentedSandboxPacket), "Sandbox evidence packets are draft-only and blocked.", "complete sandbox evidence packet rows"),
    gateRow("p898_fail_closed", "P898-P899", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove no release PASS, execution, or raw exposure.", "complete fail-closed fixtures"),
    gateRow("p899_no_execution_or_publish", "P899", noExecutionAllowed(policy) && [...candidateRows, ...artifactRows, ...clientRows, ...evidenceRows].every(noRowExecution), "P881-P900 performs no command execution, write, build, package, publish, delivery, receipt application, or rollback.", "restore no-execution release candidate boundary"),
    gateRow("p900_closeout_ready", "P900", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.publish_allowed_now), "P881-P900 closes with release candidate sandbox ready.", "complete release candidate sandbox closeout"),
    gateRow("package_script_registered", "P900", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P900", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P900", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P881-P900") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P881-P900.", "record P881-P900 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "release_candidate_sandbox_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_execution", "release_candidate_boundary", noExecutionAllowed(policy), "Release candidate policy keeps execution, publish, delivery, and rollback disabled."));
  items.push(validationItem("candidates.blocked", "release_candidate_boundary", candidateRows.every(documentedReleaseCandidate), "Release candidates remain blocked."));
  items.push(validationItem("artifact.isolated_blocked", "artifact_boundary", artifactRows.every(documentedArtifactIsolation), "Artifact isolation rows are blocked and not materialized."));
  items.push(validationItem("client_delivery.blocked", "client_delivery_boundary", clientRows.every(documentedClientDeliveryBlock), "Client delivery rows are blocked."));
  items.push(validationItem("packets.draft_only", "evidence_packet_boundary", evidenceRows.every(documentedSandboxPacket), "Sandbox evidence packets are draft-only."));
  items.push(validationItem("fail_closed.pass", "release_candidate_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.publish_allowed_now), "Closeout is ready without publish."));
  return items;
}

function buildSummary({ diffReview, releaseRecovery, commandBridge, candidateRows, artifactRows, clientRows, evidenceRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_release_candidate_sandbox_status: validation.valid ? READY_STATUS : "documented_block_pending_release_candidate_sandbox",
    source_diff_review_rollback_binding_status: diffReview.summary.zendd_diff_review_rollback_binding_status,
    source_release_recovery_status: releaseRecovery.summary.zendd_release_recovery_status,
    source_command_evidence_execution_bridge_status: commandBridge.summary.zendd_command_evidence_execution_bridge_status,
    release_candidate_sandbox_count: candidateRows.length,
    artifact_isolation_count: artifactRows.length,
    client_delivery_block_count: clientRows.length,
    sandbox_evidence_packet_count: evidenceRows.length,
    release_candidate_fail_closed_count: failClosedRows.length,
    release_candidate_closeout_ready: closeoutRows.every((row) => row.release_candidate_sandbox_ready),
    release_candidate_pass_allowed_now: false,
    command_execution_allowed_now: false,
    build_artifact_execution_allowed_now: false,
    package_build_allowed_now: false,
    publish_allowed_now: false,
    client_export_allowed_now: false,
    client_delivery_allowed_now: false,
    database_migration_allowed_now: false,
    zendd_file_write_allowed_now: false,
    artifact_materialization_allowed_now: false,
    artifact_upload_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_artifact_copy_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedReleaseCandidate(row) {
  return row.current_verdict === "blocked"
    && row.sandbox_status === "view_prepared_not_executed"
    && row.human_receipt_required === true
    && row.release_candidate_pass_allowed_now === false
    && row.release_candidate_execution_allowed_now === false
    && noRowExecution(row)
    && Boolean(row.release_candidate_ref)
    && Boolean(row.sandbox_evidence_packet_ref)
    && Boolean(row.command_execution_evidence_ref)
    && Boolean(row.artifact_isolation_ref)
    && Boolean(row.artifact_hash_ref)
    && Boolean(row.diff_review_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && documentedBlock(row);
}

function documentedArtifactIsolation(row) {
  return row.current_verdict === "blocked"
    && row.human_receipt_required === true
    && row.artifact_materialized_now === false
    && row.build_artifact_execution_allowed_now === false
    && row.package_build_allowed_now === false
    && row.publish_allowed_now === false
    && row.artifact_upload_allowed_now === false
    && row.raw_artifact_copy_allowed_now === false
    && Boolean(row.artifact_isolation_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && documentedBlock(row);
}

function documentedClientDeliveryBlock(row) {
  return row.current_verdict === "blocked"
    && row.human_receipt_required === true
    && row.attorney_or_operator_receipt_required === true
    && row.client_export_allowed_now === false
    && row.client_delivery_allowed_now === false
    && row.raw_vdr_or_client_material_copy_allowed_now === false
    && Boolean(row.client_delivery_block_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && documentedBlock(row);
}

function documentedSandboxPacket(row) {
  return row.current_verdict === "blocked"
    && row.packet_status === "draft_only_not_executed"
    && row.command_execution_evidence_present === false
    && row.artifact_hash_present === false
    && row.human_receipt_payload_present === false
    && row.release_candidate_pass_allowed_now === false
    && row.publish_allowed_now === false
    && row.client_delivery_allowed_now === false
    && noRawMaterial(row)
    && Boolean(row.sandbox_evidence_packet_ref)
    && Boolean(row.release_candidate_ref)
    && Boolean(row.command_execution_packet_ref)
    && Boolean(row.command_execution_evidence_ref)
    && Boolean(row.artifact_isolation_ref)
    && Boolean(row.artifact_hash_ref)
    && Boolean(row.diff_review_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && documentedBlock(row);
}

function documentedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function noExecutionAllowed(policy) {
  return policy.release_candidate_pass_allowed_now === false
    && policy.release_candidate_execution_allowed_now === false
    && policy.command_execution_allowed_now === false
    && policy.build_artifact_execution_allowed_now === false
    && policy.package_build_allowed_now === false
    && policy.publish_allowed_now === false
    && policy.client_export_allowed_now === false
    && policy.client_delivery_allowed_now === false
    && policy.database_migration_allowed_now === false
    && policy.zendd_file_write_allowed_now === false
    && policy.artifact_materialization_allowed_now === false
    && policy.artifact_upload_allowed_now === false
    && policy.receipt_application_allowed_now === false
    && policy.rollback_execution_allowed_now === false;
}

function noRowExecution(row) {
  return row.release_candidate_pass_allowed_now !== true
    && row.release_candidate_execution_allowed_now !== true
    && row.command_execution_allowed_now !== true
    && row.build_artifact_execution_allowed_now !== true
    && row.package_build_allowed_now !== true
    && row.publish_allowed_now !== true
    && row.client_export_allowed_now !== true
    && row.client_delivery_allowed_now !== true
    && row.database_migration_allowed_now !== true
    && row.zendd_file_write_allowed_now !== true
    && row.artifact_materialized_now !== true
    && row.artifact_materialization_allowed_now !== true
    && row.artifact_upload_allowed_now !== true
    && row.receipt_application_allowed_now !== true
    && row.rollback_execution_allowed_now !== true;
}

function noRawMaterial(row) {
  return row.raw_artifact_copy_allowed_now !== true
    && row.raw_vdr_or_client_material_copy_allowed_now !== true
    && row.raw_log_storage_allowed !== true
    && row.secret_read_allowed_now !== true;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-release-candidate-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_release_candidate_sandbox_gate" : nextAllowedAction,
  };
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_RELEASE_CANDIDATE_SANDBOX_INPUTS.zenddProjectRoot,
  };
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P881-P900 Zendd release candidate sandbox contract. --check
validates without executing commands, building/package artifacts, publishing,
delivering client outputs, writing Zendd files, applying receipts, executing
rollback, copying raw artifacts or VDR/client material, reading secrets, or
promoting release candidate PASS.
`);
}

async function readJsonSource(filePath) {
  const source = await readTextSource(filePath);
  if (!source.available) return { ...source, data: null };
  try {
    return { ...source, data: JSON.parse(source.text) };
  } catch (error) {
    return { ...source, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return {
      path: resolved,
      available: true,
      text,
      content_hash: hashValue(text),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Release Candidate Sandbox Summary",
    "",
    `- Status: ${summary.zendd_release_candidate_sandbox_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Release candidates: ${summary.release_candidate_sandbox_count}`,
    `- Artifact isolation rows: ${summary.artifact_isolation_count}`,
    `- Client delivery blocks: ${summary.client_delivery_block_count}`,
    `- Sandbox evidence packets: ${summary.sandbox_evidence_packet_count}`,
    `- Publish allowed: ${summary.publish_allowed_now}`,
    `- Client delivery allowed: ${summary.client_delivery_allowed_now}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashRows(rows, fields) {
  return hashValue(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}
