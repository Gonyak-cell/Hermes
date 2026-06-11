import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryPrdIntake } from "./factory-prd-intake.mjs";

export const DEFAULT_FACTORY_WORK_PACKET_DECOMPOSITION_OUT_DIR = "artifacts/factory-work-packet-decomposition/latest";
export const DEFAULT_FACTORY_WORK_PACKET_DECOMPOSITION_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:work-packet-decomposition";
const SCHEMA_VERSION = "factory-work-packet-decomposition.v1";
const CAPABILITY_ID = "factory.work_packet_decomposition";
const PROGRAM_RANGE = "FCORE-FE.2";
const SOURCE_PROGRAM_RANGE = "FCORE-FE.1";
const READY_STATUS = "ready_factory_work_packet_decomposition";
const BLOCKED_STATUS = "blocked_factory_work_packet_decomposition";
const HASH_RE = /^[a-f0-9]{64}$/;
const RAW_TEXT_SCAN_MIN_LENGTH = 8;
const NORMALIZED_TEXT_SCAN_MIN_TOKENS = 3;

const WORK_ITEM_BLUEPRINTS = [
  {
    kind: "contract_slice",
    title_prefix: "Extract contracts for",
    acceptance: "stable IDs, schema touchpoints, and source-span references are explicit",
  },
  {
    kind: "implementation_slice",
    title_prefix: "Plan implementation surface for",
    acceptance: "module, API, dashboard, and storage candidates are bounded to the source span",
  },
  {
    kind: "verification_slice",
    title_prefix: "Define validation fixtures for",
    acceptance: "positive and negative fixtures are named before code execution",
  },
  {
    kind: "review_gate_slice",
    title_prefix: "Prepare review gate for",
    acceptance: "independent review, human adjudication, and blocked authority are visible",
  },
];

