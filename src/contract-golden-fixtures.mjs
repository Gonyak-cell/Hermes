import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_CONTRACT_GOLDEN_FIXTURES_OUT_DIR = "artifacts/contract-golden-fixtures/latest";
export const DEFAULT_CONTRACT_GOLDEN_FIXTURES_INPUTS = {
  schemaDir: "schemas",
  artifactPaths: {
    contract_inventory: "artifacts/contract-inventory/latest/contract-inventory.json",
    contract_dependency_map: "artifacts/contract-dependency-map/latest/contract-dependency-map.json",
    schema_versioning_rules: "artifacts/schema-versioning-rules/latest/schema-versioning-rules.json",
    schema_migration_manifest: "artifacts/schema-migration-manifest/latest/schema-migration-manifest-ledger.json",
    identity_model: "artifacts/identity-model/latest/identity-model.json",
    client_counterparty_registry: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
    matter_profile_team_ledger: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
    wall_policy_contract: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
    matter_access_policy_evaluator: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
    data_classification_rule_engine: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
    matter_tagging_decision_ledger: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
    access_audit_projection: "artifacts/access-audit/latest/access-audit-projection.json",
    store_policy_adapter: "artifacts/store-policy/latest/store-policy-adapter.json",
    conflict_check_interface: "artifacts/conflict-check/latest/conflict-check-interface.json",
    personal_workspace_boundary: "artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json",
    policy_golden_fixtures: "artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json",
    policy_operations_surface: "artifacts/policy-operations-surface/latest/policy-operations-surface.json",
    matter_boundary_slice: "artifacts/matter-boundary-slice/latest/matter-boundary-slice.json",
    identity_policy_matter_freeze: "artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json",
    resource_store_interface: "artifacts/resource-store-interface/latest/resource-store-interface.json",
    immutable_object_store_layout: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
    resource_version_ledger: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
    resource_dedup_hash_ledger: "artifacts/resource-dedup-hash/latest/resource-dedup-hash-ledger.json",
    resource_quarantine_model: "artifacts/resource-quarantine/latest/resource-quarantine-model.json",
    normalized_text_contract: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
    extractor_adapter_contract: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
    source_span_store: "artifacts/source-span-store/latest/source-span-store.json",
    evidence_item_store: "artifacts/evidence-item-store/latest/evidence-item-store.json",
    evidence_golden_fixtures: "artifacts/evidence-golden-fixtures/latest/evidence-golden-fixtures.json",
    fact_claim_store: "artifacts/fact-claim-store/latest/fact-claim-store.json",
    issue_graph_store: "artifacts/issue-graph-store/latest/issue-graph-store.json",
    citation_object_store: "artifacts/citation-object-store/latest/citation-object-store.json",
    lineage_graph_builder: "artifacts/lineage-graph/latest/lineage-graph.json",
    evidence_viewer_data_api: "artifacts/evidence-viewer-data-api/latest/evidence-viewer-data-api.json",
    evidence_export_bundle: "artifacts/evidence-export-bundle/latest/evidence-export-bundle.json",
    evidence_regression_tests: "artifacts/evidence-regression-tests/latest/evidence-regression-tests.json",
    resource_evidence_dashboard_summary: "artifacts/resource-evidence-dashboard/latest/resource-evidence-dashboard-summary.json",
    evidence_plane_freeze: "artifacts/evidence-plane-freeze/latest/evidence-plane-freeze.json",
    evidence_coverage_score: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
    evidence_flags: "artifacts/evidence-flags/latest/evidence-flags.json",
    exhibit_map: "artifacts/exhibit-map/latest/exhibit-map.json",
    chain_of_custody_events: "artifacts/chain-of-custody/latest/chain-of-custody-events.json",
    search_index_contract: "artifacts/search-index/latest/search-index-contract.json",
    vector_index_policy_boundary: "artifacts/vector-index-policy/latest/vector-index-policy-boundary.json",
    retrieval_filter_compiler: "artifacts/retrieval-filters/latest/retrieval-filter-compiler.json",
    model_policy_enforcement: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
    tool_runtime_policy_enforcement: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
    output_destination_policy_enforcement: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
    approval_authority_ledger: "artifacts/approval-authority/latest/approval-authority-ledger.json",
    policy_snapshot_binding_ledger: "artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json",
    resource_contract_freeze: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
    matter_contract_freeze: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
    policy_contract_freeze: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
    evidence_contract_freeze: "artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json",
    capability_workflow_contract_freeze: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
    runtime_agentrun_contract_freeze: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
    runtime_adapter_interface_v2: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
    hermes_runtime_adapter: "artifacts/hermes-runtime-adapter/latest/hermes-runtime-adapter.json",
    claude_code_adapter_contract: "artifacts/claude-code-adapter-contract/latest/claude-code-adapter-contract.json",
    codex_adapter_contract: "artifacts/codex-adapter-contract/latest/codex-adapter-contract.json",
    local_script_adapter: "artifacts/local-script-adapter/latest/local-script-adapter.json",
    gate_approval_contract_freeze: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
    output_delivery_contract_freeze: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
    event_audit_run_contract_freeze: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
    event_envelope_ledger: "artifacts/event-envelope-ledger/latest/event-envelope-ledger.json",
    event_type_registry: "artifacts/event-type-registry/latest/event-type-registry.json",
    append_only_event_store: "artifacts/append-only-event-store/latest/append-only-event-store.json",
    event_correlation_ledger: "artifacts/event-correlation/latest/event-correlation-ledger.json",
    workflow_run_ledger: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
    agent_run_ledger: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
    tool_invocation_ledger: "artifacts/tool-invocation-ledger/latest/tool-invocation-ledger.json",
    audit_event_ledger: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
    policy_snapshot_event_binding: "artifacts/policy-snapshot-event-bindings/latest/policy-snapshot-event-binding.json",
    cost_record_projection: "artifacts/cost-record-projection/latest/cost-record-projection.json",
    token_usage_projection: "artifacts/token-usage-projection/latest/token-usage-projection.json",
    observability_trace_projection: "artifacts/observability-trace-projection/latest/observability-trace-projection.json",
    error_retry_ledger: "artifacts/error-retry-ledger/latest/error-retry-ledger.json",
    event_replay_harness: "artifacts/event-replay/latest/event-replay-harness.json",
    retention_archive_ledger: "artifacts/retention-archive/latest/retention-archive-ledger.json",
    ledger_api_dashboard: "artifacts/ledger-api-dashboard/latest/ledger-api-dashboard.json",
    ledger_golden_fixtures: "artifacts/ledger-golden-fixtures/latest/ledger-golden-fixtures.json",
    observability_freeze: "artifacts/observability-freeze/latest/observability-freeze.json",
    capability_manifest_v2: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
    pack_manifest_compatibility: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
    workflow_dsl_state_model: "artifacts/workflow-dsl-state-model/latest/workflow-dsl-state-model.json",
    workflow_state_machine_runner: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
    workflow_queue_retry_backoff_contract: "artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json",
    workflow_idempotency_ledger: "artifacts/workflow-idempotency/latest/workflow-idempotency-ledger.json",
    workflow_resume_cancel_contract: "artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json",
    workflow_context_builder_contract: "artifacts/workflow-context-builder/latest/workflow-context-builder-contract.json",
    workflow_retrieval_compiler: "artifacts/workflow-retrieval-compiler/latest/workflow-retrieval-compiler.json",
    workflow_prompt_injection_boundary: "artifacts/workflow-prompt-injection-boundary/latest/workflow-prompt-injection-boundary.json",
    workflow_pre_run_gate_framework: "artifacts/workflow-pre-run-gates/latest/workflow-pre-run-gate-framework.json",
    workflow_in_run_gate_framework: "artifacts/workflow-in-run-gates/latest/workflow-in-run-gate-framework.json",
    workflow_post_run_gate_framework: "artifacts/workflow-post-run-gates/latest/workflow-post-run-gate-framework.json",
    gate_result_aggregator: "artifacts/gate-result-aggregator/latest/gate-result-aggregator.json",
    capability_registry_api: "artifacts/capability-registry-api/latest/capability-registry-api.json",
    workflow_run_dashboard: "artifacts/workflow-run-dashboard/latest/workflow-run-dashboard.json",
    workflow_golden_cases: "artifacts/workflow-golden-cases/latest/workflow-golden-cases.json",
    workflow_gate_freeze: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
    error_cost_observability_contract_freeze: "artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json",
  },
};

