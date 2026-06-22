import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { AUTHORITY_FLAGS, classifyProtectedCommand } from "./agent-bridge-manifest.mjs";
import { buildAgentBridgeReceiptImportWorkspace } from "./agent-bridge-receipt-import-workspace.mjs";

export const DEFAULT_AGENT_BRIDGE_REVIEW_FINDING_WORKBENCH_OUT_DIR = "artifacts/agent-bridge-review-finding-workbench/latest";
export const DEFAULT_AGENT_BRIDGE_REVIEW_FINDING_WORKBENCH_INPUTS = {
  schemaPath: "schemas/agent-bridge-review-finding-workbench.schema.json",
  packagePath: "package.json",
  sourceAgentBridgeReceiptImportWorkspacePath: "artifacts/agent-bridge-receipt-import-workspace/latest/agent-bridge-receipt-import-workspace.json",
};

const SCHEMA_VERSION = "agent-bridge-review-finding-workbench.v1";
const CAPABILITY_ID = "platform.agent_bridge_review_finding_workbench";
const COMMAND_NAME = "platform:agent-bridge-review-finding-workbench";
const PROGRAM_RANGE = "AGENT-BRIDGE-L13-SLICE-I";
const READY_STATUS = "ready_for_agent_bridge_review_finding_workbench";
const BLOCKED_STATUS = "blocked_agent_bridge_review_finding_workbench";

const BLOCKED_FINDING_FIXTURES = [
  ["finding.fixed_claim", "Mark finding AGF-001 fixed", "finding_fixed_claim"],
  ["finding.verified_claim", "Mark finding AGF-001 verified", "finding_verified_claim"],
  ["finding.resolved_claim", "Resolve all review findings", "finding_resolved_claim"],
  ["finding.clean_checkpoint", "Clean checkpoint is ready", "clean_checkpoint_claim"],
  ["finding.apply_patch", "Apply this patch to fix the finding", "apply_patch_or_receipt"],
  ["finding.approve", "Approve after finding triage", "approve"],
  ["finding.production_pass", "production PASS after finding review", "production_pass"],
  ["finding.enterprise_pass", "enterprise PASS after finding review", "enterprise_pass"],
  ["finding.raw_transcript", "Use the raw transcript as finding evidence", "raw_source_exposure"],
  ["finding.secret", "Use .env token as finding evidence", "secret_read"],
];

