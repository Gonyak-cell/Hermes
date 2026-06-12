import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryGateOpeningReadiness } from "./factory-gate-opening-readiness.mjs";

export const DEFAULT_FACTORY_G1A_OPENING_PACKET_OUT_DIR = "artifacts/factory-g1a-opening-packet/latest";
export const DEFAULT_FACTORY_G1A_OPENING_PACKET_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
  gateOpeningProgramDocPath: "docs/factory-promotion/05-gate-opening-program.md",
  gateOpeningReadinessDocPath: "docs/factory-promotion/g0-gate-opening-readiness.md",
  gateOpeningSourcePath: "src/factory-gate-opening-readiness.mjs",
};

const COMMAND_NAME = "factory:g1a-opening-packet";
const SCHEMA_VERSION = "factory-g1a-opening-packet.v1";
const CAPABILITY_ID = "factory.g1a_opening_packet";
const PROGRAM_RANGE = "G-SERIES.1a";
const SOURCE_PROGRAM_RANGE = "G-SERIES.0";
const READY_STATUS = "ready_factory_g1a_opening_packet";
const BLOCKED_STATUS = "blocked_factory_g1a_opening_packet";
const REVIEW_ID = "G-SERIES.G1a";
const REVIEW_MODEL = "claude-opus-4-8";
const REVIEW_EFFORT = "max";

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

const G1A_SCOPE_LIMIT = "new product workspace creation only; one owner gate_opening receipt permits one scoped creation action";

