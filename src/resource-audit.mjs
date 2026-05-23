import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const DATALESS_FLAG = 0x40000000;
const COMPRESSED_FLAG = 0x20;

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
  "profile",
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

const ARCHIVE_EXTENSIONS = new Set(["plugin", "rar", "zip"]);
const EMAIL_EXTENSIONS = new Set(["eml"]);
const OFFICE_EXTENSIONS = new Set(["doc", "docx", "hwp", "msg", "pdf", "pptx", "xlsb", "xlsx"]);
const MEDIA_EXTENSIONS = new Set(["ico", "jpg", "jpeg", "mp4", "png", "webp"]);

export const DEFAULT_RESOURCE_ROOTS = [
  "/Users/jws/Library/CloudStorage/OneDrive-개인/02_Template",
];

export async function buildResourceAudit(options = {}) {
  const roots = options.roots?.length ? options.roots : DEFAULT_RESOURCE_ROOTS;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const files = [];

  for (const root of roots) {
    const rootFiles = await statFiles(root);
    files.push(...rootFiles.map((file) => enrichFileRecord(file, root)));
  }

  const summary = summarizeFiles(files);
  const queues = buildQueues(files);

  return {
    schema_version: "resource-audit.v1",
    generated_at: generatedAt,
    roots,
    summary,
    queues,
    files,
  };
}

export async function writeResourceAudit(audit, outDir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "resource-audit.json"), audit);
  await writeJson(path.join(outDir, "materialization-queue.json"), {
    generated_at: audit.generated_at,
    count: audit.queues.needs_materialization.length,
    files: audit.queues.needs_materialization,
  });
  await writeJson(path.join(outDir, "extractor-queue.json"), {
    generated_at: audit.generated_at,
    count: audit.queues.extractable.length,
    files: audit.queues.extractable,
  });
  await writeJson(path.join(outDir, "unsupported-queue.json"), {
    generated_at: audit.generated_at,
    count: audit.queues.unsupported.length,
    files: audit.queues.unsupported,
  });
  await writeFile(path.join(outDir, "summary.md"), renderAuditSummary(audit), "utf8");
}

export async function hashReadableLocalFile(filePath, options = {}) {
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const bytes = await readFile(filePath);
  const sample = bytes.subarray(0, maxBytes);
  return {
    bytes_read: bytes.length,
    sample_hash_sha256: createHash("sha256").update(sample).digest("hex"),
    full_hash_sha256:
      bytes.length <= maxBytes ? createHash("sha256").update(bytes).digest("hex") : null,
  };
}

function statFiles(root) {
  return new Promise((resolve, reject) => {
    const statFormat = "%N\t%z\t%m\t%B\t%f";
    const child = spawn("find", [root, "-type", "f", "-exec", "stat", "-f", statFormat, "{}", "+"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `find/stat exited with code ${code}`));
        return;
      }
      const files = stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => parseStatLine(line, root))
        .filter(Boolean);
      resolve(files);
    });
  });
}

function parseStatLine(line, root) {
  const [filePath, size, modifiedEpoch, createdEpoch, flags] = line.split("\t");
  if (!filePath) return null;
  const flagNumber = Number.parseInt(flags, 10);
  return {
    path: filePath,
    root,
    size_bytes: Number.parseInt(size, 10),
    modified_at: new Date(Number.parseInt(modifiedEpoch, 10) * 1000).toISOString(),
    created_at: new Date(Number.parseInt(createdEpoch, 10) * 1000).toISOString(),
    flags_decimal: flagNumber,
    fileprovider: {
      dataless: Boolean(flagNumber & DATALESS_FLAG),
      compressed: Boolean(flagNumber & COMPRESSED_FLAG),
    },
  };
}

function enrichFileRecord(file, root) {
  const relativePath = path.relative(root, file.path);
  const normalizedRelativePath = relativePath.split(path.sep).join("/");
  const extension = getExtension(file.path);
  const topLevelFolder = normalizedRelativePath.split("/")[0] || ".";
  const resourceType = classifyResourceType(file.path, extension);
  const domain = classifyDomain(file.path, topLevelFolder, resourceType);
  const auditStatus = classifyAuditStatus(file, extension);

  return {
    ...file,
    relative_path: normalizedRelativePath,
    top_level_folder: topLevelFolder,
    extension,
    resource_type: resourceType,
    candidate_domain: domain,
    audit_status: auditStatus,
    extractor_family: chooseExtractorFamily(extension),
  };
}

function getExtension(filePath) {
  const basename = path.basename(filePath);
  if (!basename.includes(".")) return "[no_ext]";
  return basename.split(".").pop().toLowerCase();
}

function classifyResourceType(filePath, extension) {
  const normalized = filePath.toLowerCase();
  if (normalized.includes("/skills/") || normalized.endsWith("/skill.md")) return "skill";
  if (normalized.includes("/commands/") && extension === "md") return "command";
  if (normalized.includes("/scripts/") || ["py", "js", "mjs", "ps1", "sh", "bat"].includes(extension)) return "script";
  if (EMAIL_EXTENSIONS.has(extension)) return "email";
  if (extension === "plugin") return "plugin-package";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  if (OFFICE_EXTENSIONS.has(extension)) return "document";
  if (MEDIA_EXTENSIONS.has(extension)) return "media";
  if (TEXT_EXTENSIONS.has(extension)) return "reference";
  return "unknown";
}

