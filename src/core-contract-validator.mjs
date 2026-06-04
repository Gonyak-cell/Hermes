import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SCHEMA_DIR = "schemas/core";
const DEFAULT_VERTICAL_SLICE = "examples/core/vertical-slice-example.json";
const DEFAULT_POLICY_MATRIX = "examples/core/policy-matrix.json";
const DEFAULT_EVENT_LEDGER = "examples/core/event-ledger.json";
const DEFAULT_RUNTIME_ADAPTER_REGISTRY = "examples/core/runtime-adapters.json";
const DEFAULT_CAPABILITY_MANIFESTS = [
  "examples/core/capabilities/law-firm-ldd-vdr-inventory.json",
  "examples/core/capabilities/personal-dev-codex-worktree.json",
];

const SECTION_SCHEMAS = {
  identity_policy: "identity-policy.schema.json",
  resource_evidence: "resource-evidence.schema.json",
  workflow_runtime: "workflow-runtime.schema.json",
  governance_output: "governance-output.schema.json",
};

export async function validateVerticalSliceFile(filePath = DEFAULT_VERTICAL_SLICE, options = {}) {
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const slice = JSON.parse(await readFile(filePath, "utf8"));
  const schemas = await loadCoreSchemas(schemaDir);
  return validateVerticalSlice(slice, schemas);
}

export async function validatePolicyMatrixFile(filePath = DEFAULT_POLICY_MATRIX, options = {}) {
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const matrix = JSON.parse(await readFile(filePath, "utf8"));
  const schemas = await loadCoreSchemas(schemaDir);
  return validatePolicyMatrix(matrix, schemas);
}

export async function validateEventLedgerFile(filePath = DEFAULT_EVENT_LEDGER, options = {}) {
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const verticalSlicePath = options.verticalSlicePath ?? DEFAULT_VERTICAL_SLICE;
  const ledger = JSON.parse(await readFile(filePath, "utf8"));
  const slice = JSON.parse(await readFile(verticalSlicePath, "utf8"));
  const schemas = await loadCoreSchemas(schemaDir);
  return validateEventLedger(ledger, schemas, slice);
}

export async function validateRuntimeAdapterRegistryFile(filePath = DEFAULT_RUNTIME_ADAPTER_REGISTRY, options = {}) {
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const policyMatrixPath = options.policyMatrixPath ?? DEFAULT_POLICY_MATRIX;
  const capabilityManifestPaths = options.capabilityManifestPaths ?? DEFAULT_CAPABILITY_MANIFESTS;
  const registry = JSON.parse(await readFile(filePath, "utf8"));
  const policyMatrix = JSON.parse(await readFile(policyMatrixPath, "utf8"));
  const capabilityManifests = [];
  for (const manifestPath of capabilityManifestPaths) {
    capabilityManifests.push(JSON.parse(await readFile(manifestPath, "utf8")));
  }
  const schemas = await loadCoreSchemas(schemaDir);
  return validateRuntimeAdapterRegistry(registry, schemas, policyMatrix, capabilityManifests);
}

export async function validateCapabilityManifestFile(filePath, options = {}) {
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const policyMatrixPath = options.policyMatrixPath ?? DEFAULT_POLICY_MATRIX;
  const manifest = JSON.parse(await readFile(filePath, "utf8"));
  const policyMatrix = JSON.parse(await readFile(policyMatrixPath, "utf8"));
  const schemas = await loadCoreSchemas(schemaDir);
  return validateCapabilityManifest(manifest, schemas, policyMatrix);
}

export async function validateDefaultCapabilityManifests(options = {}) {
  const results = [];
  for (const filePath of options.filePaths ?? DEFAULT_CAPABILITY_MANIFESTS) {
    results.push({
      filePath,
      result: await validateCapabilityManifestFile(filePath, options),
    });
  }
  return results;
}

export async function loadCoreSchemas(schemaDir = DEFAULT_SCHEMA_DIR) {
  const schemaFiles = [
    "common.schema.json",
    "identity-policy.schema.json",
    "resource-evidence.schema.json",
    "workflow-runtime.schema.json",
    "governance-output.schema.json",
    "policy-matrix.schema.json",
    "capability-manifest.schema.json",
    "event-ledger.schema.json",
    "runtime-adapter.schema.json",
  ];
  const schemas = {};
  for (const schemaFile of schemaFiles) {
    schemas[schemaFile] = JSON.parse(await readFile(path.join(schemaDir, schemaFile), "utf8"));
  }
  return schemas;
}

