import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_WORK_PACKETS_OUT_DIR = "artifacts/control-plane-work-packets/latest";
export const DEFAULT_CONTROL_PLANE_WORK_PACKETS_ACTION_PLAN_PATH = "artifacts/control-plane-action-plan/latest/control-plane-action-plan.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER = {
  blocked: 0,
  waiting_for_human: 1,
  ready_to_run: 2,
  open: 3,
};

export async function runControlPlaneWorkPackets(options = {}) {
  const result = await buildControlPlaneWorkPackets(options);
  if (options.write !== false) await writeControlPlaneWorkPackets(result, result.output_dir);
  return result;
}

export async function buildControlPlaneWorkPackets(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_WORK_PACKETS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const actionPlanPath = path.resolve(options.actionPlanPath ?? DEFAULT_CONTROL_PLANE_WORK_PACKETS_ACTION_PLAN_PATH);
  const actionPlanResult = await readJsonOrError(actionPlanPath);
  const { workPackets, workItems } = buildWorkPacketCollections(actionPlanResult);
  const result = {
    schema_version: "control-plane-work-packets.v1",
    generated_at: generatedAt,
    work_packet_run_id: `control-plane-work-packets.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    packet_status: derivePacketStatus(workPackets, actionPlanResult),
    sources: [
      buildSource("control_plane_action_plan", "Control Plane Action Plan", actionPlanPath, actionPlanResult),
    ],
    summary: summarizeWorkPackets(workPackets, workItems, actionPlanResult),
    work_packets: workPackets,
    work_items: workItems,
  };

  return {
    ...result,
    markdown: renderWorkPacketsMarkdown(result),
  };
}

export async function writeControlPlaneWorkPackets(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-work-packets.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    work_packet_run_id: result.work_packet_run_id,
    output_dir: result.output_dir,
    packet_status: result.packet_status,
    sources: result.sources,
    summary: result.summary,
    work_packets: result.work_packets,
    work_items: result.work_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneWorkPacketsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneWorkPackets(args);
  console.log(`Control plane work packets written to ${result.output_dir}`);
  console.log(`Packet status: ${result.packet_status}`);
  console.log(`Work packets: ${result.summary.work_packet_count}`);
  console.log(`Work items: ${result.summary.work_item_count}`);
  console.log(`Protected packets: ${result.summary.protected_packet_count}`);
}

function buildWorkPacketCollections(actionPlanResult) {
  if (!actionPlanResult.ok) {
    const packet = buildMissingActionPlanPacket(actionPlanResult.error);
    return {
      workPackets: [packet],
      workItems: [],
    };
  }

  const groups = new Map();
  for (const item of actionPlanResult.value?.plan_items ?? []) {
    const packetType = classifyPacketType(item);
    const groupKey = `${packetType}:${item.source_stage}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  }

  const workPackets = [...groups.entries()]
    .map(([groupKey, items]) => buildWorkPacket(groupKey, items))
    .sort(compareWorkPackets);
  const workItems = workPackets.flatMap((packet) => packet.plan_items.map((item, index) => buildWorkItem(packet, item, index)));
  const itemIdsByPacket = new Map();
  for (const item of workItems) {
    if (!itemIdsByPacket.has(item.work_packet_id)) itemIdsByPacket.set(item.work_packet_id, []);
    itemIdsByPacket.get(item.work_packet_id).push(item.work_item_id);
  }

  return {
    workPackets: workPackets.map(({ plan_items, ...packet }) => ({
      ...packet,
      work_item_ids: itemIdsByPacket.get(packet.work_packet_id) ?? [],
    })),
    workItems,
  };
}

function buildMissingActionPlanPacket(error) {
  return {
    work_packet_id: "work-packet.source.control-plane-action-plan.missing",
    packet_type: "source_recovery",
    source_stage: "control_plane_action_plan",
    priority: "critical",
    status: "blocked",
    title: "Recover missing Control Plane Action Plan",
    reason: `Control Plane Action Plan could not be read: ${error}`,
    item_count: 0,
    plan_item_ids: [],
    work_item_ids: [],
    recommended_actions: ["run_control_plane_plan"],
    next_commands: ["npm run control-plane:plan"],
    requires_human: false,
    protected_action: false,
    checklist: [
      "Run the Control Plane Action Plan stage.",
      "Rebuild the work packets after the action plan artifact exists.",
    ],
  };
}

