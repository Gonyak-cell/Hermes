import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryG1aOwnerCandidateSelectionDocket } from "./factory-g1a-owner-candidate-selection-docket.mjs";
import { buildFactoryG1aOwnerSigningHandoff } from "./factory-g1a-owner-signing-handoff.mjs";
import { buildFactoryPromotionCloseoutReadiness } from "./factory-promotion-closeout-readiness.mjs";

export const DEFAULT_FACTORY_G1A_OWNER_ACTION_PACKET_OUT_DIR = "artifacts/factory-g1a-owner-action-packet/latest";
export const DEFAULT_FACTORY_G1A_OWNER_ACTION_PACKET_INPUTS = {
  packagePath: "package.json",
};

const COMMAND_NAME = "factory:g1a-owner-action-packet";
const SCHEMA_VERSION = "factory-g1a-owner-action-packet.v1";
const CAPABILITY_ID = "factory.g1a_owner_action_packet";
const PROGRAM_RANGE = "G-SERIES.1a.owner-action-packet";
const READY_STATUS = "ready_g1a_owner_action_packet";
const BLOCKED_STATUS = "blocked_g1a_owner_action_packet";
const HASH_RE = /^[a-f0-9]{64}$/;
const ACCEPTED_PROMOTION_CLOSEOUT_STATUSES = new Set([
  "waiting_for_g1a_owner_gate_opening_chain",
  "ready_for_human_owner_protected_closeout",
]);

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
  verifier_finality_allowed_now: false,
  codex_final_approval_allowed_now: false,
  claude_final_approval_allowed_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
  gate_opening_allowed_now: false,
  g1a_project_creation_gate_open_now: false,
  g1b_repo_write_gate_open_now: false,
  g2_command_execution_gate_open_now: false,
  g3_deployment_gate_open_now: false,
  factory_promotion_goal_complete_allowed_now: false,
};