const GOLDEN_FIXTURE_DEFINITIONS = [
  fixtureDefinition("contract_inventory", "Contract Inventory", "contracts", "contract-inventory.schema.json"),
  fixtureDefinition("contract_dependency_map", "Contract Dependency Map", "contracts", "contract-dependency-map.schema.json"),
  fixtureDefinition("schema_versioning_rules", "Schema Versioning Rules", "contracts", "schema-versioning-rules.schema.json"),
  fixtureDefinition("schema_migration_manifest", "Schema Migration Manifest", "contracts", "schema-migration-manifest.schema.json"),
  fixtureDefinition("identity_model", "Identity Model", "identity_policy", "identity-model.schema.json"),
  fixtureDefinition("client_counterparty_registry", "Client/Counterparty Registry", "identity_policy", "client-counterparty-registry.schema.json"),
  fixtureDefinition("matter_profile_team_ledger", "Matter Profile/Team Ledger", "identity_policy", "matter-profile-team-ledger.schema.json"),
  fixtureDefinition("wall_policy_contract", "Wall Policy Contract", "identity_policy", "wall-policy-contract.schema.json"),
  fixtureDefinition("matter_access_policy_evaluator", "Matter Access Policy Evaluator", "identity_policy", "matter-access-policy-evaluator.schema.json"),
  fixtureDefinition("data_classification_rule_engine", "Data Classification Rule Engine", "identity_policy", "data-classification-rule-engine.schema.json"),
  fixtureDefinition("matter_tagging_decision_ledger", "Matter Tagging Decision Ledger", "identity_policy", "matter-tagging-decision-ledger.schema.json"),
  fixtureDefinition("access_audit_projection", "Access Audit Projection", "identity_policy", "access-audit-projection.schema.json"),
  fixtureDefinition("store_policy_adapter", "Store Policy Adapter", "identity_policy", "store-policy-adapter.schema.json"),
  fixtureDefinition("conflict_check_interface", "Conflict Check Interface", "identity_policy", "conflict-check-interface.schema.json"),
  fixtureDefinition("personal_workspace_boundary", "Personal Workspace Boundary", "identity_policy", "personal-workspace-boundary.schema.json"),
  fixtureDefinition("policy_golden_fixtures", "Policy Golden Fixtures", "identity_policy", "policy-golden-fixtures.schema.json"),
  fixtureDefinition("policy_operations_surface", "Policy Operations Surface", "identity_policy", "policy-operations-surface.schema.json"),
  fixtureDefinition("matter_boundary_slice", "Matter Boundary Slice", "identity_policy", "matter-boundary-slice.schema.json"),
  fixtureDefinition("identity_policy_matter_freeze", "Identity/Policy/Matter Freeze", "identity_policy", "identity-policy-matter-freeze.schema.json"),
  fixtureDefinition("resource_store_interface", "Resource Store Interface", "resource_evidence", "resource-store-interface.schema.json"),
  fixtureDefinition("immutable_object_store_layout", "Immutable Object Store Layout", "resource_evidence", "immutable-object-store-layout.schema.json"),
  fixtureDefinition("resource_version_ledger", "Resource Version Ledger", "resource_evidence", "resource-version-ledger.schema.json"),
  fixtureDefinition("resource_dedup_hash_ledger", "Resource Dedup/Hash Ledger", "resource_evidence", "resource-dedup-hash-ledger.schema.json"),
  fixtureDefinition("resource_quarantine_model", "Resource Quarantine Model", "resource_evidence", "resource-quarantine-model.schema.json"),
  fixtureDefinition("normalized_text_contract", "Normalized Text Contract", "resource_evidence", "normalized-text-contract.schema.json"),
  fixtureDefinition("extractor_adapter_contract", "Extractor Adapter Contract", "resource_evidence", "extractor-adapter-contract.schema.json"),
  fixtureDefinition("source_span_store", "Source Span Store", "resource_evidence", "source-span-store.schema.json"),
  fixtureDefinition("evidence_item_store", "Evidence Item Store", "resource_evidence", "evidence-item-store.schema.json"),
  fixtureDefinition("evidence_golden_fixtures", "Evidence Golden Fixtures", "resource_evidence", "evidence-golden-fixtures.schema.json"),
  fixtureDefinition("fact_claim_store", "Fact Claim Store", "resource_evidence", "fact-claim-store.schema.json"),
  fixtureDefinition("issue_graph_store", "Issue Graph Store", "resource_evidence", "issue-graph-store.schema.json"),
  fixtureDefinition("citation_object_store", "Citation Object Store", "resource_evidence", "citation-object-store.schema.json"),
  fixtureDefinition("lineage_graph_builder", "Lineage Graph Builder", "resource_evidence", "lineage-graph-builder.schema.json"),
  fixtureDefinition("evidence_viewer_data_api", "Evidence Viewer Data API", "resource_evidence", "evidence-viewer-data-api.schema.json"),
  fixtureDefinition("evidence_export_bundle", "Evidence Export Bundle", "resource_evidence", "evidence-export-bundle.schema.json"),
  fixtureDefinition("evidence_regression_tests", "Evidence Regression Tests", "resource_evidence", "evidence-regression-tests.schema.json"),
  fixtureDefinition("resource_evidence_dashboard_summary", "Resource/Evidence Dashboard Summary", "resource_evidence", "resource-evidence-dashboard-summary.schema.json"),
  fixtureDefinition("evidence_plane_freeze", "Evidence Plane Freeze", "resource_evidence", "evidence-plane-freeze.schema.json"),
  fixtureDefinition("evidence_coverage_score", "Evidence Coverage Score", "resource_evidence", "evidence-coverage-score.schema.json"),
  fixtureDefinition("evidence_flags", "Evidence Flags", "resource_evidence", "evidence-flags.schema.json"),
  fixtureDefinition("exhibit_map", "Exhibit Map", "resource_evidence", "exhibit-map.schema.json"),
  fixtureDefinition("chain_of_custody_events", "Chain of Custody Events", "resource_evidence", "chain-of-custody-events.schema.json"),
  fixtureDefinition("search_index_contract", "Search Index Contract", "resource_evidence", "search-index-contract.schema.json"),
  fixtureDefinition("vector_index_policy_boundary", "Vector Index Policy Boundary", "resource_evidence", "vector-index-policy-boundary.schema.json"),
  fixtureDefinition("retrieval_filter_compiler", "Retrieval Filter Compiler", "resource_evidence", "retrieval-filter-compiler.schema.json"),
  fixtureDefinition("model_policy_enforcement", "Model Policy Enforcement", "identity_policy", "model-policy-enforcement.schema.json"),
  fixtureDefinition("tool_runtime_policy_enforcement", "Tool/Runtime Policy Enforcement", "gate_approval", "tool-runtime-policy-enforcement.schema.json"),
  fixtureDefinition("output_destination_policy_enforcement", "Output Destination Policy Enforcement", "gate_approval", "output-destination-policy-enforcement.schema.json"),
  fixtureDefinition("approval_authority_ledger", "Approval Authority Ledger", "gate_approval", "approval-authority-ledger.schema.json"),
  fixtureDefinition("policy_snapshot_binding_ledger", "Policy Snapshot Binding Ledger", "policy", "policy-snapshot-binding-ledger.schema.json"),
  fixtureDefinition("resource_contract_freeze", "Resource Contract Freeze", "resource_evidence", "resource-contract-freeze.schema.json"),
  fixtureDefinition("matter_contract_freeze", "Matter Contract Freeze", "identity_policy", "matter-contract-freeze.schema.json"),
  fixtureDefinition("policy_contract_freeze", "Policy Contract Freeze", "policy", "policy-contract-freeze.schema.json"),
  fixtureDefinition("evidence_contract_freeze", "Evidence Contract Freeze", "resource_evidence", "evidence-contract-freeze.schema.json"),
  fixtureDefinition("capability_workflow_contract_freeze", "Capability Workflow Contract Freeze", "contracts", "capability-workflow-contract-freeze.schema.json"),
  fixtureDefinition("runtime_agentrun_contract_freeze", "Runtime AgentRun Contract Freeze", "runtime", "runtime-agentrun-contract-freeze.schema.json"),
  fixtureDefinition("runtime_adapter_interface_v2", "Runtime Adapter Interface v2", "runtime", "runtime-adapter-interface-v2.schema.json"),
  fixtureDefinition("hermes_runtime_adapter", "Hermes Runtime Adapter", "runtime", "hermes-runtime-adapter.schema.json"),
  fixtureDefinition("claude_code_adapter_contract", "Claude Code Adapter Contract", "runtime", "claude-code-adapter-contract.schema.json"),
  fixtureDefinition("codex_adapter_contract", "Codex Adapter Contract", "runtime", "codex-adapter-contract.schema.json"),
  fixtureDefinition("local_script_adapter", "Local Script Adapter", "runtime", "local-script-adapter.schema.json"),
  fixtureDefinition("gate_approval_contract_freeze", "Gate Approval Contract Freeze", "gate_approval", "gate-approval-contract-freeze.schema.json"),
  fixtureDefinition("output_delivery_contract_freeze", "Output Delivery Contract Freeze", "delivery", "output-delivery-contract-freeze.schema.json"),
  fixtureDefinition("event_audit_run_contract_freeze", "Event Audit Run Contract Freeze", "audit", "event-audit-run-contract-freeze.schema.json"),
  fixtureDefinition("event_envelope_ledger", "Event Envelope Ledger", "audit", "event-envelope-ledger.schema.json"),
  fixtureDefinition("event_type_registry", "Event Type Registry", "audit", "event-type-registry.schema.json"),
  fixtureDefinition("append_only_event_store", "Append-only Event Store", "audit", "append-only-event-store.schema.json"),
  fixtureDefinition("event_correlation_ledger", "Event Correlation Ledger", "audit", "event-correlation-ledger.schema.json"),
  fixtureDefinition("workflow_run_ledger", "Workflow Run Ledger", "audit", "workflow-run-ledger.schema.json"),
  fixtureDefinition("agent_run_ledger", "Agent Run Ledger", "audit", "agent-run-ledger.schema.json"),
  fixtureDefinition("tool_invocation_ledger", "Tool Invocation Ledger", "audit", "tool-invocation-ledger.schema.json"),
  fixtureDefinition("audit_event_ledger", "Audit Event Ledger", "audit", "audit-event-ledger.schema.json"),
  fixtureDefinition("policy_snapshot_event_binding", "Policy Snapshot Event Binding", "audit", "policy-snapshot-event-binding.schema.json"),
  fixtureDefinition("cost_record_projection", "Cost Record Projection", "observability", "cost-record-projection.schema.json"),
  fixtureDefinition("token_usage_projection", "Token Usage Projection", "observability", "token-usage-projection.schema.json"),
  fixtureDefinition("observability_trace_projection", "Observability Trace Projection", "observability", "observability-trace-projection.schema.json"),
  fixtureDefinition("error_retry_ledger", "Error/Retry Ledger", "observability", "error-retry-ledger.schema.json"),
  fixtureDefinition("event_replay_harness", "Event Replay Harness", "audit", "event-replay-harness.schema.json"),
  fixtureDefinition("retention_archive_ledger", "Retention/Archive Ledger", "audit", "retention-archive-ledger.schema.json"),
  fixtureDefinition("ledger_api_dashboard", "Ledger API Dashboard", "api", "ledger-api-dashboard.schema.json"),
  fixtureDefinition("ledger_golden_fixtures", "Ledger Golden Fixtures", "audit", "ledger-golden-fixtures.schema.json"),
  fixtureDefinition("observability_freeze", "Observability Freeze", "observability", "observability-freeze.schema.json"),
  fixtureDefinition("capability_manifest_v2", "Capability Manifest v2", "contracts", "capability-manifest-v2-catalog.schema.json"),
  fixtureDefinition("pack_manifest_compatibility", "Pack Manifest Compatibility", "domain_packs", "pack-manifest-compatibility.schema.json"),
  fixtureDefinition("workflow_dsl_state_model", "Workflow DSL State Model", "workflow", "workflow-dsl-state-model.schema.json"),
  fixtureDefinition("workflow_state_machine_runner", "Workflow State Machine Runner", "workflow", "workflow-state-machine-runner.schema.json"),
  fixtureDefinition("workflow_queue_retry_backoff_contract", "Workflow Queue/Retry/Backoff Contract", "workflow", "workflow-queue-retry-backoff-contract.schema.json"),
  fixtureDefinition("workflow_idempotency_ledger", "Workflow Idempotency Ledger", "workflow", "workflow-idempotency-ledger.schema.json"),
  fixtureDefinition("workflow_resume_cancel_contract", "Workflow Resume/Cancel Contract", "workflow", "workflow-resume-cancel-contract.schema.json"),
  fixtureDefinition("workflow_context_builder_contract", "Workflow Context Builder Contract", "workflow", "workflow-context-builder-contract.schema.json"),
  fixtureDefinition("workflow_retrieval_compiler", "Workflow Retrieval Compiler", "workflow", "workflow-retrieval-compiler.schema.json"),
  fixtureDefinition("workflow_prompt_injection_boundary", "Workflow Prompt Injection Boundary", "workflow", "workflow-prompt-injection-boundary.schema.json"),
  fixtureDefinition("workflow_pre_run_gate_framework", "Workflow Pre-run Gate Framework", "workflow", "workflow-pre-run-gate-framework.schema.json"),
  fixtureDefinition("workflow_in_run_gate_framework", "Workflow In-run Gate Framework", "workflow", "workflow-in-run-gate-framework.schema.json"),
  fixtureDefinition("workflow_post_run_gate_framework", "Workflow Post-run Gate Framework", "workflow", "workflow-post-run-gate-framework.schema.json"),
  fixtureDefinition("gate_result_aggregator", "Gate Result Aggregator", "workflow", "gate-result-aggregator.schema.json"),
  fixtureDefinition("capability_registry_api", "Capability Registry API", "api", "capability-registry-api.schema.json"),
  fixtureDefinition("workflow_run_dashboard", "Workflow Run Dashboard", "api", "workflow-run-dashboard.schema.json"),
  fixtureDefinition("workflow_golden_cases", "Workflow Golden Cases", "workflow", "workflow-golden-cases.schema.json"),
  fixtureDefinition("workflow_gate_freeze", "Workflow/Gate Freeze", "workflow", "workflow-gate-freeze.schema.json"),
  fixtureDefinition("error_cost_observability_contract_freeze", "Error Cost Observability Contract Freeze", "observability", "error-cost-observability-contract-freeze.schema.json"),
];