export function validatePolicyMatrix(matrix, schemas) {
  const errors = validateAgainstSchema(matrix, schemas["policy-matrix.schema.json"], schemas, "policy_matrix");
  errors.push(...validatePolicyMatrixSemantics(matrix));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCapabilityManifest(manifest, schemas, policyMatrix) {
  const errors = validateAgainstSchema(
    manifest,
    schemas["capability-manifest.schema.json"],
    schemas,
    "capability_manifest",
  );
  errors.push(...validateCapabilityManifestSemantics(manifest, policyMatrix));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEventLedger(ledger, schemas, slice) {
  const errors = validateAgainstSchema(ledger, schemas["event-ledger.schema.json"], schemas, "event_ledger");
  errors.push(...validateEventLedgerSemantics(ledger, slice));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateRuntimeAdapterRegistry(registry, schemas, policyMatrix, capabilityManifests = []) {
  const errors = validateAgainstSchema(
    registry,
    schemas["runtime-adapter.schema.json"],
    schemas,
    "runtime_adapter_registry",
  );
  errors.push(...validateRuntimeAdapterRegistrySemantics(registry, policyMatrix, capabilityManifests));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateVerticalSlice(slice, schemas) {
  const errors = [];

  for (const [sectionName, schemaFile] of Object.entries(SECTION_SCHEMAS)) {
    if (!slice[sectionName]) {
      errors.push({
        path: sectionName,
        message: `Missing vertical slice section ${sectionName}`,
      });
      continue;
    }
    errors.push(...validateAgainstSchema(slice[sectionName], schemas[schemaFile], schemas, sectionName));
  }

  errors.push(...validateReferentialIntegrity(slice));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateAgainstSchema(value, schema, schemas, dataPath = "$", rootSchema = schema) {
  const { schema: resolved, rootSchema: resolvedRootSchema } = resolveSchemaContext(schema, schemas, rootSchema);
  const errors = [];

  if (!resolved) {
    return [{ path: dataPath, message: `Unable to resolve schema ${JSON.stringify(schema)}` }];
  }

  if (resolved.const !== undefined && value !== resolved.const) {
    errors.push({ path: dataPath, message: `Expected const ${JSON.stringify(resolved.const)}` });
  }

  if (resolved.enum && !resolved.enum.includes(value)) {
    errors.push({ path: dataPath, message: `Expected one of ${resolved.enum.join(", ")}` });
  }

  if (resolved.type && !matchesType(value, resolved.type)) {
    errors.push({ path: dataPath, message: `Expected type ${JSON.stringify(resolved.type)}` });
    return errors;
  }

  if (typeof value === "string") {
    if (Number.isFinite(resolved.minLength) && value.length < resolved.minLength) {
      errors.push({ path: dataPath, message: `Expected minLength ${resolved.minLength}` });
    }
    if (resolved.pattern && !new RegExp(resolved.pattern).test(value)) {
      errors.push({ path: dataPath, message: `Expected pattern ${resolved.pattern}` });
    }
    if (resolved.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push({ path: dataPath, message: "Expected date-time format" });
    }
  }

  if (typeof value === "number") {
    if (Number.isFinite(resolved.minimum) && value < resolved.minimum) {
      errors.push({ path: dataPath, message: `Expected minimum ${resolved.minimum}` });
    }
    if (Number.isFinite(resolved.maximum) && value > resolved.maximum) {
      errors.push({ path: dataPath, message: `Expected maximum ${resolved.maximum}` });
    }
  }

  if (Array.isArray(value)) {
    if (Number.isFinite(resolved.minItems) && value.length < resolved.minItems) {
      errors.push({ path: dataPath, message: `Expected at least ${resolved.minItems} items` });
    }
    if (Number.isFinite(resolved.maxItems) && value.length > resolved.maxItems) {
      errors.push({ path: dataPath, message: `Expected at most ${resolved.maxItems} items` });
    }
    if (resolved.items) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, resolved.items, schemas, `${dataPath}[${index}]`, resolvedRootSchema));
      });
    }
  }

  if (isPlainObject(value)) {
    const required = resolved.required ?? [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push({ path: dataPath, message: `Missing required property ${key}` });
      }
    }

    const properties = resolved.properties ?? {};
    for (const [key, childValue] of Object.entries(value)) {
      if (properties[key]) {
        errors.push(...validateAgainstSchema(childValue, properties[key], schemas, `${dataPath}.${key}`, resolvedRootSchema));
      } else if (resolved.additionalProperties === false) {
        errors.push({ path: `${dataPath}.${key}`, message: "Additional property is not allowed" });
      }
    }
  }

  return errors;
}

