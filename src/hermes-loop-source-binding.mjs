import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_HERMES_LOOP_SOURCE_BINDING_OUT_DIR = "artifacts/hermes-loop-source-binding/latest";
export const DEFAULT_HERMES_LOOP_SOURCE_BINDING_INPUTS = {
  schemaPath: "schemas/hermes-loop-source-binding.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p60001-p60400.md",
  architectureDocPath: "docs/architecture.md",
};

const COMMAND_NAME = "platform:hermes-loop-source-binding";
const SCHEMA_VERSION = "hermes-loop-source-binding.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_source_binding";
const PROGRAM_RANGE = "P60001-P60400";
const NEXT_PROGRAM_RANGE = "P60401-P60800";

export const HERMES_LOOP_AUTHORITY_FALSE_FLAGS = [
  "runtime_execution_allowed_now",
  "command_execution_allowed_now",
  "write_action_allowed_now",
  "direct_file_write_allowed_now",
  "generated_patch_apply_allowed_now",
  "connector_ingestion_allowed_now",
  "connector_write_allowed_now",
  "external_service_mutation_allowed_now",
  "raw_material_access_allowed_now",
  "cross_domain_access_allowed_now",
  "secret_read_allowed_now",
  "protected_action_allowed_now",
  "protected_closeout_allowed_now",
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_allowed_now",
  "enterprise_pass_allowed_now",
  "enterprise_trust_claim_allowed_now",
  "codex_final_approval_allowed",
  "claude_final_approval_allowed",
  "final_automated_approval_allowed_now",
];

const REQUIRED_SOURCE_SECTIONS = [
  ["source.identity", "Hermes Loop System identity", "## 1. 개요"],
  ["source.definition", "Deterministic control-plane loop definition", "deterministic control-plane loop"],
  ["source.no_direct_authority", "No direct source mutation or protected closeout", "기본적으로 source mutation"],
  ["source.evidence_before_claim", "Evidence Before Claim principle", "### 2.1 Evidence Before Claim"],
  ["source.no_silent_authority", "No Silent Authority Expansion principle", "### 2.2 No Silent Authority Expansion"],
  ["source.worker_verifier_split", "Worker and Verifier separation", "### 2.6 Worker and Verifier Are Separate"],
  ["source.dag_before_autonomy", "DAG Before Autonomy principle", "### 2.8 DAG Before Autonomy"],
  ["source.loop_definition", "Loop Definition required contract", "### 3.2 Loop Definition"],
  ["source.loop_run", "Loop Run required contract", "### 3.3 Loop Run"],
  ["source.authority_mapping", "Authority Mapping baseline", "### 4.3 Authority Mapping"],
  ["source.phase_a", "Roadmap Phase A source", "### 21.1 Phase A"],
  ["source.negative_fixtures", "Negative fixture requirements", "### 14.4 Negative Fixtures"],
  ["source.acceptance", "Acceptance criteria", "## 22. Acceptance Criteria"],
];

const OVERLAY_CONTRACTS = [
  ["HermesLoopDefinition", "loop definition overlay", "schema", "HermesLoopDefinition"],
  ["HermesLoopRun", "event-backed loop run ledger row", "schema", "HermesLoopRun"],
  ["HermesLoopStepRun", "step-level state transition", "schema", "HermesLoopStepRun"],
  ["HermesLoopDAG", "bounded workflow graph", "schema", "HermesLoopDAG"],
  ["HermesLoopWorkerRun", "candidate worker output", "schema", "HermesLoopWorkerRun"],
  ["HermesLoopVerifierRun", "worker output verification lane", "schema", "HermesLoopVerifierRun"],
  ["HermesLoopModelRouteDecision", "model route gate", "schema", "HermesLoopModelRouteDecision"],
  ["HermesLoopBudgetDecision", "budget and token gate", "schema", "HermesLoopBudgetDecision"],
  ["HermesLoopGateResult", "gate aggregation row", "schema", "HermesLoopGateResult"],
  ["HermesLoopAuthorityBoundary", "explicit authority false boundary", "schema", "HermesLoopAuthorityBoundary"],
  ["existing_workflow_mapping", "workflow/run/runtime/evidence/review/gate reuse", "mapping", "### 4.1 개념 매핑"],
  ["state_mapping_table", "source state to Hermes DSL state mapping", "mapping", "### 4.2 State Mapping"],
];

