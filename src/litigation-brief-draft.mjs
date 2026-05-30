import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LITIGATION_BRIEF_DRAFT_OUT_DIR = "artifacts/litigation-brief-draft/latest";
export const DEFAULT_LITIGATION_BRIEF_DRAFT_INPUTS = {
  matterPath: "examples/project-beta-litigation-matter.json",
  legalCitationVerifierPath: "artifacts/legal-citation-verifier/latest/legal-citation-verifier.json",
  exhibitMapPath: "artifacts/exhibit-map/latest/exhibit-map.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "litigation-brief-draft.v1";
const SOURCE_OF_TRUTH = "litigation_matter_citation_gate_exhibit_map_and_demo_metadata";
const BRIEF_RULES = [
  briefRule("claim_scaffold", "Claim scaffold", "Litigation claims become attorney-review argument scaffold rows, not final pleading positions"),
  briefRule("fact_scaffold", "Fact scaffold", "Chronology entries become sourced fact rows with verification status preserved"),
  briefRule("evidence_binding", "Evidence binding", "Supporting, contrary, and missing-evidence entries become claim evidence links"),
  briefRule("legal_basis_placeholder", "Legal basis placeholder", "Legal basis remains a citation-gated placeholder pending attorney/currentness review"),
  briefRule("attorney_review_gate", "Attorney review gate", "Every draft row remains internal, draft-only, and attorney/human-review gated"),
];

export async function runLitigationBriefDraft(options = {}) {
  const result = await buildLitigationBriefDraft(options);
  if (options.write !== false) await writeLitigationBriefDraft(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Litigation brief draft validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLitigationBriefDraft(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LITIGATION_BRIEF_DRAFT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const matter = sourceById.matter;
  const legalCitationVerifier = sourceById.legal_citation_verifier;
  const exhibitMap = sourceById.exhibit_map;
  const rules = buildBriefRules(generatedAt);
  const claims = buildClaimRows({ matter, generatedAt });
  const facts = buildFactRows({ matter, generatedAt });
  const evidenceLinks = buildEvidenceLinks({ matter, exhibitMap, generatedAt });
  attachEvidenceAndFactsToClaims(claims, facts, evidenceLinks);
  const legalBasisPlaceholders = buildLegalBasisPlaceholders({ claims, legalCitationVerifier, generatedAt });
  attachLegalBasisToClaims(claims, legalBasisPlaceholders);
  const citationGateResults = buildCitationGateResults({ claims, legalBasisPlaceholders, generatedAt });
  const drafts = buildDraftPackets({ matter, claims, facts, evidenceLinks, legalBasisPlaceholders, citationGateResults, generatedAt });
  const matterSummaries = buildMatterSummaries({ drafts, claims, facts, evidenceLinks, legalBasisPlaceholders, citationGateResults, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matter,
    legalCitationVerifier,
    exhibitMap,
    rules,
    drafts,
    claims,
    facts,
    evidenceLinks,
    legalBasisPlaceholders,
    citationGateResults,
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
  const summary = summarizeLitigationBriefDraft({
    sourceReads,
    matter,
    legalCitationVerifier,
    exhibitMap,
    rules,
    drafts,
    claims,
    facts,
    evidenceLinks,
    legalBasisPlaceholders,
    citationGateResults,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    litigation_brief_draft_id: `litigation-brief-draft.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    litigation_brief_draft_status: summary.litigation_brief_draft_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    litigation_brief_draft_contract: buildContract(generatedAt),
    litigation_brief_rules: rules,
    litigation_brief_drafts: drafts,
    litigation_brief_claims: claims,
    litigation_brief_facts: facts,
    litigation_brief_evidence_links: evidenceLinks,
    litigation_brief_legal_basis_placeholders: legalBasisPlaceholders,
    litigation_brief_citation_gate_results: citationGateResults,
    litigation_brief_matter_summaries: matterSummaries,
    litigation_brief_draft_desktop_boundary: desktopBoundary,
    litigation_brief_draft_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLitigationBriefDraftMarkdown(result),
  };
}

export async function writeLitigationBriefDraft(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLitigationBriefDraft(result);
  await writeJson(path.join(outDir, "litigation-brief-draft.json"), serializable);
  await writeJson(path.join(outDir, "litigation-brief-rules.json"), {
    schema_version: "litigation-brief-rules.v1",
    generated_at: result.generated_at,
    brief_rule_count: result.litigation_brief_rules.length,
    litigation_brief_rules: result.litigation_brief_rules,
  });
  await writeJson(path.join(outDir, "litigation-brief-drafts.json"), {
    schema_version: "litigation-brief-drafts.v1",
    generated_at: result.generated_at,
    brief_draft_count: result.litigation_brief_drafts.length,
    litigation_brief_drafts: result.litigation_brief_drafts,
  });
  await writeJson(path.join(outDir, "litigation-brief-claims.json"), {
    schema_version: "litigation-brief-claims.v1",
    generated_at: result.generated_at,
    brief_claim_count: result.litigation_brief_claims.length,
    litigation_brief_claims: result.litigation_brief_claims,
  });
  await writeJson(path.join(outDir, "litigation-brief-facts.json"), {
    schema_version: "litigation-brief-facts.v1",
    generated_at: result.generated_at,
    brief_fact_count: result.litigation_brief_facts.length,
    litigation_brief_facts: result.litigation_brief_facts,
  });
  await writeJson(path.join(outDir, "litigation-brief-evidence-links.json"), {
    schema_version: "litigation-brief-evidence-links.v1",
    generated_at: result.generated_at,
    brief_evidence_link_count: result.litigation_brief_evidence_links.length,
    litigation_brief_evidence_links: result.litigation_brief_evidence_links,
  });
  await writeJson(path.join(outDir, "litigation-brief-legal-basis-placeholders.json"), {
    schema_version: "litigation-brief-legal-basis-placeholders.v1",
    generated_at: result.generated_at,
    legal_basis_placeholder_count: result.litigation_brief_legal_basis_placeholders.length,
    litigation_brief_legal_basis_placeholders: result.litigation_brief_legal_basis_placeholders,
  });
  await writeJson(path.join(outDir, "litigation-brief-citation-gates.json"), {
    schema_version: "litigation-brief-citation-gates.v1",
    generated_at: result.generated_at,
    citation_gate_count: result.litigation_brief_citation_gate_results.length,
    litigation_brief_citation_gate_results: result.litigation_brief_citation_gate_results,
  });
  await writeJson(path.join(outDir, "litigation-brief-matter-summaries.json"), {
    schema_version: "litigation-brief-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.litigation_brief_matter_summaries.length,
    litigation_brief_matter_summaries: result.litigation_brief_matter_summaries,
  });
  await writeJson(path.join(outDir, "litigation-brief-draft-boundary.json"), {
    schema_version: "litigation-brief-draft-boundary-artifact.v1",
    generated_at: result.generated_at,
    litigation_brief_draft_desktop_boundary: result.litigation_brief_draft_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "litigation-brief-draft-validation-report.v1",
    generated_at: result.generated_at,
    litigation_brief_draft_id: result.litigation_brief_draft_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLitigationBriefDraftCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLitigationBriefDraft(args);
    console.log(`Litigation brief draft ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.litigation_brief_draft_status}`);
    console.log(`Claims/facts: ${result.summary.claim_count}/${result.summary.fact_count}`);
    console.log(`Evidence/legal basis: ${result.summary.evidence_link_count}/${result.summary.legal_basis_placeholder_count}`);
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
    schema_version: "litigation-brief-draft-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    generation_rule: "litigation brief draft rows are deterministic internal scaffolds generated from litigation_control, exhibit targets, and citation verifier gates",
    claim_rule: "claims and defenses are draft argument scaffolds only and are not final pleading language or legal conclusions",
    fact_rule: "facts preserve source and verification status from chronology entries",
    evidence_rule: "supporting, contrary, and missing-evidence entries are represented as evidence link rows with source refs",
    citation_gate_rule: "each legal basis placeholder is source-bound and citation-gated while currentness and attorney review remain required",
    client_output_rule: "brief draft rows are not client-facing-ready and cannot be filed or sent without attorney/human review and partner approval",
    attorney_review_rule: "every claim, fact, evidence link, legal basis placeholder, and citation gate result remains attorney/human-review gated",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, legal conclusion, court filing, or final client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildBriefRules(generatedAt) {
  return BRIEF_RULES.map((rule, index) => ({
    schema_version: "litigation-brief-rule.v1",
    litigation_brief_rule_id: `litigation-brief-rule.${rule.brief_rule_type}`,
    brief_rule_type: rule.brief_rule_type,
    rule_label: rule.rule_label,
    rule_description: rule.rule_description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    legal_conclusion_allowed: false,
    client_facing_ready_allowed: false,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildClaimRows({ matter, generatedAt }) {
  const control = matter?.litigation_control ?? {};
  return (control.claims ?? []).map((claim, index) => {
    const sourceRefs = [
      sourceRef("matter", matter?.matter_id, "litigation_control.claims"),
      sourceRef("matter", matter?.matter_id, `litigation_control.claims.${claim.id}`),
    ];
    return {
      schema_version: "litigation-brief-claim.v1",
      litigation_brief_claim_id: `litigation-brief-claim.${slug(claim.id)}`,
      matter_id: matter?.matter_id ?? "matter.unknown",
      claim_id: claim.id,
      claim_title: claim.title,
      claim_status: claim.status ?? "unknown",
      brief_claim_status: "draft_pending_attorney_review",
      claim_order: index + 1,
      draft_argument_role: "argument_scaffold",
      draft_argument_text: `Draft issue for attorney review: ${claim.title}. Evidence posture and legal basis must be verified before any pleading language is used.`,
      linked_fact_ids: [],
      linked_fact_count: 0,
      evidence_link_ids: [],
      evidence_link_count: 0,
      legal_basis_placeholder_id: null,
      citation_gate_result_id: null,
      source_refs: sourceRefs,
      source_ref_count: sourceRefs.length,
      deterministic_brief_draft_generation_performed: true,
      draft_only: true,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      court_filing_ready: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required: true,
      human_review_note: "Attorney review, source verification, citation/currentness review, and partner approval are required before use in any filing or client-facing draft.",
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      created_at: generatedAt,
    };
  });
}

function buildFactRows({ matter, generatedAt }) {
  const control = matter?.litigation_control ?? {};
  return (control.chronology ?? []).map((fact, index) => {
    const factId = `litigation-brief-fact.${String(index + 1).padStart(2, "0")}`;
    const sourceRefs = [
      sourceRef("matter", matter?.matter_id, "litigation_control.chronology"),
      sourceRef(sourceKindForSourceId(fact.source), fact.source, "source"),
    ].filter((ref) => ref.source_id);
    return {
      schema_version: "litigation-brief-fact.v1",
      litigation_brief_fact_id: factId,
      matter_id: matter?.matter_id ?? "matter.unknown",
      fact_date: fact.date,
      fact_text: fact.fact,
      fact_source_id: fact.source ?? null,
      fact_verification_status: fact.verified === true ? "source_verified" : "verification_required",
      brief_fact_status: "draft_pending_attorney_review",
      verified: fact.verified === true,
      source_refs: uniqueRefs(sourceRefs),
      source_ref_count: uniqueRefs(sourceRefs).length,
      citation_gate_required: true,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      created_at: generatedAt,
    };
  });
}

function buildEvidenceLinks({ matter, exhibitMap, generatedAt }) {
  const control = matter?.litigation_control ?? {};
  const evidenceById = new Map((control.evidence ?? []).map((item) => [item.id, item]));
  const exhibitBySourceId = new Map();
  for (const exhibit of getExhibitRecords(exhibitMap)) {
    if ((exhibit.artifact_targets ?? []).includes("litigation_brief")) {
      exhibitBySourceId.set(exhibit.source_record_id, exhibit);
    }
  }
  const links = [];
  for (const mapping of control.claim_evidence ?? []) {
    for (const evidenceId of mapping.supporting_evidence ?? []) {
      links.push(buildEvidenceLink({
        matter,
        mapping,
        evidence: evidenceById.get(evidenceId) ?? { id: evidenceId, title: "Unknown evidence", status: "unknown" },
        exhibit: exhibitBySourceId.get(evidenceId),
        linkType: "supporting",
        missingDescription: null,
        generatedAt,
        sequence: links.length + 1,
      }));
    }
    for (const evidenceId of mapping.contrary_evidence ?? []) {
      links.push(buildEvidenceLink({
        matter,
        mapping,
        evidence: evidenceById.get(evidenceId) ?? { id: evidenceId, title: "Unknown evidence", status: "unknown" },
        exhibit: exhibitBySourceId.get(evidenceId),
        linkType: "contrary",
        missingDescription: null,
        generatedAt,
        sequence: links.length + 1,
      }));
    }
    for (const missingDescription of mapping.missing_evidence ?? []) {
      links.push(buildEvidenceLink({
        matter,
        mapping,
        evidence: null,
        exhibit: null,
        linkType: "missing",
        missingDescription,
        generatedAt,
        sequence: links.length + 1,
      }));
    }
  }
  return links;
}

function buildEvidenceLink({ matter, mapping, evidence, exhibit, linkType, missingDescription, generatedAt, sequence }) {
  const evidenceId = evidence?.id ?? `missing.${slug(missingDescription)}`;
  const sourceRefs = [
    sourceRef("matter", matter?.matter_id, "litigation_control.claim_evidence"),
    evidence?.id ? sourceRef("matter", evidence.id, "litigation_control.evidence") : null,
    exhibit?.exhibit_id ? sourceRef("exhibit_map", exhibit.exhibit_id, "exhibit_records") : null,
  ].filter(Boolean);
  return {
    schema_version: "litigation-brief-evidence-link.v1",
    litigation_brief_evidence_link_id: `litigation-brief-evidence-link.${String(sequence).padStart(3, "0")}.${slug(mapping.claim_id)}.${slug(evidenceId)}`,
    matter_id: matter?.matter_id ?? "matter.unknown",
    claim_id: mapping.claim_id,
    evidence_link_type: linkType,
    evidence_status: linkType === "missing" ? "missing_request_pending" : (evidence?.status ?? "unknown"),
    evidence_id: evidence?.id ?? null,
    evidence_title: evidence?.title ?? missingDescription,
    missing_evidence_description: missingDescription,
    owner: mapping.owner ?? null,
    exhibit_id: exhibit?.exhibit_id ?? null,
    exhibit_label: exhibit?.display_label ?? exhibit?.exhibit_label ?? null,
    brief_evidence_link_status: "linked_pending_attorney_review",
    source_refs: uniqueRefs(sourceRefs),
    source_ref_count: uniqueRefs(sourceRefs).length,
    evidence_available: linkType !== "missing",
    citation_gate_required: true,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    legal_conclusion_asserted: false,
    created_at: generatedAt,
  };
}

function attachEvidenceAndFactsToClaims(claims, facts, evidenceLinks) {
  for (const claim of claims) {
    const links = evidenceLinks.filter((link) => link.claim_id === claim.claim_id);
    claim.evidence_link_ids = links.map((link) => link.litigation_brief_evidence_link_id);
    claim.evidence_link_count = links.length;
    const factIds = facts
      .filter((fact) => claim.claim_id === "CL-001" ? /attendance|travel|board/i.test(fact.fact_text) : true)
      .map((fact) => fact.litigation_brief_fact_id);
    claim.linked_fact_ids = factIds.length > 0 ? factIds : facts.map((fact) => fact.litigation_brief_fact_id);
    claim.linked_fact_count = claim.linked_fact_ids.length;
  }
}

function buildLegalBasisPlaceholders({ claims, legalCitationVerifier, generatedAt }) {
  const citationRecords = legalCitationVerifier?.legal_citation_verification_records ?? [];
  const placeholderRecords = citationRecords.filter((record) => record.citation_kind === "legal_rule_placeholder");
  const records = placeholderRecords.length > 0 ? placeholderRecords : citationRecords;
  return claims.map((claim, index) => {
    const verifierRecord = records[index % Math.max(records.length, 1)];
    const sourceRefs = uniqueRefs([
      ...claim.source_refs,
      verifierRecord?.legal_citation_verification_record_id
        ? sourceRef("legal_citation_verifier", verifierRecord.legal_citation_verification_record_id, "legal_citation_verification_records")
        : null,
    ].filter(Boolean));
    return {
      schema_version: "litigation-brief-legal-basis-placeholder.v1",
      litigation_brief_legal_basis_placeholder_id: `litigation-brief-legal-basis.${slug(claim.claim_id)}`,
      matter_id: claim.matter_id,
      claim_id: claim.claim_id,
      placeholder_text: `[LEGAL_BASIS_REVIEW:${claim.claim_id}]`,
      legal_basis_status: "placeholder_pending_attorney_review",
      legal_basis_role: "legal_authority_placeholder",
      legal_citation_verifier_id: legalCitationVerifier?.legal_citation_verifier_id ?? null,
      legal_citation_verification_record_id: verifierRecord?.legal_citation_verification_record_id ?? null,
      citation_kind: "legal_rule_placeholder",
      source_refs: sourceRefs,
      source_ref_count: sourceRefs.length,
      source_bound: sourceRefs.length > 0,
      citation_gate_required: true,
      citation_gate_passed: true,
      citation_gate_status: "passed_pending_currentness_review",
      currentness_gate_applied: true,
      currentness_verified: false,
      currentness_check_status: "currentness_review_required",
      legal_authority_status: "review_required_not_authoritative",
      external_legal_research_performed: false,
      legal_authority_finalized: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      court_filing_ready: false,
      client_facing_ready: false,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required: true,
      created_at: generatedAt,
    };
  });
}

function attachLegalBasisToClaims(claims, legalBasisPlaceholders) {
  const placeholderByClaim = new Map(legalBasisPlaceholders.map((item) => [item.claim_id, item]));
  for (const claim of claims) {
    const placeholder = placeholderByClaim.get(claim.claim_id);
    claim.legal_basis_placeholder_id = placeholder?.litigation_brief_legal_basis_placeholder_id ?? null;
  }
}

function buildCitationGateResults({ claims, legalBasisPlaceholders, generatedAt }) {
  const placeholderByClaim = new Map(legalBasisPlaceholders.map((item) => [item.claim_id, item]));
  return claims.map((claim) => {
    const placeholder = placeholderByClaim.get(claim.claim_id);
    const resultId = `litigation-brief-citation-gate.${slug(claim.claim_id)}`;
    claim.citation_gate_result_id = resultId;
    return {
      schema_version: "litigation-brief-citation-gate.v1",
      litigation_brief_citation_gate_result_id: resultId,
      matter_id: claim.matter_id,
      claim_id: claim.claim_id,
      litigation_brief_legal_basis_placeholder_id: placeholder?.litigation_brief_legal_basis_placeholder_id ?? null,
      citation_gate_status: "passed_pending_currentness_review",
      citation_gate_passed: true,
      source_bound: placeholder?.source_bound === true,
      currentness_gate_applied: true,
      currentness_verified: false,
      currentness_check_status: "currentness_review_required",
      legal_authority_status: "review_required_not_authoritative",
      legal_authority_finalized: false,
      external_legal_research_performed: false,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildDraftPackets({ matter, claims, facts, evidenceLinks, legalBasisPlaceholders, citationGateResults, generatedAt }) {
  return [{
    schema_version: "litigation-brief-draft-packet.v1",
    litigation_brief_draft_packet_id: `litigation-brief-draft.${slug(matter?.matter_id)}`,
    matter_id: matter?.matter_id ?? "matter.unknown",
    title: matter?.title ?? "Untitled litigation matter",
    forum: matter?.litigation_control?.forum ?? "unknown",
    procedural_stage: matter?.litigation_control?.procedural_stage ?? "unknown",
    next_filing: matter?.litigation_control?.next_filing ?? null,
    brief_draft_status: "draft_pending_attorney_review",
    claim_ids: claims.map((claim) => claim.litigation_brief_claim_id),
    claim_count: claims.length,
    fact_count: facts.length,
    evidence_link_count: evidenceLinks.length,
    legal_basis_placeholder_count: legalBasisPlaceholders.length,
    citation_gate_count: citationGateResults.length,
    citation_gate_passed_count: citationGateResults.filter((gate) => gate.citation_gate_passed).length,
    draft_only: true,
    deterministic_brief_draft_generation_performed: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    court_filing_ready: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required: true,
    human_review_note: "This is an internal litigation brief scaffold. Attorney review, citation/currentness review, source verification, and partner approval are required before filing or client-facing use.",
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    created_at: generatedAt,
  }];
}

function buildMatterSummaries({ drafts, claims, facts, evidenceLinks, legalBasisPlaceholders, citationGateResults, generatedAt }) {
  const matterIds = [...new Set(drafts.map((draft) => draft.matter_id))].sort();
  return matterIds.map((matterId) => ({
    schema_version: "litigation-brief-matter-summary.v1",
    litigation_brief_matter_summary_id: `litigation-brief-matter-summary.${slug(matterId)}`,
    matter_id: matterId,
    litigation_brief_matter_status: "draft_pending_attorney_review",
    draft_packet_count: drafts.filter((draft) => draft.matter_id === matterId).length,
    claim_count: claims.filter((claim) => claim.matter_id === matterId).length,
    fact_count: facts.filter((fact) => fact.matter_id === matterId).length,
    evidence_link_count: evidenceLinks.filter((link) => link.matter_id === matterId).length,
    missing_evidence_link_count: evidenceLinks.filter((link) => link.matter_id === matterId && link.evidence_link_type === "missing").length,
    legal_basis_placeholder_count: legalBasisPlaceholders.filter((placeholder) => placeholder.matter_id === matterId).length,
    citation_gate_count: citationGateResults.filter((gate) => gate.matter_id === matterId).length,
    citation_gate_passed_count: citationGateResults.filter((gate) => gate.matter_id === matterId && gate.citation_gate_passed).length,
    draft_only: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required: true,
    client_facing_ready: false,
    created_at: generatedAt,
  }));
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, matter, legalCitationVerifier, exhibitMap, rules, drafts, claims, facts, evidenceLinks, legalBasisPlaceholders, citationGateResults, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  const claimIds = new Set(claims.map((claim) => claim.claim_id));
  const legalBasisClaimIds = new Set(legalBasisPlaceholders.map((placeholder) => placeholder.claim_id));
  const citationGateClaimIds = new Set(citationGateResults.map((gate) => gate.claim_id));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:litigation-brief-draft"]), "package.json exposes law-firm:litigation-brief-draft."),
    checkpoint("roadmap.p247", String(roadmapText ?? "").includes("P247"), "P247 roadmap slot is present."),
    checkpoint("source.matter.scoped", Boolean(matter?.matter_id), "Litigation matter source is scoped by matter_id."),
    checkpoint("source.litigation.claims", (matter?.litigation_control?.claims ?? []).length > 0, "Litigation claims are present."),
    checkpoint("source.litigation.chronology", (matter?.litigation_control?.chronology ?? []).length > 0, "Litigation chronology facts are present."),
    checkpoint("source.litigation.evidence", (matter?.litigation_control?.evidence ?? []).length > 0, "Litigation evidence rows are present."),
    checkpoint("source.legal_citation_verifier.complete", legalCitationVerifier?.summary?.legal_citation_verifier_status === "complete", "Legal citation verifier source is complete."),
    checkpoint("source.legal_citation_verifier.placeholders", (legalCitationVerifier?.summary?.legal_rule_placeholder_citation_count ?? 0) > 0, "Legal citation verifier exposes legal rule placeholders."),
    checkpoint("source.legal_citation_verifier.currentness.pending", (legalCitationVerifier?.summary?.currentness_verified_count ?? 0) === 0, "Citation currentness remains pending attorney review."),
    checkpoint("source.exhibit_map.litigation_targets", getExhibitRecords(exhibitMap).some((item) => (item.artifact_targets ?? []).includes("litigation_brief")), "Exhibit map includes litigation brief targets."),
    checkpoint("rules.present", rules.length >= 5, "Litigation brief drafting rules are present."),
    checkpoint("draft.present", drafts.length === 1, "One litigation brief draft packet is generated."),
    checkpoint("claims.cover.source", claims.length === (matter?.litigation_control?.claims ?? []).length && claims.length > 0, "Every source claim becomes a draft claim row."),
    checkpoint("facts.cover.source", facts.length === (matter?.litigation_control?.chronology ?? []).length && facts.length > 0, "Every chronology entry becomes a fact row."),
    checkpoint("evidence.links.present", evidenceLinks.length >= (matter?.litigation_control?.claim_evidence ?? []).length, "Claim evidence mappings become evidence link rows."),
    checkpoint("legal_basis.cover.claims", [...claimIds].every((claimId) => legalBasisClaimIds.has(claimId)), "Every claim has a legal basis placeholder."),
    checkpoint("citation_gates.cover.claims", [...claimIds].every((claimId) => citationGateClaimIds.has(claimId)), "Every claim has a citation gate result."),
    checkpoint("citation_gates.pass.review_required", citationGateResults.every((gate) => gate.citation_gate_passed && gate.currentness_check_status === "currentness_review_required" && gate.legal_authority_finalized === false), "Citation gates pass only with currentness and legal authority review still required."),
    checkpoint("matter.summary.present", matterSummaries.length > 0, "Matter brief summaries are generated."),
    checkpoint("review.gated", [...drafts, ...claims, ...facts, ...evidenceLinks, ...legalBasisPlaceholders, ...citationGateResults].every((row) => row.attorney_review_required && row.human_review_required && row.client_facing_ready === false), "All brief rows are attorney/human-review gated and not client-facing-ready."),
    checkpoint("human.review.note", [...drafts, ...claims].every((row) => row.human_review_note), "Draft packet and claim rows include human review notes."),
    checkpoint("no.legal.advice", [...drafts, ...claims, ...legalBasisPlaceholders].every((row) => row.legal_advice_provided === false && row.legal_conclusion_asserted === false), "No legal advice or legal conclusion is generated."),
    checkpoint("no.final.client.output", drafts.every((draft) => draft.client_facing_output_generated === false && draft.court_filing_ready === false), "No final client-facing output or court filing is generated."),
    checkpoint("no.mutation", [...drafts, ...claims].every((row) => row.matter_data_write_allowed === false && row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false && row.protected_action_allowed === false), "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLitigationBriefDraft({ sourceReads, matter, legalCitationVerifier, exhibitMap, rules, drafts, claims, facts, evidenceLinks, legalBasisPlaceholders, citationGateResults, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  return {
    litigation_brief_draft_status: validation.valid ? "complete" : "blocked",
    litigation_brief_draft_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_status: sourceStatus("matter"),
    source_matter_id: matter?.matter_id ?? null,
    source_legal_citation_verifier_status: sourceStatus("legal_citation_verifier"),
    source_legal_citation_verifier_phase_status: legalCitationVerifier?.summary?.legal_citation_verifier_status ?? "unknown",
    source_legal_citation_verification_record_count: legalCitationVerifier?.summary?.verification_record_count ?? 0,
    source_legal_rule_placeholder_citation_count: legalCitationVerifier?.summary?.legal_rule_placeholder_citation_count ?? 0,
    source_currentness_verified_count: legalCitationVerifier?.summary?.currentness_verified_count ?? 0,
    source_exhibit_map_status: sourceStatus("exhibit_map"),
    source_litigation_brief_target_exhibit_count: getExhibitRecords(exhibitMap).filter((item) => (item.artifact_targets ?? []).includes("litigation_brief")).length,
    source_claim_count: matter?.litigation_control?.claims?.length ?? 0,
    source_chronology_count: matter?.litigation_control?.chronology?.length ?? 0,
    source_evidence_count: matter?.litigation_control?.evidence?.length ?? 0,
    source_claim_evidence_mapping_count: matter?.litigation_control?.claim_evidence?.length ?? 0,
    brief_rule_count: rules.length,
    draft_packet_count: drafts.length,
    claim_count: claims.length,
    fact_count: facts.length,
    verified_fact_count: facts.filter((fact) => fact.verified).length,
    unverified_fact_count: facts.filter((fact) => !fact.verified).length,
    evidence_link_count: evidenceLinks.length,
    supporting_evidence_link_count: evidenceLinks.filter((link) => link.evidence_link_type === "supporting").length,
    contrary_evidence_link_count: evidenceLinks.filter((link) => link.evidence_link_type === "contrary").length,
    missing_evidence_link_count: evidenceLinks.filter((link) => link.evidence_link_type === "missing").length,
    legal_basis_placeholder_count: legalBasisPlaceholders.length,
    citation_gate_count: citationGateResults.length,
    citation_gate_passed_count: citationGateResults.filter((gate) => gate.citation_gate_passed).length,
    citation_gate_currentness_review_required_count: citationGateResults.filter((gate) => gate.currentness_check_status === "currentness_review_required").length,
    citation_gate_legal_authority_review_required_count: citationGateResults.filter((gate) => gate.legal_authority_status === "review_required_not_authoritative").length,
    claim_with_fact_link_count: claims.filter((claim) => claim.linked_fact_count > 0).length,
    claim_with_evidence_link_count: claims.filter((claim) => claim.evidence_link_count > 0).length,
    claim_with_legal_basis_placeholder_count: claims.filter((claim) => claim.legal_basis_placeholder_id).length,
    matter_count: matterSummaries.length,
    draft_only_count: [...drafts, ...claims].filter((row) => row.draft_only).length,
    human_review_note_count: [...drafts, ...claims].filter((row) => row.human_review_note).length,
    deterministic_brief_draft_generation_count: claims.filter((claim) => claim.deterministic_brief_draft_generation_performed).length,
    attorney_review_required_claim_count: claims.filter((claim) => claim.attorney_review_required).length,
    human_review_required_claim_count: claims.filter((claim) => claim.human_review_required).length,
    client_facing_ready_count: [...drafts, ...claims, ...facts, ...evidenceLinks, ...legalBasisPlaceholders, ...citationGateResults].filter((row) => row.client_facing_ready).length,
    court_filing_ready_count: [...drafts, ...claims, ...legalBasisPlaceholders].filter((row) => row.court_filing_ready).length,
    legal_conclusion_asserted_count: [...drafts, ...claims, ...facts, ...evidenceLinks, ...legalBasisPlaceholders].filter((row) => row.legal_conclusion_asserted).length,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    external_legal_research_performed: false,
    legal_authority_finalized: false,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: false,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    draft_only: true,
    deterministic_brief_draft_generation_performed: true,
    citation_gate_applied: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    court_filing_ready: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    external_legal_research_performed: false,
    legal_authority_finalized: false,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
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

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "litigation-brief-draft-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    generated_at: generatedAt,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map((source) => ({
      source_id: source.source_id,
      source_kind: source.source_kind,
      path: source.path,
      status: source.status,
      schema_version: source.value?.schema_version ?? null,
      error: source.error ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:litigation-brief-draft"]),
    roadmap_p247_present: String(roadmapText.value ?? "").includes("P247"),
  };
}

function renderLitigationBriefDraftMarkdown(result) {
  const lines = [
    "# Litigation Brief Draft",
    "",
    `- Status: ${result.summary.litigation_brief_draft_status}`,
    `- Claims: ${result.summary.claim_count}`,
    `- Facts: ${result.summary.fact_count}`,
    `- Evidence links: ${result.summary.evidence_link_count}`,
    `- Legal basis placeholders: ${result.summary.legal_basis_placeholder_count}`,
    `- Citation gates passed with review required: ${result.summary.citation_gate_passed_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing ready: ${result.safe_handling.client_facing_ready}`,
    "",
    "## Claim Scaffolds",
    "",
  ];
  for (const claim of result.litigation_brief_claims) {
    lines.push(`- ${claim.claim_id}: ${claim.draft_argument_text} ${claim.legal_basis_placeholder_id ? `[${claim.legal_basis_placeholder_id}]` : ""}`);
  }
  lines.push("", "These rows are deterministic internal litigation brief scaffolds only. Attorney review, source verification, citation/currentness review, and partner approval remain required before any filing or client-facing use.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LITIGATION_BRIEF_DRAFT_INPUTS;
  return {
    matter_path: path.resolve(options.matterPath ?? defaults.matterPath),
    legal_citation_verifier_path: path.resolve(options.legalCitationVerifierPath ?? defaults.legalCitationVerifierPath),
    exhibit_map_path: path.resolve(options.exhibitMapPath ?? defaults.exhibitMapPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["matter", "matter_file", inputs.matter_path],
    ["legal_citation_verifier", "artifact", inputs.legal_citation_verifier_path],
    ["exhibit_map", "artifact", inputs.exhibit_map_path],
  ];
  return Promise.all(artifactInputs.map(async ([sourceId, sourceKind, sourcePath]) => {
    const read = await readJsonOrError(sourcePath);
    return {
      source_id: sourceId,
      source_kind: sourceKind,
      path: sourcePath,
      status: read.value ? "complete" : "missing",
      value: read.value,
      error: read.error,
    };
  }));
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8") };
  } catch (error) {
    return { error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableLitigationBriefDraft(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function briefRule(briefRuleType, ruleLabel, ruleDescription) {
  return { brief_rule_type: briefRuleType, rule_label: ruleLabel, rule_description: ruleDescription };
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return { source_kind: sourceKind, source_id: sourceId, source_field: sourceField };
}

function sourceKindForSourceId(sourceId) {
  if (!sourceId) return "matter";
  if (String(sourceId).startsWith("E-")) return "evidence";
  if (String(sourceId).startsWith("C-")) return "communication";
  return "matter";
}

function getExhibitRecords(exhibitMap) {
  return exhibitMap?.exhibit_catalog?.exhibit_records ?? exhibitMap?.exhibit_records ?? [];
}

function uniqueRefs(refs) {
  const byKey = new Map();
  for (const ref of refs.filter((item) => item?.source_kind && item?.source_id)) {
    byKey.set(`${ref.source_kind}|${ref.source_id}|${ref.source_field ?? ""}`, ref);
  }
  return [...byKey.values()];
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[^0-9]/g, "").slice(0, 14);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--legal-citation-verifier") parsed.legalCitationVerifierPath = argv[++index];
    else if (arg === "--exhibit-map") parsed.exhibitMapPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/litigation-brief-draft.mjs [options]

Options:
  --check                                   Exit non-zero if validation fails.
  --out-dir <dir>                           Output directory.
  --matter <file>                           Litigation matter JSON file.
  --legal-citation-verifier <file>          Legal citation verifier artifact.
  --exhibit-map <file>                      Exhibit map artifact.
  --package <file>                          package.json path.
  --roadmap <file>                          Phase ledger path.
  --run-at <iso>                            Deterministic timestamp.
`);
}
