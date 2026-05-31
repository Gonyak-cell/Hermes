import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS,
  buildPlatformSignedTagProvenance,
} from "./platform-signed-tag-provenance.mjs";

export const DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_OUT_DIR = "artifacts/platform-provenance-freeze-preflight/latest";
export const DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS = {
  ...DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS,
  signedTagProvenanceSchemaPath: DEFAULT_PLATFORM_SIGNED_TAG_PROVENANCE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-provenance-freeze-preflight.schema.json",
};

const SCHEMA_VERSION = "platform-provenance-freeze-preflight.v1";
const CAPABILITY_ID = "platform.provenance_freeze_preflight";
const PHASE_SLOT = "P349";
const PREVIOUS_PHASE_SLOT = "P348";
const NEXT_PHASE_SLOT = "P350";

const PHASE_SOURCE_COMMANDS = [
  ["P341", "platform:runtime-baseline", "platform:runtime-baseline -- --check"],
  ["P342", "platform:drift-check", "platform:drift-check -- --check"],
  ["P343", "platform:replay-window", "platform:replay-window -- --check"],
  ["P344", "platform:operator-handoff", "platform:operator-handoff -- --check"],
  ["P345", "platform:artifact-guard", "platform:artifact-guard -- --check"],
  ["P346", "platform:provenance-ledger", "platform:provenance-ledger -- --check"],
  ["P347", "platform:release-bundle-provenance", "platform:release-bundle-provenance -- --check"],
  ["P348", "platform:signed-tag-provenance", "platform:signed-tag-provenance -- --check"],
  ["P349", "platform:provenance-freeze-preflight", "platform:provenance-freeze-preflight -- --check"],
];