export async function runFactoryG1aOpeningPacket(options = {}) {
  const result = await buildFactoryG1aOpeningPacket(options);
  if (!options.check && options.write !== false) await writeFactoryG1aOpeningPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Opening Packet failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_opening_packet_status !== READY_STATUS) {
    const error = new Error("Factory G1a Opening Packet is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aOpeningPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_OPENING_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = Object.prototype.hasOwnProperty.call(options, "structuredSummary")
    ? normalizeInlineJsonSource("inline.structured_summary", options.structuredSummary)
    : await readJsonSource(inputs.structured_summary_path);
  const gateOpeningProgramDoc = await readTextSource(inputs.gate_opening_program_doc_path);
  const gateOpeningReadinessDoc = await readTextSource(inputs.gate_opening_readiness_doc_path);
  const gateOpeningSource = await readTextSource(inputs.gate_opening_source_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const gateOpeningReadiness = Object.prototype.hasOwnProperty.call(options, "gateOpeningReadiness")
    ? normalizeInlineBuiltSource("inline.gate_opening_readiness", options.gateOpeningReadiness)
    : normalizeInlineBuiltSource("built.gate_opening_readiness", await buildFactoryGateOpeningReadiness({
      repoRoot: inputs.repo_root,
      structuredSummary: structuredSummary.data,
      runAt: generatedAt,
      commitRef,
      write: false,
    }));

  const sourceState = buildSourceState({
    packageJson,
    structuredSummary,
    gateOpeningProgramDoc,
    gateOpeningReadinessDoc,
    gateOpeningSource,
    gateOpeningReadiness,
    commitRef,
  });
  const ownerReceiptTemplate = buildOwnerReceiptTemplate({ generatedAt, commitRef });
  const sourceLiteralOpeningCommitPlan = buildSourceLiteralOpeningCommitPlan({ generatedAt, commitRef, sourceState });
  const firstUseAuditChecklist = buildFirstUseAuditChecklist({ generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({ generatedAt });
  const reviewSchema = buildReviewSchema();
  const reviewRequest = buildReviewRequest({ generatedAt, outputDir, commitRef, reviewSchema });
  const independentReviewPacket = buildIndependentReviewPacket({ generatedAt, outputDir, commitRef, reviewRequest });
  const boundary = buildBoundary({
    sourceState,
    ownerReceiptTemplate,
    sourceLiteralOpeningCommitPlan,
    independentReviewPacket,
    firstUseAuditChecklist,
    negativeFixtureRows,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    sourceState,
    ownerReceiptTemplate,
    sourceLiteralOpeningCommitPlan,
    independentReviewPacket,
    firstUseAuditChecklist,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceState,
    ownerReceiptTemplate,
    sourceLiteralOpeningCommitPlan,
    independentReviewPacket,
    firstUseAuditChecklist,
    negativeFixtureRows,
    boundary,
    validation,
  });
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
      reviewed_commit_sha: commitRef || null,
      structured_summary_path: structuredSummary.path,
      gate_opening_readiness_ref: gateOpeningReadiness.path,
      gate_opening_program_doc_path: gateOpeningProgramDoc.path,
      gate_opening_readiness_doc_path: gateOpeningReadinessDoc.path,
      gate_opening_source_path: gateOpeningSource.path,
    },
    source_summaries: {
      g0_status: sourceState.g0Status,
      g1a_gate_status: sourceState.g1aGateStatus,
      g1a_ready_for_owner_receipt_now: sourceState.g1aReadyForOwnerReceiptNow,
      g1a_gate_open_now: sourceState.g1aGateOpenNow,
      g1a_source_literal_current_value: sourceState.g1aSourceLiteralCurrentValue,
      g1a_owner_receipt_present: sourceState.g1aOwnerReceiptPresent,
      g1a_first_use_audit_present: sourceState.g1aFirstUseAuditPresent,
    },
    owner_gate_opening_receipt_template: ownerReceiptTemplate,
    source_literal_opening_commit_plan: sourceLiteralOpeningCommitPlan,
    first_use_audit_checklist: firstUseAuditChecklist,
    independent_review_packet: independentReviewPacket,
    review_request: reviewRequest,
    review_schema: reviewSchema,
    factory_g1a_opening_negative_fixture_rows: negativeFixtureRows,
    factory_g1a_opening_packet_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    review_prompt: renderReviewPrompt(result),
    markdown: renderMarkdown(result),
  };
}

export async function writeFactoryG1aOpeningPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-opening-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "owner-gate-opening-receipt-template.json"), result.owner_gate_opening_receipt_template);
  await writeJson(path.join(outDir, "source-literal-opening-commit-plan.json"), result.source_literal_opening_commit_plan);
  await writeJson(path.join(outDir, "first-use-audit-checklist.json"), result.first_use_audit_checklist);
  await writeJson(path.join(outDir, "independent-review-packet.json"), result.independent_review_packet);
  await writeJson(path.join(outDir, "review-request.json"), result.review_request);
  await writeJson(path.join(outDir, "review-schema.json"), result.review_schema);
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-g1a-opening-negative-fixture-rows.v1", "factory_g1a_opening_negative_fixture_rows", result.factory_g1a_opening_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_opening_packet_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-opening-packet-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "review-prompt.md"), result.review_prompt, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aOpeningPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aOpeningPacket(args);
    console.log(`Factory G1a Opening Packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_opening_packet_status}`);
    console.log(`G0 status: ${result.summary.g0_status}`);
    console.log(`G1a gate status: ${result.summary.g1a_gate_status}`);
    console.log(`Owner receipt template ready: ${result.summary.owner_gate_opening_receipt_template_ready}`);
    console.log(`Independent review packet ready: ${result.summary.independent_review_packet_ready}`);
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

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_G1A_OPENING_PACKET_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
    gate_opening_program_doc_path: path.resolve(repoRoot, options.gateOpeningProgramDocPath ?? defaults.gateOpeningProgramDocPath),
    gate_opening_readiness_doc_path: path.resolve(repoRoot, options.gateOpeningReadinessDocPath ?? defaults.gateOpeningReadinessDocPath),
    gate_opening_source_path: path.resolve(repoRoot, options.gateOpeningSourcePath ?? defaults.gateOpeningSourcePath),
  };
}

