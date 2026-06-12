import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryG1aOpeningPacket } from "./factory-g1a-opening-packet.mjs";

export const DEFAULT_FACTORY_G1A_OWNER_RECEIPT_INTAKE_OUT_DIR = "artifacts/factory-g1a-owner-receipt-intake/latest";
export const DEFAULT_FACTORY_G1A_OWNER_RECEIPT_INTAKE_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:g1a-owner-receipt-intake";
const SCHEMA_VERSION = "factory-g1a-owner-receipt-intake.v1";
const CAPABILITY_ID = "factory.g1a_owner_receipt_intake";
const PROGRAM_RANGE = "G-SERIES.1a.receipt-intake";
const READY_STATUS = "ready_g1a_owner_receipt_for_source_literal_commit";
const WAITING_STATUS = "waiting_for_signed_g1a_owner_receipt";
const BLOCKED_STATUS = "blocked_g1a_owner_receipt_intake";
const HASH_RE = /^[a-f0-9]{64}$/i;

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

export async function runFactoryG1aOwnerReceiptIntake(options = {}) {
  const result = await buildFactoryG1aOwnerReceiptIntake(options);
  if (!options.check && options.write !== false) await writeFactoryG1aOwnerReceiptIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Owner Receipt Intake failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_owner_receipt_intake_status !== READY_STATUS) {
    const error = new Error("Factory G1a Owner Receipt Intake is not ready for source-literal commit.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aOwnerReceiptIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_OWNER_RECEIPT_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = Object.prototype.hasOwnProperty.call(options, "structuredSummary")
    ? normalizeInlineJsonSource("inline.structured_summary", options.structuredSummary)
    : await readJsonSource(inputs.structured_summary_path);
  const openingPacket = Object.prototype.hasOwnProperty.call(options, "openingPacket")
    ? normalizeInlineBuiltSource("inline.opening_packet", options.openingPacket)
    : normalizeInlineBuiltSource("built.opening_packet", await buildFactoryG1aOpeningPacket({
      repoRoot: inputs.repo_root,
      structuredSummary: structuredSummary.data,
      runAt: generatedAt,
      commitRef: options.commitRef,
      write: false,
    }));
  const ownerReceipt = await resolveOwnerReceiptSource({ options, openingPacket });
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const sourceState = buildSourceState({ packageJson, structuredSummary, openingPacket, commitRef });
  const receiptRows = buildReceiptRows({ sourceState, ownerReceipt, generatedAt });
  const boundary = buildBoundary({ sourceState, ownerReceipt, receiptRows, generatedAt });
  const validationItems = buildValidationItems({ sourceState, ownerReceipt, receiptRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceState, ownerReceipt, receiptRows, boundary, validation });
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
      structured_summary_path: structuredSummary.path,
      opening_packet_ref: openingPacket.path,
      owner_receipt_path: ownerReceipt.path,
    },
    source_summaries: {
      g1a_opening_packet_status: sourceState.openingPacketStatus,
      g1a_claude_review_evidence_status: sourceState.claudeReviewEvidenceStatus,
      g1a_claude_code_review_blocking_findings: sourceState.claudeReviewBlockingFindings,
      g1a_source_literal_opening_commit_applied_now: sourceState.sourceLiteralOpeningCommitAppliedNow,
    },
    owner_gate_opening_receipt_candidate: ownerReceipt.data,
    owner_receipt_intake_rows: receiptRows,
    factory_g1a_owner_receipt_intake_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryG1aOwnerReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-owner-receipt-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "owner-receipt-intake-rows.json"), collectionEnvelope("factory-g1a-owner-receipt-intake-rows.v1", "owner_receipt_intake_rows", result.owner_receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "owner-receipt-candidate.json"), result.owner_gate_opening_receipt_candidate ?? {});
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_owner_receipt_intake_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-owner-receipt-intake-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aOwnerReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aOwnerReceiptIntake(args);
    console.log(`Factory G1a Owner Receipt Intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_owner_receipt_intake_status}`);
    console.log(`Owner receipt signed: ${result.summary.owner_gate_opening_receipt_signed_now}`);
    console.log(`Ready for source literal commit: ${result.summary.g1a_owner_receipt_ready_for_source_literal_commit}`);
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
  const defaults = DEFAULT_FACTORY_G1A_OWNER_RECEIPT_INTAKE_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
  };
}

