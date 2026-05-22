import { readMatterFile } from "./matter-harness.mjs";

const OPEN_STATUSES = new Set(["open", "blocked", "requested", "missing", "in-review", "pending"]);
const IMPORTANT_SEVERITY = new Set(["high", "critical"]);

export async function readDealMatter(path) {
  return readMatterFile(path);
}

export function buildDealControlBrief(matter, options = {}) {
  const today = options.today ?? localDateISO("Asia/Seoul");
  const deal = matter.deal_control ?? {};
  const vdrRequests = deal.vdr_requests ?? [];
  const qaItems = deal.qa_items ?? [];
  const negotiationPoints = deal.negotiation_points ?? [];
  const cpChecklist = deal.cp_checklist ?? [];

  const missingVdr = vdrRequests.filter((item) => ["missing", "requested"].includes(item.status));
  const unansweredQa = qaItems.filter((item) => OPEN_STATUSES.has(item.status));
  const openNegotiationPoints = negotiationPoints.filter((item) => OPEN_STATUSES.has(item.status));
  const importantNegotiationPoints = openNegotiationPoints.filter((item) => IMPORTANT_SEVERITY.has(item.severity));
  const incompleteCp = cpChecklist.filter((item) => item.status !== "complete");
  const blockedCp = cpChecklist.filter((item) => item.status === "blocked");

  return {
    generated_on: today,
    matter_id: matter.matter_id,
    title: matter.title,
    client: matter.client,
    role: deal.role ?? "unknown",
    signing_target: deal.signing_target,
    closing_target: deal.closing_target,
    missing_vdr: sortByDue(missingVdr),
    unanswered_qa: sortByDue(unansweredQa),
    open_negotiation_points: openNegotiationPoints,
    important_negotiation_points: importantNegotiationPoints,
    incomplete_cp: sortByDue(incompleteCp),
    blocked_cp: sortByDue(blockedCp),
    review_required: matter.review_workflow?.client_facing_requires_partner_approval ?? true,
  };
}

export function renderDealControlBrief(brief) {
  const lines = [];
  lines.push(`# M&A Deal Control Brief: ${brief.matter_id}`);
  lines.push("");
  lines.push(`Generated: ${brief.generated_on}`);
  lines.push(`Client: ${brief.client}`);
  lines.push(`Matter: ${brief.title}`);
  lines.push(`Role: ${brief.role}`);
  lines.push(`Signing target: ${brief.signing_target ?? "not set"}`);
  lines.push(`Closing target: ${brief.closing_target ?? "not set"}`);
  lines.push("");
  lines.push("## Deal Snapshot");
  lines.push(`- Missing/requested VDR items: ${brief.missing_vdr.length}`);
  lines.push(`- Unanswered Q&A items: ${brief.unanswered_qa.length}`);
  lines.push(`- Open negotiation points: ${brief.open_negotiation_points.length}`);
  lines.push(`- High/critical negotiation points: ${brief.important_negotiation_points.length}`);
  lines.push(`- Incomplete CP/closing items: ${brief.incomplete_cp.length}`);
  lines.push(`- Blocked CP/closing items: ${brief.blocked_cp.length}`);
  lines.push("");

  append(lines, "Missing or Requested VDR Items", brief.missing_vdr, (item) =>
    `- ${item.due ?? "no due"} [${item.status}] ${item.title} (${item.owner ?? "unassigned"}, issue: ${item.issue ?? "general"})`,
  );
  append(lines, "Unanswered Q&A", brief.unanswered_qa, (item) =>
    `- ${item.due ?? "no due"} [${item.status}] ${item.question} (${item.owner ?? "unassigned"})`,
  );
  append(lines, "High/Critical Negotiation Points", brief.important_negotiation_points, (item) =>
    `- [${item.severity}/${item.status}] ${item.clause}: ${item.open_issue} (${item.owner ?? "unassigned"})`,
  );
  append(lines, "Incomplete CP/Closing Checklist", brief.incomplete_cp, (item) =>
    `- ${item.due ?? "no due"} [${item.status}] ${item.title} (${item.owner ?? "unassigned"})`,
  );

  lines.push("## Review Gate");
  lines.push("- This is deal-control support, not a final legal position.");
  lines.push("- Partner approval is required before sending client-facing status, markup strategy, or closing completion confirmations.");
  return `${lines.join("\n")}\n`;
}

function sortByDue(items) {
  return [...items].sort((a, b) => String(a.due ?? "9999-12-31").localeCompare(String(b.due ?? "9999-12-31")));
}

function append(lines, title, items, render) {
  lines.push(`## ${title}`);
  if (items.length === 0) {
    lines.push("- None");
  } else {
    for (const item of items) lines.push(render(item));
  }
  lines.push("");
}

function localDateISO(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