export async function runAgentBridgeReviewFindingWorkbench(options = {}) {
  const result = await buildAgentBridgeReviewFindingWorkbench(options);
  if (options.write !== false) await writeAgentBridgeReviewFindingWorkbench(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Agent Bridge review finding workbench failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAgentBridgeReviewFindingWorkbench(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AGENT_BRIDGE_REVIEW_FINDING_WORKBENCH_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceReceiptImportWorkspace = await resolveSourceReceiptImportWorkspace(options, inputs, generatedAt);
  const context = { generatedAt, outputDir, inputs, packageJson, sourceReceiptImportWorkspace };
  const contract = buildContract(context);
  const findingSeedRows = buildFindingSeedRows(context);
  const findingActionRows = buildFindingActionRows(context, findingSeedRows);
  const blockedFixtureRows = buildBlockedFindingFixtureRows(context);
  const gateRows = buildGateRows({ context, findingSeedRows, findingActionRows, blockedFixtureRows });
  const boundary = buildBoundary({ context, findingSeedRows, findingActionRows, blockedFixtureRows, gateRows });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_agent_bridge_receipt_import_workspace_summary: sourceReceiptImportWorkspace.data?.summary ?? null,
    agent_bridge_review_finding_workbench_contract: contract,
    agent_review_finding_seed_rows: findingSeedRows,
    agent_review_finding_action_rows: findingActionRows,
    blocked_finding_resolution_fixture_rows: blockedFixtureRows,
    agent_review_finding_workbench_gate_rows: gateRows,
    agent_review_finding_workbench_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  result.summary = buildSummary(result);
  const validation = validateAgentBridgeReviewFindingWorkbenchResult(result, schema.available ? schema.data : null);
  result.validation_items = validation.validation_items;
  result.validation = validation.validation;
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export function validateAgentBridgeReviewFindingWorkbenchResult(result, schema = null) {
  const items = buildValidationItems(result);
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "agent_bridge_review_finding_workbench")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  const validationItems = [...items, ...schemaItems];
  return {
    validation_items: validationItems,
    validation: summarizeValidation(validationItems),
  };
}

export async function writeAgentBridgeReviewFindingWorkbench(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "agent-bridge-review-finding-workbench.json"), serializable);
  await writeJson(path.join(outDir, "agent-review-finding-seed-rows.json"), collectionEnvelope("agent-review-finding-seed-rows.v1", "agent_review_finding_seed_rows", result.agent_review_finding_seed_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-review-finding-action-rows.json"), collectionEnvelope("agent-review-finding-action-rows.v1", "agent_review_finding_action_rows", result.agent_review_finding_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-finding-resolution-fixture-rows.json"), collectionEnvelope("blocked-finding-resolution-fixture-rows.v1", "blocked_finding_resolution_fixture_rows", result.blocked_finding_resolution_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-review-finding-workbench-gate-rows.json"), collectionEnvelope("agent-review-finding-workbench-gate-rows.v1", "agent_review_finding_workbench_gate_rows", result.agent_review_finding_workbench_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-review-finding-workbench-boundary.json"), result.agent_review_finding_workbench_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "agent-bridge-review-finding-workbench-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAgentBridgeReviewFindingWorkbenchCli(argv = process.argv.slice(2)) {
  try {
    const args = parseAgentBridgeReviewFindingWorkbenchArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runAgentBridgeReviewFindingWorkbench(args);
    console.log(`Agent Bridge review finding workbench ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.agent_bridge_review_finding_workbench_status}`);
    console.log(`Findings: ${result.summary.finding_seed_count}`);
    console.log(`Blocking findings: ${result.summary.blocking_finding_count}`);
    console.log(`Finding resolution allowed: ${result.summary.finding_resolution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildContract(context) {
  return {
    schema_version: "agent-bridge-review-finding-workbench-contract.v1",
    generated_at: context.generatedAt,
    contract_id: "contract.hermes.agent_bridge_review_finding_workbench.visible_unresolved_only",
    source_agent_bridge_receipt_import_workspace_status: context.sourceReceiptImportWorkspace.data?.summary?.agent_bridge_receipt_import_workspace_status ?? "missing",
    local_only: true,
    read_only: true,
    source_of_truth: false,
    review_finding_workbench_enabled_now: true,
    finding_seed_visible_now: true,
    finding_action_visible_now: true,
    blocking_findings_visible_now: true,
    finding_resolution_allowed_now: false,
    finding_status_fixed_allowed_now: false,
    finding_status_verified_allowed_now: false,
    finding_status_resolved_allowed_now: false,
    clean_checkpoint_allowed_now: false,
    patch_apply_allowed_now: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    execution_allowed_now: false,
    command_executed_now: false,
    mutation_performed: false,
    provider_output_authoritative: false,
    ...falseAuthorityFlags(),
  };
}

function buildFindingSeedRows(context) {
  const importRows = context.sourceReceiptImportWorkspace.data?.agent_receipt_import_candidate_rows ?? [];
  return importRows.map((candidate, index) => {
    const blocking = candidate.receipt_quarantined === true || candidate.receipt_validated !== true;
    const findingId = stableId("agent.review.finding", candidate.import_candidate_id, candidate.receipt_id);
    const severity = blocking ? "p1" : candidate.request_type === "command_suggestion" ? "p3" : "p2";
    return verdictRow({
      schema_version: "agent-review-finding-seed-row.v1",
      row_id: rowId("agent.bridge.review.finding.seed", index),
      generated_at: context.generatedAt,
      finding_id: findingId,
      source_import_candidate_id: candidate.import_candidate_id,
      receipt_id: candidate.receipt_id,
      request_id: candidate.request_id,
      request_type: candidate.request_type,
      finding_category: blocking ? "missing_or_quarantined_receipt" : "review_followup",
      severity,
      blocking,
      finding_status: blocking ? "blocking_open" : "triage_ready",
      finding_summary: blocking
        ? `Collect a valid redacted receipt for ${candidate.request_type}.`
        : `Review normalized ${candidate.request_type} receipt summary before any next step.`,
      evidence_ref: candidate.receipt_id,
      normalized_summary_only: true,
      raw_output_included: false,
      receipt_applied: false,
      finding_seed_visible_now: true,
      finding_resolution_allowed_now: false,
      finding_status_fixed_allowed_now: false,
      finding_status_verified_allowed_now: false,
      finding_status_resolved_allowed_now: false,
      clean_checkpoint_allowed_now: false,
      patch_apply_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
      provider_output_authoritative: false,
      authority_effect: "finding_visibility_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
      next_allowed_action: blocking ? "collect_redacted_receipt_before_resolution" : "triage_normalized_review_summary",
    }, candidate.raw_output_included === false && candidate.receipt_applied === false);
  });
}

function buildFindingActionRows(context, findingRows) {
  return findingRows.map((finding, index) => verdictRow({
    schema_version: "agent-review-finding-action-row.v1",
    row_id: rowId("agent.bridge.review.finding.action", index),
    generated_at: context.generatedAt,
    finding_id: finding.finding_id,
    action_status: finding.blocking ? "blocked_until_receipt" : "triage_candidate",
    action_label: finding.blocking ? "Collect redacted receipt" : "Inspect normalized finding",
    next_allowed_action: finding.next_allowed_action,
    finding_action_visible_now: true,
    action_mutates_state: false,
    action_executes_command: false,
    action_applies_patch: false,
    action_applies_receipt: false,
    finding_resolution_allowed_now: false,
    finding_status_fixed_allowed_now: false,
    finding_status_verified_allowed_now: false,
    finding_status_resolved_allowed_now: false,
    clean_checkpoint_allowed_now: false,
    patch_apply_allowed_now: false,
    approval_application_allowed_now: false,
    execution_allowed_now: false,
    authority_effect: "operator_next_action_hint_only",
    opens_authority: false,
    ...falseAuthorityFlags(),
  }, finding.current_verdict === "pass"));
}

function buildBlockedFindingFixtureRows(context) {
  return BLOCKED_FINDING_FIXTURES.map(([fixtureId, text, expectedBlocker], index) => {
    const blocked = classifyFindingBlocker(text);
    return verdictRow({
      schema_version: "agent-review-blocked-finding-resolution-fixture-row.v1",
      row_id: rowId("agent.bridge.review.finding.blocked.fixture", index),
      generated_at: context.generatedAt,
      fixture_id: fixtureId,
      fixture_text_summary: redactFixtureText(text),
      expected_blocker: expectedBlocker,
      observed_blocker: blocked.blocker,
      blocked: blocked.blocked,
      finding_resolution_allowed_now: false,
      finding_status_fixed_allowed_now: false,
      finding_status_verified_allowed_now: false,
      finding_status_resolved_allowed_now: false,
      clean_checkpoint_allowed_now: false,
      patch_apply_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
      receipt_application_allowed_now: false,
      authority_effect: "none",
      opens_authority: false,
      ...falseAuthorityFlags(),
      next_allowed_action: "reject unsafe finding resolution claim",
    }, blocked.blocked === true && blocked.blocker === expectedBlocker);
  });
}

function buildGateRows({ context, findingSeedRows, findingActionRows, blockedFixtureRows }) {
  const gates = [
    ["source.receipt_import.ready", "Source receipt import workspace is ready", context.sourceReceiptImportWorkspace.data?.summary?.agent_bridge_receipt_import_workspace_status === "ready_for_agent_bridge_receipt_import_workspace"],
    ["package.script.registered", "Package script is registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME])],
    ["findings.cover.imports", "Finding seeds cover import candidates", findingSeedRows.length >= 4 && findingSeedRows.length === (context.sourceReceiptImportWorkspace.data?.agent_receipt_import_candidate_rows ?? []).length],
    ["blocking.visible", "Missing or quarantined receipts remain visible blocking findings", findingSeedRows.some((row) => row.blocking === true)],
    ["findings.no_resolution", "Finding rows cannot resolve, verify, or fix findings", findingSeedRows.every(noResolutionAuthority)],
    ["actions.no_mutation", "Finding actions are non-mutating hints only", findingActionRows.every((row) => row.action_mutates_state === false && row.action_executes_command === false && row.action_applies_patch === false && row.opens_authority === false)],
    ["fixtures.blocked", "Unsafe finding resolution fixtures are blocked", allPass(blockedFixtureRows)],
  ];
  return gates.map(([gateId, description, pass], index) => verdictRow({
    schema_version: "agent-review-finding-workbench-gate-row.v1",
    row_id: rowId("agent.bridge.review.finding.gate", index),
    generated_at: context.generatedAt,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    description,
    authority_effect: "none",
    opens_authority: false,
    ...falseAuthorityFlags(),
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gateId}`,
  }, pass));
}

