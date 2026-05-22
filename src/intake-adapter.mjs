const DATE_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
const ISO_WEEKDAY = new Map([
  ["monday", 1],
  ["mon", 1],
  ["월요일", 1],
  ["월", 1],
  ["tuesday", 2],
  ["tue", 2],
  ["화요일", 2],
  ["화", 2],
  ["wednesday", 3],
  ["wed", 3],
  ["수요일", 3],
  ["수", 3],
  ["thursday", 4],
  ["thu", 4],
  ["목요일", 4],
  ["목", 4],
  ["friday", 5],
  ["fri", 5],
  ["금요일", 5],
  ["금", 5],
  ["saturday", 6],
  ["sat", 6],
  ["토요일", 6],
  ["토", 6],
  ["sunday", 7],
  ["sun", 7],
  ["일요일", 7],
  ["일", 7],
]);

const TASK_TERMS = [
  "please",
  "need to",
  "follow up",
  "prepare",
  "update",
  "revise",
  "send",
  "confirm",
  "확인",
  "준비",
  "수정",
  "보내",
  "송부",
  "검토",
  "요청",
  "정리",
];

const DOCUMENT_TERMS = [
  "document",
  "deliverable",
  "certificate",
  "schedule",
  "memo",
  "자료",
  "문서",
  "증빙",
  "의사록",
  "계약서",
  "체크리스트",
  "메모",
  "미수령",
  "missing",
  "requested",
];

export function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    throw new Error("Intake input must be an array of messages");
  }

  return rawMessages.map((message, index) => ({
    id: message.id ?? `MSG-${String(index + 1).padStart(3, "0")}`,
    matter_id: message.matter_id,
    source_type: message.source_type ?? "message",
    source_id: message.source_id ?? message.channel ?? message.meeting_id ?? "unknown-source",
    date: message.date,
    author: message.author ?? "unknown",
    text: String(message.text ?? "").trim(),
  }));
}

export function extractIntakeCandidates(matter, messages, options = {}) {
  const today = options.today ?? localDateISO("Asia/Seoul");
  const teamNames = new Set((matter.team ?? []).map((member) => member.name));
  const candidates = {
    matter_id: matter.matter_id,
    generated_on: today,
    communications: [],
    tasks: [],
    deadlines: [],
    documents: [],
    pending_questions: [],
    warnings: [],
  };

  for (const message of normalizeMessages(messages)) {
    if (message.matter_id && message.matter_id !== matter.matter_id) {
      candidates.warnings.push(`Skipped ${message.id}: matter_id ${message.matter_id} does not match ${matter.matter_id}`);
      continue;
    }

    const due = detectDueDate(message.text, message.date);
    const owner =
      detectDirectedOwner(message.text, teamNames) ??
      detectSelfAssignedOwner(message.text, message.author, teamNames) ??
      detectOwner(message.text, teamNames) ??
      matter.review_workflow?.default_reviewer ??
      matter.matter_profile?.responsible_partner;
    const summary = summarizeText(message.text);

    candidates.communications.push({
      id: `INTAKE-COMM-${message.id}`,
      source: `${message.source_type}:${message.source_id}`,
      date: message.date,
      summary,
      pending_questions: detectQuestions(message.text),
    });

    if (looksLikeTask(message.text)) {
      candidates.tasks.push({
        id: `INTAKE-TASK-${message.id}`,
        title: cleanTaskTitle(message.text),
        owner,
        status: "open",
        due: due ?? message.date,
        source: `${message.source_type}:${message.id}`,
        review_required: true,
        confidence: due ? "medium" : "low",
      });
    }

    if (due) {
      candidates.deadlines.push({
        id: `INTAKE-DEADLINE-${message.id}`,
        title: cleanDeadlineTitle(message.text),
        date: due,
        type: inferDeadlineType(message.text),
        owner,
        source: `${message.source_type}:${message.id}`,
        confidence: "medium",
      });
    }

    const doc = detectDocument(message.text);
    if (doc) {
      candidates.documents.push({
        id: `INTAKE-DOC-${message.id}`,
        title: doc,
        type: inferDocumentType(message.text),
        status: inferDocumentStatus(message.text),
        issue: inferIssue(message.text),
        source: `${message.source_type}:${message.id}`,
        confidence: "low",
      });
    }

    for (const question of detectQuestions(message.text)) {
      candidates.pending_questions.push({
        question,
        source: `${message.source_type}:${message.id}`,
        date: message.date,
      });
    }
  }

  return candidates;
}

export function mergeCandidatesIntoMatter(matter, candidates) {
  const merged = structuredClone(matter);
  merged.communications = mergeById(merged.communications, candidates.communications);
  merged.tasks = mergeById(merged.tasks, candidates.tasks.map(stripCandidateFields));
  merged.deadlines = mergeById(merged.deadlines, candidates.deadlines.map(stripCandidateFields));
  merged.documents = mergeById(merged.documents, candidates.documents.map(stripCandidateFields));
  return merged;
}

