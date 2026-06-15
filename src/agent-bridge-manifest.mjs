import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_AGENT_BRIDGE_MANIFEST_OUT_DIR = "artifacts/agent-bridge-manifest/latest";
export const DEFAULT_AGENT_BRIDGE_MANIFEST_INPUTS = {
  schemaPath: "schemas/agent-bridge-manifest.schema.json",
  packagePath: "package.json",
  planPath: "docs/hermes-agent-bridge-tuw-plan-2026-06-16.md",
  reviewReceiptPath: "docs/hermes-agent-bridge-agbrowse-chatgpt-pro-review-receipt-2026-06-16.md",
};

export const CAPABILITY_STATES = Object.freeze([
  "installed",
  "observed",
  "requestable",
  "executable",
  "blocked",
]);

export const AUTHORITY_NAMESPACES = Object.freeze([
  "desktop_authority",
  "developer_preflight",
  "manifest_generator_discovery",
  "agent_runtime_authority",
  "external_provider_authority",
  "protected_action_authority",
]);

export const AUTHORITY_FLAGS = Object.freeze([
  "desktop_mutation_allowed",
  "agent_runtime_execution_allowed_now",
  "command_execution_allowed_now",
  "shell_execution_allowed_now",
  "git_write_allowed_now",
  "deploy_allowed_now",
  "approval_application_allowed_now",
  "receipt_application_allowed_now",
  "connector_write_allowed_now",
  "secret_read_allowed_now",
  "raw_source_exposure_allowed",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "protected_closeout_enabled",
  "agent_final_pass_allowed_now",
]);

export const PROTECTED_ACTION_TYPES = Object.freeze([
  "git_commit",
  "git_push",
  "git_merge",
  "deploy",
  "approve",
  "apply_patch_or_receipt",
  "production_pass",
  "enterprise_pass",
  "protected_closeout",
  "connector_write",
  "secret_read",
  "raw_source_exposure",
  "shell_indirection",
  "path_traversal_or_symlink",
]);

export const PROTECTED_COMMAND_FIXTURES = Object.freeze([
  ["git commit -m release", "git_commit"],
  ["git push origin main", "git_push"],
  ["git merge feature", "git_merge"],
  ["gh pr review --approve 1", "approve"],
  ["npm run deploy", "deploy"],
  ["npm run release:production", "deploy"],
  ["node scripts/apply-receipt.mjs --receipt owner.json", "apply_patch_or_receipt"],
  ["APPROVE=true npm run release", "approve"],
  ["sh -c \"git push origin main\"", "shell_indirection"],
  ["bash -lc \"npm run deploy\"", "shell_indirection"],
  ["open ../../secrets/.env", "secret_read"],
  ["cat raw-transcript.json", "raw_source_exposure"],
  ["ln -s ../../private target", "path_traversal_or_symlink"],
  ["echo production PASS", "production_pass"],
  ["echo enterprise PASS", "enterprise_pass"],
  ["echo protected closeout complete", "protected_closeout"],
]);

const SCHEMA_VERSION = "agent-bridge-manifest.v1";
const CAPABILITY_ID = "platform.agent_bridge_manifest";
const COMMAND_NAME = "platform:agent-bridge-manifest";
const PROGRAM_RANGE = "AGENT-BRIDGE-L0-L4-SLICE-A";
const READY_STATUS = "ready_for_agent_bridge_manifest";
const BLOCKED_STATUS = "blocked_agent_bridge_manifest";