function validateReferentialIntegrity(slice) {
  const errors = [];
  const ids = new Map();

  const collect = (collection, type) => {
    for (const item of collection ?? []) {
      if (item.id) ids.set(item.id, { type, item });
    }
  };

  collect(slice.identity_policy?.tenants, "tenant");
  collect(slice.identity_policy?.users, "user");
  collect(slice.identity_policy?.clients, "client");
  collect(slice.identity_policy?.matters, "matter");
  collect(slice.identity_policy?.policy_snapshots, "policy_snapshot");
  collect(slice.resource_evidence?.resources, "resource");
  collect(slice.resource_evidence?.resource_versions, "resource_version");
  collect(slice.resource_evidence?.normalized_texts, "normalized_text");
  collect(slice.resource_evidence?.source_spans, "source_span");
  collect(slice.resource_evidence?.evidence_items, "evidence_item");
  collect(slice.resource_evidence?.facts, "fact");
  collect(slice.resource_evidence?.issues, "issue");
  collect(slice.resource_evidence?.citations, "citation");
  collect(slice.workflow_runtime?.capabilities, "capability");
  collect(slice.workflow_runtime?.workflows, "workflow");
  collect(slice.workflow_runtime?.workflow_runs, "workflow_run");
  collect(slice.workflow_runtime?.agent_runs, "agent_run");
  collect(slice.governance_output?.gate_results, "gate_result");
  collect(slice.governance_output?.approvals, "approval");
  collect(slice.governance_output?.output_artifacts, "output_artifact");
  collect(slice.governance_output?.audit_events, "audit_event");

  const expect = (fromPath, id, type) => {
    const record = ids.get(id);
    if (!record) {
      errors.push({ path: fromPath, message: `Missing referenced ${type} ${id}` });
    } else if (record.type !== type) {
      errors.push({ path: fromPath, message: `Expected ${id} to reference ${type}, found ${record.type}` });
    }
  };

  for (const resource of slice.resource_evidence?.resources ?? []) {
    expect(`resources.${resource.id}.tenant_id`, resource.tenant_id, "tenant");
    expect(`resources.${resource.id}.matter_id`, resource.matter_id, "matter");
  }

  for (const resourceVersion of slice.resource_evidence?.resource_versions ?? []) {
    expect(`resource_versions.${resourceVersion.id}.resource_id`, resourceVersion.resource_id, "resource");
  }

  for (const normalizedText of slice.resource_evidence?.normalized_texts ?? []) {
    expect(`normalized_texts.${normalizedText.id}.resource_id`, normalizedText.resource_id, "resource");
    expect(
      `normalized_texts.${normalizedText.id}.resource_version_id`,
      normalizedText.resource_version_id,
      "resource_version",
    );
  }

  for (const sourceSpan of slice.resource_evidence?.source_spans ?? []) {
    expect(`source_spans.${sourceSpan.id}.resource_id`, sourceSpan.resource_id, "resource");
    expect(`source_spans.${sourceSpan.id}.resource_version_id`, sourceSpan.resource_version_id, "resource_version");
  }

  for (const evidence of slice.resource_evidence?.evidence_items ?? []) {
    expect(`evidence_items.${evidence.id}.matter_id`, evidence.matter_id, "matter");
    for (const sourceSpanId of evidence.source_span_ids) {
      expect(`evidence_items.${evidence.id}.source_span_ids`, sourceSpanId, "source_span");
    }
  }

  for (const fact of slice.resource_evidence?.facts ?? []) {
    expect(`facts.${fact.id}.matter_id`, fact.matter_id, "matter");
    for (const evidenceId of fact.evidence_item_ids) {
      expect(`facts.${fact.id}.evidence_item_ids`, evidenceId, "evidence_item");
    }
  }

  for (const issue of slice.resource_evidence?.issues ?? []) {
    expect(`issues.${issue.id}.matter_id`, issue.matter_id, "matter");
    for (const factId of issue.linked_fact_ids) {
      expect(`issues.${issue.id}.linked_fact_ids`, factId, "fact");
    }
  }

  for (const citation of slice.resource_evidence?.citations ?? []) {
    expect(`citations.${citation.id}.output_artifact_id`, citation.output_artifact_id, "output_artifact");
    for (const sourceSpanId of citation.source_span_ids) {
      expect(`citations.${citation.id}.source_span_ids`, sourceSpanId, "source_span");
    }
    for (const evidenceId of citation.evidence_item_ids) {
      expect(`citations.${citation.id}.evidence_item_ids`, evidenceId, "evidence_item");
    }
  }

  for (const workflow of slice.workflow_runtime?.workflows ?? []) {
    expect(`workflows.${workflow.id}.capability_id`, workflow.capability_id, "capability");
  }

  for (const workflowRun of slice.workflow_runtime?.workflow_runs ?? []) {
    expect(`workflow_runs.${workflowRun.id}.workflow_id`, workflowRun.workflow_id, "workflow");
    expect(`workflow_runs.${workflowRun.id}.capability_id`, workflowRun.capability_id, "capability");
    expect(`workflow_runs.${workflowRun.id}.tenant_id`, workflowRun.tenant_id, "tenant");
    expect(`workflow_runs.${workflowRun.id}.matter_id`, workflowRun.matter_id, "matter");
    expect(`workflow_runs.${workflowRun.id}.policy_snapshot_id`, workflowRun.policy_snapshot_id, "policy_snapshot");
  }

  for (const agentRun of slice.workflow_runtime?.agent_runs ?? []) {
    expect(`agent_runs.${agentRun.id}.workflow_run_id`, agentRun.workflow_run_id, "workflow_run");
  }

  for (const outputArtifact of slice.governance_output?.output_artifacts ?? []) {
    expect(`output_artifacts.${outputArtifact.id}.tenant_id`, outputArtifact.tenant_id, "tenant");
    expect(`output_artifacts.${outputArtifact.id}.matter_id`, outputArtifact.matter_id, "matter");
    expect(`output_artifacts.${outputArtifact.id}.created_by_run_id`, outputArtifact.created_by_run_id, "agent_run");
    for (const citationId of outputArtifact.citation_ids) {
      expect(`output_artifacts.${outputArtifact.id}.citation_ids`, citationId, "citation");
    }
  }

  for (const gateResult of slice.governance_output?.gate_results ?? []) {
    expect(`gate_results.${gateResult.id}.workflow_run_id`, gateResult.workflow_run_id, "workflow_run");
  }

  for (const approval of slice.governance_output?.approvals ?? []) {
    expect(`approvals.${approval.id}.workflow_run_id`, approval.workflow_run_id, "workflow_run");
    expect(`approvals.${approval.id}.output_artifact_id`, approval.output_artifact_id, "output_artifact");
    expect(`approvals.${approval.id}.requested_from`, approval.requested_from, "user");
  }

  return errors;
}