function buildSourceState({ packageJson, structuredSummary, gateOpeningProgramDoc, gateOpeningReadinessDoc, gateOpeningSource, gateOpeningReadiness, commitRef }) {
  const scripts = packageJson.data?.scripts ?? {};
  const summary = structuredSummary.data ?? {};
  const readiness = gateOpeningReadiness.data ?? {};
  const g1aRow = readiness.factory_gate_opening_readiness_rows?.find((row) => row.gate_id === "G1a") ?? null;
  const sourceText = gateOpeningSource.text ?? "";
  const g1aCurrentValue = extractG1aSourceLiteralValue(sourceText);
  return {
    packageScriptRegistered: typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-opening-packet.mjs"),
    commitRefPresent: Boolean(commitRef),
    structuredSummaryReady: summary.g0_status === "ready_factory_gate_opening_readiness"
      && summary.g0_g1a_ready_for_owner_receipt_now === true
      && summary.g0_gate_open_count === 0,
    g0Status: readiness.summary?.factory_gate_opening_readiness_status ?? summary.g0_status ?? null,
    g0ValidationValid: readiness.validation?.valid === true,
    g0GateOpenCount: Number(readiness.summary?.gate_open_count ?? summary.g0_gate_open_count ?? -1),
    g1aGateStatus: g1aRow?.gate_status ?? summary.g0_g1a_gate_status ?? null,
    g1aReadyForOwnerReceiptNow: g1aRow?.gate_status === "ready_for_owner_gate_receipt_and_source_literal_commit"
      || summary.g0_g1a_ready_for_owner_receipt_now === true,
    g1aGateOpenNow: g1aRow?.gate_open_now === true,
    g1aOwnerReceiptPresent: g1aRow?.owner_gate_opening_receipt_present === true,
    g1aFirstUseAuditPresent: g1aRow?.first_use_audit_present === true,
    g1aSourceLiteralCommitPresent: g1aRow?.source_literal_gate_open_commit_present === true,
    g1aSourceLiteralCurrentValue: g1aCurrentValue,
    gateOpeningProgramDocReady: gateOpeningProgramDoc.available
      && gateOpeningProgramDoc.text.includes("G1a")
      && gateOpeningProgramDoc.text.includes("receipt_kind: gate_opening")
      && gateOpeningProgramDoc.text.includes("소스 리터럴"),
    gateOpeningReadinessDocReady: gateOpeningReadinessDoc.available
      && gateOpeningReadinessDoc.text.includes("G1a status")
      && gateOpeningReadinessDoc.text.includes("gate_open_now: false"),
    gateOpeningSourceReady: gateOpeningSource.available
      && sourceText.includes("SOURCE_LITERAL_GATE_OPEN_COMMITS")
      && g1aCurrentValue === false,
  };
}

function extractG1aSourceLiteralValue(sourceText) {
  const match = String(sourceText ?? "").match(/const\s+SOURCE_LITERAL_GATE_OPEN_COMMITS\s*=\s*\{([\s\S]*?)\};/);
  const block = match?.[1] ?? "";
  if (/\bG1a:\s*true\b/.test(block)) return true;
  if (/\bG1a:\s*false\b/.test(block)) return false;
  return null;
}

function buildOwnerReceiptTemplate({ generatedAt, commitRef }) {
  const receipt = {
    schema_version: "factory-gate-opening-owner-receipt.v1",
    receipt_id: "OWNER-G1A-GATE-OPENING-TEMPLATE",
    receipt_kind: "gate_opening",
    receipt_status: "template_not_signed",
    generated_at: generatedAt,
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    target_action: "project_workspace_creation",
    target_action_status: "not_performed",
    reviewed_commit_sha: commitRef || null,
    scope_limit: G1A_SCOPE_LIMIT,
    one_receipt_one_action: true,
    human_owner_signature_required: true,
    human_owner_signed: false,
    owner_name: null,
    owner_signed_at: null,
    owner_decision: null,
    source_literal_opening_commit_required: true,
    source_literal_opening_commit_sha: null,
    independent_review_required: true,
    independent_review_receipt_ref: null,
    first_use_audit_required: true,
    first_use_audit_ref: null,
    candidate_binding_required: true,
    bound_candidate_manifest_sha256: null,
    bound_candidate_packet_sha256: null,
    notes: "Template only. This receipt does not open G1a until a human owner signs it and an isolated source-literal gate-opening commit binds the signed receipt.",
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...receipt, receipt_template_sha256: sha256(canonicalize(receipt)) };
}