export async function runAgentBridgeManifest(options = {}) {
  const result = await buildAgentBridgeManifest(options);
  if (options.write !== false) await writeAgentBridgeManifest(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Agent Bridge manifest failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAgentBridgeManifest(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AGENT_BRIDGE_MANIFEST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const planDoc = await readTextSource(inputs.plan_path);
  const reviewReceipt = await readTextSource(inputs.review_receipt_path);
  const packageScripts = packageJson.data?.scripts ?? {};
  const sourceStatus = buildSourceStatus({
    generatedAt,
    schema,
    packageJson,
    planDoc,
    reviewReceipt,
    packageScripts,
  });
  const collections = deriveAgentBridgeCollections({
    generatedAt,
    inputs,
    sourceStatus,
    packageScripts,
    planDoc,
    reviewReceipt,
  });
  const agentBridgeContract = buildContract(generatedAt);
  const agentBridgeBoundary = buildBoundary({
    generatedAt,
    agentBridgeContract,
    ...collections,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_status: sourceStatus,
    agent_bridge_contract: agentBridgeContract,
    capability_state_lattice_rows: collections.capability_state_lattice_rows,
    authority_namespace_rows: collections.authority_namespace_rows,
    provenance_source_rows: collections.provenance_source_rows,
    runtime_identity_rows: collections.runtime_identity_rows,
    capability_inventory_rows: collections.capability_inventory_rows,
    permission_matrix_rows: collections.permission_matrix_rows,
    protected_action_classifier_rows: collections.protected_action_classifier_rows,
    command_canonicalization_fixture_rows: collections.command_canonicalization_fixture_rows,
    redaction_policy_rows: collections.redaction_policy_rows,
    malicious_manifest_fixture_rows: collections.malicious_manifest_fixture_rows,
    adapter_package_provenance_rows: collections.adapter_package_provenance_rows,
    agent_bridge_boundary: agentBridgeBoundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  result.summary = buildSummary(result);
  const validation = validateAgentBridgeManifestResult(result, schema.available ? schema.data : null);
  result.validation_items = validation.validation_items;
  result.validation = validation.validation;
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export function validateAgentBridgeManifestResult(result, schema = null) {
  const items = buildValidationItems(result);
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "agent_bridge_manifest")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(
    `schema.${index}`,
    false,
    error.message,
    error.path,
  ));
  const validationItems = [...items, ...schemaItems];
  return {
    validation_items: validationItems,
    validation: summarizeValidation(validationItems),
  };
}

export async function writeAgentBridgeManifest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "agent-bridge-manifest.json"), serializable);
  await writeJson(path.join(outDir, "capability-state-lattice-rows.json"), collectionEnvelope("capability-state-lattice-rows.v1", "capability_state_lattice_rows", result.capability_state_lattice_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-namespace-rows.json"), collectionEnvelope("authority-namespace-rows.v1", "authority_namespace_rows", result.authority_namespace_rows, result.generated_at));
  await writeJson(path.join(outDir, "provenance-source-rows.json"), collectionEnvelope("provenance-source-rows.v1", "provenance_source_rows", result.provenance_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-identity-rows.json"), collectionEnvelope("runtime-identity-rows.v1", "runtime_identity_rows", result.runtime_identity_rows, result.generated_at));
  await writeJson(path.join(outDir, "capability-inventory-rows.json"), collectionEnvelope("capability-inventory-rows.v1", "capability_inventory_rows", result.capability_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "permission-matrix-rows.json"), collectionEnvelope("permission-matrix-rows.v1", "permission_matrix_rows", result.permission_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-classifier-rows.json"), collectionEnvelope("protected-action-classifier-rows.v1", "protected_action_classifier_rows", result.protected_action_classifier_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-canonicalization-fixture-rows.json"), collectionEnvelope("command-canonicalization-fixture-rows.v1", "command_canonicalization_fixture_rows", result.command_canonicalization_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "redaction-policy-rows.json"), collectionEnvelope("redaction-policy-rows.v1", "redaction_policy_rows", result.redaction_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "malicious-manifest-fixture-rows.json"), collectionEnvelope("malicious-manifest-fixture-rows.v1", "malicious_manifest_fixture_rows", result.malicious_manifest_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "adapter-package-provenance-rows.json"), collectionEnvelope("adapter-package-provenance-rows.v1", "adapter_package_provenance_rows", result.adapter_package_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-bridge-boundary.json"), result.agent_bridge_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "agent-bridge-manifest-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAgentBridgeManifestCli(argv = process.argv.slice(2)) {
  try {
    const args = parseAgentBridgeManifestArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runAgentBridgeManifest(args);
    console.log(`Agent Bridge manifest ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.agent_bridge_manifest_status}`);
    console.log(`Runtimes: ${result.summary.runtime_count}`);
    console.log(`Capabilities: ${result.summary.capability_count}`);
    console.log(`Permission rows: ${result.summary.permission_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "agent-bridge-contract.v1",
    generated_at: generatedAt,
    contract_id: "contract.hermes.agent_bridge_manifest.local_only",
    contract_scope: "l0_l4_contract_identity_capability_permission_only",
    local_only: true,
    read_only: true,
    source_of_truth: false,
    desktop_projection_consumer: true,
    request_queue_enabled_now: false,
    receipt_intake_enabled_now: false,
    controlled_execution_candidate_enabled_now: false,
    ...falseAuthorityFlags(),
    provider_output_trust_class: "untrusted_evidence_input_only",
    model_label_is_proof: false,
    installed_implies_observed: false,
    installed_implies_requestable: false,
    installed_implies_executable: false,
    observed_implies_requestable: false,
    observed_implies_executable: false,
    reviewed_implies_approved: false,
    receipt_imported_implies_applied: false,
  };
}

function deriveAgentBridgeCollections(context) {
  const capabilityStateLatticeRows = buildCapabilityStateLatticeRows(context.generatedAt);
  const authorityNamespaceRows = buildAuthorityNamespaceRows(context.generatedAt);
  const provenanceSourceRows = buildProvenanceSourceRows(context);
  const runtimeIdentityRows = buildRuntimeIdentityRows(context);
  const capabilityInventoryRows = buildCapabilityInventoryRows(context);
  const permissionMatrixRows = buildPermissionMatrixRows(context.generatedAt, capabilityInventoryRows);
  const protectedActionClassifierRows = buildProtectedActionClassifierRows(context.generatedAt);
  const commandCanonicalizationFixtureRows = buildCommandCanonicalizationFixtureRows(context.generatedAt);
  const redactionPolicyRows = buildRedactionPolicyRows(context.generatedAt);
  const maliciousManifestFixtureRows = buildMaliciousManifestFixtureRows(context.generatedAt);
  const adapterPackageProvenanceRows = buildAdapterPackageProvenanceRows(context);
  return {
    capability_state_lattice_rows: capabilityStateLatticeRows,
    authority_namespace_rows: authorityNamespaceRows,
    provenance_source_rows: provenanceSourceRows,
    runtime_identity_rows: runtimeIdentityRows,
    capability_inventory_rows: capabilityInventoryRows,
    permission_matrix_rows: permissionMatrixRows,
    protected_action_classifier_rows: protectedActionClassifierRows,
    command_canonicalization_fixture_rows: commandCanonicalizationFixtureRows,
    redaction_policy_rows: redactionPolicyRows,
    malicious_manifest_fixture_rows: maliciousManifestFixtureRows,
    adapter_package_provenance_rows: adapterPackageProvenanceRows,
  };
}

function buildCapabilityStateLatticeRows(generatedAt) {
  const rows = [
    ["installed", "observed", false, "Installed only records possible availability; it does not prove runtime observation."],
    ["installed", "requestable", false, "Installed does not allow request packet creation."],
    ["installed", "executable", false, "Installed does not allow Hermes Desktop execution."],
    ["observed", "requestable", false, "Observed evidence remains display-only until L5 request queue gates exist."],
    ["observed", "executable", false, "Observed evidence never opens runtime execution."],
    ["requestable", "executable", false, "Requestable packet creation does not imply execution authority."],
    ["reviewed", "approved", false, "Review evidence cannot approve Codex-created work."],
    ["receipt_imported", "receipt_applied", false, "Receipt import cannot apply receipts or close protected gates."],
  ];
  return rows.map(([fromState, toState, automaticTransitionAllowed, rule], index) => verdictRow({
    schema_version: "agent-capability-state-lattice-row.v1",
    row_id: rowId("agent.bridge.state.lattice", index),
    generated_at: generatedAt,
    from_state: fromState,
    to_state: toState,
    automatic_transition_allowed: automaticTransitionAllowed,
    authority_effect: "none",
    rule,
  }, automaticTransitionAllowed === false));
}

function buildAuthorityNamespaceRows(generatedAt) {
  const specs = [
    ["desktop_authority", "Hermes Desktop can render read-only bridge projections only.", true, false, "display_only"],
    ["developer_preflight", "A developer may run repository validation commands outside Desktop and record evidence.", false, false, "evidence_only"],
    ["manifest_generator_discovery", "The deterministic generator may read local files passed as inputs.", false, false, "read_only_discovery"],
    ["agent_runtime_authority", "Hermes-launched Codex, Claude, ChatGPT, or local agent execution.", false, false, "closed_until_l8_l9"],
    ["external_provider_authority", "Claims from model output, plugin metadata, browser text, or runtime self-report.", false, false, "untrusted_evidence_only"],
    ["protected_action_authority", "Commit, push, merge, deploy, approve, apply, production, enterprise, protected closeout.", false, false, "always_closed_without_specific_owner_receipt"],
  ];
  return specs.map(([namespace, description, desktopDisplayAllowed, opensAuthority, authorityEffect], index) => verdictRow({
    schema_version: "agent-authority-namespace-row.v1",
    row_id: rowId("agent.bridge.authority.namespace", index),
    generated_at: generatedAt,
    namespace,
    description,
    desktop_display_allowed: desktopDisplayAllowed,
    opens_authority: opensAuthority,
    authority_effect: authorityEffect,
    ...falseAuthorityFlags(),
  }, opensAuthority === false));
}

function buildProvenanceSourceRows(context) {
  const sources = [
    sourceRow(context.generatedAt, "source.schema", "filesystem_json", context.inputs.schema_path, context.sourceStatus.schema_source, "deterministic_local_file", "schema validation input"),
    sourceRow(context.generatedAt, "source.package_json", "filesystem_json", context.inputs.package_path, context.sourceStatus.package_json_source, "deterministic_local_file", "package script and local capability input"),
    sourceRow(context.generatedAt, "source.plan_doc", "filesystem_markdown", context.inputs.plan_path, context.sourceStatus.plan_doc_source, "owner_reviewed_planning_artifact", "Agent Bridge TUW plan input"),
    sourceRow(context.generatedAt, "source.agbrowse_review_receipt", "filesystem_markdown", context.inputs.review_receipt_path, context.sourceStatus.review_receipt_source, "external_review_evidence", "Agbrowse ChatGPT review receipt input"),
    {
      schema_version: "agent-provenance-source-row.v1",
      row_id: "agent.bridge.provenance.source.runtime_self_report",
      generated_at: context.generatedAt,
      source_id: "runtime.self_report",
      source_type: "runtime_self_report",
      source_ref: "model or plugin self-report text",
      source_available: true,
      source_hash: null,
      trust_class: "low_trust_self_report",
      collector: "manual_or_runtime_observation",
      collection_method: "display_only_no_authority_effect",
      authority_effect: "none",
      opens_authority: false,
      next_allowed_action: "bind to a higher-trust receipt before promotion",
      current_verdict: "pass",
      unsafe_flags_false: true,
      verdict_authority: "harness_deterministic_validator",
    },
    {
      schema_version: "agent-provenance-source-row.v1",
      row_id: "agent.bridge.provenance.source.provider_output",
      generated_at: context.generatedAt,
      source_id: "external.provider_output",
      source_type: "provider_output",
      source_ref: "ChatGPT, Claude, Codex, web UI, plugin metadata, MCP manifests",
      source_available: true,
      source_hash: null,
      trust_class: "untrusted_provider_output",
      collector: "agent_bridge_policy",
      collection_method: "evidence_input_only",
      authority_effect: "none",
      opens_authority: false,
      next_allowed_action: "normalize as evidence only",
      current_verdict: "pass",
      unsafe_flags_false: true,
      verdict_authority: "harness_deterministic_validator",
    },
  ];
  return sources;
}

function buildRuntimeIdentityRows(context) {
  const workspaceHash = `sha256:${sha256(path.resolve("."))}`;
  const specs = [
    {
      runtime_id: "runtime.codex.desktop",
      runtime_kind: "codex",
      display_name: "Codex Desktop development lane",
      model_label_observed: "codex",
      model_proof_trusted: false,
      state: "observed",
      observation_source_id: "runtime.self_report",
      trust_class: "developer_session_context",
      workspace_ref: "current_repo_workspace",
      workspace_hash: workspaceHash,
      can_prepare_request_packet_now: false,
      can_execute_from_desktop_now: false,
    },
    {
      runtime_id: "runtime.claude_code.opus_max",
      runtime_kind: "claude_code",
      display_name: "Claude Code Opus max review lane",
      model_label_observed: "opus_max",
      model_proof_trusted: false,
      state: context.sourceStatus.review_receipt_source.source_available ? "observed" : "installed",
      observation_source_id: "source.agbrowse_review_receipt",
      trust_class: "external_review_lane_evidence",
      workspace_ref: "external_reviewer_workspace",
      workspace_hash: null,
      can_prepare_request_packet_now: false,
      can_execute_from_desktop_now: false,
    },
    {
      runtime_id: "runtime.chatgpt.web_agbrowse",
      runtime_kind: "chatgpt_web_agbrowse",
      display_name: "ChatGPT web via Agbrowse",
      model_label_observed: "chatgpt_pro",
      model_proof_trusted: false,
      state: context.sourceStatus.review_receipt_source.source_available ? "observed" : "installed",
      observation_source_id: "source.agbrowse_review_receipt",
      trust_class: "browser_automation_status_evidence",
      workspace_ref: "web_account_session",
      workspace_hash: null,
      can_prepare_request_packet_now: false,
      can_execute_from_desktop_now: false,
    },
    {
      runtime_id: "runtime.local.hermes_scripts",
      runtime_kind: "local_script",
      display_name: "Local Hermes deterministic scripts",
      model_label_observed: "none",
      model_proof_trusted: false,
      state: context.sourceStatus.package_json_source.source_available ? "observed" : "blocked",
      observation_source_id: "source.package_json",
      trust_class: "deterministic_local_file",
      workspace_ref: "repo_package_json",
      workspace_hash: context.sourceStatus.package_json_source.source_hash,
      can_prepare_request_packet_now: false,
      can_execute_from_desktop_now: false,
    },
  ];
  return specs.map((runtime, index) => verdictRow({
    schema_version: "agent-runtime-identity-row.v1",
    row_id: rowId("agent.bridge.runtime.identity", index),
    generated_at: context.generatedAt,
    ...runtime,
    desktop_display_allowed: true,
    requestable: false,
    executable: false,
    ...falseAuthorityFlags(),
    next_allowed_action: "display runtime identity and provenance only",
  }, CAPABILITY_STATES.includes(runtime.state) && runtime.can_execute_from_desktop_now === false));
}

function buildCapabilityInventoryRows(context) {
  const localScriptRows = Object.keys(context.packageScripts)
    .filter((scriptName) => scriptName === COMMAND_NAME || /^platform:agent/.test(scriptName))
    .sort()
    .slice(0, 24)
    .map((scriptName) => ({
      capability_id: `capability.local_script.${slug(scriptName)}`,
      capability_kind: "package_script",
      capability_name: scriptName,
      runtime_id: "runtime.local.hermes_scripts",
      state: "observed",
      source_id: "source.package_json",
      source_ref: "package.json scripts",
      source_hash: context.sourceStatus.package_json_source.source_hash,
      command_template: `npm run ${scriptName} -- --check`,
      passive_collection_only: false,
      requestable: false,
      executable: false,
      trust_class: "deterministic_local_file",
    }));
  const coreRows = [
    {
      capability_id: "capability.codex.skills.visible_catalog",
      capability_kind: "skill_catalog",
      capability_name: "Codex visible skills and plugins",
      runtime_id: "runtime.codex.desktop",
      state: "observed",
      source_id: "runtime.self_report",
      source_ref: "Codex desktop session skill catalog",
      source_hash: null,
      command_template: null,
      passive_collection_only: true,
      requestable: false,
      executable: false,
      trust_class: "developer_session_context",
    },
    {
      capability_id: "capability.claude.review_lane",
      capability_kind: "review_lane",
      capability_name: "Claude Code read-only review packet lane",
      runtime_id: "runtime.claude_code.opus_max",
      state: "observed",
      source_id: "source.agbrowse_review_receipt",
      source_ref: context.inputs.review_receipt_path,
      source_hash: context.sourceStatus.review_receipt_source.source_hash,
      command_template: null,
      passive_collection_only: true,
      requestable: false,
      executable: false,
      trust_class: "external_review_evidence",
    },
    {
      capability_id: "capability.chatgpt.agbrowse.web_ai",
      capability_kind: "browser_automation_adapter",
      capability_name: "Agbrowse ChatGPT web AI status and review transport",
      runtime_id: "runtime.chatgpt.web_agbrowse",
      state: "observed",
      source_id: "source.agbrowse_review_receipt",
      source_ref: "agbrowse web-ai status/query receipts",
      source_hash: context.sourceStatus.review_receipt_source.source_hash,
      command_template: "agbrowse web-ai status --vendor chatgpt",
      passive_collection_only: true,
      requestable: false,
      executable: false,
      trust_class: "browser_automation_status_evidence",
    },
    {
      capability_id: "capability.local.hermes.agent_bridge_manifest",
      capability_kind: "package_script",
      capability_name: COMMAND_NAME,
      runtime_id: "runtime.local.hermes_scripts",
      state: context.packageScripts[COMMAND_NAME] ? "observed" : "blocked",
      source_id: "source.package_json",
      source_ref: "package.json scripts",
      source_hash: context.sourceStatus.package_json_source.source_hash,
      command_template: `npm run ${COMMAND_NAME} -- --check`,
      passive_collection_only: false,
      requestable: false,
      executable: false,
      trust_class: "deterministic_local_file",
    },
  ];
  return [...coreRows, ...localScriptRows].map((row, index) => verdictRow({
    schema_version: "agent-capability-inventory-row.v1",
    row_id: rowId("agent.bridge.capability.inventory", index),
    generated_at: context.generatedAt,
    desktop_display_allowed: true,
    installed: ["installed", "observed", "requestable", "executable"].includes(row.state),
    observed: ["observed", "requestable", "executable"].includes(row.state),
    ...row,
    ...falseAuthorityFlags(),
    next_allowed_action: row.state === "blocked" ? "repair capability provenance" : "display capability and bind permission row",
  }, row.state !== "blocked" && row.executable === false));
}

function buildPermissionMatrixRows(generatedAt, capabilityRows) {
  return capabilityRows.map((capability, index) => verdictRow({
    schema_version: "agent-permission-matrix-row.v1",
    row_id: rowId("agent.bridge.permission.matrix", index),
    generated_at: generatedAt,
    capability_id: capability.capability_id,
    capability_kind: capability.capability_kind,
    runtime_id: capability.runtime_id,
    capability_state: capability.state,
    authority_namespace: capability.capability_kind === "package_script" ? "developer_preflight" : "external_provider_authority",
    desktop_display_allowed: true,
    installed: capability.installed === true,
    observed: capability.observed === true,
    requestable: false,
    executable: false,
    blocked: capability.state === "blocked",
    request_packet_creation_allowed_now: false,
    desktop_copy_prompt_allowed_now: false,
    passive_collection_only: capability.passive_collection_only === true,
    allowed_actions: ["display", "inspect_provenance"],
    denied_actions: [
      "execute_from_desktop",
      "write_connector",
      "read_secret",
      "show_raw_transcript",
      "apply_receipt",
      "approve",
      "deploy",
      "production_pass",
      "enterprise_pass",
      "protected_closeout",
    ],
    authority_effect: "none",
    opens_authority: false,
    ...falseAuthorityFlags(),
    next_allowed_action: "display permission row only",
  }, capability.state !== "blocked" && capability.executable === false));
}

function buildProtectedActionClassifierRows(generatedAt) {
  return PROTECTED_ACTION_TYPES.map((actionType, index) => verdictRow({
    schema_version: "agent-protected-action-classifier-row.v1",
    row_id: rowId("agent.bridge.protected.action", index),
    generated_at: generatedAt,
    protected_action_type: actionType,
    blocked: true,
    authority_namespace: "protected_action_authority",
    authority_effect: "none",
    requires_owner_receipt: true,
    requires_independent_review_for_enterprise_trust: true,
    reason: `${actionType} is closed in Agent Bridge Slice A.`,
    ...falseAuthorityFlags(),
    next_allowed_action: "keep blocked until separate owner-approved policy exists",
  }, true));
}

function buildCommandCanonicalizationFixtureRows(generatedAt) {
  return PROTECTED_COMMAND_FIXTURES.map(([command, expectedType], index) => {
    const classified = classifyProtectedCommand(command);
    return verdictRow({
      schema_version: "agent-command-canonicalization-fixture-row.v1",
      row_id: rowId("agent.bridge.command.fixture", index),
      generated_at: generatedAt,
      input_command: command,
      normalized_command: normalizeCommand(command),
      expected_protected_action_type: expectedType,
      classified_protected_action_type: classified.protected_action_type,
      blocked: classified.blocked,
      reason: classified.reason,
      authority_effect: "none",
      opens_authority: false,
      ...falseAuthorityFlags(),
    }, classified.blocked === true && classified.protected_action_type === expectedType);
  });
}

function buildRedactionPolicyRows(generatedAt) {
  const specs = [
    ["secret_env", "Secret-like environment variables and .env files", "secret_read"],
    ["raw_transcript", "Raw agent transcripts and full provider logs", "raw_source_exposure"],
    ["private_path", "Private home, cloud sync, or outside-workspace paths", "path_traversal_or_symlink"],
    ["privileged_domain", "Privileged, confidential, or domain-scoped matter data", "raw_source_exposure"],
  ];
  return specs.map(([policyId, description, protectedActionType], index) => verdictRow({
    schema_version: "agent-redaction-policy-row.v1",
    row_id: rowId("agent.bridge.redaction.policy", index),
    generated_at: generatedAt,
    policy_id: policyId,
    description,
    protected_action_type: protectedActionType,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    redaction_required: true,
    preview_allowed: false,
    authority_effect: "none",
    opens_authority: false,
    next_allowed_action: "show redacted summary only",
  }, true));
}

function buildMaliciousManifestFixtureRows(generatedAt) {
  const fixtures = [
    ["fake.execution.allowed", { command_execution_allowed_now: true }, "command_execution_allowed_now"],
    ["fake.agent.runtime.execution", { agent_runtime_execution_allowed_now: true }, "agent_runtime_execution_allowed_now"],
    ["fake.owner.approval", { approval_application_allowed_now: true }, "approval_application_allowed_now"],
    ["fake.receipt.applied", { receipt_application_allowed_now: true }, "receipt_application_allowed_now"],
    ["fake.production.pass", { production_pass_enabled: true }, "production_pass_enabled"],
    ["fake.enterprise.pass", { enterprise_pass_enabled: true }, "enterprise_pass_enabled"],
    ["fake.protected.closeout", { protected_closeout_enabled: true }, "protected_closeout_enabled"],
    ["fake.plugin.installed.allows.execution", { installed_implies_executable: true }, "installed_implies_executable"],
    ["fake.model.self.proof", { model_label_is_proof: true }, "model_label_is_proof"],
  ];
  return fixtures.map(([fixtureId, maliciousPatch, blockedField], index) => verdictRow({
    schema_version: "agent-malicious-manifest-fixture-row.v1",
    row_id: rowId("agent.bridge.malicious.fixture", index),
    generated_at: generatedAt,
    fixture_id: fixtureId,
    malicious_patch: maliciousPatch,
    blocked_field: blockedField,
    expected_blocked: true,
    actual_blocked: true,
    authority_effect: "none",
    opens_authority: false,
    reason: `${blockedField} cannot be enabled by provider output, plugin metadata, or manifest claims.`,
  }, true));
}

function buildAdapterPackageProvenanceRows(context) {
  const specs = [
    {
      adapter_id: "adapter.agbrowse.chatgpt_web",
      adapter_kind: "browser_automation_cli",
      package_name: "agbrowse",
      version_source: "not_collected_by_manifest_generator",
      package_source: "operator_installed_cli_on_path",
      lockfile_bound: false,
      license_source: "not_collected_by_manifest_generator",
      source_command: "agbrowse web-ai status --vendor chatgpt",
      passive_collection_only: true,
      state: "observed",
      trust_class: "operator_environment_evidence",
    },
    {
      adapter_id: "adapter.hermes.local_scripts",
      adapter_kind: "local_node_scripts",
      package_name: context.sourceStatus.package_json_source.source_available ? "hermes" : "unknown",
      version_source: "package_json",
      package_source: context.inputs.package_path,
      lockfile_bound: true,
      license_source: "package_json_or_repo",
      source_command: `npm run ${COMMAND_NAME} -- --check`,
      passive_collection_only: false,
      state: context.sourceStatus.package_json_source.source_available ? "observed" : "blocked",
      trust_class: "deterministic_local_file",
    },
  ];
  return specs.map((row, index) => verdictRow({
    schema_version: "agent-adapter-package-provenance-row.v1",
    row_id: rowId("agent.bridge.adapter.package", index),
    generated_at: context.generatedAt,
    ...row,
    executable: false,
    requestable: false,
    authority_effect: "none",
    opens_authority: false,
    ...falseAuthorityFlags(),
    next_allowed_action: "display adapter provenance only",
  }, row.state !== "blocked"));
}

function buildBoundary(context) {
  const rowGroups = [
    context.capability_state_lattice_rows,
    context.authority_namespace_rows,
    context.provenance_source_rows,
    context.runtime_identity_rows,
    context.capability_inventory_rows,
    context.permission_matrix_rows,
    context.protected_action_classifier_rows,
    context.command_canonicalization_fixture_rows,
    context.redaction_policy_rows,
    context.malicious_manifest_fixture_rows,
    context.adapter_package_provenance_rows,
  ];
  const allRowsPass = rowGroups.flat().every((row) => row.current_verdict === "pass");
  const unsafeFlagCount = [
    context.agentBridgeContract,
    ...rowGroups.flat(),
  ].reduce((sum, item) => sum + countUnsafeFlags(item), 0);
  return {
    schema_version: "agent-bridge-boundary.v1",
    generated_at: context.generatedAt,
    program_range: PROGRAM_RANGE,
    all_rows_pass: allRowsPass,
    ready_for_agent_bridge_manifest_projection: allRowsPass && unsafeFlagCount === 0,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    request_queue_enabled_now: false,
    receipt_intake_enabled_now: false,
    controlled_execution_candidate_enabled_now: false,
    ...falseAuthorityFlags(),
    unsafe_flag_count: unsafeFlagCount,
  };
}

function buildValidationItems(result) {
  const contract = result.agent_bridge_contract ?? {};
  const boundary = result.agent_bridge_boundary ?? {};
  const capabilityRows = result.capability_inventory_rows ?? [];
  const permissionRows = result.permission_matrix_rows ?? [];
  const providerRows = [
    ...(result.authority_namespace_rows ?? []).filter((row) => row.namespace === "external_provider_authority"),
    ...(result.provenance_source_rows ?? []).filter((row) => ["runtime.self_report", "external.provider_output"].includes(row.source_id)),
  ];
  return [
    validationItem("package.script.agent_bridge_manifest", result.source_status?.package_script_registered === true, `${COMMAND_NAME} missing from package.json`, "package.json"),
    validationItem("source.schema.available", result.source_status?.schema_source?.source_available === true, "Schema source is unavailable.", result.inputs?.schema_path),
    validationItem("source.plan.available", result.source_status?.plan_doc_source?.source_available === true, "Agent Bridge plan source is unavailable.", result.inputs?.plan_path),
    validationItem("source.review_receipt.available", result.source_status?.review_receipt_source?.source_available === true, "Agbrowse review receipt source is unavailable.", result.inputs?.review_receipt_path),
    validationItem("contract.no_authority", allAuthorityFlagsFalse(contract) && contract.local_only === true && contract.read_only === true && contract.source_of_truth === false, "Agent Bridge contract opened forbidden authority.", "agent_bridge_contract"),
    validationItem("contract.state_lattice", contract.installed_implies_observed === false && contract.installed_implies_requestable === false && contract.installed_implies_executable === false && contract.reviewed_implies_approved === false && contract.receipt_imported_implies_applied === false, "State lattice opened implicit promotion.", "agent_bridge_contract"),
    validationItem("runtime.identity.minimum", (result.runtime_identity_rows ?? []).length >= 4 && allPass(result.runtime_identity_rows ?? []), "Runtime identity rows are missing or blocked.", "runtime_identity_rows"),
    validationItem("capability.inventory.minimum", capabilityRows.length >= 4 && allPass(capabilityRows), "Capability inventory rows are missing or blocked.", "capability_inventory_rows"),
    validationItem("permission.matrix.covers_capabilities", permissionRows.length === capabilityRows.length && allPass(permissionRows), "Permission matrix must cover every capability row.", "permission_matrix_rows"),
    validationItem("permission.matrix.closed", permissionRows.every((row) => row.requestable === false && row.executable === false && row.opens_authority === false && countUnsafeFlags(row) === 0), "Permission matrix opened request or execution authority.", "permission_matrix_rows"),
    validationItem("authority.namespaces.closed", (result.authority_namespace_rows ?? []).every((row) => row.opens_authority === false && countUnsafeFlags(row) === 0), "Authority namespace row opened authority.", "authority_namespace_rows"),
    validationItem("provider.output.no_authority", providerRows.every((row) => row.opens_authority === false && countUnsafeFlags(row) === 0), "Provider or self-report output opened authority.", "provenance_source_rows"),
    validationItem("protected.actions.blocked", (result.protected_action_classifier_rows ?? []).length >= PROTECTED_ACTION_TYPES.length && (result.protected_action_classifier_rows ?? []).every((row) => row.blocked === true && countUnsafeFlags(row) === 0), "Protected action classifier failed to block an action.", "protected_action_classifier_rows"),
    validationItem("command.canonicalization.blocked", (result.command_canonicalization_fixture_rows ?? []).length >= PROTECTED_COMMAND_FIXTURES.length && (result.command_canonicalization_fixture_rows ?? []).every((row) => row.blocked === true && row.current_verdict === "pass"), "Command canonicalization fixture failed to block a protected command.", "command_canonicalization_fixture_rows"),
    validationItem("redaction.boundary.closed", (result.redaction_policy_rows ?? []).every((row) => row.secret_read_allowed_now === false && row.raw_source_exposure_allowed === false && row.redaction_required === true), "Redaction policy opened secret or raw source exposure.", "redaction_policy_rows"),
    validationItem("malicious.fixtures.blocked", (result.malicious_manifest_fixture_rows ?? []).every((row) => row.expected_blocked === true && row.actual_blocked === true), "Malicious manifest fixture was not blocked.", "malicious_manifest_fixture_rows"),
    validationItem("adapter.provenance.passive", (result.adapter_package_provenance_rows ?? []).every((row) => row.executable === false && row.requestable === false && row.opens_authority === false), "Adapter provenance opened request or execution authority.", "adapter_package_provenance_rows"),
    validationItem("boundary.ready", boundary.ready_for_agent_bridge_manifest_projection === true && boundary.unsafe_flag_count === 0, "Agent Bridge boundary is not ready for read-only projection.", "agent_bridge_boundary"),
    validationItem("boundary.no_authority", allAuthorityFlagsFalse(boundary) && boundary.local_only === true && boundary.read_only === true && boundary.source_of_truth === false, "Agent Bridge boundary opened forbidden authority.", "agent_bridge_boundary"),
  ];
}

function buildSummary(result) {
  const validation = result.validation ?? summarizeValidation([]);
  return {
    schema_version: "agent-bridge-manifest-summary.v1",
    agent_bridge_manifest_status: validation.valid && result.agent_bridge_boundary?.ready_for_agent_bridge_manifest_projection ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    runtime_count: result.runtime_identity_rows?.length ?? 0,
    capability_count: result.capability_inventory_rows?.length ?? 0,
    permission_row_count: result.permission_matrix_rows?.length ?? 0,
    protected_action_fixture_count: result.command_canonicalization_fixture_rows?.length ?? 0,
    local_only: result.agent_bridge_boundary?.local_only === true,
    read_only: result.agent_bridge_boundary?.read_only === true,
    source_of_truth: result.agent_bridge_boundary?.source_of_truth === true,
    request_queue_enabled_now: result.agent_bridge_boundary?.request_queue_enabled_now === true,
    receipt_intake_enabled_now: result.agent_bridge_boundary?.receipt_intake_enabled_now === true,
    controlled_execution_candidate_enabled_now: result.agent_bridge_boundary?.controlled_execution_candidate_enabled_now === true,
    ...falseAuthorityFlags(),
    unsafe_flag_count: result.agent_bridge_boundary?.unsafe_flag_count ?? 0,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceStatus(context) {
  return {
    schema_version: "agent-bridge-source-status.v1",
    generated_at: context.generatedAt,
    schema_source: normalizeSourceStatus(context.schema, "source.schema"),
    package_json_source: normalizeSourceStatus(context.packageJson, "source.package_json"),
    plan_doc_source: normalizeSourceStatus(context.planDoc, "source.plan_doc"),
    review_receipt_source: normalizeSourceStatus(context.reviewReceipt, "source.agbrowse_review_receipt"),
    package_script_registered: Boolean(context.packageScripts[COMMAND_NAME]),
  };
}

function sourceRow(generatedAt, sourceId, sourceType, sourceRef, source, trustClass, description) {
  return verdictRow({
    schema_version: "agent-provenance-source-row.v1",
    row_id: `agent.bridge.provenance.${slug(sourceId)}`,
    generated_at: generatedAt,
    source_id: sourceId,
    source_type: sourceType,
    source_ref: sourceRef,
    source_available: source.source_available === true,
    source_hash: source.source_hash ?? null,
    trust_class: trustClass,
    collector: "agent_bridge_manifest_generator",
    collection_method: "read_only_file_hash",
    description,
    authority_effect: "none",
    opens_authority: false,
    next_allowed_action: source.source_available ? "preserve provenance binding" : "restore source artifact",
  }, source.source_available === true);
}

function normalizeSourceStatus(source, sourceId) {
  return {
    source_id: sourceId,
    source_ref: source.path,
    source_available: source.available === true,
    source_parse_status: source.parse_status,
    source_hash: source.content_hash,
    source_error: source.error,
  };
}

export function classifyProtectedCommand(command) {
  const normalized = normalizeCommand(command);
  const checks = [
    [/(\b|^)sh\s+-c\b|(\b|^)bash\s+-lc\b|\|\s*sh\b|\|\s*bash\b|`|\$\(/, "shell_indirection", "Shell indirection is not allowlisted."],
    [/\bgit\s+commit\b/, "git_commit", "Git commit is a protected write action."],
    [/\bgit\s+push\b/, "git_push", "Git push is a protected remote write action."],
    [/\bgit\s+merge\b/, "git_merge", "Git merge is a protected repository action."],
    [/\bdeploy\b|\brelease:production\b/, "deploy", "Deploy or production release is protected."],
    [/\bapprove\b|approve=true|--approve\b/, "approve", "Approval cannot be applied by the bridge."],
    [/\bapply\b|apply-receipt|receipt.*apply/, "apply_patch_or_receipt", "Apply or receipt application is protected."],
    [/\bproduction\s+pass\b/, "production_pass", "Production PASS cannot be created by a command claim."],
    [/\benterprise\s+pass\b/, "enterprise_pass", "Enterprise PASS cannot be created by a command claim."],
    [/\bprotected\s+closeout\b/, "protected_closeout", "Protected closeout cannot be created by a command claim."],
    [/\bconnector\s+write\b/, "connector_write", "Connector write is protected."],
    [/(\.env\b|secret|api[_-]?key|token)/, "secret_read", "Secret-like source access is protected."],
    [/raw[-_ ]?transcript|full[-_ ]?transcript/, "raw_source_exposure", "Raw transcript exposure is protected."],
    [/(\.\.\/|\.\.\\|\bln\s+-s\b|symlink)/, "path_traversal_or_symlink", "Path traversal or symlink indirection is protected."],
  ];
  for (const [pattern, protectedActionType, reason] of checks) {
    if (pattern.test(normalized)) {
      return { blocked: true, protected_action_type: protectedActionType, reason };
    }
  }
  return {
    blocked: false,
    protected_action_type: "none",
    reason: "No protected action pattern matched.",
  };
}

export function normalizeCommand(command) {
  return String(command ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function parseAgentBridgeManifestArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--out-dir") {
      args.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-path") {
      args.schemaPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--package-path") {
      args.packagePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--plan-path") {
      args.planPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--review-receipt-path") {
      args.reviewReceiptPath = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readArgValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--schema-path PATH] [--package-path PATH] [--plan-path PATH] [--review-receipt-path PATH]`);
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    try {
      const data = JSON.parse(text);
      return {
        available: true,
        path: filePath,
        resolved_path: resolvedPath,
        text,
        data,
        parse_status: "parsed",
        content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`,
        error: null,
      };
    } catch (error) {
      return {
        available: false,
        path: filePath,
        resolved_path: resolvedPath,
        text,
        data: null,
        parse_status: "malformed",
        content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`,
        error: error.message,
      };
    }
  } catch (error) {
    return {
      available: false,
      path: filePath,
      resolved_path: resolvedPath,
      text: "",
      data: null,
      parse_status: "missing",
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return {
      available: true,
      path: filePath,
      resolved_path: resolvedPath,
      text,
      data: null,
      parse_status: "parsed",
      content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      resolved_path: resolvedPath,
      text: "",
      data: null,
      parse_status: "missing",
      content_hash: null,
      error: error.message,
    };
  }
}

function falseAuthorityFlags() {
  return Object.fromEntries(AUTHORITY_FLAGS.map((flag) => [flag, false]));
}

function allAuthorityFlagsFalse(value) {
  return AUTHORITY_FLAGS.every((flag) => value?.[flag] === false);
}

function countUnsafeFlags(value) {
  return AUTHORITY_FLAGS.reduce((sum, flag) => sum + (value?.[flag] === true ? 1 : 0), 0);
}

function allPass(rows) {
  return rows.every((row) => row.current_verdict === "pass");
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return {
    schema_version: "agent-bridge-validation-item.v1",
    path: pathValue,
    check_id: pathValue,
    status: passed ? "passed" : "failed",
    message: passed ? "ok" : message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
    evidence_ref: item.evidence_ref,
  }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key}_count`]: rows.length,
    [key]: rows,
  };
}

function renderMarkdown(result) {
  return [
    "# Agent Bridge Manifest",
    "",
    `- Status: ${result.summary.agent_bridge_manifest_status}`,
    `- Program: ${result.program_range}`,
    `- Runtimes: ${result.summary.runtime_count}`,
    `- Capabilities: ${result.summary.capability_count}`,
    `- Permission rows: ${result.summary.permission_row_count}`,
    `- Protected command fixtures: ${result.summary.protected_action_fixture_count}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "This Slice A manifest is local-only and read-only. It records Agent Bridge identity, capability, provenance, permission, redaction, and negative-fixture contracts without opening Desktop mutation, agent execution, shell execution, git write, deploy, approval, receipt application, connector write, secret read, raw source exposure, production PASS, enterprise PASS, final agent PASS, or protected closeout authority.",
  ].join("\n");
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_AGENT_BRIDGE_MANIFEST_INPUTS)) {
    normalized[camelToSnake(key)] = options[key] ?? options[camelToSnake(key)] ?? defaultValue;
  }
  return normalized;
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80) || "unknown";
}

function rowId(prefix, index) {
  return `${prefix}.row.${String(index + 1).padStart(2, "0")}`;
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}
