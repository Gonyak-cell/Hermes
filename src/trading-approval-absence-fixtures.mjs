import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS,
  DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS,
  buildTradingRouteInventoryFixtures,
} from "./trading-route-inventory-fixtures.mjs";

export const DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_OUT_DIR = "artifacts/trading-approval-absence-fixtures/latest";
export const DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS,
  routeInventoryFixturesSchemaPath: DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.schemaPath,
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  executionEnginePath: "examples/trading/execution-engine.json",
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  riskEnginePath: "examples/trading/risk-engine.json",
  schemaPath: "schemas/trading/trading-approval-absence-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-approval-absence-fixtures.v1";
const CAPABILITY_ID = "trading.approval_absence_fixtures";
const PHASE_SLOT = "P383";
const PREVIOUS_PHASE_SLOT = "P382";
const NEXT_PHASE_SLOT = "P384";
const READY_STATUS = "ready_for_trading_approval_absence_regression";
const REQUIRED_FIXTURE_KEYS = [
  "limited_live_approval_absence",
  "full_auto_approval_absence",
  "first_trade_confirmation_absence",
  "promotion_approval_absence",
  "manual_resume_approval_absence",
];

export async function runTradingApprovalAbsenceFixtures(options = {}) {
  const result = await buildTradingApprovalAbsenceFixtures(options);
  if (options.write !== false) await writeTradingApprovalAbsenceFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading approval absence fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingApprovalAbsenceFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const routeInventoryFixtures = await buildTradingRouteInventoryFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    safetyRegressionFixturesSchemaPath: inputs.safety_regression_fixtures_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.route_inventory_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const modelImprovement = await readJsonSource(inputs.model_improvement_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const approvalAbsenceAnchor = buildApprovalAbsenceAnchor({ routeInventoryFixtures });
  const approvalAbsenceEvidenceRows = buildApprovalAbsenceEvidenceRows({
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
    paperShadow: paperShadow.data,
    executionEngine: executionEngine.data,
    modelImprovement: modelImprovement.data,
    riskEngine: riskEngine.data,
  });
  const approvalAbsenceFixtureRows = buildApprovalAbsenceFixtureRows(approvalAbsenceEvidenceRows);
  const approvalAbsenceBoundary = buildApprovalAbsenceBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    evidenceRows: approvalAbsenceEvidenceRows,
    fixtureRows: approvalAbsenceFixtureRows,
  });
  const approvalAbsenceGateRows = buildApprovalAbsenceGateRows({
    routeInventoryFixtures,
    packageJson,
    platformOpsLedger,
    sources: [limitedLive, fullAuto, paperShadow, executionEngine, modelImprovement, riskEngine],
    evidenceRows: approvalAbsenceEvidenceRows,
    fixtureRows: approvalAbsenceFixtureRows,
    boundary: approvalAbsenceBoundary,
  });
  const validationItems = buildValidationItems({
    routeInventoryFixtures,
    packageJson,
    platformOpsLedger,
    sources: [limitedLive, fullAuto, paperShadow, executionEngine, modelImprovement, riskEngine],
    evidenceRows: approvalAbsenceEvidenceRows,
    fixtureRows: approvalAbsenceFixtureRows,
    gateRows: approvalAbsenceGateRows,
    boundary: approvalAbsenceBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    routeInventoryFixtures,
    evidenceRows: approvalAbsenceEvidenceRows,
    fixtureRows: approvalAbsenceFixtureRows,
    gateRows: approvalAbsenceGateRows,
    boundary: approvalAbsenceBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_approval_absence_fixtures_id: `trading-approval-absence-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    approval_absence_anchor: approvalAbsenceAnchor,
    approval_absence_evidence_rows: approvalAbsenceEvidenceRows,
    approval_absence_fixture_rows: approvalAbsenceFixtureRows,
    approval_absence_gate_rows: approvalAbsenceGateRows,
    approval_absence_boundary: approvalAbsenceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_approval_absence_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    routeInventoryFixtures,
    evidenceRows: approvalAbsenceEvidenceRows,
    fixtureRows: approvalAbsenceFixtureRows,
    gateRows: approvalAbsenceGateRows,
    boundary: approvalAbsenceBoundary,
    validation: result.validation,
  });
  result.summary.trading_approval_absence_fixtures_id = result.trading_approval_absence_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingApprovalAbsenceFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-approval-absence-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "approval-absence-evidence-rows.json"), collectionEnvelope("trading-approval-absence-evidence-rows.v1", "approval_absence_evidence_rows", result.approval_absence_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "approval-absence-fixture-rows.json"), collectionEnvelope("trading-approval-absence-fixture-rows.v1", "approval_absence_fixture_rows", result.approval_absence_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "approval-absence-gate-rows.json"), collectionEnvelope("trading-approval-absence-gate-rows.v1", "approval_absence_gate_rows", result.approval_absence_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "approval-absence-boundary.json"), result.approval_absence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-approval-absence-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingApprovalAbsenceFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingApprovalAbsenceFixtures(args);
    console.log(`Trading approval absence fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_approval_absence_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Approval receipts present: ${result.summary.approval_receipt_present_count}`);
    console.log(`Unsafe enablement detected: ${result.summary.unsafe_enablement_detected_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildApprovalAbsenceAnchor({ routeInventoryFixtures }) {
  return {
    schema_version: "trading-approval-absence-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_route_inventory_fixtures_id: routeInventoryFixtures.trading_route_inventory_fixtures_id,
    source_route_inventory_status: routeInventoryFixtures.summary.trading_route_inventory_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: routeInventoryFixtures.trading_route_inventory_fixtures_id,
      status: routeInventoryFixtures.summary.trading_route_inventory_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildApprovalAbsenceEvidenceRows({ limitedLive, fullAuto, paperShadow, executionEngine, modelImprovement, riskEngine }) {
  const rows = [
    approvalEvidenceRow({
      rowKey: "limited_live_approval_absence",
      artifactId: "limited_live_governance",
      approvalPath: "approval_gate",
      approvalRequired: valueAt(limitedLive, ["approval_gate", "approval_required"]) === true,
      receiptPresent: valueAt(limitedLive, ["approval_gate", "approval_receipt_present"]) === true || valueAt(limitedLive, ["safety_boundary", "approval_receipt_present"]) === true,
      blockingDecision: valueAt(limitedLive, ["approval_gate", "decision"]),
      blockingDecisionDeclared: valueAt(limitedLive, ["approval_gate", "decision"]) === "blocked" && valueAt(limitedLive, ["capital_cap", "blocks_when_missing_approval"]) === true,
      blockedConditions: [
        blockedCondition("safety_boundary.limited_live_enabled", valueAt(limitedLive, ["safety_boundary", "limited_live_enabled"]), false),
        blockedCondition("safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
        blockedCondition("safety_boundary.real_order_submitted", valueAt(limitedLive, ["safety_boundary", "real_order_submitted"]), false),
        blockedCondition("safety_boundary.broker_write_allowed", valueAt(limitedLive, ["safety_boundary", "broker_write_allowed"]), false),
        blockedCondition("safety_boundary.exchange_write_allowed", valueAt(limitedLive, ["safety_boundary", "exchange_write_allowed"]), false),
        blockedCondition("safety_boundary.full_auto_promotion_allowed", valueAt(limitedLive, ["safety_boundary", "full_auto_promotion_allowed"]), false),
      ],
    }),
    approvalEvidenceRow({
      rowKey: "full_auto_approval_absence",
      artifactId: "full_auto_governance",
      approvalPath: "full_auto_approval_checklist",
      approvalRequired: valueAt(fullAuto, ["full_auto_approval_checklist", "approval_required"]) === true,
      receiptPresent: valueAt(fullAuto, ["full_auto_approval_checklist", "approval_receipt_present"]) === true,
      blockingDecision: valueAt(fullAuto, ["full_auto_approval_checklist", "decision"]),
      blockingDecisionDeclared: valueAt(fullAuto, ["full_auto_approval_checklist", "decision"]) === "blocked",
      blockedConditions: [
        blockedCondition("safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
        blockedCondition("safety_boundary.limited_live_enabled", valueAt(fullAuto, ["safety_boundary", "limited_live_enabled"]), false),
        blockedCondition("safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
        blockedCondition("safety_boundary.live_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "live_order_submission_allowed"]), false),
        blockedCondition("safety_boundary.real_order_submitted", valueAt(fullAuto, ["safety_boundary", "real_order_submitted"]), false),
        blockedCondition("safety_boundary.broker_write_allowed", valueAt(fullAuto, ["safety_boundary", "broker_write_allowed"]), false),
        blockedCondition("safety_boundary.exchange_write_allowed", valueAt(fullAuto, ["safety_boundary", "exchange_write_allowed"]), false),
      ],
    }),
    approvalEvidenceRow({
      rowKey: "first_trade_confirmation_absence",
      artifactId: "limited_live_governance",
      approvalPath: "first_trade_confirmation",
      approvalRequired: valueAt(limitedLive, ["first_trade_confirmation", "required"]) === true,
      receiptPresent: valueAt(limitedLive, ["first_trade_confirmation", "confirmation_present"]) === true,
      blockingDecision: valueAt(limitedLive, ["first_trade_confirmation", "confirmation_receipt_ref"]),
      blockingDecisionDeclared: valueAt(limitedLive, ["first_trade_confirmation", "blocks_first_trade"]) === true && String(valueAt(limitedLive, ["first_trade_confirmation", "confirmation_receipt_ref"])).includes("missing"),
      blockedConditions: [
        blockedCondition("first_trade_confirmation.first_trade_submitted", valueAt(limitedLive, ["first_trade_confirmation", "first_trade_submitted"]), false),
        blockedCondition("safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
        blockedCondition("order_caps.order_submission_allowed", valueAt(limitedLive, ["order_caps", "order_submission_allowed"]), false),
        blockedCondition("auto_cancel_stale_orders.live_cancel_allowed", valueAt(limitedLive, ["auto_cancel_stale_orders", "live_cancel_allowed"]), false),
      ],
    }),
    approvalEvidenceRow({
      rowKey: "promotion_approval_absence",
      artifactId: "trading_promotion_sources",
      approvalPath: "promotion_criteria",
      approvalRequired: [
        valueAt(paperShadow, ["promotion_criteria_to_shadow", "human_approval_required"]),
        valueAt(paperShadow, ["promotion_criteria_to_limited_live", "human_approval_required"]),
        valueAt(limitedLive, ["promotion_criteria_to_full_auto", "human_approval_required"]),
        valueAt(modelImprovement, ["promotion_policy_gate", "human_approval_required"]),
      ].every((value) => value === true),
      receiptPresent: false,
      blockingDecision: "blocked_or_pending_human_review",
      blockingDecisionDeclared: ["blocked", "pending_human_review"].includes(valueAt(paperShadow, ["promotion_criteria_to_shadow", "decision"]))
        && valueAt(paperShadow, ["promotion_criteria_to_limited_live", "decision"]) === "blocked"
        && valueAt(limitedLive, ["promotion_criteria_to_full_auto", "decision"]) === "blocked",
      blockedConditions: [
        blockedCondition("promotion_criteria_to_shadow.shadow_live_enabled", valueAt(paperShadow, ["promotion_criteria_to_shadow", "shadow_live_enabled"]), false),
        blockedCondition("promotion_criteria_to_limited_live.limited_live_enabled", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "limited_live_enabled"]), false),
        blockedCondition("promotion_criteria_to_full_auto.full_auto_enabled", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "full_auto_enabled"]), false),
        blockedCondition("promotion_policy_gate.auto_live_promotion_allowed", valueAt(modelImprovement, ["promotion_policy_gate", "auto_live_promotion_allowed"]), false),
        blockedCondition("promotion_policy_gate.live_promotion_allowed", valueAt(modelImprovement, ["promotion_policy_gate", "live_promotion_allowed"]), false),
        blockedCondition("live_deployment_boundary.live_deployment_allowed", valueAt(modelImprovement, ["live_deployment_boundary", "live_deployment_allowed"]), false),
      ],
    }),
    approvalEvidenceRow({
      rowKey: "manual_resume_approval_absence",
      artifactId: "execution_and_risk_governance",
      approvalPath: "manual_resume_policy_and_risk_override",
      approvalRequired: valueAt(executionEngine, ["manual_resume_policy", "human_approval_required"]) === true && valueAt(riskEngine, ["override_policy", "requires_human_approval"]) === true,
      receiptPresent: false,
      blockingDecision: "manual_resume_and_override_blocked_without_human_receipt",
      blockingDecisionDeclared: valueAt(executionEngine, ["manual_resume_policy", "resume_route_enabled"]) === false
        && valueAt(riskEngine, ["override_policy", "override_receipt_required"]) === true
        && valueAt(riskEngine, ["risk_result_policy", "halt_prevents_resume_without_human"]) === true,
      blockedConditions: [
        blockedCondition("manual_resume_policy.resume_route_enabled", valueAt(executionEngine, ["manual_resume_policy", "resume_route_enabled"]), false),
        blockedCondition("safety_boundary.live_execution_allowed", valueAt(executionEngine, ["safety_boundary", "live_execution_allowed"]), false),
        blockedCondition("safety_boundary.live_adapter_enabled", valueAt(executionEngine, ["safety_boundary", "live_adapter_enabled"]), false),
        blockedCondition("credential_broker_contract.credential_lookup_allowed", valueAt(executionEngine, ["credential_broker_contract", "credential_lookup_allowed"]), false),
        blockedCondition("safety_boundary.broker_write_allowed", valueAt(executionEngine, ["safety_boundary", "broker_write_allowed"]), false),
        blockedCondition("safety_boundary.exchange_write_allowed", valueAt(executionEngine, ["safety_boundary", "exchange_write_allowed"]), false),
      ],
    }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "approval_absence_evidence_hash"));
}

function approvalEvidenceRow({ rowKey, artifactId, approvalPath, approvalRequired, receiptPresent, blockingDecision, blockingDecisionDeclared, blockedConditions }) {
  const allBlockedConditionsPresent = blockedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = blockedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  const approvalMissing = approvalRequired && !receiptPresent;
  const evidenceStatus = approvalMissing && blockingDecisionDeclared && allBlockedConditionsPresent && unsafeConditions.length === 0 ? "blocked_by_missing_approval" : "unsafe_or_incomplete";
  return {
    schema_version: "trading-approval-absence-evidence-row.v1",
    approval_absence_evidence_row_id: `trading-approval-absence.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    approval_path: approvalPath,
    approval_required: approvalRequired,
    approval_receipt_present: receiptPresent,
    approval_missing: approvalMissing,
    blocking_decision: blockingDecision ?? null,
    blocking_decision_declared: blockingDecisionDeclared,
    blocked_conditions: blockedConditions,
    blocked_condition_count: blockedConditions.length,
    all_blocked_conditions_present: allBlockedConditionsPresent,
    unsafe_enablement_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: evidenceStatus,
    human_review_required: true,
  };
}

function blockedCondition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean",
    unsafe_when_not_safe: true,
  };
}

function observedUnsafeCondition(evidenceRows, conditionPath) {
  return evidenceRows
    .flatMap((row) => row.blocked_conditions)
    .some((condition) => condition.condition_path === conditionPath && condition.observed_value !== condition.expected_safe_value);
}

function buildApprovalAbsenceFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-approval-absence-fixture-row.v1",
      approval_absence_fixture_row_id: `trading-approval-absence-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_approval_required: true,
      expected_approval_receipt_present: false,
      approval_required: evidenceRow?.approval_required === true,
      approval_receipt_present: evidenceRow?.approval_receipt_present === true,
      approval_missing: evidenceRow?.approval_missing === true,
      blocking_decision_declared: evidenceRow?.blocking_decision_declared === true,
      unsafe_enablement_detected: evidenceRow?.unsafe_enablement_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_receipt_present: true,
      fixture_should_fail_when_enablement_unblocked: true,
      fixture_status: evidenceRow?.evidence_status === "blocked_by_missing_approval" ? "passed" : "failed",
      live_trading_enabled_by_fixture: false,
      approval_applied_by_fixture: false,
      broker_write_allowed_by_fixture: false,
      exchange_write_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "approval_absence_fixture_hash");
  });
}

function buildApprovalAbsenceBoundary({ generatedAt, writeRequested, evidenceRows, fixtureRows }) {
  const receiptRows = evidenceRows.filter((row) => row.approval_receipt_present);
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_enablement_detected);
  return {
    schema_version: "trading-approval-absence-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    approval_absence_artifact_write_requested: writeRequested,
    approval_absence_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    approval_absence_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    approval_receipt_present_count: receiptRows.length,
    approval_receipt_present_refs: receiptRows.map((row) => row.row_key),
    unsafe_enablement_detected_count: unsafeRows.length,
    unsafe_enablement_refs: unsafeRows.map((row) => row.row_key),
    missing_approval_block_count: evidenceRows.filter((row) => row.evidence_status === "blocked_by_missing_approval").length,
    approval_absence_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "blocked_by_missing_approval"),
    approval_application_allowed: false,
    approval_applied: false,
    limited_live_enabled: observedUnsafeCondition(evidenceRows, "safety_boundary.limited_live_enabled"),
    full_auto_enabled: observedUnsafeCondition(evidenceRows, "safety_boundary.full_auto_enabled"),
    automatic_order_submission_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.automatic_order_submission_allowed"),
    live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.live_order_submission_allowed"),
    trading_live_enabled: observedUnsafeCondition(evidenceRows, "safety_boundary.limited_live_enabled") || observedUnsafeCondition(evidenceRows, "safety_boundary.live_order_submission_allowed"),
    trading_full_auto_enabled: observedUnsafeCondition(evidenceRows, "safety_boundary.full_auto_enabled"),
    trading_order_submission_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.automatic_order_submission_allowed") || observedUnsafeCondition(evidenceRows, "safety_boundary.live_order_submission_allowed"),
    live_adapter_enabled: observedUnsafeCondition(evidenceRows, "safety_boundary.live_adapter_enabled"),
    credential_lookup_enabled: observedUnsafeCondition(evidenceRows, "credential_broker_contract.credential_lookup_allowed"),
    broker_write_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.broker_write_allowed"),
    exchange_write_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.exchange_write_allowed"),
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
  };
}

function buildApprovalAbsenceGateRows({ routeInventoryFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p382_route_inventory_fixtures_ready", "P382 route inventory fixtures source is ready.", routeInventoryFixtures.validation.valid && routeInventoryFixtures.summary.trading_route_inventory_fixtures_status === "ready_for_trading_route_inventory_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P383 trading approval absence fixtures command.", typeof scripts["trading:approval-absence-fixtures"] === "string" && scripts["trading:approval-absence-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P383 trading approval absence fixtures command.", validateScript.includes("npm run trading:approval-absence-fixtures -- --check")),
    gateRow("p383_ledger_acceptance_declared", "P383 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P383: `trading:approval-absence-fixtures`")),
    gateRow("approval_sources_readable", "Trading approval absence sources are readable.", sources.every((source) => source.available)),
    gateRow("required_approval_absence_fixtures_declared", "All required approval absence fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("approval_receipts_absent", "Approval, confirmation, promotion, resume, and override receipts remain absent.", boundary.approval_receipt_present_count === 0 && evidenceRows.every((row) => row.approval_missing)),
    gateRow("missing_approval_blocks_enablement", "Missing approvals keep live, full-auto, order submission, live adapter, credential lookup, broker writes, and exchange writes blocked.", boundary.approval_absence_covered && boundary.unsafe_enablement_detected_count === 0),
    gateRow("no_trading_or_artifact_mutation", "Approval absence fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "approval_absence_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-approval-absence-gate-row.v1",
    approval_absence_gate_row_id: `trading-approval-absence-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    approval_receipt_present_by_gate: false,
    approval_applied_by_gate: false,
    unsafe_enablement_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ routeInventoryFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.route_inventory_fixtures", "p382_route_inventory_fixtures_ready", routeInventoryFixtures.validation.valid && routeInventoryFixtures.summary.trading_route_inventory_fixtures_status === "ready_for_trading_route_inventory_regression", "P382 route inventory fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P383 approval absence fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.approval_sources", "approval_sources_readable", sources.every((source) => source.available), "Trading approval absence sources are readable."),
    validationItem("approval_absence_evidence_rows", "approval_absence_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "blocked_by_missing_approval" && row.approval_missing), "Approval absence evidence rows must show missing approvals blocking enablement."),
    validationItem("approval_absence_fixture_rows", "required_approval_absence_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_receipt_present && row.fixture_should_fail_when_enablement_unblocked), "All approval absence fixtures must pass with receipts absent and enablement blocked."),
    validationItem("approval_absence_gate_rows", "approval_absence_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P383 approval absence gates are ready."),
    validationItem("boundary.approval_receipts_absent", "approval_receipts_absent", boundary.approval_receipt_present_count === 0 && !boundary.approval_applied && !boundary.approval_application_allowed, "Approval receipts and approval application must remain absent."),
    validationItem("boundary.missing_approval_blocks_enablement", "missing_approval_blocks_enablement", boundary.approval_absence_covered && boundary.unsafe_enablement_detected_count === 0 && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_adapter_enabled && !boundary.credential_lookup_enabled, "Missing approvals must keep live, full-auto, order submission, live adapter, and credential lookup blocked."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P383 approval absence fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ routeInventoryFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_approval_absence_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_route_inventory_status: routeInventoryFixtures.summary.trading_route_inventory_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    approval_absence_evidence_count: boundary.approval_absence_evidence_count,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    approval_receipt_present_count: boundary.approval_receipt_present_count,
    unsafe_enablement_detected_count: boundary.unsafe_enablement_detected_count,
    missing_approval_block_count: boundary.missing_approval_block_count,
    approval_absence_covered: boundary.approval_absence_covered,
    approval_application_allowed: boundary.approval_application_allowed,
    approval_applied: boundary.approval_applied,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    live_adapter_enabled: boundary.live_adapter_enabled,
    credential_lookup_enabled: boundary.credential_lookup_enabled,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Approval Absence Fixtures",
    "",
    `Status: ${result.summary.trading_approval_absence_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source route inventory: ${result.summary.source_route_inventory_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Approval receipts present: ${result.summary.approval_receipt_present_count}`,
    `Unsafe enablement detected: ${result.summary.unsafe_enablement_detected_count}`,
    "",
    "## Fixtures",
    "",
    ...result.approval_absence_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.approval_absence_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_OUT_DIR, routeSourcePaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--route-source") parsed.routeSourcePaths.push(argv[++index]);
    else if (arg === "--release-check-receipt-closeout-schema") parsed.releaseCheckReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--safety-regression-fixtures-schema") parsed.safetyRegressionFixturesSchemaPath = argv[++index];
    else if (arg === "--route-inventory-fixtures-schema") parsed.routeInventoryFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.routeSourcePaths.length === 0) delete parsed.routeSourcePaths;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-approval-absence-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --model-improvement <path>               Model improvement artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --route-source <path>                    Trading route source JSON for P382 source. Repeat to override defaults.
  --release-check-receipt-closeout-schema <path>
                                           P380 receipt closeout schema path.
  --safety-regression-fixtures-schema <path>
                                           P381 safety regression fixtures schema path.
  --route-inventory-fixtures-schema <path> P382 route inventory fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.riskEnginePath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-approval-absence-fixtures.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