function buildWorkPacket(groupKey, items) {
  const [packetType, sourceStage] = groupKey.split(":");
  const priority = highestPriority(items);
  const requiresHuman = items.some((item) => item.requires_human);
  const protectedAction = items.some((item) => item.protected_action);
  const status = deriveWorkPacketStatus(items, requiresHuman, protectedAction);
  return {
    work_packet_id: `work-packet.${packetType}.${slugify(sourceStage)}`,
    packet_type: packetType,
    source_stage: sourceStage,
    priority,
    status,
    title: titleForPacket(packetType, sourceStage, items),
    reason: reasonForPacket(packetType, items),
    item_count: items.length,
    plan_item_ids: items.map((item) => item.plan_item_id),
    work_item_ids: [],
    recommended_actions: unique(items.flatMap((item) => item.recommended_actions ?? [])),
    next_commands: unique(items.flatMap((item) => item.next_commands ?? [])),
    requires_human: requiresHuman,
    protected_action: protectedAction,
    checklist: checklistForPacket(packetType, items),
    plan_items: items,
  };
}

function buildWorkItem(packet, item, index) {
  return {
    work_item_id: `${packet.work_packet_id}.item.${String(index + 1).padStart(2, "0")}`,
    work_packet_id: packet.work_packet_id,
    plan_item_id: item.plan_item_id,
    source_stage: item.source_stage,
    priority: item.priority,
    status: item.status,
    title: item.title,
    reason: item.reason,
    next_commands: item.next_commands ?? [],
    requires_human: item.requires_human,
    protected_action: item.protected_action,
  };
}

function classifyPacketType(item) {
  if (item.protected_action) return "protected_action";
  if (item.requires_human) return "human_review";
  if ((item.next_commands ?? []).length > 0 && item.status !== "blocked") return "command_rerun";
  if ((item.next_commands ?? []).length > 0) return "stage_recheck";
  if (item.status === "blocked") return "investigation";
  return "source_review";
}

function deriveWorkPacketStatus(items, requiresHuman, protectedAction) {
  if (protectedAction || items.some((item) => item.status === "blocked")) return "blocked";
  if (requiresHuman) return "waiting_for_human";
  if (items.some((item) => item.status === "ready_to_run")) return "ready_to_run";
  return "open";
}

function derivePacketStatus(workPackets, actionPlanResult) {
  if (!actionPlanResult.ok) return "blocked";
  if (workPackets.some((packet) => packet.status === "blocked")) return "blocked";
  if (workPackets.some((packet) => packet.status === "waiting_for_human")) return "waiting_for_human";
  if (workPackets.some((packet) => packet.status === "ready_to_run")) return "ready_to_run";
  if (workPackets.length > 0) return "open";
  return "clear";
}

function summarizeWorkPackets(workPackets, workItems, actionPlanResult) {
  return {
    packet_status: derivePacketStatus(workPackets, actionPlanResult),
    action_plan_available: actionPlanResult.ok,
    source_plan_id: actionPlanResult.value?.plan_id ?? null,
    source_plan_status: actionPlanResult.value?.plan_status ?? null,
    source_plan_item_count: actionPlanResult.value?.summary?.plan_item_count ?? 0,
    work_packet_count: workPackets.length,
    work_item_count: workItems.length,
    blocked_packet_count: workPackets.filter((packet) => packet.status === "blocked").length,
    human_packet_count: workPackets.filter((packet) => packet.requires_human).length,
    protected_packet_count: workPackets.filter((packet) => packet.protected_action).length,
    command_packet_count: workPackets.filter((packet) => packet.packet_type === "command_rerun" || packet.packet_type === "stage_recheck").length,
    ready_to_run_packet_count: workPackets.filter((packet) => packet.status === "ready_to_run").length,
    waiting_for_human_packet_count: workPackets.filter((packet) => packet.status === "waiting_for_human").length,
    next_command_count: unique(workPackets.flatMap((packet) => packet.next_commands)).length,
    by_packet_type: countBy(workPackets, "packet_type"),
    by_status: countBy(workPackets, "status"),
    by_source_stage: countBy(workPackets, "source_stage"),
  };
}

