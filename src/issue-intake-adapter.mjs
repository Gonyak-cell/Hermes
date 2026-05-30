import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ISSUE_INTAKE_ADAPTER_OUT_DIR = "artifacts/issue-intake-adapter/latest";
export const DEFAULT_ISSUE_INTAKE_ADAPTER_INPUTS = {
  repoRoot: ".",
  devProjectsPath: "examples/dev-projects.json",
  agentInstructionRegistryPath: "artifacts/agent-instruction-registry/latest/agent-instruction-registry.json",
  repoProfileDetectorPath: "artifacts/repo-profile-detector/latest/repo-profile-detector.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "issue-intake-adapter.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "issue_tracker_payloads_normalized_to_task_contract";
const DESKTOP_SURFACE_POLICY = "read_only_operator_surface";

export async function runIssueIntakeAdapter(options = {}) {
  const result = await buildIssueIntakeAdapter(options);
  if (options.write !== false) await writeIssueIntakeAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Issue intake adapter validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildIssueIntakeAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ISSUE_INTAKE_ADAPTER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const devProjects = await readJsonOrError(path.resolve(repoRoot, inputs.dev_projects_path));
  const repoProfileDetector = await readJsonOrError(inputs.repo_profile_detector_path);
  const agentInstructionRegistry = await readJsonOrError(inputs.agent_instruction_registry_path);
  const issueSources = buildIssueSources({ generatedAt });
  const issueRecords = buildIssueRecords({ devProjects: devProjects.value, generatedAt });
  const normalizedTasks = buildNormalizedTaskContracts({
    issueRecords,
    repoProfileDetector: repoProfileDetector.value,
    agentInstructionRegistry: agentInstructionRegistry.value,
    generatedAt,
  });
  const issueTaskBindings = buildIssueTaskBindings({ issueRecords, normalizedTasks, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ issueSources, issueRecords, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    repoProfileDetector: repoProfileDetector.value,
    agentInstructionRegistry: agentInstructionRegistry.value,
    issueSources,
    issueRecords,
    normalizedTasks,
    issueTaskBindings,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeIssueIntakeAdapter({
    repoProfileDetector: repoProfileDetector.value,
    agentInstructionRegistry: agentInstructionRegistry.value,
    issueSources,
    issueRecords,
    normalizedTasks,
    issueTaskBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    issue_intake_adapter_id: `issue-intake-adapter.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    issue_intake_status: summary.issue_intake_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, devProjects, repoProfileDetector, agentInstructionRegistry }),
    issue_intake_contract: buildContract(generatedAt),
    issue_intake_sources: issueSources,
    issue_intake_records: issueRecords,
    normalized_task_contracts: normalizedTasks,
    issue_task_bindings: issueTaskBindings,
    issue_intake_desktop_boundary: desktopBoundary,
    issue_intake_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderIssueIntakeAdapterMarkdown(result),
  };
}

export async function writeIssueIntakeAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableIssueIntakeAdapter(result);
  await writeJson(path.join(outDir, "issue-intake-adapter.json"), serializable);
  await writeJson(path.join(outDir, "issue-intake-sources.json"), {
    schema_version: "issue-intake-sources.v1",
    generated_at: result.generated_at,
    issue_source_count: result.issue_intake_sources.length,
    issue_intake_sources: result.issue_intake_sources,
  });
  await writeJson(path.join(outDir, "issue-intake-records.json"), {
    schema_version: "issue-intake-records.v1",
    generated_at: result.generated_at,
    issue_record_count: result.issue_intake_records.length,
    issue_intake_records: result.issue_intake_records,
  });
  await writeJson(path.join(outDir, "normalized-task-contracts.json"), {
    schema_version: "normalized-task-contracts.v1",
    generated_at: result.generated_at,
    normalized_task_count: result.normalized_task_contracts.length,
    normalized_task_contracts: result.normalized_task_contracts,
  });
  await writeJson(path.join(outDir, "issue-task-bindings.json"), {
    schema_version: "issue-task-bindings.v1",
    generated_at: result.generated_at,
    issue_task_binding_count: result.issue_task_bindings.length,
    issue_task_bindings: result.issue_task_bindings,
  });
  await writeJson(path.join(outDir, "issue-intake-desktop-boundary.json"), {
    schema_version: "issue-intake-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    issue_intake_desktop_boundary: result.issue_intake_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "issue-intake-adapter-validation-report.v1",
    generated_at: result.generated_at,
    issue_intake_adapter_id: result.issue_intake_adapter_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runIssueIntakeAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runIssueIntakeAdapter(args);
    console.log(`Issue intake adapter ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.issue_intake_status}`);
    console.log(`Issue sources: ${result.summary.issue_source_count}`);
    console.log(`Normalized tasks: ${result.summary.normalized_task_count}`);
    console.log(`Issue mutations performed: ${result.summary.issue_mutation_performed_count}`);
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
    schema_version: "issue-intake-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    intake_rule: "github_plane_and_local_issue_payloads_are_mapped_to_one_normalized_task_contract_shape",
    source_rule: "remote_issue_trackers_are_represented_by_fixture_payloads_and_never_fetched_or_mutated_by_this_artifact",
    task_rule: "normalized_tasks_keep_source_issue_identity_status_priority_labels_repository_and_human_gate_requirements",
    desktop_companion_rule: "desktop_companion_reads_issue_source_issue_record_task_contract_and_binding_status_only",
    mutation_policy: "issue_writes_external_fetches_task_state_changes_and_protected_mutations_require_human_gate_and_are_not_executed_by_this_artifact",
    created_at: generatedAt,
  };
}

function buildIssueSources({ generatedAt }) {
  return [
    issueSourceRecord({ sourceSystem: "github", displayName: "GitHub Issues", sourceKind: "remote_issue_tracker", generatedAt }),
    issueSourceRecord({ sourceSystem: "plane", displayName: "Plane Issues", sourceKind: "remote_issue_tracker", generatedAt }),
    issueSourceRecord({ sourceSystem: "local", displayName: "Local Dev Project JSON", sourceKind: "local_fixture", generatedAt }),
  ];
}

function issueSourceRecord({ sourceSystem, displayName, sourceKind, generatedAt }) {
  const source = {
    schema_version: "issue-intake-source.v1",
    issue_source_id: `issue-intake-source.${sourceSystem}`,
    source_system: sourceSystem,
    source_kind: sourceKind,
    display_name: displayName,
    source_status: "ready",
    source_read_mode: sourceSystem === "local" ? "local_fixture" : "representative_fixture",
    source_record_count: 1,
    external_fetch_allowed: false,
    external_fetch_performed: false,
    issue_mutation_allowed: false,
    issue_mutation_performed: false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutations_require_human_gate: true,
    source_of_truth: SOURCE_OF_TRUTH,
    recorded_at: generatedAt,
  };
  return {
    ...source,
    issue_source_hash: hashObject(source),
  };
}

function buildIssueRecords({ devProjects, generatedAt }) {
  const localTask = findLocalTask(devProjects);
  const records = [
    issueRecord({
      sourceSystem: "github",
      sourceIssueId: "GH-216",
      issueNumber: 216,
      title: "Normalize issue intake into personal-dev task contract",
      description: "Convert GitHub issue metadata into the same task contract shape used by Plane and local issue sources.",
      issueStatus: "open",
      normalizedStatus: "next",
      priority: "p1",
      labels: ["personal-dev", "intake", "task-contract"],
      issueKind: "feature",
      sourceUrl: "https://example.invalid/hermes/issues/216",
      assignee: "codex",
      generatedAt,
    }),
    issueRecord({
      sourceSystem: "plane",
      sourceIssueId: "PLANE-HERMES-216",
      issueNumber: null,
      title: "Map Plane workflow issues to normalized personal-dev tasks",
      description: "Preserve source workflow state while emitting the same normalized task fields used by GitHub and local issue intake.",
      issueStatus: "started",
      normalizedStatus: "in-progress",
      priority: "p1",
      labels: ["plane", "workflow", "adapter"],
      issueKind: "task",
      sourceUrl: "https://example.invalid/plane/hermes/HERMES-216",
      assignee: "codex",
      generatedAt,
    }),
    issueRecord({
      sourceSystem: "local",
      sourceIssueId: localTask?.id ?? "LOCAL-HD-003",
      issueNumber: null,
      title: localTask?.title ?? "Decide whether to connect GitHub Issues or keep local JSON first",
      description: localTask?.context ?? "Local personal-dev JSON task used as the offline issue source fixture.",
      issueStatus: localTask?.status ?? "next",
      normalizedStatus: normalizeStatus(localTask?.status ?? "next"),
      priority: normalizePriority(localTask?.priority ?? "p1"),
      labels: ["local", "dev-projects", "offline-fixture"],
      issueKind: "task",
      sourceUrl: null,
      assignee: "jws",
      dueDate: localTask?.due ?? null,
      estimateMinutes: localTask?.estimate_minutes ?? null,
      generatedAt,
    }),
  ];
  return records;
}

function issueRecord({
  sourceSystem,
  sourceIssueId,
  issueNumber,
  title,
  description,
  issueStatus,
  normalizedStatus,
  priority,
  labels,
  issueKind,
  sourceUrl,
  assignee,
  dueDate = null,
  estimateMinutes = null,
  generatedAt,
}) {
  const payload = {
    source_issue_id: sourceIssueId,
    issue_number: issueNumber,
    title,
    description,
    issue_status: issueStatus,
    labels,
    priority,
    issue_kind: issueKind,
    assignee,
    due_date: dueDate,
    estimate_minutes: estimateMinutes,
  };
  const record = {
    schema_version: "issue-intake-record.v1",
    issue_record_id: `issue-intake-record.${sourceSystem}.${slugify(sourceIssueId)}`,
    issue_source_id: `issue-intake-source.${sourceSystem}`,
    source_system: sourceSystem,
    source_issue_id: sourceIssueId,
    source_issue_number: issueNumber,
    source_url: sourceUrl,
    issue_title: title,
    issue_description: description,
    issue_kind: issueKind,
    issue_status: issueStatus,
    normalized_task_status: normalizedStatus,
    priority,
    labels,
    assignee,
    due_date: dueDate,
    estimate_minutes: estimateMinutes,
    source_payload: payload,
    source_payload_hash: hashObject(payload),
    external_fetch_performed: false,
    issue_mutation_performed: false,
    issue_record_status: "normalized",
    recorded_at: generatedAt,
  };
  return {
    ...record,
    issue_record_hash: hashObject(record),
  };
}

function buildNormalizedTaskContracts({ issueRecords, repoProfileDetector, agentInstructionRegistry, generatedAt }) {
  const repoProfile = repoProfileDetector?.repo_profile ?? repoProfileDetector?.repo_profiles?.[0] ?? {};
  const instructionVersionIds = agentInstructionRegistry?.agent_instruction_versions?.map((version) => version.agent_instruction_version_id) ?? [];
  return issueRecords.map((record) => {
    const task = {
      schema_version: "normalized-task-contract.v1",
      task_contract_id: `normalized-task.${record.source_system}.${slugify(record.source_issue_id)}`,
      task_id: `task.personal-dev.${record.source_system}.${slugify(record.source_issue_id)}`,
      task_title: record.issue_title,
      task_description: record.issue_description,
      task_status: record.normalized_task_status,
      task_priority: record.priority,
      task_kind: record.issue_kind,
      pack_id: PACK_ID,
      capability_id: CAPABILITY_ID,
      repo_profile_id: repoProfile.repo_profile_id ?? null,
      repository: repoProfile.repo_root ?? null,
      primary_language_id: repoProfile.primary_language_id ?? null,
      source_system: record.source_system,
      source_issue_id: record.source_issue_id,
      source_issue_number: record.source_issue_number,
      source_url: record.source_url,
      issue_record_id: record.issue_record_id,
      labels: record.labels,
      assignee: record.assignee,
      due_date: record.due_date,
      estimate_minutes: record.estimate_minutes,
      agent_instruction_version_ids: instructionVersionIds,
      source_payload_hash: record.source_payload_hash,
      external_fetch_performed: false,
      issue_mutation_performed: false,
      command_execution_performed: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      desktop_source_of_truth: false,
      protected_mutations_require_human_gate: true,
      human_gate_required_for_execution: true,
      normalized_task_status: "ready_for_workflow",
      normalized_at: generatedAt,
    };
    return {
      ...task,
      normalized_task_hash: hashObject(task),
    };
  });
}

function buildIssueTaskBindings({ issueRecords, normalizedTasks, generatedAt }) {
  const taskByIssue = new Map(normalizedTasks.map((task) => [task.issue_record_id, task]));
  return issueRecords.map((record) => {
    const task = taskByIssue.get(record.issue_record_id);
    const binding = {
      schema_version: "issue-task-binding.v1",
      issue_task_binding_id: `issue-task-binding.${record.source_system}.${slugify(record.source_issue_id)}`,
      issue_record_id: record.issue_record_id,
      issue_source_id: record.issue_source_id,
      source_system: record.source_system,
      source_issue_id: record.source_issue_id,
      task_contract_id: task?.task_contract_id ?? null,
      task_id: task?.task_id ?? null,
      binding_status: task ? "bound" : "blocked",
      binding_rule: "one_issue_record_maps_to_one_normalized_task_contract",
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      bound_at: generatedAt,
    };
    return {
      ...binding,
      binding_hash: hashObject(binding),
    };
  });
}

function buildDesktopBoundary({ issueSources, issueRecords, generatedAt }) {
  const boundary = {
    schema_version: "issue-intake-desktop-boundary.v1",
    boundary_id: "issue-intake-desktop-boundary.personal-dev",
    pack_id: PACK_ID,
    desktop_companion_role: "operator_read_only_issue_task_status_view",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_issue_write_allowed: false,
    desktop_task_state_write_allowed: false,
    desktop_runtime_execution_allowed: false,
    desktop_source_of_truth: false,
    protected_mutations_require_human_gate: true,
    issue_mutations_require_human_gate: true,
    external_fetch_allowed: false,
    external_fetch_performed_count: issueSources.filter((source) => source.external_fetch_performed === true).length
      + issueRecords.filter((record) => record.external_fetch_performed === true).length,
    issue_mutation_allowed: false,
    issue_mutation_performed_count: issueSources.filter((source) => source.issue_mutation_performed === true).length
      + issueRecords.filter((record) => record.issue_mutation_performed === true).length,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    boundary_status: "enforced",
    recorded_at: generatedAt,
  };
  return {
    ...boundary,
    boundary_hash: hashObject(boundary),
  };
}

function buildCheckpoints({ packageJson, roadmapText, repoProfileDetector, agentInstructionRegistry, issueSources, issueRecords, normalizedTasks, issueTaskBindings, desktopBoundary }) {
  const sourceSystems = new Set(issueSources.map((source) => source.source_system));
  const taskIds = normalizedTasks.map((task) => task.task_id);
  const uniqueTaskIds = new Set(taskIds);
  const roadmapSlotPresent = typeof roadmapText === "string" && roadmapText.includes("| P216 | issue intake adapter 구현 |");
  return [
    checkpoint("repo_profile_detector_bound", repoProfileDetector?.summary?.repo_profile_detector_status === "complete", "P214 repo profile detector is complete and available."),
    checkpoint("agent_instruction_registry_bound", agentInstructionRegistry?.summary?.agent_instruction_registry_status === "complete", "P215 agent instruction registry is complete and available."),
    checkpoint("issue_sources_cover_required_systems", ["github", "plane", "local"].every((system) => sourceSystems.has(system)), "GitHub, Plane, and local issue sources are represented."),
    checkpoint("issue_records_normalized", issueRecords.length === 3 && issueRecords.every((record) => record.issue_record_status === "normalized"), `${issueRecords.length} issue record(s) are normalized.`),
    checkpoint("normalized_tasks_complete", normalizedTasks.length === issueRecords.length && normalizedTasks.every((task) => task.normalized_task_status === "ready_for_workflow" && task.pack_id === PACK_ID), `${normalizedTasks.length} normalized task contract(s) are ready for workflow use.`),
    checkpoint("issue_task_bindings_complete", issueTaskBindings.length === issueRecords.length && issueTaskBindings.every((binding) => binding.binding_status === "bound"), `${issueTaskBindings.length} issue-to-task binding(s) are bound.`),
    checkpoint("task_ids_unique", uniqueTaskIds.size === taskIds.length, "Normalized task IDs are unique across issue sources."),
    checkpoint("no_external_fetch_or_issue_mutation", desktopBoundary.external_fetch_performed_count === 0 && desktopBoundary.issue_mutation_performed_count === 0, "Issue intake performed no external fetches and no issue tracker mutations."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.desktop_read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_issue_write_allowed === false && desktopBoundary.desktop_runtime_execution_allowed === false, "Desktop companion remains read-only and cannot mutate issue or runtime state."),
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:issue-intake"]), "package.json exposes personal-dev:issue-intake."),
    checkpoint("roadmap_slot_present", roadmapSlotPresent, "P216 remains recorded in the final completion ledger."),
  ];
}

function summarizeIssueIntakeAdapter({ repoProfileDetector, agentInstructionRegistry, issueSources, issueRecords, normalizedTasks, issueTaskBindings, desktopBoundary, checkpoints, validation }) {
  const passedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length;
  const boundBindingCount = issueTaskBindings.filter((binding) => binding.binding_status === "bound").length;
  const taskIds = normalizedTasks.map((task) => task.task_id);
  const duplicateTaskIdCount = taskIds.length - new Set(taskIds).size;
  const complete = validation.valid
    && repoProfileDetector?.summary?.repo_profile_detector_status === "complete"
    && agentInstructionRegistry?.summary?.agent_instruction_registry_status === "complete"
    && issueSources.length === 3
    && issueRecords.length === 3
    && normalizedTasks.length === 3
    && boundBindingCount === issueTaskBindings.length
    && duplicateTaskIdCount === 0
    && desktopBoundary.boundary_status === "enforced";
  return {
    issue_intake_status: complete ? "complete" : "blocked",
    issue_intake_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    repo_profile_detector_status: repoProfileDetector?.summary?.repo_profile_detector_status ?? "missing",
    agent_instruction_registry_status: agentInstructionRegistry?.summary?.agent_instruction_registry_status ?? "missing",
    issue_source_count: issueSources.length,
    github_issue_source_count: issueSources.filter((source) => source.source_system === "github").length,
    plane_issue_source_count: issueSources.filter((source) => source.source_system === "plane").length,
    local_issue_source_count: issueSources.filter((source) => source.source_system === "local").length,
    issue_record_count: issueRecords.length,
    normalized_issue_record_count: issueRecords.filter((record) => record.issue_record_status === "normalized").length,
    github_issue_record_count: issueRecords.filter((record) => record.source_system === "github").length,
    plane_issue_record_count: issueRecords.filter((record) => record.source_system === "plane").length,
    local_issue_record_count: issueRecords.filter((record) => record.source_system === "local").length,
    normalized_task_count: normalizedTasks.length,
    ready_normalized_task_count: normalizedTasks.filter((task) => task.normalized_task_status === "ready_for_workflow").length,
    issue_task_binding_count: issueTaskBindings.length,
    bound_issue_task_binding_count: boundBindingCount,
    unbound_issue_task_binding_count: issueTaskBindings.length - boundBindingCount,
    unresolved_issue_count: issueRecords.length - boundBindingCount,
    duplicate_task_id_count: duplicateTaskIdCount,
    external_fetch_performed_count: desktopBoundary.external_fetch_performed_count,
    issue_mutation_performed_count: desktopBoundary.issue_mutation_performed_count,
    command_execution_performed_count: normalizedTasks.filter((task) => task.command_execution_performed === true).length,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: desktopBoundary.desktop_read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_issue_write_allowed: desktopBoundary.desktop_issue_write_allowed,
    desktop_task_state_write_allowed: desktopBoundary.desktop_task_state_write_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.desktop_runtime_execution_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    protected_mutations_require_human_gate: desktopBoundary.protected_mutations_require_human_gate,
    issue_mutations_require_human_gate: desktopBoundary.issue_mutations_require_human_gate,
    external_fetch_allowed: desktopBoundary.external_fetch_allowed,
    raw_secret_material_exposed: desktopBoundary.raw_secret_material_exposed,
    provider_key_exposed: desktopBoundary.provider_key_exposed,
    installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: passedCheckpointCount,
    failed_checkpoint_count: checkpoints.length - passedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_source_system: countBy(issueRecords, "source_system"),
    by_issue_status: countBy(issueRecords, "issue_status"),
    by_task_status: countBy(normalizedTasks, "task_status"),
    by_binding_status: countBy(issueTaskBindings, "binding_status"),
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    external_fetch_allowed: false,
    external_fetch_performed: false,
    issue_mutation_allowed: false,
    issue_mutation_performed: false,
    task_state_mutation_allowed: false,
    task_state_mutation_performed: false,
    runtime_execution_performed: false,
    protected_mutation_executed: false,
    desktop_mutation_allowed: false,
    desktop_issue_write_allowed: false,
    desktop_task_state_write_allowed: false,
    desktop_runtime_execution_allowed: false,
    desktop_source_of_truth: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, devProjects, repoProfileDetector, agentInstructionRegistry }) {
  return {
    package_json: sourceContractFromRead(packageJson),
    roadmap: sourceContractFromRead(roadmapText),
    dev_projects: sourceContractFromRead(devProjects),
    repo_profile_detector: sourceContractFromRead(repoProfileDetector),
    agent_instruction_registry: sourceContractFromRead(agentInstructionRegistry),
  };
}

function findLocalTask(devProjects) {
  const tasks = (devProjects?.projects ?? []).flatMap((project) => (project.tasks ?? []).map((task) => ({ ...task, project_id: project.id, repository: project.repository })));
  return tasks.find((task) => task.id === "HD-003") ?? tasks[0] ?? null;
}

function normalizeStatus(status) {
  if (status === "in-progress" || status === "started") return "in-progress";
  if (status === "review") return "review";
  if (status === "blocked") return "blocked";
  if (status === "done" || status === "closed") return "done";
  return "next";
}

function normalizePriority(priority) {
  if (["p0", "p1", "p2", "p3"].includes(priority)) return priority;
  if (priority === "urgent" || priority === "critical") return "p0";
  if (priority === "high") return "p1";
  if (priority === "low") return "p3";
  return "p2";
}

function sourceContractFromRead(read) {
  return {
    schema_version: read.value?.schema_version ?? null,
    path: read.path,
    available: read.available,
    content_hash: read.content_hash,
    error: read.error,
  };
}

async function readJsonOrError(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, value: JSON.parse(text), content_hash: hashValue(text), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, value: null, content_hash: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, value: text, content_hash: hashValue(text), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, value: null, content_hash: null, error: error.message };
  }
}

function normalizeInputs(options) {
  const merged = { ...DEFAULT_ISSUE_INTAKE_ADAPTER_INPUTS, ...options };
  return {
    repo_root: merged.repoRoot,
    dev_projects_path: merged.devProjectsPath,
    agent_instruction_registry_path: merged.agentInstructionRegistryPath,
    repo_profile_detector_path: merged.repoProfileDetectorPath,
    package_path: merged.packagePath,
    roadmap_path: merged.roadmapPath,
  };
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
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--dev-projects") parsed.devProjectsPath = argv[++index];
    else if (arg === "--agent-instruction-registry") parsed.agentInstructionRegistryPath = argv[++index];
    else if (arg === "--repo-profile-detector") parsed.repoProfileDetectorPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/issue-intake-adapter.mjs [options]

Options:
  --check                               Fail when validation does not pass
  --no-write                            Build without writing artifacts
  --out-dir <path>                      Output directory
  --repo-root <path>                    Repository root to inspect
  --dev-projects <path>                 Local dev project task fixture path
  --agent-instruction-registry <path>   P215 agent instruction registry artifact
  --repo-profile-detector <path>        P214 repo profile detector artifact
  --package <path>                      package.json path relative to repo root
  --roadmap <path>                      final completion ledger path relative to repo root
`);
}

function renderIssueIntakeAdapterMarkdown(result) {
  const lines = [];
  lines.push("# Issue Intake Adapter");
  lines.push("");
  lines.push(`Status: ${result.summary.issue_intake_status}`);
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  for (const source of result.issue_intake_sources) {
    lines.push(`- ${source.source_system}: ${source.source_status}, ${source.source_read_mode}`);
  }
  lines.push("");
  lines.push("## Normalized Tasks");
  lines.push("");
  for (const task of result.normalized_task_contracts) {
    lines.push(`- ${task.task_id}: ${task.task_status}, ${task.task_priority}, source ${task.source_system}/${task.source_issue_id}`);
  }
  lines.push("");
  lines.push("## Desktop Boundary");
  lines.push("");
  lines.push(`- Read only: ${result.summary.desktop_read_only}`);
  lines.push(`- Issue write allowed: ${result.summary.desktop_issue_write_allowed}`);
  lines.push(`- Runtime execution allowed: ${result.summary.desktop_runtime_execution_allowed}`);
  lines.push("");
  lines.push("## Checkpoints");
  lines.push("");
  for (const checkpointItem of result.issue_intake_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status} - ${checkpointItem.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableIssueIntakeAdapter(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "issue-intake-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message ?? "Validation item failed." }));
  return { valid: errors.length === 0, errors };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashObject(value) {
  return hashValue(JSON.stringify(value));
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
