import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_LAUNCH_NON_HUMAN_READINESS_OUT_DIR = "artifacts/launch-non-human-readiness/latest";
export const DEFAULT_LAUNCH_NON_HUMAN_READINESS_INPUTS = {
  schemaPath: "schemas/launch-non-human-readiness.schema.json",
  packagePath: "package.json",
  workflowPath: ".github/workflows/hermes-verification-trust.yml",
  releaseReadinessPath: "artifacts/release-readiness-control-plane/latest/release-readiness-control-plane.json",
  releaseCandidatePath: "artifacts/release-candidate-report/latest/release-candidate-report.json",
  gSeriesReadinessPath: "artifacts/factory-g-series-advancement-readiness/latest/factory-g-series-advancement-readiness.json",
  stage67ReadinessPath: "artifacts/factory-stage6-7-execution-readiness/latest/factory-stage6-7-execution-readiness.json",
  workOsSmokePath: "artifacts/work-os-read-only-api-ui-smoke/latest/work-os-read-only-api-ui-smoke.json",
  amplitudeUiAuditPath: "artifacts/ui-reference/amplitude-feb-2025/latest/amplitude-ui-reference-audit.json",
};

const COMMAND_NAME = "platform:launch-non-human-readiness";
const SCHEMA_VERSION = "launch-non-human-readiness.v1";
const CAPABILITY_ID = "platform.launch_non_human_readiness";
const READY_STATUS = "ready_for_non_human_launch_readiness_execution";

const AUTHORITY_FLAGS = [
  "project_creation_allowed_now",
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "command_execution_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
];

const WORKSTREAM_SPECS = [
  {
    workstream_id: "ui.product_shell",
    title: "Product shell locale typography and operator queue",
    owner_lane: "codex",
    source_refs: ["work_os_smoke", "amplitude_ui_audit"],
    deliverables: [
      "Korean / English selector",
      "Korean typography contract",
      "Global Operator Queue",
      "Review Evidence Trace",
      "Readiness Rule Matrix",
      "read-only browser smoke",
    ],
  },
  {
    workstream_id: "factory.g_series_contracts",
    title: "G1b G2 G3 source evidence and closed authority guard",
    owner_lane: "codex",
    source_refs: ["g_series_readiness"],
    deliverables: [
      "G1b repo-write contract evidence",
      "G2 command-execution contract evidence",
      "G3 staging deployment contract evidence",
      "runtime authority remains closed",
    ],
  },
  {
    workstream_id: "factory.stage6_stage7_contracts",
    title: "Stage6 and Stage7 contract development",
    owner_lane: "codex",
    source_refs: ["stage67_readiness"],
    deliverables: [
      "Stage6 intake runtime contract",
      "Stage6 validation loop contract",
      "Stage7 staging RC contract",
      "Stage7 rollback rehearsal contract",
    ],
  },
  {
    workstream_id: "release.evidence_packet",
    title: "Release candidate evidence packet",
    owner_lane: "codex",
    source_refs: ["release_candidate", "release_readiness"],
    deliverables: [
      "release candidate report",
      "migration readiness rows",
      "rollback restore rows",
      "incident response rows",
      "production checklist rows",
    ],
  },
  {
    workstream_id: "release.review_packet_prep",
    title: "Independent review packet preparation",
    owner_lane: "codex",
    source_refs: ["release_readiness"],
    deliverables: [
      "Claude release review request packet",
      "source-bound evidence index",
      "finding adjudication template",
      "no-final-approval boundary",
    ],
  },
  {
    workstream_id: "ci.pr_observability",
    title: "PR and CI observability handoff",
    owner_lane: "codex",
    source_refs: ["package", "workflow"],
    deliverables: [
      "validation command inventory",
      "CI status reference",
      "review-required visibility",
      "merge is not self-approved",
    ],
  },
];

const CI_RUNTIME_UPGRADE_SPECS = [
  ["ci.checkout_node24", "actions/checkout@v4", "actions/checkout@v5", "Checkout action runs on Node 24-capable major"],
  ["ci.setup_node_node24", "actions/setup-node@v4", "actions/setup-node@v6", "Setup Node action runs on Node 24-capable major"],
  ["ci.upload_artifact_node24", "actions/upload-artifact@v4", "actions/upload-artifact@v7", "Upload artifact action runs on Node 24-capable major"],
];

const REVIEW_PACKET_SPECS = [
  ["review.scope", "Review scope", "Changed files and command outputs are reviewable without protected approval."],
  ["review.authority_boundary", "Authority boundary", "Codex prepares evidence but cannot self-approve release or enterprise trust."],
  ["review.evidence_matrix", "Evidence matrix", "Each workstream links to source artifact, command, and validation evidence."],
  ["review.finding_loop", "Finding loop", "Reviewer findings remain open until validated; clean checkpoint is not implied."],
  ["review.ci_status", "CI status", "PR CI can be cited as verification evidence but not as human approval."],
  ["review.human_blockers", "Human blockers", "Owner adjudication, release approval, signed provenance, and enterprise PASS stay explicit."],
];

const RELEASE_GAP_SPECS = [
  ["gap.pr_review_required", "external_review", false, "PR review is still required and cannot be closed by Codex."],
  ["gap.owner_adjudication", "human_only", false, "Human owner adjudication is required for protected closeout."],
  ["gap.signed_provenance", "human_only", false, "Signed provenance or attestation receipt is absent."],
  ["gap.release_approval", "human_only", false, "Final release approval is intentionally blocked."],
  ["gap.production_enterprise_pass", "human_only", false, "Production PASS and enterprise trust cannot be self-issued."],
  ["gap.node20_actions_annotation", "non_human_closed", true, "GitHub Actions Node 20 annotation is addressed by Node 24-capable action majors."],
];

