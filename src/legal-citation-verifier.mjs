import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LEGAL_CITATION_VERIFIER_OUT_DIR = "artifacts/legal-citation-verifier/latest";
export const DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS = {
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "legal-citation-verifier.v1";
const SOURCE_OF_TRUTH = "citation_object_store_issue_graph_source_span_evidence_fact_and_lineage";

export async function runLegalCitationVerifier(options = {}) {
  const result = await buildLegalCitationVerifier(options);
  if (options.write !== false) await writeLegalCitationVerifier(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Legal citation verifier validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLegalCitationVerifier(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LEGAL_CITATION_VERIFIER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const citationObjectStore = sourceById.citation_object_store;
  const issueGraphStore = sourceById.issue_graph_store;
  const sourceSpanStore = sourceById.source_span_store;
  const evidenceItemStore = sourceById.evidence_item_store;
  const factClaimStore = sourceById.fact_claim_store;
  const lineageGraph = sourceById.lineage_graph;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;

  const citationCatalog = citationObjectStore?.citation_catalog ?? {};
  const issueCatalog = issueGraphStore?.issue_graph_catalog ?? {};
  const citations = citationCatalog.citations ?? [];
  const outputParagraphs = citationCatalog.output_paragraphs ?? [];
  const paragraphSourceBindings = citationCatalog.paragraph_source_bindings ?? [];
  const issues = issueCatalog.issues ?? [];
  const legalRules = issueCatalog.legal_rules ?? [];
  const legalRuleBindings = issueCatalog.legal_rule_bindings ?? [];
  const sourceSpans = sourceSpanStore?.source_span_catalog?.source_spans ?? [];
  const evidenceItems = evidenceItemStore?.evidence_item_catalog?.evidence_items ?? [];
  const factClaims = factClaimStore?.fact_claim_catalog?.fact_claims ?? [];
  const lineagePaths = lineageGraph?.lineage_graph_catalog?.lineage_paths ?? [];

  const context = {
    generatedAt,
    citationObjectStore,
    issueGraphStore,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    lineageGraph,
    outputCatalog,
    deliveryQueue,
    citations,
    paragraphById: mapBy(outputParagraphs, "output_paragraph_id"),
    bindingByCitationId: mapBy(paragraphSourceBindings, "citation_id"),
    issueById: mapBy(issues, "issue_id"),
    legalRuleById: mapBy(legalRules, "legal_rule_id"),
    legalRuleBindingsByIssueId: groupBy(legalRuleBindings, "issue_id"),
    sourceSpanById: mapBy(sourceSpans, "source_span_id"),
    evidenceItemById: mapBy(evidenceItems, "evidence_id"),
    factClaimById: mapBy(factClaims, "fact_id"),
    lineagePathByCitationId: mapBy(lineagePaths, "citation_id"),
  };

  const verificationRecords = buildVerificationRecords(context);
  const sourceChecks = buildSourceChecks(verificationRecords, context);
  const currentnessChecks = buildCurrentnessChecks(verificationRecords, context);
  const matterSummaries = buildMatterSummaries(verificationRecords, sourceChecks, currentnessChecks, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    citationObjectStore,
    issueGraphStore,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    lineageGraph,
    outputCatalog,
    deliveryQueue,
    citations,
    verificationRecords,
    sourceChecks,
    currentnessChecks,
    matterSummaries,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLegalCitationVerifier({
    citationObjectStore,
    issueGraphStore,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    lineageGraph,
    outputCatalog,
    deliveryQueue,
    verificationRecords,
    sourceChecks,
    currentnessChecks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    legal_citation_verifier_id: `legal-citation-verifier.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    legal_citation_verifier_status: summary.legal_citation_verifier_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    legal_citation_verifier_contract: buildContract(generatedAt),
    legal_citation_verification_records: verificationRecords,
    legal_citation_source_checks: sourceChecks,
    legal_citation_currentness_checks: currentnessChecks,
    legal_citation_matter_summaries: matterSummaries,
    legal_citation_verifier_desktop_boundary: desktopBoundary,
    legal_citation_verifier_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLegalCitationVerifierMarkdown(result),
  };
}

export async function writeLegalCitationVerifier(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLegalCitationVerifier(result);
  await writeJson(path.join(outDir, "legal-citation-verifier.json"), serializable);
  await writeJson(path.join(outDir, "legal-citation-verification-records.json"), {
    schema_version: "legal-citation-verification-records.v1",
    generated_at: result.generated_at,
    verification_record_count: result.legal_citation_verification_records.length,
    legal_citation_verification_records: result.legal_citation_verification_records,
  });
  await writeJson(path.join(outDir, "legal-citation-source-checks.json"), {
    schema_version: "legal-citation-source-checks.v1",
    generated_at: result.generated_at,
    source_check_count: result.legal_citation_source_checks.length,
    legal_citation_source_checks: result.legal_citation_source_checks,
  });
  await writeJson(path.join(outDir, "legal-citation-currentness-checks.json"), {
    schema_version: "legal-citation-currentness-checks.v1",
    generated_at: result.generated_at,
    currentness_check_count: result.legal_citation_currentness_checks.length,
    legal_citation_currentness_checks: result.legal_citation_currentness_checks,
  });
  await writeJson(path.join(outDir, "legal-citation-matter-summaries.json"), {
    schema_version: "legal-citation-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.legal_citation_matter_summaries.length,
    legal_citation_matter_summaries: result.legal_citation_matter_summaries,
  });
  await writeJson(path.join(outDir, "legal-citation-verifier-boundary.json"), {
    schema_version: "legal-citation-verifier-boundary-artifact.v1",
    generated_at: result.generated_at,
    legal_citation_verifier_desktop_boundary: result.legal_citation_verifier_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "legal-citation-verifier-validation-report.v1",
    generated_at: result.generated_at,
    legal_citation_verifier_id: result.legal_citation_verifier_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLegalCitationVerifierCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLegalCitationVerifier(args);
    console.log(`Legal citation verifier ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.legal_citation_verifier_status}`);
    console.log(`Citations: ${result.summary.citation_count}`);
    console.log(`Source/currentness checks: ${result.summary.source_check_count}/${result.summary.currentness_check_count}`);
    console.log(`Currentness review required: ${result.summary.currentness_review_required_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "legal-citation-verifier-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    verifier_rule: "every citation object receives deterministic source, legal rule, and currentness review gates before legal or client-facing use",
    source_verification_rule: "source-bound means the citation, paragraph-source binding, source span, evidence item, fact claim, issue, and lineage path are present and matter-scoped",
    legal_authority_rule: "local issue-graph legal rules are placeholders and never authoritative until attorney confirmation",
    currentness_rule: "currentness is routed to attorney review; this harness does not assert that any law, case, or secondary source is current",
    attorney_review_rule: "all legal citation verification records require attorney review before client-facing use",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no legal advice, client-facing output, matter data write, task state write, workflow transition, runtime execution, delivery execution, or protected action is performed",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    external_legal_research_performed: false,
    currentness_verified: false,
    legal_authority_finalized: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
  };
}

function buildVerificationRecords(context) {
  return context.citations.map((citation, index) => {
    const paragraph = context.paragraphById.get(citation.output_paragraph_id);
    const binding = context.bindingByCitationId.get(citation.citation_id);
    const issue = context.issueById.get(citation.issue_id);
    const sourceSpan = context.sourceSpanById.get(citation.source_span_id);
    const evidenceItem = context.evidenceItemById.get(citation.evidence_item_id);
    const factClaim = context.factClaimById.get(citation.fact_id);
    const lineagePath = context.lineagePathByCitationId.get(citation.citation_id);
    const legalRuleIds = issue?.legal_rule_ids ?? [];
    const legalRules = legalRuleIds.map((legalRuleId) => context.legalRuleById.get(legalRuleId)).filter(Boolean);
    const legalRuleBindings = context.legalRuleBindingsByIssueId.get(citation.issue_id) ?? [];
    const sourceBound = Boolean(
      citation.source_binding_status === "bound"
        && binding?.binding_status === "bound"
        && sourceSpan
        && evidenceItem
        && factClaim
        && issue
        && lineagePath?.path_status === "complete",
    );
    const legalRuleBound = legalRuleIds.length > 0
      && legalRuleIds.every((legalRuleId) => context.legalRuleById.has(legalRuleId))
      && legalRuleBindings.length >= legalRuleIds.length
      && legalRuleBindings.every((ruleBinding) => ruleBinding.binding_status === "bound");
    const sourceCheckStatus = sourceBound ? "source_bound_pending_attorney_review" : "source_binding_attention_required";
    const currentnessCheckStatus = "currentness_review_required";
    const verificationStatus = sourceBound && legalRuleBound
      ? "source_and_currentness_review_required"
      : "source_or_authority_binding_attention";

    return {
      schema_version: "legal-citation-verification-record.v1",
      legal_citation_verification_record_id: `legal-citation-verification.${slugify(citation.citation_id)}`,
      citation_id: citation.citation_id,
      output_paragraph_id: citation.output_paragraph_id,
      issue_id: citation.issue_id,
      fact_id: citation.fact_id,
      evidence_item_id: citation.evidence_item_id,
      source_span_id: citation.source_span_id,
      lineage_path_id: lineagePath?.lineage_path_id ?? null,
      tenant_id: citation.tenant_id ?? issue?.tenant_id ?? null,
      matter_id: citation.matter_id ?? issue?.matter_id ?? null,
      classification: citation.classification ?? issue?.classification ?? null,
      policy_snapshot_id: citation.policy_snapshot_id ?? issue?.policy_snapshot_id ?? null,
      citation_kind: legalRuleBound ? "legal_rule_placeholder" : "source_material_reference",
      authority_type: legalRuleBound ? "local_issue_graph_legal_rule_placeholder" : "source_material_reference",
      legal_rule_ids: legalRuleIds,
      legal_rule_count: legalRuleIds.length,
      legal_rule_binding_status: legalRuleBound ? "bound" : "attention_required",
      legal_rule_source_statuses: legalRules.map((legalRule) => legalRule.source_status ?? "unknown"),
      legal_rule_verification_statuses: legalRules.map((legalRule) => legalRule.verification_status ?? "unknown"),
      jurisdiction_codes: unique(legalRules.map((legalRule) => legalRule.jurisdiction ?? "unknown")),
      source_bound: sourceBound,
      source_check_status: sourceCheckStatus,
      currentness_gate_applied: true,
      currentness_verified: false,
      currentness_check_status: currentnessCheckStatus,
      legal_authority_status: "review_required_not_authoritative",
      verification_status: verificationStatus,
      review_status: "attorney_review_required",
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      external_legal_research_performed: false,
      legal_authority_finalized: false,
      created_at: context.generatedAt,
      sequence_number: index + 1,
      metadata: {
        paragraph_type: paragraph?.paragraph_type ?? null,
        issue_type: issue?.issue_type ?? citation.metadata?.issue_type ?? null,
        risk_severity: issue?.risk_severity ?? citation.metadata?.risk_severity ?? null,
        citation_style: citation.citation_style ?? null,
        citation_status: citation.citation_status ?? null,
        citation_verification_status: citation.verification_status ?? null,
        source_locator_status: sourceSpan?.locator_status ?? sourceSpan?.locator?.locator_status ?? null,
        source_location_type: sourceSpan?.location_type ?? evidenceItem?.location_type ?? null,
        evidence_review_status: evidenceItem?.review_status ?? null,
        fact_review_status: factClaim?.review_status ?? null,
        issue_review_status: issue?.review_status ?? issue?.status ?? null,
        attorney_review_note: "Source binding, legal authority, and currentness must be confirmed by an attorney before legal or client-facing use.",
        no_legal_advice_note: "This verifier creates review gates only and does not provide legal advice.",
      },
    };
  });
}

function buildSourceChecks(records, context) {
  return records.map((record) => {
    const citation = context.citations.find((item) => item.citation_id === record.citation_id);
    const sourceSpan = context.sourceSpanById.get(record.source_span_id);
    const evidenceItem = context.evidenceItemById.get(record.evidence_item_id);
    const factClaim = context.factClaimById.get(record.fact_id);
    const issue = context.issueById.get(record.issue_id);
    const binding = context.bindingByCitationId.get(record.citation_id);
    const lineagePath = context.lineagePathByCitationId.get(record.citation_id);
    const sourceBound = Boolean(record.source_bound);
    return {
      schema_version: "legal-citation-source-check.v1",
      legal_citation_source_check_id: `legal-citation-source-check.${slugify(record.citation_id)}`,
      legal_citation_verification_record_id: record.legal_citation_verification_record_id,
      citation_id: record.citation_id,
      output_paragraph_id: record.output_paragraph_id,
      issue_id: record.issue_id,
      fact_id: record.fact_id,
      evidence_item_id: record.evidence_item_id,
      source_span_id: record.source_span_id,
      matter_id: record.matter_id,
      classification: record.classification,
      source_check_status: record.source_check_status,
      source_bound: sourceBound,
      citation_object_present: Boolean(citation),
      paragraph_source_binding_status: binding?.binding_status ?? "missing",
      source_span_present: Boolean(sourceSpan),
      evidence_item_present: Boolean(evidenceItem),
      fact_claim_present: Boolean(factClaim),
      issue_present: Boolean(issue),
      lineage_path_status: lineagePath?.path_status ?? "missing",
      source_locator_status: sourceSpan?.locator_status ?? sourceSpan?.locator?.locator_status ?? "missing",
      source_timestamp_status: sourceSpan?.timestamp_status ?? sourceSpan?.locator?.timestamp_status ?? "unknown",
      source_system: sourceSpan?.source_system ?? null,
      resource_id: sourceSpan?.resource_id ?? evidenceItem?.resource_id ?? null,
      resource_version_id: sourceSpan?.resource_version_id ?? evidenceItem?.resource_version_id ?? null,
      content_hash: sourceSpan?.content_hash ?? null,
      matter_boundary_preserved: record.matter_id && sourceSpan?.matter_id === record.matter_id && evidenceItem?.matter_id === record.matter_id && factClaim?.matter_id === record.matter_id && issue?.matter_id === record.matter_id,
      attorney_review_required: true,
      human_review_required: true,
      created_at: record.created_at,
      metadata: {
        source_binding_rule: "source span, evidence item, fact claim, issue, paragraph-source binding, and lineage path must all remain present and matter-scoped",
      },
    };
  });
}

function buildCurrentnessChecks(records, context) {
  return records.map((record) => {
    const legalRules = record.legal_rule_ids.map((legalRuleId) => context.legalRuleById.get(legalRuleId)).filter(Boolean);
    return {
      schema_version: "legal-citation-currentness-check.v1",
      legal_citation_currentness_check_id: `legal-citation-currentness-check.${slugify(record.citation_id)}`,
      legal_citation_verification_record_id: record.legal_citation_verification_record_id,
      citation_id: record.citation_id,
      issue_id: record.issue_id,
      matter_id: record.matter_id,
      classification: record.classification,
      currentness_check_status: record.currentness_check_status,
      currentness_gate_applied: true,
      currentness_verified: false,
      attorney_currentness_review_required: true,
      human_review_required: true,
      external_legal_research_performed: false,
      online_legal_database_checked: false,
      legal_authority_finalized: false,
      legal_authority_status: record.legal_authority_status,
      legal_rule_ids: record.legal_rule_ids,
      legal_rule_count: record.legal_rule_count,
      legal_rule_binding_status: record.legal_rule_binding_status,
      jurisdiction_codes: record.jurisdiction_codes,
      legal_rule_source_statuses: record.legal_rule_source_statuses,
      legal_rule_verification_statuses: record.legal_rule_verification_statuses,
      as_of_date: record.created_at.slice(0, 10),
      review_requirement: "attorney_must_confirm_controlling_law_case_secondary_source_and_currentness_before_client_facing_use",
      created_at: record.created_at,
      metadata: {
        rule_categories: unique(legalRules.map((legalRule) => legalRule.rule_category ?? "unknown")),
        rule_labels: legalRules.map((legalRule) => legalRule.rule_label ?? legalRule.legal_rule_id),
        currentness_note: "The harness records a currentness review gate only; it does not certify current law.",
      },
    };
  });
}

function buildMatterSummaries(records, sourceChecks, currentnessChecks, generatedAt) {
  const recordsByMatter = groupBy(records, "matter_id");
  const sourceChecksByMatter = groupBy(sourceChecks, "matter_id");
  const currentnessChecksByMatter = groupBy(currentnessChecks, "matter_id");
  return [...recordsByMatter.entries()].map(([matterId, matterRecords], index) => {
    const matterSourceChecks = sourceChecksByMatter.get(matterId) ?? [];
    const matterCurrentnessChecks = currentnessChecksByMatter.get(matterId) ?? [];
    return {
      schema_version: "legal-citation-matter-summary.v1",
      legal_citation_matter_summary_id: `legal-citation-matter-summary.${slugify(matterId ?? `unassigned-${index + 1}`)}`,
      matter_id: matterId,
      legal_citation_matter_status: "complete",
      citation_count: matterRecords.length,
      verification_record_count: matterRecords.length,
      source_check_count: matterSourceChecks.length,
      currentness_check_count: matterCurrentnessChecks.length,
      source_bound_citation_count: countWhere(matterRecords, (record) => record.source_bound),
      legal_rule_bound_citation_count: countWhere(matterRecords, (record) => record.legal_rule_binding_status === "bound"),
      currentness_gate_applied_count: countWhere(matterCurrentnessChecks, (check) => check.currentness_gate_applied),
      currentness_review_required_count: countWhere(matterCurrentnessChecks, (check) => check.currentness_check_status === "currentness_review_required"),
      currentness_verified_count: countWhere(matterCurrentnessChecks, (check) => check.currentness_verified),
      attorney_review_required_count: countWhere(matterRecords, (record) => record.attorney_review_required),
      human_review_required_count: countWhere(matterRecords, (record) => record.human_review_required),
      client_facing_ready_count: countWhere(matterRecords, (record) => record.client_facing_ready),
      legal_advice_provided: false,
      client_facing_output_generated: false,
      created_at: generatedAt,
    };
  });
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "legal-citation-verifier-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    desktop_companion_allowed: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    client_facing_output_allowed_without_attorney_review: false,
    external_legal_research_performed: false,
    legal_authority_finalized: false,
    currentness_verified: false,
    created_at: generatedAt,
  };
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  citationObjectStore,
  issueGraphStore,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  lineageGraph,
  outputCatalog,
  deliveryQueue,
  citations,
  verificationRecords,
  sourceChecks,
  currentnessChecks,
  matterSummaries,
  desktopBoundary,
}) {
  const citationCount = citations.length;
  const sourceStatuses = Object.fromEntries(sourceReads.map((source) => [source.source_id, source.available ? "complete" : "missing"]));
  return [
    checkpoint("source_artifacts_available", Object.values(sourceStatuses).every((status) => status === "complete"), "All legal citation verifier source artifacts are available.", sourceStatuses),
    checkpoint("source_statuses_complete", artifactStatus(citationObjectStore, "citation_object_store_status") === "complete"
      && artifactStatus(issueGraphStore, "issue_graph_store_status") === "complete"
      && artifactStatus(sourceSpanStore, "source_span_store_status") === "complete"
      && artifactStatus(evidenceItemStore, "evidence_item_store_status") === "complete"
      && artifactStatus(factClaimStore, "fact_claim_store_status") === "complete"
      && artifactStatus(lineageGraph, "lineage_graph_status") === "complete"
      && Boolean(outputCatalog)
      && Boolean(deliveryQueue), "Upstream citation, issue, evidence, lineage, output, and delivery sources are complete or present."),
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["legal:citations"]), "package.json exposes legal:citations."),
    checkpoint("roadmap_phase_registered", typeof roadmapText === "string" && roadmapText.includes("P239") && roadmapText.toLowerCase().includes("legal citation"), "Roadmap or ledger contains the P239 legal citation verifier slot."),
    checkpoint("citations_present", citationCount > 0, "Citation object store contains citation records.", { citation_count: citationCount }),
    checkpoint("verification_records_match_citations", verificationRecords.length === citationCount, "Each citation has one legal citation verification record.", { citation_count: citationCount, verification_record_count: verificationRecords.length }),
    checkpoint("source_checks_match_citations", sourceChecks.length === citationCount, "Each citation has one source check.", { citation_count: citationCount, source_check_count: sourceChecks.length }),
    checkpoint("currentness_checks_match_citations", currentnessChecks.length === citationCount, "Each citation has one currentness check.", { citation_count: citationCount, currentness_check_count: currentnessChecks.length }),
    checkpoint("all_citations_source_bound", verificationRecords.every((record) => record.source_bound), "All citation records remain bound to source evidence and lineage."),
    checkpoint("all_citations_legal_rule_bound", verificationRecords.every((record) => record.legal_rule_binding_status === "bound"), "All citation records remain bound to issue graph legal rule placeholders."),
    checkpoint("currentness_gate_applied", currentnessChecks.every((check) => check.currentness_gate_applied), "Currentness review gate is applied to every citation."),
    checkpoint("currentness_not_machine_verified", currentnessChecks.every((check) => check.currentness_verified === false), "The harness does not machine-certify citation currentness."),
    checkpoint("currentness_review_required", currentnessChecks.every((check) => check.currentness_check_status === "currentness_review_required"), "Every citation requires attorney currentness review."),
    checkpoint("attorney_review_required", verificationRecords.every((record) => record.attorney_review_required && record.human_review_required), "Every legal citation verification record requires attorney/human review."),
    checkpoint("no_client_facing_ready_records", verificationRecords.every((record) => record.client_facing_ready === false), "No legal citation record is client-facing ready without attorney review."),
    checkpoint("no_legal_or_client_output", verificationRecords.every((record) => record.legal_advice_provided === false && record.client_facing_output_generated === false), "Verifier does not provide legal advice or generate client-facing output."),
    checkpoint("no_mutation_or_execution", verificationRecords.every((record) => record.matter_data_write_allowed === false
      && record.task_state_write_allowed === false
      && record.workflow_transition_allowed === false
      && record.runtime_execution_allowed === false
      && record.delivery_execution_allowed === false
      && record.protected_action_allowed === false), "Verifier performs no matter/task/workflow/runtime/delivery/protected mutation."),
    checkpoint("matter_summaries_present", matterSummaries.length > 0 && matterSummaries.every((summary) => summary.legal_citation_matter_status === "complete"), "Matter-scoped legal citation summaries are present."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced"
      && desktopBoundary.read_only === true
      && desktopBoundary.desktop_mutation_allowed === false
      && desktopBoundary.desktop_source_of_truth === false
      && desktopBoundary.client_facing_output_allowed_without_attorney_review === false
      && desktopBoundary.currentness_verified === false, "Desktop boundary is read-only and preserves attorney review gates."),
  ];
}

function summarizeLegalCitationVerifier({
  citationObjectStore,
  issueGraphStore,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  lineageGraph,
  outputCatalog,
  deliveryQueue,
  verificationRecords,
  sourceChecks,
  currentnessChecks,
  matterSummaries,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const citationCount = verificationRecords.length;
  const validationErrorCount = validation.errors.length;
  return {
    legal_citation_verifier_status: validation.valid && citationCount > 0 ? "complete" : "blocked",
    legal_citation_verifier_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_citation_object_store_status: artifactStatus(citationObjectStore, "citation_object_store_status"),
    source_issue_graph_store_status: artifactStatus(issueGraphStore, "issue_graph_store_status"),
    source_source_span_store_status: artifactStatus(sourceSpanStore, "source_span_store_status"),
    source_evidence_item_store_status: artifactStatus(evidenceItemStore, "evidence_item_store_status"),
    source_fact_claim_store_status: artifactStatus(factClaimStore, "fact_claim_store_status"),
    source_lineage_graph_status: artifactStatus(lineageGraph, "lineage_graph_status"),
    source_output_catalog_status: outputCatalog ? "complete" : "missing",
    source_delivery_queue_status: deliveryQueue ? "complete" : "missing",
    citation_count: citationCount,
    verification_record_count: verificationRecords.length,
    source_check_count: sourceChecks.length,
    currentness_check_count: currentnessChecks.length,
    matter_count: matterSummaries.length,
    source_bound_citation_count: countWhere(verificationRecords, (record) => record.source_bound),
    legal_rule_bound_citation_count: countWhere(verificationRecords, (record) => record.legal_rule_binding_status === "bound"),
    legal_rule_placeholder_citation_count: countWhere(verificationRecords, (record) => record.citation_kind === "legal_rule_placeholder"),
    currentness_gate_applied_count: countWhere(currentnessChecks, (check) => check.currentness_gate_applied),
    currentness_review_required_count: countWhere(currentnessChecks, (check) => check.currentness_check_status === "currentness_review_required"),
    currentness_verified_count: countWhere(currentnessChecks, (check) => check.currentness_verified),
    legal_authority_review_required_count: countWhere(verificationRecords, (record) => record.legal_authority_status === "review_required_not_authoritative"),
    attorney_review_required_citation_count: countWhere(verificationRecords, (record) => record.attorney_review_required),
    human_review_required_citation_count: countWhere(verificationRecords, (record) => record.human_review_required),
    client_facing_ready_count: countWhere(verificationRecords, (record) => record.client_facing_ready),
    legal_advice_provided: false,
    client_facing_output_generated: false,
    external_legal_research_performed: false,
    legal_authority_finalized: false,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    failed_checkpoint_count: countWhere(checkpoints, (item) => item.status !== "passed"),
    validation_item_count: validation.items.length,
    validation_error_count: validationErrorCount,
    by_matter_id: countBy(verificationRecords, "matter_id"),
    by_classification: countBy(verificationRecords, "classification"),
    by_citation_kind: countBy(verificationRecords, "citation_kind"),
    by_authority_type: countBy(verificationRecords, "authority_type"),
    by_source_check_status: countBy(verificationRecords, "source_check_status"),
    by_currentness_check_status: countBy(verificationRecords, "currentness_check_status"),
    by_legal_authority_status: countBy(verificationRecords, "legal_authority_status"),
    by_verification_status: countBy(verificationRecords, "verification_status"),
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    schema_version: "legal-citation-verifier-source-contracts.v1",
    sources: sourceReads.map((source) => ({
      source_id: source.source_id,
      source_label: source.source_label,
      source_path: source.path,
      available: source.available,
      source_status: source.available ? "complete" : "missing",
      schema_version: source.value?.schema_version ?? null,
      summary_status: source.value?.summary ? statusFromSummary(source.source_id, source.value.summary) : null,
      error: source.error ?? null,
    })),
    package: {
      path: packageJson.path,
      available: packageJson.available,
      script_registered: Boolean(packageJson.value?.scripts?.["legal:citations"]),
      error: packageJson.error ?? null,
    },
    roadmap: {
      path: roadmapText.path,
      available: roadmapText.available,
      phase_registered: typeof roadmapText.value === "string" && roadmapText.value.includes("P239"),
      error: roadmapText.error ?? null,
    },
  };
}

function renderLegalCitationVerifierMarkdown(result) {
  const summary = result.summary;
  return [
    "# Legal Citation Verifier",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${summary.legal_citation_verifier_status}`,
    "",
    "## Summary",
    "",
    `- Citations checked: ${summary.citation_count}`,
    `- Source-bound citations: ${summary.source_bound_citation_count}`,
    `- Legal rule placeholder bindings: ${summary.legal_rule_bound_citation_count}`,
    `- Currentness review required: ${summary.currentness_review_required_count}`,
    `- Machine currentness verified: ${summary.currentness_verified_count}`,
    `- Attorney review required: ${summary.attorney_review_required_citation_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "- This artifact is read-only.",
    "- It does not provide legal advice.",
    "- It does not certify that any law, case, or secondary source is current.",
    "- Every legal citation record remains blocked for attorney review before client-facing use.",
    "",
  ].join("\n");
}

function serializableLegalCitationVerifier(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function normalizeInputs(options) {
  return {
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.citationObjectStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.issueGraphStorePath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.evidenceItemStorePath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.factClaimStorePath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.lineageGraphPath),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_LEGAL_CITATION_VERIFIER_INPUTS.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const sourceSpecs = [
    ["citation_object_store", "Citation Object Store", inputs.citation_object_store_path],
    ["issue_graph_store", "Issue Graph Store", inputs.issue_graph_store_path],
    ["source_span_store", "Source Span Store", inputs.source_span_store_path],
    ["evidence_item_store", "Evidence Item Store", inputs.evidence_item_store_path],
    ["fact_claim_store", "Fact Claim Store", inputs.fact_claim_store_path],
    ["lineage_graph", "Lineage Graph", inputs.lineage_graph_path],
    ["output_catalog", "Output Catalog", inputs.output_catalog_path],
    ["delivery_queue", "Protected Delivery Queue", inputs.delivery_queue_path],
  ];
  return Promise.all(sourceSpecs.map(async ([sourceId, sourceLabel, sourcePath]) => {
    const read = await readJsonOrError(sourcePath);
    return {
      source_id: sourceId,
      source_label: sourceLabel,
      path: read.path,
      available: read.available,
      value: read.value,
      error: read.error,
    };
  }));
}

async function readJsonOrError(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return {
      path: resolved,
      available: true,
      value: JSON.parse(await readFile(resolved, "utf8")),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      value: null,
      error: error.message,
    };
  }
}

async function readTextOrError(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return {
      path: resolved,
      available: true,
      value: await readFile(resolved, "utf8"),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      value: null,
      error: error.message,
    };
  }
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
    status: item.status,
  }));
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
    items,
  };
}

