import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { isPublicWebClassificationAllowed } from "./adapter-selection-policy.mjs";

export const DEFAULT_PUBLIC_WEB_CONNECTOR_OUT_DIR = "artifacts/public-web-connector/latest";
export const DEFAULT_PUBLIC_WEB_CONNECTOR_INPUT = "examples/public-web-connector/allowed-public-pages.json";

const BLOCKED_PROTOCOLS = new Set(["file:", "data:", "blob:", "ftp:"]);
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

export async function runPublicWebConnector(options = {}) {
  const result = await buildPublicWebConnector(options);
  if (options.write !== false) await writePublicWebConnector(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Public web connector validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPublicWebConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PUBLIC_WEB_CONNECTOR_OUT_DIR);
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_PUBLIC_WEB_CONNECTOR_INPUT);
  const input = await readJson(inputPath);
  const allowlist = input.allowed_domains ?? [];
  const sourceRows = [];
  const blockedRows = [];

  for (const page of input.pages ?? []) {
    const decision = validatePublicWebRequest(page, { allowlist });
    if (!decision.allowed) {
      blockedRows.push(blockedRow(page, decision, generatedAt));
      continue;
    }
    const snapshot = await materializePublicPage(page, {
      generatedAt,
      outputDir,
      live: Boolean(options.live),
      crawl4aiCommand: options.crawl4aiCommand ?? "crwl",
    });
    sourceRows.push(snapshot);
  }

  const validationItems = validateConnectorResult({ input, sourceRows, blockedRows, live: Boolean(options.live) });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "public-web-connector.v1",
    generated_at: generatedAt,
    connector_id: "connector.public_web.v2",
    connector_run_id: `public-web-connector.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    source_input: inputPath,
    connector_policy: {
      allowed_classifications: ["P0_PUBLIC", "P1_INTERNAL"],
      url_allowlist_required: true,
      query_based_crawling_allowed: false,
      private_network_targets_allowed: false,
      authenticated_profile_allowed: false,
      proxy_escalation_allowed: false,
      cloud_crawl4ai_allowed: false,
      external_service_allowed: false,
      human_review_required: true,
      output_status: "pending_review",
    },
    summary: {
      connector_status: validation.valid ? "complete" : "blocked",
      requested_page_count: (input.pages ?? []).length,
      materialized_page_count: sourceRows.length,
      blocked_page_count: blockedRows.length,
      live_mode: Boolean(options.live),
      validation_error_count: validation.errors.length,
    },
    public_web_resource_items: sourceRows,
    blocked_url_attempts: blockedRows,
    validation_items: validationItems,
    validation,
  };
  return {
    ...result,
    markdown: renderPublicWebConnectorMarkdown(result),
  };
}

export async function writePublicWebConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeSnapshotPayloads(result.public_web_resource_items);
  await writeJson(path.join(outDir, "public-web-connector.json"), serializable(result));
  await writeJson(path.join(outDir, "public-web-resource-items.json"), {
    schema_version: "public-web-resource-items.v1",
    generated_at: result.generated_at,
    item_count: result.public_web_resource_items.length,
    public_web_resource_items: stripSnapshotContent(result.public_web_resource_items),
  });
  await writeJson(path.join(outDir, "blocked-url-attempts.json"), {
    schema_version: "blocked-url-attempts.v1",
    generated_at: result.generated_at,
    blocked_count: result.blocked_url_attempts.length,
    blocked_url_attempts: result.blocked_url_attempts,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "public-web-connector-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export function validatePublicWebRequest(page, { allowlist = [] } = {}) {
  if (!isPublicWebClassificationAllowed(page.classification)) {
    return deny("classification_not_allowed", `Classification ${page.classification} is not allowed for public web connector.`);
  }
  if (!page.matter_id) return deny("matter_id_required", "matter_id is required.");
  if (!page.purpose) return deny("purpose_required", "purpose is required.");
  let url;
  try {
    url = new URL(page.url);
  } catch {
    return deny("invalid_url", "URL must be absolute and valid.");
  }
  if (BLOCKED_PROTOCOLS.has(url.protocol)) return deny("blocked_protocol", `${url.protocol} is blocked.`);
  if (!["http:", "https:"].includes(url.protocol)) return deny("unsupported_protocol", `${url.protocol} is unsupported.`);
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return deny("private_network_target", `${url.hostname} is blocked.`);
  if (!allowlist.includes(url.hostname)) return deny("host_not_allowlisted", `${url.hostname} is not in allowed_domains.`);
  if (page.query || page.search_query) return deny("query_based_crawling_blocked", "Query-based crawling is disabled.");
  return { allowed: true, reason: "allowed", url };
}

async function materializePublicPage(page, { generatedAt, outputDir, live, crawl4aiCommand }) {
  const url = new URL(page.url);
  const itemId = `public-web.${slugify(url.hostname)}.${sha256(page.url).slice(0, 12)}`;
  const snapshotDir = path.join(outputDir, "snapshots");
  const markdownPath = path.join(snapshotDir, `${itemId}.md`);
  const htmlPath = path.join(snapshotDir, `${itemId}.html`);

  let markdown = "";
  let html = "";
  let crawl4ai = {
    command_available: false,
    command_used: false,
    command_path: null,
    exit_code: null,
  };

  if (page.fixture_path) {
    html = await readFile(path.resolve(page.fixture_path), "utf8");
    markdown = htmlToMarkdown(html, page.url);
  } else if (live) {
    const commandPath = await commandExists(crawl4aiCommand);
    crawl4ai.command_available = Boolean(commandPath);
    crawl4ai.command_path = commandPath;
    if (commandPath) {
      const command = await runCommand(commandPath, [page.url, "--output", "markdown"], { timeoutMs: 30_000 });
      crawl4ai.command_used = true;
      crawl4ai.exit_code = command.exit_code;
      markdown = command.stdout || "";
      html = "";
    } else {
      throw new Error("Live public web connector requires Crawl4AI crwl command.");
    }
  } else {
    markdown = `# Public Web Snapshot Pending\n\nURL: ${page.url}\n\nFixture mode did not provide fixture_path; live crawling was not enabled.\n`;
  }

  const contentHash = sha256(`${page.url}\n${markdown}\n${html}`);
  return {
    schema_version: "public-web-resource-item.v1",
    item_id: itemId,
    connector_id: "connector.public_web.v2",
    source_system: "public_web",
    source_kind: "public_url",
    source_url: page.url,
    canonical_url: url.toString(),
    allowed_domain: url.hostname,
    tenant_id: page.tenant_id ?? null,
    matter_id: page.matter_id,
    classification: page.classification,
    purpose: page.purpose,
    policy_snapshot_id: page.policy_snapshot_id ?? null,
    fetched_at: generatedAt,
    content_hash_sha256: contentHash,
    markdown_snapshot_path: markdownPath,
    html_snapshot_path: html ? htmlPath : null,
    resource_expansion_candidate: {
      item_id: itemId,
      status: "extracted",
      source_path: markdownPath,
      relative_path: path.relative(process.cwd(), markdownPath),
      extension: "md",
      candidate_domain: "public-web",
      resource_type: "document",
      data_classification: page.classification,
      matter_id: page.matter_id,
      raw_hash_sha256: contentHash,
      extraction: {
        extractor: "plain_text_probe",
        text_preview: markdown.replace(/\s+/g, " ").trim().slice(0, 1600),
        text_length: markdown.length,
        metadata: {
          source_url: page.url,
          canonical_url: url.toString(),
          connector_extractor: "crawl4ai_public_web_connector",
          crawl4ai,
          parser_chain: ["public_web_connector", "plain_text_probe"],
          human_review_required: true,
          output_status: "pending_review",
        },
      },
    },
    crawl4ai,
    _snapshot_content: {
      markdown,
      html,
    },
    external_service_allowed: false,
    human_review_required: true,
    output_status: "pending_review",
  };
}

