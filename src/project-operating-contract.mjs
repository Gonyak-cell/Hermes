import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildMultiProjectSaasControlPlane } from "./multi-project-saas-control-plane.mjs";

export const DEFAULT_PROJECT_OPERATING_CONTRACT_OUT_DIR = "artifacts/project-operating-contract/latest";
export const DEFAULT_PROJECT_OPERATING_CONTRACT_INPUTS = {
  schemaPath: "schemas/project-operating-contract.schema.json",
  packagePath: "package.json",
  multiProjectSaasControlPlanePath: "artifacts/multi-project-saas-control-plane/latest/multi-project-saas-control-plane.json",
};

export const PROJECT_STATES = Object.freeze([
  "active",
  "blocked",
  "review_needed",
  "owner_action_needed",
  "stale",
  "paused",
  "ready_read_only",
]);

export const BLOCKER_TYPES = Object.freeze([
  "missing_review",
  "missing_owner_decision",
  "failed_validation",
  "stale_artifact",
  "external_auth",
  "protected_action_required",
  "data_boundary_risk",
]);

export const SAFE_ACTION_TYPES = Object.freeze([
  "inspect",
  "copy_command",
  "open_artifact",
  "prepare_review_packet",
  "draft_owner_decision",
  "refresh_artifact",
]);

export const FORBIDDEN_ACTION_TYPES = Object.freeze([
  "commit",
  "push",
  "merge",
  "deploy",
  "approve",
  "apply",
  "apply_receipt",
  "production_pass",
  "enterprise_pass",
  "connector_write",
  "secret_read",
  "raw_source_exposure",
]);

const SCHEMA_VERSION = "project-operating-contract.v1";
const CAPABILITY_ID = "platform.project_operating_contract";
const COMMAND_NAME = "platform:project-operating-contract";
const PROGRAM_RANGE = "TUW-001-TUW-009";
const SOURCE_PROGRAM_RANGE = "P9401-P9600";
const READY_STATUS = "ready_for_project_operating_contract";
const BLOCKED_STATUS = "blocked_project_operating_contract";
const FRESH_DAYS = 7;
const AGING_DAYS = 14;

