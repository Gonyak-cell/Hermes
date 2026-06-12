import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryG1aOpeningCloseoutReadiness } from "./factory-g1a-opening-closeout-readiness.mjs";

export const DEFAULT_FACTORY_G1A_FIRST_USE_AUDIT_READINESS_OUT_DIR = "artifacts/factory-g1a-first-use-audit-readiness/latest";

const COMMAND_NAME = "factory:g1a-first-use-audit-readiness";
const SCHEMA_VERSION = "factory-g1a-first-use-audit-readiness.v1";
const CAPABILITY_ID = "factory.g1a_first_use_audit_readiness";
const PROGRAM_RANGE = "G-SERIES.1a.first-use-audit-readiness";
const READY_STATUS = "ready_g1a_first_use_audit_for_source_literal_binding";
const WAITING_OPENING_STATUS = "waiting_for_g1a_opening_source_literal_commit";
const WAITING_AUDIT_STATUS = "waiting_for_g1a_first_use_audit_candidate";
const ALREADY_BOUND_STATUS = "g1a_first_use_audit_already_bound";
const BLOCKED_STATUS = "blocked_g1a_first_use_audit_readiness";

const REQUIRED_AUDIT_ITEMS = [
  "bind_signed_owner_receipt",
  "bind_candidate_hash",
  "create_one_workspace_only",
  "record_audit_trace",
  "confirm_no_cross_tenant_data",
  "record_post_action_status",
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

export async function runFactoryG1aFirstUseAuditReadiness(options = {}) {
  const result = await buildFactoryG1aFirstUseAuditReadiness(options);
  if (!options.check && options.write !== false) await writeFactoryG1aFirstUseAuditReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a First-Use Audit Readiness failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_first_use_audit_readiness_status !== READY_STATUS) {
    const error = new Error("Factory G1a First-Use Audit Readiness is not ready for source-literal audit binding.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aFirstUseAuditReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_FIRST_USE_AUDIT_READINESS_OUT_DIR);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(repoRoot);
  const sharedOptions = { ...options, repoRoot, runAt: generatedAt, commitRef, write: false };
  const closeoutReadiness = Object.prototype.hasOwnProperty.call(options, "closeoutReadiness")
    ? normalizeInlineBuiltSource("inline.g1a_opening_closeout_readiness", options.closeoutReadiness)
    : normalizeInlineBuiltSource("built.g1a_opening_closeout_readiness", await buildFactoryG1aOpeningCloseoutReadiness(sharedOptions));
  const auditSource = await readAuditCandidateSource({ ...options, repoRoot });
  const sourceState = buildSourceState(closeoutReadiness.data);
  const auditCandidate = auditSource.data ?? null;
  const auditCandidateSha256 = auditCandidate ? sha256(canonicalize(auditCandidate)) : null;
  const auditBindingPreview = buildAuditBindingPreview({ auditCandidate, auditCandidateSha256, sourceState, generatedAt });
  const auditReadinessRows = buildAuditReadinessRows({
    closeoutReadiness: closeoutReadiness.data,
    auditSource,
    auditCandidate,
    auditCandidateSha256,
    auditBindingPreview,
    sourceState,
    generatedAt,
  });
  const blockerRows = buildBlockerRows({ auditReadinessRows, generatedAt });
  const boundary = buildBoundary({ sourceState, auditCandidate, auditBindingPreview, auditReadinessRows, blockerRows, generatedAt });
  const validationItems = buildValidationItems({ closeoutReadiness: closeoutReadiness.data, auditReadinessRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceState, auditSource, auditCandidate, auditReadinessRows, blockerRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    source_refs: {
      reviewed_commit_sha: commitRef || null,
      g1a_opening_closeout_readiness_ref: closeoutReadiness.path,
      audit_candidate_path: auditSource.path,
    },
    source_summaries: {
      g1a_opening_closeout_readiness_status: closeoutReadiness.data.summary?.factory_g1a_opening_closeout_readiness_status ?? null,
      source_literal_opening_commit_applied: sourceState.sourceLiteralOpeningCommitApplied,
      source_literal_owner_receipt_bound: sourceState.sourceLiteralOwnerReceiptBound,
      first_use_audit_already_bound: sourceState.firstUseAuditAlreadyBound,
      owner_receipt_signed: sourceState.ownerReceiptSigned,
    },
    audit_candidate_sha256: auditCandidateSha256,
    g1a_first_use_audit_candidate: auditCandidate,
    proposed_first_use_audit_source_binding: auditBindingPreview,
    g1a_first_use_audit_readiness_rows: auditReadinessRows,
    g1a_first_use_audit_blocker_rows: blockerRows,
    factory_g1a_first_use_audit_readiness_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryG1aFirstUseAuditReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-first-use-audit-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "first-use-audit-readiness-rows.json"), collectionEnvelope("factory-g1a-first-use-audit-readiness-rows.v1", "g1a_first_use_audit_readiness_rows", result.g1a_first_use_audit_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "first-use-audit-blocker-rows.json"), collectionEnvelope("factory-g1a-first-use-audit-blocker-rows.v1", "g1a_first_use_audit_blocker_rows", result.g1a_first_use_audit_blocker_rows, result.generated_at));
  await writeJson(path.join(outDir, "proposed-first-use-audit-source-binding.json"), result.proposed_first_use_audit_source_binding);
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_first_use_audit_readiness_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-first-use-audit-readiness-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aFirstUseAuditReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aFirstUseAuditReadiness(args);
    console.log(`Factory G1a First-Use Audit Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_first_use_audit_readiness_status}`);
    console.log(`Rows pass/wait/fail: ${result.summary.readiness_pass_count}/${result.summary.readiness_wait_count}/${result.summary.readiness_fail_count}`);
    console.log(`Audit candidate present: ${result.summary.first_use_audit_candidate_present}`);
    console.log(`Ready for source binding: ${result.summary.ready_for_first_use_audit_source_binding}`);
    console.log(`G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildSourceState(closeoutReadiness) {
  const rows = closeoutReadiness.g1a_opening_closeout_chain_rows ?? [];
  const rowVerdict = (rowId) => rows.find((row) => row.row_id === rowId)?.current_verdict ?? null;
  return {
    closeoutValidationValid: closeoutReadiness.validation?.valid === true,
    ownerReceiptSigned: rowVerdict("owner_receipt.signed") === "pass",
    sourceLiteralOpeningCommitApplied: rowVerdict("source_literal.commit_applied") === "pass",
    sourceLiteralOwnerReceiptBound: rowVerdict("source_literal.owner_receipt_bound") === "pass",
    firstUseAuditAlreadyBound: rowVerdict("first_use.audit_present") === "pass",
    authorityClosedUntilComplete: rowVerdict("authority.closed_until_complete") === "pass",
    chainRowCount: rows.length,
  };
}

async function readAuditCandidateSource(options) {
  if (Object.prototype.hasOwnProperty.call(options, "auditCandidate")) {
    return normalizeInlineJsonSource("inline.g1a_first_use_audit_candidate", options.auditCandidate);
  }
  if (options.auditPath) return readJsonSource(path.resolve(options.repoRoot, options.auditPath));
  return {
    path: null,
    available: false,
    data: null,
    error: null,
  };
}

function buildAuditBindingPreview({ auditCandidate, auditCandidateSha256, sourceState, generatedAt }) {
  const auditId = auditCandidate?.audit_id ?? "G1A-FIRST-USE-AUDIT-<captured-id>";
  const ownerReceiptId = auditCandidate?.owner_gate_opening_receipt_id ?? "OWNER-G1A-GATE-OPENING-<signed-id>";
  const sourceCommit = auditCandidate?.source_literal_opening_commit_sha ?? null;
  const workspaceId = auditCandidate?.workspace_id ?? null;
  const productId = auditCandidate?.product_id ?? null;
  const preview = {
    schema_version: "factory-g1a-first-use-audit-source-binding-preview.v1",
    generated_at: generatedAt,
    preview_only: true,
    apply_allowed_now: false,
    source_mutation_allowed_now: false,
    ready_for_binding_now: false,
    target_file: "src/factory-gate-opening-readiness.mjs",
    target_symbol: "SOURCE_LITERAL_FIRST_USE_AUDITS",
    required_preconditions: {
      source_literal_opening_commit_applied: sourceState.sourceLiteralOpeningCommitApplied,
      source_literal_owner_receipt_bound: sourceState.sourceLiteralOwnerReceiptBound,
      first_use_audit_not_already_bound: sourceState.firstUseAuditAlreadyBound === false,
      audit_candidate_present: Boolean(auditCandidate),
    },
    required_replacement: {
      before: "const SOURCE_LITERAL_FIRST_USE_AUDITS = [];",
      after: renderFirstUseAuditLiteral({ auditId, auditCandidateSha256, ownerReceiptId, sourceCommit, productId, workspaceId }),
    },
    forbidden_replacements: [
      "SOURCE_LITERAL_GATE_OPEN_COMMITS.G1b",
      "SOURCE_LITERAL_GATE_OPEN_COMMITS.G2",
      "SOURCE_LITERAL_GATE_OPEN_COMMITS.G3",
      "SOURCE_LITERAL_GATE_OPENING_RECEIPTS",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "connector_write_allowed_now",
      "deployment_allowed_now",
    ],
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...preview, binding_preview_sha256: sha256(canonicalize(preview)) };
}

function renderFirstUseAuditLiteral({ auditId, auditCandidateSha256, ownerReceiptId, sourceCommit, productId, workspaceId }) {
  return [
    "const SOURCE_LITERAL_FIRST_USE_AUDITS = [",
    "  {",
    "    gate_id: \"G1a\",",
    `    audit_id: ${JSON.stringify(auditId)},`,
    `    audit_sha256: ${JSON.stringify(auditCandidateSha256)},`,
    `    owner_gate_opening_receipt_id: ${JSON.stringify(ownerReceiptId)},`,
    `    source_literal_opening_commit_sha: ${JSON.stringify(sourceCommit)},`,
    `    product_id: ${JSON.stringify(productId)},`,
    `    workspace_id: ${JSON.stringify(workspaceId)},`,
    "  },",
    "];",
  ].join("\n");
}

function buildAuditReadinessRows({ closeoutReadiness, auditSource, auditCandidate, auditCandidateSha256, auditBindingPreview, sourceState, generatedAt }) {
  const candidatePresent = Boolean(auditCandidate);
  return [
    readinessRow("source.closeout_valid", "source", sourceState.closeoutValidationValid ? "pass" : "fail", "G1a opening closeout readiness has no hard validation failures", closeoutReadiness.summary?.factory_g1a_opening_closeout_readiness_status ?? null, generatedAt),
    readinessRow("source.owner_receipt_signed", "source", sourceState.ownerReceiptSigned ? "pass" : "wait", "Signed owner receipt is visible in the G1a source chain", sourceState.ownerReceiptSigned, generatedAt),
    readinessRow("source.source_literal_commit_applied", "source", sourceState.sourceLiteralOpeningCommitApplied ? "pass" : "wait", "G1a source-literal opening commit is applied before first use", sourceState.sourceLiteralOpeningCommitApplied, generatedAt),
    readinessRow("source.owner_receipt_bound", "source", sourceState.sourceLiteralOwnerReceiptBound ? "pass" : "wait", "G1a source-literal opening commit binds the owner receipt", sourceState.sourceLiteralOwnerReceiptBound, generatedAt),
    readinessRow("source.first_use_not_already_bound", "source", sourceState.firstUseAuditAlreadyBound ? "wait" : "pass", "No first-use audit is already bound in source", sourceState.firstUseAuditAlreadyBound, generatedAt),
    readinessRow("audit.candidate_present", "audit_candidate", candidatePresent ? "pass" : "wait", "First-use audit candidate is present", auditSource.path, generatedAt),
    readinessRow("audit.schema_version", "audit_candidate", candidatePresent ? (auditCandidate.schema_version === "factory-g1a-first-use-audit.v1" ? "pass" : "fail") : "wait", "Audit candidate uses factory-g1a-first-use-audit.v1", auditCandidate?.schema_version ?? null, generatedAt),
    readinessRow("audit.gate_scope", "audit_candidate", candidatePresent ? (auditCandidate.gate_id === "G1a" && auditCandidate.authority_flag === "project_creation_allowed_now" && auditCandidate.target_action === "project_workspace_creation" ? "pass" : "fail") : "wait", "Audit candidate targets only G1a project workspace creation", auditCandidate?.gate_id ?? null, generatedAt),
    readinessRow("audit.receipt_binding", "audit_candidate", candidatePresent ? (nonEmptyString(auditCandidate.owner_gate_opening_receipt_id) && isSha256(auditCandidate.owner_gate_opening_receipt_sha256) ? "pass" : "fail") : "wait", "Audit candidate binds one signed owner receipt id and SHA-256", auditCandidate?.owner_gate_opening_receipt_id ?? null, generatedAt),
    readinessRow("audit.candidate_hash_binding", "audit_candidate", candidatePresent ? (isSha256(auditCandidate.bound_candidate_manifest_sha256) || isSha256(auditCandidate.bound_candidate_packet_sha256) ? "pass" : "fail") : "wait", "Audit candidate binds a candidate manifest or packet SHA-256", auditCandidate?.bound_candidate_manifest_sha256 ?? auditCandidate?.bound_candidate_packet_sha256 ?? null, generatedAt),
    readinessRow("audit.workspace_scope", "audit_candidate", candidatePresent ? (positiveInteger(auditCandidate.workspace_count_created) === 1 && positiveInteger(auditCandidate.receipt_count_consumed) === 1 && nonEmptyString(auditCandidate.product_id) && nonEmptyString(auditCandidate.workspace_id) ? "pass" : "fail") : "wait", "Audit candidate records exactly one workspace and one consumed receipt", auditCandidate?.workspace_id ?? null, generatedAt),
    readinessRow("audit.trace_fields", "audit_candidate", candidatePresent ? (nonEmptyString(auditCandidate.actor_id) && nonEmptyString(auditCandidate.source_literal_opening_commit_sha) && timestampString(auditCandidate.action_started_at) && timestampString(auditCandidate.action_completed_at) ? "pass" : "fail") : "wait", "Audit candidate records actor, source commit, and timestamps", auditCandidate?.actor_id ?? null, generatedAt),
    readinessRow("audit.required_items_completed", "audit_candidate", candidatePresent ? (requiredItemsCompleted(auditCandidate) ? "pass" : "fail") : "wait", "Audit candidate completes every required first-use audit checklist item", auditCandidate?.completed_item_ids ?? null, generatedAt),
    readinessRow("audit.data_boundary", "audit_candidate", candidatePresent ? (auditCandidate.cross_tenant_data_confirmed_absent === true && auditCandidate.scope_violation_detected === false && auditCandidate.raw_confidential_material_visible === false ? "pass" : "fail") : "wait", "Audit candidate confirms no cross-boundary data exposure or scope violation", auditCandidate?.cross_tenant_data_confirmed_absent ?? null, generatedAt),
    readinessRow("audit.result_success", "audit_candidate", candidatePresent ? (auditCandidate.action_result === "success" && auditCandidate.post_action_status === "success_recorded" && auditCandidate.rollback_required === false && auditCandidate.demotion_required === false ? "pass" : "fail") : "wait", "Audit candidate records a successful first use with no rollback or demotion required", auditCandidate?.action_result ?? null, generatedAt),
    readinessRow("audit.authority_closed", "authority", candidatePresent ? (candidateAuthorityClosed(auditCandidate) ? "pass" : "fail") : "wait", "Audit candidate does not claim production, enterprise, repo write, deployment, connector, or final approval authority", candidatePresent, generatedAt),
    readinessRow("binding.preview_ready", "source_binding_preview", candidatePresent && auditCandidateSha256 && auditBindingPreview.preview_only === true ? "pass" : "wait", "Source binding preview is ready and preview-only", auditCandidateSha256, generatedAt),
  ];
}

function buildBlockerRows({ auditReadinessRows, generatedAt }) {
  return auditReadinessRows
    .filter((row) => row.current_verdict !== "pass")
    .map((row, index) => {
      const blocker = {
        schema_version: "factory-g1a-first-use-audit-blocker-row.v1",
        blocker_id: `g1a.first_use_audit.blocker.${row.row_id}`,
        source_row_id: row.row_id,
        blocker_status: row.current_verdict === "fail" ? "hard_blocked" : "waiting",
        next_operator_action: nextActionForRow(row),
        generated_at: generatedAt,
        ordinal: index + 1,
      };
      return { ...blocker, blocker_row_sha256: sha256(canonicalize(blocker)) };
    });
}

function buildBoundary({ sourceState, auditCandidate, auditBindingPreview, auditReadinessRows, blockerRows, generatedAt }) {
  const failCount = auditReadinessRows.filter((row) => row.current_verdict === "fail").length;
  const waitCount = auditReadinessRows.filter((row) => row.current_verdict === "wait").length;
  const passCount = auditReadinessRows.filter((row) => row.current_verdict === "pass").length;
  const ready = failCount === 0
    && waitCount === 0
    && sourceState.sourceLiteralOpeningCommitApplied === true
    && sourceState.sourceLiteralOwnerReceiptBound === true
    && sourceState.firstUseAuditAlreadyBound === false
    && Boolean(auditCandidate);
  return {
    schema_version: "factory-g1a-first-use-audit-readiness-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    first_use_audit_readiness_only: true,
    ready_for_first_use_audit_source_binding: ready,
    blocker_count: blockerRows.length,
    readiness_pass_count: passCount,
    readiness_wait_count: waitCount,
    readiness_fail_count: failCount,
    source_literal_opening_commit_required_first: true,
    owner_receipt_binding_required_first: true,
    first_use_audit_candidate_present: Boolean(auditCandidate),
    first_use_audit_bound_by_this_command: false,
    source_mutation_allowed_now: false,
    proposed_source_binding_preview_only: auditBindingPreview.preview_only === true,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ closeoutReadiness, auditReadinessRows, boundary }) {
  const failRows = auditReadinessRows.filter((row) => row.current_verdict === "fail");
  return [
    validationItem("source.closeout_valid", "source", closeoutReadiness.validation?.valid === true, "G1a opening closeout readiness has hard validation failures"),
    validationItem("rows.present", "readiness_rows", auditReadinessRows.length === 17, "G1a first-use audit readiness row count changed unexpectedly"),
    validationItem("rows.no_failures", "readiness_rows", failRows.length === 0, `G1a first-use audit readiness has ${failRows.length} failed row(s)`),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "G1a first-use audit readiness opened forbidden authority"),
    validationItem("boundary.preview_only", "source_binding_preview", boundary.first_use_audit_bound_by_this_command === false && boundary.source_mutation_allowed_now === false, "G1a first-use audit readiness claimed to bind or mutate source"),
  ];
}

function buildSummary({ sourceState, auditSource, auditCandidate, auditReadinessRows, blockerRows, boundary, validation }) {
  const hardFailed = validation.valid === false || boundary.readiness_fail_count > 0;
  const sourceOpened = sourceState.sourceLiteralOpeningCommitApplied === true && sourceState.sourceLiteralOwnerReceiptBound === true;
  const status = hardFailed
    ? BLOCKED_STATUS
    : boundary.ready_for_first_use_audit_source_binding
      ? READY_STATUS
      : sourceState.firstUseAuditAlreadyBound
        ? ALREADY_BOUND_STATUS
        : sourceOpened
          ? WAITING_AUDIT_STATUS
          : WAITING_OPENING_STATUS;
  return {
    factory_g1a_first_use_audit_readiness_status: status,
    program_range: PROGRAM_RANGE,
    ready_for_first_use_audit_source_binding: boundary.ready_for_first_use_audit_source_binding,
    first_use_audit_candidate_present: Boolean(auditCandidate),
    first_use_audit_candidate_path: auditSource.path,
    first_use_audit_already_bound: sourceState.firstUseAuditAlreadyBound,
    source_literal_opening_commit_applied: sourceState.sourceLiteralOpeningCommitApplied,
    source_literal_owner_receipt_bound: sourceState.sourceLiteralOwnerReceiptBound,
    owner_receipt_signed: sourceState.ownerReceiptSigned,
    readiness_row_count: auditReadinessRows.length,
    readiness_pass_count: boundary.readiness_pass_count,
    readiness_wait_count: boundary.readiness_wait_count,
    readiness_fail_count: boundary.readiness_fail_count,
    blocker_count: blockerRows.length,
    waiting_blocker_ids: blockerRows.filter((row) => row.blocker_status === "waiting").map((row) => row.blocker_id),
    hard_blocker_ids: blockerRows.filter((row) => row.blocker_status === "hard_blocked").map((row) => row.blocker_id),
    first_use_audit_bound_by_this_command: false,
    source_mutation_allowed_now: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function readinessRow(rowId, category, currentVerdict, description, observedValue, generatedAt) {
  const row = {
    schema_version: "factory-g1a-first-use-audit-readiness-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    description,
    observed_value: observedValue,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-first-use-audit-readiness-validation-item.v1",
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

function nextActionForRow(row) {
  if (row.current_verdict === "fail") return `repair ${row.row_id} before first-use audit can be counted`;
  if (row.row_id === "source.source_literal_commit_applied") return "apply the reviewed isolated G1a source-literal opening commit after signed owner receipt";
  if (row.row_id === "source.owner_receipt_bound") return "bind the signed owner receipt in the isolated source-literal opening commit";
  if (row.row_id === "audit.candidate_present") return "capture the first G1a project-creation audit candidate after the gate-opening commit";
  if (row.row_id === "binding.preview_ready") return "provide a valid first-use audit candidate before source binding preview can be ready";
  return `wait for ${row.row_id}`;
}

function requiredItemsCompleted(candidate) {
  const completed = new Set(Array.isArray(candidate.completed_item_ids) ? candidate.completed_item_ids : []);
  return REQUIRED_AUDIT_ITEMS.every((item) => completed.has(item));
}

function candidateAuthorityClosed(candidate) {
  const forbiddenTrueKeys = [
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ];
  return forbiddenTrueKeys.every((key) => candidate[key] !== true);
}

function boundaryFlagsClosed(boundary) {
  return [
    "project_creation_allowed_now",
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
    "source_mutation_allowed_now",
    "first_use_audit_bound_by_this_command",
  ].every((key) => boundary[key] === false);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function timestampString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--audit") args.auditPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log("Usage: node scripts/factory-g1a-first-use-audit-readiness.mjs [--check] [--require-pass] [--no-write] [--out-dir DIR] [--audit PATH]");
  console.log("Validates the G1a first-use audit candidate and source-binding preview without mutating source or opening authority.");
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(raw),
      sha256: sha256(raw),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      sha256: null,
      error: error.message,
    };
  }
}

function normalizeInlineJsonSource(sourcePath, data) {
  const safeData = data ?? null;
  return {
    path: sourcePath,
    available: safeData !== null,
    data: safeData,
    sha256: safeData === null ? null : sha256(canonicalize(safeData)),
    error: null,
  };
}

function normalizeInlineBuiltSource(sourcePath, data) {
  return {
    path: sourcePath,
    available: Boolean(data),
    data: data ?? {},
    sha256: data ? sha256(canonicalize(serializableResult(data))) : null,
    error: null,
  };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [collectionName]: rows,
  };
}

function serializableResult(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function canonicalize(value) {
  return JSON.stringify(sortForStableJson(value));
}

function sortForStableJson(value) {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortForStableJson(value[key])]));
  }
  return value;
}

function renderMarkdown(result) {
  const lines = [
    "# Factory G1a First-Use Audit Readiness",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.summary.factory_g1a_first_use_audit_readiness_status}`,
    `Rows pass/wait/fail: ${result.summary.readiness_pass_count}/${result.summary.readiness_wait_count}/${result.summary.readiness_fail_count}`,
    `Audit candidate present: ${result.summary.first_use_audit_candidate_present}`,
    `Ready for source binding: ${result.summary.ready_for_first_use_audit_source_binding}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
    "## Blockers",
    "",
    ...result.g1a_first_use_audit_blocker_rows.map((row) => `- ${row.blocker_id}: ${row.blocker_status}; next=${row.next_operator_action}`),
    "",
    "## Boundary",
    "",
    "- Read-only: true",
    "- First-use audit bound by this command: false",
    "- Source mutation allowed now: false",
    "- Production/enterprise pass enabled: false/false",
  ];
  return `${lines.join("\n")}\n`;
}