function buildBoundary({ context, findingSeedRows, findingActionRows, blockedFixtureRows, gateRows }) {
  const rowGroups = [findingSeedRows, findingActionRows, blockedFixtureRows, gateRows];
  const unsafeFlagCount = rowGroups.flat().reduce((sum, row) => sum + countUnsafeFlags(row), 0);
  const ready = rowGroups.flat().every((row) => row.current_verdict === "pass") && unsafeFlagCount === 0;
  const blockingCount = findingSeedRows.filter((row) => row.blocking === true).length;
  return {
    schema_version: "agent-review-finding-workbench-boundary.v1",
    generated_at: context.generatedAt,
    program_range: PROGRAM_RANGE,
    source_agent_bridge_receipt_import_workspace_status: context.sourceReceiptImportWorkspace.data?.summary?.agent_bridge_receipt_import_workspace_status ?? "missing",
    ready_for_agent_review_finding_workbench: ready,
    ready_for_desktop_agents_projection: ready,
    finding_seed_count: findingSeedRows.length,
    finding_action_count: findingActionRows.length,
    blocking_finding_count: blockingCount,
    blocked_finding_fixture_count: blockedFixtureRows.length,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    review_finding_workbench_enabled_now: true,
    finding_seed_visible_now: true,
    finding_action_visible_now: true,
    blocking_findings_visible_now: blockingCount > 0,
    finding_resolution_allowed_now: false,
    finding_status_fixed_allowed_now: false,
    finding_status_verified_allowed_now: false,
    finding_status_resolved_allowed_now: false,
    clean_checkpoint_allowed_now: false,
    patch_apply_allowed_now: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    execution_allowed_now: false,
    command_executed_now: false,
    mutation_performed: false,
    provider_output_authoritative: false,
    ...falseAuthorityFlags(),
    unsafe_flag_count: unsafeFlagCount,
  };
}

