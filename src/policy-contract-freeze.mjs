import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_CONTRACT_FREEZE_OUT_DIR = "artifacts/policy-contract-freeze/latest";
export const DEFAULT_POLICY_CONTRACT_FREEZE_INPUTS = {
  policyMatrixCatalogPath: "artifacts/policy-matrix/latest/policy-matrix-catalog.json",
  policySnapshotLedgerPath: "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
};

const REQUIRED_CLASSIFICATIONS = [
  "P0_PUBLIC",
  "P1_INTERNAL",
  "P2_CLIENT_CONFIDENTIAL",
  "P3_PRIVILEGED",
  "P4_HIGHLY_RESTRICTED",
  "P5_SECRET",
];

const CLASSIFICATION_ORDINALS = new Map(REQUIRED_CLASSIFICATIONS.map((classification, index) => [classification, index]));
const EXTERNAL_MODEL_POLICIES = new Set(["allowed_with_audit", "approval_required", "forbidden"]);
const REFERENCE_TYPES = new Set(["snapshot", "usage", "resource", "client", "matter", "matter_boundary"]);

export async function runPolicyContractFreeze(options = {}) {
  const result = await buildPolicyContractFreeze(options);
  if (options.write !== false) await writePolicyContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicyContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_CONTRACT_FREEZE_OUT_DIR);
  const inputs = {
    policy_matrix_catalog_path: path.resolve(options.policyMatrixCatalogPath ?? DEFAULT_POLICY_CONTRACT_FREEZE_INPUTS.policyMatrixCatalogPath),
    policy_snapshot_ledger_path: path.resolve(options.policySnapshotLedgerPath ?? DEFAULT_POLICY_CONTRACT_FREEZE_INPUTS.policySnapshotLedgerPath),
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_POLICY_CONTRACT_FREEZE_INPUTS.resourceContractFreezePath),
    matter_contract_freeze_path: path.resolve(options.matterContractFreezePath ?? DEFAULT_POLICY_CONTRACT_FREEZE_INPUTS.matterContractFreezePath),
  };
  const policyMatrixCatalog = await readJson(inputs.policy_matrix_catalog_path);
  const policySnapshotLedger = await readJson(inputs.policy_snapshot_ledger_path);
  const resourceContractFreeze = await readJson(inputs.resource_contract_freeze_path);
  const matterContractFreeze = await readJson(inputs.matter_contract_freeze_path);
  const classificationContracts = buildClassificationContracts(policyMatrixCatalog, generatedAt);
  const policyDecisionContracts = buildPolicyDecisionContracts(policyMatrixCatalog, policySnapshotLedger, classificationContracts, generatedAt);
  const policyReferenceContracts = buildPolicyReferenceContracts({
    policySnapshotLedger,
    resourceContractFreeze,
    matterContractFreeze,
    classificationContracts,
    generatedAt,
  });
  const validationItems = validatePolicyContracts({
    policyMatrixCatalog,
    policySnapshotLedger,
    resourceContractFreeze,
    matterContractFreeze,
    classificationContracts,
    policyDecisionContracts,
    policyReferenceContracts,
  });
  const validation = summarizeValidation(validationItems, classificationContracts, policyReferenceContracts);
  const result = {
    schema_version: "policy-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `policy-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      policy_matrix_catalog: {
        schema_version: policyMatrixCatalog.schema_version,
        catalog_id: policyMatrixCatalog.catalog_id,
        policy_status: policyMatrixCatalog.policy_status,
      },
      policy_snapshot_ledger: {
        schema_version: policySnapshotLedger.schema_version,
        ledger_id: policySnapshotLedger.ledger_id,
        ledger_status: policySnapshotLedger.ledger_status,
      },
      resource_contract_freeze: {
        schema_version: resourceContractFreeze.schema_version,
        freeze_id: resourceContractFreeze.freeze_id,
        freeze_status: resourceContractFreeze.summary?.freeze_status ?? null,
      },
      matter_contract_freeze: {
        schema_version: matterContractFreeze.schema_version,
        freeze_id: matterContractFreeze.freeze_id,
        freeze_status: matterContractFreeze.summary?.freeze_status ?? null,
      },
    },
    contract_versions: {
      data_classification_schema_version: "data-classification.v2",
      policy_reference_schema_version: "policy-reference.v2",
      policy_decision_schema_version: "policy-decision.v2",
      compatibility_floor: "policy-matrix-catalog.v1+policy-snapshot-ledger.v1",
    },
    summary: summarizeFreeze({
      classificationContracts,
      policyDecisionContracts,
      policyReferenceContracts,
      validationItems,
      validation,
    }),
    policy_contract: {
      schema_version: "policy-contract.v2",
      generated_at: generatedAt,
      data_classifications: classificationContracts,
      policy_decisions: policyDecisionContracts,
      policy_references: policyReferenceContracts,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderPolicyContractFreezeMarkdown(result),
  };
}

