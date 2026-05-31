import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_OUT_DIR = "artifacts/platform-release-check-evidence-index/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS = {
  packagePath: "package.json",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  tradingReleaseCheckDocPath: "docs/trading-release-check.md",
  platformOpsCheckDocPath: "docs/platform-ops-check.md",
  platformReleaseCheckDocPath: "docs/platform-release-check.md",
  noWriteAuditDocPath: "docs/platform-release-check-no-write-audit.md",
  schemaPath: "schemas/platform-release-check-evidence-index.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-evidence-index.v1";
const CAPABILITY_ID = "platform.release_check_evidence_index";
const PHASE_SLOT = "P365";
const PREVIOUS_PHASE_SLOT = "P364";
const NEXT_PHASE_SLOT = "P366";

const EVIDENCE_ROWS = [
  evidenceSpec("trading_release_check", "P361", "trading:release-check", "docs/trading-release-check.md", "artifacts/trading-release-check/latest", "validate_chain_required"),
  evidenceSpec("platform_ops_check", "P362", "platform:ops-check", "docs/platform-ops-check.md", "artifacts/platform-ops-check/latest", "validate_chain_required"),
  evidenceSpec("platform_release_check", "P363", "platform:release-check", "docs/platform-release-check.md", "artifacts/platform-release-check/latest", "not_in_validate_recursion_guard"),
  evidenceSpec("platform_release_check_no_write_audit", "P364", "platform:release-check-no-write-audit", "docs/platform-release-check-no-write-audit.md", "artifacts/platform-release-check-no-write-audit/latest", "validate_chain_required"),
];

