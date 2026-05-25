import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IDENTITY_POLICY_MATTER_FREEZE_OUT_DIR = "artifacts/identity-policy-matter-freeze/latest";
export const DEFAULT_IDENTITY_POLICY_MATTER_FREEZE_INPUTS = {
  identityModelPath: "artifacts/identity-model/latest/identity-model.json",
  clientCounterpartyRegistryPath: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
  approvalAuthorityLedgerPath: "artifacts/approval-authority/latest/approval-authority-ledger.json",
  policySnapshotBindingLedgerPath: "artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json",
  matterTaggingDecisionLedgerPath: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
  accessAuditProjectionPath: "artifacts/access-audit/latest/access-audit-projection.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  conflictCheckInterfacePath: "artifacts/conflict-check/latest/conflict-check-interface.json",
  personalWorkspaceBoundaryPath: "artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json",
  policyGoldenFixturesPath: "artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json",
  policyOperationsSurfacePath: "artifacts/policy-operations-surface/latest/policy-operations-surface.json",
  matterBoundarySlicePath: "artifacts/matter-boundary-slice/latest/matter-boundary-slice.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const FREEZE_SOURCE_DEFINITIONS = [
  sourceDefinition("identity_model", "Identity Model", "identityModelPath", "P113", "identity_model_status", "complete"),
  sourceDefinition("client_counterparty_registry", "Client/Counterparty Registry", "clientCounterpartyRegistryPath", "P114", "registry_status", "complete"),
  sourceDefinition("matter_profile_team_ledger", "Matter Profile/Team Ledger", "matterProfileTeamLedgerPath", "P115", "ledger_status", "complete"),
  sourceDefinition("wall_policy_contract", "Wall Policy Contract", "wallPolicyContractPath", "P116", "wall_policy_status", "complete"),
  sourceDefinition("matter_access_policy_evaluator", "Matter Access Policy Evaluator", "matterAccessPolicyEvaluatorPath", "P117", "access_policy_status", "complete"),
  sourceDefinition("data_classification_rule_engine", "Data Classification Rule Engine", "dataClassificationRuleEnginePath", "P118", "classification_rule_engine_status", "complete"),
  sourceDefinition("model_policy_enforcement", "Model Policy Enforcement", "modelPolicyEnforcementPath", "P119", "model_policy_enforcement_status", "complete"),
  sourceDefinition("tool_runtime_policy_enforcement", "Tool/Runtime Policy Enforcement", "toolRuntimePolicyEnforcementPath", "P120", "tool_runtime_policy_enforcement_status", "complete"),
  sourceDefinition("output_destination_policy_enforcement", "Output Destination Policy Enforcement", "outputDestinationPolicyEnforcementPath", "P121", "output_destination_policy_status", "complete"),
  sourceDefinition("approval_authority_ledger", "Approval Authority Ledger", "approvalAuthorityLedgerPath", "P122", "approval_authority_status", "complete"),
  sourceDefinition("policy_snapshot_binding_ledger", "Policy Snapshot Binding Ledger", "policySnapshotBindingLedgerPath", "P123", "policy_snapshot_binding_status", "complete"),
  sourceDefinition("matter_tagging_decision_ledger", "Matter Tagging Decision Ledger", "matterTaggingDecisionLedgerPath", "P124", "matter_tagging_ledger_status", "complete"),
  sourceDefinition("access_audit_projection", "Access Audit Projection", "accessAuditProjectionPath", "P125", "access_audit_projection_status", "complete"),
  sourceDefinition("store_policy_adapter", "Store Policy Adapter", "storePolicyAdapterPath", "P126", "store_policy_adapter_status", "complete"),
  sourceDefinition("conflict_check_interface", "Conflict Check Interface", "conflictCheckInterfacePath", "P127", "conflict_check_interface_status", "complete"),
  sourceDefinition("personal_workspace_boundary", "Personal Workspace Boundary", "personalWorkspaceBoundaryPath", "P128", "personal_workspace_boundary_status", "complete"),
  sourceDefinition("policy_golden_fixtures", "Policy Golden Fixtures", "policyGoldenFixturesPath", "P129", "policy_golden_fixture_status", "complete"),
  sourceDefinition("policy_operations_surface", "Policy Operations Surface", "policyOperationsSurfacePath", "P130", "policy_operations_surface_status", "complete"),
  sourceDefinition("matter_boundary_slice", "Matter Boundary Slice", "matterBoundarySlicePath", "P131", "matter_boundary_slice_status", "complete"),
];

