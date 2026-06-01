import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  runTradingDashboardStub,
  runTradingGoldenFixtures,
  runTradingSafetyCheck,
  runTradingValidate,
} from "../src/trading-pack.mjs";
import { runTradingBacktestReport } from "../src/trading-backtest-validation.mjs";
import { runTradingExecutionReport } from "../src/trading-execution-engine.mjs";
import { runTradingFullAutoReport } from "../src/trading-full-auto-governance.mjs";
import { runTradingLimitedLiveReport } from "../src/trading-limited-live-governance.mjs";
import { runTradingReleaseCheck } from "../src/trading-release-check.mjs";
import { runTradingSafetyRegressionFixtures } from "../src/trading-safety-regression-fixtures.mjs";
import {
  DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS,
  runTradingRouteInventoryFixtures,
} from "../src/trading-route-inventory-fixtures.mjs";
import { runTradingApprovalAbsenceFixtures } from "../src/trading-approval-absence-fixtures.mjs";
import { runTradingLiveAdapterDisabledFixtures } from "../src/trading-live-adapter-disabled-fixtures.mjs";
import { runTradingCredentialLookupDisabledFixtures } from "../src/trading-credential-lookup-disabled-fixtures.mjs";
import { runTradingBrokerWriteDisabledFixtures } from "../src/trading-broker-write-disabled-fixtures.mjs";
import { runTradingExchangeWriteDisabledFixtures } from "../src/trading-exchange-write-disabled-fixtures.mjs";
import { runTradingSafetyBoundaryFixtures } from "../src/trading-safety-boundary-fixtures.mjs";
import { runTradingManualResumeDisabledFixtures } from "../src/trading-manual-resume-disabled-fixtures.mjs";
import { runTradingRiskOverrideDisabledFixtures } from "../src/trading-risk-override-disabled-fixtures.mjs";
import { runTradingPromotionDisabledFixtures } from "../src/trading-promotion-disabled-fixtures.mjs";
import { runTradingFirstTradeDisabledFixtures } from "../src/trading-first-trade-disabled-fixtures.mjs";
import { runTradingOrderIntentDisabledFixtures } from "../src/trading-order-intent-disabled-fixtures.mjs";
import { runTradingMarketOrderDisabledFixtures } from "../src/trading-market-order-disabled-fixtures.mjs";
import { runTradingLeverageDisabledFixtures } from "../src/trading-leverage-disabled-fixtures.mjs";
import { runTradingShortSellingDisabledFixtures } from "../src/trading-short-selling-disabled-fixtures.mjs";
import { runTradingOrderFrequencyThrottleFixtures } from "../src/trading-order-frequency-throttle-fixtures.mjs";
import { runTradingLossStreakCooldownFixtures } from "../src/trading-loss-streak-cooldown-fixtures.mjs";
import { runTradingModelDegradationHaltFixtures } from "../src/trading-model-degradation-halt-fixtures.mjs";
import { runTradingDataOutageHaltFixtures } from "../src/trading-data-outage-halt-fixtures.mjs";
import { runTradingPromotionReceiptContractFixtures } from "../src/trading-promotion-receipt-contract-fixtures.mjs";
import { runTradingPromotionCompletionGateFixtures } from "../src/trading-promotion-completion-gate-fixtures.mjs";
import { runTradingPromotionGovernanceReadonlyFixtures } from "../src/trading-promotion-governance-readonly-fixtures.mjs";
import { runTradingPromotionReceiptIntakeQueueFixtures } from "../src/trading-promotion-receipt-intake-queue-fixtures.mjs";
import { runTradingPromotionReceiptValidationRulesFixtures } from "../src/trading-promotion-receipt-validation-rules-fixtures.mjs";
import { runTradingPromotionReceiptWorkspaceFixtures } from "../src/trading-promotion-receipt-workspace-fixtures.mjs";
import { runTradingPromotionReceiptWorkspaceMergeFixtures } from "../src/trading-promotion-receipt-workspace-merge-fixtures.mjs";
import {
  runTradingFeatureReport,
  runTradingMarketDataReport,
} from "../src/trading-market-data-feature-store.mjs";
import {
  runTradingModelEvalReport,
  runTradingModelTrainReport,
} from "../src/trading-model-improvement.mjs";
import {
  runTradingPaperReport,
  runTradingShadowReport,
} from "../src/trading-paper-shadow-live.mjs";
import { runTradingRiskCheck } from "../src/trading-risk-engine.mjs";
import { runTradingSignalReport } from "../src/trading-signal-engine.mjs";
import { runTradingStrategyTaxonomy } from "../src/trading-strategy-taxonomy.mjs";
import { runDomainPackRegistry } from "../src/domain-pack-registry.mjs";