const NEXT_WORK_QUEUE_SPECS = [
  ["queue.ci_runtime_upgrade", "CI runtime annotation cleanup", "ci_runtime_upgrade_rows"],
  ["queue.review_packet_refresh", "PR review packet refresh", "review_packet_rows"],
  ["queue.release_gap_report", "Release readiness gap report", "release_gap_rows"],
  ["queue.ui_productization", "Read-only UI productization", "ui_productization_rows"],
  ["queue.gate_cross_refs", "Gate readiness cross references", "gate_readiness_cross_ref_rows"],
  ["queue.final_validation", "Targeted full validation and PR CI", "validation_items"],
];

const UI_PRODUCTIZATION_SPECS = [
  ["ui.locale_selector", "Korean / English selector", "locale_count"],
  ["ui.korean_typography", "Hermes Pretendard and Hermes SUITE typography", "korean_font_contract_ready"],
  ["ui.operator_queue", "Global Operator Queue", "ui_binding_count"],
  ["ui.review_trace", "Review Evidence Trace", "browser_smoke_ready"],
  ["ui.launch_readiness_console", "Launch Readiness Console", "launch_readiness_console_ready"],
];

const GATE_CROSS_REF_SPECS = [
  ["gate.g1b", "G1b repo write evidence complete while repo write remains closed", "g_series_readiness", "g1b_source_evidence_complete_now", "repo_write_allowed_now"],
  ["gate.g2", "G2 command execution evidence complete while command execution remains closed", "g_series_readiness", "g2_source_evidence_complete_now", "command_execution_allowed_now"],
  ["gate.g3", "G3 deployment evidence complete while deployment remains closed", "g_series_readiness", "g3_source_evidence_complete_now", "deployment_allowed_now"],
  ["gate.stage6", "Stage6 source evidence complete while runtime remains closed", "stage67_readiness", "stage6_source_evidence_complete_now", "stage6_7_runtime_authority_open_now"],
  ["gate.stage7", "Stage7 source evidence complete while release candidate authority remains closed", "stage67_readiness", "stage7_source_evidence_complete_now", "stage7_release_candidate_allowed_now"],
  ["gate.release_control", "Release readiness stays blocked until signed provenance review and human approval", "release_readiness", "release_readiness_control_plane_status", "release_approval_allowed_now"],
];

const HUMAN_EXCLUSION_SPECS = [
  ["human.owner_adjudication", "Human owner adjudication and protected closeout", "manual_owner_decision_required"],
  ["human.release_approval", "Final release approval", "manual_release_decision_required"],
  ["human.signed_provenance", "Signed provenance receipt", "manual_signature_or_attestation_required"],
  ["human.enterprise_trust", "Enterprise trust or production PASS claim", "manual_enterprise_approval_required"],
];

