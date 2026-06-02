import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddReviewReceipts } from "./zendd-review-receipts.mjs";

export const DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_OUT_DIR = "artifacts/zendd-client-output-gate/latest";
export const DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_INPUTS = {
  schemaPath: "schemas/zendd-client-output-gate.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-client-output-gate";
const REVIEW_RECEIPTS_COMMAND_NAME = "project:zendd-review-receipts";
const SCHEMA_VERSION = "zendd-client-output-gate.v1";
const CAPABILITY_ID = "project.zendd.client_output_gate";
const PHASE_RANGE = "P641-P660";
const PHASE_SLOT = "P641";
const PREVIOUS_PHASE_SLOT = "P640";
const NEXT_PHASE_SLOT = "P661";

export async function runZenddClientOutputGate(options = {}) {
  const result = await buildZenddClientOutputGate(options);
  if (options.write !== false) await writeZenddClientOutputGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd client output gate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddClientOutputGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const reviewReceipts = await buildZenddReviewReceipts({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildClientOutputPolicy(generatedAt);
  const outputClaimRows = buildOutputClaimRows(reviewReceipts.receipt_template_rows);
  const languageRows = buildLanguageQualityRows(outputClaimRows);
  const citationRows = buildCitationGateRows(outputClaimRows);
  const exposureRows = buildExposureControlRows(outputClaimRows);
  const receiptRows = buildClientReceiptBindingRows(outputClaimRows, reviewReceipts.receipt_template_rows);
  const freezeRows = buildClientOutputFreezeRows(outputClaimRows, languageRows, citationRows, exposureRows);
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    reviewReceipts,
    policy,
    outputClaimRows,
    languageRows,
    citationRows,
    exposureRows,
    receiptRows,
    freezeRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    reviewReceipts,
    policy,
    outputClaimRows,
    languageRows,
    citationRows,
    exposureRows,
    receiptRows,
    freezeRows,
  });
  const validationItems = buildValidationItems({ gateRows, policy, outputClaimRows, languageRows, citationRows, exposureRows, receiptRows, freezeRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ reviewReceipts, outputClaimRows, languageRows, citationRows, exposureRows, freezeRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_client_output_gate_id: `zendd-client-output-gate.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    client_output_anchor: anchor,
    review_receipts_summary: reviewReceipts.summary,
    client_output_gate_policy: policy,
    client_output_claim_rows: outputClaimRows,
    korean_language_quality_rows: languageRows,
    citation_gate_rows: citationRows,
    client_exposure_control_rows: exposureRows,
    client_receipt_binding_rows: receiptRows,
    client_output_freeze_rows: freezeRows,
    client_output_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_client_output_gate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ reviewReceipts, outputClaimRows, languageRows, citationRows, exposureRows, freezeRows, validation: result.validation });
  result.summary.zendd_client_output_gate_id = result.zendd_client_output_gate_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddClientOutputGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-client-output-gate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "client-output-gate-policy.json"), result.client_output_gate_policy);
  await writeJson(path.join(outDir, "client-output-claim-rows.json"), collectionEnvelope("zendd-client-output-claim-rows.v1", "client_output_claim_rows", result.client_output_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "korean-language-quality-rows.json"), collectionEnvelope("zendd-korean-language-quality-rows.v1", "korean_language_quality_rows", result.korean_language_quality_rows, result.generated_at));
  await writeJson(path.join(outDir, "citation-gate-rows.json"), collectionEnvelope("zendd-citation-gate-rows.v1", "citation_gate_rows", result.citation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "client-exposure-control-rows.json"), collectionEnvelope("zendd-client-exposure-control-rows.v1", "client_exposure_control_rows", result.client_exposure_control_rows, result.generated_at));
  await writeJson(path.join(outDir, "client-receipt-binding-rows.json"), collectionEnvelope("zendd-client-receipt-binding-rows.v1", "client_receipt_binding_rows", result.client_receipt_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "client-output-freeze-rows.json"), collectionEnvelope("zendd-client-output-freeze-rows.v1", "client_output_freeze_rows", result.client_output_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-client-output-gate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddClientOutputGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddClientOutputGate(args);
    console.log(`Zendd client output gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_client_output_gate_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Client output claims: ${result.summary.client_output_claim_row_count}`);
    console.log(`Language gates: ${result.summary.korean_language_quality_row_count}`);
    console.log(`Protected PASS allowed: ${result.summary.protected_client_output_pass_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildClientOutputPolicy(generatedAt) {
  return {
    schema_version: "zendd-client-output-gate-policy.v1",
    phase_slot: "P641",
    project_id: "project.zendd",
    client_output_generation_allowed_now: false,
    protected_client_output_pass_allowed: false,
    raw_client_document_copy_allowed_in_hermes: false,
    weak_korean_language_can_pass: false,
    unsupported_sentence_can_pass: false,
    citationless_legal_conclusion_can_pass: false,
    internal_review_wording_can_pass: false,
    client_output_pass_requires: ["source_trace_ref", "fact_claim_ref", "issue_ref", "citation_ref", "korean_quality_gate_ref", "reviewer_ref", "human_receipt_ref"],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "bind source-backed facts, citation gate, Korean quality gate, and human receipt before client output PASS",
    created_at: generatedAt,
  };
}

function buildOutputClaimRows(receiptTemplates) {
  const clientTemplates = receiptTemplates.filter((row) => row.claim_id.includes("client_output") || row.required_reviewer_role.includes("client_output"));
  const templates = clientTemplates.length ? clientTemplates : receiptTemplates.slice(0, 4);
  const rows = [
    ["ldd_summary_sentence", "client-facing LDD summary sentence"],
    ["issue_summary_sentence", "client-facing issue summary sentence"],
    ["risk_factor_sentence", "client-facing risk factor sentence"],
    ["recommendation_sentence", "client-facing recommendation sentence"],
    ["citation_sentence", "client-facing citation sentence"],
    ["executive_summary_paragraph", "client-facing executive summary paragraph"],
  ];
  return rows.map(([outputKey, description], index) => {
    const receipt = templates[index % templates.length];
    return {
      schema_version: "zendd-client-output-claim-row.v1",
      phase_slot: "P642-P646",
      row_id: `zendd-client-output-claim.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: `claim.zendd.client_output.${outputKey}`,
      output_ref: `client-output.zendd.${outputKey}`,
      output_description: description,
      source_trace_ref: `source-trace.zendd.${outputKey}`,
      fact_claim_ref: receipt.claim_id,
      issue_ref: receipt.binding_type === "issue_linkage" ? receipt.claim_id : `issue.zendd.client_output.${outputKey}`,
      citation_ref: `citation.zendd.${outputKey}`,
      korean_quality_gate_ref: `gate.zendd.korean_quality.${outputKey}`,
      reviewer_ref: receipt.reviewer_ref,
      human_receipt_ref: receipt.receipt_template_ref,
      protected_output: true,
      current_verdict: "blocked",
      block_reason: "client_output_not_quality_gated_or_receipted",
      responsible_owner: "integration_operator",
      next_allowed_action: "bind source trace, fact evidence, citation, Korean quality gate, and validated human receipt",
    };
  });
}

function buildLanguageQualityRows(outputRows) {
  const checks = [
    ["korean_particle_quality", "Korean particles and endings must read naturally for client-facing prose."],
    ["specific_legal_wording", "Vague internal-review wording must be removed from client-facing output."],
    ["no_internal_review_placeholder", "Phrases equivalent to internal review pending cannot appear as client advice."],
    ["sentence_support_clarity", "The sentence must expose its source-backed basis clearly enough for review."],
  ];
  return outputRows.flatMap((outputRow) => checks.map(([checkId, description], index) => ({
    schema_version: "zendd-korean-language-quality-row.v1",
    phase_slot: "P647-P650",
    row_id: `zendd-korean-quality.${normalizeKey(outputRow.output_ref)}.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: outputRow.claim_id,
    output_ref: outputRow.output_ref,
    quality_check_id: checkId,
    quality_description: description,
    quality_evidence_ref: `evidence.zendd.korean_quality.${normalizeKey(outputRow.output_ref)}.${checkId}`,
    pass_without_quality_evidence_allowed: false,
    current_verdict: "blocked",
    block_reason: "korean_quality_evidence_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "run Korean client-output quality review and bind evidence ref",
  })));
}

function buildCitationGateRows(outputRows) {
  return outputRows.map((row, index) => ({
    schema_version: "zendd-citation-gate-row.v1",
    phase_slot: "P651-P653",
    row_id: `zendd-citation-gate.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: row.claim_id,
    output_ref: row.output_ref,
    citation_ref: row.citation_ref,
    source_trace_ref: row.source_trace_ref,
    citation_required: true,
    citationless_legal_conclusion_can_pass: false,
    current_verdict: "blocked",
    block_reason: "citation_or_source_trace_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "bind citation and source trace before client output PASS",
  }));
}

function buildExposureControlRows(outputRows) {
  const exposureChecks = [
    ["raw_client_doc_exposure", "raw client document text cannot be copied into Hermes"],
    ["privileged_detail_exposure", "privileged or restricted details must remain redacted"],
    ["unscoped_fact_exposure", "client output cannot expose facts outside the scoped matter"],
    ["secret_or_env_exposure", "secret and env values cannot appear in client-facing output"],
  ];
  return outputRows.flatMap((outputRow) => exposureChecks.map(([checkId, description], index) => ({
    schema_version: "zendd-client-exposure-control-row.v1",
    phase_slot: "P654-P656",
    row_id: `zendd-client-exposure.${normalizeKey(outputRow.output_ref)}.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: outputRow.claim_id,
    output_ref: outputRow.output_ref,
    exposure_check_id: checkId,
    exposure_description: description,
    unsafe_exposure_allowed: false,
    current_verdict: "blocked",
    block_reason: `${checkId}_not_cleared`,
    responsible_owner: "integration_operator",
    next_allowed_action: "clear exposure control with redaction evidence before PASS",
  })));
}

function buildClientReceiptBindingRows(outputRows, receiptTemplates) {
  const templateByRef = new Map(receiptTemplates.map((row) => [row.receipt_template_ref, row]));
  return outputRows.map((row, index) => {
    const template = templateByRef.get(row.human_receipt_ref);
    return {
      schema_version: "zendd-client-receipt-binding-row.v1",
      phase_slot: "P657-P658",
      row_id: `zendd-client-receipt-binding.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      output_ref: row.output_ref,
      receipt_template_ref: row.human_receipt_ref,
      required_reviewer_role: template?.required_reviewer_role ?? "attorney_client_output_reviewer",
      receipt_payload_present: false,
      protected_pass_allowed_without_receipt: false,
      current_verdict: "blocked",
      block_reason: "client_output_receipt_missing",
      responsible_owner: "integration_operator",
      next_allowed_action: "collect and validate client-output human receipt before PASS",
    };
  });
}

function buildClientOutputFreezeRows(outputRows, languageRows, citationRows, exposureRows) {
  const rows = [
    ...outputRows.map((row) => [row.claim_id, row.output_ref, row.block_reason, row.next_allowed_action]),
    ...languageRows.map((row) => [row.claim_id, row.output_ref, row.block_reason, row.next_allowed_action]),
    ...citationRows.map((row) => [row.claim_id, row.output_ref, row.block_reason, row.next_allowed_action]),
    ...exposureRows.map((row) => [row.claim_id, row.output_ref, row.block_reason, row.next_allowed_action]),
  ];
  return rows.map(([claimId, outputRef, blockReason, nextAllowedAction], index) => ({
    schema_version: "zendd-client-output-freeze-row.v1",
    phase_slot: "P659-P660",
    row_id: `zendd-client-output-freeze.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    claim_id: claimId,
    output_ref: outputRef,
    current_verdict: "blocked",
    block_reason: blockReason,
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildAnchor({ packageJson, phaseLedger, reviewReceipts, policy, outputClaimRows, languageRows, citationRows, exposureRows, receiptRows, freezeRows }) {
  return {
    schema_version: "zendd-client-output-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    review_receipts_command_name: REVIEW_RECEIPTS_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    review_receipts_summary_hash: hashValue(reviewReceipts.summary),
    client_output_policy_hash: hashValue(policy),
    output_claim_hash: hashRows(outputClaimRows, ["claim_id", "source_trace_ref", "citation_ref", "human_receipt_ref", "current_verdict"]),
    language_quality_hash: hashRows(languageRows, ["claim_id", "quality_check_id", "pass_without_quality_evidence_allowed"]),
    citation_gate_hash: hashRows(citationRows, ["claim_id", "citation_required", "citationless_legal_conclusion_can_pass"]),
    exposure_control_hash: hashRows(exposureRows, ["claim_id", "exposure_check_id", "unsafe_exposure_allowed"]),
    receipt_binding_hash: hashRows(receiptRows, ["claim_id", "receipt_payload_present", "protected_pass_allowed_without_receipt"]),
    freeze_hash: hashRows(freezeRows, ["claim_id", "current_verdict", "block_reason", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, reviewReceipts, policy, outputClaimRows, languageRows, citationRows, exposureRows, receiptRows, freezeRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p641_policy_declared", "P641", !policy.client_output_generation_allowed_now && !policy.protected_client_output_pass_allowed && !policy.weak_korean_language_can_pass, "Client output policy blocks generation/PASS and weak Korean output.", "declare client output policy"),
    gateRow("p642_output_claims_bound", "P642-P646", outputClaimRows.length >= 6 && outputClaimRows.every((row) => row.source_trace_ref && row.fact_claim_ref && row.citation_ref && row.human_receipt_ref && row.current_verdict === "blocked"), "Client output claims are bound to source, fact, citation, and receipt refs.", "complete client output claim rows"),
    gateRow("p647_language_quality_required", "P647-P650", languageRows.length >= outputClaimRows.length * 4 && languageRows.every((row) => !row.pass_without_quality_evidence_allowed && row.current_verdict === "blocked"), "Korean language quality checks require evidence before PASS.", "complete Korean quality rows"),
    gateRow("p651_citations_required", "P651-P653", citationRows.length === outputClaimRows.length && citationRows.every((row) => row.citation_required && !row.citationless_legal_conclusion_can_pass), "Client legal conclusions cannot PASS without citation/source trace.", "complete citation gate rows"),
    gateRow("p654_exposure_controls_blocked", "P654-P656", exposureRows.length >= outputClaimRows.length * 4 && exposureRows.every((row) => !row.unsafe_exposure_allowed && row.current_verdict === "blocked"), "Exposure controls block raw client, privileged, unscoped, and secret output exposure.", "complete exposure controls"),
    gateRow("p657_receipts_required", "P657-P658", receiptRows.length === outputClaimRows.length && receiptRows.every((row) => !row.receipt_payload_present && !row.protected_pass_allowed_without_receipt), "Client output receipt bindings remain blocked without receipt payload.", "complete client receipt bindings"),
    gateRow("p659_freeze_rows_document_blocks", "P659-P660", freezeRows.length >= outputClaimRows.length && freezeRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Client output freeze rows document BLOCK with next action.", "complete client output freeze rows"),
    gateRow("package_script_registered", "P660", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P660", phaseLedger.available && phaseLedger.text.includes("P641-P660") && phaseLedger.text.includes(COMMAND_NAME), "P641-P660 phase ledger declares client output gate acceptance.", "record P641-P660 in phase ledger"),
    gateRow("review_receipts_chain_valid", "P660", reviewReceipts.validation.valid && reviewReceipts.summary.zendd_review_receipts_status === "ready_for_client_output_gate_fusion", "P621-P640 review receipts remain valid before client output gate fusion.", "repair review receipt validation before client output gate"),
  ];
}

function buildValidationItems({ gateRows, policy, outputClaimRows, languageRows, citationRows, exposureRows, receiptRows, freezeRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "client_output_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.protected_pass", "client_output_boundary", policy.protected_client_output_pass_allowed === false, "Protected client output PASS is disabled"));
  items.push(validationItem("policy.weak_korean", "language_boundary", policy.weak_korean_language_can_pass === false && policy.internal_review_wording_can_pass === false, "Weak Korean and internal-review wording cannot PASS"));
  items.push(validationItem("output_claims.refs", "claim_boundary", outputClaimRows.every((row) => row.source_trace_ref && row.fact_claim_ref && row.citation_ref && row.human_receipt_ref), "Client output claims have required refs"));
  items.push(validationItem("language.quality_evidence", "language_boundary", languageRows.every((row) => row.pass_without_quality_evidence_allowed === false), "Language quality evidence is required"));
  items.push(validationItem("citation.required", "citation_boundary", citationRows.every((row) => row.citation_required && row.citationless_legal_conclusion_can_pass === false), "Citations are required for legal conclusions"));
  items.push(validationItem("exposure.unsafe", "source_boundary", exposureRows.every((row) => row.unsafe_exposure_allowed === false), "Unsafe exposure is blocked"));
  items.push(validationItem("receipt.required", "receipt_boundary", receiptRows.every((row) => row.receipt_payload_present === false && row.protected_pass_allowed_without_receipt === false), "Client output requires receipt"));
  items.push(validationItem("freeze.next_allowed_action", "claim_boundary", freezeRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Freeze rows document blocks with next actions"));
  return items;
}

function buildSummary({ reviewReceipts, outputClaimRows, languageRows, citationRows, exposureRows, freezeRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_client_output_gate_status: validation.valid
      ? "ready_for_operator_surface_bridge"
      : "documented_block_pending_client_output_gate",
    zendd_project_root: reviewReceipts.summary.zendd_project_root,
    zendd_git_head_short: reviewReceipts.summary.zendd_git_head_short,
    review_receipts_status: reviewReceipts.summary.zendd_review_receipts_status,
    client_output_claim_row_count: outputClaimRows.length,
    korean_language_quality_row_count: languageRows.length,
    citation_gate_row_count: citationRows.length,
    exposure_control_row_count: exposureRows.length,
    freeze_row_count: freezeRows.length,
    protected_client_output_pass_allowed: false,
    weak_korean_language_can_pass: false,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-client-output-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_client_output_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_CLIENT_OUTPUT_GATE_INPUTS.zenddProjectRoot,
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

Creates the P641-P660 Zendd-Hermes client output gate fusion.
--check validates without generating client output, copying client documents, or applying receipts.
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

function normalizeKey(value) {
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
    "# Zendd Client Output Gate Summary",
    "",
    `- Status: ${summary.zendd_client_output_gate_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Client output claims: ${summary.client_output_claim_row_count}`,
    `- Korean language quality rows: ${summary.korean_language_quality_row_count}`,
    `- Citation gates: ${summary.citation_gate_row_count}`,
    `- Exposure controls: ${summary.exposure_control_row_count}`,
    `- Freeze rows: ${summary.freeze_row_count}`,
    `- Protected client output PASS allowed: ${summary.protected_client_output_pass_allowed}`,
    `- Weak Korean can PASS: ${summary.weak_korean_language_can_pass}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.client_output_gate_policy.next_allowed_action,
    "",
  ].join("\n");
}
