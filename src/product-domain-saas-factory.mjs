import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReviewEnterpriseTrustHardening } from "./review-enterprise-trust-hardening.mjs";

export const DEFAULT_PRODUCT_DOMAIN_SAAS_FACTORY_OUT_DIR = "artifacts/product-domain-saas-factory/latest";
export const DEFAULT_PRODUCT_DOMAIN_SAAS_FACTORY_INPUTS = {
  schemaPath: "schemas/product-domain-saas-factory.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:product-domain-saas-factory";
const REVIEW_TRUST_COMMAND_NAME = "platform:review-enterprise-trust-hardening";
const SCHEMA_VERSION = "product-domain-saas-factory.v1";
const CAPABILITY_ID = "platform.product_domain_saas_factory";
const PROGRAM_RANGE = "P6201-P6600";
const READY_STATUS = "ready_for_product_domain_saas_factory_v0";
const REVIEW_TRUST_READY_STATUS = "ready_for_review_enterprise_trust_hardening_v0";

const PHASE_SPECS = [
  ["P6201-P6240", "SaaS Project Intake Contract"],
  ["P6241-P6280", "Requirement Traceability Matrix"],
  ["P6281-P6320", "Domain Pack Factory Registry"],
  ["P6321-P6360", "HR SaaS Control Plan Pack"],
  ["P6361-P6400", "Law-Firm SaaS Control Plan Pack"],
  ["P6401-P6440", "Personal-Dev SaaS Control Plan Pack"],
  ["P6441-P6480", "Creative-Document SaaS Control Plan Pack"],
  ["P6481-P6520", "Connector and Resource SaaS Control Plan Pack"],
  ["P6521-P6560", "Factory Review and Trust Lane"],
  ["P6561-P6600", "Product Domain SaaS Factory Freeze"],
];

const SAAS_PROJECT_SPECS = [
  ["project.hr_solution_internalization", "HR Solution", "human_resources", "requirements_traceable_hr_saas_control_plan"],
  ["project.law_firm_os", "Law Firm OS", "law_firm", "matter_first_law_firm_saas_control_plan"],
  ["project.hermes_harness", "Hermes Harness", "platform", "multi_project_governance_harness"],
  ["project.zendd_bridge", "Zendd Bridge", "external_adapter", "no_write_external_project_adapter"],
];

const DOMAIN_PACK_SPECS = [
  ["domain.personal_dev", "personal-dev", "development_projects", "issue, plan, worktree, diff, test, PR draft, rollback"],
  ["domain.law_firm", "law-firm", "matter_operations", "matter, VDR, LDD, citation, review packet, attorney gate boundary"],
  ["domain.creative_document", "creative-document", "document_outputs", "template, style, asset, DOCX, PPTX, PDF, HTML review"],
  ["domain.connectors_resource", "connectors-resource", "resource_ingestion", "read-only ingestion, classification, quarantine, evidence"],
  ["domain.trading_read_only", "trading-read-only", "trading_safety", "read-only safety, backtest review, no live action"],
];

const FACTORY_UI_SURFACES = [
  ["surface.project_portfolio", "Project Portfolio", "list SaaS projects, owner, domain pack, current phase, trust tier"],
  ["surface.control_plan_registry", "Control Plan Registry", "register phase bands, requirement ids, gate ids, review refs"],
  ["surface.requirement_traceability", "Requirement Traceability", "map requirement source to phase, acceptance, evidence, reviewer"],
  ["surface.phase_progress_board", "Phase Progress Board", "show ready, blocked, pending external evidence, and next action"],
  ["surface.codex_harness_claude_lane", "Codex-Harness-Claude Lane", "show implementation packet, validation, Claude receipt, finding loop"],
  ["surface.evidence_and_receipts", "Evidence and Receipts", "show validator, CI, attestation, review, and transcript refs"],
  ["surface.domain_pack_console", "Domain Pack Console", "show pack capabilities, boundaries, forbidden actions, rollout level"],
  ["surface.context_recovery", "Context Recovery", "show source-cited restart bundles and forgotten-context blockers"],
];

const FACTORY_NEGATIVE_FIXTURES = [
  ["negative.hermes_as_single_vertical_saas", "Hermes is presented as only the HR or law-firm SaaS product", "BLOCK_PRODUCT_IDENTITY_DRIFT"],
  ["negative.launch_without_requirement_trace", "SaaS project is launch-ready without requirement traceability", "BLOCK_UNTRACEABLE_SAAS_RELEASE"],
  ["negative.codex_self_approval", "Codex-created work is approved by Codex as final", "BLOCK_SELF_APPROVAL"],
  ["negative.claude_as_product_approver", "Claude review receipt is treated as product launch approval", "BLOCK_REVIEWER_AS_APPROVER"],
  ["negative.no_human_as_launch_authority", "No-human milestone mode is treated as protected product launch authority", "BLOCK_PROTECTED_FINAL_DECISION"],
  ["negative.raw_sensitive_hr_data", "HR SaaS control plan imports raw employee or applicant data", "BLOCK_RAW_SENSITIVE_DATA"],
  ["negative.external_project_write", "Factory lane writes to an external SaaS project repository or service", "BLOCK_EXTERNAL_WRITE"],
];

export async function runProductDomainSaasFactory(options = {}) {
  const result = await buildProductDomainSaasFactory(options);
  if (options.write !== false) await writeProductDomainSaasFactory(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Product domain SaaS factory failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProductDomainSaasFactory(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PRODUCT_DOMAIN_SAAS_FACTORY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const reviewTrust = options.reviewTrust ?? await buildReviewEnterpriseTrustHardening({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildFactoryContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const projectIntakeRows = buildProjectIntakeRows(generatedAt);
  const requirementTraceabilityRows = buildRequirementTraceabilityRows(generatedAt);
  const domainPackFactoryRows = buildDomainPackFactoryRows(generatedAt);
  const controlPlanRows = buildControlPlanRows({ projectIntakeRows, generatedAt });
  const reviewProcessBindingRows = buildReviewProcessBindingRows(generatedAt);
  const factoryUiSurfaceRows = buildFactoryUiSurfaceRows(generatedAt);
  const factoryTrustBoundaryRows = buildFactoryTrustBoundaryRows({ reviewTrust, generatedAt });
  const negativeFixtureRows = buildFactoryNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({ projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, reviewTrust, contract, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows });
  const boundary = buildBoundary({ reviewTrust, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, reviewTrust, contract, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    product_domain_saas_factory_id: `product-domain-saas-factory.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_review_enterprise_trust_hardening_summary: reviewTrust.summary,
    product_domain_saas_factory_contract: contract,
    product_domain_saas_factory_phase_rows: phaseRows,
    saas_project_intake_rows: projectIntakeRows,
    requirement_traceability_rows: requirementTraceabilityRows,
    domain_pack_factory_rows: domainPackFactoryRows,
    control_plan_rows: controlPlanRows,
    review_process_binding_rows: reviewProcessBindingRows,
    factory_ui_surface_rows: factoryUiSurfaceRows,
    factory_trust_boundary_rows: factoryTrustBoundaryRows,
    factory_negative_fixture_rows: negativeFixtureRows,
    product_domain_saas_factory_freeze_rows: freezeRows,
    product_domain_saas_factory_gate_rows: gateRows,
    product_domain_saas_factory_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ reviewTrust, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "product_domain_saas_factory")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ reviewTrust, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.product_domain_saas_factory_id = result.product_domain_saas_factory_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeProductDomainSaasFactory(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "product-domain-saas-factory.json"), serializableResult(result));
  await writeJson(path.join(outDir, "saas-project-intake-rows.json"), collectionEnvelope("saas-project-intake-rows.v1", "saas_project_intake_rows", result.saas_project_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "requirement-traceability-rows.json"), collectionEnvelope("requirement-traceability-rows.v1", "requirement_traceability_rows", result.requirement_traceability_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-factory-rows.json"), collectionEnvelope("domain-pack-factory-rows.v1", "domain_pack_factory_rows", result.domain_pack_factory_rows, result.generated_at));
  await writeJson(path.join(outDir, "control-plan-rows.json"), collectionEnvelope("control-plan-rows.v1", "control_plan_rows", result.control_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-process-binding-rows.json"), collectionEnvelope("review-process-binding-rows.v1", "review_process_binding_rows", result.review_process_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-ui-surface-rows.json"), collectionEnvelope("factory-ui-surface-rows.v1", "factory_ui_surface_rows", result.factory_ui_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-trust-boundary-rows.json"), collectionEnvelope("factory-trust-boundary-rows.v1", "factory_trust_boundary_rows", result.factory_trust_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-negative-fixture-rows.json"), collectionEnvelope("factory-negative-fixture-rows.v1", "factory_negative_fixture_rows", result.factory_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-domain-saas-factory-freeze-rows.json"), collectionEnvelope("product-domain-saas-factory-freeze-rows.v1", "product_domain_saas_factory_freeze_rows", result.product_domain_saas_factory_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-domain-saas-factory-gate-rows.json"), collectionEnvelope("product-domain-saas-factory-gate-rows.v1", "product_domain_saas_factory_gate_rows", result.product_domain_saas_factory_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-domain-saas-factory-boundary.json"), result.product_domain_saas_factory_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "product-domain-saas-factory-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runProductDomainSaasFactoryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runProductDomainSaasFactory(args);
    console.log(`Product domain SaaS factory ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.product_domain_saas_factory_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`SaaS projects: ${result.summary.saas_project_count}`);
    console.log(`Domain packs: ${result.summary.domain_pack_count}`);
    console.log(`HR SaaS control plan ready: ${result.summary.hr_saas_control_plan_ready}`);
    console.log(`Hermes vertical SaaS claim enabled: ${result.summary.hermes_vertical_saas_claim_enabled}`);
    console.log(`SaaS launch enabled: ${result.summary.saas_product_launch_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFactoryContract(generatedAt) {
  return {
    schema_version: "product-domain-saas-factory-contract.v1",
    generated_at: generatedAt,
    contract_id: "product-domain-saas-factory-contract.p6201-p6600",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5801-P6200",
    saas_project_intake_required: true,
    requirement_traceability_required: true,
    domain_pack_factory_registry_required: true,
    hr_saas_control_plan_required: true,
    law_firm_saas_control_plan_required: true,
    personal_dev_control_plan_required: true,
    creative_document_control_plan_required: true,
    connector_resource_control_plan_required: true,
    codex_harness_claude_review_process_required: true,
    milestone_claude_review_receipt_required: true,
    hermes_as_control_harness_not_vertical_saas: true,
    hermes_vertical_saas_claim_enabled: false,
    saas_product_launch_enabled: false,
    external_project_write_enabled: false,
    raw_sensitive_data_ingestion_enabled: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "product-domain-saas-factory-phase-row.v1",
      row_id: `product.domain.saas.factory.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.product_domain_saas_factory.${phase_range}`,
      responsible_owner: "platform_product_owner",
      next_allowed_action: pass ? "preserve SaaS factory phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildProjectIntakeRows(generatedAt) {
  return SAAS_PROJECT_SPECS.map(([project_id, display_name, domain, control_plan_type]) => ({
    schema_version: "saas-project-intake-row.v1",
    row_id: `saas.project.intake.row.${project_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    project_id,
    display_name,
    domain,
    control_plan_type,
    intake_status: "READY_FOR_CONTROL_PLAN",
    requirement_source_required: true,
    plan_registry_required: true,
    phase_progress_required: true,
    evidence_registry_required: true,
    review_process_binding_required: true,
    transcript_source_binding_required: true,
    raw_sensitive_data_allowed: false,
    external_project_write_allowed: false,
    product_launch_allowed: false,
    evidence_ref: `evidence.saas_project_intake.${project_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.saas_project_intake.${project_id}`,
    next_allowed_action: "register requirement trace and control plan without product writes",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRequirementTraceabilityRows(generatedAt) {
  const specs = [
    ["trace.hr_solution", "project.hr_solution_internalization", "HR-Solution-Spec.md or equivalent requirement inventory", "HR requirement ids, acceptance criteria, evidence, review refs"],
    ["trace.law_firm_os", "project.law_firm_os", "law-firm-os product contract and RP phases", "matter-first requirement ids, tenant/matter trace, evidence, review refs"],
    ["trace.hermes_harness", "project.hermes_harness", "Hermes P4001-P8000 roadmap", "phase ids, gate ids, evidence refs, trust boundary refs"],
    ["trace.zendd_bridge", "project.zendd_bridge", "Zendd adapter receipts and no-write plan", "work order ids, diff review refs, rollback refs, no-write evidence"],
  ];
  return specs.map(([trace_id, project_id, source_ref, trace_fields]) => ({
    schema_version: "requirement-traceability-row.v1",
    row_id: `requirement.traceability.row.${trace_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    trace_id,
    project_id,
    requirement_source_ref: source_ref,
    trace_fields,
    requirement_inventory_required: true,
    requirement_ids_bound_now: false,
    acceptance_criteria_required: true,
    phase_mapping_required: true,
    evidence_mapping_required: true,
    claude_review_receipt_required: true,
    launch_without_trace_allowed: false,
    evidence_ref: `evidence.requirement_traceability.${trace_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.requirement_traceability.${trace_id}`,
    next_allowed_action: "bind concrete requirement ids before any project release claim",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildDomainPackFactoryRows(generatedAt) {
  return DOMAIN_PACK_SPECS.map(([domain_pack_id, pack_name, domain_scope, capability_summary]) => ({
    schema_version: "domain-pack-factory-row.v1",
    row_id: `domain.pack.factory.row.${pack_name.replaceAll("-", "_")}`,
    generated_at: generatedAt,
    domain_pack_id,
    pack_name,
    domain_scope,
    capability_summary,
    domain_goal_workflow_contract_required: true,
    pass_owner_required: true,
    evidence_gate_required: true,
    compatibility_gate_required: true,
    rollout_level: "CONTROL_PLAN_ONLY",
    runtime_execution_allowed: false,
    write_action_allowed: false,
    protected_action_allowed: false,
    evidence_ref: `evidence.domain_pack_factory.${domain_pack_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.domain_pack_factory.${domain_pack_id}`,
    next_allowed_action: "register domain control-plan contract before runtime rollout",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildControlPlanRows({ projectIntakeRows, generatedAt }) {
  return projectIntakeRows.map((project) => ({
    schema_version: "control-plan-row.v1",
    row_id: `control.plan.row.${project.project_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    project_id: project.project_id,
    control_plan_id: `control_plan.${project.project_id}`,
    plan_registry_ready: true,
    phase_lane_required: true,
    requirement_traceability_required: true,
    evidence_lane_required: true,
    codex_harness_claude_review_lane_required: true,
    transcript_source_required: true,
    blocker_next_action_required: true,
    product_launch_ready: false,
    external_write_ready: false,
    evidence_ref: `evidence.control_plan.${project.project_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.control_plan.${project.project_id}`,
    next_allowed_action: "show control plan in factory UI and keep product launch blocked",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildReviewProcessBindingRows(generatedAt) {
  const steps = [
    ["step.codex_implementation_packet", "Codex implementation packet", "engine.codex.primary_developer"],
    ["step.harness_deterministic_validation", "Harness deterministic validation", "engine.harness.deterministic_validator"],
    ["step.claude_review_receipt", "Claude Code Opus max independent review receipt", "engine.claude_code_opus_max.independent_reviewer"],
    ["step.finding_loop_revalidation", "Finding loop and revalidation", "engine.harness.deterministic_validator"],
    ["step.receipt_registration", "Receipt registration", "engine.harness.deterministic_validator"],
    ["step.single_owner_trust_classification", "Single-owner trust classification", "engine.harness.deterministic_validator"],
  ];
  return steps.map(([step_id, step_name, engine_ref], index) => ({
    schema_version: "review-process-binding-row.v1",
    row_id: `review.process.binding.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    step_id,
    step_name,
    engine_ref,
    sequence_index: index + 1,
    applies_to_all_factory_projects: true,
    claude_review_receipt_required: step_id === "step.claude_review_receipt",
    codex_self_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    human_adjudication_in_milestone_gate: false,
    evidence_ref: `evidence.review_process_binding.${step_id}`,
    reviewer_ref: step_id === "step.claude_review_receipt" ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.review_process_binding.${step_id}`,
    next_allowed_action: "preserve review process binding for every factory project",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFactoryUiSurfaceRows(generatedAt) {
  return FACTORY_UI_SURFACES.map(([surface_id, surface_name, surface_purpose], index) => ({
    schema_version: "factory-ui-surface-row.v1",
    row_id: `factory.ui.surface.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    surface_id,
    surface_name,
    surface_purpose,
    queue_first: index === 0,
    shows_phase_status: true,
    shows_requirement_trace: surface_id.includes("requirement") || surface_id.includes("control_plan") || surface_id.includes("project_portfolio"),
    shows_review_process: true,
    shows_block_reason: true,
    shows_next_allowed_action: true,
    writes_product_state: false,
    launches_product: false,
    evidence_ref: `evidence.factory_ui_surface.${surface_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.factory_ui_surface.${surface_id}`,
    next_allowed_action: "project UI surface into operator console without product writes",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFactoryTrustBoundaryRows({ reviewTrust, generatedAt }) {
  const reviewReady = reviewTrust.summary?.review_enterprise_trust_hardening_status === REVIEW_TRUST_READY_STATUS;
  return [
    {
      schema_version: "factory-trust-boundary-row.v1",
      row_id: "factory.trust.boundary.row.001",
      generated_at: generatedAt,
      boundary_id: "factory.single_owner_lower_trust",
      review_enterprise_trust_hardening_ready: reviewReady,
      single_owner_lower_trust_mode: true,
      hermes_vertical_saas_claim_enabled: false,
      saas_product_launch_enabled: false,
      external_project_write_enabled: false,
      enterprise_trust_claim_enabled: false,
      protected_closeout_enabled: false,
      work_os_claim_enabled: false,
      evidence_ref: "evidence.factory_trust_boundary.single_owner_lower_trust",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.factory_trust_boundary.single_owner_lower_trust",
      next_allowed_action: "govern multiple SaaS projects as lower-trust control plans only",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildFactoryNegativeFixtureRows(generatedAt) {
  return FACTORY_NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "factory-negative-fixture-row.v1",
    row_id: `factory.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_factory_claim_allowed: false,
    evidence_ref: `evidence.factory_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.factory_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve factory negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFreezeRows({ projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, generatedAt }) {
  const specs = [
    ["project_intake_ready", projectIntakeRows.every((row) => row.intake_status === "READY_FOR_CONTROL_PLAN" && row.external_project_write_allowed === false), "SaaS project intake is control-plan only"],
    ["requirement_traceability_ready", requirementTraceabilityRows.every((row) => row.requirement_inventory_required && row.launch_without_trace_allowed === false), "requirement traceability blocks untraceable releases"],
    ["domain_pack_factory_ready", domainPackFactoryRows.every((row) => row.rollout_level === "CONTROL_PLAN_ONLY" && row.runtime_execution_allowed === false), "domain packs are registered as control plans"],
    ["control_plans_ready", controlPlanRows.every((row) => row.plan_registry_ready && row.product_launch_ready === false), "control plans are ready while product launch is blocked"],
    ["review_process_bound", reviewProcessBindingRows.every((row) => row.codex_self_approval_allowed === false && row.human_adjudication_in_milestone_gate === false), "Codex-Harness-Claude review process is bound"],
    ["factory_ui_ready", factoryUiSurfaceRows.every((row) => row.writes_product_state === false && row.shows_next_allowed_action), "factory UI surfaces are read-only control surfaces"],
    ["factory_trust_boundary_ready", factoryTrustBoundaryRows.every((row) => row.single_owner_lower_trust_mode && row.enterprise_trust_claim_enabled === false), "factory trust boundary stays lower-trust"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_factory_claim_allowed === false), "factory negative fixtures block unsafe claims"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "product-domain-saas-factory-freeze-row.v1",
    row_id: `product.domain.saas.factory.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.product_domain_saas_factory.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.product_domain_saas_factory.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, reviewTrust, contract, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:product-domain-saas-factory"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes product domain SaaS factory"],
    ["review_trust_script_registered", Boolean(packageJson.data?.scripts?.[REVIEW_TRUST_COMMAND_NAME]), "review enterprise trust hardening script exists"],
    ["review_trust_ready", reviewTrust.summary?.review_enterprise_trust_hardening_status === REVIEW_TRUST_READY_STATUS, "P5801-P6200 review trust hardening is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Product and Domain SaaS Factory"), "P6201-P6600 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Product and Domain SaaS Factory"), "architecture doc reflects product domain SaaS factory"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Product and Domain SaaS Factory"), "review dashboard IA reflects product domain SaaS factory"],
    ["contract_ready", contract.saas_project_intake_required && contract.hermes_vertical_saas_claim_enabled === false && contract.human_adjudication_in_milestone_gate === false, "product domain SaaS factory contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P6201-P6600 phase rows pass"],
    ["project_intake_ready", projectIntakeRows.length >= 4 && projectIntakeRows.every((row) => row.intake_status === "READY_FOR_CONTROL_PLAN"), "SaaS project intake rows are ready"],
    ["hr_project_registered", projectIntakeRows.some((row) => row.project_id === "project.hr_solution_internalization"), "HR Solution project control plan is registered"],
    ["law_firm_project_registered", projectIntakeRows.some((row) => row.project_id === "project.law_firm_os"), "Law Firm OS project control plan is registered"],
    ["requirement_traceability_ready", requirementTraceabilityRows.every((row) => row.requirement_inventory_required && row.launch_without_trace_allowed === false), "requirement traceability rows are ready"],
    ["domain_packs_ready", domainPackFactoryRows.length >= 5 && domainPackFactoryRows.every((row) => row.rollout_level === "CONTROL_PLAN_ONLY"), "domain pack factory rows are ready"],
    ["control_plans_ready", controlPlanRows.every((row) => row.plan_registry_ready && row.product_launch_ready === false), "control plans are ready"],
    ["review_process_binding_ready", reviewProcessBindingRows.length === 6 && reviewProcessBindingRows.every((row) => row.codex_self_approval_allowed === false && row.claude_final_approval_allowed === false), "review process binding rows are ready"],
    ["factory_ui_surfaces_ready", factoryUiSurfaceRows.length >= 8 && factoryUiSurfaceRows.every((row) => row.writes_product_state === false), "factory UI surfaces are read-only"],
    ["factory_trust_boundary_ready", factoryTrustBoundaryRows.every((row) => row.hermes_vertical_saas_claim_enabled === false && row.saas_product_launch_enabled === false), "factory trust boundary blocks launch claims"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "factory negative fixtures are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_runtime_write", contract.agent_runtime_execution_enabled === false && contract.write_action_enabled === false && contract.protected_action_enabled === false, "runtime/write/protected action stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "product-domain-saas-factory-gate-row.v1",
    row_id: `product.domain.saas.factory.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.product_domain_saas_factory.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("review") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.product_domain_saas_factory.${gate_id}`,
    responsible_owner: "platform_product_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ reviewTrust, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    reviewTrust.summary?.review_enterprise_trust_hardening_status !== REVIEW_TRUST_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    projectIntakeRows.some((row) => row.raw_sensitive_data_allowed || row.external_project_write_allowed || row.product_launch_allowed),
    requirementTraceabilityRows.some((row) => row.launch_without_trace_allowed),
    domainPackFactoryRows.some((row) => row.runtime_execution_allowed || row.write_action_allowed || row.protected_action_allowed),
    controlPlanRows.some((row) => row.product_launch_ready || row.external_write_ready),
    reviewProcessBindingRows.some((row) => row.codex_self_approval_allowed || row.claude_final_approval_allowed || row.reviewer_mutation_allowed || row.human_adjudication_in_milestone_gate),
    factoryUiSurfaceRows.some((row) => row.writes_product_state || row.launches_product),
    factoryTrustBoundaryRows.some((row) => row.hermes_vertical_saas_claim_enabled || row.saas_product_launch_enabled || row.enterprise_trust_claim_enabled || row.work_os_claim_enabled),
    negativeFixtureRows.some((row) => row.unsafe_factory_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "product-domain-saas-factory-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5801-P6200",
    product_domain_saas_factory_ready: unsafeFlags.filter(Boolean).length === 0,
    review_enterprise_trust_hardening_ready: reviewTrust.summary?.review_enterprise_trust_hardening_status === REVIEW_TRUST_READY_STATUS,
    multi_project_saas_governance_ready: projectIntakeRows.length >= 4 && domainPackFactoryRows.length >= 5,
    hr_saas_control_plan_ready: projectIntakeRows.some((row) => row.project_id === "project.hr_solution_internalization") && controlPlanRows.some((row) => row.project_id === "project.hr_solution_internalization"),
    law_firm_saas_control_plan_ready: projectIntakeRows.some((row) => row.project_id === "project.law_firm_os") && controlPlanRows.some((row) => row.project_id === "project.law_firm_os"),
    requirement_traceability_contract_ready: requirementTraceabilityRows.every((row) => row.requirement_inventory_required && row.acceptance_criteria_required),
    codex_harness_claude_review_process_bound: reviewProcessBindingRows.length === 6 && reviewProcessBindingRows.every((row) => row.applies_to_all_factory_projects),
    single_owner_lower_trust_mode: true,
    hermes_vertical_saas_claim_enabled: false,
    saas_product_launch_enabled: false,
    external_project_write_enabled: false,
    raw_sensitive_data_ingestion_enabled: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, reviewTrust, contract, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include product domain SaaS factory command"),
    validationItem("review_trust.ready", "source", reviewTrust.summary?.review_enterprise_trust_hardening_status === REVIEW_TRUST_READY_STATUS, "review trust hardening must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P6201-P6600 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Product and Domain SaaS Factory"), "architecture must reflect product domain SaaS factory"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Product and Domain SaaS Factory"), "dashboard IA must reflect product domain SaaS factory"),
    validationItem("contract.ready", "contract", contract.saas_project_intake_required && contract.hermes_vertical_saas_claim_enabled === false, "factory contract must be ready"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P6201-P6600 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P6201-P6600 phase rows must pass"),
    validationItem("project_intake.ready", "projects", projectIntakeRows.length >= 4 && projectIntakeRows.every((row) => row.intake_status === "READY_FOR_CONTROL_PLAN"), "project intake rows must be ready"),
    validationItem("requirements.ready", "requirements", requirementTraceabilityRows.every((row) => row.requirement_inventory_required && row.launch_without_trace_allowed === false), "requirement traceability rows must be ready"),
    validationItem("domain_packs.ready", "domain_packs", domainPackFactoryRows.length >= 5 && domainPackFactoryRows.every((row) => row.rollout_level === "CONTROL_PLAN_ONLY"), "domain pack factory rows must be ready"),
    validationItem("control_plans.ready", "control_plans", controlPlanRows.every((row) => row.plan_registry_ready && row.product_launch_ready === false), "control plans must be ready and launch-blocked"),
    validationItem("review_process.ready", "review_process", reviewProcessBindingRows.length === 6 && reviewProcessBindingRows.every((row) => row.codex_self_approval_allowed === false && row.claude_final_approval_allowed === false), "review process rows must be ready"),
    validationItem("ui.ready", "ui", factoryUiSurfaceRows.length >= 8 && factoryUiSurfaceRows.every((row) => row.writes_product_state === false), "factory UI rows must be read-only"),
    validationItem("trust_boundary.ready", "trust", factoryTrustBoundaryRows.every((row) => row.hermes_vertical_saas_claim_enabled === false && row.enterprise_trust_claim_enabled === false), "factory trust boundary must block unsafe claims"),
    validationItem("negative_fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_factory_claim_allowed === false), "negative fixtures must block unsafe factory claims"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.not_vertical_saas", "boundary", boundary.hermes_vertical_saas_claim_enabled === false && boundary.multi_project_saas_governance_ready, "Hermes must remain a multi-project control harness"),
    validationItem("boundary.no_launch_write", "boundary", boundary.saas_product_launch_enabled === false && boundary.external_project_write_enabled === false && boundary.write_action_enabled === false, "SaaS launch/write must stay disabled"),
    validationItem("boundary.no_enterprise", "boundary", boundary.enterprise_trust_claim_enabled === false && boundary.protected_closeout_enabled === false, "enterprise trust and protected closeout must stay disabled"),
  ];
}

function buildSummary({ reviewTrust, phaseRows, projectIntakeRows, requirementTraceabilityRows, domainPackFactoryRows, controlPlanRows, reviewProcessBindingRows, factoryUiSurfaceRows, factoryTrustBoundaryRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "product-domain-saas-factory-summary.v1",
    product_domain_saas_factory_status: validation.valid && boundary.product_domain_saas_factory_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5801-P6200",
    review_enterprise_trust_hardening_status: reviewTrust.summary?.review_enterprise_trust_hardening_status ?? "unknown",
    phase_row_count: phaseRows.length,
    saas_project_count: projectIntakeRows.length,
    requirement_traceability_count: requirementTraceabilityRows.length,
    domain_pack_count: domainPackFactoryRows.length,
    control_plan_count: controlPlanRows.length,
    review_process_step_count: reviewProcessBindingRows.length,
    factory_ui_surface_count: factoryUiSurfaceRows.length,
    factory_trust_boundary_count: factoryTrustBoundaryRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    multi_project_saas_governance_ready: boundary.multi_project_saas_governance_ready,
    hr_saas_control_plan_ready: boundary.hr_saas_control_plan_ready,
    law_firm_saas_control_plan_ready: boundary.law_firm_saas_control_plan_ready,
    requirement_traceability_contract_ready: boundary.requirement_traceability_contract_ready,
    codex_harness_claude_review_process_bound: boundary.codex_harness_claude_review_process_bound,
    single_owner_lower_trust_mode: boundary.single_owner_lower_trust_mode,
    hermes_vertical_saas_claim_enabled: boundary.hermes_vertical_saas_claim_enabled,
    saas_product_launch_enabled: boundary.saas_product_launch_enabled,
    external_project_write_enabled: boundary.external_project_write_enabled,
    raw_sensitive_data_ingestion_enabled: boundary.raw_sensitive_data_ingestion_enabled,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    protected_final_decision_enabled: boundary.protected_final_decision_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    agent_runtime_execution_enabled: boundary.agent_runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_product_domain_saas_factory.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Product and Domain SaaS Factory",
    "",
    `Status: ${result.summary.product_domain_saas_factory_status}`,
    `Program: ${result.summary.program_range}`,
    `Review trust hardening: ${result.summary.review_enterprise_trust_hardening_status}`,
    `SaaS projects: ${result.summary.saas_project_count}`,
    `Domain packs: ${result.summary.domain_pack_count}`,
    `Control plans: ${result.summary.control_plan_count}`,
    `Review process steps: ${result.summary.review_process_step_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `HR SaaS control plan ready: ${result.summary.hr_saas_control_plan_ready}`,
    `Law Firm SaaS control plan ready: ${result.summary.law_firm_saas_control_plan_ready}`,
    `Hermes vertical SaaS claim enabled: ${result.summary.hermes_vertical_saas_claim_enabled}`,
    `SaaS product launch enabled: ${result.summary.saas_product_launch_enabled}`,
    `External project write enabled: ${result.summary.external_project_write_enabled}`,
    `Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Product Boundary",
    "",
    "Hermes is ready to govern multiple SaaS development control plans, including HR Solution and Law Firm OS, without becoming a single vertical SaaS product. Product launch, external project writes, raw sensitive data ingestion, protected closeout, enterprise trust, runtime execution, write action, and Work OS production claims remain disabled.",
    "",
  ].join("\n");
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
    item_count: items.length,
    error_count: items.filter((item) => item.status !== "pass").length,
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PRODUCT_DOMAIN_SAAS_FACTORY_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    review_dashboard_doc_path: options.reviewDashboardDocPath ?? defaults.reviewDashboardDocPath,
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

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
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
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    reviewDashboardDocPath: undefined,
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
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--review-dashboard-doc") {
      args.reviewDashboardDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/product-domain-saas-factory.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --review-dashboard-doc <path>   Review dashboard IA document path.
  --help                          Show this help.
`);
}
