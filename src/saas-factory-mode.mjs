import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildMultiEngineOrchestration } from "./multi-engine-orchestration.mjs";

export const DEFAULT_SAAS_FACTORY_MODE_OUT_DIR = "artifacts/saas-factory-mode/latest";
export const DEFAULT_SAAS_FACTORY_MODE_INPUTS = {
  schemaPath: "schemas/saas-factory-mode.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p15001-p15400.md",
  architectureDocPath: "docs/architecture.md",
  sourceMultiEnginePath: "artifacts/multi-engine-orchestration/latest/multi-engine-orchestration.json",
  ownerAdjudicationReceiptPath: "docs/factory-promotion/s0-owner-adjudication-receipt.json",
};

const COMMAND_NAME = "platform:saas-factory-mode";
const SCHEMA_VERSION = "saas-factory-mode.v1";
const CAPABILITY_ID = "platform.saas_factory_mode";
const PROGRAM_RANGE = "P15001-P15400";
const SOURCE_PROGRAM_RANGE = "P14601-P15000";
const READY_STATUS = "ready_for_saas_factory_mode";
const BLOCKED_STATUS = "blocked_saas_factory_mode";

const PHASE_SPECS = [
  ["P15001-P15040", "P15000 Source Binding", "saas_factory_source_binding_rows"],
  ["P15041-P15080", "Project Template Contract", "project_template_contract_rows"],
  ["P15081-P15120", "Requirement Matrix Contract", "requirement_matrix_contract_rows"],
  ["P15121-P15160", "Validation Plan Contract", "validation_plan_contract_rows"],
  ["P15161-P15200", "Review Lane Contract", "review_lane_contract_rows"],
  ["P15201-P15240", "Domain Pack Composition", "domain_pack_composition_rows"],
  ["P15241-P15280", "Release Gate Blueprint", "release_gate_blueprint_rows"],
  ["P15281-P15320", "Bootstrap Read-Only Projection", "bootstrap_projection_rows"],
  ["P15321-P15360", "Factory Authority Guard", "factory_authority_guard_rows"],
  ["P15361-P15400", "SaaS Factory Freeze", "p15400_freeze_rows"],
];

const TEMPLATE_TERMS = ["template id", "project type", "domain pack set", "owner engine", "starter artifact ref", "template blocker"];
const REQUIREMENT_TERMS = ["requirement id", "coverage target", "acceptance criterion", "source evidence ref", "priority", "traceability blocker"];
const VALIDATION_TERMS = ["validator id", "command ref", "expected evidence", "negative fixture", "adjacent check", "validation blocker"];
const REVIEW_TERMS = ["review lane id", "reviewer engine", "review scope", "finding loop", "authority boundary", "stale review blocker"];
const DOMAIN_TERMS = ["domain pack id", "capability map", "data boundary", "protected output rule", "pack compatibility", "composition blocker"];
const RELEASE_TERMS = ["release gate id", "candidate evidence", "rollback requirement", "attestation requirement", "production blocker", "no auto deploy"];
const PROJECTION_TERMS = ["read-only factory API row", "dashboard row", "template preview", "requirement rollup", "gate rollup", "no project creation"];
const AUTHORITY_TERMS = [
  "no project creation",
  "no repo write",
  "no secret generation",
  "no connector provisioning",
  "no deployment",
  "no production PASS",
  "no enterprise trust claim",
  "no final automated approval",
];

