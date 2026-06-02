import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddSourceContract } from "./zendd-source-contract.mjs";

export const DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_OUT_DIR = "artifacts/zendd-fact-issue-bridge/latest";
export const DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_INPUTS = {
  schemaPath: "schemas/zendd-fact-issue-bridge.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-fact-issue-bridge";
const SOURCE_CONTRACT_COMMAND_NAME = "project:zendd-source-contract";
const SCHEMA_VERSION = "zendd-fact-issue-bridge.v1";
const CAPABILITY_ID = "project.zendd.fact_issue_bridge";
const PHASE_RANGE = "P601-P620";
const PHASE_SLOT = "P601";
const PREVIOUS_PHASE_SLOT = "P600";
const NEXT_PHASE_SLOT = "P621";

export async function runZenddFactIssueBridge(options = {}) {
  const result = await buildZenddFactIssueBridge(options);
  if (options.write !== false) await writeZenddFactIssueBridge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd fact issue bridge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddFactIssueBridge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const sourceContract = await buildZenddSourceContract({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildFactIssueBridgePolicy(generatedAt);
  const factRows = buildFactClaimRows(sourceContract.vdr_ldd_source_contract_rows);
  const issueRows = buildIssueBridgeRows(factRows);
  const confidencePolicy = buildConfidencePolicy(generatedAt);
  const conflictRows = buildConflictFixtureRows(factRows);
  const reviewRows = buildReviewBindingRows(factRows, issueRows);
  const freezeRows = buildFactIssueFreezeRows(factRows, issueRows, conflictRows);
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    sourceContract,
    policy,
    factRows,
    issueRows,
    confidencePolicy,
    conflictRows,
    reviewRows,
    freezeRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    sourceContract,
    policy,
    factRows,
    issueRows,
    confidencePolicy,
    conflictRows,
    reviewRows,
    freezeRows,
  });
  const validationItems = buildValidationItems({ gateRows, policy, factRows, issueRows, confidencePolicy, conflictRows, reviewRows, freezeRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceContract, factRows, issueRows, conflictRows, freezeRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_fact_issue_bridge_id: `zendd-fact-issue-bridge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    fact_issue_anchor: anchor,
    source_contract_summary: sourceContract.summary,
    fact_issue_bridge_policy: policy,
    fact_claim_rows: factRows,
    issue_bridge_rows: issueRows,
    fact_confidence_policy: confidencePolicy,
    conflict_fixture_rows: conflictRows,
    fact_issue_review_binding_rows: reviewRows,
    fact_issue_freeze_rows: freezeRows,
    fact_issue_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_fact_issue_bridge")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceContract, factRows, issueRows, conflictRows, freezeRows, validation: result.validation });
  result.summary.zendd_fact_issue_bridge_id = result.zendd_fact_issue_bridge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddFactIssueBridge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-fact-issue-bridge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "fact-issue-bridge-policy.json"), result.fact_issue_bridge_policy);
  await writeJson(path.join(outDir, "fact-claim-rows.json"), collectionEnvelope("zendd-fact-claim-rows.v1", "fact_claim_rows", result.fact_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "issue-bridge-rows.json"), collectionEnvelope("zendd-issue-bridge-rows.v1", "issue_bridge_rows", result.issue_bridge_rows, result.generated_at));
  await writeJson(path.join(outDir, "conflict-fixture-rows.json"), collectionEnvelope("zendd-conflict-fixture-rows.v1", "conflict_fixture_rows", result.conflict_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "fact-issue-review-binding-rows.json"), collectionEnvelope("zendd-fact-issue-review-binding-rows.v1", "fact_issue_review_binding_rows", result.fact_issue_review_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "fact-issue-freeze-rows.json"), collectionEnvelope("zendd-fact-issue-freeze-rows.v1", "fact_issue_freeze_rows", result.fact_issue_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-fact-issue-bridge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddFactIssueBridgeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddFactIssueBridge(args);
    console.log(`Zendd fact issue bridge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_fact_issue_bridge_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Fact claims: ${result.summary.fact_claim_row_count}`);
    console.log(`Issue rows: ${result.summary.issue_bridge_row_count}`);
    console.log(`Auto PASS allowed: ${result.summary.auto_pass_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFactIssueBridgePolicy(generatedAt) {
  return {
    schema_version: "zendd-fact-issue-bridge-policy.v1",
    phase_slot: "P601",
    project_id: "project.zendd",
    raw_fact_text_storage_allowed_in_hermes: false,
    raw_source_material_copy_allowed_in_hermes: false,
    auto_pass_allowed: false,
    fact_pass_formula: "fact_claim_to_source_contract_ref_to_evidence_span_ref_to_issue_linkage_to_review_gate_to_human_receipt_to_pass_or_block",
    fact_pass_requires: ["fact_ref", "source_contract_id", "stable_source_ref", "evidence_ref", "redacted_summary_ref", "reviewer_ref", "hard_gate_ref"],
    protected_fact_pass_requires: ["human_receipt_ref", "receipt_status"],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "bind fact and issue claims to source contract rows before any client-facing output PASS",
    created_at: generatedAt,
  };
}

function buildFactClaimRows(sourceRows) {
  const sourceByType = new Map(sourceRows.map((row) => [row.source_type, row]));
  const sourceFor = (type) => sourceByType.get(type) ?? sourceRows[0];
  const rows = [
    ["document_inventory_fact", "document_inventory", "vdr_source", "fact.zendd.document_inventory", "issue.zendd.missing_document"],
    ["classification_fact", "document_classification", "vdr_source", "fact.zendd.vdr_classification", "issue.zendd.classification_gap"],
    ["source_control_fact", "source_control", "ldd_source_control", "fact.zendd.source_control", "issue.zendd.source_blocker"],
    ["fact_span_fact", "fact_source_span", "ldd_fact_span", "fact.zendd.ldd_fact_span", "issue.zendd.unsupported_fact"],
    ["issue_linkage_fact", "issue_linkage", "ldd_issue_trace", "fact.zendd.issue_linkage", "issue.zendd.unlinked_issue"],
    ["client_output_trace_fact", "client_output_trace", "client_output_trace", "fact.zendd.client_output_trace", "issue.zendd.client_output_exposure"],
    ["redaction_fact", "redaction_report", "redaction_report", "fact.zendd.redaction", "issue.zendd.redaction_gap"],
    ["citation_surface_fact", "citation_surface", "citation_surface", "fact.zendd.citation_surface", "issue.zendd.citation_gap"],
  ];
  return rows.map(([factKey, factType, sourceType, factRef, issueRef], index) => {
    const source = sourceFor(sourceType);
    return {
      schema_version: "zendd-fact-claim-row.v1",
      phase_slot: "P602-P608",
      row_id: `zendd-fact-claim.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: `claim.zendd.fact.${factKey}`,
      fact_ref: factRef,
      fact_type: factType,
      issue_ref: issueRef,
      source_contract_id: source.source_contract_id,
      stable_source_ref: source.stable_source_ref,
      evidence_ref: source.evidence_ref,
      redacted_summary_ref: source.redacted_summary_ref,
      reviewer_ref: `review.zendd.fact.${factKey}`,
      hard_gate_ref: `gate.zendd.fact_issue.${factKey}`,
      human_receipt_ref_required: true,
      raw_fact_text_storage_allowed_in_hermes: false,
      current_verdict: "blocked",
      block_reason: "fact_claim_not_reviewed_or_receipted",
      responsible_owner: "integration_operator",
      next_allowed_action: "capture fact ref, issue linkage, evidence span ref, reviewer, and human receipt before PASS",
    };
  });
}

function buildIssueBridgeRows(factRows) {
  return factRows.map((row, index) => ({
    schema_version: "zendd-issue-bridge-row.v1",
    phase_slot: "P609-P612",
    row_id: `zendd-issue-bridge.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    issue_ref: row.issue_ref,
    linked_fact_claim_id: row.claim_id,
    source_contract_id: row.source_contract_id,
    evidence_ref: row.evidence_ref,
    issue_status: "blocked_pending_issue_review",
    missing_evidence_surface: true,
    human_receipt_ref_required: true,
    current_verdict: "blocked",
    block_reason: "issue_linkage_not_reviewed_or_receipted",
    responsible_owner: "integration_operator",
    next_allowed_action: "review linked fact claim and bind issue disposition receipt",
  }));
}

function buildConfidencePolicy(generatedAt) {
  return {
    schema_version: "zendd-fact-confidence-policy.v1",
    phase_slot: "P613",
    project_id: "project.zendd",
    auto_pass_allowed: false,
    low_confidence_can_pass: false,
    confidence_without_source_can_pass: false,
    conflicting_source_can_pass: false,
    required_confidence_fields: ["confidence", "confidence_reason", "source_coverage_ref", "reviewer_ref"],
    missing_confidence_verdict: "blocked",
    next_allowed_action: "attach confidence reason and source coverage ref before reviewer adjudication",
    created_at: generatedAt,
  };
}

function buildConflictFixtureRows(factRows) {
  const rows = [
    ["missing_source_span", "fact claim lacks source span evidence", "bind evidence span ref"],
    ["contradictory_source", "fact claim has conflicting source evidence", "create conflict review packet"],
    ["stale_vdr_classification", "fact claim relies on stale VDR classification", "refresh VDR classification evidence ref"],
    ["cross_matter_source_mix", "fact claim crosses matter boundary", "quarantine claim and bind matter boundary receipt"],
    ["unsupported_client_sentence", "client-facing sentence is not supported by fact refs", "rewrite output or bind supporting fact refs"],
    ["privileged_source_exposure", "fact claim exposes privileged or restricted source detail", "redact and collect attorney review receipt"],
  ];
  return rows.map(([fixtureId, description, nextAllowedAction], index) => {
    const row = factRows[index % factRows.length];
    return {
      schema_version: "zendd-conflict-fixture-row.v1",
      phase_slot: "P614-P616",
      row_id: `zendd-conflict-fixture.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      fixture_id: `fixture.zendd.fact_issue.${fixtureId}`,
      claim_id: row.claim_id,
      evidence_ref: row.evidence_ref,
      conflict_description: description,
      current_verdict: "blocked",
      block_reason: fixtureId,
      responsible_owner: "integration_operator",
      next_allowed_action: nextAllowedAction,
    };
  });
}

function buildReviewBindingRows(factRows, issueRows) {
  const rows = [
    ...factRows.map((row) => ({
      binding_type: "fact_claim",
      claim_id: row.claim_id,
      fact_ref: row.fact_ref,
      issue_ref: row.issue_ref,
      evidence_ref: row.evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
    })),
    ...issueRows.map((row) => ({
      binding_type: "issue_linkage",
      claim_id: `claim.${row.issue_ref}`,
      fact_ref: row.linked_fact_claim_id,
      issue_ref: row.issue_ref,
      evidence_ref: row.evidence_ref,
      reviewer_ref: `review.${row.issue_ref}`,
      hard_gate_ref: `gate.${row.issue_ref}`,
    })),
  ];
  return rows.map((row, index) => ({
    schema_version: "zendd-fact-issue-review-binding-row.v1",
    phase_slot: "P617-P618",
    row_id: `zendd-fact-issue-review.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    ...row,
    human_receipt_ref_required: true,
    pass_without_review_allowed: false,
    pass_without_receipt_allowed: false,
    current_verdict: "blocked_pending_fact_issue_review",
    block_reason: "fact_issue_review_or_receipt_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "bind reviewer or hard gate and human receipt before PASS",
  }));
}

function buildFactIssueFreezeRows(factRows, issueRows, conflictRows) {
  const claimRows = [
    ...factRows.map((row) => [row.claim_id, row.evidence_ref, row.block_reason, row.next_allowed_action]),
    ...issueRows.map((row) => [`claim.${row.issue_ref}`, row.evidence_ref, row.block_reason, row.next_allowed_action]),
    ...conflictRows.map((row) => [row.claim_id, row.evidence_ref, row.block_reason, row.next_allowed_action]),
  ];
  return claimRows.map(([claimId, evidenceRef, blockReason, nextAllowedAction], index) => ({
    schema_version: "zendd-fact-issue-freeze-row.v1",
    phase_slot: "P619-P620",
    row_id: `zendd-fact-issue-freeze.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: claimId,
    evidence_ref: evidenceRef,
    current_verdict: "blocked",
    block_reason: blockReason,
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildAnchor({ packageJson, phaseLedger, sourceContract, policy, factRows, issueRows, confidencePolicy, conflictRows, reviewRows, freezeRows }) {
  return {
    schema_version: "zendd-fact-issue-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_contract_command_name: SOURCE_CONTRACT_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    source_contract_summary_hash: hashValue(sourceContract.summary),
    fact_issue_policy_hash: hashValue(policy),
    fact_claim_hash: hashRows(factRows, ["claim_id", "fact_ref", "source_contract_id", "evidence_ref", "current_verdict"]),
    issue_bridge_hash: hashRows(issueRows, ["issue_ref", "linked_fact_claim_id", "evidence_ref", "current_verdict"]),
    confidence_policy_hash: hashValue(confidencePolicy),
    conflict_fixture_hash: hashRows(conflictRows, ["fixture_id", "claim_id", "block_reason", "next_allowed_action"]),
    review_binding_hash: hashRows(reviewRows, ["binding_type", "claim_id", "pass_without_review_allowed", "pass_without_receipt_allowed"]),
    freeze_hash: hashRows(freezeRows, ["claim_id", "current_verdict", "block_reason", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, sourceContract, policy, factRows, issueRows, confidencePolicy, conflictRows, reviewRows, freezeRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p601_policy_declared", "P601", !policy.auto_pass_allowed && !policy.raw_fact_text_storage_allowed_in_hermes && policy.fact_pass_requires.includes("source_contract_id"), "Fact/issue policy blocks raw fact text and requires source contract linkage.", "declare fact/issue bridge policy"),
    gateRow("p602_fact_claim_rows_bound_to_source", "P602-P608", factRows.length >= 8 && factRows.every((row) => row.fact_ref && row.source_contract_id && row.evidence_ref && !row.raw_fact_text_storage_allowed_in_hermes), "Fact claim rows are bound to source contract evidence refs.", "complete fact claim rows"),
    gateRow("p609_issue_rows_bound_to_fact", "P609-P612", issueRows.length === factRows.length && issueRows.every((row) => row.linked_fact_claim_id && row.missing_evidence_surface && row.next_allowed_action), "Issue rows are linked to fact claims and missing evidence surfaces.", "complete issue bridge rows"),
    gateRow("p613_confidence_policy_blocks_auto_pass", "P613", !confidencePolicy.auto_pass_allowed && !confidencePolicy.low_confidence_can_pass && !confidencePolicy.conflicting_source_can_pass, "Confidence policy blocks auto PASS, low-confidence PASS, and conflicting-source PASS.", "declare confidence policy"),
    gateRow("p614_conflict_fixtures_fail_closed", "P614-P616", conflictRows.length >= 6 && conflictRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Conflict fixtures fail closed with block reasons and next actions.", "complete conflict fixtures"),
    gateRow("p617_review_bindings_required", "P617-P618", reviewRows.length === factRows.length + issueRows.length && reviewRows.every((row) => !row.pass_without_review_allowed && !row.pass_without_receipt_allowed), "Fact and issue rows require review and receipt before PASS.", "bind fact/issue review rows"),
    gateRow("p619_freeze_rows_document_blocks", "P619-P620", freezeRows.length >= factRows.length + issueRows.length && freezeRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Fact and issue claims remain documented BLOCK until evidence, review, and receipt exist.", "complete fact/issue freeze rows"),
    gateRow("package_script_registered", "P620", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P620", phaseLedger.available && phaseLedger.text.includes("P601-P620") && phaseLedger.text.includes(COMMAND_NAME), "P601-P620 phase ledger declares fact/issue acceptance.", "record P601-P620 in phase ledger"),
    gateRow("source_contract_chain_valid", "P620", sourceContract.validation.valid && sourceContract.summary.zendd_source_contract_status === "ready_for_fact_issue_bridge", "P581-P600 source contract remains valid before fact/issue bridge.", "repair source contract validation before fact/issue bridge"),
  ];
}

function buildValidationItems({ gateRows, policy, factRows, issueRows, confidencePolicy, conflictRows, reviewRows, freezeRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "fact_issue_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.auto_pass_allowed", "claim_boundary", policy.auto_pass_allowed === false, "Fact/issue bridge does not allow auto PASS"));
  items.push(validationItem("policy.raw_fact_text_storage", "source_boundary", policy.raw_fact_text_storage_allowed_in_hermes === false, "Raw fact text is not stored in Hermes"));
  items.push(validationItem("facts.source_contract_id", "source_boundary", factRows.every((row) => row.source_contract_id && row.stable_source_ref && row.evidence_ref), "Fact rows are bound to source contract refs"));
  items.push(validationItem("issues.linked_fact", "claim_boundary", issueRows.every((row) => row.linked_fact_claim_id && row.issue_ref), "Issue rows link back to fact claims"));
  items.push(validationItem("confidence.fail_closed", "claim_boundary", confidencePolicy.auto_pass_allowed === false && confidencePolicy.conflicting_source_can_pass === false, "Confidence policy fails closed"));
  items.push(validationItem("conflicts.blocked", "claim_boundary", conflictRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Conflict fixtures remain blocked with next actions"));
  items.push(validationItem("review.pass_without_review", "receipt_boundary", reviewRows.every((row) => row.pass_without_review_allowed === false && row.pass_without_receipt_allowed === false), "Fact/issue PASS requires review and receipt"));
  items.push(validationItem("freeze.next_allowed_action", "claim_boundary", freezeRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Freeze rows document blocks with next actions"));
  return items;
}

function buildSummary({ sourceContract, factRows, issueRows, conflictRows, freezeRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_fact_issue_bridge_status: validation.valid
      ? "ready_for_review_receipt_bridge"
      : "documented_block_pending_fact_issue_gate",
    zendd_project_root: sourceContract.summary.zendd_project_root,
    zendd_git_head_short: sourceContract.summary.zendd_git_head_short,
    source_contract_status: sourceContract.summary.zendd_source_contract_status,
    fact_claim_row_count: factRows.length,
    issue_bridge_row_count: issueRows.length,
    conflict_fixture_row_count: conflictRows.length,
    freeze_row_count: freezeRows.length,
    raw_fact_text_storage_allowed_in_hermes: false,
    auto_pass_allowed: false,
    protected_pass_allowed_without_receipt: false,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-fact-issue-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_fact_issue_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_FACT_ISSUE_BRIDGE_INPUTS.zenddProjectRoot,
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

Creates the P601-P620 Zendd-Hermes fact/evidence/issue bridge.
--check validates without writing artifacts, copying raw source material, or executing Zendd commands.
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
    "# Zendd Fact Issue Bridge Summary",
    "",
    `- Status: ${summary.zendd_fact_issue_bridge_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Fact claim rows: ${summary.fact_claim_row_count}`,
    `- Issue rows: ${summary.issue_bridge_row_count}`,
    `- Conflict fixtures: ${summary.conflict_fixture_row_count}`,
    `- Freeze rows: ${summary.freeze_row_count}`,
    `- Raw fact text storage allowed in Hermes: ${summary.raw_fact_text_storage_allowed_in_hermes}`,
    `- Auto PASS allowed: ${summary.auto_pass_allowed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.fact_issue_bridge_policy.next_allowed_action,
    "",
  ].join("\n");
}
