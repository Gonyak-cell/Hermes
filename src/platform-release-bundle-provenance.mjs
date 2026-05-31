import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS,
  buildPlatformProvenanceLedger,
} from "./platform-provenance-ledger.mjs";

export const DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_OUT_DIR = "artifacts/platform-release-bundle-provenance/latest";
export const DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS = {
  ...DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS,
  provenanceLedgerSchemaPath: DEFAULT_PLATFORM_PROVENANCE_LEDGER_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-bundle-provenance.schema.json",
};

const SCHEMA_VERSION = "platform-release-bundle-provenance.v1";
const CAPABILITY_ID = "platform.release_bundle_provenance";
const PHASE_SLOT = "P347";
const PREVIOUS_PHASE_SLOT = "P346";
const NEXT_PHASE_SLOT = "P348";
const P340_BUNDLE_SHA256 = "1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d";

export async function runPlatformReleaseBundleProvenance(options = {}) {
  const result = await buildPlatformReleaseBundleProvenance(options);
  if (options.write !== false) await writePlatformReleaseBundleProvenance(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release bundle provenance failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseBundleProvenance(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const provenanceLedger = await buildPlatformProvenanceLedger({
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
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.provenance_ledger_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const packageLock = await readTextSource(inputs.package_lock_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const bundleAnchor = buildBundleAnchor(provenanceLedger);
  const bundleHashRequirementRows = buildBundleHashRequirementRows(provenanceLedger, platformOpsLedger);
  const bundleManifestRows = buildBundleManifestRows({ inputs, packageJson, packageLock, platformOpsLedger, provenanceLedger });
  const bundleVerificationRows = buildBundleVerificationRows(bundleHashRequirementRows, bundleManifestRows);
  const bundleBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    provenanceLedger,
    packageJson,
    platformOpsLedger,
    bundleHashRequirementRows,
    bundleManifestRows,
    bundleVerificationRows,
    bundleBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    provenanceLedger,
    bundleHashRequirementRows,
    bundleManifestRows,
    bundleVerificationRows,
    bundleBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_bundle_provenance_id: `platform-release-bundle-provenance.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    bundle_anchor: bundleAnchor,
    bundle_hash_requirement_rows: bundleHashRequirementRows,
    bundle_manifest_rows: bundleManifestRows,
    bundle_verification_rows: bundleVerificationRows,
    release_bundle_boundary: bundleBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_bundle_provenance") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    provenanceLedger,
    bundleHashRequirementRows,
    bundleManifestRows,
    bundleVerificationRows,
    bundleBoundary,
    validation: result.validation,
  });
  result.summary.platform_release_bundle_provenance_id = result.platform_release_bundle_provenance_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseBundleProvenance(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-release-bundle-provenance.json"), serializable);
  await writeJson(path.join(outDir, "bundle-hash-requirement-rows.json"), collectionEnvelope("platform-release-bundle-hash-requirement-rows.v1", "bundle_hash_requirement_rows", result.bundle_hash_requirement_rows, result.generated_at));
  await writeJson(path.join(outDir, "bundle-manifest-rows.json"), collectionEnvelope("platform-release-bundle-manifest-rows.v1", "bundle_manifest_rows", result.bundle_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "bundle-verification-rows.json"), collectionEnvelope("platform-release-bundle-verification-rows.v1", "bundle_verification_rows", result.bundle_verification_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-bundle-boundary.json"), result.release_bundle_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-bundle-provenance-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseBundleProvenanceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseBundleProvenance(args);
    console.log(`Platform release bundle provenance ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_bundle_provenance_status}`);
    console.log(`Bundle hash requirements: ${result.summary.ready_bundle_hash_requirement_count}/${result.summary.bundle_hash_requirement_count}`);
    console.log(`Bundle manifest rows: ${result.summary.ready_bundle_manifest_row_count}/${result.summary.bundle_manifest_row_count}`);
    console.log(`Bundle verification rows: ${result.summary.ready_bundle_verification_row_count}/${result.summary.bundle_verification_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildBundleAnchor(provenanceLedger) {
  return {
    schema_version: "platform-release-bundle-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_provenance_ledger_id: provenanceLedger.platform_provenance_ledger_id,
    source_provenance_ledger_status: provenanceLedger.summary.platform_provenance_ledger_status,
    p340_verified_bundle_sha256: P340_BUNDLE_SHA256,
    source_provenance_hash: hashValue({
      id: provenanceLedger.platform_provenance_ledger_id,
      status: provenanceLedger.summary.platform_provenance_ledger_status,
      records: provenanceLedger.summary.provenance_record_count,
      release_hash_policy: provenanceLedger.summary.release_hash_policy_count,
    }),
  };
}

function buildBundleHashRequirementRows(provenanceLedger, platformOpsLedger) {
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    requirementRow("source_archive_sha256_required", "Future release archive hash must be recorded before release publication.", ledgerText.includes("release-bundle hash policy") || ledgerText.includes("release bundle hashes")),
    requirementRow("manifest_sha256_required", "Future release manifest hash must be recorded with bundle contents.", provenanceLedger.release_hash_policy_rows.some((row) => row.row_key === "bundle_manifest_hash_required" && row.release_hash_policy_status === "ready")),
    requirementRow("package_lock_hash_required", "Lockfile hash is required as dependency provenance for release bundles.", true),
    requirementRow("provenance_ledger_hash_required", "The P346 provenance ledger hash is required as a source record for future bundles.", provenanceLedger.validation.valid),
    requirementRow("verification_before_publish_required", "Hash verification must happen before release publish eligibility.", provenanceLedger.release_hash_policy_rows.some((row) => row.row_key === "hash_verification_before_release" && row.release_hash_policy_status === "ready")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "bundle_hash_requirement_hash"));
}

function requirementRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-bundle-hash-requirement-row.v1",
    bundle_hash_requirement_row_id: `platform-release-bundle.requirement.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    requirement_status: passed ? "ready" : "blocked",
    hash_required: true,
    release_bundle_created_by_report: false,
    release_published_by_report: false,
    source_mutation_allowed: false,
    human_review_required: true,
  };
}

function buildBundleManifestRows({ inputs, packageJson, packageLock, platformOpsLedger, provenanceLedger }) {
  const packageName = packageJson.data?.name ?? null;
  const rows = [
    manifestRow("package_json", inputs.package_path, "source", packageJson.available, packageJson.content_hash, { package_name: packageName }),
    manifestRow("package_lock", inputs.package_lock_path, "dependency_lock", packageLock.available, packageLock.content_hash),
    manifestRow("platform_ops_ledger", inputs.platform_ops_ledger_path, "governance_ledger", platformOpsLedger.available, platformOpsLedger.content_hash),
    manifestRow("p346_provenance_ledger", "platform:provenance-ledger -- --check", "generated_policy", provenanceLedger.validation.valid, hashValue(provenanceLedger.summary)),
    manifestRow("p340_verified_bundle", "Hermes-P340-verified-20260531-p340.tar.gz", "historical_bundle", true, `sha256:${P340_BUNDLE_SHA256}`),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "bundle_manifest_hash"));
}

function manifestRow(rowKey, sourceRef, sourceKind, available, contentHash, details = {}) {
  return {
    schema_version: "platform-release-bundle-manifest-row.v1",
    bundle_manifest_row_id: `platform-release-bundle.manifest.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    source_ref: sourceRef,
    source_kind: sourceKind,
    manifest_row_status: available ? "ready" : "blocked",
    content_hash: contentHash,
    source_available: available,
    package_name: details.package_name ?? null,
    release_bundle_created_by_report: false,
    release_published_by_report: false,
    source_mutation_allowed: false,
    human_review_required: true,
  };
}

function buildBundleVerificationRows(requirementRows, manifestRows) {
  const rows = [
    verificationRow("requirements_ready", "All release bundle hash requirements are ready.", requirementRows.every((row) => row.requirement_status === "ready")),
    verificationRow("manifest_rows_ready", "All release bundle manifest source rows are ready.", manifestRows.every((row) => row.manifest_row_status === "ready")),
    verificationRow("no_bundle_created", "P347 does not create a release bundle.", true),
    verificationRow("no_release_published", "P347 does not publish a release.", true),
    verificationRow("human_review_before_bundle", "Future bundle creation remains human-review gated.", true),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "bundle_verification_hash"));
}

function verificationRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-bundle-verification-row.v1",
    bundle_verification_row_id: `platform-release-bundle.verification.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    verification_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    release_bundle_created_by_report: false,
    release_published_by_report: false,
    protected_action_executed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-release-bundle-boundary.v1",
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
    human_review_required_for_release_bundle: true,
  };
}

function buildValidationItems({ provenanceLedger, packageJson, platformOpsLedger, bundleHashRequirementRows, bundleManifestRows, bundleVerificationRows, bundleBoundary }) {
  return [
    validationItem("source.provenance_ledger", "p346_provenance_ledger_ready", provenanceLedger.validation.valid && provenanceLedger.summary.platform_provenance_ledger_status === "ready", "P346 provenance ledger source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for release bundle provenance."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("bundle_hash_requirements", "bundle_hash_requirements_ready", bundleHashRequirementRows.length >= 5 && bundleHashRequirementRows.every((row) => row.requirement_status === "ready" && row.hash_required && !row.release_bundle_created_by_report), "Release bundle hash requirements are ready and report-only."),
    validationItem("bundle_manifest_rows", "bundle_manifest_ready", bundleManifestRows.length >= 5 && bundleManifestRows.every((row) => row.manifest_row_status === "ready" && row.content_hash && !row.release_published_by_report), "Release bundle manifest rows are ready and hash-backed."),
    validationItem("bundle_verification_rows", "bundle_verification_ready", bundleVerificationRows.length >= 5 && bundleVerificationRows.every((row) => row.verification_status === "ready" && !row.release_bundle_created_by_report && !row.protected_action_executed_by_report), "Release bundle verification rows are ready and do not create bundles."),
    validationItem("boundary.read_only", "read_only_report", bundleBoundary.read_only && bundleBoundary.report_only && !bundleBoundary.command_execution_performed && !bundleBoundary.package_mutation_performed && !bundleBoundary.artifact_overwrite_performed, "Release bundle provenance is read-only and does not overwrite artifacts."),
    validationItem("boundary.no_release", "no_bundle_tag_or_release", !bundleBoundary.git_operation_performed && !bundleBoundary.git_tag_created && !bundleBoundary.signed_tag_created && !bundleBoundary.release_bundle_created && !bundleBoundary.release_published, "Release bundle provenance records policy without creating tags, bundles, or releases."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !bundleBoundary.trading_live_enabled && !bundleBoundary.trading_full_auto_enabled && !bundleBoundary.trading_order_submission_allowed && !bundleBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !bundleBoundary.desktop_source_of_truth && !bundleBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ provenanceLedger, bundleHashRequirementRows, bundleManifestRows, bundleVerificationRows, bundleBoundary, validation }) {
  return {
    platform_release_bundle_provenance_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_provenance_ledger_status: provenanceLedger.summary.platform_provenance_ledger_status,
    bundle_hash_requirement_count: bundleHashRequirementRows.length,
    ready_bundle_hash_requirement_count: bundleHashRequirementRows.filter((row) => row.requirement_status === "ready").length,
    bundle_manifest_row_count: bundleManifestRows.length,
    ready_bundle_manifest_row_count: bundleManifestRows.filter((row) => row.manifest_row_status === "ready").length,
    bundle_verification_row_count: bundleVerificationRows.length,
    ready_bundle_verification_row_count: bundleVerificationRows.filter((row) => row.verification_status === "ready").length,
    read_only: bundleBoundary.read_only,
    report_only: bundleBoundary.report_only,
    command_execution_performed: bundleBoundary.command_execution_performed,
    dependency_install_performed: bundleBoundary.dependency_install_performed,
    package_mutation_performed: bundleBoundary.package_mutation_performed,
    artifact_overwrite_performed: bundleBoundary.artifact_overwrite_performed,
    git_operation_performed: bundleBoundary.git_operation_performed,
    git_tag_created: bundleBoundary.git_tag_created,
    signed_tag_created: bundleBoundary.signed_tag_created,
    release_bundle_created: bundleBoundary.release_bundle_created,
    release_published: bundleBoundary.release_published,
    recovery_execution_performed: bundleBoundary.recovery_execution_performed,
    protected_action_executed: bundleBoundary.protected_action_executed,
    approval_applied: bundleBoundary.approval_applied,
    desktop_source_of_truth: bundleBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: bundleBoundary.desktop_mutation_allowed,
    trading_live_enabled: bundleBoundary.trading_live_enabled,
    trading_full_auto_enabled: bundleBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: bundleBoundary.trading_order_submission_allowed,
    broker_write_allowed: bundleBoundary.broker_write_allowed,
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
    "# Platform Release Bundle Provenance",
    "",
    `Status: ${result.summary.platform_release_bundle_provenance_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source provenance ledger: ${result.summary.source_provenance_ledger_status}`,
    `Bundle hash requirements: ${result.summary.ready_bundle_hash_requirement_count}/${result.summary.bundle_hash_requirement_count}`,
    `Bundle manifest rows: ${result.summary.ready_bundle_manifest_row_count}/${result.summary.bundle_manifest_row_count}`,
    `Bundle verification rows: ${result.summary.ready_bundle_verification_row_count}/${result.summary.bundle_verification_row_count}`,
    "",
    "## Hash Requirements",
    "",
    ...result.bundle_hash_requirement_rows.map((row) => `- ${row.row_key}: ${row.requirement_status}`),
    "",
    "## Manifest Rows",
    "",
    ...result.bundle_manifest_rows.map((row) => `- ${row.row_key}: ${row.manifest_row_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_OUT_DIR };
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
  console.log(`Usage: node scripts/platform-release-bundle-provenance.mjs [options]

Options:
  --out-dir <folder>                   Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_OUT_DIR}
  --run-at <iso>                       Deterministic generated_at timestamp.
  --package <path>                     package.json path.
  --package-lock <path>                package-lock.json path.
  --nvmrc <path>                       .nvmrc path.
  --node-version <path>                .node-version path.
  --npmrc <path>                       .npmrc path.
  --platform-ops-ledger <path>         P341-P500 ledger path.
  --trading-phase-ledger <path>        Trading P001-P340 ledger path.
  --baseline-schema <path>             P341 runtime baseline schema path.
  --drift-schema <path>                P342 runtime drift schema path.
  --replay-window-schema <path>        P343 replay-window schema path.
  --operator-handoff-schema <path>     P344 operator handoff schema path.
  --artifact-guard-schema <path>       P345 artifact guard schema path.
  --provenance-ledger-schema <path>    P346 provenance ledger schema path.
  --gitignore <path>                   .gitignore path.
  --schema <path>                      Output schema path.
  --check                              Validate only, do not write artifacts.
  -h, --help                           Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.provenanceLedgerSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_BUNDLE_PROVENANCE_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-bundle-provenance.${slugify(itemPath)}.${checkId}`,
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
