import { createReadStream } from "node:fs";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseOutlookEml } from "./outlook-parser.mjs";

export const DEFAULT_EXTRACTOR_QUEUE = "audits/resource-audit/latest/extractor-queue.json";
export const DEFAULT_EXTRACTION_OUT_DIR = "audits/resource-audit/latest/extraction";

const DEFAULT_MAX_TEXT_BYTES = 1024 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 4;

const TEXT_EXTENSIONS = new Set([
  "bat",
  "css",
  "csv",
  "html",
  "js",
  "json",
  "jsonl",
  "jsx",
  "lock",
  "md",
  "mjs",
  "ps1",
  "py",
  "sample",
  "sh",
  "skill",
  "svg",
  "template",
  "toml",
  "txt",
  "yaml",
  "yml",
]);

const ARCHIVE_EXTENSIONS = new Set(["plugin", "zip"]);

const PRACTICE_KEYWORDS = {
  ldd_vdr: ["ldd", "vdr", "due diligence", "실사", "법률실사", "전수검토", "자료실", "rfi"],
  contract: ["contract", "agreement", "계약", "mou", "nda", "sha", "spa", "bta", "투자계약", "주주간계약"],
  litigation: ["litigation", "소송", "소장", "준비서면", "답변서", "항소", "상고", "증거", "청구취지"],
  corporate: ["corporate", "회사법", "정관", "주주총회", "이사회", "주주명부", "등기", "의사록"],
  proposal: ["proposal", "수임", "제안서", "fee", "견적", "scope of work"],
  legal_memo: ["memorandum", "memo", "의견서", "검토의견", "법률검토", "legal opinion"],
  email_reply: ["email", "e-mail", "메일", "이메일", "회신", "reply"],
  presentation: ["pptx", "presentation", "slide", "deck", "보고자료", "디자인", "horizon"],
  document_formatting: ["format", "서식", "스타일", "템플릿", "docx", "word", "finalize"],
  extractor_runtime: ["extractor", "parser", "inventory", "entity", "validator", "normalizer", "mapper"],
  agent_platform: ["plugin", "skill", "command", "claude", "codex", "agent", "mcp", "cowork"],
  personal_dev: ["github", "ui-tars", "open-generative-ai", "frontend", "backend", "agent-skills", "개발 프로젝트"],
  creative_content: ["video", "novel", "web novel", "웹소설", "동영상", "story generator"],
};

const ROLE_KEYWORDS = {
  plugin_package: ["plugin", ".plugin"],
  skill_instruction: ["skill.md", "skills/", "## instructions", "when to use"],
  command: ["commands/", "slash command", "명령"],
  extractor: ["extractor", "parser", "validator", "normalizer", "mapper"],
  template: ["template", "템플릿", "양식", "서식"],
  precedent: ["sample", "example", "precedent", "사례", "샘플", "역설계"],
  report_writer: ["report", "보고서", "draft", "generate", "작성"],
  design_asset: ["pptx", "slide", "theme", "layout", "design", "master"],
  code_asset: ["function ", "class ", "import ", "def ", "package.json", "script"],
  knowledge_base: ["reference", "references/", "methodology", "방법론", "db/", "corpus"],
};

export async function extractResourceQueue(options = {}) {
  const queuePath = options.queuePath ?? DEFAULT_EXTRACTOR_QUEUE;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const queue = JSON.parse(await readFile(queuePath, "utf8"));
  const files = Number.isFinite(options.limit) ? queue.files.slice(0, options.limit) : queue.files;
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const records = await mapWithConcurrency(files, concurrency, (file) =>
    extractResourceFile(file, { maxTextBytes }),
  );
  const summary = summarizeExtraction(records);
  const capabilitySignals = buildCapabilitySignals(records);

  return {
    schema_version: "resource-extraction.v1",
    generated_at: generatedAt,
    source_queue: path.resolve(queuePath),
    input_count: files.length,
    source_queue_count: queue.count,
    summary,
    capability_signals: capabilitySignals,
    files: records,
  };
}

