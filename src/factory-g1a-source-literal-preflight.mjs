import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryG1aOwnerReceiptIntake } from "./factory-g1a-owner-receipt-intake.mjs";

export const DEFAULT_FACTORY_G1A_SOURCE_LITERAL_PREFLIGHT_OUT_DIR = "artifacts/factory-g1a-source-literal-preflight/latest";
export const DEFAULT_FACTORY_G1A_SOURCE_LITERAL_PREFLIGHT_INPUTS = {
  packagePath: "package.json",
  gateOpeningSourcePath: "src/factory-gate-opening-readiness.mjs",
};

const COMMAND_NAME = "factory:g1a-source-literal-preflight";
const SCHEMA_VERSION = "factory-g1a-source-literal-preflight.v1";
const CAPABILITY_ID = "factory.g1a_source_literal_preflight";
const PROGRAM_RANGE = "G-SERIES.1a.source-literal-preflight";
const READY_STATUS = "ready_g1a_source_literal_commit_preflight";
const WAITING_STATUS = "waiting_for_signed_g1a_owner_receipt";
const BLOCKED_STATUS = "blocked_g1a_source_literal_preflight";
const OWNER_INTAKE_READY_STATUS = "ready_g1a_owner_receipt_for_source_literal_commit";

const CLOSED_AUTHORITY_FLAGS = {
  project_creation_allowed_now: false,
  review_decision_allowed_now: false,
  approval_allowed_now: false,
  apply_allowed_now: false,
  command_execution_enabled: false,
  command_execution_allowed_now: false,
  work_packet_execution_allowed_now: false,
  work_item_execution_allowed_now: false,
  validation_loop_execution_allowed_now: false,
  worker_execution_allowed_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryG1aSourceLiteralPreflight(options = {}) {
  const result = await buildFactoryG1aSourceLiteralPreflight(options);
  if (!options.check && options.write !== false) await writeFactoryG1aSourceLiteralPreflight(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Source Literal Preflight failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_source_literal_preflight_status !== READY_STATUS) {
    const error = new Error("Factory G1a Source Literal Preflight is not ready for an isolated source-literal commit.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aSourceLiteralPreflight(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_SOURCE_LITERAL_PREFLIGHT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const gateOpeningSource = await readTextSource(inputs.gate_opening_source_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const ownerReceiptIntake = await buildFactoryG1aOwnerReceiptIntake({
    ...options,
    repoRoot: inputs.repo_root,
    runAt: generatedAt,
    commitRef,
    write: false,
  });
  const sourceFacts = buildSourceFacts(gateOpeningSource);
  const receipt = ownerReceiptIntake.owner_gate_opening_receipt_candidate ?? null;
  const ownerReceiptSha256 = receipt ? sha256(canonicalize(receipt)) : null;
  const proposedChange = buildProposedSourceLiteralChange({
    receipt,
    ownerReceiptSha256,
    gateOpeningSource,
    generatedAt,
  });
  const preflightRows = buildPreflightRows({
    ownerReceiptIntake,
    sourceFacts,
    proposedChange,
    receipt,
    ownerReceiptSha256,
    generatedAt,
  });
  const boundary = buildBoundary({ ownerReceiptIntake, sourceFacts, proposedChange, preflightRows, generatedAt });
  const validationItems = buildValidationItems({ packageJson, gateOpeningSource, ownerReceiptIntake, sourceFacts, proposedChange, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ ownerReceiptIntake, preflightRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      reviewed_commit_sha: commitRef || null,
      gate_opening_source_path: gateOpeningSource.path,
      owner_receipt_path: ownerReceiptIntake.summary.owner_receipt_path,
    },
    source_summaries: {
      owner_receipt_intake_status: ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status,
      owner_receipt_signed_now: ownerReceiptIntake.summary.owner_gate_opening_receipt_signed_now,
      current_g1a_source_literal_value: sourceFacts.g1aSourceLiteralValue,
      current_g1a_receipt_count: sourceFacts.g1aReceiptCount,
      current_g1a_first_use_audit_count: sourceFacts.g1aFirstUseAuditCount,
    },
    owner_receipt_sha256: ownerReceiptSha256,
    owner_gate_opening_receipt_candidate: receipt,
    proposed_source_literal_change: proposedChange,
    source_literal_preflight_rows: preflightRows,
    factory_g1a_source_literal_preflight_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryG1aSourceLiteralPreflight(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-source-literal-preflight.json"), serializableResult(result));
  await writeJson(path.join(outDir, "source-literal-preflight-rows.json"), collectionEnvelope("factory-g1a-source-literal-preflight-rows.v1", "source_literal_preflight_rows", result.source_literal_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "proposed-source-literal-change.json"), result.proposed_source_literal_change);
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_source_literal_preflight_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-source-literal-preflight-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aSourceLiteralPreflightCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aSourceLiteralPreflight(args);
    console.log(`Factory G1a Source Literal Preflight ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_source_literal_preflight_status}`);
    console.log(`Owner receipt signed: ${result.summary.owner_gate_opening_receipt_signed_now}`);
    console.log(`Ready for isolated source literal commit: ${result.summary.ready_for_isolated_source_literal_commit}`);
    console.log(`Source mutation applied now: ${result.summary.source_literal_opening_commit_applied_now}`);
    console.log(`G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_G1A_SOURCE_LITERAL_PREFLIGHT_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    gate_opening_source_path: path.resolve(repoRoot, options.gateOpeningSourcePath ?? defaults.gateOpeningSourcePath),
  };
}

function buildSourceFacts(source) {
  const text = source.text ?? "";
  return {
    source_available: source.available === true,
    source_text_sha256: source.available ? sha256(text) : null,
    g1aSourceLiteralValue: extractSourceLiteralValue(text, "G1a"),
    g1aReceiptCount: countLiteralObjectsForGate(text, "SOURCE_LITERAL_GATE_OPENING_RECEIPTS", "G1a"),
    g1aFirstUseAuditCount: countLiteralObjectsForGate(text, "SOURCE_LITERAL_FIRST_USE_AUDITS", "G1a"),
  };
}

function buildProposedSourceLiteralChange({ receipt, ownerReceiptSha256, gateOpeningSource, generatedAt }) {
  const receiptId = receipt?.receipt_id ?? "OWNER-G1A-GATE-OPENING-<signed-id>";
  const signedAt = receipt?.owner_signed_at ?? null;
  const reviewRef = receipt?.independent_review_receipt_ref ?? null;
  const scopeLimit = receipt?.scope_limit ?? "new product workspace creation only; one owner gate_opening receipt permits one scoped creation action";
  const currentSha = gateOpeningSource.available ? sha256(gateOpeningSource.text) : null;
  const change = {
    schema_version: "factory-g1a-source-literal-change-preview.v1",
    generated_at: generatedAt,
    preview_only: true,
    apply_allowed_now: false,
    target_file: "src/factory-gate-opening-readiness.mjs",
    target_symbol: "SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a",
    source_file_sha256_before: currentSha,
    allowed_file_count: 1,
    allowed_files: ["src/factory-gate-opening-readiness.mjs"],
    required_replacements: [
      {
        replacement_id: "g1a.literal.false_to_true",
        before: "G1a: false,",
        after: "G1a: true,",
      },
      {
        replacement_id: "g1a.receipt.bind_one_owner_receipt",
        before: "const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [];",
        after: renderReceiptLiteral({ receiptId, ownerReceiptSha256, signedAt, reviewRef, scopeLimit }),
      },
    ],
    forbidden_replacements: [
      "SOURCE_LITERAL_GATE_OPEN_COMMITS.G1b",
      "SOURCE_LITERAL_GATE_OPEN_COMMITS.G2",
      "SOURCE_LITERAL_GATE_OPEN_COMMITS.G3",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "connector_write_allowed_now",
      "deployment_allowed_now",
    ],
    first_use_audit_required_after_commit: true,
    first_use_audit_added_by_this_preflight: false,
    first_use_audit_claimed_now: false,
  };
  return { ...change, change_preview_sha256: sha256(canonicalize(change)) };
}

function renderReceiptLiteral({ receiptId, ownerReceiptSha256, signedAt, reviewRef, scopeLimit }) {
  return [
    "const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [",
    "  {",
    "    gate_id: \"G1a\",",
    `    receipt_id: ${JSON.stringify(receiptId)},`,
    `    receipt_sha256: ${JSON.stringify(ownerReceiptSha256)},`,
    `    owner_signed_at: ${JSON.stringify(signedAt)},`,
    `    independent_review_receipt_ref: ${JSON.stringify(reviewRef)},`,
    `    scope_limit: ${JSON.stringify(scopeLimit)},`,
    "  },",
    "];",
  ].join("\n");
}

function buildPreflightRows({ ownerReceiptIntake, sourceFacts, proposedChange, receipt, ownerReceiptSha256, generatedAt }) {
  const intakeReady = ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status === OWNER_INTAKE_READY_STATUS;
  return [
    preflightRow("source.file_available", "source", sourceFacts.source_available ? "pass" : "fail", "Gate-opening source file is readable", generatedAt),
    preflightRow("source.g1a_literal_false", "source", sourceFacts.g1aSourceLiteralValue === false ? "pass" : "fail", "Current G1a source literal is false before the opening commit", generatedAt),
    preflightRow("source.no_existing_g1a_receipt", "source", sourceFacts.g1aReceiptCount === 0 ? "pass" : "fail", "No G1a owner receipt is already bound in source", generatedAt),
    preflightRow("source.no_existing_g1a_first_use_audit", "source", sourceFacts.g1aFirstUseAuditCount === 0 ? "pass" : "fail", "No G1a first-use audit is already bound in source", generatedAt),
    preflightRow("owner_receipt.intake_valid", "owner_receipt", ownerReceiptIntake.validation.valid ? "pass" : "fail", "Owner receipt intake has no hard validation failures", generatedAt),
    preflightRow("owner_receipt.signed_ready", "owner_receipt", intakeReady ? "pass" : "wait", "Signed scoped owner receipt is ready for source-literal commit", generatedAt),
    preflightRow("owner_receipt.hash_bound", "owner_receipt", ownerReceiptSha256 ? "pass" : "wait", "Owner receipt SHA-256 can be bound into source", generatedAt),
    preflightRow("owner_receipt.gate_scope", "owner_receipt", receipt?.gate_id === "G1a" && receipt?.authority_flag === "project_creation_allowed_now" ? "pass" : "fail", "Receipt targets only G1a project creation", generatedAt),
    preflightRow("patch.single_file", "patch", proposedChange.allowed_file_count === 1 && proposedChange.allowed_files.length === 1 ? "pass" : "fail", "Future source-literal commit is constrained to one source file", generatedAt),
    preflightRow("patch.false_to_true_only", "patch", proposedChange.required_replacements.some((item) => item.replacement_id === "g1a.literal.false_to_true") ? "pass" : "fail", "Future patch changes only G1a false to true for gate-open literal", generatedAt),
    preflightRow("patch.receipt_binding", "patch", proposedChange.required_replacements.some((item) => item.replacement_id === "g1a.receipt.bind_one_owner_receipt") ? "pass" : "fail", "Future patch binds exactly one signed owner receipt", generatedAt),
    preflightRow("patch.first_use_not_claimed", "patch", proposedChange.first_use_audit_claimed_now === false && proposedChange.first_use_audit_required_after_commit === true ? "pass" : "fail", "Preflight does not claim first-use audit before first use", generatedAt),
  ];
}

function buildBoundary({ ownerReceiptIntake, sourceFacts, proposedChange, preflightRows, generatedAt }) {
  const failCount = preflightRows.filter((row) => row.current_verdict === "fail").length;
  const waitCount = preflightRows.filter((row) => row.current_verdict === "wait").length;
  const passCount = preflightRows.filter((row) => row.current_verdict === "pass").length;
  const ready = failCount === 0
    && waitCount === 0
    && ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status === OWNER_INTAKE_READY_STATUS
    && sourceFacts.g1aSourceLiteralValue === false;
  return {
    schema_version: "factory-g1a-source-literal-preflight-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    preflight_only: true,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: false,
    ready_for_isolated_source_literal_commit: ready,
    proposed_change_preview_sha256: proposedChange.change_preview_sha256,
    first_use_audit_present: false,
    g1a_source_literal_preflight_can_open_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    preflight_pass_count: passCount,
    preflight_wait_count: waitCount,
    preflight_fail_count: failCount,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ packageJson, gateOpeningSource, ownerReceiptIntake, sourceFacts, proposedChange, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script_registered", "package", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-source-literal-preflight.mjs"), "package.json does not register factory:g1a-source-literal-preflight"),
    validationItem("source.file_available", "source", gateOpeningSource.available === true, "Gate-opening source file is missing"),
    validationItem("source.g1a_literal_false", "source", sourceFacts.g1aSourceLiteralValue === false, "G1a source literal is not currently false"),
    validationItem("source.no_existing_g1a_receipt", "source", sourceFacts.g1aReceiptCount === 0, "G1a owner receipt is already bound in source"),
    validationItem("owner_receipt_intake.valid", "owner_receipt", ownerReceiptIntake.validation.valid === true, "Owner receipt intake has hard validation failures"),
    validationItem("patch.preview_only", "patch", proposedChange.preview_only === true && proposedChange.apply_allowed_now === false, "Source literal preflight tried to apply a source change"),
    validationItem("patch.single_file", "patch", proposedChange.allowed_files.length === 1 && proposedChange.allowed_files[0] === "src/factory-gate-opening-readiness.mjs", "Source literal patch is not constrained to the gate-opening source file"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Source literal preflight opened forbidden authority"),
  ];
}

function buildSummary({ ownerReceiptIntake, preflightRows, boundary, validation }) {
  const hardFailed = validation.valid === false || boundary.preflight_fail_count > 0;
  const ready = validation.valid === true && boundary.ready_for_isolated_source_literal_commit === true;
  const status = hardFailed ? BLOCKED_STATUS : ready ? READY_STATUS : WAITING_STATUS;
  return {
    factory_g1a_source_literal_preflight_status: status,
    program_range: PROGRAM_RANGE,
    owner_receipt_intake_status: ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status,
    owner_gate_opening_receipt_signed_now: ownerReceiptIntake.summary.owner_gate_opening_receipt_signed_now,
    ready_for_isolated_source_literal_commit: ready,
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    g1a_source_literal_preflight_can_open_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    validation_errors: validation.errors.length,
    preflight_row_count: preflightRows.length,
    preflight_pass_count: boundary.preflight_pass_count,
    preflight_wait_count: boundary.preflight_wait_count,
    preflight_fail_count: boundary.preflight_fail_count,
    proposed_change_preview_sha256: boundary.proposed_change_preview_sha256,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function preflightRow(rowId, category, currentVerdict, message, generatedAt) {
  return {
    schema_version: "factory-g1a-source-literal-preflight-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    generated_at: generatedAt,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-source-literal-preflight-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
  }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function boundaryFlagsClosed(boundary) {
  return [
    ...Object.keys(CLOSED_AUTHORITY_FLAGS),
    "factory_promotion_goal_complete_allowed_now",
    "g1a_project_creation_gate_open_now",
    "g1a_source_literal_preflight_can_open_gate_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Source Literal Preflight",
    "",
    `Status: ${result.summary.factory_g1a_source_literal_preflight_status}`,
    `Program: ${result.program_range}`,
    `Owner receipt intake: ${result.summary.owner_receipt_intake_status}`,
    `Owner receipt signed: ${result.summary.owner_gate_opening_receipt_signed_now}`,
    `Ready for isolated source literal commit: ${result.summary.ready_for_isolated_source_literal_commit}`,
    `Source mutation applied now: ${result.summary.source_literal_opening_commit_applied_now}`,
    `First-use audit present: ${result.summary.first_use_audit_present}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Preflight rows pass/wait/fail: ${result.summary.preflight_pass_count}/${result.summary.preflight_wait_count}/${result.summary.preflight_fail_count}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--owner-receipt-path") args.ownerReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g1a-source-literal-preflight.mjs [--check] [--require-pass] [--owner-receipt-path <path>] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds a read-only preflight for the future isolated G1a source-literal opening commit. It never mutates source or opens project creation authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text, error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, error: null };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function extractSourceLiteralValue(sourceText, gateId) {
  const match = String(sourceText ?? "").match(/const\s+SOURCE_LITERAL_GATE_OPEN_COMMITS\s*=\s*\{([\s\S]*?)\};/);
  if (!match) return null;
  const block = match[1];
  if (new RegExp(`\\b${gateId}:\\s*true\\b`).test(block)) return true;
  if (new RegExp(`\\b${gateId}:\\s*false\\b`).test(block)) return false;
  return null;
}

function countLiteralObjectsForGate(sourceText, symbolName, gateId) {
  const match = String(sourceText ?? "").match(new RegExp(`const\\s+${symbolName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) return 0;
  const gatePattern = new RegExp(`gate_id\\s*:\\s*["']${gateId}["']`, "g");
  return [...match[1].matchAll(gatePattern)].length;
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function serializableResult(result) {
  const { markdown, ...json } = result;
  return json;
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