const NEGATIVE_FIXTURES = [
  "missing_evidence",
  "missing_reviewer",
  "missing_human_receipt",
  "stale_source",
  "cross_domain_source_leak",
  "raw_source_exposure",
  "secret_bearing_output",
  "connector_write_attempt",
  "protected_action_attempt",
  "unbounded_dag_cycle",
  "worker_self_approval",
  "verifier_missing_for_high_risk_output",
  "budget_exceeded_but_loop_continues",
  "high_cost_model_escalation_without_gate",
  "codex_self_approval",
  "claude_final_approval",
  "production_pass_without_release_evidence",
  "enterprise_pass_without_independent_evidence",
  "missing_next_phase_handoff",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-source-binding.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-source-binding.mjs"],
  ["unit.test", "node --test test/hermes-loop-source-binding.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-source-binding -- --check"],
  ["package.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\"))'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopSourceBinding(options = {}) {
  const result = await buildHermesLoopSourceBinding(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop source binding failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopSourceBinding(result, result.output_dir);
  return result;
}

export async function buildHermesLoopSourceBinding(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_SOURCE_BINDING_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readOptionalTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readOptionalTextSource(inputs.architecture_doc_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(sourceSpec);
  const sourceRows = buildSourceBindingRows({ sourceSpec, sourceState, commitRef, generatedAt });
  const overlayRows = buildOverlayContractInventoryRows({ sourceSpec, generatedAt });
  const authorityRows = buildAuthorityBoundaryBaselineRows({ overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeFixtureContractRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows({ generatedAt });
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceState, sourceRows, overlayRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildNextPhaseHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceState, sourceRows, overlayRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceState, sourceRows, overlayRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      hermes_loop_system_specification_path: sourceSpec.path,
      source_hash_sha256: sourceSpec.hash,
      source_commit_ref: commitRef || null,
      source_of_truth: "docs/hermes-loop-system-specification.md",
    },
    hermes_loop_source_binding_contract: buildContract(generatedAt),
    p60001_source_binding_rows: sourceRows,
    loop_overlay_contract_inventory_rows: overlayRows,
    authority_boundary_baseline_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_source_binding_wiring_rows: wiringRows,
    p60400_closeout_rows: closeoutRows,
    p60401_next_phase_handoff_rows: handoffRows,
    hermes_loop_source_binding_boundary: boundary,
    hermes_loop_source_binding_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_source_binding")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_source_binding_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_source_binding_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopSourceBinding(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-source-binding.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p60001-source-binding-rows.json"), collectionEnvelope("p60001-source-binding-rows.v1", "p60001_source_binding_rows", result.p60001_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "loop-overlay-contract-inventory-rows.json"), collectionEnvelope("loop-overlay-contract-inventory-rows.v1", "loop_overlay_contract_inventory_rows", result.loop_overlay_contract_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-baseline-rows.json"), collectionEnvelope("authority-boundary-baseline-rows.v1", "authority_boundary_baseline_rows", result.authority_boundary_baseline_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-contract-rows.json"), collectionEnvelope("negative-fixture-contract-rows.v1", "negative_fixture_contract_rows", result.negative_fixture_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-command-rows.json"), collectionEnvelope("validation-command-rows.v1", "validation_command_rows", result.validation_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "p60400-closeout-rows.json"), collectionEnvelope("p60400-closeout-rows.v1", "p60400_closeout_rows", result.p60400_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p60401-next-phase-handoff-rows.json"), collectionEnvelope("p60401-next-phase-handoff-rows.v1", "p60401_next_phase_handoff_rows", result.p60401_next_phase_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "hermes-loop-source-binding-boundary.json"), result.hermes_loop_source_binding_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopSourceBindingCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopSourceBinding(args);
  console.log(`Hermes Loop source binding ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_source_binding_status}`);
  console.log(`Source bound: ${result.summary.source_of_truth_bound_now}`);
  console.log(`Authority boundary closed: ${result.summary.authority_boundary_closed_now}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p60401_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(sourceSpec) {
  const text = sourceSpec.text ?? "";
  const requiredSections = REQUIRED_SOURCE_SECTIONS.map(([sectionId, label, marker]) => ({
    section_id: sectionId,
    label,
    marker,
    present: text.includes(marker),
  }));
  return {
    available: sourceSpec.available === true,
    nonEmpty: text.trim().length > 0,
    hashPresent: typeof sourceSpec.hash === "string" && sourceSpec.hash.length === 64,
    versionOk: text.includes("문서 버전: v1.1"),
    productIdentityNeutral: text.includes("Law Firm OS 전용 엔진이 아니다"),
    phaseAPresent: text.includes("### 21.1 Phase A"),
    requiredSections,
    requiredSectionCount: requiredSections.length,
    presentRequiredSectionCount: requiredSections.filter((section) => section.present).length,
    allRequiredSectionsPresent: requiredSections.every((section) => section.present),
  };
}

function buildSourceBindingRows({ sourceSpec, sourceState, commitRef, generatedAt }) {
  const rows = [
    verdictRow({
      row_id: "source_binding.source_doc_exists",
      category: "source_binding",
      label: "Hermes Loop System source specification exists",
      observed: sourceState.available,
      evidence_ref: sourceSpec.path,
      blocker: "missing_hermes_loop_system_specification",
      next_allowed_action: "restore_docs_hermes_loop_system_specification_md",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source_binding.source_doc_non_empty",
      category: "source_binding",
      label: "Source specification is non-empty",
      observed: sourceState.nonEmpty,
      evidence_ref: sourceSpec.path,
      blocker: "empty_hermes_loop_system_specification",
      next_allowed_action: "populate_source_specification_before_loop_binding",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source_binding.source_hash_present",
      category: "source_binding",
      label: "Source specification has stable SHA-256 hash",
      observed: sourceState.hashPresent,
      evidence_ref: sourceSpec.hash ?? "missing_hash",
      blocker: "missing_source_hash",
      next_allowed_action: "recalculate_source_hash",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source_binding.document_version_v1_1",
      category: "source_binding",
      label: "Source specification declares v1.1",
      observed: sourceState.versionOk,
      evidence_ref: sourceSpec.path,
      blocker: "source_version_not_v1_1",
      next_allowed_action: "align_source_version_to_v1_1",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source_binding.product_identity_neutral",
      category: "source_binding",
      label: "Hermes remains a general project/workflow control plane",
      observed: sourceState.productIdentityNeutral,
      evidence_ref: sourceSpec.path,
      blocker: "domain_pack_promoted_to_product_identity",
      next_allowed_action: "restore_general_harness_identity",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source_binding.commit_ref_recorded",
      category: "source_binding",
      label: "Current git commit reference recorded",
      observed: Boolean(commitRef),
      evidence_ref: commitRef || "missing_commit_ref",
      blocker: "missing_commit_ref",
      next_allowed_action: "run_from_git_checkout_with_commit_ref",
      generated_at: generatedAt,
    }),
  ];

  for (const section of sourceState.requiredSections) {
    rows.push(verdictRow({
      row_id: section.section_id,
      category: "required_source_section",
      label: section.label,
      observed: section.present,
      evidence_ref: section.marker,
      blocker: `missing_${section.section_id.replaceAll(".", "_")}`,
      next_allowed_action: "restore_required_source_section_before_loop_baseline",
      generated_at: generatedAt,
    }));
  }
  return rows;
}

function buildOverlayContractInventoryRows({ sourceSpec, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return OVERLAY_CONTRACTS.map(([contractId, label, contractType, marker]) => verdictRow({
    row_id: `overlay.${contractId}`,
    category: "loop_overlay_contract_inventory",
    label,
    observed: text.includes(marker),
    evidence_ref: sourceSpec.path,
    output_ref: contractId,
    blocker: `missing_overlay_contract_${contractId}`,
    next_allowed_action: "restore_phase_a_overlay_contract_source",
    contract_type: contractType,
    generated_at: generatedAt,
  }));
}

function buildAuthorityBoundaryBaselineRows({ overrides = {}, generatedAt }) {
  return HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : false;
    return verdictRow({
      row_id: `authority.${flag}`,
      category: "authority_boundary_baseline",
      label: `${flag} remains false`,
      observed: value === false,
      evidence_ref: "docs/hermes-loop-system-specification.md#authority-mapping",
      output_ref: flag,
      blocker: value === false ? null : `unsafe_authority_opened.${flag}`,
      next_allowed_action: value === false ? "continue_read_only_loop_contract_buildout" : "close_authority_flag_before_closeout",
      authority_flag: flag,
      allowed_now: value === false ? false : value,
      generated_at: generatedAt,
    });
  });
}

function buildNegativeFixtureContractRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => verdictRow({
    row_id: `negative_fixture.${fixtureId}`,
    category: "negative_fixture_contract",
    label: `${fixtureId} blocks closeout`,
    observed: true,
    evidence_ref: "docs/hermes-loop-system-specification.md#negative-fixtures",
    output_ref: fixtureId,
    blocker: null,
    next_allowed_action: "keep_fixture_as_blocking_regression_case",
    fixture_id: fixtureId,
    expected_verdict: "block",
    generated_at: generatedAt,
  }));
}

function buildValidationCommandRows({ generatedAt }) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => verdictRow({
    row_id: `validation_command.${commandId}`,
    category: "validation_command",
    label: command,
    observed: true,
    evidence_ref: command,
    output_ref: commandId,
    mutating: false,
    generated_at: generatedAt,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    verdictRow({
      row_id: "wiring.package_script",
      category: "wiring",
      label: `${COMMAND_NAME} script registered`,
      observed: scripts[COMMAND_NAME] === "node scripts/hermes-loop-source-binding.mjs",
      evidence_ref: "package.json",
      blocker: "missing_package_script",
      next_allowed_action: "add_package_script_before_closeout",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "wiring.roadmap_doc",
      category: "wiring",
      label: "P60001-P60400 roadmap doc includes required phase plan fields",
      observed: roadmapDoc.available && roadmapDoc.text.includes("P60001-P60400") && roadmapDoc.text.includes("Negative fixtures"),
      evidence_ref: "docs/hermes-roadmap-p60001-p60400.md",
      blocker: "missing_phase_plan_doc",
      next_allowed_action: "write_phase_plan_doc_before_closeout",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "wiring.architecture_doc",
      category: "wiring",
      label: "Architecture doc references Hermes Loop System v1.1 tranche",
      observed: architectureDoc.available && architectureDoc.text.includes("P60001-P64000 Hermes Loop System v1.1"),
      evidence_ref: "docs/architecture.md",
      blocker: "missing_architecture_reference",
      next_allowed_action: "add_architecture_reference_before_closeout",
      generated_at: generatedAt,
    }),
  ];
}

function buildCloseoutRows({ sourceState, sourceRows, overlayRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt }) {
  const authorityClosed = authorityRows.every((row) => row.current_verdict === "pass" && row.allowed_now === false);
  const negativeComplete = NEGATIVE_FIXTURES.every((fixtureId) => negativeRows.some((row) => row.fixture_id === fixtureId));
  return [
    closeoutRow("p60400.source_binding_complete", "Source binding rows are present and passing", sourceRows.every((row) => row.current_verdict === "pass"), generatedAt),
    closeoutRow("p60400.required_sections_complete", "Required source sections are all present", sourceState.allRequiredSectionsPresent, generatedAt),
    closeoutRow("p60400.overlay_inventory_complete", "Loop overlay contract inventory rows are visible", overlayRows.every((row) => row.current_verdict === "pass"), generatedAt),
    closeoutRow("p60400.authority_boundary_closed", "All authority flags remain false", authorityClosed, generatedAt),
    closeoutRow("p60400.negative_fixture_contract_complete", "Negative fixture contract rows cover all required blockers", negativeComplete, generatedAt),
    closeoutRow("p60400.validation_commands_declared", "Targeted validation commands are declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p60400.wiring_complete", "Package, roadmap, and architecture wiring are visible", wiringRows.every((row) => row.current_verdict === "pass"), generatedAt),
    closeoutRow("p60400.no_runtime_execution", "Runtime execution remains closed", authorityRows.find((row) => row.authority_flag === "runtime_execution_allowed_now")?.allowed_now === false, generatedAt),
    closeoutRow("p60400.no_production_or_enterprise_pass", "Production and enterprise PASS remain closed", authorityRows.filter((row) => ["production_pass_allowed_now", "enterprise_pass_allowed_now"].includes(row.authority_flag)).every((row) => row.allowed_now === false), generatedAt),
  ];
}

function buildNextPhaseHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every((row) => row.current_verdict === "pass");
  return [
    verdictRow({
      row_id: "handoff.p60401_next_source",
      category: "next_phase_handoff",
      label: `${NEXT_PROGRAM_RANGE} consumes Hermes Loop v1.1 source binding baseline`,
      observed: ready,
      evidence_ref: "artifacts/hermes-loop-source-binding/latest/hermes-loop-source-binding.json",
      output_ref: "loop_definition_loop_run_dag_schema_expansion",
      blocker: ready ? null : "p60400_closeout_not_ready",
      next_allowed_action: ready ? "implement_loop_definition_run_dag_schema_rows" : "resolve_p60400_closeout_blockers",
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "handoff.p60401_authority_boundary",
      category: "next_phase_handoff",
      label: "Next phase must preserve all runtime/write/protected/deployment/final approval boundaries false",
      observed: true,
      evidence_ref: "docs/hermes-loop-system-specification.md#authority-mapping",
      output_ref: "authority_boundary_baseline_rows",
      next_allowed_action: "carry_false_authority_flags_into_p60401",
      generated_at: generatedAt,
    }),
  ];
}

function buildBoundary({ sourceState, sourceRows, overlayRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows }) {
  const authorityBoundary = Object.fromEntries(authorityRows.map((row) => [row.authority_flag, row.allowed_now]));
  const boundary = {
    p60400_contract_ready: closeoutRows.every((row) => row.current_verdict === "pass"),
    source_doc_available_now: sourceState.available,
    source_doc_hash_present_now: sourceState.hashPresent,
    source_of_truth_bound_now: sourceRows.every((row) => row.current_verdict === "pass"),
    phase_a_source_bound_now: sourceState.phaseAPresent,
    overlay_contract_inventory_visible_now: overlayRows.every((row) => row.current_verdict === "pass"),
    authority_boundary_closed_now: authorityRows.every((row) => row.current_verdict === "pass" && row.allowed_now === false),
    negative_fixture_contract_visible_now: NEGATIVE_FIXTURES.every((fixtureId) => negativeRows.some((row) => row.fixture_id === fixtureId)),
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every((row) => row.current_verdict === "pass"),
    ready_for_p60401_handoff: handoffRows.every((row) => row.current_verdict === "pass"),
    source_binding_row_count: sourceRows.length,
    overlay_contract_inventory_row_count: overlayRows.length,
    authority_boundary_row_count: authorityRows.length,
    negative_fixture_contract_row_count: negativeRows.length,
    validation_command_row_count: validationCommandRows.length,
    closeout_row_count: closeoutRows.length,
    handoff_row_count: handoffRows.length,
    ...authorityBoundary,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems({ sourceState, sourceRows, overlayRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary }) {
  return [
    validationItem("source.available", "source_binding", sourceState.available, "Hermes Loop source specification must exist"),
    validationItem("source.non_empty", "source_binding", sourceState.nonEmpty, "Hermes Loop source specification must be non-empty"),
    validationItem("source.hash", "source_binding", sourceState.hashPresent, "Hermes Loop source specification must have SHA-256 hash"),
    validationItem("source.version", "source_binding", sourceState.versionOk, "Hermes Loop source specification must declare v1.1"),
    validationItem("source.sections", "source_binding", sourceState.allRequiredSectionsPresent, "Hermes Loop source specification must include all required sections"),
    validationItem("rows.source_binding", "row_contract", sourceRows.length >= REQUIRED_SOURCE_SECTIONS.length + 6 && sourceRows.every((row) => row.current_verdict === "pass"), "Source binding rows must pass"),
    validationItem("rows.overlay_inventory", "row_contract", overlayRows.length === OVERLAY_CONTRACTS.length && overlayRows.every((row) => row.current_verdict === "pass"), "Overlay inventory rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.length === HERMES_LOOP_AUTHORITY_FALSE_FLAGS.length && authorityRows.every((row) => row.current_verdict === "pass" && row.allowed_now === false), "Authority flags must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Every required negative fixture must be represented"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((row) => row.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every((row) => row.current_verdict === "pass"), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every((row) => row.current_verdict === "pass"), "P60401 handoff rows must pass"),
    validationItem("boundary.p60400_ready", "boundary", boundary.p60400_contract_ready === true, "P60400 contract must be ready"),
    validationItem("boundary.source_bound", "boundary", boundary.source_of_truth_bound_now === true, "Source of truth must be bound"),
    validationItem("boundary.authority_closed", "boundary", boundary.authority_boundary_closed_now === true, "Authority boundary must remain closed"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "hermes_loop_system_v1_1_source_binding",
    program_range: PROGRAM_RANGE,
    source_of_truth: "docs/hermes-loop-system-specification.md",
    roadmap_phase: "Phase A: Loop Overlay Contract",
    source_binding_required: true,
    output_rows_required: [
      "p60001_source_binding_rows",
      "loop_overlay_contract_inventory_rows",
      "authority_boundary_baseline_rows",
      "negative_fixture_contract_rows",
      "validation_command_rows",
      "p60400_closeout_rows",
      "p60401_next_phase_handoff_rows",
    ],
    authority_flags_required_false: HERMES_LOOP_AUTHORITY_FALSE_FLAGS,
    generated_at: generatedAt,
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p60401_handoff
    ? "ready_for_p60401_handoff"
    : validation.valid
      ? "valid_block_p60401_handoff_pending"
      : "blocked_hermes_loop_source_binding";
  return {
    hermes_loop_source_binding_status: status,
    program_range: PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    source_of_truth_bound_now: boundary.source_of_truth_bound_now,
    p60400_contract_ready: boundary.p60400_contract_ready,
    ready_for_p60401_handoff: boundary.ready_for_p60401_handoff,
    authority_boundary_closed_now: boundary.authority_boundary_closed_now,
    negative_fixture_contract_visible_now: boundary.negative_fixture_contract_visible_now,
    source_binding_row_count: boundary.source_binding_row_count,
    overlay_contract_inventory_row_count: boundary.overlay_contract_inventory_row_count,
    authority_boundary_row_count: boundary.authority_boundary_row_count,
    negative_fixture_contract_row_count: boundary.negative_fixture_contract_row_count,
    validation_command_row_count: boundary.validation_command_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries(HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => [flag, boundary[flag]])),
  };
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Source Binding ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_source_binding_status}`,
    `- source_of_truth: ${result.source_refs.source_of_truth}`,
    `- source_hash_sha256: ${result.source_refs.source_hash_sha256}`,
    `- p60400_contract_ready: ${result.summary.p60400_contract_ready}`,
    `- ready_for_p60401_handoff: ${result.summary.ready_for_p60401_handoff}`,
    `- authority_boundary_closed_now: ${result.summary.authority_boundary_closed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    `- final_approval_enabled: ${result.summary.final_approval_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p60401_handoff
      ? "Implement P60401-P60800 Loop Definition, Loop Run, and DAG schema rows against this baseline."
      : "Resolve P60400 source binding, authority, negative fixture, wiring, or validation blockers before P60401.",
    "",
  ].join("\n");
}

function verdictRow(fields) {
  const observed = fields.observed === true;
  return {
    row_id: fields.row_id,
    category: fields.category,
    label: fields.label,
    observed,
    current_verdict: observed ? "pass" : "block",
    evidence_ref: fields.evidence_ref ?? null,
    output_ref: fields.output_ref ?? null,
    block_reason: observed ? null : fields.blocker ?? "missing_required_condition",
    next_allowed_action: fields.next_allowed_action ?? "review_blocker",
    generated_at: fields.generated_at,
    ...withoutUndefined({
      contract_type: fields.contract_type,
      authority_flag: fields.authority_flag,
      allowed_now: fields.allowed_now,
      fixture_id: fields.fixture_id,
      expected_verdict: fields.expected_verdict,
      mutating: fields.mutating,
    }),
  };
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return verdictRow({
    row_id: rowId,
    category: "p60400_closeout",
    label,
    observed,
    evidence_ref: "artifacts/hermes-loop-source-binding/latest/hermes-loop-source-binding.json",
    blocker: observed ? null : `${rowId}.blocked`,
    next_allowed_action: observed ? "continue_to_p60401_handoff" : "resolve_p60400_closeout_blocker",
    generated_at: generatedAt,
  });
}

function validationItem(id, category, passed, message) {
  return {
    validation_id: id,
    category,
    passed: passed === true,
    severity: passed === true ? "info" : "error",
    message: passed === true ? `${id} passed` : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors: errors.map((item) => ({
      path: item.validation_id,
      message: item.message,
      category: item.category,
    })),
  };
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    collection: collectionName,
    generated_at: generatedAt,
    rows,
  };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_HERMES_LOOP_SOURCE_BINDING_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      data: JSON.parse(text),
      hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      hash: sha256(text),
      line_count: text.split(/\r?\n/).length,
      byte_length: Buffer.byteLength(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      hash: null,
      error: error.message,
    };
  }
}

async function readOptionalTextSource(filePath) {
  return readTextSource(filePath);
}

function normalizeInlineTextSource(sourceId, text) {
  const normalizedText = String(text ?? "");
  return {
    path: sourceId,
    available: true,
    text: normalizedText,
    hash: sha256(normalizedText),
    line_count: normalizedText.split(/\r?\n/).length,
    byte_length: Buffer.byteLength(normalizedText),
  };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--source-spec") args.sourceSpecPath = argv[++index];
    else if (arg === "--schema") args.schemaPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-spec PATH]`);
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
