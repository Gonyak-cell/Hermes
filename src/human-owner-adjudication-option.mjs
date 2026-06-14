import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPatchCandidateLane } from "./patch-candidate-lane.mjs";

export const DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_OUT_DIR = "artifacts/human-owner-adjudication-option/latest";
export const DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS = {
  schemaPath: "schemas/human-owner-adjudication-option.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p12601-p12800.md",
  architectureDocPath: "docs/architecture.md",
  sourcePatchCandidateLanePath: "artifacts/patch-candidate-lane/latest/patch-candidate-lane.json",
  ownerAdjudicationReceiptPath: "artifacts/human-owner-adjudication-option/review/owner-adjudication-receipt.json",
};

const COMMAND_NAME = "platform:human-owner-adjudication-option";
const SCHEMA_VERSION = "human-owner-adjudication-option.v1";
const CAPABILITY_ID = "platform.human_owner_adjudication_option";
const PROGRAM_RANGE = "P12601-P12800";
const SOURCE_PROGRAM_RANGE = "P12401-P12600";
const READY_STATUS = "ready_for_human_owner_adjudication_option";
const BLOCKED_STATUS = "blocked_human_owner_adjudication_option";

const PHASE_SPECS = [
  ["P12601-P12620", "P12600 Source Binding", "adjudication_source_binding_rows"],
  ["P12621-P12640", "Owner Adjudication Receipt Schema", "owner_adjudication_receipt_rows"],
  ["P12641-P12660", "Protected Closeout Mapping", "protected_closeout_mapping_rows"],
  ["P12661-P12680", "Independent Review Separation", "independent_review_separation_rows"],
  ["P12681-P12700", "Single-Owner Trust Downgrade", "single_owner_trust_downgrade_rows"],
  ["P12701-P12720", "Adjudication Queue", "adjudication_queue_rows"],
  ["P12721-P12740", "Finding Disposition", "finding_disposition_rows"],
  ["P12741-P12760", "Read-Only Operator/API Projection", "adjudication_operator_projection_rows"],
  ["P12761-P12780", "Authority Guard", "adjudication_authority_guard_rows"],
  ["P12781-P12800", "Human/Owner Adjudication Freeze", "p12800_freeze_rows"],
];

const OWNER_RECEIPT_TERMS = [
  ["receipt_schema", "receipt schema"],
  ["adjudicator_id", "adjudicator id"],
  ["adjudicator_role", "adjudicator role"],
  ["scope_ref", "scope ref"],
  ["decision_set", "decision set"],
  ["evidence_refs", "evidence refs"],
  ["raw_payload_redaction", "raw payload redaction"],
];
const PROTECTED_CLOSEOUT_TERMS = ["protected output class", "owner receipt requirement", "review evidence ref", "validation evidence ref", "rollback evidence ref", "closeout remains blocked"];
const INDEPENDENT_REVIEW_TERMS = ["independent GitHub review", "Claude review evidence", "owner adjudication evidence", "enterprise trust separation", "review authority boundary", "no reviewer replacement"];
const SINGLE_OWNER_TERMS = ["single-owner mode", "lower trust classification", "not enterprise independent review", "merge readiness only", "explicit exception receipt"];
const QUEUE_TERMS = ["queue item id", "scope owner", "required evidence", "missing receipt", "blocked reason", "next condition"];
const FINDING_TERMS = ["finding id", "disposition enum", "owner decision ref", "follow-up required", "unresolved finding remains blocked", "redacted rationale summary"];
const OPERATOR_TERMS = ["adjudication state", "source state", "receipt state", "independent review state", "single-owner trust state", "next condition"];
const AUTHORITY_TERMS = ["owner receipt not enterprise review", "owner receipt not GitHub approval", "Codex not final approver", "Claude not final approver", "no production PASS", "no enterprise PASS"];

