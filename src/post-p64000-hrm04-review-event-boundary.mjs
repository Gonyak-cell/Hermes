import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_HRM04_REVIEW_EVENT_BOUNDARY_OUT_DIR = "artifacts/post-p64000-hrm04-review-event-boundary/latest";
export const DEFAULT_POST_P64000_HRM04_REVIEW_EVENT_BOUNDARY_INPUTS = {
  schemaPath: "schemas/post-p64000-hrm04-review-event-boundary.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p65601-p66000.md",
  architectureDocPath: "docs/architecture.md",
  p65600HandoffPath: "artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json",
  baselinePath: "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json",
  packetPath: "artifacts/post-p64000-claude-review/latest/claude-review-packet.md",
  executionPath: "artifacts/post-p64000-claude-review-execution/latest/post-p64000-claude-review-execution.json",
  rawReviewPath: "artifacts/post-p64000-claude-review/review/claude-review-raw.json",
  normalizedReceiptPath: "artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json",
};

const COMMAND_NAME = "platform:post-p64000-hrm04-review-event-boundary";
const SCHEMA_VERSION = "post-p64000-hrm04-review-event-boundary.v1";
const CAPABILITY_ID = "platform.post_p64000_hrm04_review_event_boundary";
const PROGRAM_RANGE = "P65601-P66000";
const SOURCE_PROGRAM_RANGE = "P65201-P65600";
const NEXT_PROGRAM_RANGE = "P66001-P66400";
const HRM04_ID = "HRM-04";

const NEGATIVE_FIXTURES = [
  "packet_treated_as_review_event",
  "packet_missing_false_event_marker",
  "raw_event_missing_true_event_marker",
  "malformed_raw_review_json",
  "auth_failure_counted_as_review_event",
  "tool_call_shaped_output_counted_as_review_event",
  "review_event_without_durable_raw_ref",
  "packet_cited_as_performed_review_evidence",
  "final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "reviewer_mutation_claim",
];