export async function writeResourceExtraction(extraction, outDir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "resource-extraction.json"), extraction);
  await writeJson(path.join(outDir, "capability-signals.json"), {
    generated_at: extraction.generated_at,
    capability_signals: extraction.capability_signals,
  });
  await writeJson(path.join(outDir, "extraction-failures.json"), {
    generated_at: extraction.generated_at,
    count: extraction.files.filter((file) => file.extraction_status !== "extracted").length,
    files: extraction.files.filter((file) => file.extraction_status !== "extracted"),
  });
  await writeFile(path.join(outDir, "summary.md"), renderExtractionSummary(extraction), "utf8");
}

export async function extractResourceFile(file, options = {}) {
  const startedAt = new Date().toISOString();
  const base = {
    path: file.path,
    relative_path: file.relative_path,
    size_bytes: file.size_bytes,
    extension: file.extension,
    candidate_domain: file.candidate_domain,
    resource_type: file.resource_type,
    extractor_family: file.extractor_family,
    started_at: startedAt,
  };

  try {
    const rawHashSha256 = await hashFile(file.path);
    const extraction = await extractByExtension(file, options);
    const text = extraction.text ?? "";
    const signals = inferResourceSignals(file, text, extraction);
    const textHashSha256 = text ? createHash("sha256").update(text).digest("hex") : null;
    const record = {
      ...base,
      extraction_status: "extracted",
      extractor: extraction.extractor,
      raw_hash_sha256: rawHashSha256,
      text_hash_sha256: textHashSha256,
      text_length: text.length,
      text_truncated: Boolean(extraction.text_truncated),
      text_preview: previewText(text),
      headings: extractHeadings(text),
      metadata: extraction.metadata ?? {},
      signals,
      completed_at: new Date().toISOString(),
    };
    return record;
  } catch (error) {
    return {
      ...base,
      extraction_status: "failed",
      error: sanitizeError(error),
      completed_at: new Date().toISOString(),
    };
  }
}