function validatePolicyMatrixSemantics(matrix) {
  const errors = [];
  const requiredClassifications = [
    "P0_PUBLIC",
    "P1_INTERNAL",
    "P2_CLIENT_CONFIDENTIAL",
    "P3_PRIVILEGED",
    "P4_HIGHLY_RESTRICTED",
    "P5_SECRET",
  ];

  const classificationSets = {
    classification_levels: new Set((matrix.classification_levels ?? []).map((item) => item.classification)),
    runtime_rules: new Set((matrix.runtime_rules ?? []).map((item) => item.classification)),
    model_rules: new Set((matrix.model_rules ?? []).map((item) => item.classification)),
  };

  errors.push(...validateUniqueBy(matrix.classification_levels, "classification_levels", "classification"));
  errors.push(...validateUniqueBy(matrix.runtime_rules, "runtime_rules", "classification"));
  errors.push(...validateUniqueBy(matrix.model_rules, "model_rules", "classification"));
  errors.push(...validateUniqueBy(matrix.tool_rules, "tool_rules", "tool_id"));
  errors.push(...validateUniqueBy(matrix.output_rules, "output_rules", "artifact_type"));
  errors.push(...validateUniqueBy(matrix.gate_rules, "gate_rules", "gate_id"));

  for (const [section, values] of Object.entries(classificationSets)) {
    for (const classification of requiredClassifications) {
      if (!values.has(classification)) {
        errors.push({ path: section, message: `Missing rule for ${classification}` });
      }
    }
  }

  const gateIds = new Set((matrix.gate_rules ?? []).map((gate) => gate.gate_id));
  const checkGateRefs = (pathPrefix, items) => {
    for (const item of items ?? []) {
      for (const gateId of item.required_gates ?? []) {
        if (!gateIds.has(gateId)) {
          errors.push({ path: `${pathPrefix}.${item.classification ?? item.tool_id ?? item.artifact_type}`, message: `Unknown gate ${gateId}` });
        }
      }
    }
  };

  checkGateRefs("runtime_rules", matrix.runtime_rules);
  checkGateRefs("tool_rules", matrix.tool_rules);
  checkGateRefs("output_rules", matrix.output_rules);

  for (const runtimeRule of matrix.runtime_rules ?? []) {
    errors.push(...validateRuntimePartition(runtimeRule));
  }

  const secretRule = (matrix.model_rules ?? []).find((rule) => rule.classification === "P5_SECRET");
  if (secretRule?.external_model_policy !== "forbidden" || secretRule?.local_model_policy !== "forbidden") {
    errors.push({ path: "model_rules.P5_SECRET", message: "P5_SECRET must be forbidden for external and local models" });
  }

  const privilegedRule = (matrix.model_rules ?? []).find((rule) => rule.classification === "P3_PRIVILEGED");
  if (privilegedRule?.external_model_policy !== "forbidden") {
    errors.push({ path: "model_rules.P3_PRIVILEGED", message: "P3_PRIVILEGED external model policy must be forbidden" });
  }

  const clientRule = (matrix.model_rules ?? []).find((rule) => rule.classification === "P2_CLIENT_CONFIDENTIAL");
  if (!clientRule?.approval_required) {
    errors.push({ path: "model_rules.P2_CLIENT_CONFIDENTIAL", message: "P2_CLIENT_CONFIDENTIAL must require approval" });
  }
  if (clientRule?.redaction_policy !== "required") {
    errors.push({ path: "model_rules.P2_CLIENT_CONFIDENTIAL", message: "P2_CLIENT_CONFIDENTIAL must require redaction" });
  }

  const p4Rule = (matrix.model_rules ?? []).find((rule) => rule.classification === "P4_HIGHLY_RESTRICTED");
  if (p4Rule?.external_model_policy !== "forbidden") {
    errors.push({ path: "model_rules.P4_HIGHLY_RESTRICTED", message: "P4_HIGHLY_RESTRICTED external model policy must be forbidden" });
  }

  const p5RuntimeRule = (matrix.runtime_rules ?? []).find((rule) => rule.classification === "P5_SECRET");
  for (const runtimeId of ["hermes", "claude_code", "codex", "document_renderer", "mcp_tool", "browser"]) {
    if (!p5RuntimeRule?.forbidden_runtimes?.includes(runtimeId)) {
      errors.push({ path: "runtime_rules.P5_SECRET", message: `P5_SECRET must forbid runtime ${runtimeId}` });
    }
  }

  const outputRulesByType = new Map((matrix.output_rules ?? []).map((rule) => [rule.artifact_type, rule]));
  requireOutputGate(errors, outputRulesByType, "docx", "citation_gate");
  requireOutputGate(errors, outputRulesByType, "docx", "human_approval_gate");
  requireOutputGate(errors, outputRulesByType, "email_draft", "output_destination_gate");
  requireOutputGate(errors, outputRulesByType, "pr_draft", "test_gate");
  requireOutputGate(errors, outputRulesByType, "pr_draft", "diff_review_gate");

  const vectorRule = (matrix.tool_rules ?? []).find((rule) => rule.tool_id === "vector.retrieve");
  const requiredFilters = vectorRule?.metadata?.filter_required ?? [];
  for (const requiredFilter of ["tenant_id", "matter_id", "wall_id", "classification"]) {
    if (!requiredFilters.includes(requiredFilter)) {
      errors.push({ path: "tool_rules.vector.retrieve", message: `vector.retrieve must require filter ${requiredFilter}` });
    }
  }

  return errors;
}

