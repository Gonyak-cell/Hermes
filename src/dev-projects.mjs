import { readFile } from "node:fs/promises";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_PROJECT_STATUSES = new Set(["active", "blocked", "maintenance"]);
const OPEN_TASK_STATUSES = new Set(["next", "in-progress", "blocked", "review"]);
const PRIORITY_ORDER = new Map([
  ["p0", 0],
  ["p1", 1],
  ["p2", 2],
  ["p3", 3],
]);

export async function readDevProjectsFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function validateDevProjects(portfolio) {
  const errors = [];
  const requireString = (path, value) => {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${path} must be a non-empty string`);
    }
  };
  const requireDate = (path, value) => {
    if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      errors.push(`${path} must be a YYYY-MM-DD date`);
    }
  };

  if (!portfolio || typeof portfolio !== "object" || Array.isArray(portfolio)) {
    return ["portfolio must be an object"];
  }

  requireString("owner", portfolio.owner);
  requireDate("generated_on", portfolio.generated_on);
  if (!["daily", "weekly", "ad-hoc"].includes(portfolio.review_cadence)) {
    errors.push("review_cadence must be daily, weekly, or ad-hoc");
  }
  if (!Array.isArray(portfolio.projects)) {
    errors.push("projects must be an array");
    return errors;
  }

  for (const [projectIndex, project] of portfolio.projects.entries()) {
    requireString(`projects[${projectIndex}].id`, project.id);
    requireString(`projects[${projectIndex}].name`, project.name);
    requireString(`projects[${projectIndex}].repository`, project.repository);
    requireString(`projects[${projectIndex}].north_star`, project.north_star);
    if (!["active", "paused", "blocked", "maintenance", "shipped"].includes(project.status)) {
      errors.push(`projects[${projectIndex}].status is invalid`);
    }
    if (!PRIORITY_ORDER.has(project.priority)) {
      errors.push(`projects[${projectIndex}].priority is invalid`);
    }
    if (!project.next_milestone || typeof project.next_milestone !== "object") {
      errors.push(`projects[${projectIndex}].next_milestone must be an object`);
    } else {
      requireString(`projects[${projectIndex}].next_milestone.name`, project.next_milestone.name);
      requireDate(`projects[${projectIndex}].next_milestone.due`, project.next_milestone.due);
    }
    if (!Array.isArray(project.tasks)) {
      errors.push(`projects[${projectIndex}].tasks must be an array`);
      continue;
    }
    for (const [taskIndex, task] of project.tasks.entries()) {
      requireString(`projects[${projectIndex}].tasks[${taskIndex}].id`, task.id);
      requireString(`projects[${projectIndex}].tasks[${taskIndex}].title`, task.title);
      if (!["next", "in-progress", "blocked", "review", "done", "backlog"].includes(task.status)) {
        errors.push(`projects[${projectIndex}].tasks[${taskIndex}].status is invalid`);
      }
      if (!PRIORITY_ORDER.has(task.priority)) {
        errors.push(`projects[${projectIndex}].tasks[${taskIndex}].priority is invalid`);
      }
      requireDate(`projects[${projectIndex}].tasks[${taskIndex}].due`, task.due);
      if (!Number.isInteger(task.estimate_minutes) || task.estimate_minutes < 0) {
        errors.push(`projects[${projectIndex}].tasks[${taskIndex}].estimate_minutes must be a non-negative integer`);
      }
    }
  }

  return errors;
}

export function buildDevProjectBrief(portfolio, options = {}) {
  const today = options.today ?? localDateISO("Asia/Seoul");
  const todayTime = toDateTime(today);
  const weekTime = todayTime + 7 * 24 * 60 * 60 * 1000;
  const activeProjects = portfolio.projects.filter((project) => ACTIVE_PROJECT_STATUSES.has(project.status));

  const projectSummaries = activeProjects
    .map((project) => summarizeProject(project, todayTime, weekTime))
    .sort(compareProjectSummary);

  const allOpenTasks = projectSummaries.flatMap((project) =>
    project.open_tasks.map((task) => ({
      ...task,
      project_id: project.id,
      project_name: project.name,
      repository: project.repository,
    })),
  );

  const blockedTasks = allOpenTasks.filter((task) => task.status === "blocked");
  const reviewTasks = allOpenTasks.filter((task) => task.status === "review");
  const dueToday = allOpenTasks.filter((task) => task.due === today);
  const dueSoon = allOpenTasks.filter((task) => {
    const due = toDateTime(task.due);
    return due >= todayTime && due <= weekTime;
  });

  return {
    generated_on: today,
    owner: portfolio.owner,
    review_cadence: portfolio.review_cadence,
    active_projects: projectSummaries,
    due_today: sortTasks(dueToday),
    due_soon: sortTasks(dueSoon),
    blocked_tasks: sortTasks(blockedTasks),
    review_tasks: sortTasks(reviewTasks),
    recommended_focus: chooseRecommendedFocus(projectSummaries, allOpenTasks, today),
    attention_budget_minutes: estimateAttentionBudget(allOpenTasks),
  };
}

export function renderDevProjectBrief(brief) {
  const lines = [];
  lines.push(`# Developer Project Brief`);
  lines.push("");
  lines.push(`Generated: ${brief.generated_on}`);
  lines.push(`Owner: ${brief.owner}`);
  lines.push(`Review cadence: ${brief.review_cadence}`);
  lines.push("");
  lines.push("## Snapshot");
  lines.push(`- Active projects: ${brief.active_projects.length}`);
  lines.push(`- Due today: ${brief.due_today.length}`);
  lines.push(`- Due within 7 days: ${brief.due_soon.length}`);
  lines.push(`- Blocked tasks: ${brief.blocked_tasks.length}`);
  lines.push(`- Review tasks: ${brief.review_tasks.length}`);
  lines.push(`- Open-task estimate: ${brief.attention_budget_minutes} minutes`);
  lines.push("");

  lines.push("## Recommended Focus");
  for (const item of brief.recommended_focus) {
    lines.push(`- ${item.project_id}: ${item.title} (${item.status}, ${item.priority}, ${item.estimate_minutes}m)`);
  }
  if (brief.recommended_focus.length === 0) lines.push("- No urgent focus item. Pick one p1 next task.");
  lines.push("");

  appendTasks(lines, "Due Today", brief.due_today);
  appendTasks(lines, "Blocked", brief.blocked_tasks);
  appendTasks(lines, "Needs Review", brief.review_tasks);

  lines.push("## Project Status");
  for (const project of brief.active_projects) {
    lines.push(`- ${project.id} [${project.status}/${project.priority}] ${project.name}`);
    lines.push(`  - Milestone: ${project.next_milestone.name} (${project.next_milestone.due})`);
    lines.push(`  - Open tasks: ${project.open_tasks.length}, blocked: ${project.blocked_tasks.length}, release remaining: ${project.release_remaining.length}`);
  }
  lines.push("");

  lines.push("## Operating Rule");
  lines.push("- Keep the brief short enough to act on today.");
  lines.push("- If a task is blocked, Hermes should first reduce the blocker to one concrete next action.");
  lines.push("- If a project has no next task, create one before doing broad planning.");

  return `${lines.join("\n")}\n`;
}

function summarizeProject(project, todayTime, weekTime) {
  const openTasks = (project.tasks ?? []).filter((task) => OPEN_TASK_STATUSES.has(task.status));
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const dueSoonTasks = openTasks.filter((task) => {
    const due = toDateTime(task.due);
    return due >= todayTime && due <= weekTime;
  });
  const openRisks = (project.risks ?? []).filter((risk) => ["open", "watching"].includes(risk.status));
  const releaseRemaining = (project.release?.checklist ?? []).filter((item) => item.status !== "done");

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    priority: project.priority,
    repository: project.repository,
    north_star: project.north_star,
    next_milestone: project.next_milestone,
    open_tasks: sortTasks(openTasks),
    blocked_tasks: sortTasks(blockedTasks),
    due_soon_tasks: sortTasks(dueSoonTasks),
    open_risks: openRisks,
    release_remaining: releaseRemaining,
  };
}

