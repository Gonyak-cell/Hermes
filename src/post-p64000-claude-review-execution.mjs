import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_CLAUDE_REVIEW_EXECUTION_OUT_DIR = "artifacts/post-p64000-claude-review-execution/latest";
export const DEFAULT_POST_P64000_CLAUDE_REVIEW_EXECUTION_INPUTS = {
  schemaPath: "schemas/post-p64000-claude-review-execution.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p64401-p64800.md",
  architectureDocPath: "docs/architecture.md",
  baselinePath: "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json",
  packetPath: "artifacts/post-p64000-claude-review/latest/claude-review-packet.md",
  rawReviewPath: "artifacts/post-p64000-claude-review/review/claude-review-raw.json",
};

const COMMAND_NAME = "platform:post-p64000-claude-review-execution";
const SCHEMA_VERSION = "post-p64000-claude-review-execution.v1";
const CAPABILITY_ID = "platform.post_p64000_claude_review_execution";
const PROGRAM_RANGE = "P64401-P64800";
const SOURCE_PROGRAM_RANGE = "P64001-P64400";
const NEXT_PROGRAM_RANGE = "P64801-P65200";

const NEGATIVE_FIXTURES = [
  "missing_p64400_baseline",
  "p64400_not_ready",
  "missing_review_packet",
  "missing_raw_capture",
  "empty_raw_capture",
  "malformed_raw_json",
  "auth_failure_raw_output",
  "pty_stdout_loss_counted_as_evidence",
  "tool_call_shaped_output_counted_as_review",
  "missing_review_json_payload",
  "source_mutation_claim",
  "claude_final_approval_claim",
];

