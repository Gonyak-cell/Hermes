import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddClientOutputGate } from "./zendd-client-output-gate.mjs";
import { buildZenddReleaseCandidateSandbox } from "./zendd-release-candidate-sandbox.mjs";

export const DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_OUT_DIR = "artifacts/zendd-vdr-ldd-workflow-adapter/latest";
export const DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_INPUTS = {
  schemaPath: "schemas/zendd-vdr-ldd-workflow-adapter.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-vdr-ldd-workflow-adapter";
const CLIENT_OUTPUT_GATE_COMMAND_NAME = "project:zendd-client-output-gate";
const RELEASE_CANDIDATE_SANDBOX_COMMAND_NAME = "project:zendd-release-candidate-sandbox";
const SCHEMA_VERSION = "zendd-vdr-ldd-workflow-adapter.v1";
const CAPABILITY_ID = "project.zendd.vdr_ldd_workflow_adapter";
const PHASE_RANGE = "P901-P920";
const PHASE_SLOT = "P901";
const PREVIOUS_PHASE_SLOT = "P900";
const NEXT_PHASE_SLOT = "P921";
const READY_STATUS = "ready_for_zendd_vdr_ldd_workflow_adapter";
const CLIENT_OUTPUT_GATE_READY_STATUS = "ready_for_operator_surface_bridge";

export async function runZenddVdrLddWorkflowAdapter(options = {}) {
  const result = await buildZenddVdrLddWorkflowAdapter(options);
  if (options.write !== false) await writeZenddVdrLddWorkflowAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd VDR/LDD workflow adapter failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddVdrLddWorkflowAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const clientOutputGate = await buildZenddClientOutputGate({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.integration_phase_ledger_path,
    write: false,
  });
  const releaseCandidateSandbox = await buildZenddReleaseCandidateSandbox({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });

  const policy = buildWorkflowAdapterPolicy(generatedAt, clientOutputGate, releaseCandidateSandbox);
  const adapterRows = buildWorkflowAdapterRows(clientOutputGate.client_output_claim_rows);
  const sourceSpanRows = buildSourceSpanMappingRows(clientOutputGate.client_output_claim_rows);
  const qualityPrivilegeRows = buildQualityPrivilegeGateRows(clientOutputGate);
  const operatorRows = buildOperatorClaimSurfaceRows(adapterRows, sourceSpanRows, qualityPrivilegeRows);
  const failClosedRows = buildFailClosedRows({ policy, clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows });
  const closeoutRows = buildCloseoutRows({ policy, clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, clientOutputGate, releaseCandidateSandbox, policy, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, clientOutputGate, releaseCandidateSandbox, policy, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_vdr_ldd_workflow_adapter_id: `zendd-vdr-ldd-workflow-adapter.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    vdr_ldd_workflow_adapter_anchor: anchor,
    source_client_output_gate_summary: clientOutputGate.summary,
    source_release_candidate_sandbox_summary: releaseCandidateSandbox.summary,
    vdr_ldd_workflow_adapter_policy: policy,
    vdr_ldd_workflow_adapter_rows: adapterRows,
    vdr_ldd_source_span_mapping_rows: sourceSpanRows,
    vdr_ldd_quality_privilege_gate_rows: qualityPrivilegeRows,
    vdr_ldd_operator_claim_surface_rows: operatorRows,
    vdr_ldd_workflow_fail_closed_rows: failClosedRows,
    vdr_ldd_workflow_closeout_rows: closeoutRows,
    vdr_ldd_workflow_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_vdr_ldd_workflow_adapter")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_vdr_ldd_workflow_adapter_id = result.zendd_vdr_ldd_workflow_adapter_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddVdrLddWorkflowAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-vdr-ldd-workflow-adapter.json"), serializableResult(result));
  await writeJson(path.join(outDir, "vdr-ldd-workflow-adapter-policy.json"), result.vdr_ldd_workflow_adapter_policy);
  await writeJson(path.join(outDir, "vdr-ldd-workflow-adapter-rows.json"), collectionEnvelope("zendd-vdr-ldd-workflow-adapter-rows.v1", "vdr_ldd_workflow_adapter_rows", result.vdr_ldd_workflow_adapter_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-source-span-mapping-rows.json"), collectionEnvelope("zendd-vdr-ldd-source-span-mapping-rows.v1", "vdr_ldd_source_span_mapping_rows", result.vdr_ldd_source_span_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-quality-privilege-gate-rows.json"), collectionEnvelope("zendd-vdr-ldd-quality-privilege-gate-rows.v1", "vdr_ldd_quality_privilege_gate_rows", result.vdr_ldd_quality_privilege_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-operator-claim-surface-rows.json"), collectionEnvelope("zendd-vdr-ldd-operator-claim-surface-rows.v1", "vdr_ldd_operator_claim_surface_rows", result.vdr_ldd_operator_claim_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-workflow-fail-closed-rows.json"), collectionEnvelope("zendd-vdr-ldd-workflow-fail-closed-rows.v1", "vdr_ldd_workflow_fail_closed_rows", result.vdr_ldd_workflow_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-workflow-closeout-rows.json"), collectionEnvelope("zendd-vdr-ldd-workflow-closeout-rows.v1", "vdr_ldd_workflow_closeout_rows", result.vdr_ldd_workflow_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "vdr-ldd-workflow-gate-rows.json"), collectionEnvelope("zendd-vdr-ldd-workflow-gate-rows.v1", "vdr_ldd_workflow_gate_rows", result.vdr_ldd_workflow_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-vdr-ldd-workflow-adapter-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddVdrLddWorkflowAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddVdrLddWorkflowAdapter(args);
    console.log(`Zendd VDR/LDD workflow adapter ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_vdr_ldd_workflow_adapter_status}`);
    console.log(`Workflow adapter rows: ${result.summary.vdr_ldd_workflow_adapter_count}`);
    console.log(`Source span mappings: ${result.summary.vdr_ldd_source_span_mapping_count}`);
    console.log(`Quality/privilege gates: ${result.summary.vdr_ldd_quality_privilege_gate_count}`);
    console.log(`Operator claim surfaces: ${result.summary.vdr_ldd_operator_claim_surface_count}`);
    console.log(`Automatic legal PASS allowed: ${result.summary.automatic_legal_pass_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildWorkflowAdapterPolicy(generatedAt, clientOutputGate, releaseCandidateSandbox) {
  return {
    schema_version: "zendd-vdr-ldd-workflow-adapter-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_client_output_gate_ref: clientOutputGate.zendd_client_output_gate_id,
    source_release_candidate_sandbox_ref: releaseCandidateSandbox.zendd_release_candidate_sandbox_id,
    workflow_surface_creation_allowed: true,
    vdr_source_mutation_allowed_now: false,
    ldd_workflow_mutation_allowed_now: false,
    client_output_generation_allowed_now: false,
    client_delivery_allowed_now: false,
    automatic_legal_pass_allowed: false,
    legal_advice_or_filing_decision_allowed_now: false,
    receipt_application_allowed_now: false,
    release_candidate_publish_allowed_now: false,
    raw_vdr_material_copy_allowed_in_hermes: false,
    raw_client_document_copy_allowed_in_hermes: false,
    raw_fact_text_storage_allowed_in_hermes: false,
    raw_ocr_text_storage_allowed_in_hermes: false,
    secret_read_allowed_now: false,
    workflow_pass_requires: [
      "workflow_adapter_ref",
      "claim_id",
      "source_trace_ref",
      "fact_claim_ref",
      "issue_ref",
      "citation_ref",
      "redacted_summary_ref",
      "quality_gate_ref",
      "conflict_gate_ref",
      "privilege_gate_ref",
      "reviewer_ref",
      "hard_gate_ref",
      "human_receipt_ref",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "surface Zendd VDR/LDD workflow claims through stable refs, redacted summaries, review gates, and human receipts only",
    created_at: generatedAt,
  };
}

function buildWorkflowAdapterRows(outputClaimRows) {
  return outputClaimRows.map((row, index) => {
    const key = normalizeKey(row.claim_id);
    return {
      schema_version: "zendd-vdr-ldd-workflow-adapter-row.v1",
      phase_slot: "P904-P908",
      row_id: `zendd-vdr-ldd-workflow-adapter.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      workflow_adapter_ref: `workflow-adapter.zendd.vdr_ldd.${key}`,
      workflow_type: "vdr_ldd_client_output_workflow",
      claim_id: row.claim_id,
      output_ref: row.output_ref,
      source_trace_ref: row.source_trace_ref,
      fact_claim_ref: row.fact_claim_ref,
      issue_ref: row.issue_ref,
      citation_ref: row.citation_ref,
      redacted_summary_ref: `redacted-summary.zendd.vdr_ldd.${key}`,
      quality_gate_ref: row.korean_quality_gate_ref,
      conflict_gate_ref: `gate.zendd.vdr_ldd.conflict.${key}`,
      privilege_gate_ref: `gate.zendd.vdr_ldd.privilege.${key}`,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: `hard-gate.zendd.vdr_ldd.workflow.${key}`,
      human_receipt_ref: row.human_receipt_ref,
      source_span_preserved: true,
      citation_gate_preserved: true,
      quality_gate_preserved: true,
      conflict_gate_preserved: true,
      privilege_gate_preserved: true,
      human_review_gate_preserved: true,
      vdr_source_mutation_allowed_now: false,
      ldd_workflow_mutation_allowed_now: false,
      client_output_generation_allowed_now: false,
      automatic_legal_pass_allowed: false,
      raw_vdr_material_copy_allowed_in_hermes: false,
      raw_client_document_copy_allowed_in_hermes: false,
      raw_fact_text_storage_allowed_in_hermes: false,
      secret_read_allowed_now: false,
      current_verdict: "blocked",
      block_reason: "vdr_ldd_workflow_requires_review_receipt_and_redacted_source_span_evidence",
      responsible_owner: "legal_domain_operator",
      next_allowed_action: "bind redacted source span, conflict clearance, privilege clearance, and human receipt before workflow PASS",
    };
  });
}

function buildSourceSpanMappingRows(outputClaimRows) {
  return outputClaimRows.map((row, index) => {
    const key = normalizeKey(row.claim_id);
    return {
      schema_version: "zendd-vdr-ldd-source-span-mapping-row.v1",
      phase_slot: "P909-P911",
      row_id: `zendd-vdr-ldd-source-span.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      source_trace_ref: row.source_trace_ref,
      fact_claim_ref: row.fact_claim_ref,
      issue_ref: row.issue_ref,
      citation_ref: row.citation_ref,
      redacted_summary_ref: `redacted-summary.zendd.vdr_ldd.${key}`,
      source_span_ref: `source-span.zendd.vdr_ldd.${key}`,
      evidence_ref: `evidence.zendd.vdr_ldd.source_span.${key}`,
      raw_source_text_present: false,
      raw_vdr_material_copy_allowed_in_hermes: false,
      raw_client_document_copy_allowed_in_hermes: false,
      raw_fact_text_storage_allowed_in_hermes: false,
      citation_required: true,
      source_span_required: true,
      current_verdict: "blocked",
      block_reason: "redacted_source_span_evidence_not_validated",
      responsible_owner: "legal_domain_operator",
      next_allowed_action: "validate redacted source span and citation refs without copying raw VDR/client material",
    };
  });
}

function buildQualityPrivilegeGateRows(clientOutputGate) {
  const qualityByClaim = groupBy(clientOutputGate.korean_language_quality_rows, "claim_id");
  const citationByClaim = new Map(clientOutputGate.citation_gate_rows.map((row) => [row.claim_id, row]));
  const exposureByClaim = groupBy(clientOutputGate.client_exposure_control_rows, "claim_id");
  const receiptByClaim = new Map(clientOutputGate.client_receipt_binding_rows.map((row) => [row.claim_id, row]));
  return clientOutputGate.client_output_claim_rows.map((row, index) => {
    const key = normalizeKey(row.claim_id);
    const qualityRows = qualityByClaim.get(row.claim_id) ?? [];
    const exposureRows = exposureByClaim.get(row.claim_id) ?? [];
    const citation = citationByClaim.get(row.claim_id);
    const receipt = receiptByClaim.get(row.claim_id);
    return {
      schema_version: "zendd-vdr-ldd-quality-privilege-gate-row.v1",
      phase_slot: "P912-P915",
      row_id: `zendd-vdr-ldd-quality-privilege.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      output_ref: row.output_ref,
      quality_gate_ref: row.korean_quality_gate_ref,
      citation_gate_ref: citation?.citation_ref ?? row.citation_ref,
      conflict_gate_ref: `gate.zendd.vdr_ldd.conflict.${key}`,
      privilege_gate_ref: `gate.zendd.vdr_ldd.privilege.${key}`,
      exposure_gate_refs: exposureRows.map((exposure) => exposure.exposure_check_id),
      quality_evidence_refs: qualityRows.map((quality) => quality.quality_evidence_ref),
      human_receipt_ref: receipt?.receipt_template_ref ?? row.human_receipt_ref,
      quality_gate_passed: false,
      citation_gate_passed: false,
      conflict_gate_passed: false,
      privilege_gate_passed: false,
      human_receipt_payload_present: false,
      automatic_legal_pass_allowed: false,
      client_output_generation_allowed_now: false,
      client_delivery_allowed_now: false,
      raw_vdr_material_copy_allowed_in_hermes: false,
      raw_client_document_copy_allowed_in_hermes: false,
      raw_fact_text_storage_allowed_in_hermes: false,
      current_verdict: "blocked",
      block_reason: "quality_citation_conflict_privilege_or_receipt_gate_missing",
      responsible_owner: "legal_domain_operator",
      next_allowed_action: "clear quality, citation, conflict, privilege, and human receipt gates before PASS",
    };
  });
}

function buildOperatorClaimSurfaceRows(adapterRows, sourceSpanRows, qualityPrivilegeRows) {
  const spanByClaim = new Map(sourceSpanRows.map((row) => [row.claim_id, row]));
  const qualityByClaim = new Map(qualityPrivilegeRows.map((row) => [row.claim_id, row]));
  return adapterRows.map((row, index) => {
    const span = spanByClaim.get(row.claim_id);
    const quality = qualityByClaim.get(row.claim_id);
    return {
      schema_version: "zendd-vdr-ldd-operator-claim-surface-row.v1",
      phase_slot: "P916-P918",
      row_id: `zendd-vdr-ldd-operator-surface.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      workflow_adapter_ref: row.workflow_adapter_ref,
      current_verdict: "blocked",
      missing_evidence: [
        "validated_redacted_source_span_evidence",
        "quality_gate_evidence",
        "conflict_clearance_evidence",
        "privilege_clearance_evidence",
      ],
      missing_reviewer_or_receipt: ["validated_human_receipt"],
      source_span_mapping_ref: span?.source_span_ref,
      quality_gate_ref: quality?.quality_gate_ref,
      conflict_gate_ref: row.conflict_gate_ref,
      privilege_gate_ref: row.privilege_gate_ref,
      block_reason: "workflow_adapter_missing_review_evidence_and_human_receipt",
      responsible_owner: "legal_domain_operator",
      next_allowed_action: row.next_allowed_action,
    };
  });
}

function buildFailClosedRows({ policy, clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows }) {
  const allRows = [...adapterRows, ...sourceSpanRows, ...qualityPrivilegeRows, ...operatorRows];
  const rows = [
    ["source_client_output_gate_ready", clientOutputGate.validation.valid && clientOutputGate.summary.zendd_client_output_gate_status === CLIENT_OUTPUT_GATE_READY_STATUS, "P641-P660 client output gate is ready.", "repair Zendd client output gate"],
    ["source_release_candidate_sandbox_ready", releaseCandidateSandbox.validation.valid && releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox", "P881-P900 release candidate sandbox is ready.", "repair release candidate sandbox"],
    ["workflow_rows_blocked", adapterRows.length >= 6 && adapterRows.every(documentedWorkflowAdapter), "Workflow adapter rows are documented BLOCK.", "complete workflow adapter rows"],
    ["source_spans_redacted_only", sourceSpanRows.length === adapterRows.length && sourceSpanRows.every(documentedSourceSpanMapping), "Source span mappings are redacted refs only.", "complete source span mapping rows"],
    ["quality_privilege_gates_blocked", qualityPrivilegeRows.length === adapterRows.length && qualityPrivilegeRows.every(documentedQualityPrivilegeGate), "Quality, citation, conflict, privilege, and receipt gates are blocked.", "complete quality and privilege gate rows"],
    ["operator_surface_documents_next_action", operatorRows.length === adapterRows.length && operatorRows.every(documentedOperatorSurface), "Operator surface shows missing evidence, missing receipt, block reason, owner, and next action.", "complete operator claim surface rows"],
    ["no_raw_vdr_or_client_copy", noRawMaterial(policy) && allRows.every(noRawMaterial), "No raw VDR material, client documents, fact text, OCR text, or secrets are copied or stored.", "restore reference-only workflow adapter"],
    ["no_automatic_legal_pass", policy.automatic_legal_pass_allowed === false && allRows.every((row) => row.automatic_legal_pass_allowed !== true && row.current_verdict === "blocked"), "No workflow can become a legal PASS automatically.", "keep workflows blocked pending human review"],
    ["no_client_output_generation_or_delivery", policy.client_output_generation_allowed_now === false && policy.client_delivery_allowed_now === false && allRows.every(noWorkflowMutation), "No client output generation, delivery, VDR mutation, or LDD mutation is allowed.", "restore no-mutation workflow adapter"],
    ["no_receipt_application_or_publish", policy.receipt_application_allowed_now === false && policy.release_candidate_publish_allowed_now === false, "No receipt application or release publish happens in P901-P920.", "keep receipt intake and publish future-only"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-vdr-ldd-workflow-fail-closed-row.v1",
    phase_slot: "P919",
    row_id: `zendd-vdr-ldd-workflow-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.vdr_ldd_workflow.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    automatic_legal_pass_allowed: false,
    vdr_source_mutation_allowed_now: false,
    ldd_workflow_mutation_allowed_now: false,
    client_output_generation_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_application_allowed_now: false,
    release_candidate_publish_allowed_now: false,
    raw_vdr_material_copy_allowed_in_hermes: false,
    raw_client_document_copy_allowed_in_hermes: false,
    raw_fact_text_storage_allowed_in_hermes: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_vdr_ldd_workflow_adapter_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ policy, clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows }) {
  const ready = clientOutputGate.validation.valid
    && clientOutputGate.summary.zendd_client_output_gate_status === CLIENT_OUTPUT_GATE_READY_STATUS
    && releaseCandidateSandbox.validation.valid
    && releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox"
    && policy.workflow_surface_creation_allowed
    && noWorkflowMutation(policy)
    && noRawMaterial(policy)
    && adapterRows.every(documentedWorkflowAdapter)
    && sourceSpanRows.every(documentedSourceSpanMapping)
    && qualityPrivilegeRows.every(documentedQualityPrivilegeGate)
    && operatorRows.every(documentedOperatorSurface)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-vdr-ldd-workflow-closeout-row.v1",
    phase_slot: "P920",
    row_id: "zendd-vdr-ldd-workflow-closeout.p920",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    workflow_adapter_ready: ready,
    vdr_ldd_workflow_adapter_count: adapterRows.length,
    vdr_ldd_source_span_mapping_count: sourceSpanRows.length,
    vdr_ldd_quality_privilege_gate_count: qualityPrivilegeRows.length,
    vdr_ldd_operator_claim_surface_count: operatorRows.length,
    automatic_legal_pass_allowed: false,
    vdr_source_mutation_allowed_now: false,
    ldd_workflow_mutation_allowed_now: false,
    client_output_generation_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_application_allowed_now: false,
    release_candidate_publish_allowed_now: false,
    raw_vdr_material_copy_allowed_in_hermes: false,
    raw_client_document_copy_allowed_in_hermes: false,
    raw_fact_text_storage_allowed_in_hermes: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P921-P940 human receipt intake without copying raw VDR/client material or applying receipts",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, clientOutputGate, releaseCandidateSandbox, policy, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-vdr-ldd-workflow-adapter-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    client_output_gate_command_name: CLIENT_OUTPUT_GATE_COMMAND_NAME,
    release_candidate_sandbox_command_name: RELEASE_CANDIDATE_SANDBOX_COMMAND_NAME,
    source_client_output_gate_ref: clientOutputGate.zendd_client_output_gate_id,
    source_client_output_gate_status: clientOutputGate.summary.zendd_client_output_gate_status,
    source_release_candidate_sandbox_ref: releaseCandidateSandbox.zendd_release_candidate_sandbox_id,
    source_release_candidate_sandbox_status: releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    workflow_adapter_rows_hash: hashRows(adapterRows, ["workflow_adapter_ref", "claim_id", "current_verdict"]),
    source_span_rows_hash: hashRows(sourceSpanRows, ["source_span_ref", "claim_id", "raw_source_text_present"]),
    quality_privilege_rows_hash: hashRows(qualityPrivilegeRows, ["claim_id", "quality_gate_passed", "privilege_gate_passed"]),
    operator_surface_rows_hash: hashRows(operatorRows, ["claim_id", "current_verdict", "next_allowed_action"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "workflow_adapter_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, clientOutputGate, releaseCandidateSandbox, policy, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p901_client_output_gate_ready", "P901", clientOutputGate.validation.valid && clientOutputGate.summary.zendd_client_output_gate_status === CLIENT_OUTPUT_GATE_READY_STATUS, "P641-P660 client output gate is ready.", "repair Zendd client output gate"),
    gateRow("p902_release_sandbox_ready", "P902", releaseCandidateSandbox.validation.valid && releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox", "P881-P900 release candidate sandbox is ready.", "repair release candidate sandbox"),
    gateRow("p903_policy_reference_only", "P903", policy.workflow_surface_creation_allowed && noWorkflowMutation(policy) && noRawMaterial(policy), "Workflow adapter policy is reference-only and no-mutation.", "restore workflow adapter policy"),
    gateRow("p904_workflow_adapter_rows", "P904-P908", adapterRows.length >= 6 && adapterRows.every(documentedWorkflowAdapter), "VDR/LDD workflow adapter rows are blocked and fully referenced.", "complete workflow adapter rows"),
    gateRow("p909_source_span_mapping", "P909-P911", sourceSpanRows.length === adapterRows.length && sourceSpanRows.every(documentedSourceSpanMapping), "Source span mapping preserves citations through redacted refs only.", "complete source span mapping rows"),
    gateRow("p912_quality_privilege_gates", "P912-P915", qualityPrivilegeRows.length === adapterRows.length && qualityPrivilegeRows.every(documentedQualityPrivilegeGate), "Quality, citation, conflict, privilege, and receipt gates are blocked pending evidence.", "complete quality and privilege gate rows"),
    gateRow("p916_operator_surface", "P916-P918", operatorRows.length === adapterRows.length && operatorRows.every(documentedOperatorSurface), "Operator rows expose verdict, missing evidence, missing receipt, block reason, owner, and next action.", "complete operator surface rows"),
    gateRow("p919_fail_closed", "P919", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove no raw copy, no mutation, no client delivery, and no automatic legal PASS.", "complete fail-closed fixtures"),
    gateRow("p920_closeout_ready", "P920", closeoutRows.every((row) => row.closeout_status === READY_STATUS && row.workflow_adapter_ready), "P901-P920 closes with VDR/LDD workflow adapter ready.", "complete workflow adapter closeout"),
    gateRow("package_script_registered", "P920", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P920", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P920", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P901-P920") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P901-P920.", "record P901-P920 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "vdr_ldd_workflow_adapter_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_mutation", "workflow_boundary", noWorkflowMutation(policy), "Workflow policy keeps mutation, delivery, receipt application, and publish disabled."));
  items.push(validationItem("policy.no_raw_material", "workflow_boundary", noRawMaterial(policy), "Workflow policy forbids raw VDR/client/fact/OCR/secret exposure."));
  items.push(validationItem("workflow_rows.documented_block", "workflow_boundary", adapterRows.every(documentedWorkflowAdapter), "Workflow adapter rows are documented blocks."));
  items.push(validationItem("source_span.redacted_only", "source_span_boundary", sourceSpanRows.every(documentedSourceSpanMapping), "Source span rows are redacted refs only."));
  items.push(validationItem("quality_privilege.blocked", "quality_privilege_boundary", qualityPrivilegeRows.every(documentedQualityPrivilegeGate), "Quality and privilege rows are blocked pending review."));
  items.push(validationItem("operator_surface.next_action", "operator_surface_boundary", operatorRows.every(documentedOperatorSurface), "Operator rows include next allowed action."));
  items.push(validationItem("fail_closed.pass", "workflow_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS), "Closeout is ready without mutation."));
  return items;
}

function buildSummary({ clientOutputGate, releaseCandidateSandbox, adapterRows, sourceSpanRows, qualityPrivilegeRows, operatorRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_vdr_ldd_workflow_adapter_status: validation.valid ? READY_STATUS : "documented_block_pending_vdr_ldd_workflow_adapter",
    source_client_output_gate_status: clientOutputGate.summary.zendd_client_output_gate_status,
    source_release_candidate_sandbox_status: releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
    vdr_ldd_workflow_adapter_count: adapterRows.length,
    vdr_ldd_source_span_mapping_count: sourceSpanRows.length,
    vdr_ldd_quality_privilege_gate_count: qualityPrivilegeRows.length,
    vdr_ldd_operator_claim_surface_count: operatorRows.length,
    vdr_ldd_workflow_fail_closed_count: failClosedRows.length,
    vdr_ldd_workflow_closeout_ready: closeoutRows.every((row) => row.workflow_adapter_ready),
    automatic_legal_pass_allowed: false,
    vdr_source_mutation_allowed_now: false,
    ldd_workflow_mutation_allowed_now: false,
    client_output_generation_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_application_allowed_now: false,
    release_candidate_publish_allowed_now: false,
    raw_vdr_material_copy_allowed_in_hermes: false,
    raw_client_document_copy_allowed_in_hermes: false,
    raw_fact_text_storage_allowed_in_hermes: false,
    raw_ocr_text_storage_allowed_in_hermes: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedWorkflowAdapter(row) {
  return row.current_verdict === "blocked"
    && row.source_span_preserved === true
    && row.citation_gate_preserved === true
    && row.quality_gate_preserved === true
    && row.conflict_gate_preserved === true
    && row.privilege_gate_preserved === true
    && row.human_review_gate_preserved === true
    && noWorkflowMutation(row)
    && noRawMaterial(row)
    && Boolean(row.workflow_adapter_ref)
    && Boolean(row.claim_id)
    && Boolean(row.source_trace_ref)
    && Boolean(row.fact_claim_ref)
    && Boolean(row.issue_ref)
    && Boolean(row.citation_ref)
    && Boolean(row.redacted_summary_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && documentedBlock(row);
}

function documentedSourceSpanMapping(row) {
  return row.current_verdict === "blocked"
    && row.raw_source_text_present === false
    && row.citation_required === true
    && row.source_span_required === true
    && noRawMaterial(row)
    && Boolean(row.source_trace_ref)
    && Boolean(row.source_span_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.redacted_summary_ref)
    && documentedBlock(row);
}

function documentedQualityPrivilegeGate(row) {
  return row.current_verdict === "blocked"
    && row.quality_gate_passed === false
    && row.citation_gate_passed === false
    && row.conflict_gate_passed === false
    && row.privilege_gate_passed === false
    && row.human_receipt_payload_present === false
    && noWorkflowMutation(row)
    && noRawMaterial(row)
    && Boolean(row.quality_gate_ref)
    && Boolean(row.citation_gate_ref)
    && Boolean(row.conflict_gate_ref)
    && Boolean(row.privilege_gate_ref)
    && Boolean(row.human_receipt_ref)
    && documentedBlock(row);
}

function documentedOperatorSurface(row) {
  return row.current_verdict === "blocked"
    && Array.isArray(row.missing_evidence)
    && row.missing_evidence.length >= 4
    && Array.isArray(row.missing_reviewer_or_receipt)
    && row.missing_reviewer_or_receipt.includes("validated_human_receipt")
    && Boolean(row.workflow_adapter_ref)
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function documentedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function noWorkflowMutation(row) {
  return row.vdr_source_mutation_allowed_now !== true
    && row.ldd_workflow_mutation_allowed_now !== true
    && row.client_output_generation_allowed_now !== true
    && row.client_delivery_allowed_now !== true
    && row.receipt_application_allowed_now !== true
    && row.release_candidate_publish_allowed_now !== true
    && row.legal_advice_or_filing_decision_allowed_now !== true;
}

function noRawMaterial(row) {
  return row.raw_vdr_material_copy_allowed_in_hermes !== true
    && row.raw_client_document_copy_allowed_in_hermes !== true
    && row.raw_fact_text_storage_allowed_in_hermes !== true
    && row.raw_ocr_text_storage_allowed_in_hermes !== true
    && row.secret_read_allowed_now !== true;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const groupKey = row[key];
    const values = map.get(groupKey) ?? [];
    values.push(row);
    map.set(groupKey, values);
  }
  return map;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-vdr-ldd-workflow-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_vdr_ldd_workflow_adapter_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_VDR_LDD_WORKFLOW_ADAPTER_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P901-P920 Zendd VDR/LDD workflow adapter. --check validates
without mutating Zendd, generating client output, delivering client material,
applying receipts, publishing release candidates, copying raw VDR/client/fact
material, reading secrets, or granting automatic legal PASS.
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd VDR/LDD Workflow Adapter Summary",
    "",
    `- Status: ${summary.zendd_vdr_ldd_workflow_adapter_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Workflow adapter rows: ${summary.vdr_ldd_workflow_adapter_count}`,
    `- Source span mappings: ${summary.vdr_ldd_source_span_mapping_count}`,
    `- Quality/privilege gates: ${summary.vdr_ldd_quality_privilege_gate_count}`,
    `- Operator claim surfaces: ${summary.vdr_ldd_operator_claim_surface_count}`,
    `- Automatic legal PASS allowed: ${summary.automatic_legal_pass_allowed}`,
    `- Raw VDR material copy allowed: ${summary.raw_vdr_material_copy_allowed_in_hermes}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
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

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}