function chooseRecommendedFocus(projectSummaries, allOpenTasks, today) {
  const priorityTasks = allOpenTasks
    .filter((task) => task.status !== "blocked")
    .sort(compareTask)
    .slice(0, 3);

  if (priorityTasks.length > 0) return priorityTasks;

  return projectSummaries
    .flatMap((project) => project.blocked_tasks.map((task) => ({
      ...task,
      project_id: project.id,
      project_name: project.name,
      repository: project.repository,
    })))
    .sort(compareTask)
    .slice(0, 3);
}

function estimateAttentionBudget(tasks) {
  return tasks.reduce((total, task) => total + (task.estimate_minutes ?? 0), 0);
}

function sortTasks(tasks) {
  return [...tasks].sort(compareTask);
}

function compareProjectSummary(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority) || a.next_milestone.due.localeCompare(b.next_milestone.due);
}

function compareTask(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority) || a.due.localeCompare(b.due) || statusRank(a.status) - statusRank(b.status);
}

function priorityRank(priority) {
  return PRIORITY_ORDER.get(priority) ?? 99;
}

function statusRank(status) {
  return {
    "in-progress": 0,
    review: 1,
    next: 2,
    blocked: 3,
    backlog: 4,
    done: 5,
  }[status] ?? 99;
}

function appendTasks(lines, title, tasks) {
  lines.push(`## ${title}`);
  if (tasks.length === 0) {
    lines.push("- None");
  } else {
    for (const task of tasks) {
      const project = task.project_id ? `${task.project_id}: ` : "";
      const blocker = task.blocker ? ` - blocker: ${task.blocker}` : "";
      lines.push(`- ${task.due} ${project}${task.title} (${task.status}, ${task.priority}, ${task.estimate_minutes}m)${blocker}`);
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
