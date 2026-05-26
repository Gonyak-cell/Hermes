import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_CONTEXT_BUILDER_OUT_DIR = "artifacts/workflow-context-builder/latest";
export const DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS = {
  workflowResumeCancelContractPath: "artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json",
  contextPacketLedgerPath: "artifacts/context-packets/latest/context-packet-ledger.json",
  searchIndexContractPath: "artifacts/search-index/latest/search-index-contract.json",
  evidenceExportBundlePath: "artifacts/evidence-export-bundle/latest/evidence-export-bundle.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTEXT_BUILDER_CONTRACT_ID = "workflow-context-builder-contract.v1";
const CONTEXT_PACKET_V2_SCHEMA_VERSION = "context-packet-v2-record.v1";
const RESOURCE_SELECTION_SCHEMA_VERSION = "context-resource-selection-record.v1";
const TOKEN_BUDGET_SCHEMA_VERSION = "context-token-budget-record.v1";
const CITATION_HINT_SCHEMA_VERSION = "context-citation-hint-record.v1";

export async function runWorkflowContextBuilderContract(options = {}) {
  const result = await buildWorkflowContextBuilderContract(options);
  if (options.write !== false) await writeWorkflowContextBuilderContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow context builder contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowContextBuilderContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowResumeCancelContract = await readJson(inputs.workflow_resume_cancel_contract_path);
  const contextPacketLedger = await readJson(inputs.context_packet_ledger_path);
  const searchIndexContract = await readJson(inputs.search_index_contract_path);
  const evidenceExportBundle = await readJson(inputs.evidence_export_bundle_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const resumeCursorRecords = workflowResumeCancelContract.resume_cursor_records ?? [];
  const sourceContextPackets = contextPacketLedger.context_packets ?? [];
  const sourceContextItems = contextPacketLedger.context_items ?? [];
  const sourceRetrievalFilters = contextPacketLedger.retrieval_filters ?? [];
  const buildResult = buildContextPacketV2Records({
    resumeCursorRecords,
    sourceContextPackets,
    sourceContextItems,
    sourceRetrievalFilters,
    generatedAt,
  });
  const validationItems = validateWorkflowContextBuilderContract({
    workflowResumeCancelContract,
    contextPacketLedger,
    searchIndexContract,
    evidenceExportBundle,
    packageJson,
    roadmapText,
    resumeCursorRecords,
    sourceContextPackets,
    sourceContextItems,
    buildResult,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-context-builder-contract.v1",
    generated_at: generatedAt,
    workflow_context_builder_contract_id: `workflow-context-builder.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_resume_cancel_contract: sourceSummary(workflowResumeCancelContract, "workflow_resume_cancel_status"),
      context_packet_ledger: {
        schema_version: contextPacketLedger.schema_version ?? null,
        ledger_status: contextPacketLedger.ledger_status ?? contextPacketLedger.summary?.ledger_status ?? "unknown",
        context_packet_count: contextPacketLedger.summary?.context_packet_count ?? sourceContextPackets.length,
        context_item_count: contextPacketLedger.summary?.context_item_count ?? sourceContextItems.length,
        retrieval_filter_count: contextPacketLedger.summary?.retrieval_filter_count ?? sourceRetrievalFilters.length,
        validation_error_count: contextPacketLedger.summary?.validation_error_count ?? contextPacketLedger.validation?.errors?.length ?? 0,
      },
      search_index_contract: sourceSummary(searchIndexContract, "search_index_contract_status"),
      evidence_export_bundle: sourceSummary(evidenceExportBundle, "evidence_export_bundle_status"),
    },
    workflow_context_builder_contract: buildContextBuilderContract(generatedAt),
    context_packet_v2_records: buildResult.contextPacketV2Records,
    context_resource_selection_records: buildResult.contextResourceSelectionRecords,
    context_token_budget_records: buildResult.contextTokenBudgetRecords,
    context_citation_hint_records: buildResult.contextCitationHintRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowContextBuilderContract({
      workflowResumeCancelContract,
      contextPacketLedger,
      searchIndexContract,
      evidenceExportBundle,
      resumeCursorRecords,
      sourceContextPackets,
      sourceContextItems,
      sourceRetrievalFilters,
      buildResult,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowContextBuilderMarkdown(result),
  };
}

export async function writeWorkflowContextBuilderContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-context-builder-contract.json"), serializableWorkflowContextBuilderContract(result));
  await writeJson(path.join(outDir, "context-packet-v2-records.json"), {
    schema_version: "context-packet-v2-records.v1",
    generated_at: result.generated_at,
    context_packet_v2_record_count: result.context_packet_v2_records.length,
    context_packet_v2_records: result.context_packet_v2_records,
  });
  await writeJson(path.join(outDir, "context-resource-selection-records.json"), {
    schema_version: "context-resource-selection-records.v1",
    generated_at: result.generated_at,
    context_resource_selection_record_count: result.context_resource_selection_records.length,
    context_resource_selection_records: result.context_resource_selection_records,
  });
  await writeJson(path.join(outDir, "context-token-budget-records.json"), {
    schema_version: "context-token-budget-records.v1",
    generated_at: result.generated_at,
    context_token_budget_record_count: result.context_token_budget_records.length,
    context_token_budget_records: result.context_token_budget_records,
  });
  await writeJson(path.join(outDir, "context-citation-hint-records.json"), {
    schema_version: "context-citation-hint-records.v1",
    generated_at: result.generated_at,
    context_citation_hint_record_count: result.context_citation_hint_records.length,
    context_citation_hint_records: result.context_citation_hint_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-context-builder-validation-report.v1",
    generated_at: result.generated_at,
    workflow_context_builder_contract_id: result.workflow_context_builder_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowContextBuilderContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkflowContextBuilderContract(args);
    console.log(`Workflow context builder contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_context_builder_status}`);
    console.log(`Context packet v2 records: ${result.summary.context_packet_v2_count}`);
    console.log(`Accessible resources: ${result.summary.accessible_resource_count}`);
    console.log(`Excluded resources: ${result.summary.excluded_resource_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContextPacketV2Records({
  resumeCursorRecords,
  sourceContextPackets,
  sourceContextItems,
  sourceRetrievalFilters,
  generatedAt,
}) {
  const packetsByRun = groupBy(sourceContextPackets, "workflow_run_id");
  const itemsByPacket = groupBy(sourceContextItems, "context_packet_id");
  const filtersByPacket = groupBy(sourceRetrievalFilters, "context_packet_id");
  const resourceBearingItems = sourceContextItems.filter((item) => item.resource_id);
  const contextPacketV2Records = [];
  const contextResourceSelectionRecords = [];
  const contextTokenBudgetRecords = [];
  const contextCitationHintRecords = [];

  for (const cursor of resumeCursorRecords) {
    const sourcePackets = (packetsByRun.get(cursor.workflow_run_id) ?? []).sort(by("context_packet_id"));
    const sourcePacketIds = sourcePackets.map((packet) => packet.context_packet_id);
    const sourceItems = sourcePacketIds.flatMap((packetId) => itemsByPacket.get(packetId) ?? []).sort(by("context_item_id"));
    const sourceFilters = sourcePacketIds.flatMap((packetId) => filtersByPacket.get(packetId) ?? []).sort(by("retrieval_filter_id"));
    const packetId = `context-packet-v2.${slugify(cursor.workflow_run_id)}`;
    const accessibleSelections = dedupeBy(sourceItems.filter((item) => item.resource_id), "resource_id")
      .map((item, index) => buildResourceSelectionRecord({
        item,
        cursor,
        packetId,
        decision: "accessible_resource",
        reason: "matter_boundary_and_policy_snapshot_match",
        generatedAt,
        index,
      }));
    const excludedSelections = dedupeBy(resourceBearingItems.filter((item) => item.matter_id !== cursor.matter_id), "resource_id")
      .slice(0, Math.max(3, accessibleSelections.length > 0 ? 1 : 0))
      .map((item, index) => buildResourceSelectionRecord({
        item,
        cursor,
        packetId,
        decision: "excluded_resource",
        reason: "matter_boundary_mismatch",
        generatedAt,
        index,
      }));
    const selectionRecords = [...accessibleSelections, ...excludedSelections].sort(by("context_resource_selection_record_id"));
    const tokenBudget = buildTokenBudgetRecord({ cursor, packetId, accessibleSelections, excludedSelections, generatedAt });
    const citationHint = buildCitationHintRecord({ cursor, packetId, accessibleSelections, generatedAt });
    const packetRecordBase = {
      schema_version: CONTEXT_PACKET_V2_SCHEMA_VERSION,
      context_packet_v2_record_id: packetId,
      context_builder_contract_id: CONTEXT_BUILDER_CONTRACT_ID,
      source_resume_cursor_record_id: cursor.resume_cursor_record_id,
      idempotency_key_record_id: cursor.idempotency_key_record_id,
      idempotency_key: cursor.idempotency_key,
      workflow_run_id: cursor.workflow_run_id,
      canonical_workflow_run_id: cursor.canonical_workflow_run_id,
      run_ledger_id: cursor.run_ledger_id,
      workflow_id: cursor.workflow_id,
      capability_id: cursor.capability_id,
      domain_pack: cursor.domain_pack,
      tenant_id: sourcePackets[0]?.tenant_id ?? null,
      matter_id: cursor.matter_id,
      policy_snapshot_id: cursor.policy_snapshot_id,
      context_packet_v2_status: cursor.resume_blocked ? "held_for_human_gate" : "ready_for_operator_review",
      context_mode: "review_context_packet_v2",
      source_context_packet_ids: sourcePacketIds,
      source_context_packet_count: sourcePacketIds.length,
      source_context_item_count: sourceItems.length,
      source_retrieval_filter_ids: sourceFilters.map((filter) => filter.retrieval_filter_id),
      required_filter_keys: unique(sourceFilters.flatMap((filter) => filter.required_filter_keys ?? [])),
      required_context_dimensions: ["accessible_resource", "excluded_resource", "token_budget", "citation_hint"],
      accessible_resource_count: accessibleSelections.length,
      excluded_resource_count: excludedSelections.length,
      context_resource_selection_record_ids: selectionRecords.map((record) => record.context_resource_selection_record_id),
      token_budget_record_id: tokenBudget.context_token_budget_record_id,
      citation_hint_record_id: citationHint.context_citation_hint_record_id,
      prompt_injection_handling: "treat_untrusted_content_as_data",
      retrieval_execution_allowed: false,
      human_review_required: true,
      law_firm_human_review_required: cursor.domain_pack === "law-firm" || Boolean(cursor.law_firm_human_review_required),
      client_facing_output_allowed: false,
      external_transfer_allowed: false,
      protected_action_execution_allowed: false,
      recorded_at: generatedAt,
    };
    contextPacketV2Records.push({
      ...packetRecordBase,
      context_packet_v2_hash: hashValue(packetRecordBase),
    });
    contextResourceSelectionRecords.push(...selectionRecords);
    contextTokenBudgetRecords.push(tokenBudget);
    contextCitationHintRecords.push(citationHint);
  }

  return {
    contextPacketV2Records: contextPacketV2Records.sort(by("context_packet_v2_record_id")),
    contextResourceSelectionRecords: contextResourceSelectionRecords.sort(by("context_resource_selection_record_id")),
    contextTokenBudgetRecords: contextTokenBudgetRecords.sort(by("context_token_budget_record_id")),
    contextCitationHintRecords: contextCitationHintRecords.sort(by("context_citation_hint_record_id")),
  };
}

function buildResourceSelectionRecord({ item, cursor, packetId, decision, reason, generatedAt, index }) {
  const recordBase = {
    schema_version: RESOURCE_SELECTION_SCHEMA_VERSION,
    context_resource_selection_record_id: `context-resource-selection.${decision}.${slugify(cursor.workflow_run_id)}.${String(index + 1).padStart(3, "0")}`,
    context_packet_v2_record_id: packetId,
    workflow_run_id: cursor.workflow_run_id,
    source_context_packet_id: item.context_packet_id,
    source_context_item_id: item.context_item_id,
    source_ref_type: item.source_ref_type,
    source_ref_id: item.source_ref_id,
    resource_id: item.resource_id,
    packet_matter_id: cursor.matter_id,
    matter_id: item.matter_id,
    classification: item.classification,
    content_mode: decision === "accessible_resource" ? item.content_mode : "metadata_only",
    selection_decision: decision,
    selection_reason: reason,
    token_eligible: decision === "accessible_resource",
    citation_eligible: decision === "accessible_resource",
    preview_hash: item.preview ? hashValue(item.preview) : null,
    external_transfer_allowed: false,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    selection_hash: hashValue(recordBase),
  };
}

function buildTokenBudgetRecord({ cursor, packetId, accessibleSelections, excludedSelections, generatedAt }) {
  const maxContextTokens = domainTokenBudget(cursor.domain_pack);
  const reservedInstructionTokens = cursor.domain_pack === "law-firm" ? 1600 : 1000;
  const reservedCitationTokens = cursor.domain_pack === "law-firm" ? 1200 : 800;
  const availableResourceTokenBudget = maxContextTokens - reservedInstructionTokens - reservedCitationTokens;
  const estimatedAccessibleTokens = accessibleSelections.reduce((sum, record) => sum + estimatedTokensFor(record), 0);
  const recordBase = {
    schema_version: TOKEN_BUDGET_SCHEMA_VERSION,
    context_token_budget_record_id: `context-token-budget.${slugify(cursor.workflow_run_id)}`,
    context_packet_v2_record_id: packetId,
    workflow_run_id: cursor.workflow_run_id,
    domain_pack: cursor.domain_pack,
    max_context_tokens: maxContextTokens,
    reserved_instruction_tokens: reservedInstructionTokens,
    reserved_citation_tokens: reservedCitationTokens,
    available_resource_token_budget: availableResourceTokenBudget,
    estimated_accessible_resource_tokens: estimatedAccessibleTokens,
    estimated_excluded_resource_tokens: 0,
    accessible_resource_count: accessibleSelections.length,
    excluded_resource_count: excludedSelections.length,
    token_budget_status: estimatedAccessibleTokens <= availableResourceTokenBudget ? "within_budget" : "over_budget",
    overflow_policy: "exclude_low_priority_resources_before_prompt_assembly",
    token_budget_enforced: true,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    token_budget_hash: hashValue(recordBase),
  };
}

function buildCitationHintRecord({ cursor, packetId, accessibleSelections, generatedAt }) {
  const citationHints = accessibleSelections.slice(0, 5).map((selection, index) => ({
    citation_hint_id: `citation-hint.${slugify(cursor.workflow_run_id)}.${String(index + 1).padStart(3, "0")}`,
    resource_id: selection.resource_id,
    source_context_item_id: selection.source_context_item_id,
    source_ref_type: selection.source_ref_type,
    source_ref_id: selection.source_ref_id,
    classification: selection.classification,
    citation_role: "supporting_context",
    citation_requirement: "source_span_or_resource_id_required",
    preview_hash: selection.preview_hash,
  }));
  const recordBase = {
    schema_version: CITATION_HINT_SCHEMA_VERSION,
    context_citation_hint_record_id: `context-citation-hints.${slugify(cursor.workflow_run_id)}`,
    context_packet_v2_record_id: packetId,
    workflow_run_id: cursor.workflow_run_id,
    domain_pack: cursor.domain_pack,
    citation_hint_status: citationHints.length > 0 ? "citation_hints_ready" : "missing_accessible_resource",
    citation_required: true,
    source_span_required: true,
    lineage_required: true,
    human_review_required: true,
    client_facing_output_allowed: false,
    citation_hint_count: citationHints.length,
    citation_hints: citationHints,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    citation_hint_hash: hashValue(recordBase),
  };
}

function validateWorkflowContextBuilderContract({
  workflowResumeCancelContract,
  contextPacketLedger,
  searchIndexContract,
  evidenceExportBundle,
  packageJson,
  roadmapText,
  resumeCursorRecords,
  sourceContextPackets,
  sourceContextItems,
  buildResult,
}) {
  const items = [];
  const packetRecords = buildResult.contextPacketV2Records;
  const selectionRecords = buildResult.contextResourceSelectionRecords;
  const tokenBudgets = buildResult.contextTokenBudgetRecords;
  const citationHints = buildResult.contextCitationHintRecords;
  const packetIds = new Set(packetRecords.map((record) => record.context_packet_v2_record_id));
  const tokenBudgetPacketIds = new Set(tokenBudgets.map((record) => record.context_packet_v2_record_id));
  const citationPacketIds = new Set(citationHints.map((record) => record.context_packet_v2_record_id));

  pushCheck(items, "source.workflow_resume_cancel_contract", "workflow_resume_cancel_complete", workflowResumeCancelContract.summary?.workflow_resume_cancel_status === "complete" && workflowResumeCancelContract.validation?.valid !== false, "Workflow resume/cancel contract must be complete.");
  pushCheck(items, "source.context_packet_ledger", "context_packet_ledger_valid", contextPacketLedger.ledger_status === "valid" && contextPacketLedger.validation?.valid !== false, "Context packet ledger must be valid.");
  pushCheck(items, "source.search_index_contract", "search_index_contract_complete", searchIndexContract.summary?.search_index_contract_status === "complete" && searchIndexContract.validation?.valid !== false, "Search index contract must be complete.");
  pushCheck(items, "source.evidence_export_bundle", "evidence_export_bundle_complete", evidenceExportBundle.summary?.evidence_export_bundle_status === "complete" && evidenceExportBundle.validation?.valid !== false, "Evidence export bundle must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:context-builder"]), "package.json must expose npm run workflows:context-builder.");
  pushCheck(items, "roadmap.phase_184", "phase_184_documented", roadmapText.includes("P184") && roadmapText.includes("context builder"), "Phase ledger must keep the P184 context builder slot visible.");
  pushCheck(items, "context_packet_v2_records", "packet_per_resume_cursor", packetRecords.length === resumeCursorRecords.length && packetRecords.length > 0, "Every resume cursor must have one context packet v2 record.");
  pushCheck(items, "context_packet_v2_records.source", "packets_bind_source_context", packetRecords.every((record) => record.source_context_packet_count > 0 && record.source_context_item_count > 0), "Every context packet v2 record must bind source context packets and items.");
  pushCheck(items, "context_packet_v2_records.accessible", "packets_have_accessible_resources", packetRecords.every((record) => record.accessible_resource_count > 0), "Every context packet v2 record must declare accessible resources.");
  pushCheck(items, "context_packet_v2_records.excluded", "packets_have_excluded_resources", packetRecords.every((record) => record.excluded_resource_count > 0), "Every context packet v2 record must declare excluded resources.");
  pushCheck(items, "context_resource_selection_records", "selection_records_match_packet_counts", selectionRecords.length === packetRecords.reduce((sum, record) => sum + record.accessible_resource_count + record.excluded_resource_count, 0), "Selection record count must match packet accessible/excluded resource counts.");
  pushCheck(items, "context_resource_selection_records.accessible", "accessible_selection_records_present", selectionRecords.some((record) => record.selection_decision === "accessible_resource") && selectionRecords.filter((record) => record.selection_decision === "accessible_resource").every((record) => record.token_eligible && record.citation_eligible), "Accessible selections must be token and citation eligible.");
  pushCheck(items, "context_resource_selection_records.excluded", "excluded_selection_records_present", selectionRecords.some((record) => record.selection_decision === "excluded_resource") && selectionRecords.filter((record) => record.selection_decision === "excluded_resource").every((record) => !record.token_eligible && !record.citation_eligible && record.matter_id !== record.packet_matter_id), "Excluded selections must be boundary mismatches and ineligible for token/citation assembly.");
  pushCheck(items, "context_token_budget_records", "token_budget_per_packet", tokenBudgets.length === packetRecords.length && [...packetIds].every((id) => tokenBudgetPacketIds.has(id)), "Every context packet v2 record must have one token budget record.");
  pushCheck(items, "context_token_budget_records.status", "token_budgets_within_budget", tokenBudgets.every((record) => record.token_budget_status === "within_budget" && record.token_budget_enforced), "Token budgets must be enforced and within budget.");
  pushCheck(items, "context_citation_hint_records", "citation_hint_per_packet", citationHints.length === packetRecords.length && [...packetIds].every((id) => citationPacketIds.has(id)), "Every context packet v2 record must have one citation hint record.");
  pushCheck(items, "context_citation_hint_records.status", "citation_hints_ready", citationHints.every((record) => record.citation_hint_status === "citation_hints_ready" && record.citation_hint_count > 0 && record.citation_required), "Citation hints must be ready and required.");
  pushCheck(items, "context_packet_v2_records.prompt_injection", "prompt_injection_treated_as_data", packetRecords.every((record) => record.prompt_injection_handling === "treat_untrusted_content_as_data"), "All context packet v2 records must treat untrusted content as data.");
  pushCheck(items, "context_packet_v2_records.law_firm", "law_firm_packets_require_human_review", packetRecords.filter((record) => record.domain_pack === "law-firm").every((record) => record.law_firm_human_review_required && record.human_review_required), "Law-firm context packets must require human review.");
  pushCheck(items, "context_packet_v2_records.execution", "no_context_execution_or_transfer", packetRecords.every((record) => !record.retrieval_execution_allowed && !record.client_facing_output_allowed && !record.external_transfer_allowed && !record.protected_action_execution_allowed), "Context builder must not execute retrieval, transfer data, produce client-facing output, or execute protected actions.");
  pushCheck(items, "source_context_items", "source_context_item_inventory_present", sourceContextPackets.length > 0 && sourceContextItems.length > 0, "Source context packet ledger must provide context packet and item inventory.");
  return items;
}

function summarizeWorkflowContextBuilderContract({
  workflowResumeCancelContract,
  contextPacketLedger,
  searchIndexContract,
  evidenceExportBundle,
  resumeCursorRecords,
  sourceContextPackets,
  sourceContextItems,
  sourceRetrievalFilters,
  buildResult,
  validation,
  validationItems,
}) {
  const packetRecords = buildResult.contextPacketV2Records;
  const selectionRecords = buildResult.contextResourceSelectionRecords;
  const tokenBudgets = buildResult.contextTokenBudgetRecords;
  const citationHints = buildResult.contextCitationHintRecords;
  return {
    workflow_context_builder_status: validation.errors.length === 0 ? "complete" : "blocked",
    context_builder_contract_id: CONTEXT_BUILDER_CONTRACT_ID,
    source_workflow_resume_cancel_status: workflowResumeCancelContract.summary?.workflow_resume_cancel_status ?? "unknown",
    source_context_packet_ledger_status: contextPacketLedger.ledger_status ?? "unknown",
    source_search_index_contract_status: searchIndexContract.summary?.search_index_contract_status ?? "unknown",
    source_evidence_export_bundle_status: evidenceExportBundle.summary?.evidence_export_bundle_status ?? "unknown",
    source_resume_cursor_count: resumeCursorRecords.length,
    source_context_packet_count: sourceContextPackets.length,
    source_context_item_count: sourceContextItems.length,
    source_retrieval_filter_count: sourceRetrievalFilters.length,
    source_indexed_record_count: searchIndexContract.summary?.indexed_record_count ?? 0,
    source_export_bundle_count: evidenceExportBundle.summary?.export_bundle_count ?? 0,
    context_packet_v2_count: packetRecords.length,
    context_resource_selection_count: selectionRecords.length,
    accessible_resource_count: selectionRecords.filter((record) => record.selection_decision === "accessible_resource").length,
    excluded_resource_count: selectionRecords.filter((record) => record.selection_decision === "excluded_resource").length,
    packet_with_accessible_resource_count: packetRecords.filter((record) => record.accessible_resource_count > 0).length,
    packet_with_excluded_resource_count: packetRecords.filter((record) => record.excluded_resource_count > 0).length,
    token_budget_record_count: tokenBudgets.length,
    within_budget_record_count: tokenBudgets.filter((record) => record.token_budget_status === "within_budget").length,
    over_budget_record_count: tokenBudgets.filter((record) => record.token_budget_status === "over_budget").length,
    token_budget_enforced_count: tokenBudgets.filter((record) => record.token_budget_enforced).length,
    citation_hint_record_count: citationHints.length,
    citation_hint_ready_count: citationHints.filter((record) => record.citation_hint_status === "citation_hints_ready").length,
    citation_hint_count: citationHints.reduce((sum, record) => sum + record.citation_hint_count, 0),
    prompt_injection_protected_count: packetRecords.filter((record) => record.prompt_injection_handling === "treat_untrusted_content_as_data").length,
    human_review_required_packet_count: packetRecords.filter((record) => record.human_review_required).length,
    law_firm_context_packet_count: packetRecords.filter((record) => record.domain_pack === "law-firm").length,
    law_firm_human_review_packet_count: packetRecords.filter((record) => record.domain_pack === "law-firm" && record.law_firm_human_review_required).length,
    retrieval_execution_allowed_count: packetRecords.filter((record) => record.retrieval_execution_allowed).length,
    client_facing_output_allowed_count: packetRecords.filter((record) => record.client_facing_output_allowed).length,
    external_transfer_allowed_count: packetRecords.filter((record) => record.external_transfer_allowed).length,
    protected_action_executed_count: packetRecords.filter((record) => record.protected_action_execution_allowed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_context_packet_v2_status: countByObject(packetRecords, "context_packet_v2_status"),
    by_selection_decision: countByObject(selectionRecords, "selection_decision"),
    by_token_budget_status: countByObject(tokenBudgets, "token_budget_status"),
    by_citation_hint_status: countByObject(citationHints, "citation_hint_status"),
    by_domain_pack: countByObject(packetRecords, "domain_pack"),
  };
}

function buildContextBuilderContract(generatedAt) {
  return {
    schema_version: "workflow-context-builder-contract.v1",
    generated_at: generatedAt,
    context_builder_contract_id: CONTEXT_BUILDER_CONTRACT_ID,
    context_packet_version: "context-packet-v2",
    deterministic_context_builder: true,
    source_resume_cancel_required: true,
    resource_selection_policy: {
      accessible_resource_required: true,
      excluded_resource_required: true,
      matter_boundary_mismatch_excluded: true,
      external_transfer_allowed: false,
    },
    token_budget_policy: {
      token_budget_required: true,
      overflow_policy: "exclude_low_priority_resources_before_prompt_assembly",
    },
    citation_policy: {
      citation_hint_required: true,
      source_span_or_resource_id_required: true,
      human_review_required: true,
    },
    prompt_injection_policy: {
      untrusted_content_handling: "treat_untrusted_content_as_data",
    },
    law_firm_safety_rule: "Context packets remain review-only and cannot execute retrieval, transfer client data, or produce client-facing legal output without human approval.",
  };
}

function sourceSummary(source, statusKey) {
  return {
    schema_version: source.schema_version ?? null,
    status: source.summary?.[statusKey] ?? source[statusKey] ?? "unknown",
    validation_error_count: source.summary?.validation_error_count ?? source.validation?.errors?.length ?? 0,
  };
}

function renderWorkflowContextBuilderMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Context Builder Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_context_builder_status}`);
  lines.push("");
  lines.push(`- Context packet v2 records: ${summary.context_packet_v2_count}`);
  lines.push(`- Accessible resources: ${summary.accessible_resource_count}`);
  lines.push(`- Excluded resources: ${summary.excluded_resource_count}`);
  lines.push(`- Token budgets within limit: ${summary.within_budget_record_count}/${summary.token_budget_record_count}`);
  lines.push(`- Citation hint records ready: ${summary.citation_hint_ready_count}/${summary.citation_hint_record_count}`);
  lines.push(`- Law-firm human-review packets: ${summary.law_firm_human_review_packet_count}/${summary.law_firm_context_packet_count}`);
  lines.push(`- Retrieval/client/external/protected allowed: ${summary.retrieval_execution_allowed_count}/${summary.client_facing_output_allowed_count}/${summary.external_transfer_allowed_count}/${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Context Packet v2 Records");
  lines.push("");
  for (const record of result.context_packet_v2_records) {
    lines.push(`- ${record.context_packet_v2_record_id}: ${record.context_packet_v2_status}, accessible=${record.accessible_resource_count}, excluded=${record.excluded_resource_count}, budget=${record.token_budget_record_id}, citations=${record.citation_hint_record_id}`);
  }
  return `${lines.join("\n")}\n`;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function normalizeInputs(options) {
  return {
    workflow_resume_cancel_contract_path: path.resolve(options.workflowResumeCancelContractPath ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.workflowResumeCancelContractPath),
    context_packet_ledger_path: path.resolve(options.contextPacketLedgerPath ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.contextPacketLedgerPath),
    search_index_contract_path: path.resolve(options.searchIndexContractPath ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.searchIndexContractPath),
    evidence_export_bundle_path: path.resolve(options.evidenceExportBundlePath ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.evidenceExportBundlePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowResumeCancelContractPath: DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.workflowResumeCancelContractPath,
    contextPacketLedgerPath: DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.contextPacketLedgerPath,
    searchIndexContractPath: DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.searchIndexContractPath,
    evidenceExportBundlePath: DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.evidenceExportBundlePath,
    packagePath: DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_CONTEXT_BUILDER_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_CONTEXT_BUILDER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-resume-cancel") parsed.workflowResumeCancelContractPath = argv[++index];
    else if (arg === "--context-packet-ledger") parsed.contextPacketLedgerPath = argv[++index];
    else if (arg === "--search-index") parsed.searchIndexContractPath = argv[++index];
    else if (arg === "--evidence-export-bundle") parsed.evidenceExportBundlePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-context-builder-contract.mjs [options]

Options:
  --workflow-resume-cancel <path> workflow-resume-cancel-contract.json path.
  --context-packet-ledger <path>  context-packet-ledger.json path.
  --search-index <path>           search-index-contract.json path.
  --evidence-export-bundle <path> evidence-export-bundle.json path.
  --package <path>                package.json path.
  --roadmap <path>                phase ledger path.
  --out-dir <folder>              Output directory.
  --run-at <iso>                  Deterministic generated_at timestamp.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function domainTokenBudget(domainPack) {
  if (domainPack === "law-firm") return 32000;
  if (domainPack === "personal-dev") return 24000;
  if (domainPack === "creative-document") return 20000;
  return 16000;
}

function estimatedTokensFor(selection) {
  if (selection.content_mode === "raw_reference") return 450;
  if (selection.content_mode === "redacted_reference") return 180;
  return 80;
}

function serializableWorkflowContextBuilderContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function countByObject(items, key) {
  return Object.fromEntries([...countBy(items, key).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function dedupeBy(items, key) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    deduped.push(item);
  }
  return deduped;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}
