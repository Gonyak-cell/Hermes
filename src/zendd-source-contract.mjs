import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddCommandEvidence } from "./zendd-command-evidence.mjs";

export const DEFAULT_ZENDD_SOURCE_CONTRACT_OUT_DIR = "artifacts/zendd-source-contract/latest";
export const DEFAULT_ZENDD_SOURCE_CONTRACT_INPUTS = {
  schemaPath: "schemas/zendd-source-contract.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-source-contract";
const COMMAND_EVIDENCE_COMMAND_NAME = "project:zendd-command-evidence";
const SCHEMA_VERSION = "zendd-source-contract.v1";
const CAPABILITY_ID = "project.zendd.source_contract";
const PHASE_RANGE = "P581-P600";
const PHASE_SLOT = "P581";
const PREVIOUS_PHASE_SLOT = "P580";
const NEXT_PHASE_SLOT = "P601";

export async function runZenddSourceContract(options = {}) {
  const result = await buildZenddSourceContract(options);
  if (options.write !== false) await writeZenddSourceContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd source contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddSourceContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_SOURCE_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const commandEvidence = await buildZenddCommandEvidence({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildSourceContractPolicy(generatedAt);
  const comparisonRows = buildGateComparisonRows();
  const sourceRows = buildSourceRows();
  const referencePolicy = buildSourceReferencePolicy(generatedAt);
  const improvementRows = buildCrossGateImprovementRows();
  const passBlockPolicy = buildSourcePassBlockPolicy(generatedAt);
  const reviewRows = buildSourceReviewBindingRows(sourceRows);
  const freezeRows = buildSourceFreezeRows(sourceRows);
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    commandEvidence,
    policy,
    comparisonRows,
    sourceRows,
    referencePolicy,
    improvementRows,
    reviewRows,
    freezeRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    commandEvidence,
    policy,
    comparisonRows,
    sourceRows,
    referencePolicy,
    improvementRows,
    passBlockPolicy,
    reviewRows,
    freezeRows,
  });
  const validationItems = buildValidationItems({
    gateRows,
    policy,
    comparisonRows,
    sourceRows,
    referencePolicy,
    improvementRows,
    passBlockPolicy,
    reviewRows,
    freezeRows,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ commandEvidence, sourceRows, improvementRows, freezeRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_source_contract_id: `zendd-source-contract.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_contract_anchor: anchor,
    source_command_evidence_summary: commandEvidence.summary,
    source_contract_policy: policy,
    gate_comparison_rows: comparisonRows,
    vdr_ldd_source_contract_rows: sourceRows,
    source_reference_policy: referencePolicy,
    cross_gate_improvement_rows: improvementRows,
    source_pass_block_policy: passBlockPolicy,
    source_review_binding_rows: reviewRows,
    source_freeze_rows: freezeRows,
    source_contract_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_source_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ commandEvidence, sourceRows, improvementRows, freezeRows, validation: result.validation });
  result.summary.zendd_source_contract_id = result.zendd_source_contract_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddSourceContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-source-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "source-contract-policy.json"), result.source_contract_policy);
  await writeJson(path.join(outDir, "gate-comparison-rows.json"), collectionEnvelope("zendd-gate-comparison-rows.v1", "gate_comparison_rows", result.gate_comparison_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-source-contract-rows.json"), collectionEnvelope("zendd-vdr-ldd-source-contract-rows.v1", "vdr_ldd_source_contract_rows", result.vdr_ldd_source_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-gate-improvement-rows.json"), collectionEnvelope("zendd-cross-gate-improvement-rows.v1", "cross_gate_improvement_rows", result.cross_gate_improvement_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-review-binding-rows.json"), collectionEnvelope("zendd-source-review-binding-rows.v1", "source_review_binding_rows", result.source_review_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-freeze-rows.json"), collectionEnvelope("zendd-source-freeze-rows.v1", "source_freeze_rows", result.source_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-source-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddSourceContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddSourceContract(args);
    console.log(`Zendd source contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_source_contract_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Source contract rows: ${result.summary.source_contract_row_count}`);
    console.log(`Gate comparison rows: ${result.summary.gate_comparison_row_count}`);
    console.log(`Raw material copy allowed: ${result.summary.raw_material_copy_allowed_in_hermes}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSourceContractPolicy(generatedAt) {
  return {
    schema_version: "zendd-source-contract-policy.v1",
    phase_slot: "P581",
    project_id: "project.zendd",
    contract_id: "project.zendd.vdr_ldd_source_contract",
    raw_material_copy_allowed_in_hermes: false,
    source_pass_formula: "source_claim_to_stable_source_ref_to_redacted_evidence_to_source_gate_to_reviewer_to_human_receipt_if_protected_to_pass_or_block",
    source_pass_requires: ["stable_source_ref", "evidence_ref", "redacted_summary_ref", "source_boundary_gate_ref", "reviewer_ref"],
    protected_source_pass_requires: ["human_receipt_ref", "receipt_status"],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    forbidden_hermes_source_fields: ["raw_vdr_payload", "raw_client_document", "full_ocr_text", "secret_value", "env_value"],
    verdict: "pass",
    next_allowed_action: "bind Zendd VDR/LDD source refs to Hermes evidence rows without copying raw material",
    created_at: generatedAt,
  };
}

function buildGateComparisonRows() {
  const rows = [
    {
      comparison_id: "resource_intake_vs_vdr_upload",
      hermes_gate: "resource.expansion.intake_quarantine",
      zendd_gate: "vdr.upload_and_classification",
      hermes_strength: "domain-neutral quarantine, duplicate detection, expansion evidence, and resource lineage",
      zendd_strength: "matter-scoped VDR upload, legal document classification, and diligence source routing",
      integration_decision: "use Hermes quarantine lineage for Zendd uploads while keeping raw VDR files in Zendd",
      hermes_improvement_action: "add legal source-control reason fields to resource evidence rows when domain pack is law-firm",
      zendd_improvement_action: "attach Hermes quarantine and duplicate-status evidence refs to VDR upload results",
    },
    {
      comparison_id: "resource_classification_vs_ldd_source_control",
      hermes_gate: "resource.classification_and_quarantine",
      zendd_gate: "ldd.source_controls",
      hermes_strength: "stable resource IDs, extraction confidence, quarantine state, and review status",
      zendd_strength: "legal source admissibility, blocker codes, and LDD-specific source eligibility",
      integration_decision: "require both resource classification evidence and Zendd LDD source-control evidence before PASS",
      hermes_improvement_action: "surface source-control blocker codes as first-class missing evidence",
      zendd_improvement_action: "standardize blocker rows as claim evidence with responsible owner and next action",
    },
    {
      comparison_id: "resource_evidence_surface_vs_fact_span_trace",
      hermes_gate: "resource.evidence_surface",
      zendd_gate: "ldd.fact_engine.source_span",
      hermes_strength: "operator-facing evidence references and artifact traceability",
      zendd_strength: "fact sentence, issue, source span, and cross-document reasoning trace",
      integration_decision: "bridge only fact span refs, hashes, and redacted excerpts into Hermes evidence surfaces",
      hermes_improvement_action: "add source-span evidence type for legal fact claims",
      zendd_improvement_action: "make every fact span emit claim_id, evidence_ref, reviewer_ref, and receipt status",
    },
    {
      comparison_id: "resource_operator_status_vs_client_output_trace",
      hermes_gate: "resource.operator_status",
      zendd_gate: "client_output.source_trace_gate",
      hermes_strength: "missing evidence, missing review, block reason, and next action surfaces",
      zendd_strength: "Korean client-facing sentence quality, citation exposure, and internal-review wording controls",
      integration_decision: "show client output source trace as protected claim status, not as raw client document",
      hermes_improvement_action: "add client-output protected status to operator dashboards",
      zendd_improvement_action: "use Hermes PASS/BLOCK wording for client-facing output gates",
    },
  ];
  return rows.map((row, index) => ({
    schema_version: "zendd-gate-comparison-row.v1",
    phase_slot: "P582-P583",
    row_id: `zendd-gate-comparison.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    current_verdict: "pass",
    next_allowed_action: "materialize cross-gate improvement row before enabling source PASS",
    ...row,
  }));
}

function buildSourceRows() {
  const rows = [
    ["vdr_upload_manifest", "VDR upload manifest and document inventory", "vdr_source", "gate.zendd.vdr.upload_manifest", "gate.hermes.resource.quarantine"],
    ["vdr_classification_result", "VDR document classification result", "vdr_source", "gate.zendd.vdr.classification", "gate.hermes.resource.classification"],
    ["ldd_source_control_state", "LDD source control allow/block state", "ldd_source_control", "gate.zendd.ldd.source_control", "gate.hermes.resource.review_status"],
    ["ldd_fact_source_span", "LDD fact source span and redacted excerpt", "ldd_fact_span", "gate.zendd.ldd.fact_span", "gate.hermes.resource.evidence_surface"],
    ["ldd_issue_linkage", "LDD issue-to-source linkage", "ldd_issue_trace", "gate.zendd.ldd.issue_linkage", "gate.hermes.claim.evidence_matrix"],
    ["client_output_source_trace", "Client-facing report or memo source trace", "client_output_trace", "gate.zendd.client_output.source_trace", "gate.hermes.protected_output.review"],
    ["redaction_report", "Redaction report for VDR/LDD evidence export", "redaction_report", "gate.zendd.redaction.report", "gate.hermes.resource.redacted_evidence"],
    ["citation_evidence_surface", "Citation and evidence surface for legal output", "citation_surface", "gate.zendd.citation.trace", "gate.hermes.resource.operator_surface"],
  ];
  return rows.map(([sourceId, description, sourceType, zenddGateRef, hermesGateRef], index) => {
    const key = normalizeKey(sourceId);
    return {
      schema_version: "zendd-vdr-ldd-source-contract-row.v1",
      phase_slot: "P584-P590",
      row_id: `zendd-source-contract.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: `claim.zendd.source.${key}`,
      source_contract_id: `source-contract.zendd.${key}`,
      source_type: sourceType,
      source_description: description,
      stable_source_ref: `source.zendd.${key}`,
      evidence_ref: `evidence.zendd.source.${key}`,
      redacted_summary_ref: `redaction.zendd.source.${key}`,
      hermes_resource_gate_ref: hermesGateRef,
      zendd_vdr_ldd_gate_ref: zenddGateRef,
      reviewer_ref: `review.zendd.source.${key}`,
      hard_gate_ref: `gate.zendd.source_contract.${key}`,
      human_receipt_ref_required: true,
      raw_material_copy_allowed_in_hermes: false,
      current_verdict: "blocked",
      block_reason: "source_evidence_not_captured_or_reviewed",
      responsible_owner: "integration_operator",
      next_allowed_action: "capture stable source ref, redacted summary, source gate evidence, reviewer, and human receipt before PASS",
    };
  });
}

function buildSourceReferencePolicy(generatedAt) {
  return {
    schema_version: "zendd-source-reference-policy.v1",
    phase_slot: "P591",
    project_id: "project.zendd",
    allowed_hermes_fields: [
      "stable_source_ref",
      "matter_id",
      "source_type",
      "classification_label",
      "source_control_status",
      "confidence",
      "redacted_summary_ref",
      "evidence_ref",
      "reviewer_ref",
      "human_receipt_ref",
    ],
    blocked_hermes_fields: ["raw_vdr_payload", "raw_client_document", "full_ocr_text", "secret_value", "env_value", "unscoped_absolute_client_path"],
    reference_only_required: true,
    raw_material_copy_allowed_in_hermes: false,
    verdict: "pass",
    next_allowed_action: "use stable references and redacted evidence only",
    created_at: generatedAt,
  };
}

function buildCrossGateImprovementRows() {
  const rows = [
    ["hermes_from_zendd.source_control_codes", "hermes_from_zendd", "Add LDD source-control blocker codes to Hermes resource evidence rows.", "implement in future resource-law-firm bridge"],
    ["hermes_from_zendd.fact_span_type", "hermes_from_zendd", "Add legal fact span as a typed Hermes evidence reference.", "bind fact span bridge in P601-P620"],
    ["zendd_from_hermes.quarantine_lineage", "zendd_from_hermes", "Attach Hermes quarantine and duplicate evidence refs to Zendd VDR uploads.", "add Zendd output adapter field after work order receipt"],
    ["zendd_from_hermes.pass_block_formula", "zendd_from_hermes", "Convert Zendd ready/done statuses into CLAIM/EVIDENCE/REVIEW/RECEIPT/PASS-or-BLOCK.", "bind Zendd claims to Hermes freeze rows"],
    ["mutual.redaction_hashes", "mutual_hardening", "Require redacted summary refs and output hashes for both systems.", "create shared redaction evidence schema"],
    ["mutual.operator_next_action", "mutual_hardening", "Show missing source evidence, missing receipt, block reason, and next action in both operator surfaces.", "bridge operator rows in P661-P680"],
  ];
  return rows.map(([improvementId, direction, description, nextAllowedAction], index) => ({
    schema_version: "zendd-cross-gate-improvement-row.v1",
    phase_slot: "P592-P594",
    row_id: `zendd-cross-gate-improvement.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    improvement_id: improvementId,
    direction,
    description,
    current_verdict: "documented_improvement",
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildSourcePassBlockPolicy(generatedAt) {
  return {
    schema_version: "zendd-source-pass-block-policy.v1",
    phase_slot: "P595",
    project_id: "project.zendd",
    pass_allowed_without_stable_source_ref: false,
    pass_allowed_without_redacted_summary: false,
    pass_allowed_without_review: false,
    protected_pass_allowed_without_receipt: false,
    unsafe_raw_material_copy_can_pass: false,
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    verdict: "pass",
    next_allowed_action: "adjudicate source claims only after reference, evidence, gate, review, and receipt are present",
    created_at: generatedAt,
  };
}

function buildSourceReviewBindingRows(sourceRows) {
  return sourceRows.map((row, index) => ({
    schema_version: "zendd-source-review-binding-row.v1",
    phase_slot: "P596-P598",
    row_id: `zendd-source-review.row.${String(index + 1).padStart(2, "0")}`,
    claim_id: row.claim_id,
    stable_source_ref: row.stable_source_ref,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref_required: row.human_receipt_ref_required,
    pass_without_review_allowed: false,
    pass_without_receipt_allowed: false,
    current_verdict: "blocked_pending_source_review",
    block_reason: "source_contract_not_reviewed",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "bind source reviewer/hard gate and human receipt before source PASS",
  }));
}

function buildSourceFreezeRows(sourceRows) {
  return sourceRows.map((row, index) => ({
    schema_version: "zendd-source-freeze-row.v1",
    phase_slot: "P599-P600",
    row_id: `zendd-source-freeze.row.${String(index + 1).padStart(2, "0")}`,
    claim_id: row.claim_id,
    stable_source_ref: row.stable_source_ref,
    evidence_ref: row.evidence_ref,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
  }));
}

function buildAnchor({ packageJson, phaseLedger, commandEvidence, policy, comparisonRows, sourceRows, referencePolicy, improvementRows, reviewRows, freezeRows }) {
  return {
    schema_version: "zendd-source-contract-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    command_evidence_command_name: COMMAND_EVIDENCE_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    command_evidence_summary_hash: hashValue(commandEvidence.summary),
    source_contract_policy_hash: hashValue(policy),
    gate_comparison_hash: hashRows(comparisonRows, ["comparison_id", "integration_decision", "hermes_improvement_action", "zendd_improvement_action"]),
    source_contract_hash: hashRows(sourceRows, ["claim_id", "stable_source_ref", "evidence_ref", "raw_material_copy_allowed_in_hermes", "next_allowed_action"]),
    source_reference_policy_hash: hashValue(referencePolicy),
    cross_gate_improvement_hash: hashRows(improvementRows, ["improvement_id", "direction", "next_allowed_action"]),
    review_binding_hash: hashRows(reviewRows, ["claim_id", "pass_without_review_allowed", "pass_without_receipt_allowed"]),
    freeze_hash: hashRows(freezeRows, ["claim_id", "current_verdict", "block_reason", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, commandEvidence, policy, comparisonRows, sourceRows, referencePolicy, improvementRows, passBlockPolicy, reviewRows, freezeRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p581_policy_declared", "P581", !policy.raw_material_copy_allowed_in_hermes && policy.source_pass_requires.includes("stable_source_ref"), "Source contract policy keeps Zendd raw material out of Hermes and requires stable source refs.", "declare source contract policy"),
    gateRow("p582_gate_comparison_declared", "P582-P583", comparisonRows.length >= 4 && comparisonRows.every((row) => row.integration_decision && row.hermes_improvement_action && row.zendd_improvement_action), "Hermes resource gate and Zendd VDR/LDD gate differences are documented with improvement actions.", "complete gate comparison rows"),
    gateRow("p584_source_rows_reference_only", "P584-P590", sourceRows.length >= 8 && sourceRows.every((row) => row.stable_source_ref && row.evidence_ref && !row.raw_material_copy_allowed_in_hermes), "VDR/LDD source rows use reference-only evidence refs.", "complete source contract rows"),
    gateRow("p591_reference_policy_blocks_raw_material", "P591", referencePolicy.reference_only_required && !referencePolicy.raw_material_copy_allowed_in_hermes && referencePolicy.blocked_hermes_fields.includes("raw_vdr_payload"), "Source reference policy blocks raw VDR/client material in Hermes.", "declare source reference policy"),
    gateRow("p592_cross_gate_improvements_declared", "P592-P594", improvementRows.length >= 6 && hasDirections(improvementRows, ["hermes_from_zendd", "zendd_from_hermes", "mutual_hardening"]), "Cross-system improvement rows cover Hermes, Zendd, and mutual hardening.", "record cross-gate improvements"),
    gateRow("p595_pass_block_policy_declared", "P595", !passBlockPolicy.pass_allowed_without_stable_source_ref && !passBlockPolicy.pass_allowed_without_review && !passBlockPolicy.protected_pass_allowed_without_receipt, "Source PASS cannot occur without source ref, review, and protected receipt.", "declare source PASS/BLOCK policy"),
    gateRow("p596_review_bindings_required", "P596-P598", reviewRows.length === sourceRows.length && reviewRows.every((row) => !row.pass_without_review_allowed && !row.pass_without_receipt_allowed), "Every source row is bound to review and receipt requirements.", "bind source review rows"),
    gateRow("p599_freeze_rows_document_blocks", "P599-P600", freezeRows.length === sourceRows.length && freezeRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Every source claim remains documented BLOCK until evidence, review, and receipt exist.", "complete source freeze rows"),
    gateRow("package_script_registered", "P600", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P600", phaseLedger.available && phaseLedger.text.includes("P581-P600") && phaseLedger.text.includes(COMMAND_NAME), "P581-P600 phase ledger declares source contract acceptance.", "record P581-P600 in phase ledger"),
    gateRow("command_evidence_chain_valid", "P600", commandEvidence.validation.valid && commandEvidence.summary.zendd_command_evidence_status === "ready_for_vdr_ldd_source_contract_bridge", "P561-P580 command evidence remains valid before source contract.", "repair command evidence validation before source contract"),
  ];
}

function buildValidationItems({ gateRows, policy, comparisonRows, sourceRows, referencePolicy, improvementRows, passBlockPolicy, reviewRows, freezeRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "source_contract_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.raw_material_copy_allowed_in_hermes", "source_boundary", policy.raw_material_copy_allowed_in_hermes === false, "Raw source material is not copied into Hermes"));
  items.push(validationItem("comparison.integration_decision", "gate_comparison", comparisonRows.every((row) => row.integration_decision && row.hermes_improvement_action && row.zendd_improvement_action), "Gate comparison rows include mutual improvement actions"));
  items.push(validationItem("source_rows.stable_refs", "source_boundary", sourceRows.every((row) => row.stable_source_ref && row.evidence_ref && row.redacted_summary_ref), "Source rows include stable refs and redacted evidence refs"));
  items.push(validationItem("source_rows.raw_copy_blocked", "source_boundary", sourceRows.every((row) => row.raw_material_copy_allowed_in_hermes === false), "Source rows block raw material copies"));
  items.push(validationItem("reference_policy.blocked_fields", "source_boundary", referencePolicy.blocked_hermes_fields.includes("raw_vdr_payload") && referencePolicy.blocked_hermes_fields.includes("raw_client_document"), "Reference policy blocks raw VDR and client documents"));
  items.push(validationItem("improvements.directions", "gate_comparison", hasDirections(improvementRows, ["hermes_from_zendd", "zendd_from_hermes", "mutual_hardening"]), "Improvement rows cover both systems and mutual hardening"));
  items.push(validationItem("pass_policy.receipt", "claim_boundary", passBlockPolicy.protected_pass_allowed_without_receipt === false, "Protected source PASS requires receipt"));
  items.push(validationItem("review.pass_without_review", "claim_boundary", reviewRows.every((row) => row.pass_without_review_allowed === false && row.pass_without_receipt_allowed === false), "Source rows cannot PASS without review or receipt"));
  items.push(validationItem("freeze.next_allowed_action", "claim_boundary", freezeRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Freeze rows document blocks with next actions"));
  return items;
}

function buildSummary({ commandEvidence, sourceRows, improvementRows, freezeRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_source_contract_status: validation.valid
      ? "ready_for_fact_issue_bridge"
      : "documented_block_pending_source_contract_gate",
    zendd_project_root: commandEvidence.summary.zendd_project_root,
    zendd_git_head_short: commandEvidence.summary.zendd_git_head_short,
    source_command_evidence_status: commandEvidence.summary.zendd_command_evidence_status,
    source_contract_row_count: sourceRows.length,
    gate_comparison_row_count: 4,
    cross_gate_improvement_row_count: improvementRows.length,
    freeze_row_count: freezeRows.length,
    raw_material_copy_allowed_in_hermes: false,
    protected_pass_allowed_without_receipt: false,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-source-contract-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_source_contract_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_SOURCE_CONTRACT_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_SOURCE_CONTRACT_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_SOURCE_CONTRACT_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_SOURCE_CONTRACT_INPUTS.zenddProjectRoot,
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

Creates the P581-P600 Zendd-Hermes VDR/LDD source contract bridge.
--check validates without writing artifacts, copying raw VDR material, or executing Zendd commands.
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

function hasDirections(rows, directions) {
  const present = new Set(rows.map((row) => row.direction));
  return directions.every((direction) => present.has(direction));
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
    "# Zendd Source Contract Summary",
    "",
    `- Status: ${summary.zendd_source_contract_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Source contract rows: ${summary.source_contract_row_count}`,
    `- Gate comparison rows: ${summary.gate_comparison_row_count}`,
    `- Cross-gate improvement rows: ${summary.cross_gate_improvement_row_count}`,
    `- Freeze rows: ${summary.freeze_row_count}`,
    `- Raw material copy allowed in Hermes: ${summary.raw_material_copy_allowed_in_hermes}`,
    `- Protected PASS without receipt allowed: ${summary.protected_pass_allowed_without_receipt}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.source_contract_policy.next_allowed_action,
    "",
  ].join("\n");
}