function buildValidationItems(result) {
  const contract = result.agent_bridge_review_finding_workbench_contract ?? {};
  const boundary = result.agent_review_finding_workbench_boundary ?? {};
  const findingRows = result.agent_review_finding_seed_rows ?? [];
  return [
    validationItem("source.receipt_import.ready", result.source_agent_bridge_receipt_import_workspace_summary?.agent_bridge_receipt_import_workspace_status === "ready_for_agent_bridge_receipt_import_workspace", "Source receipt import workspace is not ready.", result.inputs?.source_agent_bridge_receipt_import_workspace_path),
    validationItem("contract.no_resolution", allAuthorityFlagsFalse(contract) && contract.finding_resolution_allowed_now === false && contract.clean_checkpoint_allowed_now === false && contract.patch_apply_allowed_now === false, "Finding workbench contract opened resolution or patch authority.", "agent_bridge_review_finding_workbench_contract"),
    validationItem("findings.cover.imports", findingRows.length >= 4 && findingRows.length === (result.source_agent_bridge_receipt_import_workspace_summary?.import_candidate_count ?? 0), "Finding seeds must cover every import candidate.", "agent_review_finding_seed_rows"),
    validationItem("blocking.visible", findingRows.some((row) => row.blocking === true), "Blocking finding rows must remain visible for missing or quarantined receipts.", "agent_review_finding_seed_rows"),
    validationItem("findings.no_resolution", findingRows.every(noResolutionAuthority), "Finding rows opened fixed, verified, resolved, clean checkpoint, or patch authority.", "agent_review_finding_seed_rows"),
    validationItem("actions.no_mutation", (result.agent_review_finding_action_rows ?? []).every((row) => row.action_mutates_state === false && row.action_executes_command === false && row.action_applies_patch === false && row.opens_authority === false), "Finding actions opened mutation or execution.", "agent_review_finding_action_rows"),
    validationItem("fixtures.blocked", allPass(result.blocked_finding_resolution_fixture_rows ?? []), "Blocked finding fixture failed.", "blocked_finding_resolution_fixture_rows"),
    validationItem("gates.ready", allPass(result.agent_review_finding_workbench_gate_rows ?? []), "Finding workbench gates are not all ready.", "agent_review_finding_workbench_gate_rows"),
    validationItem("boundary.ready", boundary.ready_for_agent_review_finding_workbench === true && boundary.unsafe_flag_count === 0, "Finding workbench boundary is not ready.", "agent_review_finding_workbench_boundary"),
    validationItem("boundary.no_authority", allAuthorityFlagsFalse(boundary) && boundary.finding_resolution_allowed_now === false && boundary.clean_checkpoint_allowed_now === false && boundary.execution_allowed_now === false && boundary.provider_output_authoritative === false, "Finding workbench boundary opened forbidden authority.", "agent_review_finding_workbench_boundary"),
  ];
}

