import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_AUDIT_TRAIL_OUT_DIR = "artifacts/control-plane-audit-trail/latest";

export const DEFAULT_AUDIT_SOURCE_PATHS = {
  approvalDecisionPath: "artifacts/approval-decisions/latest/approval-decision-result.json",
  approvalInboxDecisionPath: "artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json",
  deliveryReceiptLedgerPath: "artifacts/delivery-receipts/latest/delivery-receipt-ledger.json",
  closeoutReceiptApplicationPath: "artifacts/delivery-closeout-application/latest/closeout-receipt-application.json",
  humanGateReceiptApplicationPath: "artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json",
  workPacketReceiptApplicationPath: "artifacts/control-plane-work-packet-receipt-application/latest/control-plane-work-packet-receipt-application.json",
};

const DEFAULT_AUDIT_SOURCES = [
  sourceDefinition("approval_decisions", "Approval Decisions", "approvalDecisionPath"),
  sourceDefinition("approval_inbox_decisions", "Approval Inbox Decisions", "approvalInboxDecisionPath"),
  sourceDefinition("delivery_receipts", "Delivery Receipt Ledger", "deliveryReceiptLedgerPath"),
  sourceDefinition("closeout_receipt_application", "Closeout Receipt Application", "closeoutReceiptApplicationPath"),
  sourceDefinition("control_plane_human_gate_receipt_application", "Control Plane Human Gate Receipt Application", "humanGateReceiptApplicationPath"),
  sourceDefinition("control_plane_work_packet_receipt_application", "Control Plane Work Packet Receipt Application", "workPacketReceiptApplicationPath"),
];

export async function runControlPlaneAuditTrail(options = {}) {
  const result = await buildControlPlaneAuditTrail(options);
  if (options.write !== false) await writeControlPlaneAuditTrail(result, result.output_dir);
  return result;
}