export function inferResourceSignals(file, text = "", extraction = {}) {
  const entryText = Array.isArray(extraction.metadata?.entries)
    ? extraction.metadata.entries.slice(0, 300).join("\n")
    : "";
  const haystack = normalizeForSearch(
    [
      file.relative_path,
      file.extension,
      file.candidate_domain,
      file.resource_type,
      extraction.metadata?.package_name,
      extraction.metadata?.plugin_name,
      extraction.metadata?.plugin_version,
      entryText,
      text.slice(0, 200_000),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const practiceAreas = keywordMatches(haystack, PRACTICE_KEYWORDS);
  const resourceRoles = keywordMatches(haystack, ROLE_KEYWORDS);
  const capabilityIds = inferCapabilityIds(file, practiceAreas, resourceRoles, haystack);

  return {
    practice_areas: practiceAreas,
    resource_roles: resourceRoles,
    capability_ids: capabilityIds,
  };
}

export function extractTextFromOfficeXml(xml) {
  if (!xml) return "";
  const withBreaks = xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<a:tab\s*\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .replace(/<a:br\s*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/a:tr>/g, "\n")
    .replace(/<\/si>/g, "\n");

  return decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractByExtension(file, options) {
  const ext = file.extension;
  if (TEXT_EXTENSIONS.has(ext)) return extractPlainText(file, options);
  if (ext === "docx") return extractDocx(file);
  if (ext === "pptx") return extractPptx(file);
  if (ext === "xlsx") return extractXlsx(file);
  if (ext === "pdf") return extractPdf(file);
  if (ext === "eml") return extractEml(file, options);
  if (ARCHIVE_EXTENSIONS.has(ext)) return extractArchiveOrPlugin(file);
  throw new Error(`No extractor registered for extension ${ext}`);
}

async function extractPlainText(file, options) {
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const { buffer, truncated } = await readFirstBytes(file.path, maxTextBytes);
  const text = buffer.toString("utf8");
  const metadata = {};

  if (file.extension === "json" && !truncated) {
    Object.assign(metadata, parseJsonMetadata(text));
  }
  if (file.extension === "jsonl") {
    metadata.jsonl_line_count = text.split("\n").filter(Boolean).length;
  }
  if (["py", "js", "jsx", "mjs", "ps1", "sh", "bat"].includes(file.extension)) {
    metadata.definitions = extractCodeDefinitions(text);
  }
  if (["yaml", "yml", "toml"].includes(file.extension)) {
    metadata.top_level_keys = extractConfigKeys(text);
  }

  return {
    extractor: "plain_text_probe",
    text,
    text_truncated: truncated,
    metadata,
  };
}

async function extractDocx(file) {
  const xml = await unzipEntry(file.path, "word/document.xml");
  const text = extractTextFromOfficeXml(xml.stdout);
  return {
    extractor: "docx_word_xml_probe",
    text,
    metadata: {
      table_count: countMatches(xml.stdout, /<w:tbl\b/g),
      paragraph_count: countMatches(xml.stdout, /<w:p\b/g),
      xml_truncated: xml.truncated,
    },
  };
}

async function extractPptx(file) {
  const entries = await listArchiveEntries(file.path);
  const slideEntries = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
    .sort(compareSlideNames);
  const textParts = [];
  for (const slide of slideEntries.slice(0, 40)) {
    const xml = await unzipEntry(file.path, slide);
    const slideText = extractTextFromOfficeXml(xml.stdout);
    if (slideText) textParts.push(`Slide ${slide.replace(/\D/g, "")}\n${slideText}`);
  }
  return {
    extractor: "pptx_open_xml_probe",
    text: textParts.join("\n\n"),
    text_truncated: slideEntries.length > 40,
    metadata: {
      entries: entries.slice(0, 300),
      entry_count: entries.length,
      slide_count: slideEntries.length,
      master_count: entries.filter((entry) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(entry)).length,
      layout_count: entries.filter((entry) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(entry)).length,
    },
  };
}

async function extractXlsx(file) {
  const entries = await listArchiveEntries(file.path);
  const textParts = [];
  if (entries.includes("xl/sharedStrings.xml")) {
    const sharedStrings = await unzipEntry(file.path, "xl/sharedStrings.xml");
    textParts.push(extractTextFromOfficeXml(sharedStrings.stdout));
  }
  for (const sheet of entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry)).slice(0, 5)) {
    const xml = await unzipEntry(file.path, sheet);
    const text = extractTextFromOfficeXml(xml.stdout);
    if (text) textParts.push(text);
  }
  return {
    extractor: "xlsx_open_xml_probe",
    text: textParts.filter(Boolean).join("\n\n"),
    metadata: {
      entries: entries.slice(0, 300),
      entry_count: entries.length,
      sheet_count: entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry)).length,
      has_shared_strings: entries.includes("xl/sharedStrings.xml"),
    },
  };
}

async function extractPdf(file) {
  if (await commandExists("pdftotext")) {
    const result = await runCommand("pdftotext", ["-f", "1", "-l", "5", "-layout", "-enc", "UTF-8", file.path, "-"], {
      timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
      maxStdoutBytes: 2 * 1024 * 1024,
    });
    return {
      extractor: "pdf_pdftotext_probe",
      text: result.stdout,
      text_truncated: result.truncated,
      metadata: {
        pages_sampled: 5,
      },
    };
  }

  const { buffer } = await readFirstBytes(file.path, 4096);
  return {
    extractor: "pdf_header_probe",
    text: buffer.toString("latin1"),
    metadata: {
      pdftotext_available: false,
    },
  };
}

async function extractEml(file, options) {
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const { buffer, truncated, size } = await readFirstBytes(file.path, maxTextBytes);
  const rawText = buffer.toString("utf8");
  const message = parseOutlookEml(rawText, { sourceId: "resource-expansion-eml" }, file.path);
  return {
    extractor: "outlook_eml_probe",
    text: message.text,
    text_truncated: truncated,
    metadata: {
      parsed_message_id: message.id,
      source_type: message.source_type,
      source_id: message.source_id,
      author: message.author,
      date: message.date ?? null,
      raw_size_bytes: size,
    },
  };
}

