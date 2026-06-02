import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddBoundary } from "./zendd-boundary.mjs";
import { buildZenddDevHarness } from "./zendd-dev-harness.mjs";

export const DEFAULT_ZENDD_COMMAND_EVIDENCE_OUT_DIR = "artifacts/zendd-command-evidence/latest";
export const DEFAULT_ZENDD_COMMAND_EVIDENCE_INPUTS = {
  schemaPath: "schemas/zendd-command-evidence.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-command-evidence";
const DEV_HARNESS_COMMAND_NAME = "project:zendd-dev-harness";
const SCHEMA_VERSION = "zendd-command-evidence.v1";
const CAPABILITY_ID = "project.zendd.command_evidence";
const PHASE_RANGE = "P561-P580";
const PHASE_SLOT = "P561";
const PREVIOUS_PHASE_SLOT = "P560";
const NEXT_PHASE_SLOT = "P581";

export async function runZenddCommandEvidence(options = {}) {
  const result = await buildZenddCommandEvidence(options);
  if (options.write !== false) await writeZenddCommandEvidence(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd command evidence failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddCommandEvidence(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const boundary = await buildZenddBoundary({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const devHarness = await buildZenddDevHarness({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildCommandEvidencePolicy(generatedAt);
  const evidenceRows = buildCommandEvidenceRows(boundary);
  const redactionPolicy = buildLogRedactionPolicy(generatedAt);
  const reviewRows = buildReviewBindingRows(evidenceRows);
  const passBlockPolicy = buildPassBlockPolicy(generatedAt);
  const protectedRows = buildProtectedCommandRows(evidenceRows);
  const capturePlan = buildCapturePlan(generatedAt, evidenceRows);
  const freezeRows = buildCommandEvidenceFreezeRows(evidenceRows);
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    boundary,
    devHarness,
    evidenceRows,
    reviewRows,
    protectedRows,
    freezeRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    boundary,
    devHarness,
    policy,
    evidenceRows,
    redactionPolicy,
    reviewRows,
    passBlockPolicy,
    protectedRows,
    capturePlan,
    freezeRows,
  });
  const validationItems = buildValidationItems({ gateRows, policy, evidenceRows, redactionPolicy, reviewRows, protectedRows, capturePlan, freezeRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ boundary, devHarness, evidenceRows, protectedRows, freezeRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_command_evidence_id: `zendd-command-evidence.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    command_evidence_anchor: anchor,
    source_boundary_summary: boundary.summary,
    source_dev_harness_summary: devHarness.summary,
    command_evidence_policy: policy,
    command_evidence_rows: evidenceRows,
    log_redaction_policy: redactionPolicy,
    command_review_binding_rows: reviewRows,
    command_pass_block_policy: passBlockPolicy,
    protected_command_rows: protectedRows,
    command_capture_plan: capturePlan,
    command_evidence_freeze_rows: freezeRows,
    command_evidence_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_command_evidence")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ boundary, devHarness, evidenceRows, protectedRows, freezeRows, validation: result.validation });
  result.summary.zendd_command_evidence_id = result.zendd_command_evidence_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddCommandEvidence(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-command-evidence.json"), serializableResult(result));
  await writeJson(path.join(outDir, "command-evidence-policy.json"), result.command_evidence_policy);
  await writeJson(path.join(outDir, "command-evidence-rows.json"), collectionEnvelope("zendd-command-evidence-rows.v1", "command_evidence_rows", result.command_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-review-binding-rows.json"), collectionEnvelope("zendd-command-review-binding-rows.v1", "command_review_binding_rows", result.command_review_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-command-rows.json"), collectionEnvelope("zendd-protected-command-rows.v1", "protected_command_rows", result.protected_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-evidence-freeze-rows.json"), collectionEnvelope("zendd-command-evidence-freeze-rows.v1", "command_evidence_freeze_rows", result.command_evidence_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-command-evidence-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddCommandEvidenceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddCommandEvidence(args);
    console.log(`Zendd command evidence ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_command_evidence_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Command evidence rows: ${result.summary.command_evidence_row_count}`);
    console.log(`Protected commands: ${result.summary.protected_command_count}`);
    console.log(`Command execution allowed: ${result.summary.command_execution_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCommandEvidencePolicy(generatedAt) {
  return {
    schema_version: "zendd-command-evidence-policy.v1",
    phase_slot: "P561",
    project_id: "project.zendd",
    command_execution_allowed_now: false,
    command_pass_requires: ["command_evidence_ref", "exit_code", "redaction_report_ref", "reviewer_ref_or_gate_ref"],
    protected_command_pass_requires: ["human_receipt_ref", "receipt_status"],
    evidence_capture_required_fields: [
      "command_name",
      "command_scope",
      "cwd_ref",
      "started_at",
      "ended_at",
      "exit_code",
      "stdout_hash",
      "stderr_hash",
      "redaction_report_ref",
      "artifact_ref",
    ],
    forbidden_capture_fields: ["raw_secret_value", "raw_vdr_payload", "unscoped_client_document"],
    verdict: "pass",
    next_allowed_action: "bind selected check command to evidence capture request before execution",
    created_at: generatedAt,
  };
}

function buildCommandEvidenceRows(boundary) {
  return boundary.zendd_command_catalog_rows.map((row, index) => {
    const commandKey = normalizeCommandKey(`${row.command_scope}.${row.script_name}`);
    const protectedCommand = isProtectedCommand(row);
    const checkCandidate = row.command_classification === "check_mode_candidate";
    return {
      schema_version: "zendd-command-evidence-row.v1",
      phase_slot: checkCandidate ? "P562" : "P563",
      row_id: `zendd-command-evidence.row.${String(index + 1).padStart(3, "0")}`,
      project_id: "project.zendd",
      claim_id: `claim.zendd.command.${commandKey}`,
      command_scope: row.command_scope,
      package_path: row.package_path,
      script_name: row.script_name,
      command_classification: row.command_classification,
      command_evidence_ref: `evidence.zendd.command.${commandKey}`,
      expected_artifact_ref: `artifact.zendd.command.${commandKey}.capture`,
      reviewer_ref: `review.zendd.command.${commandKey}`,
      hard_gate_ref: protectedCommand ? `gate.zendd.protected_command.${commandKey}` : `gate.zendd.check_command.${commandKey}`,
      human_receipt_ref_required: protectedCommand,
      execution_allowed_now: false,
      evidence_capture_status: "pending_capture",
      verdict: checkCandidate ? "blocked_pending_evidence_capture" : "blocked_protected_or_unclassified_command",
      block_reason: checkCandidate ? "command_not_executed_yet" : row.block_reason,
      responsible_owner: "integration_operator",
      next_allowed_action: checkCandidate
        ? "create evidence capture request and run only after explicit work order"
        : row.next_allowed_action,
    };
  });
}

function isProtectedCommand(row) {
  return ["database", "packaging_or_release", "runtime_or_server", "mutating_or_dependency"].includes(row.command_classification);
}

function buildLogRedactionPolicy(generatedAt) {
  return {
    schema_version: "zendd-log-redaction-policy.v1",
    phase_slot: "P564",
    project_id: "project.zendd",
    raw_log_storage_allowed: false,
    secret_value_storage_allowed: false,
    raw_vdr_log_storage_allowed: false,
    required_redactions: ["secret_like_tokens", "env_values", "absolute_client_paths", "raw_vdr_file_names_when_sensitive"],
    required_outputs: ["stdout_hash", "stderr_hash", "redaction_report_ref", "safe_excerpt_ref"],
    verdict: "pass",
    next_allowed_action: "create redaction report before command evidence PASS",
    created_at: generatedAt,
  };
}

function buildReviewBindingRows(evidenceRows) {
  return evidenceRows.map((row, index) => ({
    schema_version: "zendd-command-review-binding-row.v1",
    phase_slot: "P565",
    row_id: `zendd-command-review.row.${String(index + 1).padStart(3, "0")}`,
    claim_id: row.claim_id,
    command_evidence_ref: row.command_evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    reviewer_required_for_pass: true,
    human_receipt_ref_required: row.human_receipt_ref_required,
    pass_without_review_allowed: false,
    current_verdict: "blocked_pending_review_binding",
    block_reason: "command_evidence_not_captured_or_reviewed",
    next_allowed_action: "capture command evidence then bind reviewer or hard gate",
  }));
}

function buildPassBlockPolicy(generatedAt) {
  return {
    schema_version: "zendd-command-pass-block-policy.v1",
    phase_slot: "P566",
    project_id: "project.zendd",
    pass_formula: "claim_to_command_evidence_to_redaction_report_to_reviewer_or_hard_gate_to_receipt_if_protected_to_pass_or_block",
    pass_allowed_without_evidence: false,
    pass_allowed_without_review: false,
    protected_pass_allowed_without_receipt: false,
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    verdict: "pass",
    next_allowed_action: "evaluate command rows only after evidence capture",
    created_at: generatedAt,
  };
}

function buildProtectedCommandRows(evidenceRows) {
  return evidenceRows
    .filter((row) => row.human_receipt_ref_required)
    .map((row, index) => ({
      schema_version: "zendd-protected-command-row.v1",
      phase_slot: "P567",
      row_id: `zendd-protected-command.row.${String(index + 1).padStart(3, "0")}`,
      claim_id: row.claim_id,
      command_scope: row.command_scope,
      script_name: row.script_name,
      command_classification: row.command_classification,
      command_evidence_ref: row.command_evidence_ref,
      human_receipt_ref_required: true,
      execution_allowed_now: false,
      current_verdict: "blocked_pending_protected_command_receipt",
      block_reason: "protected_command_requires_human_receipt_and_evidence",
      responsible_owner: "integration_operator",
      next_allowed_action: "collect work order and human receipt before protected command execution",
    }));
}

function buildCapturePlan(generatedAt, evidenceRows) {
  return {
    schema_version: "zendd-command-capture-plan.v1",
    phase_slot: "P568",
    project_id: "project.zendd",
    command_count: evidenceRows.length,
    capture_execution_allowed_now: false,
    capture_runner: "future_read_only_command_capture_adapter",
    timeout_policy: "explicit_timeout_required_per_command",
    cwd_policy: "zendd_external_root_reference_only",
    evidence_rows_have_refs: evidenceRows.every((row) => row.command_evidence_ref && row.expected_artifact_ref),
    next_allowed_action: "implement command capture adapter with explicit work order gate",
    created_at: generatedAt,
  };
}

function buildCommandEvidenceFreezeRows(evidenceRows) {
  return evidenceRows.map((row, index) => ({
    schema_version: "zendd-command-evidence-freeze-row.v1",
    phase_slot: "P569-P580",
    row_id: `zendd-command-evidence-freeze.row.${String(index + 1).padStart(3, "0")}`,
    claim_id: row.claim_id,
    command_evidence_ref: row.command_evidence_ref,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
  }));
}

function buildAnchor({ packageJson, phaseLedger, boundary, devHarness, evidenceRows, reviewRows, protectedRows, freezeRows }) {
  return {
    schema_version: "zendd-command-evidence-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    dev_harness_command_name: DEV_HARNESS_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    boundary_summary_hash: hashValue(boundary.summary),
    dev_harness_summary_hash: hashValue(devHarness.summary),
    command_evidence_hash: hashRows(evidenceRows, ["claim_id", "command_evidence_ref", "execution_allowed_now", "verdict", "next_allowed_action"]),
    review_binding_hash: hashRows(reviewRows, ["claim_id", "reviewer_required_for_pass", "human_receipt_ref_required", "next_allowed_action"]),
    protected_command_hash: hashRows(protectedRows, ["claim_id", "human_receipt_ref_required", "block_reason", "next_allowed_action"]),
    freeze_hash: hashRows(freezeRows, ["claim_id", "current_verdict", "block_reason", "next_allowed_action"]),
  };
}

function buildGateRows({
  packageJson,
  phaseLedger,
  boundary,
  devHarness,
  policy,
  evidenceRows,
  redactionPolicy,
  reviewRows,
  passBlockPolicy,
  protectedRows,
  capturePlan,
  freezeRows,
}) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p561_policy_declared", "P561", !policy.command_execution_allowed_now && policy.command_pass_requires.includes("command_evidence_ref"), "Command evidence policy requires evidence before PASS.", "declare command evidence policy"),
    gateRow("p562_command_evidence_refs_assigned", "P562", evidenceRows.length >= 1 && evidenceRows.every((row) => row.command_evidence_ref && row.claim_id && !row.execution_allowed_now), "Every cataloged Zendd command has a claim and evidence ref without execution.", "assign command evidence refs"),
    gateRow("p563_log_redaction_policy_declared", "P563", !redactionPolicy.raw_log_storage_allowed && redactionPolicy.required_outputs.includes("redaction_report_ref"), "Command logs require redaction reports and hashes.", "declare log redaction policy"),
    gateRow("p564_review_bindings_required", "P564", reviewRows.length === evidenceRows.length && reviewRows.every((row) => row.reviewer_required_for_pass && !row.pass_without_review_allowed), "Every command evidence row requires reviewer or hard gate.", "bind command review rows"),
    gateRow("p565_pass_block_formula_declared", "P565", !passBlockPolicy.pass_allowed_without_evidence && !passBlockPolicy.pass_allowed_without_review && !passBlockPolicy.protected_pass_allowed_without_receipt, "PASS requires evidence, review/gate, and protected receipt.", "declare pass/block policy"),
    gateRow("p566_protected_commands_blocked", "P566", protectedRows.every((row) => row.human_receipt_ref_required && !row.execution_allowed_now && row.block_reason), "Protected commands are blocked pending receipt.", "block protected commands"),
    gateRow("p567_capture_plan_no_execution", "P567", !capturePlan.capture_execution_allowed_now && capturePlan.evidence_rows_have_refs, "Capture plan is declared without executing commands.", "keep capture execution disabled"),
    gateRow("p568_freeze_rows_document_blocks", "P568-P580", freezeRows.length === evidenceRows.length && freezeRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Every command evidence claim is blocked with reason and next action until captured.", "complete freeze rows"),
    gateRow("package_script_registered", "P580", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P580", phaseLedger.available && phaseLedger.text.includes("P561-P580") && phaseLedger.text.includes(COMMAND_NAME), "P561-P580 phase ledger declares command evidence acceptance.", "record P561-P580 in phase ledger"),
    gateRow("dev_harness_chain_valid", "P580", devHarness.validation.valid && devHarness.summary.zendd_dev_harness_status === "ready_for_command_evidence_bridge" && boundary.validation.valid, "P541-P560 dev harness remains valid before command evidence.", "repair dev harness validation before command evidence"),
  ];
}

function buildValidationItems({ gateRows, policy, evidenceRows, redactionPolicy, reviewRows, protectedRows, capturePlan, freezeRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "command_evidence_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.command_execution_allowed_now", "safety_boundary", policy.command_execution_allowed_now === false, "Command evidence bridge does not permit command execution"));
  items.push(validationItem("commands.execution_allowed_now", "safety_boundary", evidenceRows.every((row) => row.execution_allowed_now === false), "Command evidence rows are capture-only"));
  items.push(validationItem("redaction.raw_log_storage_allowed", "secret_boundary", redactionPolicy.raw_log_storage_allowed === false && redactionPolicy.secret_value_storage_allowed === false, "Raw logs and secrets are not stored"));
  items.push(validationItem("review.pass_without_review_allowed", "claim_boundary", reviewRows.every((row) => row.pass_without_review_allowed === false), "Command evidence cannot PASS without review"));
  items.push(validationItem("protected.execution_allowed_now", "receipt_boundary", protectedRows.every((row) => row.execution_allowed_now === false && row.human_receipt_ref_required), "Protected commands require receipt and stay blocked"));
  items.push(validationItem("capture.execution_allowed", "safety_boundary", capturePlan.capture_execution_allowed_now === false, "Capture runner remains future-only"));
  items.push(validationItem("freeze.next_allowed_action", "claim_boundary", freezeRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Freeze rows document blocks with next actions"));
  return items;
}

function buildSummary({ boundary, devHarness, evidenceRows, protectedRows, freezeRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_command_evidence_status: validation.valid
      ? "ready_for_vdr_ldd_source_contract_bridge"
      : "documented_block_pending_command_evidence_gate",
    zendd_project_root: devHarness.summary.zendd_project_root,
    zendd_git_head_short: devHarness.summary.zendd_git_head_short,
    source_boundary_status: boundary.summary.zendd_boundary_status,
    source_dev_harness_status: devHarness.summary.zendd_dev_harness_status,
    command_evidence_row_count: evidenceRows.length,
    protected_command_count: protectedRows.length,
    freeze_row_count: freezeRows.length,
    command_execution_allowed: false,
    protected_pass_allowed_without_receipt: false,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-command-evidence-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_command_evidence_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--phase-ledger") {
      args.phaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P561-P580 Zendd-Hermes command evidence bridge.
--check validates without writing artifacts or executing Zendd commands.
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

function normalizeCommandKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
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

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Command Evidence Summary",
    "",
    `- Status: ${summary.zendd_command_evidence_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Command evidence rows: ${summary.command_evidence_row_count}`,
    `- Protected command rows: ${summary.protected_command_count}`,
    `- Freeze rows: ${summary.freeze_row_count}`,
    `- Command execution allowed: ${summary.command_execution_allowed}`,
    `- Protected PASS without receipt allowed: ${summary.protected_pass_allowed_without_receipt}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.command_evidence_policy.next_allowed_action,
    "",
  ].join("\n");
}
