import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_AGENDA_OUT_DIR = "artifacts/human-review-agenda/latest";
export const DEFAULT_HUMAN_REVIEW_AGENDA_PACKET_LEDGER_PATH = "artifacts/human-review-packets/latest/human-review-packet-ledger.json";
export const DEFAULT_HUMAN_REVIEW_AGENDA_ACTION_PLAN_PATH = "artifacts/control-plane-action-plan/latest/control-plane-action-plan.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewAgenda(options = {}) {
  const result = await buildHumanReviewAgenda(options);
  if (options.write !== false) await writeHumanReviewAgenda(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review agenda validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewAgenda(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_AGENDA_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const packetLedgerPath = path.resolve(options.packetLedgerPath ?? DEFAULT_HUMAN_REVIEW_AGENDA_PACKET_LEDGER_PATH);
  const actionPlanPath = options.actionPlanPath === false ? null : path.resolve(options.actionPlanPath ?? DEFAULT_HUMAN_REVIEW_AGENDA_ACTION_PLAN_PATH);
  const packetLedgerResult = await readJsonOrError(packetLedgerPath);
  const actionPlanResult = actionPlanPath ? await readJsonOrError(actionPlanPath) : { ok: false, value: null, error: "disabled" };
  const agendaItems = buildAgendaItems(packetLedgerResult.value, actionPlanResult.value).sort(compareAgendaItems);
  const agendaSections = buildAgendaSections(agendaItems);
  const decisionTemplate = buildDecisionTemplate(generatedAt, agendaItems, packetLedgerResult.value?.review_items ?? []);
  const validation = validateHumanReviewAgenda({ packetLedgerResult, agendaItems, decisionTemplate });
  const agenda = {
    schema_version: "human-review-agenda.v1",
    generated_at: generatedAt,
    agenda_id: `human-review-agenda.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    agenda_status: deriveAgendaStatus(validation, agendaItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      receipts_must_be_validated_before_application: true,
      protected_actions_require_manual_receipt: true,
    },
    sources: [
      buildSource("human_review_packet_ledger", "Human Review Packet Ledger", packetLedgerPath, packetLedgerResult),
      buildSource("control_plane_action_plan", "Control Plane Action Plan", actionPlanPath, actionPlanResult),
    ],
    summary: summarizeAgenda(agendaItems, agendaSections, decisionTemplate, validation),
    agenda_sections: agendaSections,
    agenda_items: agendaItems,
    decision_template: decisionTemplate,
    validation,
  };

  return {
    ...agenda,
    markdown: renderHumanReviewAgendaMarkdown(agenda),
  };
}

export async function writeHumanReviewAgenda(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-agenda.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    agenda_id: result.agenda_id,
    output_dir: result.output_dir,
    agenda_status: result.agenda_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    agenda_sections: result.agenda_sections,
    agenda_items: result.agenda_items,
    decision_template: result.decision_template,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "agenda-sections.json"), {
    generated_at: result.generated_at,
    count: result.agenda_sections.length,
    agenda_sections: result.agenda_sections,
  });
  await writeJson(path.join(outDir, "agenda-items.json"), {
    generated_at: result.generated_at,
    count: result.agenda_items.length,
    agenda_items: result.agenda_items,
  });
  await writeJson(path.join(outDir, "decision-template.json"), result.decision_template);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewAgendaCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewAgenda(args);
    console.log(`Human review agenda ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Agenda status: ${result.agenda_status}`);
    console.log(`Agenda items: ${result.summary.agenda_item_count}`);
    console.log(`Actors: ${result.summary.actor_count}`);
    console.log(`Decision rows: ${result.summary.decision_template_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildAgendaItems(packetLedger, actionPlan) {
  const reviewItemsByPacket = groupReviewItemsByPacket(packetLedger?.review_packets ?? [], packetLedger?.review_items ?? []);
  const planItemsById = new Map((actionPlan?.plan_items ?? []).map((item) => [item.plan_item_id, item]));
  return (packetLedger?.review_packets ?? []).map((packet) => {
    const reviewItems = reviewItemsByPacket.get(packet.review_packet_id) ?? [];
    const relatedPlanItems = reviewItems.map((item) => planItemsById.get(item.source_plan_item_id)).filter(Boolean);
    const agendaStatus = packet.packet_status === "blocked_missing_receipt"
      ? "blocked_missing_receipt"
      : packet.pending_receipt_count > 0
        ? "pending_human_review"
        : "clear";
    return {
      agenda_item_id: `human-review-agenda-item.${slugify(packet.review_packet_id)}`,
      review_packet_id: packet.review_packet_id,
      packet_type: packet.packet_type,
      required_actor: packet.required_actor,
      priority: packet.priority,
      agenda_status: agendaStatus,
      title: `Review ${packet.packet_type} packet`,
      reason: buildAgendaReason(packet, relatedPlanItems),
      item_count: packet.item_count,
      protected_action_count: packet.protected_action_count,
      human_required_count: packet.human_required_count,
      pending_receipt_count: packet.pending_receipt_count,
      missing_receipt_count: packet.missing_receipt_count,
      command_count: packet.command_count,
      gate_item_ids: packet.gate_item_ids,
      receipt_ids: packet.receipt_ids,
      review_item_ids: reviewItems.map((item) => item.review_item_id),
      source_plan_item_ids: unique(reviewItems.map((item) => item.source_plan_item_id).filter(Boolean)),
      source_stages: packet.source_stages,
      subject_refs: packet.subject_refs.slice(0, 10),
      recommended_actions: packet.recommended_actions,
      next_commands: packet.next_commands,
      checklist: buildAgendaChecklist(packet),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        receipt_gate_required: packet.pending_receipt_count > 0 || packet.protected_action_count > 0,
        protected_actions_require_manual_receipt: packet.protected_action_count > 0,
      },
      receipt_template_refs: packet.receipt_ids.map((receiptId) => ({
        receipt_id: receiptId,
        template_path: "artifacts/human-review-agenda/latest/decision-template.json",
      })),
      related_plan_item_ids: relatedPlanItems.map((item) => item.plan_item_id),
      agenda_hash: hashValue({
        review_packet_id: packet.review_packet_id,
        receipt_ids: packet.receipt_ids,
        item_count: packet.item_count,
        pending_receipt_count: packet.pending_receipt_count,
      }),
    };
  });
}

function groupReviewItemsByPacket(packets, reviewItems) {
  const packetByGate = new Map();
  for (const packet of packets) {
    for (const gateItemId of packet.gate_item_ids ?? []) packetByGate.set(gateItemId, packet.review_packet_id);
  }
  const grouped = new Map();
  for (const item of reviewItems) {
    const packetId = packetByGate.get(item.gate_item_id);
    if (!packetId) continue;
    if (!grouped.has(packetId)) grouped.set(packetId, []);
    grouped.get(packetId).push(item);
  }
  return grouped;
}

function buildAgendaReason(packet, relatedPlanItems) {
  const planReason = relatedPlanItems.find((item) => item.reason)?.reason;
  if (packet.protected_action_count > 0) {
    return `${packet.protected_action_count} protected action(s) require manual receipt before any execution. ${planReason ?? ""}`.trim();
  }
  if (packet.packet_type === "evidence_decision") {
    return `${packet.item_count} evidence decision item(s) require human review with matter and citation context preserved.`;
  }
  return planReason ?? `${packet.item_count} human gate item(s) are waiting for ${packet.required_actor}.`;
}

function buildAgendaChecklist(packet) {
  const checklist = [
    ...packet.checklist,
    "Fill the decision template only after the human reviewer has made a decision.",
    "Run receipt validation before any receipt application command.",
  ];
  if (packet.protected_action_count > 0) checklist.push("Do not perform protected delivery or merge from this agenda artifact.");
  if (packet.command_count > 0) checklist.push("Run follow-up commands only after the corresponding receipt is no longer pending.");
  return unique(checklist);
}

function buildAgendaSections(agendaItems) {
  return Object.entries(groupBy(agendaItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => ({
      agenda_section_id: `human-review-agenda-section.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      section_status: items.some((item) => item.agenda_status === "blocked_missing_receipt")
        ? "blocked"
        : items.some((item) => item.agenda_status === "pending_human_review")
          ? "pending_review"
          : "clear",
      priority: highestPriority(items),
      agenda_item_count: items.length,
      review_item_count: items.reduce((sum, item) => sum + item.item_count, 0),
      protected_action_count: items.reduce((sum, item) => sum + item.protected_action_count, 0),
      pending_receipt_count: items.reduce((sum, item) => sum + item.pending_receipt_count, 0),
      agenda_item_ids: items.map((item) => item.agenda_item_id),
      review_packet_ids: items.map((item) => item.review_packet_id),
      packet_types: countBy(items, "packet_type"),
      recommended_actions: unique(items.flatMap((item) => item.recommended_actions)),
      next_commands: unique(items.flatMap((item) => item.next_commands)),
    }))
    .sort(compareSections);
}

function buildDecisionTemplate(generatedAt, agendaItems, reviewItems) {
  const agendaByPacket = new Map(agendaItems.map((item) => [item.review_packet_id, item]));
  const packetByGate = new Map();
  for (const item of agendaItems) {
    for (const gateItemId of item.gate_item_ids) packetByGate.set(gateItemId, item.review_packet_id);
  }
  const rows = reviewItems.map((item) => {
    const packetId = packetByGate.get(item.gate_item_id) ?? null;
    const agendaItem = packetId ? agendaByPacket.get(packetId) : null;
    return {
      review_item_id: item.review_item_id,
      agenda_item_id: agendaItem?.agenda_item_id ?? null,
      review_packet_id: packetId,
      receipt_id: item.receipt_id,
      gate_item_id: item.gate_item_id,
      gate_type: item.gate_type,
      required_actor: item.required_actor,
      subject_ref: item.subject_ref,
      allowed_outcomes: item.allowed_outcomes,
      receipt_status: "pending",
      outcome: "pending",
      decided_by: "",
      decided_at: "",
      reviewer: item.requires_human ? "" : null,
      decision_reference: "",
      decision_notes: "",
      protected_action_reference: item.protected_action ? "" : null,
      command_result: item.next_commands.length > 0 ? "not_run" : null,
      commands_run: item.next_commands,
      completed_action_refs: [],
      required_receipt_fields: item.required_receipt_fields,
    };
  });
  return {
    schema_version: "human-review-decision-template.v1",
    generated_at: generatedAt,
    instructions: "Complete receipt rows after human review. Pending rows do not close gates and this template never executes protected actions by itself.",
    safe_handling: {
      auto_execute_allowed: false,
      validate_with: "npm run control-plane:human-gate-receipts:validate",
      apply_with: "npm run control-plane:human-gate-receipts:apply",
    },
    receipts: rows,
  };
}

function validateHumanReviewAgenda({ packetLedgerResult, agendaItems, decisionTemplate }) {
  const errors = [];
  if (!packetLedgerResult.ok) {
    errors.push({ path: "sources.human_review_packet_ledger", message: `Human review packet ledger unavailable: ${packetLedgerResult.error}` });
  }
  for (const item of agendaItems) {
    if (item.safe_handling.auto_execute_allowed) {
      errors.push({ path: `agenda_items.${item.agenda_item_id}.safe_handling.auto_execute_allowed`, message: "Human review agenda must not allow auto execution" });
    }
    if (item.receipt_ids.length !== item.item_count) {
      errors.push({ path: `agenda_items.${item.agenda_item_id}.receipt_ids`, message: "Every agenda item must retain one receipt template reference per review item" });
    }
  }
  if (decisionTemplate.safe_handling.auto_execute_allowed) {
    errors.push({ path: "decision_template.safe_handling.auto_execute_allowed", message: "Decision template must not allow auto execution" });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function deriveAgendaStatus(validation, agendaItems) {
  if (!validation.valid) return "blocked";
  if (agendaItems.some((item) => item.agenda_status === "blocked_missing_receipt")) return "blocked";
  if (agendaItems.some((item) => item.agenda_status === "pending_human_review")) return "pending_review";
  return "clear";
}

function summarizeAgenda(agendaItems, agendaSections, decisionTemplate, validation) {
  return {
    agenda_item_count: agendaItems.length,
    agenda_section_count: agendaSections.length,
    actor_count: agendaSections.length,
    review_packet_count: agendaItems.length,
    review_item_count: agendaItems.reduce((sum, item) => sum + item.item_count, 0),
    pending_agenda_item_count: agendaItems.filter((item) => item.agenda_status === "pending_human_review").length,
    blocked_agenda_item_count: agendaItems.filter((item) => item.agenda_status === "blocked_missing_receipt").length,
    protected_action_count: agendaItems.reduce((sum, item) => sum + item.protected_action_count, 0),
    command_count: agendaItems.reduce((sum, item) => sum + item.command_count, 0),
    decision_template_row_count: decisionTemplate.receipts.length,
    validation_error_count: validation.errors.length,
    highest_priority: highestPriority(agendaItems),
    by_required_actor: countBy(agendaItems, "required_actor"),
    by_packet_type: countBy(agendaItems, "packet_type"),
    by_priority: countBy(agendaItems, "priority"),
    by_agenda_status: countBy(agendaItems, "agenda_status"),
  };
}

function renderHumanReviewAgendaMarkdown(agenda) {
  const lines = [];
  lines.push("# Human Review Agenda");
  lines.push("");
  lines.push(`Generated: ${agenda.generated_at}`);
  lines.push(`Agenda status: ${agenda.agenda_status}`);
  lines.push("");
  lines.push(`- Agenda sections: ${agenda.summary.agenda_section_count}`);
  lines.push(`- Agenda items: ${agenda.summary.agenda_item_count}`);
  lines.push(`- Review items: ${agenda.summary.review_item_count}`);
  lines.push(`- Decision template rows: ${agenda.summary.decision_template_row_count}`);
  lines.push(`- Protected actions: ${agenda.summary.protected_action_count}`);
  lines.push(`- Validation errors: ${agenda.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Sections");
  lines.push("");
  for (const section of agenda.agenda_sections) {
    lines.push(`- [${section.priority}] ${section.required_actor}: ${section.agenda_item_count} packet(s), ${section.review_item_count} item(s), ${section.section_status}`);
  }
  if (agenda.agenda_sections.length === 0) lines.push("- No agenda sections.");
  lines.push("");
  lines.push("## Agenda Items");
  lines.push("");
  for (const item of agenda.agenda_items) {
    lines.push(`- [${item.priority}] ${item.review_packet_id}`);
    lines.push(`  - Actor: ${item.required_actor}`);
    lines.push(`  - Status: ${item.agenda_status}`);
    lines.push(`  - Review items: ${item.item_count}`);
    lines.push(`  - Protected actions: ${item.protected_action_count}`);
  }
  if (agenda.agenda_items.length === 0) lines.push("- No agenda items.");
  return `${lines.join("\n")}\n`;
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.ok ? null : result.error,
  };
}

async function readJsonOrError(filePath) {
  if (!filePath) {
    return { ok: false, value: null, error: "disabled" };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function compareAgendaItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    || b.protected_action_count - a.protected_action_count
    || b.item_count - a.item_count
    || a.review_packet_id.localeCompare(b.review_packet_id);
}

function compareSections(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    || b.protected_action_count - a.protected_action_count
    || a.required_actor.localeCompare(b.required_actor);
}

function highestPriority(items) {
  if (items.length === 0) return "low";
  return items.map((item) => item.priority).sort((a, b) => (PRIORITY_ORDER[a] ?? 9) - (PRIORITY_ORDER[b] ?? 9))[0] ?? "low";
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function countBy(items, key) {
  return Object.fromEntries(
    Object.entries(groupBy(items, (item) => item[key] ?? "unknown"))
      .map(([value, grouped]) => [value, grouped.length])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function dateStamp(value) {
  return value.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown";
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--packet-ledger") parsed.packetLedgerPath = argv[++index];
    else if (arg === "--action-plan") parsed.actionPlanPath = argv[++index];
    else if (arg === "--no-action-plan") parsed.actionPlanPath = false;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-agenda.mjs [options]

Options:
  --packet-ledger <path> human-review-packet-ledger.json path.
  --action-plan <path>   control-plane-action-plan.json path.
  --no-action-plan       Build agenda without action plan context.
  --out-dir <path>       Output directory.
  --run-at <iso>         Fixed generation timestamp.
  --check                Exit non-zero when validation errors are present.
  --help                 Show this help.
`);
}
