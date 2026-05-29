import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ERP_DRAFT_CONNECTOR_OUT_DIR = "artifacts/erp-draft-connector/latest";
export const DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  plaudTranscriptConnectorPath: "artifacts/plaud-transcript-connector/latest/plaud-transcript-connector.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  erpInputs: ["examples/erp-draft-connector"],
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.erp_draft.v2";
const CONNECTOR_PHASE = "P275";
const DEFAULT_TENANT_ID = "tenant.hermes.erp.demo";
const DEFAULT_MATTER_ID = "MNA-2026-ALPHA";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.erp_draft.default.v1";

export async function runErpDraftConnector(options = {}) {
  const result = await buildErpDraftConnector(options);
  if (options.write !== false) await writeErpDraftConnector(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.erp_draft_connector_status !== "complete")) {
    const error = new Error(`ERP draft connector validation failed with ${result.validation.errors.length} error(s); status=${result.summary.erp_draft_connector_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildErpDraftConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ERP_DRAFT_CONNECTOR_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.connectorContractV2Path);
  const plaudTranscriptConnectorPath = path.resolve(options.plaudTranscriptConnectorPath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.plaudTranscriptConnectorPath);
  const outputDeliveryContractFreezePath = path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.outputDeliveryContractFreezePath);
  const erpInputs = normalizeInputPaths(options.erpInputs ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.erpInputs);
  const connectorContract = await readJson(connectorContractPath);
  const plaudTranscriptConnector = await readJson(plaudTranscriptConnectorPath);
  const outputDeliveryContractFreeze = await readJson(outputDeliveryContractFreezePath);
  const erpContract = pickErpConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? erpContract.source_contract?.source_id ?? "source.erp_draft.v2";
  const sourceItems = await readErpInputs(erpInputs, {
    generatedAt,
    tenantId: options.tenantId,
    matterId: options.matterId,
    policySnapshotId: options.policySnapshotId,
  });
  const accountRecords = buildAccountRecords(sourceItems, { sourceId, generatedAt });
  const draftRecords = buildDraftRecords(sourceItems, accountRecords, { sourceId, generatedAt });
  const lineItemRecords = buildLineItemRecords(sourceItems, draftRecords, { generatedAt });
  const draftOutputRecords = buildDraftOutputRecords(draftRecords, lineItemRecords, { generatedAt });
  const approvalHoldRecords = buildApprovalHoldRecords(draftRecords, draftOutputRecords, { generatedAt });
  const connectorContractBinding = buildConnectorContractBinding(erpContract, connectorContract, sourceId);
  const sourceBinding = buildSourceBinding(erpContract, { sourceId, erpInputs, accountRecords, draftRecords, generatedAt });
  const authBoundary = buildAuthBoundary(erpContract.auth_boundary, generatedAt);
  const cursorState = buildCursorState(erpContract.cursor_contract, draftRecords, { generatedAt, sourceId, accountRecords });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateErpDraftConnector({
    connectorContract,
    plaudTranscriptConnector,
    outputDeliveryContractFreeze,
    erpContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    accountRecords,
    draftRecords,
    lineItemRecords,
    draftOutputRecords,
    approvalHoldRecords,
    cursorState,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeErpDraftConnector({
    plaudTranscriptConnector,
    outputDeliveryContractFreeze,
    authBoundary,
    accountRecords,
    draftRecords,
    lineItemRecords,
    draftOutputRecords,
    approvalHoldRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "erp-draft-connector.v1",
    generated_at: generatedAt,
    erp_draft_connector_id: `erp-draft-connector.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.erp_draft_connector_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      plaud_transcript_connector_path: plaudTranscriptConnectorPath,
      output_delivery_contract_freeze_path: outputDeliveryContractFreezePath,
      erp_inputs: erpInputs,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    erp_account_records: accountRecords,
    erp_draft_records: draftRecords,
    erp_line_item_records: lineItemRecords,
    erp_draft_output_records: draftOutputRecords,
    erp_approval_hold_records: approvalHoldRecords,
    cursor_state: cursorState,
    erp_connector_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderErpDraftConnectorMarkdown(result) };
}