export async function runFactoryG1aOwnerActionPacket(options = {}) {
  const result = await buildFactoryG1aOwnerActionPacket(options);
  if (!options.check && options.write !== false) await writeFactoryG1aOwnerActionPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Owner Action Packet failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_owner_action_packet_status !== READY_STATUS) {
    const error = new Error("Factory G1a Owner Action Packet is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aOwnerActionPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_OWNER_ACTION_PACKET_OUT_DIR);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const inputs = normalizeInputs(options, repoRoot);
  const packageJson = await readJsonSource(inputs.package_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(repoRoot);
  const sharedOptions = {
    ...options,
    repoRoot,
    runAt: generatedAt,
    commitRef,
    write: false,
  };
  const candidateSelectionDocket = Object.prototype.hasOwnProperty.call(options, "candidateSelectionDocket")
    ? options.candidateSelectionDocket
    : await buildFactoryG1aOwnerCandidateSelectionDocket({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-candidate-selection-docket"),
    });
  const ownerSigningHandoff = Object.prototype.hasOwnProperty.call(options, "ownerSigningHandoff")
    ? options.ownerSigningHandoff
    : await buildFactoryG1aOwnerSigningHandoff({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-owner-signing-handoff"),
      boundCandidatePacketSha256: selectedCandidatePacketSha(candidateSelectionDocket) ?? undefined,
      boundCandidateManifestSha256: selectedCandidateManifestSha(candidateSelectionDocket) ?? undefined,
    });
  const promotionCloseoutReadiness = Object.prototype.hasOwnProperty.call(options, "promotionCloseoutReadiness")
    ? options.promotionCloseoutReadiness
    : await buildFactoryPromotionCloseoutReadiness({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-promotion-closeout-readiness"),
      g1aCandidateSelectionDocket: candidateSelectionDocket,
      g1aOwnerSigningHandoff: ownerSigningHandoff,
    });

  const candidateCards = buildCandidateActionCards({ candidateSelectionDocket, generatedAt });
  const ownerActionRows = buildOwnerActionRows({
    candidateSelectionDocket,
    ownerSigningHandoff,
    promotionCloseoutReadiness,
    candidateCards,
    generatedAt,
  });
  const ownerWorkOrder = buildOwnerWorkOrder({
    candidateSelectionDocket,
    ownerSigningHandoff,
    promotionCloseoutReadiness,
    candidateCards,
    ownerActionRows,
    generatedAt,
  });
  const boundary = buildBoundary({ candidateCards, ownerActionRows, ownerWorkOrder, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    candidateSelectionDocket,
    ownerSigningHandoff,
    promotionCloseoutReadiness,
    candidateCards,
    ownerActionRows,
    ownerWorkOrder,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ candidateCards, ownerActionRows, ownerWorkOrder, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      candidate_selection_docket_ref: "built.factory_g1a_owner_candidate_selection_docket",
      owner_signing_handoff_ref: "built.factory_g1a_owner_signing_handoff",
      promotion_closeout_readiness_ref: "built.factory_promotion_closeout_readiness",
    },
    source_summaries: {
      candidate_selection_status: candidateSelectionDocket.summary?.factory_g1a_owner_candidate_selection_docket_status ?? null,
      owner_signing_handoff_status: ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status ?? null,
      promotion_closeout_status: promotionCloseoutReadiness.summary?.factory_promotion_closeout_readiness_status ?? null,
      promotion_closeout_waiting_blocker_ids: promotionCloseoutReadiness.summary?.waiting_blocker_ids ?? [],
    },
    owner_candidate_action_cards: candidateCards,
    owner_action_rows: ownerActionRows,
    owner_work_order: ownerWorkOrder,
    factory_g1a_owner_action_packet_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryG1aOwnerActionPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-owner-action-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "owner-candidate-action-cards.json"), collectionEnvelope("factory-g1a-owner-candidate-action-cards.v1", "owner_candidate_action_cards", result.owner_candidate_action_cards, result.generated_at));
  await writeJson(path.join(outDir, "owner-action-rows.json"), collectionEnvelope("factory-g1a-owner-action-rows.v1", "owner_action_rows", result.owner_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "owner-work-order.json"), result.owner_work_order);
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_owner_action_packet_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-owner-action-packet-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aOwnerActionPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aOwnerActionPacket(args);
    console.log(`Factory G1a Owner Action Packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_owner_action_packet_status}`);
    console.log(`Candidate cards: ${result.summary.owner_candidate_card_count}`);
    console.log(`Action rows pass/wait/fail: ${result.summary.owner_action_pass_count}/${result.summary.owner_action_wait_count}/${result.summary.owner_action_fail_count}`);
    console.log(`First required owner action: ${result.summary.first_required_owner_action}`);
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

function buildCandidateActionCards({ candidateSelectionDocket, generatedAt }) {
  return (candidateSelectionDocket.g1a_owner_candidate_selection_rows ?? []).map((row, index) => {
    const selectedNow = row.selected_now === true;
    const card = {
      schema_version: "factory-g1a-owner-candidate-action-card.v1",
      card_id: `g1a.owner-action-card.${normalizeKey(row.product_id)}.${index + 1}`,
      selection_row_id: row.selection_row_id,
      product_id: row.product_id,
      candidate_packet_id: row.candidate_packet_id,
      candidate_manifest_id: row.candidate_manifest_id,
      candidate_packet_sha256: row.candidate_packet_sha256,
      candidate_manifest_sha256: row.candidate_manifest_sha256,
      eligibility_status: row.eligibility_status,
      eligible_for_owner_selection_now: row.eligible_for_owner_selection_now === true,
      selected_now: selectedNow,
      owner_selection_card_status: row.eligible_for_owner_selection_now === true ? "available_for_owner_selection" : "blocked_not_eligible",
      bind_hash_kind: "candidate_packet_sha256",
      bind_hash_value: row.candidate_packet_sha256,
      prebind_packet_command: row.owner_prebind_packet_command,
      prebind_manifest_command: row.owner_prebind_manifest_command,
      selection_is_not_signature: true,
      card_selects_by_default: false,
      card_signs_owner_receipt_now: false,
      card_opens_gate_now: false,
      card_mutates_source_now: false,
      next_owner_action_if_selected: selectedNow ? "review_signable_owner_receipt_draft_and_sign_manually" : "choose_this_candidate_hash_explicitly_if_owner_intends_to_open_g1a",
      ...CLOSED_AUTHORITY_FLAGS,
      generated_at: generatedAt,
    };
    return { ...card, card_sha256: sha256(canonicalize(card)) };
  });
}

function buildOwnerActionRows({
  candidateSelectionDocket,
  ownerSigningHandoff,
  promotionCloseoutReadiness,
  candidateCards,
  generatedAt,
}) {
  const selected = candidateSelectionDocket.summary?.selected_candidate_now === true
    && candidateSelectionDocket.summary?.candidate_hash_bound_now === true;
  const handoffReady = ownerSigningHandoff.validation?.valid === true
    && ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status === "ready_g1a_owner_signature_handoff";
  const ownerSigned = ownerSigningHandoff.summary?.owner_gate_opening_receipt_signed_now === true;
  const sourceCommitApplied = promotionCloseoutRowPassed(promotionCloseoutReadiness, "g1a.source_literal_commit_applied");
  const firstUseAuditPresent = promotionCloseoutRowPassed(promotionCloseoutReadiness, "g1a.first_use_audit_present");
  const closeoutReady = promotionCloseoutRowPassed(promotionCloseoutReadiness, "g1a.opening_closeout_ready")
    && promotionCloseoutReadiness.summary?.ready_for_human_owner_protected_closeout === true
    && promotionCloseoutReadiness.summary?.g1a_owner_gate_opening_chain_ready === true;
  return [
    ownerActionRow("owner.choose_candidate_hash", "owner_selection", selected ? "pass" : "wait", "Owner chooses exactly one eligible candidate packet hash", firstCandidateAction(candidateCards), generatedAt),
    ownerActionRow("owner.run_prebind_check", "owner_selection", selected && handoffReady ? "pass" : "wait", "Owner runs the selected hash prebind check command", selected ? "prebind command can be re-run with selected hash" : "select a candidate card first", generatedAt),
    ownerActionRow("owner.sign_gate_opening_receipt", "owner_signature", ownerSigned ? "pass" : "wait", "Owner signs the gate_opening receipt manually after candidate hash binding", "no signature performed by this command", generatedAt),
    ownerActionRow("codex.validate_signed_receipt", "receipt_intake", ownerSigned ? "pass" : "wait", "Codex validates the signed owner receipt with owner receipt intake", "waiting for signed receipt path", generatedAt),
    ownerActionRow("codex.prepare_source_literal_commit", "source_literal", ownerSigned ? "pass" : "wait", "Codex prepares isolated source-literal opening commit draft after signed receipt", "waiting for signed receipt", generatedAt),
    ownerActionRow("codex.apply_source_literal_commit", "source_literal", sourceCommitApplied ? "pass" : "wait", "Codex applies the isolated source-literal opening commit only after signed receipt and review", "not applied by this command", generatedAt),
    ownerActionRow("codex.capture_first_use_audit", "first_use_audit", firstUseAuditPresent ? "pass" : "wait", "Codex captures the first G1a workspace creation audit after the gate is opened", "not captured by this command", generatedAt),
    ownerActionRow("owner.protected_closeout_adjudication", "protected_closeout", closeoutReady ? "pass" : "wait", "Human owner performs protected closeout after the full G1a chain is complete", "Factory Promotion closeout remains waiting", generatedAt),
  ];
}

function ownerActionRow(rowId, category, currentVerdict, message, nextAction, generatedAt) {
  const row = {
    schema_version: "factory-g1a-owner-action-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    next_action: nextAction,
    action_performed_by_this_command: false,
    owner_signature_performed_by_this_command: false,
    source_mutation_performed_by_this_command: false,
    gate_opened_by_this_command: false,
    ...CLOSED_AUTHORITY_FLAGS,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function buildOwnerWorkOrder({
  candidateSelectionDocket,
  ownerSigningHandoff,
  promotionCloseoutReadiness,
  candidateCards,
  ownerActionRows,
  generatedAt,
}) {
  const firstWait = ownerActionRows.find((row) => row.current_verdict === "wait");
  const sourceLiteralApplied = ownerActionRows.some((row) => row.row_id === "codex.apply_source_literal_commit" && row.current_verdict === "pass");
  const firstUseAuditPresent = ownerActionRows.some((row) => row.row_id === "codex.capture_first_use_audit" && row.current_verdict === "pass");
  const workOrder = {
    schema_version: "factory-g1a-owner-work-order.v1",
    work_order_id: "g1a.owner-action-packet.current",
    generated_at: generatedAt,
    work_order_status: "ready_for_owner_review_not_signed",
    owner_selection_required_now: candidateSelectionDocket.summary?.owner_selection_required_now === true,
    owner_signature_required_now: ownerSigningHandoff.summary?.owner_gate_opening_receipt_signed_now !== true,
    first_required_owner_action: firstWait?.row_id ?? null,
    owner_candidate_card_count: candidateCards.length,
    eligible_candidate_count: candidateCards.filter((card) => card.eligible_for_owner_selection_now).length,
    selected_candidate_now: candidateSelectionDocket.summary?.selected_candidate_now === true,
    candidate_hash_bound_now: candidateSelectionDocket.summary?.candidate_hash_bound_now === true,
    signable_owner_receipt_draft_ref: ownerSigningHandoff.source_refs?.signable_owner_receipt_draft_path ?? "artifacts/factory-g1a-owner-signing-handoff/latest/signable-owner-receipt-draft.json",
    signable_owner_receipt_draft_ref_kind: "logical_source_ref_not_materialized_by_this_command",
    signable_owner_receipt_draft_materialized_by_command: "npm run factory:g1a-owner-signing-handoff",
    promotion_closeout_status: promotionCloseoutReadiness.summary?.factory_promotion_closeout_readiness_status ?? null,
    promotion_waiting_blocker_ids: promotionCloseoutReadiness.summary?.waiting_blocker_ids ?? [],
    owner_action_summary: ownerActionRows.map((row) => ({
      row_id: row.row_id,
      current_verdict: row.current_verdict,
      next_action: row.next_action,
    })),
    command_to_refresh_packet: "npm run factory:g1a-owner-action-packet -- --check",
    command_to_view_candidates: "npm run factory:g1a-owner-candidate-selection-docket -- --check --require-pass",
    command_to_prebind_after_owner_selection: "npm run factory:g1a-owner-signing-handoff -- --bound-candidate-packet-sha256 <owner-selected-candidate-packet-sha256> --check --require-pass",
    command_to_validate_signed_receipt: "npm run factory:g1a-owner-receipt-intake -- --owner-receipt-path <signed-owner-receipt.json> --check --require-pass",
    command_to_prepare_source_literal_commit: "npm run factory:g1a-source-literal-commit-draft -- --owner-receipt-path <signed-owner-receipt.json> --check",
    ...CLOSED_AUTHORITY_FLAGS,
    signs_owner_receipt_now: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: sourceLiteralApplied,
    first_use_audit_present: firstUseAuditPresent,
  };
  return { ...workOrder, work_order_sha256: sha256(canonicalize(workOrder)) };
}

function buildBoundary({ candidateCards, ownerActionRows, ownerWorkOrder, generatedAt }) {
  const passCount = ownerActionRows.filter((row) => row.current_verdict === "pass").length;
  const waitCount = ownerActionRows.filter((row) => row.current_verdict === "wait").length;
  const failCount = ownerActionRows.filter((row) => row.current_verdict === "fail").length;
  return {
    schema_version: "factory-g1a-owner-action-packet-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    owner_action_packet_only: true,
    candidate_card_count: candidateCards.length,
    owner_action_pass_count: passCount,
    owner_action_wait_count: waitCount,
    owner_action_fail_count: failCount,
    owner_selection_required_now: ownerWorkOrder.owner_selection_required_now,
    owner_signature_required_now: ownerWorkOrder.owner_signature_required_now,
    signs_owner_receipt_now: false,
    selects_candidate_by_default_now: false,
    source_literal_opening_commit_applied_now: ownerWorkOrder.source_literal_opening_commit_applied_now,
    first_use_audit_present: ownerWorkOrder.first_use_audit_present,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({
  packageJson,
  candidateSelectionDocket,
  ownerSigningHandoff,
  promotionCloseoutReadiness,
  candidateCards,
  ownerActionRows,
  ownerWorkOrder,
  boundary,
}) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script_registered", "package", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-owner-action-packet.mjs"), "package.json does not register factory:g1a-owner-action-packet"),
    validationItem("source.candidate_selection_ready", "source", candidateSelectionDocket.validation?.valid === true && candidateSelectionDocket.summary?.factory_g1a_owner_candidate_selection_docket_status === "ready_g1a_owner_candidate_selection_docket", "Candidate selection docket is not ready"),
    validationItem("source.owner_signing_handoff_ready", "source", ownerSigningHandoff.validation?.valid === true && ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status === "ready_g1a_owner_signature_handoff", "Owner signing handoff is not ready"),
    validationItem("source.promotion_closeout_ready", "source", promotionCloseoutReadiness.validation?.valid === true && ACCEPTED_PROMOTION_CLOSEOUT_STATUSES.has(promotionCloseoutReadiness.summary?.factory_promotion_closeout_readiness_status), "Promotion closeout readiness must be valid and either waiting on G1a owner chain or ready for protected owner closeout"),
    validationItem("cards.present", "candidate_cards", candidateCards.length >= 3, "At least three owner candidate action cards are expected"),
    validationItem("cards.no_default_selection", "candidate_cards", candidateCards.every((card) => card.card_selects_by_default === false && card.card_signs_owner_receipt_now === false && card.card_opens_gate_now === false && card.card_mutates_source_now === false), "Candidate cards must not select, sign, open, or mutate"),
    validationItem("actions.present", "owner_actions", ownerActionRows.length === 8, "Owner action row count changed unexpectedly"),
    validationItem("actions.no_failures", "owner_actions", ownerActionRows.every((row) => row.current_verdict !== "fail"), "Owner action packet has hard failed rows"),
    validationItem("work_order.no_signature", "owner_work_order", ownerWorkOrder.signs_owner_receipt_now === false && ownerWorkOrder.source_mutation_allowed_now === false, "Owner work order must not sign or allow source mutation"),
    validationItem("boundary.authority_closed", "authority", authorityClosed(boundary), "Owner action packet opened forbidden authority"),
  ];
}

function buildSummary({ candidateCards, ownerActionRows, ownerWorkOrder, boundary, validation }) {
  return {
    factory_g1a_owner_action_packet_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    owner_candidate_card_count: candidateCards.length,
    eligible_candidate_count: candidateCards.filter((card) => card.eligible_for_owner_selection_now).length,
    selected_candidate_now: ownerWorkOrder.selected_candidate_now,
    candidate_hash_bound_now: ownerWorkOrder.candidate_hash_bound_now,
    owner_selection_required_now: ownerWorkOrder.owner_selection_required_now,
    owner_signature_required_now: ownerWorkOrder.owner_signature_required_now,
    first_required_owner_action: ownerWorkOrder.first_required_owner_action,
    owner_action_row_count: ownerActionRows.length,
    owner_action_pass_count: boundary.owner_action_pass_count,
    owner_action_wait_count: boundary.owner_action_wait_count,
    owner_action_fail_count: boundary.owner_action_fail_count,
    signs_owner_receipt_now: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: boundary.source_literal_opening_commit_applied_now,
    first_use_audit_present: boundary.first_use_audit_present,
    opens_gate_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function selectedCandidatePacketSha(candidateSelectionDocket) {
  const value = candidateSelectionDocket.summary?.selected_candidate_packet_sha256
    ?? candidateSelectionDocket.selection_policy?.selected_candidate_packet_sha256;
  return isSha(value) ? value : null;
}

function selectedCandidateManifestSha(candidateSelectionDocket) {
  const value = candidateSelectionDocket.summary?.selected_candidate_manifest_sha256
    ?? candidateSelectionDocket.selection_policy?.selected_candidate_manifest_sha256;
  return isSha(value) ? value : null;
}

function firstCandidateAction(candidateCards) {
  return candidateCards.some((card) => card.eligible_for_owner_selection_now)
    ? "choose_exactly_one_candidate_hash_from_owner_candidate_action_cards_then_run npm run factory:g1a-owner-signing-handoff -- --bound-candidate-packet-sha256 <owner-selected-candidate-packet-sha256> --check --require-pass"
    : "choose_exactly_one_candidate_hash_from_owner_candidate_action_cards";
}

function promotionCloseoutRowPassed(promotionCloseoutReadiness, rowId) {
  return (promotionCloseoutReadiness.factory_promotion_closeout_readiness_rows ?? []).some((row) => (
    row.row_id === rowId && row.current_verdict === "pass"
  ));
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-owner-action-packet-validation-item.v1",
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
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function authorityClosed(value = {}) {
  return Object.keys(CLOSED_AUTHORITY_FLAGS).every((flag) => value?.[flag] === false)
    && value?.signs_owner_receipt_now === false
    && value?.selects_candidate_by_default_now === false;
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Owner Action Packet",
    "",
    `Status: ${result.summary.factory_g1a_owner_action_packet_status}`,
    `Program: ${result.program_range}`,
    `Candidate cards: ${result.summary.owner_candidate_card_count}`,
    `Action rows pass/wait/fail: ${result.summary.owner_action_pass_count}/${result.summary.owner_action_wait_count}/${result.summary.owner_action_fail_count}`,
    `First required owner action: ${result.summary.first_required_owner_action}`,
    `Owner selection required: ${result.summary.owner_selection_required_now}`,
    `Owner signature required: ${result.summary.owner_signature_required_now}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function normalizeInputs(options, repoRoot) {
  const defaults = DEFAULT_FACTORY_G1A_OWNER_ACTION_PACKET_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--selected-candidate-packet-sha256") args.selectedCandidatePacketSha256 = argv[++index];
    else if (arg === "--selected-candidate-manifest-sha256") args.selectedCandidateManifestSha256 = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g1a-owner-action-packet.mjs [--check] [--require-pass] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>] [--selected-candidate-packet-sha256 <sha>] [--selected-candidate-manifest-sha256 <sha>]\n\nBuilds a read-only G1a owner action packet. It never chooses a candidate by default, signs receipts, mutates source, opens G1a, or grants production/enterprise trust.`);
}

async function readJsonSource(filePath) {
  const text = await readFile(filePath, "utf8");
  return { path: filePath, data: JSON.parse(text), text, sha256: sha256(text) };
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

function normalizeKey(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function isSha(value) {
  return typeof value === "string" && HASH_RE.test(value);
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
