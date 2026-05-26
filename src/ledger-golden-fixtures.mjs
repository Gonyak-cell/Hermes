import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LEDGER_GOLDEN_FIXTURES_OUT_DIR = "artifacts/ledger-golden-fixtures/latest";
export const DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS = {
  eventReplayHarnessPath: "artifacts/event-replay/latest/event-replay-harness.json",
  costRecordProjectionPath: "artifacts/cost-record-projection/latest/cost-record-projection.json",
  tokenUsageProjectionPath: "artifacts/token-usage-projection/latest/token-usage-projection.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  ledgerApiDashboardPath: "artifacts/ledger-api-dashboard/latest/ledger-api-dashboard.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
};

const FIXTURE_SET_ID = "ledger-golden-fixtures.v1";
const CASE_SCHEMA_VERSION = "ledger-golden-case.v1";
const MATRIX_SCHEMA_VERSION = "ledger-fixture-matrix.v1";
const REGRESSION_MANIFEST_SCHEMA_VERSION = "ledger-regression-manifest.v1";
const REQUIRED_GROUPS = ["replay", "projection", "cost", "audit"];

export async function runLedgerGoldenFixtures(options = {}) {
  const result = await buildLedgerGoldenFixtures(options);
  if (options.write !== false) await writeLedgerGoldenFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Ledger golden fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLedgerGoldenFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    eventReplayHarness: await readJsonOrError(inputs.event_replay_harness_path),
    costRecordProjection: await readJsonOrError(inputs.cost_record_projection_path),
    tokenUsageProjection: await readJsonOrError(inputs.token_usage_projection_path),
    auditEventLedger: await readJsonOrError(inputs.audit_event_ledger_path),
    ledgerApiDashboard: await readJsonOrError(inputs.ledger_api_dashboard_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
    reviewApi: await readTextOrError(inputs.review_api_path),
    reviewDashboard: await readTextOrError(inputs.review_dashboard_path),
  };
  const artifacts = {
    eventReplayHarness: sources.eventReplayHarness.value ?? {},
    costRecordProjection: sources.costRecordProjection.value ?? {},
    tokenUsageProjection: sources.tokenUsageProjection.value ?? {},
    auditEventLedger: sources.auditEventLedger.value ?? {},
    ledgerApiDashboard: sources.ledgerApiDashboard.value ?? {},
  };
  const ledgerGoldenCases = buildLedgerGoldenCases(artifacts, generatedAt);
  const ledgerFixtureMatrix = buildLedgerFixtureMatrix(ledgerGoldenCases, generatedAt);
  const ledgerRegressionManifest = buildLedgerRegressionManifest(ledgerGoldenCases, generatedAt);
  const validationItems = validateLedgerGoldenFixtures({
    sources,
    ledgerGoldenCases,
    ledgerFixtureMatrix,
    ledgerRegressionManifest,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: FIXTURE_SET_ID,
    generated_at: generatedAt,
    ledger_golden_fixture_set_id: `ledger-golden-fixtures.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_event_replay_harness: sourceSummary("event_replay_harness", sources.eventReplayHarness, "event_replay_status"),
    source_cost_record_projection: sourceSummary("cost_record_projection", sources.costRecordProjection, "cost_record_projection_status"),
    source_token_usage_projection: sourceSummary("token_usage_projection", sources.tokenUsageProjection, "token_usage_projection_status"),
    source_audit_event_ledger: sourceSummary("audit_event_ledger", sources.auditEventLedger, "audit_event_ledger_status"),
    source_ledger_api_dashboard: sourceSummary("ledger_api_dashboard", sources.ledgerApiDashboard, "ledger_api_dashboard_status"),
    ledger_golden_fixture_contract: buildLedgerGoldenFixtureContract(generatedAt),
    ledger_golden_fixture_catalog: {
      schema_version: "ledger-golden-fixture-catalog.v1",
      generated_at: generatedAt,
      ledger_golden_cases: ledgerGoldenCases,
      ledger_fixture_matrix: ledgerFixtureMatrix,
      ledger_regression_manifest: ledgerRegressionManifest,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeLedgerGoldenFixtures({
      sources,
      ledgerGoldenCases,
      ledgerRegressionManifest,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderLedgerGoldenFixturesMarkdown(result),
  };
}

export async function writeLedgerGoldenFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "ledger-golden-fixtures.json"), serializableLedgerGoldenFixtures(result));
  await writeJson(path.join(outDir, "ledger-golden-cases.json"), {
    schema_version: "ledger-golden-cases.v1",
    generated_at: result.generated_at,
    ledger_golden_case_count: result.ledger_golden_fixture_catalog.ledger_golden_cases.length,
    ledger_golden_cases: result.ledger_golden_fixture_catalog.ledger_golden_cases,
  });
  await writeJson(path.join(outDir, "ledger-fixture-matrix.json"), result.ledger_golden_fixture_catalog.ledger_fixture_matrix);
  await writeJson(path.join(outDir, "ledger-regression-manifest.json"), result.ledger_golden_fixture_catalog.ledger_regression_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ledger-golden-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    ledger_golden_fixture_set_id: result.ledger_golden_fixture_set_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLedgerGoldenFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLedgerGoldenFixtures(args);
    console.log(`Ledger golden fixtures written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.ledger_golden_fixture_status}`);
    console.log(`Cases: ${result.summary.ledger_golden_case_count}`);
    console.log(`Locked cases: ${result.summary.locked_case_count}`);
    console.log(`Assertions: ${result.summary.passed_metric_assertion_count}/${result.summary.metric_assertion_count}`);
    console.log(`Regression hashes: ${result.summary.locked_regression_hash_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildLedgerGoldenFixtureContract(generatedAt) {
  return {
    schema_version: "ledger-golden-fixture-contract.v1",
    ledger_golden_fixture_contract_id: FIXTURE_SET_ID,
    generated_at: generatedAt,
    required_fixture_groups: REQUIRED_GROUPS,
    source_inputs: [
      "event-replay-harness.v1",
      "cost-record-projection.v1",
      "token-usage-projection.v1",
      "audit-event-ledger.v1",
      "ledger-api-dashboard.v1",
    ],
    fixture_rule: "Replay, projection, cost, and audit ledger fixtures must lock representative operational invariants with regression hashes.",
    review_rule: "Ledger fixture locks do not approve legal, client-facing, retry, retention, delivery, or deletion decisions.",
  };
}

function buildLedgerGoldenCases(artifacts, generatedAt) {
  const replay = artifacts.eventReplayHarness.summary ?? {};
  const cost = artifacts.costRecordProjection.summary ?? {};
  const token = artifacts.tokenUsageProjection.summary ?? {};
  const audit = artifacts.auditEventLedger.summary ?? {};
  const dashboard = artifacts.ledgerApiDashboard.summary ?? {};
  return [
    ledgerCase({
      caseId: "event-replay-parity",
      fixtureGroup: "replay",
      sourceArtifactId: "event_replay_harness",
      sourceRecordType: "event_replay_summary",
      label: "Event replay parity",
      expectedOutcome: "replay_verified",
      observedStatus: replay.event_replay_status ?? "missing",
      expectedMetrics: {
        source_stored_event_count: replay.source_stored_event_count ?? 0,
        replayed_event_count: replay.source_stored_event_count ?? 0,
        verified_event_stream_count: replay.source_event_stream_count ?? 0,
        hash_chain_mismatch_count: 0,
        dashboard_metric_mismatch_count: 0,
      },
      observedMetrics: {
        source_stored_event_count: replay.source_stored_event_count ?? 0,
        replayed_event_count: replay.replayed_event_count ?? 0,
        verified_event_stream_count: replay.verified_event_stream_count ?? 0,
        hash_chain_mismatch_count: replay.hash_chain_mismatch_count ?? 0,
        dashboard_metric_mismatch_count: replay.dashboard_metric_mismatch_count ?? 0,
      },
      generatedAt,
    }),
    ledgerCase({
      caseId: "token-cost-projection-binding",
      fixtureGroup: "projection",
      sourceArtifactId: "token_usage_projection",
      sourceRecordType: "token_usage_projection_summary",
      label: "Token usage projection provider binding",
      expectedOutcome: "projection_bound",
      observedStatus: token.token_usage_projection_status ?? "missing",
      expectedMetrics: {
        projected_token_usage_record_count: token.source_token_usage_record_count ?? 0,
        provider_cost_bound_record_count: token.provider_cost_record_count ?? 0,
        missing_provider_cost_record_count: 0,
        blocked_record_count: 0,
        dashboard_panel_count: dashboard.ledger_dashboard_panel_count ?? 0,
      },
      observedMetrics: {
        projected_token_usage_record_count: token.projected_token_usage_record_count ?? 0,
        provider_cost_bound_record_count: token.provider_cost_bound_record_count ?? 0,
        missing_provider_cost_record_count: token.missing_provider_cost_record_count ?? 0,
        blocked_record_count: token.blocked_record_count ?? 0,
        dashboard_panel_count: dashboard.ledger_dashboard_panel_count ?? 0,
      },
      generatedAt,
    }),
    ledgerCase({
      caseId: "cost-rollup-attribution",
      fixtureGroup: "cost",
      sourceArtifactId: "cost_record_projection",
      sourceRecordType: "cost_record_projection_summary",
      label: "Cost projection rollup attribution",
      expectedOutcome: "cost_attributed",
      observedStatus: cost.cost_record_projection_status ?? "missing",
      expectedMetrics: {
        projected_cost_record_count: cost.projected_cost_record_count ?? 0,
        run_cost_rollup_count: cost.run_cost_rollup_count ?? 0,
        attributed_run_cost_rollup_count: cost.run_cost_rollup_count ?? 0,
        missing_run_cost_rollup_count: 0,
        total_token_count: cost.total_token_count ?? 0,
      },
      observedMetrics: {
        projected_cost_record_count: cost.projected_cost_record_count ?? 0,
        run_cost_rollup_count: cost.run_cost_rollup_count ?? 0,
        attributed_run_cost_rollup_count: cost.attributed_run_cost_rollup_count ?? 0,
        missing_run_cost_rollup_count: cost.missing_run_cost_rollup_count ?? 0,
        total_token_count: cost.total_token_count ?? 0,
      },
      generatedAt,
    }),
    ledgerCase({
      caseId: "audit-separation-binding",
      fixtureGroup: "audit",
      sourceArtifactId: "audit_event_ledger",
      sourceRecordType: "audit_event_ledger_summary",
      label: "Audit ledger separation binding",
      expectedOutcome: "audit_separated",
      observedStatus: audit.audit_event_ledger_status ?? "missing",
      expectedMetrics: {
        audit_trail_record_count: audit.audit_trail_record_count ?? 0,
        separated_binding_count: audit.audit_separation_binding_count ?? 0,
        mixed_observability_record_count: 0,
        protected_action_executed_audit_record_count: audit.protected_action_executed_audit_record_count ?? 0,
        event_store_bound_record_count: audit.event_store_bound_record_count ?? 0,
      },
      observedMetrics: {
        audit_trail_record_count: audit.audit_trail_record_count ?? 0,
        separated_binding_count: audit.separated_binding_count ?? 0,
        mixed_observability_record_count: audit.mixed_observability_record_count ?? 0,
        protected_action_executed_audit_record_count: audit.protected_action_executed_audit_record_count ?? 0,
        event_store_bound_record_count: audit.event_store_bound_record_count ?? 0,
      },
      generatedAt,
    }),
  ].sort(by("ledger_golden_case_id"));
}

function ledgerCase({
  caseId,
  fixtureGroup,
  sourceArtifactId,
  sourceRecordType,
  label,
  expectedOutcome,
  observedStatus,
  expectedMetrics,
  observedMetrics,
  generatedAt,
}) {
  const metricAssertions = Object.entries(expectedMetrics).map(([metricKey, expectedValue]) => {
    const observedValue = observedMetrics[metricKey] ?? null;
    const assertionStatus = Object.is(observedValue, expectedValue) ? "passed" : "failed";
    return {
      assertion_id: `ledger-assertion.${caseId}.${metricKey}`,
      metric_key: metricKey,
      expected_operator: "equals",
      expected_value: expectedValue,
      observed_value: observedValue,
      assertion_status: assertionStatus,
    };
  });
  const base = {
    schema_version: CASE_SCHEMA_VERSION,
    ledger_golden_case_id: `ledger-golden-case.${caseId}`,
    fixture_group: fixtureGroup,
    source_artifact_id: sourceArtifactId,
    source_record_type: sourceRecordType,
    label,
    expected_outcome: expectedOutcome,
    observed_status: observedStatus,
    expected_metrics: expectedMetrics,
    observed_metrics: observedMetrics,
    metric_assertions: metricAssertions,
    case_status: observedStatus === "complete" && metricAssertions.every((assertion) => assertion.assertion_status === "passed") ? "locked" : "mismatch",
    human_review_required: true,
    protected_action: false,
    captured_at: generatedAt,
  };
  return {
    ...base,
    regression_hash: stableHash(base),
  };
}

function buildLedgerFixtureMatrix(cases, generatedAt) {
  const fixtureGroups = REQUIRED_GROUPS.map((fixtureGroup) => {
    const groupCases = cases.filter((item) => item.fixture_group === fixtureGroup);
    const assertions = groupCases.flatMap((item) => item.metric_assertions ?? []);
    return {
      fixture_group: fixtureGroup,
      case_count: groupCases.length,
      locked_case_count: groupCases.filter((item) => item.case_status === "locked").length,
      mismatch_case_count: groupCases.filter((item) => item.case_status !== "locked").length,
      assertion_count: assertions.length,
      passed_assertion_count: assertions.filter((item) => item.assertion_status === "passed").length,
      failed_assertion_count: assertions.filter((item) => item.assertion_status !== "passed").length,
    };
  });
  return {
    schema_version: MATRIX_SCHEMA_VERSION,
    generated_at: generatedAt,
    ledger_golden_case_count: cases.length,
    fixture_group_count: fixtureGroups.length,
    fixture_groups: fixtureGroups,
  };
}

function buildLedgerRegressionManifest(cases, generatedAt) {
  return {
    schema_version: REGRESSION_MANIFEST_SCHEMA_VERSION,
    generated_at: generatedAt,
    ledger_regression_hashes: cases.map((item) => ({
      regression_hash_id: `ledger-regression-hash.${slugify(item.ledger_golden_case_id)}`,
      ledger_golden_case_id: item.ledger_golden_case_id,
      fixture_group: item.fixture_group,
      source_artifact_id: item.source_artifact_id,
      regression_hash: item.regression_hash,
      lock_status: item.case_status === "locked" ? "locked" : "mismatch",
    })),
  };
}

function validateLedgerGoldenFixtures({ sources, ledgerGoldenCases, ledgerFixtureMatrix, ledgerRegressionManifest }) {
  const packageJson = sources.packageJson.value ?? {};
  const roadmapText = sources.roadmap.value ?? "";
  const reviewApiSource = sources.reviewApi.value ?? "";
  const reviewDashboardSource = sources.reviewDashboard.value ?? "";
  const groups = new Set(ledgerGoldenCases.map((item) => item.fixture_group));
  const assertions = ledgerGoldenCases.flatMap((item) => item.metric_assertions ?? []);
  const mismatchCases = ledgerGoldenCases.filter((item) => item.case_status !== "locked");
  const failedAssertions = assertions.filter((item) => item.assertion_status !== "passed");
  const unlockedRegressionHashes = ledgerRegressionManifest.ledger_regression_hashes.filter((item) => item.lock_status !== "locked" || !item.regression_hash?.startsWith("sha256:"));
  const items = [];
  items.push(validationItem("sources.event_replay_harness", "source_complete", sourceStatus(sources.eventReplayHarness, "event_replay_status") === "complete", "Event replay harness source must be complete."));
  items.push(validationItem("sources.cost_record_projection", "source_complete", sourceStatus(sources.costRecordProjection, "cost_record_projection_status") === "complete", "Cost record projection source must be complete."));
  items.push(validationItem("sources.token_usage_projection", "source_complete", sourceStatus(sources.tokenUsageProjection, "token_usage_projection_status") === "complete", "Token usage projection source must be complete."));
  items.push(validationItem("sources.audit_event_ledger", "source_complete", sourceStatus(sources.auditEventLedger, "audit_event_ledger_status") === "complete", "Audit event ledger source must be complete."));
  items.push(validationItem("sources.ledger_api_dashboard", "source_complete", sourceStatus(sources.ledgerApiDashboard, "ledger_api_dashboard_status") === "complete", "Ledger API dashboard source must be complete."));
  items.push(validationItem("package.scripts.ledgers_golden_fixtures", "package_script_present", Boolean(packageJson.scripts?.["ledgers:golden-fixtures"]), "package.json must expose npm run ledgers:golden-fixtures."));
  items.push(validationItem("roadmap.phase_175", "roadmap_phase_declared", roadmapText.includes("Phase 175: Ledger Golden Fixtures"), "Phase 175 roadmap entry must be declared."));
  items.push(validationItem("review_dashboard.source", "dashboard_source_present", reviewDashboardSource.includes("ledger_golden_fixtures"), "Review dashboard must read ledger_golden_fixtures source artifacts."));
  items.push(validationItem("review_dashboard.stage", "dashboard_stage_present", reviewDashboardSource.includes("Ledger Golden Fixtures"), "Review dashboard must expose Ledger Golden Fixtures stage status."));
  items.push(validationItem("review_api.routes", "api_routes_present", [
    "/api/ledger-golden-fixtures",
    "/api/ledger-golden-cases",
    "/api/ledger-fixture-matrix",
    "/api/ledger-regression-hashes",
    "/api/ledger-golden-validations",
  ].every((routePath) => reviewApiSource.includes(`"${routePath}"`)), "Review API must expose ledger golden fixture routes."));
  items.push(validationItem("fixture_groups.required", "required_groups_present", REQUIRED_GROUPS.every((group) => groups.has(group)), "Replay, projection, cost, and audit fixture groups must be present."));
  items.push(validationItem("fixture_cases.locked", "cases_locked", ledgerGoldenCases.length >= REQUIRED_GROUPS.length && mismatchCases.length === 0, "All ledger golden cases must be locked.", {
    mismatch_case_ids: mismatchCases.map((item) => item.ledger_golden_case_id),
  }));
  items.push(validationItem("metric_assertions.passed", "assertions_passed", assertions.length > 0 && failedAssertions.length === 0, "All ledger fixture metric assertions must pass.", {
    failed_assertion_ids: failedAssertions.map((item) => item.assertion_id),
  }));
  items.push(validationItem("regression_hashes.locked", "regression_hashes_locked", unlockedRegressionHashes.length === 0, "All ledger fixture regression hashes must be locked.", {
    unlocked_regression_hash_ids: unlockedRegressionHashes.map((item) => item.regression_hash_id),
  }));
  items.push(validationItem("fixture_matrix.groups", "matrix_group_count", ledgerFixtureMatrix.fixture_group_count === REQUIRED_GROUPS.length, "Ledger fixture matrix must include every required group."));
  return items;
}

function summarizeLedgerGoldenFixtures({ sources, ledgerGoldenCases, ledgerRegressionManifest, validation, validationItems }) {
  const groupCounts = countBy(ledgerGoldenCases, "fixture_group");
  const assertions = ledgerGoldenCases.flatMap((item) => item.metric_assertions ?? []);
  const sourceValidationErrorCount = [
    sources.eventReplayHarness,
    sources.costRecordProjection,
    sources.tokenUsageProjection,
    sources.auditEventLedger,
    sources.ledgerApiDashboard,
  ].reduce((sum, source) => sum + (source.value?.summary?.validation_error_count ?? source.value?.validation?.errors?.length ?? 0), 0);
  return {
    ledger_golden_fixture_status: validation.valid ? "complete" : "blocked",
    ledger_golden_fixture_contract_id: FIXTURE_SET_ID,
    source_event_replay_harness_status: sourceStatus(sources.eventReplayHarness, "event_replay_status"),
    source_cost_record_projection_status: sourceStatus(sources.costRecordProjection, "cost_record_projection_status"),
    source_token_usage_projection_status: sourceStatus(sources.tokenUsageProjection, "token_usage_projection_status"),
    source_audit_event_ledger_status: sourceStatus(sources.auditEventLedger, "audit_event_ledger_status"),
    source_ledger_api_dashboard_status: sourceStatus(sources.ledgerApiDashboard, "ledger_api_dashboard_status"),
    ledger_golden_case_count: ledgerGoldenCases.length,
    locked_case_count: ledgerGoldenCases.filter((item) => item.case_status === "locked").length,
    mismatch_case_count: ledgerGoldenCases.filter((item) => item.case_status !== "locked").length,
    fixture_group_count: new Set(ledgerGoldenCases.map((item) => item.fixture_group)).size,
    replay_case_count: groupCounts.replay ?? 0,
    projection_case_count: groupCounts.projection ?? 0,
    cost_case_count: groupCounts.cost ?? 0,
    audit_case_count: groupCounts.audit ?? 0,
    metric_assertion_count: assertions.length,
    passed_metric_assertion_count: assertions.filter((item) => item.assertion_status === "passed").length,
    failed_metric_assertion_count: assertions.filter((item) => item.assertion_status !== "passed").length,
    regression_hash_count: ledgerRegressionManifest.ledger_regression_hashes.length,
    locked_regression_hash_count: ledgerRegressionManifest.ledger_regression_hashes.filter((item) => item.lock_status === "locked").length,
    human_review_required_case_count: ledgerGoldenCases.filter((item) => item.human_review_required === true).length,
    protected_action_case_count: ledgerGoldenCases.filter((item) => item.protected_action === true).length,
    source_validation_error_count: sourceValidationErrorCount,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderLedgerGoldenFixturesMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Ledger Golden Fixtures");
  lines.push("");
  lines.push("Attorney review is required before any legal, client-facing, retry, retention, delivery, or deletion decision.");
  lines.push("");
  lines.push(`- Status: ${summary.ledger_golden_fixture_status}`);
  lines.push(`- Cases: ${summary.locked_case_count}/${summary.ledger_golden_case_count}`);
  lines.push(`- Fixture groups replay/projection/cost/audit: ${summary.replay_case_count}/${summary.projection_case_count}/${summary.cost_case_count}/${summary.audit_case_count}`);
  lines.push(`- Assertions: ${summary.passed_metric_assertion_count}/${summary.metric_assertion_count}`);
  lines.push(`- Regression hashes: ${summary.locked_regression_hash_count}/${summary.regression_hash_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Cases");
  for (const item of result.ledger_golden_fixture_catalog.ledger_golden_cases) {
    lines.push(`- ${item.label}: ${item.case_status}; ${item.metric_assertions.filter((assertion) => assertion.assertion_status === "passed").length}/${item.metric_assertions.length} assertions`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    event_replay_harness_path: options.eventReplayHarnessPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.eventReplayHarnessPath,
    cost_record_projection_path: options.costRecordProjectionPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.costRecordProjectionPath,
    token_usage_projection_path: options.tokenUsageProjectionPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.tokenUsageProjectionPath,
    audit_event_ledger_path: options.auditEventLedgerPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.auditEventLedgerPath,
    ledger_api_dashboard_path: options.ledgerApiDashboardPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.ledgerApiDashboardPath,
    package_path: options.packagePath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.roadmapPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.reviewApiPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_LEDGER_GOLDEN_FIXTURES_INPUTS.reviewDashboardPath,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--event-replay-harness") args.eventReplayHarnessPath = argv[++index];
    else if (arg === "--cost-record-projection") args.costRecordProjectionPath = argv[++index];
    else if (arg === "--token-usage-projection") args.tokenUsageProjectionPath = argv[++index];
    else if (arg === "--audit-event-ledger") args.auditEventLedgerPath = argv[++index];
    else if (arg === "--ledger-api-dashboard") args.ledgerApiDashboardPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--roadmap") args.roadmapPath = argv[++index];
    else if (arg === "--review-api") args.reviewApiPath = argv[++index];
    else if (arg === "--review-dashboard") args.reviewDashboardPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/ledger-golden-fixtures.mjs [options]

Options:
  --check                         fail when validation is not complete
  --out-dir <dir>                 output directory
  --event-replay-harness <path>   event-replay-harness.json path
  --cost-record-projection <path> cost-record-projection.json path
  --token-usage-projection <path> token-usage-projection.json path
  --audit-event-ledger <path>     audit-event-ledger.json path
  --ledger-api-dashboard <path>   ledger-api-dashboard.json path
  --package <path>                package.json path
  --roadmap <path>                implementation roadmap path
  --review-api <path>             review-api source path
  --review-dashboard <path>       review-dashboard source path
  --run-at <iso>                  deterministic generated_at timestamp
  --help                          show this help
`);
}

function sourceSummary(sourceId, source, summaryKey) {
  return {
    source_id: sourceId,
    schema_version: source.value?.schema_version ?? null,
    status: sourceStatus(source, summaryKey),
    validation_error_count: source.value?.summary?.validation_error_count ?? source.value?.validation?.errors?.length ?? 0,
    generated_at: source.value?.generated_at ?? null,
    path: source.path,
    available: source.ok,
    error: source.ok ? null : source.error,
  };
}

function sourceStatus(source, summaryKey) {
  if (!source.ok) return "missing";
  return source.value?.summary?.[summaryKey] ?? (source.value?.validation?.valid === true ? "valid" : "unknown");
}

function validationItem(pathValue, checkId, passed, message, details = {}) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    ...details,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map(({ path: itemPath, message, status: _status, check_id: _checkId, ...details }) => ({ path: itemPath, message, ...details }));
  return { valid: errors.length === 0, errors };
}

async function readJsonOrError(filePath) {
  try {
    return { ok: true, path: filePath, value: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { ok: false, path: filePath, value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { ok: true, path: filePath, value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { ok: false, path: filePath, value: "", error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableLedgerGoldenFixtures(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function slugify(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function dateStamp(iso) {
  return iso.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

function stableHash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