export async function runContractGoldenFixtures(options = {}) {
  const result = await buildContractGoldenFixtures(options);
  if (options.write !== false) await writeContractGoldenFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Contract golden fixture validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContractGoldenFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTRACT_GOLDEN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const goldenFixtures = [];
  for (const definition of GOLDEN_FIXTURE_DEFINITIONS) {
    goldenFixtures.push(await buildGoldenFixtureRecord(definition, inputs, generatedAt));
  }
  const regressionHashManifest = buildRegressionHashManifest(goldenFixtures, generatedAt);
  const validationItems = buildValidationItems(goldenFixtures, regressionHashManifest);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "contract-golden-fixtures.v1",
    generated_at: generatedAt,
    golden_fixture_set_id: `contract-golden-fixtures.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    golden_fixture_manifest: {
      schema_version: "contract-golden-fixture-manifest.v1",
      generated_at: generatedAt,
      required_fixture_count: GOLDEN_FIXTURE_DEFINITIONS.length,
      fixture_definitions: GOLDEN_FIXTURE_DEFINITIONS,
    },
    golden_fixtures: goldenFixtures,
    regression_hash_manifest: regressionHashManifest,
    validation_items: validationItems,
    validation,
    summary: summarizeGoldenFixtures(goldenFixtures, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderContractGoldenFixturesMarkdown(result),
  };
}

export async function writeContractGoldenFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableGoldenFixtures(result);
  await writeJson(path.join(outDir, "contract-golden-fixtures.json"), serializable);
  await writeJson(path.join(outDir, "golden-fixture-manifest.json"), result.golden_fixture_manifest);
  await writeJson(path.join(outDir, "golden-fixture-records.json"), {
    generated_at: result.generated_at,
    golden_fixture_count: result.golden_fixtures.length,
    golden_fixtures: result.golden_fixtures,
  });
  await writeJson(path.join(outDir, "regression-hash-manifest.json"), result.regression_hash_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    golden_fixture_set_id: result.golden_fixture_set_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContractGoldenFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContractGoldenFixtures(args);
    console.log(`Contract golden fixtures written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.golden_fixture_status}`);
    console.log(`Fixtures: ${result.summary.fixture_count}`);
    console.log(`Schema-valid fixtures: ${result.summary.schema_valid_fixture_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function fixtureDefinition(fixtureId, label, fixtureScope, schemaFile) {
  return {
    fixture_id: fixtureId,
    label,
    fixture_scope: fixtureScope,
    schema_file: schemaFile,
  };
}

async function buildGoldenFixtureRecord(definition, inputs, generatedAt) {
  const artifactPath = inputs.artifact_paths[definition.fixture_id] ?? null;
  const schemaPath = path.join(inputs.schema_dir, definition.schema_file);
  const artifactRead = await readJsonWithRaw(artifactPath);
  const schemaRead = await readJsonWithRaw(schemaPath);
  const schemaErrors = artifactRead.value && schemaRead.value
    ? validateAgainstSchema(artifactRead.value, schemaRead.value, {}, definition.fixture_id)
    : [];
  const readErrors = [
    ...(artifactRead.error ? [{ path: artifactPath, message: artifactRead.error }] : []),
    ...(schemaRead.error ? [{ path: schemaPath, message: schemaRead.error }] : []),
  ];
  const validationErrors = [...readErrors, ...schemaErrors];
  const contentHash = artifactRead.raw ? sha256(artifactRead.raw) : null;
  return {
    schema_version: "contract-golden-fixture-record.v1",
    golden_fixture_id: `golden-fixture.${definition.fixture_id}`,
    fixture_id: definition.fixture_id,
    artifact_id: definition.fixture_id,
    label: definition.label,
    fixture_scope: definition.fixture_scope,
    owner_area: definition.fixture_scope,
    artifact_path: artifactPath,
    schema_path: schemaPath,
    artifact_schema_version: artifactRead.value?.schema_version ?? null,
    fixture_status: validationErrors.length === 0 ? "locked" : "blocked",
    schema_validation_status: schemaErrors.length === 0 && readErrors.length === 0 ? "passed" : "failed",
    regression_status: contentHash ? "locked" : "missing_hash",
    content_hash: contentHash,
    schema_hash: schemaRead.raw ? sha256(schemaRead.raw) : null,
    captured_at: generatedAt,
    validation_error_count: validationErrors.length,
    validation_errors: validationErrors,
  };
}

function buildRegressionHashManifest(goldenFixtures, generatedAt) {
  const regressionHashes = goldenFixtures.map((fixture) => ({
    regression_hash_id: `regression-hash.${fixture.fixture_id}`,
    golden_fixture_id: fixture.golden_fixture_id,
    fixture_id: fixture.fixture_id,
    fixture_scope: fixture.fixture_scope,
    content_hash: fixture.content_hash,
    schema_hash: fixture.schema_hash,
    regression_status: fixture.regression_status,
  }));
  return {
    schema_version: "contract-golden-regression-hash-manifest.v1",
    generated_at: generatedAt,
    regression_hash_count: regressionHashes.length,
    locked_regression_hash_count: regressionHashes.filter((item) => item.regression_status === "locked").length,
    regression_hashes: regressionHashes,
  };
}

function buildValidationItems(goldenFixtures, regressionHashManifest) {
  const items = [];
  for (const fixture of goldenFixtures) {
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.artifact_path`,
      check_id: "golden_fixture_artifact_available",
      passed: fixture.validation_errors.every((error) => error.path !== fixture.artifact_path),
      message: `${fixture.fixture_id} artifact path is ${fixture.artifact_path ?? "missing"}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.schema_path`,
      check_id: "golden_fixture_schema_available",
      passed: fixture.validation_errors.every((error) => error.path !== fixture.schema_path),
      message: `${fixture.fixture_id} schema path is ${fixture.schema_path}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.schema_validation_status`,
      check_id: "golden_fixture_schema_validation_passed",
      passed: fixture.schema_validation_status === "passed",
      message: `${fixture.fixture_id} schema validation status is ${fixture.schema_validation_status}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.content_hash`,
      check_id: "golden_fixture_content_hash_locked",
      passed: Boolean(fixture.content_hash),
      message: `${fixture.fixture_id} content hash is ${fixture.content_hash ? "locked" : "missing"}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.artifact_schema_version`,
      check_id: "golden_fixture_schema_version_present",
      passed: Boolean(fixture.artifact_schema_version),
      message: `${fixture.fixture_id} artifact schema version is ${fixture.artifact_schema_version ?? "missing"}.`,
    });
  }
  addValidation(items, {
    path: "regression_hash_manifest",
    check_id: "regression_hash_manifest_matches_fixture_count",
    passed: regressionHashManifest.regression_hash_count === goldenFixtures.length,
    message: `${regressionHashManifest.regression_hash_count} regression hash row(s) for ${goldenFixtures.length} fixture(s).`,
  });
  addValidation(items, {
    path: "regression_hash_manifest.locked_regression_hash_count",
    check_id: "all_regression_hashes_locked",
    passed: regressionHashManifest.locked_regression_hash_count === goldenFixtures.length,
    message: `${regressionHashManifest.locked_regression_hash_count}/${goldenFixtures.length} regression hash(es) are locked.`,
  });
  return items;
}

function summarizeGoldenFixtures(goldenFixtures, validationItems, validation) {
  const failedValidationItems = validationItems.filter((item) => item.status === "failed");
  return {
    golden_fixture_status: validation.valid ? "complete" : "blocked",
    fixture_count: goldenFixtures.length,
    required_fixture_count: GOLDEN_FIXTURE_DEFINITIONS.length,
    locked_fixture_count: goldenFixtures.filter((fixture) => fixture.fixture_status === "locked").length,
    blocked_fixture_count: goldenFixtures.filter((fixture) => fixture.fixture_status === "blocked").length,
    schema_valid_fixture_count: goldenFixtures.filter((fixture) => fixture.schema_validation_status === "passed").length,
    schema_invalid_fixture_count: goldenFixtures.filter((fixture) => fixture.schema_validation_status === "failed").length,
    regression_hash_count: goldenFixtures.filter((fixture) => fixture.content_hash).length,
    locked_regression_hash_count: goldenFixtures.filter((fixture) => fixture.regression_status === "locked").length,
    missing_artifact_count: goldenFixtures.filter((fixture) => !fixture.content_hash).length,
    schema_version_present_count: goldenFixtures.filter((fixture) => fixture.artifact_schema_version).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItems.length,
    validation_error_count: validation.errors.length,
    by_fixture_scope: countBy(goldenFixtures, "fixture_scope"),
    by_owner_area: countBy(goldenFixtures, "owner_area"),
    by_schema_validation_status: countBy(goldenFixtures, "schema_validation_status"),
    by_regression_status: countBy(goldenFixtures, "regression_status"),
  };
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `contract-golden-fixtures.${slugify(itemPath)}.${checkId}`,
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

function renderContractGoldenFixturesMarkdown(result) {
  const lines = [];
  lines.push("# Contract Golden Fixtures");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.golden_fixture_status}`);
  lines.push("");
  lines.push(`- Fixtures: ${result.summary.fixture_count}`);
  lines.push(`- Schema-valid fixtures: ${result.summary.schema_valid_fixture_count}`);
  lines.push(`- Locked regression hashes: ${result.summary.locked_regression_hash_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Fixtures");
  for (const fixture of result.golden_fixtures) {
    lines.push(`- ${fixture.fixture_id}: ${fixture.fixture_scope} / ${fixture.schema_validation_status} / ${fixture.regression_status}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const artifactPaths = {
    ...DEFAULT_CONTRACT_GOLDEN_FIXTURES_INPUTS.artifactPaths,
    ...(options.artifactPaths ?? {}),
  };
  return {
    schema_dir: path.resolve(options.schemaDir ?? DEFAULT_CONTRACT_GOLDEN_FIXTURES_INPUTS.schemaDir),
    artifact_paths: Object.fromEntries(
      Object.entries(artifactPaths).map(([artifactId, artifactPath]) => [artifactId, path.resolve(artifactPath)]),
    ),
  };
}

function parseArgs(argv) {
  const parsed = { artifactPaths: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--schema-dir") parsed.schemaDir = argv[++index];
    else if (arg === "--artifact") {
      const value = argv[++index];
      const [artifactId, ...pathParts] = String(value).split("=");
      if (!artifactId || pathParts.length === 0) throw new Error("--artifact must use artifact_id=path");
      parsed.artifactPaths[artifactId] = pathParts.join("=");
    } else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/contract-golden-fixtures.mjs [options]

Options:
  --schema-dir <path>           Schema directory.
  --artifact <artifact_id=path> Override a golden fixture artifact path.
  --out-dir <path>              Output directory.
  --run-at <iso>                Fixed generation timestamp.
  --check                       Exit non-zero when validation fails.
  -h, --help                    Show this help.
`);
}

async function readJsonWithRaw(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      raw,
      value: JSON.parse(raw),
      error: null,
    };
  } catch (error) {
    return {
      raw: null,
      value: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableGoldenFixtures(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
