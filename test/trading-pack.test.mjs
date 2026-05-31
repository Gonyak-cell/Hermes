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