export async function buildControlPlaneAuditTrail(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_AUDIT_TRAIL_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceDefinitions = buildSourceDefinitions(options);
  const sources = await readAuditSources(sourceDefinitions);
  const extractedEvents = sources.flatMap((source) => extractAuditEvents(source, generatedAt));
  const { auditEvents, duplicateEvents } = dedupeAuditEvents(extractedEvents);
  const auditTrail = {
    schema_version: "control-plane-audit-trail.v1",
    generated_at: generatedAt,
    audit_trail_id: `control-plane-audit-trail.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    audit_status: deriveAuditStatus(sources, auditEvents),
    summary: summarizeAuditTrail(sources, auditEvents, duplicateEvents),
    sources: sources.map(({ artifact: _artifact, ...source }) => source),
    audit_events: auditEvents,
    duplicate_events: duplicateEvents,
  };

  return {
    ...auditTrail,
    markdown: renderAuditTrailMarkdown(auditTrail),
  };
}

export async function writeControlPlaneAuditTrail(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-audit-trail.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    audit_trail_id: result.audit_trail_id,
    output_dir: result.output_dir,
    audit_status: result.audit_status,
    summary: result.summary,
    sources: result.sources,
    audit_events: result.audit_events,
    duplicate_events: result.duplicate_events,
  });
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneAuditTrailCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneAuditTrail(args);
  console.log(`Control plane audit trail written to ${result.output_dir}`);
  console.log(`Audit status: ${result.audit_status}`);
  console.log(`Audit events: ${result.summary.audit_event_count}`);
  console.log(`Missing sources: ${result.summary.missing_source_count}`);
}

function sourceDefinition(sourceId, label, optionName) {
  return {
    source_id: sourceId,
    label,
    option_name: optionName,
    default_path: DEFAULT_AUDIT_SOURCE_PATHS[optionName],
  };
}

function buildSourceDefinitions(options) {
  return DEFAULT_AUDIT_SOURCES
    .filter((source) => options[source.option_name] !== false)
    .map((source) => ({
      source_id: source.source_id,
      label: source.label,
      path: path.resolve(options[source.option_name] ?? source.default_path),
    }));
}

async function readAuditSources(sourceDefinitions) {
  const sources = [];
  for (const source of sourceDefinitions) {
    const result = await readJsonOrError(source.path);
    const artifact = result.value;
    sources.push({
      source_id: source.source_id,
      label: source.label,
      path: source.path,
      available: result.ok,
      schema_version: artifact?.schema_version ?? null,
      generated_at: artifact?.generated_at ?? null,
      event_count: artifact?.audit_events?.length ?? 0,
      error: result.ok ? null : result.error,
      artifact,
    });
  }
  return sources;
}

function extractAuditEvents(source, generatedAt) {
  if (!source.available) return [];
  return (source.artifact?.audit_events ?? []).map((event, index) => normalizeAuditEvent(source, event, index, generatedAt));
}

function normalizeAuditEvent(source, event, index, generatedAt) {
  const eventType = String(event.type ?? "unknown");
  const time = event.time ?? source.generated_at ?? generatedAt;
  const actor = normalizeActor(event.actor);
  const subject = normalizeSubject(event.subject, eventType);
  const rawEventId = event.id ?? event.event_id ?? null;
  const auditEventId = rawEventId ?? `audit.${source.source_id}.${shortHash(`${source.source_id}:${eventType}:${time}:${index}:${JSON.stringify(event.subject ?? {})}`)}`;
  const data = event.data ?? event.subject ?? {};
  const metadata = event.metadata ?? {};
  const protectedActionExecuted = Boolean(
    event.subject?.protected_action_executed
      ?? event.data?.protected_action_executed
      ?? eventType === "delivery.executed",
  );
  const protectedActionEvent = protectedActionExecuted
    || eventType.startsWith("delivery.")
    || Boolean(data.delivery_action_id)
    || metadata.item_type === "gate_review";

  return {
    schema_version: "control-plane-audit-event.v1",
    audit_event_id: auditEventId,
    raw_event_id: rawEventId,
    source_id: source.source_id,
    source_label: source.label,
    source_schema_version: source.schema_version,
    source_generated_at: source.generated_at,
    event_index: index,
    event_type: eventType,
    event_category: eventType.split(".")[0] ?? "unknown",
    time,
    tenant_id: event.tenant_id ?? data.tenant_id ?? metadata.tenant_id ?? "tenant.unknown",
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    actor_display_name: actor.display_name,
    subject_type: subject.subject_type,
    subject_id: subject.subject_id,
    correlation_id: event.correlation_id ?? null,
    policy_snapshot_id: event.policy_snapshot_id ?? null,
    protected_action_event: protectedActionEvent,
    protected_action_executed: protectedActionExecuted,
    data,
    metadata,
  };
}

function normalizeActor(actor) {
  if (typeof actor === "string" && actor.length > 0) {
    return {
      actor_type: actor.startsWith("agent.") ? "agent" : "human",
      actor_id: actor,
      display_name: actor,
    };
  }
  if (actor && typeof actor === "object") {
    return {
      actor_type: actor.actor_type ?? "unknown",
      actor_id: actor.actor_id ?? actor.display_name ?? "unknown",
      display_name: actor.display_name ?? actor.actor_id ?? "unknown",
    };
  }
  return {
    actor_type: "unknown",
    actor_id: "unknown",
    display_name: "unknown",
  };
}

function normalizeSubject(subject, eventType) {
  if (subject?.subject_type && subject?.subject_id) {
    return {
      subject_type: subject.subject_type,
      subject_id: subject.subject_id,
    };
  }
  if (subject?.gate_item_id) {
    return {
      subject_type: "human_gate",
      subject_id: subject.gate_item_id,
    };
  }
  if (subject?.work_packet_id) {
    return {
      subject_type: "work_packet",
      subject_id: subject.work_packet_id,
    };
  }
  if (subject?.packet_id) {
    return {
      subject_type: "delivery_packet",
      subject_id: subject.packet_id,
    };
  }
  if (subject?.receipt_id) {
    return {
      subject_type: "receipt",
      subject_id: subject.receipt_id,
    };
  }
  return {
    subject_type: eventType.split(".")[0] ?? "unknown",
    subject_id: "unknown",
  };
}

function dedupeAuditEvents(events) {
  const seen = new Map();
  const auditEvents = [];
  const duplicateEvents = [];
  for (const event of [...events].sort(compareAuditEvents)) {
    const dedupeKey = event.raw_event_id ? `raw:${event.raw_event_id}` : `normalized:${event.audit_event_id}`;
    if (seen.has(dedupeKey)) {
      duplicateEvents.push({
        duplicate_audit_event_id: event.audit_event_id,
        kept_audit_event_id: seen.get(dedupeKey).audit_event_id,
        source_id: event.source_id,
        event_type: event.event_type,
        time: event.time,
      });
      continue;
    }
    seen.set(dedupeKey, event);
    auditEvents.push(event);
  }
  return { auditEvents, duplicateEvents };
}

function deriveAuditStatus(sources, auditEvents) {
  const missingSources = sources.filter((source) => !source.available).length;
  if (sources.length === 0 || missingSources === sources.length) return "missing_sources";
  if (missingSources > 0) return "partial";
  if (auditEvents.length === 0) return "empty";
  return "complete";
}

function summarizeAuditTrail(sources, auditEvents, duplicateEvents) {
  return {
    source_count: sources.length,
    available_source_count: sources.filter((source) => source.available).length,
    missing_source_count: sources.filter((source) => !source.available).length,
    audit_event_count: auditEvents.length,
    duplicate_event_count: duplicateEvents.length,
    protected_action_event_count: auditEvents.filter((event) => event.protected_action_event).length,
    protected_action_executed_count: auditEvents.filter((event) => event.protected_action_executed).length,
    human_actor_event_count: auditEvents.filter((event) => event.actor_type === "human").length,
    machine_actor_event_count: auditEvents.filter((event) => ["agent", "script", "system"].includes(event.actor_type)).length,
    unknown_actor_event_count: auditEvents.filter((event) => event.actor_type === "unknown").length,
    approval_event_count: auditEvents.filter((event) => event.event_category === "approval" || event.event_category === "approval_inbox").length,
    delivery_event_count: auditEvents.filter((event) => event.event_category === "delivery").length,
    human_gate_event_count: auditEvents.filter((event) => event.event_category === "human_gate").length,
    work_packet_event_count: auditEvents.filter((event) => event.event_category === "work_packet").length,
    by_event_type: countBy(auditEvents, "event_type"),
    by_source_id: countBy(auditEvents, "source_id"),
    by_actor_type: countBy(auditEvents, "actor_type"),
    by_tenant_id: countBy(auditEvents, "tenant_id"),
  };
}

function renderAuditTrailMarkdown(auditTrail) {
  const lines = [];
  lines.push("# Control Plane Audit Trail");
  lines.push("");
  lines.push(`Generated: ${auditTrail.generated_at}`);
  lines.push(`Audit status: ${auditTrail.audit_status}`);
  lines.push("");
  lines.push(`- Sources: ${auditTrail.summary.available_source_count}/${auditTrail.summary.source_count}`);
  lines.push(`- Audit events: ${auditTrail.summary.audit_event_count}`);
  lines.push(`- Duplicate events skipped: ${auditTrail.summary.duplicate_event_count}`);
  lines.push(`- Protected action events: ${auditTrail.summary.protected_action_event_count}`);
  lines.push(`- Protected action executed events: ${auditTrail.summary.protected_action_executed_count}`);
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  for (const source of auditTrail.sources) {
    lines.push(`- ${source.source_id}: ${source.available ? "available" : "missing"} (${source.event_count} event(s))`);
  }
  lines.push("");
  lines.push("## Event Types");
  lines.push("");
  for (const [type, count] of Object.entries(auditTrail.summary.by_event_type)) {
    lines.push(`- ${type}: ${count}`);
  }
  if (Object.keys(auditTrail.summary.by_event_type).length === 0) lines.push("- No audit events found.");
  return `${lines.join("\n")}\n`;
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

function compareAuditEvents(left, right) {
  return String(left.time).localeCompare(String(right.time))
    || String(left.event_type).localeCompare(String(right.event_type))
    || String(left.audit_event_id).localeCompare(String(right.audit_event_id));
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

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CONTROL_PLANE_AUDIT_TRAIL_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--approval-decisions") parsed.approvalDecisionPath = argv[++index];
    else if (arg === "--no-approval-decisions") parsed.approvalDecisionPath = false;
    else if (arg === "--approval-inbox-decisions") parsed.approvalInboxDecisionPath = argv[++index];
    else if (arg === "--no-approval-inbox-decisions") parsed.approvalInboxDecisionPath = false;
    else if (arg === "--delivery-receipts") parsed.deliveryReceiptLedgerPath = argv[++index];
    else if (arg === "--no-delivery-receipts") parsed.deliveryReceiptLedgerPath = false;
    else if (arg === "--closeout-application") parsed.closeoutReceiptApplicationPath = argv[++index];
    else if (arg === "--no-closeout-application") parsed.closeoutReceiptApplicationPath = false;
    else if (arg === "--human-gate-application") parsed.humanGateReceiptApplicationPath = argv[++index];
    else if (arg === "--no-human-gate-application") parsed.humanGateReceiptApplicationPath = false;
    else if (arg === "--work-packet-application") parsed.workPacketReceiptApplicationPath = argv[++index];
    else if (arg === "--no-work-packet-application") parsed.workPacketReceiptApplicationPath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-audit-trail.mjs [options]

Options:
  --approval-decisions <path>          approval-decision-result.json path.
  --no-approval-decisions              Do not include Approval Decisions audit events.
  --approval-inbox-decisions <path>    approval-inbox-decision-result.json path.
  --no-approval-inbox-decisions        Do not include Approval Inbox Decisions audit events.
  --delivery-receipts <path>           delivery-receipt-ledger.json path.
  --no-delivery-receipts               Do not include Delivery Receipt Ledger audit events.
  --closeout-application <path>        closeout-receipt-application.json path.
  --no-closeout-application            Do not include Closeout Receipt Application audit events.
  --human-gate-application <path>      control-plane-human-gate-receipt-application.json path.
  --no-human-gate-application          Do not include Human Gate Receipt Application audit events.
  --work-packet-application <path>     control-plane-work-packet-receipt-application.json path.
  --no-work-packet-application         Do not include Work Packet Receipt Application audit events.
  --out-dir <folder>                   Output directory.
  --run-at <iso>                       Deterministic generated_at timestamp.
  -h, --help                           Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
