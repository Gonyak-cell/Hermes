import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS,
  buildPlatformReleaseBundleProvenance,
} from "./platform-release-bundle-provenance.mjs";

export const DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_OUT_DIR = "artifacts/platform-signed-tag-provenance/latest";
export const DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS,
  releaseBundleProvenanceSchemaPath: DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-signed-tag-provenance.schema.json",
};

const SCHEMA_VERSION = "platform-signed-tag-provenance.v1";
const CAPABILITY_ID = "platform.signed_tag_provenance";
const PHASE_SLOT = "P348";
const PREVIOUS_PHASE_SLOT = "P347";
const NEXT_PHASE_SLOT = "P349";

export async function runPlatformSignedTagProvenance(options = {}) {
  const result = await buildPlatformSignedTagProvenance(options);
  if (options.write !== false) await writePlatformSignedTagProvenance(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform signed-tag provenance failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformSignedTagProvenance(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const releaseBundleProvenance = await buildPlatformReleaseBundleProvenance({
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
    artifactGuardSchemaPath: inputs.artifact_guard_schema_path,
    provenanceLedgerSchemaPath: inputs.provenance_ledger_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.release_bundle_provenance_schema_path,
  });
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const signedTagAnchor = buildSignedTagAnchor(releaseBundleProvenance);
  const signedTagPolicyRows = buildSignedTagPolicyRows(releaseBundleProvenance, platformOpsLedger);
  const signedTagGateRows = buildSignedTagGateRows(signedTagPolicyRows, releaseBundleProvenance);
  const signedTagBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    releaseBundleProvenance,
    platformOpsLedger,
    signedTagPolicyRows,
    signedTagGateRows,
    signedTagBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    releaseBundleProvenance,
    signedTagPolicyRows,
    signedTagGateRows,
    signedTagBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_signed_tag_provenance_id: `platform-signed-tag-provenance.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    signed_tag_anchor: signedTagAnchor,
    signed_tag_policy_rows: signedTagPolicyRows,
    signed_tag_gate_rows: signedTagGateRows,
    signed_tag_boundary: signedTagBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_signed_tag_provenance") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    releaseBundleProvenance,
    signedTagPolicyRows,
    signedTagGateRows,
    signedTagBoundary,
    validation: result.validation,
  });
  result.summary.platform_signed_tag_provenance_id = result.platform_signed_tag_provenance_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformSignedTagProvenance(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-signed-tag-provenance.json"), serializable);
  await writeJson(path.join(outDir, "signed-tag-policy-rows.json"), collectionEnvelope("platform-signed-tag-policy-rows.v1", "signed_tag_policy_rows", result.signed_tag_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "signed-tag-gate-rows.json"), collectionEnvelope("platform-signed-tag-gate-rows.v1", "signed_tag_gate_rows", result.signed_tag_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "signed-tag-boundary.json"), result.signed_tag_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-signed-tag-provenance-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformSignedTagProvenanceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformSignedTagProvenance(args);
    console.log(`Platform signed-tag provenance ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_signed_tag_provenance_status}`);
    console.log(`Signed-tag policy rows: ${result.summary.ready_signed_tag_policy_count}/${result.summary.signed_tag_policy_count}`);
    console.log(`Signed-tag gate rows: ${result.summary.ready_signed_tag_gate_count}/${result.summary.signed_tag_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSignedTagAnchor(releaseBundleProvenance) {
  return {
    schema_version: "platform-signed-tag-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_release_bundle_provenance_id: releaseBundleProvenance.platform_release_bundle_provenance_id,
    source_release_bundle_provenance_status: releaseBundleProvenance.summary.platform_release_bundle_provenance_status,
    source_release_bundle_hash: hashValue({
      id: releaseBundleProvenance.platform_release_bundle_provenance_id,
      status: releaseBundleProvenance.summary.platform_release_bundle_provenance_status,
      requirements: releaseBundleProvenance.summary.bundle_hash_requirement_count,
      manifests: releaseBundleProvenance.summary.bundle_manifest_row_count,
    }),
  };
}

function buildSignedTagPolicyRows(releaseBundleProvenance, platformOpsLedger) {
  const ledgerText = platformOpsLedger.text ?? "";
  const signedTagDeclared = hasSignedTagPolicy(ledgerText);
  const rows = [
    policyRow("signed_tag_required_for_future_release", "Future release tags require signed-tag provenance.", signedTagDeclared),
    policyRow("bundle_manifest_hash_required_before_tag", "A ready release-bundle manifest hash is required before future tag eligibility.", releaseBundleProvenance.summary.platform_release_bundle_provenance_status === "ready"),
    policyRow("human_approval_required_before_tag", "Future tag creation requires a human approval gate.", true),
    policyRow("external_signing_key_required", "Signing key material must stay outside repo artifacts.", true),
    policyRow("unsigned_tag_rejected", "Unsigned or unreviewed tags are not release-eligible.", true),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "signed_tag_policy_hash"));
}

function hasSignedTagPolicy(text) {
  return /\bsigned[- ]tags?\b/iu.test(text);
}

function policyRow(rowKey, description, passed) {
  return {
    schema_version: "platform-signed-tag-policy-row.v1",
    signed_tag_policy_row_id: `platform-signed-tag.policy.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    signed_tag_policy_status: passed ? "ready" : "blocked",
    signed_tag_required: true,
    git_tag_created_by_report: false,
    signed_tag_created_by_report: false,
    git_operation_performed_by_report: false,
    signing_key_materialized_by_report: false,
    release_published_by_report: false,
    human_review_required: true,
  };
}

function buildSignedTagGateRows(policyRows, releaseBundleProvenance) {
  const rows = [
    gateRow("release_bundle_provenance_ready", "P347 release-bundle provenance must be ready before signed-tag policy is ready.", releaseBundleProvenance.validation.valid && releaseBundleProvenance.summary.platform_release_bundle_provenance_status === "ready"),
    gateRow("signed_tag_policy_ready", "All signed-tag policy rows must be ready.", policyRows.every((row) => row.signed_tag_policy_status === "ready")),
    gateRow("no_git_operation", "P348 performs no git operation.", true),
    gateRow("no_tag_created", "P348 creates no tag or signed tag.", true),
    gateRow("no_release_published", "P348 publishes no release.", true),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "signed_tag_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-signed-tag-gate-row.v1",
    signed_tag_gate_row_id: `platform-signed-tag.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    git_operation_performed_by_report: false,
    git_tag_created_by_report: false,
    signed_tag_created_by_report: false,
    release_published_by_report: false,
    protected_action_executed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-signed-tag-boundary.v1",
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
    signing_key_materialized: false,
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
    human_review_required_for_signed_tag: true,
  };
}

function buildValidationItems({ releaseBundleProvenance, platformOpsLedger, signedTagPolicyRows, signedTagGateRows, signedTagBoundary }) {
  return [
    validationItem("source.release_bundle_provenance", "p347_release_bundle_provenance_ready", releaseBundleProvenance.validation.valid && releaseBundleProvenance.summary.platform_release_bundle_provenance_status === "ready", "P347 release-bundle provenance source must be ready."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("signed_tag_policy_rows", "signed_tag_policy_ready", signedTagPolicyRows.length >= 5 && signedTagPolicyRows.every((row) => row.signed_tag_policy_status === "ready" && row.signed_tag_required && !row.signed_tag_created_by_report), "Signed-tag policy rows are ready and report-only."),
    validationItem("signed_tag_gate_rows", "signed_tag_gates_ready", signedTagGateRows.length >= 5 && signedTagGateRows.every((row) => row.gate_status === "ready" && !row.git_operation_performed_by_report && !row.release_published_by_report), "Signed-tag gate rows are ready and no git/release operation is performed."),
    validationItem("boundary.read_only", "read_only_report", signedTagBoundary.read_only && signedTagBoundary.report_only && !signedTagBoundary.command_execution_performed && !signedTagBoundary.package_mutation_performed && !signedTagBoundary.artifact_overwrite_performed, "Signed-tag provenance is read-only and does not overwrite artifacts."),
    validationItem("boundary.no_git_tag_release", "no_git_tag_or_release", !signedTagBoundary.git_operation_performed && !signedTagBoundary.git_tag_created && !signedTagBoundary.signed_tag_created && !signedTagBoundary.signing_key_materialized && !signedTagBoundary.release_published, "Signed-tag provenance records policy without creating tags, keys, or releases."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !signedTagBoundary.trading_live_enabled && !signedTagBoundary.trading_full_auto_enabled && !signedTagBoundary.trading_order_submission_allowed && !signedTagBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !signedTagBoundary.desktop_source_of_truth && !signedTagBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ releaseBundleProvenance, signedTagPolicyRows, signedTagGateRows, signedTagBoundary, validation }) {
  return {
    platform_signed_tag_provenance_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_release_bundle_provenance_status: releaseBundleProvenance.summary.platform_release_bundle_provenance_status,
    signed_tag_policy_count: signedTagPolicyRows.length,
    ready_signed_tag_policy_count: signedTagPolicyRows.filter((row) => row.signed_tag_policy_status === "ready").length,
    signed_tag_gate_count: signedTagGateRows.length,
    ready_signed_tag_gate_count: signedTagGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: signedTagBoundary.read_only,
    report_only: signedTagBoundary.report_only,
    command_execution_performed: signedTagBoundary.command_execution_performed,
    dependency_install_performed: signedTagBoundary.dependency_install_performed,
    package_mutation_performed: signedTagBoundary.package_mutation_performed,
    artifact_overwrite_performed: signedTagBoundary.artifact_overwrite_performed,
    git_operation_performed: signedTagBoundary.git_operation_performed,
    git_tag_created: signedTagBoundary.git_tag_created,
    signed_tag_created: signedTagBoundary.signed_tag_created,
    signing_key_materialized: signedTagBoundary.signing_key_materialized,
    release_bundle_created: signedTagBoundary.release_bundle_created,
    release_published: signedTagBoundary.release_published,
    recovery_execution_performed: signedTagBoundary.recovery_execution_performed,
    protected_action_executed: signedTagBoundary.protected_action_executed,
    approval_applied: signedTagBoundary.approval_applied,
    desktop_source_of_truth: signedTagBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: signedTagBoundary.desktop_mutation_allowed,
    trading_live_enabled: signedTagBoundary.trading_live_enabled,
    trading_full_auto_enabled: signedTagBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: signedTagBoundary.trading_order_submission_allowed,
    broker_write_allowed: signedTagBoundary.broker_write_allowed,
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
    "# Platform Signed-Tag Provenance",
    "",
    `Status: ${result.summary.platform_signed_tag_provenance_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source release bundle provenance: ${result.summary.source_release_bundle_provenance_status}`,
    `Signed-tag policy rows: ${result.summary.ready_signed_tag_policy_count}/${result.summary.signed_tag_policy_count}`,
    `Signed-tag gate rows: ${result.summary.ready_signed_tag_gate_count}/${result.summary.signed_tag_gate_count}`,
    "",
    "## Policy Rows",
    "",
    ...result.signed_tag_policy_rows.map((row) => `- ${row.row_key}: ${row.signed_tag_policy_status}`),
    "",
    "## Gate Rows",
    "",
    ...result.signed_tag_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_OUT_DIR };
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
    else if (arg === "--provenance-ledger-schema") parsed.provenanceLedgerSchemaPath = argv[++index];
    else if (arg === "--release-bundle-provenance-schema") parsed.releaseBundleProvenanceSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-signed-tag-provenance.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --package-lock <path>                    package-lock.json path.
  --nvmrc <path>                           .nvmrc path.
  --node-version <path>                    .node-version path.
  --npmrc <path>                           .npmrc path.
  --platform-ops-ledger <path>             P341-P500 ledger path.
  --trading-phase-ledger <path>            Trading P001-P340 ledger path.
  --baseline-schema <path>                 P341 runtime baseline schema path.
  --drift-schema <path>                    P342 runtime drift schema path.
  --replay-window-schema <path>            P343 replay-window schema path.
  --operator-handoff-schema <path>         P344 operator handoff schema path.
  --artifact-guard-schema <path>           P345 artifact guard schema path.
  --provenance-ledger-schema <path>        P346 provenance ledger schema path.
  --release-bundle-provenance-schema <path> P347 release bundle provenance schema path.
  --gitignore <path>                       .gitignore path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.releaseBundleProvenanceSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.schemaPath),
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
    validation_item_id: `platform-signed-tag-provenance.${slugify(itemPath)}.${checkId}`,
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