async function extractArchiveOrPlugin(file) {
  let entries;
  try {
    entries = await listArchiveEntries(file.path);
  } catch (error) {
    const { buffer } = await readFirstBytes(file.path, 4096);
    return {
      extractor: "archive_header_probe",
      text: buffer.toString("latin1"),
      metadata: {
        archive_valid: false,
        archive_error: sanitizeError(error),
      },
    };
  }

  const interestingEntries = entries.filter(isInterestingArchiveEntry).slice(0, 35);
  const textParts = [];
  const manifests = [];

  for (const entry of interestingEntries) {
    const unzipped = await unzipEntry(file.path, entry, { maxStdoutBytes: 512 * 1024 });
    const entryText = unzipped.stdout;
    textParts.push(`# ${entry}\n${entryText}`);
    if (/(\bplugin\.json|\bpackage\.json|\bmanifest\.json)$/i.test(entry)) {
      const parsed = parseJsonMetadata(entryText);
      if (Object.keys(parsed).length) manifests.push({ entry, ...parsed });
    }
  }

  const packageManifest = manifests.find((manifest) => /package\.json$/i.test(manifest.entry));
  const pluginManifest = manifests.find((manifest) => /plugin\.json$/i.test(manifest.entry));

  return {
    extractor: file.extension === "plugin" ? "claude_plugin_archive_probe" : "zip_archive_probe",
    text: textParts.join("\n\n"),
    text_truncated: interestingEntries.length < entries.filter(isInterestingArchiveEntry).length,
    metadata: {
      entries: entries.slice(0, 500),
      entry_count: entries.length,
      interesting_entry_count: interestingEntries.length,
      extension_counts: countExtensions(entries),
      manifests,
      package_name: packageManifest?.name ?? pluginManifest?.name ?? null,
      plugin_name: pluginManifest?.name ?? packageManifest?.name ?? null,
      plugin_version: pluginManifest?.version ?? packageManifest?.version ?? null,
      skill_count: entries.filter((entry) => /(^|\/)SKILL\.md$/i.test(entry)).length,
      command_count: entries.filter((entry) => /(^|\/)commands\/.+\.md$/i.test(entry)).length,
      script_count: entries.filter((entry) => /(^|\/)scripts\/.+\.(py|js|mjs|sh|ps1|bat)$/i.test(entry)).length,
    },
  };
}

async function readFirstBytes(filePath, maxBytes) {
  const handle = await open(filePath, "r");
  try {
    const stat = await handle.stat();
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return {
      buffer: buffer.subarray(0, bytesRead),
      truncated: stat.size > maxBytes,
      size: stat.size,
    };
  } finally {
    await handle.close();
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function listArchiveEntries(filePath) {
  const result = await runCommand("unzip", ["-Z1", filePath], {
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    maxStdoutBytes: 2 * 1024 * 1024,
  });
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

async function unzipEntry(filePath, entry, options = {}) {
  return runCommand("unzip", ["-p", filePath, entry], {
    timeoutMs: options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    maxStdoutBytes: options.maxStdoutBytes ?? 8 * 1024 * 1024,
  });
}

function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const maxStdoutBytes = options.maxStdoutBytes ?? 1024 * 1024;
  const maxStderrBytes = options.maxStderrBytes ?? 256 * 1024;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxStdoutBytes) {
        stdoutChunks.push(chunk);
      } else {
        stdoutTruncated = true;
        const remaining = Math.max(0, maxStdoutBytes - (stdoutBytes - chunk.length));
        if (remaining > 0) stdoutChunks.push(chunk.subarray(0, remaining));
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxStderrBytes) {
        stderrChunks.push(chunk);
      } else {
        stderrTruncated = true;
        const remaining = Math.max(0, maxStderrBytes - (stderrBytes - chunk.length));
        if (remaining > 0) stderrChunks.push(chunk.subarray(0, remaining));
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (timedOut) {
        reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({
        stdout,
        stderr,
        truncated: stdoutTruncated || stderrTruncated,
      });
    });
  });
}

async function commandExists(command) {
  try {
    await runCommand("command", ["-v", command], { timeoutMs: 1000, maxStdoutBytes: 4096 });
    return true;
  } catch {
    try {
      await runCommand("which", [command], { timeoutMs: 1000, maxStdoutBytes: 4096 });
      return true;
    } catch {
      return false;
    }
  }
}

