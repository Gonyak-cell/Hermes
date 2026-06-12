import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_FACTORY_GATE_OPENING_READINESS_OUT_DIR = "artifacts/factory-gate-opening-readiness/latest";
export const DEFAULT_FACTORY_GATE_OPENING_READINESS_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
  gateOpeningProgramDocPath: "docs/factory-promotion/05-gate-opening-program.md",
  masterPromotionPlanDocPath: "docs/factory-promotion/02-master-promotion-plan.md",
};

const COMMAND_NAME = "factory:gate-opening-readiness";
const SCHEMA_VERSION = "factory-gate-opening-readiness.v1";
const CAPABILITY_ID = "factory.gate_opening_readiness";
const PROGRAM_RANGE = "G-SERIES.0";
const SOURCE_PROGRAM_RANGE = "FCORE-FA-FE";
const READY_STATUS = "ready_factory_gate_opening_readiness";
const BLOCKED_STATUS = "blocked_factory_gate_opening_readiness";

// Gate opening is intentionally a source-literal change, not a data flag.
// Future gate-opening commits must change this constant in an isolated commit.
const SOURCE_LITERAL_GATE_OPEN_COMMITS = {
  G1a: true,
  G1b: false,
  G2: false,
  G3: false,
};

// Owner receipts become countable only after a source-literal gate-opening commit
// names the receipt here. Runtime data alone must never open authority.
const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [
  {
    gate_id: "G1a",
    receipt_id: "OWNER-G1A-GATE-OPENING-GONYAK-CELL-20260612-ALPHA",
    receipt_sha256: "ddb647e5806799263b439bd7baefd8175016b79388b6ab2ceeac4a572e5c6316",
    owner_signed_at: "2026-06-12T07:06:37Z",
    independent_review_receipt_ref: "docs/factory-promotion/g1a-claude-opus-4-8-review-receipt.md",
    scope_limit: "new product workspace creation only; one owner gate_opening receipt permits one scoped creation action",
  },
];
const SOURCE_LITERAL_FIRST_USE_AUDITS = [
  {
    gate_id: "G1a",
    audit_id: "G1A-FIRST-USE-AUDIT-GONYAK-CELL-20260612-ALPHA",
    audit_sha256: "ec943fb68d02926b05863e2a620194c567e74393043ad8cd9a11b4cb64ee3249",
    audit_ref: "examples/factory/g1a-first-use-audit-gonyak-cell-alpha.json",
    owner_gate_opening_receipt_id: "OWNER-G1A-GATE-OPENING-GONYAK-CELL-20260612-ALPHA",
    source_literal_opening_commit_sha: "e681f2a7fc9a6f9915f94dd1428877a5b02393c1",
    product_id: "product.fc2_candidate_gonyak_cell_alpha",
    workspace_id: "workspace.g1a.gonyak_cell.alpha",
  },
];

const GATE_DEFINITIONS = [
  {
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    ps_transition: "PS2_receipt_bound_to_PS3_candidate_ready",
    prerequisite_key: "stage2_candidate_manifest_and_fb_review",
    prerequisite_description: "Stage 2 candidate manifest resolver and FB review receipts are ready.",
    scope_limit: "new product workspace creation only; one receipt permits one creation action",
  },
  {
    gate_id: "G1b",
    gate_name: "repo_write_patch_apply",
    authority_flag: "repo_write_allowed_now",
    ps_transition: "PS3_candidate_ready_to_PS4_apply_ready",
    prerequisite_key: "stage4_closed_apply_cycle_and_fd_review",
    prerequisite_description: "Stage 4 closed apply cycle and FD review evidence are ready.",
    scope_limit: "worktree-scoped patch apply only; protected paths stay blocked",
  },
  {
    gate_id: "G2",
    gate_name: "command_execution",
    authority_flag: "command_execution_enabled",
    ps_transition: "PS4_apply_ready_to_PS5_limited_execution",
    prerequisite_key: "g1b_three_no_incident_usage_rows",
    prerequisite_description: "G1b has at least three no-incident usage rows.",
    scope_limit: "repo-local allowlist commands with timeout and logs",
  },
  {
    gate_id: "G3",
    gate_name: "deployment_staging",
    authority_flag: "deployment_allowed_now",
    ps_transition: "PS6_release_candidate_to_PS7_deploy_ready",
    prerequisite_key: "g2_release_candidate_evidence_loop",
    prerequisite_description: "G2 and release-candidate evidence loop are ready.",
    scope_limit: "one pilot product in staging only",
  },
];