function checkpoint(checkpointId, passed, message, metadata = {}) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
    ...metadata,
  };
}

function artifactStatus(artifact, statusKey) {
  if (!artifact) return "missing";
  if (statusKey && artifact.summary?.[statusKey]) return artifact.summary[statusKey];
  return "complete";
}

function statusFromSummary(sourceId, summary) {
  const keys = [
    `${sourceId}_status`,
    sourceId === "lineage_graph" ? "lineage_graph_status" : null,
    sourceId === "output_catalog" ? "output_catalog_status" : null,
    sourceId === "delivery_queue" ? "delivery_queue_status" : null,
  ].filter(Boolean);
  for (const key of keys) {
    if (summary[key]) return summary[key];
  }
  return "complete";
}

function mapBy(items, key) {
  return new Map((items ?? []).filter((item) => item?.[key]).map((item) => [item[key], item]));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items ?? []) {
    const value = item?.[key] ?? null;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function countWhere(items, predicate) {
  return (items ?? []).filter(predicate).length;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items ?? []) {
    const value = item?.[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function unique(values) {
  return [...new Set((values ?? []).filter((value) => value !== undefined && value !== null))];
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/legal-citation-verifier.mjs [options]

Options:
  --check                         fail if verifier validation does not pass
  --no-write                      build without writing artifacts
  --out-dir <path>                output directory
  --citation-object-store <path>  citation object store artifact
  --issue-graph-store <path>      issue graph store artifact
  --source-span-store <path>      source span store artifact
  --evidence-item-store <path>    evidence item store artifact
  --fact-claim-store <path>       fact claim store artifact
  --lineage-graph <path>          lineage graph artifact
  --output-catalog <path>         output catalog artifact
  --delivery-queue <path>         protected delivery queue artifact
  --package <path>                package.json path
  --roadmap <path>                roadmap or phase ledger path
`);
}
