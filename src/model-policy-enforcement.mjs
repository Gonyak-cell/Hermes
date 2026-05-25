import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MODEL_POLICY_ENFORCEMENT_OUT_DIR = "artifacts/model-policy-enforcement/latest";
export const DEFAULT_MODEL_POLICY_ENFORCEMENT_INPUTS = {
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  modelRoutingLedgerPath: "artifacts/model-routing/latest/model-routing-ledger.json",
  policyContractFreezePath: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
};

const DECISIONS = new Set(["allow", "review", "deny"]);
const GATE_STATUSES = new Set(["passed", "requires_approval", "blocked"]);
const SENSITIVE_ORDINAL_FLOOR = 2;
const FORBIDDEN_ORDINAL_FLOOR = 3;

export async function runModelPolicyEnforcement(options = {}) {
  const result = await buildModelPolicyEnforcement(options);
  if (options.write !== false) await writeModelPolicyEnforcement(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Model policy enforcement failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildModelPolicyEnforcement(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MODEL_POLICY_ENFORCEMENT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const dataClassificationResult = await readJsonOrError(inputs.data_classification_rule_engine_path);
  const modelRoutingResult = await readJsonOrError(inputs.model_routing_ledger_path);
  const policyContractResult = await readJsonOrError(inputs.policy_contract_freeze_path);
  const projected = projectModelPolicyEnforcement({
    dataClassificationRuleEngine: dataClassificationResult.value ?? {},
    modelRoutingLedger: modelRoutingResult.value ?? {},
    policyContractFreeze: policyContractResult.value ?? {},
    generatedAt,
  });
  const validationItems = validateModelPolicyEnforcement({
    dataClassificationResult,
    modelRoutingResult,
    policyContractResult,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "model-policy-enforcement.v1",
    generated_at: generatedAt,
    model_policy_enforcement_id: `model-policy-enforcement.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_data_classification_rule_engine: summarizeDataClassificationSource(dataClassificationResult),
    source_model_routing_ledger: summarizeModelRoutingSource(modelRoutingResult),
    source_policy_contract: summarizePolicyContractSource(policyContractResult),
    model_policy_gate_catalog: {
      schema_version: "model-policy-gate-catalog.v1",
      generated_at: generatedAt,
      classification_model_gates: projected.classificationModelGates,
      resource_model_gates: projected.resourceModelGates,
      route_model_gates: projected.routeModelGates,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeModelPolicyEnforcement(projected, validationItems, validation, {
      dataClassificationResult,
      modelRoutingResult,
      policyContractResult,
    }),
  };
  return {
    ...result,
    markdown: renderModelPolicyEnforcementMarkdown(result),
  };
}

export async function writeModelPolicyEnforcement(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "model-policy-enforcement.json"), serializable);
  await writeJson(path.join(outDir, "model-policy-gates.json"), serializable.model_policy_gate_catalog);
  await writeJson(path.join(outDir, "classification-model-gates.json"), {
    generated_at: result.generated_at,
    classification_model_gate_count: result.model_policy_gate_catalog.classification_model_gates.length,
    classification_model_gates: result.model_policy_gate_catalog.classification_model_gates,
  });
  await writeJson(path.join(outDir, "resource-model-gates.json"), {
    generated_at: result.generated_at,
    resource_model_gate_count: result.model_policy_gate_catalog.resource_model_gates.length,
    resource_model_gates: result.model_policy_gate_catalog.resource_model_gates,
  });
  await writeJson(path.join(outDir, "route-model-gates.json"), {
    generated_at: result.generated_at,
    route_model_gate_count: result.model_policy_gate_catalog.route_model_gates.length,
    route_model_gates: result.model_policy_gate_catalog.route_model_gates,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    model_policy_enforcement_id: result.model_policy_enforcement_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runModelPolicyEnforcementCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runModelPolicyEnforcement(args);
    console.log(`Model policy enforcement written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.model_policy_enforcement_status}`);
    console.log(`Classification gates: ${result.summary.classification_model_gate_count}`);
    console.log(`Resource gates: ${result.summary.resource_model_gate_count}`);
    console.log(`Route gates: ${result.summary.route_model_gate_count}`);
    console.log(`Unauthorized external allow: ${result.summary.unauthorized_external_allow_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectModelPolicyEnforcement({
  dataClassificationRuleEngine,
  modelRoutingLedger,
  policyContractFreeze,
  generatedAt,
}) {
  const classificationRules = dataClassificationRuleEngine.classification_rule_catalog?.classification_rules ?? [];
  const resourceClassificationDecisions = dataClassificationRuleEngine.classification_rule_catalog?.resource_classification_decisions ?? [];
  const routingDecisions = modelRoutingLedger.routing_decisions ?? [];
  const policyClassifications = policyContractFreeze.policy_contract?.data_classifications ?? [];
  const ordinalByClassification = new Map(policyClassifications.map((classification) => [classification.classification, classification.ordinal]));

  const classificationModelGates = classificationRules.map((rule) => buildClassificationModelGate({
    rule,
    ordinal: ordinalFor(rule.classification, rule.ordinal, ordinalByClassification),
    generatedAt,
  })).sort(by("classification_model_gate_id"));
  const classificationGateByClassification = new Map(classificationModelGates.map((gate) => [gate.classification, gate]));

  const resourceModelGates = resourceClassificationDecisions.map((decision) => buildResourceModelGate({
    decision,
    classificationGate: classificationGateByClassification.get(decision.effective_classification),
    ordinal: ordinalFor(decision.effective_classification, null, ordinalByClassification),
    generatedAt,
  })).sort(by("resource_model_gate_id"));

  const routeModelGates = routingDecisions.map((route) => buildRouteModelGate({
    route,
    classificationGate: classificationGateByClassification.get(route.classification),
    ordinal: ordinalFor(route.classification, null, ordinalByClassification),
    generatedAt,
  })).sort(by("route_model_gate_id"));

  return {
    classificationRules,
    resourceClassificationDecisions,
    routingDecisions,
    policyClassifications,
    classificationModelGates,
    resourceModelGates,
    routeModelGates,
  };
}

function buildClassificationModelGate({ rule, ordinal, generatedAt }) {
  const sensitiveData = ordinal >= SENSITIVE_ORDINAL_FLOOR;
  const forbiddenData = ordinal >= FORBIDDEN_ORDINAL_FLOOR;
  const gateDecision = modelDecisionFor(rule.external_model_decision, rule.external_model_policy);
  const gateStatus = statusForDecision(gateDecision);
  const reasonCodes = [];
  if (sensitiveData) reasonCodes.push("sensitive_classification");
  if (forbiddenData) reasonCodes.push("external_model_forbidden_floor");
  if (rule.external_model_policy === "approval_required") reasonCodes.push("external_model_requires_approval");
  if (rule.external_model_policy === "forbidden") reasonCodes.push("external_model_forbidden");
  if (rule.redaction_required || rule.redaction_policy === "required") reasonCodes.push("redaction_required");

  return {
    schema_version: "classification-model-policy-gate.v1",
    classification_model_gate_id: `classification-model-gate.${slugify(rule.classification)}`,
    classification_rule_id: rule.classification_rule_id,
    classification: rule.classification,
    classification_ordinal: ordinal,
    sensitive_data: sensitiveData,
    policy_decision_id: rule.policy_decision_id,
    external_model_policy: rule.external_model_policy,
    external_model_decision: gateDecision,
    local_model_policy: rule.local_model_policy,
    redaction_policy: rule.redaction_policy,
    requires_redaction: Boolean(rule.redaction_required || rule.redaction_policy === "required"),
    enforcement_mode: enforcementModeFor(gateDecision),
    gate_status: gateStatus,
    audit_required: true,
    human_approval_required: gateDecision === "review" || Boolean(rule.approval_required),
    required_gates: requiredModelGates(rule.required_gates, { sensitiveData, gateDecision, requiresRedaction: rule.redaction_required || rule.redaction_policy === "required" }),
    reason_codes: unique(reasonCodes),
    decided_at: generatedAt,
    metadata: {},
  };
}

function buildResourceModelGate({ decision, classificationGate, ordinal, generatedAt }) {
  const sensitiveData = ordinal >= SENSITIVE_ORDINAL_FLOOR;
  const gateDecision = resourceGateDecision(decision, classificationGate);
  const gateStatus = statusForDecision(gateDecision);
  const reasonCodes = unique([
    ...(decision.reason_codes ?? []),
    ...(classificationGate?.reason_codes ?? []),
    ...(sensitiveData ? ["sensitive_resource_classification"] : []),
    ...(decision.resource_policy_decision === "review" ? ["resource_policy_review_required"] : []),
  ]);
  return {
    schema_version: "resource-model-policy-gate.v1",
    resource_model_gate_id: `resource-model-gate.${slugify(decision.resource_id)}`,
    resource_classification_decision_id: decision.resource_classification_decision_id,
    resource_id: decision.resource_id,
    resource_version_id: decision.resource_version_id,
    tenant_id: decision.tenant_id,
    matter_id: decision.matter_id,
    classification: decision.effective_classification,
    classification_ordinal: ordinal,
    sensitive_data: sensitiveData,
    policy_decision_id: decision.policy_decision_id,
    policy_reference_id: decision.policy_reference_id,
    external_model_policy: decision.external_model_policy,
    external_model_decision: modelDecisionFor(decision.external_model_decision, decision.external_model_policy),
    local_model_policy: decision.local_model_policy,
    redaction_policy: decision.redaction_policy,
    requires_redaction: Boolean(decision.requires_redaction),
    resource_policy_decision: decision.resource_policy_decision,
    external_transfer_gate_status: externalTransferGateStatusFor(gateDecision),
    gate_decision: gateDecision,
    gate_status: gateStatus,
    audit_required: true,
    human_approval_required: gateDecision === "review" || Boolean(decision.requires_human_review),
    required_gates: requiredModelGates(decision.required_gates, { sensitiveData, gateDecision, requiresRedaction: decision.requires_redaction }),
    reason_codes: reasonCodes,
    decided_at: generatedAt,
    metadata: {
      source_system: decision.source_system,
      source_uri: decision.source_uri,
      linked_resource_access_decision_count: decision.linked_resource_access_decision_count ?? 0,
    },
  };
}

function buildRouteModelGate({ route, classificationGate, ordinal, generatedAt }) {
  const sensitiveData = ordinal >= SENSITIVE_ORDINAL_FLOOR;
  const sourceRouteDecision = route.route_status === "blocked" ? "deny" : route.route_status === "approval_required" ? "review" : "allow";
  const policyDecision = route.external_transfer ? modelDecisionFor(route.external_model_policy, route.external_model_policy) : sourceRouteDecision;
  const redactionMissing = Boolean(route.external_transfer && (classificationGate?.requires_redaction || route.redaction_policy === "required") && route.redaction_status !== "enforced");
  const gateDecision = route.route_status === "blocked" || redactionMissing
    ? "deny"
    : route.external_transfer
      ? stricterDecision(policyDecision, classificationGate?.external_model_decision ?? "review")
      : sourceRouteDecision;
  const gateStatus = statusForDecision(gateDecision);
  const reasonCodes = unique([
    ...(route.blocker_reasons ?? []),
    ...(route.approval_reasons ?? []),
    ...(classificationGate?.reason_codes ?? []),
    ...(sensitiveData ? ["sensitive_route_classification"] : []),
    ...(route.external_transfer ? ["external_transfer_requested"] : ["local_or_sandboxed_route"]),
    ...(redactionMissing ? ["redaction_required_before_external_transfer"] : []),
  ]);
  return {
    schema_version: "route-model-policy-gate.v1",
    route_model_gate_id: `route-model-gate.${slugify(route.routing_decision_id)}`,
    routing_decision_id: route.routing_decision_id,
    context_packet_id: route.context_packet_id,
    workflow_run_id: route.workflow_run_id,
    agent_run_id: route.agent_run_id,
    runtime_id: route.runtime_id,
    capability_id: route.capability_id,
    domain_pack: route.domain_pack,
    tenant_id: route.tenant_id,
    matter_id: route.matter_id,
    client_id: route.client_id,
    policy_snapshot_id: route.policy_snapshot_id,
    policy_decision_id: route.policy_decision_id,
    classification: route.classification,
    classification_ordinal: ordinal,
    sensitive_data: sensitiveData,
    source_route_status: route.route_status,
    source_route_mode: route.route_mode,
    external_transfer: Boolean(route.external_transfer),
    provider_boundary: route.provider_boundary,
    runtime_policy_status: route.runtime_policy_status,
    external_model_policy: route.external_model_policy,
    external_model_decision: route.external_transfer ? modelDecisionFor(route.external_model_policy, route.external_model_policy) : "not_applicable",
    local_model_policy: route.local_model_policy,
    redaction_policy: route.redaction_policy,
    redaction_status: route.redaction_status,
    gate_decision: gateDecision,
    gate_status: gateStatus,
    audit_required: true,
    human_approval_required: gateDecision === "review" || Boolean(route.approval_required),
    required_gates: requiredModelGates(route.required_gates, { sensitiveData, gateDecision, requiresRedaction: redactionMissing || route.redaction_policy === "required" }),
    enforcement_reasons: reasonCodes,
    decided_at: generatedAt,
    metadata: {
      prompt_injection_handling: route.prompt_injection_handling,
      routing_hash: route.routing_hash,
    },
  };
}

function validateModelPolicyEnforcement({
  dataClassificationResult,
  modelRoutingResult,
  policyContractResult,
  projected,
}) {
  const validationItems = [];
  const classificationGateIds = new Set(projected.classificationModelGates.map((gate) => gate.classification_model_gate_id));
  const resourceGateIds = new Set(projected.resourceModelGates.map((gate) => gate.resource_model_gate_id));
  const routeGateIds = new Set(projected.routeModelGates.map((gate) => gate.route_model_gate_id));
  const policyClassifications = new Set(projected.policyClassifications.map((classification) => classification.classification));
  const classificationRules = new Map(projected.classificationRules.map((rule) => [rule.classification, rule]));
  const routeGateByDecision = new Map(projected.routeModelGates.map((gate) => [gate.routing_decision_id, gate]));

  pushCheck(validationItems, "source", "data_classification_rule_engine", "source_available", dataClassificationResult.ok, "Data Classification Rule Engine must be readable.");
  pushCheck(validationItems, "source", "model_routing_ledger", "source_available", modelRoutingResult.ok, "Model Routing Ledger must be readable.");
  pushCheck(validationItems, "source", "policy_contract_freeze", "source_available", policyContractResult.ok, "Policy Contract Freeze must be readable.");
  pushCheck(validationItems, "source", dataClassificationResult.value?.classification_rule_engine_id ?? "data_classification_rule_engine", "data_classification_complete", dataClassificationResult.value?.summary?.classification_rule_engine_status === "complete", "Data Classification Rule Engine must be complete.");
  pushCheck(validationItems, "source", modelRoutingResult.value?.ledger_id ?? "model_routing_ledger", "model_routing_valid", modelRoutingResult.value?.ledger_status === "valid", "Model Routing Ledger must be valid before model policy enforcement.");
  pushCheck(validationItems, "source", policyContractResult.value?.freeze_id ?? "policy_contract_freeze", "policy_contract_complete", policyContractResult.value?.summary?.freeze_status === "complete", "Policy Contract Freeze must be complete.");

  pushUniqueIdChecks(validationItems, projected.classificationModelGates, "classification_model_gate", "classification_model_gate_id");
  pushUniqueIdChecks(validationItems, projected.resourceModelGates, "resource_model_gate", "resource_model_gate_id");
  pushUniqueIdChecks(validationItems, projected.routeModelGates, "route_model_gate", "route_model_gate_id");

  for (const rule of projected.classificationRules) {
    const gate = projected.classificationModelGates.find((item) => item.classification === rule.classification);
    pushCheck(validationItems, "classification_rule", rule.classification_rule_id, "classification_gate_present", Boolean(gate), "Every classification rule must have a model policy gate.");
  }

  for (const gate of projected.classificationModelGates) {
    pushCheck(validationItems, "classification_model_gate", gate.classification_model_gate_id, "gate_id_known", classificationGateIds.has(gate.classification_model_gate_id), "Classification model gate must have a stable id.");
    pushCheck(validationItems, "classification_model_gate", gate.classification_model_gate_id, "classification_known", policyClassifications.has(gate.classification), "Classification model gate must reference a DataClassification contract.");
    pushCheck(validationItems, "classification_model_gate", gate.classification_model_gate_id, "gate_decision_supported", DECISIONS.has(gate.external_model_decision), "Classification external model decision must be allow, review, or deny.");
    pushCheck(validationItems, "classification_model_gate", gate.classification_model_gate_id, "gate_status_supported", GATE_STATUSES.has(gate.gate_status), "Classification gate status must be supported.");
    pushCheck(validationItems, "classification_model_gate", gate.classification_model_gate_id, "p2_plus_not_external_allow", !gate.sensitive_data || gate.external_model_decision !== "allow", "P2-P5 classifications cannot allow external model transfer without a gate.");
    pushCheck(validationItems, "classification_model_gate", gate.classification_model_gate_id, "p3_plus_external_forbidden", gate.classification_ordinal < FORBIDDEN_ORDINAL_FLOOR || gate.external_model_decision === "deny", "P3-P5 classifications must deny external model transfer.");
  }

  for (const decision of projected.resourceClassificationDecisions) {
    const gate = projected.resourceModelGates.find((item) => item.resource_classification_decision_id === decision.resource_classification_decision_id);
    pushCheck(validationItems, "resource_classification_decision", decision.resource_classification_decision_id, "resource_gate_present", Boolean(gate), "Every resource classification decision must have a resource model gate.");
  }

  for (const gate of projected.resourceModelGates) {
    pushCheck(validationItems, "resource_model_gate", gate.resource_model_gate_id, "gate_id_known", resourceGateIds.has(gate.resource_model_gate_id), "Resource model gate must have a stable id.");
    pushCheck(validationItems, "resource_model_gate", gate.resource_model_gate_id, "classification_gate_known", classificationRules.has(gate.classification), "Resource model gate must reference a known classification rule.");
    pushCheck(validationItems, "resource_model_gate", gate.resource_model_gate_id, "gate_decision_supported", DECISIONS.has(gate.gate_decision), "Resource model gate decision must be allow, review, or deny.");
    pushCheck(validationItems, "resource_model_gate", gate.resource_model_gate_id, "gate_status_supported", GATE_STATUSES.has(gate.gate_status), "Resource model gate status must be supported.");
    pushCheck(validationItems, "resource_model_gate", gate.resource_model_gate_id, "sensitive_resource_not_external_allowed", !gate.sensitive_data || gate.external_transfer_gate_status !== "allowed", "P2-P5 resources cannot have an allowed external transfer gate.");
    pushCheck(validationItems, "resource_model_gate", gate.resource_model_gate_id, "review_requires_human", gate.gate_decision !== "review" || gate.human_approval_required === true, "Review model gates must require human approval.");
  }

  for (const route of projected.routingDecisions) {
    const gate = routeGateByDecision.get(route.routing_decision_id);
    pushCheck(validationItems, "routing_decision", route.routing_decision_id, "route_gate_present", Boolean(gate), "Every model routing decision must have a route model gate.");
  }

  for (const gate of projected.routeModelGates) {
    pushCheck(validationItems, "route_model_gate", gate.route_model_gate_id, "gate_id_known", routeGateIds.has(gate.route_model_gate_id), "Route model gate must have a stable id.");
    pushCheck(validationItems, "route_model_gate", gate.route_model_gate_id, "gate_decision_supported", DECISIONS.has(gate.gate_decision), "Route model gate decision must be allow, review, or deny.");
    pushCheck(validationItems, "route_model_gate", gate.route_model_gate_id, "gate_status_supported", GATE_STATUSES.has(gate.gate_status), "Route model gate status must be supported.");
    pushCheck(validationItems, "route_model_gate", gate.route_model_gate_id, "blocked_route_denied", gate.source_route_status !== "blocked" || gate.gate_decision === "deny", "Blocked model routes must remain denied.");
    pushCheck(validationItems, "route_model_gate", gate.route_model_gate_id, "sensitive_external_not_allowed", !(gate.sensitive_data && gate.external_transfer) || gate.gate_decision !== "allow", "P2-P5 external transfer routes must not pass as allow.");
    pushCheck(validationItems, "route_model_gate", gate.route_model_gate_id, "redaction_missing_not_allowed", !gate.enforcement_reasons.includes("redaction_required_before_external_transfer") || gate.gate_decision === "deny", "Missing redaction on an external route must deny the model gate.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.classificationModelGates.length === 0) errors.push({ path: "model_policy_gate_catalog.classification_model_gates", message: "At least one classification model gate is required." });
  if (projected.resourceModelGates.length === 0) errors.push({ path: "model_policy_gate_catalog.resource_model_gates", message: "At least one resource model gate is required." });
  if (projected.routeModelGates.length === 0) errors.push({ path: "model_policy_gate_catalog.route_model_gates", message: "At least one route model gate is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeModelPolicyEnforcement(projected, validationItems, validation, sources) {
  const classificationGates = projected.classificationModelGates;
  const resourceGates = projected.resourceModelGates;
  const routeGates = projected.routeModelGates;
  const externalRouteGates = routeGates.filter((gate) => gate.external_transfer);
  const p2PlusRouteGates = routeGates.filter((gate) => gate.external_transfer && gate.sensitive_data);
  const unauthorizedExternalAllow = p2PlusRouteGates.filter((gate) => gate.gate_decision === "allow").length;
  return {
    model_policy_enforcement_status: validation.valid ? "complete" : "blocked",
    source_data_classification_rule_engine_status: sources.dataClassificationResult.value?.summary?.classification_rule_engine_status ?? "unknown",
    source_model_routing_ledger_status: sources.modelRoutingResult.value?.ledger_status ?? "unknown",
    source_policy_contract_status: sources.policyContractResult.value?.summary?.freeze_status ?? "unknown",
    classification_model_gate_count: classificationGates.length,
    resource_model_gate_count: resourceGates.length,
    route_model_gate_count: routeGates.length,
    p2_p5_classification_gate_count: classificationGates.filter((gate) => gate.sensitive_data).length,
    p2_p5_resource_gate_count: resourceGates.filter((gate) => gate.sensitive_data).length,
    external_transfer_route_count: externalRouteGates.length,
    p2_p5_external_transfer_route_count: p2PlusRouteGates.length,
    external_transfer_allowed_count: externalRouteGates.filter((gate) => gate.gate_decision === "allow").length,
    external_transfer_review_count: externalRouteGates.filter((gate) => gate.gate_decision === "review").length,
    external_transfer_denied_count: externalRouteGates.filter((gate) => gate.gate_decision === "deny").length,
    high_sensitivity_external_denied_count: p2PlusRouteGates.filter((gate) => gate.classification_ordinal >= FORBIDDEN_ORDINAL_FLOOR && gate.gate_decision === "deny").length,
    unauthorized_external_allow_count: unauthorizedExternalAllow,
    redaction_required_resource_gate_count: resourceGates.filter((gate) => gate.requires_redaction).length,
    redaction_required_external_route_count: externalRouteGates.filter((gate) => gate.redaction_policy === "required").length,
    redaction_blocked_route_count: routeGates.filter((gate) => gate.enforcement_reasons.includes("redaction_required_before_external_transfer")).length,
    human_approval_required_gate_count: [...classificationGates, ...resourceGates, ...routeGates].filter((gate) => gate.human_approval_required).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_gate_status: countBy([...classificationGates, ...resourceGates, ...routeGates], "gate_status"),
    by_gate_decision: countBy([...resourceGates, ...routeGates], "gate_decision"),
    by_classification: countBy([...resourceGates, ...routeGates], "classification"),
    by_external_model_policy: countBy([...classificationGates, ...resourceGates, ...routeGates], "external_model_policy"),
  };
}

function summarizeDataClassificationSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    classification_rule_engine_id: source.classification_rule_engine_id ?? null,
    classification_rule_engine_status: source.summary?.classification_rule_engine_status ?? (result.ok ? "unknown" : "missing"),
    classification_rule_count: source.summary?.classification_rule_count ?? 0,
    resource_classification_decision_count: source.summary?.resource_classification_decision_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeModelRoutingSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    ledger_id: source.ledger_id ?? null,
    ledger_status: source.ledger_status ?? (result.ok ? "unknown" : "missing"),
    routing_decision_count: source.summary?.routing_decision_count ?? 0,
    external_transfer_count: source.summary?.external_transfer_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizePolicyContractSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? (result.ok ? "unknown" : "missing"),
    classification_count: source.summary?.classification_count ?? 0,
    policy_decision_count: source.summary?.policy_decision_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function renderModelPolicyEnforcementMarkdown(result) {
  const lines = [];
  lines.push("# Model Policy Enforcement");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.model_policy_enforcement_status}`);
  lines.push("");
  lines.push(`- Classification gates: ${result.summary.classification_model_gate_count}`);
  lines.push(`- Resource gates: ${result.summary.resource_model_gate_count}`);
  lines.push(`- Route gates: ${result.summary.route_model_gate_count}`);
  lines.push(`- External transfer routes: ${result.summary.external_transfer_route_count}`);
  lines.push(`- P2-P5 external transfer routes: ${result.summary.p2_p5_external_transfer_route_count}`);
  lines.push(`- Unauthorized external allow: ${result.summary.unauthorized_external_allow_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Classification Gates");
  for (const gate of result.model_policy_gate_catalog.classification_model_gates) {
    lines.push(`- ${gate.classification}: ${gate.enforcement_mode}, ${gate.gate_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function modelDecisionFor(decisionOrPolicy, policyFallback) {
  if (decisionOrPolicy === "allow") return "allow";
  if (decisionOrPolicy === "review") return "review";
  if (decisionOrPolicy === "deny") return "deny";
  if (decisionOrPolicy === "allowed_with_audit") return "allow";
  if (decisionOrPolicy === "approval_required") return "review";
  if (decisionOrPolicy === "forbidden") return "deny";
  if (policyFallback === "allowed_with_audit") return "allow";
  if (policyFallback === "approval_required") return "review";
  if (policyFallback === "forbidden") return "deny";
  return "review";
}

function resourceGateDecision(decision, classificationGate) {
  if (decision.resource_policy_decision === "deny") return "deny";
  if (decision.resource_policy_decision === "review") return "review";
  return classificationGate?.external_model_decision ?? modelDecisionFor(decision.external_model_decision, decision.external_model_policy);
}

function stricterDecision(left, right) {
  const order = { allow: 0, review: 1, deny: 2 };
  return (order[left] ?? 1) >= (order[right] ?? 1) ? left : right;
}

function statusForDecision(decision) {
  if (decision === "deny") return "blocked";
  if (decision === "review") return "requires_approval";
  return "passed";
}

function externalTransferGateStatusFor(decision) {
  if (decision === "deny") return "blocked";
  if (decision === "review") return "requires_approval";
  return "allowed";
}

function enforcementModeFor(decision) {
  if (decision === "deny") return "external_forbidden";
  if (decision === "review") return "external_requires_approval";
  return "external_allowed_with_audit";
}

function requiredModelGates(existing, { sensitiveData, gateDecision, requiresRedaction }) {
  return unique([
    ...(existing ?? []),
    "model_policy_gate",
    ...(sensitiveData ? ["external_model_gate"] : []),
    ...(gateDecision === "review" ? ["human_approval_gate"] : []),
    ...(requiresRedaction ? ["redaction_gate"] : []),
  ]);
}

function ordinalFor(classification, explicitOrdinal, ordinalByClassification) {
  if (Number.isInteger(explicitOrdinal)) return explicitOrdinal;
  if (Number.isInteger(ordinalByClassification.get(classification))) return ordinalByClassification.get(classification);
  const match = /^P(\d+)_/.exec(String(classification ?? ""));
  return match ? Number.parseInt(match[1], 10) : 0;
}

function normalizeInputs(options) {
  return {
    data_classification_rule_engine_path: path.resolve(options.dataClassificationRuleEnginePath ?? DEFAULT_MODEL_POLICY_ENFORCEMENT_INPUTS.dataClassificationRuleEnginePath),
    model_routing_ledger_path: path.resolve(options.modelRoutingLedgerPath ?? DEFAULT_MODEL_POLICY_ENFORCEMENT_INPUTS.modelRoutingLedgerPath),
    policy_contract_freeze_path: path.resolve(options.policyContractFreezePath ?? DEFAULT_MODEL_POLICY_ENFORCEMENT_INPUTS.policyContractFreezePath),
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
    else if (arg === "--data-classification-rules") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--model-routing-ledger") parsed.modelRoutingLedgerPath = argv[++index];
    else if (arg === "--policy-contract-freeze") parsed.policyContractFreezePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/model-policy-enforcement.mjs [options]

Options:
  --data-classification-rules <path> data-classification-rule-engine.json path.
  --model-routing-ledger <path>      model-routing-ledger.json path.
  --policy-contract-freeze <path>    policy-contract-freeze.json path.
  --out-dir <path>                   Output directory.
  --run-at <iso>                     Deterministic timestamp.
  --check                            Exit non-zero when validation fails.
  --no-write                         Build without writing artifacts.
  -h, --help                         Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function pushUniqueIdChecks(items, rows, subjectType, idKey) {
  const seen = new Set();
  for (const row of rows) {
    const id = row[idKey];
    const unique = Boolean(id) && !seen.has(id);
    pushCheck(items, subjectType, id ?? "missing_id", `${idKey}_unique`, unique, `${idKey} must be present and unique.`);
    if (id) seen.add(id);
  }
}

function pushCheck(items, subjectType, subjectId, checkId, passed, message) {
  items.push({
    schema_version: "model-policy-enforcement-validation.v1",
    validation_id: `model-policy-validation.${slugify(subjectType)}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: String(subjectId ?? "unknown"),
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