function blockedRow(page, decision, generatedAt) {
  return {
    schema_version: "blocked-url-attempt.v1",
    generated_at: generatedAt,
    url: page.url ?? null,
    matter_id: page.matter_id ?? null,
    classification: page.classification ?? null,
    reason: decision.reason,
    message: decision.message,
    connector_id: "connector.public_web.v2",
    blocked: true,
  };
}

function validateConnectorResult({ input, sourceRows, blockedRows, live }) {
  const items = [];
  pushCheck(items, "input", "allowed_domains_present", Array.isArray(input.allowed_domains), "allowed_domains must be declared.");
  pushCheck(items, "policy", "blocked_rows_recorded", blockedRows.every((row) => row.blocked), "Blocked URL attempts must be recorded.");
  pushCheck(items, "policy", "source_rows_p0_p1", sourceRows.every((row) => ["P0_PUBLIC", "P1_INTERNAL"].includes(row.classification)), "Materialized public web rows must be P0/P1 only.");
  pushCheck(items, "policy", "no_direct_llm_prompt", sourceRows.every((row) => row.resource_expansion_candidate), "Connector output must become resource expansion candidates.");
  pushCheck(items, "runtime", "fixture_default_no_network", live || sourceRows.every((row) => row.crawl4ai.command_used === false), "Fixture mode must avoid network/crawler execution.");
  return items;
}

