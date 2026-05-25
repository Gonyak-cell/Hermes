import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_TAGGING_DECISION_LEDGER_OUT_DIR = "artifacts/matter-tagging/latest";
export const DEFAULT_MATTER_TAGGING_DECISION_LEDGER_INPUTS = {
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
};

export async function runMatterTaggingDecisionLedger(options = {}) {
  const result = await buildMatterTaggingDecisionLedger(options);
  if (options.write !== false) await writeMatterTaggingDecisionLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter tagging decision ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterTaggingDecisionLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_TAGGING_DECISION_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceContractFreeze = await readJson(inputs.resource_contract_freeze_path);
  const matterProfileTeamLedger = await readJson(inputs.matter_profile_team_ledger_path);
  const matterAccessPolicyEvaluator = await readJson(inputs.matter_access_policy_evaluator_path);
  const dataClassificationRuleEngine = await readJson(inputs.data_classification_rule_engine_path);
  const projected = projectMatterTaggingDecisions({
    resourceContractFreeze,
    matterProfileTeamLedger,
    matterAccessPolicyEvaluator,
    dataClassificationRuleEngine,
    generatedAt,
  });
  const validationItems = validateMatterTaggingDecisions({
    resourceContractFreeze,
    matterProfileTeamLedger,
    matterAccessPolicyEvaluator,
    dataClassificationRuleEngine,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "matter-tagging-decision-ledger.v1",
    generated_at: generatedAt,
    matter_tagging_ledger_id: `matter-tagging-decision-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_contract: summarizeResourceContractSource(resourceContractFreeze),
    source_matter_profile_team_ledger: summarizeMatterProfileTeamSource(matterProfileTeamLedger),
    source_matter_access_policy: summarizeMatterAccessPolicySource(matterAccessPolicyEvaluator),
    source_data_classification_rule_engine: summarizeDataClassificationSource(dataClassificationRuleEngine),
    matter_tagging_catalog: {
      schema_version: "matter-tagging-catalog.v1",
      generated_at: generatedAt,
      matter_tagging_decisions: projected.matterTaggingDecisions,
      automatic_tagging_candidates: projected.automaticTaggingCandidates,
      human_confirmation_queue: projected.humanConfirmationQueue,
      correction_history: projected.correctionHistory,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeMatterTaggingDecisions(projected, validationItems, validation, {
      resourceContractFreeze,
      matterProfileTeamLedger,
      matterAccessPolicyEvaluator,
      dataClassificationRuleEngine,
    }),
  };
  return {
    ...result,
    markdown: renderMatterTaggingDecisionLedgerMarkdown(result),
  };
}

export async function writeMatterTaggingDecisionLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "matter-tagging-ledger.json"), serializable);
  await writeJson(path.join(outDir, "matter-tagging-catalog.json"), serializable.matter_tagging_catalog);
  await writeJson(path.join(outDir, "matter-tagging-decisions.json"), {
    generated_at: result.generated_at,
    matter_tagging_decision_count: result.matter_tagging_catalog.matter_tagging_decisions.length,
    matter_tagging_decisions: result.matter_tagging_catalog.matter_tagging_decisions,
  });
  await writeJson(path.join(outDir, "matter-tagging-candidates.json"), {
    generated_at: result.generated_at,
    automatic_candidate_count: result.matter_tagging_catalog.automatic_tagging_candidates.length,
    automatic_tagging_candidates: result.matter_tagging_catalog.automatic_tagging_candidates,
  });
  await writeJson(path.join(outDir, "matter-tagging-confirmations.json"), {
    generated_at: result.generated_at,
    human_confirmation_request_count: result.matter_tagging_catalog.human_confirmation_queue.length,
    human_confirmation_queue: result.matter_tagging_catalog.human_confirmation_queue,
  });
  await writeJson(path.join(outDir, "matter-tagging-corrections.json"), {
    generated_at: result.generated_at,
    correction_history_count: result.matter_tagging_catalog.correction_history.length,
    correction_history: result.matter_tagging_catalog.correction_history,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    matter_tagging_ledger_id: result.matter_tagging_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterTaggingDecisionLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterTaggingDecisionLedger(args);
    console.log(`Matter tagging decision ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_tagging_ledger_status}`);
    console.log(`Decisions: ${result.summary.matter_tagging_decision_count}`);
    console.log(`Automatic candidates: ${result.summary.automatic_candidate_count}`);
    console.log(`Pending human confirmation: ${result.summary.pending_human_confirmation_count}`);
    console.log(`Corrections: ${result.summary.correction_history_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectMatterTaggingDecisions({
  resourceContractFreeze,
  matterProfileTeamLedger,
  matterAccessPolicyEvaluator,
  dataClassificationRuleEngine,
  generatedAt,
}) {
  const resources = resourceContractFreeze.resource_contract?.resources ?? [];
  const matterProfiles = matterProfileTeamLedger.matter_team_contract?.matter_profiles ?? [];
  const resourceAccessDecisions = matterAccessPolicyEvaluator.matter_access_policy?.resource_access_decisions ?? [];
  const resourceClassificationDecisions = dataClassificationRuleEngine.classification_rule_catalog?.resource_classification_decisions ?? [];
  const profileByMatterId = new Map(matterProfiles.map((profile) => [profile.matter_id, profile]));
  const accessByResourceId = groupBy(resourceAccessDecisions, "resource_id");
  const classificationDecisionByResourceId = new Map(resourceClassificationDecisions.map((decision) => [decision.resource_id, decision]));

  const automaticTaggingCandidates = [];
  const matterTaggingDecisions = [];
  const humanConfirmationQueue = [];

  for (const resource of resources) {
    const accessDecisions = accessByResourceId.get(resource.resource_id) ?? [];
    const candidates = buildCandidatesForResource({
      resource,
      accessDecisions,
      profileByMatterId,
      generatedAt,
    });
    automaticTaggingCandidates.push(...candidates);
    const selectedCandidate = candidates[0] ?? null;
    const classificationDecision = classificationDecisionByResourceId.get(resource.resource_id) ?? null;
    const decision = buildMatterTaggingDecision({
      resource,
      selectedCandidate,
      classificationDecision,
      generatedAt,
    });
    matterTaggingDecisions.push(decision);
    if (decision.human_confirmation_required) {
      humanConfirmationQueue.push(buildHumanConfirmationRequest({
        decision,
        selectedCandidate,
        profileByMatterId,
        generatedAt,
      }));
    }
  }

  return {
    resources,
    matterProfiles,
    resourceAccessDecisions,
    resourceClassificationDecisions,
    matterTaggingDecisions: matterTaggingDecisions.sort(by("matter_tagging_decision_id")),
    automaticTaggingCandidates: automaticTaggingCandidates.sort(by("matter_tagging_candidate_id")),
    humanConfirmationQueue: humanConfirmationQueue.sort(by("matter_tagging_confirmation_id")),
    correctionHistory: [],
  };
}

function buildCandidatesForResource({ resource, accessDecisions, profileByMatterId, generatedAt }) {
  const byTargetMatter = groupBy(accessDecisions, "target_matter_id");
  const candidates = [];
  for (const [targetMatterId, decisions] of byTargetMatter.entries()) {
    if (!targetMatterId || targetMatterId === "unknown") continue;
    const profile = profileByMatterId.get(targetMatterId);
    const reviewCount = decisions.filter((decision) => decision.access_decision === "review").length;
    const gateNames = unique(decisions.flatMap((decision) => decision.required_gates ?? []));
    const matterTaggingGatePresent = gateNames.includes("matter_tagging_gate");
    const profileKnown = Boolean(profile);
    const proposedTenantId = profile?.tenant_id ?? decisions.find((decision) => decision.tenant_id)?.tenant_id ?? null;
    const tenantBoundaryMismatch = Boolean(resource.tenant_id && proposedTenantId && resource.tenant_id !== proposedTenantId);
    const score = candidateScore({
      totalDecisions: decisions.length,
      reviewCount,
      gateCount: gateNames.length,
      matterTaggingGatePresent,
      profileKnown,
      tenantBoundaryMismatch,
    });
    const candidateStatus = resource.matter_id === targetMatterId
      ? "already_current"
      : "requires_human_confirmation";
    candidates.push({
      schema_version: "matter-tagging-candidate.v1",
      matter_tagging_candidate_id: `matter-tagging-candidate.${slugify(resource.resource_id)}.${slugify(targetMatterId)}`,
      resource_id: resource.resource_id,
      resource_version_id: resource.latest_resource_version_id,
      current_matter_id: resource.matter_id,
      proposed_matter_id: targetMatterId,
      current_tenant_id: resource.tenant_id,
      proposed_tenant_id: proposedTenantId,
      matter_profile_id: profile?.matter_profile_id ?? null,
      client_id: profile?.client_id ?? decisions.find((decision) => decision.client_id)?.client_id ?? null,
      candidate_status: candidateStatus,
      confidence: score,
      score,
      evidence_signals: {
        resource_access_decision_count: decisions.length,
        review_access_decision_count: reviewCount,
        matter_tagging_gate_present: matterTaggingGatePresent,
        matter_profile_known: profileKnown,
        tenant_boundary_mismatch: tenantBoundaryMismatch,
        policy_snapshot_ids: unique(decisions.map((decision) => decision.policy_snapshot_id).filter(Boolean)),
        runtime_ids: unique(decisions.map((decision) => decision.runtime_id).filter(Boolean)),
        required_gates: gateNames,
      },
      linked_resource_access_decision_ids: decisions.map((decision) => decision.resource_access_decision_id).filter(Boolean).sort(),
      reason_codes: unique([
        "matter_access_candidate_found",
        ...(matterTaggingGatePresent ? ["matter_tagging_gate_required"] : []),
        ...(profileKnown ? ["matter_profile_resolved"] : ["matter_profile_missing"]),
        ...(tenantBoundaryMismatch ? ["tenant_boundary_mismatch"] : []),
        ...(candidateStatus === "requires_human_confirmation" ? ["human_confirmation_required"] : []),
      ]),
      proposed_at: generatedAt,
      metadata: {
        source_uri: resource.source_uri,
        source_system: resource.source_system,
      },
    });
  }
  return candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.matter_tagging_candidate_id.localeCompare(right.matter_tagging_candidate_id);
  });
}

function buildMatterTaggingDecision({ resource, selectedCandidate, classificationDecision, generatedAt }) {
  const currentMatterUnassigned = isUnassignedMatter(resource.matter_id);
  const proposedMatterId = selectedCandidate?.proposed_matter_id ?? null;
  const alreadyCurrent = proposedMatterId && resource.matter_id === proposedMatterId;
  const hasCandidate = Boolean(selectedCandidate);
  const humanConfirmationRequired = Boolean(hasCandidate && !alreadyCurrent)
    || currentMatterUnassigned;
  const taggingStatus = alreadyCurrent
    ? "confirmed"
    : hasCandidate
      ? "pending_human_confirmation"
      : "no_candidate";
  const autoTaggingStatus = alreadyCurrent
    ? "not_required"
    : hasCandidate
      ? "candidate_generated"
      : "no_candidate";
  const autoApplyAllowed = false;
  const reasonCodes = unique([
    ...(currentMatterUnassigned ? ["resource_current_matter_unassigned"] : []),
    ...(hasCandidate ? ["matter_access_candidate_found"] : ["matter_access_candidate_missing"]),
    ...(selectedCandidate?.evidence_signals?.matter_tagging_gate_present ? ["matter_tagging_gate_required"] : []),
    ...(selectedCandidate?.evidence_signals?.tenant_boundary_mismatch ? ["tenant_boundary_mismatch"] : []),
    ...(humanConfirmationRequired ? ["human_confirmation_required"] : []),
    ...(autoApplyAllowed ? ["auto_apply_allowed"] : ["auto_apply_blocked"]),
  ]);
  return {
    schema_version: "matter-tagging-decision.v1",
    matter_tagging_decision_id: `matter-tagging-decision.${slugify(resource.resource_id)}`,
    resource_id: resource.resource_id,
    resource_version_id: resource.latest_resource_version_id,
    current_matter_id: resource.matter_id,
    proposed_matter_id: proposedMatterId,
    current_tenant_id: resource.tenant_id,
    proposed_tenant_id: selectedCandidate?.proposed_tenant_id ?? null,
    source_system: resource.source_system,
    source_uri: resource.source_uri,
    classification: resource.classification,
    classification_source: resource.classification_source,
    policy_snapshot_id: resource.policy_snapshot_id ?? classificationDecision?.policy_snapshot_id ?? null,
    resource_classification_decision_id: classificationDecision?.resource_classification_decision_id ?? null,
    selected_candidate_id: selectedCandidate?.matter_tagging_candidate_id ?? null,
    tagging_status: taggingStatus,
    auto_tagging_status: autoTaggingStatus,
    human_confirmation_required: humanConfirmationRequired,
    auto_apply_allowed: autoApplyAllowed,
    protected_action: "resource.matter_tag.apply",
    linked_resource_access_decision_ids: selectedCandidate?.linked_resource_access_decision_ids ?? [],
    reason_codes: reasonCodes,
    decided_at: generatedAt,
    metadata: {
      external_id: resource.external_id,
      relative_path: resource.metadata?.relative_path ?? null,
      candidate_confidence: selectedCandidate?.confidence ?? null,
    },
  };
}

function buildHumanConfirmationRequest({ decision, selectedCandidate, profileByMatterId, generatedAt }) {
  const profile = selectedCandidate?.proposed_matter_id
    ? profileByMatterId.get(selectedCandidate.proposed_matter_id)
    : null;
  const assignedUserIds = unique([
    ...(profile?.responsible_partner_user_ids ?? []),
    ...(profile?.reviewer_user_ids ?? []),
    ...(profile?.team_member_user_ids ?? []),
  ]);
  return {
    schema_version: "matter-tagging-confirmation.v1",
    matter_tagging_confirmation_id: `matter-tagging-confirmation.${slugify(decision.resource_id)}`,
    matter_tagging_decision_id: decision.matter_tagging_decision_id,
    matter_tagging_candidate_id: selectedCandidate?.matter_tagging_candidate_id ?? null,
    resource_id: decision.resource_id,
    current_matter_id: decision.current_matter_id,
    proposed_matter_id: decision.proposed_matter_id,
    current_tenant_id: decision.current_tenant_id,
    proposed_tenant_id: decision.proposed_tenant_id,
    confirmation_status: "pending",
    required_actor_role: "responsible_partner_or_matter_reviewer",
    assigned_user_ids: assignedUserIds,
    protected_action: decision.protected_action,
    auto_apply_allowed: false,
    required_gates: ["matter_tagging_gate", "human_approval_gate"],
    reason_codes: unique([
      ...decision.reason_codes,
      "manual_confirmation_required_before_matter_tag_apply",
    ]),
    requested_at: generatedAt,
    metadata: {
      source_uri: decision.source_uri,
      classification: decision.classification,
    },
  };
}

function validateMatterTaggingDecisions({
  resourceContractFreeze,
  matterProfileTeamLedger,
  matterAccessPolicyEvaluator,
  dataClassificationRuleEngine,
  projected,
}) {
  const validationItems = [];
  const resourceIds = new Set(projected.resources.map((resource) => resource.resource_id));
  const matterIds = new Set(projected.matterProfiles.map((profile) => profile.matter_id));
  const decisionsByResourceId = new Map(projected.matterTaggingDecisions.map((decision) => [decision.resource_id, decision]));
  const confirmationsByDecisionId = new Map(projected.humanConfirmationQueue.map((confirmation) => [confirmation.matter_tagging_decision_id, confirmation]));

  pushCheck(validationItems, "source", resourceContractFreeze.freeze_id ?? "resource-contract-freeze", "resource_contract_complete", resourceContractFreeze.summary?.freeze_status === "complete", "Matter tagging requires a complete Resource contract freeze.");
  pushCheck(validationItems, "source", matterProfileTeamLedger.ledger_id ?? "matter-profile-team-ledger", "matter_profile_team_ledger_complete", matterProfileTeamLedger.summary?.ledger_status === "complete", "Matter tagging requires a complete Matter Profile/Team Ledger.");
  pushCheck(validationItems, "source", matterAccessPolicyEvaluator.access_policy_ledger_id ?? "matter-access-policy-evaluator", "matter_access_policy_complete", matterAccessPolicyEvaluator.summary?.access_policy_status === "complete", "Matter tagging requires a complete Matter Access Policy Evaluator.");
  pushCheck(validationItems, "source", dataClassificationRuleEngine.classification_rule_engine_id ?? "data-classification-rule-engine", "data_classification_rule_engine_complete", dataClassificationRuleEngine.summary?.classification_rule_engine_status === "complete", "Matter tagging requires a complete Data Classification Rule Engine.");

  pushUniqueIdChecks(validationItems, projected.matterTaggingDecisions, "matter_tagging_decision", "matter_tagging_decision_id");
  pushUniqueIdChecks(validationItems, projected.automaticTaggingCandidates, "matter_tagging_candidate", "matter_tagging_candidate_id");
  pushUniqueIdChecks(validationItems, projected.humanConfirmationQueue, "matter_tagging_confirmation", "matter_tagging_confirmation_id");

  for (const resource of projected.resources) {
    const decision = decisionsByResourceId.get(resource.resource_id);
    pushCheck(validationItems, "resource", resource.resource_id, "matter_tagging_decision_present", Boolean(decision), "Every resource must have one matter tagging decision.");
    if (!decision) continue;
    pushCheck(validationItems, "resource", resource.resource_id, "decision_resource_known", resourceIds.has(decision.resource_id), "Matter tagging decision must reference a known resource.");
    pushCheck(validationItems, "resource", resource.resource_id, "unassigned_resource_not_auto_applied", !isUnassignedMatter(resource.matter_id) || decision.auto_apply_allowed === false, "Unassigned resources must not be auto-applied to a matter.");
    pushCheck(validationItems, "resource", resource.resource_id, "unassigned_resource_requires_confirmation", !isUnassignedMatter(resource.matter_id) || decision.human_confirmation_required === true, "Unassigned resources must require human confirmation before matter tagging.");
  }

  for (const candidate of projected.automaticTaggingCandidates) {
    pushCheck(validationItems, "matter_tagging_candidate", candidate.matter_tagging_candidate_id, "candidate_resource_known", resourceIds.has(candidate.resource_id), "Matter tagging candidate must reference a known resource.");
    pushCheck(validationItems, "matter_tagging_candidate", candidate.matter_tagging_candidate_id, "candidate_matter_profile_known", matterIds.has(candidate.proposed_matter_id), "Matter tagging candidate proposed matter must have a known matter profile.");
    pushCheck(validationItems, "matter_tagging_candidate", candidate.matter_tagging_candidate_id, "candidate_needs_human_confirmation", candidate.candidate_status !== "requires_human_confirmation" || candidate.reason_codes.includes("human_confirmation_required"), "Automatic candidate must mark human confirmation when it is not already current.");
  }

  const pendingDecisions = projected.matterTaggingDecisions.filter((decision) => decision.tagging_status === "pending_human_confirmation");
  for (const decision of pendingDecisions) {
    const confirmation = confirmationsByDecisionId.get(decision.matter_tagging_decision_id);
    pushCheck(validationItems, "matter_tagging_decision", decision.matter_tagging_decision_id, "pending_decision_has_confirmation", Boolean(confirmation), "Pending matter tagging decisions must have a human confirmation request.");
    pushCheck(validationItems, "matter_tagging_decision", decision.matter_tagging_decision_id, "pending_decision_not_auto_applied", decision.auto_apply_allowed === false, "Pending matter tagging decisions must not allow auto-apply.");
  }

  pushCheck(validationItems, "correction_history", "matter-tagging-correction-history", "correction_history_separate_collection", Array.isArray(projected.correctionHistory), "Correction history must be a separate collection even when empty.");
  pushCheck(validationItems, "confirmation_queue", "matter-tagging-confirmation-queue", "confirmation_queue_matches_pending_decisions", projected.humanConfirmationQueue.length === pendingDecisions.length, "Human confirmation queue must match pending matter tagging decisions.");
  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.resources.length === 0) errors.push({ path: "source_resource_contract.resources", message: "At least one resource is required for matter tagging." });
  if (projected.matterTaggingDecisions.length === 0) errors.push({ path: "matter_tagging_catalog.matter_tagging_decisions", message: "At least one matter tagging decision is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeMatterTaggingDecisions(projected, validationItems, validation, sources) {
  const decisions = projected.matterTaggingDecisions;
  const candidates = projected.automaticTaggingCandidates;
  const confirmations = projected.humanConfirmationQueue;
  const corrections = projected.correctionHistory;
  return {
    matter_tagging_ledger_status: validation.valid ? "complete" : "blocked",
    source_resource_contract_status: sources.resourceContractFreeze.summary?.freeze_status ?? "unknown",
    source_matter_profile_team_ledger_status: sources.matterProfileTeamLedger.summary?.ledger_status ?? "unknown",
    source_matter_access_policy_status: sources.matterAccessPolicyEvaluator.summary?.access_policy_status ?? "unknown",
    source_data_classification_rule_engine_status: sources.dataClassificationRuleEngine.summary?.classification_rule_engine_status ?? "unknown",
    resource_count: projected.resources.length,
    matter_profile_count: projected.matterProfiles.length,
    resource_access_decision_count: projected.resourceAccessDecisions.length,
    resource_classification_decision_count: projected.resourceClassificationDecisions.length,
    matter_tagging_decision_count: decisions.length,
    automatic_candidate_count: candidates.length,
    pending_human_confirmation_count: decisions.filter((decision) => decision.tagging_status === "pending_human_confirmation").length,
    human_confirmation_request_count: confirmations.length,
    confirmed_decision_count: decisions.filter((decision) => decision.tagging_status === "confirmed").length,
    no_candidate_count: decisions.filter((decision) => decision.tagging_status === "no_candidate").length,
    auto_applied_count: decisions.filter((decision) => decision.auto_apply_allowed === true).length,
    correction_history_count: corrections.length,
    applied_correction_count: corrections.filter((correction) => correction.correction_status === "applied").length,
    pending_correction_count: corrections.filter((correction) => correction.correction_status === "pending").length,
    tenant_boundary_mismatch_count: decisions.filter((decision) => decision.reason_codes.includes("tenant_boundary_mismatch")).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_tagging_status: countBy(decisions, "tagging_status"),
    by_auto_tagging_status: countBy(decisions, "auto_tagging_status"),
    by_proposed_matter_id: countBy(decisions.filter((decision) => decision.proposed_matter_id), "proposed_matter_id"),
    by_current_matter_id: countBy(decisions, "current_matter_id"),
  };
}

function summarizeResourceContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    resource_count: source.summary?.resource_count ?? 0,
    resource_version_count: source.summary?.resource_version_count ?? 0,
    matter_link_count: source.summary?.matter_link_count ?? 0,
  };
}

function summarizeMatterProfileTeamSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    ledger_id: source.ledger_id ?? null,
    ledger_status: source.summary?.ledger_status ?? "unknown",
    matter_profile_count: source.summary?.matter_profile_count ?? 0,
    matter_team_roster_count: source.summary?.matter_team_roster_count ?? 0,
    matter_access_subject_count: source.summary?.matter_access_subject_count ?? 0,
  };
}

function summarizeMatterAccessPolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    access_policy_ledger_id: source.access_policy_ledger_id ?? null,
    access_policy_status: source.summary?.access_policy_status ?? "unknown",
    matter_access_decision_count: source.summary?.matter_access_decision_count ?? 0,
    resource_access_decision_count: source.summary?.resource_access_decision_count ?? 0,
    unassigned_resource_review_count: source.summary?.unassigned_resource_review_count ?? 0,
  };
}

function summarizeDataClassificationSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    classification_rule_engine_id: source.classification_rule_engine_id ?? null,
    classification_rule_engine_status: source.summary?.classification_rule_engine_status ?? "unknown",
    resource_classification_decision_count: source.summary?.resource_classification_decision_count ?? 0,
    matter_tagging_review_count: source.summary?.matter_tagging_review_count ?? 0,
  };
}

function renderMatterTaggingDecisionLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Matter Tagging Decision Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_tagging_ledger_status}`);
  lines.push("");
  lines.push(`- Resources: ${result.summary.resource_count}`);
  lines.push(`- Matter tagging decisions: ${result.summary.matter_tagging_decision_count}`);
  lines.push(`- Automatic candidates: ${result.summary.automatic_candidate_count}`);
  lines.push(`- Pending human confirmations: ${result.summary.pending_human_confirmation_count}`);
  lines.push(`- Correction history rows: ${result.summary.correction_history_count}`);
  lines.push(`- Auto-applied changes: ${result.summary.auto_applied_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Proposed Matter Counts");
  for (const [matterId, count] of Object.entries(result.summary.by_proposed_matter_id ?? {})) {
    lines.push(`- ${matterId}: ${count}`);
  }
  return `${lines.join("\n")}\n`;
}

