import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";
import { buildSaasQualityGatePacks } from "./saas-quality-gate-packs.mjs";

export const DEFAULT_DOMAIN_PACK_SDK_V2_OUT_DIR = "artifacts/domain-pack-sdk-v2/latest";
export const DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS = {
  schemaPath: "schemas/domain-pack-sdk-v2.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p12001-p12200.md",
  architectureDocPath: "docs/architecture.md",
  sourceSaasQualityGatePacksPath: "artifacts/saas-quality-gate-packs/latest/saas-quality-gate-packs.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
};

const COMMAND_NAME = "platform:domain-pack-sdk-v2";
const SCHEMA_VERSION = "domain-pack-sdk-v2.v1";
const CAPABILITY_ID = "platform.domain_pack_sdk_v2";
const PROGRAM_RANGE = "P12001-P12200";
const SOURCE_PROGRAM_RANGE = "P11801-P12000";
const READY_STATUS = "ready_for_domain_pack_sdk_v2";
const BLOCKED_STATUS = "blocked_domain_pack_sdk_v2";

const PHASE_SPECS = [
  ["P12001-P12020", "P12000 Source Binding", "domain_pack_sdk_source_binding_rows"],
  ["P12021-P12040", "SDK Domain Matrix", "domain_pack_sdk_domain_rows"],
  ["P12041-P12060", "Pack Manifest v2 Contract", "pack_manifest_v2_contract_rows"],
  ["P12061-P12080", "Capability Interface Contract", "capability_interface_contract_rows"],
  ["P12081-P12100", "Data Boundary Contract", "domain_data_boundary_rows"],
  ["P12101-P12120", "Review And Authority Contract", "domain_review_authority_rows"],
  ["P12121-P12140", "Gate Pack Binding Contract", "domain_gate_pack_binding_rows"],
  ["P12141-P12160", "Compatibility And Migration Contract", "domain_compatibility_migration_rows"],
  ["P12161-P12180", "Domain Contribution Contract", "domain_contribution_contract_rows"],
  ["P12181-P12200", "SDK v2 Freeze", "p12200_freeze_rows"],
];

const DOMAIN_SPECS = [
  ["hr", "HR context", "people module context", "Hermes 제품 identity"],
  ["law_firm", "law-firm context", "legal/matter context", "lawyer substitute"],
  ["crm", "CRM context", "customer/workflow context", "external send/write"],
  ["erp", "ERP context", "operations/finance workflow context", "production approval"],
  ["document", "document context", "creative/document workflow context", "client delivery finalization"],
  ["trading", "trading context", "research/backtest/paper context", "live trading"],
  ["future_saas", "future SaaS context", "project/workflow context", "domain-specific product identity"],
];

const PACK_MANIFEST_TERMS = ["pack id", "version", "capability ids", "data classes", "review authority", "boundary refs"];
const CAPABILITY_INTERFACE_TERMS = ["inputs", "outputs", "protected outputs", "validator refs", "evidence refs", "rollback refs"];
const DATA_BOUNDARY_TERMS = ["project isolation", "tenant isolation", "client/resource isolation", "raw body policy", "quarantine", "retention"];
const REVIEW_AUTHORITY_TERMS = ["Codex developer", "Claude reviewer", "human owner", "independent review", "no final approval expansion"];
const GATE_PACK_BINDING_TERMS = ["security", "permissions", "data model", "UX", "API", "performance", "docs", "deployment/rollback", "provenance gate refs"];
const COMPATIBILITY_TERMS = ["sdk version", "compatibility", "migration plan", "deprecated fields", "fixture coverage"];
const CONTRIBUTION_TERMS = ["contribution checklist", "registry entry", "negative fixtures", "docs", "owner refs"];

