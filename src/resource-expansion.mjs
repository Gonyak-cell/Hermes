import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { buildResourceAudit, DEFAULT_RESOURCE_ROOTS } from "./resource-audit.mjs";
import { extractResourceFile } from "./resource-extract.mjs";

export const DEFAULT_RESOURCE_EXPANSION_OUT_DIR = "audits/resource-expansion/latest";

const TERMINAL_STATUSES = new Set(["extracted", "quarantined", "failed", "skipped_duplicate"]);
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_TEXT_BYTES = 1024 * 1024;

export async function runResourceExpansionJob(options = {}) {
  const result = await buildResourceExpansionJob(options);
  if (options.write !== false) {
    await writeResourceExpansionJob(result, result.output_dir);
  }
  return result;
}

export async function buildResourceExpansionJob(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_EXPANSION_OUT_DIR);
  const runAt = new Date(options.runAt ?? new Date()).toISOString();
  const roots = (options.roots?.length ? options.roots : DEFAULT_RESOURCE_ROOTS).map((root) => path.resolve(root));
  const sourceId = options.sourceId ?? "local.filesystem";
  const jobId = options.jobId ?? `resource-expansion.${slug(sourceId)}.${shortHash(roots.join("\n"))}`;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const previousState = options.reset ? null : await readPreviousState(outputDir);

  const audit = await buildResourceAudit({ roots, generatedAt: runAt });
  const previousByKey = new Map((previousState?.items ?? []).map((item) => [item.idempotency_key, item]));
  const discoveredFiles = [...audit.files].sort(compareAuditFiles);
  const fileByKey = new Map();
  const contentHashOwners = new Map();
  const items = [];

  for (const previous of previousState?.items ?? []) {
    if (previous.raw_hash_sha256 && previous.status === "extracted") {
      contentHashOwners.set(previous.raw_hash_sha256, previous.resource_id);
    }
  }

  for (const file of discoveredFiles) {
    const idempotencyKey = buildIdempotencyKey(file);
    fileByKey.set(idempotencyKey, file);
    const previous = previousByKey.get(idempotencyKey);
    if (previous && TERMINAL_STATUSES.has(previous.status) && !(options.retryFailed && previous.status === "failed")) {
      items.push(refreshDiscoveredFields(previous, file));
      continue;
    }
    items.push(createDiscoveredItem(file, {
      idempotencyKey,
      jobId,
      runAt,
      maxFileBytes,
      defaultMatterId: options.defaultMatterId ?? null,
    }));
  }

  const processableItems = items.filter((item) => item.status === "queued").slice(0, batchSize);
  const processedByKey = new Map();
  for (const item of processableItems) {
    const file = fileByKey.get(item.idempotency_key);
    processedByKey.set(
      item.idempotency_key,
      await processQueuedItem(item, file, {
        runAt,
        maxTextBytes,
        contentHashOwners,
      }),
    );
  }

  const finalItems = items.map((item) => processedByKey.get(item.idempotency_key) ?? item);
  const summary = summarizeExpansion(finalItems, audit, processableItems.length);
  const cursor = buildCursor(finalItems);

  return {
    schema_version: "resource-expansion-job.v1",
    generated_at: runAt,
    job_id: jobId,
    source_id: sourceId,
    source_roots: roots,
    output_dir: outputDir,
    policy_snapshot_id: options.policySnapshotId ?? "policy.resource_expansion.default.v1",
    batch: {
      requested_batch_size: batchSize,
      processed_count: processableItems.length,
      remaining_count: summary.remaining_count,
    },
    cursor,
    resumability: {
      loaded_previous_state: Boolean(previousState),
      previous_generated_at: previousState?.generated_at ?? null,
      idempotency_strategy: "path:size:modified_at",
      state_path: path.join(outputDir, "resource-expansion-state.json"),
    },
    audit_summary: audit.summary,
    summary,
    items: finalItems,
  };
}

export async function writeResourceExpansionJob(job, outDir = job.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "resource-expansion-job.json"), job);
  await writeJson(path.join(outDir, "resource-expansion-state.json"), job);
  await writeJson(path.join(outDir, "quarantine-queue.json"), {
    generated_at: job.generated_at,
    count: job.items.filter((item) => ["quarantined", "failed"].includes(item.status)).length,
    items: job.items.filter((item) => ["quarantined", "failed"].includes(item.status)),
  });
  await writeJson(path.join(outDir, "next-batch.json"), {
    generated_at: job.generated_at,
    count: job.items.filter((item) => item.status === "queued").length,
    items: job.items.filter((item) => item.status === "queued").slice(0, job.batch.requested_batch_size),
  });
  await writeFile(path.join(outDir, "summary.md"), renderResourceExpansionSummary(job), "utf8");
}

export async function runResourceExpansionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const job = await runResourceExpansionJob(args);
  console.log(`Resource expansion job written to ${job.output_dir}`);
  console.log(`Job: ${job.job_id}`);
  console.log(`Discovered: ${job.summary.discovered_count}`);
  console.log(`Processed this run: ${job.batch.processed_count}`);
  console.log(`Extracted: ${job.summary.by_status.extracted ?? 0}`);
  console.log(`Quarantined: ${job.summary.by_status.quarantined ?? 0}`);
  console.log(`Skipped duplicates: ${job.summary.by_status.skipped_duplicate ?? 0}`);
  console.log(`Remaining queued: ${job.summary.remaining_count}`);
}