export async function runPublicWebConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPublicWebConnector(args);
    console.log(`Public web connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.connector_status}`);
    console.log(`Materialized: ${result.summary.materialized_page_count}`);
    console.log(`Blocked: ${result.summary.blocked_page_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function deny(reason, message) {
  return { allowed: false, reason, message };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: `${item.path}.${item.check_id}`,
    message: item.message,
  }));
  return { valid: errors.length === 0, errors };
}

function renderPublicWebConnectorMarkdown(result) {
  const lines = [];
  lines.push("# Public Web Connector");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.connector_status}`);
  lines.push("");
  lines.push(`- Requested pages: ${result.summary.requested_page_count}`);
  lines.push(`- Materialized pages: ${result.summary.materialized_page_count}`);
  lines.push(`- Blocked pages: ${result.summary.blocked_page_count}`);
  lines.push(`- Live mode: ${result.summary.live_mode}`);
  lines.push("");
  lines.push("Human review note: public web snapshots are internal resource candidates only and are not legal advice or client-facing output.");
  return `${lines.join("\n")}\n`;
}

function htmlToMarkdown(html, url) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? url;
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `# ${decodeHtml(title)}\n\nSource: ${url}\n\n${decodeHtml(body)}\n`;
}

function decodeHtml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs ?? 30_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exit_code: 127, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exit_code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function commandExists(command) {
  const probe = process.platform === "win32" ? "where.exe" : "sh";
  const args = process.platform === "win32" ? [command] : ["-lc", `command -v ${shellQuote(command)}`];
  const result = await runCommand(probe, args, { timeoutMs: 1500 });
  if (result.exit_code === 0) return result.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? command;
  return null;
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_PUBLIC_WEB_CONNECTOR_INPUT,
    outDir: DEFAULT_PUBLIC_WEB_CONNECTOR_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") parsed.inputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--live") parsed.live = true;
    else if (arg === "--crawl4ai-command") parsed.crawl4aiCommand = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/public-web-connector.mjs [options]

Options:
  --input <path>              Public web allowlist input.
  --out-dir <folder>          Output directory.
  --run-at <iso>              Deterministic generated_at timestamp.
  --live                      Enable live Crawl4AI command execution.
  --crawl4ai-command <cmd>    Crawl4AI command name, default crwl.
  --check                     Validate only, do not write artifacts.
  --no-write                  Build without writing artifacts.
  -h, --help                  Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializable(result) {
  const { markdown, ...rest } = result;
  return stripSnapshotContent(rest);
}

async function writeSnapshotPayloads(items = []) {
  for (const item of items) {
    const snapshot = item._snapshot_content;
    if (!snapshot) continue;
    await mkdir(path.dirname(item.markdown_snapshot_path), { recursive: true });
    await writeFile(item.markdown_snapshot_path, snapshot.markdown, "utf8");
    if (snapshot.html && item.html_snapshot_path) await writeFile(item.html_snapshot_path, snapshot.html, "utf8");
  }
}

function stripSnapshotContent(value) {
  if (Array.isArray(value)) return value.map(stripSnapshotContent);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_snapshot_content")
      .map(([key, nested]) => [key, stripSnapshotContent(nested)]),
  );
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runPublicWebConnectorCli();
}