export async function runProjectOperatingContract(options = {}) {
  const result = await buildProjectOperatingContract(options);
  if (options.write !== false) await writeProjectOperatingContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Project operating contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProjectOperatingContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PROJECT_OPERATING_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const source = await resolveMultiProjectSaasSource(options, inputs, generatedAt);
  const collections = deriveProjectOperatingCollections(source, generatedAt);
  const projectOperatingContract = buildContract(generatedAt, source);
  const projectOperatingBoundary = buildBoundary({
    source,
    projectOperatingContract,
    ...collections,
  });
  const validationItems = buildValidationItems({
    packageJson,
    source,
    projectOperatingContract,
    projectOperatingBoundary,
    ...collections,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_status: buildSourceStatus(source, generatedAt),
    project_operating_contract: projectOperatingContract,
    project_identity_rows: collections.project_identity_rows,
    project_source_inventory_rows: collections.project_source_inventory_rows,
    project_state_rows: collections.project_state_rows,
    project_progress_rows: collections.project_progress_rows,
    project_blocker_taxonomy_rows: collections.project_blocker_taxonomy_rows,
    project_next_action_taxonomy_rows: collections.project_next_action_taxonomy_rows,
    project_authority_boundary_rows: collections.project_authority_boundary_rows,
    project_freshness_rows: collections.project_freshness_rows,
    control_room_acceptance_rows: collections.control_room_acceptance_rows,
    project_operating_gate_rows: collections.project_operating_gate_rows,
    project_operating_boundary: projectOperatingBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ collections, projectOperatingBoundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "project_operating_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ collections, projectOperatingBoundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeProjectOperatingContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "project-operating-contract.json"), serializable);
  await writeJson(path.join(outDir, "project-identity-rows.json"), collectionEnvelope("project-identity-rows.v1", "project_identity_rows", result.project_identity_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-source-inventory-rows.json"), collectionEnvelope("project-source-inventory-rows.v1", "project_source_inventory_rows", result.project_source_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-state-rows.json"), collectionEnvelope("project-state-rows.v1", "project_state_rows", result.project_state_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-progress-rows.json"), collectionEnvelope("project-progress-rows.v1", "project_progress_rows", result.project_progress_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-blocker-taxonomy-rows.json"), collectionEnvelope("project-blocker-taxonomy-rows.v1", "project_blocker_taxonomy_rows", result.project_blocker_taxonomy_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-next-action-taxonomy-rows.json"), collectionEnvelope("project-next-action-taxonomy-rows.v1", "project_next_action_taxonomy_rows", result.project_next_action_taxonomy_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-authority-boundary-rows.json"), collectionEnvelope("project-authority-boundary-rows.v1", "project_authority_boundary_rows", result.project_authority_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-freshness-rows.json"), collectionEnvelope("project-freshness-rows.v1", "project_freshness_rows", result.project_freshness_rows, result.generated_at));
  await writeJson(path.join(outDir, "control-room-acceptance-rows.json"), collectionEnvelope("control-room-acceptance-rows.v1", "control_room_acceptance_rows", result.control_room_acceptance_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-operating-gate-rows.json"), collectionEnvelope("project-operating-gate-rows.v1", "project_operating_gate_rows", result.project_operating_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-operating-boundary.json"), result.project_operating_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "project-operating-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runProjectOperatingContractCli(argv = process.argv.slice(2)) {
  try {
    const args = parseProjectOperatingContractArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runProjectOperatingContract(args);
    console.log(`Project operating contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.project_operating_contract_status}`);
    console.log(`Projects: ${result.summary.project_count}`);
    console.log(`Ready projects: ${result.summary.ready_project_count}`);
    console.log(`Blocked projects: ${result.summary.blocked_project_count}`);
    console.log(`Stale projects: ${result.summary.stale_project_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt, source) {
  return {
    schema_version: "project-operating-contract-definition.v1",
    generated_at: generatedAt,
    contract_id: "contract.hermes.project_operating_contract.local_only",
    source_contract_ref: SOURCE_PROGRAM_RANGE,
    source_path: source.path,
    source_available: source.available === true,
    source_hash: source.content_hash,
    project_identity_required: true,
    source_inventory_required: true,
    project_state_required: true,
    progress_required: true,
    blocker_taxonomy_required: true,
    next_action_taxonomy_required: true,
    authority_boundary_required: true,
    freshness_required: true,
    control_room_acceptance_required: true,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    desktop_projection_consumer: true,
    ui_write_authority_enabled: false,
    command_execution_allowed_now: false,
    git_write_allowed_now: false,
    deploy_allowed_now: false,
    approval_application_allowed_now: false,
    receipt_application_allowed_now: false,
    connector_write_allowed_now: false,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    cross_project_data_mixing_allowed: false,
    domain_pack_as_whole_product_allowed: false,
  };
}

function deriveProjectOperatingCollections(source, generatedAt) {
  const sourceData = source.data ?? {};
  const projects = asArray(sourceData.saas_project_registry_rows);
  const repos = asArray(sourceData.saas_repo_inventory_rows);
  const risks = asArray(sourceData.current_goal_risk_rows);
  const validationRows = asArray(sourceData.validation_review_aggregation_rows);
  const blockerRows = asArray(sourceData.blocker_next_action_rows);
  const operatorRows = asArray(sourceData.operator_control_summary_rows);
  const identityRows = projects.map((project, index) => {
    const repo = findByProjectId(repos, project.project_id);
    const pass = Boolean(project.project_id)
      && Boolean(project.project_name)
      && Boolean(project.data_boundary_id)
      && project.domain_pack_scope === "project_workflow_context"
      && project.domain_pack_is_whole_product === false
      && project.cross_project_data_mixed === false
      && repo?.repo_write_enabled === false;
    return verdictRow({
      schema_version: "project-identity-row.v1",
      row_id: `project.identity.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      project_name: project.project_name,
      domain_pack: project.domain_pack,
      factory_product_id: project.factory_product_id ?? null,
      repo_ref: repo?.repo_ref ?? null,
      data_boundary_id: project.data_boundary_id,
      artifact_scope: `artifact_scope.${slug(project.project_id)}`,
      owner_engine: project.owner_engine ?? "codex_primary_development_engine",
      reviewer_engine: project.reviewer_engine ?? "claude_code_opus_max_optional_evidence_lane",
      domain_pack_scope: project.domain_pack_scope,
      domain_pack_is_whole_product: project.domain_pack_is_whole_product === true,
      hermes_product_identity: project.hermes_product_identity,
      cross_project_data_mixed: project.cross_project_data_mixed === true,
      read_only: true,
      next_allowed_action: "inspect project identity and boundaries",
    }, pass);
  });

  const freshnessRows = projects.map((project, index) => {
    const sourceGeneratedAt = project.generated_at ?? sourceData.generated_at ?? source.generated_at ?? null;
    const freshness = classifyFreshness(sourceGeneratedAt, generatedAt);
    return verdictRow({
      schema_version: "project-freshness-row.v1",
      row_id: `project.freshness.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      source_generated_at: sourceGeneratedAt,
      source_age_days: freshness.age_days,
      freshness_status: freshness.status,
      refresh_required: freshness.status === "stale" || freshness.status === "missing",
      source_hash: source.content_hash,
      next_allowed_action: freshness.status === "stale" || freshness.status === "missing" ? "refresh source artifact" : "consume read-only projection",
    }, freshness.status !== "stale" && freshness.status !== "missing");
  });

  const progressRows = projects.map((project, index) => {
    const operator = findByProjectId(operatorRows, project.project_id);
    const blockers = findByProjectId(blockerRows, project.project_id);
    const risk = findByProjectId(risks, project.project_id);
    const validation = findByProjectId(validationRows, project.project_id);
    const confidence = normalizeProgressConfidence(project.progress_confidence ?? operator?.progress_confidence ?? "high");
    const completedUnits = Number(project.completed_units ?? operator?.completed_units ?? 0);
    const remainingUnits = Number(project.remaining_units ?? operator?.remaining_units ?? blockers?.next_action_count ?? 0);
    const pass = confidence !== "unknown" && validation?.validation_ready === true && Number.isFinite(remainingUnits);
    return verdictRow({
      schema_version: "project-progress-row.v1",
      row_id: `project.progress.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      current_goal_id: project.current_goal_id ?? operator?.current_goal_id ?? null,
      current_phase_range: project.current_phase_range ?? operator?.current_phase_range ?? null,
      risk_level: risk?.risk_level ?? "unknown",
      validation_ready: validation?.validation_ready === true,
      review_boundary_ready: validation?.review_boundary_ready === true,
      blocker_count: Number(blockers?.blocker_count ?? 0),
      next_action_count: Number(blockers?.next_action_count ?? 0),
      completed_units: completedUnits,
      remaining_units: remainingUnits,
      progress_confidence: confidence,
      read_only: true,
      next_allowed_action: "inspect progress and choose a safe next action",
    }, pass);
  });

  const stateRows = projects.map((project, index) => {
    const blockers = findByProjectId(blockerRows, project.project_id);
    const validation = findByProjectId(validationRows, project.project_id);
    const progress = findByProjectId(progressRows, project.project_id);
    const freshness = findByProjectId(freshnessRows, project.project_id);
    const authority = buildAuthorityBoundaryRow(project, repos, index, generatedAt);
    const state = deriveProjectState({ project, blockers, validation, progress, freshness, authority });
    const pass = PROJECT_STATES.includes(state.project_state)
      && !(state.project_state === "ready_read_only" && freshness?.freshness_status === "stale")
      && !(state.project_state === "ready_read_only" && progress?.progress_confidence === "low")
      && authority.unsafe_flag_count === 0;
    return verdictRow({
      schema_version: "project-state-row.v1",
      row_id: `project.state.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      project_state: state.project_state,
      state_reason: state.state_reason,
      blocker_count: Number(blockers?.blocker_count ?? 0),
      blocker_type: state.blocker_type,
      validation_ready: validation?.validation_ready === true,
      review_boundary_ready: validation?.review_boundary_ready === true,
      freshness_status: freshness?.freshness_status ?? "missing",
      progress_confidence: progress?.progress_confidence ?? "unknown",
      ready_read_only: state.project_state === "ready_read_only",
      execution_allowed_now: false,
      mutates_state: false,
      next_allowed_action: state.next_allowed_action,
    }, pass);
  });

  const projectSourceInventoryRows = projects.map((project, index) => {
    const freshness = findByProjectId(freshnessRows, project.project_id);
    const pass = source.available === true && Boolean(source.content_hash) && Boolean(freshness);
    return verdictRow({
      schema_version: "project-source-inventory-row.v1",
      row_id: `project.source.inventory.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      source_kind: "multi_project_saas_control_plane",
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_artifact_path: source.path,
      source_artifact_sha256: source.content_hash,
      source_generated_at: freshness?.source_generated_at ?? null,
      source_available: source.available === true,
      source_parse_status: source.parse_status,
      artifact_backed: source.path !== "inline.multi_project_saas_control_plane",
      read_only: true,
      next_allowed_action: "bind project source evidence",
    }, pass);
  });

  const authorityRows = projects.map((project, index) => buildAuthorityBoundaryRow(project, repos, index, generatedAt));
  const blockerTaxonomyRows = buildBlockerTaxonomyRows(stateRows, generatedAt);
  const nextActionTaxonomyRows = buildNextActionTaxonomyRows(generatedAt);
  const acceptanceRows = buildAcceptanceRows({
    identityRows,
    projectSourceInventoryRows,
    stateRows,
    progressRows,
    blockerTaxonomyRows,
    nextActionTaxonomyRows,
    authorityRows,
    freshnessRows,
    generatedAt,
  });
  const gateRows = buildGateRows({
    source,
    identityRows,
    projectSourceInventoryRows,
    stateRows,
    progressRows,
    blockerTaxonomyRows,
    nextActionTaxonomyRows,
    authorityRows,
    freshnessRows,
    acceptanceRows,
    generatedAt,
  });

  return {
    project_identity_rows: identityRows,
    project_source_inventory_rows: projectSourceInventoryRows,
    project_state_rows: stateRows,
    project_progress_rows: progressRows,
    project_blocker_taxonomy_rows: blockerTaxonomyRows,
    project_next_action_taxonomy_rows: nextActionTaxonomyRows,
    project_authority_boundary_rows: authorityRows,
    project_freshness_rows: freshnessRows,
    control_room_acceptance_rows: acceptanceRows,
    project_operating_gate_rows: gateRows,
  };
}

function buildAuthorityBoundaryRow(project, repos, index, generatedAt) {
  const repo = findByProjectId(repos, project.project_id);
  const unsafeFlags = [
    repo?.repo_write_enabled === true,
    repo?.git_stage_enabled === true,
    repo?.git_commit_enabled === true,
    repo?.git_push_enabled === true,
    repo?.merge_enabled === true,
    repo?.patch_apply_enabled === true,
    repo?.external_connector_write_enabled === true,
    project.domain_pack_is_whole_product === true,
    project.cross_project_data_mixed === true,
  ].filter(Boolean).length;
  return verdictRow({
    schema_version: "project-authority-boundary-row.v1",
    row_id: `project.authority.boundary.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    project_id: project.project_id,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    command_execution_allowed_now: false,
    git_stage_enabled: false,
    git_commit_enabled: false,
    git_push_enabled: false,
    merge_enabled: false,
    deploy_allowed_now: false,
    approval_application_allowed_now: false,
    receipt_application_allowed_now: false,
    connector_write_allowed_now: false,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    cross_project_data_mixing_allowed: false,
    domain_pack_as_whole_product_allowed: false,
    upstream_repo_write_observed: repo?.repo_write_enabled === true,
    upstream_git_push_observed: repo?.git_push_enabled === true,
    upstream_merge_observed: repo?.merge_enabled === true,
    unsafe_flag_count: unsafeFlags,
    next_allowed_action: "show closed authority boundary",
  }, unsafeFlags === 0);
}

function deriveProjectState({ blockers, validation, progress, freshness, authority }) {
  if (freshness?.freshness_status === "stale" || freshness?.freshness_status === "missing") {
    return state("stale", "source_freshness", "stale_artifact", "refresh source artifact");
  }
  if (authority?.unsafe_flag_count > 0) {
    return state("blocked", "authority_boundary_violation", "protected_action_required", "inspect closed authority boundary");
  }
  if (Number(blockers?.blocker_count ?? 0) > 0) {
    return state("blocked", "open_blockers", "failed_validation", "inspect blocker list");
  }
  if (validation?.validation_ready !== true) {
    return state("review_needed", "validation_missing", "failed_validation", "run validation check");
  }
  if (validation?.review_boundary_ready !== true) {
    return state("review_needed", "review_boundary_missing", "missing_review", "prepare review packet");
  }
  if (progress?.progress_confidence === "low") {
    return state("review_needed", "low_progress_confidence", "missing_review", "inspect project progress evidence");
  }
  return state("ready_read_only", "read_only_contract_ready", null, "inspect project state");
}

function state(projectState, stateReason, blockerType, nextAllowedAction) {
  return {
    project_state: projectState,
    state_reason: stateReason,
    blocker_type: blockerType,
    next_allowed_action: nextAllowedAction,
  };
}

function buildBlockerTaxonomyRows(stateRows, generatedAt) {
  return BLOCKER_TYPES.map((blockerType, index) => {
    const observedCount = stateRows.filter((row) => row.blocker_type === blockerType).length;
    return verdictRow({
      schema_version: "project-blocker-taxonomy-row.v1",
      row_id: `project.blocker.taxonomy.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      blocker_type: blockerType,
      observed_project_count: observedCount,
      allowed_in_contract: true,
      closes_execution_authority: true,
      next_allowed_action: "show blocker type and safe remediation hint",
    }, true);
  });
}

function buildNextActionTaxonomyRows(generatedAt) {
  const safeRows = SAFE_ACTION_TYPES.map((actionType, index) => verdictRow({
    schema_version: "project-next-action-taxonomy-row.v1",
    row_id: `project.next.action.taxonomy.safe.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    action_type: actionType,
    action_class: "safe_read_only",
    allowed: true,
    mutates_state: false,
    opens_authority: false,
    next_allowed_action: "render as safe affordance",
  }, true));
  const forbiddenRows = FORBIDDEN_ACTION_TYPES.map((actionType, index) => verdictRow({
    schema_version: "project-next-action-taxonomy-row.v1",
    row_id: `project.next.action.taxonomy.forbidden.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    action_type: actionType,
    action_class: "forbidden_protected_action",
    allowed: false,
    mutates_state: true,
    opens_authority: true,
    next_allowed_action: "show disabled or external-owner-only state",
  }, true));
  return [...safeRows, ...forbiddenRows];
}

function buildAcceptanceRows(context) {
  const specs = [
    ["project_identity", "Project identity rows cover every source project", context.identityRows.length > 0 && allPass(context.identityRows)],
    ["source_inventory", "Source inventory binds every project to hashed source evidence", context.projectSourceInventoryRows.length === context.identityRows.length && allPass(context.projectSourceInventoryRows)],
    ["state_projection", "Project state rows exist and do not mark stale or low-confidence projects ready", context.stateRows.length === context.identityRows.length && allPass(context.stateRows)],
    ["progress_projection", "Progress rows include goal, phase, validation, review, blocker, and confidence fields", context.progressRows.length === context.identityRows.length && allPass(context.progressRows)],
    ["blocker_taxonomy", "Blocker taxonomy includes the required fail-closed blocker types", context.blockerTaxonomyRows.length === BLOCKER_TYPES.length && allPass(context.blockerTaxonomyRows)],
    ["next_action_taxonomy", "Next action taxonomy separates safe affordances from forbidden protected actions", context.nextActionTaxonomyRows.length === SAFE_ACTION_TYPES.length + FORBIDDEN_ACTION_TYPES.length && allPass(context.nextActionTaxonomyRows)],
    ["authority_boundary", "Authority boundary rows keep all write, deploy, approval, receipt, and trust actions closed", context.authorityRows.length === context.identityRows.length && allPass(context.authorityRows)],
    ["freshness", "Freshness rows classify source age and block stale or missing source material", context.freshnessRows.length === context.identityRows.length && allPass(context.freshnessRows)],
  ];
  return specs.map(([acceptanceId, description, pass], index) => verdictRow({
    schema_version: "control-room-acceptance-row.v1",
    row_id: `control.room.acceptance.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    acceptance_id: acceptanceId,
    description,
    required: true,
    covered: pass,
    next_allowed_action: pass ? "bind to desktop control room projection" : `repair ${acceptanceId}`,
  }, pass));
}

function buildGateRows(context) {
  const freshnessReady = context.freshnessRows.every((row) => row.freshness_status !== "stale" && row.freshness_status !== "missing");
  const noReadyStale = context.stateRows.every((row) => !(row.ready_read_only && row.freshness_status === "stale"));
  const noReadyLowConfidence = context.stateRows.every((row) => !(row.ready_read_only && row.progress_confidence === "low"));
  const forbiddenClosed = context.nextActionTaxonomyRows
    .filter((row) => row.action_class === "forbidden_protected_action")
    .every((row) => row.allowed === false && row.opens_authority === true);
  const gates = [
    ["source.available", "Multi-project SaaS control plane source is available", context.source.available === true],
    ["identity.unique", "Project ids are unique and non-empty", uniqueProjectIds(context.identityRows)],
    ["source.inventory.hashed", "Project sources are hash-bound", context.projectSourceInventoryRows.every((row) => Boolean(row.source_artifact_sha256))],
    ["state.enum", "Project states are in the contract enum", context.stateRows.every((row) => PROJECT_STATES.includes(row.project_state))],
    ["freshness.ready", "No project uses stale or missing source material", freshnessReady],
    ["state.no_ready_stale", "Stale projects cannot be ready_read_only", noReadyStale],
    ["state.no_ready_low_confidence", "Low-confidence projects cannot be ready_read_only", noReadyLowConfidence],
    ["blockers.taxonomy", "Blocker taxonomy is complete", context.blockerTaxonomyRows.length === BLOCKER_TYPES.length],
    ["actions.safe_only", "Forbidden protected actions stay closed", forbiddenClosed],
    ["authority.closed", "Project authority rows keep unsafe flags at zero", context.authorityRows.every((row) => row.unsafe_flag_count === 0)],
    ["acceptance.covered", "All control-room acceptance rows are covered", context.acceptanceRows.every((row) => row.covered === true)],
  ];
  return gates.map(([gateId, description, pass], index) => verdictRow({
    schema_version: "project-operating-gate-row.v1",
    row_id: `project.operating.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    description,
    evidence_ref: `evidence.${gateId}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gateId}`,
  }, pass));
}

function buildBoundary(context) {
  const allGatesPass = context.project_operating_gate_rows.every((row) => row.current_verdict === "pass");
  const readyProjectCount = context.project_state_rows.filter((row) => row.project_state === "ready_read_only").length;
  const staleProjectCount = context.project_state_rows.filter((row) => row.project_state === "stale").length;
  const blockedProjectCount = context.project_state_rows.filter((row) => row.project_state === "blocked").length;
  const unsafeFlagCount = context.project_authority_boundary_rows.reduce((sum, row) => sum + Number(row.unsafe_flag_count ?? 0), 0);
  return {
    schema_version: "project-operating-boundary.v1",
    generated_at: context.projectOperatingContract.generated_at,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_available: context.source.available === true,
    source_hash: context.source.content_hash,
    project_count: context.project_identity_rows.length,
    ready_project_count: readyProjectCount,
    blocked_project_count: blockedProjectCount,
    stale_project_count: staleProjectCount,
    all_gates_pass: allGatesPass,
    ready_for_desktop_multi_project_projection: context.source.available === true && allGatesPass && unsafeFlagCount === 0,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    command_execution_allowed_now: false,
    git_write_allowed_now: false,
    deploy_allowed_now: false,
    approval_application_allowed_now: false,
    receipt_application_allowed_now: false,
    connector_write_allowed_now: false,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    cross_project_data_mixing_allowed: false,
    domain_pack_as_whole_product_allowed: false,
    unsafe_flag_count: unsafeFlagCount,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script.project_operating_contract", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json"),
    validationItem("source.available", context.source.available === true, "Multi-project SaaS control plane source is unavailable.", context.source.path),
    validationItem("source.schema", context.source.data?.schema_version === "multi-project-saas-control-plane.v1", "Source must be multi-project-saas-control-plane.v1.", context.source.path),
    validationItem("project.identity.present", context.project_identity_rows.length > 0 && allPass(context.project_identity_rows), "Project identity rows are missing or invalid.", "project_identity_rows"),
    validationItem("project.identity.unique", uniqueProjectIds(context.project_identity_rows), "Project ids must be unique.", "project_identity_rows"),
    validationItem("source.inventory.hash", context.project_source_inventory_rows.every((row) => Boolean(row.source_artifact_sha256)), "Every source inventory row needs a SHA256 binding.", "project_source_inventory_rows"),
    validationItem("state.enum", context.project_state_rows.every((row) => PROJECT_STATES.includes(row.project_state)), "Project state rows use an unknown state.", "project_state_rows"),
    validationItem("state.no_ready_stale", context.project_state_rows.every((row) => !(row.ready_read_only && row.freshness_status === "stale")), "Stale projects cannot be ready_read_only.", "project_state_rows"),
    validationItem("state.no_ready_low_confidence", context.project_state_rows.every((row) => !(row.ready_read_only && row.progress_confidence === "low")), "Low-confidence projects cannot be ready_read_only.", "project_state_rows"),
    validationItem("freshness.not_stale", context.project_freshness_rows.every((row) => row.freshness_status !== "stale" && row.freshness_status !== "missing"), "Source freshness is stale or missing.", "project_freshness_rows"),
    validationItem("blocker.taxonomy.complete", context.project_blocker_taxonomy_rows.length === BLOCKER_TYPES.length, "Blocker taxonomy is incomplete.", "project_blocker_taxonomy_rows"),
    validationItem("next_action.forbidden_closed", context.project_next_action_taxonomy_rows.filter((row) => row.action_class === "forbidden_protected_action").every((row) => row.allowed === false), "Forbidden action taxonomy opened a protected action.", "project_next_action_taxonomy_rows"),
    validationItem("authority.closed", context.project_authority_boundary_rows.every((row) => row.unsafe_flag_count === 0 && row.git_push_enabled === false && row.merge_enabled === false && row.deploy_allowed_now === false), "Authority boundary opened a write, merge, deploy, or trust action.", "project_authority_boundary_rows"),
    validationItem("acceptance.covered", context.control_room_acceptance_rows.every((row) => row.covered === true), "Control-room acceptance rows are not fully covered.", "control_room_acceptance_rows"),
    validationItem("gates.pass", context.project_operating_gate_rows.every((row) => row.current_verdict === "pass"), "Project operating gates did not all pass.", "project_operating_gate_rows"),
    validationItem("boundary.ready", context.projectOperatingBoundary.ready_for_desktop_multi_project_projection === true && context.projectOperatingBoundary.unsafe_flag_count === 0, "Project operating boundary is not ready for desktop projection.", "project_operating_boundary"),
    validationItem("contract.no_authority", context.projectOperatingContract.git_write_allowed_now === false && context.projectOperatingContract.deploy_allowed_now === false && context.projectOperatingContract.approval_application_allowed_now === false && context.projectOperatingContract.production_pass_enabled === false && context.projectOperatingContract.enterprise_pass_enabled === false, "Project operating contract opened forbidden authority.", "project_operating_contract"),
  ];
}

