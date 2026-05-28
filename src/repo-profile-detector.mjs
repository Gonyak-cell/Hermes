import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REPO_PROFILE_DETECTOR_OUT_DIR = "artifacts/repo-profile-detector/latest";
export const DEFAULT_REPO_PROFILE_DETECTOR_INPUTS = {
  repoRoot: ".",
  personalDevPackManifestPath: "artifacts/personal-dev-pack-manifest/latest/personal-dev-pack-manifest.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "repo-profile-detector.v1";
const PACK_ID = "personal-dev";
const SOURCE_OF_TRUTH = "repository_files_and_package_scripts";
const DESKTOP_SURFACE_POLICY = "read_only_operator_surface";
const IGNORED_DIRS = new Set([
  ".git",
  ".cache",
  ".next",
  ".turbo",
  "artifacts",
  "audits",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "temp",
  "tmp",
]);

const LANGUAGE_BY_EXTENSION = new Map([
  [".mjs", "javascript"],
  [".js", "javascript"],
  [".cjs", "javascript"],
  [".json", "json"],
  [".schema.json", "json_schema"],
  [".md", "markdown"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".txt", "text"],
]);

export async function runRepoProfileDetector(options = {}) {
  const result = await buildRepoProfileDetector(options);
  if (options.write !== false) await writeRepoProfileDetector(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Repo profile detector validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRepoProfileDetector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REPO_PROFILE_DETECTOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const personalDevPackManifest = await readJsonOrError(inputs.personal_dev_pack_manifest_path);
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const repoFiles = await listRepoFiles(repoRoot);
  const detectionSignals = buildDetectionSignals({ repoRoot, repoFiles, packageJson: packageJson.value });
  const languageProfiles = buildLanguageProfiles(repoFiles, detectionSignals);
  const commandProfiles = buildCommandProfiles(packageJson.value);
  const frameworkProfiles = buildFrameworkProfiles({ repoFiles, packageJson: packageJson.value, commandProfiles });
  const repoProfile = buildRepoProfile({
    generatedAt,
    inputs,
    repoRoot,
    packageJson,
    repoFiles,
    languageProfiles,
    frameworkProfiles,
    commandProfiles,
  });
  const desktopBoundary = buildDesktopBoundary({ generatedAt, commandProfiles });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    personalDevPackManifest: personalDevPackManifest.value,
    roadmapText: roadmapText.value,
    repoFiles,
    languageProfiles,
    frameworkProfiles,
    commandProfiles,
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
  const summary = summarizeRepoProfileDetector({
    personalDevPackManifest: personalDevPackManifest.value,
    repoFiles,
    languageProfiles,
    frameworkProfiles,
    commandProfiles,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    repo_profile_detector_id: `repo-profile-detector.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    repo_profile_detector_status: summary.repo_profile_detector_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, personalDevPackManifest, roadmapText, repoRoot, repoFiles }),
    repo_profile_detector_contract: buildContract(generatedAt),
    repo_profile: repoProfile,
    repo_profiles: [repoProfile],
    language_profiles: languageProfiles,
    framework_profiles: frameworkProfiles,
    repo_command_profiles: commandProfiles,
    repo_detection_signals: detectionSignals,
    repo_profile_desktop_boundary: desktopBoundary,
    repo_profile_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderRepoProfileDetectorMarkdown(result),
  };
}

export async function writeRepoProfileDetector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableRepoProfileDetector(result);
  await writeJson(path.join(outDir, "repo-profile-detector.json"), serializable);
  await writeJson(path.join(outDir, "repo-profile.json"), {
    schema_version: "repo-profile-artifact.v1",
    generated_at: result.generated_at,
    repo_profile: result.repo_profile,
  });
  await writeJson(path.join(outDir, "repo-command-catalog.json"), {
    schema_version: "repo-command-catalog.v1",
    generated_at: result.generated_at,
    repo_command_profile_count: result.repo_command_profiles.length,
    repo_command_profiles: result.repo_command_profiles,
  });
  await writeJson(path.join(outDir, "repo-detection-signals.json"), {
    schema_version: "repo-detection-signals.v1",
    generated_at: result.generated_at,
    repo_detection_signal_count: result.repo_detection_signals.length,
    repo_detection_signals: result.repo_detection_signals,
  });
  await writeJson(path.join(outDir, "repo-profile-desktop-boundary.json"), {
    schema_version: "repo-profile-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    repo_profile_desktop_boundary: result.repo_profile_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "repo-profile-detector-validation-report.v1",
    generated_at: result.generated_at,
    repo_profile_detector_id: result.repo_profile_detector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRepoProfileDetectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRepoProfileDetector(args);
    console.log(`Repo profile detector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.repo_profile_detector_status}`);
    console.log(`Primary language: ${result.summary.primary_language_id}`);
    console.log(`Frameworks: ${result.summary.framework_profile_count}`);
    console.log(`Configured commands: ${result.summary.configured_command_count}`);
    console.log(`Command executions performed: ${result.summary.command_execution_performed_count}`);
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
    schema_version: "repo-profile-detector-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    detector_rule: "inspect_repository_markers_package_scripts_and_file_extensions_without_running_commands",
    command_rule: "test_build_lint_commands_are_reported_as_detected_derived_or_not_configured_but_never_executed",
    desktop_companion_rule: "desktop_companion_reads_profile_status_and_command_catalog_only",
    mutation_policy: "protected_mutations_and_command_execution_require_human_gate_and_are_not_executed_by_this_artifact",
    created_at: generatedAt,
  };
}

function buildRepoProfile({ generatedAt, inputs, repoRoot, packageJson, repoFiles, languageProfiles, frameworkProfiles, commandProfiles }) {
  const primaryLanguage = languageProfiles.find((profile) => profile.primary_language === true) ?? languageProfiles[0] ?? null;
  const testCommand = commandProfiles.find((command) => command.command_kind === "test") ?? null;
  const buildCommand = commandProfiles.find((command) => command.command_kind === "build") ?? null;
  const lintCommand = commandProfiles.find((command) => command.command_kind === "lint") ?? null;
  const profile = {
    schema_version: "repo-profile.v1",
    repo_profile_id: `repo-profile.${slugify(packageJson.value?.name ?? path.basename(repoRoot))}`,
    repo_root: repoRoot,
    package_name: packageJson.value?.name ?? null,
    package_version: packageJson.value?.version ?? null,
    package_private: packageJson.value?.private ?? null,
    module_type: packageJson.value?.type ?? null,
    package_manager: detectPackageManager(repoFiles),
    source_control: {
      git_present: repoFiles.some((file) => file.relative_path === ".gitignore"),
      source_control_status: repoFiles.some((file) => file.relative_path === ".gitignore") ? "detected" : "not_detected",
    },
    profile_source: SOURCE_OF_TRUTH,
    profile_scope: "local_repository",
    primary_language_id: primaryLanguage?.language_id ?? null,
    primary_framework_id: frameworkProfiles[0]?.framework_id ?? null,
    language_profile_count: languageProfiles.length,
    framework_profile_count: frameworkProfiles.length,
    command_profile_count: commandProfiles.length,
    test_command: testCommand?.command ?? null,
    build_command: buildCommand?.command ?? null,
    lint_command: lintCommand?.command ?? null,
    command_execution_performed_count: commandProfiles.filter((command) => command.execution_performed === true).length,
    scanned_file_count: repoFiles.length,
    ignored_dir_names: [...IGNORED_DIRS].sort(),
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_command_execution_allowed: false,
    desktop_source_of_truth: false,
    profile_status: primaryLanguage && testCommand?.command_status !== "not_configured" ? "complete" : "blocked",
    detected_at: generatedAt,
    input_repo_root: inputs.repo_root,
  };
  return {
    ...profile,
    repo_profile_hash: hashObject(profile),
  };
}

function buildLanguageProfiles(repoFiles) {
  const extensionCounts = new Map();
  for (const file of repoFiles) {
    const extension = extensionFor(file.relative_path);
    extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
  }
  const languageCounts = new Map();
  const languageExtensions = new Map();
  for (const [extension, count] of extensionCounts.entries()) {
    const language = LANGUAGE_BY_EXTENSION.get(extension) ?? "other";
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + count);
    const extensions = languageExtensions.get(language) ?? [];
    extensions.push(extension);
    languageExtensions.set(language, extensions);
  }
  const primaryLanguageId = languageCounts.has("javascript")
    ? "javascript"
    : [...languageCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  return [...languageCounts.entries()]
    .sort((left, right) => (left[0] === primaryLanguageId ? -1 : right[0] === primaryLanguageId ? 1 : right[1] - left[1]))
    .map(([languageId, fileCount]) => {
      const profile = {
        schema_version: "repo-language-profile.v1",
        language_profile_id: `repo-language-profile.${languageId}`,
        language_id: languageId,
        file_count: fileCount,
        extension_count: languageExtensions.get(languageId)?.length ?? 0,
        extensions: (languageExtensions.get(languageId) ?? []).sort(),
        primary_language: languageId === primaryLanguageId,
        detection_status: "detected",
        confidence: languageId === primaryLanguageId ? 0.98 : 0.78,
      };
      return {
        ...profile,
        language_profile_hash: hashObject(profile),
      };
    });
}

function buildFrameworkProfiles({ repoFiles, packageJson, commandProfiles }) {
  const scripts = packageJson?.scripts ?? {};
  const frameworks = [];
  if (packageJson) {
    frameworks.push(frameworkProfile("nodejs-esm", "Node.js ESM", "runtime", "detected", packageJson.type === "module" ? 0.98 : 0.82, "package.json"));
  }
  if (scripts.test?.includes("node --test")) {
    frameworks.push(frameworkProfile("node-test", "Node test runner", "test", "detected", 0.96, "package.json#scripts.test"));
  }
  if (repoFiles.some((file) => file.relative_path.startsWith("schemas/") && file.relative_path.endsWith(".schema.json"))) {
    frameworks.push(frameworkProfile("json-schema-contracts", "JSON Schema contracts", "contract", "detected", 0.94, "schemas/*.schema.json"));
  }
  if (repoFiles.some((file) => file.relative_path.startsWith("packs/"))) {
    frameworks.push(frameworkProfile("domain-pack-harness", "Domain pack harness", "domain_pack", "detected", 0.92, "packs/"));
  }
  if (commandProfiles.some((command) => command.command_status !== "not_configured")) {
    frameworks.push(frameworkProfile("npm-script-harness", "npm script harness", "tooling", "detected", 0.9, "package.json#scripts"));
  }
  return frameworks;
}

function frameworkProfile(frameworkId, displayName, category, status, confidence, source) {
  const profile = {
    schema_version: "repo-framework-profile.v1",
    framework_profile_id: `repo-framework-profile.${frameworkId}`,
    framework_id: frameworkId,
    display_name: displayName,
    framework_category: category,
    framework_status: status,
    confidence,
    detection_source: source,
  };
  return {
    ...profile,
    framework_profile_hash: hashObject(profile),
  };
}

function buildCommandProfiles(packageJson) {
  const scripts = packageJson?.scripts ?? {};
  return [
    commandProfile({
      kind: "test",
      scriptName: "test",
      command: scripts.test ? "npm test" : null,
      status: scripts.test ? "detected" : "not_configured",
      source: scripts.test ? "package.json#scripts.test" : "package.json#scripts",
      evidence: scripts.test ?? null,
      confidence: scripts.test ? 0.98 : 0,
      required: true,
    }),
    commandProfile({
      kind: "build",
      scriptName: scripts.build ? "build" : scripts["dashboard:build"] ? "dashboard:build" : null,
      command: scripts.build ? "npm run build" : scripts["dashboard:build"] ? "npm run dashboard:build" : null,
      status: scripts.build ? "detected" : scripts["dashboard:build"] ? "derived" : "not_configured",
      source: scripts.build ? "package.json#scripts.build" : scripts["dashboard:build"] ? "package.json#scripts.dashboard:build" : "package.json#scripts",
      evidence: scripts.build ?? scripts["dashboard:build"] ?? null,
      confidence: scripts.build ? 0.96 : scripts["dashboard:build"] ? 0.78 : 0,
      required: true,
    }),
    commandProfile({
      kind: "lint",
      scriptName: scripts.lint ? "lint" : scripts["validate:core"] ? "validate:core" : scripts.validate ? "validate" : null,
      command: scripts.lint ? "npm run lint" : scripts["validate:core"] ? "npm run validate:core" : scripts.validate ? "npm run validate" : null,
      status: scripts.lint ? "detected" : scripts["validate:core"] || scripts.validate ? "derived" : "not_configured",
      source: scripts.lint ? "package.json#scripts.lint" : scripts["validate:core"] ? "package.json#scripts.validate:core" : scripts.validate ? "package.json#scripts.validate" : "package.json#scripts",
      evidence: scripts.lint ?? scripts["validate:core"] ?? scripts.validate ?? null,
      confidence: scripts.lint ? 0.96 : scripts["validate:core"] || scripts.validate ? 0.72 : 0,
      required: true,
    }),
    commandProfile({
      kind: "validate",
      scriptName: scripts.validate ? "validate" : null,
      command: scripts.validate ? "npm run validate" : null,
      status: scripts.validate ? "detected" : "not_configured",
      source: scripts.validate ? "package.json#scripts.validate" : "package.json#scripts",
      evidence: scripts.validate ?? null,
      confidence: scripts.validate ? 0.94 : 0,
      required: false,
    }),
  ];
}

function commandProfile({ kind, scriptName, command, status, source, evidence, confidence, required }) {
  const profile = {
    schema_version: "repo-command-profile.v1",
    repo_command_profile_id: `repo-command-profile.${kind}`,
    command_kind: kind,
    package_script_name: scriptName,
    command,
    command_status: status,
    command_source: source,
    evidence,
    required_for_repo_profile: required,
    execution_policy: "not_executed_by_repo_profile_detector",
    execution_performed: false,
    desktop_read_only: true,
    desktop_command_execution_allowed: false,
    desktop_mutation_allowed: false,
    protected_mutation_requires_human_gate: true,
    confidence,
  };
  return {
    ...profile,
    repo_command_profile_hash: hashObject(profile),
  };
}

function buildDetectionSignals({ repoRoot, repoFiles, packageJson }) {
  const signals = [];
  const rootFiles = new Set(repoFiles.map((file) => file.relative_path));
  if (packageJson) {
    signals.push(signal("package-json", "package", "package.json", `package ${packageJson.name ?? "unknown"} type ${packageJson.type ?? "unknown"}`, 0.98));
  }
  for (const marker of ["README.md", "AGENTS.md", ".gitignore"]) {
    if (rootFiles.has(marker)) signals.push(signal(slugify(marker), "marker", marker, `${marker} present`, 0.85));
  }
  const jsCount = repoFiles.filter((file) => [".mjs", ".js", ".cjs"].includes(extensionFor(file.relative_path))).length;
  const schemaCount = repoFiles.filter((file) => file.relative_path.endsWith(".schema.json")).length;
  if (jsCount > 0) signals.push(signal("javascript-files", "language", repoRoot, `${jsCount} JavaScript file(s) detected`, 0.95));
  if (schemaCount > 0) signals.push(signal("json-schema-files", "framework", "schemas", `${schemaCount} JSON Schema file(s) detected`, 0.94));
  return signals;
}

function signal(signalId, signalType, sourcePath, evidence, confidence) {
  const item = {
    schema_version: "repo-detection-signal.v1",
    repo_detection_signal_id: `repo-detection-signal.${signalId}`,
    signal_type: signalType,
    source_path: sourcePath,
    evidence,
    signal_status: "detected",
    confidence,
  };
  return {
    ...item,
    signal_hash: hashObject(item),
  };
}

function buildDesktopBoundary({ generatedAt, commandProfiles }) {
  const boundary = {
    schema_version: "repo-profile-desktop-boundary.v1",
    boundary_id: "repo-profile-desktop-boundary.personal-dev",
    pack_id: PACK_ID,
    desktop_companion_role: "operator_read_only_view",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_command_execution_allowed: false,
    desktop_source_of_truth: false,
    protected_mutations_require_human_gate: true,
    command_execution_requires_human_gate: true,
    command_execution_performed_count: commandProfiles.filter((command) => command.execution_performed === true).length,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    runtime_execution_allowed: false,
    runtime_control_allowed: false,
    boundary_status: "enforced",
    recorded_at: generatedAt,
  };
  return {
    ...boundary,
    boundary_hash: hashObject(boundary),
  };
}

function buildCheckpoints({ packageJson, personalDevPackManifest, roadmapText, repoFiles, languageProfiles, frameworkProfiles, commandProfiles, desktopBoundary }) {
  const commandByKind = new Map(commandProfiles.map((command) => [command.command_kind, command]));
  const primaryLanguage = languageProfiles.find((profile) => profile.primary_language === true);
  const roadmapSlotPresent = typeof roadmapText === "string" && roadmapText.includes("| P214 | repo profile detector 구현 |");
  return [
    checkpoint("repo_files_scanned", repoFiles.length > 0, `${repoFiles.length} repository file(s) scanned with generated artifact folders ignored.`),
    checkpoint("package_json_available", Boolean(packageJson?.scripts), "package.json is readable and exposes npm scripts."),
    checkpoint("personal_dev_pack_manifest_bound", personalDevPackManifest?.summary?.personal_dev_pack_manifest_status === "complete" && personalDevPackManifest?.summary?.pack_id === PACK_ID, "P213 personal-dev pack manifest is complete and bound as source context."),
    checkpoint("primary_language_detected", Boolean(primaryLanguage?.language_id), `Primary language ${primaryLanguage?.language_id ?? "missing"} detected.`),
    checkpoint("framework_profile_detected", frameworkProfiles.length >= 3, `${frameworkProfiles.length} framework/tooling profile(s) detected.`),
    checkpoint("test_command_detected", commandByKind.get("test")?.command_status !== "not_configured", `Test command ${commandByKind.get("test")?.command ?? "missing"} recorded.`),
    checkpoint("build_command_detected_or_set", commandByKind.get("build")?.command_status !== "not_configured", `Build command ${commandByKind.get("build")?.command ?? "missing"} recorded.`),
    checkpoint("lint_command_detected_or_set", commandByKind.get("lint")?.command_status !== "not_configured", `Lint/validation command ${commandByKind.get("lint")?.command ?? "missing"} recorded.`),
    checkpoint("command_execution_not_performed", commandProfiles.every((command) => command.execution_performed === false), "Repo profile detection did not run test, build, lint, or validation commands."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.desktop_read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_command_execution_allowed === false, "Desktop companion remains a read-only operator surface."),
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:repo-profile"]), "package.json exposes personal-dev:repo-profile."),
    checkpoint("roadmap_slot_present", roadmapSlotPresent, "P214 remains recorded in the final completion ledger."),
  ];
}

function summarizeRepoProfileDetector({ personalDevPackManifest, repoFiles, languageProfiles, frameworkProfiles, commandProfiles, desktopBoundary, checkpoints, validation }) {
  const commandByKind = new Map(commandProfiles.map((command) => [command.command_kind, command]));
  const primaryLanguage = languageProfiles.find((profile) => profile.primary_language === true);
  const passedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length;
  const configuredCommands = commandProfiles.filter((command) => command.command_status !== "not_configured");
  const commandExecutionPerformedCount = commandProfiles.filter((command) => command.execution_performed === true).length;
  const complete = validation.valid
    && primaryLanguage
    && frameworkProfiles.length > 0
    && commandByKind.get("test")?.command_status !== "not_configured"
    && commandByKind.get("build")?.command_status !== "not_configured"
    && commandByKind.get("lint")?.command_status !== "not_configured"
    && commandExecutionPerformedCount === 0
    && desktopBoundary.boundary_status === "enforced";
  return {
    repo_profile_detector_status: complete ? "complete" : "blocked",
    repo_profile_detector_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    personal_dev_pack_manifest_status: personalDevPackManifest?.summary?.personal_dev_pack_manifest_status ?? "missing",
    repo_profile_status: complete ? "complete" : "blocked",
    scanned_file_count: repoFiles.length,
    primary_language_id: primaryLanguage?.language_id ?? null,
    language_profile_count: languageProfiles.length,
    framework_profile_count: frameworkProfiles.length,
    command_profile_count: commandProfiles.length,
    configured_command_count: configuredCommands.length,
    missing_required_command_count: commandProfiles.filter((command) => command.required_for_repo_profile && command.command_status === "not_configured").length,
    missing_optional_command_count: commandProfiles.filter((command) => !command.required_for_repo_profile && command.command_status === "not_configured").length,
    test_command_detected: commandByKind.get("test")?.command_status !== "not_configured",
    build_command_detected: commandByKind.get("build")?.command_status !== "not_configured",
    lint_command_detected: commandByKind.get("lint")?.command_status !== "not_configured",
    test_command: commandByKind.get("test")?.command ?? null,
    build_command: commandByKind.get("build")?.command ?? null,
    lint_command: commandByKind.get("lint")?.command ?? null,
    command_execution_performed_count: commandExecutionPerformedCount,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: desktopBoundary.desktop_read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.desktop_command_execution_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    protected_mutations_require_human_gate: desktopBoundary.protected_mutations_require_human_gate,
    command_execution_requires_human_gate: desktopBoundary.command_execution_requires_human_gate,
    raw_secret_material_exposed: desktopBoundary.raw_secret_material_exposed,
    provider_key_exposed: desktopBoundary.provider_key_exposed,
    installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: passedCheckpointCount,
    failed_checkpoint_count: checkpoints.length - passedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_command_status: countBy(commandProfiles, "command_status"),
    by_framework_status: countBy(frameworkProfiles, "framework_status"),
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    repository_mutation_allowed: false,
    command_execution_performed: false,
    protected_mutation_executed: false,
    desktop_mutation_allowed: false,
    desktop_command_execution_allowed: false,
    desktop_source_of_truth: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
  };
}

function buildSourceContracts({ packageJson, personalDevPackManifest, roadmapText, repoRoot, repoFiles }) {
  return {
    repo_root: {
      schema_version: null,
      path: repoRoot,
      available: true,
      scanned_file_count: repoFiles.length,
      content_hash: hashObject(repoFiles.map((file) => file.relative_path).sort()),
      error: null,
    },
    package_json: {
      schema_version: null,
      path: packageJson.path,
      available: packageJson.available,
      content_hash: packageJson.content_hash,
      error: packageJson.error,
    },
    personal_dev_pack_manifest: {
      schema_version: personalDevPackManifest.value?.schema_version ?? null,
      path: personalDevPackManifest.path,
      available: personalDevPackManifest.available,
      content_hash: personalDevPackManifest.content_hash,
      error: personalDevPackManifest.error,
    },
    roadmap: {
      schema_version: null,
      path: roadmapText.path,
      available: roadmapText.available,
      content_hash: roadmapText.content_hash,
      error: roadmapText.error,
    },
  };
}

async function listRepoFiles(repoRoot, dir = "") {
  const absoluteDir = path.join(repoRoot, dir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const relativePath = toPosixPath(path.join(dir, entry.name));
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...await listRepoFiles(repoRoot, relativePath));
    } else if (entry.isFile()) {
      files.push({
        relative_path: relativePath,
        extension: extensionFor(relativePath),
      });
    }
  }
  return files.sort((left, right) => left.relative_path.localeCompare(right.relative_path));
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
  const merged = { ...DEFAULT_REPO_PROFILE_DETECTOR_INPUTS, ...options };
  return {
    repo_root: merged.repoRoot,
    personal_dev_pack_manifest_path: merged.personalDevPackManifestPath,
    package_path: merged.packagePath,
    roadmap_path: merged.roadmapPath,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--personal-dev-pack-manifest") parsed.personalDevPackManifestPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/repo-profile-detector.mjs [options]

Options:
  --check                              Fail when validation does not pass
  --no-write                           Build without writing artifacts
  --out-dir <path>                     Output directory
  --repo-root <path>                   Repository root to inspect
  --personal-dev-pack-manifest <path>  P213 personal-dev pack manifest artifact
  --package <path>                     package.json path relative to repo root
  --roadmap <path>                     final completion ledger path relative to repo root
`);
}

function renderRepoProfileDetectorMarkdown(result) {
  const lines = [];
  lines.push("# Repo Profile Detector");
  lines.push("");
  lines.push(`Status: ${result.summary.repo_profile_detector_status}`);
  lines.push("");
  lines.push("## Profile");
  lines.push("");
  lines.push(`- Primary language: ${result.summary.primary_language_id}`);
  lines.push(`- Framework profiles: ${result.summary.framework_profile_count}`);
  lines.push(`- Scanned files: ${result.summary.scanned_file_count}`);
  lines.push("");
  lines.push("## Commands");
  lines.push("");
  for (const command of result.repo_command_profiles) {
    lines.push(`- ${command.command_kind}: ${command.command ?? "not configured"} (${command.command_status}, not executed)`);
  }
  lines.push("");
  lines.push("## Desktop Boundary");
  lines.push("");
  lines.push(`- Read only: ${result.summary.desktop_read_only}`);
  lines.push(`- Mutation allowed: ${result.summary.desktop_mutation_allowed}`);
  lines.push(`- Command execution allowed: ${result.summary.desktop_command_execution_allowed}`);
  lines.push("");
  lines.push("## Checkpoints");
  lines.push("");
  for (const checkpointItem of result.repo_profile_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status} - ${checkpointItem.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableRepoProfileDetector(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "repo-profile-checkpoint.v1",
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

function detectPackageManager(repoFiles) {
  const rootFiles = new Set(repoFiles.map((file) => file.relative_path));
  if (rootFiles.has("package-lock.json")) return "npm";
  if (rootFiles.has("pnpm-lock.yaml")) return "pnpm";
  if (rootFiles.has("yarn.lock")) return "yarn";
  if (rootFiles.has("package.json")) return "npm_inferred";
  return "unknown";
}

function extensionFor(relativePath) {
  if (relativePath.endsWith(".schema.json")) return ".schema.json";
  return path.extname(relativePath).toLowerCase() || "none";
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
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

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value).replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}
