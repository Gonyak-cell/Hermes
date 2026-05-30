import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DATA_CLASSIFICATION_RULE_ENGINE_OUT_DIR = "artifacts/data-classification-rules/latest";
export const DEFAULT_DATA_CLASSIFICATION_RULE_ENGINE_INPUTS = {
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  policyContractFreezePath: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
};

const DECISIONS = new Set(["allow", "review", "deny"]);
const EXTERNAL_MODEL_POLICIES = new Set(["allowed_with_audit", "approval_required", "forbidden"]);

export async function runDataClassificationRuleEngine(options = {}) {
  const result = await buildDataClassificationRuleEngine(options);
  if (options.write !== false) await writeDataClassificationRuleEngine(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Data classification rule engine failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDataClassificationRuleEngine(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DATA_CLASSIFICATION_RULE_ENGINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceContractFreeze = await readJson(inputs.resource_contract_freeze_path);
  const policyContractFreeze = await readJson(inputs.policy_contract_freeze_path);
  const matterAccessPolicyEvaluator = await readJson(inputs.matter_access_policy_evaluator_path);
  const projected = projectDataClassificationRules({
    resourceContractFreeze,
    policyContractFreeze,
    matterAccessPolicyEvaluator,
    generatedAt,
  });
  const validationItems = validateDataClassificationRules({
    resourceContractFreeze,
    policyContractFreeze,
    matterAccessPolicyEvaluator,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "data-classification-rule-engine.v1",
    generated_at: generatedAt,
    classification_rule_engine_id: `data-classification-rule-engine.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_contract: summarizeResourceContractSource(resourceContractFreeze),
    source_policy_contract: summarizePolicyContractSource(policyContractFreeze),
    source_matter_access_policy: summarizeMatterAccessPolicySource(matterAccessPolicyEvaluator),
    classification_rule_catalog: {
      schema_version: "data-classification-rule-catalog.v1",
      generated_at: generatedAt,
      classification_rules: projected.classificationRules,
      resource_classification_decisions: projected.resourceClassificationDecisions,
      classification_policy_bindings: projected.classificationPolicyBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeDataClassificationRules(projected, validationItems, validation, {
      resourceContractFreeze,
      policyContractFreeze,
      matterAccessPolicyEvaluator,
    }),
  };
  return {
    ...result,
    markdown: renderDataClassificationRuleEngineMarkdown(result),
  };
}

export async function writeDataClassificationRuleEngine(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "data-classification-rule-engine.json"), serializable);
  await writeJson(path.join(outDir, "classification-rule-catalog.json"), serializable.classification_rule_catalog);
  await writeJson(path.join(outDir, "classification-rules.json"), {
    generated_at: result.generated_at,
    classification_rule_count: result.classification_rule_catalog.classification_rules.length,
    classification_rules: result.classification_rule_catalog.classification_rules,
  });
  await writeJson(path.join(outDir, "resource-classification-decisions.json"), {
    generated_at: result.generated_at,
    resource_classification_decision_count: result.classification_rule_catalog.resource_classification_decisions.length,
    resource_classification_decisions: result.classification_rule_catalog.resource_classification_decisions,
  });
  await writeJson(path.join(outDir, "classification-policy-bindings.json"), {
    generated_at: result.generated_at,
    classification_policy_binding_count: result.classification_rule_catalog.classification_policy_bindings.length,
    classification_policy_bindings: result.classification_rule_catalog.classification_policy_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    classification_rule_engine_id: result.classification_rule_engine_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDataClassificationRuleEngineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runDataClassificationRuleEngine(args);
    console.log(`Data classification rule engine written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.classification_rule_engine_status}`);
    console.log(`Classification rules: ${result.summary.classification_rule_count}`);
    console.log(`Resource decisions: ${result.summary.resource_classification_decision_count}`);
    console.log(`Policy bindings: ${result.summary.classification_policy_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectDataClassificationRules({
  resourceContractFreeze,
  policyContractFreeze,
  matterAccessPolicyEvaluator,
  generatedAt,
}) {
  const resources = resourceContractFreeze.resource_contract?.resources ?? [];
  const dataClassifications = policyContractFreeze.policy_contract?.data_classifications ?? [];
  const policyDecisions = policyContractFreeze.policy_contract?.policy_decisions ?? [];
  const policyReferences = policyContractFreeze.policy_contract?.policy_references ?? [];
  const resourceAccessDecisions = matterAccessPolicyEvaluator.matter_access_policy?.resource_access_decisions ?? [];

  const policyDecisionByClassification = new Map(policyDecisions.map((decision) => [decision.classification, decision]));
  const resourcePolicyReferenceByResourceId = new Map(
    policyReferences
      .filter((reference) => reference.reference_type === "resource" && reference.subject_type === "resource")
      .map((reference) => [reference.subject_id, reference]),
  );
  const accessDecisionsByResourceId = groupBy(resourceAccessDecisions, "resource_id");

  const classificationRules = dataClassifications.map((classification) => {
    const policyDecision = policyDecisionByClassification.get(classification.classification);
    return buildClassificationRule({ classification, policyDecision, generatedAt });
  }).sort(by("classification_rule_id"));
  const classificationRuleByClassification = new Map(classificationRules.map((rule) => [rule.classification, rule]));

  const resourceClassificationDecisions = resources.map((resource) => {
    const policyReference = resourcePolicyReferenceByResourceId.get(resource.resource_id);
    const policyDecision = policyDecisionByClassification.get(resource.classification);
    const classificationRule = classificationRuleByClassification.get(resource.classification);
    const matterAccessDecisions = accessDecisionsByResourceId.get(resource.resource_id) ?? [];
    return buildResourceClassificationDecision({
      resource,
      policyReference,
      policyDecision,
      classificationRule,
      matterAccessDecisions,
      generatedAt,
    });
  }).sort(by("resource_classification_decision_id"));

  const resourceDecisionsByClassification = groupBy(resourceClassificationDecisions, "effective_classification");
  const policyReferencesByClassification = groupBy(
    policyReferences.filter((reference) => reference.reference_type === "resource" && reference.subject_type === "resource"),
    "classification",
  );
  const classificationPolicyBindings = classificationRules.map((classificationRule) => {
    const decisions = resourceDecisionsByClassification.get(classificationRule.classification) ?? [];
    const references = policyReferencesByClassification.get(classificationRule.classification) ?? [];
    return buildClassificationPolicyBinding({
      classificationRule,
      resourceClassificationDecisions: decisions,
      policyReferences: references,
      generatedAt,
    });
  }).sort(by("classification_policy_binding_id"));

  return {
    resources,
    dataClassifications,
    policyDecisions,
    policyReferences,
    resourceAccessDecisions,
    classificationRules,
    resourceClassificationDecisions,
    classificationPolicyBindings,
  };
}

function buildClassificationRule({ classification, policyDecision, generatedAt }) {
  const externalModelDecision = externalModelDecisionFor(policyDecision?.external_model_policy ?? classification.external_model_policy);
  const defaultPolicyDecision = defaultPolicyDecisionFor(policyDecision);
  return {
    schema_version: "data-classification-rule.v1",
    classification_rule_id: `data-classification-rule.${slugify(classification.classification)}`,
    classification: classification.classification,
    ordinal: classification.ordinal,
    classification_name: classification.name,
    policy_decision_id: policyDecision?.decision_id ?? null,
    runtime_rule_id: classification.runtime_rule_id ?? policyDecision?.runtime_rule_id ?? null,
    model_rule_id: classification.model_rule_id ?? null,
    default_external_model_policy: classification.default_external_model_policy,
    external_model_policy: policyDecision?.external_model_policy ?? classification.external_model_policy ?? null,
    external_model_decision: externalModelDecision,
    local_model_policy: policyDecision?.local_model_policy ?? classification.local_model_policy ?? null,
    redaction_policy: policyDecision?.redaction_policy ?? classification.redaction_policy ?? null,
    default_policy_decision: defaultPolicyDecision,
    allowed_runtimes: arrayValue(policyDecision?.allowed_runtimes ?? classification.allowed_runtimes),
    restricted_runtimes: arrayValue(policyDecision?.restricted_runtimes ?? classification.restricted_runtimes),
    forbidden_runtimes: arrayValue(policyDecision?.forbidden_runtimes ?? classification.forbidden_runtimes),
    required_gates: unique(policyDecision?.required_gates ?? classification.required_gates ?? []),
    blocking_gate_ids: unique(classification.blocking_gate_ids ?? []),
    approval_required: Boolean(policyDecision?.approval_required ?? classification.approval_required),
    redaction_required: (policyDecision?.redaction_policy ?? classification.redaction_policy) === "required",
    rule_status: policyDecision ? "active" : "blocked",
    created_at: generatedAt,
    metadata: {},
  };
}

function buildResourceClassificationDecision({
  resource,
  policyReference,
  policyDecision,
  classificationRule,
  matterAccessDecisions,
  generatedAt,
}) {
  const reasonCodes = [];
  const externalModelDecision = externalModelDecisionFor(policyDecision?.external_model_policy);
  let policyDecisionValue = defaultPolicyDecisionFor(policyDecision);
  let contextMode = contextModeFor(policyDecision, externalModelDecision);

  if (policyReference?.reference_status === "resolved") reasonCodes.push("policy_reference_resolved");
  else reasonCodes.push("policy_reference_missing_or_unresolved");

  if (classificationRule?.rule_status === "active" && policyDecision) reasonCodes.push("classification_policy_resolved");
  else reasonCodes.push("classification_policy_missing");

  if (isUnassignedMatter(resource.matter_id)) {
    policyDecisionValue = "review";
    contextMode = "review_required";
    reasonCodes.push("resource_matter_tagging_required");
  }

  if (externalModelDecision === "deny") reasonCodes.push("external_model_forbidden");
  if (externalModelDecision === "review") reasonCodes.push("external_model_approval_required");
  if (externalModelDecision === "allow") reasonCodes.push("external_model_allowed_with_audit");

  const requiredGates = unique([
    ...(classificationRule?.required_gates ?? []),
    ...(isUnassignedMatter(resource.matter_id) ? ["matter_tagging_gate", "human_approval_gate"] : []),
    ...(externalModelDecision === "review" ? ["external_model_gate", "human_approval_gate"] : []),
  ]);
  const requiresHumanReview = policyDecisionValue === "review"
    || Boolean(classificationRule?.approval_required)
    || requiredGates.includes("human_approval_gate");
  const linkedAccessDecisions = matterAccessDecisions.map((decision) => ({
    resource_access_decision_id: decision.resource_access_decision_id,
    runtime_id: decision.runtime_id,
    access_decision: decision.access_decision,
    context_mode: decision.context_mode,
  })).sort(by("resource_access_decision_id"));

  return {
    schema_version: "resource-classification-decision.v1",
    resource_classification_decision_id: `resource-classification-decision.${slugify(resource.resource_id)}`,
    resource_id: resource.resource_id,
    resource_version_id: resource.latest_resource_version_id,
    tenant_id: resource.tenant_id,
    matter_id: resource.matter_id,
    source_system: resource.source_system,
    source_uri: resource.source_uri,
    source_classification: resource.classification,
    effective_classification: resource.classification,
    classification_source: resource.classification_source,
    classification_rule_id: classificationRule?.classification_rule_id ?? null,
    policy_reference_id: policyReference?.policy_reference_id ?? null,
    policy_decision_id: policyDecision?.decision_id ?? null,
    policy_snapshot_id: resource.policy_snapshot_id ?? policyReference?.policy_snapshot_id ?? null,
    policy_reference_status: policyReference?.reference_status ?? "missing",
    classification_policy_decision: defaultPolicyDecisionFor(policyDecision),
    resource_policy_decision: policyDecisionValue,
    external_model_policy: policyDecision?.external_model_policy ?? null,
    external_model_decision: externalModelDecision,
    local_model_policy: policyDecision?.local_model_policy ?? null,
    redaction_policy: policyDecision?.redaction_policy ?? null,
    context_mode: contextMode,
    requires_redaction: policyDecision?.redaction_policy === "required",
    requires_human_review: requiresHumanReview,
    required_gates: requiredGates,
    linked_resource_access_decision_count: linkedAccessDecisions.length,
    linked_access_summary: {
      allow: matterAccessDecisions.filter((decision) => decision.access_decision === "allow").length,
      review: matterAccessDecisions.filter((decision) => decision.access_decision === "review").length,
      deny: matterAccessDecisions.filter((decision) => decision.access_decision === "deny").length,
    },
    linked_resource_access_decisions: linkedAccessDecisions,
    reason_codes: unique(reasonCodes),
    decided_at: generatedAt,
    metadata: {
      external_id: resource.external_id,
      materialization_status: resource.materialization_status,
      ingestion_status: resource.ingestion_status,
    },
  };
}

function buildClassificationPolicyBinding({ classificationRule, resourceClassificationDecisions, policyReferences, generatedAt }) {
  const policyBoundDecisions = resourceClassificationDecisions.filter((decision) => decision.policy_reference_status === "resolved" && decision.policy_decision_id);
  return {
    schema_version: "classification-policy-binding.v1",
    classification_policy_binding_id: `classification-policy-binding.${slugify(classificationRule.classification)}`,
    classification_rule_id: classificationRule.classification_rule_id,
    classification: classificationRule.classification,
    policy_decision_id: classificationRule.policy_decision_id,
    external_model_policy: classificationRule.external_model_policy,
    external_model_decision: classificationRule.external_model_decision,
    default_policy_decision: classificationRule.default_policy_decision,
    required_gates: classificationRule.required_gates,
    resource_count: resourceClassificationDecisions.length,
    policy_reference_count: policyReferences.length,
    policy_bound_resource_count: policyBoundDecisions.length,
    review_resource_count: resourceClassificationDecisions.filter((decision) => decision.resource_policy_decision === "review").length,
    allow_resource_count: resourceClassificationDecisions.filter((decision) => decision.resource_policy_decision === "allow").length,
    deny_resource_count: resourceClassificationDecisions.filter((decision) => decision.resource_policy_decision === "deny").length,
    resource_ids: resourceClassificationDecisions.map((decision) => decision.resource_id).sort(),
    policy_reference_ids: policyReferences.map((reference) => reference.policy_reference_id).sort(),
    binding_status: policyBoundDecisions.length === resourceClassificationDecisions.length ? "complete" : "needs_review",
    created_at: generatedAt,
    metadata: {},
  };
}

function validateDataClassificationRules({ resourceContractFreeze, policyContractFreeze, matterAccessPolicyEvaluator, projected }) {
  const validationItems = [];
  const classificationIds = new Set(projected.dataClassifications.map((classification) => classification.classification));
  const ruleIds = new Set(projected.classificationRules.map((rule) => rule.classification_rule_id));
  const policyDecisionIds = new Set(projected.policyDecisions.map((decision) => decision.decision_id));
  const policyReferenceIds = new Set(projected.policyReferences.map((reference) => reference.policy_reference_id));
  const resourceIds = new Set(projected.resources.map((resource) => resource.resource_id));
  const decisionsByResource = new Map(projected.resourceClassificationDecisions.map((decision) => [decision.resource_id, decision]));
  const accessDecisionGroups = groupBy(projected.resourceAccessDecisions, "resource_id");

  pushCheck(validationItems, "source", resourceContractFreeze.freeze_id ?? "resource-contract-freeze", "resource_contract_complete", resourceContractFreeze.summary?.freeze_status === "complete", "Data classification rules require a complete Resource contract freeze.");
  pushCheck(validationItems, "source", policyContractFreeze.freeze_id ?? "policy-contract-freeze", "policy_contract_complete", policyContractFreeze.summary?.freeze_status === "complete", "Data classification rules require a complete Policy contract freeze.");
  pushCheck(validationItems, "source", matterAccessPolicyEvaluator.access_policy_ledger_id ?? "matter-access-policy-evaluator", "matter_access_policy_complete", matterAccessPolicyEvaluator.summary?.access_policy_status === "complete", "Data classification rules require a complete Matter Access Policy Evaluator.");

  pushUniqueIdChecks(validationItems, projected.classificationRules, "classification_rule", "classification_rule_id");
  pushUniqueIdChecks(validationItems, projected.resourceClassificationDecisions, "resource_classification_decision", "resource_classification_decision_id");
  pushUniqueIdChecks(validationItems, projected.classificationPolicyBindings, "classification_policy_binding", "classification_policy_binding_id");

  for (const rule of projected.classificationRules) {
    pushCheck(validationItems, "classification_rule", rule.classification_rule_id, "classification_known", classificationIds.has(rule.classification), "Classification rule must map to a DataClassification contract.");
    pushCheck(validationItems, "classification_rule", rule.classification_rule_id, "policy_decision_known", !rule.policy_decision_id || policyDecisionIds.has(rule.policy_decision_id), "Classification rule policy decision must exist in PolicyDecision v2.");
    pushCheck(validationItems, "classification_rule", rule.classification_rule_id, "external_model_policy_supported", EXTERNAL_MODEL_POLICIES.has(rule.external_model_policy), "Classification rule external model policy must be supported.");
    pushCheck(validationItems, "classification_rule", rule.classification_rule_id, "decision_supported", DECISIONS.has(rule.default_policy_decision), "Classification rule default decision must be allow, review, or deny.");
  }

  for (const resource of projected.resources) {
    const decision = decisionsByResource.get(resource.resource_id);
    pushCheck(validationItems, "resource", resource.resource_id, "resource_classification_decision_present", Boolean(decision), "Every resource must have a classification policy decision.");
    pushCheck(validationItems, "resource", resource.resource_id, "classification_known", classificationIds.has(resource.classification), "Every resource classification must exist in DataClassification v2.");
  }

  for (const decision of projected.resourceClassificationDecisions) {
    const accessDecisions = accessDecisionGroups.get(decision.resource_id) ?? [];
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "resource_known", resourceIds.has(decision.resource_id), "Resource classification decision resource must exist.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "classification_rule_bound", ruleIds.has(decision.classification_rule_id), "Resource classification decision must bind to a classification rule.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "policy_reference_resolved", policyReferenceIds.has(decision.policy_reference_id) && decision.policy_reference_status === "resolved", "Resource classification decision must bind to a resolved PolicyReference.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "policy_decision_known", policyDecisionIds.has(decision.policy_decision_id), "Resource classification decision must bind to a PolicyDecision.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "decision_supported", DECISIONS.has(decision.resource_policy_decision), "Resource policy decision must be allow, review, or deny.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "external_decision_supported", DECISIONS.has(decision.external_model_decision), "External model decision must be allow, review, or deny.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "matter_access_linked", decision.linked_resource_access_decision_count === accessDecisions.length && accessDecisions.length > 0, "Resource classification decision must link to Matter Access resource decisions.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "unassigned_resource_requires_review", !isUnassignedMatter(decision.matter_id) || decision.resource_policy_decision === "review", "Unassigned resources must require review before use.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "review_requires_human", decision.resource_policy_decision !== "review" || decision.requires_human_review === true, "Review resource policy decisions must require human review.");
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "forbidden_external_not_allowed", decision.external_model_policy !== "forbidden" || decision.external_model_decision === "deny", "Forbidden external model policies must produce deny decisions.");
  }

  for (const binding of projected.classificationPolicyBindings) {
    pushCheck(validationItems, "classification_policy_binding", binding.classification_policy_binding_id, "classification_known", classificationIds.has(binding.classification), "Classification policy binding must map to a DataClassification contract.");
    pushCheck(validationItems, "classification_policy_binding", binding.classification_policy_binding_id, "policy_decision_known", !binding.policy_decision_id || policyDecisionIds.has(binding.policy_decision_id), "Classification policy binding policy decision must exist.");
    pushCheck(validationItems, "classification_policy_binding", binding.classification_policy_binding_id, "resource_reference_coverage", binding.policy_reference_count === binding.resource_count, "Classification policy binding must have one resource PolicyReference per resource in that classification.");
    pushCheck(validationItems, "classification_policy_binding", binding.classification_policy_binding_id, "bound_resource_coverage", binding.policy_bound_resource_count === binding.resource_count, "Classification policy binding must bind every resource in that classification to policy.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.classificationRules.length === 0) errors.push({ path: "classification_rule_catalog.classification_rules", message: "At least one classification rule is required." });
  if (projected.resourceClassificationDecisions.length === 0) errors.push({ path: "classification_rule_catalog.resource_classification_decisions", message: "At least one resource classification decision is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeDataClassificationRules(projected, validationItems, validation, sources) {
  const decisions = projected.resourceClassificationDecisions;
  return {
    classification_rule_engine_status: validation.valid ? "complete" : "blocked",
    source_resource_contract_status: sources.resourceContractFreeze.summary?.freeze_status ?? "unknown",
    source_policy_contract_status: sources.policyContractFreeze.summary?.freeze_status ?? "unknown",
    source_matter_access_policy_status: sources.matterAccessPolicyEvaluator.summary?.access_policy_status ?? "unknown",
    classification_rule_count: projected.classificationRules.length,
    resource_classification_decision_count: decisions.length,
    classification_policy_binding_count: projected.classificationPolicyBindings.length,
    resource_count: projected.resources.length,
    classified_resource_count: decisions.filter((decision) => decision.effective_classification).length,
    unclassified_resource_count: projected.resources.length - decisions.filter((decision) => decision.effective_classification).length,
    policy_bound_resource_count: decisions.filter((decision) => decision.policy_reference_status === "resolved" && decision.policy_decision_id).length,
    unbound_resource_count: decisions.filter((decision) => decision.policy_reference_status !== "resolved" || !decision.policy_decision_id).length,
    allow_decision_count: decisions.filter((decision) => decision.resource_policy_decision === "allow").length,
    review_decision_count: decisions.filter((decision) => decision.resource_policy_decision === "review").length,
    deny_decision_count: decisions.filter((decision) => decision.resource_policy_decision === "deny").length,
    external_model_allow_count: decisions.filter((decision) => decision.external_model_decision === "allow").length,
    external_model_review_count: decisions.filter((decision) => decision.external_model_decision === "review").length,
    external_model_deny_count: decisions.filter((decision) => decision.external_model_decision === "deny").length,
    redaction_required_resource_count: decisions.filter((decision) => decision.requires_redaction).length,
    human_review_required_resource_count: decisions.filter((decision) => decision.requires_human_review).length,
    matter_tagging_review_count: decisions.filter((decision) => decision.reason_codes.includes("resource_matter_tagging_required")).length,
    matter_access_link_count: decisions.reduce((sum, decision) => sum + decision.linked_resource_access_decision_count, 0),
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_classification: countBy(decisions, "effective_classification"),
    by_policy_decision: countBy(decisions, "resource_policy_decision"),
    by_external_model_decision: countBy(decisions, "external_model_decision"),
    by_context_mode: countBy(decisions, "context_mode"),
  };
}

function summarizeResourceContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    resource_count: source.summary?.resource_count ?? 0,
    resource_version_count: source.summary?.resource_version_count ?? 0,
    classification_count: source.summary?.classification_count ?? 0,
  };
}

function summarizePolicyContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    classification_count: source.summary?.classification_count ?? 0,
    policy_decision_count: source.summary?.policy_decision_count ?? 0,
    policy_reference_count: source.summary?.policy_reference_count ?? 0,
    resource_policy_reference_count: source.summary?.resource_policy_reference_count ?? 0,
  };
}

function summarizeMatterAccessPolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    access_policy_ledger_id: source.access_policy_ledger_id ?? null,
    access_policy_status: source.summary?.access_policy_status ?? "unknown",
    resource_access_decision_count: source.summary?.resource_access_decision_count ?? 0,
    resource_review_decision_count: source.summary?.resource_review_decision_count ?? 0,
    runtime_access_matrix_count: source.summary?.runtime_access_matrix_count ?? 0,
  };
}

function renderDataClassificationRuleEngineMarkdown(result) {
  const lines = [];
  lines.push("# Data Classification Rule Engine");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.classification_rule_engine_status}`);
  lines.push("");
  lines.push(`- Classification rules: ${result.summary.classification_rule_count}`);
  lines.push(`- Resource decisions: ${result.summary.resource_classification_decision_count}`);
  lines.push(`- Policy-bound resources: ${result.summary.policy_bound_resource_count}`);
  lines.push(`- Review decisions: ${result.summary.review_decision_count}`);
  lines.push(`- External model allow/review/deny: ${result.summary.external_model_allow_count}/${result.summary.external_model_review_count}/${result.summary.external_model_deny_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Classification Bindings");
  for (const binding of result.classification_rule_catalog.classification_policy_bindings) {
    lines.push(`- ${binding.classification}: ${binding.resource_count} resource(s), ${binding.policy_bound_resource_count} policy-bound, ${binding.external_model_decision} external model decision`);
  }
  return `${lines.join("\n")}\n`;
}

function externalModelDecisionFor(policy) {
  if (policy === "forbidden") return "deny";
  if (policy === "approval_required") return "review";
  if (policy === "allowed_with_audit") return "allow";
  return "review";
}

function defaultPolicyDecisionFor(policyDecision) {
  if (!policyDecision) return "review";
  if (policyDecision.external_model_policy === "forbidden" && policyDecision.local_model_policy === "forbidden") return "deny";
  if (policyDecision.approval_required || policyDecision.external_model_policy === "approval_required") return "review";
  return "allow";
}

function contextModeFor(policyDecision, externalModelDecision) {
  if (!policyDecision) return "review_required";
  if (externalModelDecision === "deny" && policyDecision.local_model_policy === "forbidden") return "blocked";
  if (policyDecision.redaction_policy === "required") return "redacted";
  if (externalModelDecision === "review") return "review_required";
  return "raw";
}

function normalizeInputs(options) {
  return {
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_DATA_CLASSIFICATION_RULE_ENGINE_INPUTS.resourceContractFreezePath),
    policy_contract_freeze_path: path.resolve(options.policyContractFreezePath ?? DEFAULT_DATA_CLASSIFICATION_RULE_ENGINE_INPUTS.policyContractFreezePath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_DATA_CLASSIFICATION_RULE_ENGINE_INPUTS.matterAccessPolicyEvaluatorPath),
  };
}

function serializableLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--policy-contract-freeze") parsed.policyContractFreezePath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/data-classification-rule-engine.mjs [options]

Options:
  --resource-contract-freeze <path>  resource-contract-freeze.json path.
  --policy-contract-freeze <path>    policy-contract-freeze.json path.
  --matter-access-policy <path>      matter-access-policy-evaluator.json path.
  --out-dir <path>                   Output directory.
  --run-at <iso>                     Deterministic timestamp.
  --check                            Exit non-zero when validation fails.
  --no-write                         Build without writing artifacts.
`);
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
    validation_id: `data-classification-rule-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
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

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort();
}

function slugify(value) {
  return String(value ?? "unknown")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\..+$/, "Z");
}