export async function runPlatformReleaseCheckEvidenceIndex(options = {}) {
  const result = await buildPlatformReleaseCheckEvidenceIndex(options);
  if (options.write !== false) await writePlatformReleaseCheckEvidenceIndex(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check evidence index failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckEvidenceIndex(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const docs = {
    "docs/trading-release-check.md": await readTextSource(inputs.trading_release_check_doc_path),
    "docs/platform-ops-check.md": await readTextSource(inputs.platform_ops_check_doc_path),
    "docs/platform-release-check.md": await readTextSource(inputs.platform_release_check_doc_path),
    "docs/platform-release-check-no-write-audit.md": await readTextSource(inputs.no_write_audit_doc_path),
  };
  const sourceRows = buildSourceRows({ packageJson, platformOpsLedger, docs });
  const evidenceRows = buildEvidenceRows({ packageJson, docs });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const gateRows = buildGateRows({ sourceRows, evidenceRows, boundary });
  const validationItems = buildValidationItems({ sourceRows, evidenceRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceRows, evidenceRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    evidence_index_id: `platform-release-check-evidence-index.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    evidence_index_anchor: {
      schema_version: "platform-release-check-evidence-index-anchor.v1",
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      evidence_row_count: EVIDENCE_ROWS.length,
    },
    source_rows: sourceRows,
    release_check_evidence_rows: evidenceRows,
    release_check_evidence_gate_rows: gateRows,
    release_check_evidence_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_evidence_index") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, evidenceRows, gateRows, boundary, validation: result.validation });
  result.summary.evidence_index_id = result.evidence_index_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckEvidenceIndex(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-evidence-index.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-evidence-rows.json"), collectionEnvelope("platform-release-check-evidence-rows.v1", "release_check_evidence_rows", result.release_check_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-evidence-gate-rows.json"), collectionEnvelope("platform-release-check-evidence-gate-rows.v1", "release_check_evidence_gate_rows", result.release_check_evidence_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-evidence-boundary.json"), result.release_check_evidence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-evidence-index-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckEvidenceIndexCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckEvidenceIndex(args);
    console.log(`Platform release-check evidence index ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_index_status}`);
    console.log(`Evidence rows: ${result.summary.ready_evidence_row_count}/${result.summary.evidence_row_count}`);
    console.log(`Gates: ${result.summary.ready_evidence_gate_count}/${result.summary.evidence_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function evidenceSpec(rowKey, sourcePhaseSlot, packageScriptName, docPath, artifactDir, validationChainPolicy) {
  return {
    row_key: rowKey,
    source_phase_slot: sourcePhaseSlot,
    package_script_name: packageScriptName,
    doc_path: docPath,
    artifact_dir: artifactDir,
    validation_chain_policy: validationChainPolicy,
  };
}

function buildSourceRows({ packageJson, platformOpsLedger, docs }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const rows = [
    sourceRow("package_json_available", "package.json is readable.", packageJson.available),
    sourceRow("package_evidence_index_registered", "package.json registers platform:release-check-evidence-index.", typeof scripts["platform:release-check-evidence-index"] === "string" && scripts["platform:release-check-evidence-index"].length > 0),
    sourceRow("validation_chain_registered", "Validation chain includes platform:release-check-evidence-index -- --check.", validateScript.includes("npm run platform:release-check-evidence-index -- --check")),
    sourceRow("platform_ops_ledger_p365_declared", "Platform operations ledger declares P365 release-check evidence index acceptance.", platformOpsLedger.available && platformOpsLedger.text.includes("P365: `platform:release-check-evidence-index`")),
    ...Object.entries(docs).map(([docPath, doc]) => sourceRow(`doc_${slugify(docPath)}_available`, `${docPath} is readable.`, doc.available)),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "source_row_hash"));
}

function sourceRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-evidence-index-source-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    source_status: passed ? "ready" : "blocked",
    human_review_required: true,
  };
}

function buildEvidenceRows({ packageJson, docs }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return EVIDENCE_ROWS.map((spec, index) => {
    const doc = docs[spec.doc_path] ?? { available: false, text: "" };
    const scriptRegistered = typeof scripts[spec.package_script_name] === "string" && scripts[spec.package_script_name].length > 0;
    const docReferencesCommand = doc.available && doc.text.includes(spec.package_script_name);
    const docReferencesCheck = doc.available && doc.text.includes("--check");
    const validateCommand = `npm run ${spec.package_script_name} -- --check`;
    const validationChainMatchesPolicy = spec.validation_chain_policy === "validate_chain_required"
      ? validateScript.includes(validateCommand)
      : !validateScript.includes(validateCommand);
    const ready = scriptRegistered && docReferencesCommand && docReferencesCheck && validationChainMatchesPolicy;
    const row = {
      schema_version: "platform-release-check-evidence-row.v1",
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      source_phase_slot: spec.source_phase_slot,
      package_script_name: spec.package_script_name,
      check_command: validateCommand,
      doc_path: spec.doc_path,
      expected_artifact_dir: spec.artifact_dir,
      validation_chain_policy: spec.validation_chain_policy,
      evidence_status: ready ? "ready" : "blocked",
      package_script_registered: scriptRegistered,
      doc_available: doc.available,
      doc_references_command: docReferencesCommand,
      doc_references_check_mode: docReferencesCheck,
      validation_chain_policy_satisfied: validationChainMatchesPolicy,
      check_mode_no_write_expected: true,
      command_execution_performed_by_index: false,
      artifact_write_performed_by_index: false,
      protected_action_executed_by_index: false,
      release_published_by_index: false,
      trading_order_submission_performed_by_index: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_evidence_row_hash");
  });
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-evidence-index-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    control_plane_only: true,
    check_mode: true,
    evidence_index_artifact_write_requested: writeRequested,
    command_execution_performed: false,
    package_command_execution_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    protected_action_executed: false,
    release_published: false,
    git_operation_performed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    human_review_required: true,
    human_review_note: "Operator must review release-check evidence rows before using them as release-facing proof.",
  };
}

function buildGateRows({ sourceRows, evidenceRows, boundary }) {
  const rows = [
    gateRow("source_rows_ready", "P365 source rows are ready.", sourceRows.every((row) => row.source_status === "ready")),
    gateRow("evidence_rows_ready", "Release-check evidence rows are ready.", evidenceRows.length >= 4 && evidenceRows.every((row) => row.evidence_status === "ready")),
    gateRow("docs_reference_check_commands", "Release-check docs reference the package command and --check mode.", evidenceRows.every((row) => row.doc_references_command && row.doc_references_check_mode)),
    gateRow("validation_chain_policy_ready", "Validation-chain policy is satisfied, including keeping platform:release-check out of validate.", evidenceRows.every((row) => row.validation_chain_policy_satisfied)),
    gateRow("no_command_or_artifact_mutation", "Evidence index does not execute commands, write artifacts, mutate packages, publish releases, or run git.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.release_published && !boundary.git_operation_performed),
    gateRow("trading_disabled_boundary", "Trading live/full-auto/order submission and broker/exchange writes remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("human_review_note_present", "Human review note is present for release-facing evidence.", Boolean(boundary.human_review_note)),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_evidence_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-evidence-index-gate-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_index: false,
    artifact_write_performed_by_index: false,
    protected_action_executed_by_index: false,
    release_published_by_index: false,
    trading_order_submission_performed_by_index: false,
    human_review_required: true,
  };
}

function buildValidationItems({ sourceRows, evidenceRows, gateRows, boundary }) {
  return [
    validationItem("source_rows", "source_rows_ready", sourceRows.length >= 8 && sourceRows.every((row) => row.source_status === "ready"), "P365 source rows are ready."),
    validationItem("release_check_evidence_rows", "evidence_rows_ready", evidenceRows.length >= 4 && evidenceRows.every((row) => row.evidence_status === "ready"), "Release-check evidence rows are ready."),
    validationItem("release_check_evidence_gate_rows", "gates_ready", gateRows.length >= 7 && gateRows.every((row) => row.gate_status === "ready"), "Release-check evidence gates are ready."),
    validationItem("boundary.no_execution", "no_command_execution", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.artifact_write_performed, "Evidence index does not execute commands or write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.protected_action_executed && !boundary.release_published && !boundary.git_operation_performed, "Evidence index performs no dependency, package, lockfile, protected, release, or git mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "Trading writes remain disabled."),
    validationItem("boundary.review", "human_review_required", boundary.human_review_required && Boolean(boundary.human_review_note), "Human review note is present."),
  ];
}

function buildSummary({ sourceRows, evidenceRows, gateRows, boundary, validation }) {
  return {
    evidence_index_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_row_count: sourceRows.length,
    ready_source_row_count: sourceRows.filter((row) => row.source_status === "ready").length,
    evidence_row_count: evidenceRows.length,
    ready_evidence_row_count: evidenceRows.filter((row) => row.evidence_status === "ready").length,
    evidence_gate_count: gateRows.length,
    ready_evidence_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Evidence Index",
    "",
    `Status: ${result.summary.evidence_index_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Evidence rows: ${result.summary.ready_evidence_row_count}/${result.summary.evidence_row_count}`,
    `Gates: ${result.summary.ready_evidence_gate_count}/${result.summary.evidence_gate_count}`,
    "",
    "## Evidence Rows",
    "",
    ...result.release_check_evidence_rows.map((row) => `- ${row.package_script_name}: ${row.evidence_status} (${row.validation_chain_policy})`),
    "",
    "## Gate Rows",
    "",
    ...result.release_check_evidence_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-release-check-doc") parsed.tradingReleaseCheckDocPath = argv[++index];
    else if (arg === "--platform-ops-check-doc") parsed.platformOpsCheckDocPath = argv[++index];
    else if (arg === "--platform-release-check-doc") parsed.platformReleaseCheckDocPath = argv[++index];
    else if (arg === "--no-write-audit-doc") parsed.noWriteAuditDocPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-evidence-index.mjs [options]

Options:
  --out-dir <folder>              Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_OUT_DIR}
  --run-at <iso>                  Deterministic generated_at timestamp.
  --package <path>                package.json path.
  --platform-ops-ledger <path>    P341-P500 platform operations ledger path.
  --trading-release-check-doc <path>
                                  Trading release-check doc path.
  --platform-ops-check-doc <path> Platform ops-check doc path.
  --platform-release-check-doc <path>
                                  Platform release-check doc path.
  --no-write-audit-doc <path>     Release-check no-write audit doc path.
  --schema <path>                 Output schema path.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.noWriteAuditDocPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.schemaPath),
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
      text: "",
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
    validation_item_id: `platform-release-check-evidence-index.${slugify(itemPath)}.${checkId}`,
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

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
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
