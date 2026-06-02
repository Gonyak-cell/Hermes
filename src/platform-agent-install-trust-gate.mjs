import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentAuthorityFreeze } from "./platform-agent-authority-freeze.mjs";

export const DEFAULT_PLATFORM_AGENT_INSTALL_TRUST_GATE_OUT_DIR = "artifacts/platform-agent-install-trust-gate/latest";
export const DEFAULT_PLATFORM_AGENT_INSTALL_TRUST_GATE_INPUTS = {
  schemaPath: "schemas/platform-agent-install-trust-gate.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-install-trust-gate";
const AUTHORITY_COMMAND_NAME = "platform:agent-authority-freeze";
const SCHEMA_VERSION = "platform-agent-install-trust-gate.v1";
const CAPABILITY_ID = "platform.agent_operations.install_trust_gate";
const PROGRAM_RANGE = "P1041-P1121";
const PHASE_RANGE = "P1045-P1056";
const PHASE_SLOT = "P1045";
const PREVIOUS_PHASE_SLOT = "P1044";
const NEXT_PHASE_SLOT = "P1057";
const READY_STATUS = "ready_for_agent_install_trust_gate";

const OBSERVED_PACKAGE = {
  package_name: "hermes-agent",
  observed_version: "0.15.2",
  observed_release_date: "2026-05-29",
  python_requirement: ">=3.11",
  license: "MIT",
  pypi_url: "https://pypi.org/project/hermes-agent/",
  github_url: "https://github.com/NousResearch/hermes-agent",
  docs_install_url: "https://hermes-agent.nousresearch.com/docs/getting-started/installation",
  sdist_filename: "hermes_agent-0.15.2.tar.gz",
  sdist_sha256: "e77892f0d7d5437f7c2f04f862e660bc493fc0253b68704ac106ea3e28dca3ef",
  wheel_filename: "hermes_agent-0.15.2-py3-none-any.whl",
  wheel_sha256: "1a062a3813de8998021a290abaf18489a5c009717b1569855b617ff2caef4b76",
  pypi_trusted_publishing: true,
  pypi_publisher_workflow: "upload_to_pypi.yml on NousResearch/hermes-agent",
  pypi_source_commit: "75cd420b3ba1b83185020c6d4506d7cc53b12e2b",
};

const PROVENANCE_ROWS = [
  ["pypi_project", "pass", "PyPI project exists for hermes-agent.", "pypi"],
  ["observed_version", "pass", "Observed PyPI version is recorded as a pinned install candidate.", "pypi"],
  ["python_requirement", "pass", "Python requirement is captured before installation.", "pypi"],
  ["license_recorded", "pass", "License is recorded as MIT.", "pypi"],
  ["sdist_hash_recorded", "pass", "Source distribution SHA256 is recorded.", "pypi"],
  ["wheel_hash_recorded", "pass", "Wheel SHA256 is recorded.", "pypi"],
  ["trusted_publishing", "pass", "PyPI Trusted Publishing is recorded.", "pypi_attestation"],
  ["source_repository_attested", "pass", "PyPI provenance links to NousResearch/hermes-agent.", "pypi_attestation"],
  ["official_install_docs", "pass", "Official install docs are recorded.", "official_docs"],
  ["github_repository", "pass", "GitHub repository is recorded as official source.", "official_repository"],
];

const INSTALL_MODE_ROWS = [
  {
    install_mode_id: "pipx",
    install_command_candidate: "pipx install hermes-agent==0.15.2",
    rollback_command_candidate: "pipx uninstall hermes-agent",
    current_verdict: "pass",
    trust_tier: "preferred_isolated_cli",
    block_reason: null,
    next_allowed_action: "request human receipt for P1057 pipx install smoke if pipx is available",
  },
  {
    install_mode_id: "repo_local_venv",
    install_command_candidate: "python3 -m venv .hermes-agent-venv && .hermes-agent-venv/bin/python -m pip install hermes-agent==0.15.2",
    rollback_command_candidate: "rm -rf .hermes-agent-venv",
    current_verdict: "pass",
    trust_tier: "preferred_repo_local",
    block_reason: null,
    next_allowed_action: "request human receipt for P1057 repo-local venv install smoke",
  },
  {
    install_mode_id: "docker_container",
    install_command_candidate: "docker run --rm -it nousresearch/hermes-agent:latest hermes --help",
    rollback_command_candidate: "docker image rm nousresearch/hermes-agent:latest",
    current_verdict: "pass",
    trust_tier: "candidate_containerized",
    block_reason: null,
    next_allowed_action: "pin image digest before Docker smoke and mount no repo paths by default",
  },
  {
    install_mode_id: "one_line_git_main_installer",
    install_command_candidate: "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
    rollback_command_candidate: "remove ~/.hermes/hermes-agent and ~/.local/bin/hermes after review",
    current_verdict: "blocked",
    trust_tier: "protected_script",
    block_reason: "unpinned_main_branch_and_shell_pipe_install",
    next_allowed_action: "download installer as evidence, inspect checksum, and require human receipt before execution",
  },
  {
    install_mode_id: "global_pip_install",
    install_command_candidate: "python3 -m pip install hermes-agent",
    rollback_command_candidate: "python3 -m pip uninstall hermes-agent",
    current_verdict: "blocked",
    trust_tier: "global_environment_mutation",
    block_reason: "global_python_environment_mutation",
    next_allowed_action: "use pipx or repo-local venv instead",
  },
  {
    install_mode_id: "root_or_sudo_install",
    install_command_candidate: "sudo install or sudo curl installer execution",
    rollback_command_candidate: "manual root-level removal plan required",
    current_verdict: "blocked",
    trust_tier: "system_mutation",
    block_reason: "root_or_system_level_install_forbidden",
    next_allowed_action: "keep installation per-user or repo-local unless separate admin receipt exists",
  },
];

const SMOKE_ROWS = [
  ["version_probe", "hermes --version", "captures installed CLI version"],
  ["doctor_probe", "hermes doctor", "captures environment and missing dependency report"],
  ["config_probe", "hermes config check", "checks config without adding provider secrets"],
  ["help_probe", "hermes --help", "confirms CLI entrypoint exists without starting a runtime"],
  ["tool_policy_probe", "hermes tools --help", "confirms tool policy surface without enabling all tools"],
];

export async function runPlatformAgentInstallTrustGate(options = {}) {
  const result = await buildPlatformAgentInstallTrustGate(options);
  if (options.write !== false) await writePlatformAgentInstallTrustGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent install trust gate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentInstallTrustGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_INSTALL_TRUST_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.agent_operations_phase_ledger_path);
  const authorityFreeze = await buildPlatformAgentAuthorityFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });
  const policy = buildTrustPolicy(generatedAt, authorityFreeze);
  const provenanceRows = buildProvenanceRows();
  const installRows = buildInstallModeRows();
  const smokeRows = buildSmokeRows();
  const rollbackRows = buildRollbackRows(installRows);
  const claimRows = buildClaimRows({ provenanceRows, installRows, smokeRows, rollbackRows });
  const closeoutRows = buildCloseoutRows({ policy, authorityFreeze, provenanceRows, installRows, smokeRows, rollbackRows, claimRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, authorityFreeze, policy, provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, authorityFreeze, policy, provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, authorityFreeze, provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_install_trust_gate_id: `platform-agent-install-trust-gate.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_install_trust_anchor: anchor,
    source_agent_authority_freeze_summary: authorityFreeze.summary,
    agent_install_trust_policy: policy,
    agent_package_observation: buildPackageObservation(),
    agent_package_provenance_rows: provenanceRows,
    agent_install_mode_rows: installRows,
    agent_smoke_command_rows: smokeRows,
    agent_install_rollback_rows: rollbackRows,
    agent_install_trust_claim_rows: claimRows,
    agent_install_trust_closeout_rows: closeoutRows,
    agent_install_trust_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_install_trust_gate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.platform_agent_install_trust_gate_id = result.platform_agent_install_trust_gate_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentInstallTrustGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-install-trust-gate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-install-trust-policy.json"), result.agent_install_trust_policy);
  await writeJson(path.join(outDir, "agent-package-observation.json"), result.agent_package_observation);
  await writeJson(path.join(outDir, "agent-package-provenance-rows.json"), collectionEnvelope("agent-package-provenance-rows.v1", "agent_package_provenance_rows", result.agent_package_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-mode-rows.json"), collectionEnvelope("agent-install-mode-rows.v1", "agent_install_mode_rows", result.agent_install_mode_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-smoke-command-rows.json"), collectionEnvelope("agent-smoke-command-rows.v1", "agent_smoke_command_rows", result.agent_smoke_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-rollback-rows.json"), collectionEnvelope("agent-install-rollback-rows.v1", "agent_install_rollback_rows", result.agent_install_rollback_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-trust-claim-rows.json"), collectionEnvelope("agent-install-trust-claim-rows.v1", "agent_install_trust_claim_rows", result.agent_install_trust_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-trust-closeout-rows.json"), collectionEnvelope("agent-install-trust-closeout-rows.v1", "agent_install_trust_closeout_rows", result.agent_install_trust_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-trust-gate-rows.json"), collectionEnvelope("agent-install-trust-gate-rows.v1", "agent_install_trust_gate_rows", result.agent_install_trust_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-install-trust-gate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentInstallTrustGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentInstallTrustGate(args);
    console.log(`Platform agent install trust gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_install_trust_gate_status}`);
    console.log(`Observed package: ${result.summary.observed_package_version}`);
    console.log(`Install modes: pass ${result.summary.pass_install_mode_count}, blocked ${result.summary.blocked_install_mode_count}`);
    console.log(`Smoke commands: ${result.summary.smoke_command_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Install execution allowed: ${result.summary.install_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildTrustPolicy(generatedAt, authorityFreeze) {
  return {
    schema_version: "platform-agent-install-trust-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_agent_authority_freeze_ref: authorityFreeze.platform_agent_authority_freeze_id,
    source_agent_authority_freeze_status: authorityFreeze.summary.platform_agent_authority_freeze_status,
    source_authority_verdict: authorityFreeze.summary.verdict_authority,
    install_trust_surface_creation_allowed: true,
    install_execution_allowed_now: false,
    package_download_allowed_now: false,
    package_install_allowed_now: false,
    runtime_execution_allowed_now: false,
    terminal_command_execution_allowed_now: false,
    mcp_server_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_or_gateway_start_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    yolo_mode_allowed: false,
    approval_off_allowed: false,
    secret_forwarding_allowed: false,
    global_python_mutation_allowed: false,
    root_or_sudo_install_allowed: false,
    curl_pipe_bash_allowed_now: false,
    raw_client_or_vdr_context_allowed: false,
    allowed_install_mode_candidates: ["pipx", "repo_local_venv", "docker_container"],
    blocked_install_mode_candidates: ["one_line_git_main_installer", "global_pip_install", "root_or_sudo_install"],
    required_before_p1057_install: ["human_receipt_ref", "rollback_command_candidate", "version_pin", "hash_or_attestation_ref", "doctor_smoke_plan", "empty_secret_allowlist"],
    next_allowed_action: "advance to P1057 isolated install only after human receipt selects one PASS install mode",
    created_at: generatedAt,
  };
}

function buildPackageObservation() {
  return {
    schema_version: "agent-package-observation.v1",
    observed_at: "2026-06-02T00:00:00.000Z",
    ...OBSERVED_PACKAGE,
  };
}

function buildProvenanceRows() {
  return PROVENANCE_ROWS.map(([provenanceId, verdict, description, sourceType], index) => ({
    schema_version: "agent-package-provenance-row.v1",
    row_id: `agent-package-provenance.row.${String(index + 1).padStart(3, "0")}`,
    provenance_id: provenanceId,
    current_verdict: verdict,
    source_type: sourceType,
    description,
    package_name: OBSERVED_PACKAGE.package_name,
    observed_version: OBSERVED_PACKAGE.observed_version,
    evidence_ref: `evidence.platform.agent.package.${provenanceId}`,
    reviewer_ref: "reviewer.platform.agent_supply_chain",
    hard_gate_ref: `gate.platform.agent.package.${provenanceId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "keep as source evidence for P1057 install selection",
  }));
}

function buildInstallModeRows() {
  return INSTALL_MODE_ROWS.map((row, index) => ({
    schema_version: "agent-install-mode-row.v1",
    row_id: `agent-install-mode.row.${String(index + 1).padStart(3, "0")}`,
    package_name: OBSERVED_PACKAGE.package_name,
    observed_version: OBSERVED_PACKAGE.observed_version,
    install_execution_allowed_now: false,
    package_download_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    human_receipt_ref: row.current_verdict === "pass" ? `receipt.platform.agent.install.${row.install_mode_id}` : null,
    evidence_ref: `evidence.platform.agent.install_mode.${row.install_mode_id}`,
    reviewer_ref: "reviewer.platform.agent_install_mode",
    hard_gate_ref: `gate.platform.agent.install_mode.${row.install_mode_id}`,
    responsible_owner: "platform_agent_owner",
    ...row,
  }));
}

function buildSmokeRows() {
  return SMOKE_ROWS.map(([smoke_id, commandCandidate, purpose], index) => ({
    schema_version: "agent-smoke-command-row.v1",
    row_id: `agent-smoke-command.row.${String(index + 1).padStart(3, "0")}`,
    smoke_id,
    command_candidate: commandCandidate,
    purpose,
    current_verdict: "blocked",
    block_reason: "install_not_yet_performed",
    command_execution_allowed_now: false,
    raw_stdout_storage_allowed: false,
    provider_secret_required: false,
    evidence_ref: `evidence.platform.agent.smoke.${smoke_id}`,
    reviewer_ref: "reviewer.platform.agent_smoke",
    hard_gate_ref: `gate.platform.agent.smoke.${smoke_id}`,
    rollback_target_ref: `rollback.platform.agent.install.${smoke_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "run only after P1057 isolated install human receipt",
  }));
}

function buildRollbackRows(installRows) {
  return installRows.map((row, index) => ({
    schema_version: "agent-install-rollback-row.v1",
    row_id: `agent-install-rollback.row.${String(index + 1).padStart(3, "0")}`,
    install_mode_id: row.install_mode_id,
    current_verdict: row.rollback_command_candidate ? "pass" : "blocked",
    rollback_command_candidate: row.rollback_command_candidate,
    rollback_execution_allowed_now: false,
    evidence_ref: `evidence.platform.agent.rollback.${row.install_mode_id}`,
    reviewer_ref: "reviewer.platform.agent_install_rollback",
    hard_gate_ref: `gate.platform.agent.rollback.${row.install_mode_id}`,
    block_reason: row.rollback_command_candidate ? null : "missing_rollback_command",
    responsible_owner: "platform_agent_owner",
    next_allowed_action: row.rollback_command_candidate ? "attach rollback candidate before P1057 install" : "define rollback command before install selection",
  }));
}

function buildClaimRows({ provenanceRows, installRows, smokeRows, rollbackRows }) {
  const provenanceClaims = provenanceRows.map((row) => passClaim({
    claimId: `claim.platform.agent.package.${row.provenance_id}`,
    claimType: "package_provenance",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    nextAllowedAction: row.next_allowed_action,
  }));
  const installClaims = installRows.map((row) => row.current_verdict === "pass"
    ? passClaim({
      claimId: `claim.platform.agent.install_mode.${row.install_mode_id}`,
      claimType: "install_mode_candidate",
      sourceRef: row.row_id,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      humanReceiptRef: row.human_receipt_ref,
      nextAllowedAction: row.next_allowed_action,
    })
    : blockedClaim({
      claimId: `claim.platform.agent.install_mode.${row.install_mode_id}`,
      claimType: "install_mode_candidate",
      sourceRef: row.row_id,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      blockReason: row.block_reason,
      nextAllowedAction: row.next_allowed_action,
    }));
  const smokeClaims = smokeRows.map((row) => blockedClaim({
    claimId: `claim.platform.agent.smoke.${row.smoke_id}`,
    claimType: "doctor_smoke_command",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    blockReason: row.block_reason,
    nextAllowedAction: row.next_allowed_action,
  }));
  const rollbackClaims = rollbackRows.map((row) => passClaim({
    claimId: `claim.platform.agent.rollback.${row.install_mode_id}`,
    claimType: "install_rollback_candidate",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    nextAllowedAction: row.next_allowed_action,
  }));
  return [...provenanceClaims, ...installClaims, ...smokeClaims, ...rollbackClaims].map((row, index) => ({
    ...row,
    row_id: `agent-install-trust-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ policy, authorityFreeze, provenanceRows, installRows, smokeRows, rollbackRows, claimRows }) {
  const rows = [
    ["source_authority_freeze_ready", authorityFreeze.summary.platform_agent_authority_freeze_status === "ready_for_agent_authority_freeze", "source_agent_authority_freeze"],
    ["package_provenance_complete", provenanceRows.length >= 10 && provenanceRows.every((row) => row.current_verdict === "pass"), "agent_package_provenance_rows"],
    ["pypi_hashes_recorded", Boolean(OBSERVED_PACKAGE.sdist_sha256 && OBSERVED_PACKAGE.wheel_sha256), "agent_package_observation"],
    ["trusted_publishing_recorded", OBSERVED_PACKAGE.pypi_trusted_publishing === true, "agent_package_observation"],
    ["preferred_install_modes_present", installRows.filter((row) => row.current_verdict === "pass").length >= 3, "agent_install_mode_rows"],
    ["unsafe_install_modes_blocked", installRows.filter((row) => row.current_verdict === "blocked").length >= 3, "agent_install_mode_rows"],
    ["doctor_smoke_deferred", smokeRows.every((row) => row.current_verdict === "blocked" && row.command_execution_allowed_now === false), "agent_smoke_command_rows"],
    ["rollback_candidates_present", rollbackRows.every((row) => row.current_verdict === "pass" && row.rollback_command_candidate), "agent_install_rollback_rows"],
    ["install_execution_still_disabled", policy.install_execution_allowed_now === false && policy.package_download_allowed_now === false, "agent_install_trust_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_install_trust_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-install-trust-closeout-row.v1",
    row_id: `agent-install-trust-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    evidence_ref: `evidence.platform.agent.install_trust.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_install_trust_closeout",
    hard_gate_ref: `gate.platform.agent.install_trust.closeout.${closeoutId}`,
    source_ref: sourceRef,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1056 closeout`,
  }));
}

function buildAnchor({ packageJson, phaseLedger, authorityFreeze, policy, provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-install-trust-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: AUTHORITY_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    phase_ledger_present: phaseLedger.available,
    source_agent_authority_freeze_status: authorityFreeze.summary.platform_agent_authority_freeze_status,
    install_execution_allowed_now: policy.install_execution_allowed_now,
    package_download_allowed_now: policy.package_download_allowed_now,
    provenance_count: provenanceRows.length,
    install_mode_count: installRows.length,
    smoke_command_count: smokeRows.length,
    rollback_count: rollbackRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, phaseLedger, authorityFreeze, policy, provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const authorityCommand = `npm run ${AUTHORITY_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_authority_freeze", validate.indexOf(command) > validate.indexOf(authorityCommand) && validate.indexOf(authorityCommand) >= 0, "package.json scripts.validate"],
    ["phase_ledger_declares_install_trust", phaseLedger.available && ["P1045-P1056", COMMAND_NAME, "Supply Chain And Install Trust Gate"].every((token) => phaseLedger.text.includes(token)), "docs/hermes-agent-operations-phase-ledger.md"],
    ["source_authority_freeze_ready", authorityFreeze.summary.platform_agent_authority_freeze_status === "ready_for_agent_authority_freeze", "source_agent_authority_freeze_summary"],
    ["package_provenance_complete", provenanceRows.length >= 10 && provenanceRows.every((row) => row.current_verdict === "pass"), "agent_package_provenance_rows"],
    ["install_modes_partitioned", installRows.filter((row) => row.current_verdict === "pass").length >= 3 && installRows.filter((row) => row.current_verdict === "blocked").length >= 3, "agent_install_mode_rows"],
    ["smoke_commands_deferred", smokeRows.every((row) => row.current_verdict === "blocked" && row.command_execution_allowed_now === false), "agent_smoke_command_rows"],
    ["rollback_candidates_ready", rollbackRows.every((row) => row.current_verdict === "pass"), "agent_install_rollback_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_install_trust_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_install_trust_closeout_rows"],
    ["no_install_or_download", policy.install_execution_allowed_now === false && policy.package_download_allowed_now === false && policy.package_install_allowed_now === false, "agent_install_trust_policy"],
    ["unsafe_modes_blocked", policy.curl_pipe_bash_allowed_now === false && policy.global_python_mutation_allowed === false && policy.root_or_sudo_install_allowed === false, "agent_install_trust_policy"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-install-trust-gate-row.v1",
    row_id: `agent-install-trust-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.install_trust.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_install_trust_gate",
    hard_gate_ref: `gate.platform.agent.install_trust.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    install_execution_performed_by_gate: false,
    package_download_performed_by_gate: false,
    command_execution_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1056 closeout`,
  }));
}

function buildValidationItems({ gateRows, policy, authorityFreeze, provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All install trust gates must be ready."],
    ["source.ready", authorityFreeze.summary.platform_agent_authority_freeze_status === "ready_for_agent_authority_freeze", "P1041 authority source must be ready."],
    ["policy.no_install", policy.install_execution_allowed_now === false, "P1045-P1056 must not install Hermes Agent."],
    ["policy.no_download", policy.package_download_allowed_now === false, "P1045-P1056 must not download packages."],
    ["provenance.complete", provenanceRows.length >= 10, "Package provenance rows must be complete."],
    ["install_modes.partitioned", installRows.filter((row) => row.current_verdict === "pass").length >= 3 && installRows.filter((row) => row.current_verdict === "blocked").length >= 3, "Install modes must be partitioned into PASS candidates and documented BLOCK."],
    ["smoke.deferred", smokeRows.every((row) => row.current_verdict === "blocked"), "Doctor smoke commands must be deferred until install."],
    ["rollback.present", rollbackRows.every((row) => row.current_verdict === "pass"), "Each install mode must have rollback candidate."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_install_trust_gate", passed, message));
}

function isSupportedClaimState(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  return false;
}

function passClaim({ claimId, claimType, sourceRef, evidenceRef, reviewerRef, hardGateRef, humanReceiptRef = null, nextAllowedAction }) {
  return {
    schema_version: "agent-install-trust-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: null,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim({ claimId, claimType, sourceRef, evidenceRef, reviewerRef, hardGateRef, blockReason, nextAllowedAction }) {
  return {
    schema_version: "agent-install-trust-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: null,
    block_reason: blockReason,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildSummary({ provenanceRows, installRows, smokeRows, rollbackRows, claimRows, closeoutRows, gateRows, validation }) {
  return {
    platform_agent_install_trust_gate_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    observed_package_version: OBSERVED_PACKAGE.observed_version,
    observed_release_date: OBSERVED_PACKAGE.observed_release_date,
    provenance_count: provenanceRows.length,
    install_mode_count: installRows.length,
    pass_install_mode_count: installRows.filter((row) => row.current_verdict === "pass").length,
    blocked_install_mode_count: installRows.filter((row) => row.current_verdict === "blocked").length,
    smoke_command_count: smokeRows.length,
    rollback_count: rollbackRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    install_execution_allowed_now: false,
    package_download_allowed_now: false,
    runtime_execution_allowed_now: false,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Install Trust Gate",
    "",
    `Status: ${result.summary.platform_agent_install_trust_gate_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Observed package: hermes-agent ${result.summary.observed_package_version}`,
    `Install modes: ${result.summary.pass_install_mode_count} PASS candidates / ${result.summary.blocked_install_mode_count} documented BLOCK`,
    `Claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Frozen Policy",
    "",
    "- Install execution allowed now: false",
    "- Package download allowed now: false",
    "- Runtime execution allowed now: false",
    "- Preferred candidates: pipx, repo-local venv, docker container",
    "- Blocked candidates: curl pipe bash, global pip, root/sudo install",
    "",
    "## Next Allowed Action",
    "",
    result.agent_install_trust_policy.next_allowed_action,
  ];
  return `${lines.join("\n")}\n`;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function validateChainIncludes(packageJson, commandName) {
  const validate = packageJson.data?.scripts?.validate ?? "";
  return validate.includes(`npm run ${commandName} -- --check`);
}

function validationItem(id, category, passed, message) {
  return {
    id,
    category,
    passed,
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_AGENT_INSTALL_TRUST_GATE_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, path: filePath, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--phase-ledger") {
      args.agentOperationsPhaseLedgerPath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-install-trust-gate.mjs [--check] [--out-dir DIR]\n\nCreates the P1045-P1056 Hermes Agent install trust gate without downloading or installing packages.`);
}
