import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS,
  buildPlatformArtifactGuard,
} from "./platform-artifact-guard.mjs";

export const DEFAULT_PLATFORM_PROVENANCE_LEDGER_OUT_DIR = "artifacts/platform-provenance-ledger/latest";
export const DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS = {
  ...DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS,
  artifactGuardSchemaPath: DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.schemaPath,
  schemaPath: "schemas/platform-provenance-ledger.schema.json",
};

const SCHEMA_VERSION = "platform-provenance-ledger.v1";
const CAPABILITY_ID = "platform.provenance_ledger";
const PHASE_SLOT = "P346";
const PREVIOUS_PHASE_SLOT = "P345";
const NEXT_PHASE_SLOT = "P347";
const P340_BUNDLE_SHA256 = "1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d";
const P340_HISTORY_BASELINE_COMMIT = "0abc97b";
const MAC_REPLAY_STABILIZATION_COMMIT = "8e4323d";

export async function runPlatformProvenanceLedger(options = {}) {
  const result = await buildPlatformProvenanceLedger(options);
  if (options.write !== false) await writePlatformProvenanceLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform provenance ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformProvenanceLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const artifactGuard = await buildPlatformArtifactGuard({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    packageLockPath: inputs.package_lock_path,
    nvmrcPath: inputs.nvmrc_path,
    nodeVersionPath: inputs.node_version_path,
    npmrcPath: inputs.npmrc_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingPhaseLedgerPath: inputs.trading_phase_ledger_path,
    baselineSchemaPath: inputs.baseline_schema_path,
    driftSchemaPath: inputs.drift_schema_path,
    replayWindowSchemaPath: inputs.replay_window_schema_path,
    operatorHandoffSchemaPath: inputs.operator_handoff_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.artifact_guard_schema_path,
  });
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const provenanceAnchor = buildProvenanceAnchor(artifactGuard);
  const provenanceRecords = buildProvenanceRecords(platformOpsLedger, artifactGuard);
  const releaseHashPolicyRows = buildReleaseHashPolicyRows(platformOpsLedger);
  const signedTagRequirementRows = buildSignedTagRequirementRows(platformOpsLedger);
  const provenanceBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    artifactGuard,
    platformOpsLedger,
    provenanceRecords,
    releaseHashPolicyRows,
    signedTagRequirementRows,
    provenanceBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    artifactGuard,
    provenanceRecords,
    releaseHashPolicyRows,
    signedTagRequirementRows,
    provenanceBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_provenance_ledger_id: `platform-provenance-ledger.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    provenance_anchor: provenanceAnchor,
    provenance_records: provenanceRecords,
    release_hash_policy_rows: releaseHashPolicyRows,
    signed_tag_requirement_rows: signedTagRequirementRows,
    provenance_boundary: provenanceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_provenance_ledger") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    artifactGuard,
    provenanceRecords,
    releaseHashPolicyRows,
    signedTagRequirementRows,
    provenanceBoundary,
    validation: result.validation,
  });
  result.summary.platform_provenance_ledger_id = result.platform_provenance_ledger_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformProvenanceLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-provenance-ledger.json"), serializable);
  await writeJson(path.join(outDir, "provenance-records.json"), collectionEnvelope("platform-provenance-records.v1", "provenance_records", result.provenance_records, result.generated_at));
  await writeJson(path.join(outDir, "release-hash-policy-rows.json"), collectionEnvelope("platform-release-hash-policy-rows.v1", "release_hash_policy_rows", result.release_hash_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "signed-tag-requirement-rows.json"), collectionEnvelope("platform-signed-tag-requirement-rows.v1", "signed_tag_requirement_rows", result.signed_tag_requirement_rows, result.generated_at));
  await writeJson(path.join(outDir, "provenance-boundary.json"), result.provenance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-provenance-ledger-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformProvenanceLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformProvenanceLedger(args);
    console.log(`Platform provenance ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_provenance_ledger_status}`);
    console.log(`Provenance records: ${result.summary.ready_provenance_record_count}/${result.summary.provenance_record_count}`);
    console.log(`Release hash policy: ${result.summary.ready_release_hash_policy_count}/${result.summary.release_hash_policy_count}`);
    console.log(`Signed tag requirements: ${result.summary.ready_signed_tag_requirement_count}/${result.summary.signed_tag_requirement_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildProvenanceAnchor(artifactGuard) {
  return {
    schema_version: "platform-provenance-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_artifact_guard_id: artifactGuard.platform_artifact_guard_id,
    source_artifact_guard_status: artifactGuard.summary.platform_artifact_guard_status,
    p340_verified_bundle_sha256: P340_BUNDLE_SHA256,
    p340_history_baseline_commit: P340_HISTORY_BASELINE_COMMIT,
    mac_replay_stabilization_commit: MAC_REPLAY_STABILIZATION_COMMIT,
    provenance_anchor_hash: hashValue({
      p340_verified_bundle_sha256: P340_BUNDLE_SHA256,
      p340_history_baseline_commit: P340_HISTORY_BASELINE_COMMIT,
      mac_replay_stabilization_commit: MAC_REPLAY_STABILIZATION_COMMIT,
      artifact_guard: artifactGuard.summary.platform_artifact_guard_status,
    }),
  };
}

function buildProvenanceRecords(platformOpsLedger, artifactGuard) {
  const ledgerText = platformOpsLedger.text ?? "";
  const records = [
    provenanceRecord("p340_verified_bundle_hash", "P340 verified transfer bundle SHA256 is recorded.", "docs/platform-operations-stability-phase-ledger.md", ledgerText.toLowerCase().includes(P340_BUNDLE_SHA256), {
      expected_value: P340_BUNDLE_SHA256,
      actual_value: ledgerText.toLowerCase().includes(P340_BUNDLE_SHA256) ? P340_BUNDLE_SHA256 : null,
    }),
    provenanceRecord("p340_history_baseline_commit", "P340 history baseline commit is recorded.", "docs/platform-operations-stability-phase-ledger.md", ledgerText.includes(P340_HISTORY_BASELINE_COMMIT), {
      expected_value: P340_HISTORY_BASELINE_COMMIT,
      actual_value: ledgerText.includes(P340_HISTORY_BASELINE_COMMIT) ? P340_HISTORY_BASELINE_COMMIT : null,
    }),
    provenanceRecord("mac_replay_stabilization_commit", "Mac replay stabilization commit is recorded.", "docs/platform-operations-stability-phase-ledger.md", ledgerText.includes(MAC_REPLAY_STABILIZATION_COMMIT), {
      expected_value: MAC_REPLAY_STABILIZATION_COMMIT,
      actual_value: ledgerText.includes(MAC_REPLAY_STABILIZATION_COMMIT) ? MAC_REPLAY_STABILIZATION_COMMIT : null,
    }),
    provenanceRecord("p341_p345_artifact_guard", "P345 artifact guard closes the P341-P345 drift-report sequence.", "platform:artifact-guard -- --check", artifactGuard.summary.platform_artifact_guard_status === "guarded", {
      expected_value: "guarded",
      actual_value: artifactGuard.summary.platform_artifact_guard_status,
    }),
    provenanceRecord("p346_acceptance_declared", "P346 acceptance declares release-bundle hash policy and signed-tag requirements without creating tags or releases.", "docs/platform-operations-stability-phase-ledger.md", ledgerText.includes("P346: `platform:provenance-ledger`") && ledgerText.includes("release-bundle hash policy") && ledgerText.includes("without creating tags or releases"), {
      expected_value: "P346 platform:provenance-ledger release-bundle hash policy without creating tags or releases",
      actual_value: ledgerText.includes("P346: `platform:provenance-ledger`") ? "ledger_text" : null,
    }),
  ];
  return records.map((row, index) => withOrdinalAndHash(row, index, "provenance_record_hash"));
}

function provenanceRecord(recordKey, description, sourceRef, passed, details = {}) {
  return {
    schema_version: "platform-provenance-record.v1",
    provenance_record_id: `platform-provenance.${recordKey}`,
    phase_slot: PHASE_SLOT,
    record_key: recordKey,
    description,
    source_ref: sourceRef,
    expected_value: details.expected_value ?? null,
    actual_value: details.actual_value ?? null,
    provenance_status: passed ? "ready" : "blocked",
    hash_recorded: recordKey.includes("hash") ? passed : false,
    commit_recorded: recordKey.includes("commit") ? passed : false,
    source_mutation_allowed: false,
    human_review_required: true,
  };
}

function buildReleaseHashPolicyRows(platformOpsLedger) {
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    releaseHashPolicyRow("release_bundle_hash_required", "Future release bundles require an explicit hash record.", ledgerText.includes("release_bundle_hash_required") || ledgerText.includes("release bundle hashes") || ledgerText.includes("release-bundle hash policy"), {
      expected_value: "release bundle hashes or release-bundle hash policy",
      actual_value: ledgerText.includes("release bundle hashes") || ledgerText.includes("release-bundle hash policy") ? "ledger_text" : null,
    }),
    releaseHashPolicyRow("bundle_manifest_hash_required", "Future release bundles require a manifest hash or equivalent artifact manifest.", true, {
      expected_value: "manifest_hash_required",
      actual_value: "policy_declared",
    }),
    releaseHashPolicyRow("hash_verification_before_release", "Hash verification is a pre-release policy row, not release publication.", true, {
      expected_value: "verify_before_release",
      actual_value: "policy_declared",
    }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_hash_policy_hash"));
}

function releaseHashPolicyRow(rowKey, description, passed, details = {}) {
  return {
    schema_version: "platform-release-hash-policy-row.v1",
    release_hash_policy_row_id: `platform-provenance.release_hash.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    expected_value: details.expected_value ?? null,
    actual_value: details.actual_value ?? null,
    release_hash_policy_status: passed ? "ready" : "blocked",
    release_bundle_created_by_report: false,
    release_published_by_report: false,
    source_mutation_allowed: false,
    human_review_required: true,
  };
}

function buildSignedTagRequirementRows(platformOpsLedger) {
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    signedTagRequirementRow("future_signed_tag_required", "Future release tags require a signed-tag requirement record.", ledgerText.includes("signed-tag") || ledgerText.includes("signed tag"), {
      expected_value: "signed-tag requirement",
      actual_value: ledgerText.includes("signed-tag") || ledgerText.includes("signed tag") ? "ledger_text" : null,
    }),
    signedTagRequirementRow("tag_creation_not_performed", "P346 records tag policy without creating a tag.", true, {
      expected_value: "git_tag_created=false",
      actual_value: "git_tag_created=false",
    }),
    signedTagRequirementRow("human_gate_before_tag", "Future tag creation remains human-gated.", true, {
      expected_value: "human_gate_required",
      actual_value: "policy_declared",
    }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "signed_tag_requirement_hash"));
}

function signedTagRequirementRow(rowKey, description, passed, details = {}) {
  return {
    schema_version: "platform-signed-tag-requirement-row.v1",
    signed_tag_requirement_row_id: `platform-provenance.signed_tag.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    expected_value: details.expected_value ?? null,
    actual_value: details.actual_value ?? null,
    signed_tag_requirement_status: passed ? "ready" : "blocked",
    git_tag_created_by_report: false,
    git_operation_performed_by_report: false,
    release_published_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-provenance-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    artifact_overwrite_performed: false,
    git_operation_performed: false,
    git_tag_created: false,
    signed_tag_created: false,
    release_bundle_created: false,
    release_published: false,
    recovery_execution_performed: false,
    protected_action_executed: false,
    approval_applied: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    human_review_required_for_release_provenance: true,
  };
}

function buildValidationItems({ artifactGuard, platformOpsLedger, provenanceRecords, releaseHashPolicyRows, signedTagRequirementRows, provenanceBoundary }) {
  return [
    validationItem("source.artifact_guard", "p345_artifact_guard_ready", artifactGuard.validation.valid && artifactGuard.summary.platform_artifact_guard_status === "guarded", "P345 artifact guard source must be guarded."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("provenance_records", "provenance_records_ready", provenanceRecords.length >= 5 && provenanceRecords.every((row) => row.provenance_status === "ready"), "P340/P345/P346 provenance records are ready."),
    validationItem("release_hash_policy", "release_hash_policy_ready", releaseHashPolicyRows.length >= 3 && releaseHashPolicyRows.every((row) => row.release_hash_policy_status === "ready" && !row.release_bundle_created_by_report && !row.release_published_by_report), "Release hash policy rows are ready and report-only."),
    validationItem("signed_tag_requirements", "signed_tag_requirements_ready", signedTagRequirementRows.length >= 3 && signedTagRequirementRows.every((row) => row.signed_tag_requirement_status === "ready" && !row.git_tag_created_by_report && !row.git_operation_performed_by_report), "Signed-tag requirement rows are ready and no tag is created."),
    validationItem("boundary.read_only", "read_only_report", provenanceBoundary.read_only && provenanceBoundary.report_only && !provenanceBoundary.command_execution_performed && !provenanceBoundary.package_mutation_performed && !provenanceBoundary.artifact_overwrite_performed, "Provenance ledger is read-only and does not overwrite artifacts."),
    validationItem("boundary.git_release", "no_git_tag_or_release", !provenanceBoundary.git_operation_performed && !provenanceBoundary.git_tag_created && !provenanceBoundary.signed_tag_created && !provenanceBoundary.release_bundle_created && !provenanceBoundary.release_published, "Provenance ledger records policy without creating tags, bundles, or releases."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !provenanceBoundary.trading_live_enabled && !provenanceBoundary.trading_full_auto_enabled && !provenanceBoundary.trading_order_submission_allowed && !provenanceBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !provenanceBoundary.desktop_source_of_truth && !provenanceBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ artifactGuard, provenanceRecords, releaseHashPolicyRows, signedTagRequirementRows, provenanceBoundary, validation }) {
  return {
    platform_provenance_ledger_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_artifact_guard_status: artifactGuard.summary.platform_artifact_guard_status,
    provenance_record_count: provenanceRecords.length,
    ready_provenance_record_count: provenanceRecords.filter((row) => row.provenance_status === "ready").length,
    release_hash_policy_count: releaseHashPolicyRows.length,
    ready_release_hash_policy_count: releaseHashPolicyRows.filter((row) => row.release_hash_policy_status === "ready").length,
    signed_tag_requirement_count: signedTagRequirementRows.length,
    ready_signed_tag_requirement_count: signedTagRequirementRows.filter((row) => row.signed_tag_requirement_status === "ready").length,
    hash_record_count: provenanceRecords.filter((row) => row.hash_recorded).length,
    commit_record_count: provenanceRecords.filter((row) => row.commit_recorded).length,
    read_only: provenanceBoundary.read_only,
    report_only: provenanceBoundary.report_only,
    command_execution_performed: provenanceBoundary.command_execution_performed,
    dependency_install_performed: provenanceBoundary.dependency_install_performed,
    package_mutation_performed: provenanceBoundary.package_mutation_performed,
    artifact_overwrite_performed: provenanceBoundary.artifact_overwrite_performed,
    git_operation_performed: provenanceBoundary.git_operation_performed,
    git_tag_created: provenanceBoundary.git_tag_created,
    signed_tag_created: provenanceBoundary.signed_tag_created,
    release_bundle_created: provenanceBoundary.release_bundle_created,
    release_published: provenanceBoundary.release_published,
    recovery_execution_performed: provenanceBoundary.recovery_execution_performed,
    protected_action_executed: provenanceBoundary.protected_action_executed,
    approval_applied: provenanceBoundary.approval_applied,
    desktop_source_of_truth: provenanceBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: provenanceBoundary.desktop_mutation_allowed,
    trading_live_enabled: provenanceBoundary.trading_live_enabled,
    trading_full_auto_enabled: provenanceBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: provenanceBoundary.trading_order_submission_allowed,
    broker_write_allowed: provenanceBoundary.broker_write_allowed,
    validation_error_count: validation.errors.length,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Provenance Ledger",
    "",
    `Status: ${result.summary.platform_provenance_ledger_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source artifact guard: ${result.summary.source_artifact_guard_status}`,
    `Provenance records: ${result.summary.ready_provenance_record_count}/${result.summary.provenance_record_count}`,
    `Release hash policy: ${result.summary.ready_release_hash_policy_count}/${result.summary.release_hash_policy_count}`,
    `Signed tag requirements: ${result.summary.ready_signed_tag_requirement_count}/${result.summary.signed_tag_requirement_count}`,
    "",
    "## Provenance Records",
    "",
    ...result.provenance_records.map((row) => `- ${row.record_key}: ${row.provenance_status}`),
    "",
    "## Signed Tag Requirements",
    "",
    ...result.signed_tag_requirement_rows.map((row) => `- ${row.row_key}: ${row.signed_tag_requirement_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_PROVENANCE_LEDGER_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--package-lock") parsed.packageLockPath = argv[++index];
    else if (arg === "--nvmrc") parsed.nvmrcPath = argv[++index];
    else if (arg === "--node-version") parsed.nodeVersionPath = argv[++index];
    else if (arg === "--npmrc") parsed.npmrcPath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-phase-ledger") parsed.tradingPhaseLedgerPath = argv[++index];
    else if (arg === "--baseline-schema") parsed.baselineSchemaPath = argv[++index];
    else if (arg === "--drift-schema") parsed.driftSchemaPath = argv[++index];
    else if (arg === "--replay-window-schema") parsed.replayWindowSchemaPath = argv[++index];
    else if (arg === "--operator-handoff-schema") parsed.operatorHandoffSchemaPath = argv[++index];
    else if (arg === "--artifact-guard-schema") parsed.artifactGuardSchemaPath = argv[++index];
    else if (arg === "--gitignore") parsed.gitignorePath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-provenance-ledger.mjs [options]

Options:
  --out-dir <folder>                Output directory. Default: ${DEFAULT_PLATFORM_PROVENANCE_LEDGER_OUT_DIR}
  --run-at <iso>                    Deterministic generated_at timestamp.
  --package <path>                  package.json path.
  --package-lock <path>             package-lock.json path.
  --nvmrc <path>                    .nvmrc path.
  --node-version <path>             .node-version path.
  --npmrc <path>                    .npmrc path.
  --platform-ops-ledger <path>      P341-P500 ledger path.
  --trading-phase-ledger <path>     Trading P001-P340 ledger path.
  --baseline-schema <path>          P341 runtime baseline schema path.
  --drift-schema <path>             P342 runtime drift schema path.
  --replay-window-schema <path>     P343 replay-window schema path.
  --operator-handoff-schema <path>  P344 operator handoff schema path.
  --artifact-guard-schema <path>    P345 artifact guard schema path.
  --gitignore <path>                .gitignore path.
  --schema <path>                   Output schema path.
  --check                           Validate only, do not write artifacts.
  -h, --help                        Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.artifactGuardSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.schemaPath),
  };
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(raw),
      content_hash: sha256(raw),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-provenance-ledger.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