function validateCapabilityManifestSemantics(manifest, policyMatrix) {
  const errors = [];
  const gateIds = new Set((policyMatrix.gate_rules ?? []).map((gate) => gate.gate_id));
  const toolIds = new Set((policyMatrix.tool_rules ?? []).map((tool) => tool.tool_id));
  const outputTypes = new Set((policyMatrix.output_rules ?? []).map((output) => output.artifact_type));
  const allGateRefs = [
    ...(manifest.required_gates?.pre_run ?? []),
    ...(manifest.required_gates?.in_run ?? []),
    ...(manifest.required_gates?.post_run ?? []),
  ];

  for (const gateId of allGateRefs) {
    if (!gateIds.has(gateId)) {
      errors.push({ path: `capability_manifest.${manifest.capability_id}.required_gates`, message: `Unknown gate ${gateId}` });
    }
  }

  for (const toolId of manifest.required_tools ?? []) {
    if (!toolIds.has(toolId)) {
      errors.push({ path: `capability_manifest.${manifest.capability_id}.required_tools`, message: `Unknown tool ${toolId}` });
    }
  }

  for (const outputArtifact of manifest.output_artifacts ?? []) {
    if (!outputTypes.has(outputArtifact.artifact_type)) {
      errors.push({
        path: `capability_manifest.${manifest.capability_id}.output_artifacts`,
        message: `Unknown output artifact type ${outputArtifact.artifact_type}`,
      });
    }
  }

  const runtimeRule = (policyMatrix.runtime_rules ?? []).find(
    (rule) => rule.classification === manifest.data_policy?.max_input_classification,
  );
  for (const runtimeId of manifest.allowed_runtimes ?? []) {
    if (runtimeRule?.forbidden_runtimes?.includes(runtimeId)) {
      errors.push({
        path: `capability_manifest.${manifest.capability_id}.allowed_runtimes`,
        message: `${runtimeId} is forbidden for ${manifest.data_policy.max_input_classification}`,
      });
    }
  }

  const maxClassification = manifest.data_policy?.max_input_classification;
  if (
    ["claude_code", "codex", "hermes"].some((runtimeId) => manifest.allowed_runtimes?.includes(runtimeId)) &&
    classificationRank(maxClassification) >= classificationRank("P2_CLIENT_CONFIDENTIAL")
  ) {
    errors.push({
      path: `capability_manifest.${manifest.capability_id}.allowed_runtimes`,
      message: "Agent runtimes for P2 or higher require a narrower redacted-context capability",
    });
  }

  if (
    classificationRank(maxClassification) >= classificationRank("P2_CLIENT_CONFIDENTIAL") &&
    manifest.data_policy?.external_model_policy === "allowed"
  ) {
    errors.push({
      path: `capability_manifest.${manifest.capability_id}.data_policy.external_model_policy`,
      message: "P2 or higher capabilities cannot allow external model transfer by default",
    });
  }

  if (manifest.domain_pack === "law-firm") {
    if (!manifest.capability_id.startsWith("law_firm.")) {
      errors.push({ path: `capability_manifest.${manifest.capability_id}.capability_id`, message: "Law-firm capability id must start with law_firm." });
    }
    for (const gateId of ["matter_access_gate", "classification_gate", "human_approval_gate"]) {
      if (!allGateRefs.includes(gateId)) {
        errors.push({ path: `capability_manifest.${manifest.capability_id}.required_gates`, message: `Law-firm capability must require ${gateId}` });
      }
    }
    for (const filterId of ["tenant_id", "matter_id", "classification"]) {
      if (!manifest.data_policy?.retrieval_filters_required?.includes(filterId)) {
        errors.push({
          path: `capability_manifest.${manifest.capability_id}.data_policy.retrieval_filters_required`,
          message: `Law-firm capability must require retrieval filter ${filterId}`,
        });
      }
    }
  }

  if (manifest.domain_pack === "personal-dev" && !manifest.capability_id.startsWith("personal_dev.")) {
    errors.push({ path: `capability_manifest.${manifest.capability_id}.capability_id`, message: "Personal-dev capability id must start with personal_dev." });
  }

  if (manifest.allowed_runtimes?.includes("codex")) {
    for (const gateId of ["protected_file_gate", "diff_review_gate", "test_gate"]) {
      if (!allGateRefs.includes(gateId)) {
        errors.push({ path: `capability_manifest.${manifest.capability_id}.required_gates`, message: `Codex capability must require ${gateId}` });
      }
    }
  }

  return errors;
}

function validateEventLedgerSemantics(ledger, slice) {
  const errors = [];
  const eventIds = new Set();
  const eventById = new Map();
  const ledgerRefs = buildLedgerRefMap(ledger);
  for (const event of ledger.events ?? []) {
    if (eventIds.has(event.id)) {
      errors.push({ path: "event_ledger.events", message: `Duplicate event id ${event.id}` });
    }
    eventIds.add(event.id);
    eventById.set(event.id, event);
  }

  for (const event of ledger.events ?? []) {
    if (event.causation_id && !eventById.has(event.causation_id)) {
      errors.push({ path: `event_ledger.events.${event.id}.causation_id`, message: `Unknown causation event ${event.causation_id}` });
    }
    if (event.policy_snapshot_id) {
      expectSliceRef(errors, slice, `event_ledger.events.${event.id}.policy_snapshot_id`, event.policy_snapshot_id, "policy_snapshot");
    }
    expectSliceRef(errors, slice, `event_ledger.events.${event.id}.tenant_id`, event.tenant_id, "tenant");
    expectEventSubjectRef(errors, slice, ledgerRefs, event);
  }

  for (const runLedger of ledger.run_ledgers ?? []) {
    expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.tenant_id`, runLedger.tenant_id, "tenant");
    expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.workflow_run_id`, runLedger.workflow_run_id, "workflow_run");
    expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.capability_id`, runLedger.capability_id, "capability");
    expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.policy_snapshot_id`, runLedger.policy_snapshot_id, "policy_snapshot");

    for (const eventId of runLedger.event_ids ?? []) {
      const event = eventById.get(eventId);
      if (!event) {
        errors.push({ path: `event_ledger.run_ledgers.${runLedger.id}.event_ids`, message: `Unknown event ${eventId}` });
      } else if (event.correlation_id !== runLedger.workflow_run_id) {
        errors.push({
          path: `event_ledger.run_ledgers.${runLedger.id}.event_ids`,
          message: `Event ${eventId} correlation_id must match workflow_run_id ${runLedger.workflow_run_id}`,
        });
      }
    }

    for (const inputRef of runLedger.input_refs ?? []) {
      expectAnySliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.input_refs`, inputRef);
    }
    for (const agentRunId of runLedger.agent_run_ids ?? []) {
      expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.agent_run_ids`, agentRunId, "agent_run");
    }
    for (const gateResultId of runLedger.gate_result_ids ?? []) {
      expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.gate_result_ids`, gateResultId, "gate_result");
    }
    for (const approvalId of runLedger.approval_ids ?? []) {
      expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.approval_ids`, approvalId, "approval");
    }
    for (const outputArtifactId of runLedger.output_artifact_ids ?? []) {
      expectSliceRef(errors, slice, `event_ledger.run_ledgers.${runLedger.id}.output_artifact_ids`, outputArtifactId, "output_artifact");
    }
  }

  return errors;
}

