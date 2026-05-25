import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_GOLDEN_FIXTURES_OUT_DIR = "artifacts/policy-golden-fixtures/latest";
export const DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS = {
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  personalWorkspaceBoundaryPath: "artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json",
};

const REQUIRED_OUTCOMES = ["allow", "review", "deny"];

export async function runPolicyGoldenFixtures(options = {}) {
  const result = await buildPolicyGoldenFixtures(options);
  if (options.write !== false) await writePolicyGoldenFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy golden fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicyGoldenFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_GOLDEN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const matterAccessPolicyEvaluator = await readJson(inputs.matter_access_policy_evaluator_path);
  const modelPolicyEnforcement = await readJson(inputs.model_policy_enforcement_path);
  const toolRuntimePolicyEnforcement = await readJson(inputs.tool_runtime_policy_enforcement_path);
  const outputDestinationPolicyEnforcement = await readJson(inputs.output_destination_policy_enforcement_path);
  const storePolicyAdapter = await readJson(inputs.store_policy_adapter_path);
  const personalWorkspaceBoundary = await readJson(inputs.personal_workspace_boundary_path);
  const projected = projectPolicyGoldenFixtures({
    matterAccessPolicyEvaluator,
    modelPolicyEnforcement,
    toolRuntimePolicyEnforcement,
    outputDestinationPolicyEnforcement,
    storePolicyAdapter,
    personalWorkspaceBoundary,
    generatedAt,
  });
  const validationItems = validatePolicyGoldenFixtures({
    matterAccessPolicyEvaluator,
    modelPolicyEnforcement,
    toolRuntimePolicyEnforcement,
    outputDestinationPolicyEnforcement,
    storePolicyAdapter,
    personalWorkspaceBoundary,
    projected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "policy-golden-fixtures.v1",
    generated_at: generatedAt,
    policy_golden_fixture_set_id: `policy-golden-fixtures.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_matter_access_policy_evaluator: summarizeSource(matterAccessPolicyEvaluator, "access_policy_status"),
    source_model_policy_enforcement: summarizeSource(modelPolicyEnforcement, "model_policy_enforcement_status"),
    source_tool_runtime_policy_enforcement: summarizeSource(toolRuntimePolicyEnforcement, "tool_runtime_policy_enforcement_status"),
    source_output_destination_policy_enforcement: summarizeSource(outputDestinationPolicyEnforcement, "output_destination_policy_status"),
    source_store_policy_adapter: summarizeSource(storePolicyAdapter, "store_policy_adapter_status"),
    source_personal_workspace_boundary: summarizeSource(personalWorkspaceBoundary, "personal_workspace_boundary_status"),
    policy_golden_fixture_catalog: {
      schema_version: "policy-golden-fixture-catalog.v1",
      generated_at: generatedAt,
      policy_fixture_cases: projected.policyFixtureCases,
      policy_outcome_matrix: projected.policyOutcomeMatrix,
      policy_regression_manifest: projected.policyRegressionManifest,
    },
    validation_items: validationItems,
    validation,
    summary: summarizePolicyGoldenFixtures(projected.policyFixtureCases, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderPolicyGoldenFixturesMarkdown(result),
  };
}

export async function writePolicyGoldenFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePolicyGoldenFixtures(result);
  await writeJson(path.join(outDir, "policy-golden-fixtures.json"), serializable);
  await writeJson(path.join(outDir, "policy-fixture-cases.json"), {
    generated_at: result.generated_at,
    policy_fixture_case_count: result.policy_golden_fixture_catalog.policy_fixture_cases.length,
    policy_fixture_cases: result.policy_golden_fixture_catalog.policy_fixture_cases,
  });
  await writeJson(path.join(outDir, "policy-outcome-matrix.json"), result.policy_golden_fixture_catalog.policy_outcome_matrix);
  await writeJson(path.join(outDir, "policy-regression-manifest.json"), result.policy_golden_fixture_catalog.policy_regression_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    policy_golden_fixture_set_id: result.policy_golden_fixture_set_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicyGoldenFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicyGoldenFixtures(args);
    console.log(`Policy golden fixtures written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.policy_golden_fixture_status}`);
    console.log(`Cases: ${result.summary.policy_fixture_case_count}`);
    console.log(`Allow/review/deny: ${result.summary.allow_case_count}/${result.summary.review_case_count}/${result.summary.deny_case_count}`);
    console.log(`Regression hashes: ${result.summary.locked_regression_hash_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectPolicyGoldenFixtures({
  matterAccessPolicyEvaluator,
  modelPolicyEnforcement,
  toolRuntimePolicyEnforcement,
  outputDestinationPolicyEnforcement,
  storePolicyAdapter,
  personalWorkspaceBoundary,
  generatedAt,
}) {
  const policyFixtureCases = [
    ...matterAccessCases(matterAccessPolicyEvaluator, generatedAt),
    ...modelPolicyCases(modelPolicyEnforcement, generatedAt),
    ...toolRuntimeCases(toolRuntimePolicyEnforcement, generatedAt),
    ...outputDestinationCases(outputDestinationPolicyEnforcement, generatedAt),
    ...storePolicyCases(storePolicyAdapter, generatedAt),
    ...personalWorkspaceCases(personalWorkspaceBoundary, generatedAt),
  ].sort(by("policy_fixture_case_id"));
  return {
    policyFixtureCases,
    policyOutcomeMatrix: buildPolicyOutcomeMatrix(policyFixtureCases, generatedAt),
    policyRegressionManifest: buildPolicyRegressionManifest(policyFixtureCases, generatedAt),
  };
}

function matterAccessCases(artifact, generatedAt) {
  const rows = artifact.matter_access_policy?.matter_access_decisions ?? [];
  return REQUIRED_OUTCOMES.map((outcome) => {
    const row = rows.find((item) => item.access_decision === outcome);
    return row ? buildPolicyCase({
      fixtureGroup: "matter_access",
      sourceArtifactId: "matter_access_policy_evaluator",
      sourceRecordType: "matter_access_decision",
      sourceRecordId: row.matter_access_decision_id,
      label: `Matter access ${outcome}`,
      expectedDecision: outcome,
      observedDecision: row.access_decision,
      expectedGateStatus: decisionStatus(outcome),
      observedGateStatus: decisionStatus(row.access_decision),
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanApprovalRequired: row.requires_human_review,
      subjectRef: {
        subject_type: "matter_runtime_access",
        subject_id: row.matter_access_decision_id,
      },
      metadata: {
        runtime_id: row.runtime_id,
        matter_id: row.matter_id,
        tenant_id: row.tenant_id,
        classification: row.classification,
        context_mode: row.context_mode,
      },
      generatedAt,
    }) : missingPolicyCase("matter_access", outcome, generatedAt);
  });
}

function modelPolicyCases(artifact, generatedAt) {
  const classificationRows = artifact.model_policy_gate_catalog?.classification_model_gates ?? [];
  return REQUIRED_OUTCOMES.map((outcome) => {
    const row = classificationRows.find((item) => item.external_model_decision === outcome);
    return row ? buildPolicyCase({
      fixtureGroup: "model_policy",
      sourceArtifactId: "model_policy_enforcement",
      sourceRecordType: "classification_model_policy_gate",
      sourceRecordId: row.classification_model_gate_id,
      label: `Model policy ${outcome}`,
      expectedDecision: outcome,
      observedDecision: row.external_model_decision,
      expectedGateStatus: row.gate_status,
      observedGateStatus: row.gate_status,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanApprovalRequired: row.human_approval_required,
      subjectRef: {
        subject_type: "classification_model_gate",
        subject_id: row.classification_model_gate_id,
      },
      metadata: {
        classification: row.classification,
        external_model_policy: row.external_model_policy,
        enforcement_mode: row.enforcement_mode,
      },
      generatedAt,
    }) : missingPolicyCase("model_policy", outcome, generatedAt);
  });
}

function toolRuntimeCases(artifact, generatedAt) {
  const rows = artifact.tool_runtime_policy_catalog?.tool_permission_gates ?? [];
  return REQUIRED_OUTCOMES.map((outcome) => {
    const row = rows.find((item) => item.gate_decision === outcome);
    return row ? buildPolicyCase({
      fixtureGroup: "tool_runtime",
      sourceArtifactId: "tool_runtime_policy_enforcement",
      sourceRecordType: "tool_permission_gate",
      sourceRecordId: row.tool_permission_gate_id,
      label: `Tool/runtime ${outcome}`,
      expectedDecision: outcome,
      observedDecision: row.gate_decision,
      expectedGateStatus: row.gate_status,
      observedGateStatus: row.gate_status,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanApprovalRequired: row.approval_required,
      subjectRef: {
        subject_type: "tool_permission_gate",
        subject_id: row.tool_permission_gate_id,
      },
      metadata: {
        runtime_id: row.runtime_id,
        tool_id: row.tool_id,
        requested_state: row.requested_state,
        protected_action: row.protected_action,
      },
      generatedAt,
    }) : missingPolicyCase("tool_runtime", outcome, generatedAt);
  });
}

function outputDestinationCases(artifact, generatedAt) {
  const rows = artifact.output_destination_policy_catalog?.final_action_separation_gates ?? [];
  return ["allow", "review"].map((outcome) => {
    const row = rows.find((item) => item.gate_decision === outcome);
    return row ? buildPolicyCase({
      fixtureGroup: "output_destination",
      sourceArtifactId: "output_destination_policy_enforcement",
      sourceRecordType: "final_action_separation_gate",
      sourceRecordId: row.final_action_separation_gate_id,
      label: `Output destination ${outcome}`,
      expectedDecision: outcome,
      observedDecision: row.gate_decision,
      expectedGateStatus: row.gate_status,
      observedGateStatus: row.gate_status,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanApprovalRequired: row.gate_decision === "review",
      subjectRef: {
        subject_type: "final_action_separation_gate",
        subject_id: row.final_action_separation_gate_id,
      },
      metadata: {
        artifact_type: row.artifact_type,
        delivery_policy: row.delivery_policy,
        destination_kind: row.destination_kind,
        final_action_required: row.final_action_required,
      },
      generatedAt,
    }) : missingPolicyCase("output_destination", outcome, generatedAt);
  });
}

function storePolicyCases(artifact, generatedAt) {
  const rows = artifact.store_policy_catalog?.store_query_plans ?? [];
  return [
    ["allow", "executable"],
    ["review", "held_for_human_confirmation"],
    ["deny", "blocked"],
  ].map(([outcome, queryStatus]) => {
    const row = rows.find((item) => item.query_status === queryStatus);
    return row ? buildPolicyCase({
      fixtureGroup: "store_policy",
      sourceArtifactId: "store_policy_adapter",
      sourceRecordType: "store_query_plan",
      sourceRecordId: row.store_query_plan_id,
      label: `Store policy ${outcome}`,
      expectedDecision: outcome,
      observedDecision: outcome,
      expectedGateStatus: queryStatus,
      observedGateStatus: row.query_status,
      requiredGates: queryStatus === "held_for_human_confirmation" ? ["human_confirmation_gate"] : ["store_policy_gate"],
      reasonCodes: row.reason_codes,
      humanApprovalRequired: queryStatus === "held_for_human_confirmation",
      subjectRef: {
        subject_type: "store_query_plan",
        subject_id: row.store_query_plan_id,
      },
      metadata: {
        collection_id: row.collection_id,
        target_type: row.target_type,
        target_matter_id: row.target_matter_id,
        target_resource_id: row.target_resource_id,
        runtime_id: row.runtime_id,
        rls_enforced: row.rls_enforced,
      },
      generatedAt,
    }) : missingPolicyCase("store_policy", outcome, generatedAt);
  });
}

function personalWorkspaceCases(artifact, generatedAt) {
  const rows = artifact.workspace_boundary_catalog?.cross_workspace_probes ?? [];
  const row = rows.find((item) => item.observed_outcome === "blocked");
  return [
    row ? buildPolicyCase({
      fixtureGroup: "workspace_boundary",
      sourceArtifactId: "personal_workspace_boundary",
      sourceRecordType: "cross_workspace_probe",
      sourceRecordId: row.cross_workspace_probe_id,
      label: "Workspace boundary deny",
      expectedDecision: "deny",
      observedDecision: row.observed_outcome === "blocked" ? "deny" : "allow",
      expectedGateStatus: "blocked",
      observedGateStatus: row.observed_outcome,
      requiredGates: ["tenant_boundary_gate", "search_namespace_gate"],
      reasonCodes: [row.block_reason].filter(Boolean),
      humanApprovalRequired: false,
      subjectRef: {
        subject_type: "cross_workspace_probe",
        subject_id: row.cross_workspace_probe_id,
      },
      metadata: {
        probe_type: row.probe_type,
        requester_tenant_id: row.requester_tenant_id,
        target_tenant_id: row.target_tenant_id,
      },
      generatedAt,
    }) : missingPolicyCase("workspace_boundary", "deny", generatedAt),
  ];
}

function buildPolicyCase({
  fixtureGroup,
  sourceArtifactId,
  sourceRecordType,
  sourceRecordId,
  label,
  expectedDecision,
  observedDecision,
  expectedGateStatus,
  observedGateStatus,
  requiredGates = [],
  reasonCodes = [],
  humanApprovalRequired = false,
  subjectRef,
  metadata = {},
  generatedAt,
}) {
  const normalizedExpected = normalizeDecision(expectedDecision);
  const normalizedObserved = normalizeDecision(observedDecision);
  const expectedControlEffect = controlEffectFor(normalizedExpected);
  const observedControlEffect = controlEffectFor(normalizedObserved);
  const regressionPayload = {
    fixture_group: fixtureGroup,
    source_artifact_id: sourceArtifactId,
    source_record_type: sourceRecordType,
    source_record_id: sourceRecordId,
    expected_decision: normalizedExpected,
    observed_decision: normalizedObserved,
    expected_gate_status: expectedGateStatus,
    observed_gate_status: observedGateStatus,
    expected_control_effect: expectedControlEffect,
    observed_control_effect: observedControlEffect,
    required_gates: unique(requiredGates),
    reason_codes: unique(reasonCodes),
    subject_ref: subjectRef,
  };
  const matched = normalizedExpected === normalizedObserved
    && expectedGateStatus === observedGateStatus
    && expectedControlEffect === observedControlEffect;
  return {
    schema_version: "policy-golden-fixture-case.v1",
    policy_fixture_case_id: `policy-golden-fixture.${slugify(fixtureGroup)}.${slugify(normalizedExpected)}.${slugify(sourceRecordId)}`,
    fixture_group: fixtureGroup,
    source_artifact_id: sourceArtifactId,
    source_record_type: sourceRecordType,
    source_record_id: sourceRecordId,
    label,
    expected_decision: normalizedExpected,
    observed_decision: normalizedObserved,
    expected_gate_status: expectedGateStatus,
    observed_gate_status: observedGateStatus,
    expected_control_effect: expectedControlEffect,
    observed_control_effect: observedControlEffect,
    required_gates: unique(requiredGates),
    reason_codes: unique(reasonCodes),
    human_approval_required: Boolean(humanApprovalRequired),
    subject_ref: subjectRef,
    case_status: matched ? "locked" : "mismatch",
    regression_hash: hashValue(regressionPayload),
    captured_at: generatedAt,
    metadata,
  };
}

function missingPolicyCase(fixtureGroup, expectedDecision, generatedAt) {
  const normalizedExpected = normalizeDecision(expectedDecision);
  return {
    schema_version: "policy-golden-fixture-case.v1",
    policy_fixture_case_id: `policy-golden-fixture.${slugify(fixtureGroup)}.${slugify(normalizedExpected)}.missing`,
    fixture_group: fixtureGroup,
    source_artifact_id: fixtureGroup,
    source_record_type: "missing",
    source_record_id: "missing",
    label: `${fixtureGroup} ${normalizedExpected} missing`,
    expected_decision: normalizedExpected,
    observed_decision: "missing",
    expected_gate_status: decisionStatus(normalizedExpected),
    observed_gate_status: "missing",
    expected_control_effect: controlEffectFor(normalizedExpected),
    observed_control_effect: "missing",
    required_gates: [],
    reason_codes: ["missing_representative_case"],
    human_approval_required: false,
    subject_ref: {
      subject_type: "missing_policy_case",
      subject_id: `${fixtureGroup}.${normalizedExpected}`,
    },
    case_status: "missing",
    regression_hash: null,
    captured_at: generatedAt,
    metadata: {},
  };
}

function buildPolicyOutcomeMatrix(cases, generatedAt) {
  const byGroup = {};
  const byDecision = {};
  for (const policyCase of cases) {
    byGroup[policyCase.fixture_group] ??= { allow: 0, review: 0, deny: 0, missing: 0, total: 0 };
    byDecision[policyCase.expected_decision] = (byDecision[policyCase.expected_decision] ?? 0) + 1;
    byGroup[policyCase.fixture_group][policyCase.expected_decision] = (byGroup[policyCase.fixture_group][policyCase.expected_decision] ?? 0) + 1;
    byGroup[policyCase.fixture_group].total += 1;
  }
  return {
    schema_version: "policy-outcome-matrix.v1",
    generated_at: generatedAt,
    fixture_group_count: Object.keys(byGroup).length,
    policy_fixture_case_count: cases.length,
    by_fixture_group: Object.fromEntries(Object.entries(byGroup).sort(([left], [right]) => left.localeCompare(right))),
    by_expected_decision: Object.fromEntries(Object.entries(byDecision).sort(([left], [right]) => left.localeCompare(right))),
  };
}

function buildPolicyRegressionManifest(cases, generatedAt) {
  const rows = cases.map((policyCase) => ({
    policy_regression_hash_id: `policy-regression-hash.${slugify(policyCase.policy_fixture_case_id)}`,
    policy_fixture_case_id: policyCase.policy_fixture_case_id,
    fixture_group: policyCase.fixture_group,
    expected_decision: policyCase.expected_decision,
    observed_decision: policyCase.observed_decision,
    case_status: policyCase.case_status,
    regression_hash: policyCase.regression_hash,
  }));
  return {
    schema_version: "policy-regression-manifest.v1",
    generated_at: generatedAt,
    policy_regression_hash_count: rows.length,
    locked_regression_hash_count: rows.filter((row) => row.case_status === "locked" && row.regression_hash).length,
    policy_regression_hashes: rows,
  };
}

function validatePolicyGoldenFixtures({
  matterAccessPolicyEvaluator,
  modelPolicyEnforcement,
  toolRuntimePolicyEnforcement,
  outputDestinationPolicyEnforcement,
  storePolicyAdapter,
  personalWorkspaceBoundary,
  projected,
}) {
  const items = [];
  const cases = projected.policyFixtureCases;
  addSourceValidation(items, "matter_access_policy_evaluator", matterAccessPolicyEvaluator.summary?.access_policy_status);
  addSourceValidation(items, "model_policy_enforcement", modelPolicyEnforcement.summary?.model_policy_enforcement_status);
  addSourceValidation(items, "tool_runtime_policy_enforcement", toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status);
  addSourceValidation(items, "output_destination_policy_enforcement", outputDestinationPolicyEnforcement.summary?.output_destination_policy_status);
  addSourceValidation(items, "store_policy_adapter", storePolicyAdapter.summary?.store_policy_adapter_status);
  addSourceValidation(items, "personal_workspace_boundary", personalWorkspaceBoundary.summary?.personal_workspace_boundary_status);

  for (const outcome of REQUIRED_OUTCOMES) {
    addValidation(items, {
      path: `policy_fixture_cases.${outcome}`,
      check_id: "required_policy_outcome_present",
      passed: cases.some((policyCase) => policyCase.expected_decision === outcome && policyCase.case_status === "locked"),
      message: `${outcome} representative policy case is present and locked.`,
    });
  }

  for (const fixtureGroup of ["matter_access", "model_policy", "tool_runtime", "store_policy"]) {
    addValidation(items, {
      path: `policy_fixture_cases.${fixtureGroup}`,
      check_id: "core_policy_group_has_three_outcomes",
      passed: REQUIRED_OUTCOMES.every((outcome) => cases.some((policyCase) => policyCase.fixture_group === fixtureGroup && policyCase.expected_decision === outcome && policyCase.case_status === "locked")),
      message: `${fixtureGroup} has allow/review/deny representative cases.`,
    });
  }

  addValidation(items, {
    path: "policy_fixture_cases.workspace_boundary",
    check_id: "workspace_boundary_block_case_present",
    passed: cases.some((policyCase) => policyCase.fixture_group === "workspace_boundary" && policyCase.expected_decision === "deny" && policyCase.observed_gate_status === "blocked"),
    message: "workspace boundary has a blocked cross-workspace regression case.",
  });

  for (const policyCase of cases) {
    addValidation(items, {
      path: `policy_fixture_cases.${policyCase.policy_fixture_case_id}.decision`,
      check_id: "policy_case_expected_matches_observed",
      passed: policyCase.expected_decision === policyCase.observed_decision,
      message: `${policyCase.policy_fixture_case_id} expected ${policyCase.expected_decision} and observed ${policyCase.observed_decision}.`,
    });
    addValidation(items, {
      path: `policy_fixture_cases.${policyCase.policy_fixture_case_id}.gate_status`,
      check_id: "policy_case_gate_status_matches",
      passed: policyCase.expected_gate_status === policyCase.observed_gate_status,
      message: `${policyCase.policy_fixture_case_id} expected gate ${policyCase.expected_gate_status} and observed ${policyCase.observed_gate_status}.`,
    });
    addValidation(items, {
      path: `policy_fixture_cases.${policyCase.policy_fixture_case_id}.regression_hash`,
      check_id: "policy_case_regression_hash_locked",
      passed: Boolean(policyCase.regression_hash) && policyCase.case_status === "locked",
      message: `${policyCase.policy_fixture_case_id} regression hash is ${policyCase.regression_hash ? "locked" : "missing"}.`,
    });
    if (policyCase.expected_decision === "review") {
      addValidation(items, {
        path: `policy_fixture_cases.${policyCase.policy_fixture_case_id}.review_gate`,
        check_id: "review_case_requires_hold_or_human_gate",
        passed: policyCase.human_approval_required
          || policyCase.required_gates.some((gate) => /human|approval|confirmation/.test(gate))
          || ["requires_approval", "held_for_human_confirmation"].includes(policyCase.observed_gate_status),
        message: `${policyCase.policy_fixture_case_id} review case has a human/approval/hold control.`,
      });
    }
    if (policyCase.expected_decision === "deny") {
      addValidation(items, {
        path: `policy_fixture_cases.${policyCase.policy_fixture_case_id}.deny_gate`,
        check_id: "deny_case_blocks",
        passed: policyCase.expected_control_effect === "block" && ["blocked", "deny"].includes(policyCase.observed_gate_status),
        message: `${policyCase.policy_fixture_case_id} deny case blocks execution/retrieval.`,
      });
    }
  }

  addValidation(items, {
    path: "policy_regression_manifest.locked_regression_hash_count",
    check_id: "all_policy_regression_hashes_locked",
    passed: projected.policyRegressionManifest.locked_regression_hash_count === cases.length,
    message: `${projected.policyRegressionManifest.locked_regression_hash_count}/${cases.length} policy regression hash(es) are locked.`,
  });
  return items;
}

function summarizePolicyGoldenFixtures(cases, validationItems, validation) {
  const failedValidationItems = validationItems.filter((item) => item.status === "failed");
  return {
    policy_golden_fixture_status: validation.valid ? "complete" : "blocked",
    policy_fixture_case_count: cases.length,
    fixture_group_count: new Set(cases.map((policyCase) => policyCase.fixture_group)).size,
    allow_case_count: cases.filter((policyCase) => policyCase.expected_decision === "allow").length,
    review_case_count: cases.filter((policyCase) => policyCase.expected_decision === "review").length,
    deny_case_count: cases.filter((policyCase) => policyCase.expected_decision === "deny").length,
    locked_case_count: cases.filter((policyCase) => policyCase.case_status === "locked").length,
    mismatch_case_count: cases.filter((policyCase) => policyCase.case_status === "mismatch").length,
    missing_case_count: cases.filter((policyCase) => policyCase.case_status === "missing").length,
    locked_regression_hash_count: cases.filter((policyCase) => policyCase.regression_hash && policyCase.case_status === "locked").length,
    review_case_with_human_gate_count: cases.filter((policyCase) => policyCase.expected_decision === "review" && (
      policyCase.human_approval_required
      || policyCase.required_gates.some((gate) => /human|approval|confirmation/.test(gate))
      || ["requires_approval", "held_for_human_confirmation"].includes(policyCase.observed_gate_status)
    )).length,
    deny_case_blocked_count: cases.filter((policyCase) => policyCase.expected_decision === "deny" && ["blocked", "deny"].includes(policyCase.observed_gate_status)).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItems.length,
    validation_error_count: validation.errors.length,
    by_fixture_group: countBy(cases, "fixture_group"),
    by_expected_decision: countBy(cases, "expected_decision"),
    by_case_status: countBy(cases, "case_status"),
    by_control_effect: countBy(cases, "expected_control_effect"),
  };
}

function addSourceValidation(items, sourceId, status) {
  addValidation(items, {
    path: `sources.${sourceId}`,
    check_id: "source_policy_artifact_complete",
    passed: ["complete", "valid"].includes(status),
    message: `${sourceId} source status is ${status ?? "unknown"}.`,
  });
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `policy-golden-fixtures.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function renderPolicyGoldenFixturesMarkdown(result) {
  const lines = [];
  lines.push("# Policy Golden Fixtures");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.policy_golden_fixture_status}`);
  lines.push("");
  lines.push(`- Cases: ${result.summary.policy_fixture_case_count}`);
  lines.push(`- Allow/review/deny: ${result.summary.allow_case_count}/${result.summary.review_case_count}/${result.summary.deny_case_count}`);
  lines.push(`- Locked regression hashes: ${result.summary.locked_regression_hash_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Fixture Groups");
  for (const [group, count] of Object.entries(result.summary.by_fixture_group)) lines.push(`- ${group}: ${count}`);
  lines.push("");
  lines.push("## Representative Cases");
  for (const policyCase of result.policy_golden_fixture_catalog.policy_fixture_cases) {
    lines.push(`- ${policyCase.fixture_group}/${policyCase.expected_decision}: ${policyCase.source_record_type} ${policyCase.case_status}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function decisionStatus(decision) {
  if (decision === "allow") return "passed";
  if (decision === "review") return "requires_approval";
  if (decision === "deny") return "blocked";
  return "unknown";
}

function controlEffectFor(decision) {
  if (decision === "allow") return "permit";
  if (decision === "review") return "hold_for_review";
  if (decision === "deny") return "block";
  return "missing";
}

function normalizeDecision(decision) {
  if (decision === "blocked") return "deny";
  if (decision === "requires_approval" || decision === "held_for_human_confirmation") return "review";
  if (decision === "passed" || decision === "executable") return "allow";
  return decision ?? "missing";
}

function summarizeSource(artifact, statusKey) {
  return {
    schema_version: artifact.schema_version ?? null,
    status: artifact.summary?.[statusKey] ?? "unknown",
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    generated_at: artifact.generated_at ?? null,
  };
}

function normalizeInputs(options) {
  return {
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS.matterAccessPolicyEvaluatorPath),
    model_policy_enforcement_path: path.resolve(options.modelPolicyEnforcementPath ?? DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS.modelPolicyEnforcementPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS.toolRuntimePolicyEnforcementPath),
    output_destination_policy_enforcement_path: path.resolve(options.outputDestinationPolicyEnforcementPath ?? DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS.outputDestinationPolicyEnforcementPath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS.storePolicyAdapterPath),
    personal_workspace_boundary_path: path.resolve(options.personalWorkspaceBoundaryPath ?? DEFAULT_POLICY_GOLDEN_FIXTURES_INPUTS.personalWorkspaceBoundaryPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--model-policy") parsed.modelPolicyEnforcementPath = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = argv[++index];
    else if (arg === "--store-policy") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--personal-workspace-boundary") parsed.personalWorkspaceBoundaryPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-golden-fixtures.mjs [options]

Options:
  --matter-access-policy <path>       Matter access policy evaluator artifact.
  --model-policy <path>               Model policy enforcement artifact.
  --tool-runtime-policy <path>        Tool/runtime policy enforcement artifact.
  --output-destination-policy <path>  Output destination policy enforcement artifact.
  --store-policy <path>               Store policy adapter artifact.
  --personal-workspace-boundary <path> Personal workspace boundary artifact.
  --out-dir <path>                    Output directory.
  --run-at <iso>                      Fixed generation timestamp.
  --check                             Exit non-zero when validation fails.
  -h, --help                          Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializablePolicyGoldenFixtures(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(right)),
  );
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
