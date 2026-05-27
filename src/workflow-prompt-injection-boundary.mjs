import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_OUT_DIR = "artifacts/workflow-prompt-injection-boundary/latest";
export const DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS = {
  workflowRetrievalCompilerPath: "artifacts/workflow-retrieval-compiler/latest/workflow-retrieval-compiler.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const BOUNDARY_CONTRACT_ID = "workflow-prompt-injection-boundary.v1";
const CONTENT_WRAPPER_SCHEMA_VERSION = "untrusted-content-wrapper.v1";
const INSTRUCTION_SIGNAL_SCHEMA_VERSION = "prompt-injection-instruction-signal.v1";
const BOUNDARY_GUARD_SCHEMA_VERSION = "prompt-boundary-guard.v1";
const CONTENT_HANDLING = "treat_untrusted_content_as_evidence_data";

const INSTRUCTION_SIGNAL_PATTERNS = [
  { signal_type: "ignore_prior_instruction", pattern: /\b(ignore|disregard|forget)\b.{0,50}\b(instruction|policy|rule|system|developer)\b/i },
  { signal_type: "role_override_attempt", pattern: /\b(system|developer|assistant|tool)\s*:/i },
  { signal_type: "tool_or_command_request", pattern: /\b(run|execute|delete|send|email|upload|download|curl|rm\s+-rf|powershell|bash|sudo)\b/i },
  { signal_type: "secret_exfiltration_attempt", pattern: /\b(secret|api[_ -]?key|token|credential|password)\b/i },
  { signal_type: "korean_instruction_request", pattern: /(무시|실행|삭제|전송|보내|비밀|토큰|명령|지시)/u },
];

export async function runWorkflowPromptInjectionBoundary(options = {}) {
  const result = await buildWorkflowPromptInjectionBoundary(options);
  if (options.write !== false) await writeWorkflowPromptInjectionBoundary(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow prompt injection boundary validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowPromptInjectionBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowRetrievalCompiler = await readJson(inputs.workflow_retrieval_compiler_path);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const retrievalRequests = workflowRetrievalCompiler.retrieval_request_records ?? [];
  const retrievalCandidates = workflowRetrievalCompiler.retrieval_candidate_records ?? [];
  const retrievalGuards = workflowRetrievalCompiler.retrieval_guard_records ?? [];
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const buildResult = buildPromptBoundaryRecords({
    retrievalRequests,
    retrievalCandidates,
    retrievalGuards,
    sourceSpans,
    generatedAt,
  });
  const validationItems = validateWorkflowPromptInjectionBoundary({
    workflowRetrievalCompiler,
    sourceSpanStore,
    packageJson,
    roadmapText,
    retrievalRequests,
    retrievalCandidates,
    buildResult,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-prompt-injection-boundary.v1",
    generated_at: generatedAt,
    workflow_prompt_injection_boundary_id: `workflow-prompt-injection-boundary.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_retrieval_compiler: sourceSummary(workflowRetrievalCompiler, "workflow_retrieval_compiler_status"),
      source_span_store: sourceSummary(sourceSpanStore, "source_span_store_status"),
    },
    prompt_injection_boundary_contract: buildPromptInjectionBoundaryContract(generatedAt),
    untrusted_content_wrapper_records: buildResult.untrustedContentWrapperRecords,
    instruction_signal_records: buildResult.instructionSignalRecords,
    prompt_boundary_guard_records: buildResult.promptBoundaryGuardRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowPromptInjectionBoundary({
      workflowRetrievalCompiler,
      sourceSpanStore,
      retrievalRequests,
      retrievalCandidates,
      buildResult,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowPromptInjectionBoundaryMarkdown(result),
  };
}

export async function writeWorkflowPromptInjectionBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-prompt-injection-boundary.json"), serializablePromptInjectionBoundary(result));
  await writeJson(path.join(outDir, "untrusted-content-wrappers.json"), {
    schema_version: "untrusted-content-wrapper-records.v1",
    generated_at: result.generated_at,
    untrusted_content_wrapper_count: result.untrusted_content_wrapper_records.length,
    untrusted_content_wrapper_records: result.untrusted_content_wrapper_records,
  });
  await writeJson(path.join(outDir, "instruction-signal-records.json"), {
    schema_version: "prompt-injection-instruction-signal-records.v1",
    generated_at: result.generated_at,
    instruction_signal_record_count: result.instruction_signal_records.length,
    instruction_signal_records: result.instruction_signal_records,
  });
  await writeJson(path.join(outDir, "prompt-boundary-guard-records.json"), {
    schema_version: "prompt-boundary-guard-records.v1",
    generated_at: result.generated_at,
    prompt_boundary_guard_count: result.prompt_boundary_guard_records.length,
    prompt_boundary_guard_records: result.prompt_boundary_guard_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-prompt-injection-boundary-validation-report.v1",
    generated_at: result.generated_at,
    workflow_prompt_injection_boundary_id: result.workflow_prompt_injection_boundary_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowPromptInjectionBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkflowPromptInjectionBoundary(args);
    console.log(`Workflow prompt injection boundary ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_prompt_injection_boundary_status}`);
    console.log(`Untrusted wrappers: ${result.summary.untrusted_content_wrapper_count}`);
    console.log(`Instruction signals: ${result.summary.instruction_signal_count}`);
    console.log(`Neutralized signals: ${result.summary.neutralized_instruction_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildPromptBoundaryRecords({
  retrievalRequests,
  retrievalCandidates,
  retrievalGuards,
  sourceSpans,
  generatedAt,
}) {
  const sourceSpanById = indexBy(sourceSpans, "source_span_id");
  const candidatesByRequest = groupBy(retrievalCandidates, "retrieval_request_record_id");
  const guardByRequest = indexBy(retrievalGuards, "retrieval_request_record_id");
  const untrustedContentWrapperRecords = retrievalCandidates
    .sort(by("retrieval_candidate_record_id"))
    .map((candidate) => buildUntrustedContentWrapper(candidate, sourceSpanById.get(candidate.source_span_id), generatedAt));
  const wrapperByCandidate = indexBy(untrustedContentWrapperRecords, "retrieval_candidate_record_id");
  const instructionSignalRecords = untrustedContentWrapperRecords.map((wrapper) => buildInstructionSignalRecord(wrapper, generatedAt));
  const signalByWrapper = indexBy(instructionSignalRecords, "untrusted_content_wrapper_id");
  const promptBoundaryGuardRecords = retrievalRequests
    .sort(by("retrieval_request_record_id"))
    .map((request) => buildPromptBoundaryGuardRecord({
      request,
      candidates: candidatesByRequest.get(request.retrieval_request_record_id) ?? [],
      guard: guardByRequest.get(request.retrieval_request_record_id),
      wrapperByCandidate,
      signalByWrapper,
      generatedAt,
    }));
  return {
    untrustedContentWrapperRecords,
    instructionSignalRecords,
    promptBoundaryGuardRecords,
  };
}

function buildUntrustedContentWrapper(candidate, sourceSpan, generatedAt) {
  const preview = sourceSpan?.content_preview ?? null;
  const wrapperBase = {
    schema_version: CONTENT_WRAPPER_SCHEMA_VERSION,
    untrusted_content_wrapper_id: `untrusted-content-wrapper.${slugify(candidate.retrieval_candidate_record_id)}`,
    retrieval_candidate_record_id: candidate.retrieval_candidate_record_id,
    retrieval_request_record_id: candidate.retrieval_request_record_id,
    context_packet_v2_record_id: candidate.context_packet_v2_record_id,
    workflow_run_id: candidate.workflow_run_id,
    resource_id: candidate.resource_id,
    source_span_id: candidate.source_span_id,
    source_span_bound: candidate.source_span_bound === true,
    source_span_location_type: candidate.source_span_location_type ?? "metadata_only",
    matter_id: candidate.matter_id,
    classification: candidate.classification,
    span_classification: candidate.span_classification ?? candidate.classification,
    policy_snapshot_id: candidate.policy_snapshot_id,
    content_origin: candidate.source_span_bound ? "external_source_span_preview" : "resource_metadata_only",
    content_role: "evidence_content",
    wrapper_status: "wrapped_as_untrusted_evidence_content",
    prompt_injection_handling: CONTENT_HANDLING,
    instruction_boundary_status: "instruction_text_neutralized",
    allowed_use: ["attorney_review_context", "evidence_review", "citation_hint", "lineage_reference"],
    forbidden_use: ["system_prompt", "developer_instruction", "tool_instruction", "policy_override", "client_facing_output", "external_transfer", "protected_action"],
    content_preview_available: Boolean(preview),
    content_preview_hash: preview ? hashValue(preview) : candidate.content_preview_hash ?? null,
    sanitized_content_preview: preview ? wrapAsQuotedEvidence(preview) : "[metadata-only candidate; source text unavailable in retrieval compiler]",
    raw_instruction_execution_allowed: false,
    tool_instruction_allowed: false,
    system_prompt_override_allowed: false,
    policy_override_allowed: false,
    client_facing_output_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return {
    ...wrapperBase,
    wrapper_hash: hashValue(wrapperBase),
  };
}

function buildInstructionSignalRecord(wrapper, generatedAt) {
  const preview = wrapper.sanitized_content_preview ?? "";
  const matchedSignals = INSTRUCTION_SIGNAL_PATTERNS
    .filter((signal) => signal.pattern.test(preview))
    .map((signal) => signal.signal_type);
  const signalBase = {
    schema_version: INSTRUCTION_SIGNAL_SCHEMA_VERSION,
    instruction_signal_record_id: `prompt-injection-signal.${slugify(wrapper.untrusted_content_wrapper_id)}`,
    untrusted_content_wrapper_id: wrapper.untrusted_content_wrapper_id,
    retrieval_candidate_record_id: wrapper.retrieval_candidate_record_id,
    retrieval_request_record_id: wrapper.retrieval_request_record_id,
    source_span_id: wrapper.source_span_id,
    resource_id: wrapper.resource_id,
    instruction_signal_status: matchedSignals.length > 0 ? "neutralized_instruction_like_text" : "no_instruction_signal_detected",
    signal_count: matchedSignals.length,
    matched_signal_types: matchedSignals,
    instruction_treatment: "evidence_content_only",
    promoted_to_prompt_instruction: false,
    promoted_to_tool_instruction: false,
    policy_override_allowed: false,
    neutralized: true,
    recorded_at: generatedAt,
  };
  return {
    ...signalBase,
    instruction_signal_hash: hashValue(signalBase),
  };
}

function buildPromptBoundaryGuardRecord({
  request,
  candidates,
  guard,
  wrapperByCandidate,
  signalByWrapper,
  generatedAt,
}) {
  const wrappers = candidates
    .map((candidate) => wrapperByCandidate.get(candidate.retrieval_candidate_record_id))
    .filter(Boolean);
  const signals = wrappers
    .map((wrapper) => signalByWrapper.get(wrapper.untrusted_content_wrapper_id))
    .filter(Boolean);
  const signalCount = sum(signals.map((signal) => signal.signal_count ?? 0));
  const wrapperCount = wrappers.length;
  const guardBase = {
    schema_version: BOUNDARY_GUARD_SCHEMA_VERSION,
    prompt_boundary_guard_id: `prompt-boundary-guard.${slugify(request.retrieval_request_record_id)}`,
    retrieval_request_record_id: request.retrieval_request_record_id,
    context_packet_v2_record_id: request.context_packet_v2_record_id,
    workflow_run_id: request.workflow_run_id,
    matter_id: request.matter_id,
    classification_floor: request.classification_floor,
    prompt_boundary_guard_status: wrapperCount === candidates.length && signals.every((signal) => signal.neutralized) ? "passed" : "blocked",
    source_retrieval_guard_status: guard?.retrieval_guard_status ?? "missing",
    candidate_count: candidates.length,
    untrusted_content_wrapper_count: wrapperCount,
    instruction_signal_record_count: signals.length,
    instruction_signal_count: signalCount,
    neutralized_instruction_signal_count: sum(signals.filter((signal) => signal.neutralized).map((signal) => signal.signal_count ?? 0)),
    content_role_guard_status: wrappers.every((wrapper) => wrapper.content_role === "evidence_content") ? "passed" : "blocked",
    wrapper_guard_status: wrapperCount === candidates.length ? "passed" : "blocked",
    instruction_promotion_guard_status: signals.every((signal) => !signal.promoted_to_prompt_instruction && !signal.promoted_to_tool_instruction) ? "passed" : "blocked",
    no_tool_instruction_guard_status: wrappers.every((wrapper) => wrapper.tool_instruction_allowed === false) ? "passed" : "blocked",
    no_policy_override_guard_status: wrappers.every((wrapper) => wrapper.policy_override_allowed === false) ? "passed" : "blocked",
    query_execution_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return {
    ...guardBase,
    prompt_boundary_guard_hash: hashValue(guardBase),
  };
}

function validateWorkflowPromptInjectionBoundary({
  workflowRetrievalCompiler,
  sourceSpanStore,
  packageJson,
  roadmapText,
  retrievalRequests,
  retrievalCandidates,
  buildResult,
}) {
  const items = [];
  const wrappers = buildResult.untrustedContentWrapperRecords;
  const signals = buildResult.instructionSignalRecords;
  const guards = buildResult.promptBoundaryGuardRecords;
  const candidateIds = new Set(retrievalCandidates.map((candidate) => candidate.retrieval_candidate_record_id));
  const wrapperCandidateIds = new Set(wrappers.map((wrapper) => wrapper.retrieval_candidate_record_id));
  const wrapperIds = new Set(wrappers.map((wrapper) => wrapper.untrusted_content_wrapper_id));
  const requestIds = new Set(retrievalRequests.map((request) => request.retrieval_request_record_id));

  pushCheck(items, "source.workflow_retrieval_compiler", "workflow_retrieval_compiler_complete", workflowRetrievalCompiler.summary?.workflow_retrieval_compiler_status === "complete" && workflowRetrievalCompiler.validation?.valid !== false, "Workflow retrieval compiler must be complete.");
  pushCheck(items, "source.source_span_store", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete" && sourceSpanStore.validation?.valid !== false, "Source span store must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:prompt-injection-boundary"]), "package.json must expose npm run workflows:prompt-injection-boundary.");
  pushCheck(items, "roadmap.phase_186", "phase_186_documented", roadmapText.includes("P186") && roadmapText.includes("prompt injection boundary"), "Phase ledger must keep the P186 prompt injection boundary slot visible.");
  pushCheck(items, "untrusted_content_wrapper_records", "wrapper_per_retrieval_candidate", wrappers.length === retrievalCandidates.length && [...candidateIds].every((candidateId) => wrapperCandidateIds.has(candidateId)), "Every retrieval candidate must have one untrusted content wrapper.");
  pushCheck(items, "untrusted_content_wrapper_records", "wrappers_treat_content_as_evidence", wrappers.length > 0 && wrappers.every((wrapper) => wrapper.content_role === "evidence_content" && wrapper.prompt_injection_handling === CONTENT_HANDLING), "Wrappers must treat external content only as evidence data.");
  pushCheck(items, "untrusted_content_wrapper_records", "wrappers_prevent_instruction_promotion", wrappers.every((wrapper) => !wrapper.raw_instruction_execution_allowed && !wrapper.tool_instruction_allowed && !wrapper.system_prompt_override_allowed && !wrapper.policy_override_allowed), "Wrappers must block raw instruction execution and prompt/tool/policy override.");
  pushCheck(items, "untrusted_content_wrapper_records", "wrappers_block_transfer_and_actions", wrappers.every((wrapper) => !wrapper.client_facing_output_allowed && !wrapper.external_transfer_allowed && !wrapper.protected_action_execution_allowed), "Wrappers must not allow client-facing output, external transfer, or protected actions.");
  pushCheck(items, "instruction_signal_records", "signal_per_wrapper", signals.length === wrappers.length && signals.every((signal) => wrapperIds.has(signal.untrusted_content_wrapper_id)), "Every wrapper must have one instruction signal record.");
  pushCheck(items, "instruction_signal_records", "signals_neutralized", signals.every((signal) => signal.neutralized === true && signal.instruction_treatment === "evidence_content_only"), "Instruction-like text must be neutralized as evidence content only.");
  pushCheck(items, "instruction_signal_records", "signals_not_promoted", signals.every((signal) => !signal.promoted_to_prompt_instruction && !signal.promoted_to_tool_instruction && !signal.policy_override_allowed), "Instruction signals must not become prompt/tool instructions or policy overrides.");
  pushCheck(items, "prompt_boundary_guard_records", "guard_per_request", guards.length === retrievalRequests.length && guards.every((guard) => requestIds.has(guard.retrieval_request_record_id)), "Every retrieval request must have one prompt boundary guard.");
  pushCheck(items, "prompt_boundary_guard_records", "guards_pass", guards.every((guard) => guard.prompt_boundary_guard_status === "passed" && guard.wrapper_guard_status === "passed" && guard.content_role_guard_status === "passed"), "Prompt boundary guards must pass wrapper and content-role checks.");
  pushCheck(items, "prompt_boundary_guard_records", "guards_non_executable", guards.every((guard) => !guard.query_execution_allowed && !guard.external_transfer_allowed && !guard.protected_action_execution_allowed), "Prompt boundary guards must not allow query execution, transfer, or protected actions.");
  pushCheck(items, "prompt_boundary_guard_records", "guards_human_review", guards.every((guard) => guard.human_review_required), "Prompt boundary guards must require human review.");
  return items;
}

function summarizeWorkflowPromptInjectionBoundary({
  workflowRetrievalCompiler,
  sourceSpanStore,
  retrievalRequests,
  retrievalCandidates,
  buildResult,
  validation,
  validationItems,
}) {
  const wrappers = buildResult.untrustedContentWrapperRecords;
  const signals = buildResult.instructionSignalRecords;
  const guards = buildResult.promptBoundaryGuardRecords;
  const instructionSignalCount = sum(signals.map((signal) => signal.signal_count ?? 0));
  return {
    workflow_prompt_injection_boundary_status: validation.errors.length === 0 ? "complete" : "blocked",
    prompt_injection_boundary_contract_id: BOUNDARY_CONTRACT_ID,
    source_workflow_retrieval_compiler_status: workflowRetrievalCompiler.summary?.workflow_retrieval_compiler_status ?? "unknown",
    source_source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    source_retrieval_request_count: retrievalRequests.length,
    source_retrieval_candidate_count: retrievalCandidates.length,
    source_source_span_count: sourceSpanStore.summary?.source_span_count ?? 0,
    untrusted_content_wrapper_count: wrappers.length,
    source_span_bound_wrapper_count: wrappers.filter((wrapper) => wrapper.source_span_bound).length,
    metadata_only_wrapper_count: wrappers.filter((wrapper) => !wrapper.source_span_bound).length,
    evidence_content_role_count: wrappers.filter((wrapper) => wrapper.content_role === "evidence_content").length,
    wrapper_with_preview_count: wrappers.filter((wrapper) => wrapper.content_preview_available).length,
    instruction_signal_record_count: signals.length,
    instruction_signal_count: instructionSignalCount,
    wrapper_with_instruction_signal_count: signals.filter((signal) => (signal.signal_count ?? 0) > 0).length,
    neutralized_instruction_signal_count: sum(signals.filter((signal) => signal.neutralized).map((signal) => signal.signal_count ?? 0)),
    promoted_prompt_instruction_count: signals.filter((signal) => signal.promoted_to_prompt_instruction).length,
    promoted_tool_instruction_count: signals.filter((signal) => signal.promoted_to_tool_instruction).length,
    policy_override_allowed_count: wrappers.filter((wrapper) => wrapper.policy_override_allowed).length + signals.filter((signal) => signal.policy_override_allowed).length,
    tool_instruction_allowed_count: wrappers.filter((wrapper) => wrapper.tool_instruction_allowed).length,
    system_prompt_override_allowed_count: wrappers.filter((wrapper) => wrapper.system_prompt_override_allowed).length,
    client_facing_output_allowed_count: wrappers.filter((wrapper) => wrapper.client_facing_output_allowed).length,
    external_transfer_allowed_count: wrappers.filter((wrapper) => wrapper.external_transfer_allowed).length + guards.filter((guard) => guard.external_transfer_allowed).length,
    protected_action_executed_count: wrappers.filter((wrapper) => wrapper.protected_action_execution_allowed).length + guards.filter((guard) => guard.protected_action_execution_allowed).length,
    prompt_boundary_guard_count: guards.length,
    prompt_boundary_guard_passed_count: guards.filter((guard) => guard.prompt_boundary_guard_status === "passed").length,
    wrapper_guard_passed_count: guards.filter((guard) => guard.wrapper_guard_status === "passed").length,
    content_role_guard_passed_count: guards.filter((guard) => guard.content_role_guard_status === "passed").length,
    instruction_promotion_guard_passed_count: guards.filter((guard) => guard.instruction_promotion_guard_status === "passed").length,
    no_tool_instruction_guard_passed_count: guards.filter((guard) => guard.no_tool_instruction_guard_status === "passed").length,
    no_policy_override_guard_passed_count: guards.filter((guard) => guard.no_policy_override_guard_status === "passed").length,
    human_review_required_guard_count: guards.filter((guard) => guard.human_review_required).length,
    law_firm_wrapper_count: wrappers.filter((wrapper) => wrapper.policy_snapshot_id === "policy.default.law_firm.v1").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_wrapper_status: countByObject(wrappers, "wrapper_status"),
    by_instruction_signal_status: countByObject(signals, "instruction_signal_status"),
    by_prompt_boundary_guard_status: countByObject(guards, "prompt_boundary_guard_status"),
    by_content_origin: countByObject(wrappers, "content_origin"),
  };
}

function buildPromptInjectionBoundaryContract(generatedAt) {
  return {
    schema_version: "workflow-prompt-injection-boundary-contract.v1",
    generated_at: generatedAt,
    prompt_injection_boundary_contract_id: BOUNDARY_CONTRACT_ID,
    untrusted_content_wrapper_schema_version: CONTENT_WRAPPER_SCHEMA_VERSION,
    instruction_signal_schema_version: INSTRUCTION_SIGNAL_SCHEMA_VERSION,
    prompt_boundary_guard_schema_version: BOUNDARY_GUARD_SCHEMA_VERSION,
    content_handling_rule: "all external or source-derived text is wrapped as evidence content and never promoted to system, developer, tool, or policy instructions",
    detection_rule: "instruction-like text is detected deterministically and recorded as neutralized evidence signals",
    execution_rule: "P186 does not execute retrieval queries, tools, external transfers, client-facing output, or protected actions",
    law_firm_safety_rule: "law-firm content remains human-review gated and attorney-reviewable only.",
  };
}

function renderWorkflowPromptInjectionBoundaryMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Prompt Injection Boundary");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_prompt_injection_boundary_status}`);
  lines.push("");
  lines.push(`- Untrusted wrappers: ${summary.untrusted_content_wrapper_count}`);
  lines.push(`- Instruction signals: ${summary.instruction_signal_count}`);
  lines.push(`- Neutralized signals: ${summary.neutralized_instruction_signal_count}`);
  lines.push(`- Prompt/tool/policy promotions: ${summary.promoted_prompt_instruction_count}/${summary.promoted_tool_instruction_count}/${summary.policy_override_allowed_count}`);
  lines.push(`- External/protected allowed: ${summary.external_transfer_allowed_count}/${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Guards");
  lines.push("");
  for (const guard of result.prompt_boundary_guard_records) {
    lines.push(`- ${guard.prompt_boundary_guard_id}: ${guard.prompt_boundary_guard_status}, wrappers=${guard.untrusted_content_wrapper_count}, signals=${guard.instruction_signal_count}`);
  }
  return `${lines.join("\n")}\n`;
}

function wrapAsQuotedEvidence(text) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  return `[UNTRUSTED_EVIDENCE_CONTENT_BEGIN] ${normalized} [UNTRUSTED_EVIDENCE_CONTENT_END]`;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function normalizeInputs(options) {
  return {
    workflow_retrieval_compiler_path: path.resolve(options.workflowRetrievalCompilerPath ?? DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.workflowRetrievalCompilerPath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.sourceSpanStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowRetrievalCompilerPath: DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.workflowRetrievalCompilerPath,
    sourceSpanStorePath: DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.sourceSpanStorePath,
    packagePath: DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_PROMPT_INJECTION_BOUNDARY_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-retrieval-compiler") parsed.workflowRetrievalCompilerPath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-prompt-injection-boundary.mjs [options]

Options:
  --workflow-retrieval-compiler <path> workflow-retrieval-compiler.json path.
  --source-span-store <path> source-span-store.json path.
  --package <path> package.json path.
  --roadmap <path> final completion phase ledger path.
  --out-dir <path> output directory.
  --run-at <iso> deterministic generated_at timestamp.
  --check validate only without writing artifacts.
`);
}

function serializablePromptInjectionBoundary(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourceSummary(artifact, statusKey) {
  return {
    schema_version: artifact.schema_version ?? null,
    generated_at: artifact.generated_at ?? null,
    status: artifact.summary?.[statusKey] ?? artifact.summary?.status ?? artifact.ledger_status ?? (artifact.validation?.valid === true ? "complete" : "unknown"),
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
  };
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function indexBy(items, key) {
  return new Map((items ?? []).filter((item) => item?.[key] != null).map((item) => [item[key], item]));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items ?? []) {
    const groupKey = item?.[key];
    if (groupKey == null) continue;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  }
  return groups;
}

function countByObject(items, key) {
  const counts = {};
  for (const item of items ?? []) {
    const value = item?.[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}