function validateRuntimeAdapterRegistrySemantics(registry, policyMatrix, capabilityManifests) {
  const errors = [];
  const adapters = registry.adapters ?? [];
  const adaptersByRuntime = new Map();
  const adapterIds = new Set();
  const runtimeIds = new Set();
  const toolIds = new Set((policyMatrix.tool_rules ?? []).map((tool) => tool.tool_id));
  const gateIds = new Set((policyMatrix.gate_rules ?? []).map((gate) => gate.gate_id));
  const outputTypes = new Set((policyMatrix.output_rules ?? []).map((output) => output.artifact_type));
  const policyRuntimeIds = collectPolicyRuntimeIds(policyMatrix);

  for (const adapter of adapters) {
    if (adapterIds.has(adapter.adapter_id)) {
      errors.push({ path: "runtime_adapter_registry.adapters", message: `Duplicate adapter_id ${adapter.adapter_id}` });
    }
    adapterIds.add(adapter.adapter_id);

    if (runtimeIds.has(adapter.runtime_id)) {
      errors.push({ path: "runtime_adapter_registry.adapters", message: `Duplicate runtime_id ${adapter.runtime_id}` });
    }
    runtimeIds.add(adapter.runtime_id);
    adaptersByRuntime.set(adapter.runtime_id, adapter);

    errors.push(...validateRuntimeAdapterPolicyRefs(adapter, toolIds, gateIds, outputTypes));
    errors.push(...validateRuntimeAdapterClassificationPolicy(adapter, policyMatrix));
    errors.push(...validateRuntimeAdapterRiskPolicy(adapter));
  }

  for (const runtimeId of policyRuntimeIds) {
    if (!adaptersByRuntime.has(runtimeId)) {
      errors.push({ path: "runtime_adapter_registry.adapters", message: `Missing adapter for policy runtime ${runtimeId}` });
    }
  }

  for (const manifest of capabilityManifests ?? []) {
    errors.push(...validateCapabilityRuntimeBindings(manifest, adaptersByRuntime));
  }

  return errors;
}

function validateRuntimeAdapterPolicyRefs(adapter, toolIds, gateIds, outputTypes) {
  const errors = [];
  const allowedTools = adapter.tool_policy?.allowed_tools ?? [];
  const forbiddenTools = adapter.tool_policy?.forbidden_tools ?? [];
  const allowedToolSet = new Set(allowedTools);

  for (const toolId of [...allowedTools, ...forbiddenTools]) {
    if (!toolIds.has(toolId)) {
      errors.push({
        path: `runtime_adapter_registry.adapters.${adapter.runtime_id}.tool_policy`,
        message: `Unknown tool ${toolId}`,
      });
    }
  }

  for (const forbiddenTool of forbiddenTools) {
    if (allowedToolSet.has(forbiddenTool)) {
      errors.push({
        path: `runtime_adapter_registry.adapters.${adapter.runtime_id}.tool_policy`,
        message: `Tool ${forbiddenTool} cannot be both allowed and forbidden`,
      });
    }
  }

  for (const gateId of [
    ...(adapter.tool_policy?.required_gates ?? []),
    ...(adapter.verification?.required_gates ?? []),
  ]) {
    if (!gateIds.has(gateId)) {
      errors.push({
        path: `runtime_adapter_registry.adapters.${adapter.runtime_id}.required_gates`,
        message: `Unknown gate ${gateId}`,
      });
    }
  }

  for (const artifactType of adapter.output_contract?.artifact_types ?? []) {
    if (!outputTypes.has(artifactType)) {
      errors.push({
        path: `runtime_adapter_registry.adapters.${adapter.runtime_id}.output_contract.artifact_types`,
        message: `Unknown output artifact type ${artifactType}`,
      });
    }
  }

  return errors;
}

function validateRuntimeAdapterClassificationPolicy(adapter, policyMatrix) {
  const errors = [];
  const runtimeId = adapter.runtime_id;
  const classifications = [
    ...(adapter.data_access?.default_allowed_classifications ?? []),
    ...(adapter.data_access?.raw_context_allowed_classifications ?? []),
    ...(adapter.data_access?.redacted_context_allowed_classifications ?? []),
  ];

  for (const classification of classifications) {
    const runtimeRule = (policyMatrix.runtime_rules ?? []).find((rule) => rule.classification === classification);
    if (runtimeRule?.forbidden_runtimes?.includes(runtimeId)) {
      errors.push({
        path: `runtime_adapter_registry.adapters.${runtimeId}.data_access`,
        message: `${runtimeId} is forbidden for ${classification}`,
      });
    }
  }

  if (
    runtimeId !== "manual" &&
    adapter.data_access?.raw_context_allowed_classifications?.includes("P5_SECRET")
  ) {
    errors.push({
      path: `runtime_adapter_registry.adapters.${runtimeId}.data_access.raw_context_allowed_classifications`,
      message: "Only manual runtime can accept P5_SECRET raw context",
    });
  }

  if (adapter.execution_environment?.external_execution && !adapter.input_contract?.redaction_required) {
    errors.push({
      path: `runtime_adapter_registry.adapters.${runtimeId}.input_contract.redaction_required`,
      message: "External execution runtimes must require redaction by default",
    });
  }

  if (
    adapter.execution_environment?.external_execution &&
    (adapter.data_access?.raw_context_allowed_classifications ?? []).some(
      (classification) => classificationRank(classification) >= classificationRank("P2_CLIENT_CONFIDENTIAL"),
    )
  ) {
    errors.push({
      path: `runtime_adapter_registry.adapters.${runtimeId}.data_access.raw_context_allowed_classifications`,
      message: "External execution runtimes cannot accept P2 or higher raw context by default",
    });
  }

  return errors;
}

