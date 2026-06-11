import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildFactoryReceiptPreflight } from "./factory-receipt-preflight.mjs";
import { buildSaasFactoryMode } from "./saas-factory-mode.mjs";

export const DEFAULT_FACTORY_PROMOTION_F0_GATE_OUT_DIR = "artifacts/factory-promotion-f0-gate/latest";
export const DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS = {
  schemaPath: "schemas/factory-promotion-f0-gate.schema.json",
  packagePath: "package.json",
  ownerAdjudicationReceiptPath: "docs/factory-promotion/s0-owner-adjudication-receipt.json",
  ownerNoOpusExceptionReceiptPath: "docs/factory-promotion/f0-owner-no-opus-exception-receipt.json",
  connectorReviewReceiptPath: "artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json",
  executionReviewReceiptPath: "artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json",
  sourceMultiEnginePath: "artifacts/multi-engine-orchestration/latest/multi-engine-orchestration.json",
};

const COMMAND_NAME = "factory:promotion-f0-gate";
const SCHEMA_VERSION = "factory-promotion-f0-gate.v1";
const CAPABILITY_ID = "factory.promotion_f0_gate";
const PROGRAM_RANGE = "FCORE-F0";
const READY_STATUS = "ready_for_fa_implementation";
const BLOCKED_STATUS = "blocked_factory_promotion_f0_gate";

const EXPECTED_DECISIONS = [
  ["S0-1", "A_then_B", "F0.1 independent review engine identity policy"],
  ["S0-2", "corrective_baseline_waiver", "F0.2 corrective baseline waiver policy"],
  ["S0-3", "parallel_with_adopted_caps", "F0.3 HRM cap policy"],
  ["S0-4", "pilot_merge_governance", "F0.4 merge governance policy"],
  ["S0-5", "factory_now_product_later_fcore_canonical", "F0.5 product identity and ID policy"],
];

const UNSAFE_AUTHORITY_FIELDS = [
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
  "enterprise_trust_claim_allowed_now",
  "secret_generation_allowed_now",
  "connector_provisioning_allowed_now",
  "connector_write_enabled",
  "write_action_allowed_now",
  "runtime_execution_allowed_now",
  "release_approval_allowed_now",
  "final_approval_ui_enabled",
  "codex_final_approval_ui_enabled",
  "claude_final_approval_ui_enabled",
];

