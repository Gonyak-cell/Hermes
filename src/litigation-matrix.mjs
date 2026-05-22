import { readMatterFile } from "./matter-harness.mjs";

export async function readLitigationMatter(path) {
  return readMatterFile(path);
}

export function buildLitigationMatrix(matter, options = {}) {
  const today = options.today ?? localDateISO("Asia/Seoul");
  const control = matter.litigation_control ?? {};
  const claims = control.claims ?? [];
  const chronology = control.chronology ?? [];
  const evidence = control.evidence ?? [];
  const claimEvidence = control.claim_evidence ?? [];

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const unverifiedFacts = chronology.filter((item) => item.verified !== true);
  const unsupportedClaims = claims.filter((claim) => {
    const mapping = claimEvidence.find((item) => item.claim_id === claim.id);
    return !mapping || (mapping.supporting_evidence ?? []).length === 0;
  });
  const missingEvidence = claimEvidence.flatMap((mapping) =>
    (mapping.missing_evidence ?? []).map((item) => ({
      claim_id: mapping.claim_id,
      missing: item,
      owner: mapping.owner,
    })),
  );
  const contraryEvidence = claimEvidence.flatMap((mapping) =>
    (mapping.contrary_evidence ?? []).map((id) => ({
      claim_id: mapping.claim_id,
      evidence: evidenceById.get(id) ?? { id, title: "Unknown evidence" },
      owner: mapping.owner,
    })),
  );

  return {
    generated_on: today,
    matter_id: matter.matter_id,
    title: matter.title,
    client: matter.client,
    forum: control.forum ?? "unknown",
    procedural_stage: control.procedural_stage ?? "unknown",
    next_filing: control.next_filing,
    claims,
    chronology: [...chronology].sort((a, b) => a.date.localeCompare(b.date)),
    evidence,
    claim_evidence: claimEvidence,
    unverified_facts: unverifiedFacts,
    unsupported_claims: unsupportedClaims,
    missing_evidence: missingEvidence,
    contrary_evidence: contraryEvidence,
  };
}

export function renderLitigationMatrix(matrix) {
  const lines = [];
  lines.push(`# Litigation Evidence Matrix: ${matrix.matter_id}`);
  lines.push("");
  lines.push(`Generated: ${matrix.generated_on}`);
  lines.push(`Client: ${matrix.client}`);
  lines.push(`Matter: ${matrix.title}`);
  lines.push(`Forum: ${matrix.forum}`);
  lines.push(`Procedural stage: ${matrix.procedural_stage}`);
  lines.push(`Next filing: ${matrix.next_filing ?? "not set"}`);
  lines.push("");
  lines.push("## Litigation Snapshot");
  lines.push(`- Claims/defenses: ${matrix.claims.length}`);
  lines.push(`- Chronology facts: ${matrix.chronology.length}`);
  lines.push(`- Evidence items: ${matrix.evidence.length}`);
  lines.push(`- Unverified facts: ${matrix.unverified_facts.length}`);
  lines.push(`- Unsupported claims/defenses: ${matrix.unsupported_claims.length}`);
  lines.push(`- Missing evidence items: ${matrix.missing_evidence.length}`);
  lines.push(`- Contrary evidence links: ${matrix.contrary_evidence.length}`);
  lines.push("");

  append(lines, "Chronology", matrix.chronology, (item) =>
    `- ${item.date} ${item.verified ? "[verified]" : "[unverified]"} ${item.fact} (source: ${item.source ?? "none"})`,
  );
  append(lines, "Unsupported Claims or Defenses", matrix.unsupported_claims, (item) =>
    `- [${item.status}] ${item.title}`,
  );
  append(lines, "Missing Evidence", matrix.missing_evidence, (item) =>
    `- ${item.claim_id}: ${item.missing} (${item.owner ?? "unassigned"})`,
  );
  append(lines, "Contrary Evidence", matrix.contrary_evidence, (item) =>
    `- ${item.claim_id}: ${item.evidence.id} ${item.evidence.title} (${item.owner ?? "unassigned"})`,
  );

  lines.push("## Review Gate");
  lines.push("- This matrix distinguishes sourced facts from unverified notes.");
  lines.push("- Pleading language, final legal arguments, and court submissions require attorney review and source verification.");
  return `${lines.join("\n")}\n`;
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