async function resolveOwnerReceiptSource({ options, openingPacket }) {
  if (Object.prototype.hasOwnProperty.call(options, "ownerReceipt")) {
    return normalizeInlineJsonSource("inline.owner_receipt", options.ownerReceipt);
  }
  if (options.ownerReceiptPath) return readJsonSource(options.ownerReceiptPath);
  return {
    path: `${openingPacket.path}.owner_gate_opening_receipt_template`,
    available: true,
    data: openingPacket.data?.owner_gate_opening_receipt_template ?? null,
    text: JSON.stringify(openingPacket.data?.owner_gate_opening_receipt_template ?? null),
    error: null,
  };
}

function buildSourceState({ packageJson, structuredSummary, openingPacket, commitRef }) {
  const scripts = packageJson.data?.scripts ?? {};
  const summary = structuredSummary.data ?? {};
  const packetSummary = openingPacket.data?.summary ?? {};
  return {
    packageScriptRegistered: typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-owner-receipt-intake.mjs"),
    commitRefPresent: Boolean(commitRef),
    openingPacketReady: packetSummary.factory_g1a_opening_packet_status === "ready_factory_g1a_opening_packet"
      || summary.g1a_opening_packet_status === "ready_factory_g1a_opening_packet",
    openingPacketStatus: packetSummary.factory_g1a_opening_packet_status ?? summary.g1a_opening_packet_status ?? null,
    claudeReviewEvidenceReady: summary.g1a_claude_review_evidence_status === "valid_review_evidence"
      && Number(summary.g1a_claude_code_review_blocking_findings ?? -1) === 0,
    claudeReviewEvidenceStatus: summary.g1a_claude_review_evidence_status ?? null,
    claudeReviewBlockingFindings: Number(summary.g1a_claude_code_review_blocking_findings ?? -1),
    sourceLiteralOpeningCommitAppliedNow: summary.g1a_source_literal_opening_commit_applied_now === true,
  };
}