function validateRuntimeAdapterRiskPolicy(adapter) {
  const errors = [];
  const runtimeId = adapter.runtime_id;
  const highRiskRuntimeIds = new Set(["hermes", "claude_code", "codex", "mcp_tool", "browser"]);

  if (
    (["high", "critical"].includes(adapter.risk_level) || highRiskRuntimeIds.has(runtimeId)) &&
    !adapter.verification?.verification_required
  ) {
    errors.push({
      path: `runtime_adapter_registry.adapters.${runtimeId}.verification.verification_required`,
      message: "High-risk runtimes must require verification",
    });
  }

  if (["high", "critical"].includes(adapter.risk_level)) {
    for (const key of ["logs_required", "trace_required", "output_hash_required", "artifact_capture_required"]) {
      if (!adapter.observability?.[key]) {
        errors.push({
          path: `runtime_adapter_registry.adapters.${runtimeId}.observability.${key}`,
          message: "High-risk runtimes must capture logs, traces, output hashes, and artifacts",
        });
      }
    }
  }

  if (["codex", "claude_code"].includes(runtimeId)) {
    if (adapter.workspace_policy?.isolation_type !== "git_worktree") {
      errors.push({
        path: `runtime_adapter_registry.adapters.${runtimeId}.workspace_policy.isolation_type`,
        message: `${runtimeId} must use git_worktree isolation`,
      });
    }
    if (adapter.output_contract?.output_trust !== "untrusted_until_verified") {
      errors.push({
        path: `runtime_adapter_registry.adapters.${runtimeId}.output_contract.output_trust`,
        message: `${runtimeId} output must be untrusted_until_verified`,
      });
    }
    for (const gateId of ["protected_file_gate", "diff_review_gate", "test_gate"]) {
      if (!adapter.verification?.required_gates?.includes(gateId)) {
        errors.push({
          path: `runtime_adapter_registry.adapters.${runtimeId}.verification.required_gates`,
          message: `${runtimeId} must require ${gateId}`,
        });
      }
    }
  }

  if (runtimeId === "document_renderer") {
    if (adapter.output_contract?.output_trust !== "draft_only") {
      errors.push({
        path: "runtime_adapter_registry.adapters.document_renderer.output_contract.output_trust",
        message: "document_renderer output must be draft_only",
      });
    }
    for (const gateId of ["format_validation_gate", "human_approval_gate"]) {
      if (!adapter.verification?.required_gates?.includes(gateId)) {
        errors.push({
          path: "runtime_adapter_registry.adapters.document_renderer.verification.required_gates",
          message: `document_renderer must require ${gateId}`,
        });
      }
    }
  }

  return errors;
}

function validateCapabilityRuntimeBindings(manifest, adaptersByRuntime) {
  const errors = [];
  const allowedRuntimeIds = manifest.allowed_runtimes ?? [];
  const requiredTools = manifest.required_tools ?? [];
  const maxClassification = manifest.data_policy?.max_input_classification;
  const runtimeToolUnion = new Set();
  let runtimeCanHandleMaxClassification = false;

  for (const runtimeId of allowedRuntimeIds) {
    const adapter = adaptersByRuntime.get(runtimeId);
    if (!adapter) {
      errors.push({
        path: `capability_manifest.${manifest.capability_id}.allowed_runtimes`,
        message: `Missing runtime adapter ${runtimeId}`,
      });
      continue;
    }

    for (const toolId of adapter.tool_policy?.allowed_tools ?? []) {
      runtimeToolUnion.add(toolId);
    }

    if (adapter.data_access?.default_allowed_classifications?.includes(maxClassification)) {
      runtimeCanHandleMaxClassification = true;
    }
  }

  for (const toolId of requiredTools) {
    if (!runtimeToolUnion.has(toolId)) {
      errors.push({
        path: `capability_manifest.${manifest.capability_id}.required_tools`,
        message: `No allowed runtime adapter exposes required tool ${toolId}`,
      });
    }
  }

  if (maxClassification && !runtimeCanHandleMaxClassification) {
    errors.push({
      path: `capability_manifest.${manifest.capability_id}.allowed_runtimes`,
      message: `No allowed runtime adapter can handle ${maxClassification}`,
    });
  }

  return errors;
}

function collectPolicyRuntimeIds(policyMatrix) {
  const runtimeIds = new Set();
  for (const rule of policyMatrix.runtime_rules ?? []) {
    for (const runtimeId of [
      ...(rule.allowed_runtimes ?? []),
      ...(rule.restricted_runtimes ?? []),
      ...(rule.forbidden_runtimes ?? []),
    ]) {
      runtimeIds.add(runtimeId);
    }
  }
  return runtimeIds;
}

function expectEventSubjectRef(errors, slice, ledgerRefs, event) {
  const subjectType = event.subject.subject_type;
  const subjectId = event.subject.subject_id;
  if (subjectType === "cost_record" || subjectType === "error_record") {
    const record = ledgerRefs.get(subjectId);
    if (!record) {
      errors.push({ path: `event_ledger.events.${event.id}.subject`, message: `Missing referenced ${subjectType} ${subjectId}` });
    } else if (record.type !== subjectType) {
      errors.push({ path: `event_ledger.events.${event.id}.subject`, message: `Expected ${subjectId} to reference ${subjectType}, found ${record.type}` });
    }
    return;
  }
  expectSliceRef(errors, slice, `event_ledger.events.${event.id}.subject`, subjectId, subjectType);
}