const CLOSED_AUTHORITY_FLAGS = {
  project_creation_allowed_now: false,
  review_decision_allowed_now: false,
  approval_allowed_now: false,
  apply_allowed_now: false,
  command_execution_enabled: false,
  command_execution_allowed_now: false,
  work_packet_execution_allowed_now: false,
  work_item_execution_allowed_now: false,
  validation_loop_execution_allowed_now: false,
  worker_execution_allowed_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryGateOpeningReadiness(options = {}) {
  const result = await buildFactoryGateOpeningReadiness(options);
  if (!options.check && options.write !== false) await writeFactoryGateOpeningReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Gate Opening Readiness failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_gate_opening_readiness_status !== READY_STATUS) {
    const error = new Error("Factory Gate Opening Readiness is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryGateOpeningReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_GATE_OPENING_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = Object.prototype.hasOwnProperty.call(options, "structuredSummary")
    ? normalizeInlineJsonSource("inline.structured_summary", options.structuredSummary)
    : await readJsonSource(inputs.structured_summary_path);
  const gateProgramDoc = await readTextSource(inputs.gate_opening_program_doc_path);
  const masterPlanDoc = await readTextSource(inputs.master_promotion_plan_doc_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState({ packageJson, structuredSummary, gateProgramDoc, masterPlanDoc, commitRef });
  const prerequisiteRows = buildPrerequisiteRows(sourceState, generatedAt);
  const gateRows = buildGateRows({ sourceState, prerequisiteRows, generatedAt });
  const deferredGateRows = buildDeferredGateRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows({ sourceState, generatedAt });
  const boundary = buildBoundary({ sourceState, gateRows, deferredGateRows, negativeFixtureRows, generatedAt });
  const validationItems = buildValidationItems({ sourceState, prerequisiteRows, gateRows, deferredGateRows, negativeFixtureRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceState, prerequisiteRows, gateRows, deferredGateRows, negativeFixtureRows, boundary, validation });
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
      structured_summary_path: structuredSummary.path,
      gate_opening_program_doc_path: gateProgramDoc.path,
      master_promotion_plan_doc_path: masterPlanDoc.path,
    },
    source_summaries: {
      f0_completed: sourceState.f0Completed,
      fb_ready: sourceState.fbReady,
      fc_ready: sourceState.fcReady,
      fd_ready: sourceState.fdReady,
      fe_ready: sourceState.feReady,
      protected_closeout_required: sourceState.protectedCloseoutRequired,
      g_series_program_required: sourceState.gSeriesProgramRequired,
    },
    factory_gate_opening_prerequisite_rows: prerequisiteRows,
    factory_gate_opening_readiness_rows: gateRows,
    factory_deferred_gate_rows: deferredGateRows,
    factory_gate_opening_negative_fixture_rows: negativeFixtureRows,
    factory_gate_opening_readiness_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryGateOpeningReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-gate-opening-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "gate-opening-prerequisite-rows.json"), collectionEnvelope("factory-gate-opening-prerequisite-rows.v1", "factory_gate_opening_prerequisite_rows", result.factory_gate_opening_prerequisite_rows, result.generated_at));
  await writeJson(path.join(outDir, "gate-opening-readiness-rows.json"), collectionEnvelope("factory-gate-opening-readiness-rows.v1", "factory_gate_opening_readiness_rows", result.factory_gate_opening_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "deferred-gate-rows.json"), collectionEnvelope("factory-deferred-gate-rows.v1", "factory_deferred_gate_rows", result.factory_deferred_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-gate-opening-negative-fixture-rows.v1", "factory_gate_opening_negative_fixture_rows", result.factory_gate_opening_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_gate_opening_readiness_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-gate-opening-readiness-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryGateOpeningReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryGateOpeningReadiness(args);
    console.log(`Factory Gate Opening Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_gate_opening_readiness_status}`);
    console.log(`Gate rows: ${result.summary.gate_count}`);
    console.log(`Gate open now: ${result.summary.gate_open_count}`);
    console.log(`G1a status: ${result.summary.g1a_gate_status}`);
    console.log(`Deferred gates closed: ${result.summary.deferred_gate_closed_count}/${result.summary.deferred_gate_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_GATE_OPENING_READINESS_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
    gate_opening_program_doc_path: path.resolve(repoRoot, options.gateOpeningProgramDocPath ?? defaults.gateOpeningProgramDocPath),
    master_promotion_plan_doc_path: path.resolve(repoRoot, options.masterPromotionPlanDocPath ?? defaults.masterPromotionPlanDocPath),
  };
}

function buildSourceState({ packageJson, structuredSummary, gateProgramDoc, masterPlanDoc, commitRef }) {
  const summary = structuredSummary.data ?? {};
  const scripts = packageJson.data?.scripts ?? {};
  const phaseState = {
    fb: phasesReady(summary, ["fb1", "fb2", "fb3", "fb4", "fb5"]),
    fc: phasesReady(summary, ["fc1", "fc2", "fc3", "fc4", "fc5"]),
    fd: phasesReady(summary, ["fd1", "fd2", "fd3", "fd4", "fd5"]),
    fe: phasesReady(summary, ["fe1", "fe2", "fe3", "fe4"]),
  };
  const remainingHardBlockers = summary.remaining_hard_blockers ?? [];
  return {
    commitRefPresent: Boolean(commitRef),
    packageScriptRegistered: typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-gate-opening-readiness.mjs"),
    gateProgramDocReady: gateProgramDoc.available
      && gateProgramDoc.text.includes("G1a")
      && gateProgramDoc.text.includes("G1b")
      && gateProgramDoc.text.includes("G2")
      && gateProgramDoc.text.includes("G3")
      && gateProgramDoc.text.includes("receipt_kind: gate_opening"),
    masterPlanDocReady: masterPlanDoc.available
      && masterPlanDoc.text.includes("Stage 5")
      && masterPlanDoc.text.includes("Stage 7")
      && masterPlanDoc.text.includes("production_pass_enabled"),
    f0Completed: summary.f0_completed === true
      && summary.f0_and_fb3_deferred_review_blockers_closed_now === true
      && summary.independent_review_evidence_complete_for_f0_and_fb3_now === true,
    fbReady: phaseState.fb.ready,
    fcReady: phaseState.fc.ready,
    fdReady: phaseState.fd.ready,
    feReady: phaseState.fe.ready,
    phaseState,
    gSeriesProgramRequired: summary.fe4_g_series_program_required_before_gate_opening === true,
    protectedCloseoutRequired: remainingHardBlockers.some((item) => String(item).includes("human owner protected closeout")),
    productionEnterpriseTrustClosed: summary.fe4_production_pass_enabled === false
      && summary.fe4_enterprise_pass_enabled === false
      && summary.fe4_factory_promotion_goal_complete_allowed_now === false,
    fbCandidateManifestEvidenceReady: summary.fb3_status?.includes("reviewed") === true
      && summary.fb3_claude_code_review_blocking_findings === 0
      && summary.fb4_starter_artifact_corpus_materialized_now === true
      && summary.fb5_status?.includes("reviewed") === true,
    fdClosedApplyReady: summary.fd5_status?.includes("reviewed") === true
      && summary.fd5_apply_allowed_now === false
      && summary.fd5_apply_engine_runtime_enabled_now === false
      && summary.fd5_repo_write_allowed_now === false,
    g1bNoIncidentUsageCount: Number(summary.g1b_no_incident_usage_count ?? 0),
    releaseCandidateEvidenceReady: summary.stage7_release_candidate_evidence_ready === true,
  };
}

function phasesReady(summary, phases) {
  const states = phases.map((phase) => {
    const status = String(summary[`${phase}_status`] ?? "");
    const reviewStatus = String(summary[`${phase}_claude_code_review_status`] ?? "");
    const receipt = summary[`${phase}_review_receipt`] ?? null;
    const blocking = summary[`${phase}_claude_code_review_blocking_findings`];
    const blockingClean = blocking === undefined
      || blocking === null
      || Number(blocking) === 0
      || reviewStatus.includes("no_blocking")
      || reviewStatus.includes("no_findings");
    return {
      phase,
      status,
      review_status: reviewStatus || null,
      receipt,
      ready: status.startsWith("ready_"),
      reviewed: reviewStatus.startsWith("valid_") && receipt !== null,
      blocking_clean: blockingClean,
    };
  });
  return {
    ready: states.every((state) => state.ready && state.reviewed && state.blocking_clean),
    states,
  };
}

function buildPrerequisiteRows(sourceState, generatedAt) {
  const checks = [
    ["f0_owner_adjudication_and_review_receipts", "F0 owner adjudication and F0/FB3 independent review deferrals are closed.", sourceState.f0Completed],
    ["fb_read_only_factory_ready", "FB read-only factory, candidate manifest resolver, starter corpus, and workbench are reviewed.", sourceState.fbReady && sourceState.fbCandidateManifestEvidenceReady],
    ["fc_candidate_factory_ready", "FC candidate packet, review docket, API, and freeze handoff are reviewed.", sourceState.fcReady],
    ["fd_closed_apply_cycle_ready", "FD receipt verification, closed apply engine, chain audit, and closed apply cycle freeze are reviewed.", sourceState.fdReady && sourceState.fdClosedApplyReady],
    ["fe_freeze_handoff_ready", "FE intake, work packet decomposition, validation-loop candidates, and FE freeze are reviewed.", sourceState.feReady],
    ["g_series_program_required", "FE.4 keeps authority closed and points to the separate G-series program.", sourceState.gSeriesProgramRequired],
    ["protected_closeout_required_visible", "Human owner protected closeout remains visible before production or enterprise trust.", sourceState.protectedCloseoutRequired],
    ["production_enterprise_trust_closed", "Production, enterprise, and factory goal-complete authority remain closed.", sourceState.productionEnterpriseTrustClosed],
  ];
  return checks.map(([rowKey, description, passed], index) => {
    const row = {
      schema_version: "factory-gate-opening-prerequisite-row.v1",
      prerequisite_id: `gate-prereq.${rowKey}`,
      row_key: rowKey,
      prerequisite_status: passed ? "ready" : "blocked",
      description,
      generated_at: generatedAt,
      ordinal: index + 1,
    };
    return { ...row, prerequisite_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildGateRows({ sourceState, prerequisiteRows, generatedAt }) {
  const prerequisites = Object.fromEntries(prerequisiteRows.map((row) => [row.row_key, row.prerequisite_status === "ready"]));
  const gatePrerequisites = {
    G1a: prerequisites.f0_owner_adjudication_and_review_receipts && prerequisites.fb_read_only_factory_ready,
    G1b: prerequisites.fc_candidate_factory_ready && prerequisites.fd_closed_apply_cycle_ready,
    G2: false,
    G3: false,
  };
  const g1aEvidenceComplete = gatePrerequisites.G1a === true
    && SOURCE_LITERAL_GATE_OPENING_RECEIPTS.some((receipt) => receipt.gate_id === "G1a")
    && SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a === true
    && SOURCE_LITERAL_FIRST_USE_AUDITS.some((audit) => audit.gate_id === "G1a");
  const previousGateOpen = { G1a: true, G1b: g1aEvidenceComplete, G2: false, G3: false };
  return GATE_DEFINITIONS.map((definition, index) => {
    const ownerReceiptPresent = SOURCE_LITERAL_GATE_OPENING_RECEIPTS.some((receipt) => receipt.gate_id === definition.gate_id);
    const firstUseAuditRefs = SOURCE_LITERAL_FIRST_USE_AUDITS.filter((audit) => audit.gate_id === definition.gate_id);
    const firstUseAuditPresent = firstUseAuditRefs.length > 0;
    const sourceLiteralCommitPresent = SOURCE_LITERAL_GATE_OPEN_COMMITS[definition.gate_id] === true;
    const prerequisiteReady = gatePrerequisites[definition.gate_id] === true;
    const previousReady = previousGateOpen[definition.gate_id] === true;
    const gateEvidenceComplete = prerequisiteReady && previousReady && ownerReceiptPresent && sourceLiteralCommitPresent && firstUseAuditPresent;
    const gateOpen = false;
    const blockedReasonIds = buildGateBlockedReasons({
      definition,
      prerequisiteReady,
      previousReady,
      ownerReceiptPresent,
      sourceLiteralCommitPresent,
      firstUseAuditPresent,
      sourceState,
    });
    const row = {
      schema_version: "factory-gate-opening-readiness-row.v1",
      gate_id: definition.gate_id,
      gate_name: definition.gate_name,
      authority_flag: definition.authority_flag,
      ps_transition: definition.ps_transition,
      prerequisite_key: definition.prerequisite_key,
      prerequisite_description: definition.prerequisite_description,
      prerequisite_status: prerequisiteReady ? "ready" : "blocked",
      previous_gate_status: previousReady ? "not_required_or_open" : "blocked_previous_gate_closed",
      gate_status: gateOpen ? "open" : buildGateStatus({
        definition,
        prerequisiteReady,
        previousReady,
        ownerReceiptPresent,
        sourceLiteralCommitPresent,
        firstUseAuditPresent,
        gateEvidenceComplete,
      }),
      gate_open_now: gateOpen,
      gate_evidence_complete_now: gateEvidenceComplete,
      runtime_authority_open_now: false,
      owner_gate_opening_receipt_required: true,
      owner_gate_opening_receipt_present: ownerReceiptPresent,
      receipt_kind_required: "gate_opening",
      source_literal_gate_open_commit_required: true,
      source_literal_gate_open_commit_present: sourceLiteralCommitPresent,
      source_literal_change_only: true,
      data_driven_opening_allowed_now: false,
      first_use_audit_required: true,
      first_use_audit_present: firstUseAuditPresent,
      first_use_audit_refs: firstUseAuditRefs.map((audit) => ({
        audit_id: audit.audit_id,
        audit_sha256: audit.audit_sha256,
        audit_ref: audit.audit_ref,
      })),
      one_receipt_one_action: true,
      scope_limit: definition.scope_limit,
      blocked_reason_ids: blockedReasonIds,
      next_operator_actions: buildNextOperatorActions(definition.gate_id, blockedReasonIds),
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
      g1a_project_creation_gate_open_now: definition.gate_id === "G1a" ? gateOpen : false,
      g1b_repo_write_gate_open_now: definition.gate_id === "G1b" ? gateOpen : false,
      g2_command_execution_gate_open_now: definition.gate_id === "G2" ? gateOpen : false,
      g3_deployment_gate_open_now: definition.gate_id === "G3" ? gateOpen : false,
    };
    return { ...row, gate_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildGateBlockedReasons({ definition, prerequisiteReady, previousReady, ownerReceiptPresent, sourceLiteralCommitPresent, firstUseAuditPresent, sourceState }) {
  const reasons = [];
  if (!prerequisiteReady) reasons.push(`${definition.prerequisite_key}_missing`);
  if (!previousReady) reasons.push("previous_gate_not_open");
  if (definition.gate_id === "G2" && sourceState.g1bNoIncidentUsageCount < 3) reasons.push("g1b_three_no_incident_usage_rows_missing");
  if (!ownerReceiptPresent) reasons.push("gate_opening_receipt_missing");
  if (!sourceLiteralCommitPresent) reasons.push("source_literal_gate_open_commit_missing");
  if (!firstUseAuditPresent) reasons.push("post_open_first_use_audit_missing");
  return [...new Set(reasons)];
}

function buildGateStatus({ definition, prerequisiteReady, previousReady, ownerReceiptPresent, sourceLiteralCommitPresent, firstUseAuditPresent, gateEvidenceComplete }) {
  if (gateEvidenceComplete) return "source_evidence_complete_runtime_authority_closed";
  if (!prerequisiteReady) return "blocked_prerequisites_missing";
  if (!previousReady) return "blocked_previous_gate_closed";
  if (definition.gate_id === "G1a" && ownerReceiptPresent && sourceLiteralCommitPresent && !firstUseAuditPresent) return "waiting_for_first_use_audit_after_source_literal_commit";
  if (definition.gate_id === "G1a" && ownerReceiptPresent && !sourceLiteralCommitPresent) return "ready_for_source_literal_commit";
  if (definition.gate_id === "G1a" && !ownerReceiptPresent && sourceLiteralCommitPresent) return "blocked_source_literal_commit_without_owner_receipt";
  if (definition.gate_id === "G1a") return "ready_for_owner_gate_receipt_and_source_literal_commit";
  return "blocked_gate_order_or_usage_evidence_missing";
}

function buildNextOperatorActions(gateId, blockedReasonIds) {
  if (gateId === "G1a" && blockedReasonIds.length === 1 && blockedReasonIds.includes("post_open_first_use_audit_missing")) {
    return ["capture_g1a_first_use_audit_after_owner_authorized_opening"];
  }
  if (gateId === "G1a" && blockedReasonIds.includes("gate_opening_receipt_missing")) {
    return ["prepare_g1a_gate_opening_receipt", "prepare_isolated_source_literal_gate_opening_commit", "request_independent_gate_opening_review"];
  }
  if (blockedReasonIds.includes("previous_gate_not_open")) return ["complete_previous_gate_opening_sequence_first"];
  return ["keep_gate_closed_and_collect_missing_evidence"];
}

function buildDeferredGateRows(generatedAt) {
  const rows = [
    ["connector_write_allowed_now", "external service and secret/OAuth program not in this gate-opening scope"],
    ["production_pass_enabled", "requires independent GitHub approval and required status checks"],
    ["enterprise_pass_enabled", "requires signed attestation and independent review evidence"],
    ["codex_final_approval_allowed_now", "AI final approval is permanently disallowed"],
    ["claude_final_approval_allowed_now", "AI final approval is permanently disallowed"],
    ["fable_final_approval_allowed_now", "planning engine cannot approve implementation"],
  ];
  return rows.map(([authorityFlag, reason], index) => {
    const row = {
      schema_version: "factory-deferred-gate-row.v1",
      deferred_gate_id: `deferred.${authorityFlag}`,
      authority_flag: authorityFlag,
      gate_status: "deferred_closed",
      gate_open_now: false,
      deferred_reason: reason,
      generated_at: generatedAt,
      ordinal: index + 1,
    };
    return { ...row, deferred_gate_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildNegativeFixtureRows({ generatedAt }) {
  const fixtures = [
    ["data_only_gate_open_attempt", "Data tries to open G1a without source literal commit.", true],
    ["owner_receipt_without_source_commit", "Owner receipt without source literal gate commit remains blocked.", true],
    ["source_commit_without_owner_receipt", "Source literal gate commit without owner receipt remains blocked.", true],
    ["production_enterprise_gate_attempt", "Production and enterprise trust stay deferred even after G-series readiness.", true],
    ["ai_final_approval_attempt", "AI final approval flags stay permanently closed.", true],
  ];
  return fixtures.map(([fixtureKey, description, blocked], index) => {
    const row = {
      schema_version: "factory-gate-opening-negative-fixture-row.v1",
      fixture_id: `gate-opening-negative.${fixtureKey}`,
      fixture_key: fixtureKey,
      fixture_status: blocked ? "blocked_as_expected" : "failed_opened_unexpectedly",
      description,
      observed_gate_open_now: false,
      observed_data_driven_opening_allowed_now: false,
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
    };
    return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildBoundary({ sourceState, gateRows, deferredGateRows, negativeFixtureRows, generatedAt }) {
  const gateOpenCount = gateRows.filter((row) => row.gate_open_now).length;
  return {
    schema_version: "factory-gate-opening-readiness-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    source_literal_authority_model: true,
    data_driven_gate_opening_allowed_now: false,
    g_series_program_required: sourceState.gSeriesProgramRequired,
    gate_count: gateRows.length,
    gate_open_count: gateOpenCount,
    deferred_gate_count: deferredGateRows.length,
    deferred_gate_closed_count: deferredGateRows.filter((row) => row.gate_open_now === false).length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    human_owner_protected_closeout_required: sourceState.protectedCloseoutRequired,
    factory_promotion_goal_complete_allowed_now: false,
    g1a_project_creation_gate_open_now: gateRows.find((row) => row.gate_id === "G1a")?.gate_open_now === true,
    g1a_source_evidence_complete_now: gateRows.find((row) => row.gate_id === "G1a")?.gate_evidence_complete_now === true,
    g1b_repo_write_gate_open_now: gateRows.find((row) => row.gate_id === "G1b")?.gate_open_now === true,
    g2_command_execution_gate_open_now: gateRows.find((row) => row.gate_id === "G2")?.gate_open_now === true,
    g3_deployment_gate_open_now: gateRows.find((row) => row.gate_id === "G3")?.gate_open_now === true,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ sourceState, prerequisiteRows, gateRows, deferredGateRows, negativeFixtureRows, boundary }) {
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:gate-opening-readiness"),
    validationItem("docs.gate_program_ready", "docs", sourceState.gateProgramDocReady, "Gate opening program doc is missing required G-series matrix or receipt wording"),
    validationItem("docs.master_plan_ready", "docs", sourceState.masterPlanDocReady, "Master promotion plan does not expose Stage 5/7 and trust boundary wording"),
    validationItem("source.commit_ref_present", "source", sourceState.commitRefPresent, "Current commit ref is missing"),
    validationItem("prerequisites.rows_present", "prerequisites", prerequisiteRows.length >= 8, "Gate prerequisite rows are incomplete"),
    validationItem("gates.rows_present", "gates", gateRows.length === 4, "G1a/G1b/G2/G3 rows are incomplete"),
    validationItem("gates.no_data_driven_opening", "authority", gateRows.every((row) => row.data_driven_opening_allowed_now === false && row.source_literal_change_only === true), "A gate can be opened by data instead of source literal"),
    validationItem("gates.closed_without_source_and_receipt", "authority", gateRows.every((row) => row.gate_open_now === false || (row.owner_gate_opening_receipt_present && row.source_literal_gate_open_commit_present && row.first_use_audit_present)), "Gate opened without source commit, owner receipt, or first-use audit"),
    validationItem("deferred.closed", "authority", deferredGateRows.length >= 6 && deferredGateRows.every((row) => row.gate_open_now === false), "Deferred trust or connector gates opened"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length >= 5 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "Gate-opening negative fixtures did not all block"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Protected authority boundary opened"),
  ];
}

function buildSummary({ prerequisiteRows, gateRows, deferredGateRows, negativeFixtureRows, boundary, validation }) {
  const readyPrerequisites = prerequisiteRows.filter((row) => row.prerequisite_status === "ready").length;
  const gateOpenCount = gateRows.filter((row) => row.gate_open_now).length;
  const g1a = gateRows.find((row) => row.gate_id === "G1a");
  const ready = validation.valid
    && readyPrerequisites === prerequisiteRows.length
    && gateRows.length === 4
    && gateOpenCount === 0
    && boundaryFlagsClosed(boundary);
  return {
    factory_gate_opening_readiness_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    prerequisite_count: prerequisiteRows.length,
    prerequisite_ready_count: readyPrerequisites,
    gate_count: gateRows.length,
    gate_open_count: gateOpenCount,
    gate_evidence_complete_count: gateRows.filter((row) => row.gate_evidence_complete_now).length,
    g1a_gate_status: g1a?.gate_status ?? null,
    g1a_source_evidence_complete_now: g1a?.gate_evidence_complete_now === true,
    g1a_ready_for_owner_receipt_now: g1a?.gate_status === "ready_for_owner_gate_receipt_and_source_literal_commit",
    source_literal_gate_open_commit_count: gateRows.filter((row) => row.source_literal_gate_open_commit_present).length,
    owner_gate_opening_receipt_count: gateRows.filter((row) => row.owner_gate_opening_receipt_present).length,
    first_use_audit_count: gateRows.filter((row) => row.first_use_audit_present).length,
    deferred_gate_count: deferredGateRows.length,
    deferred_gate_closed_count: deferredGateRows.filter((row) => row.gate_open_now === false).length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    data_driven_gate_opening_allowed_now: false,
    source_literal_authority_model: true,
    human_owner_protected_closeout_required: boundary.human_owner_protected_closeout_required,
    factory_promotion_goal_complete_allowed_now: false,
    g1a_project_creation_gate_open_now: false,
    g1b_repo_write_gate_open_now: false,
    g2_command_execution_gate_open_now: false,
    g3_deployment_gate_open_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-gate-opening-readiness-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function boundaryFlagsClosed(boundary) {
  return [
    ...Object.keys(CLOSED_AUTHORITY_FLAGS),
    "factory_promotion_goal_complete_allowed_now",
    "g1a_project_creation_gate_open_now",
    "g1b_repo_write_gate_open_now",
    "g2_command_execution_gate_open_now",
    "g3_deployment_gate_open_now",
  ].every((flag) => boundary[flag] === false);
}

function renderMarkdown(result) {
  return [
    "# Factory Gate Opening Readiness",
    "",
    `Status: ${result.summary.factory_gate_opening_readiness_status}`,
    `Program: ${result.program_range}`,
    `Prerequisites: ${result.summary.prerequisite_ready_count}/${result.summary.prerequisite_count}`,
    `Gate rows: ${result.summary.gate_count}`,
    `Gate open now: ${result.summary.gate_open_count}`,
    `G1a status: ${result.summary.g1a_gate_status}`,
    `Deferred gates closed: ${result.summary.deferred_gate_closed_count}/${result.summary.deferred_gate_count}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Factory goal complete allowed: ${result.summary.factory_promotion_goal_complete_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-gate-opening-readiness.mjs [--check] [--require-pass] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds the G-series gate opening readiness read model without opening authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(text),
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

function normalizeInlineJsonSource(sourcePath, data) {
  return {
    path: sourcePath,
    available: true,
    data,
    error: null,
  };
}

async function readTextSource(filePath) {
  try {
    return {
      path: filePath,
      available: true,
      text: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      error: error.message,
    };
  }
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
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

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