function buildReceiptRows({ sourceState, ownerReceipt, generatedAt }) {
  const receipt = ownerReceipt.data ?? {};
  const signed = receipt.human_owner_signed === true && receipt.receipt_status === "signed";
  const candidateBound = HASH_RE.test(receipt.bound_candidate_manifest_sha256 ?? "")
    || HASH_RE.test(receipt.bound_candidate_packet_sha256 ?? "");
  return [
    receiptRow("source.opening_packet_ready", "source", sourceState.openingPacketReady ? "pass" : "fail", "G1a opening packet is ready", "docs/factory-promotion/99-structured-summary.json", generatedAt),
    receiptRow("source.independent_review_ready", "source", sourceState.claudeReviewEvidenceReady ? "pass" : "fail", "G1a independent Claude review evidence is valid and has no blocking findings", "docs/factory-promotion/99-structured-summary.json", generatedAt),
    receiptRow("receipt.available", "receipt", ownerReceipt.available ? "pass" : "fail", "Owner receipt candidate is available", ownerReceipt.path, generatedAt),
    receiptRow("receipt.schema", "receipt", receipt.schema_version === "factory-gate-opening-owner-receipt.v1" ? "pass" : "fail", "Owner receipt schema is factory-gate-opening-owner-receipt.v1", ownerReceipt.path, generatedAt),
    receiptRow("receipt.kind", "receipt", receipt.receipt_kind === "gate_opening" ? "pass" : "fail", "Owner receipt kind is gate_opening", ownerReceipt.path, generatedAt),
    receiptRow("receipt.gate", "receipt", receipt.gate_id === "G1a" && receipt.gate_name === "project_creation" ? "pass" : "fail", "Owner receipt targets G1a project_creation", ownerReceipt.path, generatedAt),
    receiptRow("receipt.authority_flag", "authority", receipt.authority_flag === "project_creation_allowed_now" ? "pass" : "fail", "Owner receipt authority flag is project_creation_allowed_now", ownerReceipt.path, generatedAt),
    receiptRow("receipt.signed", "owner_signature", signed ? "pass" : "wait", "Human owner signature is present and receipt_status is signed", ownerReceipt.path, generatedAt),
    receiptRow("receipt.owner_identity", "owner_signature", signed && hasText(receipt.owner_name) && isIsoDate(receipt.owner_signed_at) ? "pass" : "wait", "Owner name and signed timestamp are present", ownerReceipt.path, generatedAt),
    receiptRow("receipt.owner_decision", "owner_signature", signed && receipt.owner_decision === "approve_g1a_opening" ? "pass" : "wait", "Owner decision explicitly approves G1a opening", ownerReceipt.path, generatedAt),
    receiptRow("receipt.one_action", "scope", receipt.one_receipt_one_action === true ? "pass" : "fail", "Receipt is one receipt for one action", ownerReceipt.path, generatedAt),
    receiptRow("receipt.scope_limit", "scope", String(receipt.scope_limit ?? "").includes("workspace creation") ? "pass" : "fail", "Receipt scope is limited to workspace creation", ownerReceipt.path, generatedAt),
    receiptRow("receipt.target_action", "scope", receipt.target_action === "project_workspace_creation" && receipt.target_action_status === "not_performed" ? "pass" : "fail", "Target action is one not-yet-performed project workspace creation", ownerReceipt.path, generatedAt),
    receiptRow("receipt.candidate_bound", "candidate_binding", candidateBound ? "pass" : "wait", "Receipt binds a candidate manifest or candidate packet SHA-256", ownerReceipt.path, generatedAt),
    receiptRow("receipt.independent_review_ref", "review_binding", hasText(receipt.independent_review_receipt_ref) ? "pass" : "wait", "Receipt binds independent review evidence", ownerReceipt.path, generatedAt),
    receiptRow("receipt.source_literal_required", "source_literal", receipt.source_literal_opening_commit_required === true && receipt.source_literal_opening_commit_sha === null ? "pass" : "fail", "Receipt requires a future source-literal opening commit and has not bound one yet", ownerReceipt.path, generatedAt),
    receiptRow("receipt.first_use_audit_required", "first_use_audit", receipt.first_use_audit_required === true && receipt.first_use_audit_ref === null ? "pass" : "fail", "Receipt requires future first-use audit", ownerReceipt.path, generatedAt),
    receiptRow("receipt.authority_closed", "authority", receiptAuthorityClosed(receipt) ? "pass" : "fail", "Receipt does not open protected authority by itself", ownerReceipt.path, generatedAt),
  ];
}