function classifyDomain(filePath, topLevelFolder, resourceType) {
  const text = `${filePath} ${topLevelFolder}`.toLocaleLowerCase("ko-KR").normalize("NFC");
  if (text.includes("agent-skills") || text.includes("open-generative-ai") || text.includes("ui-tars")) {
    return "personal-dev";
  }
  if (text.includes("sulphur") || text.includes("pptx") || text.includes("video")) {
    return "creative";
  }
  if (
    text.includes("dd") ||
    text.includes("ldd") ||
    text.includes("계약") ||
    text.includes("소송") ||
    text.includes("법률") ||
    text.includes("수임") ||
    text.includes("회사법") ||
    text.includes("공시") ||
    text.includes("의견서") ||
    text.includes("내용증명") ||
    resourceType === "plugin-package"
  ) {
    return "law-firm";
  }
  return "unclassified";
}

function classifyAuditStatus(file, extension) {
  if (file.fileprovider.dataless) return "needs_materialization";
  if (["doc", "hwp", "msg", "rar", "xlsb"].includes(extension)) return "unsupported_but_recorded";
  if (
    TEXT_EXTENSIONS.has(extension) ||
    EMAIL_EXTENSIONS.has(extension) ||
    ARCHIVE_EXTENSIONS.has(extension) ||
    OFFICE_EXTENSIONS.has(extension) ||
    MEDIA_EXTENSIONS.has(extension)
  ) {
    return "ready_for_extraction";
  }
  return "recorded_unknown_type";
}

function chooseExtractorFamily(extension) {
  if (TEXT_EXTENSIONS.has(extension)) return "plain_text";
  if (extension === "docx") return "docx_word_xml";
  if (extension === "pptx") return "pptx_open_xml";
  if (extension === "xlsx") return "xlsx_workbook";
  if (extension === "pdf") return "pdf_text_or_ocr";
  if (extension === "eml") return "outlook_eml";
  if (extension === "msg") return "outlook_msg";
  if (extension === "hwp") return "hwp_converter";
  if (extension === "doc") return "legacy_doc_converter";
  if (extension === "xlsb") return "xlsb_converter";
  if (MEDIA_EXTENSIONS.has(extension)) return "media_metadata_or_ocr";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive_or_plugin";
  return "unknown";
}

function summarizeFiles(files) {
  const summary = {
    total_files: files.length,
    total_size_bytes: sum(files, "size_bytes"),
    by_status: countBy(files, "audit_status"),
    by_extension: countBy(files, "extension"),
    by_top_level_folder: countBy(files, "top_level_folder"),
    by_candidate_domain: countBy(files, "candidate_domain"),
    dataless_files: files.filter((file) => file.fileprovider.dataless).length,
    dataless_size_bytes: sum(files.filter((file) => file.fileprovider.dataless), "size_bytes"),
    local_files: files.filter((file) => !file.fileprovider.dataless).length,
  };
  summary.dataless_ratio = summary.total_files ? summary.dataless_files / summary.total_files : 0;
  return summary;
}

function buildQueues(files) {
  const publicShape = (file) => ({
    path: file.path,
    relative_path: file.relative_path,
    size_bytes: file.size_bytes,
    extension: file.extension,
    top_level_folder: file.top_level_folder,
    candidate_domain: file.candidate_domain,
    resource_type: file.resource_type,
    extractor_family: file.extractor_family,
    audit_status: file.audit_status,
  });

  return {
    needs_materialization: files.filter((file) => file.audit_status === "needs_materialization").map(publicShape),
    extractable: files.filter((file) => file.audit_status === "ready_for_extraction").map(publicShape),
    unsupported: files
      .filter((file) => ["unsupported_but_recorded", "recorded_unknown_type"].includes(file.audit_status))
      .map(publicShape),
  };
}

function renderAuditSummary(audit) {
  const lines = [];
  lines.push("# Resource Audit Summary");
  lines.push("");
  lines.push(`Generated: ${audit.generated_at}`);
  lines.push(`Total files: ${audit.summary.total_files}`);
  lines.push(`Total size: ${formatBytes(audit.summary.total_size_bytes)}`);
  lines.push(`Local/readable candidates: ${audit.summary.local_files}`);
  lines.push(`Needs materialization: ${audit.summary.dataless_files} (${formatPercent(audit.summary.dataless_ratio)})`);
  lines.push(`Dataless size: ${formatBytes(audit.summary.dataless_size_bytes)}`);
  lines.push("");
  appendCountSection(lines, "By Status", audit.summary.by_status);
  appendCountSection(lines, "By Top-Level Folder", audit.summary.by_top_level_folder, 30);
  appendCountSection(lines, "By Extension", audit.summary.by_extension, 40);
  appendCountSection(lines, "By Candidate Domain", audit.summary.by_candidate_domain);
  lines.push("");
  lines.push("## Next Gates");
  lines.push("");
  lines.push("1. Materialize every `needs_materialization` file from OneDrive.");
  lines.push("2. Re-run the audit until `dataless_files` is 0 or every remaining item is explicitly waived.");
  lines.push("3. Run type-specific extractors on `extractor-queue.json`.");
  lines.push("4. Feed extracted fingerprints into Resource Registry, Capability Catalog, and Extractor Registry.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function appendCountSection(lines, title, counts, limit = 20) {
  lines.push(`## ${title}`);
  lines.push("");
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  for (const [key, count] of entries) {
    lines.push(`- ${key}: ${count}`);
  }
  lines.push("");
}

function countBy(files, key) {
  return files.reduce((counts, file) => {
    const value = file[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sum(files, key) {
  return files.reduce((total, file) => total + (Number.isFinite(file[key]) ? file[key] : 0), 0);
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let current = value / 1024;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