function titleForPacket(packetType, sourceStage, items) {
  const label = sourceStage.replaceAll("_", " ");
  if (packetType === "protected_action") return `Protected action packet: ${label}`;
  if (packetType === "human_review") return `Human review packet: ${label}`;
  if (packetType === "command_rerun") return `Command rerun packet: ${label}`;
  if (packetType === "stage_recheck") return `Stage recheck packet: ${label}`;
  if (packetType === "source_recovery") return `Source recovery packet: ${label}`;
  if (packetType === "investigation") return `Investigation packet: ${label}`;
  return `Source review packet: ${label} (${items.length})`;
}

function reasonForPacket(packetType, items) {
  if (packetType === "protected_action") return `${items.length} item(s) need explicit protected-action handling before automation can continue.`;
  if (packetType === "human_review") return `${items.length} item(s) need a human decision or review record.`;
  if (packetType === "command_rerun") return `${items.length} item(s) can be advanced by rerunning safe local commands.`;
  if (packetType === "stage_recheck") return `${items.length} item(s) need the related stage rerun after blockers are addressed.`;
  if (packetType === "investigation") return `${items.length} blocked item(s) need source inspection.`;
  return `${items.length} item(s) remain open.`;
}

function checklistForPacket(packetType, items) {
  const checklist = [];
  if (packetType === "protected_action") {
    checklist.push("Confirm the protected action outside the harness before marking it complete.");
    checklist.push("Record delivery, merge, or receipt reference in the appropriate receipt input.");
    checklist.push("Rerun closeout validation and dashboard build after the reference is recorded.");
  } else if (packetType === "human_review") {
    checklist.push("Open the relevant approval, gate, or dashboard source.");
    checklist.push("Record a decision or review note in the matching approval/decision artifact.");
    checklist.push("Rerun the affected stage and rebuild the dashboard.");
  } else if (packetType === "command_rerun" || packetType === "stage_recheck") {
    for (const command of unique(items.flatMap((item) => item.next_commands ?? []))) {
      checklist.push(`Run: ${command}`);
    }
    checklist.push("Rebuild the dashboard after commands finish.");
  } else {
    checklist.push("Inspect the source artifact referenced by each work item.");
    checklist.push("Resolve the underlying blocker, then rerun the affected stage.");
  }
  return checklist;
}

function highestPriority(items) {
  return items.map((item) => item.priority).sort((left, right) => PRIORITY_ORDER[left] - PRIORITY_ORDER[right])[0] ?? "medium";
}

function compareWorkPackets(a, b) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    a.source_stage.localeCompare(b.source_stage) ||
    a.packet_type.localeCompare(b.packet_type)
  );
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

function renderWorkPacketsMarkdown(result) {
  const lines = [];
  lines.push("# Control Plane Work Packets");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Packet status: ${result.packet_status}`);
  lines.push("");
  lines.push(`- Work packets: ${result.summary.work_packet_count}`);
  lines.push(`- Work items: ${result.summary.work_item_count}`);
  lines.push(`- Human packets: ${result.summary.human_packet_count}`);
  lines.push(`- Protected packets: ${result.summary.protected_packet_count}`);
  lines.push(`- Next commands: ${result.summary.next_command_count}`);
  lines.push("");
  lines.push("## Packets");
  lines.push("");
  for (const packet of result.work_packets) {
    lines.push(`- [${packet.priority}] ${packet.title} (${packet.status}, ${packet.item_count} item(s))`);
    for (const step of packet.checklist) {
      lines.push(`  - ${step}`);
    }
  }
  if (result.work_packets.length === 0) lines.push("- No work packets.");
  return `${lines.join("\n")}\n`;
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    actionPlanPath: DEFAULT_CONTROL_PLANE_WORK_PACKETS_ACTION_PLAN_PATH,
    outDir: DEFAULT_CONTROL_PLANE_WORK_PACKETS_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--action-plan") parsed.actionPlanPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-work-packets.mjs [options]

Options:
  --action-plan <path>    control-plane-action-plan.json path.
  --out-dir <folder>     Output directory.
  --run-at <iso>         Deterministic generated_at timestamp.
  -h, --help             Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