export async function runPlatformProvenanceFreezePreflight(options = {}) {
  const result = await buildPlatformProvenanceFreezePreflight(options);
  if (options.write !== false) await writePlatformProvenanceFreezePreflight(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform provenance freeze preflight failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformProvenanceFreezePreflight(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signedTagProvenance = await buildPlatformSignedTagProvenance({
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
    releaseBundleProvenanceSchemaPath: inputs.release_bundle_provenance_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.signed_tag_provenance_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const preflightAnchor = buildPreflightAnchor(signedTagProvenance);
  const freezeSourceRows = buildFreezeSourceRows({ packageJson, signedTagProvenance });
  const freezeGateRows = buildFreezeGateRows({ packageJson, platformOpsLedger, signedTagProvenance });
  const preflightBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    signedTagProvenance,
    packageJson,
    platformOpsLedger,
    freezeSourceRows,
    freezeGateRows,
    preflightBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    signedTagProvenance,
    freezeSourceRows,
    freezeGateRows,
    preflightBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_provenance_freeze_preflight_id: `platform-provenance-freeze-preflight.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    preflight_anchor: preflightAnchor,
    freeze_source_rows: freezeSourceRows,
    freeze_gate_rows: freezeGateRows,
    provenance_freeze_preflight_boundary: preflightBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_provenance_freeze_preflight") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    signedTagProvenance,
    freezeSourceRows,
    freezeGateRows,
    preflightBoundary,
    validation: result.validation,
  });
  result.summary.platform_provenance_freeze_preflight_id = result.platform_provenance_freeze_preflight_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformProvenanceFreezePreflight(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-provenance-freeze-preflight.json"), serializable);
  await writeJson(path.join(outDir, "freeze-source-rows.json"), collectionEnvelope("platform-provenance-freeze-source-rows.v1", "freeze_source_rows", result.freeze_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-gate-rows.json"), collectionEnvelope("platform-provenance-freeze-gate-rows.v1", "freeze_gate_rows", result.freeze_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "provenance-freeze-preflight-boundary.json"), result.provenance_freeze_preflight_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-provenance-freeze-preflight-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformProvenanceFreezePreflightCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformProvenanceFreezePreflight(args);
    console.log(`Platform provenance freeze preflight ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_provenance_freeze_preflight_status}`);
    console.log(`Freeze sources: ${result.summary.ready_freeze_source_count}/${result.summary.freeze_source_count}`);
    console.log(`Freeze gates: ${result.summary.ready_freeze_gate_count}/${result.summary.freeze_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPreflightAnchor(signedTagProvenance) {
  return {
    schema_version: "platform-provenance-freeze-preflight-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signed_tag_provenance_id: signedTagProvenance.platform_signed_tag_provenance_id,
    source_signed_tag_provenance_status: signedTagProvenance.summary.platform_signed_tag_provenance_status,
    source_signed_tag_hash: hashValue({
      id: signedTagProvenance.platform_signed_tag_provenance_id,
      status: signedTagProvenance.summary.platform_signed_tag_provenance_status,
      policy_rows: signedTagProvenance.summary.signed_tag_policy_count,
      gate_rows: signedTagProvenance.summary.signed_tag_gate_count,
    }),
  };
}

function buildFreezeSourceRows({ packageJson, signedTagProvenance }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const transitiveSourceReady = signedTagProvenance.validation.valid && signedTagProvenance.summary.platform_signed_tag_provenance_status === "ready";
  return PHASE_SOURCE_COMMANDS.map(([phaseSlot, packageScriptName, checkCommand], index) => {
    const packageScriptRegistered = typeof scripts[packageScriptName] === "string" && scripts[packageScriptName].length > 0;
    const validationChainRegistered = validateScript.includes(`npm run ${checkCommand}`);
    const sourceReady = transitiveSourceReady && packageScriptRegistered && validationChainRegistered;
    const row = {
      schema_version: "platform-provenance-freeze-source-row.v1",
      freeze_source_row_id: `platform-provenance-freeze.source.${phaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: phaseSlot,
      package_script_name: packageScriptName,
      check_command: checkCommand,
      source_status: sourceReady ? "ready" : "blocked",
      freeze_source_status: sourceReady ? "ready" : "blocked",
      package_script_registered: packageScriptRegistered,
      validation_chain_registered: validationChainRegistered,
      check_mode_required: true,
      command_execution_performed_by_report: false,
      source_mutation_allowed: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "freeze_source_hash");
  });
}

function buildFreezeGateRows({ packageJson, platformOpsLedger, signedTagProvenance }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p348_signed_tag_ready", "P348 signed-tag provenance source is ready.", signedTagProvenance.validation.valid && signedTagProvenance.summary.platform_signed_tag_provenance_status === "ready"),
    gateRow("platform_package_scripts_registered", "package.json registers P341-P349 platform stability scripts.", PHASE_SOURCE_COMMANDS.every(([, scriptName]) => typeof scripts[scriptName] === "string" && scripts[scriptName].length > 0)),
    gateRow("platform_validation_chain_registered", "Validation chain includes P341-P349 platform stability checks.", PHASE_SOURCE_COMMANDS.every(([, , checkCommand]) => validateScript.includes(`npm run ${checkCommand}`))),
    gateRow("p349_ledger_acceptance_declared", "P349 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P349: `platform:provenance-freeze-preflight`")),
    gateRow("no_git_tag_release_execution", "Preflight performs no git tag or release operation.", true),
    gateRow("p350_next_phase_reserved", "P350 remains reserved for final provenance freeze closeout.", ledgerText.includes("P350") && ledgerText.includes("final provenance freeze")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "freeze_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-provenance-freeze-gate-row.v1",
    freeze_gate_row_id: `platform-provenance-freeze.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    git_operation_performed_by_report: false,
    git_tag_created_by_report: false,
    signed_tag_created_by_report: false,
    release_bundle_created_by_report: false,
    release_published_by_report: false,
    protected_action_executed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-provenance-freeze-preflight-boundary.v1",
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
    human_review_required_for_freeze: true,
  };
}

function buildValidationItems({ signedTagProvenance, packageJson, platformOpsLedger, freezeSourceRows, freezeGateRows, preflightBoundary }) {
  return [
    validationItem("source.signed_tag_provenance", "p348_signed_tag_provenance_ready", signedTagProvenance.validation.valid && signedTagProvenance.summary.platform_signed_tag_provenance_status === "ready", "P348 signed-tag provenance source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for validation-chain preflight."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("freeze_source_rows", "freeze_sources_ready", freezeSourceRows.length >= 9 && freezeSourceRows.every((row) => row.freeze_source_status === "ready" && row.check_mode_required && !row.command_execution_performed_by_report), "P341-P349 freeze source rows are ready and check-mode only."),
    validationItem("freeze_gate_rows", "freeze_gates_ready", freezeGateRows.length >= 6 && freezeGateRows.every((row) => row.gate_status === "ready" && !row.git_operation_performed_by_report && !row.release_published_by_report), "P349 freeze preflight gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", preflightBoundary.read_only && preflightBoundary.report_only && !preflightBoundary.command_execution_performed && !preflightBoundary.package_mutation_performed && !preflightBoundary.artifact_overwrite_performed, "Provenance freeze preflight is read-only and does not overwrite artifacts."),
    validationItem("boundary.no_git_tag_release", "no_git_tag_or_release", !preflightBoundary.git_operation_performed && !preflightBoundary.git_tag_created && !preflightBoundary.signed_tag_created && !preflightBoundary.release_bundle_created && !preflightBoundary.release_published, "Preflight records freeze readiness without creating tags, bundles, or releases."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !preflightBoundary.trading_live_enabled && !preflightBoundary.trading_full_auto_enabled && !preflightBoundary.trading_order_submission_allowed && !preflightBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !preflightBoundary.desktop_source_of_truth && !preflightBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ signedTagProvenance, freezeSourceRows, freezeGateRows, preflightBoundary, validation }) {
  return {
    platform_provenance_freeze_preflight_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signed_tag_provenance_status: signedTagProvenance.summary.platform_signed_tag_provenance_status,
    freeze_source_count: freezeSourceRows.length,
    ready_freeze_source_count: freezeSourceRows.filter((row) => row.freeze_source_status === "ready").length,
    freeze_gate_count: freezeGateRows.length,
    ready_freeze_gate_count: freezeGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: preflightBoundary.read_only,
    report_only: preflightBoundary.report_only,
    command_execution_performed: preflightBoundary.command_execution_performed,
    dependency_install_performed: preflightBoundary.dependency_install_performed,
    package_mutation_performed: preflightBoundary.package_mutation_performed,
    artifact_overwrite_performed: preflightBoundary.artifact_overwrite_performed,
    git_operation_performed: preflightBoundary.git_operation_performed,
    git_tag_created: preflightBoundary.git_tag_created,
    signed_tag_created: preflightBoundary.signed_tag_created,
    signing_key_materialized: preflightBoundary.signing_key_materialized,
    release_bundle_created: preflightBoundary.release_bundle_created,
    release_published: preflightBoundary.release_published,
    recovery_execution_performed: preflightBoundary.recovery_execution_performed,
    protected_action_executed: preflightBoundary.protected_action_executed,
    approval_applied: preflightBoundary.approval_applied,
    desktop_source_of_truth: preflightBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: preflightBoundary.desktop_mutation_allowed,
    trading_live_enabled: preflightBoundary.trading_live_enabled,
    trading_full_auto_enabled: preflightBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: preflightBoundary.trading_order_submission_allowed,
    broker_write_allowed: preflightBoundary.broker_write_allowed,
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
    "# Platform Provenance Freeze Preflight",
    "",
    `Status: ${result.summary.platform_provenance_freeze_preflight_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signed-tag provenance: ${result.summary.source_signed_tag_provenance_status}`,
    `Freeze sources: ${result.summary.ready_freeze_source_count}/${result.summary.freeze_source_count}`,
    `Freeze gates: ${result.summary.ready_freeze_gate_count}/${result.summary.freeze_gate_count}`,
    "",
    "## Freeze Sources",
    "",
    ...result.freeze_source_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.freeze_source_status}`),
    "",
    "## Freeze Gates",
    "",
    ...result.freeze_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_OUT_DIR };
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
    else if (arg === "--signed-tag-provenance-schema") parsed.signedTagProvenanceSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-provenance-freeze-preflight.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --package <path>                      package.json path.
  --package-lock <path>                 package-lock.json path.
  --nvmrc <path>                        .nvmrc path.
  --node-version <path>                 .node-version path.
  --npmrc <path>                        .npmrc path.
  --platform-ops-ledger <path>          P341-P500 ledger path.
  --trading-phase-ledger <path>         Trading P001-P340 ledger path.
  --baseline-schema <path>              P341 runtime baseline schema path.
  --drift-schema <path>                 P342 runtime drift schema path.
  --replay-window-schema <path>         P343 replay-window schema path.
  --operator-handoff-schema <path>      P344 operator handoff schema path.
  --artifact-guard-schema <path>        P345 artifact guard schema path.
  --provenance-ledger-schema <path>     P346 provenance ledger schema path.
  --release-bundle-provenance-schema <path> P347 release bundle provenance schema path.
  --signed-tag-provenance-schema <path> P348 signed-tag provenance schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.signedTagProvenanceSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_PROVENANCE_FREEZE_PREFLIGHT_INPUTS.schemaPath),
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
    validation_item_id: `platform-provenance-freeze-preflight.${slugify(itemPath)}.${checkId}`,
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