export function renderIntakeReport(candidates) {
  const lines = [];
  lines.push(`# Intake Report: ${candidates.matter_id}`);
  lines.push("");
  lines.push(`Generated: ${candidates.generated_on}`);
  lines.push("");
  append(lines, "Communications", candidates.communications, (item) => `- ${item.date} ${item.source}: ${item.summary}`);
  append(lines, "Task Candidates", candidates.tasks, (item) => `- ${item.due} ${item.title} (${item.owner}, ${item.confidence})`);
  append(lines, "Deadline Candidates", candidates.deadlines, (item) => `- ${item.date} [${item.type}] ${item.title} (${item.owner})`);
  append(lines, "Document Candidates", candidates.documents, (item) => `- [${item.status}] ${item.title} (${item.type}, issue: ${item.issue})`);
  append(lines, "Pending Questions", candidates.pending_questions, (item) => `- ${item.question} (${item.source})`);
  append(lines, "Warnings", candidates.warnings, (item) => `- ${item}`);
  lines.push("## Review Gate");
  lines.push("- These are intake candidates, not confirmed matter records.");
  lines.push("- A responsible attorney or delegated reviewer should approve, edit, or reject each candidate before relying on it.");
  return `${lines.join("\n")}\n`;
}

function detectDueDate(text, messageDate) {
  const iso = text.match(DATE_RE);
  if (iso) return iso[0];

  const lower = text.toLowerCase();
  if (/(today|오늘|금일)/.test(lower)) return messageDate;
  if (/(tomorrow|내일)/.test(lower)) return addDays(messageDate, 1);
  if (/(day after tomorrow|모레)/.test(lower)) return addDays(messageDate, 2);

  for (const [label, weekday] of ISO_WEEKDAY) {
    const pattern = new RegExp(`\\b${escapeRegExp(label)}\\b|${escapeRegExp(label)}`);
    if (pattern.test(lower)) {
      return weekdayDate(messageDate, weekday, lower.includes(`next ${label}`) || lower.includes(`다음 주 ${label}`));
    }
  }

  return undefined;
}

function detectOwner(text, teamNames) {
  for (const name of teamNames) {
    if (text.includes(name)) return name;
  }
  return undefined;
}

function detectDirectedOwner(text, teamNames) {
  const head = text.slice(0, 80);
  for (const name of teamNames) {
    if (new RegExp(`(^|\\s|@)${escapeRegExp(name)}(,|님|\\s)`).test(head)) return name;
  }
  return undefined;
}

function detectSelfAssignedOwner(text, author, teamNames) {
  if (!/(^|\s)(I will|I'll|제가|제가요|하겠습니다|진행하겠습니다|확인하겠습니다|요청하겠습니다)(\s|\.|$)/i.test(text)) {
    return undefined;
  }
  return detectOwner(author, teamNames);
}

function detectQuestions(text) {
  const sentences = splitSentences(text);
  return sentences.filter((sentence) => /[?？]$/.test(sentence) || /(확인|confirm|ask client|고객.*질문|문의)/i.test(sentence));
}

function looksLikeTask(text) {
  const lower = text.toLowerCase();
  return TASK_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

function detectDocument(text) {
  const lower = text.toLowerCase();
  if (!DOCUMENT_TERMS.some((term) => lower.includes(term.toLowerCase()))) return undefined;
  return summarizeText(text, 96);
}

function inferDocumentStatus(text) {
  const lower = text.toLowerCase();
  if (/(missing|미수령|없|누락)/.test(lower)) return "missing";
  if (/(requested|요청|달라|받아야)/.test(lower)) return "requested";
  if (/(review|검토)/.test(lower)) return "in-review";
  return "received";
}

function inferDocumentType(text) {
  const lower = text.toLowerCase();
  if (/(spa|sha|contract|계약서)/.test(lower)) return "contract";
  if (/(certificate|deliverable|closing|cp|증빙|체크리스트)/.test(lower)) return "closing-deliverable";
  if (/(memo|메모|의견서)/.test(lower)) return "internal-memo";
  if (/(minutes|의사록|board)/.test(lower)) return "governance-document";
  return "source-document";
}

function inferIssue(text) {
  const lower = text.toLowerCase();
  if (/(tax|세무)/.test(lower)) return "tax";
  if (/(closing|cp|deliverable|종결|클로징)/.test(lower)) return "closing";
  if (/(indemnity|손해배상|면책)/.test(lower)) return "indemnity";
  if (/(governance|board|이사회|주총)/.test(lower)) return "governance";
  return "general";
}

function inferDeadlineType(text) {
  const lower = text.toLowerCase();
  if (/(court|filing|법원|제출기한|기일)/.test(lower)) return "court";
  if (/(closing|signing|cp|spa|deal|종결|거래)/.test(lower)) return "deal";
  if (/(client|고객|의뢰인)/.test(lower)) return "client";
  if (/(statutory|법정|법령)/.test(lower)) return "statutory";
  return "internal";
}

function cleanTaskTitle(text) {
  return summarizeText(text, 120).replace(/^(please|pls)\s+/i, "");
}

function cleanDeadlineTitle(text) {
  return summarizeText(text, 100);
}

function summarizeText(text, max = 140) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}...`;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.?!？])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mergeById(existing = [], incoming = []) {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function stripCandidateFields(item) {
  const { confidence, ...rest } = item;
  return rest;
}

function addDays(date, days) {
  const time = Date.parse(`${date}T00:00:00Z`);
  return new Date(time + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function weekdayDate(date, targetIsoWeekday, forceNextWeek = false) {
  const current = new Date(`${date}T00:00:00Z`);
  const currentIsoWeekday = current.getUTCDay() || 7;
  let delta = targetIsoWeekday - currentIsoWeekday;
  if (forceNextWeek) {
    if (delta <= 0) delta += 7;
    else delta += 7;
  } else if (delta < 0) {
    delta += 7;
  }
  return addDays(date, delta);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