test("trading pack validates research/backtest/paper with live execution blocked", async () => {
  const result = await runTradingValidate({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_validation_status, "complete");
  assert.deepEqual(result.summary.active_stages, ["research", "backtest", "paper"]);
  assert.deepEqual(result.summary.blocked_stages, ["shadow_live", "limited_live", "full_auto"]);
  assert.equal(result.summary.live_trading_enabled, false);
  assert.equal(result.summary.real_broker_adapters_enabled, false);
  assert.equal(result.summary.contract_schema_count, 15);
});

test("trading safety check keeps live trading and real execution disabled", async () => {
  const result = await runTradingSafetyCheck({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.safety_check_status, "complete");
  assert.equal(result.summary.live_trading_enabled, false);
  assert.equal(result.summary.real_execution_enabled, false);
  assert.equal(result.summary.blocked_live_stage_count, 3);
});

test("trading golden fixtures and dashboard stub are deterministic read-only surfaces", async () => {
  const goldenFixtures = await runTradingGoldenFixtures({ write: false, check: true });
  const dashboard = await runTradingDashboardStub({ write: false, check: true });

  assert.equal(goldenFixtures.validation.valid, true);
  assert.equal(goldenFixtures.summary.golden_fixture_status, "complete");
  assert.equal(goldenFixtures.summary.locked_regression_hash_count, goldenFixtures.summary.fixture_count);
  assert.equal(dashboard.validation.valid, true);
  assert.equal(dashboard.summary.read_only, true);
  assert.equal(dashboard.summary.mutating_route_count, 0);
});

test("domain pack registry includes trading pack and capability", async () => {
  const registry = await runDomainPackRegistry({ write: false, check: true });

  assert.ok(registry.packs.some((pack) => pack.pack_id === "trading"));
  assert.ok(registry.capabilities.some((capability) => capability.capability_id === "trading.research_backtest_paper"));
});

test("trading strategy taxonomy covers P036-P060 without live eligibility", async () => {
  const result = await runTradingStrategyTaxonomy({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.strategy_taxonomy_status, "complete");
  assert.equal(result.summary.phase_range, "P036-P060");
  assert.equal(result.summary.complete_phase_count, 25);
  assert.equal(result.summary.archetype_count, 12);
  assert.equal(result.summary.event_model_count, 8);
  assert.equal(result.summary.live_eligible_archetype_count, 0);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.order_intent_generated, false);
});

test("trading market data and feature store covers P061-P090 without live feeds", async () => {
  const marketData = await runTradingMarketDataReport({ write: false, check: true });
  const features = await runTradingFeatureReport({ write: false, check: true });

  assert.equal(marketData.validation.valid, true);
  assert.equal(marketData.summary.market_data_report_status, "complete");
  assert.equal(marketData.summary.phase_range, "P061-P090");
  assert.equal(marketData.summary.complete_phase_count, 30);
  assert.equal(marketData.summary.dataset_count, 3);
  assert.equal(marketData.summary.market_session_count, 3);
  assert.equal(marketData.summary.quality_check_pass_count, 4);
  assert.equal(marketData.summary.live_vendor_feeds_enabled, false);
  assert.equal(marketData.summary.external_api_keys_required, false);

  assert.equal(features.validation.valid, true);
  assert.equal(features.summary.feature_report_status, "complete");
  assert.equal(features.summary.feature_category_count, 10);
  assert.equal(features.summary.feature_snapshot_count, 1);
  assert.equal(features.summary.min_feature_quality_score, 0.96);
  assert.equal(features.summary.order_intent_generated, false);
  assert.equal(features.summary.dashboard_read_only, true);
});

test("trading signal engine covers P091-P125 without order intent", async () => {
  const result = await runTradingSignalReport({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.signal_report_status, "complete");
  assert.equal(result.summary.phase_range, "P091-P125");
  assert.equal(result.summary.complete_phase_count, 35);
  assert.equal(result.summary.adapter_count, 8);
  assert.equal(result.summary.signal_candidate_count, 3);
  assert.equal(result.summary.review_queue_item_count, 3);
  assert.equal(result.summary.generated_order_intent_count, 0);
  assert.equal(result.summary.signal_only, true);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.dashboard_read_only, true);
});

test("trading model improvement covers P126-P165 without live deployment", async () => {
  const train = await runTradingModelTrainReport({ write: false, check: true });
  const evalReport = await runTradingModelEvalReport({ write: false, check: true });

  assert.equal(train.validation.valid, true);
  assert.equal(train.summary.model_report_status, "complete");
  assert.equal(train.summary.report_kind, "train");
  assert.equal(train.summary.phase_range, "P126-P165");
  assert.equal(train.summary.complete_phase_count, 40);
  assert.equal(train.summary.model_count, 5);
  assert.equal(train.summary.dataset_count, 3);
  assert.equal(train.summary.scorecard_count, 5);
  assert.equal(train.summary.promotion_candidate_count, 1);
  assert.equal(train.summary.generated_live_deployment_count, 0);
  assert.equal(train.summary.research_only, true);
  assert.equal(train.summary.external_model_training_allowed, false);
  assert.equal(train.summary.order_intent_generated, false);
  assert.equal(train.summary.live_deployment_allowed, false);
  assert.equal(train.summary.dashboard_read_only, true);

  assert.equal(evalReport.validation.valid, true);
  assert.equal(evalReport.summary.model_report_status, "complete");
  assert.equal(evalReport.summary.report_kind, "eval");
  assert.equal(evalReport.summary.phase_range, "P126-P165");
});

test("trading backtest validation covers P166-P195 without promotion or orders", async () => {
  const result = await runTradingBacktestReport({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.backtest_report_status, "complete");
  assert.equal(result.summary.phase_range, "P166-P195");
  assert.equal(result.summary.complete_phase_count, 30);
  assert.equal(result.summary.backtest_artifact_count, 2);
  assert.equal(result.summary.strategy_binding_count, 2);
  assert.equal(result.summary.model_binding_count, 2);
  assert.equal(result.summary.stress_scenario_count, 3);
  assert.equal(result.summary.deterministic_only, true);
  assert.equal(result.summary.simulation_only, true);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.promotion_candidate_generated, false);
  assert.equal(result.summary.dashboard_read_only, true);
});

test("trading risk engine covers P196-P220 before any order-intent boundary", async () => {
  const result = await runTradingRiskCheck({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.risk_check_status, "complete");
  assert.equal(result.summary.phase_range, "P196-P220");
  assert.equal(result.summary.complete_phase_count, 25);
  assert.equal(result.summary.risk_check_artifact_count, 1);
  assert.equal(result.summary.primary_risk_result, "block");
  assert.equal(result.summary.guard_count, 12);
  assert.equal(result.summary.limit_group_count, 7);
  assert.equal(result.summary.pre_order_gate_only, true);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.override_requires_human_approval, true);
  assert.equal(result.summary.risk_freeze_locked, true);
  assert.equal(result.summary.dashboard_read_only, true);
});

test("trading paper and shadow layer covers P221-P245 without real orders", async () => {
  const paper = await runTradingPaperReport({ write: false, check: true });
  const shadow = await runTradingShadowReport({ write: false, check: true });

  assert.equal(paper.validation.valid, true);
  assert.equal(paper.summary.paper_shadow_report_status, "complete");
  assert.equal(paper.summary.report_kind, "paper");
  assert.equal(paper.summary.phase_range, "P221-P245");
  assert.equal(paper.summary.complete_phase_count, 25);
  assert.equal(paper.summary.paper_order_count, 3);
  assert.equal(paper.summary.partial_paper_order_count, 1);
  assert.equal(paper.summary.rejected_paper_order_count, 1);
  assert.equal(paper.summary.shadow_order_intent_count, 1);
  assert.equal(paper.summary.real_order_count, 0);
  assert.equal(paper.summary.paper_simulation_only, true);
  assert.equal(paper.summary.shadow_read_only, true);
  assert.equal(paper.summary.shadow_order_intent_non_executable, true);
  assert.equal(paper.summary.live_execution_allowed, false);
  assert.equal(paper.summary.broker_adapter_enabled, false);
  assert.equal(paper.summary.exchange_adapter_enabled, false);
  assert.equal(paper.summary.limited_live_enabled, false);
  assert.equal(paper.summary.dashboard_read_only, true);

  assert.equal(shadow.validation.valid, true);
  assert.equal(shadow.summary.paper_shadow_report_status, "complete");
  assert.equal(shadow.summary.report_kind, "shadow");
  assert.equal(shadow.summary.phase_range, "P221-P245");
  assert.equal(shadow.summary.real_order_count, 0);
});

test("trading execution engine covers P246-P280 without live execution", async () => {
  const result = await runTradingExecutionReport({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.execution_report_status, "complete");
  assert.equal(result.summary.phase_range, "P246-P280");
  assert.equal(result.summary.complete_phase_count, 35);
  assert.equal(result.summary.execution_artifact_count, 3);
  assert.equal(result.summary.simulated_execution_count, 2);
  assert.equal(result.summary.blocked_execution_count, 1);
  assert.equal(result.summary.allowed_order_type_count, 2);
  assert.equal(result.summary.regression_case_count, 10);
  assert.equal(result.summary.interface_only, true);
  assert.equal(result.summary.simulation_only, true);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.market_order_allowed, false);
  assert.equal(result.summary.secret_logged, false);
  assert.equal(result.summary.manual_resume_required, true);
  assert.equal(result.summary.dashboard_read_only, true);
});

test("trading limited live governance covers P281-P310 without enabling live orders", async () => {
  const result = await runTradingLimitedLiveReport({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.limited_live_report_status, "complete");
  assert.equal(result.summary.phase_range, "P281-P310");
  assert.equal(result.summary.complete_phase_count, 30);
  assert.equal(result.summary.approval_required, true);
  assert.equal(result.summary.approval_receipt_present, false);
  assert.equal(result.summary.capital_cap_amount, 1000);
  assert.equal(result.summary.asset_whitelist_count, 3);
  assert.equal(result.summary.strategy_whitelist_count, 1);
  assert.equal(result.summary.model_whitelist_count, 1);
  assert.equal(result.summary.daily_order_count_cap, 0);
  assert.equal(result.summary.halt_gate_count, 4);
  assert.equal(result.summary.first_trade_manual_confirmation_required, true);
  assert.equal(result.summary.first_trade_confirmation_present, false);
  assert.equal(result.summary.auto_cancel_stale_orders_enabled, true);
  assert.equal(result.summary.live_cancel_allowed, false);
  assert.equal(result.summary.post_trade_reconciliation_status, "not_applicable");
  assert.equal(result.summary.incident_notification_configured, true);
  assert.equal(result.summary.external_notification_sent, false);
  assert.equal(result.summary.rollback_to_paper_mode, true);
  assert.equal(result.summary.regression_case_count, 10);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.full_auto_promotion_allowed, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.dashboard_read_only, true);
});

test("trading full auto governance covers P311-P340 without automatic orders", async () => {
  const result = await runTradingFullAutoReport({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.full_auto_report_status, "complete");
  assert.equal(result.summary.phase_range, "P311-P340");
  assert.equal(result.summary.complete_phase_count, 30);
  assert.equal(result.summary.approval_required, true);
  assert.equal(result.summary.approval_receipt_present, false);
  assert.equal(result.summary.strategy_health_count, 1);
  assert.equal(result.summary.model_health_count, 1);
  assert.equal(result.summary.allocator_count, 5);
  assert.equal(result.summary.failover_policy_count, 2);
  assert.equal(result.summary.final_regression_case_count, 12);
  assert.equal(result.summary.v1_freeze_checklist_count, 10);
  assert.equal(result.summary.v1_freeze_status, "complete");
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.live_enablement_allowed, false);
  assert.equal(result.summary.dashboard_read_only, true);
});

test("trading release check composes P361 child checks without enabling trading mutation", async () => {
  const calls = [];
  const result = await runTradingReleaseCheck({
    write: false,
    check: true,
    runner: async (spec) => {
      calls.push(spec.package_script_name);
      return {
        exitCode: 0,
        stdout: `${spec.package_script_name} ok\n`,
        stderr: "",
        durationMs: 1,
      };
    },
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_release_check_status, "complete");
  assert.equal(result.summary.phase_slot, "P361");
  assert.equal(result.summary.previous_phase_slot, "P360");
  assert.equal(result.summary.next_phase_slot, "P362");
  assert.equal(result.summary.command_count, 20);
  assert.equal(result.summary.passed_command_count, 20);
  assert.equal(result.summary.contract_release_command_count, 3);
  assert.equal(result.summary.trading_command_count, 17);
  assert.equal(result.summary.command_execution_performed, true);
  assert.equal(result.summary.release_check_execution_performed, true);
  assert.equal(result.summary.check_mode_command_count, 20);
  assert.equal(result.summary.child_artifact_write_allowed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(calls.length, 20);
  assert.deepEqual(calls.slice(0, 3), ["contracts:golden-fixtures", "contracts:validate", "release:freeze"]);
  assert.ok(result.release_check_command_rows.every((row) => row.executed_by_release_check && row.check_mode_used && row.release_check_command_status === "passed"));
  assert.ok(result.release_check_gate_rows.every((row) => row.gate_status === "ready"));
});

test("trading release check blocks when a child check fails", async () => {
  const result = await runTradingReleaseCheck({
    write: false,
    runner: async (spec) => ({
      exitCode: spec.package_script_name === "trading:risk-check" ? 1 : 0,
      stdout: "",
      stderr: spec.package_script_name === "trading:risk-check" ? "risk failed\n" : "",
      durationMs: 1,
    }),
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.trading_release_check_status, "blocked");
  assert.equal(result.summary.failed_command_count, 1);
  assert.ok(result.release_check_command_rows.some((row) => row.package_script_name === "trading:risk-check" && row.release_check_command_status === "failed"));
  await assert.rejects(
    () => runTradingReleaseCheck({
      write: false,
      check: true,
      runner: async (spec) => ({
        exitCode: spec.package_script_name === "trading:risk-check" ? 1 : 0,
        stdout: "",
        stderr: "",
        durationMs: 1,
      }),
    }),
    /Trading release check failed/,
  );
});

test("trading release check blocks when package registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-release-registration-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:release-check"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:release-check -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingReleaseCheck({
      packagePath,
      write: false,
      runner: async () => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }),
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_release_check_status, "blocked");
    assert.ok(result.source_rows.some((row) => row.row_key === "package_trading_release_check_registered" && row.source_status === "blocked"));
    assert.ok(result.source_rows.some((row) => row.row_key === "package_validation_chain_registered" && row.source_status === "blocked"));
    await assert.rejects(
      () => runTradingReleaseCheck({
        packagePath,
        write: false,
        check: true,
        runner: async () => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }),
      }),
      /Trading release check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading --check runners do not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-validation.json");
    const sentinel = "{ \"sentinel\": true }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingValidate({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading strategy taxonomy --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-taxonomy-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-strategy-taxonomy.json");
    const sentinel = "{ \"sentinel\": true }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingStrategyTaxonomy({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading market data and feature --check do not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-feature-store-check-"));
  try {
    const marketDataOutDir = path.join(root, "market-data");
    const featureOutDir = path.join(root, "feature");
    await mkdir(marketDataOutDir, { recursive: true });
    await mkdir(featureOutDir, { recursive: true });
    const marketDataSentinelPath = path.join(marketDataOutDir, "trading-market-data-report.json");
    const featureSentinelPath = path.join(featureOutDir, "trading-feature-report.json");
    const marketDataSentinel = "{ \"sentinel\": \"market-data\" }\n";
    const featureSentinel = "{ \"sentinel\": \"feature\" }\n";
    await writeFile(marketDataSentinelPath, marketDataSentinel, "utf8");
    await writeFile(featureSentinelPath, featureSentinel, "utf8");

    await runTradingMarketDataReport({ outDir: marketDataOutDir, write: false, check: true });
    await runTradingFeatureReport({ outDir: featureOutDir, write: false, check: true });

    assert.equal(await readFile(marketDataSentinelPath, "utf8"), marketDataSentinel);
    assert.equal(await readFile(featureSentinelPath, "utf8"), featureSentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading signal report --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-signal-check-"));
  try {
    const outDir = path.join(root, "signal");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-signal-report.json");
    const sentinel = "{ \"sentinel\": \"signal\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingSignalReport({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading model reports --check do not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-model-check-"));
  try {
    const trainOutDir = path.join(root, "train");
    const evalOutDir = path.join(root, "eval");
    await mkdir(trainOutDir, { recursive: true });
    await mkdir(evalOutDir, { recursive: true });
    const trainSentinelPath = path.join(trainOutDir, "trading-model-train-report.json");
    const evalSentinelPath = path.join(evalOutDir, "trading-model-eval-report.json");
    const trainSentinel = "{ \"sentinel\": \"train\" }\n";
    const evalSentinel = "{ \"sentinel\": \"eval\" }\n";
    await writeFile(trainSentinelPath, trainSentinel, "utf8");
    await writeFile(evalSentinelPath, evalSentinel, "utf8");

    await runTradingModelTrainReport({ outDir: trainOutDir, write: false, check: true });
    await runTradingModelEvalReport({ outDir: evalOutDir, write: false, check: true });

    assert.equal(await readFile(trainSentinelPath, "utf8"), trainSentinel);
    assert.equal(await readFile(evalSentinelPath, "utf8"), evalSentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading backtest report --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-backtest-check-"));
  try {
    const outDir = path.join(root, "backtest");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-backtest-report.json");
    const sentinel = "{ \"sentinel\": \"backtest\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingBacktestReport({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading risk check --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-risk-check-"));
  try {
    const outDir = path.join(root, "risk");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-risk-check.json");
    const sentinel = "{ \"sentinel\": \"risk\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingRiskCheck({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading paper and shadow reports --check do not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-paper-shadow-check-"));
  try {
    const paperOutDir = path.join(root, "paper");
    const shadowOutDir = path.join(root, "shadow");
    await mkdir(paperOutDir, { recursive: true });
    await mkdir(shadowOutDir, { recursive: true });
    const paperSentinelPath = path.join(paperOutDir, "trading-paper-report.json");
    const shadowSentinelPath = path.join(shadowOutDir, "trading-shadow-report.json");
    const paperSentinel = "{ \"sentinel\": \"paper\" }\n";
    const shadowSentinel = "{ \"sentinel\": \"shadow\" }\n";
    await writeFile(paperSentinelPath, paperSentinel, "utf8");
    await writeFile(shadowSentinelPath, shadowSentinel, "utf8");

    await runTradingPaperReport({ outDir: paperOutDir, write: false, check: true });
    await runTradingShadowReport({ outDir: shadowOutDir, write: false, check: true });

    assert.equal(await readFile(paperSentinelPath, "utf8"), paperSentinel);
    assert.equal(await readFile(shadowSentinelPath, "utf8"), shadowSentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading execution report --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-execution-check-"));
  try {
    const outDir = path.join(root, "execution");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-execution-report.json");
    const sentinel = "{ \"sentinel\": \"execution\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingExecutionReport({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading limited live report --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-limited-live-check-"));
  try {
    const outDir = path.join(root, "limited-live");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-limited-live-report.json");
    const sentinel = "{ \"sentinel\": \"limited-live\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingLimitedLiveReport({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading full auto report --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-full-auto-check-"));
  try {
    const outDir = path.join(root, "full-auto");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-full-auto-report.json");
    const sentinel = "{ \"sentinel\": \"full-auto\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingFullAutoReport({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading release check --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-release-check-"));
  try {
    const outDir = path.join(root, "release-check");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-release-check.json");
    const sentinel = "{ \"sentinel\": \"release-check\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingReleaseCheck({
      outDir,
      write: false,
      check: true,
      runner: async () => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }),
    });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading safety regression fixtures fail fast on unsafe enablement flags", async () => {
  const result = await runTradingSafetyRegressionFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_safety_regression_fixtures_status, "ready_for_trading_safety_regression");
  assert.equal(result.summary.phase_slot, "P381");
  assert.equal(result.summary.previous_phase_slot, "P380");
  assert.equal(result.summary.next_phase_slot, "P382");
  assert.equal(result.summary.source_release_check_receipt_closeout_status, "ready_for_release_check_receipt_chain_closeout");
  assert.equal(result.summary.fixture_count, 4);
  assert.equal(result.summary.passed_fixture_count, 4);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_flag_detected_count, 0);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.safety_regression_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_true && row.expected_safe_value === false && row.unsafe_value === true && row.unsafe_value_detected === false && row.protected_action_executed_by_fixture === false));
  assert.ok(result.safety_regression_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading safety regression fixtures block when full auto is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-safety-regression-full-auto-"));
  try {
    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.safety_boundary.full_auto_enabled = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingSafetyRegressionFixtures({ fullAutoPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_safety_regression_fixtures_status, "blocked");
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.unsafe_flag_detected_count, 1);
    assert.ok(result.safety_regression_fixture_rows.some((row) => row.flag_name === "full_auto_enabled" && row.fixture_status === "failed" && row.unsafe_value_detected));
    await assert.rejects(
      () => runTradingSafetyRegressionFixtures({ fullAutoPath, write: false, check: true }),
      /Trading safety regression fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading safety regression fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-safety-regression-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:safety-regression-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:safety-regression-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingSafetyRegressionFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_safety_regression_fixtures_status, "blocked");
    assert.ok(result.safety_regression_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.safety_regression_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingSafetyRegressionFixtures({ packagePath, write: false, check: true }),
      /Trading safety regression fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading safety regression fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-safety-regression-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-safety-regression-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-safety-regression-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingSafetyRegressionFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading route inventory fixtures block unsafe active trading route families", async () => {
  const result = await runTradingRouteInventoryFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_route_inventory_fixtures_status, "ready_for_trading_route_inventory_regression");
  assert.equal(result.summary.phase_slot, "P382");
  assert.equal(result.summary.previous_phase_slot, "P381");
  assert.equal(result.summary.next_phase_slot, "P383");
  assert.equal(result.summary.source_safety_regression_status, "ready_for_trading_safety_regression");
  assert.equal(result.summary.route_source_count, 10);
  assert.equal(result.summary.ready_route_source_count, 10);
  assert.equal(result.summary.fixture_count, 4);
  assert.equal(result.summary.passed_fixture_count, 4);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.active_unsafe_route_count, 0);
  assert.equal(result.summary.required_category_count, 4);
  assert.equal(result.summary.disabled_coverage_category_count, 4);
  assert.equal(result.summary.disabled_routes_covered, true);
  assert.equal(result.summary.mutating_trading_route_enabled, false);
  assert.equal(result.summary.broker_credential_route_enabled, false);
  assert.equal(result.summary.live_broker_write_route_enabled, false);
  assert.equal(result.summary.generic_order_submission_route_enabled, false);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.active_route_rows.every((row) => row.method === "GET" && row.unsafe_when_active === false && row.unsafe_category_count === 0));
  assert.ok(result.route_inventory_fixture_rows.every((row) => row.fixture_status === "passed" && row.active_unsafe_route_count === 0 && row.disabled_route_coverage_present && row.disabled_evidence_route_count > 0));
  assert.ok(result.route_inventory_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading route inventory fixtures block active generic order and credential routes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-route-inventory-unsafe-route-"));
  try {
    const unsafeSource = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    unsafeSource.dashboard_api_stub.routes.push({ method: "POST", path: "/api/trading/orders/submit" });
    unsafeSource.dashboard_api_stub.routes.push({ method: "GET", path: "/api/trading/credentials" });
    const unsafeSourcePath = path.join(root, "execution-engine-unsafe.json");
    await writeFile(unsafeSourcePath, `${JSON.stringify(unsafeSource, null, 2)}\n`, "utf8");
    const routeSourcePaths = [...DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS, unsafeSourcePath];

    const result = await runTradingRouteInventoryFixtures({ routeSourcePaths, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_route_inventory_fixtures_status, "blocked");
    assert.equal(result.summary.active_unsafe_route_count, 2);
    assert.equal(result.summary.mutating_trading_route_enabled, true);
    assert.equal(result.summary.broker_credential_route_enabled, true);
    assert.equal(result.summary.generic_order_submission_route_enabled, true);
    assert.ok(result.route_inventory_fixture_rows.some((row) => row.category_key === "generic_order_submission_routes" && row.fixture_status === "failed" && row.active_unsafe_route_count > 0));
    assert.ok(result.route_inventory_fixture_rows.some((row) => row.category_key === "broker_credential_routes" && row.fixture_status === "failed" && row.active_unsafe_route_count > 0));
    await assert.rejects(
      () => runTradingRouteInventoryFixtures({ routeSourcePaths, write: false, check: true }),
      /Trading route inventory fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading route inventory fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-route-inventory-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:route-inventory-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:route-inventory-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingRouteInventoryFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_route_inventory_fixtures_status, "blocked");
    assert.ok(result.route_inventory_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.route_inventory_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingRouteInventoryFixtures({ packagePath, write: false, check: true }),
      /Trading route inventory fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading route inventory fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-route-inventory-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-route-inventory-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-route-inventory-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingRouteInventoryFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading approval absence fixtures keep missing approvals blocking enablement", async () => {
  const result = await runTradingApprovalAbsenceFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_approval_absence_fixtures_status, "ready_for_trading_approval_absence_regression");
  assert.equal(result.summary.phase_slot, "P383");
  assert.equal(result.summary.previous_phase_slot, "P382");
  assert.equal(result.summary.next_phase_slot, "P384");
  assert.equal(result.summary.source_route_inventory_status, "ready_for_trading_route_inventory_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.evidence_count, 5);
  assert.equal(result.summary.fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.approval_receipt_present_count, 0);
  assert.equal(result.summary.unsafe_enablement_detected_count, 0);
  assert.equal(result.summary.missing_approval_block_count, 5);
  assert.equal(result.summary.approval_absence_covered, true);
  assert.equal(result.summary.approval_application_allowed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.approval_absence_evidence_rows.every((row) => row.evidence_status === "blocked_by_missing_approval" && row.approval_missing && row.approval_receipt_present === false && row.unsafe_enablement_detected === false));
  assert.ok(result.approval_absence_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_receipt_present && row.fixture_should_fail_when_enablement_unblocked));
  assert.ok(result.approval_absence_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading approval absence fixtures block when approval receipt and enablement appear", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-approval-absence-receipt-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.approval_gate.approval_receipt_present = true;
    limitedLive.safety_boundary.approval_receipt_present = true;
    limitedLive.safety_boundary.limited_live_enabled = true;
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingApprovalAbsenceFixtures({ limitedLivePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_approval_absence_fixtures_status, "blocked");
    assert.equal(result.summary.approval_receipt_present_count, 1);
    assert.ok(result.summary.unsafe_enablement_detected_count > 0);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.live_order_submission_allowed, true);
    assert.ok(result.approval_absence_fixture_rows.some((row) => row.row_key === "limited_live_approval_absence" && row.fixture_status === "failed" && row.approval_receipt_present));
    await assert.rejects(
      () => runTradingApprovalAbsenceFixtures({ limitedLivePath, write: false, check: true }),
      /Trading approval absence fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading approval absence fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-approval-absence-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:approval-absence-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:approval-absence-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingApprovalAbsenceFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_approval_absence_fixtures_status, "blocked");
    assert.ok(result.approval_absence_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.approval_absence_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingApprovalAbsenceFixtures({ packagePath, write: false, check: true }),
      /Trading approval absence fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading approval absence fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-approval-absence-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-approval-absence-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-approval-absence-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingApprovalAbsenceFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading live adapter disabled fixtures keep live adapters and writes disabled", async () => {
  const result = await runTradingLiveAdapterDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_live_adapter_disabled_fixtures_status, "ready_for_trading_live_adapter_disabled_regression");
  assert.equal(result.summary.phase_slot, "P384");
  assert.equal(result.summary.previous_phase_slot, "P383");
  assert.equal(result.summary.next_phase_slot, "P385");
  assert.equal(result.summary.source_approval_absence_status, "ready_for_trading_approval_absence_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.evidence_count, 5);
  assert.equal(result.summary.fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_adapter_signal_count, 0);
  assert.equal(result.summary.live_adapter_disabled_covered, true);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.external_network_allowed, false);
  assert.equal(result.summary.live_write_allowed, false);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.live_adapter_disabled_evidence_rows.every((row) => row.evidence_status === "live_adapter_disabled" && row.unsafe_adapter_signal_detected === false));
  assert.ok(result.live_adapter_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_live_adapter_enabled && row.fixture_should_fail_when_live_write_allowed));
  assert.ok(result.live_adapter_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading live adapter disabled fixtures block when live adapter is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-live-adapter-enabled-"));
  try {
    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.safety_boundary.live_adapter_enabled = true;
    executionEngine.safety_boundary.live_execution_allowed = true;
    executionEngine.adapters.live_adapter.enabled = true;
    executionEngine.adapters.live_adapter.external_network_allowed = true;
    executionEngine.adapters.live_adapter.live_write_allowed = true;
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const result = await runTradingLiveAdapterDisabledFixtures({ executionEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_live_adapter_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_adapter_signal_count > 0);
    assert.equal(result.summary.live_adapter_enabled, true);
    assert.equal(result.summary.external_network_allowed, true);
    assert.equal(result.summary.live_write_allowed, true);
    assert.ok(result.live_adapter_disabled_fixture_rows.some((row) => row.row_key === "execution_live_adapter_disabled" && row.fixture_status === "failed" && row.unsafe_adapter_signal_detected));
    await assert.rejects(
      () => runTradingLiveAdapterDisabledFixtures({ executionEnginePath, write: false, check: true }),
      /Trading live adapter disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading live adapter disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-live-adapter-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:live-adapter-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:live-adapter-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingLiveAdapterDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_live_adapter_disabled_fixtures_status, "blocked");
    assert.ok(result.live_adapter_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.live_adapter_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingLiveAdapterDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading live adapter disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading live adapter disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-live-adapter-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-live-adapter-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-live-adapter-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingLiveAdapterDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading credential lookup disabled fixtures keep credentials and secrets blocked", async () => {
  const result = await runTradingCredentialLookupDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_credential_lookup_disabled_fixtures_status, "ready_for_trading_credential_lookup_disabled_regression");
  assert.equal(result.summary.phase_slot, "P385");
  assert.equal(result.summary.previous_phase_slot, "P384");
  assert.equal(result.summary.next_phase_slot, "P386");
  assert.equal(result.summary.source_live_adapter_disabled_status, "ready_for_trading_live_adapter_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.evidence_count, 6);
  assert.equal(result.summary.fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_credential_signal_count, 0);
  assert.equal(result.summary.credential_lookup_disabled_covered, true);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.plaintext_secret_allowed, false);
  assert.equal(result.summary.model_context_secret_allowed, false);
  assert.equal(result.summary.external_api_keys_required, false);
  assert.equal(result.summary.credentials_required, false);
  assert.equal(result.summary.secret_logged, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.credential_lookup_disabled_evidence_rows.every((row) => row.evidence_status === "credential_lookup_disabled" && row.unsafe_credential_signal_detected === false));
  assert.ok(result.credential_lookup_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_lookup_enabled && row.fixture_should_fail_when_plaintext_allowed));
  assert.ok(result.credential_lookup_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading credential lookup disabled fixtures block when credential lookup is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-credential-lookup-enabled-"));
  try {
    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.credential_broker_contract.credential_lookup_allowed = true;
    executionEngine.credential_broker_contract.plaintext_secret_allowed = true;
    executionEngine.credential_broker_contract.model_context_secret_allowed = true;
    executionEngine.safety_boundary.secret_logged = true;
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const result = await runTradingCredentialLookupDisabledFixtures({ executionEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_credential_lookup_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_credential_signal_count > 0);
    assert.equal(result.summary.credential_lookup_enabled, true);
    assert.equal(result.summary.plaintext_secret_allowed, true);
    assert.equal(result.summary.model_context_secret_allowed, true);
    assert.equal(result.summary.secret_logged, true);
    assert.ok(result.credential_lookup_disabled_fixture_rows.some((row) => row.row_key === "credential_broker_lookup_disabled" && row.fixture_status === "failed" && row.unsafe_credential_signal_detected));
    await assert.rejects(
      () => runTradingCredentialLookupDisabledFixtures({ executionEnginePath, write: false, check: true }),
      /Trading credential lookup disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading credential lookup disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-credential-lookup-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:credential-lookup-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:credential-lookup-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingCredentialLookupDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_credential_lookup_disabled_fixtures_status, "blocked");
    assert.ok(result.credential_lookup_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.credential_lookup_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingCredentialLookupDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading credential lookup disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading credential lookup disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-credential-lookup-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-credential-lookup-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-credential-lookup-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingCredentialLookupDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading broker write disabled fixtures keep broker writes blocked", async () => {
  const result = await runTradingBrokerWriteDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_broker_write_disabled_fixtures_status, "ready_for_trading_broker_write_disabled_regression");
  assert.equal(result.summary.phase_slot, "P386");
  assert.equal(result.summary.previous_phase_slot, "P385");
  assert.equal(result.summary.next_phase_slot, "P387");
  assert.equal(result.summary.source_credential_lookup_disabled_status, "ready_for_trading_credential_lookup_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.evidence_count, 6);
  assert.equal(result.summary.fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_broker_write_signal_count, 0);
  assert.equal(result.summary.broker_write_disabled_covered, true);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.live_submit_state_enabled, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.live_cancel_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.broker_write_disabled_evidence_rows.every((row) => row.evidence_status === "broker_write_disabled" && row.unsafe_broker_write_signal_detected === false));
  assert.ok(result.broker_write_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_broker_write_allowed && row.fixture_should_fail_when_live_order_submission_allowed));
  assert.ok(result.broker_write_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading broker write disabled fixtures block when broker write is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-broker-write-enabled-"));
  try {
    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.safety_boundary.broker_write_allowed = true;
    executionEngine.safety_boundary.real_order_submitted = true;
    executionEngine.broker_adapter_interface.write_methods_enabled = true;
    executionEngine.execution_state_machine.live_submit_state_enabled = true;
    executionEngine.order_controls.order_throttle.blocks_order_submission = false;
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const result = await runTradingBrokerWriteDisabledFixtures({ executionEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_broker_write_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_broker_write_signal_count > 0);
    assert.equal(result.summary.broker_write_allowed, true);
    assert.equal(result.summary.live_submit_state_enabled, true);
    assert.equal(result.summary.real_order_submitted, true);
    assert.ok(result.broker_write_disabled_fixture_rows.some((row) => row.row_key === "execution_broker_interface_write_disabled" && row.fixture_status === "failed" && row.unsafe_broker_write_signal_detected));
    await assert.rejects(
      () => runTradingBrokerWriteDisabledFixtures({ executionEnginePath, write: false, check: true }),
      /Trading broker write disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading broker write disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-broker-write-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:broker-write-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:broker-write-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingBrokerWriteDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_broker_write_disabled_fixtures_status, "blocked");
    assert.ok(result.broker_write_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.broker_write_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingBrokerWriteDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading broker write disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading broker write disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-broker-write-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-broker-write-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-broker-write-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingBrokerWriteDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading exchange write disabled fixtures keep exchange writes blocked", async () => {
  const result = await runTradingExchangeWriteDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_exchange_write_disabled_fixtures_status, "ready_for_trading_exchange_write_disabled_regression");
  assert.equal(result.summary.phase_slot, "P387");
  assert.equal(result.summary.previous_phase_slot, "P386");
  assert.equal(result.summary.next_phase_slot, "P388");
  assert.equal(result.summary.source_broker_write_disabled_status, "ready_for_trading_broker_write_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.evidence_count, 6);
  assert.equal(result.summary.fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_exchange_write_signal_count, 0);
  assert.equal(result.summary.exchange_write_disabled_covered, true);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.live_submit_state_enabled, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.live_cancel_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.exchange_write_disabled_evidence_rows.every((row) => row.evidence_status === "exchange_write_disabled" && row.unsafe_exchange_write_signal_detected === false));
  assert.ok(result.exchange_write_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_exchange_write_allowed && row.fixture_should_fail_when_live_order_submission_allowed));
  assert.ok(result.exchange_write_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading exchange write disabled fixtures block when exchange write is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-exchange-write-enabled-"));
  try {
    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.safety_boundary.exchange_write_allowed = true;
    executionEngine.safety_boundary.real_order_submitted = true;
    executionEngine.crypto_exchange_adapter_interface.write_methods_enabled = true;
    executionEngine.execution_state_machine.live_submit_state_enabled = true;
    executionEngine.order_controls.order_throttle.blocks_order_submission = false;
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const result = await runTradingExchangeWriteDisabledFixtures({ executionEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_exchange_write_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_exchange_write_signal_count > 0);
    assert.equal(result.summary.exchange_write_allowed, true);
    assert.equal(result.summary.live_submit_state_enabled, true);
    assert.equal(result.summary.real_order_submitted, true);
    assert.ok(result.exchange_write_disabled_fixture_rows.some((row) => row.row_key === "execution_exchange_interface_write_disabled" && row.fixture_status === "failed" && row.unsafe_exchange_write_signal_detected));
    await assert.rejects(
      () => runTradingExchangeWriteDisabledFixtures({ executionEnginePath, write: false, check: true }),
      /Trading exchange write disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading exchange write disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-exchange-write-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:exchange-write-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:exchange-write-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingExchangeWriteDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_exchange_write_disabled_fixtures_status, "blocked");
    assert.ok(result.exchange_write_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.exchange_write_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingExchangeWriteDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading exchange write disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading exchange write disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-exchange-write-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-exchange-write-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-exchange-write-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingExchangeWriteDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading safety boundary fixtures consolidate P381-P387 safety layers", async () => {
  const result = await runTradingSafetyBoundaryFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_safety_boundary_fixtures_status, "ready_for_trading_safety_boundary_regression");
  assert.equal(result.summary.phase_slot, "P388");
  assert.equal(result.summary.previous_phase_slot, "P387");
  assert.equal(result.summary.next_phase_slot, "P389");
  assert.equal(result.summary.source_exchange_write_disabled_status, "ready_for_trading_exchange_write_disabled_regression");
  assert.equal(result.summary.required_layer_count, 7);
  assert.equal(result.summary.layer_count, 7);
  assert.equal(result.summary.ready_layer_count, 7);
  assert.equal(result.summary.blocked_layer_count, 0);
  assert.equal(result.summary.required_boundary_fixture_count, 11);
  assert.equal(result.summary.fixture_count, 11);
  assert.equal(result.summary.passed_fixture_count, 11);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_signal_count, 0);
  assert.equal(result.summary.safety_regression_covered, true);
  assert.equal(result.summary.disabled_routes_covered, true);
  assert.equal(result.summary.approval_absence_covered, true);
  assert.equal(result.summary.live_adapter_disabled_covered, true);
  assert.equal(result.summary.credential_lookup_disabled_covered, true);
  assert.equal(result.summary.broker_write_disabled_covered, true);
  assert.equal(result.summary.exchange_write_disabled_covered, true);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_adapter_enabled, false);
  assert.equal(result.summary.credential_lookup_enabled, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.safety_boundary_layer_rows.every((row) => row.layer_status === "ready" && row.source_validation_valid && row.unsafe_signal_count === 0));
  assert.ok(result.safety_boundary_fixture_rows.every((row) => row.fixture_status === "passed" && row.unsafe_signal_detected === false && row.protected_action_executed_by_fixture === false));
  assert.ok(result.safety_boundary_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading safety boundary fixtures block when limited live enablement appears", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-safety-boundary-limited-live-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.limited_live_enabled = true;
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    limitedLive.order_caps.order_submission_allowed = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingSafetyBoundaryFixtures({ limitedLivePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_safety_boundary_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_signal_count > 0);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.live_order_submission_allowed, true);
    assert.equal(result.summary.trading_order_submission_allowed, true);
    assert.ok(result.safety_boundary_layer_rows.some((row) => row.row_key === "safety_regression" && row.layer_status === "blocked"));
    assert.ok(result.safety_boundary_fixture_rows.some((row) => row.row_key === "limited_live_disabled" && row.fixture_status === "failed" && row.unsafe_signal_detected));
    await assert.rejects(
      () => runTradingSafetyBoundaryFixtures({ limitedLivePath, write: false, check: true }),
      /Trading safety boundary fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading safety boundary fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-safety-boundary-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:safety-boundary-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:safety-boundary-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingSafetyBoundaryFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_safety_boundary_fixtures_status, "blocked");
    assert.ok(result.safety_boundary_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.safety_boundary_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingSafetyBoundaryFixtures({ packagePath, write: false, check: true }),
      /Trading safety boundary fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading safety boundary fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-safety-boundary-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-safety-boundary-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-safety-boundary-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingSafetyBoundaryFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading manual resume disabled fixtures keep halt and resume paths human gated", async () => {
  const result = await runTradingManualResumeDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_manual_resume_disabled_fixtures_status, "ready_for_trading_manual_resume_disabled_regression");
  assert.equal(result.summary.phase_slot, "P389");
  assert.equal(result.summary.previous_phase_slot, "P388");
  assert.equal(result.summary.next_phase_slot, "P390");
  assert.equal(result.summary.source_safety_boundary_status, "ready_for_trading_safety_boundary_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.evidence_count, 6);
  assert.equal(result.summary.fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_manual_resume_signal_count, 0);
  assert.equal(result.summary.manual_resume_disabled_covered, true);
  assert.equal(result.summary.manual_resume_required_missing, false);
  assert.equal(result.summary.manual_resume_route_enabled, false);
  assert.equal(result.summary.live_orders_cancelled, false);
  assert.equal(result.summary.rollback_to_paper_missing, false);
  assert.equal(result.summary.protected_action_route_enabled, false);
  assert.equal(result.summary.external_broker_recovery_allowed, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.manual_resume_disabled_evidence_rows.every((row) => row.evidence_status === "manual_resume_disabled" && row.unsafe_manual_resume_signal_detected === false));
  assert.ok(result.manual_resume_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_resume_route_enabled && row.fixture_should_fail_when_manual_resume_not_required));
  assert.ok(result.manual_resume_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading manual resume disabled fixtures block when resume route is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-manual-resume-enabled-"));
  try {
    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.emergency_halt.manual_resume_required = false;
    executionEngine.emergency_halt.cancels_live_orders = true;
    executionEngine.manual_resume_policy.resume_route_enabled = true;
    executionEngine.dashboard_api_stub.disabled_routes = executionEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/execution/resume");
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const result = await runTradingManualResumeDisabledFixtures({ executionEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_manual_resume_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_manual_resume_signal_count > 0);
    assert.equal(result.summary.manual_resume_required_missing, true);
    assert.equal(result.summary.manual_resume_route_enabled, true);
    assert.equal(result.summary.live_orders_cancelled, true);
    assert.ok(result.manual_resume_disabled_fixture_rows.some((row) => row.row_key === "execution_manual_resume_route_disabled" && row.fixture_status === "failed" && row.unsafe_manual_resume_signal_detected));
    await assert.rejects(
      () => runTradingManualResumeDisabledFixtures({ executionEnginePath, write: false, check: true }),
      /Trading manual resume disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading manual resume disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-manual-resume-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:manual-resume-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:manual-resume-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingManualResumeDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_manual_resume_disabled_fixtures_status, "blocked");
    assert.ok(result.manual_resume_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.manual_resume_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingManualResumeDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading manual resume disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading manual resume disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-manual-resume-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-manual-resume-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-manual-resume-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingManualResumeDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading risk override disabled fixtures keep override paths human gated", async () => {
  const result = await runTradingRiskOverrideDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_risk_override_disabled_fixtures_status, "ready_for_trading_risk_override_disabled_regression");
  assert.equal(result.summary.phase_slot, "P390");
  assert.equal(result.summary.previous_phase_slot, "P389");
  assert.equal(result.summary.next_phase_slot, "P391");
  assert.equal(result.summary.source_manual_resume_disabled_status, "ready_for_trading_manual_resume_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.evidence_count, 5);
  assert.equal(result.summary.fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_risk_override_signal_count, 0);
  assert.equal(result.summary.risk_override_disabled_covered, true);
  assert.equal(result.summary.human_approval_required_missing, false);
  assert.equal(result.summary.protected_action_gate_missing, false);
  assert.equal(result.summary.override_receipt_required_missing, false);
  assert.equal(result.summary.risk_override_without_human_allowed, false);
  assert.equal(result.summary.risk_override_route_enabled, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.investment_advice_generated, false);
  assert.equal(result.summary.trade_recommendation_generated, false);
  assert.equal(result.summary.live_trade_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.risk_override_disabled_evidence_rows.every((row) => row.evidence_status === "risk_override_disabled" && row.unsafe_risk_override_signal_detected === false));
  assert.ok(result.risk_override_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_override_without_human_allowed && row.fixture_should_fail_when_override_route_enabled));
  assert.ok(result.risk_override_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading risk override disabled fixtures block when override route is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-risk-override-enabled-"));
  try {
    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.override_policy.requires_human_approval = false;
    riskEngine.override_policy.protected_action_gate_required = false;
    riskEngine.safety_boundary.risk_override_without_human_allowed = true;
    riskEngine.safety_boundary.order_intent_generated = true;
    riskEngine.dashboard_api_stub.mutating_routes_enabled = true;
    riskEngine.dashboard_api_stub.disabled_routes = riskEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/risk/override");
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const result = await runTradingRiskOverrideDisabledFixtures({ riskEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_risk_override_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_risk_override_signal_count > 0);
    assert.equal(result.summary.human_approval_required_missing, true);
    assert.equal(result.summary.protected_action_gate_missing, true);
    assert.equal(result.summary.risk_override_without_human_allowed, true);
    assert.equal(result.summary.risk_override_route_enabled, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.ok(result.risk_override_disabled_fixture_rows.some((row) => row.row_key === "risk_override_route_disabled" && row.fixture_status === "failed" && row.unsafe_risk_override_signal_detected));
    await assert.rejects(
      () => runTradingRiskOverrideDisabledFixtures({ riskEnginePath, write: false, check: true }),
      /Trading risk override disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading risk override disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-risk-override-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:risk-override-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:risk-override-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingRiskOverrideDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_risk_override_disabled_fixtures_status, "blocked");
    assert.ok(result.risk_override_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.risk_override_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingRiskOverrideDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading risk override disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading risk override disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-risk-override-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-risk-override-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-risk-override-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingRiskOverrideDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion disabled fixtures keep promotion paths human gated", async () => {
  const result = await runTradingPromotionDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_disabled_fixtures_status, "ready_for_trading_promotion_disabled_regression");
  assert.equal(result.summary.phase_slot, "P391");
  assert.equal(result.summary.previous_phase_slot, "P390");
  assert.equal(result.summary.next_phase_slot, "P392");
  assert.equal(result.summary.source_risk_override_disabled_status, "ready_for_trading_risk_override_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.evidence_count, 6);
  assert.equal(result.summary.fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_promotion_signal_count, 0);
  assert.equal(result.summary.promotion_disabled_covered, true);
  assert.equal(result.summary.human_approval_required_missing, false);
  assert.equal(result.summary.approval_receipt_present, false);
  assert.equal(result.summary.promotion_candidate_generated, false);
  assert.equal(result.summary.auto_live_promotion_allowed, false);
  assert.equal(result.summary.live_promotion_allowed, false);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.full_auto_promotion_allowed, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.promotion_route_enabled, false);
  assert.equal(result.summary.order_route_enabled, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.promotion_disabled_evidence_rows.every((row) => row.evidence_status === "promotion_disabled" && row.unsafe_promotion_signal_detected === false));
  assert.ok(result.promotion_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_live_promotion_allowed && row.fixture_should_fail_when_promotion_route_enabled));
  assert.ok(result.promotion_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading promotion disabled fixtures block when promotion route is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-enabled-"));
  try {
    const modelImprovement = JSON.parse(await readFile("examples/trading/model-improvement-layer.json", "utf8"));
    modelImprovement.promotion_policy_gate.human_approval_required = false;
    modelImprovement.promotion_policy_gate.auto_live_promotion_allowed = true;
    modelImprovement.promotion_policy_gate.live_promotion_allowed = true;
    modelImprovement.promotion_candidates[0].promotion_artifact.live_promotion_allowed = true;
    const modelImprovementPath = path.join(root, "model-improvement-layer.json");
    await writeFile(modelImprovementPath, `${JSON.stringify(modelImprovement, null, 2)}\n`, "utf8");

    const backtestValidation = JSON.parse(await readFile("examples/trading/backtest-validation.json", "utf8"));
    backtestValidation.promotion_boundary.promotion_candidate_generated = true;
    backtestValidation.promotion_boundary.live_promotion_allowed = true;
    backtestValidation.dashboard_api_stub.disabled_routes = backtestValidation.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/backtests/promote");
    const backtestValidationPath = path.join(root, "backtest-validation.json");
    await writeFile(backtestValidationPath, `${JSON.stringify(backtestValidation, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.promotion_criteria_to_shadow.human_approval_required = false;
    paperShadow.promotion_criteria_to_shadow.shadow_live_enabled = true;
    paperShadow.promotion_criteria_to_limited_live.limited_live_enabled = true;
    paperShadow.dashboard_api_stub.disabled_routes = paperShadow.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/shadow/enable-live");
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.promotion_criteria_to_full_auto.full_auto_enabled = true;
    limitedLive.safety_boundary.full_auto_promotion_allowed = true;
    limitedLive.dashboard_api_stub.disabled_routes = limitedLive.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/limited-live/promote-full-auto");
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionDisabledFixtures({
      modelImprovementPath,
      backtestValidationPath,
      paperShadowPath,
      limitedLivePath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_promotion_signal_count > 0);
    assert.equal(result.summary.human_approval_required_missing, true);
    assert.equal(result.summary.promotion_candidate_generated, true);
    assert.equal(result.summary.auto_live_promotion_allowed, true);
    assert.equal(result.summary.live_promotion_allowed, true);
    assert.equal(result.summary.shadow_live_enabled, true);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.full_auto_promotion_allowed, true);
    assert.equal(result.summary.promotion_route_enabled, true);
    assert.ok(result.promotion_disabled_fixture_rows.some((row) => row.row_key === "limited_live_to_full_auto_promotion_blocked" && row.fixture_status === "failed" && row.unsafe_promotion_signal_detected));
    await assert.rejects(
      () => runTradingPromotionDisabledFixtures({ modelImprovementPath, backtestValidationPath, paperShadowPath, limitedLivePath, write: false, check: true }),
      /Trading promotion disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_disabled_fixtures_status, "blocked");
    assert.ok(result.promotion_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading promotion disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading first trade disabled fixtures keep first trade blocked", async () => {
  const result = await runTradingFirstTradeDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_first_trade_disabled_fixtures_status, "ready_for_trading_first_trade_disabled_regression");
  assert.equal(result.summary.phase_slot, "P392");
  assert.equal(result.summary.previous_phase_slot, "P391");
  assert.equal(result.summary.next_phase_slot, "P393");
  assert.equal(result.summary.source_promotion_disabled_status, "ready_for_trading_promotion_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.evidence_count, 5);
  assert.equal(result.summary.fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_first_trade_signal_count, 0);
  assert.equal(result.summary.first_trade_disabled_covered, true);
  assert.equal(result.summary.approval_required_missing, false);
  assert.equal(result.summary.approval_receipt_present, false);
  assert.equal(result.summary.first_trade_confirmation_required_missing, false);
  assert.equal(result.summary.first_trade_confirmation_present, false);
  assert.equal(result.summary.first_trade_not_blocked, false);
  assert.equal(result.summary.first_trade_submitted, false);
  assert.equal(result.summary.order_size_cap_missing, false);
  assert.equal(result.summary.daily_order_cap_missing, false);
  assert.equal(result.summary.order_submission_allowed, false);
  assert.equal(result.summary.live_order_route_enabled, false);
  assert.equal(result.summary.live_cancel_allowed, false);
  assert.equal(result.summary.live_fill_recorded, false);
  assert.equal(result.summary.real_order_reported, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.first_trade_disabled_evidence_rows.every((row) => row.evidence_status === "first_trade_disabled" && row.unsafe_first_trade_signal_detected === false));
  assert.ok(result.first_trade_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_first_trade_submitted && row.fixture_should_fail_when_order_route_enabled));
  assert.ok(result.first_trade_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading first trade disabled fixtures block when first trade is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-first-trade-enabled-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.approval_gate.approval_receipt_present = true;
    limitedLive.approval_gate.decision = "approved";
    limitedLive.safety_boundary.limited_live_enabled = true;
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    limitedLive.first_trade_confirmation.confirmation_present = true;
    limitedLive.first_trade_confirmation.blocks_first_trade = false;
    limitedLive.first_trade_confirmation.first_trade_submitted = true;
    limitedLive.order_caps.order_submission_allowed = true;
    limitedLive.order_caps.daily_order_count_cap.max_orders_per_day = 1;
    limitedLive.auto_cancel_stale_orders.live_cancel_allowed = true;
    limitedLive.post_trade_reconciliation.live_fill_count = 1;
    limitedLive.daily_live_report.real_order_count = 1;
    limitedLive.dashboard_api_stub.mutating_routes_enabled = true;
    limitedLive.dashboard_api_stub.disabled_routes = limitedLive.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/limited-live/orders");
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingFirstTradeDisabledFixtures({ limitedLivePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_first_trade_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_first_trade_signal_count > 0);
    assert.equal(result.summary.approval_receipt_present, true);
    assert.equal(result.summary.first_trade_confirmation_present, true);
    assert.equal(result.summary.first_trade_not_blocked, true);
    assert.equal(result.summary.first_trade_submitted, true);
    assert.equal(result.summary.daily_order_cap_missing, true);
    assert.equal(result.summary.order_submission_allowed, true);
    assert.equal(result.summary.live_order_route_enabled, true);
    assert.equal(result.summary.live_cancel_allowed, true);
    assert.equal(result.summary.live_fill_recorded, true);
    assert.equal(result.summary.real_order_reported, true);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.live_order_submission_allowed, true);
    assert.ok(result.first_trade_disabled_fixture_rows.some((row) => row.row_key === "first_trade_confirmation_missing_blocks_submission" && row.fixture_status === "failed" && row.unsafe_first_trade_signal_detected));
    await assert.rejects(
      () => runTradingFirstTradeDisabledFixtures({ limitedLivePath, write: false, check: true }),
      /Trading first trade disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading first trade disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-first-trade-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:first-trade-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:first-trade-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingFirstTradeDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_first_trade_disabled_fixtures_status, "blocked");
    assert.ok(result.first_trade_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.first_trade_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingFirstTradeDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading first trade disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading first trade disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-first-trade-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-first-trade-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-first-trade-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingFirstTradeDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading order intent disabled fixtures keep order intents blocked", async () => {
  const result = await runTradingOrderIntentDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_order_intent_disabled_fixtures_status, "ready_for_trading_order_intent_disabled_regression");
  assert.equal(result.summary.phase_slot, "P393");
  assert.equal(result.summary.previous_phase_slot, "P392");
  assert.equal(result.summary.next_phase_slot, "P394");
  assert.equal(result.summary.source_first_trade_disabled_status, "ready_for_trading_first_trade_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.evidence_count, 6);
  assert.equal(result.summary.fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_order_intent_signal_count, 0);
  assert.equal(result.summary.order_intent_disabled_covered, true);
  assert.equal(result.summary.signal_to_order_intent_allowed, false);
  assert.equal(result.summary.generated_order_intent_count_present, false);
  assert.equal(result.summary.model_order_intent_generation_allowed, false);
  assert.equal(result.summary.backtest_order_intent_generated, false);
  assert.equal(result.summary.shadow_order_intent_executable, false);
  assert.equal(result.summary.market_order_allowed, false);
  assert.equal(result.summary.order_intent_route_enabled, false);
  assert.equal(result.summary.order_submit_route_enabled, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.order_intent_disabled_evidence_rows.every((row) => row.evidence_status === "order_intent_disabled" && row.unsafe_order_intent_signal_detected === false));
  assert.ok(result.order_intent_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_order_intent_generated && row.fixture_should_fail_when_order_intent_route_enabled));
  assert.ok(result.order_intent_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading order intent disabled fixtures block when order intent is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-order-intent-enabled-"));
  try {
    const signalEngine = JSON.parse(await readFile("examples/trading/signal-engine.json", "utf8"));
    signalEngine.safety_boundary.order_intent_generated = true;
    signalEngine.order_intent_boundary.signal_to_order_intent_allowed = true;
    signalEngine.order_intent_boundary.generated_order_intent_count = 1;
    signalEngine.dashboard_api_stub.disabled_routes = signalEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/signals/to-order-intent");
    const signalEnginePath = path.join(root, "signal-engine.json");
    await writeFile(signalEnginePath, `${JSON.stringify(signalEngine, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.shadow_order_intents[0].non_executable = false;
    paperShadow.shadow_order_intents[0].review_only = false;
    paperShadow.shadow_order_intents[0].live_execution_allowed = true;
    paperShadow.shadow_order_intents[0].market_order_allowed = true;
    paperShadow.no_order_shadow_mode.real_order_count = 1;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.pre_trade_risk_gate.current_result = "pass";
    executionEngine.order_controls.order_throttle.max_orders_per_day = 1;
    executionEngine.order_controls.order_throttle.blocks_order_submission = false;
    executionEngine.safety_boundary.real_order_submitted = true;
    executionEngine.dashboard_api_stub.disabled_routes = executionEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/orders/submit");
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const result = await runTradingOrderIntentDisabledFixtures({ signalEnginePath, paperShadowPath, executionEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_order_intent_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_order_intent_signal_count > 0);
    assert.equal(result.summary.signal_to_order_intent_allowed, true);
    assert.equal(result.summary.generated_order_intent_count_present, true);
    assert.equal(result.summary.order_intent_route_enabled, true);
    assert.equal(result.summary.order_submit_route_enabled, true);
    assert.equal(result.summary.shadow_order_intent_executable, true);
    assert.equal(result.summary.market_order_allowed, true);
    assert.equal(result.summary.order_throttle_missing, true);
    assert.equal(result.summary.pre_trade_risk_gate_not_blocking, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.equal(result.summary.real_order_submitted, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.ok(result.order_intent_disabled_fixture_rows.some((row) => row.row_key === "signal_to_order_intent_disabled" && row.fixture_status === "failed" && row.unsafe_order_intent_signal_detected));
    await assert.rejects(
      () => runTradingOrderIntentDisabledFixtures({ signalEnginePath, paperShadowPath, executionEnginePath, write: false, check: true }),
      /Trading order intent disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading order intent disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-order-intent-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:order-intent-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:order-intent-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingOrderIntentDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_order_intent_disabled_fixtures_status, "blocked");
    assert.ok(result.order_intent_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.order_intent_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingOrderIntentDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading order intent disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading order intent disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-order-intent-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-order-intent-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-order-intent-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingOrderIntentDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading market order disabled fixtures keep market orders blocked", async () => {
  const result = await runTradingMarketOrderDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_market_order_disabled_fixtures_status, "ready_for_trading_market_order_disabled_regression");
  assert.equal(result.summary.phase_slot, "P394");
  assert.equal(result.summary.previous_phase_slot, "P393");
  assert.equal(result.summary.next_phase_slot, "P395");
  assert.equal(result.summary.source_order_intent_disabled_status, "ready_for_trading_order_intent_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.evidence_count, 5);
  assert.equal(result.summary.fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_market_order_signal_count, 0);
  assert.equal(result.summary.market_order_disabled_covered, true);
  assert.equal(result.summary.market_orders_enabled, false);
  assert.equal(result.summary.research_market_order_allowed, false);
  assert.equal(result.summary.research_order_type_not_none, false);
  assert.equal(result.summary.strategy_no_market_order_missing, false);
  assert.equal(result.summary.shadow_market_order_allowed, false);
  assert.equal(result.summary.shadow_order_type_not_none, false);
  assert.equal(result.summary.shadow_order_intent_executable, false);
  assert.equal(result.summary.execution_order_type_whitelist_invalid, false);
  assert.equal(result.summary.execution_market_order_allowed, false);
  assert.equal(result.summary.order_throttle_missing, false);
  assert.equal(result.summary.order_submit_route_enabled, false);
  assert.equal(result.summary.limited_live_order_submission_allowed, false);
  assert.equal(result.summary.limited_live_order_route_enabled, false);
  assert.equal(result.summary.full_auto_order_submission_allowed, false);
  assert.equal(result.summary.full_auto_order_route_enabled, false);
  assert.equal(result.summary.market_order_allowed, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.market_order_disabled_evidence_rows.every((row) => row.evidence_status === "market_order_disabled" && row.unsafe_market_order_signal_detected === false));
  assert.ok(result.market_order_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_market_orders_enabled && row.fixture_should_fail_when_market_order_allowed));
  assert.ok(result.market_order_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading market order disabled fixtures block when market order paths are enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-market-order-enabled-"));
  try {
    const researchBacktestPaper = JSON.parse(await readFile("examples/trading/research-backtest-paper-sample.json", "utf8"));
    researchBacktestPaper.safety_policy.market_orders_enabled = true;
    researchBacktestPaper.contract_examples["trading-order-intent"].market_order_allowed = true;
    researchBacktestPaper.contract_examples["trading-order-intent"].order_type = "market";
    researchBacktestPaper.contract_examples["trading-strategy"].tradability_constraints = researchBacktestPaper.contract_examples["trading-strategy"].tradability_constraints.filter((constraint) => constraint !== "no_market_order");
    const researchBacktestPaperPath = path.join(root, "research-backtest-paper-sample.json");
    await writeFile(researchBacktestPaperPath, `${JSON.stringify(researchBacktestPaper, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.shadow_order_intents[0].market_order_allowed = true;
    paperShadow.shadow_order_intents[0].order_type = "market";
    paperShadow.shadow_order_intents[0].non_executable = false;
    paperShadow.no_order_shadow_mode.real_order_count = 1;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.order_type_whitelist.allowed_order_types.push("market");
    executionEngine.order_type_whitelist.market_order_allowed = true;
    executionEngine.order_controls.order_throttle.max_orders_per_day = 1;
    executionEngine.order_controls.order_throttle.blocks_order_submission = false;
    executionEngine.safety_boundary.real_order_submitted = true;
    executionEngine.dashboard_api_stub.disabled_routes = executionEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/orders/submit");
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    limitedLive.order_caps.order_submission_allowed = true;
    limitedLive.dashboard_api_stub.disabled_routes = limitedLive.dashboard_api_stub.disabled_routes.filter((route) => !["/api/trading/orders", "/api/trading/limited-live/orders"].includes(route.path));
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.safety_boundary.full_auto_enabled = true;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    fullAuto.safety_boundary.live_order_submission_allowed = true;
    fullAuto.dashboard_api_stub.disabled_routes = fullAuto.dashboard_api_stub.disabled_routes.filter((route) => !["/api/trading/orders", "/api/trading/full-auto/orders"].includes(route.path));
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingMarketOrderDisabledFixtures({ researchBacktestPaperPath, paperShadowPath, executionEnginePath, limitedLivePath, fullAutoPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_market_order_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_market_order_signal_count > 0);
    assert.equal(result.summary.market_orders_enabled, true);
    assert.equal(result.summary.research_market_order_allowed, true);
    assert.equal(result.summary.research_order_type_not_none, true);
    assert.equal(result.summary.strategy_no_market_order_missing, true);
    assert.equal(result.summary.shadow_market_order_allowed, true);
    assert.equal(result.summary.shadow_order_type_not_none, true);
    assert.equal(result.summary.shadow_order_intent_executable, true);
    assert.equal(result.summary.execution_order_type_whitelist_invalid, true);
    assert.equal(result.summary.execution_market_order_allowed, true);
    assert.equal(result.summary.order_throttle_missing, true);
    assert.equal(result.summary.order_submit_route_enabled, true);
    assert.equal(result.summary.limited_live_order_submission_allowed, true);
    assert.equal(result.summary.limited_live_order_route_enabled, true);
    assert.equal(result.summary.full_auto_order_submission_allowed, true);
    assert.equal(result.summary.full_auto_order_route_enabled, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.market_order_allowed, true);
    assert.equal(result.summary.real_order_submitted, true);
    assert.ok(result.market_order_disabled_fixture_rows.some((row) => row.row_key === "research_market_order_policy_disabled" && row.fixture_status === "failed" && row.unsafe_market_order_signal_detected));
    await assert.rejects(
      () => runTradingMarketOrderDisabledFixtures({ researchBacktestPaperPath, paperShadowPath, executionEnginePath, limitedLivePath, fullAutoPath, write: false, check: true }),
      /Trading market order disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading market order disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-market-order-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:market-order-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:market-order-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingMarketOrderDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_market_order_disabled_fixtures_status, "blocked");
    assert.ok(result.market_order_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.market_order_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingMarketOrderDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading market order disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading market order disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-market-order-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-market-order-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-market-order-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingMarketOrderDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading leverage disabled fixtures keep leverage and margin blocked", async () => {
  const result = await runTradingLeverageDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_leverage_disabled_fixtures_status, "ready_for_trading_leverage_disabled_regression");
  assert.equal(result.summary.phase_slot, "P395");
  assert.equal(result.summary.previous_phase_slot, "P394");
  assert.equal(result.summary.next_phase_slot, "P396");
  assert.equal(result.summary.source_market_order_disabled_status, "ready_for_trading_market_order_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.evidence_count, 5);
  assert.equal(result.summary.fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.failed_fixture_count, 0);
  assert.equal(result.summary.unsafe_leverage_signal_count, 0);
  assert.equal(result.summary.leverage_disabled_covered, true);
  assert.equal(result.summary.leverage_enabled, false);
  assert.equal(result.summary.derivatives_enabled, false);
  assert.equal(result.summary.asset_leverage_allowed, false);
  assert.equal(result.summary.asset_derivatives_allowed, false);
  assert.equal(result.summary.asset_live_trading_allowed, false);
  assert.equal(result.summary.strategy_no_leverage_missing, false);
  assert.equal(result.summary.strategy_live_eligible, false);
  assert.equal(result.summary.strategy_live_stage_allowed, false);
  assert.equal(result.summary.backtest_leverage_allowed, false);
  assert.equal(result.summary.backtest_position_size_unbounded, false);
  assert.equal(result.summary.risk_leverage_allowed, false);
  assert.equal(result.summary.risk_margin_allowed, false);
  assert.equal(result.summary.leverage_margin_gate_not_blocking, false);
  assert.equal(result.summary.leverage_margin_not_blocking_order_intent, false);
  assert.equal(result.summary.leverage_risk_check_not_blocking, false);
  assert.equal(result.summary.market_order_allowed, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.real_order_submitted, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.leverage_disabled_evidence_rows.every((row) => row.evidence_status === "leverage_disabled" && row.unsafe_leverage_signal_detected === false));
  assert.ok(result.leverage_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_leverage_enabled && row.fixture_should_fail_when_margin_enabled));
  assert.ok(result.leverage_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading leverage disabled fixtures block when leverage or margin is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-leverage-enabled-"));
  try {
    const researchBacktestPaper = JSON.parse(await readFile("examples/trading/research-backtest-paper-sample.json", "utf8"));
    researchBacktestPaper.safety_policy.leverage_enabled = true;
    researchBacktestPaper.safety_policy.derivatives_enabled = true;
    researchBacktestPaper.contract_examples["trading-asset"].capability_flags.leverage_allowed = true;
    researchBacktestPaper.contract_examples["trading-asset"].capability_flags.derivatives_allowed = true;
    researchBacktestPaper.contract_examples["trading-asset"].capability_flags.live_trading_allowed = true;
    researchBacktestPaper.contract_examples["trading-asset"].tradability_status = "live_allowed";
    researchBacktestPaper.contract_examples["trading-strategy"].tradability_constraints = researchBacktestPaper.contract_examples["trading-strategy"].tradability_constraints.filter((constraint) => constraint !== "no_leverage");
    researchBacktestPaper.contract_examples["trading-strategy"].live_eligible = true;
    researchBacktestPaper.contract_examples["trading-strategy"].allowed_stages.push("live");
    const researchBacktestPaperPath = path.join(root, "research-backtest-paper-sample.json");
    await writeFile(researchBacktestPaperPath, `${JSON.stringify(researchBacktestPaper, null, 2)}\n`, "utf8");

    const backtestValidation = JSON.parse(await readFile("examples/trading/backtest-validation.json", "utf8"));
    backtestValidation.position_sizing.leverage_allowed = true;
    backtestValidation.position_sizing.max_position_pct = 1.5;
    backtestValidation.safety_boundary.live_execution_allowed = true;
    backtestValidation.safety_boundary.order_intent_generated = true;
    const backtestValidationPath = path.join(root, "backtest-validation.json");
    await writeFile(backtestValidationPath, `${JSON.stringify(backtestValidation, null, 2)}\n`, "utf8");

    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.risk_guards.leverage_margin_gate.leverage_allowed = true;
    riskEngine.risk_guards.leverage_margin_gate.margin_allowed = true;
    riskEngine.risk_guards.leverage_margin_gate.result = "pass";
    riskEngine.risk_guards.leverage_margin_gate.blocks_order_intent = false;
    riskEngine.risk_check_artifacts[0].checks = riskEngine.risk_check_artifacts[0].checks.map((check) => (
      check.check_id === "leverage_margin_disabled" ? { ...check, status: "pass" } : check
    ));
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const result = await runTradingLeverageDisabledFixtures({ researchBacktestPaperPath, backtestValidationPath, riskEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_leverage_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_leverage_signal_count > 0);
    assert.equal(result.summary.leverage_enabled, true);
    assert.equal(result.summary.derivatives_enabled, true);
    assert.equal(result.summary.asset_leverage_allowed, true);
    assert.equal(result.summary.asset_derivatives_allowed, true);
    assert.equal(result.summary.asset_live_trading_allowed, true);
    assert.equal(result.summary.asset_not_paper_allowed, true);
    assert.equal(result.summary.strategy_no_leverage_missing, true);
    assert.equal(result.summary.strategy_live_eligible, true);
    assert.equal(result.summary.strategy_live_stage_allowed, true);
    assert.equal(result.summary.backtest_leverage_allowed, true);
    assert.equal(result.summary.backtest_position_size_unbounded, true);
    assert.equal(result.summary.backtest_live_execution_allowed, true);
    assert.equal(result.summary.backtest_order_intent_generated, true);
    assert.equal(result.summary.risk_leverage_allowed, true);
    assert.equal(result.summary.risk_margin_allowed, true);
    assert.equal(result.summary.leverage_margin_gate_not_blocking, true);
    assert.equal(result.summary.leverage_margin_not_blocking_order_intent, true);
    assert.equal(result.summary.leverage_risk_check_not_blocking, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.ok(result.leverage_disabled_fixture_rows.some((row) => row.row_key === "risk_leverage_margin_gate_blocks" && row.fixture_status === "failed" && row.unsafe_leverage_signal_detected));
    await assert.rejects(
      () => runTradingLeverageDisabledFixtures({ researchBacktestPaperPath, backtestValidationPath, riskEnginePath, write: false, check: true }),
      /Trading leverage disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading leverage disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-leverage-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:leverage-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:leverage-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingLeverageDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_leverage_disabled_fixtures_status, "blocked");
    assert.ok(result.leverage_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.leverage_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingLeverageDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading leverage disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading leverage disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-leverage-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-leverage-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-leverage-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingLeverageDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading short selling disabled fixtures keep short selling blocked", async () => {
  const result = await runTradingShortSellingDisabledFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_short_selling_disabled_fixtures_status, "ready_for_trading_short_selling_disabled_regression");
  assert.equal(result.summary.phase_slot, "P396");
  assert.equal(result.summary.previous_phase_slot, "P395");
  assert.equal(result.summary.next_phase_slot, "P397");
  assert.equal(result.summary.source_leverage_disabled_status, "ready_for_trading_leverage_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 5);
  assert.equal(result.summary.passed_fixture_count, 5);
  assert.equal(result.summary.unsafe_short_selling_signal_count, 0);
  assert.equal(result.summary.short_selling_disabled_covered, true);
  assert.equal(result.summary.short_selling_enabled, false);
  assert.equal(result.summary.asset_short_allowed, false);
  assert.equal(result.summary.strategy_no_short_missing, false);
  assert.equal(result.summary.paper_short_order_present, false);
  assert.equal(result.summary.risk_short_selling_allowed, false);
  assert.equal(result.summary.risk_korea_short_check_missing, false);
  assert.equal(result.summary.short_selling_gate_not_blocking, false);
  assert.equal(result.summary.short_selling_not_blocking_order_intent, false);
  assert.equal(result.summary.short_selling_risk_check_not_blocking, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.short_selling_disabled_evidence_rows.every((row) => row.evidence_status === "short_selling_disabled" && row.unsafe_short_selling_signal_detected === false));
  assert.ok(result.short_selling_disabled_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_short_selling_enabled));
  assert.ok(result.short_selling_disabled_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading short selling disabled fixtures block when short selling is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-short-selling-enabled-"));
  try {
    const researchBacktestPaper = JSON.parse(await readFile("examples/trading/research-backtest-paper-sample.json", "utf8"));
    researchBacktestPaper.safety_policy.short_selling_enabled = true;
    researchBacktestPaper.contract_examples["trading-asset"].capability_flags.short_allowed = true;
    researchBacktestPaper.contract_examples["trading-strategy"].tradability_constraints = researchBacktestPaper.contract_examples["trading-strategy"].tradability_constraints.filter((constraint) => constraint !== "no_short");
    researchBacktestPaper.contract_examples["trading-strategy"].live_eligible = true;
    researchBacktestPaper.contract_examples["trading-strategy"].allowed_stages.push("live");
    researchBacktestPaper.contract_examples["trading-paper-trade"].orders[0].side = "sell_short";
    researchBacktestPaper.contract_examples["trading-paper-trade"].promotion_status = "eligible";
    researchBacktestPaper.contract_examples["trading-order-intent"].order_side = "short";
    researchBacktestPaper.contract_examples["trading-order-intent"].live_execution_allowed = true;
    const researchBacktestPaperPath = path.join(root, "research-backtest-paper-sample.json");
    await writeFile(researchBacktestPaperPath, `${JSON.stringify(researchBacktestPaper, null, 2)}\n`, "utf8");

    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.risk_guards.short_selling_capability_gate.short_selling_allowed = true;
    riskEngine.risk_guards.short_selling_capability_gate.korea_short_check_required = false;
    riskEngine.risk_guards.short_selling_capability_gate.result = "pass";
    riskEngine.risk_guards.short_selling_capability_gate.blocks_order_intent = false;
    riskEngine.risk_check_artifacts[0].checks = riskEngine.risk_check_artifacts[0].checks.map((check) => (
      check.check_id === "short_selling_capability_gate" ? { ...check, status: "pass" } : check
    ));
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const result = await runTradingShortSellingDisabledFixtures({ researchBacktestPaperPath, riskEnginePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_short_selling_disabled_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_short_selling_signal_count > 0);
    assert.equal(result.summary.short_selling_enabled, true);
    assert.equal(result.summary.asset_short_allowed, true);
    assert.equal(result.summary.strategy_no_short_missing, true);
    assert.equal(result.summary.strategy_live_eligible, true);
    assert.equal(result.summary.strategy_live_stage_allowed, true);
    assert.equal(result.summary.paper_short_order_present, true);
    assert.equal(result.summary.paper_promotion_eligible, true);
    assert.equal(result.summary.order_intent_short_side_present, true);
    assert.equal(result.summary.order_intent_live_execution_allowed, true);
    assert.equal(result.summary.risk_short_selling_allowed, true);
    assert.equal(result.summary.risk_korea_short_check_missing, true);
    assert.equal(result.summary.short_selling_gate_not_blocking, true);
    assert.equal(result.summary.short_selling_not_blocking_order_intent, true);
    assert.equal(result.summary.short_selling_risk_check_not_blocking, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.ok(result.short_selling_disabled_fixture_rows.some((row) => row.row_key === "risk_short_selling_capability_gate_blocks" && row.fixture_status === "failed" && row.unsafe_short_selling_signal_detected));
    await assert.rejects(
      () => runTradingShortSellingDisabledFixtures({ researchBacktestPaperPath, riskEnginePath, write: false, check: true }),
      /Trading short selling disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading short selling disabled fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-short-selling-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:short-selling-disabled-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:short-selling-disabled-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingShortSellingDisabledFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_short_selling_disabled_fixtures_status, "blocked");
    assert.ok(result.short_selling_disabled_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.short_selling_disabled_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingShortSellingDisabledFixtures({ packagePath, write: false, check: true }),
      /Trading short selling disabled fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading short selling disabled fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-short-selling-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-short-selling-disabled-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-short-selling-disabled-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingShortSellingDisabledFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading order frequency throttle fixtures keep order generation blocked", async () => {
  const result = await runTradingOrderFrequencyThrottleFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_order_frequency_throttle_fixtures_status, "ready_for_trading_order_frequency_throttle_regression");
  assert.equal(result.summary.phase_slot, "P397");
  assert.equal(result.summary.previous_phase_slot, "P396");
  assert.equal(result.summary.next_phase_slot, "P398");
  assert.equal(result.summary.source_short_selling_disabled_status, "ready_for_trading_short_selling_disabled_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.unsafe_order_frequency_signal_count, 0);
  assert.equal(result.summary.order_frequency_throttle_covered, true);
  assert.equal(result.summary.signal_order_intent_generated, false);
  assert.equal(result.summary.signal_to_order_intent_route_enabled, false);
  assert.equal(result.summary.risk_order_frequency_max_not_zero, false);
  assert.equal(result.summary.risk_order_frequency_current_nonzero, false);
  assert.equal(result.summary.risk_order_frequency_not_blocking, false);
  assert.equal(result.summary.risk_order_frequency_not_blocking_order_intent, false);
  assert.equal(result.summary.risk_order_frequency_check_not_blocking, false);
  assert.equal(result.summary.execution_order_frequency_max_not_zero, false);
  assert.equal(result.summary.execution_current_orders_nonzero, false);
  assert.equal(result.summary.execution_order_throttle_not_blocking, false);
  assert.equal(result.summary.execution_submit_route_enabled, false);
  assert.equal(result.summary.limited_live_order_cap_max_not_zero, false);
  assert.equal(result.summary.limited_live_current_orders_nonzero, false);
  assert.equal(result.summary.limited_live_order_cap_not_enforced, false);
  assert.equal(result.summary.limited_live_order_cap_not_blocking, false);
  assert.equal(result.summary.limited_live_order_submission_allowed, false);
  assert.equal(result.summary.shadow_order_intents_executable, false);
  assert.equal(result.summary.shadow_real_order_count_nonzero, false);
  assert.equal(result.summary.full_auto_order_generation_allowed, false);
  assert.equal(result.summary.full_auto_automatic_order_submission_allowed, false);
  assert.equal(result.summary.full_auto_live_order_submission_allowed, false);
  assert.equal(result.summary.full_auto_orders_route_enabled, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.order_frequency_throttle_evidence_rows.every((row) => row.evidence_status === "order_frequency_throttled" && row.unsafe_order_frequency_signal_detected === false));
  assert.ok(result.order_frequency_throttle_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_order_frequency_enabled));
  assert.ok(result.order_frequency_throttle_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading order frequency throttle fixtures block when order generation is enabled", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-order-frequency-enabled-"));
  try {
    const signalEngine = JSON.parse(await readFile("examples/trading/signal-engine.json", "utf8"));
    signalEngine.safety_boundary.order_intent_generated = true;
    signalEngine.safety_boundary.live_execution_allowed = true;
    signalEngine.dashboard_api_stub.disabled_routes = signalEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/signals/to-order-intent");
    const signalEnginePath = path.join(root, "signal-engine.json");
    await writeFile(signalEnginePath, `${JSON.stringify(signalEngine, null, 2)}\n`, "utf8");

    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.risk_guards.order_frequency_throttle.max_orders_per_day = 25;
    riskEngine.risk_guards.order_frequency_throttle.current_orders_today = 1;
    riskEngine.risk_guards.order_frequency_throttle.result = "pass";
    riskEngine.risk_guards.order_frequency_throttle.blocks_order_intent = false;
    riskEngine.risk_check_artifacts[0].checks = riskEngine.risk_check_artifacts[0].checks.map((check) => (
      check.check_id === "order_frequency_throttle" ? { ...check, status: "pass" } : check
    ));
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.order_controls.order_throttle.max_orders_per_day = 25;
    executionEngine.order_controls.order_throttle.current_orders_today = 1;
    executionEngine.order_controls.order_throttle.blocks_order_submission = false;
    executionEngine.dashboard_api_stub.disabled_routes = executionEngine.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/orders/submit");
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.order_caps.daily_order_count_cap.max_orders_per_day = 25;
    limitedLive.order_caps.daily_order_count_cap.current_orders_today = 1;
    limitedLive.order_caps.daily_order_count_cap.enforced = false;
    limitedLive.order_caps.daily_order_count_cap.blocks_submission = false;
    limitedLive.order_caps.order_submission_allowed = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.safety_boundary.shadow_order_intent_non_executable = false;
    paperShadow.shadow_order_intents[0].non_executable = false;
    paperShadow.shadow_order_intents[0].review_only = false;
    paperShadow.shadow_order_intents[0].risk_gate_status = "pass";
    paperShadow.no_order_shadow_mode.real_order_count = 1;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.allocators.multi_strategy_conflict_resolver.order_generation_allowed = true;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    fullAuto.safety_boundary.live_order_submission_allowed = true;
    fullAuto.dashboard_api_stub.disabled_routes = fullAuto.dashboard_api_stub.disabled_routes.filter((route) => route.path !== "/api/trading/full-auto/orders" && route.path !== "/api/trading/orders");
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingOrderFrequencyThrottleFixtures({
      signalEnginePath,
      riskEnginePath,
      executionEnginePath,
      limitedLivePath,
      paperShadowPath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_order_frequency_throttle_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_order_frequency_signal_count > 0);
    assert.equal(result.summary.signal_order_intent_generated, true);
    assert.equal(result.summary.signal_to_order_intent_route_enabled, true);
    assert.equal(result.summary.risk_order_frequency_max_not_zero, true);
    assert.equal(result.summary.risk_order_frequency_current_nonzero, true);
    assert.equal(result.summary.risk_order_frequency_not_blocking, true);
    assert.equal(result.summary.risk_order_frequency_not_blocking_order_intent, true);
    assert.equal(result.summary.risk_order_frequency_check_not_blocking, true);
    assert.equal(result.summary.execution_order_frequency_max_not_zero, true);
    assert.equal(result.summary.execution_current_orders_nonzero, true);
    assert.equal(result.summary.execution_order_throttle_not_blocking, true);
    assert.equal(result.summary.execution_submit_route_enabled, true);
    assert.equal(result.summary.limited_live_order_cap_max_not_zero, true);
    assert.equal(result.summary.limited_live_current_orders_nonzero, true);
    assert.equal(result.summary.limited_live_order_cap_not_enforced, true);
    assert.equal(result.summary.limited_live_order_cap_not_blocking, true);
    assert.equal(result.summary.limited_live_order_submission_allowed, true);
    assert.equal(result.summary.shadow_order_intents_executable, true);
    assert.equal(result.summary.shadow_real_order_count_nonzero, true);
    assert.equal(result.summary.full_auto_order_generation_allowed, true);
    assert.equal(result.summary.full_auto_automatic_order_submission_allowed, true);
    assert.equal(result.summary.full_auto_live_order_submission_allowed, true);
    assert.equal(result.summary.full_auto_orders_route_enabled, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.ok(result.order_frequency_throttle_fixture_rows.some((row) => row.row_key === "risk_order_frequency_throttle_blocks" && row.fixture_status === "failed" && row.unsafe_order_frequency_signal_detected));
    await assert.rejects(
      () => runTradingOrderFrequencyThrottleFixtures({
        signalEnginePath,
        riskEnginePath,
        executionEnginePath,
        limitedLivePath,
        paperShadowPath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading order frequency throttle fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading order frequency throttle fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-order-frequency-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:order-frequency-throttle-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:order-frequency-throttle-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingOrderFrequencyThrottleFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_order_frequency_throttle_fixtures_status, "blocked");
    assert.ok(result.order_frequency_throttle_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.order_frequency_throttle_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingOrderFrequencyThrottleFixtures({ packagePath, write: false, check: true }),
      /Trading order frequency throttle fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading order frequency throttle fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-order-frequency-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-order-frequency-throttle-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-order-frequency-throttle-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingOrderFrequencyThrottleFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading loss streak cooldown fixtures keep cooldown and halt paths human gated", async () => {
  const result = await runTradingLossStreakCooldownFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_loss_streak_cooldown_fixtures_status, "ready_for_trading_loss_streak_cooldown_regression");
  assert.equal(result.summary.phase_slot, "P398");
  assert.equal(result.summary.previous_phase_slot, "P397");
  assert.equal(result.summary.next_phase_slot, "P399");
  assert.equal(result.summary.source_order_frequency_throttle_status, "ready_for_trading_order_frequency_throttle_regression");
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.unsafe_loss_streak_signal_count, 0);
  assert.equal(result.summary.loss_streak_cooldown_covered, true);
  assert.equal(result.summary.loss_streak_count_nonzero, false);
  assert.equal(result.summary.cooldown_threshold_missing, false);
  assert.equal(result.summary.cooldown_active, false);
  assert.equal(result.summary.loss_streak_result_not_pass, false);
  assert.equal(result.summary.loss_streak_check_not_pass, false);
  assert.equal(result.summary.risk_halt_without_human_resume, false);
  assert.equal(result.summary.risk_block_not_preventing_order_intent, false);
  assert.equal(result.summary.risk_override_without_human_allowed, false);
  assert.equal(result.summary.paper_drawdown_outside_fixture, false);
  assert.equal(result.summary.paper_scorecard_not_blocked, false);
  assert.equal(result.summary.paper_human_review_missing, false);
  assert.equal(result.summary.limited_live_daily_loss_halt_not_armed, false);
  assert.equal(result.summary.limited_live_daily_loss_halt_triggered, false);
  assert.equal(result.summary.limited_live_order_submission_allowed, false);
  assert.equal(result.summary.emergency_halt_unavailable, false);
  assert.equal(result.summary.emergency_halt_not_halted, false);
  assert.equal(result.summary.emergency_halt_not_manual_resume, false);
  assert.equal(result.summary.emergency_halt_cancels_live_orders, false);
  assert.equal(result.summary.full_auto_disable_policy_not_control_plane, false);
  assert.equal(result.summary.full_auto_live_orders_touched, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.loss_streak_cooldown_evidence_rows.every((row) => row.evidence_status === "loss_streak_cooldown_ready" && row.unsafe_loss_streak_signal_detected === false));
  assert.ok(result.loss_streak_cooldown_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_loss_streak_bypassed));
  assert.ok(result.loss_streak_cooldown_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading loss streak cooldown fixtures block when cooldown is bypassed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-loss-streak-bypass-"));
  try {
    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.risk_guards.loss_streak_cooldown.loss_streak_count = 4;
    riskEngine.risk_guards.loss_streak_cooldown.cooldown_required_after_losses = 0;
    riskEngine.risk_guards.loss_streak_cooldown.cooldown_active = true;
    riskEngine.risk_guards.loss_streak_cooldown.result = "pass";
    riskEngine.risk_result_policy.block_prevents_order_intent = false;
    riskEngine.risk_result_policy.halt_prevents_resume_without_human = false;
    riskEngine.override_policy.requires_human_approval = false;
    riskEngine.safety_boundary.risk_override_without_human_allowed = true;
    riskEngine.risk_check_artifacts[0].checks = riskEngine.risk_check_artifacts[0].checks.map((check) => (
      check.check_id === "loss_streak_cooldown" ? { ...check, status: "halt" } : check
    ));
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.paper_drawdown.drawdown_pct = -0.25;
    paperShadow.strategy_paper_scorecards[0].paper_status = "eligible";
    paperShadow.strategy_paper_scorecards[0].human_review_required = false;
    paperShadow.safety_boundary.real_order_submitted = true;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.halt_gates.daily_loss_halt.enabled = false;
    limitedLive.halt_gates.daily_loss_halt.triggered = true;
    limitedLive.halt_gates.daily_loss_halt.halt_on_trigger = false;
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const executionEngine = JSON.parse(await readFile("examples/trading/execution-engine.json", "utf8"));
    executionEngine.emergency_halt.available = false;
    executionEngine.emergency_halt.halt_state = "blocked";
    executionEngine.emergency_halt.manual_resume_required = false;
    executionEngine.emergency_halt.cancels_live_orders = true;
    const executionEnginePath = path.join(root, "execution-engine.json");
    await writeFile(executionEnginePath, `${JSON.stringify(executionEngine, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.enabled = false;
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.trigger_results = ["warn", "block"];
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.control_plane_state_change_only = false;
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.live_orders_touched = true;
    fullAuto.safety_boundary.full_auto_enabled = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingLossStreakCooldownFixtures({
      riskEnginePath,
      paperShadowPath,
      limitedLivePath,
      executionEnginePath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_loss_streak_cooldown_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_loss_streak_signal_count > 0);
    assert.equal(result.summary.loss_streak_count_nonzero, true);
    assert.equal(result.summary.cooldown_threshold_missing, true);
    assert.equal(result.summary.cooldown_active, true);
    assert.equal(result.summary.loss_streak_check_not_pass, true);
    assert.equal(result.summary.risk_halt_without_human_resume, true);
    assert.equal(result.summary.risk_block_not_preventing_order_intent, true);
    assert.equal(result.summary.risk_override_without_human_allowed, true);
    assert.equal(result.summary.paper_drawdown_outside_fixture, true);
    assert.equal(result.summary.paper_scorecard_not_blocked, true);
    assert.equal(result.summary.paper_human_review_missing, true);
    assert.equal(result.summary.paper_real_order_submitted, true);
    assert.equal(result.summary.limited_live_daily_loss_halt_not_armed, true);
    assert.equal(result.summary.limited_live_daily_loss_halt_triggered, true);
    assert.equal(result.summary.limited_live_order_submission_allowed, true);
    assert.equal(result.summary.emergency_halt_unavailable, true);
    assert.equal(result.summary.emergency_halt_not_halted, true);
    assert.equal(result.summary.emergency_halt_not_manual_resume, true);
    assert.equal(result.summary.emergency_halt_cancels_live_orders, true);
    assert.equal(result.summary.full_auto_disable_policy_not_control_plane, true);
    assert.equal(result.summary.full_auto_live_orders_touched, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.ok(result.loss_streak_cooldown_fixture_rows.some((row) => row.row_key === "risk_loss_streak_cooldown_declared" && row.fixture_status === "failed" && row.unsafe_loss_streak_signal_detected));
    await assert.rejects(
      () => runTradingLossStreakCooldownFixtures({
        riskEnginePath,
        paperShadowPath,
        limitedLivePath,
        executionEnginePath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading loss streak cooldown fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading loss streak cooldown fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-loss-streak-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:loss-streak-cooldown-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:loss-streak-cooldown-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingLossStreakCooldownFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_loss_streak_cooldown_fixtures_status, "blocked");
    assert.ok(result.loss_streak_cooldown_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.loss_streak_cooldown_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingLossStreakCooldownFixtures({ packagePath, write: false, check: true }),
      /Trading loss streak cooldown fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading loss streak cooldown fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-loss-streak-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-loss-streak-cooldown-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-loss-streak-cooldown-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingLossStreakCooldownFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading model degradation halt fixtures keep model halt paths human gated", async () => {
  const result = await runTradingModelDegradationHaltFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_model_degradation_halt_fixtures_status, "ready_for_trading_model_degradation_halt_regression");
  assert.equal(result.summary.phase_slot, "P399");
  assert.equal(result.summary.previous_phase_slot, "P398");
  assert.equal(result.summary.next_phase_slot, "P400");
  assert.equal(result.summary.source_loss_streak_cooldown_status, "ready_for_trading_loss_streak_cooldown_regression");
  assert.equal(result.summary.source_loss_streak_cooldown_ready, true);
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.unsafe_model_degradation_signal_count, 0);
  assert.equal(result.summary.model_degradation_halt_covered, true);
  assert.equal(result.summary.risk_model_degradation_source_unbound, false);
  assert.equal(result.summary.risk_degradation_result_not_pass, false);
  assert.equal(result.summary.risk_model_degradation_halt_not_armed, false);
  assert.equal(result.summary.risk_model_degradation_result_not_pass, false);
  assert.equal(result.summary.risk_model_degradation_check_not_pass, false);
  assert.equal(result.summary.model_registry_missing, false);
  assert.equal(result.summary.model_degradation_checks_missing, false);
  assert.equal(result.summary.model_degradation_checks_allow_promotion, false);
  assert.equal(result.summary.model_degradation_halt_present, false);
  assert.equal(result.summary.model_auto_live_promotion_allowed, false);
  assert.equal(result.summary.model_live_deployment_allowed, false);
  assert.equal(result.summary.research_model_not_research_only, false);
  assert.equal(result.summary.research_model_live_deployed, false);
  assert.equal(result.summary.research_model_degradation_not_none, false);
  assert.equal(result.summary.research_model_drift_not_none, false);
  assert.equal(result.summary.research_live_trading_enabled, false);
  assert.equal(result.summary.research_full_auto_not_blocked, false);
  assert.equal(result.summary.limited_live_model_degradation_source_unbound, false);
  assert.equal(result.summary.limited_live_model_degradation_result_not_pass, false);
  assert.equal(result.summary.limited_live_model_degradation_halt_not_armed, false);
  assert.equal(result.summary.limited_live_model_enabled, false);
  assert.equal(result.summary.limited_live_order_submission_allowed, false);
  assert.equal(result.summary.full_auto_degradation_disable_not_control_plane, false);
  assert.equal(result.summary.full_auto_model_drift_disable_not_control_plane, false);
  assert.equal(result.summary.full_auto_live_orders_touched, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.model_automated_live_deployment_allowed, false);
  assert.equal(result.summary.model_order_intent_generated, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.model_degradation_halt_evidence_rows.every((row) => row.evidence_status === "model_degradation_halt_ready" && row.unsafe_model_degradation_signal_detected === false));
  assert.ok(result.model_degradation_halt_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_model_degradation_bypassed && row.fixture_should_fail_when_promotion_enabled && row.fixture_should_fail_when_live_model_enabled));
  assert.ok(result.model_degradation_halt_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading model degradation halt fixtures block when model degradation halt is bypassed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-model-degradation-bypass-"));
  try {
    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.risk_guards.model_degradation_halt.source_ref = "degradation.missing";
    riskEngine.risk_guards.model_degradation_halt.degradation_result = "halt";
    riskEngine.risk_guards.model_degradation_halt.halt_on_degradation = false;
    riskEngine.risk_guards.model_degradation_halt.result = "halt";
    riskEngine.safety_boundary.order_intent_generated = true;
    riskEngine.safety_boundary.live_execution_allowed = true;
    riskEngine.risk_check_artifacts[0].checks = riskEngine.risk_check_artifacts[0].checks.map((check) => (
      check.check_id === "model_degradation_halt" ? { ...check, status: "halt" } : check
    ));
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const modelImprovement = JSON.parse(await readFile("examples/trading/model-improvement-layer.json", "utf8"));
    modelImprovement.degradation_checks = modelImprovement.degradation_checks.map((check) => (
      check.check_id === "degradation.baseline_rule.validation_delta" ? { ...check, result: "halt", blocks_promotion: false } : check
    ));
    modelImprovement.promotion_policy_gate.auto_live_promotion_allowed = true;
    modelImprovement.live_deployment_boundary.live_deployment_allowed = true;
    modelImprovement.safety_boundary.automated_live_deployment_allowed = true;
    modelImprovement.safety_boundary.order_intent_generated = true;
    const modelImprovementPath = path.join(root, "model-improvement-layer.json");
    await writeFile(modelImprovementPath, `${JSON.stringify(modelImprovement, null, 2)}\n`, "utf8");

    const researchBacktestPaper = JSON.parse(await readFile("examples/trading/research-backtest-paper-sample.json", "utf8"));
    researchBacktestPaper.contract_examples["trading-model"].research_only = false;
    researchBacktestPaper.contract_examples["trading-model"].deployment_stage = "live";
    researchBacktestPaper.contract_examples["trading-model"].scorecard.degradation_status = "halt";
    researchBacktestPaper.contract_examples["trading-model"].scorecard.drift_status = "halt";
    researchBacktestPaper.safety_policy.live_trading_enabled = true;
    researchBacktestPaper.stage_policy.full_auto = "active";
    const researchBacktestPaperPath = path.join(root, "research-backtest-paper-sample.json");
    await writeFile(researchBacktestPaperPath, `${JSON.stringify(researchBacktestPaper, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.model_live_degradation_check.source_ref = "degradation.missing";
    limitedLive.model_live_degradation_check.result = "halt";
    limitedLive.model_live_degradation_check.halt_on_degradation = false;
    limitedLive.model_live_degradation_check.live_model_enabled = true;
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.enabled = false;
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.trigger_results = ["warn", "block"];
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.control_plane_state_change_only = false;
    fullAuto.automatic_disable_policies.strategy_disable_on_degradation.live_orders_touched = true;
    fullAuto.automatic_disable_policies.model_disable_on_drift.control_plane_state_change_only = false;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    fullAuto.safety_boundary.broker_write_allowed = true;
    fullAuto.safety_boundary.exchange_write_allowed = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingModelDegradationHaltFixtures({
      riskEnginePath,
      modelImprovementPath,
      researchBacktestPaperPath,
      limitedLivePath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_model_degradation_halt_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_model_degradation_signal_count > 0);
    assert.equal(result.summary.risk_model_degradation_source_unbound, true);
    assert.equal(result.summary.risk_degradation_result_not_pass, true);
    assert.equal(result.summary.risk_model_degradation_halt_not_armed, true);
    assert.equal(result.summary.risk_model_degradation_result_not_pass, true);
    assert.equal(result.summary.risk_model_degradation_check_not_pass, true);
    assert.equal(result.summary.model_degradation_checks_allow_promotion, true);
    assert.equal(result.summary.model_degradation_halt_present, true);
    assert.equal(result.summary.model_auto_live_promotion_allowed, true);
    assert.equal(result.summary.model_live_deployment_allowed, true);
    assert.equal(result.summary.research_model_not_research_only, true);
    assert.equal(result.summary.research_model_live_deployed, true);
    assert.equal(result.summary.research_model_degradation_not_none, true);
    assert.equal(result.summary.research_model_drift_not_none, true);
    assert.equal(result.summary.research_live_trading_enabled, true);
    assert.equal(result.summary.research_full_auto_not_blocked, true);
    assert.equal(result.summary.limited_live_model_degradation_source_unbound, true);
    assert.equal(result.summary.limited_live_model_degradation_result_not_pass, true);
    assert.equal(result.summary.limited_live_model_degradation_halt_not_armed, true);
    assert.equal(result.summary.limited_live_model_enabled, true);
    assert.equal(result.summary.limited_live_order_submission_allowed, true);
    assert.equal(result.summary.full_auto_degradation_disable_not_control_plane, true);
    assert.equal(result.summary.full_auto_model_drift_disable_not_control_plane, true);
    assert.equal(result.summary.full_auto_live_orders_touched, true);
    assert.equal(result.summary.automatic_order_submission_allowed, true);
    assert.equal(result.summary.model_automated_live_deployment_allowed, true);
    assert.equal(result.summary.model_order_intent_generated, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.equal(result.summary.broker_write_allowed, true);
    assert.equal(result.summary.exchange_write_allowed, true);
    assert.ok(result.model_degradation_halt_fixture_rows.some((row) => row.row_key === "risk_model_degradation_halt_declared" && row.fixture_status === "failed" && row.unsafe_model_degradation_signal_detected));
    await assert.rejects(
      () => runTradingModelDegradationHaltFixtures({
        riskEnginePath,
        modelImprovementPath,
        researchBacktestPaperPath,
        limitedLivePath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading model degradation halt fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading model degradation halt fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-model-degradation-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:model-degradation-halt-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:model-degradation-halt-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingModelDegradationHaltFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_model_degradation_halt_fixtures_status, "blocked");
    assert.ok(result.model_degradation_halt_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.model_degradation_halt_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingModelDegradationHaltFixtures({ packagePath, write: false, check: true }),
      /Trading model degradation halt fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading model degradation halt fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-model-degradation-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-model-degradation-halt-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-model-degradation-halt-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingModelDegradationHaltFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading data outage halt fixtures keep outage and data quality paths read-only", async () => {
  const result = await runTradingDataOutageHaltFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_data_outage_halt_fixtures_status, "ready_for_trading_data_outage_halt_regression");
  assert.equal(result.summary.phase_slot, "P400");
  assert.equal(result.summary.previous_phase_slot, "P399");
  assert.equal(result.summary.next_phase_slot, "P401");
  assert.equal(result.summary.source_model_degradation_halt_status, "ready_for_trading_model_degradation_halt_regression");
  assert.equal(result.summary.source_model_degradation_halt_ready, true);
  assert.equal(result.summary.required_fixture_count, 6);
  assert.equal(result.summary.passed_fixture_count, 6);
  assert.equal(result.summary.unsafe_data_outage_signal_count, 0);
  assert.equal(result.summary.data_outage_halt_covered, true);
  assert.equal(result.summary.risk_data_outage_source_unbound, false);
  assert.equal(result.summary.risk_data_outage_detected, false);
  assert.equal(result.summary.risk_data_outage_halt_not_armed, false);
  assert.equal(result.summary.risk_data_outage_result_not_pass, false);
  assert.equal(result.summary.risk_data_outage_check_not_pass, false);
  assert.equal(result.summary.risk_stale_data_detected, false);
  assert.equal(result.summary.risk_stale_data_not_blocking_order_intent, false);
  assert.equal(result.summary.market_data_artifacts_missing, false);
  assert.equal(result.summary.market_data_quality_not_clean, false);
  assert.equal(result.summary.market_data_quality_checks_missing, false);
  assert.equal(result.summary.market_data_quality_checks_not_blocking_usage, false);
  assert.equal(result.summary.market_data_live_feed_enabled, false);
  assert.equal(result.summary.market_data_order_intent_generated, false);
  assert.equal(result.summary.paper_shadow_data_outage_detected, false);
  assert.equal(result.summary.paper_shadow_data_outage_halt_not_armed, false);
  assert.equal(result.summary.paper_shadow_live_adapter_not_read_only, false);
  assert.equal(result.summary.paper_shadow_order_routes_enabled, false);
  assert.equal(result.summary.paper_real_order_submitted, false);
  assert.equal(result.summary.limited_live_exchange_outage_halt_not_armed, false);
  assert.equal(result.summary.limited_live_exchange_outage_detected, false);
  assert.equal(result.summary.limited_live_stale_data_halt_not_armed, false);
  assert.equal(result.summary.limited_live_stale_data_detected, false);
  assert.equal(result.summary.limited_live_order_submission_allowed, false);
  assert.equal(result.summary.full_auto_data_failover_not_read_only, false);
  assert.equal(result.summary.full_auto_data_failover_external_network_allowed, false);
  assert.equal(result.summary.full_auto_order_generation_during_failover_allowed, false);
  assert.equal(result.summary.full_auto_broker_exchange_failover_allows_writes, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.external_service_allowed, false);
  assert.equal(result.summary.order_intent_generated, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.data_outage_halt_evidence_rows.every((row) => row.evidence_status === "data_outage_halt_ready" && row.unsafe_data_outage_signal_detected === false));
  assert.ok(result.data_outage_halt_fixture_rows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_data_outage_bypassed && row.fixture_should_fail_when_quality_gate_disabled && row.fixture_should_fail_when_live_feed_enabled));
  assert.ok(result.data_outage_halt_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading data outage halt fixtures block when outage and live-feed paths are bypassed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-data-outage-bypass-"));
  try {
    const riskEngine = JSON.parse(await readFile("examples/trading/risk-engine.json", "utf8"));
    riskEngine.risk_guards.data_outage_halt.source_ref = "market_data_quality_report.missing";
    riskEngine.risk_guards.data_outage_halt.data_outage_detected = true;
    riskEngine.risk_guards.data_outage_halt.halt_on_outage = false;
    riskEngine.risk_guards.data_outage_halt.result = "halt";
    riskEngine.risk_guards.stale_data_trade_block.stale_data_detected = true;
    riskEngine.risk_guards.stale_data_trade_block.blocks_order_intent = false;
    riskEngine.risk_check_artifacts[0].checks = riskEngine.risk_check_artifacts[0].checks.map((check) => (
      check.check_id === "data_outage_halt" ? { ...check, status: "halt" } : check
    ));
    const riskEnginePath = path.join(root, "risk-engine.json");
    await writeFile(riskEnginePath, `${JSON.stringify(riskEngine, null, 2)}\n`, "utf8");

    const marketDataFeatureStore = JSON.parse(await readFile("examples/trading/market-data-feature-store.json", "utf8"));
    marketDataFeatureStore.market_data_artifacts[0].quality_checks.stale_data_detected = true;
    marketDataFeatureStore.market_data_artifacts[0].quality_checks.missing_data_detected = true;
    marketDataFeatureStore.quality_gate_model.checks = marketDataFeatureStore.quality_gate_model.checks
      .filter((check) => check.check_id !== "duplicate_candle")
      .map((check) => check.check_id === "stale_data" ? { ...check, status: "fail", blocks_usage: false } : check);
    marketDataFeatureStore.quality_gate_model.blocks_feature_generation_on_failure = false;
    marketDataFeatureStore.safety_boundary.live_vendor_feeds_enabled = true;
    marketDataFeatureStore.safety_boundary.real_time_trading_feed_enabled = true;
    marketDataFeatureStore.safety_boundary.order_intent_generated = true;
    const marketDataFeatureStorePath = path.join(root, "market-data-feature-store.json");
    await writeFile(marketDataFeatureStorePath, `${JSON.stringify(marketDataFeatureStore, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.data_outage_detection.outage_detected = true;
    paperShadow.data_outage_detection.halt_shadow_generation_on_outage = false;
    paperShadow.read_only_live_data_adapter.read_only = false;
    paperShadow.read_only_live_data_adapter.credentials_required = true;
    paperShadow.read_only_live_data_adapter.external_network_required = true;
    paperShadow.read_only_live_data_adapter.order_routes_enabled = true;
    paperShadow.safety_boundary.real_order_submitted = true;
    paperShadow.safety_boundary.live_execution_allowed = true;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.halt_gates.exchange_broker_outage_halt.enabled = false;
    limitedLive.halt_gates.exchange_broker_outage_halt.outage_detected = true;
    limitedLive.halt_gates.exchange_broker_outage_halt.halt_on_trigger = false;
    limitedLive.halt_gates.stale_data_halt.enabled = false;
    limitedLive.halt_gates.stale_data_halt.stale_data_detected = true;
    limitedLive.halt_gates.stale_data_halt.halt_on_trigger = false;
    limitedLive.safety_boundary.live_order_submission_allowed = true;
    limitedLive.safety_boundary.broker_write_allowed = true;
    limitedLive.safety_boundary.exchange_write_allowed = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.failover_policies.data_vendor_failover.enabled = false;
    fullAuto.failover_policies.data_vendor_failover.read_only = false;
    fullAuto.failover_policies.data_vendor_failover.external_network_allowed = true;
    fullAuto.failover_policies.data_vendor_failover.order_generation_allowed_during_failover = true;
    fullAuto.failover_policies.broker_exchange_failover.broker_write_allowed = true;
    fullAuto.failover_policies.broker_exchange_failover.exchange_write_allowed = true;
    fullAuto.failover_policies.broker_exchange_failover.failover_target = "live";
    fullAuto.failover_policies.broker_exchange_failover.manual_resume_required = false;
    fullAuto.safety_boundary.full_auto_enabled = true;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    fullAuto.safety_boundary.broker_write_allowed = true;
    fullAuto.safety_boundary.exchange_write_allowed = true;
    fullAuto.safety_boundary.external_service_allowed = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingDataOutageHaltFixtures({
      riskEnginePath,
      marketDataFeatureStorePath,
      paperShadowPath,
      limitedLivePath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_data_outage_halt_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_data_outage_signal_count > 0);
    assert.equal(result.summary.risk_data_outage_source_unbound, true);
    assert.equal(result.summary.risk_data_outage_detected, true);
    assert.equal(result.summary.risk_data_outage_halt_not_armed, true);
    assert.equal(result.summary.risk_data_outage_result_not_pass, true);
    assert.equal(result.summary.risk_data_outage_check_not_pass, true);
    assert.equal(result.summary.risk_stale_data_detected, true);
    assert.equal(result.summary.risk_stale_data_not_blocking_order_intent, true);
    assert.equal(result.summary.market_data_quality_not_clean, true);
    assert.equal(result.summary.market_data_quality_checks_missing, true);
    assert.equal(result.summary.market_data_quality_checks_not_blocking_usage, true);
    assert.equal(result.summary.market_data_live_feed_enabled, true);
    assert.equal(result.summary.market_data_order_intent_generated, true);
    assert.equal(result.summary.paper_shadow_data_outage_detected, true);
    assert.equal(result.summary.paper_shadow_data_outage_halt_not_armed, true);
    assert.equal(result.summary.paper_shadow_live_adapter_not_read_only, true);
    assert.equal(result.summary.paper_shadow_order_routes_enabled, true);
    assert.equal(result.summary.paper_real_order_submitted, true);
    assert.equal(result.summary.limited_live_exchange_outage_halt_not_armed, true);
    assert.equal(result.summary.limited_live_exchange_outage_detected, true);
    assert.equal(result.summary.limited_live_stale_data_halt_not_armed, true);
    assert.equal(result.summary.limited_live_stale_data_detected, true);
    assert.equal(result.summary.limited_live_order_submission_allowed, true);
    assert.equal(result.summary.full_auto_data_failover_not_read_only, true);
    assert.equal(result.summary.full_auto_data_failover_external_network_allowed, true);
    assert.equal(result.summary.full_auto_order_generation_during_failover_allowed, true);
    assert.equal(result.summary.full_auto_broker_exchange_failover_allows_writes, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.automatic_order_submission_allowed, true);
    assert.equal(result.summary.external_service_allowed, true);
    assert.equal(result.summary.order_intent_generated, true);
    assert.equal(result.summary.real_order_submitted, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.equal(result.summary.broker_write_allowed, true);
    assert.equal(result.summary.exchange_write_allowed, true);
    assert.ok(result.data_outage_halt_fixture_rows.some((row) => row.row_key === "risk_data_outage_halt_declared" && row.fixture_status === "failed" && row.unsafe_data_outage_signal_detected));
    await assert.rejects(
      () => runTradingDataOutageHaltFixtures({
        riskEnginePath,
        marketDataFeatureStorePath,
        paperShadowPath,
        limitedLivePath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading data outage halt fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading data outage halt fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-data-outage-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:data-outage-halt-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:data-outage-halt-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingDataOutageHaltFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_data_outage_halt_fixtures_status, "blocked");
    assert.ok(result.data_outage_halt_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.data_outage_halt_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingDataOutageHaltFixtures({ packagePath, write: false, check: true }),
      /Trading data outage halt fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading data outage halt fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-data-outage-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-data-outage-halt-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-data-outage-halt-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingDataOutageHaltFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt contract fixtures declare independent human receipt gates", async () => {
  const result = await runTradingPromotionReceiptContractFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_receipt_contract_fixtures_status, "ready_for_trading_promotion_receipt_contract_regression");
  assert.equal(result.summary.phase_slot, "P401");
  assert.equal(result.summary.previous_phase_slot, "P400");
  assert.equal(result.summary.next_phase_slot, "P402");
  assert.equal(result.summary.source_data_outage_halt_status, "ready_for_trading_data_outage_halt_regression");
  assert.equal(result.summary.source_data_outage_halt_ready, true);
  assert.equal(result.summary.required_contract_count, 6);
  assert.equal(result.summary.contract_count, 6);
  assert.equal(result.summary.ready_contract_count, 6);
  assert.equal(result.summary.independent_receipt_contract_count, 6);
  assert.equal(result.summary.summary_row_count, 6);
  assert.equal(result.summary.unsafe_promotion_receipt_signal_count, 0);
  assert.equal(result.summary.promotion_receipt_contracts_covered, true);
  assert.equal(result.summary.independent_receipt_contracts_declared, true);
  assert.equal(result.summary.receipt_contracts_ready_for_human_input, true);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.receipt_input_read_performed, false);
  assert.equal(result.summary.receipt_validation_performed, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.higher_stage_enablement_claimed, false);
  assert.equal(result.summary.higher_stage_completion_claim_without_receipt, false);
  assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, true);
  assert.equal(result.summary.human_approval_missing_from_source, false);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.deepEqual(
    result.promotion_receipt_contract_rows.map((row) => row.row_key),
    [
      "research_to_backtest_receipt_contract",
      "backtest_to_paper_receipt_contract",
      "paper_to_shadow_receipt_contract",
      "shadow_to_limited_live_receipt_contract",
      "limited_live_to_full_auto_receipt_contract",
      "full_auto_activation_receipt_contract",
    ],
  );
  assert.equal(new Set(result.promotion_receipt_contract_rows.map((row) => row.receipt_contract_id)).size, 6);
  assert.ok(result.promotion_receipt_contract_rows.every((row) => row.contract_status === "ready_for_human_receipt" && row.receipt_required && row.receipt_contract_independent && row.approval_receipt_present === false && row.promotion_enablement_allowed === false));
  assert.ok(result.promotion_receipt_summary_rows.every((row) => row.summary_status === "receipt_contract_ready" && row.governance_complete_with_real_enablement_false));
  assert.ok(result.promotion_receipt_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading promotion receipt contract fixtures block when promotion receipts or enablement are pre-applied", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-receipt-bypass-"));
  try {
    const tradingSample = JSON.parse(await readFile("examples/trading/research-backtest-paper-sample.json", "utf8"));
    tradingSample.safety_policy.human_approval_required_for_promotion = false;
    tradingSample.contract_examples["trading-backtest"].promotion_candidate = true;
    const tradingSamplePath = path.join(root, "research-backtest-paper-sample.json");
    await writeFile(tradingSamplePath, `${JSON.stringify(tradingSample, null, 2)}\n`, "utf8");

    const modelImprovement = JSON.parse(await readFile("examples/trading/model-improvement-layer.json", "utf8"));
    modelImprovement.promotion_candidates[0].promotion_artifact.decision = "approved";
    modelImprovement.promotion_candidates[0].promotion_artifact.human_approval_required = false;
    modelImprovement.promotion_candidates[0].promotion_artifact.live_promotion_allowed = true;
    modelImprovement.promotion_policy_gate.human_approval_required = false;
    modelImprovement.promotion_policy_gate.live_promotion_allowed = true;
    const modelImprovementPath = path.join(root, "model-improvement-layer.json");
    await writeFile(modelImprovementPath, `${JSON.stringify(modelImprovement, null, 2)}\n`, "utf8");

    const backtestValidation = JSON.parse(await readFile("examples/trading/backtest-validation.json", "utf8"));
    backtestValidation.promotion_boundary.promotion_candidate_generated = true;
    backtestValidation.promotion_boundary.live_promotion_allowed = true;
    const backtestValidationPath = path.join(root, "backtest-validation.json");
    await writeFile(backtestValidationPath, `${JSON.stringify(backtestValidation, null, 2)}\n`, "utf8");

    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.promotion_criteria_to_shadow.decision = "approved";
    paperShadow.promotion_criteria_to_shadow.human_approval_required = false;
    paperShadow.promotion_criteria_to_shadow.shadow_live_enabled = true;
    paperShadow.promotion_criteria_to_limited_live.decision = "approved";
    paperShadow.promotion_criteria_to_limited_live.human_approval_required = false;
    paperShadow.promotion_criteria_to_limited_live.limited_live_enabled = true;
    paperShadow.safety_boundary.live_execution_allowed = true;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.explicit_human_approval_required = false;
    limitedLive.safety_boundary.approval_receipt_present = true;
    limitedLive.safety_boundary.limited_live_enabled = true;
    limitedLive.safety_boundary.full_auto_promotion_allowed = true;
    limitedLive.promotion_criteria_to_full_auto.decision = "approved";
    limitedLive.promotion_criteria_to_full_auto.human_approval_required = false;
    limitedLive.promotion_criteria_to_full_auto.full_auto_enabled = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.full_auto_approval_checklist.approval_required = false;
    fullAuto.full_auto_approval_checklist.approval_receipt_present = true;
    fullAuto.full_auto_approval_checklist.decision = "approved";
    fullAuto.safety_boundary.full_auto_enabled = true;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    fullAuto.safety_boundary.live_order_submission_allowed = true;
    fullAuto.safety_boundary.live_execution_allowed = true;
    fullAuto.safety_boundary.broker_write_allowed = true;
    fullAuto.safety_boundary.exchange_write_allowed = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptContractFixtures({
      tradingSamplePath,
      modelImprovementPath,
      backtestValidationPath,
      paperShadowPath,
      limitedLivePath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_contract_fixtures_status, "blocked");
    assert.ok(result.summary.unsafe_promotion_receipt_signal_count > 0);
    assert.equal(result.summary.human_approval_missing_from_source, true);
    assert.equal(result.summary.source_receipt_present, true);
    assert.equal(result.summary.source_approval_applied, true);
    assert.equal(result.summary.higher_stage_enablement_claimed, true);
    assert.equal(result.summary.higher_stage_completion_claim_without_receipt, true);
    assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, false);
    assert.equal(result.summary.promotion_candidate_generated, true);
    assert.equal(result.summary.shadow_live_enabled, true);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.automatic_order_submission_allowed, true);
    assert.equal(result.summary.live_order_submission_allowed, true);
    assert.equal(result.summary.live_promotion_allowed, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.equal(result.summary.broker_write_allowed, true);
    assert.equal(result.summary.exchange_write_allowed, true);
    assert.ok(result.promotion_receipt_contract_rows.some((row) => row.row_key === "full_auto_activation_receipt_contract" && row.contract_status === "blocked" && row.source_receipt_present));
    await assert.rejects(
      () => runTradingPromotionReceiptContractFixtures({
        tradingSamplePath,
        modelImprovementPath,
        backtestValidationPath,
        paperShadowPath,
        limitedLivePath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading promotion receipt contract fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt contract fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-receipt-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-receipt-contract-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-receipt-contract-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptContractFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_contract_fixtures_status, "blocked");
    assert.ok(result.promotion_receipt_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_receipt_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptContractFixtures({ packagePath, write: false, check: true }),
      /Trading promotion receipt contract fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt contract fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-receipt-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-receipt-contract-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-receipt-contract-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionReceiptContractFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion completion gate fixtures block completion until receipts exist", async () => {
  const result = await runTradingPromotionCompletionGateFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_completion_gate_fixtures_status, "ready_for_trading_promotion_completion_gate_regression");
  assert.equal(result.summary.phase_slot, "P402");
  assert.equal(result.summary.previous_phase_slot, "P401");
  assert.equal(result.summary.next_phase_slot, "P403");
  assert.equal(result.summary.source_promotion_receipt_contract_status, "ready_for_trading_promotion_receipt_contract_regression");
  assert.equal(result.summary.source_promotion_receipt_contract_ready, true);
  assert.equal(result.summary.required_stage_count, 6);
  assert.equal(result.summary.stage_count, 6);
  assert.equal(result.summary.ready_stage_count, 6);
  assert.equal(result.summary.blocked_stage_count, 0);
  assert.equal(result.summary.promotion_completion_gates_covered, true);
  assert.equal(result.summary.receipt_required_for_every_completion_gate, true);
  assert.equal(result.summary.completion_gates_block_without_receipts, true);
  assert.equal(result.summary.completion_claim_count, 0);
  assert.equal(result.summary.completion_claim_without_receipt_count, 0);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.receipt_input_read_performed, false);
  assert.equal(result.summary.receipt_validation_performed, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, true);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.deepEqual(
    result.promotion_completion_stage_rows.map((row) => row.row_key),
    [
      "research_to_backtest_completion_gate",
      "backtest_to_paper_completion_gate",
      "paper_to_shadow_completion_gate",
      "shadow_to_limited_live_completion_gate",
      "limited_live_to_full_auto_completion_gate",
      "full_auto_activation_completion_gate",
    ],
  );
  assert.ok(result.promotion_completion_stage_rows.every((row) => row.stage_completion_status === "ready_blocking_completion" && row.receipt_required && row.completion_blocked_without_receipt && row.completion_enablement_allowed === false));
  assert.ok(result.promotion_completion_summary_rows.every((row) => row.summary_status === "completion_blocked_pending_receipt" && row.completion_blocked_without_receipt));
  assert.ok(result.promotion_completion_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading promotion completion gate fixtures block when completion is claimed without receipts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-completion-claim-"));
  try {
    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.promotion_criteria_to_shadow.decision = "approved";
    paperShadow.promotion_criteria_to_shadow.shadow_live_enabled = true;
    paperShadow.promotion_criteria_to_limited_live.decision = "approved";
    paperShadow.promotion_criteria_to_limited_live.limited_live_enabled = true;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.full_auto_approval_checklist.decision = "approved";
    fullAuto.safety_boundary.full_auto_enabled = true;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionCompletionGateFixtures({
      paperShadowPath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_completion_gate_fixtures_status, "blocked");
    assert.equal(result.summary.source_promotion_receipt_contract_ready, false);
    assert.ok(result.summary.completion_claim_count > 0);
    assert.ok(result.summary.completion_claim_without_receipt_count > 0);
    assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, false);
    assert.equal(result.summary.shadow_live_enabled, true);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.automatic_order_submission_allowed, true);
    assert.ok(result.promotion_completion_stage_rows.some((row) => row.row_key === "paper_to_shadow_completion_gate" && row.stage_completion_status === "blocked" && row.completion_claim_without_receipt));
    await assert.rejects(
      () => runTradingPromotionCompletionGateFixtures({
        paperShadowPath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading promotion completion gate fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion completion gate fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-completion-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-completion-gate-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-completion-gate-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionCompletionGateFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_completion_gate_fixtures_status, "blocked");
    assert.ok(result.promotion_completion_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_completion_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionCompletionGateFixtures({ packagePath, write: false, check: true }),
      /Trading promotion completion gate fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion completion gate fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-completion-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-completion-gate-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-completion-gate-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionCompletionGateFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion governance readonly fixtures keep complete governance evidence non-enabling", async () => {
  const result = await runTradingPromotionGovernanceReadonlyFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_governance_readonly_fixtures_status, "ready_for_trading_promotion_governance_readonly_regression");
  assert.equal(result.summary.phase_slot, "P403");
  assert.equal(result.summary.previous_phase_slot, "P402");
  assert.equal(result.summary.next_phase_slot, "P404");
  assert.equal(result.summary.source_promotion_completion_gate_status, "ready_for_trading_promotion_completion_gate_regression");
  assert.equal(result.summary.source_promotion_completion_gate_ready, true);
  assert.equal(result.summary.required_governance_row_count, 6);
  assert.equal(result.summary.governance_row_count, 6);
  assert.equal(result.summary.ready_governance_row_count, 6);
  assert.equal(result.summary.promotion_governance_rows_covered, true);
  assert.equal(result.summary.governance_reports_readonly, true);
  assert.equal(result.summary.governance_reports_may_be_complete, true);
  assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, true);
  assert.equal(result.summary.completion_gates_block_without_receipts, true);
  assert.equal(result.summary.real_enablement_count, 0);
  assert.equal(result.summary.completion_claim_count, 0);
  assert.equal(result.summary.completion_claim_without_receipt_count, 0);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.receipt_validation_performed, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.deepEqual(
    result.promotion_governance_readonly_rows.map((row) => row.row_key),
    [
      "research_to_backtest_governance_readonly",
      "backtest_to_paper_governance_readonly",
      "paper_to_shadow_governance_readonly",
      "shadow_to_limited_live_governance_readonly",
      "limited_live_to_full_auto_governance_readonly",
      "full_auto_activation_governance_readonly",
    ],
  );
  assert.ok(result.promotion_governance_readonly_rows.every((row) => row.readonly_governance_status === "ready_readonly_governance" && row.governance_completion_readonly && row.real_enablement_allowed === false));
  assert.ok(result.promotion_governance_readonly_summary_rows.every((row) => row.summary_status === "readonly_governance_ready" && row.governance_complete_with_real_enablement_false));
  assert.ok(result.promotion_governance_readonly_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading promotion governance readonly fixtures block when governance implies real enablement", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-governance-enable-"));
  try {
    const paperShadow = JSON.parse(await readFile("examples/trading/paper-shadow-live.json", "utf8"));
    paperShadow.promotion_criteria_to_shadow.shadow_live_enabled = true;
    paperShadow.promotion_criteria_to_limited_live.limited_live_enabled = true;
    const paperShadowPath = path.join(root, "paper-shadow-live.json");
    await writeFile(paperShadowPath, `${JSON.stringify(paperShadow, null, 2)}\n`, "utf8");

    const fullAuto = JSON.parse(await readFile("examples/trading/full-auto-governance.json", "utf8"));
    fullAuto.safety_boundary.full_auto_enabled = true;
    fullAuto.safety_boundary.automatic_order_submission_allowed = true;
    fullAuto.safety_boundary.live_execution_allowed = true;
    const fullAutoPath = path.join(root, "full-auto-governance.json");
    await writeFile(fullAutoPath, `${JSON.stringify(fullAuto, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionGovernanceReadonlyFixtures({
      paperShadowPath,
      fullAutoPath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_governance_readonly_fixtures_status, "blocked");
    assert.equal(result.summary.source_promotion_completion_gate_ready, false);
    assert.ok(result.summary.real_enablement_count > 0);
    assert.ok(result.summary.completion_claim_count > 0);
    assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, false);
    assert.equal(result.summary.shadow_live_enabled, true);
    assert.equal(result.summary.limited_live_enabled, true);
    assert.equal(result.summary.full_auto_enabled, true);
    assert.equal(result.summary.automatic_order_submission_allowed, true);
    assert.equal(result.summary.live_execution_allowed, true);
    assert.ok(result.promotion_governance_readonly_rows.some((row) => row.row_key === "paper_to_shadow_governance_readonly" && row.readonly_governance_status === "blocked" && row.real_enablement_detected));
    await assert.rejects(
      () => runTradingPromotionGovernanceReadonlyFixtures({
        paperShadowPath,
        fullAutoPath,
        write: false,
        check: true,
      }),
      /Trading promotion governance readonly fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion governance readonly fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-governance-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-governance-readonly-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-governance-readonly-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionGovernanceReadonlyFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_governance_readonly_fixtures_status, "blocked");
    assert.ok(result.promotion_governance_readonly_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_governance_readonly_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionGovernanceReadonlyFixtures({ packagePath, write: false, check: true }),
      /Trading promotion governance readonly fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion governance readonly fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-governance-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-governance-readonly-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-governance-readonly-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionGovernanceReadonlyFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt intake queue fixtures keep receipts pending human input", async () => {
  const result = await runTradingPromotionReceiptIntakeQueueFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_receipt_intake_queue_fixtures_status, "ready_for_trading_promotion_receipt_intake_queue_regression");
  assert.equal(result.summary.phase_slot, "P404");
  assert.equal(result.summary.previous_phase_slot, "P403");
  assert.equal(result.summary.next_phase_slot, "P405");
  assert.equal(result.summary.source_promotion_governance_readonly_status, "ready_for_trading_promotion_governance_readonly_regression");
  assert.equal(result.summary.source_promotion_governance_readonly_ready, true);
  assert.equal(result.summary.required_receipt_intake_queue_row_count, 6);
  assert.equal(result.summary.receipt_intake_queue_row_count, 6);
  assert.equal(result.summary.ready_receipt_intake_queue_row_count, 6);
  assert.equal(result.summary.receipt_intake_queue_rows_covered, true);
  assert.equal(result.summary.receipt_intake_queue_pending, true);
  assert.equal(result.summary.governance_reports_readonly, true);
  assert.equal(result.summary.governance_reports_complete_with_real_enablement_false, true);
  assert.equal(result.summary.completion_gates_block_without_receipts, true);
  assert.equal(result.summary.real_enablement_count, 0);
  assert.equal(result.summary.receipt_payload_present_count, 0);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.receipt_input_read_performed, false);
  assert.equal(result.summary.receipt_validation_performed, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.deepEqual(
    result.promotion_receipt_intake_queue_rows.map((row) => row.row_key),
    [
      "research_to_backtest_receipt_intake_queue",
      "backtest_to_paper_receipt_intake_queue",
      "paper_to_shadow_receipt_intake_queue",
      "shadow_to_limited_live_receipt_intake_queue",
      "limited_live_to_full_auto_receipt_intake_queue",
      "full_auto_activation_receipt_intake_queue",
    ],
  );
  assert.ok(result.promotion_receipt_intake_queue_rows.every((row) => row.receipt_intake_queue_status === "queued_pending_human_receipt" && row.receipt_required && row.receipt_payload_present === false));
  assert.ok(result.promotion_receipt_intake_queue_summary_rows.every((row) => row.summary_status === "pending_human_receipt_intake" && row.receipt_validation_performed === false));
  assert.ok(result.promotion_receipt_intake_queue_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_gate === false));
});

test("trading promotion receipt intake queue fixtures block when receipt payloads appear early", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-intake-receipt-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.approval_receipt_present = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptIntakeQueueFixtures({
      limitedLivePath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_intake_queue_fixtures_status, "blocked");
    assert.equal(result.summary.source_promotion_governance_readonly_ready, false);
    assert.equal(result.summary.source_receipt_present, true);
    assert.ok(result.summary.receipt_payload_present_count > 0);
    assert.equal(result.summary.receipt_intake_queue_pending, false);
    assert.ok(result.promotion_receipt_intake_queue_rows.some((row) => row.row_key === "shadow_to_limited_live_receipt_intake_queue" && row.receipt_intake_queue_status === "blocked" && row.receipt_payload_present));
    await assert.rejects(
      () => runTradingPromotionReceiptIntakeQueueFixtures({
        limitedLivePath,
        write: false,
        check: true,
      }),
      /Trading promotion receipt intake queue fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt intake queue fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-intake-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-receipt-intake-queue-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-receipt-intake-queue-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptIntakeQueueFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_intake_queue_fixtures_status, "blocked");
    assert.ok(result.promotion_receipt_intake_queue_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_receipt_intake_queue_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptIntakeQueueFixtures({ packagePath, write: false, check: true }),
      /Trading promotion receipt intake queue fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt intake queue fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-intake-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-receipt-intake-queue-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-receipt-intake-queue-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionReceiptIntakeQueueFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt validation rules fixtures declare future validation without payloads", async () => {
  const result = await runTradingPromotionReceiptValidationRulesFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_receipt_validation_rules_fixtures_status, "ready_for_trading_promotion_receipt_validation_rules_regression");
  assert.equal(result.summary.phase_slot, "P405");
  assert.equal(result.summary.previous_phase_slot, "P404");
  assert.equal(result.summary.next_phase_slot, "P406");
  assert.equal(result.summary.source_promotion_receipt_intake_queue_status, "ready_for_trading_promotion_receipt_intake_queue_regression");
  assert.equal(result.summary.source_promotion_receipt_intake_queue_ready, true);
  assert.equal(result.summary.rule_row_count, 6);
  assert.equal(result.summary.ready_rule_row_count, 6);
  assert.equal(result.summary.validation_rules_declared, true);
  assert.equal(result.summary.future_receipt_validation_required, true);
  assert.equal(result.summary.required_receipt_field_count, 7);
  assert.equal(result.summary.allowed_receipt_decision_count, 3);
  assert.equal(result.summary.receipt_queue_consumed_in_memory, true);
  assert.equal(result.summary.receipt_queue_artifact_read_performed, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_to_validate_receipt_payload, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.real_enablement_count, 0);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.promotion_receipt_validation_rule_rows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.future_receipt_validation_required && row.receipt_payload_present === false));
  assert.ok(result.promotion_receipt_validation_rule_rows.every((row) => row.required_receipt_fields.includes("receipt_id") && row.allowed_receipt_decisions.includes("approved_for_next_stage")));
  assert.ok(result.promotion_receipt_validation_rule_summary_rows.every((row) => row.summary_status === "future_receipt_validation_rules_ready" && row.receipt_validated_by_rules === false));
  assert.ok(result.promotion_receipt_validation_rules_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_rules === false));
});

test("trading promotion receipt validation rules fixtures block when source queue is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-validation-rules-source-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.approval_receipt_present = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptValidationRulesFixtures({
      limitedLivePath,
      write: false,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_validation_rules_fixtures_status, "blocked");
    assert.equal(result.summary.source_promotion_receipt_intake_queue_ready, false);
    assert.equal(result.summary.source_receipt_present, true);
    assert.equal(result.summary.ready_rule_row_count, 0);
    assert.ok(result.promotion_receipt_validation_rule_rows.every((row) => row.receipt_validation_rule_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptValidationRulesFixtures({
        limitedLivePath,
        write: false,
        check: true,
      }),
      /Trading promotion receipt validation rules fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt validation rules fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-validation-rules-registration-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-receipt-validation-rules-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-receipt-validation-rules-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptValidationRulesFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_validation_rules_fixtures_status, "blocked");
    assert.ok(result.promotion_receipt_validation_rules_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_receipt_validation_rules_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptValidationRulesFixtures({ packagePath, write: false, check: true }),
      /Trading promotion receipt validation rules fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt validation rules fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-validation-rules-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-receipt-validation-rules-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-receipt-validation-rules-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionReceiptValidationRulesFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt workspace fixtures expose human rows without materializing inputs", async () => {
  const result = await runTradingPromotionReceiptWorkspaceFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_receipt_workspace_fixtures_status, "ready_for_trading_promotion_receipt_workspace_regression");
  assert.equal(result.summary.phase_slot, "P406");
  assert.equal(result.summary.previous_phase_slot, "P405");
  assert.equal(result.summary.next_phase_slot, "P407");
  assert.equal(result.summary.source_promotion_receipt_validation_rules_status, "ready_for_trading_promotion_receipt_validation_rules_regression");
  assert.equal(result.summary.source_promotion_receipt_validation_rules_ready, true);
  assert.equal(result.summary.workspace_row_count, 6);
  assert.equal(result.summary.ready_workspace_row_count, 6);
  assert.equal(result.summary.validation_rules_consumed_in_memory, true);
  assert.equal(result.summary.validation_rules_artifact_read_performed, false);
  assert.equal(result.summary.workspace_rows_declared, true);
  assert.equal(result.summary.editable_receipt_fields_declared, true);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.real_enablement_count, 0);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.promotion_receipt_workspace_rows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.source_receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.editable_receipt_fields_declared && row.receipt_input_file_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_workspace === false));
  assert.ok(result.promotion_receipt_workspace_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_workspace === false));
});

test("trading promotion receipt workspace fixtures block when source validation rules are blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-workspace-source-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.approval_receipt_present = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptWorkspaceFixtures({ limitedLivePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_workspace_fixtures_status, "blocked");
    assert.equal(result.summary.source_promotion_receipt_validation_rules_ready, false);
    assert.equal(result.summary.source_receipt_present, true);
    assert.equal(result.summary.ready_workspace_row_count, 0);
    assert.ok(result.promotion_receipt_workspace_rows.every((row) => row.workspace_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptWorkspaceFixtures({ limitedLivePath, write: false, check: true }),
      /Trading promotion receipt workspace fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt workspace fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-workspace-registration-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-receipt-workspace-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-receipt-workspace-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptWorkspaceFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_workspace_fixtures_status, "blocked");
    assert.ok(result.promotion_receipt_workspace_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_receipt_workspace_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptWorkspaceFixtures({ packagePath, write: false, check: true }),
      /Trading promotion receipt workspace fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt workspace fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-workspace-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-receipt-workspace-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-receipt-workspace-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionReceiptWorkspaceFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt workspace merge fixtures declare future merge without inputs", async () => {
  const result = await runTradingPromotionReceiptWorkspaceMergeFixtures({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trading_promotion_receipt_workspace_merge_fixtures_status, "ready_for_trading_promotion_receipt_workspace_merge_regression");
  assert.equal(result.summary.phase_slot, "P407");
  assert.equal(result.summary.previous_phase_slot, "P406");
  assert.equal(result.summary.next_phase_slot, "P408");
  assert.equal(result.summary.source_promotion_receipt_workspace_status, "ready_for_trading_promotion_receipt_workspace_regression");
  assert.equal(result.summary.source_promotion_receipt_workspace_ready, true);
  assert.equal(result.summary.merge_row_count, 6);
  assert.equal(result.summary.ready_merge_row_count, 6);
  assert.equal(result.summary.receipt_workspace_consumed_in_memory, true);
  assert.equal(result.summary.receipt_workspace_artifact_read_performed, false);
  assert.equal(result.summary.merge_rows_declared, true);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.merge_performed, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.receipt_application_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.source_receipt_present, false);
  assert.equal(result.summary.source_approval_applied, false);
  assert.equal(result.summary.real_enablement_count, 0);
  assert.equal(result.summary.shadow_live_enabled, false);
  assert.equal(result.summary.limited_live_enabled, false);
  assert.equal(result.summary.full_auto_enabled, false);
  assert.equal(result.summary.automatic_order_submission_allowed, false);
  assert.equal(result.summary.live_order_submission_allowed, false);
  assert.equal(result.summary.live_execution_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.ok(result.promotion_receipt_workspace_merge_rows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && row.source_workspace_status === "ready_for_human_receipt_input" && row.merged_receipt_input_materialized === false && row.merge_performed === false && row.receipt_payload_present === false));
  assert.ok(result.promotion_receipt_workspace_merge_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_merge === false));
});

test("trading promotion receipt workspace merge fixtures block when source workspace is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-workspace-merge-source-"));
  try {
    const limitedLive = JSON.parse(await readFile("examples/trading/limited-live-governance.json", "utf8"));
    limitedLive.safety_boundary.approval_receipt_present = true;
    const limitedLivePath = path.join(root, "limited-live-governance.json");
    await writeFile(limitedLivePath, `${JSON.stringify(limitedLive, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptWorkspaceMergeFixtures({ limitedLivePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_workspace_merge_fixtures_status, "blocked");
    assert.equal(result.summary.source_promotion_receipt_workspace_ready, false);
    assert.equal(result.summary.source_receipt_present, true);
    assert.equal(result.summary.ready_merge_row_count, 0);
    assert.ok(result.promotion_receipt_workspace_merge_rows.every((row) => row.merge_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptWorkspaceMergeFixtures({ limitedLivePath, write: false, check: true }),
      /Trading promotion receipt workspace merge fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt workspace merge fixtures block when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-workspace-merge-registration-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:promotion-receipt-workspace-merge-fixtures"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run trading:promotion-receipt-workspace-merge-fixtures -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runTradingPromotionReceiptWorkspaceMergeFixtures({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.trading_promotion_receipt_workspace_merge_fixtures_status, "blocked");
    assert.ok(result.promotion_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.promotion_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runTradingPromotionReceiptWorkspaceMergeFixtures({ packagePath, write: false, check: true }),
      /Trading promotion receipt workspace merge fixtures failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trading promotion receipt workspace merge fixtures --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-trading-promotion-workspace-merge-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "trading-promotion-receipt-workspace-merge-fixtures.json");
    const sentinel = "{ \"sentinel\": \"trading-promotion-receipt-workspace-merge-fixtures\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runTradingPromotionReceiptWorkspaceMergeFixtures({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