export async function runLaunchNonHumanReadiness(options = {}) {
  const result = await buildLaunchNonHumanReadiness(options);
  if (options.write !== false) await writeLaunchNonHumanReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Launch non-human readiness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLaunchNonHumanReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LAUNCH_NON_HUMAN_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const workflow = await readTextSource(inputs.workflow_path);
  const sources = {
    release_readiness: await readJsonSource(inputs.release_readiness_path),
    release_candidate: await readJsonSource(inputs.release_candidate_path),
    g_series_readiness: await readJsonSource(inputs.g_series_readiness_path),
    stage67_readiness: await readJsonSource(inputs.stage67_readiness_path),
    work_os_smoke: await readJsonSource(inputs.work_os_smoke_path),
    amplitude_ui_audit: await readJsonSource(inputs.amplitude_ui_audit_path),
    package: packageJson,
    workflow,
  };
  const sourceRows = buildSourceRows(sources, generatedAt);
  const humanExclusionRows = buildHumanExclusionRows(sources, generatedAt);
  const workstreamRows = buildWorkstreamRows(sources, generatedAt);
  const commandRows = buildCommandRows(packageJson, generatedAt);
  const authorityRows = buildAuthorityRows(sources, generatedAt);
  const ciRuntimeUpgradeRows = buildCiRuntimeUpgradeRows(sources, generatedAt);
  const reviewPacketRows = buildReviewPacketRows(sources, workstreamRows, commandRows, generatedAt);
  const releaseGapRows = buildReleaseGapRows(sources, ciRuntimeUpgradeRows, generatedAt);
  const uiProductizationRows = buildUiProductizationRows(sources, generatedAt);
  const gateReadinessCrossRefRows = buildGateReadinessCrossRefRows(sources, generatedAt);
  const executionPlanRows = buildExecutionPlanRows(workstreamRows, generatedAt);
  const nextWorkQueueRows = buildNextWorkQueueRows({
    ciRuntimeUpgradeRows,
    reviewPacketRows,
    releaseGapRows,
    uiProductizationRows,
    gateReadinessCrossRefRows,
    executionPlanRows,
    generatedAt,
  });
  const boundary = buildBoundary({ sources, sourceRows, humanExclusionRows, workstreamRows, commandRows, authorityRows, ciRuntimeUpgradeRows, reviewPacketRows, releaseGapRows, uiProductizationRows, gateReadinessCrossRefRows, nextWorkQueueRows, executionPlanRows, generatedAt });
  const validationItems = buildValidationItems({ packageJson, sourceRows, humanExclusionRows, workstreamRows, commandRows, authorityRows, ciRuntimeUpgradeRows, reviewPacketRows, releaseGapRows, uiProductizationRows, gateReadinessCrossRefRows, nextWorkQueueRows, executionPlanRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    output_dir: outputDir,
    inputs,
    source_summaries: buildSourceSummaries(sources),
    non_human_source_rows: sourceRows,
    human_approval_exclusion_rows: humanExclusionRows,
    non_human_workstream_rows: workstreamRows,
    non_human_command_rows: commandRows,
    authority_guard_rows: authorityRows,
    ci_runtime_upgrade_rows: ciRuntimeUpgradeRows,
    pr_review_packet_rows: reviewPacketRows,
    release_readiness_gap_rows: releaseGapRows,
    ui_productization_rows: uiProductizationRows,
    gate_readiness_cross_ref_rows: gateReadinessCrossRefRows,
    next_work_queue_rows: nextWorkQueueRows,
    execution_plan_rows: executionPlanRows,
    launch_non_human_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRows, humanExclusionRows, workstreamRows, commandRows, authorityRows, ciRuntimeUpgradeRows, reviewPacketRows, releaseGapRows, uiProductizationRows, gateReadinessCrossRefRows, nextWorkQueueRows, executionPlanRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "launch_non_human_readiness")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, humanExclusionRows, workstreamRows, commandRows, authorityRows, ciRuntimeUpgradeRows, reviewPacketRows, releaseGapRows, uiProductizationRows, gateReadinessCrossRefRows, nextWorkQueueRows, executionPlanRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeLaunchNonHumanReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "launch-non-human-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "non-human-source-rows.json"), collectionEnvelope("launch-non-human-source-rows.v1", "non_human_source_rows", result.non_human_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "human-approval-exclusion-rows.json"), collectionEnvelope("launch-human-approval-exclusion-rows.v1", "human_approval_exclusion_rows", result.human_approval_exclusion_rows, result.generated_at));
  await writeJson(path.join(outDir, "non-human-workstream-rows.json"), collectionEnvelope("launch-non-human-workstream-rows.v1", "non_human_workstream_rows", result.non_human_workstream_rows, result.generated_at));
  await writeJson(path.join(outDir, "non-human-command-rows.json"), collectionEnvelope("launch-non-human-command-rows.v1", "non_human_command_rows", result.non_human_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-guard-rows.json"), collectionEnvelope("launch-non-human-authority-guard-rows.v1", "authority_guard_rows", result.authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "ci-runtime-upgrade-rows.json"), collectionEnvelope("launch-ci-runtime-upgrade-rows.v1", "ci_runtime_upgrade_rows", result.ci_runtime_upgrade_rows, result.generated_at));
  await writeJson(path.join(outDir, "pr-review-packet-rows.json"), collectionEnvelope("launch-pr-review-packet-rows.v1", "pr_review_packet_rows", result.pr_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-readiness-gap-rows.json"), collectionEnvelope("launch-release-readiness-gap-rows.v1", "release_readiness_gap_rows", result.release_readiness_gap_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-productization-rows.json"), collectionEnvelope("launch-ui-productization-rows.v1", "ui_productization_rows", result.ui_productization_rows, result.generated_at));
  await writeJson(path.join(outDir, "gate-readiness-cross-ref-rows.json"), collectionEnvelope("launch-gate-readiness-cross-ref-rows.v1", "gate_readiness_cross_ref_rows", result.gate_readiness_cross_ref_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-work-queue-rows.json"), collectionEnvelope("launch-next-work-queue-rows.v1", "next_work_queue_rows", result.next_work_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-plan-rows.json"), collectionEnvelope("launch-non-human-execution-plan-rows.v1", "execution_plan_rows", result.execution_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "launch-non-human-boundary.json"), result.launch_non_human_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "launch-non-human-readiness-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runLaunchNonHumanReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runLaunchNonHumanReadiness(args);
    console.log(`Launch Non-Human Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.launch_non_human_readiness_status}`);
    console.log(`Workstreams: ${result.summary.non_human_workstream_count}`);
    console.log(`Human exclusions: ${result.summary.human_approval_exclusion_count}`);
    console.log(`Authority flags closed: ${result.summary.closed_authority_flag_count}/${result.summary.authority_flag_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildSourceRows(sources, generatedAt) {
  return [
    sourceRow("release_readiness", "Release readiness control plane", sources.release_readiness, sources.release_readiness.data?.summary?.release_readiness_control_plane_status === "blocked_release_readiness_control_plane", generatedAt),
    sourceRow("release_candidate", "Release candidate report", sources.release_candidate, sources.release_candidate.data?.summary?.release_candidate_status === "complete", generatedAt),
    sourceRow("g_series_readiness", "G-series advancement readiness", sources.g_series_readiness, sources.g_series_readiness.data?.summary?.g_series_code_development_allowed_now === true, generatedAt),
    sourceRow("stage67_readiness", "Stage6 Stage7 execution readiness", sources.stage67_readiness, sources.stage67_readiness.data?.summary?.stage6_7_contract_development_allowed_now === true, generatedAt),
    sourceRow("work_os_smoke", "Work OS read-only API/UI smoke", sources.work_os_smoke, sources.work_os_smoke.data?.summary?.work_os_read_only_api_ui_smoke_status === "ready_for_work_os_read_only_api_ui_smoke", generatedAt),
    sourceRow("amplitude_ui_audit", "Amplitude UI reference audit", sources.amplitude_ui_audit, sources.amplitude_ui_audit.data?.summary?.validation_error_count === 0, generatedAt),
    sourceRow("ci_workflow", "Hermes verification trust workflow", sources.workflow, sources.workflow.available && CI_RUNTIME_UPGRADE_SPECS.every(([, legacy, target]) => !includesToken(sources.workflow.text, legacy) && includesToken(sources.workflow.text, target)), generatedAt),
  ];
}

function sourceRow(sourceId, label, source, observed, generatedAt) {
  return verdictRow({
    schema_version: "launch-non-human-source-row.v1",
    row_id: `source.${sourceId}`,
    generated_at: generatedAt,
    source_id: sourceId,
    label,
    source_path: source.path,
    source_available: source.available,
    observed,
    evidence_ref: source.path,
    next_allowed_action: observed ? "consume source for non-human launch readiness" : "refresh source artifact before launch readiness closeout",
  });
}

function buildHumanExclusionRows(sources, generatedAt) {
  const releaseSummary = sources.release_readiness.data?.summary ?? {};
  const observed = {
    "human.owner_adjudication": releaseSummary.source_ready_for_p12801_handoff === false,
    "human.release_approval": releaseSummary.release_approval_allowed_now === false,
    "human.signed_provenance": releaseSummary.signed_provenance_receipt_present_now === false,
    "human.enterprise_trust": releaseSummary.enterprise_pass_enabled === false && releaseSummary.production_pass_enabled === false,
  };
  return HUMAN_EXCLUSION_SPECS.map(([exclusion_id, label, block_reason], index) => verdictRow({
    schema_version: "launch-human-approval-exclusion-row.v1",
    row_id: `human.exclusion.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    exclusion_id,
    label,
    block_reason,
    excluded_from_codex_execution_now: true,
    requires_human: true,
    codex_may_prepare_packet: true,
    codex_may_mark_approved: false,
    observed: observed[exclusion_id] === true,
    evidence_ref: sources.release_readiness.path,
    next_allowed_action: "prepare evidence packet only; do not approve or deploy",
  }));
}

function buildWorkstreamRows(sources, generatedAt) {
  return WORKSTREAM_SPECS.map((spec, index) => {
    const sourceReady = spec.source_refs.every((sourceId) => sourceReadyForWorkstream(sourceId, sources[sourceId]));
    return verdictRow({
      schema_version: "launch-non-human-workstream-row.v1",
      row_id: `workstream.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      workstream_id: spec.workstream_id,
      title: spec.title,
      owner_lane: spec.owner_lane,
      source_refs: spec.source_refs,
      deliverables: spec.deliverables,
      source_ready: sourceReady,
      human_approval_required_for_this_workstream: false,
      opens_runtime_authority: false,
      mutates_external_service: false,
      deployment_execution_allowed: false,
      production_pass_enabled: false,
      observed: sourceReady,
      evidence_ref: spec.source_refs.map((sourceId) => sources[sourceId]?.path ?? sourceId).join(" "),
      next_allowed_action: sourceReady ? "continue implementation and evidence hardening" : "refresh missing source artifact",
    });
  });
}

function sourceReadyForWorkstream(sourceId, source) {
  if (!source?.available) return false;
  const summary = source.data?.summary ?? {};
  if (sourceId === "release_readiness") return summary.release_readiness_control_plane_status === "blocked_release_readiness_control_plane";
  if (sourceId === "release_candidate") return summary.release_candidate_status === "complete";
  if (sourceId === "g_series_readiness") return summary.g_series_code_development_allowed_now === true;
  if (sourceId === "stage67_readiness") return summary.stage6_7_contract_development_allowed_now === true;
  if (sourceId === "work_os_smoke") return summary.work_os_read_only_api_ui_smoke_status === "ready_for_work_os_read_only_api_ui_smoke";
  if (sourceId === "amplitude_ui_audit") return summary.validation_error_count === 0;
  if (sourceId === "package") return true;
  if (sourceId === "workflow") return source.available
    && CI_RUNTIME_UPGRADE_SPECS.every(([, legacy, target]) => !includesToken(source.text, legacy) && includesToken(source.text, target));
  return false;
}

function buildCommandRows(packageJson, generatedAt) {
  const scripts = packageJson.data?.scripts ?? {};
  const commandSpecs = [
    ["platform:work-os-read-only-api-ui-smoke", "UI shell and read-only API smoke"],
    ["platform:amplitude-ui-reference-audit", "Amplitude measured UI reference audit"],
    ["factory:g-series-advancement-readiness", "G-series non-human readiness"],
    ["factory:g-series-runtime-guards", "G-series protected runtime guards"],
    ["factory:stage6-7-execution-readiness", "Stage6 Stage7 contract readiness"],
    ["release:candidate", "Release candidate report"],
    ["platform:release-readiness-control-plane", "Release readiness control plane"],
    [COMMAND_NAME, "Launch non-human readiness"],
  ];
  return commandSpecs.map(([command_name, description], index) => verdictRow({
    schema_version: "launch-non-human-command-row.v1",
    row_id: `command.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    command_name,
    description,
    registered_in_package_json: typeof scripts[command_name] === "string",
    check_mode_supported: command_name === COMMAND_NAME || String(scripts[command_name] ?? "").includes("node scripts/"),
    mutates_external_service: false,
    deployment_execution_allowed: false,
    observed: typeof scripts[command_name] === "string",
    evidence_ref: "package.json",
    next_allowed_action: `run npm run ${command_name} -- --check`,
  }));
}

function buildAuthorityRows(sources, generatedAt) {
  const summaries = [
    sources.release_readiness.data?.summary ?? {},
    sources.g_series_readiness.data?.summary ?? {},
    sources.stage67_readiness.data?.summary ?? {},
    sources.work_os_smoke.data?.summary ?? {},
  ];
  return AUTHORITY_FLAGS.map((flagName, index) => {
    const observedClosed = summaries.every((summary) => summary[flagName] !== true);
    return verdictRow({
      schema_version: "launch-non-human-authority-guard-row.v1",
      row_id: `authority.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      flag_name: flagName,
      expected_value: false,
      observed_closed: observedClosed,
      observed: observedClosed,
      evidence_ref: "release/factory/work-os summaries",
      next_allowed_action: observedClosed ? "preserve closed authority boundary" : "restore closed authority boundary before continuing",
    });
  });
}

function buildCiRuntimeUpgradeRows(sources, generatedAt) {
  const workflowText = sources.workflow.text ?? "";
  return CI_RUNTIME_UPGRADE_SPECS.map(([upgrade_id, legacy_action, target_action, description], index) => {
    const legacyAbsent = !includesToken(workflowText, legacy_action);
    const targetPresent = includesToken(workflowText, target_action);
    return verdictRow({
      schema_version: "launch-ci-runtime-upgrade-row.v1",
      row_id: `ci.runtime.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      upgrade_id,
      legacy_action,
      target_action,
      description,
      workflow_ref: sources.workflow.path,
      node24_capable_major_required: true,
      legacy_action_absent: legacyAbsent,
      target_action_present: targetPresent,
      mutates_runtime_authority: false,
      release_approval_allowed_now: false,
      observed: sources.workflow.available && legacyAbsent && targetPresent,
      evidence_ref: sources.workflow.path,
      next_allowed_action: targetPresent ? "watch PR CI for annotation removal" : `upgrade ${legacy_action} to ${target_action}`,
    });
  });
}

function buildReviewPacketRows(sources, workstreamRows, commandRows, generatedAt) {
  const allWorkstreamsReady = workstreamRows.every((row) => row.current_verdict === "pass");
  const commandsRegistered = commandRows.every((row) => row.current_verdict === "pass");
  const releaseSummary = sources.release_readiness.data?.summary ?? {};
  return REVIEW_PACKET_SPECS.map(([packet_id, title, description], index) => {
    const observed = allWorkstreamsReady
      && commandsRegistered
      && sources.release_readiness.available
      && releaseSummary.release_approval_allowed_now === false
      && releaseSummary.enterprise_pass_enabled === false;
    return verdictRow({
      schema_version: "launch-pr-review-packet-row.v1",
      row_id: `review.packet.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      packet_id,
      title,
      description,
      reviewer_lane: packet_id === "review.ci_status" ? "github_ci" : "independent_reviewer_or_owner",
      source_refs: Object.keys(sources).filter((key) => ["release_readiness", "release_candidate", "g_series_readiness", "stage67_readiness", "work_os_smoke", "workflow"].includes(key)),
      codex_may_prepare_packet: true,
      codex_may_mark_approved: false,
      review_completion_claimed_now: false,
      human_approval_counted_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      observed,
      evidence_ref: "launch-non-human-readiness review packet rows",
      next_allowed_action: "present packet for reviewer or owner without approving it",
    });
  });
}

function buildReleaseGapRows(sources, ciRuntimeUpgradeRows, generatedAt) {
  const releaseSummary = sources.release_readiness.data?.summary ?? {};
  const ciUpgradeComplete = ciRuntimeUpgradeRows.every((row) => row.current_verdict === "pass");
  const gapObserved = {
    "gap.pr_review_required": true,
    "gap.owner_adjudication": releaseSummary.source_ready_for_p12801_handoff === false,
    "gap.signed_provenance": releaseSummary.signed_provenance_receipt_present_now === false,
    "gap.release_approval": releaseSummary.release_approval_allowed_now === false,
    "gap.production_enterprise_pass": releaseSummary.production_pass_enabled === false && releaseSummary.enterprise_pass_enabled === false,
    "gap.node20_actions_annotation": ciUpgradeComplete,
  };
  return RELEASE_GAP_SPECS.map(([gap_id, gap_category, codex_executable, description], index) => verdictRow({
    schema_version: "launch-release-readiness-gap-row.v1",
    row_id: `release.gap.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    gap_id,
    gap_category,
    description,
    codex_executable,
    requires_human: codex_executable === false,
    gap_status: codex_executable ? "closed_non_human" : "open_human_or_external",
    protected_closeout_required: codex_executable === false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    observed: gapObserved[gap_id] === true,
    evidence_ref: gap_id === "gap.node20_actions_annotation" ? sources.workflow.path : sources.release_readiness.path,
    next_allowed_action: codex_executable ? "cite as non-human gap closed by code change" : "prepare evidence and wait for authorized decision",
  }));
}

function buildUiProductizationRows(sources, generatedAt) {
  const summary = sources.work_os_smoke.data?.summary ?? {};
  return UI_PRODUCTIZATION_SPECS.map(([ui_id, title, summary_key], index) => {
    const value = summary[summary_key];
    const observed = typeof value === "boolean" ? value : Number(value ?? 0) > 0;
    return verdictRow({
      schema_version: "launch-ui-productization-row.v1",
      row_id: `ui.product.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      ui_id,
      title,
      summary_key,
      observed_value: value ?? null,
      source_ref: sources.work_os_smoke.path,
      first_viewport_signal: true,
      read_only_surface: true,
      protected_action_controls_enabled: false,
      raw_payload_embedded: false,
      locale_switch_supported: true,
      observed,
      evidence_ref: sources.work_os_smoke.path,
      next_allowed_action: "keep hardening product shell without adding mutation controls",
    });
  });
}

function buildGateReadinessCrossRefRows(sources, generatedAt) {
  return GATE_CROSS_REF_SPECS.map(([gate_id, description, source_id, ready_key, closed_key], index) => {
    const summary = sources[source_id]?.data?.summary ?? {};
    const readyObserved = ready_key.endsWith("_status")
      ? summary[ready_key] === "blocked_release_readiness_control_plane"
      : summary[ready_key] === true;
    const closedObserved = summary[closed_key] !== true;
    return verdictRow({
      schema_version: "launch-gate-readiness-cross-ref-row.v1",
      row_id: `gate.cross.ref.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      gate_id,
      description,
      source_id,
      ready_key,
      closed_authority_key: closed_key,
      source_evidence_complete: readyObserved,
      protected_authority_closed: closedObserved,
      opens_gate_now: false,
      owner_approval_counted_now: false,
      deployment_allowed_now: false,
      observed: readyObserved && closedObserved,
      evidence_ref: sources[source_id]?.path ?? source_id,
      next_allowed_action: "preserve readiness evidence and wait for protected approval to open real gate",
    });
  });
}

function buildNextWorkQueueRows(context) {
  const {
    ciRuntimeUpgradeRows,
    reviewPacketRows,
    releaseGapRows,
    uiProductizationRows,
    gateReadinessCrossRefRows,
    executionPlanRows,
    generatedAt,
  } = context;
  const collections = {
    ci_runtime_upgrade_rows: ciRuntimeUpgradeRows,
    review_packet_rows: reviewPacketRows,
    release_gap_rows: releaseGapRows,
    ui_productization_rows: uiProductizationRows,
    gate_readiness_cross_ref_rows: gateReadinessCrossRefRows,
    validation_items: executionPlanRows,
  };
  return NEXT_WORK_QUEUE_SPECS.map(([queue_id, title, collectionKey], index) => {
    const rows = collections[collectionKey] ?? [];
    const ready = rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
    return verdictRow({
      schema_version: "launch-next-work-queue-row.v1",
      row_id: `next.work.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      queue_id,
      sequence: index + 1,
      title,
      collection_key: collectionKey,
      row_count: rows.length,
      ready_row_count: rows.filter((row) => row.current_verdict === "pass").length,
      codex_executable_now: true,
      requires_human_before_execution: false,
      protected_action_allowed_now: false,
      release_approval_allowed_now: false,
      observed: ready,
      evidence_ref: collectionKey,
      next_allowed_action: ready ? "include in current non-human closeout summary" : "complete referenced row collection",
    });
  });
}

function buildExecutionPlanRows(workstreamRows, generatedAt) {
  return workstreamRows.map((row, index) => verdictRow({
    schema_version: "launch-non-human-execution-plan-row.v1",
    row_id: `plan.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    sequence: index + 1,
    workstream_id: row.workstream_id,
    title: row.title,
    detailed_steps: buildDetailedSteps(row.workstream_id),
    entry_condition: "human approval not required; runtime authority remains closed",
    exit_condition: "artifact, tests, and no-authority boundary validate",
    blocked_by_human_approval: false,
    observed: row.current_verdict === "pass",
    evidence_ref: row.evidence_ref,
    next_allowed_action: row.next_allowed_action,
  }));
}

function buildDetailedSteps(workstreamId) {
  const steps = {
    "ui.product_shell": [
      "bind Global Operator Console to read-only Work OS API routes",
      "verify Korean / English selector and Korean typography contract",
      "preserve hidden raw/protected material boundary",
      "run browser smoke and generated artifact check",
    ],
    "factory.g_series_contracts": [
      "preserve G1b/G2/G3 source evidence rows",
      "verify negative runtime guards block protected attempts",
      "keep repo write command and deploy authority closed",
      "produce summary for owner review without opening gates",
    ],
    "factory.stage6_stage7_contracts": [
      "verify Stage6 runtime contract rows",
      "verify Stage7 staging RC contract rows",
      "preserve no staging deployment until G3",
      "record closeout blocker as human/protected closeout only",
    ],
    "release.evidence_packet": [
      "refresh release candidate report",
      "bind migration rollback incident and checklist rows",
      "surface dashboard blocked state honestly",
      "do not mark client-facing ready",
    ],
    "release.review_packet_prep": [
      "prepare release review request packet",
      "include source-bound evidence index",
      "include finding adjudication template",
      "do not count review as human approval",
    ],
    "ci.pr_observability": [
      "run focused local checks",
      "confirm PR CI status",
      "record review-required state",
      "keep merge/final approval outside Codex authority",
    ],
  };
  return steps[workstreamId] ?? ["preserve source evidence", "run validation", "keep authority closed"];
}

function buildBoundary(context) {
  const {
    sourceRows,
    humanExclusionRows,
    workstreamRows,
    commandRows,
    authorityRows,
    ciRuntimeUpgradeRows,
    reviewPacketRows,
    releaseGapRows,
    uiProductizationRows,
    gateReadinessCrossRefRows,
    nextWorkQueueRows,
    executionPlanRows,
    generatedAt,
  } = context;
  return {
    schema_version: "launch-non-human-boundary.v1",
    generated_at: generatedAt,
    human_approval_excluded_now: true,
    codex_final_approval_allowed: false,
    human_approval_counted_as_done: false,
    release_approval_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_authority_open_now: false,
    protected_action_allowed_now: false,
    non_human_work_allowed_now: true,
    all_sources_available: sourceRows.every((row) => row.source_available),
    all_human_exclusions_visible: humanExclusionRows.every((row) => row.current_verdict === "pass"),
    all_workstreams_ready: workstreamRows.every((row) => row.current_verdict === "pass"),
    all_commands_registered: commandRows.every((row) => row.current_verdict === "pass"),
    all_authority_flags_closed: authorityRows.every((row) => row.current_verdict === "pass"),
    ci_runtime_upgraded: ciRuntimeUpgradeRows.every((row) => row.current_verdict === "pass"),
    pr_review_packet_ready: reviewPacketRows.every((row) => row.current_verdict === "pass"),
    release_gaps_classified: releaseGapRows.every((row) => row.current_verdict === "pass"),
    ui_productization_ready: uiProductizationRows.every((row) => row.current_verdict === "pass"),
    gate_readiness_cross_refs_ready: gateReadinessCrossRefRows.every((row) => row.current_verdict === "pass"),
    next_work_queue_ready: nextWorkQueueRows.every((row) => row.current_verdict === "pass"),
    all_execution_plan_rows_ready: executionPlanRows.every((row) => row.current_verdict === "pass"),
  };
}

function buildValidationItems(context) {
  const {
    packageJson,
    sourceRows,
    humanExclusionRows,
    workstreamRows,
    commandRows,
    authorityRows,
    ciRuntimeUpgradeRows,
    reviewPacketRows,
    releaseGapRows,
    uiProductizationRows,
    gateReadinessCrossRefRows,
    nextWorkQueueRows,
    executionPlanRows,
    boundary,
  } = context;
  return [
    validationItem("package.available", "source", packageJson.available, "package.json is readable"),
    validationItem("sources.available", "source", sourceRows.every((row) => row.source_available), "all launch readiness source artifacts are readable"),
    validationItem("human.exclusions.visible", "boundary", humanExclusionRows.every((row) => row.current_verdict === "pass"), "human-only approval blockers are visible and excluded from Codex execution"),
    validationItem("workstreams.ready", "workstream", workstreamRows.every((row) => row.current_verdict === "pass"), "all non-human workstreams have ready source evidence"),
    validationItem("commands.registered", "command", commandRows.every((row) => row.current_verdict === "pass"), "all launch non-human commands are registered"),
    validationItem("authority.closed", "authority", authorityRows.every((row) => row.current_verdict === "pass"), "all protected authority flags remain closed"),
    validationItem("ci.runtime.upgraded", "ci", ciRuntimeUpgradeRows.every((row) => row.current_verdict === "pass"), "GitHub Actions workflow uses Node 24-capable action majors"),
    validationItem("review.packet.ready", "review", reviewPacketRows.every((row) => row.current_verdict === "pass"), "PR review packet rows are ready without approval claims"),
    validationItem("release.gaps.classified", "release", releaseGapRows.every((row) => row.current_verdict === "pass"), "release readiness gaps are classified as human/external or non-human closed"),
    validationItem("ui.productization.ready", "ui", uiProductizationRows.every((row) => row.current_verdict === "pass"), "read-only UI productization rows are ready"),
    validationItem("gate.cross.refs.ready", "factory", gateReadinessCrossRefRows.every((row) => row.current_verdict === "pass"), "gate readiness cross references are ready without opening protected gates"),
    validationItem("next.work.queue.ready", "queue", nextWorkQueueRows.every((row) => row.current_verdict === "pass"), "next work queue rows are ready"),
    validationItem("execution.plan.ready", "plan", executionPlanRows.every((row) => row.current_verdict === "pass"), "execution plan rows are ready"),
    validationItem("boundary.no.final.approval", "boundary", boundary.codex_final_approval_allowed === false && boundary.release_approval_allowed_now === false, "Codex does not approve or release"),
    validationItem("boundary.no.deploy", "boundary", boundary.deployment_allowed_now === false && boundary.runtime_authority_open_now === false, "deployment and runtime authority stay closed"),
  ];
}

function buildSummary(context) {
  const {
    sourceRows,
    humanExclusionRows,
    workstreamRows,
    commandRows,
    authorityRows,
    ciRuntimeUpgradeRows = [],
    reviewPacketRows = [],
    releaseGapRows = [],
    uiProductizationRows = [],
    gateReadinessCrossRefRows = [],
    nextWorkQueueRows = [],
    executionPlanRows,
    boundary,
    validation,
  } = context;
  const ready = validation.valid
    && boundary.human_approval_excluded_now
    && boundary.non_human_work_allowed_now
    && boundary.all_authority_flags_closed;
  return {
    schema_version: "launch-non-human-readiness-summary.v1",
    launch_non_human_readiness_status: ready ? READY_STATUS : "blocked_launch_non_human_readiness",
    source_count: sourceRows.length,
    source_available_count: sourceRows.filter((row) => row.source_available).length,
    human_approval_exclusion_count: humanExclusionRows.length,
    human_approval_excluded_now: boundary.human_approval_excluded_now,
    non_human_workstream_count: workstreamRows.length,
    non_human_workstream_ready_count: workstreamRows.filter((row) => row.current_verdict === "pass").length,
    command_count: commandRows.length,
    command_registered_count: commandRows.filter((row) => row.current_verdict === "pass").length,
    authority_flag_count: authorityRows.length,
    closed_authority_flag_count: authorityRows.filter((row) => row.current_verdict === "pass").length,
    ci_runtime_upgrade_count: ciRuntimeUpgradeRows.length,
    ci_runtime_upgrade_ready_count: ciRuntimeUpgradeRows.filter((row) => row.current_verdict === "pass").length,
    pr_review_packet_row_count: reviewPacketRows.length,
    pr_review_packet_ready_count: reviewPacketRows.filter((row) => row.current_verdict === "pass").length,
    release_gap_count: releaseGapRows.length,
    release_gap_classified_count: releaseGapRows.filter((row) => row.current_verdict === "pass").length,
    human_or_external_release_gap_count: releaseGapRows.filter((row) => row.requires_human === true).length,
    non_human_closed_gap_count: releaseGapRows.filter((row) => row.gap_status === "closed_non_human").length,
    ui_productization_count: uiProductizationRows.length,
    ui_productization_ready_count: uiProductizationRows.filter((row) => row.current_verdict === "pass").length,
    gate_readiness_cross_ref_count: gateReadinessCrossRefRows.length,
    gate_readiness_cross_ref_ready_count: gateReadinessCrossRefRows.filter((row) => row.current_verdict === "pass").length,
    next_work_queue_count: nextWorkQueueRows.length,
    next_work_queue_ready_count: nextWorkQueueRows.filter((row) => row.current_verdict === "pass").length,
    execution_plan_row_count: executionPlanRows.length,
    execution_plan_ready_count: executionPlanRows.filter((row) => row.current_verdict === "pass").length,
    codex_final_approval_allowed: false,
    release_approval_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    ready_for_human_review_after_non_human_work: ready,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceSummaries(sources) {
  return Object.fromEntries(Object.entries(sources).map(([sourceId, source]) => [
    sourceId,
    {
      available: source.available,
      path: source.path,
      summary: source.data?.summary ?? null,
    },
  ]));
}

function renderMarkdown(result) {
  const lines = [
    "# Launch Non-Human Readiness",
    "",
    `Generated at: ${result.generated_at}`,
    `Status: ${result.summary.launch_non_human_readiness_status}`,
    "",
    "## Boundary",
    "",
    "- Human approval, release approval, signed provenance, production PASS, enterprise PASS, deployment, and protected runtime authority are excluded.",
    "- Codex may prepare packets, run read-only validation, improve UI/API surfaces, and preserve evidence.",
    "- Codex must not mark protected closeout complete.",
    "",
    "## Workstreams",
    "",
    ...result.non_human_workstream_rows.map((row) => `- ${row.workstream_id}: ${row.title} (${row.current_verdict})`),
    "",
    "## Commands",
    "",
    ...result.non_human_command_rows.map((row) => `- npm run ${row.command_name} -- --check`),
    "",
    "## Release Gaps",
    "",
    ...result.release_readiness_gap_rows.map((row) => `- ${row.gap_id}: ${row.gap_status} (${row.current_verdict})`),
    "",
    "## Next Work Queue",
    "",
    ...result.next_work_queue_rows.map((row) => `- ${row.sequence}. ${row.title}: ${row.current_verdict}`),
    "",
  ];
  return lines.join("\n");
}

function renderHtml(result) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Launch Non-Human Readiness</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #151a17; background: #f7f9f8; letter-spacing: 0; }
    header, main { padding: 20px 24px; }
    header { background: #fff; border-bottom: 1px solid #d8dfda; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    section { border-top: 1px solid #d8dfda; padding-top: 14px; margin-top: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #d8dfda; border-radius: 8px; padding: 12px; min-height: 96px; }
    .muted { color: #5f6963; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <header>
    <h1>Launch Non-Human Readiness</h1>
    <div class="muted">Human approval excluded. Runtime, deploy, release approval, production PASS, and enterprise PASS stay closed.</div>
  </header>
  <main>
    <section>
      <h2>Summary</h2>
      <div class="grid">
        <div class="card"><strong>Status</strong><div class="mono">${escapeHtml(result.summary.launch_non_human_readiness_status)}</div></div>
        <div class="card"><strong>Workstreams</strong><div>${result.summary.non_human_workstream_ready_count}/${result.summary.non_human_workstream_count}</div></div>
        <div class="card"><strong>Authority Closed</strong><div>${result.summary.closed_authority_flag_count}/${result.summary.authority_flag_count}</div></div>
        <div class="card"><strong>Review Packet</strong><div>${result.summary.pr_review_packet_ready_count}/${result.summary.pr_review_packet_row_count}</div></div>
        <div class="card"><strong>Release Gaps</strong><div>${result.summary.release_gap_classified_count}/${result.summary.release_gap_count}</div></div>
        <div class="card"><strong>Next Queue</strong><div>${result.summary.next_work_queue_ready_count}/${result.summary.next_work_queue_count}</div></div>
      </div>
    </section>
    <section>
      <h2>Workstreams</h2>
      <div class="grid">${result.non_human_workstream_rows.map((row) => `<article class="card"><strong>${escapeHtml(row.title)}</strong><div class="mono">${escapeHtml(row.workstream_id)}</div><p>${escapeHtml(row.next_allowed_action)}</p></article>`).join("")}</div>
    </section>
    <section>
      <h2>Release Gaps</h2>
      <div class="grid">${result.release_readiness_gap_rows.map((row) => `<article class="card"><strong>${escapeHtml(row.gap_id)}</strong><div class="mono">${escapeHtml(row.gap_status)}</div><p>${escapeHtml(row.description)}</p></article>`).join("")}</div>
    </section>
  </main>
</body>
</html>`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LAUNCH_NON_HUMAN_READINESS_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    workflow_path: path.resolve(options.workflowPath ?? defaults.workflowPath),
    release_readiness_path: path.resolve(options.releaseReadinessPath ?? defaults.releaseReadinessPath),
    release_candidate_path: path.resolve(options.releaseCandidatePath ?? defaults.releaseCandidatePath),
    g_series_readiness_path: path.resolve(options.gSeriesReadinessPath ?? defaults.gSeriesReadinessPath),
    stage67_readiness_path: path.resolve(options.stage67ReadinessPath ?? defaults.stage67ReadinessPath),
    work_os_smoke_path: path.resolve(options.workOsSmokePath ?? defaults.workOsSmokePath),
    amplitude_ui_audit_path: path.resolve(options.amplitudeUiAuditPath ?? defaults.amplitudeUiAuditPath),
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

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: null };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") { parsed.check = true; parsed.write = false; }
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--workflow") parsed.workflowPath = argv[++index];
    else if (arg === "--release-readiness") parsed.releaseReadinessPath = argv[++index];
    else if (arg === "--release-candidate") parsed.releaseCandidatePath = argv[++index];
    else if (arg === "--g-series") parsed.gSeriesReadinessPath = argv[++index];
    else if (arg === "--stage67") parsed.stage67ReadinessPath = argv[++index];
    else if (arg === "--work-os-smoke") parsed.workOsSmokePath = argv[++index];
    else if (arg === "--amplitude-ui-audit") parsed.amplitudeUiAuditPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Builds the launch readiness plan for all non-human work while preserving approval and deployment boundaries.");
}

function verdictRow(row) {
  return {
    block_reason: row.observed ? null : `${row.label ?? row.title ?? row.row_id} missing or blocked.`,
    ...row,
    current_verdict: row.observed ? "pass" : "blocked",
  };
}

function validationItem(pathKey, category, pass, message) {
  return {
    schema_version: "launch-non-human-readiness-validation-item.v1",
    path: pathKey,
    category,
    status: pass ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, count: rows.length, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function includesToken(text, token) {
  return String(text ?? "").includes(token);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
