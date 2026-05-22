import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_VIEWER_INPUT = "artifacts/resource-ingest/latest/resource-ingest.json";
export const DEFAULT_EVIDENCE_VIEWER_OUT_DIR = "artifacts/evidence-viewer/latest";

export async function runEvidenceViewer(options = {}) {
  const result = await buildEvidenceViewer(options);
  if (options.write !== false) await writeEvidenceViewer(result, result.output_dir);
  return result;
}

export async function buildEvidenceViewer(options = {}) {
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_EVIDENCE_VIEWER_INPUT);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_VIEWER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const resourceEvidence = input.schema_version === "resource-evidence.v1" ? input : input.resource_evidence;
  if (!resourceEvidence) throw new Error("Input must be resource-evidence.v1 or contain resource_evidence");

  const reviewPacket = buildReviewPacket(resourceEvidence, {
    generatedAt,
    inputPath,
    ingestSummary: input.summary ?? null,
    gateResults: input.gate_results ?? [],
    blockedItems: input.blocked_items ?? [],
  });

  return {
    schema_version: "evidence-viewer.v1",
    generated_at: generatedAt,
    input_path: inputPath,
    output_dir: outputDir,
    summary: reviewPacket.summary,
    review_packet: reviewPacket,
    html: renderEvidenceViewerHtml(reviewPacket),
    markdown: renderEvidenceViewerMarkdown(reviewPacket),
  };
}