export async function writePolicyContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "policy-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "data-classification-v2-fixture.json"), {
    generated_at: result.generated_at,
    data_classification_schema_version: result.contract_versions.data_classification_schema_version,
    classification_count: result.policy_contract.data_classifications.length,
    data_classifications: result.policy_contract.data_classifications,
  });
  await writeJson(path.join(outDir, "policy-reference-v2-fixture.json"), {
    generated_at: result.generated_at,
    policy_reference_schema_version: result.contract_versions.policy_reference_schema_version,
    policy_reference_count: result.policy_contract.policy_references.length,
    policy_references: result.policy_contract.policy_references,
  });
  await writeJson(path.join(outDir, "policy-decision-v2-fixture.json"), {
    generated_at: result.generated_at,
    policy_decision_schema_version: result.contract_versions.policy_decision_schema_version,
    policy_decision_count: result.policy_contract.policy_decisions.length,
    policy_decisions: result.policy_contract.policy_decisions,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicyContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicyContractFreeze(args);
    console.log(`Policy contract freeze written to ${result.output_dir}`);
    console.log(`Classifications v2: ${result.summary.classification_count}`);
    console.log(`Policy references v2: ${result.summary.policy_reference_count}`);
    console.log(`Resolved references: ${result.summary.resolved_policy_reference_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildClassificationContracts(policyMatrixCatalog, generatedAt) {
  const runtimeRules = new Map((policyMatrixCatalog.runtime_rules ?? []).map((rule) => [rule.classification, rule]));
  const modelRules = new Map((policyMatrixCatalog.model_rules ?? []).map((rule) => [rule.classification, rule]));
  const gateRules = new Map((policyMatrixCatalog.gate_rules ?? []).map((rule) => [rule.gate_id, rule]));
  return (policyMatrixCatalog.classification_levels ?? []).map((level) => {
    const runtimeRule = runtimeRules.get(level.classification) ?? {};
    const modelRule = modelRules.get(level.classification) ?? {};
    return {
      schema_version: "data-classification.v2",
      classification: level.classification,
      ordinal: CLASSIFICATION_ORDINALS.get(level.classification) ?? null,
      name: level.name,
      description: level.description,
      default_external_model_policy: level.default_external_model_policy,
      runtime_rule_id: runtimeRule.runtime_rule_id ?? null,
      model_rule_id: modelRule.model_rule_id ?? null,
      allowed_runtimes: runtimeRule.allowed_runtimes ?? [],
      restricted_runtimes: runtimeRule.restricted_runtimes ?? [],
      forbidden_runtimes: runtimeRule.forbidden_runtimes ?? [],
      required_gates: runtimeRule.required_gates ?? [],
      blocking_gate_ids: (runtimeRule.required_gates ?? []).filter((gateId) => gateRules.get(gateId)?.blocking_by_default),
      external_model_policy: modelRule.external_model_policy ?? level.default_external_model_policy ?? null,
      local_model_policy: modelRule.local_model_policy ?? null,
      redaction_policy: modelRule.redaction_policy ?? null,
      approval_required: Boolean(modelRule.approval_required),
      created_at: generatedAt,
      metadata: level.metadata ?? {},
    };
  }).sort((left, right) => (left.ordinal ?? 999) - (right.ordinal ?? 999));
}

function buildPolicyDecisionContracts(policyMatrixCatalog, policySnapshotLedger, classificationContracts, generatedAt) {
  const ledgerDecisionsByClassification = groupBy(policySnapshotLedger.policy_decisions ?? [], "classification");
  const matrixRuntimeRules = new Map((policyMatrixCatalog.runtime_rules ?? []).map((rule) => [rule.classification, rule]));
  return classificationContracts.map((classification) => {
    const ledgerDecisions = ledgerDecisionsByClassification.get(classification.classification) ?? [];
    const runtimeRule = matrixRuntimeRules.get(classification.classification) ?? {};
    return {
      schema_version: "policy-decision.v2",
      decision_id: `policy-decision-contract.${slugify(classification.classification)}`,
      classification: classification.classification,
      default_external_model_policy: classification.default_external_model_policy,
      external_model_policy: classification.external_model_policy,
      local_model_policy: classification.local_model_policy,
      redaction_policy: classification.redaction_policy,
      approval_required: classification.approval_required,
      allowed_runtimes: classification.allowed_runtimes,
      restricted_runtimes: classification.restricted_runtimes,
      forbidden_runtimes: classification.forbidden_runtimes,
      required_gates: classification.required_gates,
      snapshot_policy_decision_ids: ledgerDecisions.map((decision) => decision.decision_id).sort(),
      snapshot_policy_decision_count: ledgerDecisions.length,
      decision_status: ledgerDecisions.some((decision) => decision.decision_status === "blocked") ? "blocked" : "passed",
      runtime_rule_id: runtimeRule.runtime_rule_id ?? null,
      created_at: generatedAt,
      metadata: {},
    };
  });
}

function buildPolicyReferenceContracts({
  policySnapshotLedger,
  resourceContractFreeze,
  matterContractFreeze,
  classificationContracts,
  generatedAt,
}) {
  const snapshotIds = new Set((policySnapshotLedger.policy_snapshots ?? []).map((snapshot) => snapshot.policy_snapshot_id));
  const classificationIds = new Set(classificationContracts.map((classification) => classification.classification));
  const references = [];

  for (const snapshot of policySnapshotLedger.policy_snapshots ?? []) {
    references.push(referenceContract({
      referenceType: "snapshot",
      sourceArtifact: "policy_snapshot_ledger",
      sourceId: "policy_snapshot_ledger",
      subjectType: "policy_snapshot",
      subjectId: snapshot.policy_snapshot_id,
      policySnapshotId: snapshot.policy_snapshot_id,
      tenantId: snapshot.tenant_id,
      matterId: null,
      classification: snapshot.default_classification,
      occurredAt: snapshot.created_at_latest,
      snapshotIds,
      classificationIds,
      generatedAt,
      metadata: {
        source_ids: snapshot.source_ids,
        body_hash: snapshot.body_hash,
      },
    }));
  }

  for (const usage of policySnapshotLedger.usage_records ?? []) {
    references.push(referenceContract({
      referenceType: "usage",
      sourceArtifact: "policy_snapshot_ledger",
      sourceId: usage.source_id,
      subjectType: usage.usage_type,
      subjectId: usage.workflow_run_id ?? usage.event_id ?? usage.run_ledger_id ?? usage.usage_id,
      policySnapshotId: usage.policy_snapshot_id,
      tenantId: usage.tenant_id,
      matterId: usage.matter_id,
      classification: classificationForSnapshot(policySnapshotLedger, usage.policy_snapshot_id),
      occurredAt: usage.occurred_at,
      snapshotIds,
      classificationIds,
      generatedAt,
      metadata: {
        usage_id: usage.usage_id,
        status: usage.status,
      },
    }));
  }

  for (const resource of resourceContractFreeze.resource_contract?.resources ?? []) {
    references.push(referenceContract({
      referenceType: "resource",
      sourceArtifact: "resource_contract_freeze",
      sourceId: "resource_contract_freeze",
      subjectType: "resource",
      subjectId: resource.resource_id,
      policySnapshotId: resource.policy_snapshot_id,
      tenantId: resource.tenant_id,
      matterId: resource.matter_id,
      classification: resource.classification,
      occurredAt: resource.created_at,
      snapshotIds,
      classificationIds,
      generatedAt,
      metadata: {
        source_system: resource.source_system,
        external_id: resource.external_id,
      },
    }));
  }

  for (const client of matterContractFreeze.matter_contract?.clients ?? []) {
    references.push(referenceContract({
      referenceType: "client",
      sourceArtifact: "matter_contract_freeze",
      sourceId: "matter_contract_freeze",
      subjectType: "client",
      subjectId: client.client_id,
      policySnapshotId: client.default_policy_snapshot_id,
      tenantId: client.tenant_id,
      matterId: null,
      classification: client.classification_floor,
      occurredAt: client.created_at,
      snapshotIds,
      classificationIds,
      generatedAt,
      metadata: {
        client_status: client.client_status,
      },
    }));
  }

  for (const matter of matterContractFreeze.matter_contract?.matters ?? []) {
    references.push(referenceContract({
      referenceType: "matter",
      sourceArtifact: "matter_contract_freeze",
      sourceId: "matter_contract_freeze",
      subjectType: "matter",
      subjectId: matter.matter_id,
      policySnapshotId: matter.default_policy_snapshot_id,
      tenantId: matter.tenant_id,
      matterId: matter.matter_id,
      classification: matter.classification,
      occurredAt: matter.created_at,
      snapshotIds,
      classificationIds,
      generatedAt,
      metadata: {
        client_id: matter.client_id,
        matter_status: matter.matter_status,
      },
    }));
  }

  for (const boundary of matterContractFreeze.matter_contract?.matter_boundaries ?? []) {
    references.push(referenceContract({
      referenceType: "matter_boundary",
      sourceArtifact: "matter_contract_freeze",
      sourceId: "matter_contract_freeze",
      subjectType: "matter_boundary",
      subjectId: boundary.matter_boundary_id,
      policySnapshotId: boundary.policy_snapshot_id,
      tenantId: boundary.tenant_id,
      matterId: boundary.matter_id,
      classification: boundary.classification,
      occurredAt: boundary.created_at,
      snapshotIds,
      classificationIds,
      generatedAt,
      metadata: {
        client_id: boundary.client_id,
        access_scope: boundary.access_scope,
      },
    }));
  }

  return references.sort((left, right) => left.policy_reference_id.localeCompare(right.policy_reference_id));
}

function referenceContract({
  referenceType,
  sourceArtifact,
  sourceId,
  subjectType,
  subjectId,
  policySnapshotId,
  tenantId,
  matterId,
  classification,
  occurredAt,
  snapshotIds,
  classificationIds,
  generatedAt,
  metadata,
}) {
  const policyResolved = Boolean(policySnapshotId && snapshotIds.has(policySnapshotId));
  const classificationResolved = Boolean(classification && classificationIds.has(classification));
  return {
    schema_version: "policy-reference.v2",
    policy_reference_id: `policy-reference.${slugify(referenceType)}.${slugify(sourceId)}.${slugify(subjectId)}`,
    reference_type: referenceType,
    source_artifact: sourceArtifact,
    source_id: sourceId,
    subject_type: subjectType,
    subject_id: subjectId,
    tenant_id: tenantId ?? null,
    matter_id: matterId ?? null,
    policy_snapshot_id: policySnapshotId ?? null,
    classification: classification ?? null,
    policy_snapshot_resolved: policyResolved,
    classification_resolved: classificationResolved,
    reference_status: policyResolved && classificationResolved ? "resolved" : "unresolved",
    occurred_at: occurredAt ?? generatedAt,
    metadata: metadata ?? {},
  };
}

function classificationForSnapshot(policySnapshotLedger, policySnapshotId) {
  return (policySnapshotLedger.policy_snapshots ?? []).find((snapshot) => snapshot.policy_snapshot_id === policySnapshotId)?.default_classification ?? null;
}

function validatePolicyContracts({
  policyMatrixCatalog,
  policySnapshotLedger,
  resourceContractFreeze,
  matterContractFreeze,
  classificationContracts,
  policyDecisionContracts,
  policyReferenceContracts,
}) {
  const validationItems = [];
  const classificationIds = new Set(classificationContracts.map((classification) => classification.classification));
  const runtimeRuleClassifications = new Set((policyMatrixCatalog.runtime_rules ?? []).map((rule) => rule.classification));
  const modelRuleClassifications = new Set((policyMatrixCatalog.model_rules ?? []).map((rule) => rule.classification));

  pushCheck(validationItems, "policy_matrix_catalog", policyMatrixCatalog.catalog_id, "policy_matrix_valid", policyMatrixCatalog.policy_status === "valid", "Policy matrix catalog must be valid.");
  pushCheck(validationItems, "policy_snapshot_ledger", policySnapshotLedger.ledger_id, "policy_snapshot_ledger_valid", policySnapshotLedger.ledger_status === "valid", "Policy snapshot ledger must be valid.");
  pushCheck(validationItems, "resource_contract_freeze", resourceContractFreeze.freeze_id, "resource_contract_freeze_complete", resourceContractFreeze.summary?.freeze_status === "complete", "Resource contract freeze must be complete.");
  pushCheck(validationItems, "matter_contract_freeze", matterContractFreeze.freeze_id, "matter_contract_freeze_complete", matterContractFreeze.summary?.freeze_status === "complete", "Matter contract freeze must be complete.");

  for (const requiredClassification of REQUIRED_CLASSIFICATIONS) {
    pushCheck(validationItems, "data_classification", requiredClassification, "classification_present", classificationIds.has(requiredClassification), `${requiredClassification} must exist in the data classification contract.`);
    pushCheck(validationItems, "data_classification", requiredClassification, "runtime_rule_present", runtimeRuleClassifications.has(requiredClassification), `${requiredClassification} must have a runtime policy rule.`);
    pushCheck(validationItems, "data_classification", requiredClassification, "model_rule_present", modelRuleClassifications.has(requiredClassification), `${requiredClassification} must have a model policy rule.`);
  }

  for (const classification of classificationContracts) {
    pushCheck(validationItems, "data_classification", classification.classification, "canonical_classification", REQUIRED_CLASSIFICATIONS.includes(classification.classification), "Classification must be one of P0-P5.");
    pushCheck(validationItems, "data_classification", classification.classification, "ordinal_present", Number.isInteger(classification.ordinal), "Classification must carry a stable ordinal.");
    pushCheck(validationItems, "data_classification", classification.classification, "external_model_policy_present", EXTERNAL_MODEL_POLICIES.has(classification.external_model_policy), "Classification must carry a canonical external model policy.");
    pushCheck(validationItems, "data_classification", classification.classification, "required_gates_present", classification.required_gates.length > 0, "Classification must carry required gate ids.");
    if (["P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET"].includes(classification.classification)) {
      pushCheck(validationItems, "data_classification", classification.classification, "high_sensitivity_external_model_forbidden", classification.external_model_policy === "forbidden", "P3-P5 classifications must forbid external model transfer by default.");
    }
  }

  for (const decision of policyDecisionContracts) {
    pushCheck(validationItems, "policy_decision", decision.decision_id, "classification_link_present", classificationIds.has(decision.classification), "PolicyDecision must link to a DataClassification v2 contract.");
    pushCheck(validationItems, "policy_decision", decision.decision_id, "external_model_policy_present", EXTERNAL_MODEL_POLICIES.has(decision.external_model_policy), "PolicyDecision must preserve the external model policy.");
    pushCheck(validationItems, "policy_decision", decision.decision_id, "runtime_rule_link_present", Boolean(decision.runtime_rule_id), "PolicyDecision must link to a runtime rule.");
  }

  for (const reference of policyReferenceContracts) {
    pushCheck(validationItems, "policy_reference", reference.policy_reference_id, "reference_type_canonical", REFERENCE_TYPES.has(reference.reference_type), "PolicyReference must have a canonical reference type.");
    pushCheck(validationItems, "policy_reference", reference.policy_reference_id, "policy_snapshot_id_present", Boolean(reference.policy_snapshot_id), "PolicyReference must carry a policy snapshot id.");
    pushCheck(validationItems, "policy_reference", reference.policy_reference_id, "policy_snapshot_resolved", reference.policy_snapshot_resolved, "PolicyReference must resolve to a known policy snapshot.");
    pushCheck(validationItems, "policy_reference", reference.policy_reference_id, "classification_present", Boolean(reference.classification), "PolicyReference must carry a classification.");
    pushCheck(validationItems, "policy_reference", reference.policy_reference_id, "classification_resolved", reference.classification_resolved, "PolicyReference classification must resolve to a DataClassification v2 contract.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `policy-contract-validation.${subjectType}.${slugify(subjectId)}.${checkId}`,
    subject_type: subjectType,
    subject_id: subjectId ?? "unknown",
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems, classificationContracts, policyReferenceContracts) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (classificationContracts.length === 0) errors.push({ path: "policy_contract.data_classifications", message: "At least one DataClassification v2 fixture is required." });
  if (policyReferenceContracts.length === 0) errors.push({ path: "policy_contract.policy_references", message: "At least one PolicyReference v2 fixture is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFreeze({ classificationContracts, policyDecisionContracts, policyReferenceContracts, validationItems, validation }) {
  const missingClassifications = REQUIRED_CLASSIFICATIONS.filter((classification) => !classificationContracts.some((contract) => contract.classification === classification));
  const extraClassifications = classificationContracts.map((contract) => contract.classification).filter((classification) => !REQUIRED_CLASSIFICATIONS.includes(classification));
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    data_classification_schema_version: "data-classification.v2",
    policy_reference_schema_version: "policy-reference.v2",
    policy_decision_schema_version: "policy-decision.v2",
    required_classification_count: REQUIRED_CLASSIFICATIONS.length,
    classification_count: classificationContracts.length,
    missing_classification_count: missingClassifications.length,
    extra_classification_count: extraClassifications.length,
    runtime_rule_link_count: classificationContracts.filter((classification) => classification.runtime_rule_id).length,
    model_rule_link_count: classificationContracts.filter((classification) => classification.model_rule_id).length,
    policy_decision_count: policyDecisionContracts.length,
    policy_reference_count: policyReferenceContracts.length,
    resolved_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_status === "resolved").length,
    unresolved_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_status !== "resolved").length,
    snapshot_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_type === "snapshot").length,
    usage_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_type === "usage").length,
    resource_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_type === "resource").length,
    client_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_type === "client").length,
    matter_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_type === "matter").length,
    matter_boundary_policy_reference_count: policyReferenceContracts.filter((reference) => reference.reference_type === "matter_boundary").length,
    external_model_forbidden_count: classificationContracts.filter((classification) => classification.external_model_policy === "forbidden").length,
    external_model_approval_required_count: classificationContracts.filter((classification) => classification.external_model_policy === "approval_required").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_classification: countBy(policyReferenceContracts, "classification"),
    by_reference_type: countBy(policyReferenceContracts, "reference_type"),
    by_reference_status: countBy(policyReferenceContracts, "reference_status"),
  };
}

function renderPolicyContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Policy Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.freeze_status}`);
  lines.push("");
  lines.push(`- DataClassification schema: ${result.summary.data_classification_schema_version}`);
  lines.push(`- PolicyReference schema: ${result.summary.policy_reference_schema_version}`);
  lines.push(`- PolicyDecision schema: ${result.summary.policy_decision_schema_version}`);
  lines.push(`- Classifications: ${result.summary.classification_count}/${result.summary.required_classification_count}`);
  lines.push(`- Policy references: ${result.summary.policy_reference_count}`);
  lines.push(`- Resolved references: ${result.summary.resolved_policy_reference_count}`);
  lines.push(`- Unresolved references: ${result.summary.unresolved_policy_reference_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Reference Types");
  for (const [referenceType, count] of Object.entries(result.summary.by_reference_type)) {
    lines.push(`- ${referenceType}: ${count}`);
  }
  lines.push("");
  lines.push("## Classifications");
  for (const classification of result.policy_contract.data_classifications) {
    lines.push(`- ${classification.classification}: external=${classification.external_model_policy}, local=${classification.local_model_policy}, redaction=${classification.redaction_policy}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
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

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 180) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--policy-matrix-catalog") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--policy-snapshot-ledger") parsed.policySnapshotLedgerPath = argv[++index];
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--matter-contract-freeze") parsed.matterContractFreezePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-contract-freeze.mjs [options]

Options:
  --out-dir <path>                  Output directory.
  --policy-matrix-catalog <path>    policy-matrix-catalog.json path.
  --policy-snapshot-ledger <path>   policy-snapshot-ledger.json path.
  --resource-contract-freeze <path> resource-contract-freeze.json path.
  --matter-contract-freeze <path>   matter-contract-freeze.json path.
  --run-at <iso>                    Override generated_at.
  --check                           Exit non-zero on validation errors.
  --help                            Show this help.
`);
}