function buildLedgerRefMap(ledger) {
  const refs = new Map();
  for (const runLedger of ledger.run_ledgers ?? []) {
    for (const costRecord of runLedger.cost_records ?? []) {
      refs.set(costRecord.cost_record_id, { type: "cost_record", item: costRecord });
    }
    for (const errorRecord of runLedger.error_records ?? []) {
      refs.set(errorRecord.error_record_id, { type: "error_record", item: errorRecord });
    }
  }
  return refs;
}

function expectSliceRef(errors, slice, path, id, type) {
  const record = buildSliceIdMap(slice).get(id);
  if (!record) {
    errors.push({ path, message: `Missing referenced ${type} ${id}` });
  } else if (record.type !== type) {
    errors.push({ path, message: `Expected ${id} to reference ${type}, found ${record.type}` });
  }
}

function expectAnySliceRef(errors, slice, path, id) {
  if (!buildSliceIdMap(slice).has(id)) {
    errors.push({ path, message: `Missing referenced object ${id}` });
  }
}

function buildSliceIdMap(slice) {
  const ids = new Map();
  const collect = (collection, type) => {
    for (const item of collection ?? []) {
      if (item.id) ids.set(item.id, { type, item });
    }
  };
  collect(slice.identity_policy?.tenants, "tenant");
  collect(slice.identity_policy?.users, "user");
  collect(slice.identity_policy?.clients, "client");
  collect(slice.identity_policy?.matters, "matter");
  collect(slice.identity_policy?.policy_snapshots, "policy_snapshot");
  collect(slice.resource_evidence?.resources, "resource");
  collect(slice.resource_evidence?.resource_versions, "resource_version");
  collect(slice.resource_evidence?.normalized_texts, "normalized_text");
  collect(slice.resource_evidence?.source_spans, "source_span");
  collect(slice.resource_evidence?.evidence_items, "evidence_item");
  collect(slice.resource_evidence?.facts, "fact");
  collect(slice.resource_evidence?.issues, "issue");
  collect(slice.resource_evidence?.citations, "citation");
  collect(slice.workflow_runtime?.capabilities, "capability");
  collect(slice.workflow_runtime?.workflows, "workflow");
  collect(slice.workflow_runtime?.workflow_runs, "workflow_run");
  collect(slice.workflow_runtime?.agent_runs, "agent_run");
  collect(slice.governance_output?.gate_results, "gate_result");
  collect(slice.governance_output?.approvals, "approval");
  collect(slice.governance_output?.output_artifacts, "output_artifact");
  collect(slice.governance_output?.audit_events, "audit_event");
  return ids;
}

function classificationRank(classification) {
  const order = [
    "P0_PUBLIC",
    "P1_INTERNAL",
    "P2_CLIENT_CONFIDENTIAL",
    "P3_PRIVILEGED",
    "P4_HIGHLY_RESTRICTED",
    "P5_SECRET",
  ];
  return order.indexOf(classification);
}

function validateUniqueBy(items = [], path, key) {
  const errors = [];
  const seen = new Set();
  for (const item of items) {
    const value = item?.[key];
    if (seen.has(value)) {
      errors.push({ path, message: `Duplicate ${key} ${value}` });
    }
    seen.add(value);
  }
  return errors;
}

function validateRuntimePartition(runtimeRule) {
  const errors = [];
  const buckets = {
    allowed_runtimes: runtimeRule.allowed_runtimes ?? [],
    restricted_runtimes: runtimeRule.restricted_runtimes ?? [],
    forbidden_runtimes: runtimeRule.forbidden_runtimes ?? [],
  };
  const seen = new Map();
  for (const [bucketName, runtimes] of Object.entries(buckets)) {
    for (const runtimeId of runtimes) {
      const previousBucket = seen.get(runtimeId);
      if (previousBucket) {
        errors.push({
          path: `runtime_rules.${runtimeRule.classification}`,
          message: `Runtime ${runtimeId} appears in both ${previousBucket} and ${bucketName}`,
        });
      }
      seen.set(runtimeId, bucketName);
    }
  }
  return errors;
}

function requireOutputGate(errors, outputRulesByType, artifactType, gateId) {
  const rule = outputRulesByType.get(artifactType);
  if (!rule?.required_gates?.includes(gateId)) {
    errors.push({ path: `output_rules.${artifactType}`, message: `${artifactType} must require ${gateId}` });
  }
}

function resolveSchemaContext(schema, schemas, rootSchema) {
  if (!schema?.$ref) return { schema, rootSchema };
  const [filePart, pointerPart] = schema.$ref.split("#");
  const targetRoot = filePart ? schemas[filePart] : rootSchema;
  if (!targetRoot) throw new Error(`Unknown schema reference ${schema.$ref}`);
  return {
    schema: resolvePointer(targetRoot, pointerPart || ""),
    rootSchema: targetRoot,
  };
}

function resolvePointer(root, pointer) {
  if (!pointer) return root;
  const parts = pointer.replace(/^\//, "").split("/").filter(Boolean);
  return parts.reduce((current, part) => current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}

function matchesType(value, expected) {
  const expectedTypes = Array.isArray(expected) ? expected : [expected];
  return expectedTypes.some((type) => {
    if (type === "array") return Array.isArray(value);
    if (type === "object") return isPlainObject(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "null") return value === null;
    return typeof value === type;
  });
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
