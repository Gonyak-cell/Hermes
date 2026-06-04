import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformDomainPackEcosystem } from "./platform-domain-pack-ecosystem.mjs";

export const DEFAULT_PLATFORM_PRODUCTION_GOVERNANCE_WORK_OS_FREEZE_OUT_DIR = "artifacts/platform-production-governance-work-os-freeze/latest";
export const DEFAULT_PLATFORM_PRODUCTION_GOVERNANCE_WORK_OS_FREEZE_INPUTS = {
  schemaPath: "schemas/platform-production-governance-work-os-freeze.schema.json",
  packagePath: "package.json",
  domainPackEcosystemLedgerPath: "docs/hermes-domain-pack-ecosystem.md",
  productionGovernanceLedgerPath: "docs/hermes-production-governance-work-os-freeze.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:production-governance-work-os-freeze";
const SOURCE_COMMAND_NAME = "platform:domain-pack-ecosystem";
const SCHEMA_VERSION = "platform-production-governance-work-os-freeze.v1";
const CAPABILITY_ID = "platform.production_governance_work_os_freeze";
const READY_STATUS = "ready_for_platform_production_governance_work_os_freeze";
const SOURCE_READY_STATUS = "ready_for_platform_domain_pack_ecosystem";
const PROGRAM_RANGE = "P3041-P3200";
const PHASE_RANGE = "P3041-P3200";
const PHASE_SLOT = "P3041";
const PREVIOUS_PHASE_SLOT = "P3040";
const NEXT_PHASE_SLOT = "P3200";

const COMPONENT_SPECS = [
  ["ai_risk_governance_contract", "AI risk, model, Agent authority, protected action, legal safety, trading safety, privacy, and security contract"],
  ["supply_chain_contract", "Dependency, package, schema, artifact provenance, secret scan, and license contract"],
  ["backup_restore_contract", "Backup snapshot, restore drill, degraded mode, audit export, and disaster recovery contract"],
  ["incident_response_contract", "Incident runbook, severity routing, owner escalation, evidence capture, and postmortem contract"],
  ["release_readiness_contract", "Core validation, phase chain, domain pack, handbook, dashboard/API sync, artifact manifest, and signoff ledger contract"],
  ["work_os_maturity_contract", "L0-L7 maturity claim contract with L6/L7 final declaration closed until live closed-loop evidence exists"],
  ["domain_rollout_freeze_contract", "Domain rollout, PASS owner, final authority, and pack rollout freeze contract"],
  ["final_p3200_closeout_contract", "P3200 final invariant and post-P3200 rollout prerequisite contract"],
];

const AI_RISK_SPECS = [
  ["model_policy", "Model selection, model behavior, evaluation, and downgrade policy"],
  ["agent_authority", "Agent authority, delegation, and final PASS prohibition policy"],
  ["protected_action", "Protected action hard gate and human reviewer policy"],
  ["legal_safety", "Legal work product, client advice, filing, and attorney approval policy"],
  ["trading_safety", "Trading live action, broker write, exchange write, and risk override policy"],
  ["privacy_security", "Privacy, privilege, secret, restricted material, and cross-domain boundary policy"],
];

const SUPPLY_CHAIN_SPECS = [
  ["dependency_lock", "Dependency lock and reproducibility policy"],
  ["package_integrity", "Package source, checksum, and tamper evidence policy"],
  ["schema_integrity", "Schema compatibility and contract integrity policy"],
  ["artifact_provenance", "Artifact source, timestamp, hash, owner, and retention policy"],
  ["secret_scan", "Secret scan, redaction, and raw material leakage policy"],
  ["license_policy", "License, attribution, and restricted dependency policy"],
];

const RESILIENCE_SPECS = [
  ["backup_snapshot", "Backup snapshot contract"],
  ["restore_drill", "Restore drill and recovery evidence contract"],
  ["incident_runbook", "Incident runbook and severity routing contract"],
  ["degraded_mode", "Degraded mode and fail-closed operation contract"],
  ["audit_export", "Audit export and evidence retention contract"],
  ["disaster_recovery", "Disaster recovery and owner closeout contract"],
];

const RELEASE_READINESS_SPECS = [
  ["core_validation", "Core validation and package script chain"],
  ["phase_chain_validation", "P1200-P3200 phase chain validation"],
  ["domain_pack_validation", "Domain pack ecosystem validation"],
  ["operator_handbook", "Operator handbook and human decision surface"],
  ["dashboard_api_sync", "Dashboard/API projection sync"],
  ["artifact_manifest", "Artifact manifest, provenance, and retention"],
  ["signoff_ledger", "Signoff ledger and PASS owner closeout"],
];

const MATURITY_SPECS = [
  ["l0_read_only", "Read-only evidence and status visibility"],
  ["l4_hard_gate", "Hard gate before safety or protected action claims"],
  ["l5_human_receipt", "Human receipt before execution, write, or protected action"],
  ["l6_closed_loop", "Closed-loop operation with evidence, owner, rollback, and incident loop"],
  ["l7_work_os_declaration", "Work OS declaration with live closed-loop evidence and enterprise PASS ownership"],
];

const FREEZE_SPECS = [
  ["no_evidence_no_pass", "No evidence means no PASS"],
  ["no_owner_no_rollout", "No PASS owner means no rollout"],
  ["no_receipt_no_execution", "No receipt means no execution or write"],
  ["no_reviewer_no_protected_action", "No reviewer means no protected action"],
  ["no_rollback_no_write", "No rollback means no controlled write"],
  ["no_grounded_recall_no_memory_claim", "No grounded recall means no memory claim"],
  ["no_hard_gate_no_safety_claim", "No hard gate means no safety claim"],
  ["no_l6_no_work_os_claim", "No L6 closed loop means no Work OS claim"],
];

const FINAL_AUTHORITY_SPECS = [
  ["legal_final", "Legal analysis, client advice, filing, and final legal work product"],
  ["release_final", "Release decision, release notes, merge, deploy, and rollback approval"],
  ["production_final", "Production readiness, production rollout, and production incident closeout"],
  ["trading_live_final", "Live order, broker write, exchange write, risk override, and auto-trading authority"],
  ["client_output_final", "Client-facing deliverable, external publication, and final artifact approval"],
  ["pack_rollout_final", "Domain pack rollout, registry publish, contribution merge, and compatibility exception"],
];

const HANDOFF_SPECS = [
  ["p3200_final_freeze", "P3200", "Final freeze can verify production governance and Work OS claim prerequisites."],
  ["post_p3200_runtime_rollout", "Post-P3200", "Runtime rollout may be planned only after receipts, evidence, owners, rollback, and incident controls are live."],
  ["post_p3200_incident_loop", "Post-P3200", "Incident loop may run only with evidence capture, owner escalation, and postmortem closeout."],
];

export async function runPlatformProductionGovernanceWorkOsFreeze(options = {}) {
  const result = await buildPlatformProductionGovernanceWorkOsFreeze(options);
  if (options.write !== false) await writePlatformProductionGovernanceWorkOsFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform production governance Work OS freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformProductionGovernanceWorkOsFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_PRODUCTION_GOVERNANCE_WORK_OS_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const domainPackEcosystemLedger = await readTextSource(inputs.domain_pack_ecosystem_ledger_path);
  const productionGovernanceLedger = await readTextSource(inputs.production_governance_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceDomainPackEcosystem = options.sourceDomainPackEcosystem ?? await buildPlatformDomainPackEcosystem({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    domainPackEcosystemLedgerPath: inputs.domain_pack_ecosystem_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const aiRiskRows = buildAiRiskRows();
  const supplyChainRows = buildSupplyChainRows();
  const resilienceRows = buildResilienceRows();
  const releaseReadinessRows = buildReleaseReadinessRows();
  const maturityRows = buildMaturityRows();
  const freezeRows = buildFreezeRows();
  const finalAuthorityRows = buildFinalAuthorityRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, domainPackEcosystemLedger, productionGovernanceLedger, roadmapDoc, sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows });
  const guardRows = buildGuardRows({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows });
  const boundary = buildBoundary({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, domainPackEcosystemLedger, productionGovernanceLedger, roadmapDoc, sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_production_governance_work_os_freeze_id: `platform-production-governance-work-os-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    production_governance_anchor: anchor,
    source_domain_pack_ecosystem_summary: sourceDomainPackEcosystem.summary,
    production_governance_manifest: manifest,
    production_governance_component_rows: componentRows,
    ai_risk_governance_rows: aiRiskRows,
    supply_chain_governance_rows: supplyChainRows,
    resilience_governance_rows: resilienceRows,
    release_readiness_rows: releaseReadinessRows,
    work_os_maturity_rows: maturityRows,
    production_freeze_invariant_rows: freezeRows,
    final_authority_rows: finalAuthorityRows,
    production_governance_handoff_rows: handoffRows,
    production_governance_guard_rows: guardRows,
    production_governance_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_production_governance_work_os_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_production_governance_work_os_freeze_id = result.platform_production_governance_work_os_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformProductionGovernanceWorkOsFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-production-governance-work-os-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "production-governance-manifest.json"), result.production_governance_manifest);
  await writeJson(path.join(outDir, "production-governance-component-rows.json"), collectionEnvelope("production-governance-component-rows.v1", "production_governance_component_rows", result.production_governance_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "ai-risk-governance-rows.json"), collectionEnvelope("ai-risk-governance-rows.v1", "ai_risk_governance_rows", result.ai_risk_governance_rows, result.generated_at));
  await writeJson(path.join(outDir, "supply-chain-governance-rows.json"), collectionEnvelope("supply-chain-governance-rows.v1", "supply_chain_governance_rows", result.supply_chain_governance_rows, result.generated_at));
  await writeJson(path.join(outDir, "resilience-governance-rows.json"), collectionEnvelope("resilience-governance-rows.v1", "resilience_governance_rows", result.resilience_governance_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-readiness-rows.json"), collectionEnvelope("release-readiness-rows.v1", "release_readiness_rows", result.release_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-maturity-rows.json"), collectionEnvelope("work-os-maturity-rows.v1", "work_os_maturity_rows", result.work_os_maturity_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-freeze-invariant-rows.json"), collectionEnvelope("production-freeze-invariant-rows.v1", "production_freeze_invariant_rows", result.production_freeze_invariant_rows, result.generated_at));
  await writeJson(path.join(outDir, "final-authority-rows.json"), collectionEnvelope("final-authority-rows.v1", "final_authority_rows", result.final_authority_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-governance-handoff-rows.json"), collectionEnvelope("production-governance-handoff-rows.v1", "production_governance_handoff_rows", result.production_governance_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-governance-guard-rows.json"), collectionEnvelope("production-governance-guard-rows.v1", "production_governance_guard_rows", result.production_governance_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-governance-boundary.json"), result.production_governance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-production-governance-work-os-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformProductionGovernanceWorkOsFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformProductionGovernanceWorkOsFreeze(args);
    console.log(`Platform production governance Work OS freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_production_governance_work_os_freeze_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`AI risk rows: ${result.summary.ai_risk_count}`);
    console.log(`Supply chain rows: ${result.summary.supply_chain_count}`);
    console.log(`Release readiness rows: ${result.summary.release_readiness_count}`);
    console.log(`Work OS maturity rows: ${result.summary.work_os_maturity_count}`);
    console.log(`P3200 final freeze candidate: ${result.summary.p3200_final_freeze_candidate}`);
    console.log(`Production ready claimed now: ${result.summary.production_ready_claimed_now}`);
    console.log(`Work OS final claim now: ${result.summary.work_os_claim_finalized_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "production-governance-component-row.v1",
    row_id: `production.governance.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.production_governance.component.${componentId}`,
    reviewer_ref: "reviewer.platform_production_governance",
    hard_gate_ref: `gate.platform.production_governance.component.${componentId}`,
    responsible_owner: "platform_governance_owner",
    next_allowed_action: "preserve as P3200 freeze precondition",
  }));
}

function buildAiRiskRows() {
  return AI_RISK_SPECS.map(([riskId, description], index) => passRow({
    schema_version: "ai-risk-governance-row.v1",
    row_id: `ai.risk.governance.row.${String(index + 1).padStart(2, "0")}`,
    risk_id: riskId,
    risk_status: "policy_contract",
    description,
    evidence_required: true,
    reviewer_required: true,
    hard_gate_required: true,
    human_final_authority_required: true,
    agent_final_pass_allowed_now: false,
    protected_action_allowed_now: false,
    evidence_ref: `evidence.platform.production_governance.ai_risk.${riskId}`,
    reviewer_ref: "reviewer.platform_ai_risk",
    hard_gate_ref: `gate.platform.production_governance.ai_risk.${riskId}`,
    responsible_owner: "platform_ai_risk_owner",
    next_allowed_action: "attach evaluation and reviewer evidence before safety claims",
  }));
}

function buildSupplyChainRows() {
  return SUPPLY_CHAIN_SPECS.map(([supplyChainId, description], index) => passRow({
    schema_version: "supply-chain-governance-row.v1",
    row_id: `supply.chain.governance.row.${String(index + 1).padStart(2, "0")}`,
    supply_chain_id: supplyChainId,
    supply_chain_status: "policy_contract",
    description,
    evidence_required: true,
    integrity_check_required: true,
    secret_scan_required: supplyChainId === "secret_scan",
    package_or_schema_change_allowed_now: false,
    production_dependency_allowed_now: false,
    evidence_ref: `evidence.platform.production_governance.supply_chain.${supplyChainId}`,
    reviewer_ref: "reviewer.platform_supply_chain",
    hard_gate_ref: `gate.platform.production_governance.supply_chain.${supplyChainId}`,
    responsible_owner: "platform_supply_chain_owner",
    next_allowed_action: "run supply-chain evidence gates before production claim",
  }));
}

function buildResilienceRows() {
  return RESILIENCE_SPECS.map(([resilienceId, description], index) => passRow({
    schema_version: "resilience-governance-row.v1",
    row_id: `resilience.governance.row.${String(index + 1).padStart(2, "0")}`,
    resilience_id: resilienceId,
    resilience_status: "policy_contract",
    description,
    evidence_required: true,
    owner_required: true,
    drill_or_runbook_required: true,
    restore_verified_now: false,
    incident_loop_enabled_now: false,
    production_resilience_claim_allowed_now: false,
    evidence_ref: `evidence.platform.production_governance.resilience.${resilienceId}`,
    reviewer_ref: "reviewer.platform_resilience",
    hard_gate_ref: `gate.platform.production_governance.resilience.${resilienceId}`,
    responsible_owner: "platform_resilience_owner",
    next_allowed_action: "capture drill evidence before resilience claim",
  }));
}

function buildReleaseReadinessRows() {
  return RELEASE_READINESS_SPECS.map(([releaseId, description], index) => passRow({
    schema_version: "release-readiness-row.v1",
    row_id: `release.readiness.row.${String(index + 1).padStart(2, "0")}`,
    release_id: releaseId,
    release_status: "readiness_contract",
    description,
    evidence_required: true,
    reviewer_required: true,
    pass_owner_required: true,
    release_gate_run_now: false,
    release_allowed_now: false,
    production_ready_claim_allowed_now: false,
    evidence_ref: `evidence.platform.production_governance.release.${releaseId}`,
    reviewer_ref: "reviewer.platform_release_readiness",
    hard_gate_ref: `gate.platform.production_governance.release.${releaseId}`,
    responsible_owner: "platform_release_owner",
    next_allowed_action: "run release readiness gate before release or production claim",
  }));
}

function buildMaturityRows() {
  return MATURITY_SPECS.map(([levelId, description], index) => passRow({
    schema_version: "work-os-maturity-row.v1",
    row_id: `work.os.maturity.row.${String(index + 1).padStart(2, "0")}`,
    maturity_id: levelId,
    maturity_status: "claim_contract",
    description,
    evidence_required: true,
    pass_owner_required: true,
    hard_gate_required: true,
    live_closed_loop_required: levelId === "l6_closed_loop" || levelId === "l7_work_os_declaration",
    maturity_claim_finalized_now: false,
    work_os_claim_allowed_now: false,
    evidence_ref: `evidence.platform.production_governance.work_os.${levelId}`,
    reviewer_ref: "reviewer.platform_work_os_maturity",
    hard_gate_ref: `gate.platform.production_governance.work_os.${levelId}`,
    responsible_owner: "platform_work_os_owner",
    next_allowed_action: "collect live closed-loop evidence before L6/L7 declaration",
  }));
}

function buildFreezeRows() {
  return FREEZE_SPECS.map(([freezeId, description], index) => passRow({
    schema_version: "production-freeze-invariant-row.v1",
    row_id: `production.freeze.invariant.row.${String(index + 1).padStart(2, "0")}`,
    freeze_id: freezeId,
    freeze_status: "hard_invariant",
    description,
    invariant_required: true,
    invariant_enforced_now: true,
    bypass_allowed_now: false,
    evidence_ref: `evidence.platform.production_governance.freeze.${freezeId}`,
    reviewer_ref: "reviewer.platform_production_freeze",
    hard_gate_ref: `gate.platform.production_governance.freeze.${freezeId}`,
    responsible_owner: "platform_governance_owner",
    next_allowed_action: "preserve as P3200 closeout invariant",
  }));
}

function buildFinalAuthorityRows() {
  return FINAL_AUTHORITY_SPECS.map(([authorityId, description], index) => passRow({
    schema_version: "final-authority-row.v1",
    row_id: `final.authority.row.${String(index + 1).padStart(2, "0")}`,
    authority_id: authorityId,
    authority_status: "human_required",
    description,
    human_required: true,
    evidence_required: true,
    reviewer_required: true,
    receipt_required: true,
    agent_final_allowed: false,
    final_authority_granted_now: false,
    evidence_ref: `evidence.platform.production_governance.final_authority.${authorityId}`,
    reviewer_ref: "reviewer.platform_final_authority",
    hard_gate_ref: `gate.platform.production_governance.final_authority.${authorityId}`,
    responsible_owner: `${authorityId}_owner`,
    next_allowed_action: "show human receipt and owner verdict before final authority",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "production-governance-handoff-row.v1",
    row_id: `production.governance.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    runtime_rollout_enabled_by_handoff: false,
    production_ready_enabled_by_handoff: false,
    work_os_claim_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.production_governance.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_production_handoff",
    hard_gate_ref: `gate.platform.production_governance.handoff.${handoffId}`,
    responsible_owner: "platform_governance_owner",
    next_allowed_action: "use as final freeze evidence without enabling production",
  }));
}

function buildAnchor({ packageJson, domainPackEcosystemLedger, productionGovernanceLedger, roadmapDoc, sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows }) {
  return {
    schema_version: "production-governance-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    domain_pack_ecosystem_ledger_present: domainPackEcosystemLedger.available,
    production_governance_ledger_present: productionGovernanceLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_domain_pack_ecosystem_status: sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status,
    source_pack_install_performed_now: sourceDomainPackEcosystem.summary.pack_install_performed_now,
    source_domain_rollout_allowed_now: sourceDomainPackEcosystem.summary.domain_rollout_allowed_now,
    source_production_ready_allowed_now: sourceDomainPackEcosystem.summary.production_ready_allowed_now,
    component_count: componentRows.length,
    ai_risk_count: aiRiskRows.length,
    supply_chain_count: supplyChainRows.length,
    resilience_count: resilienceRows.length,
    release_readiness_count: releaseReadinessRows.length,
    work_os_maturity_count: maturityRows.length,
    freeze_invariant_count: freezeRows.length,
    final_authority_count: finalAuthorityRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows }) {
  return {
    schema_version: "production-governance-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_domain_pack_ecosystem_status: sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status,
    component_count: componentRows.length,
    ai_risk_count: aiRiskRows.length,
    supply_chain_count: supplyChainRows.length,
    resilience_count: resilienceRows.length,
    release_readiness_count: releaseReadinessRows.length,
    work_os_maturity_count: maturityRows.length,
    freeze_invariant_count: freezeRows.length,
    final_authority_count: finalAuthorityRows.length,
    handoff_count: handoffRows.length,
    production_governance_contract_ready: true,
    work_os_freeze_contract_ready: true,
    next_allowed_action: "hold P3200 final freeze evidence without enabling production",
  };
}

function buildGuardRows({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows }) {
  const guards = [
    ["source_domain_pack_ready", sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status === SOURCE_READY_STATUS, "Source domain pack ecosystem must be ready"],
    ["source_no_pack_or_production", sourceDomainPackEcosystem.summary.pack_install_performed_now === false && sourceDomainPackEcosystem.summary.domain_rollout_allowed_now === false && sourceDomainPackEcosystem.summary.production_ready_allowed_now === false, "Source must not enable pack install, rollout, or production"],
    ["components_ready", componentRows.length === 8 && componentRows.every((row) => row.current_verdict === "pass"), "All production governance components must pass"],
    ["ai_risk_human_owned", aiRiskRows.length === 6 && aiRiskRows.every((row) => row.evidence_required === true && row.agent_final_pass_allowed_now === false && row.protected_action_allowed_now === false), "AI risk must require evidence and keep Agent final PASS blocked"],
    ["supply_chain_no_production_dependency", supplyChainRows.length === 6 && supplyChainRows.every((row) => row.package_or_schema_change_allowed_now === false && row.production_dependency_allowed_now === false), "Supply chain rows must not approve production dependencies now"],
    ["resilience_no_claim", resilienceRows.length === 6 && resilienceRows.every((row) => row.restore_verified_now === false && row.production_resilience_claim_allowed_now === false), "Resilience rows must not claim verified production resilience now"],
    ["release_not_allowed", releaseReadinessRows.length === 7 && releaseReadinessRows.every((row) => row.release_gate_run_now === false && row.release_allowed_now === false && row.production_ready_claim_allowed_now === false), "Release rows must not enable release or production readiness now"],
    ["work_os_not_declared", maturityRows.length === 5 && maturityRows.every((row) => row.maturity_claim_finalized_now === false && row.work_os_claim_allowed_now === false), "Work OS maturity rows must not finalize L6/L7 claim now"],
    ["freeze_invariants_enforced", freezeRows.length === 8 && freezeRows.every((row) => row.invariant_required === true && row.invariant_enforced_now === true && row.bypass_allowed_now === false), "Freeze invariants must be enforced and not bypassed"],
    ["final_authority_human", finalAuthorityRows.length === 6 && finalAuthorityRows.every((row) => row.human_required === true && row.agent_final_allowed === false && row.final_authority_granted_now === false), "Final authority must remain human-owned"],
    ["handoffs_no_enablement", handoffRows.length === 3 && handoffRows.every((row) => row.runtime_rollout_enabled_by_handoff === false && row.production_ready_enabled_by_handoff === false && row.work_os_claim_enabled_by_handoff === false), "Handoffs must not enable production or Work OS claims"],
    ["no_runtime_write_or_production", true, "This contract does not enable runtime execution, write action, connector write, pack install, final authority, production readiness, or Work OS final claim"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "production-governance-guard-row.v1",
    row_id: `production.governance.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.production_governance.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_production_governance_guard",
    hard_gate_ref: `gate.platform.production_governance.guard.${guardId}`,
    responsible_owner: "platform_governance_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P3200 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status !== SOURCE_READY_STATUS,
    sourceDomainPackEcosystem.summary.pack_install_performed_now,
    sourceDomainPackEcosystem.summary.domain_rollout_allowed_now,
    sourceDomainPackEcosystem.summary.production_ready_allowed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    aiRiskRows.some((row) => !row.evidence_required || row.agent_final_pass_allowed_now || row.protected_action_allowed_now),
    supplyChainRows.some((row) => row.package_or_schema_change_allowed_now || row.production_dependency_allowed_now),
    resilienceRows.some((row) => row.restore_verified_now || row.incident_loop_enabled_now || row.production_resilience_claim_allowed_now),
    releaseReadinessRows.some((row) => row.release_gate_run_now || row.release_allowed_now || row.production_ready_claim_allowed_now),
    maturityRows.some((row) => row.maturity_claim_finalized_now || row.work_os_claim_allowed_now),
    freezeRows.some((row) => !row.invariant_required || !row.invariant_enforced_now || row.bypass_allowed_now),
    finalAuthorityRows.some((row) => !row.human_required || row.agent_final_allowed || row.final_authority_granted_now),
    handoffRows.some((row) => row.runtime_rollout_enabled_by_handoff || row.production_ready_enabled_by_handoff || row.work_os_claim_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "production-governance-boundary.v1",
    source_domain_pack_ecosystem_status: sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status,
    production_governance_contract_ready: true,
    work_os_freeze_contract_ready: true,
    p3200_final_freeze_candidate: unsafeFlags.filter(Boolean).length === 0,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    connector_write_allowed_now: false,
    pack_install_allowed_now: false,
    domain_rollout_allowed_now: false,
    production_ready_claimed_now: false,
    production_ready_allowed_now: false,
    work_os_claim_finalized_now: false,
    l7_declared_now: false,
    agent_final_pass_allowed_now: false,
    legal_final_authority_allowed_now: false,
    release_final_authority_allowed_now: false,
    production_final_authority_allowed_now: false,
    trading_live_authority_allowed_now: false,
    client_output_final_authority_allowed_now: false,
    pack_rollout_final_authority_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, domainPackEcosystemLedger, productionGovernanceLedger, roadmapDoc, sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:production-governance-work-os-freeze"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:production-governance-work-os-freeze -- --check"),
    validationItem("source.domain_pack", "source_ready", sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status === SOURCE_READY_STATUS, "source domain pack ecosystem must be ready"),
    validationItem("source.no_install", "source_ready", sourceDomainPackEcosystem.summary.pack_install_performed_now === false && sourceDomainPackEcosystem.summary.domain_rollout_allowed_now === false && sourceDomainPackEcosystem.summary.production_ready_allowed_now === false, "source must not enable pack install, rollout, or production"),
    validationItem("ledger.domain_pack", "ledger", domainPackEcosystemLedger.available && domainPackEcosystemLedger.text.includes(SOURCE_COMMAND_NAME), "domain pack ecosystem ledger must be present"),
    validationItem("ledger.production_governance", "ledger", productionGovernanceLedger.available && productionGovernanceLedger.text.includes("P3041-P3200") && productionGovernanceLedger.text.includes(COMMAND_NAME), "production governance ledger must be present"),
    validationItem("roadmap.production_governance", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P3041-P3200") && roadmapDoc.text.includes("Production Governance"), "roadmap must reflect production governance"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all production governance component rows must exist"),
    validationItem("ai_risk.count", "ai_risk_rows", aiRiskRows.length === 6, "all AI risk rows must exist"),
    validationItem("supply_chain.count", "supply_chain_rows", supplyChainRows.length === 6, "all supply chain rows must exist"),
    validationItem("resilience.count", "resilience_rows", resilienceRows.length === 6, "all resilience rows must exist"),
    validationItem("release.count", "release_rows", releaseReadinessRows.length === 7, "all release readiness rows must exist"),
    validationItem("maturity.count", "maturity_rows", maturityRows.length === 5, "all Work OS maturity rows must exist"),
    validationItem("freeze.count", "freeze_rows", freezeRows.length === 8, "all freeze invariant rows must exist"),
    validationItem("authority.count", "final_authority_rows", finalAuthorityRows.length === 6, "all final authority rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all handoff rows must exist"),
    validationItem("ai_risk.no_agent_final", "unsafe_invariants", aiRiskRows.every((row) => row.agent_final_pass_allowed_now === false && row.protected_action_allowed_now === false), "AI risk must keep Agent final PASS and protected actions closed"),
    validationItem("release.no_claim", "unsafe_invariants", releaseReadinessRows.every((row) => row.release_allowed_now === false && row.production_ready_claim_allowed_now === false), "release readiness must not open release or production claim"),
    validationItem("work_os.no_declaration", "unsafe_invariants", maturityRows.every((row) => row.maturity_claim_finalized_now === false && row.work_os_claim_allowed_now === false), "Work OS maturity must not finalize L6/L7 now"),
    validationItem("authority.human_only", "unsafe_invariants", finalAuthorityRows.every((row) => row.human_required === true && row.agent_final_allowed === false && row.final_authority_granted_now === false), "final authority rows must be human only"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all production governance guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_production", "unsafe_invariants", boundary.production_ready_claimed_now === false && boundary.work_os_claim_finalized_now === false && boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false, "production governance must not enable production, Work OS final claim, runtime, or write now"),
  ];
}

function buildSummary({ sourceDomainPackEcosystem, componentRows, aiRiskRows, supplyChainRows, resilienceRows, releaseReadinessRows, maturityRows, freezeRows, finalAuthorityRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-production-governance-work-os-freeze-summary.v1",
    platform_production_governance_work_os_freeze_status: validation.valid && boundary.p3200_final_freeze_candidate ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_domain_pack_ecosystem_status: sourceDomainPackEcosystem.summary.platform_domain_pack_ecosystem_status,
    component_count: componentRows.length,
    ai_risk_count: aiRiskRows.length,
    supply_chain_count: supplyChainRows.length,
    resilience_count: resilienceRows.length,
    release_readiness_count: releaseReadinessRows.length,
    work_os_maturity_count: maturityRows.length,
    freeze_invariant_count: freezeRows.length,
    final_authority_count: finalAuthorityRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    production_governance_contract_ready: boundary.production_governance_contract_ready,
    work_os_freeze_contract_ready: boundary.work_os_freeze_contract_ready,
    p3200_final_freeze_candidate: boundary.p3200_final_freeze_candidate,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    pack_install_allowed_now: boundary.pack_install_allowed_now,
    domain_rollout_allowed_now: boundary.domain_rollout_allowed_now,
    production_ready_claimed_now: boundary.production_ready_claimed_now,
    production_ready_allowed_now: boundary.production_ready_allowed_now,
    work_os_claim_finalized_now: boundary.work_os_claim_finalized_now,
    l7_declared_now: boundary.l7_declared_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    legal_final_authority_allowed_now: boundary.legal_final_authority_allowed_now,
    release_final_authority_allowed_now: boundary.release_final_authority_allowed_now,
    production_final_authority_allowed_now: boundary.production_final_authority_allowed_now,
    trading_live_authority_allowed_now: boundary.trading_live_authority_allowed_now,
    client_output_final_authority_allowed_now: boundary.client_output_final_authority_allowed_now,
    pack_rollout_final_authority_allowed_now: boundary.pack_rollout_final_authority_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Production Governance and Work OS Freeze",
    "",
    `Status: ${result.summary.platform_production_governance_work_os_freeze_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source domain pack ecosystem status: ${result.summary.source_domain_pack_ecosystem_status}`,
    `Components: ${result.summary.component_count}`,
    `AI risk rows: ${result.summary.ai_risk_count}`,
    `Supply chain rows: ${result.summary.supply_chain_count}`,
    `Resilience rows: ${result.summary.resilience_count}`,
    `Release readiness rows: ${result.summary.release_readiness_count}`,
    `Work OS maturity rows: ${result.summary.work_os_maturity_count}`,
    `Freeze invariants: ${result.summary.freeze_invariant_count}`,
    `Final authority rows: ${result.summary.final_authority_count}`,
    `P3200 final freeze candidate: ${result.summary.p3200_final_freeze_candidate}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Connector write allowed now: ${result.summary.connector_write_allowed_now}`,
    `Pack install allowed now: ${result.summary.pack_install_allowed_now}`,
    `Domain rollout allowed now: ${result.summary.domain_rollout_allowed_now}`,
    `Production ready claimed now: ${result.summary.production_ready_claimed_now}`,
    `Work OS final claim now: ${result.summary.work_os_claim_finalized_now}`,
    `Agent final PASS allowed now: ${result.summary.agent_final_pass_allowed_now}`,
    `Legal final authority allowed now: ${result.summary.legal_final_authority_allowed_now}`,
    `Release final authority allowed now: ${result.summary.release_final_authority_allowed_now}`,
    `Production final authority allowed now: ${result.summary.production_final_authority_allowed_now}`,
    `Trading live authority allowed now: ${result.summary.trading_live_authority_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Final Freeze Invariants",
    "",
    "No evidence = no PASS. No owner = no rollout. No receipt = no execution or write. No reviewer = no protected action. No rollback = no controlled write. No grounded recall = no memory claim. No hard gate = no safety claim. No L6 closed loop = no Work OS claim.",
    "",
    "## Next Allowed Action",
    "",
    "Hold P3200 as a governance freeze candidate. Future post-P3200 runtime or production rollout must open a new receipt, evidence, reviewer, rollback, incident, and owner-gated program.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_PRODUCTION_GOVERNANCE_WORK_OS_FREEZE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    domain_pack_ecosystem_ledger_path: options.domainPackEcosystemLedgerPath ?? defaults.domainPackEcosystemLedgerPath,
    production_governance_ledger_path: options.productionGovernanceLedgerPath ?? defaults.productionGovernanceLedgerPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    domainPackEcosystemLedgerPath: undefined,
    productionGovernanceLedgerPath: undefined,
    roadmapDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--domain-pack-ecosystem-ledger") {
      args.domainPackEcosystemLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--production-governance-ledger") {
      args.productionGovernanceLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-production-governance-work-os-freeze.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --domain-pack-ecosystem-ledger <path>
  --production-governance-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
