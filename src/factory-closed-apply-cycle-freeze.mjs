import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryApplyEngineClosed } from "./factory-apply-engine-closed.mjs";
import { buildFactoryReceiptChainAudit } from "./factory-receipt-chain-audit.mjs";

export const DEFAULT_FACTORY_CLOSED_APPLY_CYCLE_FREEZE_OUT_DIR = "artifacts/factory-closed-apply-cycle-freeze/latest";
export const DEFAULT_FACTORY_CLOSED_APPLY_CYCLE_FREEZE_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:closed-apply-cycle-freeze";
const SCHEMA_VERSION = "factory-closed-apply-cycle-freeze.v1";
const CAPABILITY_ID = "factory.closed_apply_cycle_freeze";
const PROGRAM_RANGE = "FCORE-FD.5";
const SOURCE_PROGRAM_RANGE = "FCORE-FD.2-FD.4";
const READY_STATUS = "ready_factory_closed_apply_cycle_freeze";
const BLOCKED_STATUS = "blocked_factory_closed_apply_cycle_freeze";
const HASH_RE = /^[a-f0-9]{64}$/;

const AUTHORITY_FALSE_FLAGS = [
  "project_creation_allowed_now",
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "apply_engine_runtime_enabled_now",
  "rollback_executor_runtime_enabled_now",
  "source_file_write_allowed_now",
  "ledger_append_allowed_now",
  "persistent_ledger_append_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
];

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

const CLOSED_RUNTIME_SIGNALS = {
  receipt_apply_engine_reachable_now: false,
  receipt_apply_engine_opened_now: false,
  apply_engine_runtime_enabled_now: false,
  rollback_executor_reachable_now: false,
  rollback_executor_runtime_enabled_now: false,
  runtime_state_mutated_now: false,
  apply_cycle_runtime_enabled_now: false,
};

