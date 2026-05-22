import { readFile } from "node:fs/promises";

const CONFIDENTIALITY_LEVELS = new Set([
  "public",
  "internal",
  "client-confidential",
  "privileged",
  "restricted",
]);

const PRACTICE_AREAS = new Set([
  "mna",
  "litigation",
  "shareholder-derivative",
  "corporate-governance",
  "general-corporate",
  "regulatory",
  "other",
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_TASK_STATUSES = new Set(["open", "blocked", "in-review"]);
const OPEN_RISK_STATUSES = new Set(["open", "monitoring"]);
const IMPORTANT_RISK_LEVELS = new Set(["high", "critical"]);

export async function readMatterFile(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}

export function validateMatter(matter) {
  const errors = [];
  const requireString = (path, value) => {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${path} must be a non-empty string`);
    }
  };
  const requireArray = (path, value) => {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
    }
  };
  const requireDate = (path, value) => {
    if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      errors.push(`${path} must be a YYYY-MM-DD date`);
    }
  };

  if (!matter || typeof matter !== "object" || Array.isArray(matter)) {
    return ["matter must be an object"];
  }

  requireString("matter_id", matter.matter_id);
  requireString("title", matter.title);
  requireString("client", matter.client);

  if (!PRACTICE_AREAS.has(matter.practice_area)) {
    errors.push(`practice_area must be one of ${[...PRACTICE_AREAS].join(", ")}`);
  }

  if (!matter.matter_profile || typeof matter.matter_profile !== "object") {
    errors.push("matter_profile must be an object");
  } else {
    requireString("matter_profile.jurisdiction", matter.matter_profile.jurisdiction);
    requireString("matter_profile.responsible_partner", matter.matter_profile.responsible_partner);
    requireString("matter_profile.matter_stage", matter.matter_profile.matter_stage);
    if (!["approved", "approved-with-restrictions", "not-approved", "unknown"].includes(matter.matter_profile.client_ai_consent)) {
      errors.push("matter_profile.client_ai_consent is invalid");
    }
    if (!["cleared", "pending", "restricted", "unknown"].includes(matter.matter_profile.conflict_screen)) {
      errors.push("matter_profile.conflict_screen is invalid");
    }
  }

  if (!matter.confidentiality || typeof matter.confidentiality !== "object") {
    errors.push("confidentiality must be an object");
  } else {
    if (!CONFIDENTIALITY_LEVELS.has(matter.confidentiality.level)) {
      errors.push(`confidentiality.level must be one of ${[...CONFIDENTIALITY_LEVELS].join(", ")}`);
    }
    if (matter.confidentiality.human_approval_required !== true) {
      errors.push("confidentiality.human_approval_required must be true for law-firm harness output");
    }
    if (typeof matter.confidentiality.export_allowed !== "boolean") {
      errors.push("confidentiality.export_allowed must be a boolean");
    }
  }

  requireArray("team", matter.team);
  requireArray("source_register", matter.source_register);
  requireArray("tasks", matter.tasks);
  requireArray("deadlines", matter.deadlines);
  requireArray("communications", matter.communications);
  requireArray("documents", matter.documents);
  requireArray("risks", matter.risks);

  if (!matter.review_workflow || typeof matter.review_workflow !== "object") {
    errors.push("review_workflow must be an object");
  } else {
    requireString("review_workflow.default_reviewer", matter.review_workflow.default_reviewer);
    if (matter.review_workflow.client_facing_requires_partner_approval !== true) {
      errors.push("review_workflow.client_facing_requires_partner_approval must be true");
    }
    if (matter.review_workflow.legal_conclusion_requires_citation !== true) {
      errors.push("review_workflow.legal_conclusion_requires_citation must be true");
    }
  }

  for (const [index, task] of (matter.tasks ?? []).entries()) {
    requireString(`tasks[${index}].id`, task.id);
    requireString(`tasks[${index}].title`, task.title);
    requireString(`tasks[${index}].owner`, task.owner);
    if (!["open", "blocked", "in-review", "done"].includes(task.status)) {
      errors.push(`tasks[${index}].status is invalid`);
    }
    requireDate(`tasks[${index}].due`, task.due);
  }

  for (const [index, deadline] of (matter.deadlines ?? []).entries()) {
    requireString(`deadlines[${index}].id`, deadline.id);
    requireString(`deadlines[${index}].title`, deadline.title);
    requireDate(`deadlines[${index}].date`, deadline.date);
  }

  for (const [index, communication] of (matter.communications ?? []).entries()) {
    requireString(`communications[${index}].id`, communication.id);
    requireString(`communications[${index}].source`, communication.source);
    requireDate(`communications[${index}].date`, communication.date);
    requireString(`communications[${index}].summary`, communication.summary);
  }

  for (const [index, document] of (matter.documents ?? []).entries()) {
    requireString(`documents[${index}].id`, document.id);
    requireString(`documents[${index}].title`, document.title);
    if (!["requested", "received", "in-review", "approved", "missing"].includes(document.status)) {
      errors.push(`documents[${index}].status is invalid`);
    }
  }

  return errors;
}

export function buildMatterBrief(matter, options = {}) {
  const today = options.today ?? localDateISO("Asia/Seoul");
  const todayTime = toDateTime(today);
  const upcomingLimit = todayTime + 7 * 24 * 60 * 60 * 1000;

  const openTasks = matter.tasks
    .filter((task) => OPEN_TASK_STATUSES.has(task.status))
    .sort((a, b) => a.due.localeCompare(b.due));

  const overdueTasks = openTasks.filter((task) => toDateTime(task.due) < todayTime);
  const dueSoonTasks = openTasks.filter((task) => {
    const dueTime = toDateTime(task.due);
    return dueTime >= todayTime && dueTime <= upcomingLimit;
  });

  const upcomingDeadlines = matter.deadlines
    .filter((deadline) => toDateTime(deadline.date) >= todayTime)
    .sort((a, b) => a.date.localeCompare(b.date));

  const missingDocuments = matter.documents.filter((document) => ["missing", "requested"].includes(document.status));
  const importantRisks = matter.risks.filter(
    (risk) => IMPORTANT_RISK_LEVELS.has(risk.severity) && OPEN_RISK_STATUSES.has(risk.status),
  );

  const pendingQuestions = matter.communications.flatMap((communication) =>
    (communication.pending_questions ?? []).map((question) => ({
      question,
      source: communication.id,
      date: communication.date,
    })),
  );

  return {
    generated_on: today,
    matter_id: matter.matter_id,
    title: matter.title,
    client: matter.client,
    practice_area: matter.practice_area,
    confidentiality: matter.confidentiality,
    open_tasks: openTasks,
    overdue_tasks: overdueTasks,
    due_soon_tasks: dueSoonTasks,
    upcoming_deadlines: upcomingDeadlines,
    missing_documents: missingDocuments,
    important_risks: importantRisks,
    pending_questions: pendingQuestions,
    billing: matter.billing,
  };
}

export function renderMatterBrief(brief) {
  const lines = [];
  lines.push(`# Matter Brief: ${brief.matter_id}`);
  lines.push("");
  lines.push(`Generated: ${brief.generated_on}`);
  lines.push(`Client: ${brief.client}`);
  lines.push(`Matter: ${brief.title}`);
  lines.push(`Practice area: ${brief.practice_area}`);
  lines.push(`Confidentiality: ${brief.confidentiality.level}`);
  lines.push(`Human approval required: ${brief.confidentiality.human_approval_required ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Operating Snapshot");
  lines.push(`- Open tasks: ${brief.open_tasks.length}`);
  lines.push(`- Overdue tasks: ${brief.overdue_tasks.length}`);
  lines.push(`- Due within 7 days: ${brief.due_soon_tasks.length}`);
  lines.push(`- Upcoming deadlines: ${brief.upcoming_deadlines.length}`);
  lines.push(`- Missing/requested documents: ${brief.missing_documents.length}`);
  lines.push(`- High/critical open risks: ${brief.important_risks.length}`);
  lines.push(`- Pending client/team questions: ${brief.pending_questions.length}`);
  lines.push("");

  appendItems(lines, "## Tasks Due Soon", brief.due_soon_tasks, (task) =>
    `- ${task.due} [${task.status}] ${task.title} (${task.owner})`,
  );
  appendItems(lines, "## Upcoming Deadlines", brief.upcoming_deadlines, (deadline) =>
    `- ${deadline.date} [${deadline.type}] ${deadline.title}${deadline.owner ? ` (${deadline.owner})` : ""}`,
  );
  appendItems(lines, "## Missing or Requested Documents", brief.missing_documents, (document) =>
    `- [${document.status}] ${document.title}${document.issue ? ` - issue: ${document.issue}` : ""}`,
  );
  appendItems(lines, "## High/Critical Risks", brief.important_risks, (risk) =>
    `- [${risk.severity}/${risk.status}] ${risk.title}${risk.source ? ` - source: ${risk.source}` : ""}`,
  );
  appendItems(lines, "## Pending Questions", brief.pending_questions, (item) =>
    `- ${item.question} (source: ${item.source}, ${item.date})`,
  );

  lines.push("## Billing Notes");
  lines.push(`- WIP hours: ${brief.billing?.wip_hours ?? 0}`);
  lines.push(`- Non-billable hours: ${brief.billing?.non_billable_hours ?? 0}`);
  for (const note of brief.billing?.billing_notes ?? []) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  lines.push("## Review Gate");
  lines.push("- This brief is operational support only.");
  lines.push("- Attorney review is required before legal conclusions, client advice, filings, markups, or billing decisions.");

  return `${lines.join("\n")}\n`;
}

function appendItems(lines, title, items, render) {
  lines.push(title);
  if (items.length === 0) {
    lines.push("- None");
  } else {
    for (const item of items) {
      lines.push(render(item));
    }
  }
  lines.push("");
}

function toDateTime(date) {
  return Date.parse(`${date}T00:00:00Z`);
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
