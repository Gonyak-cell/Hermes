import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_CLAUDE_REVIEW_BASELINE_OUT_DIR = "artifacts/post-p64000-claude-review/latest";
export const DEFAULT_POST_P64000_CLAUDE_REVIEW_BASELINE_INPUTS = {
  schemaPath: "schemas/post-p64000-claude-review-baseline.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p64001-p64400.md",
  architectureDocPath: "docs/architecture.md",
  finalFreezePath: "artifacts/hermes-loop-final-freeze/latest/hermes-loop-final-freeze.json",
  lastClaudeReceiptPath: "artifacts/trust-debt-recalibration/review/claude-review-receipt.json",
};

const COMMAND_NAME = "platform:post-p64000-claude-review-baseline";
const SCHEMA_VERSION = "post-p64000-claude-review-baseline.v1";
const CAPABILITY_ID = "platform.post_p64000_claude_review_baseline";
const PROGRAM_RANGE = "P64001-P64400";
const SOURCE_PROGRAM_RANGE = "P63601-P64000";
const NEXT_PROGRAM_RANGE = "P64401-P64800";

const RECEIPT_REQUIRED_FIELDS = [
  "schema_version",
  "receipt_status",
  "reviewer",
  "overall_verdict",
  "open_blocking_finding_count",
  "blocks_clean_checkpoint",
  "findings",
  "raw_output_ref",
  "output_hash",
  "source_mutation_performed",
  "reviewer_final_approval_allowed",
];

const REVIEW_PACKET_REQUIRED_SECTIONS = [
  "review scope",
  "source baseline",
  "commit range",
  "changed files",
  "validation evidence",
  "authority boundary",
  "review instructions",
  "expected output contract",
  "non-goals",
  "next handoff",
];

const NEGATIVE_FIXTURES = [
  "missing_last_claude_receipt",
  "malformed_last_claude_receipt",
  "empty_last_claude_receipt",
  "missing_raw_durable_capture",
  "missing_post_review_commit_range",
  "untracked_reference_folder_included",
  "production_pass_claim",
  "enterprise_pass_claim",
  "claude_final_approval_claim",
];