function createDiscoveredItem(file, options) {
  const resourceId = `resource.expansion.${shortHash(file.path)}`;
  const classification = classifyData(file);
  const quarantine = initialQuarantineReason(file, options.maxFileBytes, classification);
  const status = quarantine ? "quarantined" : "queued";
  const statusHistory = [
    statusEvent("discovered", options.runAt, {
      source_path: file.path,
      audit_status: file.audit_status,
    }),
  ];
  if (status === "queued") {
    statusHistory.push(statusEvent("queued", options.runAt, { reason: "ready_for_extraction" }));
  } else {
    statusHistory.push(statusEvent("quarantined", options.runAt, { reason: quarantine }));
  }

  return {
    item_id: `resource-expansion-item.${shortHash(`${options.jobId}:${file.path}`)}`,
    resource_id: resourceId,
    resource_version_id: `${resourceId}.v1`,
    idempotency_key: options.idempotencyKey,
    status,
    source_path: file.path,
    relative_path: file.relative_path,
    root: file.root,
    size_bytes: file.size_bytes,
    modified_at: file.modified_at,
    extension: file.extension,
    candidate_domain: file.candidate_domain,
    resource_type: file.resource_type,
    extractor_family: file.extractor_family,
    matter_id: options.defaultMatterId,
    data_classification: classification,
    quarantine_reason: quarantine,
    raw_hash_sha256: null,
    text_hash_sha256: null,
    duplicate_of: null,
    extraction: null,
    error: null,
    status_history: statusHistory,
  };
}

async function processQueuedItem(item, file, options) {
  const statusHistory = [...item.status_history];
  try {
    statusHistory.push(statusEvent("ingested", options.runAt, { method: "local_hash" }));
    const rawHashSha256 = await hashFile(file.path);
    if (options.contentHashOwners.has(rawHashSha256)) {
      return {
        ...item,
        status: "skipped_duplicate",
        raw_hash_sha256: rawHashSha256,
        duplicate_of: options.contentHashOwners.get(rawHashSha256),
        status_history: [
          ...statusHistory,
          statusEvent("skipped_duplicate", options.runAt, {
            duplicate_of: options.contentHashOwners.get(rawHashSha256),
          }),
        ],
      };
    }

    statusHistory.push(statusEvent("classified", options.runAt, { data_classification: item.data_classification }));
    const extraction = await extractResourceFile(file, { maxTextBytes: options.maxTextBytes });
    if (extraction.extraction_status !== "extracted") {
      return {
        ...item,
        status: "failed",
        raw_hash_sha256: rawHashSha256,
        error: extraction.error ?? { message: "extraction did not complete" },
        status_history: [...statusHistory, statusEvent("failed", options.runAt, { stage: "extract" })],
      };
    }

    options.contentHashOwners.set(rawHashSha256, item.resource_id);
    return {
      ...item,
      status: "extracted",
      raw_hash_sha256: rawHashSha256,
      text_hash_sha256: extraction.text_hash_sha256,
      extraction: {
        extractor: extraction.extractor,
        text_length: extraction.text_length,
        text_truncated: extraction.text_truncated,
        text_preview: extraction.text_preview,
        headings: extraction.headings,
        metadata: extraction.metadata,
        signals: extraction.signals,
      },
      status_history: [
        ...statusHistory,
        statusEvent("normalized", options.runAt, {
          text_hash_sha256: extraction.text_hash_sha256,
        }),
        statusEvent("indexed", options.runAt, {
          index_scope: "resource-expansion-local-ledger",
        }),
        statusEvent("extracted", options.runAt, {
          extractor: extraction.extractor,
        }),
      ],
    };
  } catch (error) {
    return {
      ...item,
      status: "failed",
      error: sanitizeError(error),
      status_history: [...statusHistory, statusEvent("failed", options.runAt, { stage: "ingest_or_extract" })],
    };
  }
}

function initialQuarantineReason(file, maxFileBytes, classification) {
  if (classification === "P5_SECRET") return "secret_or_credential_path";
  if (file.fileprovider?.dataless) return "materialization_required";
  if (file.size_bytes > maxFileBytes) return "file_too_large_for_default_expansion";
  if (["unsupported_but_recorded", "recorded_unknown_type"].includes(file.audit_status)) {
    return `unsupported_or_unknown_type:${file.extension}`;
  }
  return null;
}

function classifyData(file) {
  const text = `${file.path} ${file.relative_path}`.toLocaleLowerCase("ko-KR");
  if (/(^|[/_.-])(\.env|env|secret|credential|token|password|apikey|api-key|private-key)([/_.-]|$)/i.test(text)) {
    return "P5_SECRET";
  }
  if (file.candidate_domain === "law-firm") return "P2_CLIENT_CONFIDENTIAL";
  if (file.candidate_domain === "personal-dev") return "P1_INTERNAL";
  if (file.candidate_domain === "creative") return "P1_INTERNAL";
  return "P1_INTERNAL";
}