function buildBoundary({ sourceState, ownerReceipt, receiptRows, generatedAt }) {
  const receipt = ownerReceipt.data ?? {};
  const failCount = receiptRows.filter((row) => row.current_verdict === "fail").length;
  const waitCount = receiptRows.filter((row) => row.current_verdict === "wait").length;
  const passCount = receiptRows.filter((row) => row.current_verdict === "pass").length;
  const ready = failCount === 0 && waitCount === 0 && sourceState.openingPacketReady && sourceState.claudeReviewEvidenceReady;
  return {
    schema_version: "factory-g1a-owner-receipt-intake-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    intake_only: true,
    owner_receipt_available: ownerReceipt.available === true,
    owner_gate_opening_receipt_signed_now: receipt.human_owner_signed === true && receipt.receipt_status === "signed",
    owner_receipt_pass_count: passCount,
    owner_receipt_wait_count: waitCount,
    owner_receipt_fail_count: failCount,
    g1a_owner_receipt_ready_for_source_literal_commit: ready,
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    opens_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    g1a_owner_receipt_intake_can_open_gate_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ sourceState, ownerReceipt, receiptRows, boundary }) {
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:g1a-owner-receipt-intake"),
    validationItem("source.commit_ref_present", "source", sourceState.commitRefPresent, "Current commit ref is missing"),
    validationItem("source.opening_packet_ready", "source", sourceState.openingPacketReady, "G1a opening packet is not ready"),
    validationItem("source.independent_review_ready", "source", sourceState.claudeReviewEvidenceReady, "G1a independent review evidence is not valid or has blocking findings"),
    validationItem("receipt.available", "receipt", ownerReceipt.available === true, "Owner receipt candidate is missing"),
    validationItem("receipt.rows_present", "receipt", receiptRows.length >= 18, "Owner receipt intake rows are incomplete"),
    validationItem("receipt.no_fail_rows", "receipt", receiptRows.every((row) => row.current_verdict !== "fail"), "Owner receipt candidate has hard validation failures"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Owner receipt intake opened forbidden authority"),
  ];
}

function buildSummary({ ownerReceipt, boundary, validation }) {
  const receipt = ownerReceipt.data ?? {};
  const hardFailed = validation.valid === false || boundary.owner_receipt_fail_count > 0;
  const ready = validation.valid === true && boundary.g1a_owner_receipt_ready_for_source_literal_commit === true;
  const status = hardFailed ? BLOCKED_STATUS : ready ? READY_STATUS : WAITING_STATUS;
  return {
    factory_g1a_owner_receipt_intake_status: status,
    program_range: PROGRAM_RANGE,
    owner_receipt_path: ownerReceipt.path,
    owner_gate_opening_receipt_signed_now: boundary.owner_gate_opening_receipt_signed_now,
    owner_receipt_status: receipt.receipt_status ?? null,
    owner_receipt_pass_count: boundary.owner_receipt_pass_count,
    owner_receipt_wait_count: boundary.owner_receipt_wait_count,
    owner_receipt_fail_count: boundary.owner_receipt_fail_count,
    g1a_owner_receipt_ready_for_source_literal_commit: ready,
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    g1a_owner_receipt_intake_can_open_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    data_driven_gate_opening_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function receiptRow(rowId, category, currentVerdict, message, evidenceRef, generatedAt) {
  return {
    schema_version: "factory-g1a-owner-receipt-intake-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-owner-receipt-intake-validation-item.v1",
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
    "g1a_owner_receipt_intake_can_open_gate_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function receiptAuthorityClosed(receipt) {
  return Object.keys(CLOSED_AUTHORITY_FLAGS).every((flag) => receipt?.[flag] === false)
    && receipt?.production_pass_enabled === false
    && receipt?.enterprise_pass_enabled === false;
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Owner Receipt Intake",
    "",
    `Status: ${result.summary.factory_g1a_owner_receipt_intake_status}`,
    `Program: ${result.program_range}`,
    `Owner receipt signed: ${result.summary.owner_gate_opening_receipt_signed_now}`,
    `Ready for source literal commit: ${result.summary.g1a_owner_receipt_ready_for_source_literal_commit}`,
    `Receipt rows pass/wait/fail: ${result.summary.owner_receipt_pass_count}/${result.summary.owner_receipt_wait_count}/${result.summary.owner_receipt_fail_count}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
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
  console.log(`Usage: node scripts/factory-g1a-owner-receipt-intake.mjs [--check] [--require-pass] [--owner-receipt-path <path>] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nValidates a signed G1a owner gate-opening receipt candidate without opening project creation authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text, error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourcePath, data) {
  return { path: sourcePath, available: true, data, text: JSON.stringify(data), error: null };
}

function normalizeInlineBuiltSource(sourcePath, data) {
  return { path: sourcePath, available: true, data, error: null };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
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