const AUTHORITY_FALSE_FLAGS = [
  "project_creation_allowed_now",
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "command_execution_enabled",
  "command_execution_allowed_now",
  "work_packet_execution_allowed_now",
  "work_item_execution_allowed_now",
  "source_file_write_allowed_now",
  "ledger_append_allowed_now",
  "persistent_ledger_append_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "gate_opening_allowed_now",
  "g1a_project_creation_gate_open_now",
  "g1b_repo_write_gate_open_now",
  "g2_command_execution_gate_open_now",
  "g3_deployment_gate_open_now",
];

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryWorkPacketDecomposition(options = {}) {
  const result = await buildFactoryWorkPacketDecomposition(options);
  if (!options.check && options.write !== false) await writeFactoryWorkPacketDecomposition(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Work Packet Decomposition failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_work_packet_decomposition_status !== READY_STATUS) {
    const error = new Error("Factory Work Packet Decomposition is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryWorkPacketDecomposition(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_WORK_PACKET_DECOMPOSITION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const prdIntake = Object.prototype.hasOwnProperty.call(options, "prdIntake")
    ? options.prdIntake
    : await buildFactoryPrdIntake({
      ...options,
      outDir: path.join(outputDir, "source-prd-intake"),
      runAt: generatedAt,
      write: false,
      commitRef,
    });
  const sourceState = summarizeSourcePrdIntake(prdIntake);
  const workPacketRows = buildWorkPacketCandidateRows({ prdIntake, sourceState, generatedAt });
  const workItemRows = buildWorkItemCandidateRows({ workPacketRows, generatedAt });
  const dependencyRows = buildDependencyRows(workPacketRows, generatedAt);
  const bundle = buildBundle({ sourceState, workPacketRows, workItemRows, dependencyRows, generatedAt });
  const rawTextLeakScan = await buildRawTextLeakScan({ prdIntake, workPacketRows, workItemRows, dependencyRows, bundle, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({
    sourceState,
    workPacketRows,
    dependencyRows,
    generatedAt,
  });
  const boundary = buildBoundary({
    sourceState,
    workPacketRows,
    workItemRows,
    dependencyRows,
    negativeFixtureRows,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    sourceState,
    workPacketRows,
    workItemRows,
    dependencyRows,
    bundle,
    rawTextLeakScan,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceState,
    workPacketRows,
    workItemRows,
    dependencyRows,
    negativeFixtureRows,
    bundle,
    boundary,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      package_path: packageJson.path,
      structured_summary_path: structuredSummary.path,
      source_prd_intake_status: sourceState.status,
      source_prd_sha256: sourceState.prd_source_sha256,
    },
    source_summaries: {
      fe1_status: structuredSummary.data?.fe1_status ?? null,
      fe1_command_status: structuredSummary.data?.fe1_command_status ?? null,
      source_prd_intake_summary: prdIntake?.summary ?? null,
    },
    factory_work_packet_decomposition_source: sourceState.public_source,
    factory_work_packet_candidate_rows: workPacketRows,
    factory_work_item_candidate_rows: workItemRows,
    factory_work_packet_dependency_rows: dependencyRows,
    factory_work_packet_candidate_bundle: bundle,
    factory_work_packet_raw_text_leak_scan: rawTextLeakScan,
    factory_work_packet_negative_fixture_rows: negativeFixtureRows,
    factory_work_packet_decomposition_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryWorkPacketDecomposition(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-work-packet-decomposition.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-packet-candidate-rows.json"), collectionEnvelope("factory-work-packet-candidate-rows.v1", "factory_work_packet_candidate_rows", result.factory_work_packet_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-item-candidate-rows.json"), collectionEnvelope("factory-work-item-candidate-rows.v1", "factory_work_item_candidate_rows", result.factory_work_item_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "dependency-rows.json"), collectionEnvelope("factory-work-packet-dependency-rows.v1", "factory_work_packet_dependency_rows", result.factory_work_packet_dependency_rows, result.generated_at));
  await writeJson(path.join(outDir, "candidate-bundle.json"), result.factory_work_packet_candidate_bundle);
  await writeJson(path.join(outDir, "raw-text-leak-scan.json"), result.factory_work_packet_raw_text_leak_scan);
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-work-packet-negative-fixture-rows.v1", "factory_work_packet_negative_fixture_rows", result.factory_work_packet_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_work_packet_decomposition_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-work-packet-decomposition-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryWorkPacketDecompositionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryWorkPacketDecomposition(args);
    console.log(`Factory Work Packet Decomposition ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_work_packet_decomposition_status}`);
    console.log(`Work packet candidates: ${result.summary.work_packet_candidate_count}`);
    console.log(`Work item candidates: ${result.summary.work_item_candidate_count}`);
    console.log(`Dependency rows: ${result.summary.dependency_row_count}`);
    console.log(`Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Work packet execution allowed: ${result.summary.work_packet_execution_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function summarizeSourcePrdIntake(prdIntake) {
  const summary = prdIntake?.summary ?? {};
  const source = prdIntake?.factory_prd_source ?? {};
  const seeds = prdIntake?.factory_prd_tuw_seed_rows ?? [];
  const requirements = prdIntake?.factory_prd_requirement_rows ?? [];
  const sourceReady = prdIntake?.validation?.valid === true
    && summary.factory_prd_intake_status === "ready_factory_prd_intake"
    && summary.fe2_work_packet_generation_allowed_next === true
    && summary.fe2_work_packet_execution_allowed_now === false;
  const seedRowsReady = seeds.length >= 15
    && seeds.every((row) => row.decomposition_status === "ready_for_fe2_work_packet_breakdown"
      && row.decomposition_scope === "bounded_to_single_prd_source_span"
      && HASH_RE.test(row.source_span_sha256 ?? "")
      && Boolean(row.source_span_id));
  return {
    status: sourceReady && seedRowsReady ? "ready_prd_intake_for_fe2" : "blocked_prd_intake_for_fe2",
    validation_valid: prdIntake?.validation?.valid === true,
    prd_intake_status: summary.factory_prd_intake_status ?? "missing",
    prd_source_sha256: summary.prd_source_sha256 ?? source.source_sha256 ?? null,
    source_span_count: summary.source_span_count ?? 0,
    requirement_row_count: requirements.length,
    tuw_seed_row_count: seeds.length,
    tuw_seed_ready_count: seeds.filter((row) => row.decomposition_status === "ready_for_fe2_work_packet_breakdown").length,
    raw_prd_text_persisted_in_artifact: summary.raw_prd_text_persisted_in_artifact === true || source.raw_prd_text_persisted_in_artifact === true,
    source_ready: sourceReady,
    seed_rows_ready: seedRowsReady,
    seeds,
    requirements,
    public_source: {
      schema_version: "factory-work-packet-decomposition-source.v1",
      source_program_range: SOURCE_PROGRAM_RANGE,
      prd_intake_status: summary.factory_prd_intake_status ?? "missing",
      prd_source_sha256: summary.prd_source_sha256 ?? source.source_sha256 ?? null,
      source_span_count: summary.source_span_count ?? 0,
      requirement_row_count: requirements.length,
      tuw_seed_row_count: seeds.length,
      tuw_seed_ready_count: seeds.filter((row) => row.decomposition_status === "ready_for_fe2_work_packet_breakdown").length,
      seed_rows_ready: seedRowsReady,
      raw_prd_text_persisted_in_artifact: summary.raw_prd_text_persisted_in_artifact === true || source.raw_prd_text_persisted_in_artifact === true,
      source_status: sourceReady && seedRowsReady ? "ready_prd_intake_for_fe2" : "blocked_prd_intake_for_fe2",
    },
  };
}

function buildWorkPacketCandidateRows({ prdIntake, sourceState, generatedAt }) {
  const requirementById = new Map((prdIntake?.factory_prd_requirement_rows ?? []).map((row) => [row.requirement_row_id, row]));
  const rows = sourceState.seeds.map((seed, index) => {
    const requirement = requirementById.get(seed.source_requirement_row_id) ?? {};
    const title = stripDecomposePrefix(seed.work_packet_candidate_title ?? requirement.title ?? `Work packet ${index + 1}`);
    const packetId = `factory-work-packet.${String(index + 1).padStart(3, "0")}.${normalizeKey(title)}`;
    const sourceBound = sourceState.status === "ready_prd_intake_for_fe2"
      && seed.decomposition_status === "ready_for_fe2_work_packet_breakdown"
      && seed.decomposition_scope === "bounded_to_single_prd_source_span"
      && HASH_RE.test(seed.source_span_sha256 ?? "")
      && HASH_RE.test(seed.source_sha256 ?? "")
      && Boolean(seed.source_span_id)
      && Boolean(seed.source_requirement_row_id);
    return {
      schema_version: "factory-work-packet-candidate-row.v1",
      work_packet_candidate_id: packetId,
      product_id: seed.product_id,
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_tuw_seed_id: seed.tuw_seed_id,
      source_requirement_row_id: seed.source_requirement_row_id,
      source_span_id: seed.source_span_id,
      source_sha256: seed.source_sha256,
      source_span_sha256: seed.source_span_sha256,
      requirement_kind: seed.requirement_kind,
      heading_number: requirement.heading_number ?? null,
      heading_title: requirement.heading_title ?? title,
      title,
      packet_type: "factory_requirement_decomposition",
      packet_status: sourceBound ? "ready_for_human_planning_review" : "blocked_source_binding",
      priority: priorityForIndex(index),
      phase_order: index + 1,
      phase_wave: Math.floor(index / 5) + 1,
      scope_lock: "single_prd_source_span",
      source_binding_status: sourceBound ? "ready_single_source_span_bound" : "blocked_source_span_binding",
      dependency_status: "pending_dependency_binding",
      depends_on_work_packet_candidate_ids: [],
      acceptance_criteria: buildAcceptanceCriteria(seed, requirement),
      validation_plan: buildValidationPlan(seed, requirement),
      review_requirements: buildReviewRequirements(),
      planned_output_contracts: buildPlannedOutputContracts(seed, requirement),
      work_item_candidate_count: WORK_ITEM_BLUEPRINTS.length,
      allowed_affordances: ["view_source_span", "view_work_packet_candidate", "view_validation_plan", "queue_for_fe3_loop_instantiation"],
      forbidden_affordances: buildForbiddenAffordances(),
      raw_prd_text_visible: false,
      raw_prd_text_persisted_in_artifact: false,
      protected_action: false,
      requires_human_review: true,
      command_execution_enabled: false,
      command_execution_allowed_now: false,
      work_packet_execution_allowed_now: false,
      source_file_write_allowed_now: false,
      ledger_append_allowed_now: false,
      repo_write_allowed_now: false,
      connector_write_allowed_now: false,
      deployment_allowed_now: false,
      protected_action_allowed_now: false,
      generated_at: generatedAt,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
  return rows.map((row, index) => ({
    ...row,
    dependency_status: index === 0 ? "root_packet" : "depends_on_previous_source_span_packet",
    depends_on_work_packet_candidate_ids: index === 0 ? [] : [rows[index - 1].work_packet_candidate_id],
  }));
}

function buildWorkItemCandidateRows({ workPacketRows, generatedAt }) {
  return workPacketRows.flatMap((packet) => WORK_ITEM_BLUEPRINTS.map((blueprint, index) => ({
    schema_version: "factory-work-item-candidate-row.v1",
    work_item_candidate_id: `${packet.work_packet_candidate_id}.item.${String(index + 1).padStart(2, "0")}.${blueprint.kind}`,
    work_packet_candidate_id: packet.work_packet_candidate_id,
    product_id: packet.product_id,
    source_tuw_seed_id: packet.source_tuw_seed_id,
    source_requirement_row_id: packet.source_requirement_row_id,
    source_span_id: packet.source_span_id,
    source_sha256: packet.source_sha256,
    source_span_sha256: packet.source_span_sha256,
    work_item_kind: blueprint.kind,
    title: `${blueprint.title_prefix} ${packet.title}`,
    item_status: packet.packet_status === "ready_for_human_planning_review" ? "ready_for_fe3_planning_queue" : "blocked_by_parent_packet",
    scope_lock: "inherits_single_prd_source_span",
    acceptance_criterion: blueprint.acceptance,
    required_evidence_refs: [
      packet.source_tuw_seed_id,
      packet.source_requirement_row_id,
      packet.source_span_id,
    ],
    command_execution_enabled: false,
    command_execution_allowed_now: false,
    work_item_execution_allowed_now: false,
    source_file_write_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    raw_prd_text_visible: false,
    generated_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  })));
}

function buildDependencyRows(workPacketRows, generatedAt) {
  return workPacketRows.flatMap((packet) => packet.depends_on_work_packet_candidate_ids.map((dependencyId) => ({
    schema_version: "factory-work-packet-dependency-row.v1",
    dependency_row_id: `factory-work-packet-dependency.${normalizeKey(dependencyId)}.${normalizeKey(packet.work_packet_candidate_id)}`,
    program_range: PROGRAM_RANGE,
    work_packet_candidate_id: packet.work_packet_candidate_id,
    depends_on_work_packet_candidate_id: dependencyId,
    dependency_kind: "source_order_previous_packet",
    dependency_status: "ready_dependency_bound",
    generated_at: generatedAt,
  })));
}

function buildBundle({ sourceState, workPacketRows, workItemRows, dependencyRows, generatedAt }) {
  const bundleInput = {
    source_prd_sha256: sourceState.prd_source_sha256,
    work_packet_candidate_ids: workPacketRows.map((row) => row.work_packet_candidate_id),
    work_item_candidate_ids: workItemRows.map((row) => row.work_item_candidate_id),
    dependency_row_ids: dependencyRows.map((row) => row.dependency_row_id),
  };
  return {
    schema_version: "factory-work-packet-candidate-bundle.v1",
    bundle_id: `factory-work-packet-candidate-bundle.${dateStamp(generatedAt)}`,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_prd_sha256: sourceState.prd_source_sha256,
    work_packet_candidate_count: workPacketRows.length,
    work_item_candidate_count: workItemRows.length,
    dependency_row_count: dependencyRows.length,
    bundle_sha256: hashValue(bundleInput),
    bundle_status: workPacketRows.length > 0 && workItemRows.length === workPacketRows.length * WORK_ITEM_BLUEPRINTS.length
      ? "ready_candidate_bundle"
      : "blocked_candidate_bundle",
    raw_prd_text_persisted_in_artifact: false,
    work_packet_execution_allowed_now: false,
    command_execution_allowed_now: false,
    generated_at: generatedAt,
  };
}

async function buildRawTextLeakScan({ prdIntake, workPacketRows, workItemRows, dependencyRows, bundle, generatedAt }) {
  const prdPath = prdIntake?.inputs?.prd_path ?? prdIntake?.source_refs?.prd_path ?? null;
  const requirementRows = prdIntake?.factory_prd_requirement_rows ?? [];
  const source = prdPath ? await readTextSource(prdPath) : { available: false, text: "", path: prdPath, error: "missing_prd_path" };
  const snippets = source.available ? buildBodySnippets(source.text, requirementRows) : [];
  const scannedPayload = {
    work_packet_rows: workPacketRows,
    work_item_rows: workItemRows,
    dependency_rows: dependencyRows,
    bundle,
  };
  const payloadStrings = collectStringFields(scannedPayload);
  const serializedPayload = JSON.stringify(scannedPayload);
  const leaks = detectRawTextLeaks({ snippets, payloadStrings, serializedPayload });
  const scanCovered = source.available && snippets.length > 0;
  const normalizedProbeCount = snippets.filter((snippet) => snippet.normalized_probe_eligible).length;
  const exactRawProbeCount = snippets.length;
  return {
    schema_version: "factory-work-packet-raw-text-leak-scan.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_path: source.path,
    source_available: source.available,
    source_error: source.error ?? null,
    scanned_payloads: [
      "factory_work_packet_candidate_rows",
      "factory_work_item_candidate_rows",
      "factory_work_packet_dependency_rows",
      "factory_work_packet_candidate_bundle",
    ],
    scanned_snippet_count: snippets.length,
    scanned_string_field_count: payloadStrings.length,
    exact_raw_probe_count: exactRawProbeCount,
    normalized_probe_count: normalizedProbeCount,
    low_entropy_probe_count: snippets.length - normalizedProbeCount,
    minimum_snippet_length: RAW_TEXT_SCAN_MIN_LENGTH,
    minimum_normalized_probe_tokens: NORMALIZED_TEXT_SCAN_MIN_TOKENS,
    scan_modes: [
      "raw_substring",
      "json_escaped_raw_substring",
      "normalized_high_entropy_field_substring",
    ],
    normalization_mode: "lowercase_whitespace_punctuation_trimmed_high_entropy_field_scan",
    leak_count: leaks.length,
    leak_refs: leaks,
    raw_snippets_persisted: false,
    raw_text_leak_found: leaks.length > 0,
    scan_status: scanCovered && leaks.length === 0
      ? "ready_no_raw_prd_text_leak_detected"
      : "blocked_raw_prd_text_leak_scan",
    generated_at: generatedAt,
  };
}

function buildBodySnippets(sourceText, requirementRows) {
  const lines = sourceText.split(/\r?\n/);
  const snippets = [];
  for (const row of requirementRows) {
    const start = Math.max(0, Number(row.start_line ?? 1) - 1);
    const end = Math.min(lines.length, Number(row.end_line ?? row.start_line ?? 1));
    for (let index = start; index < end; index += 1) {
      const rawText = String(lines[index] ?? "").trim();
      const normalized = normalizeSourceLine(rawText);
      if (normalized.length < RAW_TEXT_SCAN_MIN_LENGTH) continue;
      const sourceLabelLine = rawText.startsWith("#") || normalized === normalizeSourceLine(row.title) || normalized === normalizeSourceLine(row.heading_title);
      snippets.push({
        source_span_id: row.source_span_id,
        source_line: index + 1,
        raw_text: rawText,
        json_escaped_raw_text: JSON.stringify(rawText).slice(1, -1),
        normalized_text: normalized,
        normalized_probe_eligible: !sourceLabelLine && normalized.split(/\s+/).filter(Boolean).length >= NORMALIZED_TEXT_SCAN_MIN_TOKENS,
        source_label_line: sourceLabelLine,
      });
    }
  }
  return snippets;
}

function normalizeSourceLine(line) {
  return String(line)
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/^\s*\|?\s*-{3,}\s*\|?\s*$/, "")
    .replace(/[|`*#>[\](){}:;,.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectRawTextLeaks({ snippets, payloadStrings, serializedPayload }) {
  const leakByKey = new Map();
  for (const snippet of snippets) {
    if (snippet.raw_text && serializedPayload.includes(snippet.raw_text)) {
      addLeak(leakByKey, snippet, "serialized_payload.raw_substring", hashString(serializedPayload), "raw_substring");
    }
    if (snippet.json_escaped_raw_text && serializedPayload.includes(snippet.json_escaped_raw_text)) {
      addLeak(leakByKey, snippet, "serialized_payload.json_escaped_raw_substring", hashString(serializedPayload), "json_escaped_raw_substring");
    }
    if (!snippet.normalized_probe_eligible) continue;
    for (const field of payloadStrings) {
      if (field.normalized_value.includes(snippet.normalized_text)) {
        addLeak(leakByKey, snippet, field.path, hashString(field.normalized_value), "normalized_high_entropy_field_substring");
      }
    }
  }
  return [...leakByKey.values()];
}

function addLeak(leakByKey, snippet, fieldPath, fieldValueSha256, detectionMode) {
  const key = `${snippet.source_span_id}:${snippet.source_line}:${fieldPath}:${detectionMode}`;
  if (leakByKey.has(key)) return;
  leakByKey.set(key, {
    source_span_id: snippet.source_span_id,
    source_line: snippet.source_line,
    snippet_sha256: hashString(snippet.normalized_text),
    field_path: fieldPath,
    field_value_sha256: fieldValueSha256,
    detection_mode: detectionMode,
  });
}

function collectStringFields(value, pathParts = []) {
  if (typeof value === "string") {
    const normalizedValue = normalizeSourceLine(value);
    return normalizedValue
      ? [{ path: pathParts.join("."), normalized_value: normalizedValue }]
      : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => collectStringFields(item, [...pathParts, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStringFields(item, [...pathParts, key]));
  }
  return [];
}

function buildNegativeFixtureRows({ sourceState, workPacketRows, dependencyRows, generatedAt }) {
  const notReadySeeds = sourceState.seeds.map((seed, index) => index === 0
    ? {
      ...seed,
      source_span_sha256: null,
      decomposition_status: "blocked_before_fe2_work_packet_breakdown",
      blocked_reason_ids: [...(seed.blocked_reason_ids ?? []), "simulated_missing_source_span_hash"],
    }
    : seed);
  const notReadySourceState = {
    ...sourceState,
    status: "blocked_prd_intake_for_fe2",
    source_ready: false,
    seed_rows_ready: false,
    tuw_seed_row_count: notReadySeeds.length,
    tuw_seed_ready_count: notReadySeeds.filter((seed) => seed.decomposition_status === "ready_for_fe2_work_packet_breakdown"
      && HASH_RE.test(seed.source_span_sha256 ?? "")).length,
    seeds: notReadySeeds,
  };
  const notReadyPacketRows = buildWorkPacketCandidateRows({
    prdIntake: { factory_prd_requirement_rows: sourceState.requirements, factory_prd_tuw_seed_rows: notReadySeeds },
    sourceState: notReadySourceState,
    generatedAt,
  });
  const unboundPacketRows = workPacketRows.map((row, index) => index === 0
    ? { ...row, source_span_sha256: null, source_binding_status: "blocked_source_span_binding" }
    : row);
  const duplicatePacketRows = workPacketRows.map((row, index) => index === 1
    ? { ...row, work_packet_candidate_id: workPacketRows[0]?.work_packet_candidate_id }
    : row);
  const openedExecutionRows = workPacketRows.map((row, index) => index === 0
    ? { ...row, command_execution_enabled: true, work_packet_execution_allowed_now: true, authority_flags: { ...row.authority_flags, command_execution_enabled: true, work_packet_execution_allowed_now: true } }
    : row);
  const leakedRawRows = workPacketRows.map((row, index) => index === 0
    ? { ...row, raw_prd_text_visible: true, raw_prd_text_persisted_in_artifact: true }
    : row);
  const brokenDependencyRows = dependencyRows.map((row, index) => index === 0
    ? { ...row, depends_on_work_packet_candidate_id: "factory-work-packet.missing" }
    : row);
  const fixtures = [
    {
      fixture_key: "fe1_prd_intake_not_ready",
      simulated_condition: "source FE.1 PRD intake is not ready for FE.2",
      observed_blocked_checks: ["source.prd_intake_ready", "work_packets.source_bound"],
      blocked: notReadySourceState.status !== "ready_prd_intake_for_fe2"
        && !workPacketRowsReady(notReadyPacketRows)
        && notReadyPacketRows.some((row) => row.packet_status === "blocked_source_binding"),
    },
    {
      fixture_key: "unbound_tuw_seed",
      simulated_condition: "a TUW seed loses source span hash binding",
      observed_blocked_checks: ["work_packets.source_bound"],
      blocked: !workPacketRowsReady(unboundPacketRows),
    },
    {
      fixture_key: "duplicate_work_packet_id",
      simulated_condition: "two work packet candidates share an id",
      observed_blocked_checks: ["work_packets.one_packet_per_seed", "work_packets.unique_ids"],
      blocked: !idsUnique(duplicatePacketRows.map((row) => row.work_packet_candidate_id)),
    },
    {
      fixture_key: "execution_flag_opened",
      simulated_condition: "a work packet candidate opens command/work-packet execution",
      observed_blocked_checks: ["work_packets.no_execution", "boundary.authority_closed"],
      blocked: !workPacketRowsAuthorityClosed(openedExecutionRows),
    },
    {
      fixture_key: "raw_prd_text_leak",
      simulated_condition: "a work packet row exposes raw PRD text",
      observed_blocked_checks: ["work_packets.no_raw_prd_text"],
      blocked: !workPacketRowsRawTextClosed(leakedRawRows),
    },
    {
      fixture_key: "dependency_missing_target",
      simulated_condition: "dependency row points to a missing work packet id",
      observed_blocked_checks: ["dependencies.targets_exist"],
      blocked: !dependencyRowsValid(workPacketRows, brokenDependencyRows),
    },
  ];
  return fixtures.map((fixture) => ({
    schema_version: "factory-work-packet-negative-fixture-row.v1",
    fixture_id: `factory-work-packet-negative.${fixture.fixture_key}`,
    fixture_key: fixture.fixture_key,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    simulated_condition: fixture.simulated_condition,
    expected_result: "blocked",
    actual_result: fixture.blocked ? "blocked" : "not_blocked",
    fixture_status: fixture.blocked ? "blocked_as_expected" : "fixture_failed_open",
    observed_blocked_checks: fixture.observed_blocked_checks,
    authority_opened_by_fixture: false,
    command_execution_enabled: false,
    work_packet_execution_allowed_now: false,
    source_file_write_allowed_now: false,
    repo_write_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildBoundary({ sourceState, workPacketRows, workItemRows, dependencyRows, negativeFixtureRows, generatedAt }) {
  return {
    schema_version: "factory-work-packet-decomposition-boundary.v1",
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    read_only_decomposition: true,
    source_prd_intake_status: sourceState.status,
    work_packet_candidate_count: workPacketRows.length,
    work_item_candidate_count: workItemRows.length,
    dependency_row_count: dependencyRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    method_allowlist: ["GET", "HEAD", "READ_FILE"],
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    work_packet_generation_allowed_now: true,
    work_packet_execution_allowed_now: false,
    fe3_loop_instantiation_allowed_next: sourceState.status === "ready_prd_intake_for_fe2",
    ...AUTHORITY_CLOSED,
    generated_at: generatedAt,
  };
}

function buildValidationItems({ packageJson, structuredSummary, sourceState, workPacketRows, workItemRows, dependencyRows, bundle, rawTextLeakScan, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script", "wiring", scripts[COMMAND_NAME] === "node scripts/factory-work-packet-decomposition.mjs", `${COMMAND_NAME} package script must be registered`),
    validationItem("structured_summary.fe1_ready", "source_chain", structuredSummary.data?.fe1_status === "ready_factory_prd_intake_lawos_style_claude_reviewed", "FE.1 must be reviewed before FE.2 work-packet decomposition"),
    validationItem("source.prd_intake_ready", "source", sourceState.status === "ready_prd_intake_for_fe2", "Source PRD intake must be ready for FE.2"),
    validationItem("source.no_raw_prd_text", "source", sourceState.raw_prd_text_persisted_in_artifact === false, "Source PRD intake must not persist raw PRD text"),
    validationItem("source.seed_rows_ready", "source", sourceState.seed_rows_ready === true, "All TUW seed rows must be ready and source-span hash bound"),
    validationItem("work_packets.present", "work_packet", workPacketRows.length === sourceState.tuw_seed_row_count && workPacketRows.length >= 15, "One work packet candidate must exist per TUW seed"),
    validationItem("work_packets.unique_ids", "work_packet", idsUnique(workPacketRows.map((row) => row.work_packet_candidate_id)), "Work packet candidate IDs must be unique"),
    validationItem("work_packets.one_packet_per_seed", "work_packet", idsUnique(workPacketRows.map((row) => row.source_tuw_seed_id)) && workPacketRows.every((row) => row.source_tuw_seed_id), "Each TUW seed must map to one work packet candidate"),
    validationItem("work_packets.source_bound", "work_packet", workPacketRowsReady(workPacketRows), "Work packet candidates must be source-span bound and ready"),
    validationItem("work_packets.no_raw_prd_text", "authority", workPacketRowsRawTextClosed(workPacketRows), "Work packet candidates must not expose raw PRD text"),
    validationItem("work_packets.no_execution", "authority", workPacketRowsAuthorityClosed(workPacketRows), "Work packet candidates must not open execution or write authority"),
    validationItem("work_packets.raw_text_scan", "authority", rawTextLeakScan.source_available === true && rawTextLeakScan.scanned_snippet_count > 0 && rawTextLeakScan.exact_raw_probe_count > 0 && rawTextLeakScan.normalized_probe_count > 0 && rawTextLeakScan.scanned_string_field_count > 0 && rawTextLeakScan.scan_status === "ready_no_raw_prd_text_leak_detected" && rawTextLeakScan.raw_text_leak_found === false && rawTextLeakScan.raw_snippets_persisted === false, "Work packet decomposition output must pass non-vacuous raw PRD text leak scan"),
    validationItem("work_items.present", "work_item", workItemRows.length === workPacketRows.length * WORK_ITEM_BLUEPRINTS.length && workItemRows.length >= 60, "Each work packet must have four work item candidates"),
    validationItem("work_items.source_bound", "work_item", workItemRowsReady(workItemRows), "Work item candidates must inherit source binding and stay ready"),
    validationItem("work_items.no_execution", "authority", workItemRowsAuthorityClosed(workItemRows), "Work item candidates must not open execution or write authority"),
    validationItem("dependencies.targets_exist", "dependency", dependencyRowsValid(workPacketRows, dependencyRows), "Dependency rows must point to existing prior work packet candidates"),
    validationItem("bundle.hash_bound", "bundle", bundle.bundle_status === "ready_candidate_bundle" && HASH_RE.test(bundle.bundle_sha256), "Candidate bundle must have a stable hash"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 6 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "All negative fixtures must remain blocked"),
    validationItem("boundary.no_raw_prd_text", "authority", boundary.raw_prd_text_persisted_in_artifact === false, "Boundary must not persist raw PRD text"),
    validationItem("boundary.command_execution_closed", "authority", boundary.command_execution_enabled === false && boundary.command_execution_allowed_now === false && boundary.g2_command_execution_gate_open_now === false, "FE.2 must not open command execution"),
    validationItem("boundary.write_apply_closed", "authority", boundary.source_file_write_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.apply_allowed_now === false, "FE.2 must not open write or apply authority"),
    validationItem("boundary.gate_opening_closed", "authority", boundary.gate_opening_allowed_now === false && boundary.g1a_project_creation_gate_open_now === false && boundary.g1b_repo_write_gate_open_now === false, "FE.2 must not open G-series gates"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "All factory authority flags must remain false"),
  ];
}

function buildSummary({ sourceState, workPacketRows, workItemRows, dependencyRows, negativeFixtureRows, bundle, boundary, validation }) {
  const ready = validation.valid
    && sourceState.status === "ready_prd_intake_for_fe2"
    && workPacketRowsReady(workPacketRows)
    && workItemRowsReady(workItemRows)
    && dependencyRowsValid(workPacketRows, dependencyRows)
    && allAuthorityClosed(boundary);
  return {
    factory_work_packet_decomposition_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_prd_intake_status: sourceState.status,
    source_prd_sha256: sourceState.prd_source_sha256,
    source_tuw_seed_row_count: sourceState.tuw_seed_row_count,
    work_packet_candidate_count: workPacketRows.length,
    work_packet_candidate_ready_count: workPacketRows.filter((row) => row.packet_status === "ready_for_human_planning_review").length,
    work_item_candidate_count: workItemRows.length,
    work_item_candidate_ready_count: workItemRows.filter((row) => row.item_status === "ready_for_fe3_planning_queue").length,
    dependency_row_count: dependencyRows.length,
    candidate_bundle_sha256: bundle.bundle_sha256,
    raw_text_leak_scan_status: validation.errors.some((item) => item.item_id === "work_packets.raw_text_scan")
      ? "blocked_raw_prd_text_leak_scan"
      : "ready_no_raw_prd_text_leak_detected",
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    fe3_loop_instantiation_allowed_next: boundary.fe3_loop_instantiation_allowed_next,
    validation_errors: validation.errors.length,
    ...AUTHORITY_CLOSED,
  };
}

function buildAcceptanceCriteria(seed, requirement) {
  return [
    "source span hash remains unchanged",
    "work packet stays bounded to a single PRD source span",
    "generated work items inherit the same source span binding",
    "no command execution, repository write, connector write, deployment, protected action, production pass, or enterprise pass is inferred",
    ...(seed.acceptance_basis ?? []),
    requirement.requirement_signal_count ? `requirement signal count remains ${requirement.requirement_signal_count}` : "requirement signal count remains available",
  ];
}

function buildValidationPlan(seed, requirement) {
  return {
    schema_version: "factory-work-packet-validation-plan.v1",
    source_span_id: seed.source_span_id,
    source_span_sha256: seed.source_span_sha256,
    positive_fixture: `source-bound ${requirement.title ?? seed.requirement_kind} work packet candidate`,
    negative_fixtures: [
      "missing source span hash",
      "duplicate work packet id",
      "opened execution authority",
      "raw PRD text exposure",
    ],
    required_commands_before_execution: [
      "npm run factory:work-packet-decomposition -- --check --require-pass",
      "independent read-only review receipt",
      "human owner gate only if later execution is requested",
    ],
  };
}

function buildReviewRequirements() {
  return {
    schema_version: "factory-work-packet-review-requirements.v1",
    independent_review_required_before_execution: true,
    human_owner_adjudication_required_before_execution: true,
    g_series_gate_required_before_execution: "G2",
    final_approval_allowed_for_ai: false,
  };
}

function buildPlannedOutputContracts(seed, requirement) {
  return [
    `contract.${normalizeKey(requirement.requirement_kind ?? seed.requirement_kind)}.schema`,
    `artifact.${normalizeKey(requirement.requirement_kind ?? seed.requirement_kind)}.validation_plan`,
    `review.${normalizeKey(requirement.requirement_kind ?? seed.requirement_kind)}.receipt_packet`,
  ];
}

function priorityForIndex(index) {
  if (index < 5) return "high";
  if (index < 10) return "medium";
  return "low";
}

function workPacketRowsReady(rows) {
  return rows.length > 0 && rows.every((row) => row.packet_status === "ready_for_human_planning_review"
    && row.source_binding_status === "ready_single_source_span_bound"
    && row.scope_lock === "single_prd_source_span"
    && HASH_RE.test(row.source_sha256 ?? "")
    && HASH_RE.test(row.source_span_sha256 ?? "")
    && Boolean(row.source_span_id)
    && Boolean(row.source_tuw_seed_id));
}

function workItemRowsReady(rows) {
  return rows.length > 0 && rows.every((row) => row.item_status === "ready_for_fe3_planning_queue"
    && row.scope_lock === "inherits_single_prd_source_span"
    && HASH_RE.test(row.source_sha256 ?? "")
    && HASH_RE.test(row.source_span_sha256 ?? "")
    && Boolean(row.source_span_id)
    && Boolean(row.work_packet_candidate_id));
}

function workPacketRowsRawTextClosed(rows) {
  return rows.every((row) => row.raw_prd_text_visible === false && row.raw_prd_text_persisted_in_artifact === false);
}

function workPacketRowsAuthorityClosed(rows) {
  return rows.every((row) => row.command_execution_enabled === false
    && row.command_execution_allowed_now === false
    && row.work_packet_execution_allowed_now === false
    && row.source_file_write_allowed_now === false
    && row.repo_write_allowed_now === false
    && row.connector_write_allowed_now === false
    && row.deployment_allowed_now === false
    && row.protected_action_allowed_now === false
    && allAuthorityClosed(row.authority_flags ?? {}));
}

function workItemRowsAuthorityClosed(rows) {
  return rows.every((row) => row.command_execution_enabled === false
    && row.command_execution_allowed_now === false
    && row.work_item_execution_allowed_now === false
    && row.source_file_write_allowed_now === false
    && row.repo_write_allowed_now === false
    && row.connector_write_allowed_now === false
    && row.deployment_allowed_now === false
    && row.protected_action_allowed_now === false
    && row.raw_prd_text_visible === false
    && allAuthorityClosed(row.authority_flags ?? {}));
}

function dependencyRowsValid(workPacketRows, dependencyRows) {
  const packetIds = new Set(workPacketRows.map((row) => row.work_packet_candidate_id));
  const orderById = new Map(workPacketRows.map((row) => [row.work_packet_candidate_id, row.phase_order]));
  return dependencyRows.every((row) => packetIds.has(row.work_packet_candidate_id)
    && packetIds.has(row.depends_on_work_packet_candidate_id)
    && (orderById.get(row.depends_on_work_packet_candidate_id) ?? Infinity) < (orderById.get(row.work_packet_candidate_id) ?? -Infinity));
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-work-packet-decomposition-validation-item.v1",
    item_id: itemId,
    category,
    current_verdict: pass ? "pass" : "block",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function renderMarkdown(result) {
  return [
    "# Factory Work Packet Decomposition",
    "",
    `Status: ${result.summary.factory_work_packet_decomposition_status}`,
    `Program: ${result.summary.program_range}`,
    `Source PRD intake: ${result.summary.source_prd_intake_status}`,
    `Work packet candidates: ${result.summary.work_packet_candidate_count}`,
    `Work item candidates: ${result.summary.work_item_candidate_count}`,
    `Dependency rows: ${result.summary.dependency_row_count}`,
    `Candidate bundle SHA-256: ${result.summary.candidate_bundle_sha256}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Work packet execution allowed: ${result.summary.work_packet_execution_allowed_now}`,
    `Command execution enabled: ${result.summary.command_execution_enabled}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function buildForbiddenAffordances() {
  return [
    "create_project",
    "append_ledger",
    "advance_ps3",
    "open_gate",
    "execute_work_packet",
    "execute_command",
    "write_source_file",
    "apply_candidate",
    "merge_branch",
    "call_connector",
    "deploy",
    "grant_production_pass",
    "grant_enterprise_pass",
  ];
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((key) => value[key] === false);
}

function idsUnique(ids) {
  return ids.filter(Boolean).length === ids.length && new Set(ids).size === ids.length;
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { path: resolved, available: true, data: JSON.parse(await readFile(resolved, "utf8")) };
  } catch (error) {
    return { path: resolved, available: false, data: null, error: error.code ?? error.message };
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? DEFAULT_FACTORY_WORK_PACKET_DECOMPOSITION_INPUTS.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? DEFAULT_FACTORY_WORK_PACKET_DECOMPOSITION_INPUTS.structuredSummaryPath),
  };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashString(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath ?? "");
  try {
    return { path: resolved, available: true, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.code ?? error.message };
  }
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function stripDecomposePrefix(value) {
  return String(value).replace(/^Decompose\s+/i, "").trim();
}

function dateStamp(value) {
  return String(value).slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--require-pass") parsed.requirePass = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package-path") parsed.packagePath = argv[++index];
    else if (arg === "--structured-summary-path") parsed.structuredSummaryPath = argv[++index];
    else if (arg === "--prd-path") parsed.prdPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--commit-ref") parsed.commitRef = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:work-packet-decomposition -- [--check] [--require-pass] [--out-dir DIR]

Builds the FE.2 source-bound work packet candidate decomposition from FE.1 PRD
intake TUW seed rows. This command does not execute work packets, run commands,
write repositories, open G-series gates, or grant production/enterprise trust.

Options:
  --check             Validate without writing artifacts.
  --require-pass      Require ready_factory_work_packet_decomposition status.
  --no-write          Build in memory only.
  --out-dir DIR       Output directory.
  --prd-path FILE     Passed through to the FE.1 PRD intake builder.
  --run-at ISO_DATE   Deterministic timestamp for tests.
  --commit-ref REF    Deterministic commit ref for tests.
`);
}
