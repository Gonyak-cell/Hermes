import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_STDOUT_BYTES = 4 * 1024 * 1024;

export async function runLiteParseAdapter(file, options = {}) {
  const commandName = options.command ?? "lit";
  const commandPath = await commandExists(commandName);
  const startedAt = new Date().toISOString();
  if (!commandPath) {
    return unavailableResult(file, "liteparse_command_unavailable", startedAt, Boolean(options.sidecar));
  }

  const args = [
    "parse",
    file.path,
    "--format",
    "json",
    "--max-pages",
    String(options.maxPages ?? 20),
  ];
  const result = await runCommand(commandPath, args, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxStdoutBytes: options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES,
  });
  if (result.exit_code !== 0) {
    return {
      schema_version: "document-parser-adapter-output.v1",
      extractor: options.sidecar ? "liteparse_layout_sidecar" : "liteparse_local",
      available: true,
      ok: false,
      text: "",
      text_truncated: result.truncated,
      metadata: metadataBase(file, startedAt, {
        command_path: commandPath,
        command_args: args,
        exit_code: result.exit_code,
        stderr_hash: sha256(result.stderr),
        failure_reason: "liteparse_command_failed",
      }, Boolean(options.sidecar)),
    };
  }

  const parsed = parseLiteParseOutput(result.stdout);
  const text = parsed.text.trim();
  return {
    schema_version: "document-parser-adapter-output.v1",
    extractor: options.sidecar ? "liteparse_layout_sidecar" : "liteparse_local",
    available: true,
    ok: Boolean(text || parsed.bbox_count > 0 || parsed.page_count > 0),
    text,
    text_truncated: result.truncated,
    metadata: metadataBase(file, startedAt, {
      command_path: commandPath,
      command_args: args,
      stdout_hash: sha256(result.stdout),
      stderr_hash: sha256(result.stderr),
      parser_chain: [options.sidecar ? "liteparse_layout_sidecar" : "liteparse_local"],
      page_count: parsed.page_count,
      bbox_count: parsed.bbox_count,
      table_signal_count: parsed.table_signal_count,
      mean_confidence: parsed.mean_confidence,
      source_spans: parsed.source_spans,
      screenshot_refs: parsed.screenshot_refs,
    }, Boolean(options.sidecar)),
  };
}

export function liteParseUsable(result) {
  return Boolean(result?.ok && typeof result.text === "string" && result.text.trim().length > 0);
}

function unavailableResult(file, reason, startedAt, sidecar = false) {
  return {
    schema_version: "document-parser-adapter-output.v1",
    extractor: sidecar ? "liteparse_layout_sidecar" : "liteparse_local",
    available: false,
    ok: false,
    text: "",
    text_truncated: false,
    metadata: metadataBase(file, startedAt, {
      failure_reason: reason,
      parser_chain: [sidecar ? "liteparse_layout_sidecar" : "liteparse_local"],
      fallback_recommended: true,
    }, sidecar),
  };
}

function metadataBase(file, startedAt, extra = {}, sidecar = false) {
  const extractorName = sidecar ? "liteparse_layout_sidecar" : "liteparse_local";
  return {
    adapter_id: `extractor-adapter.${extractorName}.v1`,
    extractor_id: `extractor.${extractorName}.v1`,
    parser: "liteparse",
    external_service_allowed: false,
    network_access_allowed: false,
    model_download_allowed: false,
    human_review_required: true,
    output_status: "pending_review",
    source_path: file.path,
    extension: file.extension,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    ...extra,
  };
}

function parseLiteParseOutput(stdout) {
  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      text: stdout,
      page_count: 0,
      bbox_count: 0,
      table_signal_count: 0,
      mean_confidence: null,
      source_spans: [],
      screenshot_refs: [],
    };
  }

  const texts = [];
  const sourceSpans = [];
  const confidences = [];
  const screenshots = [];
  walk(parsed, (value, pathParts) => {
    if (typeof value === "string" && /text|markdown|content|value/i.test(pathParts.at(-1) ?? "")) {
      if (value.trim()) texts.push(value.trim());
    }
    if (typeof value === "number" && /confidence|score/i.test(pathParts.at(-1) ?? "")) {
      if (Number.isFinite(value) && value >= 0 && value <= 1) confidences.push(value);
    }
    if (typeof value === "string" && /screenshot|image|render/i.test(pathParts.at(-1) ?? "")) {
      screenshots.push(value);
    }
    if (value && typeof value === "object" && hasBbox(value)) {
      sourceSpans.push({
        page_number: value.page ?? value.page_number ?? null,
        bbox: value.bbox ?? [value.x, value.y, value.width, value.height].filter((item) => item !== undefined),
        text: value.text ?? value.content ?? "",
      });
    }
  });

  const pageCount = countPages(parsed);
  const text = [...new Set(texts)].join("\n\n");
  return {
    text,
    page_count: pageCount,
    bbox_count: sourceSpans.length,
    table_signal_count: countKeys(parsed, /table/i),
    mean_confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
    source_spans: sourceSpans.slice(0, 200),
    screenshot_refs: [...new Set(screenshots)].slice(0, 40),
  };
}

function walk(value, visitor, pathParts = []) {
  visitor(value, pathParts);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nested]) => walk(nested, visitor, [...pathParts, key]));
  }
}

function hasBbox(value) {
  if (Array.isArray(value.bbox)) return true;
  return ["x", "y", "width", "height"].every((key) => Number.isFinite(value[key]));
}

function countPages(value) {
  if (Array.isArray(value?.pages)) return value.pages.length;
  if (Array.isArray(value?.documents?.[0]?.pages)) return value.documents[0].pages.length;
  return countKeys(value, /^page(_number)?$/i);
}

function countKeys(value, pattern) {
  let count = 0;
  walk(value, (_nested, pathParts) => {
    if (pattern.test(pathParts.at(-1) ?? "")) count += 1;
  });
  return count;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= (options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES)) stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exit_code: 127, stdout: "", stderr: error.message, truncated: false });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exit_code: timedOut ? 124 : code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        truncated: stdoutBytes > (options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES),
      });
    });
  });
}

async function commandExists(command) {
  const isWindows = process.platform === "win32";
  const probe = isWindows ? "where.exe" : "sh";
  const args = isWindows ? [command] : ["-lc", `command -v ${shellQuote(command)}`];
  const result = await runCommand(probe, args, { timeoutMs: 1500, maxStdoutBytes: 4096 });
  if (result.exit_code === 0) return result.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? command;
  if (!isWindows) {
    const which = await runCommand("which", [command], { timeoutMs: 1500, maxStdoutBytes: 4096 });
    if (which.exit_code === 0) return which.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? command;
  }
  return null;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}