export async function runHumanOwnerAdjudicationOption(options = {}) {
  const result = await buildHumanOwnerAdjudicationOption(options);
  if (options.write !== false) await writeHumanOwnerAdjudicationOption(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human/Owner Adjudication Option failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanOwnerAdjudicationOption(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "patchCandidateLane")
    ? normalizeInlineJsonSource("inline.patch_candidate_lane", options.patchCandidateLane)
    : await readJsonOrBuildPatchCandidateLane(inputs.source_patch_candidate_lane_path, generatedAt);
  const ownerReceipt = Object.prototype.hasOwnProperty.call(options, "ownerAdjudicationReceipt")
    ? normalizeInlineJsonSource("inline.owner_adjudication_receipt", options.ownerAdjudicationReceipt)
    : await readJsonSource(inputs.owner_adjudication_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const ownerReceiptRows = buildOwnerReceiptRows(roadmapDoc.text, ownerReceipt, generatedAt);
  const protectedRows = buildTermRows("protected_closeout_mapping", "Protected closeout", PROTECTED_CLOSEOUT_TERMS, roadmapDoc.text, "protected_closeout_mapping_rows", generatedAt, protectedExtras);
  const reviewRows = buildTermRows("independent_review_separation", "Independent review", INDEPENDENT_REVIEW_TERMS, roadmapDoc.text, "independent_review_separation_rows", generatedAt, reviewExtras);
  const singleOwnerRows = buildTermRows("single_owner_trust_downgrade", "Single-owner trust", SINGLE_OWNER_TERMS, roadmapDoc.text, "single_owner_trust_downgrade_rows", generatedAt, singleOwnerExtras);
  const queueRows = buildTermRows("adjudication_queue", "Adjudication queue", QUEUE_TERMS, roadmapDoc.text, "adjudication_queue_rows", generatedAt, queueExtras);
  const findingRows = buildTermRows("finding_disposition", "Finding disposition", FINDING_TERMS, roadmapDoc.text, "finding_disposition_rows", generatedAt, findingExtras);
  const operatorRows = buildTermRows("adjudication_operator_projection", "Adjudication operator projection", OPERATOR_TERMS, roadmapDoc.text, "adjudication_operator_projection_rows", generatedAt, operatorExtras);
  const authorityRows = buildTermRows("adjudication_authority_guard", "Adjudication authority guard", AUTHORITY_TERMS, roadmapDoc.text, "adjudication_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, ownerReceiptRows, protectedRows, reviewRows, singleOwnerRows, queueRows, findingRows, operatorRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, ownerReceiptRows, protectedRows, reviewRows, singleOwnerRows, queueRows, findingRows, operatorRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, ownerReceiptRows, protectedRows, reviewRows, singleOwnerRows, queueRows, findingRows, operatorRows, authorityRows, freezeRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      patch_candidate_lane_path: source.path,
      owner_adjudication_receipt_path: ownerReceipt.path,
    },
    source_patch_candidate_lane_summary: source.data?.summary ?? null,
    observed_owner_adjudication_receipt_summary: ownerReceipt.data?.summary ?? null,
    human_owner_adjudication_contract: contract,
    human_owner_phase_rows: phaseRows,
    adjudication_source_binding_rows: sourceRows,
    owner_adjudication_receipt_rows: ownerReceiptRows,
    protected_closeout_mapping_rows: protectedRows,
    independent_review_separation_rows: reviewRows,
    single_owner_trust_downgrade_rows: singleOwnerRows,
    adjudication_queue_rows: queueRows,
    finding_disposition_rows: findingRows,
    adjudication_operator_projection_rows: operatorRows,
    adjudication_authority_guard_rows: authorityRows,
    p12800_freeze_rows: freezeRows,
    human_owner_adjudication_boundary: boundary,
    human_owner_adjudication_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, ownerReceiptRows, protectedRows, reviewRows, singleOwnerRows, queueRows, findingRows, operatorRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "human_owner_adjudication_option")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.human_owner_adjudication_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.human_owner_adjudication_validation_items);
  result.summary = buildSummary({ boundary, ownerReceiptRows, protectedRows, reviewRows, singleOwnerRows, queueRows, findingRows, operatorRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeHumanOwnerAdjudicationOption(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-owner-adjudication-option.json"), serializableResult(result));
  await writeJson(path.join(outDir, "human-owner-phase-rows.json"), collectionEnvelope("human-owner-phase-rows.v1", "human_owner_phase_rows", result.human_owner_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "adjudication-source-binding-rows.json"), collectionEnvelope("adjudication-source-binding-rows.v1", "adjudication_source_binding_rows", result.adjudication_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "owner-adjudication-receipt-rows.json"), collectionEnvelope("owner-adjudication-receipt-rows.v1", "owner_adjudication_receipt_rows", result.owner_adjudication_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-closeout-mapping-rows.json"), collectionEnvelope("protected-closeout-mapping-rows.v1", "protected_closeout_mapping_rows", result.protected_closeout_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "independent-review-separation-rows.json"), collectionEnvelope("independent-review-separation-rows.v1", "independent_review_separation_rows", result.independent_review_separation_rows, result.generated_at));
  await writeJson(path.join(outDir, "single-owner-trust-downgrade-rows.json"), collectionEnvelope("single-owner-trust-downgrade-rows.v1", "single_owner_trust_downgrade_rows", result.single_owner_trust_downgrade_rows, result.generated_at));
  await writeJson(path.join(outDir, "adjudication-queue-rows.json"), collectionEnvelope("adjudication-queue-rows.v1", "adjudication_queue_rows", result.adjudication_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-disposition-rows.json"), collectionEnvelope("finding-disposition-rows.v1", "finding_disposition_rows", result.finding_disposition_rows, result.generated_at));
  await writeJson(path.join(outDir, "adjudication-operator-projection-rows.json"), collectionEnvelope("adjudication-operator-projection-rows.v1", "adjudication_operator_projection_rows", result.adjudication_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "adjudication-authority-guard-rows.json"), collectionEnvelope("adjudication-authority-guard-rows.v1", "adjudication_authority_guard_rows", result.adjudication_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p12800-freeze-rows.json"), collectionEnvelope("p12800-freeze-rows.v1", "p12800_freeze_rows", result.p12800_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "human-owner-adjudication-boundary.json"), result.human_owner_adjudication_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "human-owner-adjudication-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.human_owner_adjudication_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runHumanOwnerAdjudicationOptionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runHumanOwnerAdjudicationOption(args);
    console.log(`Human/Owner Adjudication Option ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.human_owner_adjudication_option_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P12601: ${result.summary.source_ready_for_p12601_handoff}`);
    console.log(`Owner adjudication receipt: ${result.summary.owner_adjudication_receipt_present_now}`);
    console.log(`Ready for P12801 handoff: ${result.summary.ready_for_p12801_handoff}`);
    console.log(`Enterprise trust allowed: ${result.summary.enterprise_trust_claim_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "human-owner-adjudication-option.contract.v1",
    generated_at: generatedAt,
    source_patch_candidate_lane_required: true,
    owner_adjudication_receipt_optional_input_required_for_handoff: true,
    independent_review_separation_required: true,
    single_owner_trust_downgrade_required: true,
    operator_projection_read_only: true,
    owner_receipt_auto_final_approval_enabled: false,
    owner_receipt_creates_github_approval: false,
    owner_adjudication_as_enterprise_review_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p12601-p12800.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.patch_candidate_boundary ?? {};
  const sourceStatus = summary.patch_candidate_lane_status ?? "missing";
  const sourceReady = summary.ready_for_p12601_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P12401-P12600 source artifact available", source.available],
    ["source.range", "P12401-P12600 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P12600 source status visible", sourceStatus === "ready_for_patch_candidate_lane" || sourceStatus === "blocked_patch_candidate_lane"],
    ["source.handoff", "P12600 ready_for_p12601_handoff", sourceReady],
    ["source.block_visible", "P12600 blocker visible", sourceReady || sourceBlocked],
    ["source.patch_contract", "P12600 patch candidate and diff contracts available", Number(summary.patch_candidate_row_count ?? 0) >= 6 && Number(summary.diff_packet_row_count ?? 0) >= 6],
    ["source.no_patch_write", "P12600 source did not generate apply or write patches", boundary.patch_generated_now === false && boundary.patch_applied_now === false && boundary.direct_apply_allowed_now === false && boundary.write_action_allowed_now === false],
    ["source.no_final_trust", "P12600 source did not open final approval production PASS or enterprise PASS", boundary.final_approval_ui_enabled === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: sourceStatus,
  }));
}

function buildOwnerReceiptRows(roadmapText, ownerReceipt, generatedAt) {
  const receiptObserved = ownerReceipt.available === true
    && ownerReceipt.data?.schema_version === "owner-adjudication-receipt.v1"
    && ownerReceipt.data?.receipt_status === "observed"
    && ownerReceipt.data?.owner_adjudication_receipt_present_now === true
    && ownerReceipt.data?.scope_human_owner_adjudication_option === true
    && ownerReceipt.data?.raw_payload_inlined === false
    && ownerReceipt.data?.final_authority_allowed_now === false
    && ownerReceipt.data?.enterprise_trust_claim_allowed_now === false;
  return OWNER_RECEIPT_TERMS.map(([termId, term]) => {
    const observed = termId === "receipt_schema" ? receiptObserved || includesText(roadmapText, term) : includesText(roadmapText, term);
    return verdictRow({
      row_id: `owner_receipt.${termId}`,
      category: "owner_adjudication_receipt",
      label: `Owner adjudication receipt: ${term}`,
      required: true,
      observed,
      evidence_ref: termId === "receipt_schema" && receiptObserved ? ownerReceipt.path : "docs/hermes-roadmap-p12601-p12800.md#P12621-P12640",
      generated_at: generatedAt,
      term_id: termId,
      owner_adjudication_receipt_present_now: receiptObserved,
      owner_receipt_auto_final_approval_enabled: false,
      owner_adjudication_as_enterprise_review_allowed: false,
      owner_receipt_creates_github_approval: false,
    });
  });
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p12601-p12800.md#adjudication-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const receiptReady = context.ownerReceiptRows.some((row) => row.owner_adjudication_receipt_present_now === true);
  return [
    ["freeze.source", "P12600 source ready for P12601", sourceReady],
    ["freeze.source_block_visible", "P12600 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.owner_receipt", "owner adjudication receipt observed", receiptReady],
    ["freeze.protected_mapping", "protected closeout mapping ready", allPass(context.protectedRows)],
    ["freeze.independent_review_separation", "independent review separation ready", allPass(context.reviewRows)],
    ["freeze.single_owner_downgrade", "single-owner trust downgrade ready", allPass(context.singleOwnerRows)],
    ["freeze.queue", "adjudication queue ready", allPass(context.queueRows)],
    ["freeze.finding_disposition", "finding disposition ready", allPass(context.findingRows)],
    ["freeze.operator_projection", "read-only operator/API adjudication projection ready", allPass(context.operatorRows)],
    ["freeze.authority_guard", "adjudication authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_auto_final", "owner receipt does not create auto final approval or GitHub approval", true],
    ["freeze.no_final_trust", "no production PASS enterprise PASS or enterprise trust opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p12800_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p12800-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const ownerReceiptObserved = context.ownerReceiptRows.some((row) => row.owner_adjudication_receipt_present_now === true);
  const protectedReady = allPass(context.protectedRows);
  const reviewReady = allPass(context.reviewRows);
  const singleOwnerReady = allPass(context.singleOwnerRows);
  const contractReady = allPass(context.ownerReceiptRows)
    && protectedReady
    && reviewReady
    && singleOwnerReady
    && allPass(context.queueRows)
    && allPass(context.findingRows)
    && allPass(context.operatorRows)
    && allPass(context.authorityRows);
  const freezeReady = sourceReady && ownerReceiptObserved && contractReady && allPass(context.freezeRows);
  return {
    source_patch_candidate_lane_available: sourceAvailable,
    source_ready_for_p12601_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    owner_adjudication_receipt_present_now: ownerReceiptObserved,
    owner_adjudication_block_visible_now: ownerReceiptObserved === false,
    owner_adjudication_contract_ready: contractReady,
    protected_closeout_mapping_ready: protectedReady,
    independent_review_separation_ready: reviewReady,
    single_owner_trust_downgrade_ready: singleOwnerReady,
    p12800_human_owner_adjudication_freeze_ready: freezeReady,
    ready_for_p12801_handoff: freezeReady,
    owner_adjudication_as_enterprise_review_allowed: false,
    owner_receipt_creates_github_approval: false,
    owner_receipt_auto_final_approval_enabled: false,
    single_owner_lower_trust_mode: true,
    single_owner_enterprise_trust_allowed: false,
    independent_github_review_completed_now: false,
    enterprise_trust_claim_allowed_now: false,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    raw_body_exposure_allowed: false,
    secret_read_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P12601-P12800 phase rows incomplete", "docs/hermes-roadmap-p12601-p12800.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P12601-P12800"), "Architecture doc missing P12601-P12800 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P12600 source state must be available and blocker-visible", "adjudication_source_binding_rows");
  add("owner_receipt.block_visible", "receipt", context.ownerReceiptRows.length === OWNER_RECEIPT_TERMS.length && (context.boundary.owner_adjudication_block_visible_now === true || context.boundary.owner_adjudication_receipt_present_now === true), "Owner adjudication receipt missing without visible blocker", "owner_adjudication_receipt_rows");
  add("protected.ready", "protected_closeout", context.protectedRows.length === PROTECTED_CLOSEOUT_TERMS.length && allPass(context.protectedRows), "Protected closeout mapping rows incomplete", "protected_closeout_mapping_rows");
  add("review_separation.ready", "review", context.reviewRows.length === INDEPENDENT_REVIEW_TERMS.length && allPass(context.reviewRows), "Independent review separation rows incomplete", "independent_review_separation_rows");
  add("single_owner.ready", "trust", context.singleOwnerRows.length === SINGLE_OWNER_TERMS.length && allPass(context.singleOwnerRows), "Single-owner trust downgrade rows incomplete", "single_owner_trust_downgrade_rows");
  add("queue.ready", "queue", context.queueRows.length === QUEUE_TERMS.length && allPass(context.queueRows), "Adjudication queue rows incomplete", "adjudication_queue_rows");
  add("finding.ready", "finding", context.findingRows.length === FINDING_TERMS.length && allPass(context.findingRows), "Finding disposition rows incomplete", "finding_disposition_rows");
  add("operator.ready", "projection", context.operatorRows.length === OPERATOR_TERMS.length && allPass(context.operatorRows), "Operator projection rows incomplete", "adjudication_operator_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "adjudication_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P12800 freeze rows missing", "p12800_freeze_rows");
  add("boundary.owner.not.enterprise", "boundary", context.boundary.owner_adjudication_as_enterprise_review_allowed === false && context.boundary.owner_receipt_creates_github_approval === false && context.boundary.owner_receipt_auto_final_approval_enabled === false, "Owner receipt promoted to independent review or auto final approval", "human_owner_adjudication_boundary");
  add("boundary.single.owner.lower.trust", "boundary", context.boundary.single_owner_lower_trust_mode === true && context.boundary.single_owner_enterprise_trust_allowed === false && context.boundary.enterprise_trust_claim_allowed_now === false, "Single-owner mode promoted to enterprise trust", "human_owner_adjudication_boundary");
  add("boundary.no.write", "boundary", context.boundary.patch_generated_now === false && context.boundary.patch_applied_now === false && context.boundary.direct_apply_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false, "Adjudication option opened patch/write/protected/connector action", "human_owner_adjudication_boundary");
  add("boundary.no.secret.final.trust", "boundary", context.boundary.secret_read_allowed_now === false && context.boundary.raw_body_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false, "Adjudication option opened secret/raw/final/trust boundary", "human_owner_adjudication_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p12801_handoff === context.boundary.p12800_human_owner_adjudication_freeze_ready, "P12801 handoff state must match P12800 freeze state", "human_owner_adjudication_boundary");
  return items;
}

function buildSummary(context) {
  return {
    human_owner_adjudication_option_status: context.boundary.ready_for_p12801_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p12601_handoff: context.boundary.source_ready_for_p12601_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    owner_adjudication_receipt_present_now: context.boundary.owner_adjudication_receipt_present_now,
    owner_adjudication_block_visible_now: context.boundary.owner_adjudication_block_visible_now,
    owner_adjudication_receipt_row_count: context.ownerReceiptRows.length,
    protected_closeout_mapping_row_count: context.protectedRows.length,
    independent_review_separation_row_count: context.reviewRows.length,
    single_owner_trust_downgrade_row_count: context.singleOwnerRows.length,
    adjudication_queue_row_count: context.queueRows.length,
    finding_disposition_row_count: context.findingRows.length,
    operator_projection_row_count: context.operatorRows.length,
    authority_guard_row_count: context.authorityRows.length,
    p12800_human_owner_adjudication_freeze_ready: context.boundary.p12800_human_owner_adjudication_freeze_ready,
    ready_for_p12801_handoff: context.boundary.ready_for_p12801_handoff,
    single_owner_lower_trust_mode: true,
    enterprise_trust_claim_allowed_now: false,
    owner_receipt_auto_final_approval_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Human/Owner Adjudication Option",
    "",
    `Status: ${result.summary.human_owner_adjudication_option_status}`,
    `Program: ${result.program_range}`,
    `Owner receipt rows: ${result.summary.owner_adjudication_receipt_row_count}`,
    `Independent review separation rows: ${result.summary.independent_review_separation_row_count}`,
    `Source ready for P12601: ${result.summary.source_ready_for_p12601_handoff}`,
    `Owner adjudication receipt present: ${result.summary.owner_adjudication_receipt_present_now}`,
    `Ready for P12801 handoff: ${result.summary.ready_for_p12801_handoff}`,
    `Enterprise trust allowed: ${result.summary.enterprise_trust_claim_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.adjudication_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.owner_receipt_auto_final_approval_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Human/Owner Adjudication Option</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Human/Owner Adjudication Option</h1>
    <p class="notice">Owner adjudication is captured as protected closeout input only. It does not replace independent GitHub review, enterprise review, production readiness, or final automated approval.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Auto Final</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildPatchCandidateLane(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildPatchCandidateLane({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.patch_candidate_lane", built);
}

function protectedExtras() {
  return {
    protected_closeout_mapping_required: true,
    owner_receipt_required_before_closeout: true,
    closeout_allowed_now: false,
    protected_action_allowed_now: false,
  };
}

function reviewExtras() {
  return {
    independent_review_separation_required: true,
    owner_adjudication_as_enterprise_review_allowed: false,
    owner_receipt_creates_github_approval: false,
    reviewer_replacement_allowed: false,
  };
}

function singleOwnerExtras() {
  return {
    single_owner_lower_trust_mode: true,
    single_owner_enterprise_trust_allowed: false,
    merge_readiness_only: true,
    enterprise_trust_claim_allowed_now: false,
  };
}

function queueExtras() {
  return {
    queue_projection_only: true,
    mutation_method_allowed_now: false,
    missing_receipt_blocks_closeout: true,
    next_condition_required: true,
  };
}

function findingExtras() {
  return {
    disposition_required: true,
    unresolved_finding_blocks_closeout: true,
    raw_rationale_persistence_allowed: false,
    owner_decision_ref_required: true,
  };
}

function operatorExtras() {
  return {
    api_methods_allowed: ["GET", "HEAD"],
    mutation_method_allowed_now: false,
    final_approval_ui_enabled: false,
    enterprise_trust_badge_enabled: false,
  };
}

function authorityExtras() {
  return {
    owner_receipt_auto_final_approval_enabled: false,
    owner_adjudication_as_enterprise_review_allowed: false,
    owner_receipt_creates_github_approval: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function verdictRow(row) {
  return { block_reason: row.observed ? null : `${row.label} missing or blocked.`, ...row, current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked") };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS.architectureDocPath,
    source_patch_candidate_lane_path: options.sourcePatchCandidateLanePath ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS.sourcePatchCandidateLanePath,
    owner_adjudication_receipt_path: options.ownerAdjudicationReceiptPath ?? DEFAULT_HUMAN_OWNER_ADJUDICATION_OPTION_INPUTS.ownerAdjudicationReceiptPath,
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

function normalizeInlineJsonSource(sourceId, data) {
  return { available: Boolean(data), path: sourceId, text: "", data };
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-patch-candidate-lane-path") args.sourcePatchCandidateLanePath = argv[++index];
    else if (value === "--owner-adjudication-receipt-path") args.ownerAdjudicationReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P12601-P12800 Human/Owner Adjudication Option artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