function buildSummary(result) {
  const validation = result.validation ?? summarizeValidation([]);
  const boundary = result.agent_review_finding_workbench_boundary ?? {};
  return {
    schema_version: "agent-bridge-review-finding-workbench-summary.v1",
    agent_bridge_review_finding_workbench_status: validation.valid && boundary.ready_for_agent_review_finding_workbench ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_agent_bridge_receipt_import_workspace_status: result.source_agent_bridge_receipt_import_workspace_summary?.agent_bridge_receipt_import_workspace_status ?? "missing",
    finding_seed_count: result.agent_review_finding_seed_rows?.length ?? 0,
    finding_action_count: result.agent_review_finding_action_rows?.length ?? 0,
    blocking_finding_count: boundary.blocking_finding_count ?? 0,
    blocked_finding_fixture_count: result.blocked_finding_resolution_fixture_rows?.length ?? 0,
    review_finding_workbench_enabled_now: true,
    finding_seed_visible_now: true,
    finding_action_visible_now: true,
    blocking_findings_visible_now: true,
    finding_resolution_allowed_now: false,
    finding_status_fixed_allowed_now: false,
    finding_status_verified_allowed_now: false,
    finding_status_resolved_allowed_now: false,
    clean_checkpoint_allowed_now: false,
    patch_apply_allowed_now: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    execution_allowed_now: false,
    command_executed_now: false,
    mutation_performed: false,
    provider_output_authoritative: false,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    ...falseAuthorityFlags(),
    unsafe_flag_count: boundary.unsafe_flag_count ?? 0,
    validation_error_count: validation.errors.length,
  };
}

async function resolveSourceReceiptImportWorkspace(options, inputs, generatedAt) {
  if (options.sourceAgentBridgeReceiptImportWorkspace) return normalizeInlineJsonSource("inline.agent_bridge_receipt_import_workspace", options.sourceAgentBridgeReceiptImportWorkspace);
  const source = await readJsonSource(inputs.source_agent_bridge_receipt_import_workspace_path);
  if (source.available && source.data?.schema_version === "agent-bridge-receipt-import-workspace.v1") return source;
  const built = await buildAgentBridgeReceiptImportWorkspace({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    write: false,
  });
  return normalizeInlineJsonSource("built.agent_bridge_receipt_import_workspace", built);
}

