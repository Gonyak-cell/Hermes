import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildFreezeEvidenceActivation } from "./freeze-evidence-activation.mjs";

export const DEFAULT_FREEZE_EVIDENCE_COMPLETION_OUT_DIR = "artifacts/freeze-evidence-completion/latest";
export const DEFAULT_FREEZE_EVIDENCE_COMPLETION_INPUTS = {
  schemaPath: "schemas/freeze-evidence-completion.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p17201-p17600.md",
  architectureDocPath: "docs/architecture.md",
  sourceFreezeEvidenceActivationPath: "artifacts/freeze-evidence-activation/latest/freeze-evidence-activation.json",
  claudeCompletionReviewReceiptPath: "artifacts/freeze-evidence-completion/review/claude-freeze-completion-review-receipt.json",
  revalidationReceiptPath: "artifacts/freeze-evidence-completion/revalidation/revalidation-receipt.json",
};

const COMMAND_NAME = "platform:freeze-evidence-completion";
const SCHEMA_VERSION = "freeze-evidence-completion.v1";
const CAPABILITY_ID = "platform.freeze_evidence_completion";
const PROGRAM_RANGE = "P17201-P17600";
const SOURCE_PROGRAM_RANGE = "P16801-P17200";
const READY_STATUS = "ready_for_freeze_evidence_completion";
const BLOCKED_STATUS = "blocked_freeze_evidence_completion";

const PHASE_SPECS = [
  ["P17201-P17240", "Freeze Evidence Inventory", "freeze_completion_inventory_rows"],
  ["P17241-P17280", "Claude Review Packet Execution", "claude_review_execution_rows"],
  ["P17281-P17320", "Review Receipt Intake", "completion_review_receipt_rows"],
  ["P17321-P17360", "Finding Remediation Loop", "finding_remediation_rows"],
  ["P17361-P17400", "Revalidation Evidence Capture", "revalidation_evidence_rows"],
  ["P17401-P17440", "P17601 Handoff Gate Projection", "p17601_handoff_gate_rows"],
  ["P17441-P17480", "Blocker Burn-down Ledger", "blocker_burndown_rows"],
  ["P17481-P17520", "Operator Completion Projection", "completion_operator_projection_rows"],
  ["P17521-P17560", "Completion Authority Guard", "completion_authority_guard_rows"],
  ["P17561-P17600", "P17600 Closeout And Handoff", "p17600_closeout_rows"],
];

const INVENTORY_TERMS = ["P17200 source availability", "source chain", "activation status", "current handoff state", "blocker inventory", "required next evidence"];
const CLAUDE_EXECUTION_TERMS = ["Claude review packet id", "reviewed diff ref", "reviewed source range", "model effort max", "execution evidence ref", "no Claude final approval"];
const REVIEW_RECEIPT_TERMS = ["completion review receipt schema", "receipt status", "reviewed program range", "verdict evidence ref", "freshness state", "blocking finding count"];
const FINDING_TERMS = ["finding ledger ref", "P0/P1 closure", "P2/P3 defer decision", "fix verification ref", "re-review trigger", "no auto close"];
const REVALIDATION_TERMS = ["targeted validation receipt", "adjacent regression receipt", "full npm test decision", "command log ref", "validation timestamp", "stale validation blocker"];
const HANDOFF_TERMS = ["source ready", "review ready", "finding ready", "validation ready", "authority ready", "handoff blocker"];
const BLOCKER_TERMS = ["source blocker", "receipt blocker", "finding blocker", "validation blocker", "authority blocker", "next evidence action"];
const OPERATOR_TERMS = ["read-only completion dashboard row", "blocker rollup", "evidence rollup", "review rollup", "handoff rollup", "no mutation"];
const AUTHORITY_TERMS = ["no deployment", "no release approval", "no production PASS", "no enterprise PASS", "no review bypass", "no final automated approval"];
const CLOSEOUT_TERMS = ["completion closeout id", "committed source ref", "review receipt state", "finding loop state", "validation command list", "blocked handoff note"];