const EXTRA_FALSE_FLAGS = [
  "claude_review_execution_allowed_now",
  "claude_source_mutation_allowed_now",
  "claude_receipt_accept_allowed_now",
  "reviewer_dispatch_allowed_now",
  "finding_resolution_allowed_now",
  "post_p64000_production_pass_claim_allowed_now",
  "post_p64000_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-claude-review-baseline.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-claude-review-baseline.mjs"],
  ["unit.test", "node --test test/post-p64000-claude-review-baseline.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-claude-review-baseline -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-claude-review-baseline.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000ClaudeReviewBaseline(options = {}) {
  const result = await buildPostP64000ClaudeReviewBaseline(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 Claude review baseline failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000ClaudeReviewBaseline(result, result.output_dir);
  return result;
}

export async function buildPostP64000ClaudeReviewBaseline(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_CLAUDE_REVIEW_BASELINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const finalFreeze = Object.prototype.hasOwnProperty.call(options, "finalFreeze")
    ? normalizeInlineJsonSource("inline.hermes_loop_final_freeze", options.finalFreeze)
    : await readJsonSource(inputs.final_freeze_path);
  const lastClaudeReceipt = Object.prototype.hasOwnProperty.call(options, "lastClaudeReceipt")
    ? normalizeInlineJsonSource("inline.last_claude_review_receipt", options.lastClaudeReceipt)
    : await readJsonSource(inputs.last_claude_receipt_path);
  const receiptStats = Object.prototype.hasOwnProperty.call(options, "receiptMtime")
    ? { available: true, mtimeMs: Number(options.receiptMtime) }
    : await readFileStat(inputs.last_claude_receipt_path);
  const lastReceiptState = await buildLastReceiptState({ receipt: lastClaudeReceipt, receiptStats, repoRoot: inputs.repo_root, options });
  const commitRows = Object.prototype.hasOwnProperty.call(options, "commitRows")
    ? options.commitRows
    : readPostReviewCommits(inputs.repo_root, lastReceiptState.reviewed_at_unix);
  const changedFiles = Object.prototype.hasOwnProperty.call(options, "changedFiles")
    ? options.changedFiles
    : readChangedFilesForCommits(inputs.repo_root, commitRows);
  const headRef = Object.prototype.hasOwnProperty.call(options, "headRef")
    ? String(options.headRef ?? "")
    : readGit(["rev-parse", "--short", "HEAD"], inputs.repo_root);

  const finalFreezeRows = buildFinalFreezeSourceRows({ finalFreeze, generatedAt });
  const receiptRows = buildLastReceiptRows({ receipt: lastClaudeReceipt, state: lastReceiptState, generatedAt });
  const scopeRows = buildScopeRows({ lastReceiptState, commitRows, changedFiles, headRef, generatedAt });
  const changedFileRows = buildChangedFileRows({ changedFiles, generatedAt });
  const packetRows = buildReviewPacketRows({ finalFreeze, lastReceiptState, commitRows, changedFiles, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const authorityRows = buildAuthorityRows({ overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({
    finalFreezeRows,
    receiptRows,
    scopeRows,
    changedFileRows,
    packetRows,
    validationRows,
    authorityRows,
    negativeRows,
    wiringRows,
    generatedAt,
  });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({
    finalFreezeRows,
    receiptRows,
    scopeRows,
    changedFileRows,
    packetRows,
    validationRows,
    authorityRows,
    negativeRows,
    wiringRows,
    closeoutRows,
    handoffRows,
  });
  const validationItems = buildValidationItems({
    finalFreezeRows,
    receiptRows,
    scopeRows,
    changedFileRows,
    packetRows,
    validationRows,
    authorityRows,
    negativeRows,
    wiringRows,
    closeoutRows,
    handoffRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      final_freeze_path: finalFreeze.path,
      last_claude_receipt_path: lastClaudeReceipt.path,
      last_claude_raw_output_ref: lastReceiptState.raw_output_ref,
      head_ref: headRef || null,
    },
    post_p64000_review_baseline_contract: {
      contract_id: "post_p64000_claude_review_baseline",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      source_of_truth: "docs/hermes-loop-system-specification.md and P64000 final freeze evidence",
      claude_review_is_read_only: true,
      claude_final_approval_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p64000_final_freeze_source_rows: finalFreezeRows,
    last_claude_review_receipt_rows: receiptRows,
    post_review_commit_scope_rows: scopeRows,
    post_review_changed_file_rows: changedFileRows,
    claude_review_packet_rows: packetRows,
    validation_command_rows: validationRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    p64400_wiring_rows: wiringRows,
    p64400_closeout_rows: closeoutRows,
    p64401_handoff_rows: handoffRows,
    post_p64000_claude_review_boundary: boundary,
    post_p64000_claude_review_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.claude_review_packet_markdown = renderReviewPacket(result);
  result.markdown = renderMarkdown(result);

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_claude_review_baseline")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_claude_review_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_claude_review_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  result.claude_review_packet_markdown = renderReviewPacket(result);
  return result;
}

export async function writePostP64000ClaudeReviewBaseline(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-claude-review-baseline.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-baseline.json"), {
    schema_version: "post-p64000-review-baseline.v1",
    generated_at: result.generated_at,
    source_refs: result.source_refs,
    summary: result.summary,
    boundary: result.post_p64000_claude_review_boundary,
  });
  await writeJson(path.join(outDir, "last-claude-review-receipt-rows.json"), collectionEnvelope("last-claude-review-receipt-rows.v1", "last_claude_review_receipt_rows", result.last_claude_review_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-review-commit-scope-rows.json"), collectionEnvelope("post-review-commit-scope-rows.v1", "post_review_commit_scope_rows", result.post_review_commit_scope_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-review-changed-file-rows.json"), collectionEnvelope("post-review-changed-file-rows.v1", "post_review_changed_file_rows", result.post_review_changed_file_rows, result.generated_at));
  await writeFile(path.join(outDir, "claude-review-packet.md"), result.claude_review_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000ClaudeReviewBaselineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000ClaudeReviewBaseline(args);
  console.log(`Post-P64000 Claude review baseline ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_claude_review_baseline_status}`);
  console.log(`P64000 source ready: ${result.summary.p64000_final_freeze_ready_now}`);
  console.log(`Last Claude receipt valid: ${result.summary.last_claude_receipt_valid_now}`);
  console.log(`Post-review commits: ${result.summary.post_review_commit_count}`);
  console.log(`Changed files: ${result.summary.changed_file_count}`);
  console.log(`Ready for P64401 handoff: ${result.summary.ready_for_p64401_handoff}`);
  console.log(`Claude review execution allowed now: ${result.summary.claude_review_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildFinalFreezeSourceRows({ finalFreeze, generatedAt }) {
  const summary = finalFreeze.data?.summary ?? {};
  const boundary = finalFreeze.data?.hermes_loop_final_freeze_boundary ?? {};
  return [
    row("source.p64000_available", "p64000_final_freeze_source", "P64000 final freeze artifact is available", finalFreeze.available === true, finalFreeze.path, generatedAt),
    row("source.p64000_program", "p64000_final_freeze_source", "P64000 source program range matches", finalFreeze.data?.program_range === SOURCE_PROGRAM_RANGE, finalFreeze.path, generatedAt),
    row("source.p64000_validation", "p64000_final_freeze_source", "P64000 source validation is valid", finalFreeze.data?.validation?.valid === true, finalFreeze.path, generatedAt),
    row("source.p64000_ready", "p64000_final_freeze_source", "P64000 final freeze is ready", summary.p64000_final_freeze_ready === true, finalFreeze.path, generatedAt),
    row("source.p64000_authority_closed", "p64000_final_freeze_source", "P64000 authority boundary remains closed", boundary.final_approval_enabled === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, finalFreeze.path, generatedAt),
  ];
}

async function buildLastReceiptState({ receipt, receiptStats, repoRoot, options }) {
  const data = receipt.data ?? {};
  const reviewerId = String(data.reviewer ?? "").toLowerCase().replaceAll("-", "_");
  const verdict = String(data.overall_verdict ?? data.verdict ?? "").toUpperCase();
  const blocking = Number(data.open_blocking_finding_count ?? data.blocking_finding_count);
  const rawRef = String(data.raw_output_ref ?? data.evidence_ref ?? "");
  const rawPath = rawRef ? path.resolve(repoRoot, rawRef) : "";
  const rawSource = Object.prototype.hasOwnProperty.call(options, "rawClaudeReview")
    ? normalizeInlineJsonSource("inline.claude_review_raw", options.rawClaudeReview)
    : rawPath
      ? await readJsonSource(rawPath)
      : { path: "", available: false, data: null, text: "", error: "raw_output_ref missing" };
  const fieldState = Object.fromEntries(RECEIPT_REQUIRED_FIELDS.map((field) => [field, Object.prototype.hasOwnProperty.call(data, field)]));
  const shapeValid = receipt.available === true
    && data.schema_version === "claude-review-receipt.v1"
    && data.receipt_status === "observed"
    && reviewerId === "claude_code_opus_max"
    && ["PASS", "PASS_WITH_FINDINGS"].includes(verdict)
    && Number.isFinite(blocking)
    && blocking === 0
    && data.blocks_clean_checkpoint === false
    && Array.isArray(data.findings)
    && typeof data.output_hash === "string"
    && data.output_hash.length >= 16
    && data.source_mutation_performed === false
    && data.reviewer_final_approval_allowed === false;
  const rawDurable = rawSource.available === true && rawSource.data !== null && rawSource.text.trim().length > 0;
  const reviewedAtUnix = Number.isFinite(receiptStats.mtimeMs) ? Math.floor(receiptStats.mtimeMs / 1000) : null;
  return {
    receipt_available: receipt.available === true,
    receipt_path: receipt.path,
    receipt_mtime_ms: receiptStats.mtimeMs ?? null,
    reviewed_at_unix: reviewedAtUnix,
    reviewed_at_iso: reviewedAtUnix ? new Date(reviewedAtUnix * 1000).toISOString() : null,
    reviewer_id: reviewerId,
    verdict,
    blocking_finding_count: Number.isFinite(blocking) ? blocking : null,
    blocks_clean_checkpoint: data.blocks_clean_checkpoint,
    finding_count: Array.isArray(data.findings) ? data.findings.length : null,
    raw_output_ref: rawRef,
    raw_durable_capture_present: rawDurable,
    raw_durable_capture_path: rawSource.path,
    shape_valid: shapeValid,
    field_state: fieldState,
    valid_for_review_baseline: shapeValid && rawDurable,
  };
}

function buildLastReceiptRows({ receipt, state, generatedAt }) {
  const rows = [
    row("receipt.available", "last_claude_review_receipt", "Last Claude review receipt is available", state.receipt_available, receipt.path, generatedAt),
    row("receipt.schema", "last_claude_review_receipt", "Claude review receipt schema is v1", receipt.data?.schema_version === "claude-review-receipt.v1", receipt.path, generatedAt),
    row("receipt.status", "last_claude_review_receipt", "Claude review receipt status is observed", receipt.data?.receipt_status === "observed", receipt.path, generatedAt),
    row("receipt.reviewer", "last_claude_review_receipt", "Reviewer is Claude Code Opus max", state.reviewer_id === "claude_code_opus_max", receipt.path, generatedAt),
    row("receipt.verdict", "last_claude_review_receipt", "Verdict is PASS or PASS_WITH_FINDINGS", ["PASS", "PASS_WITH_FINDINGS"].includes(state.verdict), receipt.path, generatedAt),
    row("receipt.blocking_findings", "last_claude_review_receipt", "No open blocking finding remains", state.blocking_finding_count === 0, receipt.path, generatedAt),
    row("receipt.clean_checkpoint", "last_claude_review_receipt", "Receipt does not block clean checkpoint", state.blocks_clean_checkpoint === false, receipt.path, generatedAt),
    row("receipt.raw_durable", "last_claude_review_receipt", "Raw Claude output is durably captured", state.raw_durable_capture_present, state.raw_durable_capture_path || receipt.path, generatedAt),
    row("receipt.no_mutation", "last_claude_review_receipt", "Claude review source mutation was false", receipt.data?.source_mutation_performed === false, receipt.path, generatedAt),
    row("receipt.no_final_approval", "last_claude_review_receipt", "Claude final approval was false", receipt.data?.reviewer_final_approval_allowed === false, receipt.path, generatedAt),
    row("receipt.required_fields", "last_claude_review_receipt", "All required receipt fields are present", Object.values(state.field_state).every(Boolean), receipt.path, generatedAt, { required_field_count: RECEIPT_REQUIRED_FIELDS.length }),
  ];
  return rows;
}

function buildScopeRows({ lastReceiptState, commitRows, changedFiles, headRef, generatedAt }) {
  const excluded = changedFiles.every((file) => !String(file).startsWith("hermes-operator-console-2026-06-06/"));
  return [
    row("scope.last_review_timestamp", "post_review_commit_scope", "Last review timestamp is available", Number.isFinite(lastReceiptState.reviewed_at_unix), lastReceiptState.receipt_path, generatedAt, { reviewed_at_iso: lastReceiptState.reviewed_at_iso }),
    row("scope.head_ref", "post_review_commit_scope", "Current HEAD ref is available", headRef.length > 0, "git rev-parse --short HEAD", generatedAt, { head_ref: headRef }),
    row("scope.post_review_commits", "post_review_commit_scope", "Post-review commit set is non-empty", commitRows.length > 0, "git log --since=<last-review>", generatedAt, { commit_count: commitRows.length }),
    row("scope.post_review_changed_files", "post_review_commit_scope", "Post-review changed file set is non-empty", changedFiles.length > 0, "git show --name-only <post-review-commits>", generatedAt, { changed_file_count: changedFiles.length }),
    row("scope.untracked_reference_excluded", "post_review_commit_scope", "Untracked hermes-operator-console reference folder is excluded", excluded, "git status --short", generatedAt),
  ];
}

function buildChangedFileRows({ changedFiles, generatedAt }) {
  return changedFiles.map((file) => row(
    `changed_file.${normalizeId(file)}`,
    "post_review_changed_file",
    `${file} included in post-review review scope`,
    !String(file).startsWith("hermes-operator-console-2026-06-06/"),
    file,
    generatedAt,
    { file_path: file },
  ));
}

function buildReviewPacketRows({ finalFreeze, lastReceiptState, commitRows, changedFiles, generatedAt }) {
  const sourceReady = finalFreeze.data?.summary?.p64000_final_freeze_ready === true && finalFreeze.data?.validation?.valid === true;
  const context = [
    ["packet.review_scope", "review scope", lastReceiptState.valid_for_review_baseline],
    ["packet.source_baseline", "source baseline", sourceReady],
    ["packet.commit_range", "commit range", commitRows.length > 0],
    ["packet.changed_files", "changed files", changedFiles.length > 0],
    ["packet.validation_evidence", "validation evidence", true],
    ["packet.authority_boundary", "authority boundary", true],
    ["packet.review_instructions", "review instructions", true],
    ["packet.expected_output_contract", "expected output contract", true],
    ["packet.non_goals", "non-goals", true],
    ["packet.next_handoff", "next handoff", true],
  ];
  return context.map(([rowId, section, observed]) => row(rowId, "claude_review_packet", `${section} section is ready for packet`, observed, "artifacts/post-p64000-claude-review/latest/claude-review-packet.md", generatedAt, { packet_section: section }));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation_command.${commandId}`, "validation_command", command, true, command, generatedAt, {
    command_id: commandId,
    mutating: false,
  }));
}

function buildAuthorityRows({ overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p64001-p64400.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks review packet closeout`,
    true,
    "docs/hermes-roadmap-p64001-p64400.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-claude-review-baseline.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P64001-P64400 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P64001-P64400") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p64001-p64400.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P64001-P64400 Claude review baseline", architectureDoc.available && architectureDoc.text.includes("P64001-P64400"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { finalFreezeRows, receiptRows, scopeRows, changedFileRows, packetRows, validationRows, authorityRows, negativeRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p64400.p64000_source_ready", "P64000 final freeze source is valid", finalFreezeRows.every(pass), generatedAt),
    closeoutRow("p64400.last_claude_receipt_valid", "Last Claude receipt is valid and durable", receiptRows.every(pass), generatedAt),
    closeoutRow("p64400.post_review_scope_ready", "Post-review commit and changed file scope is ready", scopeRows.every(pass), generatedAt),
    closeoutRow("p64400.changed_files_ready", "Changed files are scoped and reference folder is excluded", changedFileRows.length > 0 && changedFileRows.every(pass), generatedAt),
    closeoutRow("p64400.review_packet_ready", "Claude review packet rows are ready", packetRows.every(pass), generatedAt),
    closeoutRow("p64400.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p64400.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p64400.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p64400.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p64401_claude_readonly_review", "p64401_handoff", "P64401 may request Claude read-only review using the packet", ready, "artifacts/post-p64000-claude-review/latest/claude-review-packet.md", generatedAt, {
      next_allowed_action: ready ? "request_claude_read_only_review_and_capture_raw_json" : "resolve_p64400_review_packet_blockers",
    }),
    row("handoff.no_authority_opened", "p64401_handoff", "P64400 packet closeout opens no execution, write, protected, production, enterprise, or final approval authority", true, "docs/hermes-roadmap-p64001-p64400.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { finalFreezeRows, receiptRows, scopeRows, changedFileRows, packetRows, validationRows, authorityRows, negativeRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_review_baseline_ready: closeoutRows.every(pass),
    p64000_final_freeze_ready_now: finalFreezeRows.every(pass),
    last_claude_receipt_valid_now: receiptRows.every(pass),
    post_review_scope_ready_now: scopeRows.every(pass),
    changed_file_scope_ready_now: changedFileRows.length > 0 && changedFileRows.every(pass),
    claude_review_packet_ready_now: packetRows.every(pass),
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p64401_handoff: handoffRows.every(pass),
    post_review_commit_count: Number(scopeRows.find((item) => item.row_id === "scope.post_review_commits")?.commit_count ?? 0),
    changed_file_count: changedFileRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p64000_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p64000_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { finalFreezeRows, receiptRows, scopeRows, changedFileRows, packetRows, validationRows, authorityRows, negativeRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p64000", "source_binding", finalFreezeRows.every(pass), "P64000 final freeze source must be valid and ready"),
    validationItem("receipt.last_claude", "receipt", receiptRows.every(pass), "Last Claude review receipt must be valid, durable, non-mutating, and non-final"),
    validationItem("scope.post_review_commits", "scope", scopeRows.every(pass), "Post-review commit scope must be non-empty and exclude reference folders"),
    validationItem("scope.changed_files", "scope", changedFileRows.length > 0 && changedFileRows.every(pass), "Changed file scope must be non-empty and safe"),
    validationItem("packet.ready", "packet", packetRows.every(pass), "Claude review packet rows must be ready"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P64400 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P64401 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.post_p64000_review_baseline_ready === true, "Post-P64000 review baseline must be ready"),
    validationItem("boundary.claude_execution_false", "authority_boundary", boundary.claude_review_execution_allowed_now === false, "Claude execution must remain false in P64400"),
    validationItem("boundary.claude_mutation_false", "authority_boundary", boundary.claude_source_mutation_allowed_now === false, "Claude source mutation must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p64401_handoff
    ? "ready_for_p64401_claude_readonly_review"
    : validation.valid
      ? "valid_block_p64401_handoff_pending"
      : "blocked_post_p64000_claude_review_baseline";
  return {
    post_p64000_claude_review_baseline_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p64000_final_freeze_ready_now: boundary.p64000_final_freeze_ready_now,
    last_claude_receipt_valid_now: boundary.last_claude_receipt_valid_now,
    post_review_scope_ready_now: boundary.post_review_scope_ready_now,
    claude_review_packet_ready_now: boundary.claude_review_packet_ready_now,
    ready_for_p64401_handoff: boundary.ready_for_p64401_handoff,
    post_review_commit_count: boundary.post_review_commit_count,
    changed_file_count: boundary.changed_file_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderReviewPacket(result) {
  const commits = result.post_review_commit_scope_rows.find((row) => row.row_id === "scope.post_review_commits")?.commit_count ?? 0;
  const files = result.post_review_changed_file_rows.map((row) => `- ${row.file_path}`).join("\n");
  return [
    `# Claude Code Opus Max Review Packet ${PROGRAM_RANGE}`,
    "",
    "## Review Scope",
    "",
    "Read-only review of Hermes changes after the last durable Claude review receipt through the current P64000 final freeze head. Do not mutate source, do not run protected actions, and do not provide final approval.",
    "",
    "## Source Baseline",
    "",
    `- last_claude_receipt_path: ${result.source_refs.last_claude_receipt_path}`,
    `- last_claude_raw_output_ref: ${result.source_refs.last_claude_raw_output_ref}`,
    `- p64000_final_freeze_path: ${result.source_refs.final_freeze_path}`,
    `- head_ref: ${result.source_refs.head_ref}`,
    "",
    "## Commit Range",
    "",
    `- post_review_commit_count: ${commits}`,
    "",
    "## Changed Files",
    "",
    files || "- none",
    "",
    "## Validation Evidence",
    "",
    "- P64000 final freeze artifact is valid.",
    "- P64000 targeted Hermes Loop regression previously passed.",
    "- This packet must be validated with `npm run platform:post-p64000-claude-review-baseline -- --check` before reviewer dispatch.",
    "",
    "## Authority Boundary",
    "",
    "- Claude review execution is not performed by this packet.",
    "- Claude source mutation is forbidden.",
    "- Claude final approval is forbidden.",
    "- Runtime execution, write action, connector write, protected action, deployment, production PASS, and enterprise PASS remain false.",
    "",
    "## Review Instructions",
    "",
    "Review architecture, schema, script, test, and evidence consistency. Focus on false PASS risks, receipt-shape validation, source-of-truth drift, authority leakage, and test gaps.",
    "",
    "## Expected Output Contract",
    "",
    "Return JSON with `overall_verdict`, `blocks_clean_checkpoint`, `open_blocking_finding_count`, and `findings[]` containing `id`, `severity`, `category`, `location`, `evidence`, `issue`, and `proposed_change`.",
    "",
    "## Non-Goals",
    "",
    "- No source mutation.",
    "- No final approval.",
    "- No production or enterprise readiness claim.",
    "- No GitHub independent approval claim.",
    "",
    "## Next Handoff",
    "",
    "If this packet validates, P64401-P64800 may request Claude Code Opus max read-only review and capture durable raw JSON before receipt normalization.",
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Claude Review Baseline ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_claude_review_baseline_status}`,
    `- p64000_final_freeze_ready_now: ${result.summary.p64000_final_freeze_ready_now}`,
    `- last_claude_receipt_valid_now: ${result.summary.last_claude_receipt_valid_now}`,
    `- post_review_commit_count: ${result.summary.post_review_commit_count}`,
    `- changed_file_count: ${result.summary.changed_file_count}`,
    `- ready_for_p64401_handoff: ${result.summary.ready_for_p64401_handoff}`,
    `- claude_review_execution_allowed_now: ${result.summary.claude_review_execution_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p64401_handoff
      ? "Request Claude Code Opus max read-only review using the generated packet, then durably capture raw JSON before receipt normalization."
      : "Resolve P64400 baseline, receipt, scope, packet, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function readPostReviewCommits(repoRoot, reviewedAtUnix) {
  if (!Number.isFinite(reviewedAtUnix)) return [];
  const output = readGit(["log", `--since=@${reviewedAtUnix}`, "--pretty=format:%h%x09%ct%x09%s"], repoRoot);
  return output.split("\n").filter(Boolean).map((line) => {
    const [hash, timestamp, ...subjectParts] = line.split("\t");
    return { hash, timestamp: Number(timestamp), subject: subjectParts.join("\t") };
  });
}

function readChangedFilesForCommits(repoRoot, commitRows) {
  const files = new Set();
  for (const commit of commitRows) {
    const output = readGit(["show", "--name-only", "--pretty=format:", "--no-renames", commit.hash], repoRoot);
    for (const file of output.split("\n").map((entry) => entry.trim()).filter(Boolean)) files.add(file);
  }
  return [...files].sort();
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p64400_closeout", label, observed, "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt);
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const passed = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: passed,
    current_verdict: passed ? "pass" : "block",
    evidence_ref: evidenceRef,
    output_ref: extra.output_ref ?? null,
    block_reason: passed ? null : extra.block_reason ?? `${rowId}.blocked`,
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_review_packet_buildout" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined({
      reviewed_at_iso: extra.reviewed_at_iso,
      head_ref: extra.head_ref,
      commit_count: extra.commit_count,
      changed_file_count: extra.changed_file_count,
      file_path: extra.file_path,
      packet_section: extra.packet_section,
      required_field_count: extra.required_field_count,
      authority_flag: extra.authority_flag,
      allowed_now: extra.allowed_now,
      fixture_id: extra.fixture_id,
      expected_verdict: extra.expected_verdict,
      command_id: extra.command_id,
      mutating: extra.mutating,
    }),
  };
}

function pass(item) {
  return item.current_verdict === "pass";
}

function validationItem(id, category, passed, message) {
  return { validation_id: id, category, passed: passed === true, severity: passed === true ? "info" : "error", message: passed === true ? `${id} passed` : message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return { valid: errors.length === 0, error_count: errors.length, errors: errors.map((item) => ({ path: item.validation_id, message: item.message, category: item.category })) };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_CLAUDE_REVIEW_BASELINE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    final_freeze_path: path.resolve(repoRoot, options.finalFreezePath ?? defaults.finalFreezePath),
    last_claude_receipt_path: path.resolve(repoRoot, options.lastClaudeReceiptPath ?? defaults.lastClaudeReceiptPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

async function readFileStat(filePath) {
  try {
    const result = await stat(filePath);
    return { available: true, mtimeMs: result.mtimeMs };
  } catch (error) {
    return { available: false, mtimeMs: null, error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { path: sourceId, available: true, data, text: JSON.stringify(data ?? null) };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--last-claude-receipt") args.lastClaudeReceiptPath = argv[++index];
    else if (arg === "--final-freeze") args.finalFreezePath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--last-claude-receipt PATH] [--final-freeze PATH]`);
}

function readGit(args, repoRoot) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, claude_review_packet_markdown: _packet, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