function candidateScore({ totalDecisions, reviewCount, gateCount, matterTaggingGatePresent, profileKnown, tenantBoundaryMismatch }) {
  const reviewWeight = totalDecisions > 0 ? (reviewCount / totalDecisions) * 0.2 : 0;
  const gateWeight = Math.min(gateCount, 6) * 0.025;
  const score = 0.55
    + reviewWeight
    + gateWeight
    + (matterTaggingGatePresent ? 0.08 : 0)
    + (profileKnown ? 0.07 : 0)
    - (tenantBoundaryMismatch ? 0.05 : 0);
  return Math.round(Math.min(0.95, Math.max(0.05, score)) * 100) / 100;
}

function normalizeInputs(options) {
  return {
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_MATTER_TAGGING_DECISION_LEDGER_INPUTS.resourceContractFreezePath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_MATTER_TAGGING_DECISION_LEDGER_INPUTS.matterProfileTeamLedgerPath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_MATTER_TAGGING_DECISION_LEDGER_INPUTS.matterAccessPolicyEvaluatorPath),
    data_classification_rule_engine_path: path.resolve(options.dataClassificationRuleEnginePath ?? DEFAULT_MATTER_TAGGING_DECISION_LEDGER_INPUTS.dataClassificationRuleEnginePath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--data-classification-rules") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-tagging-decision-ledger.mjs [options]

Options:
  --resource-contract-freeze <path>       resource-contract-freeze.json path.
  --matter-profile-team-ledger <path>     matter-profile-team-ledger.json path.
  --matter-access-policy <path>           matter-access-policy-evaluator.json path.
  --data-classification-rules <path>      data-classification-rule-engine.json path.
  --out-dir <path>                        Output directory.
  --run-at <iso>                          Deterministic timestamp.
  --check                                 Exit non-zero when validation fails.
  --no-write                              Build without writing artifacts.
`);
}

function serializableLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function isUnassignedMatter(matterId) {
  return !matterId || String(matterId).includes(".unassigned.");
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the ledger.`);
    }
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `matter-tagging-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set((values ?? []).filter((value) => value !== null && value !== undefined))].sort();
}

function slugify(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