export async function runFreezeEvidenceCompletion(options = {}) {
  const result = await buildFreezeEvidenceCompletion(options);
  if (options.write !== false) await writeFreezeEvidenceCompletion(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Freeze Evidence Completion failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFreezeEvidenceCompletion(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FREEZE_EVIDENCE_COMPLETION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "freezeEvidenceActivation")
    ? normalizeInlineJsonSource("inline.freeze_evidence_activation", options.freezeEvidenceActivation)
    : await readJsonOrBuildP17200(inputs.source_freeze_evidence_activation_path, generatedAt);
  const claudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudeCompletionReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_completion_review_receipt", options.claudeCompletionReviewReceipt)
    : await readJsonSource(inputs.claude_completion_review_receipt_path);
  const revalidationReceipt = Object.prototype.hasOwnProperty.call(options, "revalidationReceipt")
    ? normalizeInlineJsonSource("inline.revalidation_receipt", options.revalidationReceipt)
    : await readJsonSource(inputs.revalidation_receipt_path);

  const sourceState = buildSourceState(source);
  const reviewState = buildReviewState(claudeReceipt);
  const revalidationState = buildRevalidationState(revalidationReceipt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const inventoryRows = buildInventoryRows(roadmapDoc.text, source, sourceState, generatedAt);
  const executionRows = buildTermRows("claude_review_execution", "Claude review execution", CLAUDE_EXECUTION_TERMS, roadmapDoc.text, "claude_review_execution_rows", generatedAt, claudeExecutionExtras);
  const reviewRows = buildReviewReceiptRows(roadmapDoc.text, claudeReceipt, reviewState, generatedAt);
  const findingRows = buildFindingRows(roadmapDoc.text, reviewState, generatedAt);
  const revalidationRows = buildRevalidationRows(roadmapDoc.text, revalidationReceipt, revalidationState, generatedAt);
  const handoffRows = buildHandoffRows(sourceState, reviewState, revalidationState, generatedAt);
  const blockerRows = buildBlockerRows(roadmapDoc.text, sourceState, reviewState, revalidationState, generatedAt);
  const operatorRows = buildTermRows("completion_operator_projection", "Completion operator projection", OPERATOR_TERMS, roadmapDoc.text, "completion_operator_projection_rows", generatedAt, operatorExtras);
  const authorityRows = buildTermRows("completion_authority_guard", "Completion authority guard", AUTHORITY_TERMS, roadmapDoc.text, "completion_authority_guard_rows", generatedAt, authorityExtras);
  const closeoutRows = buildCloseoutRows(roadmapDoc.text, sourceState, reviewState, revalidationState, generatedAt);
  const boundary = buildBoundary({ sourceState, reviewState, revalidationState, inventoryRows, executionRows, reviewRows, findingRows, revalidationRows, handoffRows, blockerRows, operatorRows, authorityRows, closeoutRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, inventoryRows, executionRows, reviewRows, findingRows, revalidationRows, handoffRows, blockerRows, operatorRows, authorityRows, closeoutRows, boundary });
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
      freeze_evidence_activation_path: source.path,
      claude_completion_review_receipt_path: claudeReceipt.path,
      revalidation_receipt_path: revalidationReceipt.path,
    },
    source_freeze_evidence_activation_summary: source.data?.summary ?? null,
    observed_claude_completion_review_summary: claudeReceipt.data?.summary ?? null,
    observed_revalidation_summary: revalidationReceipt.data?.summary ?? null,
    freeze_completion_contract: buildContract(generatedAt),
    freeze_completion_phase_rows: phaseRows,
    freeze_completion_inventory_rows: inventoryRows,
    claude_review_execution_rows: executionRows,
    completion_review_receipt_rows: reviewRows,
    finding_remediation_rows: findingRows,
    revalidation_evidence_rows: revalidationRows,
    p17601_handoff_gate_rows: handoffRows,
    blocker_burndown_rows: blockerRows,
    completion_operator_projection_rows: operatorRows,
    completion_authority_guard_rows: authorityRows,
    p17600_closeout_rows: closeoutRows,
    freeze_completion_boundary: boundary,
    freeze_completion_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, inventoryRows, executionRows, reviewRows, findingRows, revalidationRows, handoffRows, blockerRows, operatorRows, authorityRows, closeoutRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "freeze_evidence_completion")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.freeze_completion_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.freeze_completion_validation_items);
  result.summary = buildSummary({ boundary, inventoryRows, executionRows, reviewRows, findingRows, revalidationRows, handoffRows, blockerRows, operatorRows, authorityRows, closeoutRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeFreezeEvidenceCompletion(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "freeze-evidence-completion.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-completion-phase-rows.json"), collectionEnvelope("freeze-completion-phase-rows.v1", "freeze_completion_phase_rows", result.freeze_completion_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-completion-inventory-rows.json"), collectionEnvelope("freeze-completion-inventory-rows.v1", "freeze_completion_inventory_rows", result.freeze_completion_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-review-execution-rows.json"), collectionEnvelope("claude-review-execution-rows.v1", "claude_review_execution_rows", result.claude_review_execution_rows, result.generated_at));
  await writeJson(path.join(outDir, "completion-review-receipt-rows.json"), collectionEnvelope("completion-review-receipt-rows.v1", "completion_review_receipt_rows", result.completion_review_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-remediation-rows.json"), collectionEnvelope("finding-remediation-rows.v1", "finding_remediation_rows", result.finding_remediation_rows, result.generated_at));
  await writeJson(path.join(outDir, "revalidation-evidence-rows.json"), collectionEnvelope("revalidation-evidence-rows.v1", "revalidation_evidence_rows", result.revalidation_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "p17601-handoff-gate-rows.json"), collectionEnvelope("p17601-handoff-gate-rows.v1", "p17601_handoff_gate_rows", result.p17601_handoff_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocker-burndown-rows.json"), collectionEnvelope("blocker-burndown-rows.v1", "blocker_burndown_rows", result.blocker_burndown_rows, result.generated_at));
  await writeJson(path.join(outDir, "completion-operator-projection-rows.json"), collectionEnvelope("completion-operator-projection-rows.v1", "completion_operator_projection_rows", result.completion_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "completion-authority-guard-rows.json"), collectionEnvelope("completion-authority-guard-rows.v1", "completion_authority_guard_rows", result.completion_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p17600-closeout-rows.json"), collectionEnvelope("p17600-closeout-rows.v1", "p17600_closeout_rows", result.p17600_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-completion-boundary.json"), result.freeze_completion_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "freeze-evidence-completion-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.freeze_completion_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runFreezeEvidenceCompletionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runFreezeEvidenceCompletion(args);
    console.log(`Freeze Evidence Completion ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.freeze_evidence_completion_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`P17200 ready for P17201 handoff: ${result.summary.source_p17200_ready_for_p17201_handoff}`);
    console.log(`Claude completion review receipt present: ${result.summary.claude_completion_review_receipt_present_now}`);
    console.log(`Revalidation receipt present: ${result.summary.revalidation_receipt_present_now}`);
    console.log(`Unresolved findings: ${result.summary.unresolved_finding_count}`);
    console.log(`Blocking findings: ${result.summary.blocking_finding_count}`);
    console.log(`Ready for P17601 handoff: ${result.summary.ready_for_p17601_handoff}`);
    console.log(`Deployment allowed: ${result.summary.deployment_allowed_now}`);
    console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
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
    contract_id: "freeze-evidence-completion.contract.v1",
    generated_at: generatedAt,
    source_p17200_required: true,
    claude_completion_review_required: true,
    finding_remediation_required: true,
    revalidation_receipt_required: true,
    p17601_handoff_gate_required: true,
    blocker_burndown_required: true,
    operator_projection_required: true,
    authority_guard_required: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
  };
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.freeze_activation_boundary ?? {};
  const sourceStatus = summary.freeze_evidence_activation_status ?? "missing";
  const sourceReady = summary.ready_for_p17201_handoff === true;
  const statusVisible = sourceStatus === "ready_for_freeze_evidence_activation" || sourceStatus === "blocked_freeze_evidence_activation";
  const boundaryClosed = boundary.deployment_allowed_now === false
    && boundary.release_approval_allowed_now === false
    && boundary.production_pass_enabled === false
    && boundary.enterprise_pass_enabled === false
    && boundary.enterprise_trust_claim_allowed_now === false
    && boundary.protected_closeout_enabled === false
    && boundary.human_gate_bypass_allowed_now === false
    && boundary.independent_review_bypass_allowed_now === false
    && boundary.single_owner_enterprise_trust_allowed_now === false
    && boundary.environment_config_write_allowed_now === false
    && boundary.migration_execution_allowed_now === false
    && boundary.rollback_execution_allowed_now === false
    && boundary.runtime_execution_allowed_now === false
    && boundary.write_action_allowed_now === false
    && boundary.protected_action_allowed_now === false
    && boundary.connector_write_enabled === false
    && boundary.external_service_mutation_allowed_now === false
    && boundary.secret_read_allowed_now === false
    && boundary.raw_source_exposure_allowed === false
    && boundary.reviewer_mutation_allowed_now === false
    && boundary.codex_final_approval_ui_enabled === false
    && boundary.claude_final_approval_ui_enabled === false;
  const rowCountsReady = Number(summary.freeze_evidence_packet_row_count ?? 0) >= 6
    && Number(summary.claude_review_receipt_intake_row_count ?? 0) >= 6
    && Number(summary.finding_loop_row_count ?? 0) >= 6
    && Number(summary.evidence_gap_projection_row_count ?? 0) >= 6
    && Number(summary.post_p16800_handoff_recheck_row_count ?? 0) >= 6
    && Number(summary.activation_operator_projection_row_count ?? 0) >= 6
    && Number(summary.activation_authority_guard_row_count ?? 0) >= 6
    && Number(summary.activation_closeout_packet_row_count ?? 0) >= 6;
  const validSource = source.available === true
    && source.data?.program_range === SOURCE_PROGRAM_RANGE
    && source.data?.validation?.valid === true
    && statusVisible
    && rowCountsReady
    && boundaryClosed;
  const blockVisible = source.available === true && (sourceReady === false || summary.source_block_visible_now === true || summary.claude_review_receipt_block_visible_now === true || Number(summary.unresolved_finding_count ?? 0) > 0);
  return {
    sourceAvailable: source.available === true,
    summary,
    boundary,
    sourceStatus,
    sourceReady,
    statusVisible,
    rowCountsReady,
    boundaryClosed,
    validSource,
    blockVisible,
  };
}

function buildReviewState(receipt) {
  const unresolvedFindingCount = Number(receipt.data?.unresolved_finding_count ?? receipt.data?.summary?.unresolved_finding_count ?? 0);
  const blockingFindingCount = Number(receipt.data?.blocking_finding_count ?? receipt.data?.summary?.blocking_finding_count ?? unresolvedFindingCount);
  const receiptObserved = receipt.available === true
    && receipt.data?.review_engine === "claude_code_opus_max"
    && receipt.data?.model_effort === "max"
    && receipt.data?.receipt_status === "complete"
    && receipt.data?.reviewed_program_range === PROGRAM_RANGE
    && receipt.data?.reviewed_source_program_range === SOURCE_PROGRAM_RANGE
    && receipt.data?.scope_freeze_evidence_completion === true;
  const present = receiptObserved
    && unresolvedFindingCount === 0
    && blockingFindingCount === 0;
  return {
    present,
    receiptObserved,
    unresolvedFindingCount,
    blockingFindingCount,
    receiptStatus: receipt.data?.receipt_status ?? "missing",
    reviewedProgramRange: receipt.data?.reviewed_program_range ?? null,
  };
}

function buildRevalidationState(receipt) {
  const commands = Array.isArray(receipt.data?.commands_run) ? receipt.data.commands_run : [];
  const requiredCommands = [
    "platform:p16800-platform-freeze",
    "platform:freeze-evidence-activation",
    "platform:freeze-evidence-completion",
    "node --test",
    "git diff --check",
  ];
  const commandsReady = requiredCommands.every((command) => commands.some((observed) => String(observed).includes(command)));
  const present = receipt.available === true
    && receipt.data?.receipt_status === "complete"
    && receipt.data?.validation_status === "pass"
    && receipt.data?.program_range === PROGRAM_RANGE
    && receipt.data?.source_program_range === SOURCE_PROGRAM_RANGE
    && receipt.data?.stale_validation === false
    && commandsReady;
  return {
    present,
    commandsReady,
    receiptStatus: receipt.data?.receipt_status ?? "missing",
    validationStatus: receipt.data?.validation_status ?? "missing",
    staleValidation: receipt.data?.stale_validation === true,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p17201-p17600.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildInventoryRows(roadmapText, source, sourceState, generatedAt) {
  const states = new Map([
    ["P17200 source availability", source.available],
    ["source chain", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["activation status", sourceState.statusVisible],
    ["current handoff state", sourceState.sourceReady],
    ["blocker inventory", sourceState.sourceReady || sourceState.blockVisible],
    ["required next evidence", includesText(roadmapText, "required next evidence")],
  ]);
  return INVENTORY_TERMS.map((term) => verdictRow({
    row_id: `freeze_completion_inventory.${slug(term)}`,
    category: "freeze_completion_inventory",
    label: `Freeze evidence inventory: ${term}`,
    required: true,
    observed: states.get(term) ?? includesText(roadmapText, term),
    evidence_ref: source.path,
    generated_at: generatedAt,
    output_ref: "freeze_completion_inventory_rows",
    term_id: slug(term),
    source_status: sourceState.sourceStatus,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17201-p17600.md#freeze-evidence-completion-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildReviewReceiptRows(roadmapText, receipt, reviewState, generatedAt) {
  return REVIEW_RECEIPT_TERMS.map((term) => {
    const isReceiptStateTerm = term === "receipt status" || term === "reviewed program range" || term === "verdict evidence ref" || term === "freshness state" || term === "blocking finding count";
    return verdictRow({
      row_id: `completion_review_receipt.${slug(term)}`,
      category: "completion_review_receipt",
      label: `Completion review receipt: ${term}`,
      required: true,
      observed: isReceiptStateTerm ? reviewState.present : includesText(roadmapText, term),
      evidence_ref: reviewState.present ? receipt.path : "docs/hermes-roadmap-p17201-p17600.md#P17281-P17320",
      generated_at: generatedAt,
      output_ref: "completion_review_receipt_rows",
      term_id: slug(term),
      claude_completion_review_receipt_present_now: reviewState.present,
      claude_final_approval_allowed: false,
    });
  });
}

function buildFindingRows(roadmapText, reviewState, generatedAt) {
  return FINDING_TERMS.map((term) => {
    const observed = term === "P0/P1 closure"
      ? reviewState.present && reviewState.blockingFindingCount === 0
      : term === "P2/P3 defer decision"
        ? reviewState.present && reviewState.unresolvedFindingCount === 0
        : includesText(roadmapText, term);
    return verdictRow({
      row_id: `finding_remediation.${slug(term)}`,
      category: "finding_remediation",
      label: `Finding remediation: ${term}`,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p17201-p17600.md#P17321-P17360",
      generated_at: generatedAt,
      output_ref: "finding_remediation_rows",
      term_id: slug(term),
      unresolved_finding_count: reviewState.unresolvedFindingCount,
      blocking_finding_count: reviewState.blockingFindingCount,
      finding_auto_close_allowed_now: false,
    });
  });
}

function buildRevalidationRows(roadmapText, receipt, revalidationState, generatedAt) {
  return REVALIDATION_TERMS.map((term) => {
    const isReceiptStateTerm = term === "targeted validation receipt" || term === "adjacent regression receipt" || term === "command log ref" || term === "validation timestamp" || term === "stale validation blocker";
    const observed = term === "full npm test decision"
      ? includesText(roadmapText, term)
      : isReceiptStateTerm
        ? revalidationState.present
        : includesText(roadmapText, term);
    return verdictRow({
      row_id: `revalidation_evidence.${slug(term)}`,
      category: "revalidation_evidence",
      label: `Revalidation evidence: ${term}`,
      required: true,
      observed,
      evidence_ref: revalidationState.present ? receipt.path : "docs/hermes-roadmap-p17201-p17600.md#P17361-P17400",
      generated_at: generatedAt,
      output_ref: "revalidation_evidence_rows",
      term_id: slug(term),
      revalidation_receipt_present_now: revalidationState.present,
      stale_validation: revalidationState.staleValidation,
    });
  });
}

function buildHandoffRows(sourceState, reviewState, revalidationState, generatedAt) {
  const authorityReady = sourceState.boundaryClosed;
  const findingReady = reviewState.present && reviewState.unresolvedFindingCount === 0 && reviewState.blockingFindingCount === 0;
  const sourceReady = sourceState.sourceReady && sourceState.validSource;
  const handoffReady = sourceReady && reviewState.present && findingReady && revalidationState.present && authorityReady;
  const handoffBlockVisible = sourceReady === false || reviewState.present === false || findingReady === false || revalidationState.present === false || authorityReady === false;
  const states = new Map([
    ["source ready", sourceReady],
    ["review ready", reviewState.present],
    ["finding ready", findingReady],
    ["validation ready", revalidationState.present],
    ["authority ready", authorityReady],
    ["handoff blocker", handoffReady || handoffBlockVisible],
  ]);
  return HANDOFF_TERMS.map((term) => verdictRow({
    row_id: `p17601_handoff_gate.${slug(term)}`,
    category: "p17601_handoff_gate",
    label: `P17601 handoff gate: ${term}`,
    required: true,
    observed: states.get(term),
    evidence_ref: "docs/hermes-roadmap-p17201-p17600.md#P17401-P17440",
    generated_at: generatedAt,
    output_ref: "p17601_handoff_gate_rows",
    term_id: slug(term),
  }));
}

function buildBlockerRows(roadmapText, sourceState, reviewState, revalidationState, generatedAt) {
  const states = new Map([
    ["source blocker", sourceState.sourceReady || sourceState.blockVisible],
    ["receipt blocker", true],
    ["finding blocker", true],
    ["validation blocker", true],
    ["authority blocker", sourceState.boundaryClosed],
    ["next evidence action", includesText(roadmapText, "next evidence action")],
  ]);
  return BLOCKER_TERMS.map((term) => verdictRow({
    row_id: `blocker_burndown.${slug(term)}`,
    category: "blocker_burndown",
    label: `Blocker burn-down: ${term}`,
    required: true,
    observed: states.get(term) ?? includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17201-p17600.md#P17441-P17480",
    generated_at: generatedAt,
    output_ref: "blocker_burndown_rows",
    term_id: slug(term),
  }));
}

function buildCloseoutRows(roadmapText, sourceState, reviewState, revalidationState, generatedAt) {
  return CLOSEOUT_TERMS.map((term) => {
    const isStateTerm = term === "review receipt state" || term === "finding loop state" || term === "validation command list" || term === "blocked handoff note";
    const observed = isStateTerm
      ? (sourceState.sourceReady || sourceState.blockVisible)
      : includesText(roadmapText, term);
    return verdictRow({
      row_id: `p17600_closeout.${slug(term)}`,
      category: "p17600_closeout",
      label: `P17600 closeout: ${term}`,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p17201-p17600.md#P17561-P17600",
      generated_at: generatedAt,
      output_ref: "p17600_closeout_rows",
      term_id: slug(term),
      production_pass_enabled: false,
      protected_closeout_enabled: false,
    });
  });
}

function buildBoundary(context) {
  const findingReady = context.reviewState.present && context.reviewState.unresolvedFindingCount === 0 && context.reviewState.blockingFindingCount === 0;
  const handoffGateReady = allPass(context.handoffRows);
  const ready = context.sourceState.sourceReady
    && context.sourceState.validSource
    && context.reviewState.present
    && findingReady
    && context.revalidationState.present
    && handoffGateReady
    && allPass(context.blockerRows)
    && allPass(context.operatorRows)
    && allPass(context.authorityRows)
    && allPass(context.closeoutRows);
  return {
    source_p17200_available: context.sourceState.sourceAvailable,
    source_p17200_ready_for_p17201_handoff: context.sourceState.sourceReady,
    source_block_visible_now: context.sourceState.blockVisible && context.sourceState.sourceReady === false,
    claude_completion_review_receipt_observed_now: context.reviewState.receiptObserved,
    claude_completion_review_receipt_present_now: context.reviewState.present,
    claude_completion_review_block_visible_now: context.reviewState.present === false,
    finding_remediation_ready: findingReady,
    unresolved_finding_count: context.reviewState.unresolvedFindingCount,
    blocking_finding_count: context.reviewState.blockingFindingCount,
    revalidation_receipt_present_now: context.revalidationState.present,
    revalidation_block_visible_now: context.revalidationState.present === false,
    p17601_handoff_gate_ready: handoffGateReady,
    blocker_burndown_ready: allPass(context.blockerRows),
    completion_operator_projection_ready: allPass(context.operatorRows),
    completion_authority_guard_ready: allPass(context.authorityRows),
    p17600_closeout_ready: allPass(context.closeoutRows),
    ready_for_p17601_handoff: ready,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    reviewer_mutation_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P17201-P17600 phase rows incomplete", "docs/hermes-roadmap-p17201-p17600.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P17201-P17600"), "Architecture doc missing P17201-P17600 reference", "docs/architecture.md");
  add("source.available", "source", rowPass(context.inventoryRows, "freeze_completion_inventory.p17200_source_availability"), "P17200 source artifact is required", "freeze_completion_inventory_rows");
  add("source.state.visible", "source", rowPass(context.inventoryRows, "freeze_completion_inventory.source_chain") && rowPass(context.inventoryRows, "freeze_completion_inventory.activation_status") && rowPass(context.inventoryRows, "freeze_completion_inventory.blocker_inventory"), "P17200 source chain/status/blocker must be visible", "freeze_completion_inventory_rows");
  add("claude.execution.plan", "review", context.executionRows.length === CLAUDE_EXECUTION_TERMS.length && allPass(context.executionRows), "Claude review execution rows incomplete", "claude_review_execution_rows");
  add("claude.receipt.block.visible", "review", context.reviewRows.length === REVIEW_RECEIPT_TERMS.length && (context.boundary.claude_completion_review_receipt_present_now === true || context.boundary.claude_completion_review_block_visible_now === true), "Claude completion receipt missing without visible blocker", "completion_review_receipt_rows");
  add("finding.loop.visible", "finding", context.findingRows.length === FINDING_TERMS.length && (context.boundary.finding_remediation_ready === true || context.boundary.claude_completion_review_block_visible_now === true || context.boundary.unresolved_finding_count > 0 || context.boundary.blocking_finding_count > 0), "Finding remediation missing without visible blocker", "finding_remediation_rows");
  add("revalidation.block.visible", "validation", context.revalidationRows.length === REVALIDATION_TERMS.length && (context.boundary.revalidation_receipt_present_now === true || context.boundary.revalidation_block_visible_now === true), "Revalidation receipt missing without visible blocker", "revalidation_evidence_rows");
  add("handoff.gate.visible", "handoff", context.handoffRows.length === HANDOFF_TERMS.length && (context.boundary.p17601_handoff_gate_ready === true || rowPass(context.handoffRows, "p17601_handoff_gate.handoff_blocker")), "P17601 handoff gate missing blocker visibility", "p17601_handoff_gate_rows");
  add("blocker.ready", "blocker", context.blockerRows.length === BLOCKER_TERMS.length && allPass(context.blockerRows), "Blocker burn-down rows incomplete", "blocker_burndown_rows");
  add("operator.ready", "projection", context.operatorRows.length === OPERATOR_TERMS.length && allPass(context.operatorRows), "Completion operator projection rows incomplete", "completion_operator_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Completion authority guard rows incomplete", "completion_authority_guard_rows");
  add("closeout.ready", "closeout", context.closeoutRows.length === CLOSEOUT_TERMS.length && allPass(context.closeoutRows), "P17600 closeout rows incomplete", "p17600_closeout_rows");
  add("boundary.no.production.claim", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false, "Freeze completion opened production or enterprise authority", "freeze_completion_boundary");
  add("boundary.no.execution.raw.secret", "boundary", context.boundary.environment_config_write_allowed_now === false && context.boundary.migration_execution_allowed_now === false && context.boundary.rollback_execution_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_source_exposure_allowed === false, "Freeze completion opened config migration rollback runtime write connector mutation secret or raw exposure", "freeze_completion_boundary");
  add("boundary.no.final.or.bypass", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false && context.boundary.human_gate_bypass_allowed_now === false && context.boundary.independent_review_bypass_allowed_now === false && context.boundary.reviewer_mutation_allowed_now === false, "Freeze completion opened final approval or review/human bypass", "freeze_completion_boundary");
  return items;
}

function buildSummary(context) {
  return {
    freeze_evidence_completion_status: context.boundary.ready_for_p17601_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p17200_ready_for_p17201_handoff: context.boundary.source_p17200_ready_for_p17201_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    freeze_completion_inventory_row_count: context.inventoryRows.length,
    claude_review_execution_row_count: context.executionRows.length,
    completion_review_receipt_row_count: context.reviewRows.length,
    claude_completion_review_receipt_observed_now: context.boundary.claude_completion_review_receipt_observed_now,
    claude_completion_review_receipt_present_now: context.boundary.claude_completion_review_receipt_present_now,
    claude_completion_review_block_visible_now: context.boundary.claude_completion_review_block_visible_now,
    finding_remediation_row_count: context.findingRows.length,
    finding_remediation_ready: context.boundary.finding_remediation_ready,
    unresolved_finding_count: context.boundary.unresolved_finding_count,
    blocking_finding_count: context.boundary.blocking_finding_count,
    revalidation_evidence_row_count: context.revalidationRows.length,
    revalidation_receipt_present_now: context.boundary.revalidation_receipt_present_now,
    revalidation_block_visible_now: context.boundary.revalidation_block_visible_now,
    p17601_handoff_gate_row_count: context.handoffRows.length,
    p17601_handoff_gate_ready: context.boundary.p17601_handoff_gate_ready,
    blocker_burndown_row_count: context.blockerRows.length,
    completion_operator_projection_row_count: context.operatorRows.length,
    completion_authority_guard_row_count: context.authorityRows.length,
    p17600_closeout_row_count: context.closeoutRows.length,
    ready_for_p17601_handoff: context.boundary.ready_for_p17601_handoff,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Freeze Evidence Completion",
    "",
    `Status: ${result.summary.freeze_evidence_completion_status}`,
    `Program: ${result.program_range}`,
    `P17200 ready for P17201 handoff: ${result.summary.source_p17200_ready_for_p17201_handoff}`,
    `Claude completion review receipt present: ${result.summary.claude_completion_review_receipt_present_now}`,
    `Revalidation receipt present: ${result.summary.revalidation_receipt_present_now}`,
    `Unresolved findings: ${result.summary.unresolved_finding_count}`,
    `Blocking findings: ${result.summary.blocking_finding_count}`,
    `Ready for P17601 handoff: ${result.summary.ready_for_p17601_handoff}`,
    `Deployment allowed: ${result.summary.deployment_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.p17601_handoff_gate_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Freeze Evidence Completion</title>
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
    <h1>Hermes Freeze Evidence Completion</h1>
    <p class="notice">This plane records completion review, finding remediation, revalidation, blocker burn-down, and handoff status. Shipment, approvals, environment mutation, execution, writes, review bypass, raw access, and finalization stay closed.</p>
    <table><thead><tr><th>P17601 Handoff Gate</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP17200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildFreezeEvidenceActivation({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.freeze_evidence_activation", built);
}

function claudeExecutionExtras() {
  return { claude_review_required_now: true, claude_final_approval_allowed: false };
}

function operatorExtras() {
  return { read_only_projection_required: true, api_write_allowed_now: false, dashboard_mutation_allowed_now: false };
}

function authorityExtras() {
  return {
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function verdictRow(row) {
  const observed = Boolean(row.observed);
  return {
    ...row,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${row.label} is missing or not ready.`,
  };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function allPass(rows) {
  return rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
}

function includesAll(text, terms) {
  return terms.every((term) => includesText(text, term));
}

function includesText(text, term) {
  return String(text ?? "").toLowerCase().includes(String(term).toLowerCase());
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const data = JSON.parse(await readFile(resolved, "utf8"));
    return { path: resolved, available: true, data };
  } catch (error) {
    return { path: resolved, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { path: resolved, available: true, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, data: value };
  return { path: label, available: false, data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_FREEZE_EVIDENCE_COMPLETION_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? defaults.architectureDocPath),
    source_freeze_evidence_activation_path: path.resolve(options.sourceFreezeEvidenceActivationPath ?? defaults.sourceFreezeEvidenceActivationPath),
    claude_completion_review_receipt_path: path.resolve(options.claudeCompletionReviewReceiptPath ?? defaults.claudeCompletionReviewReceiptPath),
    revalidation_receipt_path: path.resolve(options.revalidationReceiptPath ?? defaults.revalidationReceiptPath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--source") {
      args.sourceFreezeEvidenceActivationPath = argv[index + 1];
      index += 1;
    } else if (arg === "--claude-receipt") {
      args.claudeCompletionReviewReceiptPath = argv[index + 1];
      index += 1;
    } else if (arg === "--revalidation-receipt") {
      args.revalidationReceiptPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--claude-receipt FILE] [--revalidation-receipt FILE]`);
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, html, ...serializable } = result;
  return serializable;
}

function slug(term) {
  return String(term)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