const SUPPORT_SOURCE_DEFINITIONS = [
  sourceDefinition("package_json", "Package Scripts", "packagePath", "verification", null, null, "text"),
  sourceDefinition("implementation_roadmap", "Implementation Roadmap", "roadmapPath", "verification", null, null, "text"),
];

export async function runIdentityPolicyMatterFreeze(options = {}) {
  const result = await buildIdentityPolicyMatterFreeze(options);
  if (options.write !== false) await writeIdentityPolicyMatterFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Identity/Policy/Matter freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildIdentityPolicyMatterFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_IDENTITY_POLICY_MATTER_FREEZE_OUT_DIR);
  const freezeSources = await readSources(FREEZE_SOURCE_DEFINITIONS, options);
  const supportSources = await readSources(SUPPORT_SOURCE_DEFINITIONS, options);
  const artifacts = Object.fromEntries([...freezeSources, ...supportSources].map((source) => [source.source_id, source.data]));
  const freezeSourceStatuses = freezeSources.map((source) => buildFreezeSourceStatus(source));
  const freezeCheckpoints = buildFreezeCheckpoints(artifacts, freezeSourceStatuses);
  const validation = summarizeValidation(freezeCheckpoints);
  const freezeStatus = validation.valid ? deriveFreezeStatus(artifacts) : "blocked";
  const result = {
    schema_version: "identity-policy-matter-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `identity-policy-matter-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    freeze_status: freezeStatus,
    safe_handling: {
      freeze_report_only: true,
      source_artifact_mutation_allowed: false,
      protected_actions_executed: false,
      external_delivery_executed: false,
      auto_approval_allowed: false,
    },
    inputs: normalizeInputs(options),
    freeze_scope: {
      track: "Identity, Policy, Matter Boundary",
      frozen_slots: ["P113", "P114", "P115", "P116", "P117", "P118", "P119", "P120", "P121", "P122", "P123", "P124", "P125", "P126", "P127", "P128", "P129", "P130", "P131", "P132"],
      source_phase_range: "Phase 113-131",
      next_planned_slot: "P133",
      next_track: "Resource, Data, Evidence, Lineage Plane",
    },
    freeze_source_statuses: freezeSourceStatuses,
    freeze_checkpoints: freezeCheckpoints,
    freeze_note: buildFreezeNote({ generatedAt, freezeStatus, artifacts, freezeSourceStatuses, freezeCheckpoints }),
    validation,
    summary: summarizeFreeze({ freezeStatus, freezeSourceStatuses, freezeCheckpoints, artifacts, validation }),
  };
  return {
    ...result,
    markdown: renderFreezeMarkdown(result),
  };
}

export async function writeIdentityPolicyMatterFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "identity-policy-matter-freeze.json"), serializableFreeze(result));
  await writeJson(path.join(outDir, "freeze-source-statuses.json"), {
    generated_at: result.generated_at,
    freeze_source_status_count: result.freeze_source_statuses.length,
    freeze_source_statuses: result.freeze_source_statuses,
  });
  await writeJson(path.join(outDir, "freeze-checkpoints.json"), {
    generated_at: result.generated_at,
    freeze_checkpoint_count: result.freeze_checkpoints.length,
    freeze_checkpoints: result.freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "freeze-note.json"), result.freeze_note);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    freeze_checkpoints: result.freeze_checkpoints,
  });
  await writeFile(path.join(outDir, "freeze-note.md"), renderFreezeNoteMarkdown(result.freeze_note), "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runIdentityPolicyMatterFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runIdentityPolicyMatterFreeze(args);
    console.log(`Identity/Policy/Matter freeze written to ${result.output_dir}`);
    console.log(`Freeze status: ${result.freeze_status}`);
    console.log(`Sources: ${result.summary.available_required_source_count}/${result.summary.required_source_count}`);
    console.log(`Checkpoints: ${result.summary.passed_freeze_checkpoint_count}/${result.summary.freeze_checkpoint_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readSources(definitions, options) {
  const inputs = normalizeInputs(options);
  const sources = [];
  for (const definition of definitions) {
    const configuredPath = inputs[snakeCase(definition.option)];
    const readResult = definition.format === "text"
      ? await readTextOrError(configuredPath)
      : await readJsonOrError(configuredPath);
    sources.push({
      ...definition,
      path: configuredPath,
      available: readResult.ok,
      schema_version: readResult.value?.schema_version ?? null,
      generated_at: readResult.value?.generated_at ?? null,
      summary: readResult.value?.summary ?? null,
      content_hash: readResult.raw ? sha256(readResult.raw) : null,
      observed_status: definition.status_key ? readResult.value?.summary?.[definition.status_key] ?? null : readResult.ok ? "available" : null,
      data: readResult.value,
      error: readResult.error,
    });
  }
  return sources;
}

function buildFreezeSourceStatus(source) {
  const statusMatches = source.expected_status === null || source.observed_status === source.expected_status;
  return {
    source_id: source.source_id,
    label: source.label,
    planned_slot: source.planned_slot,
    path: source.path,
    available: source.available,
    schema_version: source.schema_version,
    generated_at: source.generated_at,
    status_key: source.status_key,
    expected_status: source.expected_status,
    observed_status: source.observed_status,
    source_status: source.available && statusMatches ? "passed" : "failed",
    validation_error_count: source.summary?.validation_error_count ?? source.data?.validation?.errors?.length ?? 0,
    content_hash: source.content_hash,
    error: source.error,
  };
}

function buildFreezeCheckpoints(artifacts, sourceStatuses) {
  const checkpoints = [];
  const packageText = artifacts.package_json ?? "";
  const roadmapText = artifacts.implementation_roadmap ?? "";
  for (const source of sourceStatuses) {
    pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_available", source.available, `${source.label} source artifact must be readable.`);
    if (source.expected_status !== null) {
      pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_status_expected", source.observed_status === source.expected_status, `${source.label} must report ${source.status_key}=${source.expected_status}.`);
      pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_validation_clean", source.validation_error_count === 0, `${source.label} must not carry validation errors.`);
    }
    pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_hash_locked", Boolean(source.content_hash), `${source.label} must have a content hash for freeze evidence.`);
  }

  const policyGolden = artifacts.policy_golden_fixtures?.summary ?? {};
  pushCheckpoint(checkpoints, "policy_golden_fixtures", "allow_review_deny_present", (policyGolden.allow_case_count ?? 0) > 0 && (policyGolden.review_case_count ?? 0) > 0 && (policyGolden.deny_case_count ?? 0) > 0, "Policy golden fixtures must preserve allow, review, and deny cases.");
  pushCheckpoint(checkpoints, "policy_golden_fixtures", "locked_regression_hashes", (policyGolden.locked_regression_hash_count ?? 0) === (policyGolden.policy_fixture_case_count ?? -1), "Every policy fixture case must have a locked regression hash.");
  pushCheckpoint(checkpoints, "policy_golden_fixtures", "no_policy_fixture_mismatch", (policyGolden.mismatch_case_count ?? 0) === 0 && (policyGolden.missing_case_count ?? 0) === 0, "Policy golden fixtures must not have missing or mismatched cases.");

  const policySurface = artifacts.policy_operations_surface?.summary ?? {};
  pushCheckpoint(checkpoints, "policy_operations_surface", "policy_decisions_visible", (policySurface.policy_decision_row_count ?? 0) > 0 && (policySurface.allow_decision_count ?? 0) > 0 && (policySurface.review_decision_count ?? 0) > 0 && (policySurface.deny_decision_count ?? 0) > 0, "Policy operations surface must expose allow, review, and deny decisions.");
  pushCheckpoint(checkpoints, "policy_operations_surface", "violations_and_pending_approvals_visible", (policySurface.policy_violation_row_count ?? 0) > 0 && (policySurface.policy_pending_approval_row_count ?? 0) > 0, "Policy operations surface must expose violations and pending approvals.");

  const matterBoundary = artifacts.matter_boundary_slice?.summary ?? {};
  pushCheckpoint(checkpoints, "matter_boundary_slice", "boundary_paths_complete", (matterBoundary.resource_boundary_path_count ?? 0) > 0 && (matterBoundary.promoted_resource_path_count ?? 0) === (matterBoundary.resource_boundary_path_count ?? -1), "Matter boundary slice must preserve promoted resource paths.");
  pushCheckpoint(checkpoints, "matter_boundary_slice", "retrieval_gates_complete", (matterBoundary.retrieval_gate_check_count ?? 0) > 0 && (matterBoundary.passed_retrieval_gate_check_count ?? 0) === (matterBoundary.retrieval_gate_check_count ?? -1), "Matter boundary slice retrieval gates must all pass.");
  pushCheckpoint(checkpoints, "matter_boundary_slice", "unassigned_resources_not_executable", (matterBoundary.unassigned_executable_query_plan_count ?? 0) === 0, "Unassigned resources must not have executable query plans.");

  const workspace = artifacts.personal_workspace_boundary?.summary ?? {};
  pushCheckpoint(checkpoints, "personal_workspace_boundary", "cross_workspace_probes_blocked", (workspace.cross_workspace_probe_count ?? 0) > 0 && (workspace.blocked_cross_workspace_probe_count ?? 0) === (workspace.cross_workspace_probe_count ?? -1), "Cross-workspace probes must all be blocked.");

  pushCheckpoint(checkpoints, "package_json", "freeze_script_registered", String(packageText).includes("\"identity-policy:freeze\""), "package.json must expose npm run identity-policy:freeze.");
  pushCheckpoint(checkpoints, "implementation_roadmap", "phase_131_recorded", String(roadmapText).includes("## Phase 131: Matter Boundary Slice"), "Roadmap must retain the Phase 131 completion record.");
  pushCheckpoint(checkpoints, "implementation_roadmap", "phase_132_recorded", String(roadmapText).includes("## Phase 132: Identity/Policy/Matter Freeze"), "Roadmap must record Phase 132 completion.");
  return checkpoints;
}

function deriveFreezeStatus(artifacts) {
  const pending = artifacts.policy_operations_surface?.summary?.policy_pending_approval_row_count ?? 0;
  const held = artifacts.matter_boundary_slice?.summary?.held_for_matter_tagging_resource_count ?? 0;
  return pending > 0 || held > 0 ? "frozen_with_pending_human_actions" : "frozen_clear";
}

function summarizeFreeze({ freezeStatus, freezeSourceStatuses, freezeCheckpoints, artifacts, validation }) {
  return {
    freeze_status: freezeStatus,
    required_source_count: freezeSourceStatuses.length,
    available_required_source_count: freezeSourceStatuses.filter((source) => source.available).length,
    clean_source_count: freezeSourceStatuses.filter((source) => source.source_status === "passed" && source.validation_error_count === 0).length,
    frozen_slot_count: 20,
    freeze_checkpoint_count: freezeCheckpoints.length,
    passed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status === "passed").length,
    failed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status === "failed").length,
    policy_fixture_case_count: artifacts.policy_golden_fixtures?.summary?.policy_fixture_case_count ?? 0,
    locked_policy_fixture_count: artifacts.policy_golden_fixtures?.summary?.locked_case_count ?? 0,
    policy_regression_hash_count: artifacts.policy_golden_fixtures?.summary?.locked_regression_hash_count ?? 0,
    policy_decision_row_count: artifacts.policy_operations_surface?.summary?.policy_decision_row_count ?? 0,
    policy_violation_row_count: artifacts.policy_operations_surface?.summary?.policy_violation_row_count ?? 0,
    policy_pending_approval_row_count: artifacts.policy_operations_surface?.summary?.policy_pending_approval_row_count ?? 0,
    resource_boundary_path_count: artifacts.matter_boundary_slice?.summary?.resource_boundary_path_count ?? 0,
    retrieval_gate_check_count: artifacts.matter_boundary_slice?.summary?.retrieval_gate_check_count ?? 0,
    unassigned_executable_query_plan_count: artifacts.matter_boundary_slice?.summary?.unassigned_executable_query_plan_count ?? 0,
    held_for_matter_tagging_resource_count: artifacts.matter_boundary_slice?.summary?.held_for_matter_tagging_resource_count ?? 0,
    cross_workspace_probe_count: artifacts.personal_workspace_boundary?.summary?.cross_workspace_probe_count ?? 0,
    blocked_cross_workspace_probe_count: artifacts.personal_workspace_boundary?.summary?.blocked_cross_workspace_probe_count ?? 0,
    validation_error_count: validation.errors.length,
    protected_action_executed_count: 0,
    external_delivery_executed_count: 0,
    auto_approval_count: 0,
    by_checkpoint_status: countBy(freezeCheckpoints, "status"),
  };
}

function buildFreezeNote({ generatedAt, freezeStatus, artifacts, freezeSourceStatuses, freezeCheckpoints }) {
  return {
    note_id: `identity-policy-matter-freeze-note.${dateStamp(generatedAt)}`,
    freeze_status: freezeStatus,
    frozen_at: generatedAt,
    scope: "Identity, Policy, Matter Boundary P113-P132",
    next_planned_slot: "P133",
    next_track: "Resource, Data, Evidence, Lineage Plane",
    residual_human_actions: {
      policy_pending_approval_row_count: artifacts.policy_operations_surface?.summary?.policy_pending_approval_row_count ?? 0,
      held_for_matter_tagging_resource_count: artifacts.matter_boundary_slice?.summary?.held_for_matter_tagging_resource_count ?? 0,
    },
    verification_summary: {
      required_source_count: freezeSourceStatuses.length,
      available_required_source_count: freezeSourceStatuses.filter((source) => source.available).length,
      freeze_checkpoint_count: freezeCheckpoints.length,
      passed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status === "passed").length,
    },
    freeze_decision: freezeStatus === "blocked"
      ? "Identity/Policy/Matter track is not frozen; fix failed checkpoints first."
      : "Identity/Policy/Matter track is frozen for regression purposes; pending human actions remain draft-only gates.",
  };
}

function renderFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Identity/Policy/Matter Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Freeze status: ${result.freeze_status}`);
  lines.push("");
  lines.push(`- Sources: ${result.summary.available_required_source_count}/${result.summary.required_source_count}`);
  lines.push(`- Checkpoints: ${result.summary.passed_freeze_checkpoint_count}/${result.summary.freeze_checkpoint_count}`);
  lines.push(`- Policy fixture cases: ${result.summary.policy_fixture_case_count}`);
  lines.push(`- Policy decisions: ${result.summary.policy_decision_row_count}`);
  lines.push(`- Resource boundary paths: ${result.summary.resource_boundary_path_count}`);
  lines.push(`- Retrieval gates: ${result.summary.retrieval_gate_check_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Failed Checkpoints");
  const failed = result.freeze_checkpoints.filter((checkpoint) => checkpoint.status === "failed");
  if (failed.length === 0) lines.push("- None");
  for (const checkpoint of failed) lines.push(`- ${checkpoint.path}.${checkpoint.check_id}: ${checkpoint.message}`);
  return `${lines.join("\n")}\n`;
}

function renderFreezeNoteMarkdown(note) {
  const lines = [];
  lines.push("# Identity/Policy/Matter Freeze Note");
  lines.push("");
  lines.push(`Frozen at: ${note.frozen_at}`);
  lines.push(`Status: ${note.freeze_status}`);
  lines.push(`Scope: ${note.scope}`);
  lines.push(`Next: ${note.next_planned_slot} (${note.next_track})`);
  lines.push("");
  lines.push(note.freeze_decision);
  return `${lines.join("\n")}\n`;
}

function pushCheckpoint(items, itemPath, checkId, passed, message) {
  items.push({
    checkpoint_id: `identity-policy-matter-freeze.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(checkpoints) {
  const errors = checkpoints
    .filter((checkpoint) => checkpoint.status === "failed")
    .map((checkpoint) => ({ path: checkpoint.path, message: checkpoint.message, check_id: checkpoint.check_id }));
  return { valid: errors.length === 0, errors };
}

function sourceDefinition(sourceId, label, option, plannedSlot, statusKey, expectedStatus, format = "json") {
  return { source_id: sourceId, label, option, planned_slot: plannedSlot, status_key: statusKey, expected_status: expectedStatus, format };
}

function normalizeInputs(options) {
  const entries = Object.entries(DEFAULT_IDENTITY_POLICY_MATTER_FREEZE_INPUTS).map(([key, defaultPath]) => [snakeCase(key), path.resolve(options[key] ?? defaultPath)]);
  return Object.fromEntries(entries);
}

function parseArgs(argv) {
  const parsed = {};
  const optionByFlag = new Map(Object.keys(DEFAULT_IDENTITY_POLICY_MATTER_FREEZE_INPUTS).map((key) => [`--${dashCase(key.replace(/Path$/, ""))}`, key]));
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (optionByFlag.has(arg)) parsed[optionByFlag.get(arg)] = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/identity-policy-matter-freeze.mjs [options]

Options:
  --out-dir <path>                    Output directory.
  --run-at <iso>                      Fixed generation timestamp.
  --check                             Exit non-zero when validation fails.
  --identity-model <path>             identity-model.json path.
  --policy-golden-fixtures <path>     policy-golden-fixtures.json path.
  --policy-operations-surface <path>  policy-operations-surface.json path.
  --matter-boundary-slice <path>      matter-boundary-slice.json path.
  -h, --help                          Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: JSON.parse(raw), raw, error: null };
  } catch (error) {
    return { ok: false, value: null, raw: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: raw, raw, error: null };
  } catch (error) {
    return { ok: false, value: null, raw: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function dateStamp(value) {
  return value.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function snakeCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, "");
}

function dashCase(value) {
  return snakeCase(value).replaceAll("_", "-");
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
