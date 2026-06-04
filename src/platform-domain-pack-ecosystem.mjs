import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformConnectorsDataGovernance } from "./platform-connectors-data-governance.mjs";

export const DEFAULT_PLATFORM_DOMAIN_PACK_ECOSYSTEM_OUT_DIR = "artifacts/platform-domain-pack-ecosystem/latest";
export const DEFAULT_PLATFORM_DOMAIN_PACK_ECOSYSTEM_INPUTS = {
  schemaPath: "schemas/platform-domain-pack-ecosystem.schema.json",
  packagePath: "package.json",
  connectorsGovernanceLedgerPath: "docs/hermes-connectors-data-governance.md",
  domainPackEcosystemLedgerPath: "docs/hermes-domain-pack-ecosystem.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:domain-pack-ecosystem";
const SOURCE_COMMAND_NAME = "platform:connectors-data-governance";
const SCHEMA_VERSION = "platform-domain-pack-ecosystem.v1";
const CAPABILITY_ID = "platform.domain_pack_ecosystem";
const READY_STATUS = "ready_for_platform_domain_pack_ecosystem";
const SOURCE_READY_STATUS = "ready_for_platform_connectors_data_governance";
const PROGRAM_RANGE = "P2881-P3040";
const PHASE_RANGE = "P2881-P3040";
const PHASE_SLOT = "P2881";
const PREVIOUS_PHASE_SLOT = "P2880";
const NEXT_PHASE_SLOT = "P3041";

const COMPONENT_SPECS = [
  ["pack_sdk_contract", "Domain pack SDK and adapter contract"],
  ["manifest_schema_contract", "Pack manifest and capability schema contract"],
  ["compatibility_gate_contract", "Pack compatibility and invariant gate contract"],
  ["contribution_model_contract", "Pack contribution, review, and deprecation contract"],
  ["pack_registry_contract", "Pack registry, version, dependency, and quarantine contract"],
  ["domain_ontology_contract", "Domain ontology, goal, workflow, role, artifact, and risk taxonomy contract"],
  ["pass_owner_contract", "Domain PASS owner and human final authority contract"],
  ["production_handoff_contract", "P3041 production governance handoff contract"],
];

const DOMAIN_PACK_SPECS = [
  ["personal-dev", "Development projects, issue intake, worktree lanes, diff review, tests, PR drafts, release notes, rollback plans"],
  ["law-firm", "Matter operations, LDD, litigation, contracts, evidence, citation, and attorney approval gates"],
  ["creative-document", "Template, style, asset, DOCX/PPTX/PDF/HTML, layout, and output artifact workflows"],
  ["connectors-resource", "Read-only ingestion, resource expansion, extraction, classification, quarantine, and evidence surfaces"],
  ["trading", "Read-only trading safety, evidence, backtest review, and live-action blocks"],
  ["zendd-external", "External project bridge, work order, safe patch, diff review, and rollback planning"],
];

const SDK_SPECS = [
  ["pack_manifest", "Pack manifest, id, version, and source status contract"],
  ["capability_contract", "Pack capability, authority, and rollout level contract"],
  ["evidence_adapter", "Evidence adapter for claim, source, and artifact references"],
  ["gate_adapter", "Gate adapter for hard checks, receipts, and reviewer verdicts"],
  ["projection_adapter", "Read-only operator/API projection adapter"],
  ["fixture_contract", "Pack validation fixture and compatibility test contract"],
];

const COMPATIBILITY_SPECS = [
  ["schema_compatibility", "Schema version and required field compatibility"],
  ["invariant_compatibility", "Unsafe invariant and protected action compatibility"],
  ["source_boundary_compatibility", "Source, domain, tenant, matter, and project boundary compatibility"],
  ["review_gate_compatibility", "Reviewer, PASS owner, and human gate compatibility"],
  ["rollback_compatibility", "Rollback, closeout, and next-condition compatibility"],
  ["connector_memory_compatibility", "Connector quarantine and grounded memory compatibility"],
];

const CONTRIBUTION_SPECS = [
  ["proposal_packet", "Contribution proposal packet"],
  ["review_packet", "Review packet and owner verdict"],
  ["test_evidence", "Fixture and validation evidence"],
  ["owner_signoff", "Pack owner and platform owner signoff"],
  ["deprecation_path", "Deprecation, migration, and quarantine path"],
];

const REGISTRY_SPECS = [
  ["pack_catalog", "Pack catalog and source status index"],
  ["version_index", "Version and compatibility index"],
  ["dependency_map", "Pack dependency and conflict map"],
  ["migration_notes", "Migration and breaking-change notes"],
  ["quarantine_status", "Quarantine, blocked reason, and next action index"],
];

const ONTOLOGY_SPECS = [
  ["domain_vocabulary", "Domain vocabulary and aliases"],
  ["goal_taxonomy", "Goal, workflow, and outcome taxonomy"],
  ["workflow_taxonomy", "Workflow, step, gate, and artifact taxonomy"],
  ["role_taxonomy", "Owner, reviewer, operator, and final authority taxonomy"],
  ["artifact_taxonomy", "Artifact, evidence, receipt, and output taxonomy"],
  ["risk_taxonomy", "Risk, sensitivity, protected action, and unsafe flag taxonomy"],
];

const PASS_OWNER_SPECS = [
  ["personal_dev_owner", "Personal-dev release and implementation PASS owner"],
  ["legal_human_owner", "Legal-domain attorney and client-final authority owner"],
  ["creative_output_owner", "Creative-document output and client delivery owner"],
  ["connector_owner", "Connector, resource, and raw material governance owner"],
  ["trading_safety_owner", "Trading safety and live-action authority owner"],
];

const HANDOFF_SPECS = [
  ["p3041_production_governance", "P3041-P3200", "Production governance can consume pack compatibility, registry, and PASS owner contracts."],
  ["p3200_work_os_freeze", "P3200", "Final Work OS freeze can verify pack ecosystem maturity and rollout level."],
  ["post_p3200_pack_runtime", "Post-P3200", "Future runtime pack installation can consume compatibility evidence only after production freeze."],
];

export async function runPlatformDomainPackEcosystem(options = {}) {
  const result = await buildPlatformDomainPackEcosystem(options);
  if (options.write !== false) await writePlatformDomainPackEcosystem(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform domain pack ecosystem failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformDomainPackEcosystem(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_DOMAIN_PACK_ECOSYSTEM_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const connectorsGovernanceLedger = await readTextSource(inputs.connectors_governance_ledger_path);
  const domainPackEcosystemLedger = await readTextSource(inputs.domain_pack_ecosystem_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceConnectorsGovernance = options.sourceConnectorsGovernance ?? await buildPlatformConnectorsDataGovernance({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    connectorsGovernanceLedgerPath: inputs.connectors_governance_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const domainPackRows = buildDomainPackRows();
  const sdkRows = buildSdkRows();
  const compatibilityRows = buildCompatibilityRows();
  const contributionRows = buildContributionRows();
  const registryRows = buildRegistryRows();
  const ontologyRows = buildOntologyRows();
  const passOwnerRows = buildPassOwnerRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, connectorsGovernanceLedger, domainPackEcosystemLedger, roadmapDoc, sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows });
  const guardRows = buildGuardRows({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows });
  const boundary = buildBoundary({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, connectorsGovernanceLedger, domainPackEcosystemLedger, roadmapDoc, sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_domain_pack_ecosystem_id: `platform-domain-pack-ecosystem.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    domain_pack_ecosystem_anchor: anchor,
    source_connectors_data_governance_summary: sourceConnectorsGovernance.summary,
    domain_pack_ecosystem_manifest: manifest,
    domain_pack_ecosystem_component_rows: componentRows,
    domain_pack_rows: domainPackRows,
    pack_sdk_rows: sdkRows,
    pack_compatibility_gate_rows: compatibilityRows,
    pack_contribution_model_rows: contributionRows,
    pack_registry_rows: registryRows,
    domain_ontology_rows: ontologyRows,
    domain_pass_owner_rows: passOwnerRows,
    domain_pack_handoff_rows: handoffRows,
    domain_pack_guard_rows: guardRows,
    domain_pack_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_domain_pack_ecosystem")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_domain_pack_ecosystem_id = result.platform_domain_pack_ecosystem_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformDomainPackEcosystem(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-domain-pack-ecosystem.json"), serializableResult(result));
  await writeJson(path.join(outDir, "domain-pack-ecosystem-manifest.json"), result.domain_pack_ecosystem_manifest);
  await writeJson(path.join(outDir, "domain-pack-ecosystem-component-rows.json"), collectionEnvelope("domain-pack-ecosystem-component-rows.v1", "domain_pack_ecosystem_component_rows", result.domain_pack_ecosystem_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-rows.json"), collectionEnvelope("domain-pack-rows.v1", "domain_pack_rows", result.domain_pack_rows, result.generated_at));
  await writeJson(path.join(outDir, "pack-sdk-rows.json"), collectionEnvelope("pack-sdk-rows.v1", "pack_sdk_rows", result.pack_sdk_rows, result.generated_at));
  await writeJson(path.join(outDir, "pack-compatibility-gate-rows.json"), collectionEnvelope("pack-compatibility-gate-rows.v1", "pack_compatibility_gate_rows", result.pack_compatibility_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "pack-contribution-model-rows.json"), collectionEnvelope("pack-contribution-model-rows.v1", "pack_contribution_model_rows", result.pack_contribution_model_rows, result.generated_at));
  await writeJson(path.join(outDir, "pack-registry-rows.json"), collectionEnvelope("pack-registry-rows.v1", "pack_registry_rows", result.pack_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-ontology-rows.json"), collectionEnvelope("domain-ontology-rows.v1", "domain_ontology_rows", result.domain_ontology_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pass-owner-rows.json"), collectionEnvelope("domain-pass-owner-rows.v1", "domain_pass_owner_rows", result.domain_pass_owner_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-handoff-rows.json"), collectionEnvelope("domain-pack-handoff-rows.v1", "domain_pack_handoff_rows", result.domain_pack_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-guard-rows.json"), collectionEnvelope("domain-pack-guard-rows.v1", "domain_pack_guard_rows", result.domain_pack_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-boundary.json"), result.domain_pack_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-domain-pack-ecosystem-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformDomainPackEcosystemCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformDomainPackEcosystem(args);
    console.log(`Platform domain pack ecosystem ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_domain_pack_ecosystem_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`Domain packs: ${result.summary.domain_pack_count}`);
    console.log(`SDK rows: ${result.summary.sdk_count}`);
    console.log(`Compatibility gates: ${result.summary.compatibility_gate_count}`);
    console.log(`Registry rows: ${result.summary.registry_count}`);
    console.log(`P3041 handoff ready: ${result.summary.p3041_ready_as_next_goal}`);
    console.log(`Pack installed now: ${result.summary.pack_install_performed_now}`);
    console.log(`Registry published now: ${result.summary.pack_registry_published_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "domain-pack-ecosystem-component-row.v1",
    row_id: `domain.pack.ecosystem.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.domain_pack.component.${componentId}`,
    reviewer_ref: "reviewer.platform_domain_pack",
    hard_gate_ref: `gate.platform.domain_pack.component.${componentId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "preserve as P3041 production governance precondition",
  }));
}

function buildDomainPackRows() {
  return DOMAIN_PACK_SPECS.map(([packId, description], index) => passRow({
    schema_version: "domain-pack-row.v1",
    row_id: `domain.pack.row.${String(index + 1).padStart(2, "0")}`,
    pack_id: packId,
    pack_status: "registered_contract",
    description,
    pack_manifest_required: true,
    compatibility_check_required: true,
    pass_owner_required: true,
    pack_install_allowed_now: false,
    compatibility_checked_now: false,
    final_authority_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.pack.${packId}`,
    reviewer_ref: "reviewer.platform_domain_pack_registry",
    hard_gate_ref: `gate.platform.domain_pack.pack.${packId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "run compatibility gate before any pack install or rollout",
  }));
}

function buildSdkRows() {
  return SDK_SPECS.map(([sdkId, description], index) => passRow({
    schema_version: "pack-sdk-row.v1",
    row_id: `pack.sdk.row.${String(index + 1).padStart(2, "0")}`,
    sdk_id: sdkId,
    sdk_status: "contract_ready",
    description,
    manifest_required: true,
    adapter_required: true,
    fixture_required: true,
    sdk_generated_now: false,
    pack_install_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.sdk.${sdkId}`,
    reviewer_ref: "reviewer.platform_pack_sdk",
    hard_gate_ref: `gate.platform.domain_pack.sdk.${sdkId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "generate SDK artifacts only after compatibility and owner review",
  }));
}

function buildCompatibilityRows() {
  return COMPATIBILITY_SPECS.map(([gateId, description], index) => passRow({
    schema_version: "pack-compatibility-gate-row.v1",
    row_id: `pack.compatibility.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: "required_before_pack_rollout",
    description,
    compatibility_check_required: true,
    reviewer_required: true,
    rollback_required: true,
    gate_run_now: false,
    rollout_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.compatibility.${gateId}`,
    reviewer_ref: "reviewer.platform_pack_compatibility",
    hard_gate_ref: `gate.platform.domain_pack.compatibility.${gateId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "run compatibility gate before contribution merge or rollout",
  }));
}

function buildContributionRows() {
  return CONTRIBUTION_SPECS.map(([contributionId, description], index) => passRow({
    schema_version: "pack-contribution-model-row.v1",
    row_id: `pack.contribution.model.row.${String(index + 1).padStart(2, "0")}`,
    contribution_id: contributionId,
    contribution_status: "review_contract",
    description,
    proposal_required: true,
    review_required: true,
    test_evidence_required: true,
    contribution_merged_now: false,
    registry_publish_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.contribution.${contributionId}`,
    reviewer_ref: "reviewer.platform_pack_contribution",
    hard_gate_ref: `gate.platform.domain_pack.contribution.${contributionId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "merge only after compatibility gate and owner signoff",
  }));
}

function buildRegistryRows() {
  return REGISTRY_SPECS.map(([registryId, description], index) => passRow({
    schema_version: "pack-registry-row.v1",
    row_id: `pack.registry.row.${String(index + 1).padStart(2, "0")}`,
    registry_id: registryId,
    registry_status: "registry_contract",
    description,
    registry_entry_required: true,
    version_required: true,
    dependency_check_required: true,
    registry_published_now: false,
    pack_install_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.registry.${registryId}`,
    reviewer_ref: "reviewer.platform_pack_registry",
    hard_gate_ref: `gate.platform.domain_pack.registry.${registryId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "publish registry only after review and compatibility gates",
  }));
}

function buildOntologyRows() {
  return ONTOLOGY_SPECS.map(([ontologyId, description], index) => passRow({
    schema_version: "domain-ontology-row.v1",
    row_id: `domain.ontology.row.${String(index + 1).padStart(2, "0")}`,
    ontology_id: ontologyId,
    ontology_status: "taxonomy_contract",
    description,
    ontology_required: true,
    compatibility_required: true,
    conflict_resolution_required: true,
    ontology_published_now: false,
    cross_domain_merge_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.ontology.${ontologyId}`,
    reviewer_ref: "reviewer.platform_domain_ontology",
    hard_gate_ref: `gate.platform.domain_pack.ontology.${ontologyId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "publish ontology only after conflict review",
  }));
}

function buildPassOwnerRows() {
  return PASS_OWNER_SPECS.map(([passOwnerId, description], index) => passRow({
    schema_version: "domain-pass-owner-row.v1",
    row_id: `domain.pass.owner.row.${String(index + 1).padStart(2, "0")}`,
    pass_owner_id: passOwnerId,
    pass_owner_status: "required_for_domain_rollout",
    description,
    owner_required: true,
    human_final_authority_required: true,
    agent_final_pass_allowed: false,
    domain_final_authority_allowed_now: false,
    evidence_ref: `evidence.platform.domain_pack.pass_owner.${passOwnerId}`,
    reviewer_ref: "reviewer.platform_domain_pass_owner",
    hard_gate_ref: `gate.platform.domain_pack.pass_owner.${passOwnerId}`,
    responsible_owner: passOwnerId,
    next_allowed_action: "show owner before PASS, rollout, or protected domain output",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "domain-pack-handoff-row.v1",
    row_id: `domain.pack.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    production_ready_enabled_by_handoff: false,
    runtime_pack_install_enabled_by_handoff: false,
    final_work_os_claim_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.domain_pack.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_domain_pack_handoff",
    hard_gate_ref: `gate.platform.domain_pack.handoff.${handoffId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: "consume in production governance without treating handoff as production permission",
  }));
}

function buildAnchor({ packageJson, connectorsGovernanceLedger, domainPackEcosystemLedger, roadmapDoc, sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows }) {
  return {
    schema_version: "domain-pack-ecosystem-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    connectors_governance_ledger_present: connectorsGovernanceLedger.available,
    domain_pack_ecosystem_ledger_present: domainPackEcosystemLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_connectors_governance_status: sourceConnectorsGovernance.summary.platform_connectors_data_governance_status,
    source_domain_pack_install_allowed_now: sourceConnectorsGovernance.summary.domain_pack_install_allowed_now,
    source_production_ready_allowed_now: sourceConnectorsGovernance.summary.production_ready_allowed_now,
    component_count: componentRows.length,
    domain_pack_count: domainPackRows.length,
    sdk_count: sdkRows.length,
    compatibility_gate_count: compatibilityRows.length,
    contribution_count: contributionRows.length,
    registry_count: registryRows.length,
    ontology_count: ontologyRows.length,
    pass_owner_count: passOwnerRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows }) {
  return {
    schema_version: "domain-pack-ecosystem-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_connectors_governance_status: sourceConnectorsGovernance.summary.platform_connectors_data_governance_status,
    component_count: componentRows.length,
    domain_pack_count: domainPackRows.length,
    sdk_count: sdkRows.length,
    compatibility_gate_count: compatibilityRows.length,
    contribution_count: contributionRows.length,
    registry_count: registryRows.length,
    ontology_count: ontologyRows.length,
    pass_owner_count: passOwnerRows.length,
    handoff_count: handoffRows.length,
    domain_pack_ecosystem_contract_ready: true,
    pack_sdk_contract_ready: true,
    compatibility_gate_contract_ready: true,
    next_allowed_action: "start P3041-P3200 production governance and Work OS freeze planning",
  };
}

function buildGuardRows({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows }) {
  const guards = [
    ["source_connectors_ready", sourceConnectorsGovernance.summary.platform_connectors_data_governance_status === SOURCE_READY_STATUS, "Source connectors governance must be ready"],
    ["source_no_domain_install", sourceConnectorsGovernance.summary.domain_pack_install_allowed_now === false && sourceConnectorsGovernance.summary.production_ready_allowed_now === false, "Source must not enable domain pack install or production"],
    ["components_ready", componentRows.length === 8 && componentRows.every((row) => row.current_verdict === "pass"), "All domain pack components must pass"],
    ["packs_registered_no_install", domainPackRows.length === 6 && domainPackRows.every((row) => row.pack_install_allowed_now === false && row.compatibility_check_required === true), "Domain packs must be registered contracts only"],
    ["sdk_contracts_no_generation", sdkRows.length === 6 && sdkRows.every((row) => row.sdk_generated_now === false && row.pack_install_allowed_now === false), "SDK rows must not generate or install now"],
    ["compatibility_required_not_run", compatibilityRows.length === 6 && compatibilityRows.every((row) => row.compatibility_check_required === true && row.gate_run_now === false), "Compatibility gates must be required and not run now"],
    ["contributions_not_merged", contributionRows.length === 5 && contributionRows.every((row) => row.contribution_merged_now === false && row.review_required === true), "Contribution rows must require review and remain unmerged"],
    ["registry_not_published", registryRows.length === 5 && registryRows.every((row) => row.registry_published_now === false && row.pack_install_allowed_now === false), "Registry rows must not publish now"],
    ["ontology_not_published", ontologyRows.length === 6 && ontologyRows.every((row) => row.ontology_required === true && row.ontology_published_now === false), "Ontology rows must remain contracts"],
    ["pass_owners_human", passOwnerRows.length === 5 && passOwnerRows.every((row) => row.owner_required === true && row.agent_final_pass_allowed === false), "PASS owners must be human-owned"],
    ["handoffs_no_enablement", handoffRows.every((row) => row.production_ready_enabled_by_handoff === false && row.runtime_pack_install_enabled_by_handoff === false), "Handoffs must not enable production or runtime install"],
    ["no_pack_install_or_final_authority", true, "This contract does not install packs, publish registry, merge contributions, or open final authority"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "domain-pack-guard-row.v1",
    row_id: `domain.pack.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.domain_pack.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_domain_pack_guard",
    hard_gate_ref: `gate.platform.domain_pack.guard.${guardId}`,
    responsible_owner: "platform_pack_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P3040 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceConnectorsGovernance.summary.platform_connectors_data_governance_status !== SOURCE_READY_STATUS,
    sourceConnectorsGovernance.summary.domain_pack_install_allowed_now,
    sourceConnectorsGovernance.summary.production_ready_allowed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    domainPackRows.some((row) => row.pack_install_allowed_now || row.compatibility_checked_now || row.final_authority_allowed_now),
    sdkRows.some((row) => row.sdk_generated_now || row.pack_install_allowed_now),
    compatibilityRows.some((row) => !row.compatibility_check_required || row.gate_run_now || row.rollout_allowed_now),
    contributionRows.some((row) => row.contribution_merged_now || row.registry_publish_allowed_now),
    registryRows.some((row) => row.registry_published_now || row.pack_install_allowed_now),
    ontologyRows.some((row) => row.ontology_published_now || row.cross_domain_merge_allowed_now),
    passOwnerRows.some((row) => !row.owner_required || row.agent_final_pass_allowed || row.domain_final_authority_allowed_now),
    handoffRows.some((row) => row.production_ready_enabled_by_handoff || row.runtime_pack_install_enabled_by_handoff || row.final_work_os_claim_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "domain-pack-boundary.v1",
    source_connectors_governance_status: sourceConnectorsGovernance.summary.platform_connectors_data_governance_status,
    domain_pack_ecosystem_contract_ready: true,
    pack_sdk_contract_ready: true,
    compatibility_gate_contract_ready: true,
    pack_install_performed_now: false,
    sdk_generated_now: false,
    compatibility_gate_run_now: false,
    contribution_merged_now: false,
    pack_registry_published_now: false,
    ontology_published_now: false,
    domain_rollout_allowed_now: false,
    domain_final_authority_allowed_now: false,
    legal_final_authority_allowed_now: false,
    release_final_authority_allowed_now: false,
    trading_live_authority_allowed_now: false,
    production_ready_allowed_now: false,
    p3041_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, connectorsGovernanceLedger, domainPackEcosystemLedger, roadmapDoc, sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:domain-pack-ecosystem"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:domain-pack-ecosystem -- --check"),
    validationItem("source.connectors", "source_ready", sourceConnectorsGovernance.summary.platform_connectors_data_governance_status === SOURCE_READY_STATUS, "source connectors governance must be ready"),
    validationItem("source.no_install", "source_ready", sourceConnectorsGovernance.summary.domain_pack_install_allowed_now === false && sourceConnectorsGovernance.summary.production_ready_allowed_now === false, "source must not enable domain pack install or production"),
    validationItem("ledger.connectors", "ledger", connectorsGovernanceLedger.available && connectorsGovernanceLedger.text.includes(SOURCE_COMMAND_NAME), "connectors governance ledger must be present"),
    validationItem("ledger.domain_pack", "ledger", domainPackEcosystemLedger.available && domainPackEcosystemLedger.text.includes("P2881-P3040") && domainPackEcosystemLedger.text.includes(COMMAND_NAME), "domain pack ecosystem ledger must be present"),
    validationItem("roadmap.domain_pack", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P2881-P3040") && roadmapDoc.text.includes("Domain Pack Ecosystem"), "roadmap must reflect domain pack ecosystem"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all domain pack component rows must exist"),
    validationItem("packs.count", "domain_pack_rows", domainPackRows.length === 6, "all domain pack rows must exist"),
    validationItem("sdk.count", "sdk_rows", sdkRows.length === 6, "all SDK rows must exist"),
    validationItem("compatibility.count", "compatibility_rows", compatibilityRows.length === 6, "all compatibility rows must exist"),
    validationItem("contribution.count", "contribution_rows", contributionRows.length === 5, "all contribution rows must exist"),
    validationItem("registry.count", "registry_rows", registryRows.length === 5, "all registry rows must exist"),
    validationItem("ontology.count", "ontology_rows", ontologyRows.length === 6, "all ontology rows must exist"),
    validationItem("owners.count", "pass_owner_rows", passOwnerRows.length === 5, "all PASS owner rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all handoff rows must exist"),
    validationItem("packs.no_install", "unsafe_invariants", domainPackRows.every((row) => row.pack_install_allowed_now === false && row.final_authority_allowed_now === false), "packs must not install or open final authority now"),
    validationItem("registry.no_publish", "unsafe_invariants", registryRows.every((row) => row.registry_published_now === false && row.pack_install_allowed_now === false), "registry must not publish now"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all domain pack guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_pack_install", "unsafe_invariants", boundary.pack_install_performed_now === false && boundary.domain_final_authority_allowed_now === false && boundary.production_ready_allowed_now === false, "domain pack ecosystem must not install packs or open final authority now"),
  ];
}

function buildSummary({ sourceConnectorsGovernance, componentRows, domainPackRows, sdkRows, compatibilityRows, contributionRows, registryRows, ontologyRows, passOwnerRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-domain-pack-ecosystem-summary.v1",
    platform_domain_pack_ecosystem_status: validation.valid && boundary.p3041_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_connectors_governance_status: sourceConnectorsGovernance.summary.platform_connectors_data_governance_status,
    component_count: componentRows.length,
    domain_pack_count: domainPackRows.length,
    sdk_count: sdkRows.length,
    compatibility_gate_count: compatibilityRows.length,
    contribution_count: contributionRows.length,
    registry_count: registryRows.length,
    ontology_count: ontologyRows.length,
    pass_owner_count: passOwnerRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    domain_pack_ecosystem_contract_ready: boundary.domain_pack_ecosystem_contract_ready,
    pack_sdk_contract_ready: boundary.pack_sdk_contract_ready,
    compatibility_gate_contract_ready: boundary.compatibility_gate_contract_ready,
    p3041_ready_as_next_goal: boundary.p3041_ready_as_next_goal,
    pack_install_performed_now: boundary.pack_install_performed_now,
    sdk_generated_now: boundary.sdk_generated_now,
    compatibility_gate_run_now: boundary.compatibility_gate_run_now,
    contribution_merged_now: boundary.contribution_merged_now,
    pack_registry_published_now: boundary.pack_registry_published_now,
    ontology_published_now: boundary.ontology_published_now,
    domain_rollout_allowed_now: boundary.domain_rollout_allowed_now,
    domain_final_authority_allowed_now: boundary.domain_final_authority_allowed_now,
    legal_final_authority_allowed_now: boundary.legal_final_authority_allowed_now,
    release_final_authority_allowed_now: boundary.release_final_authority_allowed_now,
    trading_live_authority_allowed_now: boundary.trading_live_authority_allowed_now,
    production_ready_allowed_now: boundary.production_ready_allowed_now,
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
    "# Platform Domain Pack Ecosystem",
    "",
    `Status: ${result.summary.platform_domain_pack_ecosystem_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source connectors governance status: ${result.summary.source_connectors_governance_status}`,
    `Components: ${result.summary.component_count}`,
    `Domain packs: ${result.summary.domain_pack_count}`,
    `SDK rows: ${result.summary.sdk_count}`,
    `Compatibility gates: ${result.summary.compatibility_gate_count}`,
    `Contribution rows: ${result.summary.contribution_count}`,
    `Registry rows: ${result.summary.registry_count}`,
    `Ontology rows: ${result.summary.ontology_count}`,
    `PASS owners: ${result.summary.pass_owner_count}`,
    `P3041 ready as next goal: ${result.summary.p3041_ready_as_next_goal}`,
    `Pack installed now: ${result.summary.pack_install_performed_now}`,
    `Registry published now: ${result.summary.pack_registry_published_now}`,
    `Domain final authority allowed now: ${result.summary.domain_final_authority_allowed_now}`,
    `Production ready allowed now: ${result.summary.production_ready_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P3041-P3200 Production Governance and Work OS Freeze. This program defines pack SDK, compatibility, registry, ontology, contribution, and PASS owner contracts, but it does not install packs, publish registry entries, merge contributions, or open final authority.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_DOMAIN_PACK_ECOSYSTEM_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    connectors_governance_ledger_path: options.connectorsGovernanceLedgerPath ?? defaults.connectorsGovernanceLedgerPath,
    domain_pack_ecosystem_ledger_path: options.domainPackEcosystemLedgerPath ?? defaults.domainPackEcosystemLedgerPath,
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
    connectorsGovernanceLedgerPath: undefined,
    domainPackEcosystemLedgerPath: undefined,
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
    } else if (arg === "--connectors-governance-ledger") {
      args.connectorsGovernanceLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--domain-pack-ecosystem-ledger") {
      args.domainPackEcosystemLedgerPath = argv[index + 1];
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
  console.log(`Usage: node scripts/platform-domain-pack-ecosystem.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --connectors-governance-ledger <path>
  --domain-pack-ecosystem-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