export async function runFactoryPromotionF0Gate(options = {}) {
  const result = await buildFactoryPromotionF0Gate(options);
  if (options.write !== false) await writeFactoryPromotionF0Gate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Promotion F0 Gate failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.fa_implementation_allowed_now !== true) {
    const error = new Error("Factory Promotion F0 Gate is not ready for FA implementation.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryPromotionF0Gate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const ownerReceipt = Object.prototype.hasOwnProperty.call(options, "ownerAdjudicationReceipt")
    ? normalizeInlineJsonSource("inline.owner_adjudication_receipt", options.ownerAdjudicationReceipt)
    : await readJsonSource(inputs.owner_adjudication_receipt_path);
  const ownerNoOpusException = Object.prototype.hasOwnProperty.call(options, "ownerNoOpusExceptionReceipt")
    ? normalizeInlineJsonSource("inline.owner_no_opus_exception_receipt", options.ownerNoOpusExceptionReceipt)
    : await readJsonSource(inputs.owner_no_opus_exception_receipt_path);

  const receiptPreflight = Object.prototype.hasOwnProperty.call(options, "receiptPreflight")
    ? normalizeInlineJsonSource("inline.factory_receipt_preflight", options.receiptPreflight)
    : normalizeBuiltSource("built.factory_receipt_preflight", await buildReceiptPreflight(generatedAt, inputs, ownerReceipt, options));
  const saasFactoryMode = Object.prototype.hasOwnProperty.call(options, "saasFactoryMode")
    ? normalizeInlineJsonSource("inline.saas_factory_mode", options.saasFactoryMode)
    : normalizeBuiltSource("built.saas_factory_mode", await buildSaasFactoryModeSource(generatedAt, inputs, ownerReceipt, options));

  const noOpusException = buildNoOpusExceptionState(ownerNoOpusException);
  const f0PhaseRows = buildF0PhaseRows({ ownerReceipt, ownerNoOpusException, noOpusException, receiptPreflight, saasFactoryMode, generatedAt });
  const boundary = buildBoundary({ ownerReceipt, ownerNoOpusException, noOpusException, receiptPreflight, saasFactoryMode, f0PhaseRows });
  const validationItems = buildValidationItems({ packageJson, ownerReceipt, ownerNoOpusException, receiptPreflight, saasFactoryMode, f0PhaseRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      owner_adjudication_receipt_path: ownerReceipt.path,
      owner_no_opus_exception_receipt_path: ownerNoOpusException.path,
      factory_receipt_preflight_path: receiptPreflight.path,
      saas_factory_mode_path: saasFactoryMode.path,
      connector_review_receipt_path: inputs.connector_review_receipt_path,
      execution_review_receipt_path: inputs.execution_review_receipt_path,
      source_multi_engine_path: inputs.source_multi_engine_path,
    },
    factory_promotion_f0_gate_contract: buildContract(generatedAt),
    owner_adjudication_summary: ownerReceipt.data?.scope ?? null,
    owner_no_opus_exception_summary: ownerNoOpusException.data?.scope ?? null,
    observed_receipt_preflight_summary: receiptPreflight.data?.summary ?? null,
    observed_saas_factory_mode_summary: saasFactoryMode.data?.summary ?? null,
    f0_phase_rows: f0PhaseRows,
    factory_promotion_f0_gate_boundary: boundary,
    factory_promotion_f0_gate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, f0PhaseRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "factory_promotion_f0_gate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_promotion_f0_gate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_promotion_f0_gate_validation_items);
  result.summary = buildSummary({ boundary, f0PhaseRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryPromotionF0Gate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-promotion-f0-gate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "f0-phase-rows.json"), collectionEnvelope("factory-promotion-f0-phase-rows.v1", "f0_phase_rows", result.f0_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-promotion-f0-gate-boundary.json"), result.factory_promotion_f0_gate_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryPromotionF0GateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryPromotionF0Gate(args);
    console.log(`Factory Promotion F0 Gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_promotion_f0_gate_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`F0 phase pass count: ${result.summary.f0_phase_pass_count}/${result.summary.f0_phase_count}`);
    console.log(`F0.1 receipt preflight passed: ${result.summary.f0_1_receipt_preflight_passed}`);
    console.log(`F0.2 source handoff or visible waiver: ${result.summary.f0_2_source_handoff_or_visible_waiver_now}`);
    console.log(`FA implementation allowed: ${result.summary.fa_implementation_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.summary) console.error(`- fa_implementation_allowed_now: ${error.summary.fa_implementation_allowed_now}`);
    process.exitCode = 1;
    return null;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "factory-promotion-f0-gate.contract.v1",
    generated_at: generatedAt,
    f0_1_receipt_preflight_required: true,
    f0_1_owner_no_opus_exception_allowed_once: true,
    f0_2_source_handoff_or_visible_waiver_required: true,
    s0_owner_decisions_required: EXPECTED_DECISIONS.map(([decisionId]) => decisionId),
    fa_implementation_may_start_only_when_all_f0_rows_pass: true,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

async function buildReceiptPreflight(generatedAt, inputs, ownerReceipt, options) {
  const childOptions = {
    runAt: generatedAt,
    write: false,
    connectorReceiptPath: inputs.connector_review_receipt_path,
    executionReceiptPath: inputs.execution_review_receipt_path,
  };
  if (ownerReceipt.available || Object.prototype.hasOwnProperty.call(options, "ownerAdjudicationReceipt")) {
    childOptions.ownerAdjudicationReceipt = ownerReceipt.data;
  }
  if (Object.prototype.hasOwnProperty.call(options, "inlineReceipts")) childOptions.inlineReceipts = options.inlineReceipts;
  return buildFactoryReceiptPreflight(childOptions);
}

async function buildSaasFactoryModeSource(generatedAt, inputs, ownerReceipt, options) {
  const childOptions = {
    runAt: generatedAt,
    write: false,
    sourceMultiEnginePath: inputs.source_multi_engine_path,
  };
  if (ownerReceipt.available || Object.prototype.hasOwnProperty.call(options, "ownerAdjudicationReceipt")) {
    childOptions.ownerAdjudicationReceipt = ownerReceipt.data;
  }
  if (Object.prototype.hasOwnProperty.call(options, "multiEngineOrchestration")) {
    childOptions.multiEngineOrchestration = options.multiEngineOrchestration;
  }
  return buildSaasFactoryMode(childOptions);
}

function buildF0PhaseRows({ ownerReceipt, ownerNoOpusException, noOpusException, receiptPreflight, saasFactoryMode, generatedAt }) {
  const decisionMap = new Map((ownerReceipt.data?.adjudicated_decisions ?? []).map((decision) => [decision.decision_id, decision]));
  const s01 = decisionMap.get("S0-1");
  const s02 = decisionMap.get("S0-2");
  const receiptPreflightPassed = receiptPreflight.data?.summary?.f0_1_receipt_preflight_passed === true && s01?.decision === "A_then_B";
  const rows = [
    gateRow({
      row_id: "F0.1",
      category: noOpusException.active ? "owner_exception" : "receipt_preflight",
      label: "F0.1 independent review receipts pass integrity preflight or owner no-Opus exception is active",
      observed: receiptPreflightPassed || noOpusException.active,
      evidence_ref: noOpusException.active ? ownerNoOpusException.path : receiptPreflight.path,
      generated_at: generatedAt,
      blocked_reason: buildReceiptBlockedReason(receiptPreflight.data),
      expected_decision: "A_then_B",
      observed_decision: s01?.decision ?? null,
      decision_receipt_id: s01?.receipt_id ?? null,
      receipt_preflight_passed: receiptPreflightPassed,
      owner_no_opus_exception_active: noOpusException.active,
      owner_no_opus_exception_receipt_id: noOpusException.receipt_id,
      independent_review_deferred_now: noOpusException.active,
      fa_implementation_trust_level: noOpusException.active ? "owner_exception_low_trust" : "reviewed_baseline",
    }),
    gateRow({
      row_id: "F0.2",
      category: "source_chain",
      label: "F0.2 source handoff passes or corrective-baseline waiver remains visible",
      observed: saasFactoryMode.data?.summary?.f0_2_source_handoff_or_visible_waiver_now === true
        && saasFactoryMode.data?.summary?.fcore_corrective_baseline_waiver_opens_authority_now === false
        && s02?.decision === "corrective_baseline_waiver",
      evidence_ref: saasFactoryMode.path,
      generated_at: generatedAt,
      source_ready_for_p15001_handoff: saasFactoryMode.data?.summary?.source_ready_for_p15001_handoff ?? null,
      source_blocker_waived_for_fcore_corrective_baseline_now: saasFactoryMode.data?.summary?.source_blocker_waived_for_fcore_corrective_baseline_now ?? null,
      expected_decision: "corrective_baseline_waiver",
      observed_decision: s02?.decision ?? null,
      decision_receipt_id: s02?.receipt_id ?? null,
    }),
  ];

  for (const [decisionId, expectedDecision, label] of EXPECTED_DECISIONS.slice(2)) {
    const decision = decisionMap.get(decisionId);
    rows.push(gateRow({
      row_id: decisionId.replace("S0-", "F0."),
      category: "owner_adjudication",
      label,
      observed: decision?.decision === expectedDecision,
      evidence_ref: decision?.source_ref ?? ownerReceipt.path,
      generated_at: generatedAt,
      expected_decision: expectedDecision,
      observed_decision: decision?.decision ?? null,
      receipt_id: decision?.receipt_id ?? null,
    }));
  }
  return rows;
}

function buildNoOpusExceptionState(ownerNoOpusException) {
  const data = ownerNoOpusException.data ?? {};
  const authorityFlags = data.authority_flags ?? {};
  const active = ownerNoOpusException.available === true
    && data.receipt_kind === "human_owner_no_opus_exception"
    && data.status === "accepted_limited_low_trust"
    && data.scope?.program === "Hermes Factory Promotion"
    && data.scope?.stage === "F0.1"
    && data.scope?.applies_once === true
    && data.exception?.skip_opus_review_this_run === true
    && data.exception?.allows_fa_implementation_without_opus_now === true
    && data.exception?.requires_deferred_independent_review_before_production_or_enterprise === true
    && data.exception?.expires_before === "FA.6 freeze"
    && data.exception?.trust_level === "owner_exception_low_trust"
    && [
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
  return {
    active,
    receipt_id: data.receipt_id ?? null,
    trust_level: data.exception?.trust_level ?? null,
  };
}

function buildBoundary({ ownerReceipt, ownerNoOpusException, noOpusException, receiptPreflight, saasFactoryMode, f0PhaseRows }) {
  const unsafeAuthorityTrueCount = countUnsafeAuthorityFields([
    ownerReceipt.data,
    ownerNoOpusException.data,
    receiptPreflight.data?.factory_receipt_preflight_boundary,
    saasFactoryMode.data?.saas_factory_boundary,
    receiptPreflight.data?.summary,
    saasFactoryMode.data?.summary,
  ]);
  const f0PhasePassCount = f0PhaseRows.filter((row) => row.current_verdict === "pass").length;
  const f0AllPhasesPassed = f0PhaseRows.length > 0 && f0PhasePassCount === f0PhaseRows.length;
  return {
    owner_adjudication_receipt_present_now: ownerReceipt.available === true,
    owner_adjudication_receipt_id: ownerReceipt.data?.receipt_id ?? null,
    owner_no_opus_exception_receipt_present_now: ownerNoOpusException.available === true,
    owner_no_opus_exception_active_now: noOpusException.active,
    owner_no_opus_exception_receipt_id: noOpusException.receipt_id,
    independent_review_deferred_now: noOpusException.active,
    fa_implementation_trust_level: noOpusException.active ? "owner_exception_low_trust" : "reviewed_baseline",
    receipt_preflight_validation_valid: receiptPreflight.data?.validation?.valid === true,
    saas_factory_mode_validation_valid: saasFactoryMode.data?.validation?.valid === true,
    f0_phase_count: f0PhaseRows.length,
    f0_phase_pass_count: f0PhasePassCount,
    f0_all_phases_passed: f0AllPhasesPassed,
    f0_1_receipt_preflight_passed: receiptPreflight.data?.summary?.f0_1_receipt_preflight_passed === true,
    f0_2_source_handoff_or_visible_waiver_now: saasFactoryMode.data?.summary?.f0_2_source_handoff_or_visible_waiver_now === true,
    source_ready_for_p15001_handoff: saasFactoryMode.data?.summary?.source_ready_for_p15001_handoff === true,
    source_blocker_waived_for_fcore_corrective_baseline_now: saasFactoryMode.data?.summary?.source_blocker_waived_for_fcore_corrective_baseline_now === true,
    unsafe_authority_true_count: unsafeAuthorityTrueCount,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    command_execution_allowed_now: false,
    api_write_methods_allowed_now: false,
    store_mutation_allowed_now: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    fable_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems({ packageJson, ownerReceipt, ownerNoOpusException, receiptPreflight, saasFactoryMode, f0PhaseRows, boundary }) {
  return [
    validationItem("package.script", "package", packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/factory-promotion-f0-gate.mjs", `${COMMAND_NAME} package script missing`),
    validationItem("owner.receipt.available", "owner_adjudication", ownerReceipt.available === true, "S0 owner adjudication receipt missing", ownerReceipt.path),
    validationItem("owner.no_opus_exception.authority_closed", "owner_adjudication", ownerNoOpusException.available !== true || countUnsafeAuthorityFields(ownerNoOpusException.data) === 0, "Owner no-Opus exception opened forbidden authority", ownerNoOpusException.path),
    validationItem("receipt_preflight.validation", "receipt_preflight", receiptPreflight.data?.validation?.valid === true, "Factory receipt preflight validation is not valid", receiptPreflight.path),
    validationItem("saas_factory_mode.validation", "source_chain", saasFactoryMode.data?.validation?.valid === true, "SaaS Factory mode validation is not valid", saasFactoryMode.path),
    validationItem("f0.rows.present", "contract", f0PhaseRows.length === 5, "F0 gate rows incomplete", "f0_phase_rows"),
    validationItem("authority.closed", "authority", boundary.unsafe_authority_true_count === 0, "Input evidence opened forbidden authority", "factory_promotion_f0_gate_boundary"),
    validationItem("boundary.flags.false", "authority", allBoundaryAuthorityFlagsFalse(boundary), "F0 gate boundary opened forbidden authority", "factory_promotion_f0_gate_boundary"),
  ];
}

function buildSummary({ boundary, f0PhaseRows, validation }) {
  const faAllowed = boundary.f0_all_phases_passed === true && boundary.unsafe_authority_true_count === 0 && validation.valid === true;
  return {
    factory_promotion_f0_gate_status: faAllowed ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    owner_adjudication_receipt_present_now: boundary.owner_adjudication_receipt_present_now,
    f0_phase_count: boundary.f0_phase_count,
    f0_phase_pass_count: boundary.f0_phase_pass_count,
    f0_all_phases_passed: boundary.f0_all_phases_passed,
    f0_1_receipt_preflight_passed: boundary.f0_1_receipt_preflight_passed,
    f0_1_owner_no_opus_exception_active_now: boundary.owner_no_opus_exception_active_now,
    independent_review_deferred_now: boundary.independent_review_deferred_now,
    fa_implementation_trust_level: boundary.fa_implementation_trust_level,
    f0_2_source_handoff_or_visible_waiver_now: boundary.f0_2_source_handoff_or_visible_waiver_now,
    source_ready_for_p15001_handoff: boundary.source_ready_for_p15001_handoff,
    source_blocker_waived_for_fcore_corrective_baseline_now: boundary.source_blocker_waived_for_fcore_corrective_baseline_now,
    blocked_phase_ids: f0PhaseRows.filter((row) => row.current_verdict !== "pass").map((row) => row.row_id),
    unsafe_authority_true_count: boundary.unsafe_authority_true_count,
    validation_errors: validation.errors.length,
    fa_implementation_allowed_now: faAllowed,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function gateRow(fields) {
  return {
    schema_version: "factory-promotion-f0-gate-row.v1",
    ...fields,
    required: true,
    current_verdict: fields.observed ? "pass" : "blocked",
  };
}

function buildReceiptBlockedReason(preflight) {
  if (!preflight?.summary) return "receipt preflight unavailable";
  if (preflight.summary.f0_1_receipt_preflight_passed === true) return null;
  const blocked = preflight.summary.blocked_target_ids ?? [];
  if (blocked.length > 0) return `blocked targets: ${blocked.join(", ")}`;
  return "receipt preflight did not pass";
}

function countUnsafeAuthorityFields(values) {
  let count = 0;
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (UNSAFE_AUTHORITY_FIELDS.includes(key) && nested === true) count += 1;
      visit(nested);
    }
  }
  visit(values);
  return count;
}

function allBoundaryAuthorityFlagsFalse(boundary) {
  return [
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
  ].every((key) => boundary[key] === false);
}

function validationItem(itemId, category, observed, message, pathRef = null) {
  return {
    item_id: itemId,
    category,
    observed,
    current_verdict: observed ? "pass" : "fail",
    message: observed ? "OK" : message,
    path: pathRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function renderMarkdown(result) {
  const lines = [
    "# Factory Promotion F0 Gate",
    "",
    `Status: ${result.summary.factory_promotion_f0_gate_status}`,
    `Program: ${result.program_range}`,
    `Generated: ${result.generated_at}`,
    `FA implementation allowed: ${result.summary.fa_implementation_allowed_now}`,
    "",
    "## F0 Rows",
    "",
    "| Row | Category | Verdict | Evidence |",
    "|---|---|---|---|",
  ];
  for (const row of result.f0_phase_rows) {
    lines.push(`| ${row.row_id} | ${row.category} | ${row.current_verdict} | ${row.evidence_ref} |`);
  }
  lines.push(
    "",
    "## Boundary",
    "",
    `F0.1 receipt preflight passed: ${result.summary.f0_1_receipt_preflight_passed}`,
    `F0.2 source handoff or visible waiver: ${result.summary.f0_2_source_handoff_or_visible_waiver_now}`,
    `Unsafe authority true count: ${result.summary.unsafe_authority_true_count}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Validation",
    "",
    `Valid: ${result.validation.valid}`,
    `Errors: ${result.validation.errors.length}`,
    `Owner no-Opus exception active: ${result.summary.f0_1_owner_no_opus_exception_active_now}`,
    `FA implementation trust level: ${result.summary.fa_implementation_trust_level}`,
  );
  return `${lines.join("\n")}\n`;
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    try {
      return {
        available: true,
        parseable: true,
        path: filePath,
        data: JSON.parse(text),
      };
    } catch (error) {
      return {
        available: true,
        parseable: false,
        path: filePath,
        data: null,
        error: `Invalid JSON: ${error.message}`,
      };
    }
  } catch (error) {
    return {
      available: false,
      parseable: false,
      path: filePath,
      data: null,
      error: error.message,
    };
  }
}

function normalizeInlineJsonSource(sourcePath, value) {
  if (value === null || value === undefined) {
    return {
      available: false,
      parseable: false,
      path: sourcePath,
      data: null,
    };
  }
  return {
    available: true,
    parseable: true,
    path: sourcePath,
    data: value,
  };
}

function normalizeBuiltSource(sourcePath, value) {
  return {
    available: true,
    parseable: true,
    path: sourcePath,
    data: value,
  };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.packagePath,
    owner_adjudication_receipt_path: options.ownerAdjudicationReceiptPath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.ownerAdjudicationReceiptPath,
    owner_no_opus_exception_receipt_path: options.ownerNoOpusExceptionReceiptPath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.ownerNoOpusExceptionReceiptPath,
    connector_review_receipt_path: options.connectorReceiptPath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.connectorReviewReceiptPath,
    execution_review_receipt_path: options.executionReceiptPath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.executionReviewReceiptPath,
    source_multi_engine_path: options.sourceMultiEnginePath ?? DEFAULT_FACTORY_PROMOTION_F0_GATE_INPUTS.sourceMultiEnginePath,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") {
      args.check = true;
      args.write = false;
    } else if (value === "--require-pass") args.requirePass = true;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--owner-adjudication-receipt-path") args.ownerAdjudicationReceiptPath = argv[++index];
    else if (value === "--owner-no-opus-exception-receipt-path") args.ownerNoOpusExceptionReceiptPath = argv[++index];
    else if (value === "--connector-receipt-path") args.connectorReceiptPath = argv[++index];
    else if (value === "--execution-receipt-path") args.executionReceiptPath = argv[++index];
    else if (value === "--source-multi-engine-path") args.sourceMultiEnginePath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--require-pass] [--out-dir DIR]`);
  console.log("Composes F0 owner adjudication, receipt preflight, and source-chain readiness into the FA implementation gate.");
}