export async function writeEvidenceViewer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "evidence-viewer.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    input_path: result.input_path,
    summary: result.summary,
    review_packet: result.review_packet,
  });
  await writeFile(path.join(outDir, "evidence-viewer.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceViewerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runEvidenceViewer(args);
  console.log(`Evidence viewer written to ${result.output_dir}`);
  console.log(`Resources: ${result.summary.resource_count}`);
  console.log(`Evidence candidates: ${result.summary.evidence_count}`);
  console.log(`Needs review: ${result.summary.needs_review_count}`);
  console.log(`Blocking gates: ${result.summary.blocking_gate_count}`);
}

export function buildReviewPacket(resourceEvidence, context = {}) {
  const resources = new Map((resourceEvidence.resources ?? []).map((resource) => [resource.id, resource]));
  const versions = new Map((resourceEvidence.resource_versions ?? []).map((version) => [version.id, version]));
  const spans = new Map((resourceEvidence.source_spans ?? []).map((span) => [span.id, span]));
  const normalizedTextsByResource = groupBy(resourceEvidence.normalized_texts ?? [], "resource_id");
  const factsByEvidence = indexFactsByEvidence(resourceEvidence.facts ?? []);
  const citationsByEvidence = indexCitationsByEvidence(resourceEvidence.citations ?? []);

  const evidenceCards = (resourceEvidence.evidence_items ?? []).map((evidence) => {
    const linkedSpans = evidence.source_span_ids.map((id) => spans.get(id)).filter(Boolean);
    const primarySpan = linkedSpans[0] ?? null;
    const resource = primarySpan ? resources.get(primarySpan.resource_id) : null;
    const version = primarySpan ? versions.get(primarySpan.resource_version_id) : null;
    return {
      evidence_id: evidence.id,
      matter_id: evidence.matter_id,
      review_status: evidence.review_status,
      reliability: evidence.reliability,
      evidence_type: evidence.evidence_type,
      summary: evidence.summary,
      source: resource
        ? {
            resource_id: resource.id,
            source_uri: resource.source_uri,
            classification: resource.classification,
            ingestion_status: resource.ingestion_status,
            content_hash: resource.content_hash,
            resource_version_id: version?.id ?? null,
          }
        : null,
      span_text: primarySpan?.text ?? "",
      span_locator: primarySpan?.locator ?? {},
      normalized_texts: resource ? normalizedTextsByResource.get(resource.id) ?? [] : [],
      linked_fact_count: factsByEvidence.get(evidence.id)?.length ?? 0,
      linked_citation_count: citationsByEvidence.get(evidence.id)?.length ?? 0,
      capability_ids: evidence.metadata?.capability_ids ?? [],
    };
  });

  const summary = {
    resource_count: resourceEvidence.resources?.length ?? 0,
    evidence_count: evidenceCards.length,
    needs_review_count: evidenceCards.filter((card) => card.review_status === "needs_review").length,
    fact_count: resourceEvidence.facts?.length ?? 0,
    issue_count: resourceEvidence.issues?.length ?? 0,
    citation_count: resourceEvidence.citations?.length ?? 0,
    blocked_item_count: context.blockedItems?.length ?? 0,
    blocking_gate_count: (context.gateResults ?? []).filter((gate) => gate.blocking).length,
  };

  return {
    generated_at: context.generatedAt,
    input_path: context.inputPath,
    summary,
    ingest_summary: context.ingestSummary,
    gate_results: context.gateResults ?? [],
    blocked_items: context.blockedItems ?? [],
    evidence_cards: evidenceCards,
  };
}

export function renderEvidenceViewerHtml(packet) {
  const cards = packet.evidence_cards.map(renderEvidenceCardHtml).join("\n");
  const gates = packet.gate_results.length
    ? packet.gate_results.map((gate) => `<li><strong>${escapeHtml(gate.gate_id)}</strong>: ${escapeHtml(gate.status)}${gate.blocking ? " <span class=\"danger\">blocking</span>" : ""}<br><span>${escapeHtml(gate.message)}</span></li>`).join("\n")
    : "<li>No ingest gates were provided.</li>";
  const blocked = packet.blocked_items.length
    ? packet.blocked_items.map((item) => `<li>${escapeHtml(item.relative_path ?? item.source_path)} <span class=\"danger\">${escapeHtml(item.quarantine_reason ?? item.status)}</span></li>`).join("\n")
    : "<li>No blocked items.</li>";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Evidence Viewer</title>
  <style>
    :root { color-scheme: light; --ink:#1f2937; --muted:#5b6472; --line:#d7dde5; --panel:#f7f8fa; --accent:#1b6b63; --danger:#b42318; --warn:#9a6700; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:#fff; }
    header { padding:28px 32px 18px; border-bottom:1px solid var(--line); }
    main { padding:22px 32px 40px; max-width:1180px; margin:0 auto; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.2; }
    h2 { margin:28px 0 12px; font-size:18px; }
    .meta { color:var(--muted); font-size:13px; overflow-wrap:anywhere; }
    .stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:18px; }
    .stat { border:1px solid var(--line); border-radius:8px; padding:12px; background:var(--panel); }
    .stat strong { display:block; font-size:24px; }
    .stat span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0; }
    .section { border-top:1px solid var(--line); margin-top:24px; padding-top:4px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:16px; margin:12px 0; background:#fff; }
    .card h3 { margin:0 0 8px; font-size:16px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
    .chip { border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; color:var(--muted); background:#fff; }
    .danger { color:var(--danger); font-weight:700; }
    .warn { color:var(--warn); font-weight:700; }
    blockquote { margin:12px 0 0; border-left:3px solid var(--accent); padding:8px 12px; background:#f4faf8; white-space:pre-wrap; overflow-wrap:anywhere; }
    ul { padding-left:20px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
    @media (max-width: 640px) { header, main { padding-left:18px; padding-right:18px; } h1 { font-size:24px; } }
  </style>
</head>
<body>
  <header>
    <h1>Hermes Evidence Viewer</h1>
    <div class="meta">Generated ${escapeHtml(packet.generated_at ?? "")}</div>
    <div class="meta">Input ${escapeHtml(packet.input_path ?? "")}</div>
    <div class="stats">
      ${stat("Resources", packet.summary.resource_count)}
      ${stat("Evidence", packet.summary.evidence_count)}
      ${stat("Needs Review", packet.summary.needs_review_count)}
      ${stat("Blocking Gates", packet.summary.blocking_gate_count)}
      ${stat("Blocked Items", packet.summary.blocked_item_count)}
    </div>
  </header>
  <main>
    <section class="section">
      <h2>Gate Status</h2>
      <ul>${gates}</ul>
    </section>
    <section class="section">
      <h2>Blocked Items</h2>
      <ul>${blocked}</ul>
    </section>
    <section class="section">
      <h2>Evidence Review Queue</h2>
      ${cards || "<p>No evidence candidates.</p>"}
    </section>
  </main>
</body>
</html>
`;
}

export function renderEvidenceViewerMarkdown(packet) {
  const lines = [];
  lines.push("# Evidence Viewer Summary");
  lines.push("");
  lines.push(`Generated: ${packet.generated_at}`);
  lines.push(`Input: ${packet.input_path}`);
  lines.push("");
  lines.push(`- Resources: ${packet.summary.resource_count}`);
  lines.push(`- Evidence candidates: ${packet.summary.evidence_count}`);
  lines.push(`- Needs review: ${packet.summary.needs_review_count}`);
  lines.push(`- Blocking gates: ${packet.summary.blocking_gate_count}`);
  lines.push(`- Blocked items: ${packet.summary.blocked_item_count}`);
  lines.push("");
  lines.push("## Gates");
  lines.push("");
  for (const gate of packet.gate_results) {
    lines.push(`- ${gate.gate_id}: ${gate.status}${gate.blocking ? " (blocking)" : ""} - ${gate.message}`);
  }
  if (packet.gate_results.length === 0) lines.push("- No ingest gates were provided.");
  lines.push("");
  lines.push("## Evidence Review Queue");
  lines.push("");
  for (const card of packet.evidence_cards) {
    lines.push(`### ${card.evidence_id}`);
    lines.push("");
    lines.push(`- Review: ${card.review_status}`);
    lines.push(`- Reliability: ${card.reliability}`);
    lines.push(`- Classification: ${card.source?.classification ?? "unknown"}`);
    lines.push(`- Source: ${card.source?.source_uri ?? "unknown"}`);
    lines.push(`- Summary: ${card.summary}`);
    lines.push("");
    if (card.span_text) {
      lines.push("> " + card.span_text.replace(/\n/g, "\n> "));
      lines.push("");
    }
  }
  if (packet.evidence_cards.length === 0) lines.push("- No evidence candidates.");
  return `${lines.join("\n")}\n`;
}

function renderEvidenceCardHtml(card) {
  const capabilityChips = card.capability_ids.map((id) => `<span class="chip">${escapeHtml(id)}</span>`).join("");
  const reviewClass = card.review_status === "needs_review" ? "warn" : "";
  return `<article class="card">
  <h3>${escapeHtml(card.evidence_id)}</h3>
  <div class="chips">
    <span class="chip ${reviewClass}">${escapeHtml(card.review_status)}</span>
    <span class="chip">${escapeHtml(card.reliability)}</span>
    <span class="chip">${escapeHtml(card.source?.classification ?? "unknown")}</span>
    <span class="chip">${escapeHtml(card.evidence_type)}</span>
    ${capabilityChips}
  </div>
  <p>${escapeHtml(card.summary)}</p>
  <div class="meta">Source: ${escapeHtml(card.source?.source_uri ?? "unknown")}</div>
  <div class="meta">Resource: <code>${escapeHtml(card.source?.resource_id ?? "unknown")}</code></div>
  <blockquote>${escapeHtml(card.span_text || "No preview text available.")}</blockquote>
</article>`;
}

function stat(label, value) {
  return `<div class="stat"><strong>${Number(value ?? 0)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function indexFactsByEvidence(facts) {
  const index = new Map();
  for (const fact of facts) {
    for (const evidenceId of fact.evidence_item_ids ?? []) {
      if (!index.has(evidenceId)) index.set(evidenceId, []);
      index.get(evidenceId).push(fact);
    }
  }
  return index;
}

function indexCitationsByEvidence(citations) {
  const index = new Map();
  for (const citation of citations) {
    for (const evidenceId of citation.evidence_item_ids ?? []) {
      if (!index.has(evidenceId)) index.set(evidenceId, []);
      index.get(evidenceId).push(citation);
    }
  }
  return index;
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_EVIDENCE_VIEWER_INPUT,
    outDir: DEFAULT_EVIDENCE_VIEWER_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--input") parsed.inputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-viewer.mjs [options]

Options:
  --input <path>        resource-ingest.json or resource-evidence.json.
  --out-dir <folder>   Output directory.
  --run-at <iso>       Deterministic generated_at timestamp.
  -h, --help           Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