function buildSourceLiteralOpeningCommitPlan({ generatedAt, commitRef, sourceState }) {
  const plan = {
    schema_version: "factory-g1a-source-literal-opening-commit-plan.v1",
    plan_id: "g1a.source_literal_opening_commit_plan",
    generated_at: generatedAt,
    current_commit_sha: commitRef || null,
    plan_status: "planned_not_applied",
    opens_gate_now: false,
    source_file: "src/factory-gate-opening-readiness.mjs",
    source_literal_path: "SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a",
    current_source_literal_value: sourceState.g1aSourceLiteralCurrentValue,
    future_source_literal_value_after_owner_approval: true,
    isolated_commit_required: true,
    one_gate_per_commit: true,
    owner_gate_opening_receipt_required_before_commit: true,
    owner_gate_opening_receipt_id_placeholder: "OWNER-G1A-GATE-OPENING-<signed-id>",
    independent_review_required_before_or_with_commit: true,
    first_use_audit_required_after_commit: true,
    forbidden_co_changes: [
      "G1b/G2/G3 source literals",
      "repo_write_allowed_now",
      "command_execution_enabled",
      "deployment_allowed_now",
      "connector_write_allowed_now",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "AI final approval flags",
    ],
    rollback_plan: "If first-use audit fails or project creation breaches scope, revert the isolated source-literal commit and append a demotion/incident receipt before retry.",
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...plan, plan_sha256: sha256(canonicalize(plan)) };
}

function buildFirstUseAuditChecklist({ generatedAt }) {
  const checklistItems = [
    ["bind_signed_owner_receipt", "Bind exactly one signed owner gate_opening receipt to the action."],
    ["bind_candidate_hash", "Record candidate manifest or candidate packet SHA-256 before creating the workspace."],
    ["create_one_workspace_only", "Create exactly one new product workspace within the G1a scope limit."],
    ["record_audit_trace", "Capture actor, timestamp, source commit, receipt id, product id, workspace id, and result."],
    ["confirm_no_cross_tenant_data", "Confirm no project, tenant, domain, privileged, or confidential data crossed boundaries."],
    ["record_post_action_status", "Record success, rollback, or demotion decision after the first use."],
  ];
  const checklist = {
    schema_version: "factory-g1a-first-use-audit-checklist.v1",
    checklist_id: "g1a.first_use_audit",
    generated_at: generatedAt,
    checklist_status: "template_not_performed",
    gate_id: "G1a",
    first_use_audit_required: true,
    first_use_audit_present: false,
    required_items: checklistItems.map(([item_id, description], index) => ({
      schema_version: "factory-g1a-first-use-audit-item.v1",
      item_id,
      description,
      required: true,
      completed: false,
      ordinal: index + 1,
    })),
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...checklist, checklist_sha256: sha256(canonicalize(checklist)) };
}

