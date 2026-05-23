import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_GATE_RECEIPT_APPLICATION_OUT_DIR = "artifacts/control-plane-human-gate-receipt-application/latest";
export const DEFAULT_HUMAN_GATE_RECEIPT_VALIDATION_PATH = "artifacts/control-plane-human-gate-receipt-validation/latest/control-plane-human-gate-receipt-validation.json";
export const DEFAULT_HUMAN_GATES_PATH = "artifacts/control-plane-human-gates/latest/control-plane-human-gates.json";

const APPLIED_GATE_STATUSES = {
  resolved: "closed",
  deferred: "deferred",
  rejected: "rejected",
  failed: "failed",
  cancelled: "cancelled",
};

export async function runControlPlaneHumanGateReceiptApplication(options = {}) {
  const result = await buildControlPlaneHumanGateReceiptApplication(options);
  if (options.write !== false) await writeControlPlaneHumanGateReceiptApplication(result, result.output_dir);
  return result;
}

export async function buildControlPlaneHumanGateReceiptApplication(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_GATE_RECEIPT_APPLICATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const validationPath = path.resolve(options.validationPath ?? DEFAULT_HUMAN_GATE_RECEIPT_VALIDATION_PATH);
  const humanGatesPath = path.resolve(options.humanGatesPath ?? DEFAULT_HUMAN_GATES_PATH);
  const validationResult = await readJsonOrError(validationPath);
  const humanGatesResult = await readJsonOrError(humanGatesPath);
  const validation = validationResult.value;
  const humanGateArtifact = humanGatesResult.value;
  const validationErrors = validation?.summary?.error_count ?? validation?.receipt_errors?.length ?? 0;
  const readyReceipts = validation?.validated_receipts_to_apply?.receipts ?? [];
  const gateItemById = new Map((humanGateArtifact?.gate_items ?? []).map((item) => [item.gate_item_id, item]));
  const applicationStatus = deriveApplicationStatus(validationResult, humanGatesResult, validationErrors, readyReceipts.length);
  const canApply = applicationStatus === "applied";
  const appliedReceipts = canApply
    ? readyReceipts.map((receipt) => buildAppliedReceipt(receipt, gateItemById.get(receipt.gate_item_id)))
    : [];
  const patchedGateItems = canApply ? buildPatchedGateItems(humanGateArtifact?.gate_items ?? [], appliedReceipts) : [];
  const auditEvents = canApply
    ? appliedReceipts.map((receipt) => buildAuditEvent(receipt, generatedAt))
    : [];
  const application = {
    schema_version: "control-plane-human-gate-receipt-application.v1",
    generated_at: generatedAt,
    application_id: `control-plane-human-gate-receipt-application.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    application_status: applicationStatus,
    safe_to_apply: canApply,
    protected_actions_executed: false,
    sources: [
      buildSource("human_gate_receipt_validation", "Human Gate Receipt Validation", validationPath, validationResult),
      buildSource("control_plane_human_gates", "Control Plane Human Gates", humanGatesPath, humanGatesResult),
    ],
    summary: summarizeApplication({
      validationResult,
      humanGatesResult,
      validation,
      validationErrors,
      readyReceipts,
      appliedReceipts,
      patchedGateItems,
      auditEvents,
      applicationStatus,
    }),
    validated_receipts_to_apply: validation?.validated_receipts_to_apply ?? emptyValidatedReceipts(generatedAt),
    applied_receipts: appliedReceipts,
    pending_receipts: (validation?.validation_items ?? []).filter((item) => item.validation_status === "pending_receipt"),
    receipt_errors: validation?.receipt_errors ?? [],
    audit_events: auditEvents,
    patched_gate_items: patchedGateItems,
  };

  return {
    ...application,
    markdown: renderApplicationMarkdown(application),
  };
}

export async function writeControlPlaneHumanGateReceiptApplication(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-human-gate-receipt-application.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    application_id: result.application_id,
    output_dir: result.output_dir,
    application_status: result.application_status,
    safe_to_apply: result.safe_to_apply,
    protected_actions_executed: result.protected_actions_executed,
    sources: result.sources,
    summary: result.summary,
    validated_receipts_to_apply: result.validated_receipts_to_apply,
    applied_receipts: result.applied_receipts,
    pending_receipts: result.pending_receipts,
    receipt_errors: result.receipt_errors,
    audit_events: result.audit_events,
    patched_gate_items: result.patched_gate_items,
  });
  await writeJson(path.join(outDir, "validated-human-gate-receipts.json"), result.validated_receipts_to_apply);
  await writeJson(path.join(outDir, "applied-human-gate-receipts.json"), {
    generated_at: result.generated_at,
    protected_actions_executed: result.protected_actions_executed,
    count: result.applied_receipts.length,
    receipts: result.applied_receipts,
  });
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  if (result.patched_gate_items.length > 0) await writeJson(path.join(outDir, "patched-human-gate-items.json"), result.patched_gate_items);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneHumanGateReceiptApplicationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneHumanGateReceiptApplication(args);
  console.log(`Control plane human gate receipt application written to ${result.output_dir}`);
  console.log(`Application status: ${result.application_status}`);
  console.log(`Applied receipts: ${result.summary.applied_receipt_count}`);
  console.log(`Patched gate items: ${result.summary.patched_gate_item_count}`);
  console.log(`Protected actions executed: ${result.protected_actions_executed}`);
}

function deriveApplicationStatus(validationResult, humanGatesResult, validationErrors, readyReceiptCount) {
  if (!validationResult.ok) return "blocked_missing_validation";
  if (!humanGatesResult.ok) return "blocked_missing_human_gates";
  if (validationErrors > 0) return "blocked_validation_errors";
  if (readyReceiptCount === 0) return "nothing_to_apply";
  return "applied";
}

function buildAppliedReceipt(receipt, gateItem) {
  return {
    receipt_id: receipt.receipt_id,
    gate_item_id: receipt.gate_item_id,
    source_plan_item_id: receipt.source_plan_item_id,
    gate_type: receipt.gate_type,
    source_stage: gateItem?.source_stage ?? receipt.source_stage ?? "unknown",
    receipt_status: receipt.receipt_status,
    outcome: receipt.outcome,
    applied_gate_status: APPLIED_GATE_STATUSES[receipt.receipt_status] ?? "closed",
    decided_by: receipt.decided_by,
    decided_at: receipt.decided_at,
    reviewer: receipt.reviewer ?? null,
    decision_reference: receipt.decision_reference,
    decision_notes: receipt.decision_notes,
    protected_action_reference: receipt.protected_action_reference ?? null,
    command_result: receipt.command_result ?? null,
    commands_run: receipt.commands_run ?? [],
    completed_action_refs: receipt.completed_action_refs ?? [],
    gate_found: Boolean(gateItem),
    protected_action: gateItem?.protected_action ?? false,
    safe_handling: {
      ...(gateItem?.safe_handling ?? {}),
      auto_execute_allowed: false,
    },
    protected_action_executed: false,
  };
}

function buildPatchedGateItems(gateItems, appliedReceipts) {
  const receiptByGateItemId = new Map(appliedReceipts.map((receipt) => [receipt.gate_item_id, receipt]));
  return gateItems
    .filter((item) => receiptByGateItemId.has(item.gate_item_id))
    .map((item) => {
      const receipt = receiptByGateItemId.get(item.gate_item_id);
      return {
        ...item,
        status: receipt.applied_gate_status,
        applied_receipt_id: receipt.receipt_id,
        applied_outcome: receipt.outcome,
        applied_at: receipt.decided_at,
        decision_reference: receipt.decision_reference,
        protected_action_executed: false,
      };
    });
}

function buildAuditEvent(receipt, generatedAt) {
  return {
    type: "human_gate.receipt.applied",
    time: generatedAt,
    actor: receipt.decided_by,
    correlation_id: receipt.gate_item_id,
    subject: {
      receipt_id: receipt.receipt_id,
      gate_item_id: receipt.gate_item_id,
      gate_type: receipt.gate_type,
      receipt_status: receipt.receipt_status,
      outcome: receipt.outcome,
      applied_gate_status: receipt.applied_gate_status,
      protected_action_executed: false,
    },
  };
}

function summarizeApplication(context) {
  return {
    application_status: context.applicationStatus,
    validation_available: context.validationResult.ok,
    human_gates_available: context.humanGatesResult.ok,
    validation_status: context.validation?.validation_status ?? null,
    validation_error_count: context.validationErrors,
    ready_receipt_count: context.readyReceipts.length,
    pending_receipt_count: context.validation?.summary?.pending_receipt_count ?? 0,
    invalid_receipt_count: context.validation?.summary?.invalid_receipt_count ?? 0,
    applied_receipt_count: context.appliedReceipts.length,
    patched_gate_item_count: context.patchedGateItems.length,
    protected_action_executed_count: 0,
    protected_applied_count: context.appliedReceipts.filter((receipt) => receipt.protected_action).length,
    evidence_decision_applied_count: context.appliedReceipts.filter((receipt) => receipt.gate_type === "evidence_decision").length,
    audit_event_count: context.auditEvents.length,
    receipt_error_count: context.validation?.receipt_errors?.length ?? 0,
    by_receipt_status: countBy(context.appliedReceipts, "receipt_status"),
    by_outcome: countBy(context.appliedReceipts, "outcome"),
    by_gate_type: countBy(context.appliedReceipts, "gate_type"),
    by_source_stage: countBy(context.appliedReceipts, "source_stage"),
  };
}

function emptyValidatedReceipts(generatedAt) {
  return {
    schema_version: "control-plane-human-gate-receipts-input.v1",
    generated_at: generatedAt,
    human_gate_id: "control-plane-human-gates.unknown",
    instructions: "No validated human gate receipts were available.",
    receipts: [],
  };
}

function renderApplicationMarkdown(application) {
  const lines = [];
  lines.push("# Control Plane Human Gate Receipt Application");
  lines.push("");
  lines.push(`Generated: ${application.generated_at}`);
  lines.push(`Application status: ${application.application_status}`);
  lines.push(`Protected actions executed: ${application.protected_actions_executed}`);
  lines.push("");
  lines.push(`- Ready receipts: ${application.summary.ready_receipt_count}`);
  lines.push(`- Applied receipts: ${application.summary.applied_receipt_count}`);
  lines.push(`- Patched gate items: ${application.summary.patched_gate_item_count}`);
  lines.push(`- Audit events: ${application.summary.audit_event_count}`);
  lines.push("");
  lines.push("## Applied Receipts");
  lines.push("");
  for (const receipt of application.applied_receipts) {
    lines.push(`- ${receipt.gate_item_id}: ${receipt.receipt_status}/${receipt.outcome} -> ${receipt.applied_gate_status}`);
  }
  if (application.applied_receipts.length === 0) lines.push("- No human gate receipts applied.");
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    validationPath: DEFAULT_HUMAN_GATE_RECEIPT_VALIDATION_PATH,
    humanGatesPath: DEFAULT_HUMAN_GATES_PATH,
    outDir: DEFAULT_HUMAN_GATE_RECEIPT_APPLICATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--validation") parsed.validationPath = argv[++index];
    else if (arg === "--human-gates") parsed.humanGatesPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-human-gate-receipt-application.mjs [options]

Options:
  --validation <path>    control-plane-human-gate-receipt-validation.json path.
  --human-gates <path>   control-plane-human-gates.json path.
  --out-dir <folder>     Output directory.
  --run-at <iso>         Deterministic generated_at timestamp.
  -h, --help             Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
