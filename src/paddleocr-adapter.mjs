import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_STDOUT_BYTES = 4 * 1024 * 1024;

export async function runPaddleOcrAdapter(file, options = {}) {
  const commandName = options.command ?? "paddleocr";
  const commandPath = await commandExists(commandName);
  const startedAt = new Date().toISOString();
  if (!commandPath) {
    return {
      schema_version: "document-parser-adapter-output.v1",
      extractor: "paddleocr_local",
      available: false,
      ok: false,
      text: "",
      text_truncated: false,
      metadata: metadataBase(file, startedAt, {
        failure_reason: "paddleocr_command_unavailable",
        fallback_recommended: true,
      }),
    };
  }

  const args = ["ocr", "-i", file.path, "--return_word_box", "true"];
  const result = await runCommand(commandPath, args, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxStdoutBytes: options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES,
  });
  if (result.exit_code !== 0) {
    return {
      schema_version: "document-parser-adapter-output.v1",
      extractor: "paddleocr_local",
      available: true,
      ok: false,
      text: "",
      text_truncated: result.truncated,
      metadata: metadataBase(file, startedAt, {
        command_path: commandPath,
        command_args: args,
        exit_code: result.exit_code,
        stderr_hash: sha256(result.stderr),
        failure_reason: "paddleocr_command_failed",
      }),
    };
  }

  const parsed = parsePaddleOutput(result.stdout);
  return {
    schema_version: "document-parser-adapter-output.v1",
    extractor: "paddleocr_local",
    available: true,
    ok: parsed.text.trim().length > 0,
    text: parsed.text,
    text_truncated: result.truncated,
    metadata: metadataBase(file, startedAt, {
      command_path: commandPath,
      command_args: args,
      stdout_hash: sha256(result.stdout),
      stderr_hash: sha256(result.stderr),
      page_count: parsed.page_count,
      bbox_count: parsed.bbox_count,
      mean_confidence: parsed.mean_confidence,
      language: parsed.language,
      source_spans: parsed.source_spans,
      model_hash: options.modelHash ?? null,
    }),
  };
}

export function shouldTryPaddleOcr(extraction, file) {
  const ext = String(file.extension ?? "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return true;
  const textLength = extraction?.text?.trim?.().length ?? 0;
  if (ext === "pdf" && textLength < 80) return true;
  const confidence = extraction?.metadata?.mean_confidence;
  return Number.isFinite(confidence) && confidence < 0.65;
}

function parsePaddleOutput(stdout) {
  let data = null;
  try {
    data = JSON.parse(stdout);
  } catch {
    const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return {
      text: lines.join("\n"),
      page_count: 1,
      bbox_count: 0,
      mean_confidence: null,
      language: inferLanguage(lines.join("\n")),
      source_spans: [],
    };
  }

  const spans = [];
  const textParts = [];
  const confidences = [];
  walk(data, (value) => {
    if (value && typeof value === "object") {
      const text = value.text ?? value.transcription ?? value.content;
      if (typeof text === "string" && text.trim()) textParts.push(text.trim());
      const confidence = value.confidence ?? value.score;
      if (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) confidences.push(confidence);
      const bbox = value.bbox ?? value.box ?? value.points;
      if (bbox) spans.push({ page_number: value.page ?? value.page_number ?? null, bbox, text: typeof text === "string" ? text : "" });
    }
  });
  const text = [...new Set(textParts)].join("\n");
  return {
    text,
    page_count: Array.isArray(data?.pages) ? data.pages.length : 1,
    bbox_count: spans.length,
    mean_confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
    language: inferLanguage(text),
    source_spans: spans.slice(0, 200),
  };
}

function metadataBase(file, startedAt, extra = {}) {
  return {
    adapter_id: "extractor-adapter.paddleocr_local.v1",
    extractor_id: "extractor.paddleocr_local.v1",
    parser: "paddleocr",
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

function walk(value, visitor) {
  visitor(value);
  if (Array.isArray(value)) value.forEach((item) => walk(item, visitor));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => walk(item, visitor));
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

function inferLanguage(text) {
  return /[\uac00-\ud7a3]/u.test(text) ? "ko" : "unknown";
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}