function classifyFindingBlocker(text) {
  const value = String(text ?? "");
  if (/\bfixed\b|mark finding .*fixed/i.test(value)) return { blocked: true, blocker: "finding_fixed_claim" };
  if (/\bverified\b|mark finding .*verified/i.test(value)) return { blocked: true, blocker: "finding_verified_claim" };
  if (/\bresolve\b|\bresolved\b/i.test(value)) return { blocked: true, blocker: "finding_resolved_claim" };
  if (/clean checkpoint/i.test(value)) return { blocked: true, blocker: "clean_checkpoint_claim" };
  const commandClass = classifyProtectedCommand(value);
  if (commandClass.blocked) return { blocked: true, blocker: commandClass.protected_action_type };
  return { blocked: false, blocker: "none" };
}

function noResolutionAuthority(row) {
  return row.finding_resolution_allowed_now === false
    && row.finding_status_fixed_allowed_now === false
    && row.finding_status_verified_allowed_now === false
    && row.finding_status_resolved_allowed_now === false
    && row.clean_checkpoint_allowed_now === false
    && row.patch_apply_allowed_now === false
    && row.approval_application_allowed_now === false
    && row.execution_allowed_now === false
    && row.opens_authority === false;
}

export function parseAgentBridgeReviewFindingWorkbenchArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--out-dir") {
      args.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-path") {
      args.schemaPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--package-path") {
      args.packagePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-receipt-import-workspace-path") {
      args.sourceAgentBridgeReceiptImportWorkspacePath = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readArgValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--schema-path PATH] [--package-path PATH] [--source-agent-bridge-receipt-import-workspace-path PATH]`);
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    try {
      const data = JSON.parse(text);
      return { available: true, path: filePath, resolved_path: resolvedPath, text, data, parse_status: "parsed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
    } catch (error) {
      return { available: false, path: filePath, resolved_path: resolvedPath, text, data: null, parse_status: "malformed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: error.message };
    }
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, parse_status: "missing", content_hash: null, error: error.message };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data), parse_status: "parsed", content_hash: `sha256:${sha256(data)}`, error: null };
}

function falseAuthorityFlags() {
  return Object.fromEntries(AUTHORITY_FLAGS.map((flag) => [flag, false]));
}

function allAuthorityFlagsFalse(value) {
  return AUTHORITY_FLAGS.every((flag) => value?.[flag] === false);
}

function countUnsafeFlags(value) {
  return AUTHORITY_FLAGS.reduce((sum, flag) => sum + (value?.[flag] === true ? 1 : 0), 0);
}

function allPass(rows) {
  return rows.every((row) => row.current_verdict === "pass");
}

function verdictRow(row, pass) {
  return { ...row, current_verdict: pass ? "pass" : "blocked", unsafe_flags_false: pass, verdict_authority: "harness_deterministic_validator" };
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return { schema_version: "agent-bridge-review-finding-workbench-validation-item.v1", path: pathValue, check_id: pathValue, status: passed ? "passed" : "failed", message: passed ? "ok" : message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, evidence_ref: item.evidence_ref }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${key}_count`]: rows.length, [key]: rows };
}

function renderMarkdown(result) {
  return [
    "# Agent Bridge Review Finding Workbench",
    "",
    `- Status: ${result.summary.agent_bridge_review_finding_workbench_status}`,
    `- Program: ${result.program_range}`,
    `- Findings: ${result.summary.finding_seed_count}`,
    `- Blocking findings: ${result.summary.blocking_finding_count}`,
    `- Blocked fixtures: ${result.summary.blocked_finding_fixture_count}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "This Slice I artifact exposes finding seeds and next-action hints only. It does not resolve, fix, verify, close checkpoints, apply patches, approve, deploy, claim production PASS, claim enterprise PASS, or complete protected closeout.",
  ].join("\n");
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_AGENT_BRIDGE_REVIEW_FINDING_WORKBENCH_INPUTS)) {
    normalized[camelToSnake(key)] = options[key] ?? options[camelToSnake(key)] ?? defaultValue;
  }
  return normalized;
}

function redactFixtureText(value) {
  return String(value ?? "").replace(/token|secret|\.env/gi, "[redacted-secret-ref]").slice(0, 140);
}

function rowId(prefix, index) {
  return `${prefix}.row.${String(index + 1).padStart(2, "0")}`;
}

function stableId(prefix, ...parts) {
  return `${prefix}.${sha256(parts.join("|")).slice(0, 16)}`;
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}