export async function runDomainPackSdkV2(options = {}) {
  const result = await buildDomainPackSdkV2(options);
  if (options.write !== false) await writeDomainPackSdkV2(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Domain Pack SDK v2 failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDomainPackSdkV2(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DOMAIN_PACK_SDK_V2_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "saasQualityGatePacks")
    ? normalizeInlineJsonSource("inline.saas_quality_gate_packs", options.saasQualityGatePacks)
    : await readJsonOrBuildSaasQualityGatePacks(inputs.source_saas_quality_gate_packs_path, generatedAt);
  const registry = Object.prototype.hasOwnProperty.call(options, "domainPackRegistry")
    ? normalizeInlineJsonSource("inline.domain_pack_registry", options.domainPackRegistry)
    : await readJsonOrBuildDomainPackRegistry(inputs.domain_pack_registry_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const domainRows = buildDomainRows(roadmapDoc.text, generatedAt);
  const manifestRows = buildTermRows("pack_manifest", "Pack Manifest v2", PACK_MANIFEST_TERMS, roadmapDoc.text, "pack_manifest_v2_contract_rows", generatedAt);
  const capabilityRows = buildTermRows("capability_interface", "Capability interface", CAPABILITY_INTERFACE_TERMS, roadmapDoc.text, "capability_interface_contract_rows", generatedAt);
  const dataBoundaryRows = buildTermRows("data_boundary", "Data boundary", DATA_BOUNDARY_TERMS, roadmapDoc.text, "domain_data_boundary_rows", generatedAt);
  const reviewAuthorityRows = buildTermRows("review_authority", "Review authority", REVIEW_AUTHORITY_TERMS, roadmapDoc.text, "domain_review_authority_rows", generatedAt);
  const gateBindingRows = buildTermRows("gate_pack_binding", "Gate pack binding", GATE_PACK_BINDING_TERMS, roadmapDoc.text, "domain_gate_pack_binding_rows", generatedAt);
  const compatibilityRows = buildTermRows("compatibility_migration", "Compatibility and migration", COMPATIBILITY_TERMS, roadmapDoc.text, "domain_compatibility_migration_rows", generatedAt);
  const contributionRows = buildTermRows("contribution", "Contribution contract", CONTRIBUTION_TERMS, roadmapDoc.text, "domain_contribution_contract_rows", generatedAt);
  const registryRows = buildRegistryRows({ domainRows, manifestRows, capabilityRows, dataBoundaryRows, reviewAuthorityRows, gateBindingRows, compatibilityRows, contributionRows, registry, generatedAt });
  const freezeRows = buildFreezeRows({ sourceRows, domainRows, manifestRows, capabilityRows, dataBoundaryRows, reviewAuthorityRows, gateBindingRows, compatibilityRows, contributionRows, registryRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, domainRows, manifestRows, capabilityRows, dataBoundaryRows, reviewAuthorityRows, gateBindingRows, compatibilityRows, contributionRows, registryRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, domainRows, manifestRows, capabilityRows, dataBoundaryRows, reviewAuthorityRows, gateBindingRows, compatibilityRows, contributionRows, registryRows, freezeRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      saas_quality_gate_packs_path: source.path,
      domain_pack_registry_path: registry.path,
    },
    source_saas_quality_gate_packs_summary: source.data?.summary ?? null,
    observed_domain_pack_registry_summary: registry.data?.summary ?? null,
    domain_pack_sdk_v2_contract: contract,
    domain_pack_sdk_phase_rows: phaseRows,
    domain_pack_sdk_source_binding_rows: sourceRows,
    domain_pack_sdk_domain_rows: domainRows,
    pack_manifest_v2_contract_rows: manifestRows,
    capability_interface_contract_rows: capabilityRows,
    domain_data_boundary_rows: dataBoundaryRows,
    domain_review_authority_rows: reviewAuthorityRows,
    domain_gate_pack_binding_rows: gateBindingRows,
    domain_compatibility_migration_rows: compatibilityRows,
    domain_contribution_contract_rows: contributionRows,
    domain_pack_sdk_registry_rows: registryRows,
    p12200_freeze_rows: freezeRows,
    domain_pack_sdk_boundary: boundary,
    domain_pack_sdk_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, domainRows, manifestRows, capabilityRows, dataBoundaryRows, reviewAuthorityRows, gateBindingRows, compatibilityRows, contributionRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "domain_pack_sdk_v2")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.domain_pack_sdk_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.domain_pack_sdk_validation_items);
  result.summary = buildSummary({ boundary, domainRows, manifestRows, capabilityRows, dataBoundaryRows, reviewAuthorityRows, gateBindingRows, compatibilityRows, contributionRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeDomainPackSdkV2(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "domain-pack-sdk-v2.json"), serializableResult(result));
  await writeJson(path.join(outDir, "domain-pack-sdk-phase-rows.json"), collectionEnvelope("domain-pack-sdk-phase-rows.v1", "domain_pack_sdk_phase_rows", result.domain_pack_sdk_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-sdk-source-binding-rows.json"), collectionEnvelope("domain-pack-sdk-source-binding-rows.v1", "domain_pack_sdk_source_binding_rows", result.domain_pack_sdk_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-sdk-domain-rows.json"), collectionEnvelope("domain-pack-sdk-domain-rows.v1", "domain_pack_sdk_domain_rows", result.domain_pack_sdk_domain_rows, result.generated_at));
  await writeJson(path.join(outDir, "pack-manifest-v2-contract-rows.json"), collectionEnvelope("pack-manifest-v2-contract-rows.v1", "pack_manifest_v2_contract_rows", result.pack_manifest_v2_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "capability-interface-contract-rows.json"), collectionEnvelope("capability-interface-contract-rows.v1", "capability_interface_contract_rows", result.capability_interface_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-data-boundary-rows.json"), collectionEnvelope("domain-data-boundary-rows.v1", "domain_data_boundary_rows", result.domain_data_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-review-authority-rows.json"), collectionEnvelope("domain-review-authority-rows.v1", "domain_review_authority_rows", result.domain_review_authority_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-gate-pack-binding-rows.json"), collectionEnvelope("domain-gate-pack-binding-rows.v1", "domain_gate_pack_binding_rows", result.domain_gate_pack_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-compatibility-migration-rows.json"), collectionEnvelope("domain-compatibility-migration-rows.v1", "domain_compatibility_migration_rows", result.domain_compatibility_migration_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-contribution-contract-rows.json"), collectionEnvelope("domain-contribution-contract-rows.v1", "domain_contribution_contract_rows", result.domain_contribution_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-sdk-registry-rows.json"), collectionEnvelope("domain-pack-sdk-registry-rows.v1", "domain_pack_sdk_registry_rows", result.domain_pack_sdk_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "p12200-freeze-rows.json"), collectionEnvelope("p12200-freeze-rows.v1", "p12200_freeze_rows", result.p12200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-sdk-boundary.json"), result.domain_pack_sdk_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "domain-pack-sdk-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.domain_pack_sdk_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runDomainPackSdkV2Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDomainPackSdkV2(args);
    console.log(`Domain Pack SDK v2 ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.domain_pack_sdk_v2_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P12001: ${result.summary.source_ready_for_p12001_handoff}`);
    console.log(`Ready for P12201 handoff: ${result.summary.ready_for_p12201_handoff}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "domain-pack-sdk-v2.contract.v1",
    generated_at: generatedAt,
    source_saas_quality_gate_packs_required: true,
    sdk_domain_ids: DOMAIN_SPECS.map(([domainId]) => domainId),
    pack_manifest_v2_terms: PACK_MANIFEST_TERMS,
    capability_interface_terms: CAPABILITY_INTERFACE_TERMS,
    data_boundary_terms: DATA_BOUNDARY_TERMS,
    review_authority_terms: REVIEW_AUTHORITY_TERMS,
    gate_pack_binding_terms: GATE_PACK_BINDING_TERMS,
    compatibility_migration_terms: COMPATIBILITY_TERMS,
    contribution_terms: CONTRIBUTION_TERMS,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    domain_pack_product_identity_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p12001-p12200.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.saas_quality_gate_boundary ?? {};
  const sourceStatus = summary.saas_quality_gate_packs_status ?? "missing";
  const sourceReady = summary.ready_for_p12001_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P11801-P12000 source artifact available", source.available],
    ["source.range", "P11801-P12000 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P12000 source status visible", sourceStatus === "ready_for_saas_quality_gate_packs" || sourceStatus === "blocked_saas_quality_gate_packs"],
    ["source.handoff", "P12000 ready_for_p12001_handoff", sourceReady],
    ["source.block_visible", "P12000 blocker visible", sourceReady || sourceBlocked],
    ["source.registry", "P12000 reusable gate pack registry available", Number(summary.quality_gate_pack_count ?? 0) >= 10],
    ["source.no_write", "P12000 source did not open write or protected action", boundary.write_control_enabled === false && boundary.protected_action_enabled === false],
    ["source.no_final_trust", "P12000 source did not open final approval production PASS or enterprise PASS", boundary.final_approval_ui_enabled === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: sourceStatus,
  }));
}

function buildDomainRows(roadmapText, generatedAt) {
  return DOMAIN_SPECS.map(([domainId, label, allowedContext, forbiddenAuthority]) => verdictRow({
    row_id: `domain.${domainId}`,
    category: "sdk_domain",
    label,
    required: true,
    observed: includesAll(roadmapText, [label, allowedContext, forbiddenAuthority]),
    evidence_ref: "docs/hermes-roadmap-p12001-p12200.md#sdk-v2-contract",
    generated_at: generatedAt,
    domain_id: domainId,
    allowed_context: allowedContext,
    forbidden_authority: forbiddenAuthority,
    context_only: true,
    opens_product_identity: false,
    opens_write_action: false,
    opens_final_approval: false,
    opens_production_pass: false,
    opens_enterprise_pass: false,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p12001-p12200.md#sdk-v2-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    deterministic_validator_required: true,
    evidence_ref_required: true,
    opens_runtime_execution: false,
    opens_write_action: false,
    opens_final_approval: false,
  }));
}

function buildRegistryRows(context) {
  const contractRowsReady = allPass([
    ...context.manifestRows,
    ...context.capabilityRows,
    ...context.dataBoundaryRows,
    ...context.reviewAuthorityRows,
    ...context.gateBindingRows,
    ...context.compatibilityRows,
    ...context.contributionRows,
  ]);
  const observedPackIds = new Set((context.registry.data?.packs ?? []).map((pack) => pack.pack_id));
  return context.domainRows.map((domainRow) => {
    const mappedPackId = domainRow.domain_id === "document" ? "creative-document" : domainRow.domain_id.replaceAll("_", "-");
    const observedPackPresent = observedPackIds.has(mappedPackId);
    return verdictRow({
      row_id: `registry.${domainRow.domain_id}`,
      category: "domain_pack_sdk_registry",
      label: `${domainRow.label} SDK v2 registry entry`,
      required: true,
      observed: domainRow.current_verdict === "pass" && contractRowsReady,
      evidence_ref: "domain_pack_sdk_contract_rows",
      generated_at: context.generatedAt,
      domain_id: domainRow.domain_id,
      mapped_pack_id: mappedPackId,
      existing_pack_observed: observedPackPresent,
      actual_pack_required_now: false,
      sdk_context_ready: true,
      product_identity_enabled: false,
    });
  });
}

function buildFreezeRows(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceBlockVisible = context.sourceRows.find((row) => row.row_id === "source.block_visible")?.current_verdict === "pass";
  const domainsReady = allPass(context.domainRows);
  const manifestReady = allPass(context.manifestRows);
  const capabilityReady = allPass(context.capabilityRows);
  const dataBoundaryReady = allPass(context.dataBoundaryRows);
  const reviewReady = allPass(context.reviewAuthorityRows);
  const gateBindingReady = allPass(context.gateBindingRows);
  const compatibilityReady = allPass(context.compatibilityRows);
  const contributionReady = allPass(context.contributionRows);
  const registryReady = allPass(context.registryRows);
  return [
    ["freeze.source", "P12000 source ready for P12001", sourceReady],
    ["freeze.source_block_visible", "P12000 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.domains", "SDK domain matrix ready", domainsReady],
    ["freeze.manifest", "Pack Manifest v2 contract ready", manifestReady],
    ["freeze.capability", "Capability interface contract ready", capabilityReady],
    ["freeze.data_boundary", "Data boundary contract ready", dataBoundaryReady],
    ["freeze.review_authority", "Review authority contract ready", reviewReady],
    ["freeze.gate_binding", "Gate pack binding contract ready", gateBindingReady],
    ["freeze.compatibility", "Compatibility and migration contract ready", compatibilityReady],
    ["freeze.contribution", "Domain contribution contract ready", contributionReady],
    ["freeze.registry", "Domain Pack SDK v2 registry ready", registryReady],
    ["freeze.no_unsafe_authority", "no runtime write final approval production PASS or enterprise PASS opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p12200_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p12200-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = context.sourceRows.find((row) => row.row_id === "source.block_visible")?.current_verdict === "pass";
  const registryReady = allPass(context.domainRows)
    && allPass(context.manifestRows)
    && allPass(context.capabilityRows)
    && allPass(context.dataBoundaryRows)
    && allPass(context.reviewAuthorityRows)
    && allPass(context.gateBindingRows)
    && allPass(context.compatibilityRows)
    && allPass(context.contributionRows)
    && allPass(context.registryRows);
  const freezeReady = sourceReady && registryReady && allPass(context.freezeRows);
  return {
    source_saas_quality_gate_packs_available: sourceAvailable,
    source_ready_for_p12001_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    domain_pack_sdk_registry_ready: registryReady,
    p12200_domain_pack_sdk_freeze_ready: freezeReady,
    ready_for_p12201_handoff: freezeReady,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    domain_pack_product_identity_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P12001-P12200 phase rows incomplete", "docs/hermes-roadmap-p12001-p12200.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P12001-P12200"), "Architecture doc missing P12001-P12200 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P12000 source state must be available and blocker-visible", "domain_pack_sdk_source_binding_rows");
  add("domains.ready", "sdk", context.domainRows.length === DOMAIN_SPECS.length && allPass(context.domainRows), "SDK domain rows incomplete", "domain_pack_sdk_domain_rows");
  add("manifest.ready", "sdk", context.manifestRows.length === PACK_MANIFEST_TERMS.length && allPass(context.manifestRows), "Pack Manifest v2 contract incomplete", "pack_manifest_v2_contract_rows");
  add("capability.ready", "sdk", context.capabilityRows.length === CAPABILITY_INTERFACE_TERMS.length && allPass(context.capabilityRows), "Capability interface contract incomplete", "capability_interface_contract_rows");
  add("data_boundary.ready", "sdk", context.dataBoundaryRows.length === DATA_BOUNDARY_TERMS.length && allPass(context.dataBoundaryRows), "Data boundary contract incomplete", "domain_data_boundary_rows");
  add("review_authority.ready", "sdk", context.reviewAuthorityRows.length === REVIEW_AUTHORITY_TERMS.length && allPass(context.reviewAuthorityRows), "Review authority contract incomplete", "domain_review_authority_rows");
  add("gate_binding.ready", "sdk", context.gateBindingRows.length === GATE_PACK_BINDING_TERMS.length && allPass(context.gateBindingRows), "Gate pack binding contract incomplete", "domain_gate_pack_binding_rows");
  add("compatibility.ready", "sdk", context.compatibilityRows.length === COMPATIBILITY_TERMS.length && allPass(context.compatibilityRows), "Compatibility and migration contract incomplete", "domain_compatibility_migration_rows");
  add("contribution.ready", "sdk", context.contributionRows.length === CONTRIBUTION_TERMS.length && allPass(context.contributionRows), "Domain contribution contract incomplete", "domain_contribution_contract_rows");
  add("registry.ready", "registry", context.registryRows.length === DOMAIN_SPECS.length && allPass(context.registryRows), "Domain Pack SDK registry incomplete", "domain_pack_sdk_registry_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P12200 freeze rows missing", "p12200_freeze_rows");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false && context.boundary.connector_write_enabled === false, "Domain Pack SDK opened write/protected/connector mutation", "domain_pack_sdk_boundary");
  add("boundary.no.final", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Domain Pack SDK opened final approval", "domain_pack_sdk_boundary");
  add("boundary.no.trust", "boundary", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false, "Domain Pack SDK opened production or enterprise PASS", "domain_pack_sdk_boundary");
  add("boundary.no.product.identity", "boundary", context.boundary.domain_pack_product_identity_enabled === false, "Domain Pack SDK promoted a domain pack to product identity", "domain_pack_sdk_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p12201_handoff === context.boundary.p12200_domain_pack_sdk_freeze_ready, "P12201 handoff state must match P12200 freeze state", "domain_pack_sdk_boundary");
  return items;
}

function buildSummary(context) {
  const contractRowCount = [
    ...context.manifestRows,
    ...context.capabilityRows,
    ...context.dataBoundaryRows,
    ...context.reviewAuthorityRows,
    ...context.gateBindingRows,
    ...context.compatibilityRows,
    ...context.contributionRows,
  ].length;
  return {
    domain_pack_sdk_v2_status: context.boundary.ready_for_p12201_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p12001_handoff: context.boundary.source_ready_for_p12001_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    domain_count: context.domainRows.length,
    sdk_contract_row_count: contractRowCount,
    p12200_domain_pack_sdk_freeze_ready: context.boundary.p12200_domain_pack_sdk_freeze_ready,
    ready_for_p12201_handoff: context.boundary.ready_for_p12201_handoff,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Domain Pack SDK v2",
    "",
    `Status: ${result.summary.domain_pack_sdk_v2_status}`,
    `Program: ${result.program_range}`,
    `Domains: ${result.summary.domain_count}`,
    `SDK contract rows: ${result.summary.sdk_contract_row_count}`,
    `Source ready for P12001: ${result.summary.source_ready_for_p12001_handoff}`,
    `Ready for P12201 handoff: ${result.summary.ready_for_p12201_handoff}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.domain_pack_sdk_registry_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.existing_pack_observed)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Domain Pack SDK v2</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Domain Pack SDK v2</h1>
    <p class="notice">Reusable domain-pack contract registry. Source blockers remain visible; mutation, final authority, and trust badges remain disabled.</p>
    <table><thead><tr><th>Domain Context</th><th>Verdict</th><th>Existing Pack Observed</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildSaasQualityGatePacks(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildSaasQualityGatePacks({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.saas_quality_gate_packs", built);
}

async function readJsonOrBuildDomainPackRegistry(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildDomainPackRegistry({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.domain_pack_registry", built);
}

function verdictRow(row) {
  return { block_reason: row.observed ? null : `${row.label} missing or blocked.`, ...row, current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked") };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS.architectureDocPath,
    source_saas_quality_gate_packs_path: options.sourceSaasQualityGatePacksPath ?? DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS.sourceSaasQualityGatePacksPath,
    domain_pack_registry_path: options.domainPackRegistryPath ?? DEFAULT_DOMAIN_PACK_SDK_V2_INPUTS.domainPackRegistryPath,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { available: Boolean(data), path: sourceId, text: "", data };
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-saas-quality-gate-packs-path") args.sourceSaasQualityGatePacksPath = argv[++index];
    else if (value === "--domain-pack-registry-path") args.domainPackRegistryPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P12001-P12200 Domain Pack SDK v2 artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
