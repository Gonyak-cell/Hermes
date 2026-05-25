import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_ACCESS_POLICY_OUT_DIR = "artifacts/matter-access-policy/latest";
export const DEFAULT_MATTER_ACCESS_POLICY_INPUTS = {
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
};

const DECISIONS = new Set(["allow", "deny", "review"]);

export async function runMatterAccessPolicyEvaluator(options = {}) {
  const result = await buildMatterAccessPolicyEvaluator(options);
  if (options.write !== false) await writeMatterAccessPolicyEvaluator(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter access policy evaluator failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterAccessPolicyEvaluator(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_ACCESS_POLICY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceContractFreeze = await readJson(inputs.resource_contract_freeze_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const matterProfileTeamLedger = await readJson(inputs.matter_profile_team_ledger_path);
  const wallPolicyContract = await readJson(inputs.wall_policy_contract_path);
  const projected = projectMatterAccessPolicy({
    resourceContractFreeze,
    runtimeAgentRunContractFreeze,
    matterProfileTeamLedger,
    wallPolicyContract,
    generatedAt,
  });
  const validationItems = validateMatterAccessPolicy({
    resourceContractFreeze,
    runtimeAgentRunContractFreeze,
    matterProfileTeamLedger,
    wallPolicyContract,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "matter-access-policy-evaluator.v1",
    generated_at: generatedAt,
    access_policy_ledger_id: `matter-access-policy.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_contract: summarizeResourceContractSource(resourceContractFreeze),
    source_runtime_contract: summarizeRuntimeContractSource(runtimeAgentRunContractFreeze),
    source_matter_profile_team_ledger: summarizeMatterProfileTeamSource(matterProfileTeamLedger),
    source_wall_policy_contract: summarizeWallPolicySource(wallPolicyContract),
    matter_access_policy: {
      schema_version: "matter-access-policy.v1",
      generated_at: generatedAt,
      access_policy_rules: projected.accessPolicyRules,
      matter_access_decisions: projected.matterAccessDecisions,
      resource_access_decisions: projected.resourceAccessDecisions,
      runtime_access_matrix: projected.runtimeAccessMatrix,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeMatterAccessPolicy(projected, validationItems, validation, {
      resourceContractFreeze,
      runtimeAgentRunContractFreeze,
      matterProfileTeamLedger,
      wallPolicyContract,
    }),
  };
  return {
    ...result,
    markdown: renderMatterAccessPolicyMarkdown(result),
  };
}

export async function writeMatterAccessPolicyEvaluator(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "matter-access-policy-evaluator.json"), serializable);
  await writeJson(path.join(outDir, "matter-access-policy.json"), serializable);
  await writeJson(path.join(outDir, "access-policy-rules.json"), {
    generated_at: result.generated_at,
    access_policy_rule_count: result.matter_access_policy.access_policy_rules.length,
    access_policy_rules: result.matter_access_policy.access_policy_rules,
  });
  await writeJson(path.join(outDir, "matter-access-decisions.json"), {
    generated_at: result.generated_at,
    matter_access_decision_count: result.matter_access_policy.matter_access_decisions.length,
    matter_access_decisions: result.matter_access_policy.matter_access_decisions,
  });
  await writeJson(path.join(outDir, "resource-access-decisions.json"), {
    generated_at: result.generated_at,
    resource_access_decision_count: result.matter_access_policy.resource_access_decisions.length,
    resource_access_decisions: result.matter_access_policy.resource_access_decisions,
  });
  await writeJson(path.join(outDir, "runtime-access-matrix.json"), {
    generated_at: result.generated_at,
    runtime_access_matrix_count: result.matter_access_policy.runtime_access_matrix.length,
    runtime_access_matrix: result.matter_access_policy.runtime_access_matrix,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    access_policy_ledger_id: result.access_policy_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterAccessPolicyEvaluatorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterAccessPolicyEvaluator(args);
    console.log(`Matter access policy written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.access_policy_status}`);
    console.log(`Matter decisions: ${result.summary.matter_access_decision_count}`);
    console.log(`Resource decisions: ${result.summary.resource_access_decision_count}`);
    console.log(`Allow/review/deny: ${result.summary.allow_decision_count}/${result.summary.review_decision_count}/${result.summary.deny_decision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectMatterAccessPolicy({
  resourceContractFreeze,
  runtimeAgentRunContractFreeze,
  matterProfileTeamLedger,
  wallPolicyContract,
  generatedAt,
}) {
  const resources = resourceContractFreeze.resource_contract?.resources ?? [];
  const runtimeAdapters = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.runtime_adapters ?? [];
  const accessSubjects = matterProfileTeamLedger.matter_team_contract?.matter_access_subjects ?? [];
  const wallRules = wallPolicyContract.wall_policy_contract?.wall_policy_rules ?? [];
  const retrievalFiltersByRuleId = new Map((wallPolicyContract.wall_policy_contract?.retrieval_wall_filters ?? []).map((filter) => [filter.wall_policy_rule_id, filter]));
  const subjectBindingsBySubjectRule = new Map(
    (wallPolicyContract.wall_policy_contract?.wall_subject_bindings ?? []).map((binding) => [`${binding.access_subject_id}::${binding.wall_policy_rule_id}`, binding]),
  );

  const accessPolicyRules = [];
  const matterAccessDecisions = [];
  const resourceAccessDecisions = [];
  const runtimeAccessMatrix = [];

  for (const wallRule of wallRules) {
    const retrievalFilter = retrievalFiltersByRuleId.get(wallRule.wall_policy_rule_id);
    accessPolicyRules.push({
      schema_version: "matter-access-policy-rule.v1",
      access_policy_rule_id: `matter-access-policy-rule.${slugify(wallRule.wall_policy_rule_id)}`,
      wall_policy_rule_id: wallRule.wall_policy_rule_id,
      retrieval_wall_filter_id: wallRule.retrieval_wall_filter_id,
      wall_id: wallRule.wall_id,
      tenant_id: wallRule.tenant_id,
      client_id: wallRule.client_id,
      matter_id: wallRule.matter_id,
      rule_status: wallRule.rule_status,
      enforcement_stage: "pre_retrieval",
      decision_mode: "deny_unless_allowed",
      required_filter_keys: retrievalFilter?.required_filter_keys ?? [],
      classification_floor: wallRule.classification_floor,
      policy_snapshot_id: wallRule.policy_snapshot_id,
      allowed_access_subject_ids: wallRule.allowed_access_subject_ids ?? [],
      created_at: generatedAt,
      metadata: {
        source_wall_type: wallRule.wall_type,
      },
    });

    for (const runtime of runtimeAdapters) {
      const runtimeDecision = evaluateRuntimeClassification(runtime, wallRule.classification_floor);
      runtimeAccessMatrix.push({
        schema_version: "runtime-access-matrix-row.v1",
        runtime_access_matrix_id: `runtime-access-matrix.${slugify(wallRule.matter_id)}.${slugify(runtime.runtime_id)}`,
        runtime_id: runtime.runtime_id,
        adapter_id: runtime.adapter_id,
        matter_id: wallRule.matter_id,
        wall_id: wallRule.wall_id,
        classification: wallRule.classification_floor,
        risk_level: runtime.risk_level,
        external_execution: Boolean(runtime.execution_environment?.external_execution),
        raw_context_allowed: runtimeDecision.rawAllowed,
        redacted_context_allowed: runtimeDecision.redactedAllowed,
        default_context_allowed: runtimeDecision.defaultAllowed,
        runtime_context_mode: runtimeDecision.contextMode,
        runtime_policy_decision: runtimeDecision.decision,
        required_gates: runtimeDecision.requiredGates,
        created_at: generatedAt,
        metadata: {},
      });
    }

    for (const subject of accessSubjects.filter((item) => item.matter_id === wallRule.matter_id)) {
      const binding = subjectBindingsBySubjectRule.get(`${subject.access_subject_id}::${wallRule.wall_policy_rule_id}`);
      for (const runtime of runtimeAdapters) {
        const matterDecision = buildMatterAccessDecision({
          subject,
          runtime,
          wallRule,
          retrievalFilter,
          binding,
          generatedAt,
        });
        matterAccessDecisions.push(matterDecision);
        for (const resource of resources) {
          resourceAccessDecisions.push(buildResourceAccessDecision({
            matterDecision,
            resource,
            runtime,
            wallRule,
            retrievalFilter,
            generatedAt,
          }));
        }
      }
    }
  }

  return {
    accessPolicyRules: accessPolicyRules.sort(by("access_policy_rule_id")),
    matterAccessDecisions: matterAccessDecisions.sort(by("matter_access_decision_id")),
    resourceAccessDecisions: resourceAccessDecisions.sort(by("resource_access_decision_id")),
    runtimeAccessMatrix: runtimeAccessMatrix.sort(by("runtime_access_matrix_id")),
    resources,
    runtimeAdapters,
    accessSubjects,
    wallRules,
  };
}

function buildMatterAccessDecision({ subject, runtime, wallRule, retrievalFilter, binding, generatedAt }) {
  const runtimeDecision = evaluateRuntimeClassification(runtime, wallRule.classification_floor);
  const reasons = [];
  let decision = runtimeDecision.decision;
  let contextMode = runtimeDecision.contextMode;
  let canRetrieve = decision === "allow";
  if (!binding || binding.can_retrieve !== true || subject.access_decision !== "allow") {
    decision = "deny";
    contextMode = "blocked";
    canRetrieve = false;
    reasons.push("subject_not_allowed_by_wall");
  } else {
    reasons.push(...runtimeDecision.reasonCodes);
  }
  return {
    schema_version: "matter-access-decision.v1",
    matter_access_decision_id: `matter-access-decision.${slugify(subject.access_subject_id)}.${slugify(runtime.runtime_id)}.${slugify(wallRule.wall_policy_rule_id)}`,
    access_subject_id: subject.access_subject_id,
    user_id: subject.user_id,
    subject_type: subject.subject_type,
    runtime_id: runtime.runtime_id,
    adapter_id: runtime.adapter_id,
    risk_level: runtime.risk_level,
    external_execution: Boolean(runtime.execution_environment?.external_execution),
    matter_id: wallRule.matter_id,
    tenant_id: wallRule.tenant_id,
    client_id: wallRule.client_id,
    wall_id: wallRule.wall_id,
    wall_policy_rule_id: wallRule.wall_policy_rule_id,
    retrieval_wall_filter_id: retrievalFilter?.retrieval_wall_filter_id ?? null,
    membership_id: subject.membership_id,
    classification: wallRule.classification_floor,
    access_decision: decision,
    context_mode: contextMode,
    can_retrieve: canRetrieve,
    requires_human_review: decision === "review",
    required_gates: unique(runtimeDecision.requiredGates),
    reason_codes: unique(reasons),
    policy_snapshot_id: wallRule.policy_snapshot_id,
    decided_at: generatedAt,
    metadata: {},
  };
}

function buildResourceAccessDecision({ matterDecision, resource, runtime, wallRule, retrievalFilter, generatedAt }) {
  const reasonCodes = [...matterDecision.reason_codes];
  let accessDecision = matterDecision.access_decision;
  let contextMode = matterDecision.context_mode;
  let canRetrieve = matterDecision.can_retrieve;
  let requiresHumanReview = matterDecision.requires_human_review;

  if (resource.matter_id !== wallRule.matter_id) {
    if (isUnassignedMatter(resource.matter_id)) {
      accessDecision = "review";
      contextMode = "review_required";
      canRetrieve = false;
      requiresHumanReview = true;
      reasonCodes.push("resource_matter_tagging_required");
    } else {
      accessDecision = "deny";
      contextMode = "blocked";
      canRetrieve = false;
      requiresHumanReview = false;
      reasonCodes.push("resource_matter_mismatch");
    }
  }

  if (resource.tenant_id !== wallRule.tenant_id && !isUnassignedMatter(resource.matter_id)) {
    accessDecision = "deny";
    contextMode = "blocked";
    canRetrieve = false;
    requiresHumanReview = false;
    reasonCodes.push("tenant_mismatch");
  }

  if (resource.classification !== wallRule.classification_floor && accessDecision === "allow") {
    const runtimeDecision = evaluateRuntimeClassification(runtime, resource.classification);
    accessDecision = runtimeDecision.decision;
    contextMode = runtimeDecision.contextMode;
    canRetrieve = accessDecision === "allow";
    requiresHumanReview = accessDecision === "review";
    reasonCodes.push(...runtimeDecision.reasonCodes);
  }

  return {
    schema_version: "resource-access-decision.v1",
    resource_access_decision_id: `resource-access-decision.${slugify(matterDecision.access_subject_id)}.${slugify(runtime.runtime_id)}.${slugify(resource.resource_id)}.${slugify(wallRule.matter_id)}`,
    matter_access_decision_id: matterDecision.matter_access_decision_id,
    access_subject_id: matterDecision.access_subject_id,
    user_id: matterDecision.user_id,
    runtime_id: runtime.runtime_id,
    adapter_id: runtime.adapter_id,
    external_execution: Boolean(runtime.execution_environment?.external_execution),
    resource_id: resource.resource_id,
    resource_version_id: resource.latest_resource_version_id,
    resource_matter_id: resource.matter_id,
    target_matter_id: wallRule.matter_id,
    tenant_id: wallRule.tenant_id,
    resource_tenant_id: resource.tenant_id,
    client_id: wallRule.client_id,
    wall_id: wallRule.wall_id,
    wall_policy_rule_id: wallRule.wall_policy_rule_id,
    retrieval_wall_filter_id: retrievalFilter?.retrieval_wall_filter_id ?? null,
    resource_classification: resource.classification,
    required_classification_floor: wallRule.classification_floor,
    access_decision: accessDecision,
    context_mode: contextMode,
    can_retrieve: canRetrieve,
    requires_human_review: requiresHumanReview,
    required_gates: accessDecision === "review" ? unique([...matterDecision.required_gates, "matter_tagging_gate"]) : matterDecision.required_gates,
    reason_codes: unique(reasonCodes),
    policy_snapshot_id: resource.policy_snapshot_id ?? wallRule.policy_snapshot_id,
    decided_at: generatedAt,
    metadata: {
      source_uri: resource.source_uri,
      resource_type: resource.resource_type,
    },
  };
}

function evaluateRuntimeClassification(runtime, classification) {
  const dataAccess = runtime.data_access ?? {};
  const rawAllowed = arrayValue(dataAccess.raw_context_allowed_classifications).includes(classification);
  const redactedAllowed = arrayValue(dataAccess.redacted_context_allowed_classifications).includes(classification);
  const defaultAllowed = arrayValue(dataAccess.default_allowed_classifications).includes(classification);
  if (rawAllowed) {
    return {
      decision: "allow",
      contextMode: "raw",
      rawAllowed,
      redactedAllowed,
      defaultAllowed,
      requiredGates: arrayValue(runtime.tool_policy?.required_gates).filter((gate) => gate !== "external_model_gate"),
      reasonCodes: ["runtime_raw_context_allowed"],
    };
  }
  if (redactedAllowed) {
    return {
      decision: "review",
      contextMode: "redacted",
      rawAllowed,
      redactedAllowed,
      defaultAllowed,
      requiredGates: unique([...arrayValue(runtime.tool_policy?.required_gates), "redaction_gate", "human_review_gate"]),
      reasonCodes: ["runtime_redacted_context_only"],
    };
  }
  return {
    decision: "deny",
    contextMode: "blocked",
    rawAllowed,
    redactedAllowed,
    defaultAllowed,
    requiredGates: arrayValue(runtime.tool_policy?.required_gates),
    reasonCodes: ["runtime_classification_not_allowed"],
  };
}

function validateMatterAccessPolicy({ resourceContractFreeze, runtimeAgentRunContractFreeze, matterProfileTeamLedger, wallPolicyContract, projected }) {
  const validationItems = [];
  const matterDecisionsByRule = groupBy(projected.matterAccessDecisions, "wall_policy_rule_id");
  const resourceDecisionsByResource = groupBy(projected.resourceAccessDecisions, "resource_id");
  const accessSubjectsByMatter = groupBy(projected.accessSubjects, "matter_id");
  const runtimeIds = new Set(projected.runtimeAdapters.map((runtime) => runtime.runtime_id));
  const subjectIds = new Set(projected.accessSubjects.map((subject) => subject.access_subject_id));
  const resourceIds = new Set(projected.resources.map((resource) => resource.resource_id));

  pushCheck(validationItems, "source", resourceContractFreeze.freeze_id ?? "resource-contract-freeze", "resource_contract_complete", resourceContractFreeze.summary?.freeze_status === "complete", "Matter access policy requires a complete Resource contract freeze.");
  pushCheck(validationItems, "source", runtimeAgentRunContractFreeze.freeze_id ?? "runtime-agentrun-contract-freeze", "runtime_contract_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Matter access policy requires a complete Runtime/AgentRun contract freeze.");
  pushCheck(validationItems, "source", matterProfileTeamLedger.ledger_id ?? "matter-profile-team-ledger", "matter_profile_team_ledger_complete", matterProfileTeamLedger.summary?.ledger_status === "complete", "Matter access policy requires a complete Matter Profile/Team Ledger.");
  pushCheck(validationItems, "source", wallPolicyContract.wall_policy_ledger_id ?? "wall-policy-contract", "wall_policy_contract_complete", wallPolicyContract.summary?.wall_policy_status === "complete", "Matter access policy requires a complete Wall Policy Contract.");

  pushUniqueIdChecks(validationItems, projected.accessPolicyRules, "access_policy_rule", "access_policy_rule_id");
  pushUniqueIdChecks(validationItems, projected.matterAccessDecisions, "matter_access_decision", "matter_access_decision_id");
  pushUniqueIdChecks(validationItems, projected.resourceAccessDecisions, "resource_access_decision", "resource_access_decision_id");
  pushUniqueIdChecks(validationItems, projected.runtimeAccessMatrix, "runtime_access_matrix", "runtime_access_matrix_id");

  for (const rule of projected.accessPolicyRules) {
    const decisions = matterDecisionsByRule.get(rule.wall_policy_rule_id) ?? [];
    const subjectsForMatter = accessSubjectsByMatter.get(rule.matter_id) ?? [];
    pushCheck(validationItems, "access_policy_rule", rule.access_policy_rule_id, "pre_retrieval_rule", rule.enforcement_stage === "pre_retrieval", "Access policy rule must execute before retrieval.");
    pushCheck(validationItems, "access_policy_rule", rule.access_policy_rule_id, "deny_unless_allowed", rule.decision_mode === "deny_unless_allowed", "Access policy rule must deny unless allowed.");
    pushCheck(validationItems, "access_policy_rule", rule.access_policy_rule_id, "runtime_coverage", decisions.length === projected.runtimeAdapters.length * subjectsForMatter.length, "Each subject/runtime pair for the matter must have a matter access decision.");
  }

  for (const decision of projected.matterAccessDecisions) {
    pushCheck(validationItems, "matter_access_decision", decision.matter_access_decision_id, "subject_known", subjectIds.has(decision.access_subject_id), "Matter access decision subject must exist.");
    pushCheck(validationItems, "matter_access_decision", decision.matter_access_decision_id, "runtime_known", runtimeIds.has(decision.runtime_id), "Matter access decision runtime must exist.");
    pushCheck(validationItems, "matter_access_decision", decision.matter_access_decision_id, "decision_supported", DECISIONS.has(decision.access_decision), "Matter access decision must be allow, deny, or review.");
    pushCheck(validationItems, "matter_access_decision", decision.matter_access_decision_id, "allow_can_retrieve", decision.access_decision !== "allow" || decision.can_retrieve === true, "Allow matter decisions must be retrievable.");
    pushCheck(validationItems, "matter_access_decision", decision.matter_access_decision_id, "review_requires_human", decision.access_decision !== "review" || decision.requires_human_review === true, "Review matter decisions must require human review.");
  }

  for (const decision of projected.resourceAccessDecisions) {
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "resource_known", resourceIds.has(decision.resource_id), "Resource access decision resource must exist.");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "subject_known", subjectIds.has(decision.access_subject_id), "Resource access decision subject must exist.");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "runtime_known", runtimeIds.has(decision.runtime_id), "Resource access decision runtime must exist.");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "decision_supported", DECISIONS.has(decision.access_decision), "Resource access decision must be allow, deny, or review.");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "unassigned_resource_not_allowed", !isUnassignedMatter(decision.resource_matter_id) || decision.access_decision !== "allow", "Unassigned resources must not be allowed before matter tagging.");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "allow_can_retrieve", decision.access_decision !== "allow" || decision.can_retrieve === true, "Allow resource decisions must be retrievable.");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "review_requires_human", decision.access_decision !== "review" || decision.requires_human_review === true, "Review resource decisions must require human review.");
  }

  for (const resource of projected.resources) {
    const decisions = resourceDecisionsByResource.get(resource.resource_id) ?? [];
    pushCheck(validationItems, "resource", resource.resource_id, "resource_decision_coverage", decisions.length === projected.matterAccessDecisions.length, "Each resource must have one access decision for every matter access decision.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.matterAccessDecisions.length === 0) errors.push({ path: "matter_access_policy.matter_access_decisions", message: "At least one matter access decision is required." });
  if (projected.resourceAccessDecisions.length === 0) errors.push({ path: "matter_access_policy.resource_access_decisions", message: "At least one resource access decision is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeMatterAccessPolicy(projected, validationItems, validation, sources) {
  const decisions = [...projected.matterAccessDecisions, ...projected.resourceAccessDecisions];
  return {
    access_policy_status: validation.valid ? "complete" : "blocked",
    source_resource_contract_status: sources.resourceContractFreeze.summary?.freeze_status ?? "unknown",
    source_runtime_contract_status: sources.runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
    source_matter_profile_team_ledger_status: sources.matterProfileTeamLedger.summary?.ledger_status ?? "unknown",
    source_wall_policy_contract_status: sources.wallPolicyContract.summary?.wall_policy_status ?? "unknown",
    access_policy_rule_count: projected.accessPolicyRules.length,
    matter_access_decision_count: projected.matterAccessDecisions.length,
    resource_access_decision_count: projected.resourceAccessDecisions.length,
    runtime_access_matrix_count: projected.runtimeAccessMatrix.length,
    allow_decision_count: decisions.filter((decision) => decision.access_decision === "allow").length,
    review_decision_count: decisions.filter((decision) => decision.access_decision === "review").length,
    deny_decision_count: decisions.filter((decision) => decision.access_decision === "deny").length,
    matter_allow_decision_count: projected.matterAccessDecisions.filter((decision) => decision.access_decision === "allow").length,
    matter_review_decision_count: projected.matterAccessDecisions.filter((decision) => decision.access_decision === "review").length,
    matter_deny_decision_count: projected.matterAccessDecisions.filter((decision) => decision.access_decision === "deny").length,
    resource_allow_decision_count: projected.resourceAccessDecisions.filter((decision) => decision.access_decision === "allow").length,
    resource_review_decision_count: projected.resourceAccessDecisions.filter((decision) => decision.access_decision === "review").length,
    resource_deny_decision_count: projected.resourceAccessDecisions.filter((decision) => decision.access_decision === "deny").length,
    unassigned_resource_review_count: projected.resourceAccessDecisions.filter((decision) => decision.reason_codes.includes("resource_matter_tagging_required")).length,
    external_runtime_decision_count: decisions.filter((decision) => decision.external_execution).length,
    runtime_count: projected.runtimeAdapters.length,
    resource_count: projected.resources.length,
    access_subject_count: projected.accessSubjects.length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_decision: countBy(decisions, "access_decision"),
    by_matter_decision: countBy(projected.matterAccessDecisions, "access_decision"),
    by_runtime_id: countBy(projected.matterAccessDecisions, "runtime_id"),
    by_resource_decision: countBy(projected.resourceAccessDecisions, "access_decision"),
    by_resource_classification: countBy(projected.resourceAccessDecisions, "resource_classification"),
  };
}

function summarizeResourceContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    resource_count: source.summary?.resource_count ?? 0,
    resource_version_count: source.summary?.resource_version_count ?? 0,
  };
}

function summarizeRuntimeContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    runtime_adapter_count: source.summary?.runtime_adapter_count ?? 0,
    agent_run_count: source.summary?.agent_run_count ?? 0,
  };
}

function summarizeMatterProfileTeamSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    ledger_id: source.ledger_id ?? null,
    ledger_status: source.summary?.ledger_status ?? "unknown",
    access_subject_count: source.summary?.matter_access_subject_count ?? 0,
    allowed_access_subject_count: source.summary?.allowed_access_subject_count ?? 0,
  };
}

function summarizeWallPolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    wall_policy_ledger_id: source.wall_policy_ledger_id ?? null,
    wall_policy_status: source.summary?.wall_policy_status ?? "unknown",
    wall_policy_rule_count: source.summary?.wall_policy_rule_count ?? 0,
    retrieval_wall_filter_count: source.summary?.retrieval_wall_filter_count ?? 0,
  };
}

function renderMatterAccessPolicyMarkdown(result) {
  const lines = [];
  lines.push("# Matter Access Policy Evaluator");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.access_policy_status}`);
  lines.push("");
  lines.push(`- Matter decisions: ${result.summary.matter_access_decision_count}`);
  lines.push(`- Resource decisions: ${result.summary.resource_access_decision_count}`);
  lines.push(`- Allow decisions: ${result.summary.allow_decision_count}`);
  lines.push(`- Review decisions: ${result.summary.review_decision_count}`);
  lines.push(`- Deny decisions: ${result.summary.deny_decision_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Matter Decisions");
  for (const decision of result.matter_access_policy.matter_access_decisions.slice(0, 12)) {
    lines.push(`- ${decision.user_id} / ${decision.runtime_id} / ${decision.matter_id}: ${decision.access_decision} (${decision.context_mode})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_MATTER_ACCESS_POLICY_INPUTS.resourceContractFreezePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_MATTER_ACCESS_POLICY_INPUTS.runtimeAgentRunContractFreezePath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_MATTER_ACCESS_POLICY_INPUTS.matterProfileTeamLedgerPath),
    wall_policy_contract_path: path.resolve(options.wallPolicyContractPath ?? DEFAULT_MATTER_ACCESS_POLICY_INPUTS.wallPolicyContractPath),
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
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--wall-policy-contract") parsed.wallPolicyContractPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-access-policy-evaluator.mjs [options]

Options:
  --resource-contract-freeze <path>          resource-contract-freeze.json path.
  --runtime-agentrun-contract-freeze <path>  runtime-agentrun-contract-freeze.json path.
  --matter-profile-team-ledger <path>        matter-profile-team-ledger.json path.
  --wall-policy-contract <path>              wall-policy-contract.json path.
  --out-dir <path>                           Output directory.
  --run-at <iso>                             Deterministic timestamp.
  --check                                    Exit non-zero when validation fails.
  --no-write                                 Build without writing artifacts.
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
    validation_id: `matter-access-policy-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
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