function buildSummary({ collections, projectOperatingBoundary, validation }) {
  const stateRows = collections.project_state_rows;
  return {
    schema_version: "project-operating-contract-summary.v1",
    project_operating_contract_status: validation.valid && projectOperatingBoundary.ready_for_desktop_multi_project_projection ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    project_count: stateRows.length,
    ready_project_count: stateRows.filter((row) => row.project_state === "ready_read_only").length,
    blocked_project_count: stateRows.filter((row) => row.project_state === "blocked").length,
    review_needed_project_count: stateRows.filter((row) => row.project_state === "review_needed").length,
    owner_action_needed_project_count: stateRows.filter((row) => row.project_state === "owner_action_needed").length,
    stale_project_count: stateRows.filter((row) => row.project_state === "stale").length,
    acceptance_count: collections.control_room_acceptance_rows.length,
    ready_acceptance_count: collections.control_room_acceptance_rows.filter((row) => row.covered === true).length,
    gate_count: collections.project_operating_gate_rows.length,
    ready_gate_count: collections.project_operating_gate_rows.filter((row) => row.current_verdict === "pass").length,
    read_only: projectOperatingBoundary.read_only,
    local_only: projectOperatingBoundary.local_only,
    source_of_truth: projectOperatingBoundary.source_of_truth,
    command_execution_allowed_now: projectOperatingBoundary.command_execution_allowed_now,
    git_write_allowed_now: projectOperatingBoundary.git_write_allowed_now,
    deploy_allowed_now: projectOperatingBoundary.deploy_allowed_now,
    approval_application_allowed_now: projectOperatingBoundary.approval_application_allowed_now,
    receipt_application_allowed_now: projectOperatingBoundary.receipt_application_allowed_now,
    connector_write_allowed_now: projectOperatingBoundary.connector_write_allowed_now,
    raw_source_exposure_allowed: projectOperatingBoundary.raw_source_exposure_allowed,
    secret_read_allowed_now: projectOperatingBoundary.secret_read_allowed_now,
    production_pass_enabled: projectOperatingBoundary.production_pass_enabled,
    enterprise_pass_enabled: projectOperatingBoundary.enterprise_pass_enabled,
    protected_closeout_enabled: projectOperatingBoundary.protected_closeout_enabled,
    cross_project_data_mixing_allowed: projectOperatingBoundary.cross_project_data_mixing_allowed,
    domain_pack_as_whole_product_allowed: projectOperatingBoundary.domain_pack_as_whole_product_allowed,
    unsafe_flag_count: projectOperatingBoundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceStatus(source, generatedAt) {
  return {
    schema_version: "project-operating-source-status.v1",
    generated_at: generatedAt,
    source_path: source.path,
    source_available: source.available === true,
    source_parse_status: source.parse_status,
    source_content_hash: source.content_hash,
    source_error: source.error,
  };
}

async function resolveMultiProjectSaasSource(options, inputs, generatedAt) {
  if (options.multiProjectSaasControlPlane) {
    return normalizeInlineJsonSource("inline.multi_project_saas_control_plane", options.multiProjectSaasControlPlane);
  }
  const source = await readJsonSource(inputs.multi_project_saas_control_plane_path);
  if (source.available && source.data?.schema_version === "multi-project-saas-control-plane.v1") return source;
  try {
    const built = await buildMultiProjectSaasControlPlane({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.multi_project_saas_control_plane", built);
  } catch (error) {
    return {
      available: false,
      path: inputs.multi_project_saas_control_plane_path,
      data: source.data,
      text: source.text ?? "",
      parse_status: source.parse_status ?? "missing",
      content_hash: source.content_hash ?? null,
      generated_at: null,
      error: source.error ?? error.message,
    };
  }
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
        generated_at: data.generated_at ?? null,
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
        generated_at: null,
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
      generated_at: null,
      error: error.message,
    };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return {
    available: true,
    path: pathLabel,
    data,
    text: JSON.stringify(data),
    parse_status: "parsed",
    content_hash: `sha256:${sha256(data)}`,
    generated_at: data.generated_at ?? null,
    error: null,
  };
}

function classifyFreshness(sourceGeneratedAt, generatedAt) {
  if (!sourceGeneratedAt || Number.isNaN(Date.parse(sourceGeneratedAt))) {
    return { status: "missing", age_days: null };
  }
  const ageMs = Math.max(0, Date.parse(generatedAt) - Date.parse(sourceGeneratedAt));
  const ageDays = Number((ageMs / 86_400_000).toFixed(2));
  if (ageDays <= FRESH_DAYS) return { status: "fresh", age_days: ageDays };
  if (ageDays <= AGING_DAYS) return { status: "aging", age_days: ageDays };
  return { status: "stale", age_days: ageDays };
}

function normalizeProgressConfidence(value) {
  const normalized = String(value ?? "unknown").toLowerCase();
  if (["high", "medium", "low"].includes(normalized)) return normalized;
  return "unknown";
}

function allPass(rows) {
  return rows.every((row) => row.current_verdict === "pass");
}

function uniqueProjectIds(rows) {
  const ids = rows.map((row) => row.project_id).filter(Boolean);
  return ids.length > 0 && ids.length === new Set(ids).size;
}

function findByProjectId(rows, projectId) {
  return asArray(rows).find((row) => row.project_id === projectId);
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
    schema_version: "project-operating-validation-item.v1",
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
    "# Project Operating Contract",
    "",
    `- Status: ${result.summary.project_operating_contract_status}`,
    `- Program: ${result.program_range}`,
    `- Source: ${result.source_program_range}`,
    `- Projects: ${result.summary.project_count}`,
    `- Ready read-only projects: ${result.summary.ready_project_count}`,
    `- Blocked projects: ${result.summary.blocked_project_count}`,
    `- Review-needed projects: ${result.summary.review_needed_project_count}`,
    `- Stale projects: ${result.summary.stale_project_count}`,
    `- Gates: ${result.summary.ready_gate_count}/${result.summary.gate_count}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "This contract is local-only and read-only. It defines project identity, source inventory, state, progress, blockers, next actions, authority boundaries, freshness, and control-room acceptance without opening commit, push, merge, deploy, approval, receipt application, connector write, raw source, secret, production PASS, enterprise PASS, or protected closeout authority.",
  ].join("\n");
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_PROJECT_OPERATING_CONTRACT_INPUTS)) {
    normalized[camelToSnake(key)] = options[key] ?? options[camelToSnake(key)] ?? defaultValue;
  }
  return normalized;
}

export function parseProjectOperatingContractArgs(argv) {
  const valueFlags = new Map([
    ["--out-dir", "outDir"],
    ["--run-at", "runAt"],
    ...Object.keys(DEFAULT_PROJECT_OPERATING_CONTRACT_INPUTS).map((key) => [`--${camelToKebab(key)}`, key]),
  ]);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--no-write") parsed.write = false;
    else if (valueFlags.has(arg)) parsed[valueFlags.get(arg)] = readRequiredArgValue(argv, ++index, arg);
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/project-operating-contract.mjs [--check] [--out-dir path]\n\nWith --check, validates without writing artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item != null) : [];
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function readRequiredArgValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}