export async function writeErpDraftConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "erp-draft-connector.json"), serializableErpDraftConnector(result));
  await writeJson(path.join(outDir, "erp-account-records.json"), { generated_at: result.generated_at, account_record_count: result.erp_account_records.length, erp_account_records: result.erp_account_records });
  await writeJson(path.join(outDir, "erp-draft-records.json"), { generated_at: result.generated_at, draft_record_count: result.erp_draft_records.length, erp_draft_records: result.erp_draft_records });
  await writeJson(path.join(outDir, "erp-line-item-records.json"), { generated_at: result.generated_at, line_item_record_count: result.erp_line_item_records.length, erp_line_item_records: result.erp_line_item_records });
  await writeJson(path.join(outDir, "erp-draft-output-records.json"), { generated_at: result.generated_at, draft_output_record_count: result.erp_draft_output_records.length, erp_draft_output_records: result.erp_draft_output_records });
  await writeJson(path.join(outDir, "erp-approval-hold-records.json"), { generated_at: result.generated_at, approval_hold_record_count: result.erp_approval_hold_records.length, erp_approval_hold_records: result.erp_approval_hold_records });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), { generated_at: result.generated_at, erp_draft_connector_id: result.erp_draft_connector_id, validation: result.validation, validation_items: result.validation_items });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runErpDraftConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runErpDraftConnector(args);
    console.log(`ERP draft connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.erp_draft_connector_status}`);
    console.log(`Accounts: ${result.summary.account_count}`);
    console.log(`Drafts: ${result.summary.draft_count}`);
    console.log(`Line items: ${result.summary.line_item_count}`);
    console.log(`Draft outputs: ${result.summary.draft_output_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function pickErpConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(erpContract, connectorContract, sourceId) {
  return {
    schema_version: "connector-contract-binding.v1",
    binding_status: erpContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "erp",
    connector_family: "erp_draft",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: erpContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: erpContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: erpContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: erpContract.auth_boundary?.auth_boundary_status ?? "unknown",
  };
}

function buildSourceBinding(erpContract, { sourceId, erpInputs, accountRecords, draftRecords, generatedAt }) {
  return {
    schema_version: "connector-source-binding.v1",
    source_binding_status: erpContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "erp",
    source_kind: "billing_draft",
    source_mode: "operator_provided_erp_draft_export",
    source_paths: erpInputs,
    account_count: accountRecords.length,
    draft_count: draftRecords.length,
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    generated_at: generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "erp-draft-auth-boundary.v1",
    auth_boundary_status: ["contracted", "enforced"].includes(authContract?.auth_boundary_status) ? "enforced" : "attention",
    connector_id: CONNECTOR_ID,
    auth_mode: authContract?.auth_mode ?? "service_account_draft_hold",
    credential_ref_required: true,
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["billing.draft.read", "billing.draft.prepare"],
    external_network_access_required_for_runtime: true,
    external_network_access_performed: false,
    erp_api_execution_performed: false,
    local_export_read_performed: true,
    connector_execution_performed: true,
    read_operations_allowed: true,
    draft_output_allowed: true,
    final_output_allowed: false,
    write_operations_allowed: false,
    protected_action_allowed: false,
    delivery_execution_allowed: false,
    generated_at: generatedAt,
  };
}

async function readErpInputs(inputPaths, context) {
  const files = [];
  for (const inputPath of inputPaths) {
    const stats = await stat(inputPath);
    if (stats.isDirectory()) {
      for (const name of (await readdir(inputPath)).filter((item) => item.endsWith(".json")).sort()) files.push(path.join(inputPath, name));
    } else {
      files.push(inputPath);
    }
  }
  const items = [];
  for (const file of files) items.push(normalizeErpExport(await readJson(file), file, context));
  return items;
}

function normalizeErpExport(value, sourcePath, context) {
  const matterId = value.matter_id ?? context.matterId ?? DEFAULT_MATTER_ID;
  return {
    source_path: sourcePath,
    tenant_id: value.tenant_id ?? context.tenantId ?? DEFAULT_TENANT_ID,
    matter_id: matterId,
    policy_snapshot_id: value.policy_snapshot_id ?? context.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID,
    classification: value.classification ?? "restricted",
    erp_account_id: String(value.erp_account_id ?? `erp-account.${matterId.toLowerCase()}`),
    account_name: value.account_name ?? "Project Alpha billing account",
    client_id: value.client_id ?? "client.alpha",
    client_name: value.client_name ?? "Alpha Buyer LLC",
    currency: value.currency ?? "USD",
    drafts: (Array.isArray(value.drafts) ? value.drafts : []).map((draft, index) => ({
      draft_id: String(draft.draft_id ?? `draft-${index + 1}`),
      draft_revision: String(draft.draft_revision ?? draft.revision ?? "rev-001"),
      draft_kind: draft.draft_kind ?? draft.kind ?? "invoice",
      title: draft.title ?? `ERP draft ${index + 1}`,
      description: draft.description ?? "",
      issue_date: draft.issue_date ?? "2026-05-29",
      due_date: draft.due_date ?? null,
      subtotal: Number(draft.subtotal ?? 0),
      tax: Number(draft.tax ?? 0),
      total: Number(draft.total ?? Number(draft.subtotal ?? 0) + Number(draft.tax ?? 0)),
      line_items: Array.isArray(draft.line_items) ? draft.line_items : [],
    })),
  };
}

function buildAccountRecords(sourceItems, { sourceId, generatedAt }) {
  return sourceItems.map((item) => ({
    schema_version: "erp-account-record.v1",
    erp_account_record_id: stableId("erp-account", item.erp_account_id),
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "erp",
    source_kind: "billing_draft",
    tenant_id: item.tenant_id,
    matter_id: item.matter_id,
    policy_snapshot_id: item.policy_snapshot_id,
    classification: item.classification,
    erp_account_id: item.erp_account_id,
    account_name: item.account_name,
    client_id: item.client_id,
    client_name: item.client_name,
    currency: item.currency,
    source_path: item.source_path,
    account_status: "metadata_export_ready",
    review_status: "needs_review",
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildDraftRecords(sourceItems, accountRecords, { sourceId, generatedAt }) {
  const accountByMatter = new Map(accountRecords.map((account) => [account.matter_id, account]));
  return sourceItems.flatMap((item) => item.drafts.map((draft, index) => {
    const account = accountByMatter.get(item.matter_id);
    const externalId = `erp:${item.erp_account_id}:${draft.draft_id}:${draft.draft_revision}`;
    const externalVersionId = sha256(JSON.stringify(draft));
    return {
      schema_version: "erp-draft-record.v1",
      erp_draft_record_id: stableId("erp-draft", externalId),
      erp_account_record_id: account?.erp_account_record_id ?? null,
      connector_id: CONNECTOR_ID,
      source_id: sourceId,
      source_system: "erp",
      source_kind: "billing_draft",
      tenant_id: item.tenant_id,
      matter_id: item.matter_id,
      policy_snapshot_id: item.policy_snapshot_id,
      classification: item.classification,
      erp_account_id: item.erp_account_id,
      draft_id: draft.draft_id,
      draft_revision: draft.draft_revision,
      draft_sequence: index + 1,
      draft_kind: draft.draft_kind,
      draft_subtype: draft.draft_kind === "tax_invoice" ? "tax_invoice" : draft.draft_kind,
      title: draft.title,
      description: draft.description,
      issue_date: draft.issue_date,
      due_date: draft.due_date,
      currency: item.currency,
      subtotal: draft.subtotal,
      tax: draft.tax,
      total: draft.total,
      line_item_count: draft.line_items.length,
      external_id: externalId,
      external_version_id: externalVersionId,
      resource_id: stableId("resource.erp_draft", externalId),
      resource_version_id: stableId("resource-version.erp_draft", externalVersionId),
      resource_type: draft.draft_kind === "estimate" ? "estimate_draft" : "invoice_draft",
      draft_status: "draft_output_ready",
      erp_resource_status: "ready",
      draft_output_status: "draft_only",
      final_output_allowed: false,
      issue_allowed: false,
      issue_performed: false,
      metadata_complete: true,
      review_status: "needs_review",
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      generated_at: generatedAt,
    };
  }));
}

function buildLineItemRecords(sourceItems, draftRecords, { generatedAt }) {
  const draftsByExternal = new Map(draftRecords.map((draft) => [`${draft.erp_account_id}:${draft.draft_id}:${draft.draft_revision}`, draft]));
  return sourceItems.flatMap((item) => item.drafts.flatMap((draft) => draft.line_items.map((line, index) => {
    const draftRecord = draftsByExternal.get(`${item.erp_account_id}:${draft.draft_id}:${draft.draft_revision}`);
    const quantity = Number(line.quantity ?? 1);
    const unitAmount = Number(line.unit_amount ?? line.unitAmount ?? 0);
    const amount = Number(line.amount ?? quantity * unitAmount);
    return {
      schema_version: "erp-line-item-record.v1",
      erp_line_item_record_id: stableId("erp-line-item", draftRecord?.erp_draft_record_id, index),
      erp_draft_record_id: draftRecord?.erp_draft_record_id ?? null,
      connector_id: CONNECTOR_ID,
      tenant_id: item.tenant_id,
      matter_id: item.matter_id,
      draft_id: draft.draft_id,
      line_item_id: String(line.line_item_id ?? line.id ?? `line-${index + 1}`),
      description: line.description ?? `Line item ${index + 1}`,
      quantity,
      unit_amount: unitAmount,
      amount,
      currency: item.currency,
      line_item_status: "draft_line_ready",
      review_status: "needs_review",
      human_review_required: true,
      generated_at: generatedAt,
    };
  })));
}

function buildDraftOutputRecords(draftRecords, lineItemRecords, { generatedAt }) {
  const linesByDraft = groupBy(lineItemRecords, "erp_draft_record_id");
  return draftRecords.map((draft) => ({
    schema_version: "erp-draft-output-record.v1",
    erp_draft_output_record_id: stableId("erp-draft-output", draft.erp_draft_record_id),
    erp_draft_record_id: draft.erp_draft_record_id,
    connector_id: CONNECTOR_ID,
    tenant_id: draft.tenant_id,
    matter_id: draft.matter_id,
    draft_id: draft.draft_id,
    draft_kind: draft.draft_kind,
    artifact_type: "erp_billing_draft",
    output_title: draft.title,
    draft_output_status: "blocked_pending_human_review",
    draft_only_output_generated: true,
    final_output_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    erp_issue_performed: false,
    output_hash: sha256(JSON.stringify({ draft, line_items: linesByDraft.get(draft.erp_draft_record_id) ?? [] })),
    review_status: "needs_review",
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildApprovalHoldRecords(draftRecords, draftOutputRecords, { generatedAt }) {
  const outputByDraft = new Map(draftOutputRecords.map((record) => [record.erp_draft_record_id, record]));
  return draftRecords.map((draft) => ({
    schema_version: "erp-approval-hold-record.v1",
    erp_approval_hold_record_id: stableId("erp-approval-hold", draft.erp_draft_record_id),
    erp_draft_record_id: draft.erp_draft_record_id,
    erp_draft_output_record_id: outputByDraft.get(draft.erp_draft_record_id)?.erp_draft_output_record_id ?? null,
    connector_id: CONNECTOR_ID,
    tenant_id: draft.tenant_id,
    matter_id: draft.matter_id,
    draft_id: draft.draft_id,
    destination_tool_id: "erp.billing.issue",
    approval_hold_status: "held_for_human_review",
    final_action_blocked: true,
    protected_action_allowed: false,
    erp_issue_performed: false,
    legal_review_required: true,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildCursorState(cursorContract, draftRecords, { generatedAt, sourceId, accountRecords }) {
  const lastDraft = [...draftRecords].sort((a, b) => a.draft_sequence - b.draft_sequence).at(-1) ?? null;
  const lastAccount = accountRecords.at(-1) ?? null;
  const cursorPosition = lastDraft ? `${lastDraft.erp_account_id}:${lastDraft.draft_sequence}` : "empty";
  return {
    schema_version: "erp-draft-cursor-state.v1",
    cursor_status: cursorContract?.cursor_contract_status === "contracted" ? "complete" : "attention",
    cursor_kind: cursorContract?.cursor_kind ?? "draft_sequence_cursor",
    cursor_id: cursorContract?.cursor_id ?? "cursor.erp_draft.v2",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    tenant_id: lastAccount?.tenant_id ?? DEFAULT_TENANT_ID,
    matter_id: lastAccount?.matter_id ?? DEFAULT_MATTER_ID,
    cursor_position: cursorPosition,
    last_seen_external_id: lastDraft?.external_id ?? null,
    last_seen_at: lastDraft?.generated_at ?? generatedAt,
    high_watermark: lastDraft?.draft_sequence ?? 0,
    resume_supported: cursorContract?.resume_supported ?? true,
    reset_requires_human_review: true,
    raw_draft_sequence_cursor_material_allowed: false,
    resume_token_hash: sha256(cursorPosition),
    updated_at: generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "erp-draft-boundary.v1",
    boundary_status: "enforced",
    connector_id: CONNECTOR_ID,
    local_export_read_performed: true,
    erp_api_execution_performed: false,
    external_network_access_performed: false,
    connector_execution_performed: true,
    source_read_performed: true,
    credential_material_read: false,
    draft_output_generated: true,
    final_output_generated: false,
    erp_issue_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    billing_mutation_performed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    output_delivery_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    generated_at: generatedAt,
  };
}

function validateErpDraftConnector(input) {
  const { connectorContract, plaudTranscriptConnector, outputDeliveryContractFreeze, erpContract, connectorContractBinding, sourceBinding, authBoundary, accountRecords, draftRecords, lineItemRecords, draftOutputRecords, approvalHoldRecords, cursorState, boundary, docsAndCode } = input;
  const items = [];
  const pushCheck = (pathId, passed, message) => items.push({ path: pathId, check_id: pathId, status: passed ? "passed" : "failed", message });
  pushCheck("connector.contract.present", connectorContract?.summary?.connector_contract_status === "complete", "Connector Contract v2 is complete.");
  pushCheck("connector.definition.bound", erpContract.definition?.connector_id === CONNECTOR_ID && connectorContractBinding.binding_status === "bound", "ERP draft connector contract is bound.");
  pushCheck("source.plaud.complete", plaudTranscriptConnector?.summary?.plaud_transcript_connector_status === "complete", "P274 Plaud Transcript Connector baseline is complete.");
  pushCheck("source.output_delivery.complete", outputDeliveryContractFreeze?.summary?.freeze_status === "complete", "Output Delivery Contract Freeze source is complete.");
  pushCheck("source.binding.bound", sourceBinding.source_binding_status === "bound", "ERP draft source binding is bound.");
  pushCheck("accounts.present", accountRecords.length > 0 && accountRecords.every((record) => record.account_status === "metadata_export_ready" && record.human_review_required), "ERP account metadata is represented.");
  pushCheck("drafts.present", draftRecords.length > 0 && draftRecords.every((record) => record.draft_status === "draft_output_ready" && record.draft_output_status === "draft_only" && record.issue_allowed === false && record.issue_performed === false), "ERP drafts are draft-only resource candidates.");
  pushCheck("draft.kinds.covered", draftRecords.some((record) => record.draft_kind === "estimate") && draftRecords.some((record) => record.draft_kind === "invoice") && draftRecords.some((record) => record.draft_kind === "tax_invoice"), "Estimate, invoice, and tax invoice drafts are represented.");
  pushCheck("line_items.linked", lineItemRecords.length > 0 && lineItemRecords.every((record) => record.erp_draft_record_id && record.line_item_status === "draft_line_ready"), "ERP draft line items are linked.");
  pushCheck("draft_outputs.match", draftOutputRecords.length === draftRecords.length && draftOutputRecords.every((record) => record.draft_only_output_generated && record.final_output_allowed === false && record.delivery_execution_allowed === false), "Every ERP draft has a blocked draft-only output.");
  pushCheck("approval_holds.match", approvalHoldRecords.length === draftRecords.length && approvalHoldRecords.every((record) => record.approval_hold_status === "held_for_human_review" && record.final_action_blocked && record.erp_issue_performed === false), "Every ERP draft is held for human review before issue.");
  pushCheck("cursor.hash_only", cursorState.cursor_status === "complete" && cursorState.resume_supported === true && cursorState.raw_draft_sequence_cursor_material_allowed === false, "ERP draft cursor is resumable and hash-only.");
  pushCheck("auth.boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.credential_ref_required === true && authBoundary.credential_reference_only === true && authBoundary.raw_secret_material_allowed === false && authBoundary.draft_output_allowed === true && authBoundary.final_output_allowed === false && authBoundary.write_operations_allowed === false, "ERP auth boundary is draft-hold and credential-reference-only.");
  pushCheck("no.live.erp", authBoundary.erp_api_execution_performed === false && authBoundary.external_network_access_performed === false && boundary.erp_api_execution_performed === false, "No live ERP API or network execution is performed.");
  pushCheck("no.issue.or.delivery", boundary.erp_issue_performed === false && boundary.output_delivery_performed === false && boundary.protected_action_executed === false, "No ERP issue, delivery, or protected action is performed.");
  pushCheck("no.mutation", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.billing_mutation_performed === false, "No source, resource, or billing mutation is performed.");
  pushCheck("no.legal.client", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false, "No legal advice or client-facing output is generated.");
  pushCheck("package.script", docsAndCode.package_text.includes("\"connectors:erp-draft\""), "package.json exposes connectors:erp-draft.");
  pushCheck("roadmap.phase", docsAndCode.roadmap_text.includes("Phase 275") && docsAndCode.roadmap_text.includes("ERP Draft Connector"), "Roadmap documents Phase 275 ERP Draft Connector.");
  pushCheck("ledger.slot", docsAndCode.final_ledger_text.includes("| P275 |") && docsAndCode.final_ledger_text.includes("ERP draft connector"), "Final ledger tracks P275 ERP draft connector.");
  pushCheck("loop.step", docsAndCode.control_plane_loop_text.includes("erp_draft_connector") && docsAndCode.control_plane_loop_text.includes("connectors:erp-draft"), "Control plane loop includes ERP draft connector.");
  pushCheck("dashboard.source", docsAndCode.review_dashboard_text.includes("erp_draft_connector"), "Review dashboard includes ERP draft connector.");
  pushCheck("api.routes", docsAndCode.review_api_text.includes("/api/erp-draft-connector"), "Review API exposes ERP draft connector routes.");
  return items;
}

function summarizeErpDraftConnector(input) {
  const { plaudTranscriptConnector, outputDeliveryContractFreeze, authBoundary, accountRecords, draftRecords, lineItemRecords, draftOutputRecords, approvalHoldRecords, cursorState, boundary, validation, sourceId } = input;
  return {
    erp_draft_connector_status: validation.valid ? "complete" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_plaud_transcript_connector_status: plaudTranscriptConnector?.summary?.plaud_transcript_connector_status ?? "unknown",
    source_output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "unknown",
    account_count: accountRecords.length,
    draft_count: draftRecords.length,
    estimate_draft_count: draftRecords.filter((record) => record.draft_kind === "estimate").length,
    invoice_draft_count: draftRecords.filter((record) => record.draft_kind === "invoice").length,
    tax_invoice_draft_count: draftRecords.filter((record) => record.draft_kind === "tax_invoice").length,
    line_item_count: lineItemRecords.length,
    draft_output_count: draftOutputRecords.length,
    approval_hold_count: approvalHoldRecords.length,
    resource_candidate_count: draftRecords.length,
    line_item_link_count: lineItemRecords.filter((record) => record.erp_draft_record_id).length,
    draft_only_output_count: draftOutputRecords.filter((record) => record.draft_only_output_generated).length,
    final_output_allowed_count: draftOutputRecords.filter((record) => record.final_output_allowed).length,
    ready_to_issue_count: approvalHoldRecords.filter((record) => record.final_action_blocked === false).length,
    blocked_final_action_count: approvalHoldRecords.filter((record) => record.final_action_blocked).length,
    metadata_complete_draft_count: draftRecords.filter((record) => record.metadata_complete).length,
    cursor_status: cursorState.cursor_status,
    cursor_kind: cursorState.cursor_kind,
    cursor_resume_supported: cursorState.resume_supported,
    raw_draft_sequence_cursor_material_allowed: cursorState.raw_draft_sequence_cursor_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    auth_mode: authBoundary.auth_mode,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    read_operations_allowed: authBoundary.read_operations_allowed,
    draft_output_allowed: authBoundary.draft_output_allowed,
    final_output_allowed: authBoundary.final_output_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    local_export_read_performed: boundary.local_export_read_performed,
    erp_api_execution_performed: boundary.erp_api_execution_performed,
    external_network_access_performed: boundary.external_network_access_performed,
    connector_execution_performed: boundary.connector_execution_performed,
    source_read_performed: boundary.source_read_performed,
    credential_material_read: boundary.credential_material_read,
    draft_output_generated: boundary.draft_output_generated,
    final_output_generated: boundary.final_output_generated,
    erp_issue_performed: boundary.erp_issue_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    billing_mutation_performed: boundary.billing_mutation_performed,
    matter_data_write_allowed: boundary.matter_data_write_allowed,
    task_state_write_allowed: boundary.task_state_write_allowed,
    workflow_transition_allowed: boundary.workflow_transition_allowed,
    output_delivery_performed: boundary.output_delivery_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required_count: [...draftRecords, ...draftOutputRecords].filter((record) => record.human_review_required).length,
    approval_hold_human_review_required_count: approvalHoldRecords.filter((record) => record.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed");
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors, items };
}

function serializableErpDraftConnector(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderErpDraftConnectorMarkdown(result) {
  const { summary } = result;
  return [
    "# ERP Draft Connector",
    "",
    `Status: ${summary.erp_draft_connector_status}`,
    `Connector: ${summary.connector_id}`,
    `Accounts: ${summary.account_count}`,
    `Drafts: ${summary.draft_count}`,
    `Line items: ${summary.line_item_count}`,
    `Draft outputs: ${summary.draft_output_count}`,
    `Approval holds: ${summary.approval_hold_count}`,
    `Validation errors: ${summary.validation_error_count}`,
    "",
    "All estimate, invoice, and tax invoice drafts are internal draft-only outputs held for human review. The connector performs no live ERP API calls, network access, credential material reads, ERP issue action, delivery, protected action, legal advice, or client-facing output.",
    "",
  ].join("\n");
}

async function readDocsAndCode(options) {
  const packagePath = path.resolve(options.packagePath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.packagePath);
  const roadmapPath = path.resolve(options.roadmapPath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.roadmapPath);
  const finalLedgerPath = path.resolve(options.finalLedgerPath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.finalLedgerPath);
  const controlPlaneLoopPath = path.resolve(options.controlPlaneLoopPath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.controlPlaneLoopPath);
  const reviewDashboardPath = path.resolve(options.reviewDashboardPath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.reviewDashboardPath);
  const reviewApiPath = path.resolve(options.reviewApiPath ?? DEFAULT_ERP_DRAFT_CONNECTOR_INPUTS.reviewApiPath);
  const [packageText, roadmapText, finalLedgerText, controlPlaneLoopText, reviewDashboardText, reviewApiText] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(roadmapPath, "utf8"),
    readFile(finalLedgerPath, "utf8"),
    readFile(controlPlaneLoopPath, "utf8"),
    readFile(reviewDashboardPath, "utf8"),
    readFile(reviewApiPath, "utf8"),
  ]);
  return { package_text: packageText, roadmap_text: roadmapText, final_ledger_text: finalLedgerText, control_plane_loop_text: controlPlaneLoopText, review_dashboard_text: reviewDashboardText, review_api_text: reviewApiText };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") args.connectorContractV2Path = argv[++index];
    else if (arg === "--plaud-transcript-connector") args.plaudTranscriptConnectorPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") args.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--erp-input") args.erpInputs = [...(args.erpInputs ?? []), argv[++index]];
    else if (arg === "--run-at") args.runAt = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log("Usage: node scripts/erp-draft-connector.mjs [--check] [--erp-input path] [--out-dir path]\n\nWrites the Phase 275 ERP draft connector artifact.");
}

function normalizeInputPaths(values) {
  return (Array.isArray(values) ? values : [values]).filter(Boolean).map((value) => path.resolve(value));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const value = item[key];
    map.set(value, [...(map.get(value) ?? []), item]);
  }
  return map;
}

function stableId(prefix, ...parts) {
  return `${prefix}.${sha256(parts.join("|")).slice(7, 31)}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