function parseJsonMetadata(text) {
  try {
    const json = JSON.parse(text);
    return {
      json_top_level_keys: Array.isArray(json) ? ["[array]"] : Object.keys(json).slice(0, 40),
      name: typeof json.name === "string" ? json.name : null,
      version: typeof json.version === "string" ? json.version : null,
      description: typeof json.description === "string" ? json.description : null,
      scripts: json.scripts && typeof json.scripts === "object" ? Object.keys(json.scripts).slice(0, 40) : [],
      dependencies:
        json.dependencies && typeof json.dependencies === "object" ? Object.keys(json.dependencies).slice(0, 40) : [],
      dev_dependencies:
        json.devDependencies && typeof json.devDependencies === "object"
          ? Object.keys(json.devDependencies).slice(0, 40)
          : [],
    };
  } catch {
    return {};
  }
}

function extractCodeDefinitions(text) {
  const definitions = [];
  const patterns = [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm,
    /^\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/gm,
    /^\s*def\s+([A-Za-z0-9_]+)/gm,
    /^\s*class\s+([A-Za-z0-9_]+)/gm,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      definitions.push(match[1]);
    }
  }
  return [...new Set(definitions)].slice(0, 80);
}

function extractConfigKeys(text) {
  const keys = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*[:=]/);
    if (match) keys.push(match[1]);
  }
  return [...new Set(keys)].slice(0, 80);
}

function extractHeadings(text) {
  const headings = [];
  for (const line of text.split("\n")) {
    const markdown = line.match(/^\s{0,3}#{1,6}\s+(.{1,160})$/);
    if (markdown) {
      headings.push(markdown[1].trim());
      continue;
    }
    const shortLine = line.trim();
    if (
      headings.length < 15 &&
      shortLine.length >= 4 &&
      shortLine.length <= 80 &&
      /(?:개요|목적|절차|방법|검토|계약|소송|실사|보고서|제안|Overview|Workflow|Process|Checklist)/i.test(shortLine)
    ) {
      headings.push(shortLine);
    }
    if (headings.length >= 30) break;
  }
  return [...new Set(headings)].slice(0, 30);
}

function previewText(text, limit = 1600) {
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeForSearch(text) {
  return text.toLocaleLowerCase("ko-KR").normalize("NFC");
}

function keywordMatches(haystack, keywordMap) {
  const hits = [];
  for (const [id, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase("ko-KR")))) {
      hits.push(id);
    }
  }
  return hits;
}

function inferCapabilityIds(file, practiceAreas, resourceRoles, haystack) {
  const ids = new Set();
  if (practiceAreas.includes("ldd_vdr")) ids.add("law_firm.ldd_vdr_review");
  if (practiceAreas.includes("contract")) ids.add("law_firm.contract_drafting_review");
  if (practiceAreas.includes("litigation")) ids.add("law_firm.litigation_briefing");
  if (practiceAreas.includes("corporate")) ids.add("law_firm.corporate_documents");
  if (practiceAreas.includes("proposal")) ids.add("law_firm.engagement_proposal");
  if (practiceAreas.includes("legal_memo")) ids.add("law_firm.legal_memo_opinion");
  if (practiceAreas.includes("email_reply")) ids.add("law_firm.email_reply");
  if (practiceAreas.includes("presentation")) ids.add("document.pptx_design_system");
  if (practiceAreas.includes("document_formatting")) ids.add("document.format_qa");
  if (practiceAreas.includes("extractor_runtime") || resourceRoles.includes("extractor")) {
    ids.add("platform.extractor_workbench");
  }
  if (practiceAreas.includes("agent_platform") || resourceRoles.includes("plugin_package")) {
    ids.add("platform.plugin_skill_registry");
  }
  if (practiceAreas.includes("personal_dev") || file.candidate_domain === "personal-dev") {
    ids.add("personal.project_development_harness");
  }
  if (practiceAreas.includes("creative_content")) ids.add("personal.creative_content_factory");
  if (haystack.includes("amic")) ids.add("law_firm.amic_style_system");
  return [...ids];
}