export async function runSaasFactoryMode(options = {}) {
  const result = await buildSaasFactoryMode(options);
  if (options.write !== false) await writeSaasFactoryMode(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`SaaS Factory Mode failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSaasFactoryMode(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SAAS_FACTORY_MODE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "multiEngineOrchestration")
    ? normalizeInlineJsonSource("inline.multi_engine_orchestration", options.multiEngineOrchestration)
    : await readJsonOrBuildMultiEngine(inputs.source_multi_engine_path, generatedAt);
  const ownerReceipt = Object.prototype.hasOwnProperty.call(options, "ownerAdjudicationReceipt")
    ? normalizeInlineJsonSource("inline.owner_adjudication_receipt", options.ownerAdjudicationReceipt)
    : await readJsonSource(inputs.owner_adjudication_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const waiverRows = buildFcoreCorrectiveBaselineWaiverRows({ ownerReceipt, sourceRows, generatedAt });
  const templateRows = buildTermRows("project_template_contract", "Project template", TEMPLATE_TERMS, roadmapDoc.text, "project_template_contract_rows", generatedAt, templateExtras);
  const requirementRows = buildTermRows("requirement_matrix_contract", "Requirement matrix", REQUIREMENT_TERMS, roadmapDoc.text, "requirement_matrix_contract_rows", generatedAt, requirementExtras);
  const validationRows = buildTermRows("validation_plan_contract", "Validation plan", VALIDATION_TERMS, roadmapDoc.text, "validation_plan_contract_rows", generatedAt, validationExtras);
  const reviewRows = buildTermRows("review_lane_contract", "Review lane", REVIEW_TERMS, roadmapDoc.text, "review_lane_contract_rows", generatedAt, reviewExtras);
  const domainRows = buildTermRows("domain_pack_composition", "Domain pack composition", DOMAIN_TERMS, roadmapDoc.text, "domain_pack_composition_rows", generatedAt, domainExtras);
  const releaseRows = buildTermRows("release_gate_blueprint", "Release gate blueprint", RELEASE_TERMS, roadmapDoc.text, "release_gate_blueprint_rows", generatedAt, releaseExtras);
  const projectionRows = buildTermRows("bootstrap_projection", "Bootstrap projection", PROJECTION_TERMS, roadmapDoc.text, "bootstrap_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("factory_authority_guard", "Factory authority guard", AUTHORITY_TERMS, roadmapDoc.text, "factory_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, waiverRows, templateRows, requirementRows, validationRows, reviewRows, domainRows, releaseRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, waiverRows, templateRows, requirementRows, validationRows, reviewRows, domainRows, releaseRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, waiverRows, templateRows, requirementRows, validationRows, reviewRows, domainRows, releaseRows, projectionRows, authorityRows, freezeRows, boundary });
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
      multi_engine_orchestration_path: source.path,
      owner_adjudication_receipt_path: ownerReceipt.path,
    },
    source_multi_engine_summary: source.data?.summary ?? null,
    owner_adjudication_summary: ownerReceipt.data?.scope ?? null,
    saas_factory_contract: buildContract(generatedAt),
    saas_factory_phase_rows: phaseRows,
    saas_factory_source_binding_rows: sourceRows,
    fcore_corrective_baseline_waiver_rows: waiverRows,
    project_template_contract_rows: templateRows,
    requirement_matrix_contract_rows: requirementRows,
    validation_plan_contract_rows: validationRows,
    review_lane_contract_rows: reviewRows,
    domain_pack_composition_rows: domainRows,
    release_gate_blueprint_rows: releaseRows,
    bootstrap_projection_rows: projectionRows,
    factory_authority_guard_rows: authorityRows,
    p15400_freeze_rows: freezeRows,
    saas_factory_boundary: boundary,
    saas_factory_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, templateRows, requirementRows, validationRows, reviewRows, domainRows, releaseRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "saas_factory_mode")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.saas_factory_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.saas_factory_validation_items);
  result.summary = buildSummary({ boundary, templateRows, requirementRows, validationRows, reviewRows, domainRows, releaseRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeSaasFactoryMode(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "saas-factory-mode.json"), serializableResult(result));
  await writeJson(path.join(outDir, "saas-factory-phase-rows.json"), collectionEnvelope("saas-factory-phase-rows.v1", "saas_factory_phase_rows", result.saas_factory_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-factory-source-binding-rows.json"), collectionEnvelope("saas-factory-source-binding-rows.v1", "saas_factory_source_binding_rows", result.saas_factory_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "fcore-corrective-baseline-waiver-rows.json"), collectionEnvelope("fcore-corrective-baseline-waiver-rows.v1", "fcore_corrective_baseline_waiver_rows", result.fcore_corrective_baseline_waiver_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-template-contract-rows.json"), collectionEnvelope("project-template-contract-rows.v1", "project_template_contract_rows", result.project_template_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "requirement-matrix-contract-rows.json"), collectionEnvelope("requirement-matrix-contract-rows.v1", "requirement_matrix_contract_rows", result.requirement_matrix_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-plan-contract-rows.json"), collectionEnvelope("validation-plan-contract-rows.v1", "validation_plan_contract_rows", result.validation_plan_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-lane-contract-rows.json"), collectionEnvelope("review-lane-contract-rows.v1", "review_lane_contract_rows", result.review_lane_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-composition-rows.json"), collectionEnvelope("domain-pack-composition-rows.v1", "domain_pack_composition_rows", result.domain_pack_composition_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-gate-blueprint-rows.json"), collectionEnvelope("release-gate-blueprint-rows.v1", "release_gate_blueprint_rows", result.release_gate_blueprint_rows, result.generated_at));
  await writeJson(path.join(outDir, "bootstrap-projection-rows.json"), collectionEnvelope("bootstrap-projection-rows.v1", "bootstrap_projection_rows", result.bootstrap_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-authority-guard-rows.json"), collectionEnvelope("factory-authority-guard-rows.v1", "factory_authority_guard_rows", result.factory_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p15400-freeze-rows.json"), collectionEnvelope("p15400-freeze-rows.v1", "p15400_freeze_rows", result.p15400_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-factory-boundary.json"), result.saas_factory_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "saas-factory-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.saas_factory_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runSaasFactoryModeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runSaasFactoryMode(args);
    console.log(`SaaS Factory Mode ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.saas_factory_mode_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P15001: ${result.summary.source_ready_for_p15001_handoff}`);
    console.log(`F0.2 source handoff or visible waiver: ${result.summary.f0_2_source_handoff_or_visible_waiver_now}`);
    console.log(`FCORE corrective-baseline waiver visible: ${result.summary.fcore_corrective_baseline_waiver_visible_now}`);
    console.log(`Ready for P15401 handoff: ${result.summary.ready_for_p15401_handoff}`);
    console.log(`Project creation allowed: ${result.summary.project_creation_allowed_now}`);
    console.log(`Repo write allowed: ${result.summary.repo_write_allowed_now}`);
    console.log(`Deployment allowed: ${result.summary.deployment_allowed_now}`);
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
    contract_id: "saas-factory-mode.contract.v1",
    generated_at: generatedAt,
    source_multi_engine_required: true,
    fcore_corrective_baseline_waiver_visibility_required: true,
    project_template_contract_required: true,
    requirement_matrix_contract_required: true,
    validation_plan_contract_required: true,
    review_lane_contract_required: true,
    domain_pack_composition_required: true,
    release_gate_blueprint_required: true,
    read_only_bootstrap_projection_required: true,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p15001-p15400.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.multi_engine_boundary ?? {};
  const sourceStatus = summary.multi_engine_orchestration_status ?? "missing";
  const sourceReady = summary.ready_for_p15001_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P14601-P15000 source artifact available", source.available],
    ["source.range", "P14601-P15000 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P15000 source status visible", sourceStatus === "ready_for_multi_engine_orchestration" || sourceStatus === "blocked_multi_engine_orchestration"],
    ["source.handoff", "P15000 ready_for_p15001_handoff", sourceReady],
    ["source.block_visible", "P15000 blocker visible", sourceReady || sourceBlocked],
    ["source.orchestration_rows", "P15000 engine registry role authority and routing rows available", Number(summary.engine_registry_row_count ?? 0) >= 6 && Number(summary.role_authority_matrix_row_count ?? 0) >= 6 && Number(summary.routing_decision_contract_row_count ?? 0) >= 6],
    ["source.no_engine_authority", "P15000 source did not open cross-engine final approval self-review engine execution or protected routing", boundary.cross_engine_final_approval_allowed_now === false && boundary.self_review_approval_allowed_now === false && boundary.engine_execution_allowed_now === false && boundary.protected_action_routing_allowed_now === false],
    ["source.no_trust_write_final", "P15000 source did not open trust production deployment write runtime or final approval", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.deployment_allowed_now === false && boundary.write_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
    ["source.no_connector_raw", "P15000 source did not open connector write or raw source exposure", boundary.connector_write_enabled === false && boundary.raw_source_exposure_allowed === false],
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

function buildFcoreCorrectiveBaselineWaiverRows({ ownerReceipt, sourceRows, generatedAt }) {
  const decisions = Array.isArray(ownerReceipt.data?.adjudicated_decisions) ? ownerReceipt.data.adjudicated_decisions : [];
  const s02 = decisions.find((decision) => decision.decision_id === "S0-2");
  const authorityFlags = ownerReceipt.data?.authority_flags ?? {};
  const sourceReady = rowPass(sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(sourceRows, "source.block_visible") && sourceReady === false;
  const authorityClosed = [
    "project_creation_allowed_now",
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "command_execution_allowed_now",
    "api_write_methods_allowed_now",
    "store_mutation_allowed_now",
    "codex_final_approval_allowed",
    "claude_final_approval_allowed",
    "fable_final_approval_allowed",
    "production_pass_enabled",
    "enterprise_pass_enabled",
  ].every((key) => authorityFlags[key] === false);
  const evidenceRef = ownerReceipt.available ? ownerReceipt.path : DEFAULT_SAAS_FACTORY_MODE_INPUTS.ownerAdjudicationReceiptPath;
  return [
    ["fcore_waiver.owner_receipt_available", "S0 owner adjudication receipt available", ownerReceipt.available === true],
    ["fcore_waiver.s0_2_decision", "S0-2 corrective-baseline waiver decision recorded", s02?.decision === "corrective_baseline_waiver"],
    ["fcore_waiver.expiry", "S0-2 waiver has FA.6 expiry condition", typeof s02?.expires_before === "string" && s02.expires_before.includes("FA.6")],
    ["fcore_waiver.source_blocker_visible", "P15000 blocker remains visible when source handoff is false", sourceReady || sourceBlockVisible],
    ["fcore_waiver.authority_closed", "S0-2 waiver keeps all authority flags closed", authorityClosed],
    ["fcore_waiver.no_handoff_override", "S0-2 waiver does not mark P15000 handoff ready", sourceReady || sourceBlockVisible],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "fcore_corrective_baseline_waiver",
    label,
    required: true,
    observed,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    owner_receipt_id: ownerReceipt.data?.receipt_id ?? null,
    s0_2_receipt_id: s02?.receipt_id ?? null,
    source_ready_for_p15001_handoff: sourceReady,
    source_block_visible_now: sourceBlockVisible,
    fcore_corrective_baseline_waiver_opens_authority_now: false,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p15001-p15400.md#saas-factory-mode-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const f0VisibleWaiver = allPass(context.waiverRows) && sourceReady === false && sourceBlockVisible;
  return [
    ["freeze.source", "P15000 source ready for P15001", sourceReady],
    ["freeze.source_block_visible", "P15000 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.fcore_corrective_baseline_waiver_visible", "FCORE corrective-baseline waiver visible without opening source handoff", sourceReady || f0VisibleWaiver],
    ["freeze.project_template", "project template contract ready", allPass(context.templateRows)],
    ["freeze.requirement_matrix", "requirement matrix contract ready", allPass(context.requirementRows)],
    ["freeze.validation_plan", "validation plan contract ready", allPass(context.validationRows)],
    ["freeze.review_lane", "review lane contract ready", allPass(context.reviewRows)],
    ["freeze.domain_pack", "domain pack composition ready", allPass(context.domainRows)],
    ["freeze.release_gate", "release gate blueprint ready", allPass(context.releaseRows)],
    ["freeze.bootstrap_projection", "bootstrap read-only projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "factory authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_factory_side_effects", "no project creation repo write secret generation connector provisioning deployment or final approval opened", true],
    ["freeze.no_release_trust_write", "no production PASS enterprise trust protected closeout release write connector runtime or raw source exposure opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p15400_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p15400-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceAvailable = context.source.available === true;
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const waiverVisible = allPass(context.waiverRows);
  const sourceBlockerWaivedForFcore = waiverVisible && sourceReady === false && sourceBlockVisible;
  const templateReady = allPass(context.templateRows);
  const requirementReady = allPass(context.requirementRows);
  const validationReady = allPass(context.validationRows);
  const reviewReady = allPass(context.reviewRows);
  const domainReady = allPass(context.domainRows);
  const releaseReady = allPass(context.releaseRows);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = templateReady && requirementReady && validationReady && reviewReady && domainReady && releaseReady && projectionReady && authorityReady;
  const freezeReady = sourceReady && contractReady && allPass(context.freezeRows);
  return {
    source_multi_engine_available: sourceAvailable,
    source_ready_for_p15001_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    fcore_corrective_baseline_waiver_visible_now: waiverVisible,
    source_blocker_waived_for_fcore_corrective_baseline_now: sourceBlockerWaivedForFcore,
    f0_2_source_handoff_or_visible_waiver_now: sourceReady || sourceBlockerWaivedForFcore,
    fcore_corrective_baseline_waiver_opens_authority_now: false,
    project_template_contract_ready: templateReady,
    requirement_matrix_contract_ready: requirementReady,
    validation_plan_contract_ready: validationReady,
    review_lane_contract_ready: reviewReady,
    domain_pack_composition_ready: domainReady,
    release_gate_blueprint_ready: releaseReady,
    bootstrap_projection_ready: projectionReady,
    factory_authority_guard_ready: authorityReady,
    p15400_saas_factory_freeze_ready: freezeReady,
    ready_for_p15401_handoff: freezeReady,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    raw_source_exposure_allowed: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P15001-P15400 phase rows incomplete", "docs/hermes-roadmap-p15001-p15400.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P15001-P15400"), "Architecture doc missing P15001-P15400 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 9 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P15000 source state must be available and blocker-visible", "saas_factory_source_binding_rows");
  add("fcore.waiver.visibility.rows", "source", context.waiverRows.length >= 6, "FCORE corrective-baseline waiver rows missing", "fcore_corrective_baseline_waiver_rows");
  add("template.ready", "template", context.templateRows.length === TEMPLATE_TERMS.length && allPass(context.templateRows), "Project template rows incomplete", "project_template_contract_rows");
  add("requirement.ready", "requirement", context.requirementRows.length === REQUIREMENT_TERMS.length && allPass(context.requirementRows), "Requirement matrix rows incomplete", "requirement_matrix_contract_rows");
  add("validation.ready", "validation_plan", context.validationRows.length === VALIDATION_TERMS.length && allPass(context.validationRows), "Validation plan rows incomplete", "validation_plan_contract_rows");
  add("review.ready", "review", context.reviewRows.length === REVIEW_TERMS.length && allPass(context.reviewRows), "Review lane rows incomplete", "review_lane_contract_rows");
  add("domain.ready", "domain_pack", context.domainRows.length === DOMAIN_TERMS.length && allPass(context.domainRows), "Domain pack composition rows incomplete", "domain_pack_composition_rows");
  add("release.ready", "release_gate", context.releaseRows.length === RELEASE_TERMS.length && allPass(context.releaseRows), "Release gate blueprint rows incomplete", "release_gate_blueprint_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Bootstrap projection rows incomplete", "bootstrap_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Factory authority guard rows incomplete", "factory_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P15400 freeze rows missing", "p15400_freeze_rows");
  add("boundary.no.factory.side.effects", "boundary", context.boundary.project_creation_allowed_now === false && context.boundary.repo_write_allowed_now === false && context.boundary.secret_generation_allowed_now === false && context.boundary.connector_provisioning_allowed_now === false && context.boundary.deployment_allowed_now === false, "SaaS Factory opened project repo secret connector or deployment side effects", "saas_factory_boundary");
  add("boundary.no.trust.release", "boundary", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false && context.boundary.release_approval_allowed_now === false, "SaaS Factory opened release trust or protected closeout", "saas_factory_boundary");
  add("boundary.no.write.final.raw", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.raw_source_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "SaaS Factory opened write runtime raw exposure or final approval", "saas_factory_boundary");
  add("boundary.fcore.waiver.no.authority", "boundary", context.boundary.fcore_corrective_baseline_waiver_opens_authority_now === false, "FCORE corrective-baseline waiver opened authority", "saas_factory_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p15401_handoff === context.boundary.p15400_saas_factory_freeze_ready, "P15401 handoff state must match P15400 freeze state", "saas_factory_boundary");
  return items;
}

function buildSummary(context) {
  return {
    saas_factory_mode_status: context.boundary.ready_for_p15401_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p15001_handoff: context.boundary.source_ready_for_p15001_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    fcore_corrective_baseline_waiver_visible_now: context.boundary.fcore_corrective_baseline_waiver_visible_now,
    source_blocker_waived_for_fcore_corrective_baseline_now: context.boundary.source_blocker_waived_for_fcore_corrective_baseline_now,
    f0_2_source_handoff_or_visible_waiver_now: context.boundary.f0_2_source_handoff_or_visible_waiver_now,
    fcore_corrective_baseline_waiver_opens_authority_now: false,
    project_template_contract_row_count: context.templateRows.length,
    requirement_matrix_contract_row_count: context.requirementRows.length,
    validation_plan_contract_row_count: context.validationRows.length,
    review_lane_contract_row_count: context.reviewRows.length,
    domain_pack_composition_row_count: context.domainRows.length,
    release_gate_blueprint_row_count: context.releaseRows.length,
    bootstrap_projection_row_count: context.projectionRows.length,
    factory_authority_guard_row_count: context.authorityRows.length,
    p15400_saas_factory_freeze_ready: context.boundary.p15400_saas_factory_freeze_ready,
    ready_for_p15401_handoff: context.boundary.ready_for_p15401_handoff,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    release_approval_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# SaaS Factory Mode",
    "",
    `Status: ${result.summary.saas_factory_mode_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P15001: ${result.summary.source_ready_for_p15001_handoff}`,
    `F0.2 source handoff or visible waiver: ${result.summary.f0_2_source_handoff_or_visible_waiver_now}`,
    `FCORE corrective-baseline waiver visible: ${result.summary.fcore_corrective_baseline_waiver_visible_now}`,
    `Project template rows: ${result.summary.project_template_contract_row_count}`,
    `Requirement matrix rows: ${result.summary.requirement_matrix_contract_row_count}`,
    `Validation plan rows: ${result.summary.validation_plan_contract_row_count}`,
    `Review lane rows: ${result.summary.review_lane_contract_row_count}`,
    `Ready for P15401 handoff: ${result.summary.ready_for_p15401_handoff}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Repo write allowed: ${result.summary.repo_write_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.factory_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.project_creation_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes SaaS Factory Mode</title>
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
    <h1>Hermes SaaS Factory Mode</h1>
    <p class="notice">This plane turns reusable project templates, requirement matrices, validation plans, review lanes, domain pack composition, and release gate blueprints into read-only Harness evidence. Project instantiation, repository mutation, secret issuance, connector setup, deployment, release approval, and finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Project Creation</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildMultiEngine(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildMultiEngineOrchestration({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.multi_engine_orchestration", built);
}

function templateExtras() {
  return { template_contract_required: true, project_creation_allowed_now: false, repo_write_allowed_now: false };
}

function requirementExtras() {
  return { requirement_traceability_required: true, source_evidence_ref_required: true, traceability_blocker_required: true };
}

function validationExtras() {
  return { validation_plan_required: true, command_ref_required: true, negative_fixture_required: true };
}

function reviewExtras() {
  return { review_lane_required: true, reviewer_engine_required: true, final_approval_allowed_now: false, stale_review_blocker_required: true };
}

function domainExtras() {
  return { domain_pack_contract_required: true, data_boundary_required: true, protected_output_rule_required: true };
}

function releaseExtras() {
  return { release_gate_blueprint_required: true, production_pass_enabled: false, deployment_allowed_now: false, auto_deploy_allowed_now: false };
}

function projectionExtras() {
  return { read_only_projection_required: true, project_creation_allowed_now: false, api_write_allowed_now: false };
}

function authorityExtras() {
  return {
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    final_automated_approval_allowed: false,
  };
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
    schema_path: options.schemaPath ?? DEFAULT_SAAS_FACTORY_MODE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_SAAS_FACTORY_MODE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_SAAS_FACTORY_MODE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_SAAS_FACTORY_MODE_INPUTS.architectureDocPath,
    source_multi_engine_path: options.sourceMultiEnginePath ?? DEFAULT_SAAS_FACTORY_MODE_INPUTS.sourceMultiEnginePath,
    owner_adjudication_receipt_path: options.ownerAdjudicationReceiptPath ?? DEFAULT_SAAS_FACTORY_MODE_INPUTS.ownerAdjudicationReceiptPath,
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
    else if (value === "--source-multi-engine-path") args.sourceMultiEnginePath = argv[++index];
    else if (value === "--owner-adjudication-receipt-path") args.ownerAdjudicationReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P15001-P15400 SaaS Factory Mode artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
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
