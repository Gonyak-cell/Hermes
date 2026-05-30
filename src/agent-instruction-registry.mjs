import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_AGENT_INSTRUCTION_REGISTRY_OUT_DIR = "artifacts/agent-instruction-registry/latest";
export const DEFAULT_AGENT_INSTRUCTION_REGISTRY_INPUTS = {
  repoRoot: ".",
  agentsPath: "AGENTS.md",
  claudePath: "CLAUDE.md",
  codexPath: "Codex.md",
  codexUpperPath: "CODEX.md",
  repoProfileDetectorPath: "artifacts/repo-profile-detector/latest/repo-profile-detector.json",
  hermesRuntimeAdapterPath: "artifacts/hermes-runtime-adapter/latest/hermes-runtime-adapter.json",
  claudeCodeAdapterPath: "artifacts/claude-code-adapter-contract/latest/claude-code-adapter-contract.json",
  codexAdapterPath: "artifacts/codex-adapter-contract/latest/codex-adapter-contract.json",
  localScriptAdapterPath: "artifacts/local-script-adapter/latest/local-script-adapter.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "agent-instruction-registry.v1";
const PACK_ID = "personal-dev";
const SOURCE_OF_TRUTH = "repository_agent_instruction_files";
const DESKTOP_SURFACE_POLICY = "read_only_operator_surface";

export async function runAgentInstructionRegistry(options = {}) {
  const result = await buildAgentInstructionRegistry(options);
  if (options.write !== false) await writeAgentInstructionRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Agent instruction registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAgentInstructionRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AGENT_INSTRUCTION_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const sourceReads = await readInstructionSourceReads(inputs, repoRoot);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const repoProfileDetector = await readJsonOrError(inputs.repo_profile_detector_path);
  const runtimeAdapters = {
    hermes: await readJsonOrError(inputs.hermes_runtime_adapter_path),
    claude_code: await readJsonOrError(inputs.claude_code_adapter_path),
    codex: await readJsonOrError(inputs.codex_adapter_path),
    local_script: await readJsonOrError(inputs.local_script_adapter_path),
  };
  const instructionSources = buildInstructionSources({ sourceReads, generatedAt });
  const instructionVersions = buildInstructionVersions({ instructionSources, generatedAt });
  const instructionSections = buildInstructionSections({ instructionSources, agentsText: sourceReads.agents.value ?? "", generatedAt });
  const runtimeBindings = buildRuntimeBindings({ instructionSources, instructionVersions, runtimeAdapters, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ runtimeBindings, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    repoProfileDetector: repoProfileDetector.value,
    runtimeAdapters,
    instructionSources,
    instructionVersions,
    runtimeBindings,
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
  const summary = summarizeAgentInstructionRegistry({
    repoProfileDetector: repoProfileDetector.value,
    instructionSources,
    instructionVersions,
    instructionSections,
    runtimeBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    agent_instruction_registry_id: `agent-instruction-registry.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    agent_instruction_registry_status: summary.agent_instruction_registry_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ sourceReads, packageJson, roadmapText, repoProfileDetector, runtimeAdapters }),
    agent_instruction_registry_contract: buildContract(generatedAt),
    agent_instruction_sources: instructionSources,
    agent_instruction_versions: instructionVersions,
    runtime_instruction_bindings: runtimeBindings,
    agent_instruction_sections: instructionSections,
    agent_instruction_desktop_boundary: desktopBoundary,
    agent_instruction_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderAgentInstructionRegistryMarkdown(result),
  };
}

export async function writeAgentInstructionRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableAgentInstructionRegistry(result);
  await writeJson(path.join(outDir, "agent-instruction-registry.json"), serializable);
  await writeJson(path.join(outDir, "agent-instruction-sources.json"), {
    schema_version: "agent-instruction-sources.v1",
    generated_at: result.generated_at,
    agent_instruction_source_count: result.agent_instruction_sources.length,
    agent_instruction_sources: result.agent_instruction_sources,
  });
  await writeJson(path.join(outDir, "agent-instruction-versions.json"), {
    schema_version: "agent-instruction-versions.v1",
    generated_at: result.generated_at,
    agent_instruction_version_count: result.agent_instruction_versions.length,
    agent_instruction_versions: result.agent_instruction_versions,
  });
  await writeJson(path.join(outDir, "runtime-instruction-bindings.json"), {
    schema_version: "runtime-instruction-bindings.v1",
    generated_at: result.generated_at,
    runtime_instruction_binding_count: result.runtime_instruction_bindings.length,
    runtime_instruction_bindings: result.runtime_instruction_bindings,
  });
  await writeJson(path.join(outDir, "agent-instruction-sections.json"), {
    schema_version: "agent-instruction-sections.v1",
    generated_at: result.generated_at,
    agent_instruction_section_count: result.agent_instruction_sections.length,
    agent_instruction_sections: result.agent_instruction_sections,
  });
  await writeJson(path.join(outDir, "agent-instruction-desktop-boundary.json"), {
    schema_version: "agent-instruction-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    agent_instruction_desktop_boundary: result.agent_instruction_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "agent-instruction-registry-validation-report.v1",
    generated_at: result.generated_at,
    agent_instruction_registry_id: result.agent_instruction_registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAgentInstructionRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runAgentInstructionRegistry(args);
    console.log(`Agent instruction registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.agent_instruction_registry_status}`);
    console.log(`Instruction versions: ${result.summary.instruction_version_count}`);
    console.log(`Runtime bindings: ${result.summary.runtime_instruction_binding_count}`);
    console.log(`Applied agent runtimes: ${result.summary.agent_runtime_instruction_applied_count}`);
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
    schema_version: "agent-instruction-registry-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    registry_rule: "track_repository_agent_instruction_sources_versions_and_runtime_bindings_without_mutating_instruction_files",
    version_rule: "instruction_versions_are_content_hash_locked_and_bound_to_runtime_ids",
    runtime_rule: "hermes_claude_code_and_codex_receive_explicit_agent_instruction_bindings_while_local_script_is_tracked_as_deterministic_no_prompt",
    desktop_companion_rule: "desktop_companion_reads_instruction_versions_and_runtime_binding_status_only",
    mutation_policy: "instruction_file_writes_runtime_execution_and_protected_mutations_require_human_gate_and_are_not_executed_by_this_artifact",
    created_at: generatedAt,
  };
}

function buildInstructionSources({ sourceReads, generatedAt }) {
  const agentsRead = sourceReads.agents;
  const claudeRead = sourceReads.claude;
  const codexRead = sourceReads.codex.available || !sourceReads.codexUpper.available ? sourceReads.codex : sourceReads.codexUpper;
  const agentsSource = sourceRecord({
    kind: "agents",
    displayName: "AGENTS.md",
    filePath: agentsRead.path,
    read: agentsRead,
    status: agentsRead.available ? "present" : "missing",
    appliesToRuntimeIds: ["hermes", "claude_code", "codex"],
    generatedAt,
  });
  const claudeSource = sourceRecord({
    kind: "claude_code",
    displayName: "CLAUDE.md",
    filePath: claudeRead.path,
    read: claudeRead.available ? claudeRead : agentsRead,
    status: claudeRead.available ? "present" : "derived_from_agents",
    derivedFromSourceId: claudeRead.available ? null : agentsSource.agent_instruction_source_id,
    sourceFilePresent: claudeRead.available,
    declaredPath: claudeRead.path,
    appliesToRuntimeIds: ["claude_code"],
    generatedAt,
  });
  const codexSource = sourceRecord({
    kind: "codex",
    displayName: codexRead.path.endsWith("CODEX.md") ? "CODEX.md" : "Codex.md",
    filePath: codexRead.path,
    read: codexRead.available ? codexRead : agentsRead,
    status: codexRead.available ? "present" : "derived_from_agents",
    derivedFromSourceId: codexRead.available ? null : agentsSource.agent_instruction_source_id,
    sourceFilePresent: codexRead.available,
    declaredPath: codexRead.path,
    appliesToRuntimeIds: ["codex"],
    generatedAt,
  });
  return [agentsSource, claudeSource, codexSource];
}

function sourceRecord({
  kind,
  displayName,
  filePath,
  read,
  status,
  derivedFromSourceId = null,
  sourceFilePresent = read.available,
  declaredPath = filePath,
  appliesToRuntimeIds,
  generatedAt,
}) {
  const text = read.value ?? "";
  const sectionNames = extractMarkdownSections(text).map((section) => section.section_title);
  const contentHash = read.content_hash ?? hashValue("");
  const record = {
    schema_version: "agent-instruction-source.v1",
    agent_instruction_source_id: `agent-instruction-source.${kind}`,
    instruction_kind: kind,
    display_name: displayName,
    declared_path: declaredPath,
    resolved_path: filePath,
    source_file_present: sourceFilePresent,
    instruction_source_status: status,
    derived_from_source_id: derivedFromSourceId,
    content_hash: contentHash,
    instruction_version_id: `agent-instruction-version.${kind}.${shortHash(contentHash)}`,
    instruction_version: shortHash(contentHash),
    line_count: text ? text.split(/\r?\n/).length : 0,
    section_count: sectionNames.length,
    section_names: sectionNames,
    applies_to_runtime_ids: appliesToRuntimeIds,
    write_allowed: false,
    mutation_allowed: false,
    runtime_execution_allowed: false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    source_of_truth: status === "present" ? "repository_file" : "derived_from_agents_md",
    source_status: status === "missing" ? "blocked" : "locked",
    recorded_at: generatedAt,
  };
  return {
    ...record,
    source_hash: hashObject(record),
  };
}

function buildInstructionVersions({ instructionSources, generatedAt }) {
  return instructionSources
    .filter((source) => source.instruction_source_status !== "missing")
    .map((source) => {
      const version = {
        schema_version: "agent-instruction-version.v1",
        agent_instruction_version_id: source.instruction_version_id,
        instruction_source_id: source.agent_instruction_source_id,
        instruction_kind: source.instruction_kind,
        instruction_version: source.instruction_version,
        content_hash: source.content_hash,
        version_status: "locked",
        source_file_present: source.source_file_present,
        derived_from_source_id: source.derived_from_source_id,
        applies_to_runtime_ids: source.applies_to_runtime_ids,
        runtime_binding_count: source.applies_to_runtime_ids.length,
        supersedes_version_id: null,
        mutation_allowed: false,
        desktop_read_only: true,
        desktop_mutation_allowed: false,
        locked_at: generatedAt,
      };
      return {
        ...version,
        version_hash: hashObject(version),
      };
    });
}

function buildInstructionSections({ instructionSources, agentsText, generatedAt }) {
  const agentsSource = instructionSources.find((source) => source.instruction_kind === "agents");
  if (!agentsSource || agentsSource.instruction_source_status === "missing") return [];
  return extractMarkdownSections(agentsText).map((section, index) => {
    const item = {
      schema_version: "agent-instruction-section.v1",
      agent_instruction_section_id: `agent-instruction-section.agents.${slugify(section.section_title || `section-${index + 1}`)}`,
      instruction_source_id: agentsSource.agent_instruction_source_id,
      instruction_version_id: agentsSource.instruction_version_id,
      section_index: index,
      section_title: section.section_title,
      section_level: section.section_level,
      section_status: "tracked",
      content_hash: hashValue(section.content),
      recorded_at: generatedAt,
    };
    return {
      ...item,
      section_hash: hashObject(item),
    };
  });
}

function buildRuntimeBindings({ instructionSources, instructionVersions, runtimeAdapters, generatedAt }) {
  const versionByKind = new Map(instructionVersions.map((version) => [version.instruction_kind, version]));
  const sourceByKind = new Map(instructionSources.map((source) => [source.instruction_kind, source]));
  const agentsVersion = versionByKind.get("agents");
  const bindings = [
    runtimeBinding({
      runtimeId: "hermes",
      runtimeKind: "agent_runtime",
      adapterRead: runtimeAdapters.hermes,
      adapterStatusField: "hermes_runtime_adapter_status",
      instructionSource: sourceByKind.get("agents"),
      instructionVersion: agentsVersion,
      applicationStatus: "applied",
      deliveryMode: "stdin_context_bootstrap",
      generatedAt,
    }),
    runtimeBinding({
      runtimeId: "claude_code",
      runtimeKind: "agent_runtime",
      adapterRead: runtimeAdapters.claude_code,
      adapterStatusField: "claude_code_adapter_contract_status",
      instructionSource: sourceByKind.get("claude_code"),
      instructionVersion: versionByKind.get("claude_code"),
      applicationStatus: "applied",
      deliveryMode: "derived_agents_context",
      generatedAt,
    }),
    runtimeBinding({
      runtimeId: "codex",
      runtimeKind: "agent_runtime",
      adapterRead: runtimeAdapters.codex,
      adapterStatusField: "codex_adapter_contract_status",
      instructionSource: sourceByKind.get("codex"),
      instructionVersion: versionByKind.get("codex"),
      applicationStatus: "applied",
      deliveryMode: "derived_agents_context",
      generatedAt,
    }),
    runtimeBinding({
      runtimeId: "local_script",
      runtimeKind: "deterministic_runtime",
      adapterRead: runtimeAdapters.local_script,
      adapterStatusField: "local_script_adapter_status",
      instructionSource: sourceByKind.get("agents"),
      instructionVersion: agentsVersion,
      applicationStatus: "tracked_not_prompted",
      deliveryMode: "none_deterministic_runtime",
      generatedAt,
    }),
  ];
  return bindings;
}

function runtimeBinding({ runtimeId, runtimeKind, adapterRead, adapterStatusField, instructionSource, instructionVersion, applicationStatus, deliveryMode, generatedAt }) {
  const adapterSummary = adapterRead.value?.summary ?? {};
  const adapterComplete = adapterRead.available && adapterSummary[adapterStatusField] === "complete";
  const hasInstructionVersion = Boolean(instructionVersion?.agent_instruction_version_id);
  const bindingStatus = adapterComplete && hasInstructionVersion ? "bound" : "blocked";
  const binding = {
    schema_version: "runtime-instruction-binding.v1",
    runtime_instruction_binding_id: `runtime-instruction-binding.${runtimeId}`,
    runtime_id: runtimeId,
    runtime_kind: runtimeKind,
    adapter_status: adapterSummary[adapterStatusField] ?? "missing",
    adapter_source_path: adapterRead.path,
    instruction_source_id: instructionSource?.agent_instruction_source_id ?? null,
    instruction_kind: instructionSource?.instruction_kind ?? null,
    instruction_source_status: instructionSource?.instruction_source_status ?? "missing",
    instruction_version_id: instructionVersion?.agent_instruction_version_id ?? null,
    instruction_version: instructionVersion?.instruction_version ?? null,
    instruction_content_hash: instructionVersion?.content_hash ?? null,
    instruction_application_status: applicationStatus,
    instruction_delivery_mode: deliveryMode,
    instruction_applied_to_runtime: applicationStatus === "applied",
    deterministic_runtime_tracked: applicationStatus === "tracked_not_prompted",
    prompt_delivery: runtimeId === "local_script" ? "none" : "stdin",
    output_trust: adapterSummary.output_trust ?? null,
    verification_required: adapterSummary.verification_required ?? false,
    execute_requires_human_gate: adapterSummary.execute_requires_human_gate ?? runtimeId !== "local_script",
    direct_apply_allowed: adapterSummary.direct_apply_allowed ?? false,
    direct_merge_allowed: adapterSummary.direct_merge_allowed ?? false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    runtime_execution_performed: false,
    instruction_write_allowed: false,
    binding_status: bindingStatus,
    bound_at: generatedAt,
  };
  return {
    ...binding,
    binding_hash: hashObject(binding),
  };
}

function buildDesktopBoundary({ runtimeBindings, generatedAt }) {
  const boundary = {
    schema_version: "agent-instruction-desktop-boundary.v1",
    boundary_id: "agent-instruction-desktop-boundary.personal-dev",
    pack_id: PACK_ID,
    desktop_companion_role: "operator_read_only_instruction_status_view",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_instruction_write_allowed: false,
    desktop_runtime_execution_allowed: false,
    desktop_source_of_truth: false,
    protected_mutations_require_human_gate: true,
    instruction_file_mutation_requires_human_gate: true,
    runtime_instruction_binding_count: runtimeBindings.length,
    runtime_execution_performed_count: runtimeBindings.filter((binding) => binding.runtime_execution_performed === true).length,
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

function buildCheckpoints({ packageJson, roadmapText, repoProfileDetector, runtimeAdapters, instructionSources, instructionVersions, runtimeBindings, desktopBoundary }) {
  const sourceByKind = new Map(instructionSources.map((source) => [source.instruction_kind, source]));
  const bindingByRuntime = new Map(runtimeBindings.map((binding) => [binding.runtime_id, binding]));
  const adapterStatuses = Object.values(runtimeAdapters).map((read) => read.value?.summary ?? {});
  const roadmapSlotPresent = typeof roadmapText === "string" && roadmapText.includes("| P215 | agent instruction registry 구현 |");
  return [
    checkpoint("repo_profile_detector_bound", repoProfileDetector?.summary?.repo_profile_detector_status === "complete", "P214 repo profile detector is complete and available."),
    checkpoint("agents_instruction_present", sourceByKind.get("agents")?.instruction_source_status === "present", "AGENTS.md is present and content-hash locked."),
    checkpoint("claude_instruction_tracked", ["present", "derived_from_agents"].includes(sourceByKind.get("claude_code")?.instruction_source_status), "Claude Code instruction source is present or explicitly derived from AGENTS.md."),
    checkpoint("codex_instruction_tracked", ["present", "derived_from_agents"].includes(sourceByKind.get("codex")?.instruction_source_status), "Codex instruction source is present or explicitly derived from AGENTS.md."),
    checkpoint("instruction_versions_locked", instructionVersions.length >= 3 && instructionVersions.every((version) => version.version_status === "locked" && version.content_hash), `${instructionVersions.length} instruction version(s) are content-hash locked.`),
    checkpoint("agent_runtime_bindings_applied", ["hermes", "claude_code", "codex"].every((runtimeId) => bindingByRuntime.get(runtimeId)?.instruction_application_status === "applied" && bindingByRuntime.get(runtimeId)?.binding_status === "bound"), "Hermes, Claude Code, and Codex runtime instruction bindings are applied."),
    checkpoint("local_script_instruction_tracked", bindingByRuntime.get("local_script")?.instruction_application_status === "tracked_not_prompted" && bindingByRuntime.get("local_script")?.prompt_delivery === "none", "local_script runtime is tracked as deterministic and no-prompt."),
    checkpoint("runtime_adapters_complete", adapterStatuses.every((summary) => Object.values(summary).includes("complete")) && runtimeBindings.every((binding) => binding.binding_status === "bound"), "Runtime adapter summaries are complete and bound to instruction records."),
    checkpoint("no_instruction_runtime_execution", runtimeBindings.every((binding) => binding.runtime_execution_performed === false), "Instruction registry did not execute runtime commands."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.desktop_read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_instruction_write_allowed === false && desktopBoundary.desktop_runtime_execution_allowed === false, "Desktop companion remains read-only and cannot write instruction files or execute runtimes."),
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:instructions"]), "package.json exposes personal-dev:instructions."),
    checkpoint("roadmap_slot_present", roadmapSlotPresent, "P215 remains recorded in the final completion ledger."),
  ];
}

function summarizeAgentInstructionRegistry({ repoProfileDetector, instructionSources, instructionVersions, instructionSections, runtimeBindings, desktopBoundary, checkpoints, validation }) {
  const passedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length;
  const agentRuntimeBindings = runtimeBindings.filter((binding) => binding.runtime_kind === "agent_runtime");
  const complete = validation.valid
    && repoProfileDetector?.summary?.repo_profile_detector_status === "complete"
    && instructionSources.some((source) => source.instruction_kind === "agents" && source.instruction_source_status === "present")
    && instructionVersions.length >= 3
    && agentRuntimeBindings.length === 3
    && agentRuntimeBindings.every((binding) => binding.instruction_application_status === "applied" && binding.binding_status === "bound")
    && runtimeBindings.some((binding) => binding.runtime_id === "local_script" && binding.instruction_application_status === "tracked_not_prompted")
    && runtimeBindings.every((binding) => binding.runtime_execution_performed === false)
    && desktopBoundary.boundary_status === "enforced";
  return {
    agent_instruction_registry_status: complete ? "complete" : "blocked",
    agent_instruction_registry_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    repo_profile_detector_status: repoProfileDetector?.summary?.repo_profile_detector_status ?? "missing",
    instruction_source_count: instructionSources.length,
    present_instruction_source_count: instructionSources.filter((source) => source.instruction_source_status === "present").length,
    derived_instruction_source_count: instructionSources.filter((source) => source.instruction_source_status === "derived_from_agents").length,
    missing_instruction_source_count: instructionSources.filter((source) => source.instruction_source_status === "missing").length,
    instruction_version_count: instructionVersions.length,
    locked_instruction_version_count: instructionVersions.filter((version) => version.version_status === "locked").length,
    instruction_section_count: instructionSections.length,
    runtime_instruction_binding_count: runtimeBindings.length,
    bound_runtime_instruction_binding_count: runtimeBindings.filter((binding) => binding.binding_status === "bound").length,
    agent_runtime_instruction_binding_count: agentRuntimeBindings.length,
    agent_runtime_instruction_applied_count: agentRuntimeBindings.filter((binding) => binding.instruction_application_status === "applied").length,
    deterministic_runtime_tracked_count: runtimeBindings.filter((binding) => binding.instruction_application_status === "tracked_not_prompted").length,
    runtime_execution_performed_count: runtimeBindings.filter((binding) => binding.runtime_execution_performed === true).length,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: desktopBoundary.desktop_read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_instruction_write_allowed: desktopBoundary.desktop_instruction_write_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.desktop_runtime_execution_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    protected_mutations_require_human_gate: desktopBoundary.protected_mutations_require_human_gate,
    instruction_file_mutation_requires_human_gate: desktopBoundary.instruction_file_mutation_requires_human_gate,
    raw_secret_material_exposed: desktopBoundary.raw_secret_material_exposed,
    provider_key_exposed: desktopBoundary.provider_key_exposed,
    installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: passedCheckpointCount,
    failed_checkpoint_count: checkpoints.length - passedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_instruction_source_status: countBy(instructionSources, "instruction_source_status"),
    by_runtime_binding_status: countBy(runtimeBindings, "binding_status"),
    by_instruction_application_status: countBy(runtimeBindings, "instruction_application_status"),
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    instruction_file_mutation_allowed: false,
    runtime_execution_performed: false,
    protected_mutation_executed: false,
    desktop_mutation_allowed: false,
    desktop_instruction_write_allowed: false,
    desktop_runtime_execution_allowed: false,
    desktop_source_of_truth: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
  };
}

function buildSourceContracts({ sourceReads, packageJson, roadmapText, repoProfileDetector, runtimeAdapters }) {
  return {
    agents_md: sourceContractFromRead(sourceReads.agents),
    claude_md: sourceContractFromRead(sourceReads.claude),
    codex_md: sourceContractFromRead(sourceReads.codex.available ? sourceReads.codex : sourceReads.codexUpper),
    package_json: sourceContractFromRead(packageJson),
    roadmap: sourceContractFromRead(roadmapText),
    repo_profile_detector: sourceContractFromRead(repoProfileDetector),
    hermes_runtime_adapter: sourceContractFromRead(runtimeAdapters.hermes),
    claude_code_adapter: sourceContractFromRead(runtimeAdapters.claude_code),
    codex_adapter: sourceContractFromRead(runtimeAdapters.codex),
    local_script_adapter: sourceContractFromRead(runtimeAdapters.local_script),
  };
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

async function readInstructionSourceReads(inputs, repoRoot) {
  return {
    agents: await readTextOrError(path.resolve(repoRoot, inputs.agents_path)),
    claude: await readTextOrError(path.resolve(repoRoot, inputs.claude_path)),
    codex: await readTextOrError(path.resolve(repoRoot, inputs.codex_path)),
    codexUpper: await readTextOrError(path.resolve(repoRoot, inputs.codex_upper_path)),
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
  const merged = { ...DEFAULT_AGENT_INSTRUCTION_REGISTRY_INPUTS, ...options };
  return {
    repo_root: merged.repoRoot,
    agents_path: merged.agentsPath,
    claude_path: merged.claudePath,
    codex_path: merged.codexPath,
    codex_upper_path: merged.codexUpperPath,
    repo_profile_detector_path: merged.repoProfileDetectorPath,
    hermes_runtime_adapter_path: merged.hermesRuntimeAdapterPath,
    claude_code_adapter_path: merged.claudeCodeAdapterPath,
    codex_adapter_path: merged.codexAdapterPath,
    local_script_adapter_path: merged.localScriptAdapterPath,
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
    else if (arg === "--agents") parsed.agentsPath = argv[++index];
    else if (arg === "--claude") parsed.claudePath = argv[++index];
    else if (arg === "--codex") parsed.codexPath = argv[++index];
    else if (arg === "--repo-profile-detector") parsed.repoProfileDetectorPath = argv[++index];
    else if (arg === "--hermes-runtime-adapter") parsed.hermesRuntimeAdapterPath = argv[++index];
    else if (arg === "--claude-code-adapter") parsed.claudeCodeAdapterPath = argv[++index];
    else if (arg === "--codex-adapter") parsed.codexAdapterPath = argv[++index];
    else if (arg === "--local-script-adapter") parsed.localScriptAdapterPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-instruction-registry.mjs [options]

Options:
  --check                         Fail when validation does not pass
  --no-write                      Build without writing artifacts
  --out-dir <path>                Output directory
  --repo-root <path>              Repository root to inspect
  --agents <path>                 AGENTS.md path relative to repo root
  --claude <path>                 CLAUDE.md path relative to repo root
  --codex <path>                  Codex.md path relative to repo root
  --repo-profile-detector <path>  P214 repo profile detector artifact
  --hermes-runtime-adapter <path> Hermes runtime adapter artifact
  --claude-code-adapter <path>    Claude Code adapter artifact
  --codex-adapter <path>          Codex adapter artifact
  --local-script-adapter <path>   Local script adapter artifact
  --package <path>                package.json path relative to repo root
  --roadmap <path>                final completion ledger path relative to repo root
`);
}

function renderAgentInstructionRegistryMarkdown(result) {
  const lines = [];
  lines.push("# Agent Instruction Registry");
  lines.push("");
  lines.push(`Status: ${result.summary.agent_instruction_registry_status}`);
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  for (const source of result.agent_instruction_sources) {
    lines.push(`- ${source.display_name}: ${source.instruction_source_status}, version ${source.instruction_version}`);
  }
  lines.push("");
  lines.push("## Runtime Bindings");
  lines.push("");
  for (const binding of result.runtime_instruction_bindings) {
    lines.push(`- ${binding.runtime_id}: ${binding.binding_status}, ${binding.instruction_application_status}, version ${binding.instruction_version}`);
  }
  lines.push("");
  lines.push("## Desktop Boundary");
  lines.push("");
  lines.push(`- Read only: ${result.summary.desktop_read_only}`);
  lines.push(`- Instruction write allowed: ${result.summary.desktop_instruction_write_allowed}`);
  lines.push(`- Runtime execution allowed: ${result.summary.desktop_runtime_execution_allowed}`);
  lines.push("");
  lines.push("## Checkpoints");
  lines.push("");
  for (const checkpointItem of result.agent_instruction_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status} - ${checkpointItem.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableAgentInstructionRegistry(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "agent-instruction-checkpoint.v1",
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

function extractMarkdownSections(text) {
  const sections = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = {
        section_level: match[1].length,
        section_title: match[2].trim(),
        content: line,
      };
    } else if (current) {
      current.content += `\n${line}`;
    }
  }
  if (current) sections.push(current);
  return sections;
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

function shortHash(value) {
  return String(value).replace(/^sha256:/, "").slice(0, 16);
}

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value).replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}