function summarizeExtraction(records) {
  return {
    total_files: records.length,
    extracted_files: records.filter((record) => record.extraction_status === "extracted").length,
    failed_files: records.filter((record) => record.extraction_status !== "extracted").length,
    total_size_bytes: sum(records, "size_bytes"),
    by_status: countBy(records, "extraction_status"),
    by_extension: countBy(records, "extension"),
    by_candidate_domain: countBy(records, "candidate_domain"),
    by_extractor: countBy(records, "extractor"),
    by_practice_area: countSignal(records, "practice_areas"),
    by_resource_role: countSignal(records, "resource_roles"),
    by_capability_id: countSignal(records, "capability_ids"),
  };
}

function buildCapabilitySignals(records) {
  const capabilities = new Map();
  for (const record of records) {
    if (record.extraction_status !== "extracted") continue;
    for (const capabilityId of record.signals.capability_ids) {
      if (!capabilities.has(capabilityId)) {
        capabilities.set(capabilityId, {
          capability_id: capabilityId,
          file_count: 0,
          extensions: {},
          resource_roles: {},
          example_files: [],
        });
      }
      const capability = capabilities.get(capabilityId);
      capability.file_count += 1;
      capability.extensions[record.extension] = (capability.extensions[record.extension] ?? 0) + 1;
      for (const role of record.signals.resource_roles) {
        capability.resource_roles[role] = (capability.resource_roles[role] ?? 0) + 1;
      }
      if (capability.example_files.length < 12) {
        capability.example_files.push({
          path: record.path,
          relative_path: record.relative_path,
          extension: record.extension,
          preview: record.text_preview,
        });
      }
    }
  }
  return [...capabilities.values()].sort((a, b) => b.file_count - a.file_count);
}

function renderExtractionSummary(extraction) {
  const lines = [];
  lines.push("# Resource Extraction Summary");
  lines.push("");
  lines.push(`Generated: ${extraction.generated_at}`);
  lines.push(`Source queue: ${extraction.source_queue}`);
  lines.push(`Input files: ${extraction.input_count}`);
  lines.push(`Extracted: ${extraction.summary.extracted_files}`);
  lines.push(`Failed: ${extraction.summary.failed_files}`);
  lines.push("");
  appendCountSection(lines, "By Extension", extraction.summary.by_extension, 40);
  appendCountSection(lines, "By Extractor", extraction.summary.by_extractor, 30);
  appendCountSection(lines, "By Candidate Domain", extraction.summary.by_candidate_domain, 20);
  appendCountSection(lines, "By Practice Area Signal", extraction.summary.by_practice_area, 30);
  appendCountSection(lines, "By Resource Role Signal", extraction.summary.by_resource_role, 30);
  appendCountSection(lines, "By Capability Candidate", extraction.summary.by_capability_id, 40);
  lines.push("## Design Notes");
  lines.push("");
  lines.push("- This extraction covers files that passed the materialization gate at audit time.");
  lines.push("- Remaining OneDrive dataless files must be materialized before final architecture lock.");
  lines.push("- Use `capability-signals.json` to update Resource Registry, Capability Catalog, and Extractor Registry.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function appendCountSection(lines, title, counts, limit = 20) {
  lines.push(`## ${title}`);
  lines.push("");
  for (const [key, count] of Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, limit)) {
    lines.push(`- ${key}: ${count}`);
  }
  lines.push("");
}

function isInterestingArchiveEntry(entry) {
  return /(^|\/)(plugin\.json|package\.json|manifest\.json|README\.md|SKILL\.md|commands\/.+\.md|skills\/.+\/SKILL\.md|[^/]+\.schema\.json)$/i.test(
    entry,
  );
}

function countExtensions(entries) {
  const counts = {};
  for (const entry of entries) {
    const basename = path.basename(entry);
    const ext = basename.includes(".") ? basename.split(".").pop().toLowerCase() : "[no_ext]";
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  return counts;
}

function compareSlideNames(a, b) {
  const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
  const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
  return aNum - bNum;
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function countBy(records, key) {
  return records.reduce((counts, record) => {
    const value = record[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function countSignal(records, key) {
  const counts = {};
  for (const record of records) {
    for (const value of record.signals?.[key] ?? []) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}

function sum(records, key) {
  return records.reduce((total, record) => total + (Number.isFinite(record[key]) ? record[key] : 0), 0);
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function sanitizeError(error) {
  return {
    name: error.name,
    message: error.message.slice(0, 2000),
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
