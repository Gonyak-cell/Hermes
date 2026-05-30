import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_DECISION_REGISTER_OUT_DIR = "artifacts/human-review-decision-register/latest";
export const DEFAULT_HUMAN_REVIEW_DECISION_REGISTER_CONTEXT_BUNDLE_PATH = "artifacts/human-review-context-bundle/latest/human-review-context-bundle.json";

const APPLY_RECEIPT_STATUSES = new Set(["resolved", "deferred", "rejected", "failed", "cancelled"]);
const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewDecisionRegister(options = {}) {
  const result = await buildHumanReviewDecisionRegister(options);
  if (options.write !== false) await writeHumanReviewDecisionRegister(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review decision register failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewDecisionRegister(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_DECISION_REGISTER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const contextBundlePath = path.resolve(options.contextBundlePath ?? DEFAULT_HUMAN_REVIEW_DECISION_REGISTER_CONTEXT_BUNDLE_PATH);
  const contextBundleResult = await readJsonOrError(contextBundlePath);
  const contextCards = contextBundleResult.value?.context_cards ?? [];
  const decisionRows = buildDecisionRows(contextCards, generatedAt);
  const actorDecisionRegisters = buildActorDecisionRegisters(decisionRows, outputDir);
  const validation = validateDecisionRegister({ contextBundleResult, contextCards, decisionRows });
  const receiptInput = buildReceiptInput(generatedAt, contextBundleResult.value, decisionRows);
  const register = {
    schema_version: "human-review-decision-register.v1",
    generated_at: generatedAt,
    register_id: `human-review-decision-register.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    register_status: deriveRegisterStatus(validation, decisionRows),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      decision_register_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_context_bundle", "Human Review Context Bundle", contextBundlePath, contextBundleResult),
    ],
    summary: summarizeDecisionRegister(actorDecisionRegisters, decisionRows, validation),
    actor_decision_registers: actorDecisionRegisters,
    decision_rows: decisionRows,
    receipt_input: receiptInput,
    validation,
  };

  return {
    ...register,
    markdown: renderDecisionRegisterMarkdown(register),
  };
}

export async function writeHumanReviewDecisionRegister(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-decision-register.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    register_id: result.register_id,
    output_dir: result.output_dir,
    register_status: result.register_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_decision_registers: result.actor_decision_registers,
    decision_rows: result.decision_rows,
    receipt_input: result.receipt_input,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "decision-rows.json"), {
    generated_at: result.generated_at,
    count: result.decision_rows.length,
    decision_rows: result.decision_rows,
  });
  await writeJson(path.join(outDir, "actor-decision-registers.json"), {
    generated_at: result.generated_at,
    count: result.actor_decision_registers.length,
    actor_decision_registers: result.actor_decision_registers,
  });
  await writeJson(path.join(outDir, "receipt-input.json"), result.receipt_input);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actorRegister of result.actor_decision_registers) {
    const actorDir = path.join(outDir, "actors", actorRegister.required_actor);
    const rows = result.decision_rows.filter((row) => row.required_actor === actorRegister.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "decision-register.json"), {
      generated_at: result.generated_at,
      required_actor: actorRegister.required_actor,
      count: rows.length,
      decision_rows: rows,
    });
    await writeJson(path.join(actorDir, "receipt-input.json"), {
      ...result.receipt_input,
      instructions: `Actor-specific human gate receipt input for ${actorRegister.required_actor}. Validate before application; do not execute protected actions from this file.`,
      receipts: rows.map((row) => row.receipt),
    });
    await writeFile(path.join(actorDir, "review.md"), renderActorDecisionMarkdown(actorRegister, rows), "utf8");
  }
}

export async function runHumanReviewDecisionRegisterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewDecisionRegister(args);
    console.log(`Human review decision register ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Register status: ${result.register_status}`);
    console.log(`Decision rows: ${result.summary.decision_row_count}`);
    console.log(`Pending decisions: ${result.summary.pending_decision_count}`);
    console.log(`Ready for validation: ${result.summary.ready_for_validation_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildDecisionRows(contextCards, generatedAt) {
  return contextCards.map((card) => {
    const receiptStatus = normalizeReceiptStatus(card.review_contract?.receipt_status ?? card.receipt_status);
    const outcome = normalizeOutcome(card.review_contract?.outcome ?? card.outcome);
    const errors = validateDecisionCard(card, receiptStatus, outcome);
    const decisionStatus = deriveDecisionStatus(card, receiptStatus, errors);
    const receipt = buildReceipt(card, receiptStatus, outcome, generatedAt);
    return {
      decision_row_id: `human-review-decision-row.${slugify(card.gate_item_id)}`,
      context_card_id: card.context_card_id,
      merge_item_id: card.merge_item_id,
      receipt_id: card.receipt_id,
      gate_item_id: card.gate_item_id,
      source_plan_item_id: card.source_plan_item_id,
      gate_type: card.gate_type,
      priority: card.priority,
      required_actor: card.required_actor,
      subject_ref: card.subject_ref,
      protected_action: card.protected_action,
      decision_status: decisionStatus,
      receipt_status: receiptStatus,
      outcome,
      title: card.title,
      reason: card.reason,
      allowed_outcomes: card.review_contract?.allowed_outcomes ?? [],
      required_receipt_fields: card.review_contract?.required_receipt_fields ?? [],
      context_summary: summarizeContextForDecision(card),
      decision_fields: {
        decided_by: receipt.decided_by,
        decided_at: receipt.decided_at,
        reviewer: receipt.reviewer,
        decision_reference: receipt.decision_reference,
        decision_notes: receipt.decision_notes,
        protected_action_reference: receipt.protected_action_reference,
        command_result: receipt.command_result,
        commands_run: receipt.commands_run,
        completed_action_refs: receipt.completed_action_refs,
      },
      ready_for_validation: decisionStatus === "ready_for_validation",
      error_count: errors.length,
      errors,
      receipt,
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        validation_required_before_application: true,
      },
    };
  }).sort(compareDecisionRows);
}

function buildActorDecisionRegisters(decisionRows, outputDir) {
  return Object.entries(groupBy(decisionRows, (row) => row.required_actor))
    .map(([requiredActor, rows]) => ({
      actor_decision_register_id: `human-review-decision-register.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      register_status: rows.some((row) => row.decision_status === "invalid_context" || row.decision_status === "invalid_decision")
        ? "attention"
        : rows.some((row) => row.decision_status === "pending_decision")
          ? "pending_human_review"
          : "ready_for_validation",
      priority: highestPriority(rows),
      decision_row_count: rows.length,
      pending_decision_count: rows.filter((row) => row.decision_status === "pending_decision").length,
      ready_for_validation_count: rows.filter((row) => row.ready_for_validation).length,
      protected_action_count: rows.filter((row) => row.protected_action).length,
      evidence_decision_count: rows.filter((row) => row.gate_type === "evidence_decision").length,
      decision_row_ids: rows.map((row) => row.decision_row_id),
      decision_json_path: path.join(outputDir, "actors", requiredActor, "decision-register.json"),
      receipt_input_path: path.join(outputDir, "actors", requiredActor, "receipt-input.json"),
      review_markdown_path: path.join(outputDir, "actors", requiredActor, "review.md"),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        decision_register_only: true,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorRegisters);
}

function validateDecisionRegister({ contextBundleResult, contextCards, decisionRows }) {
  const errors = [];
  if (!contextBundleResult.ok) {
    errors.push({ path: "sources.human_review_context_bundle", message: `Context bundle unavailable: ${contextBundleResult.error}` });
  }
  if (contextCards.length !== decisionRows.length) {
    errors.push({ path: "decision_rows", message: "Decision row count must match context card count." });
  }
  for (const row of decisionRows) {
    if (row.safe_handling.auto_execute_allowed || row.safe_handling.protected_actions_executed) {
      errors.push({ path: `decision_rows.${row.decision_row_id}.safe_handling`, message: "Decision register rows must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateDecisionCard(card, receiptStatus, outcome) {
  const errors = [];
  if (card.context_status !== "ready") {
    errors.push({ path: `${card.context_card_id}.context_status`, message: "Context card must be ready before decision validation." });
  }
  if (!card.gate_context) errors.push({ path: `${card.context_card_id}.gate_context`, message: "Decision row is missing gate context." });
  if (!card.plan_context) errors.push({ path: `${card.context_card_id}.plan_context`, message: "Decision row is missing action-plan context." });
  if (receiptStatus !== "pending" && !APPLY_RECEIPT_STATUSES.has(receiptStatus)) {
    errors.push({ path: `${card.context_card_id}.receipt_status`, message: "Receipt status must be pending or an applyable terminal status." });
  }
  if (receiptStatus !== "pending" && !(card.review_contract?.allowed_outcomes ?? []).includes(outcome)) {
    errors.push({ path: `${card.context_card_id}.outcome`, message: "Outcome is not allowed by the review contract." });
  }
  return errors;
}

function deriveDecisionStatus(card, receiptStatus, errors) {
  if (errors.some((item) => item.path.includes("context"))) return "invalid_context";
  if (errors.length > 0) return "invalid_decision";
  if (receiptStatus === "pending") return "pending_decision";
  return "ready_for_validation";
}

function buildReceipt(card, receiptStatus, outcome, generatedAt) {
  return {
    receipt_id: card.receipt_id,
    gate_item_id: card.gate_item_id,
    source_plan_item_id: card.source_plan_item_id,
    gate_type: card.gate_type,
    receipt_status: receiptStatus,
    outcome,
    decided_by: "",
    decided_at: "",
    reviewer: "",
    decision_reference: card.review_contract?.decision_reference ?? "",
    decision_notes: card.review_contract?.decision_notes ?? "",
    protected_action_reference: card.review_contract?.protected_action_reference ?? null,
    command_result: null,
    commands_run: [],
    completed_action_refs: [],
    required_receipt_fields: card.review_contract?.required_receipt_fields ?? [],
    generated_at: generatedAt,
  };
}

function summarizeContextForDecision(card) {
  return {
    gate_title: card.gate_context?.title ?? null,
    plan_title: card.plan_context?.title ?? null,
    evidence_id: card.evidence_context?.evidence_id ?? null,
    evidence_summary: card.evidence_context?.summary ?? null,
    approval_item_id: card.approval_context?.approval_item_id ?? null,
    approval_status: card.approval_context?.status ?? null,
    matter_key: card.matter_context?.matter_key ?? null,
    matter_status: card.matter_context?.status ?? null,
  };
}

function buildReceiptInput(generatedAt, contextBundle, decisionRows) {
  return {
    schema_version: "control-plane-human-gate-receipts-input.v1",
    generated_at: generatedAt,
    human_gate_id: inferHumanGateId(contextBundle),
    instructions: "Human review decision register receipt input. Pending rows are safe placeholders. Validate before application; do not execute protected actions from this file.",
    receipts: decisionRows.map((row) => row.receipt),
  };
}

function inferHumanGateId(contextBundle) {
  const humanGateSource = (contextBundle?.sources ?? []).find((source) => source.source_id === "control_plane_human_gates");
  return humanGateSource?.summary?.human_gate_id ?? "control-plane-human-gates.from-decision-register";
}

function summarizeDecisionRegister(actorRegisters, decisionRows, validation) {
  return {
    actor_decision_register_count: actorRegisters.length,
    decision_row_count: decisionRows.length,
    receipt_row_count: decisionRows.length,
    pending_decision_count: decisionRows.filter((row) => row.decision_status === "pending_decision").length,
    ready_for_validation_count: decisionRows.filter((row) => row.ready_for_validation).length,
    invalid_context_count: decisionRows.filter((row) => row.decision_status === "invalid_context").length,
    invalid_decision_count: decisionRows.filter((row) => row.decision_status === "invalid_decision").length,
    protected_action_count: decisionRows.filter((row) => row.protected_action).length,
    evidence_decision_count: decisionRows.filter((row) => row.gate_type === "evidence_decision").length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(decisionRows, "required_actor"),
    by_gate_type: countBy(decisionRows, "gate_type"),
    by_decision_status: countBy(decisionRows, "decision_status"),
  };
}

function deriveRegisterStatus(validation, decisionRows) {
  if (!validation.valid) return "blocked";
  if (decisionRows.some((row) => row.decision_status === "invalid_context" || row.decision_status === "invalid_decision")) return "attention";
  if (decisionRows.some((row) => row.decision_status === "pending_decision")) return "pending_human_review";
  if (decisionRows.some((row) => row.ready_for_validation)) return "ready_for_validation";
  return "clear";
}

function renderDecisionRegisterMarkdown(register) {
  const lines = [
    "# Human Review Decision Register",
    "",
    `- Register status: ${register.register_status}`,
    `- Actor registers: ${register.summary.actor_decision_register_count}`,
    `- Decision rows: ${register.summary.decision_row_count}`,
    `- Pending decisions: ${register.summary.pending_decision_count}`,
    `- Ready for validation: ${register.summary.ready_for_validation_count}`,
    `- Validation errors: ${register.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is a decision register only.",
    "- It does not apply receipts or execute protected actions.",
    "- Run human gate receipt validation before application.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of register.actor_decision_registers) {
    lines.push(`- ${actor.required_actor}: ${actor.decision_row_count} row(s), ${actor.pending_decision_count} pending, ${actor.review_markdown_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorDecisionMarkdown(actorRegister, rows) {
  const lines = [
    `# Human Review Decisions: ${actorRegister.required_actor}`,
    "",
    `- Register status: ${actorRegister.register_status}`,
    `- Decision rows: ${actorRegister.decision_row_count}`,
    `- Pending decisions: ${actorRegister.pending_decision_count}`,
    `- Protected actions: ${actorRegister.protected_action_count}`,
    "",
    "## Rows",
    "",
  ];
  for (const row of rows) {
    lines.push(`### ${row.title}`);
    lines.push("");
    lines.push(`- Decision row: ${row.decision_row_id}`);
    lines.push(`- Context card: ${row.context_card_id}`);
    lines.push(`- Gate: ${row.gate_item_id}`);
    lines.push(`- Status: ${row.decision_status}`);
    lines.push(`- Allowed outcomes: ${row.allowed_outcomes.join(", ")}`);
    if (row.context_summary.evidence_id) lines.push(`- Evidence: ${row.context_summary.evidence_id} - ${row.context_summary.evidence_summary}`);
    if (row.context_summary.approval_item_id) lines.push(`- Approval: ${row.context_summary.approval_item_id} (${row.context_summary.approval_status})`);
    if (row.context_summary.matter_key) lines.push(`- Matter: ${row.context_summary.matter_key} (${row.context_summary.matter_status})`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function readJsonOrError(filePath) {
  if (!filePath) return { ok: false, value: null, error: "disabled" };
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return { ok: true, value, error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
  }
}

function buildSource(sourceId, label, filePath, result) {
  return {
    source_id: sourceId,
    label,
    path: filePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.error ?? null,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeReceiptStatus(value) {
  return String(value ?? "pending").trim().toLowerCase() || "pending";
}

function normalizeOutcome(value) {
  return String(value ?? "pending").trim().toLowerCase() || "pending";
}

function compareDecisionRows(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || a.gate_item_id.localeCompare(b.gate_item_id);
}

function compareActorRegisters(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
}

function highestPriority(items) {
  return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))[0]?.priority ?? "low";
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function dateStamp(value) {
  return value.replaceAll(":", "").replaceAll(".", "").replace("T", ".").replace("Z", "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown";
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--context-bundle") args.contextBundlePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-decision-register.mjs [options]

Options:
  --context-bundle <path> Human review context bundle artifact
  --out-dir <dir>         Output directory
  --run-at <iso>          Override generated_at
  --check                 Exit non-zero when validation fails
`);
}