export async function runFactoryClosedApplyCycleFreeze(options = {}) {
  const result = await buildFactoryClosedApplyCycleFreeze(options);
  if (!options.check && options.write !== false) await writeFactoryClosedApplyCycleFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Closed Apply Cycle Freeze failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_closed_apply_cycle_freeze_status !== READY_STATUS) {
    const error = new Error("Factory Closed Apply Cycle Freeze is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryClosedApplyCycleFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_CLOSED_APPLY_CYCLE_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const sourceReceiptChainAuditOutDir = path.join(outputDir, "source-receipt-chain-audit");
  const hasExplicitApplyEngineClosed = Object.prototype.hasOwnProperty.call(options, "applyEngineClosed");
  const applyEngineClosed = hasExplicitApplyEngineClosed ? options.applyEngineClosed : null;
  const receiptChainAuditOptions = {
    ...options,
    outDir: sourceReceiptChainAuditOutDir,
    runAt: generatedAt,
    write: false,
    commitRef,
  };
  if (hasExplicitApplyEngineClosed) receiptChainAuditOptions.applyEngineClosed = applyEngineClosed;
  const receiptChainAudit = Object.prototype.hasOwnProperty.call(options, "receiptChainAudit")
    ? options.receiptChainAudit
    : await buildFactoryReceiptChainAudit(receiptChainAuditOptions);
  const applyEngineClosedForSummary = hasExplicitApplyEngineClosed
    ? applyEngineClosed
    : await buildFactoryApplyEngineClosed({
      ...options,
      outDir: path.join(outputDir, "source-apply-engine-closed-summary"),
      runAt: generatedAt,
      write: false,
      commitRef,
    });
  const runtimeSignals = buildClosedRuntimeSignals();
  const cycleRows = buildClosedApplyCycleRows({
    applyEngineClosed,
    receiptChainAudit,
    runtimeSignals,
    generatedAt,
  });
  const negativeFixtureRows = buildNegativeFixtureRows({
    applyEngineClosed,
    receiptChainAudit,
    generatedAt,
  });
  const boundary = buildBoundary({
    applyEngineClosedForSummary,
    receiptChainAudit,
    cycleRows,
    negativeFixtureRows,
    runtimeSignals,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    applyEngineClosedForSummary,
    receiptChainAudit,
    cycleRows,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ cycleRows, negativeFixtureRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      package_path: packageJson.path,
      structured_summary_path: structuredSummary.path,
    },
    source_summaries: {
      fd2_apply_engine_closed: applyEngineClosedForSummary?.summary ?? receiptChainAudit.source_summaries?.fd2_apply_engine_closed ?? null,
      fd4_receipt_chain_audit: receiptChainAudit.summary ?? null,
      structured_summary_fd5_command: structuredSummary.data?.fd5_command ?? null,
    },
    factory_closed_apply_cycle_rows: cycleRows,
    factory_closed_apply_cycle_negative_fixture_rows: negativeFixtureRows,
    factory_closed_apply_cycle_freeze_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryClosedApplyCycleFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-closed-apply-cycle-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "closed-apply-cycle-rows.json"), collectionEnvelope("factory-closed-apply-cycle-rows.v1", "factory_closed_apply_cycle_rows", result.factory_closed_apply_cycle_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-closed-apply-cycle-negative-fixture-rows.v1", "factory_closed_apply_cycle_negative_fixture_rows", result.factory_closed_apply_cycle_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_closed_apply_cycle_freeze_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-closed-apply-cycle-freeze-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryClosedApplyCycleFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryClosedApplyCycleFreeze(args);
    console.log(`Factory Closed Apply Cycle Freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_closed_apply_cycle_freeze_status}`);
    console.log(`Closed apply cycles ready: ${result.summary.closed_apply_cycle_ready_count}/${result.summary.closed_apply_cycle_count}`);
    console.log(`Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Apply cycle runtime enabled: ${result.summary.apply_cycle_runtime_enabled_now}`);
    console.log(`Runtime state mutated: ${result.summary.runtime_state_mutated_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildClosedApplyCycleRows({ applyEngineClosed, receiptChainAudit, runtimeSignals, generatedAt }) {
  const applyIntentRows = applyEngineClosed?.factory_apply_intent_rows ?? [];
  const rollbackRows = applyEngineClosed?.factory_rollback_verification_rows ?? [];
  const chainRows = receiptChainAudit.factory_fd2_apply_rollback_chain_rows ?? [];
  const receiptChainReady = receiptChainAudit.summary?.factory_receipt_chain_audit_status === "ready_factory_receipt_chain_audit"
    && receiptChainAudit.validation?.valid === true;

  if (applyIntentRows.length === 0) {
    return chainRows.map((chain, index) => {
      const checks = {
        receipt_chain_audit_ready: receiptChainReady,
        fd2_chain_row_ready: chain.chain_row_status === "ready",
        receipt_bound_to_chain: Boolean(chain.receipt_id)
          && HASH_RE.test(chain.receipt_entry_hash ?? "")
          && HASH_RE.test(chain.candidate_packet_sha256 ?? ""),
        apply_intent_blocked_closed_engine: chain.apply_blocked_closed_engine === true,
        rollback_bound_to_apply_intent: Boolean(chain.rollback_verification_id)
          && Boolean(chain.rollback_plan_id)
          && HASH_RE.test(chain.rollback_plan_sha256 ?? ""),
        rollback_blocked_closed_executor: chain.rollback_blocked_closed_executor === true,
        post_apply_verification_blocked_no_mutation: runtimeSignals.runtime_state_mutated_now === false,
        authority_closed: chain.authority_closed === true,
      };
      const row = {
        schema_version: "factory-closed-apply-cycle-row.v1",
        closed_apply_cycle_id: `factory-closed-apply-cycle.${String(index + 1).padStart(4, "0")}`,
        product_id: chain.product_id ?? null,
        candidate_packet_id: chain.candidate_packet_id ?? null,
        candidate_packet_sha256: chain.candidate_packet_sha256 ?? null,
        receipt_id: chain.receipt_id ?? null,
        receipt_entry_hash: chain.receipt_entry_hash ?? null,
        apply_intent_id: chain.apply_intent_id ?? null,
        apply_intent_status: chain.apply_blocked_closed_engine === true ? "blocked_apply_engine_unreachable" : "blocked_or_open_apply_chain_not_frozen",
        apply_engine_invoked_now: false,
        apply_chain_row_id: chain.chain_row_id ?? null,
        apply_chain_row_sha256: chain.chain_row_sha256 ?? null,
        apply_chain_row_status: chain.chain_row_status ?? null,
        rollback_verification_id: chain.rollback_verification_id ?? null,
        rollback_verification_status: chain.rollback_blocked_closed_executor === true
          ? "blocked_rollback_executor_unreachable_no_state_mutation"
          : "blocked_or_open_rollback_chain_not_frozen",
        rollback_plan_id: chain.rollback_plan_id ?? null,
        rollback_plan_sha256: chain.rollback_plan_sha256 ?? null,
        rollback_executor_invoked_now: false,
        rollback_executed_now: false,
        post_apply_verification_requested_now: true,
        post_apply_verification_result: runtimeSignals.runtime_state_mutated_now === false
          ? "blocked_no_state_mutation_to_verify"
          : "blocked_state_mutation_detected_in_closed_freeze",
        source_runtime_state_mutated_now: runtimeSignals.runtime_state_mutated_now === true,
        closed_apply_cycle_status: Object.values(checks).every(Boolean)
          ? "ready_closed_apply_cycle_frozen"
          : "blocked_closed_apply_cycle",
        blocked_checks: blockedChecks(checks),
        checks,
        generated_at: generatedAt,
        ...runtimeSignals,
        ...AUTHORITY_CLOSED,
      };
      return { ...row, closed_apply_cycle_row_sha256: sha256(canonicalize(row)) };
    });
  }

  return applyIntentRows.map((intent, index) => {
    const rollback = rollbackRows.find((row) => row.apply_intent_id === intent.apply_intent_id);
    const chain = chainRows.find((row) => row.apply_intent_id === intent.apply_intent_id);
    const checks = {
      receipt_chain_audit_ready: receiptChainReady,
      fd2_chain_row_ready: chain?.chain_row_status === "ready",
      receipt_bound_to_chain: Boolean(chain)
        && chain.receipt_id === intent.receipt_id
        && chain.receipt_entry_hash === intent.receipt_entry_hash
        && chain.candidate_packet_sha256 === intent.candidate_packet_sha256,
      apply_intent_blocked_closed_engine: intent.apply_intent_status === "blocked_apply_engine_unreachable"
        && intent.apply_engine_invoked_now === false
        && intent.apply_allowed_now === false
        && intent.apply_engine_runtime_enabled_now === false,
      rollback_bound_to_apply_intent: Boolean(rollback)
        && rollback.apply_intent_id === intent.apply_intent_id
        && rollback.rollback_plan_sha256 === intent.rollback_plan_sha256
        && HASH_RE.test(rollback.rollback_plan_sha256 ?? ""),
      rollback_blocked_closed_executor: rollback?.rollback_verification_status === "blocked_rollback_executor_unreachable_no_state_mutation"
        && rollback.rollback_executor_invoked_now === false
        && rollback.rollback_executed_now === false
        && rollback.rollback_executor_runtime_enabled_now === false,
      post_apply_verification_blocked_no_mutation: runtimeSignals.runtime_state_mutated_now === false
        && intent.apply_engine_invoked_now === false
        && rollback?.rollback_executed_now === false,
      authority_closed: allAuthorityClosed(intent) && allAuthorityClosed(rollback ?? {}) && chain?.authority_closed === true,
    };
    const row = {
      schema_version: "factory-closed-apply-cycle-row.v1",
      closed_apply_cycle_id: `factory-closed-apply-cycle.${String(index + 1).padStart(4, "0")}`,
      product_id: intent.product_id ?? null,
      candidate_packet_id: intent.candidate_packet_id ?? null,
      candidate_packet_sha256: intent.candidate_packet_sha256 ?? null,
      receipt_id: intent.receipt_id ?? null,
      receipt_entry_hash: intent.receipt_entry_hash ?? null,
      apply_intent_id: intent.apply_intent_id ?? null,
      apply_intent_status: intent.apply_intent_status ?? null,
      apply_engine_invoked_now: intent.apply_engine_invoked_now === true,
      apply_chain_row_id: chain?.chain_row_id ?? null,
      apply_chain_row_sha256: chain?.chain_row_sha256 ?? null,
      apply_chain_row_status: chain?.chain_row_status ?? null,
      rollback_verification_id: rollback?.rollback_verification_id ?? null,
      rollback_verification_status: rollback?.rollback_verification_status ?? null,
      rollback_plan_id: rollback?.rollback_plan_id ?? intent.rollback_plan_id ?? null,
      rollback_plan_sha256: rollback?.rollback_plan_sha256 ?? intent.rollback_plan_sha256 ?? null,
      rollback_executor_invoked_now: rollback?.rollback_executor_invoked_now === true,
      rollback_executed_now: rollback?.rollback_executed_now === true,
      post_apply_verification_requested_now: true,
      post_apply_verification_result: runtimeSignals.runtime_state_mutated_now === false
        ? "blocked_no_state_mutation_to_verify"
        : "blocked_state_mutation_detected_in_closed_freeze",
      source_runtime_state_mutated_now: runtimeSignals.runtime_state_mutated_now === true,
      closed_apply_cycle_status: Object.values(checks).every(Boolean)
        ? "ready_closed_apply_cycle_frozen"
        : "blocked_closed_apply_cycle",
      blocked_checks: blockedChecks(checks),
      checks,
      generated_at: generatedAt,
      ...runtimeSignals,
      ...AUTHORITY_CLOSED,
    };
    return { ...row, closed_apply_cycle_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildNegativeFixtureRows({ applyEngineClosed, receiptChainAudit, generatedAt }) {
  const fixtures = [
    evaluateNegativeFixture("receipt_chain_audit_not_ready", evaluateReceiptChainAuditNotReady({
      applyEngineClosed,
      receiptChainAudit,
      generatedAt,
    }), generatedAt),
    evaluateNegativeFixture("apply_engine_opened_attempt", evaluateApplyEngineOpenedAttempt({
      applyEngineClosed,
      receiptChainAudit,
      generatedAt,
    }), generatedAt),
    evaluateNegativeFixture("rollback_executor_opened_attempt", evaluateRollbackExecutorOpenedAttempt({
      applyEngineClosed,
      receiptChainAudit,
      generatedAt,
    }), generatedAt),
    evaluateNegativeFixture("post_apply_state_mutation_observed", evaluatePostApplyStateMutationObserved({
      applyEngineClosed,
      receiptChainAudit,
      generatedAt,
    }), generatedAt),
    evaluateNegativeFixture("receipt_chain_negative_fixture_drop", evaluateReceiptChainNegativeFixtureDrop({
      receiptChainAudit,
    }), generatedAt),
  ];
  return fixtures;
}

function evaluateNegativeFixture(fixtureKey, evaluation, generatedAt) {
  const passed = evaluation.actual_result === "cycle_blocked";
  const row = {
    schema_version: "factory-closed-apply-cycle-negative-fixture-row.v1",
    fixture_id: `factory-closed-apply-cycle-negative-fixture.${fixtureKey}`,
    fixture_key: fixtureKey,
    expected_result: "cycle_blocked",
    actual_result: evaluation.actual_result,
    fixture_status: passed ? "passed" : "failed",
    attempted_action: evaluation.attempted_action,
    observed_blocked_cycle_count: evaluation.observed_blocked_cycle_count ?? 0,
    observed_blocked_checks: evaluation.observed_blocked_checks ?? [],
    checks: evaluation.checks ?? {},
    generated_at: generatedAt,
    ...AUTHORITY_CLOSED,
  };
  return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
}

function evaluateReceiptChainAuditNotReady({ applyEngineClosed, receiptChainAudit, generatedAt }) {
  const mutatedAudit = deepClone(receiptChainAudit);
  mutatedAudit.validation = { valid: false, error_count: 1, errors: [{ item_id: "synthetic.fd4.blocked", message: "synthetic blocked FD.4" }] };
  mutatedAudit.summary = {
    ...(mutatedAudit.summary ?? {}),
    factory_receipt_chain_audit_status: "blocked_factory_receipt_chain_audit",
    validation_errors: 1,
  };
  const rows = buildClosedApplyCycleRows({
    applyEngineClosed,
    receiptChainAudit: mutatedAudit,
    runtimeSignals: buildClosedRuntimeSignals(),
    generatedAt,
  });
  return cycleEvaluation("closed_apply_cycle_with_blocked_fd4_chain_audit", rows);
}

function evaluateApplyEngineOpenedAttempt({ applyEngineClosed, receiptChainAudit, generatedAt }) {
  const mutatedApply = applyEngineClosed
    ? deepClone(applyEngineClosed)
    : buildSyntheticApplyEngineClosedFromChainRows(receiptChainAudit, "apply_opened");
  const mutatedAudit = receiptChainAudit;
  if (mutatedApply?.factory_apply_intent_rows?.[0]) {
    mutatedApply.factory_apply_intent_rows = mutatedApply.factory_apply_intent_rows.map((row) => ({
      ...row,
      apply_intent_status: "ready_apply_engine_opened",
      apply_engine_invoked_now: true,
      apply_allowed_now: true,
      apply_engine_runtime_enabled_now: true,
    }));
  }
  const rows = buildClosedApplyCycleRows({
    applyEngineClosed: mutatedApply,
    receiptChainAudit: mutatedAudit,
    runtimeSignals: buildClosedRuntimeSignals(),
    generatedAt,
  });
  return cycleEvaluation("closed_apply_cycle_with_open_apply_engine", rows);
}

function evaluateRollbackExecutorOpenedAttempt({ applyEngineClosed, receiptChainAudit, generatedAt }) {
  const mutatedApply = applyEngineClosed
    ? deepClone(applyEngineClosed)
    : buildSyntheticApplyEngineClosedFromChainRows(receiptChainAudit, "rollback_opened");
  const mutatedAudit = receiptChainAudit;
  if (mutatedApply?.factory_rollback_verification_rows?.[0]) {
    mutatedApply.factory_rollback_verification_rows = mutatedApply.factory_rollback_verification_rows.map((row) => ({
      ...row,
      rollback_verification_status: "ready_rollback_executor_opened",
      rollback_executor_invoked_now: true,
      rollback_executed_now: true,
      rollback_executor_runtime_enabled_now: true,
    }));
  }
  const rows = buildClosedApplyCycleRows({
    applyEngineClosed: mutatedApply,
    receiptChainAudit: mutatedAudit,
    runtimeSignals: buildClosedRuntimeSignals(),
    generatedAt,
  });
  return cycleEvaluation("closed_apply_cycle_with_open_rollback_executor", rows);
}

function evaluatePostApplyStateMutationObserved({ applyEngineClosed, receiptChainAudit, generatedAt }) {
  const rows = buildClosedApplyCycleRows({
    applyEngineClosed,
    receiptChainAudit,
    runtimeSignals: {
      ...buildClosedRuntimeSignals(),
      runtime_state_mutated_now: true,
    },
    generatedAt,
  });
  return cycleEvaluation("closed_apply_cycle_with_post_apply_state_mutation", rows);
}

function evaluateReceiptChainNegativeFixtureDrop({ receiptChainAudit }) {
  const summary = {
    ...(receiptChainAudit.summary ?? {}),
    negative_fixture_blocked_count: Math.max(0, (receiptChainAudit.summary?.negative_fixture_blocked_count ?? 0) - 1),
  };
  const checks = {
    receipt_chain_negative_fixture_count_intact: summary.negative_fixture_count === 4,
    receipt_chain_negative_fixtures_all_blocked: summary.negative_fixture_blocked_count === 4,
  };
  return {
    attempted_action: "closed_apply_cycle_with_missing_receipt_chain_negative_fixture",
    observed_blocked_cycle_count: Object.values(checks).every(Boolean) ? 0 : 1,
    observed_blocked_checks: blockedChecks(checks),
    checks,
    actual_result: Object.values(checks).every(Boolean) ? "unexpected_ready" : "cycle_blocked",
  };
}

function cycleEvaluation(attemptedAction, rows) {
  const blockedRows = rows.filter((row) => row.closed_apply_cycle_status === "blocked_closed_apply_cycle");
  return {
    attempted_action: attemptedAction,
    observed_blocked_cycle_count: blockedRows.length,
    observed_blocked_checks: [...new Set(blockedRows.flatMap((row) => row.blocked_checks ?? []))],
    checks: {
      at_least_one_cycle_blocked: blockedRows.length > 0,
      no_cycle_runtime_authority_opened: rows.every((row) => boundaryFlagsClosed(row)),
    },
    actual_result: blockedRows.length > 0 ? "cycle_blocked" : "unexpected_ready",
  };
}

function buildBoundary({ applyEngineClosedForSummary, receiptChainAudit, cycleRows, negativeFixtureRows, runtimeSignals, generatedAt }) {
  const fd2Summary = applyEngineClosedForSummary?.summary ?? receiptChainAudit.source_summaries?.fd2_apply_engine_closed ?? {};
  return {
    schema_version: "factory-closed-apply-cycle-freeze-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    source_program_range: SOURCE_PROGRAM_RANGE,
    fd2_apply_engine_closed_ready_now: fd2Summary.factory_apply_engine_closed_status === "ready_factory_apply_engine_closed"
      && (applyEngineClosedForSummary?.validation?.valid === true || fd2Summary.validation_errors === 0),
    fd4_receipt_chain_audit_ready_now: receiptChainAudit.summary?.factory_receipt_chain_audit_status === "ready_factory_receipt_chain_audit"
      && receiptChainAudit.validation?.valid === true,
    closed_apply_cycle_count: cycleRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    closed_apply_cycles_ready: cycleRows.every((row) => row.closed_apply_cycle_status === "ready_closed_apply_cycle_frozen"),
    negative_fixtures_blocked: negativeFixtureRows.every((row) => row.fixture_status === "passed" && row.actual_result === "cycle_blocked"),
    ...runtimeSignals,
    ...AUTHORITY_CLOSED,
  };
}

function buildValidationItems({ packageJson, structuredSummary, applyEngineClosedForSummary, receiptChainAudit, cycleRows, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const fd2Summary = applyEngineClosedForSummary?.summary ?? receiptChainAudit.source_summaries?.fd2_apply_engine_closed ?? {};
  return [
    validationItem("package.script", "package", scripts[COMMAND_NAME] === "node scripts/factory-closed-apply-cycle-freeze.mjs", `${COMMAND_NAME} package script missing`, packageJson.path),
    validationItem("summary.fd5_command", "structured_summary", structuredSummary.data?.fd5_command === "npm run factory:closed-apply-cycle-freeze -- --check --require-pass", "Structured summary does not expose FD.5 command", structuredSummary.path),
    validationItem("source.fd2.ready", "source", fd2Summary.factory_apply_engine_closed_status === "ready_factory_apply_engine_closed" && (applyEngineClosedForSummary?.validation?.valid === true || fd2Summary.validation_errors === 0), "FD.2 apply engine closed verifier is not ready", "factory_apply_engine_closed"),
    validationItem("source.fd4.ready", "source", receiptChainAudit.summary?.factory_receipt_chain_audit_status === "ready_factory_receipt_chain_audit" && receiptChainAudit.validation?.valid === true, "FD.4 receipt chain audit is not ready", "factory_receipt_chain_audit"),
    validationItem("cycle.rows.count", "closed_apply_cycle", cycleRows.length === 3, "FD.5 must build 3 closed apply cycle rows", "factory_closed_apply_cycle_rows"),
    validationItem("cycle.rows.ready", "closed_apply_cycle", cycleRows.every((row) => row.closed_apply_cycle_status === "ready_closed_apply_cycle_frozen"), "Closed apply cycle rows must be frozen and ready", "factory_closed_apply_cycle_rows"),
    validationItem("cycle.rows.authority_closed", "authority", cycleRows.every((row) => boundaryFlagsClosed(row) && row.checks?.authority_closed === true), "Closed apply cycle rows opened apply/write/deploy/protected/production authority", "factory_closed_apply_cycle_rows"),
    validationItem("negative.fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 5 && negativeFixtureRows.every((row) => row.fixture_status === "passed" && row.actual_result === "cycle_blocked"), "Closed apply cycle negative fixtures did not block", "factory_closed_apply_cycle_negative_fixture_rows"),
    validationItem("boundary.closed", "authority", boundaryFlagsClosed(boundary), "FD.5 boundary opened apply/write/deploy/protected/production authority", "factory_closed_apply_cycle_freeze_boundary"),
  ];
}

function buildSummary({ cycleRows, negativeFixtureRows, boundary, validation }) {
  const cycleReadyCount = cycleRows.filter((row) => row.closed_apply_cycle_status === "ready_closed_apply_cycle_frozen").length;
  const negativeBlockedCount = negativeFixtureRows.filter((row) => row.fixture_status === "passed" && row.actual_result === "cycle_blocked").length;
  const ready = validation.valid
    && cycleRows.length === 3
    && cycleReadyCount === cycleRows.length
    && negativeFixtureRows.length === 5
    && negativeBlockedCount === negativeFixtureRows.length
    && boundaryFlagsClosed(boundary);
  return {
    factory_closed_apply_cycle_freeze_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    closed_apply_cycle_count: cycleRows.length,
    closed_apply_cycle_ready_count: cycleReadyCount,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeBlockedCount,
    receipt_chain_audit_not_ready_rejected: negativeFixtureRows.some((row) => row.fixture_key === "receipt_chain_audit_not_ready" && row.fixture_status === "passed"),
    apply_engine_opened_attempt_rejected: negativeFixtureRows.some((row) => row.fixture_key === "apply_engine_opened_attempt" && row.fixture_status === "passed"),
    rollback_executor_opened_attempt_rejected: negativeFixtureRows.some((row) => row.fixture_key === "rollback_executor_opened_attempt" && row.fixture_status === "passed"),
    post_apply_state_mutation_observed_rejected: negativeFixtureRows.some((row) => row.fixture_key === "post_apply_state_mutation_observed" && row.fixture_status === "passed"),
    receipt_chain_negative_fixture_drop_rejected: negativeFixtureRows.some((row) => row.fixture_key === "receipt_chain_negative_fixture_drop" && row.fixture_status === "passed"),
    receipt_apply_engine_reachable_now: false,
    receipt_apply_engine_opened_now: false,
    apply_cycle_runtime_enabled_now: false,
    apply_engine_runtime_enabled_now: false,
    rollback_executor_runtime_enabled_now: false,
    runtime_state_mutated_now: false,
    ...AUTHORITY_CLOSED,
    validation_errors: validation.errors.length,
  };
}

function boundaryFlagsClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => value?.[flag] === false)
    && value?.receipt_apply_engine_reachable_now === false
    && value?.receipt_apply_engine_opened_now === false
    && value?.apply_cycle_runtime_enabled_now === false
    && value?.apply_engine_runtime_enabled_now === false
    && value?.rollback_executor_reachable_now === false
    && value?.rollback_executor_runtime_enabled_now === false
    && value?.runtime_state_mutated_now === false;
}

function buildClosedRuntimeSignals() {
  return { ...CLOSED_RUNTIME_SIGNALS };
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => value?.[flag] === false);
}

function buildSyntheticApplyEngineClosedFromChainRows(receiptChainAudit, mode) {
  const rows = receiptChainAudit?.factory_fd2_apply_rollback_chain_rows ?? [];
  return {
    schema_version: "factory-apply-engine-closed.synthetic-negative-fixture.v1",
    factory_apply_intent_rows: rows.map((chain) => {
      const applyOpened = mode === "apply_opened";
      return {
        schema_version: "factory-apply-intent-row.synthetic-negative-fixture.v1",
        apply_intent_id: chain.apply_intent_id ?? null,
        receipt_id: chain.receipt_id ?? null,
        product_id: chain.product_id ?? null,
        candidate_packet_id: chain.candidate_packet_id ?? null,
        candidate_packet_sha256: chain.candidate_packet_sha256 ?? null,
        receipt_entry_hash: chain.receipt_entry_hash ?? null,
        rollback_plan_id: chain.rollback_plan_id ?? null,
        rollback_plan_sha256: chain.rollback_plan_sha256 ?? null,
        ...AUTHORITY_CLOSED,
        apply_intent_status: applyOpened ? "ready_apply_engine_opened" : "blocked_apply_engine_unreachable",
        apply_engine_invoked_now: applyOpened,
        apply_allowed_now: applyOpened,
        apply_engine_runtime_enabled_now: applyOpened,
      };
    }),
    factory_rollback_verification_rows: rows.map((chain) => {
      const rollbackOpened = mode === "rollback_opened";
      return {
        schema_version: "factory-rollback-verification-row.synthetic-negative-fixture.v1",
        rollback_verification_id: chain.rollback_verification_id ?? null,
        apply_intent_id: chain.apply_intent_id ?? null,
        product_id: chain.product_id ?? null,
        candidate_packet_id: chain.candidate_packet_id ?? null,
        candidate_packet_sha256: chain.candidate_packet_sha256 ?? null,
        rollback_plan_id: chain.rollback_plan_id ?? null,
        rollback_plan_sha256: chain.rollback_plan_sha256 ?? null,
        ...AUTHORITY_CLOSED,
        rollback_verification_status: rollbackOpened
          ? "ready_rollback_executor_opened"
          : "blocked_rollback_executor_unreachable_no_state_mutation",
        rollback_executor_invoked_now: rollbackOpened,
        rollback_executed_now: rollbackOpened,
        rollback_executor_runtime_enabled_now: rollbackOpened,
      };
    }),
  };
}

function blockedChecks(checks) {
  return Object.entries(checks ?? {})
    .filter(([, passed]) => passed === false)
    .map(([check]) => check);
}

function validationItem(itemId, category, passed, message, evidenceRef) {
  return {
    schema_version: "factory-closed-apply-cycle-freeze-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
    evidence_ref: item.evidence_ref,
  }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_CLOSED_APPLY_CYCLE_FREEZE_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return {
      path: filePath,
      available: true,
      data: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
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

function renderMarkdown(result) {
  return [
    "# Factory Closed Apply Cycle Freeze",
    "",
    `Status: ${result.summary.factory_closed_apply_cycle_freeze_status}`,
    `Program: ${result.program_range}`,
    `Closed apply cycles ready: ${result.summary.closed_apply_cycle_ready_count}/${result.summary.closed_apply_cycle_count}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Apply cycle runtime enabled: ${result.summary.apply_cycle_runtime_enabled_now}`,
    `Runtime state mutated: ${result.summary.runtime_state_mutated_now}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-closed-apply-cycle-freeze.mjs [--check] [--require-pass] [--out-dir DIR] [--run-at ISO] [--commit-ref SHA]

Builds the FD.5 closed apply cycle freeze without opening apply, rollback, write, deploy, or protected authority.`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function serializableResult(result) {
  const { markdown, ...json } = result;
  return json;
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