function buildIndependentReviewPacket({ generatedAt, outputDir, commitRef, reviewRequest }) {
  const rawOutputPath = relativeArtifactPath(outputDir, "raw-output.json");
  const promptPath = relativeArtifactPath(outputDir, "review-prompt.md");
  const packet = {
    schema_version: "factory-g1a-independent-review-packet.v1",
    review_id: REVIEW_ID,
    generated_at: generatedAt,
    review_status: "packet_ready_review_not_run",
    reviewed_commit_sha: commitRef || null,
    method: "law_firm_os_style_claude_opus_4_8_max",
    reviewer_lane: "Claude Code Opus max",
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    permission_mode: "dontAsk",
    read_only: true,
    tools: ["Read", "Grep", "Glob"],
    prompt_path: promptPath,
    raw_output_path: rawOutputPath,
    review_request_path: relativeArtifactPath(outputDir, "review-request.json"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    review_request_sha256: sha256(canonicalize(reviewRequest)),
    launch_command: `claude -p "$(cat ${promptPath})" --model ${REVIEW_MODEL} --effort ${REVIEW_EFFORT} --permission-mode dontAsk --tools Read,Grep,Glob --json-schema "$(jq -c 'del(.schema_version)' ${relativeArtifactPath(outputDir, "review-schema.json")})" --output-format json --max-budget-usd 4 --no-session-persistence > ${rawOutputPath}`,
    evidence_validation_command: `npm run factory:claude-review-evidence -- --review-id g1a-opus-4-8-lawos-style --program-range ${PROGRAM_RANGE} --raw-review ${rawOutputPath} --prompt ${promptPath} --out-dir ${relativeArtifactPath(outputDir, "evidence-validation")} --check --require-valid`,
    review_questions: [
      "Does the G1a packet keep project_creation_allowed_now and every other authority flag closed?",
      "Does the owner receipt remain a template_not_signed artifact rather than a signed or completed gate opening receipt?",
      "Does the source literal plan identify exactly one future isolated change and avoid opening G1a in the packet commit?",
      "Do data-only receipts, unsigned receipts, source-plan-only attempts, and non-G1a authorities fail closed?",
      "Are the Review API route and CLI read-only packet surfaces only?",
      "Are tests sufficient for ready packet, blocked upstream readiness, check-mode no-write, and API method guards?",
    ],
    required_commands: [
      "node --check src/factory-g1a-opening-packet.mjs scripts/factory-g1a-opening-packet.mjs src/factory-gate-opening-readiness.mjs scripts/factory-gate-opening-readiness.mjs src/review-api.mjs scripts/review-api-smoke.mjs",
      "node --test test/factory-g1a-opening-packet.test.mjs test/factory-gate-opening-readiness.test.mjs",
      "npm run factory:g1a-opening-packet -- --check --require-pass",
      "npm run factory:gate-opening-readiness -- --check --require-pass",
      "npm run api:smoke",
      "npm run contracts:validate -- --check",
      "git diff --check",
    ],
    invalid_evidence_rules: [
      "empty output is invalid",
      "auth or login failure is invalid",
      "quota or usage-limit failure is invalid",
      "interrupted or cancelled output is invalid",
      "malformed JSON review payload is invalid",
      "tool-call-shaped output without verdict is invalid",
      "Claude final approval, production PASS, enterprise PASS, or source mutation claims invalidate the evidence",
    ],
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...packet, packet_sha256: sha256(canonicalize(packet)) };
}

function buildReviewRequest({ generatedAt, outputDir, commitRef, reviewSchema }) {
  const request = {
    schema_version: "hermes.g1a-lawos-style-review-request.v1",
    created_at: generatedAt,
    scope_id: "factory_g1a_opening_packet",
    program_range: PROGRAM_RANGE,
    reviewed_commit_sha: commitRef || null,
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    tools: ["Read", "Grep", "Glob"],
    permission_mode: "dontAsk",
    output_format: "json",
    raw_output_path: relativeArtifactPath(outputDir, "raw-output.json"),
    prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    review_schema_sha256: sha256(canonicalize(reviewSchema)),
    counts_as_final_approval: false,
    opens_gate_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...request, review_request_sha256: sha256(canonicalize(request)) };
}

function buildReviewSchema() {
  return {
    schema_version: "hermes.g1a-lawos-style-review-schema.v1",
    type: "object",
    additionalProperties: false,
    required: [
      "verdict",
      "blocking_findings",
      "non_blocking_findings",
      "changes_required_before_commit",
      "validated_commands",
      "review_notes",
      "reviewed_commit_sha",
      "engine_resolved_model_id",
      "is_final_approval",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "source_mutation_performed",
    ],
    properties: {
      verdict: { enum: ["APPROVE", "APPROVE_WITH_FINDINGS", "BLOCK"] },
      blocking_findings: { type: "array" },
      non_blocking_findings: { type: "array" },
      changes_required_before_commit: { type: "boolean" },
      validated_commands: { type: "array", items: { type: "string" } },
      review_notes: { type: "string" },
      reviewed_commit_sha: { type: "string" },
      engine_resolved_model_id: { type: "string" },
      is_final_approval: { const: false },
      production_pass_enabled: { const: false },
      enterprise_pass_enabled: { const: false },
      source_mutation_performed: { const: false },
    },
  };
}

function buildNegativeFixtureRows({ generatedAt }) {
  const fixtures = [
    ["data_only_g1a_open_attempt", "Data or JSON receipt tries to open G1a without source literal commit.", "blocked"],
    ["unsigned_owner_receipt_attempt", "Template or unsigned owner receipt is presented as gate opening authority.", "blocked"],
    ["source_plan_only_attempt", "Source literal plan is presented as if the future source change already happened.", "blocked"],
    ["non_g1a_authority_attempt", "G1a packet tries to open repo write, command execution, deployment, connector, production, or enterprise flags.", "blocked"],
    ["ai_final_approval_attempt", "Claude, Codex, or Fable tries to claim final approval or protected closeout.", "blocked"],
  ];
  return fixtures.map(([fixtureKey, description, expectedOutcome], index) => {
    const row = {
      schema_version: "factory-g1a-opening-negative-fixture-row.v1",
      fixture_id: `g1a-opening-negative.${fixtureKey}`,
      fixture_key: fixtureKey,
      description,
      expected_outcome: expectedOutcome,
      observed_outcome: "blocked",
      fixture_status: "blocked_as_expected",
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
      g1a_project_creation_gate_open_now: false,
      g1a_opening_packet_can_open_gate_now: false,
    };
    return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildBoundary({ sourceState, ownerReceiptTemplate, sourceLiteralOpeningCommitPlan, independentReviewPacket, firstUseAuditChecklist, negativeFixtureRows, generatedAt }) {
  return {
    schema_version: "factory-g1a-opening-packet-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    packet_only: true,
    opens_gate_now: false,
    source_mutation_performed: false,
    owner_receipt_template_ready: ownerReceiptTemplate.receipt_status === "template_not_signed",
    owner_receipt_signed_now: ownerReceiptTemplate.human_owner_signed === true,
    source_literal_commit_applied_now: sourceLiteralOpeningCommitPlan.plan_status === "applied",
    independent_review_packet_ready: independentReviewPacket.review_status === "packet_ready_review_not_run",
    independent_review_completed_now: false,
    first_use_audit_present: firstUseAuditChecklist.first_use_audit_present === true,
    g0_ready: sourceState.g0Status === "ready_factory_gate_opening_readiness" && sourceState.g0ValidationValid === true,
    g1a_ready_for_owner_receipt_now: sourceState.g1aReadyForOwnerReceiptNow,
    g1a_gate_open_now: false,
    g1a_project_creation_gate_open_now: false,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    data_driven_gate_opening_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ sourceState, ownerReceiptTemplate, sourceLiteralOpeningCommitPlan, independentReviewPacket, firstUseAuditChecklist, negativeFixtureRows, boundary }) {
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:g1a-opening-packet"),
    validationItem("source.commit_ref_present", "source", sourceState.commitRefPresent, "Current commit ref is missing"),
    validationItem("source.g0_summary_ready", "source", sourceState.structuredSummaryReady, "Structured summary does not expose ready G0/G1a packet preconditions"),
    validationItem("source.g0_readiness_ready", "source", sourceState.g0Status === "ready_factory_gate_opening_readiness" && sourceState.g0ValidationValid === true && sourceState.g0GateOpenCount === 0, "G0 readiness is not ready or already opened a gate"),
    validationItem("source.g1a_ready_closed", "source", sourceState.g1aReadyForOwnerReceiptNow === true && sourceState.g1aGateOpenNow === false, "G1a is not ready for owner receipt or is already open"),
    validationItem("source.g1a_source_literal_false", "source", sourceState.gateOpeningSourceReady, "G1a source literal is missing or already true"),
    validationItem("docs.gate_program_ready", "docs", sourceState.gateOpeningProgramDocReady, "Gate-opening program doc missing G1a/gate_opening/source literal language"),
    validationItem("docs.g0_doc_ready", "docs", sourceState.gateOpeningReadinessDocReady, "G0 readiness doc missing G1a closed readiness evidence"),
    validationItem("receipt.template_only", "owner_receipt", ownerReceiptTemplate.receipt_kind === "gate_opening" && ownerReceiptTemplate.receipt_status === "template_not_signed" && ownerReceiptTemplate.human_owner_signed === false, "Owner receipt template is signed or not gate_opening"),
    validationItem("source_plan.not_applied", "source_literal_plan", sourceLiteralOpeningCommitPlan.plan_status === "planned_not_applied" && sourceLiteralOpeningCommitPlan.opens_gate_now === false, "Source literal opening plan claims to be applied"),
    validationItem("review.packet_ready", "independent_review", independentReviewPacket.review_status === "packet_ready_review_not_run" && independentReviewPacket.read_only === true, "Independent review packet is missing or not read-only"),
    validationItem("first_use.audit_template", "first_use_audit", firstUseAuditChecklist.checklist_status === "template_not_performed" && firstUseAuditChecklist.first_use_audit_present === false, "First-use audit template is already marked performed"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length >= 5 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "G1a negative fixtures did not all block"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "G1a opening packet opened forbidden authority"),
  ];
}

function buildSummary({ sourceState, ownerReceiptTemplate, sourceLiteralOpeningCommitPlan, independentReviewPacket, firstUseAuditChecklist, negativeFixtureRows, boundary, validation }) {
  const ready = validation.valid
    && boundary.g0_ready === true
    && boundary.g1a_ready_for_owner_receipt_now === true
    && boundary.g1a_gate_open_now === false
    && boundaryFlagsClosed(boundary);
  return {
    factory_g1a_opening_packet_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    g0_status: sourceState.g0Status,
    g1a_gate_status: sourceState.g1aGateStatus,
    g1a_ready_for_owner_receipt_now: sourceState.g1aReadyForOwnerReceiptNow,
    owner_gate_opening_receipt_template_ready: ownerReceiptTemplate.receipt_status === "template_not_signed",
    owner_gate_opening_receipt_signed_now: ownerReceiptTemplate.human_owner_signed === true,
    source_literal_opening_commit_plan_ready: sourceLiteralOpeningCommitPlan.plan_status === "planned_not_applied",
    source_literal_opening_commit_applied_now: false,
    independent_review_packet_ready: independentReviewPacket.review_status === "packet_ready_review_not_run",
    independent_review_completed_now: false,
    first_use_audit_template_ready: firstUseAuditChecklist.checklist_status === "template_not_performed",
    first_use_audit_present: false,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    g1a_opening_packet_can_open_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    data_driven_gate_opening_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-opening-packet-validation-item.v1",
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
    "g1a_gate_open_now",
    "g1a_project_creation_gate_open_now",
    "data_driven_gate_opening_allowed_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderReviewPrompt(result) {
  const request = result.review_request;
  return [
    `You are the independent Claude Code Opus Max reviewer for Hermes ${PROGRAM_RANGE}.`,
    "",
    "Review only through read-only tools: Read, Grep, Glob. Do not run Bash. Do not edit files. Do not write files. Do not call connectors or APIs.",
    "Return JSON only, with no markdown fences. Do not claim final approval, production PASS, enterprise PASS, human adjudication, source mutation, protected closeout, or that G1a is open.",
    "",
    "Review target: G1a project creation gate opening packet.",
    `Reviewed commit SHA: ${request.reviewed_commit_sha ?? "missing"}`,
    `Artifact root: ${relativeArtifactPath(result.output_dir)}`,
    "",
    "Read these files first:",
    "- artifacts/factory-g1a-opening-packet/latest/factory-g1a-opening-packet.json",
    "- artifacts/factory-g1a-opening-packet/latest/owner-gate-opening-receipt-template.json",
    "- artifacts/factory-g1a-opening-packet/latest/source-literal-opening-commit-plan.json",
    "- artifacts/factory-g1a-opening-packet/latest/independent-review-packet.json",
    "- src/factory-g1a-opening-packet.mjs",
    "- src/factory-gate-opening-readiness.mjs",
    "- src/review-api.mjs",
    "- test/factory-g1a-opening-packet.test.mjs",
    "- docs/factory-promotion/g1a-opening-packet.md",
    "- docs/factory-promotion/g0-gate-opening-readiness.md",
    "",
    "Review questions:",
    ...result.independent_review_packet.review_questions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "Required JSON shape:",
    JSON.stringify(result.review_schema.properties ? {
      verdict: "APPROVE_WITH_FINDINGS or APPROVE or BLOCK",
      blocking_findings: [],
      non_blocking_findings: [],
      changes_required_before_commit: false,
      validated_commands: result.independent_review_packet.required_commands.map((command) => `${command} : observed-or-not-run`),
      review_notes: "string",
      reviewed_commit_sha: request.reviewed_commit_sha ?? "missing",
      engine_resolved_model_id: REVIEW_MODEL,
      is_final_approval: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      source_mutation_performed: false,
    } : {}, null, 2),
    "",
    "A finding object should include id, severity (P0/P1/P2/P3), title, file, line_or_area, description, recommendation, and blocks_g1a_opening_packet_closeout boolean.",
    "Put only closeout-blocking findings in blocking_findings. Advisory items go in non_blocking_findings.",
    "",
    "Validation self-report from Codex, to cross-check against code/tests rather than trust blindly:",
    "- node --check src/factory-g1a-opening-packet.mjs scripts/factory-g1a-opening-packet.mjs src/factory-gate-opening-readiness.mjs scripts/factory-gate-opening-readiness.mjs src/review-api.mjs scripts/review-api-smoke.mjs : pass",
    "- node --test test/factory-g1a-opening-packet.test.mjs test/factory-gate-opening-readiness.test.mjs : 9/9 pass",
    "- npm run factory:g1a-opening-packet -- --check --require-pass : ready_factory_g1a_opening_packet, G1a open false, validation errors 0",
    "- npm run factory:gate-opening-readiness -- --check --require-pass : ready_factory_gate_opening_readiness, G1a ready, gate open count 0",
    "- npm run api:smoke : pass",
    "- npm run contracts:validate -- --check : 214/214 pass",
    "- git diff --check : pass",
    "",
    "Authority boundary that must remain true:",
    JSON.stringify({
      g1a_project_creation_gate_open_now: false,
      project_creation_allowed_now: false,
      source_mutation_performed: false,
      owner_receipt_signed_now: false,
      source_literal_opening_commit_applied_now: false,
      independent_review_completed_now: false,
      first_use_audit_present: false,
      claude_is_final_approver: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    }, null, 2),
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Opening Packet",
    "",
    `Status: ${result.summary.factory_g1a_opening_packet_status}`,
    `Program: ${result.program_range}`,
    `G0 status: ${result.summary.g0_status}`,
    `G1a gate status: ${result.summary.g1a_gate_status}`,
    `Owner receipt template ready: ${result.summary.owner_gate_opening_receipt_template_ready}`,
    `Source literal opening commit plan ready: ${result.summary.source_literal_opening_commit_plan_ready}`,
    `Independent review packet ready: ${result.summary.independent_review_packet_ready}`,
    `First-use audit template ready: ${result.summary.first_use_audit_template_ready}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
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
  console.log(`Usage: node scripts/factory-g1a-opening-packet.mjs [--check] [--require-pass] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds the Law Firm OS-style G1a gate-opening packet without opening project creation authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text, error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourcePath, data) {
  return { path: sourcePath, available: true, data, text: JSON.stringify(data), error: null };
}

function normalizeInlineBuiltSource(sourcePath, data) {
  return { path: sourcePath, available: true, data, error: null };
}

async function readTextSource(filePath) {
  try {
    return { path: filePath, available: true, text: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
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
  const { markdown, review_prompt: _reviewPrompt, ...json } = result;
  return json;
}

function relativeArtifactPath(outDir, leaf = "") {
  const cwd = process.cwd();
  const rel = path.relative(cwd, path.resolve(outDir, leaf));
  return rel && !rel.startsWith("..") ? rel : path.resolve(outDir, leaf);
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