const EXTRA_FALSE_FLAGS = [
  "claude_source_mutation_allowed_now",
  "claude_final_approval_claim_allowed_now",
  "claude_receipt_normalization_allowed_now",
  "finding_resolution_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "post_p64800_production_pass_claim_allowed_now",
  "post_p64800_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-claude-review-execution.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-claude-review-execution.mjs"],
  ["unit.test", "node --test test/post-p64000-claude-review-execution.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-claude-review-execution -- --check"],
  ["adjacent.baseline", "node --test test/post-p64000-claude-review-baseline.test.mjs test/post-p64000-claude-review-execution.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-claude-review-execution.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000ClaudeReviewExecution(options = {}) {
  const result = await buildPostP64000ClaudeReviewExecution(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 Claude review execution failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000ClaudeReviewExecution(result, result.output_dir);
  return result;
}

export async function buildPostP64000ClaudeReviewExecution(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_CLAUDE_REVIEW_EXECUTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const baseline = Object.prototype.hasOwnProperty.call(options, "baseline")
    ? normalizeInlineJsonSource("inline.post_p64000_claude_review_baseline", options.baseline)
    : await readJsonSource(inputs.baseline_path);
  const packet = Object.prototype.hasOwnProperty.call(options, "packetText")
    ? normalizeInlineTextSource("inline.claude_review_packet", options.packetText)
    : await readTextSource(inputs.packet_path);
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_review_raw", options.rawReview)
    : await readJsonSource(inputs.raw_review_path);
  const reviewPayload = extractReviewPayload(rawReview);

  const sourceRows = buildSourceRows({ baseline, packet, generatedAt });
  const executionRows = buildExecutionRows({ rawReview, reviewPayload, generatedAt });
  const outputRows = buildOutputRows({ reviewPayload, generatedAt });
  const authorityRows = buildAuthorityRows({ reviewPayload, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, executionRows, outputRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, reviewPayload, generatedAt });
  const boundary = buildBoundary({ sourceRows, executionRows, outputRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, reviewPayload });
  const validationItems = buildValidationItems({ sourceRows, executionRows, outputRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      baseline_path: baseline.path,
      packet_path: packet.path,
      raw_review_path: rawReview.path,
    },
    post_p64000_claude_review_execution_contract: {
      contract_id: "post_p64000_claude_review_execution",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      raw_capture_is_evidence_only: true,
      blocking_findings_go_to_finding_loop: true,
      claude_source_mutation_allowed: false,
      claude_final_approval_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p64400_baseline_source_rows: sourceRows,
    claude_review_execution_rows: executionRows,
    raw_review_output_shape_rows: outputRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p64800_wiring_rows: wiringRows,
    p64800_closeout_rows: closeoutRows,
    p64801_handoff_rows: handoffRows,
    extracted_review_payload: reviewPayload.payload,
    post_p64000_claude_review_execution_boundary: boundary,
    post_p64000_claude_review_execution_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_claude_review_execution")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_claude_review_execution_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_claude_review_execution_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000ClaudeReviewExecution(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-claude-review-execution.json"), serializableResult(result));
  await writeJson(path.join(outDir, "raw-review-output-shape-rows.json"), collectionEnvelope("raw-review-output-shape-rows.v1", "raw_review_output_shape_rows", result.raw_review_output_shape_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-review-execution-rows.json"), collectionEnvelope("claude-review-execution-rows.v1", "claude_review_execution_rows", result.claude_review_execution_rows, result.generated_at));
  await writeJson(path.join(outDir, "extracted-review-payload.json"), result.extracted_review_payload ?? {});
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000ClaudeReviewExecutionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000ClaudeReviewExecution(args);
  console.log(`Post-P64000 Claude review execution ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_claude_review_execution_status}`);
  console.log(`P64400 source ready: ${result.summary.p64400_baseline_ready_now}`);
  console.log(`Raw review captured: ${result.summary.raw_review_capture_valid_now}`);
  console.log(`Review verdict: ${result.summary.review_verdict}`);
  console.log(`Blocking findings: ${result.summary.open_blocking_finding_count}`);
  console.log(`Ready for P64801 handoff: ${result.summary.ready_for_p64801_handoff}`);
  console.log(`Claude source mutation allowed: ${result.summary.claude_source_mutation_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ baseline, packet, generatedAt }) {
  const summary = baseline.data?.summary ?? {};
  return [
    row("source.p64400_baseline_available", "p64400_baseline_source", "P64400 baseline artifact is available", baseline.available === true, baseline.path, generatedAt),
    row("source.p64400_program", "p64400_baseline_source", "P64400 baseline program range matches", baseline.data?.program_range === SOURCE_PROGRAM_RANGE, baseline.path, generatedAt),
    row("source.p64400_validation", "p64400_baseline_source", "P64400 baseline validation is valid", baseline.data?.validation?.valid === true, baseline.path, generatedAt),
    row("source.p64400_handoff", "p64400_baseline_source", "P64400 is ready for P64401 handoff", summary.ready_for_p64401_handoff === true, baseline.path, generatedAt),
    row("source.packet_available", "p64400_baseline_source", "Claude review packet is available", packet.available === true && packet.text.trim().length > 0, packet.path, generatedAt),
  ];
}

function buildExecutionRows({ rawReview, reviewPayload, generatedAt }) {
  return [
    row("execution.raw_available", "claude_review_execution", "Claude raw review JSON is available", rawReview.available === true, rawReview.path, generatedAt),
    row("execution.raw_non_empty", "claude_review_execution", "Claude raw review JSON is non-empty", rawReview.text.trim().length > 0, rawReview.path, generatedAt),
    row("execution.cli_success", "claude_review_execution", "Claude CLI result subtype is success", rawReview.data?.type === "result" && rawReview.data?.subtype === "success" && rawReview.data?.is_error === false, rawReview.path, generatedAt),
    row("execution.not_auth_failure", "claude_review_execution", "Raw output is not an auth failure", !containsAuthFailure(rawReview.text), rawReview.path, generatedAt),
    row("execution.review_payload_extracted", "claude_review_execution", "Review JSON payload was extracted from Claude result", reviewPayload.validJson === true, rawReview.path, generatedAt),
    row("execution.model_usage_observed", "claude_review_execution", "Claude model usage is observed in raw output", Object.keys(rawReview.data?.modelUsage ?? {}).length > 0, rawReview.path, generatedAt),
  ];
}

function buildOutputRows({ reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  return [
    row("output.verdict_present", "raw_review_output_shape", "Review verdict is present", typeof payload.overall_verdict === "string" && payload.overall_verdict.length > 0, reviewPayload.evidenceRef, generatedAt, { review_verdict: payload.overall_verdict }),
    row("output.blocks_clean_checkpoint_present", "raw_review_output_shape", "blocks_clean_checkpoint boolean is present", typeof payload.blocks_clean_checkpoint === "boolean", reviewPayload.evidenceRef, generatedAt),
    row("output.blocking_count_present", "raw_review_output_shape", "open_blocking_finding_count is finite", Number.isFinite(Number(payload.open_blocking_finding_count)), reviewPayload.evidenceRef, generatedAt, { open_blocking_finding_count: Number(payload.open_blocking_finding_count) }),
    row("output.findings_array", "raw_review_output_shape", "findings array is present", Array.isArray(payload.findings), reviewPayload.evidenceRef, generatedAt, { finding_count: Array.isArray(payload.findings) ? payload.findings.length : null }),
    row("output.no_final_approval", "raw_review_output_shape", "Claude did not claim final approval", !hasTrueField(payload, ["is_final_approval", "reviewer_final_approval_allowed", "claude_final_approval_allowed", "final_approval_allowed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_source_mutation", "raw_review_output_shape", "Claude did not claim source mutation", !hasTrueField(payload, ["source_mutation_performed", "source_mutation_allowed", "mutation_performed"]), reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildAuthorityRows({ reviewPayload, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, reviewPayload.evidenceRef, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P64800 closeout`,
    true,
    "docs/hermes-roadmap-p64401-p64800.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation_command.${commandId}`, "validation_command", command, true, command, generatedAt, {
    command_id: commandId,
    mutating: false,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-claude-review-execution.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P64401-P64800 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P64401-P64800") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p64401-p64800.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P64401-P64800 Claude review execution", architectureDoc.available && architectureDoc.text.includes("P64401-P64800"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, executionRows, outputRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p64800.source_ready", "P64400 baseline and packet source are ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p64800.raw_capture_valid", "Claude raw review capture is durable and parseable", executionRows.every(pass), generatedAt),
    closeoutRow("p64800.output_shape_ready", "Review output shape is extractable for P64801 normalization", outputRows.every(pass), generatedAt),
    closeoutRow("p64800.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p64800.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p64800.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p64800.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p64801_receipt_normalization", "p64801_handoff", "P64801 may normalize the durable Claude raw review and route findings", ready, reviewPayload.evidenceRef, generatedAt, {
      next_allowed_action: ready ? "normalize_claude_review_receipt_and_route_findings" : "resolve_p64800_raw_capture_blockers",
    }),
    row("handoff.blocking_findings_visible", "p64801_handoff", "Blocking findings are visible for finding loop instead of hidden", Number(payload.open_blocking_finding_count ?? 0) >= 0, reviewPayload.evidenceRef, generatedAt, {
      open_blocking_finding_count: Number(payload.open_blocking_finding_count ?? 0),
      review_verdict: payload.overall_verdict,
    }),
    row("handoff.no_clean_claim", "p64801_handoff", "P64800 raw capture is not a clean checkpoint, final approval, production PASS, or enterprise PASS", true, "docs/hermes-roadmap-p64401-p64800.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, executionRows, outputRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, reviewPayload } = parts;
  const payload = reviewPayload.payload ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_claude_review_execution_ready: closeoutRows.every(pass),
    p64400_baseline_ready_now: sourceRows.every(pass),
    raw_review_capture_valid_now: executionRows.every(pass),
    raw_review_output_shape_ready_now: outputRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p64801_handoff: handoffRows.every(pass),
    review_verdict: String(payload.overall_verdict ?? ""),
    blocks_clean_checkpoint: payload.blocks_clean_checkpoint === true,
    open_blocking_finding_count: Number(payload.open_blocking_finding_count ?? 0),
    finding_count: Array.isArray(payload.findings) ? payload.findings.length : 0,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p64800_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p64800_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, executionRows, outputRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p64400", "source_binding", sourceRows.every(pass), "P64400 baseline and packet source must be ready"),
    validationItem("execution.raw_capture", "raw_capture", executionRows.every(pass), "Claude raw review JSON must be durable, parseable, successful, and not an auth failure"),
    validationItem("output.shape", "output_shape", outputRows.every(pass), "Review output must expose verdict, blocker count, checkpoint status, and findings"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P64800 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P64801 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.post_p64000_claude_review_execution_ready === true, "P64800 review execution capture must be ready"),
    validationItem("boundary.claude_mutation_false", "authority_boundary", boundary.claude_source_mutation_allowed_now === false, "Claude source mutation must remain false"),
    validationItem("boundary.receipt_normalization_false", "authority_boundary", boundary.claude_receipt_normalization_allowed_now === false, "Receipt normalization must remain a next-phase action"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p64801_handoff
    ? boundary.open_blocking_finding_count > 0 || boundary.blocks_clean_checkpoint
      ? "review_captured_blocked_findings_ready_for_p64801"
      : "review_captured_clean_ready_for_p64801"
    : validation.valid
      ? "valid_block_p64801_handoff_pending"
      : "blocked_post_p64000_claude_review_execution";
  return {
    post_p64000_claude_review_execution_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p64400_baseline_ready_now: boundary.p64400_baseline_ready_now,
    raw_review_capture_valid_now: boundary.raw_review_capture_valid_now,
    raw_review_output_shape_ready_now: boundary.raw_review_output_shape_ready_now,
    ready_for_p64801_handoff: boundary.ready_for_p64801_handoff,
    review_verdict: boundary.review_verdict,
    blocks_clean_checkpoint: boundary.blocks_clean_checkpoint,
    open_blocking_finding_count: boundary.open_blocking_finding_count,
    finding_count: boundary.finding_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function extractReviewPayload(rawReview) {
  const evidenceRef = rawReview.path;
  const resultText = String(rawReview.data?.result ?? "");
  const fenced = resultText.match(/```json\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : resultText.trim().startsWith("{") ? resultText : "";
  if (!jsonText) return { validJson: false, payload: null, evidenceRef, error: "review_json_payload_missing" };
  try {
    const payload = JSON.parse(jsonText);
    return { validJson: true, payload, evidenceRef };
  } catch (error) {
    return { validJson: false, payload: null, evidenceRef, error: error.message };
  }
}

function containsAuthFailure(text) {
  return /not logged in|please run \/login|authentication failed|api key missing/i.test(String(text ?? ""));
}

function hasTrueField(payload, fields) {
  return fields.some((field) => payload?.[field] === true);
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Claude Review Execution ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_claude_review_execution_status}`,
    `- p64400_baseline_ready_now: ${result.summary.p64400_baseline_ready_now}`,
    `- raw_review_capture_valid_now: ${result.summary.raw_review_capture_valid_now}`,
    `- review_verdict: ${result.summary.review_verdict}`,
    `- blocks_clean_checkpoint: ${result.summary.blocks_clean_checkpoint}`,
    `- open_blocking_finding_count: ${result.summary.open_blocking_finding_count}`,
    `- ready_for_p64801_handoff: ${result.summary.ready_for_p64801_handoff}`,
    `- claude_source_mutation_allowed_now: ${result.summary.claude_source_mutation_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p64801_handoff
      ? "Normalize the Claude review receipt and route blocking findings through P64801-P65200. Do not treat this raw capture as final approval or clean closeout."
      : "Resolve raw capture, packet source, output shape, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p64800_closeout", label, observed, "artifacts/post-p64000-claude-review-execution/latest/post-p64000-claude-review-execution.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_review_evidence_flow" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined({
      review_verdict: extra.review_verdict,
      open_blocking_finding_count: extra.open_blocking_finding_count,
      finding_count: extra.finding_count,
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
  const defaults = DEFAULT_POST_P64000_CLAUDE_REVIEW_EXECUTION_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    baseline_path: path.resolve(repoRoot, options.baselinePath ?? defaults.baselinePath),
    packet_path: path.resolve(repoRoot, options.packetPath ?? defaults.packetPath),
    raw_review_path: path.resolve(repoRoot, options.rawReviewPath ?? defaults.rawReviewPath),
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

function normalizeInlineJsonSource(sourceId, data) {
  return { path: sourceId, available: data !== null && data !== undefined, data, text: data === null || data === undefined ? "" : JSON.stringify(data) };
}

function normalizeInlineTextSource(sourceId, text) {
  return { path: sourceId, available: String(text ?? "").length > 0, text: String(text ?? "") };
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
    else if (arg === "--baseline") args.baselinePath = argv[++index];
    else if (arg === "--packet") args.packetPath = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--baseline PATH] [--packet PATH] [--raw-review PATH]`);
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null));
}