const EXTRA_FALSE_FLAGS = [
  "packet_performed_review_evidence_allowed_now",
  "packet_cited_as_review_event_allowed_now",
  "review_event_without_raw_json_allowed_now",
  "reviewer_mutation_allowed_now",
  "reviewer_final_closeout_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "source_mutation_from_review_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "post_p66000_production_pass_claim_allowed_now",
  "post_p66000_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-hrm04-review-event-boundary.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-hrm04-review-event-boundary.mjs"],
  ["unit.test", "node --test test/post-p64000-hrm04-review-event-boundary.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-hrm04-review-event-boundary -- --check"],
  ["adjacent.handoff", "node --test test/post-p64000-claude-review-handoff-freeze.test.mjs test/post-p64000-hrm04-review-event-boundary.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-hrm04-review-event-boundary.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000Hrm04ReviewEventBoundary(options = {}) {
  const result = await buildPostP64000Hrm04ReviewEventBoundary(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 HRM-04 review event boundary failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000Hrm04ReviewEventBoundary(result, result.output_dir);
  return result;
}

export async function buildPostP64000Hrm04ReviewEventBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_HRM04_REVIEW_EVENT_BOUNDARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const handoff = Object.prototype.hasOwnProperty.call(options, "handoff")
    ? normalizeInlineJsonSource("inline.p65600_handoff_freeze", options.handoff)
    : await readJsonSource(inputs.p65600_handoff_path);
  const baseline = Object.prototype.hasOwnProperty.call(options, "baseline")
    ? normalizeInlineJsonSource("inline.p64400_baseline", options.baseline)
    : await readJsonSource(inputs.baseline_path);
  const packet = Object.prototype.hasOwnProperty.call(options, "packetText")
    ? normalizeInlineTextSource("inline.claude_review_packet", options.packetText)
    : await readTextSource(inputs.packet_path);
  const execution = Object.prototype.hasOwnProperty.call(options, "execution")
    ? normalizeInlineJsonSource("inline.p64800_execution", options.execution)
    : await readJsonSource(inputs.execution_path);
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_review_raw", options.rawReview)
    : await readJsonSource(inputs.raw_review_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_claude_review_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);

  const manifest = buildReviewEventBoundaryManifest({ packet, execution, rawReview, normalizedReceipt, generatedAt, overrides: options.manifestOverrides });
  const sourceRows = buildSourceRows({ handoff, baseline, packet, execution, rawReview, normalizedReceipt, generatedAt });
  const boundaryRows = buildReviewEventBoundaryRows({ manifest, generatedAt });
  const citationRows = buildCitationGuardRows({ manifest, normalizedReceipt, generatedAt });
  const remediationRows = buildHrm04RemediationRows({ manifest, handoff, normalizedReceipt, generatedAt });
  const authorityRows = buildAuthorityRows({ manifest, normalizedReceipt, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, boundaryRows, citationRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, remediationRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, boundaryRows, citationRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, manifest, normalizedReceipt });
  const validationItems = buildValidationItems({ sourceRows, boundaryRows, citationRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p65600_handoff_path: handoff.path,
      baseline_path: baseline.path,
      packet_path: packet.path,
      execution_path: execution.path,
      raw_review_path: rawReview.path,
      normalized_receipt_path: normalizedReceipt.path,
    },
    post_p64000_hrm04_review_event_boundary_contract: {
      contract_id: "post_p64000_hrm04_review_event_boundary",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      packet_is_review_event: false,
      raw_json_is_review_event: true,
      packet_citable_as_scope_only: true,
      packet_citable_as_performed_review: false,
      review_event_requires_durable_raw_json: true,
      hrm04_remediated_candidate: true,
      clean_checkpoint_allowed: false,
      source_mutation_allowed: false,
      claude_final_approval_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    review_event_boundary_manifest: manifest,
    p65600_handoff_source_rows: sourceRows,
    review_event_boundary_rows: boundaryRows,
    citation_guard_rows: citationRows,
    hrm04_remediation_rows: remediationRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p66000_wiring_rows: wiringRows,
    p66000_closeout_rows: closeoutRows,
    p66001_handoff_rows: handoffRows,
    post_p64000_hrm04_review_event_boundary: boundary,
    post_p64000_hrm04_review_event_boundary_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_hrm04_review_event_boundary")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_hrm04_review_event_boundary_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_hrm04_review_event_boundary_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000Hrm04ReviewEventBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-hrm04-review-event-boundary.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-event-boundary-manifest.json"), result.review_event_boundary_manifest);
  await writeJson(path.join(outDir, "review-event-boundary-rows.json"), collectionEnvelope("review-event-boundary-rows.v1", "review_event_boundary_rows", result.review_event_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "citation-guard-rows.json"), collectionEnvelope("citation-guard-rows.v1", "citation_guard_rows", result.citation_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "hrm04-remediation-rows.json"), collectionEnvelope("hrm04-remediation-rows.v1", "hrm04_remediation_rows", result.hrm04_remediation_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000Hrm04ReviewEventBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000Hrm04ReviewEventBoundary(args);
  console.log(`Post-P64000 HRM-04 review event boundary ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_hrm04_review_event_boundary_status}`);
  console.log(`Packet is review event: ${result.summary.packet_is_review_event_now}`);
  console.log(`Raw JSON is review event: ${result.summary.raw_json_is_review_event_now}`);
  console.log(`HRM-04 remediated candidate: ${result.summary.hrm04_remediated_candidate_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Ready for P66001 handoff: ${result.summary.ready_for_p66001_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ handoff, baseline, packet, execution, rawReview, normalizedReceipt, generatedAt }) {
  return [
    row("source.p65600_handoff_available", "source_binding", "P65600 handoff freeze is available", handoff.available === true, handoff.path, generatedAt),
    row("source.p65600_valid", "source_binding", "P65600 handoff validation is valid", handoff.data?.validation?.valid === true, handoff.path, generatedAt),
    row("source.hrm04_open", "source_binding", "HRM-04 is present as an open blocker before remediation", hasHrm04Open(normalizedReceipt.data) || hasHrm04OpenInHandoff(handoff.data), normalizedReceipt.path, generatedAt),
    row("source.p64400_baseline_valid", "source_binding", "P64400 review packet baseline is valid", baseline.data?.validation?.valid === true, baseline.path, generatedAt),
    row("source.packet_available", "source_binding", "Claude review packet is available as request artifact", packet.available === true && packet.text.trim().length > 0, packet.path, generatedAt),
    row("source.p64800_execution_valid", "source_binding", "P64800 performed review execution artifact is valid", execution.data?.validation?.valid === true, execution.path, generatedAt),
    row("source.raw_review_available", "source_binding", "Durable raw Claude review JSON is available", rawReview.available === true && rawReview.data !== null, rawReview.path, generatedAt),
    row("source.normalized_receipt_available", "source_binding", "Normalized review receipt is available", normalizedReceipt.data?.schema_version === "post-p64000-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
  ];
}

function buildReviewEventBoundaryManifest({ packet, execution, rawReview, normalizedReceipt, generatedAt, overrides = {} }) {
  const rawValid = isValidPerformedRawReview(rawReview.data);
  const manifest = {
    schema_version: "review-event-boundary-manifest.v1",
    generated_at: generatedAt,
    remediation_id: HRM04_ID,
    packet_boundary: {
      artifact_kind: "claude_review_request_packet",
      artifact_ref: packet.path,
      sha256: packet.available ? sha256(packet.text) : null,
      is_claude_review_event: false,
      performed_review_evidence_allowed: false,
      citable_as_scope_only: true,
      citable_as_performed_review: false,
    },
    performed_review_event_boundary: {
      artifact_kind: "durable_claude_review_raw_json",
      artifact_ref: rawReview.path,
      execution_ref: execution.path,
      normalized_receipt_ref: normalizedReceipt.path,
      sha256: rawReview.available ? sha256(rawReview.text) : null,
      is_claude_review_event: true,
      performed_review_evidence_allowed: rawValid,
      durable_raw_json_required: true,
      cli_success_required: true,
      reviewer_lane: normalizedReceipt.data?.reviewer_lane ?? "independent_read_only",
      reviewer: normalizedReceipt.data?.reviewer ?? "claude-code-opus-max",
      model_ids: rawReview.data?.modelUsage ? Object.keys(rawReview.data.modelUsage) : [],
    },
    citation_policy: {
      packet_ref_may_satisfy_review_scope: true,
      packet_ref_may_satisfy_performed_review: false,
      performed_review_requires_is_claude_review_event_true: true,
      performed_review_requires_durable_raw_json_ref: true,
      normalized_receipt_must_point_to_raw_event: true,
    },
    authority_boundary: {
      clean_checkpoint_allowed: false,
      source_mutation_allowed: false,
      reviewer_mutation_allowed: false,
      final_approval_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
    },
  };
  return deepMerge(manifest, overrides);
}

function buildReviewEventBoundaryRows({ manifest, generatedAt }) {
  const packet = manifest.packet_boundary ?? {};
  const event = manifest.performed_review_event_boundary ?? {};
  return [
    row("boundary.manifest_schema", "review_event_boundary", "Boundary manifest schema is present", manifest.schema_version === "review-event-boundary-manifest.v1", "artifacts/post-p64000-hrm04-review-event-boundary/latest/review-event-boundary-manifest.json", generatedAt),
    row("boundary.packet_false_marker", "review_event_boundary", "Review packet is explicitly not a Claude review event", packet.is_claude_review_event === false, packet.artifact_ref, generatedAt, { is_claude_review_event: packet.is_claude_review_event }),
    row("boundary.packet_not_evidence", "review_event_boundary", "Review packet cannot satisfy performed review evidence", packet.performed_review_evidence_allowed === false && packet.citable_as_performed_review === false, packet.artifact_ref, generatedAt),
    row("boundary.packet_scope_only", "review_event_boundary", "Review packet remains citable as review scope only", packet.citable_as_scope_only === true, packet.artifact_ref, generatedAt),
    row("boundary.raw_true_marker", "review_event_boundary", "Durable raw JSON is explicitly the Claude review event", event.is_claude_review_event === true, event.artifact_ref, generatedAt, { is_claude_review_event: event.is_claude_review_event }),
    row("boundary.raw_evidence_allowed", "review_event_boundary", "Durable raw JSON may satisfy performed review evidence", event.performed_review_evidence_allowed === true, event.artifact_ref, generatedAt),
    row("boundary.raw_ref_required", "review_event_boundary", "Performed review event requires durable raw JSON ref", event.durable_raw_json_required === true && hasText(event.artifact_ref), event.artifact_ref, generatedAt),
    row("boundary.event_links_execution", "review_event_boundary", "Performed review event links execution and normalized receipt", hasText(event.execution_ref) && hasText(event.normalized_receipt_ref), event.execution_ref, generatedAt),
  ];
}

function buildCitationGuardRows({ manifest, normalizedReceipt, generatedAt }) {
  const policy = manifest.citation_policy ?? {};
  const event = manifest.performed_review_event_boundary ?? {};
  return [
    row("citation.packet_scope_only", "citation_guard", "Packet ref may satisfy review scope only", policy.packet_ref_may_satisfy_review_scope === true, manifest.packet_boundary?.artifact_ref, generatedAt),
    row("citation.packet_not_performed_review", "citation_guard", "Packet ref cannot satisfy performed review", policy.packet_ref_may_satisfy_performed_review === false, manifest.packet_boundary?.artifact_ref, generatedAt),
    row("citation.event_requires_true_marker", "citation_guard", "Performed review citation requires event true marker", policy.performed_review_requires_is_claude_review_event_true === true && event.is_claude_review_event === true, event.artifact_ref, generatedAt),
    row("citation.event_requires_raw_ref", "citation_guard", "Performed review citation requires durable raw JSON ref", policy.performed_review_requires_durable_raw_json_ref === true && hasText(event.artifact_ref), event.artifact_ref, generatedAt),
    row("citation.receipt_points_raw", "citation_guard", "Normalized receipt points to raw event", normalizedReceipt.data?.raw_output_ref === event.artifact_ref || path.basename(String(normalizedReceipt.data?.raw_output_ref ?? "")) === path.basename(String(event.artifact_ref ?? "")), normalizedReceipt.path, generatedAt),
  ];
}

function buildHrm04RemediationRows({ manifest, handoff, normalizedReceipt, generatedAt }) {
  const finding = (normalizedReceipt.data?.findings ?? []).find((item) => item.id === HRM04_ID);
  return [
    row("hrm04.finding_present", "hrm04_remediation", "HRM-04 finding is present", finding?.id === HRM04_ID, normalizedReceipt.path, generatedAt),
    row("hrm04.finding_open_before_remediation", "hrm04_remediation", "HRM-04 was open before boundary remediation", finding?.normalized_status === "blocking_open" || hasHrm04OpenInHandoff(handoff.data), normalizedReceipt.path, generatedAt),
    row("hrm04.authority_leakage_category", "hrm04_remediation", "HRM-04 is authority leakage", finding?.category === "authority_leakage", normalizedReceipt.path, generatedAt),
    row("hrm04.packet_event_confusion_blocked", "hrm04_remediation", "Packet-as-review-event confusion is blocked", manifest.packet_boundary?.is_claude_review_event === false && manifest.packet_boundary?.performed_review_evidence_allowed === false, manifest.packet_boundary?.artifact_ref, generatedAt),
    row("hrm04.raw_event_boundary_opened", "hrm04_remediation", "Raw review event boundary is explicit", manifest.performed_review_event_boundary?.is_claude_review_event === true && manifest.performed_review_event_boundary?.performed_review_evidence_allowed === true, manifest.performed_review_event_boundary?.artifact_ref, generatedAt),
    row("hrm04.remediated_candidate", "hrm04_remediation", "HRM-04 is remediated as a boundary candidate", true, "artifacts/post-p64000-hrm04-review-event-boundary/latest/review-event-boundary-manifest.json", generatedAt, {
      finding_id: HRM04_ID,
      remediation_status: "remediated_candidate_pending_future_review",
      next_allowed_action: "continue_to_hrm03_review_window_cap",
    }),
  ];
}

function buildAuthorityRows({ manifest, normalizedReceipt, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const manifestClaim = manifestClaimForFlag(manifest, normalizedReceipt.data, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : manifestClaim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p65601-p66000.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function manifestClaimForFlag(manifest, receipt, flag) {
  if (flag === "packet_performed_review_evidence_allowed_now" && manifest.packet_boundary?.performed_review_evidence_allowed === true) return true;
  if (flag === "packet_cited_as_review_event_allowed_now" && manifest.packet_boundary?.citable_as_performed_review === true) return true;
  if (flag === "review_event_without_raw_json_allowed_now" && !hasText(manifest.performed_review_event_boundary?.artifact_ref)) return true;
  if (flag === "reviewer_mutation_allowed_now" && manifest.authority_boundary?.reviewer_mutation_allowed === true) return true;
  if (flag === "claude_final_approval_allowed" && receipt?.reviewer_final_approval_allowed === true) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && receipt?.protected_closeout_allowed === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && receipt?.source_mutation_performed === true) return true;
  if (flag === "post_p66000_production_pass_claim_allowed_now" && receipt?.production_pass_allowed === true) return true;
  if (flag === "post_p66000_enterprise_pass_claim_allowed_now" && receipt?.enterprise_pass_allowed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks HRM-04 boundary closeout`,
    true,
    "docs/hermes-roadmap-p65601-p66000.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-hrm04-review-event-boundary.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P65601-P66000 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P65601-P66000") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p65601-p66000.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P65601-P66000 HRM-04 review event boundary", architectureDoc.available && architectureDoc.text.includes("P65601-P66000"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, boundaryRows, citationRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p66000.source_ready", "P65600/P64400/P64800 sources are ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p66000.boundary_ready", "Review event boundary rows pass", boundaryRows.every(pass), generatedAt),
    closeoutRow("p66000.citation_guard_ready", "Citation guard rows pass", citationRows.every(pass), generatedAt),
    closeoutRow("p66000.hrm04_remediation_candidate", "HRM-04 remediation candidate is recorded", remediationRows.every(pass), generatedAt),
    closeoutRow("p66000.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p66000.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p66000.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p66000.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, remediationRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.hrm04_boundary_remediated", "p66001_handoff", "HRM-04 boundary remediation is ready for future review", ready, "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json", generatedAt, {
      next_allowed_action: ready ? "continue_to_hrm03_review_window_cap" : "resolve_hrm04_boundary_blockers",
    }),
    row("handoff.hrm04_not_final_approval", "p66001_handoff", "HRM-04 remediation candidate is not final approval or clean checkpoint", remediationRows.every(pass), "docs/hermes-roadmap-p65601-p66000.md", generatedAt),
    row("handoff.p66001_hrm03", "p66001_handoff", "P66001 may start HRM-03 review window cap remediation", ready, "docs/hermes-roadmap-p65601-p66000.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
    }),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, boundaryRows, citationRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, manifest, normalizedReceipt } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_hrm04_review_event_boundary_ready: closeoutRows.every(pass),
    source_binding_ready_now: sourceRows.every(pass),
    review_event_boundary_ready_now: boundaryRows.every(pass),
    citation_guard_ready_now: citationRows.every(pass),
    hrm04_remediated_candidate_now: remediationRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p66001_handoff: handoffRows.every(pass),
    packet_is_review_event_now: manifest.packet_boundary?.is_claude_review_event === true,
    raw_json_is_review_event_now: manifest.performed_review_event_boundary?.is_claude_review_event === true,
    packet_citable_as_performed_review_now: manifest.packet_boundary?.citable_as_performed_review === true,
    packet_citable_as_scope_only_now: manifest.packet_boundary?.citable_as_scope_only === true,
    clean_checkpoint_allowed_now: false,
    review_verdict: normalizedReceipt.data?.overall_verdict ?? "",
    blocks_clean_checkpoint: normalizedReceipt.data?.blocks_clean_checkpoint === true,
    blocking_finding_count: Number(normalizedReceipt.data?.normalized_blocking_finding_count ?? 0),
    finding_count: Number(normalizedReceipt.data?.finding_count ?? 0),
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p66000_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p66000_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, boundaryRows, citationRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.ready", "source_binding", sourceRows.every(pass), "P65600/P64400/P64800 sources must be valid"),
    validationItem("boundary.ready", "review_event_boundary", boundaryRows.every(pass), "Review event boundary rows must pass"),
    validationItem("citation.guard", "citation_guard", citationRows.every(pass), "Citation guard rows must pass"),
    validationItem("hrm04.remediated_candidate", "hrm04_remediation", remediationRows.every(pass), "HRM-04 remediation rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P66000 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P66001 handoff rows must pass"),
    validationItem("boundary.packet_false", "review_event_boundary", boundary.packet_is_review_event_now === false, "Packet must not be a review event"),
    validationItem("boundary.raw_true", "review_event_boundary", boundary.raw_json_is_review_event_now === true, "Raw JSON must be the performed review event"),
    validationItem("boundary.packet_not_citable", "citation_guard", boundary.packet_citable_as_performed_review_now === false, "Packet must not be citable as performed review"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p66001_handoff
    ? "hrm04_review_event_boundary_remediated_candidate_ready_for_p66001"
    : validation.valid
      ? "valid_block_p66001_handoff_pending"
      : "blocked_post_p64000_hrm04_review_event_boundary";
  return {
    post_p64000_hrm04_review_event_boundary_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    source_binding_ready_now: boundary.source_binding_ready_now,
    review_event_boundary_ready_now: boundary.review_event_boundary_ready_now,
    citation_guard_ready_now: boundary.citation_guard_ready_now,
    hrm04_remediated_candidate_now: boundary.hrm04_remediated_candidate_now,
    ready_for_p66001_handoff: boundary.ready_for_p66001_handoff,
    packet_is_review_event_now: boundary.packet_is_review_event_now,
    raw_json_is_review_event_now: boundary.raw_json_is_review_event_now,
    packet_citable_as_performed_review_now: boundary.packet_citable_as_performed_review_now,
    packet_citable_as_scope_only_now: boundary.packet_citable_as_scope_only_now,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    review_verdict: boundary.review_verdict,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function isValidPerformedRawReview(raw) {
  if (!raw || raw.type !== "result" || raw.subtype !== "success" || raw.is_error === true) return false;
  if (typeof raw.result !== "string" || raw.result.trim().length === 0) return false;
  if (/not logged in|please run \/login/i.test(raw.result)) return false;
  if (Array.isArray(raw.content) || raw.type === "tool_use") return false;
  return Object.keys(raw.modelUsage ?? {}).some((modelId) => modelId.includes("opus"));
}

function hasHrm04Open(receipt) {
  return (receipt?.findings ?? []).some((finding) => finding.id === HRM04_ID && finding.normalized_status === "blocking_open");
}

function hasHrm04OpenInHandoff(handoff) {
  return (handoff?.blocking_finding_revalidation_rows ?? []).some((rowItem) => rowItem.finding_id === HRM04_ID && rowItem.normalized_status === "blocking_open");
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 HRM-04 Review Event Boundary ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_hrm04_review_event_boundary_status}`,
    `- packet_is_review_event_now: ${result.summary.packet_is_review_event_now}`,
    `- raw_json_is_review_event_now: ${result.summary.raw_json_is_review_event_now}`,
    `- packet_citable_as_performed_review_now: ${result.summary.packet_citable_as_performed_review_now}`,
    `- hrm04_remediated_candidate_now: ${result.summary.hrm04_remediated_candidate_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- ready_for_p66001_handoff: ${result.summary.ready_for_p66001_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p66001_handoff
      ? "Continue to P66001-P66400 HRM-03 review window cap remediation. Do not claim clean checkpoint before future review."
      : "Resolve HRM-04 source, boundary, citation, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p66000_closeout", label, observed, "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_hrm04_boundary" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined(extra),
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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--p65600-handoff") args.p65600HandoffPath = argv[++index];
    else if (arg === "--baseline") args.baselinePath = argv[++index];
    else if (arg === "--packet") args.packetPath = argv[++index];
    else if (arg === "--execution") args.executionPath = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
    else if (arg === "--normalized-receipt") args.normalizedReceiptPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--p65600-handoff PATH] [--baseline PATH] [--packet PATH] [--execution PATH] [--raw-review PATH] [--normalized-receipt PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_HRM04_REVIEW_EVENT_BOUNDARY_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    p65600_handoff_path: path.resolve(repoRoot, options.p65600HandoffPath ?? defaults.p65600HandoffPath),
    baseline_path: path.resolve(repoRoot, options.baselinePath ?? defaults.baselinePath),
    packet_path: path.resolve(repoRoot, options.packetPath ?? defaults.packetPath),
    execution_path: path.resolve(repoRoot, options.executionPath ?? defaults.executionPath),
    raw_review_path: path.resolve(repoRoot, options.rawReviewPath ?? defaults.rawReviewPath),
    normalized_receipt_path: path.resolve(repoRoot, options.normalizedReceiptPath ?? defaults.normalizedReceiptPath),
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
  return { path: sourceId, available: typeof text === "string", text: typeof text === "string" ? text : "" };
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

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function deepMerge(base, overrides) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
