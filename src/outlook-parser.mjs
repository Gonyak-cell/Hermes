import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function readOutlookMessages(inputPath, options = {}) {
  const info = await stat(inputPath);
  if (info.isDirectory()) {
    const entries = await readdir(inputPath);
    const files = entries
      .filter((entry) => /\.(eml|json)$/i.test(entry))
      .sort()
      .map((entry) => path.join(inputPath, entry));
    const all = [];
    for (const file of files) {
      all.push(...(await readOutlookMessages(file, options)));
    }
    return all;
  }

  if (/\.json$/i.test(inputPath)) {
    return parseOutlookJson(await readFile(inputPath, "utf8"), options);
  }

  if (/\.eml$/i.test(inputPath)) {
    return [parseOutlookEml(await readFile(inputPath, "utf8"), options, inputPath)];
  }

  throw new Error(`Unsupported Outlook input: ${inputPath}`);
}

export function parseOutlookJson(text, options = {}) {
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : parsed.value ?? parsed.messages ?? [parsed];
  return items.map((item, index) => normalizeOutlookJsonItem(item, index, options));
}

export function parseOutlookEml(text, options = {}, inputPath = "message.eml") {
  const { headers, body } = splitEml(text);
  const subject = decodeMimeWords(headers.subject ?? "(no subject)");
  const from = decodeMimeWords(headers.from ?? "unknown");
  const date = normalizeDate(headers.date) ?? options.defaultDate;
  const sourceId = options.sourceId ?? "outlook-eml";
  const cleanBody = cleanEmailBody(body);

  return {
    id: `OUTLOOK-${slug(path.basename(inputPath))}`,
    matter_id: options.matterId,
    source_type: "outlook",
    source_id: sourceId,
    date,
    author: from,
    text: [`Subject: ${subject}`, cleanBody].filter(Boolean).join("\n\n"),
  };
}

function normalizeOutlookJsonItem(item, index, options) {
  const subject = item.subject ?? item.Subject ?? "(no subject)";
  const from = item.from?.emailAddress?.name ?? item.from?.emailAddress?.address ?? item.from ?? item.sender ?? "unknown";
  const date = normalizeDate(item.receivedDateTime ?? item.sentDateTime ?? item.date ?? item.Date) ?? options.defaultDate;
  const body =
    item.body?.content ??
    item.bodyPreview ??
    item.Body ??
    item.text ??
    "";

  return {
    id: item.id ? `OUTLOOK-${slug(item.id)}` : `OUTLOOK-JSON-${String(index + 1).padStart(4, "0")}`,
    matter_id: options.matterId,
    source_type: "outlook",
    source_id: options.sourceId ?? "outlook-json",
    date,
    author: String(from),
    text: [`Subject: ${subject}`, cleanEmailBody(String(body))].filter(Boolean).join("\n\n"),
  };
}

function splitEml(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const splitIndex = normalized.indexOf("\n\n");
  const headerText = splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized;
  const body = splitIndex >= 0 ? normalized.slice(splitIndex + 2) : "";
  const headers = {};
  let current = "";

  for (const line of headerText.split("\n")) {
    if (/^\s/.test(line) && current) {
      headers[current] = `${headers[current]} ${line.trim()}`;
      continue;
    }
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    current = match[1].toLowerCase();
    headers[current] = match[2].trim();
  }

  return { headers, body };
}

function cleanEmailBody(body) {
  return decodeQuotedPrintable(body)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeQuotedPrintable(value) {
  return value
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeMimeWords(value) {
  return String(value).replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, encoded) => {
    try {
      return Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      return encoded;
    }
  });
}

function normalizeDate(value) {
  if (!value) return undefined;
  const time = Date.parse(value);
  if (!Number.isNaN(time)) return new Date(time).toISOString().slice(0, 10);
  const iso = String(value).match(/20\d{2}-\d{1,2}-\d{1,2}/);
  if (iso) return iso[0];
  return undefined;
}

function slug(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "message";
}
