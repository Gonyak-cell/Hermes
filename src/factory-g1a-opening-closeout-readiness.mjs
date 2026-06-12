import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryGateOpeningReadiness } from "./factory-gate-opening-readiness.mjs";
import { buildFactoryG1aOpeningPacket } from "./factory-g1a-opening-packet.mjs";
import { buildFactoryG1aOwnerReceiptIntake } from "./factory-g1a-owner-receipt-intake.mjs";
import { buildFactoryG1aSourceLiteralPreflight } from "./factory-g1a-source-literal-preflight.mjs";

export const DEFAULT_FACTORY_G1A_OPENING_CLOSEOUT_READINESS_OUT_DIR = "artifacts/factory-g1a-opening-closeout-readiness/latest";

const COMMAND_NAME = "factory:g1a-opening-closeout-readiness";
const SCHEMA_VERSION = "factory-g1a-opening-closeout-readiness.v1";
const CAPABILITY_ID = "factory.g1a_opening_closeout_readiness";
const PROGRAM_RANGE = "G-SERIES.1a.closeout-readiness";
const READY_STATUS = "ready_g1a_opening_closeout_for_owner_adjudication";
const SOURCE_READY_STATUS = "ready_for_isolated_source_literal_commit";
const WAITING_RECEIPT_STATUS = "waiting_for_signed_g1a_owner_receipt";
const BLOCKED_STATUS = "blocked_g1a_opening_closeout_readiness";

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