function refreshDiscoveredFields(previous, file) {
  return {
    ...previous,
    source_path: file.path,
    relative_path: file.relative_path,
    root: file.root,
    size_bytes: file.size_bytes,
    modified_at: file.modified_at,
    extension: file.extension,
    candidate_domain: file.candidate_domain,
    resource_type: file.resource_type,
    extractor_family: file.extractor_family,
  };
}

function summarizeExpansion(items, audit, processedCount) {
  const byStatus = countBy(items, "status");
  const byClassification = countBy(items, "data_classification");
  const byDomain = countBy(items, "candidate_domain");
  return {
    discovered_count: items.length,
    processed_this_run: processedCount,
    remaining_count: byStatus.queued ?? 0,
    terminal_count: items.filter((item) => TERMINAL_STATUSES.has(item.status)).length,
    failed_count: byStatus.failed ?? 0,
    quarantine_count: byStatus.quarantined ?? 0,
    skipped_duplicate_count: byStatus.skipped_duplicate ?? 0,
    extracted_count: byStatus.extracted ?? 0,
    dataless_count: audit.summary.dataless_files,
    by_status: byStatus,
    by_data_classification: byClassification,
    by_candidate_domain: byDomain,
  };
}

function buildCursor(items) {
  const queued = items.filter((item) => item.status === "queued");
  return {
    queued_count: queued.length,
    next_item_id: queued[0]?.item_id ?? null,
    next_relative_path: queued[0]?.relative_path ?? null,
  };
}

function renderResourceExpansionSummary(job) {
  const lines = [];
  lines.push("# Resource Expansion Summary");
  lines.push("");
  lines.push(`Generated: ${job.generated_at}`);
  lines.push(`Job: ${job.job_id}`);
  lines.push(`Source: ${job.source_id}`);
  lines.push(`Processed this run: ${job.batch.processed_count}`);
  lines.push(`Remaining queued: ${job.summary.remaining_count}`);
  lines.push("");
  appendCounts(lines, "By Status", job.summary.by_status);
  appendCounts(lines, "By Data Classification", job.summary.by_data_classification);
  appendCounts(lines, "By Candidate Domain", job.summary.by_candidate_domain);
  lines.push("## Next Gate");
  lines.push("");
  if (job.summary.remaining_count > 0) {
    lines.push("Run the same command again to continue the next queued batch.");
  } else if (job.summary.quarantine_count > 0 || job.summary.failed_count > 0) {
    lines.push("Review `quarantine-queue.json` before promoting resources into Evidence OS.");
  } else {
    lines.push("All discovered resources reached a terminal expansion status.");
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function readPreviousState(outDir) {
  try {
    return JSON.parse(await readFile(path.join(outDir, "resource-expansion-state.json"), "utf8"));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const parsed = {
    roots: [],
    outDir: DEFAULT_RESOURCE_EXPANSION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--root") parsed.roots.push(argv[++index]);
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--source-id") parsed.sourceId = argv[++index];
    else if (arg === "--job-id") parsed.jobId = argv[++index];
    else if (arg === "--batch-size") parsed.batchSize = Number.parseInt(argv[++index], 10);
    else if (arg === "--max-file-bytes") parsed.maxFileBytes = Number.parseInt(argv[++index], 10);
    else if (arg === "--max-text-bytes") parsed.maxTextBytes = Number.parseInt(argv[++index], 10);
    else if (arg === "--default-matter-id") parsed.defaultMatterId = argv[++index];
    else if (arg === "--reset") parsed.reset = true;
    else if (arg === "--retry-failed") parsed.retryFailed = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-expansion.mjs [options]

Options:
  --root <folder>              Source folder. Can be repeated.
  --out-dir <folder>           Job output/state directory.
  --source-id <id>             Logical source id, e.g. onedrive.template.
  --job-id <id>                Stable expansion job id.
  --batch-size <n>             Number of queued files to process this run.
  --max-file-bytes <n>         Quarantine files above this size.
  --max-text-bytes <n>         Max text bytes for plain text extraction.
  --default-matter-id <id>     Optional matter id applied to items.
  --reset                      Ignore previous state in the output directory.
  --retry-failed               Retry failed items instead of preserving them.
  -h, --help                   Show this help.
`);
}

function statusEvent(status, at, detail = {}) {
  return { status, at, detail };
}

function buildIdempotencyKey(file) {
  return sha256([file.path, file.size_bytes, file.modified_at].join("|"));
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

function compareAuditFiles(a, b) {
  return a.relative_path.localeCompare(b.relative_path) || a.path.localeCompare(b.path);
}

function appendCounts(lines, title, counts) {
  lines.push(`## ${title}`);
  lines.push("");
  for (const [key, count] of Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`- ${key}: ${count}`);
  }
  lines.push("");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sanitizeError(error) {
  return {
    message: String(error?.message ?? error),
    name: error?.name ?? "Error",
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function shortHash(value, length = 12) {
  return sha256(value).slice(0, length);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "source";
}
