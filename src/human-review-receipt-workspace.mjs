import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_RECEIPT_WORKSPACE_OUT_DIR = "artifacts/human-review-receipt-workspace/latest";
export const DEFAULT_HUMAN_REVIEW_RECEIPT_WORKSPACE_INTAKE_PATH = "artifacts/human-review-agenda-receipt-intake/latest/human-review-agenda-receipt-intake.json";
export const DEFAULT_HUMAN_REVIEW_RECEIPT_WORKSPACE_AGENDA_PATH = "artifacts/human-review-agenda/latest/human-review-agenda.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewReceiptWorkspace(options = {}) {
  const result = await buildHumanReviewReceiptWorkspace(options);
  if (options.write !== false) await writeHumanReviewReceiptWorkspace(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review receipt workspace validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewReceiptWorkspace(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_RECEIPT_WORKSPACE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const intakePath = path.resolve(options.intakePath ?? DEFAULT_HUMAN_REVIEW_RECEIPT_WORKSPACE_INTAKE_PATH);
  const agendaPath = options.agendaPath === false ? null : path.resolve(options.agendaPath ?? DEFAULT_HUMAN_REVIEW_RECEIPT_WORKSPACE_AGENDA_PATH);
  const intakeResult = await readJsonOrError(intakePath);
  const agendaResult = agendaPath ? await readJsonOrError(agendaPath) : { ok: false, value: null, error: "disabled" };
  const agendaRowsByGate = new Map((agendaResult.value?.decision_template?.receipts ?? []).map((row) => [row.gate_item_id, row]));
  const workspaceEntries = buildWorkspaceEntries(intakeResult.value?.intake_items ?? [], agendaRowsByGate);
  const actorWorkspaces = buildActorWorkspaces(workspaceEntries, generatedAt, outputDir, intakeResult.value);
  const validation = validateWorkspace({ intakeResult, workspaceEntries, actorWorkspaces });
  const workspace = {
    schema_version: "human-review-receipt-workspace.v1",
    generated_at: generatedAt,
    workspace_id: `human-review-receipt-workspace.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    workspace_status: deriveWorkspaceStatus(validation, workspaceEntries),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      writes_editable_receipt_inputs: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_agenda_receipt_intake", "Human Review Agenda Receipt Intake", intakePath, intakeResult),
      buildSource("human_review_agenda", "Human Review Agenda", agendaPath, agendaResult),
    ],
    summary: summarizeWorkspace(actorWorkspaces, workspaceEntries, validation),
    actor_workspaces: actorWorkspaces,
    workspace_entries: workspaceEntries,
    validation,
  };

  return {
    ...workspace,
    markdown: renderWorkspaceMarkdown(workspace),
  };
}

export async function writeHumanReviewReceiptWorkspace(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-receipt-workspace.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    workspace_id: result.workspace_id,
    output_dir: result.output_dir,
    workspace_status: result.workspace_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_workspaces: result.actor_workspaces,
    workspace_entries: result.workspace_entries,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "actor-workspaces.json"), {
    generated_at: result.generated_at,
    count: result.actor_workspaces.length,
    actor_workspaces: result.actor_workspaces,
  });
  await writeJson(path.join(outDir, "workspace-entries.json"), {
    generated_at: result.generated_at,
    count: result.workspace_entries.length,
    workspace_entries: result.workspace_entries,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const workspace of result.actor_workspaces) {
    const actorDir = path.join(outDir, "actors", workspace.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "receipt-input.json"), workspace.receipt_input);
    await writeFile(path.join(actorDir, "review.md"), renderActorWorkspaceMarkdown(workspace), "utf8");
  }
}

export async function runHumanReviewReceiptWorkspaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewReceiptWorkspace(args);
    console.log(`Human review receipt workspace ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Workspace status: ${result.workspace_status}`);
    console.log(`Actor workspaces: ${result.summary.actor_workspace_count}`);
    console.log(`Receipt rows: ${result.summary.receipt_row_count}`);
    console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildWorkspaceEntries(intakeItems, agendaRowsByGate) {
  return intakeItems
    .map((item) => {
      const agendaRow = agendaRowsByGate.get(item.gate_item_id);
      return {
        workspace_entry_id: `human-review-receipt-workspace-entry.${slugify(item.gate_item_id)}`,
        intake_item_id: item.intake_item_id,
        receipt_requirement_id: item.receipt_requirement_id,
        gate_item_id: item.gate_item_id,
        source_plan_item_id: item.source_plan_item_id,
        source_stage: item.source_stage,
        gate_type: item.gate_type,
        priority: item.priority,
        required_actor: item.required_actor,
        requires_human: Boolean(item.requires_human),
        protected_action: Boolean(item.protected_action),
        receipt_id: item.receipt_id,
        receipt_status: item.receipt_status,
        outcome: item.outcome,
        intake_status: item.intake_status,
        ready_for_validation: Boolean(item.ready_for_validation),
        allowed_outcomes: agendaRow?.allowed_outcomes ?? [],
        required_receipt_fields: item.receipt?.required_receipt_fields ?? [],
        subject_ref: agendaRow?.subject_ref ?? null,
        decision_reference: item.receipt?.decision_reference ?? "",
        decision_notes: item.receipt?.decision_notes ?? "",
        receipt: item.receipt,
        editable: item.intake_status === "pending_receipt" || item.intake_status === "ready_for_validation",
        safe_handling: {
          auto_execute_allowed: false,
          protected_actions_executed: false,
          validation_required_before_application: true,
        },
      };
    })
    .sort(compareEntries);
}

function buildActorWorkspaces(entries, generatedAt, outputDir, intake) {
  return Object.entries(groupBy(entries, (entry) => entry.required_actor))
    .map(([requiredActor, actorEntries]) => {
      const receiptInput = {
        schema_version: "control-plane-human-gate-receipts-input.v1",
        generated_at: generatedAt,
        human_gate_id: intake?.receipt_input?.human_gate_id ?? "control-plane-human-gates.unknown",
        instructions: `Editable receipt input for ${requiredActor}. Validate before applying. Do not execute protected actions from this workspace.`,
        receipts: actorEntries.map((entry) => entry.receipt).filter(Boolean),
      };
      return {
        actor_workspace_id: `human-review-receipt-workspace.actor.${slugify(requiredActor)}`,
        required_actor: requiredActor,
        workspace_status: deriveActorWorkspaceStatus(actorEntries),
        priority: highestPriority(actorEntries),
        receipt_row_count: actorEntries.length,
        pending_receipt_count: actorEntries.filter((entry) => entry.receipt_status === "pending").length,
        ready_for_validation_count: actorEntries.filter((entry) => entry.ready_for_validation).length,
        protected_action_count: actorEntries.filter((entry) => entry.protected_action).length,
        evidence_decision_count: actorEntries.filter((entry) => entry.gate_type === "evidence_decision").length,
        gate_types: countBy(actorEntries, "gate_type"),
        receipt_input_path: path.join(outputDir, "actors", requiredActor, "receipt-input.json"),
        review_markdown_path: path.join(outputDir, "actors", requiredActor, "review.md"),
        workspace_entry_ids: actorEntries.map((entry) => entry.workspace_entry_id),
        receipt_ids: actorEntries.map((entry) => entry.receipt_id).filter(Boolean),
        safe_handling: {
          auto_execute_allowed: false,
          protected_actions_executed: false,
          validation_required_before_application: true,
        },
        receipt_input: receiptInput,
      };
    })
    .sort(compareActorWorkspaces);
}

function validateWorkspace({ intakeResult, workspaceEntries, actorWorkspaces }) {
  const errors = [];
  if (!intakeResult.ok) {
    errors.push({ path: "sources.human_review_agenda_receipt_intake", message: `Human review agenda receipt intake unavailable: ${intakeResult.error}` });
  }
  if (intakeResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_agenda_receipt_intake.safe_handling.auto_execute_allowed", message: "Receipt workspace requires auto execution to remain disabled." });
  }
  for (const entry of workspaceEntries) {
    if (!entry.receipt) errors.push({ path: `workspace_entries.${entry.workspace_entry_id}.receipt`, message: "Workspace entry is missing an editable receipt object." });
    if (entry.safe_handling.auto_execute_allowed || entry.safe_handling.protected_actions_executed) {
      errors.push({ path: `workspace_entries.${entry.workspace_entry_id}.safe_handling`, message: "Receipt workspace entries must not execute protected actions." });
    }
  }
  for (const workspace of actorWorkspaces) {
    if (workspace.safe_handling.auto_execute_allowed || workspace.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_workspaces.${workspace.actor_workspace_id}.safe_handling`, message: "Actor workspaces must remain draft-only and non-executing." });
    }
    if (workspace.receipt_input.receipts.length !== workspace.receipt_row_count) {
      errors.push({ path: `actor_workspaces.${workspace.actor_workspace_id}.receipt_input.receipts`, message: "Actor receipt input row count does not match the workspace manifest." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeWorkspace(actorWorkspaces, entries, validation) {
  return {
    actor_workspace_count: actorWorkspaces.length,
    workspace_entry_count: entries.length,
    receipt_row_count: entries.filter((entry) => entry.receipt).length,
    pending_receipt_count: entries.filter((entry) => entry.receipt_status === "pending").length,
    ready_for_validation_count: entries.filter((entry) => entry.ready_for_validation).length,
    protected_action_count: entries.filter((entry) => entry.protected_action).length,
    human_required_count: entries.filter((entry) => entry.requires_human).length,
    evidence_decision_count: entries.filter((entry) => entry.gate_type === "evidence_decision").length,
    editable_file_count: actorWorkspaces.length * 2,
    blocked_workspace_count: actorWorkspaces.filter((workspace) => workspace.workspace_status === "blocked").length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(entries, "required_actor"),
    by_gate_type: countBy(entries, "gate_type"),
    by_workspace_status: countBy(actorWorkspaces, "workspace_status"),
    by_priority: countBy(entries, "priority"),
  };
}

function deriveWorkspaceStatus(validation, entries) {
  if (!validation.valid || entries.some((entry) => ["invalid_template_row", "missing_template_row", "unknown_requirement"].includes(entry.intake_status))) return "blocked";
  if (entries.some((entry) => entry.receipt_status === "pending")) return "pending_human_review";
  if (entries.some((entry) => entry.ready_for_validation)) return "ready_for_validation";
  return "clear";
}

function deriveActorWorkspaceStatus(entries) {
  if (entries.some((entry) => ["invalid_template_row", "missing_template_row", "unknown_requirement"].includes(entry.intake_status))) return "blocked";
  if (entries.some((entry) => entry.receipt_status === "pending")) return "pending_human_review";
  if (entries.some((entry) => entry.ready_for_validation)) return "ready_for_validation";
  return "clear";
}

function renderWorkspaceMarkdown(workspace) {
  const lines = [
    "# Human Review Receipt Workspace",
    "",
    `- Workspace status: ${workspace.workspace_status}`,
    `- Actor workspaces: ${workspace.summary.actor_workspace_count}`,
    `- Receipt rows: ${workspace.summary.receipt_row_count}`,
    `- Pending receipts: ${workspace.summary.pending_receipt_count}`,
    `- Protected actions: ${workspace.summary.protected_action_count}`,
    `- Validation errors: ${workspace.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This workspace writes editable receipt input drafts only.",
    "- It does not apply receipts or execute protected actions.",
    "- Run human gate receipt validation before any receipt application.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of workspace.actor_workspaces) {
    lines.push(`- ${actor.required_actor}: ${actor.receipt_row_count} receipt(s), ${actor.pending_receipt_count} pending, ${actor.review_markdown_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorWorkspaceMarkdown(workspace) {
  const lines = [
    `# Human Review Receipts: ${workspace.required_actor}`,
    "",
    `- Status: ${workspace.workspace_status}`,
    `- Priority: ${workspace.priority}`,
    `- Receipt rows: ${workspace.receipt_row_count}`,
    `- Pending receipts: ${workspace.pending_receipt_count}`,
    `- Protected actions: ${workspace.protected_action_count}`,
    `- Editable input: ${workspace.receipt_input_path}`,
    "",
    "## Required Workflow",
    "",
    "1. Review the source gate item and subject reference.",
    "2. Fill only the pending receipt fields in `receipt-input.json`.",
    "3. Run human gate receipt validation.",
    "4. Apply receipts only after validation reports ready receipts.",
    "",
    "## Receipts",
    "",
  ];
  for (const receipt of workspace.receipt_input.receipts) {
    lines.push(`- ${receipt.receipt_id}: ${receipt.gate_type} / ${receipt.receipt_status} / ${receipt.outcome}`);
  }
  return `${lines.join("\n")}\n`;
}

function compareEntries(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || a.gate_item_id.localeCompare(b.gate_item_id);
}

function compareActorWorkspaces(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
}

function highestPriority(items) {
  return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))[0]?.priority ?? "low";
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
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--intake") args.intakePath = argv[++index];
    else if (arg === "--agenda") args.agendaPath = argv[++index];
    else if (arg === "--no-agenda") args.agendaPath = false;
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-receipt-workspace.mjs [options]

Options:
  --intake <path>   Human review agenda receipt intake artifact
  --agenda <path>   Human review agenda artifact for allowed outcome context
  --no-agenda       Build without agenda enrichment
  --out-dir <dir>   Output directory
  --run-at <iso>    Override generated_at
  --check           Exit non-zero when validation fails
`);
}