export async function runFactoryG1aOpeningCloseoutReadiness(options = {}) {
  const result = await buildFactoryG1aOpeningCloseoutReadiness(options);
  if (!options.check && options.write !== false) await writeFactoryG1aOpeningCloseoutReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Opening Closeout Readiness failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_opening_closeout_readiness_status !== READY_STATUS) {
    const error = new Error("Factory G1a Opening Closeout Readiness is not ready for owner closeout adjudication.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aOpeningCloseoutReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_OPENING_CLOSEOUT_READINESS_OUT_DIR);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(repoRoot);
  const sharedOptions = { ...options, repoRoot, runAt: generatedAt, commitRef, write: false };
  const gateReadiness = await buildFactoryGateOpeningReadiness(sharedOptions);
  const openingPacket = await buildFactoryG1aOpeningPacket({ ...sharedOptions, gateOpeningReadiness: gateReadiness });
  const ownerReceiptIntake = await buildFactoryG1aOwnerReceiptIntake({ ...sharedOptions, openingPacket });
  const sourceLiteralPreflight = await buildFactoryG1aSourceLiteralPreflight({ ...sharedOptions, ownerReceiptIntake });
  const g1aGateRow = gateReadiness.factory_gate_opening_readiness_rows.find((row) => row.gate_id === "G1a") ?? null;
  const chainRows = buildChainRows({
    gateReadiness,
    openingPacket,
    ownerReceiptIntake,
    sourceLiteralPreflight,
    g1aGateRow,
    generatedAt,
  });
  const blockerRows = buildBlockerRows({ chainRows, generatedAt });
  const boundary = buildBoundary({ chainRows, blockerRows, g1aGateRow, generatedAt });
  const validationItems = buildValidationItems({
    gateReadiness,
    openingPacket,
    ownerReceiptIntake,
    sourceLiteralPreflight,
    chainRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ chainRows, blockerRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    source_refs: {
      reviewed_commit_sha: commitRef || null,
      gate_opening_readiness_ref: gateReadiness.source_refs?.current_commit_ref ? "built.factory_gate_opening_readiness" : null,
      opening_packet_ref: openingPacket.source_refs?.reviewed_commit_sha ? "built.g1a_opening_packet" : null,
      owner_receipt_path: ownerReceiptIntake.summary.owner_receipt_path,
      source_literal_preflight_ref: "built.g1a_source_literal_preflight",
    },
    source_summaries: {
      g0_status: gateReadiness.summary.factory_gate_opening_readiness_status,
      g1a_opening_packet_status: openingPacket.summary.factory_g1a_opening_packet_status,
      g1a_owner_receipt_intake_status: ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status,
      g1a_source_literal_preflight_status: sourceLiteralPreflight.summary.factory_g1a_source_literal_preflight_status,
      g1a_gate_status: g1aGateRow?.gate_status ?? null,
    },
    g1a_opening_closeout_chain_rows: chainRows,
    g1a_opening_closeout_blocker_rows: blockerRows,
    factory_g1a_opening_closeout_readiness_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryG1aOpeningCloseoutReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-opening-closeout-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "closeout-chain-rows.json"), collectionEnvelope("factory-g1a-opening-closeout-chain-rows.v1", "g1a_opening_closeout_chain_rows", result.g1a_opening_closeout_chain_rows, result.generated_at));
  await writeJson(path.join(outDir, "closeout-blocker-rows.json"), collectionEnvelope("factory-g1a-opening-closeout-blocker-rows.v1", "g1a_opening_closeout_blocker_rows", result.g1a_opening_closeout_blocker_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_opening_closeout_readiness_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-opening-closeout-readiness-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aOpeningCloseoutReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aOpeningCloseoutReadiness(args);
    console.log(`Factory G1a Opening Closeout Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_opening_closeout_readiness_status}`);
    console.log(`Chain pass/wait/fail: ${result.summary.chain_pass_count}/${result.summary.chain_wait_count}/${result.summary.chain_fail_count}`);
    console.log(`Blockers: ${result.summary.blocker_count}`);
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

function buildChainRows({ gateReadiness, openingPacket, ownerReceiptIntake, sourceLiteralPreflight, g1aGateRow, generatedAt }) {
  const gateReady = gateReadiness.summary.factory_gate_opening_readiness_status === "ready_factory_gate_opening_readiness";
  const packetReady = openingPacket.summary.factory_g1a_opening_packet_status === "ready_factory_g1a_opening_packet";
  const ownerSigned = ownerReceiptIntake.summary.owner_gate_opening_receipt_signed_now === true;
  const ownerReady = ownerReceiptIntake.summary.g1a_owner_receipt_ready_for_source_literal_commit === true;
  const sourceReady = sourceLiteralPreflight.summary.ready_for_isolated_source_literal_commit === true;
  const sourceApplied = g1aGateRow?.source_literal_gate_open_commit_present === true;
  const sourceReceiptBound = g1aGateRow?.owner_gate_opening_receipt_present === true;
  const firstUseAudit = g1aGateRow?.first_use_audit_present === true;
  return [
    chainRow("g0.readiness_ready", "source_chain", gateReady ? "pass" : "fail", "G-series gate opening readiness is valid", gateReadiness.summary.factory_gate_opening_readiness_status, generatedAt),
    chainRow("g1a.packet_ready", "packet", packetReady ? "pass" : "fail", "G1a opening packet is ready and reviewed", openingPacket.summary.factory_g1a_opening_packet_status, generatedAt),
    chainRow("g1a.packet_review_valid", "independent_review", openingPacket.summary.g1a_project_creation_gate_open_now === false && openingPacket.summary.independent_review_packet_ready === true ? "pass" : "fail", "G1a packet independent review packet exists and does not open G1a", openingPacket.summary.independent_review_packet_ready, generatedAt),
    chainRow("owner_receipt.signed", "owner_receipt", ownerSigned ? "pass" : "wait", "Signed owner gate_opening receipt is present", ownerReceiptIntake.summary.owner_gate_opening_receipt_signed_now, generatedAt),
    chainRow("owner_receipt.intake_ready", "owner_receipt", ownerReady ? "pass" : "wait", "Owner receipt intake is ready for source-literal commit", ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status, generatedAt),
    chainRow("source_literal.preflight_ready", "source_literal", sourceReady ? "pass" : "wait", "Source-literal preflight is ready for an isolated commit", sourceLiteralPreflight.summary.factory_g1a_source_literal_preflight_status, generatedAt),
    chainRow("source_literal.commit_applied", "source_literal", sourceApplied ? "pass" : "wait", "Source-literal opening commit is applied in source", sourceApplied, generatedAt),
    chainRow("source_literal.owner_receipt_bound", "source_literal", sourceReceiptBound ? "pass" : "wait", "Source-literal commit binds the owner receipt", sourceReceiptBound, generatedAt),
    chainRow("first_use.audit_present", "first_use_audit", firstUseAudit ? "pass" : "wait", "First-use audit is captured after opening", firstUseAudit, generatedAt),
    chainRow("authority.closed_until_complete", "authority", authorityClosedAcross(openingPacket, ownerReceiptIntake, sourceLiteralPreflight, g1aGateRow) ? "pass" : "fail", "Authority remains closed until the full G1a closeout chain is complete", false, generatedAt),
  ];
}

function buildBlockerRows({ chainRows, generatedAt }) {
  return chainRows
    .filter((row) => row.current_verdict !== "pass")
    .map((row, index) => {
      const blocker = {
        schema_version: "factory-g1a-opening-closeout-blocker-row.v1",
        blocker_id: `g1a.closeout.blocker.${row.row_id}`,
        source_row_id: row.row_id,
        blocker_status: row.current_verdict === "fail" ? "hard_blocked" : "waiting",
        next_operator_action: nextActionForRow(row),
        generated_at: generatedAt,
        ordinal: index + 1,
      };
      return { ...blocker, blocker_row_sha256: sha256(canonicalize(blocker)) };
    });
}

function buildBoundary({ chainRows, blockerRows, g1aGateRow, generatedAt }) {
  const failCount = chainRows.filter((row) => row.current_verdict === "fail").length;
  const waitCount = chainRows.filter((row) => row.current_verdict === "wait").length;
  const passCount = chainRows.filter((row) => row.current_verdict === "pass").length;
  const ready = failCount === 0 && waitCount === 0 && g1aGateRow?.gate_open_now === true;
  return {
    schema_version: "factory-g1a-opening-closeout-readiness-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    closeout_readiness_only: true,
    owner_adjudication_required: true,
    ready_for_g1a_opening_closeout_owner_adjudication: ready,
    blocker_count: blockerRows.length,
    chain_pass_count: passCount,
    chain_wait_count: waitCount,
    chain_fail_count: failCount,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_by_this_command: false,
    first_use_audit_claimed_by_this_command: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ gateReadiness, openingPacket, ownerReceiptIntake, sourceLiteralPreflight, chainRows, boundary }) {
  return [
    validationItem("source.g0_valid", "source", gateReadiness.validation.valid === true, "G0 gate-opening readiness has hard validation failures"),
    validationItem("source.g1a_packet_valid", "source", openingPacket.validation.valid === true, "G1a opening packet has hard validation failures"),
    validationItem("source.owner_receipt_intake_valid", "source", ownerReceiptIntake.validation.valid === true, "G1a owner receipt intake has hard validation failures"),
    validationItem("source.source_literal_preflight_valid", "source", sourceLiteralPreflight.validation.valid === true, "G1a source-literal preflight has hard validation failures"),
    validationItem("chain.rows_present", "chain", chainRows.length === 10, "G1a closeout chain row count changed unexpectedly"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "G1a closeout readiness opened forbidden authority"),
  ];
}

function buildSummary({ chainRows, blockerRows, boundary, validation }) {
  const hardFailed = validation.valid === false || boundary.chain_fail_count > 0;
  const ready = validation.valid === true && boundary.ready_for_g1a_opening_closeout_owner_adjudication === true;
  const sourceReady = chainRows.find((row) => row.row_id === "source_literal.preflight_ready")?.current_verdict === "pass";
  const status = hardFailed ? BLOCKED_STATUS : ready ? READY_STATUS : sourceReady ? SOURCE_READY_STATUS : WAITING_RECEIPT_STATUS;
  return {
    factory_g1a_opening_closeout_readiness_status: status,
    program_range: PROGRAM_RANGE,
    ready_for_g1a_opening_closeout_owner_adjudication: ready,
    blocker_count: blockerRows.length,
    chain_row_count: chainRows.length,
    chain_pass_count: boundary.chain_pass_count,
    chain_wait_count: boundary.chain_wait_count,
    chain_fail_count: boundary.chain_fail_count,
    waiting_blocker_ids: blockerRows.filter((row) => row.blocker_status === "waiting").map((row) => row.blocker_id),
    hard_blocker_ids: blockerRows.filter((row) => row.blocker_status === "hard_blocked").map((row) => row.blocker_id),
    owner_adjudication_required: true,
    source_literal_opening_commit_applied_by_this_command: false,
    first_use_audit_claimed_by_this_command: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function chainRow(rowId, category, currentVerdict, message, observedValue, generatedAt) {
  const row = {
    schema_version: "factory-g1a-opening-closeout-chain-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    observed_value: observedValue,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-opening-closeout-readiness-validation-item.v1",
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

function nextActionForRow(row) {
  if (row.row_id === "owner_receipt.signed") return "collect_signed_owner_gate_opening_receipt";
  if (row.row_id === "owner_receipt.intake_ready") return "rerun_owner_receipt_intake_with_signed_receipt";
  if (row.row_id === "source_literal.preflight_ready") return "rerun_source_literal_preflight_with_signed_receipt";
  if (row.row_id === "source_literal.commit_applied") return "prepare_isolated_source_literal_opening_commit_after_signed_receipt";
  if (row.row_id === "source_literal.owner_receipt_bound") return "bind_signed_owner_receipt_in_source_literal_commit";
  if (row.row_id === "first_use.audit_present") return "capture_first_use_audit_after_g1a_opening";
  return "resolve_hard_validation_blocker_before_closeout";
}

function authorityClosedAcross(openingPacket, ownerReceiptIntake, sourceLiteralPreflight, g1aGateRow) {
  return openingPacket.summary.project_creation_allowed_now === false
    && ownerReceiptIntake.summary.project_creation_allowed_now === false
    && sourceLiteralPreflight.summary.project_creation_allowed_now === false
    && g1aGateRow?.project_creation_allowed_now === false
    && openingPacket.summary.production_pass_enabled === false
    && ownerReceiptIntake.summary.production_pass_enabled === false
    && sourceLiteralPreflight.summary.production_pass_enabled === false;
}

function boundaryFlagsClosed(boundary) {
  return [
    ...Object.keys(CLOSED_AUTHORITY_FLAGS),
    "factory_promotion_goal_complete_allowed_now",
    "g1a_project_creation_gate_open_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Opening Closeout Readiness",
    "",
    `Status: ${result.summary.factory_g1a_opening_closeout_readiness_status}`,
    `Program: ${result.program_range}`,
    `Chain rows pass/wait/fail: ${result.summary.chain_pass_count}/${result.summary.chain_wait_count}/${result.summary.chain_fail_count}`,
    `Blockers: ${result.summary.blocker_count}`,
    `Ready for owner closeout adjudication: ${result.summary.ready_for_g1a_opening_closeout_owner_adjudication}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
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
  console.log(`Usage: node scripts/factory-g1a-opening-closeout-readiness.mjs [--check] [--require-pass] [--owner-receipt-path <path>] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds a read-only G1a gate-opening closeout readiness view. It never signs receipts, mutates source, opens G1a, or grants project creation authority.`);
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
