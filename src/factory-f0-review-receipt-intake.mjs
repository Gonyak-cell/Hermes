import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildFactoryReceiptPreflight } from "./factory-receipt-preflight.mjs";

export const DEFAULT_FACTORY_F0_REVIEW_RECEIPT_INTAKE_OUT_DIR = "artifacts/factory-f0-review-receipt-intake/latest";
export const DEFAULT_FACTORY_F0_REVIEW_RECEIPT_INTAKE_INPUTS = {
  schemaPath: "schemas/factory-f0-review-receipt-intake.schema.json",
  packagePath: "package.json",
  requestIndexPath: "docs/factory-promotion/f0-review-requests/review-request-index.json",
};

const COMMAND_NAME = "factory:f0-review-receipt-intake";
const SCHEMA_VERSION = "factory-f0-review-receipt-intake.v1";
const CAPABILITY_ID = "factory.f0_review_receipt_intake";
const PROGRAM_RANGE = "FCORE-F0.1";
const READY_STATUS = "ready_f0_review_receipt_intake";
const BLOCKED_STATUS = "blocked_f0_review_receipt_intake";

const HEX_64 = /^[a-f0-9]{64}$/i;
const GIT_SHA = /^[a-f0-9]{7,64}$/i;
const LABEL_ONLY_ENGINE_IDS = new Set([
  "claude",
  "claude_code",
  "claude_code_opus_max",
  "opus",
  "opus_max",
  "fable",
  "fable_5",
]);

const SCOPE_CONFIGS = {
  connector_external_app_governance: {
    schema_version: "connector-governance-claude-review-receipt.v1",
    receipt_path: "artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json",
    scope_field: "scope_connector_external_app_governance",
    target_id: "f0_1.connector_external_app_governance",
  },
  execution_write_authority_maturity: {
    schema_version: "execution-write-authority-claude-review-receipt.v1",
    receipt_path: "artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json",
    scope_field: "scope_execution_write_authority_maturity",
    target_id: "f0_1.execution_write_authority_maturity",
  },
};

export async function runFactoryF0ReviewReceiptIntake(options = {}) {
  const result = await buildFactoryF0ReviewReceiptIntake(options);
  if (options.write !== false && result.generated_receipt) await writeFactoryF0ReviewReceiptIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory F0 Review Receipt Intake failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.factory_f0_review_receipt_intake_status !== READY_STATUS) {
    const error = new Error("Factory F0 Review Receipt Intake target receipt does not pass F0.1 preflight or intake rows.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryF0ReviewReceiptIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_F0_REVIEW_RECEIPT_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const requestIndex = Object.prototype.hasOwnProperty.call(options, "requestIndex")
    ? normalizeInlineJsonSource("inline.request_index", options.requestIndex)
    : await readJsonSource(inputs.request_index_path);
  const scopeId = options.scopeId ?? inputs.scope_id;
  const scopeConfig = SCOPE_CONFIGS[scopeId] ?? null;
  const request = findRequest(requestIndex.data, scopeId);
  const prompt = request?.prompt_path ? await readTextSource(request.prompt_path) : unavailableTextSource("missing.prompt_path");
  const rawOutput = Object.prototype.hasOwnProperty.call(options, "rawOutputText")
    ? normalizeInlineTextSource("inline.raw_output", options.rawOutputText)
    : await readTextSource(inputs.raw_output_path);
  const findings = await readFindings(options);
  const unresolvedFindingCount = Number(options.unresolvedFindingCount ?? findings.length);
  const receiptPath = options.receiptPath ?? request?.required_receipt_path ?? scopeConfig?.receipt_path ?? null;
  const generatedReceipt = scopeConfig && request && rawOutput.available
    ? buildReceipt({
      scopeId,
      scopeConfig,
      prompt,
      rawOutput,
      reviewedCommitSha: inputs.reviewed_commit_sha,
      engineResolvedModelId: inputs.engine_resolved_model_id,
      unresolvedFindingCount,
      findings,
    })
    : null;
  const targetPreflight = generatedReceipt
    ? await buildTargetPreflight({ scopeConfig, generatedReceipt, generatedAt })
    : null;
  const receiptRows = buildReceiptRows({
    packageJson,
    requestIndex,
    request,
    prompt,
    rawOutput,
    scopeId,
    scopeConfig,
    generatedReceipt,
    targetPreflight,
    reviewedCommitSha: inputs.reviewed_commit_sha,
    engineResolvedModelId: inputs.engine_resolved_model_id,
    unresolvedFindingCount,
    findings,
    receiptPath,
    generatedAt,
  });
  const boundary = buildBoundary({ receiptRows, generatedReceipt, targetPreflight, unresolvedFindingCount });
  const validationItems = buildValidationItems({ packageJson, requestIndex, request, receiptRows, boundary, receiptPath });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      request_index_path: requestIndex.path,
      prompt_path: request?.prompt_path ?? null,
      raw_output_path: rawOutput.path,
      target_receipt_path: receiptPath,
    },
    factory_f0_review_receipt_intake_contract: buildContract(generatedAt),
    generated_receipt_path: receiptPath,
    generated_receipt: generatedReceipt,
    receipt_intake_rows: receiptRows,
    target_preflight_summary: targetPreflight?.receipt_targets?.find((target) => target.target_id === scopeConfig?.target_id) ?? null,
    factory_f0_review_receipt_intake_boundary: boundary,
    factory_f0_review_receipt_intake_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, receiptRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "factory_f0_review_receipt_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_f0_review_receipt_intake_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_f0_review_receipt_intake_validation_items);
  result.summary = buildSummary({ boundary, receiptRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryF0ReviewReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-f0-review-receipt-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "receipt-intake-rows.json"), collectionEnvelope("factory-f0-review-receipt-intake-rows.v1", "receipt_intake_rows", result.receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-f0-review-receipt-intake-boundary.json"), result.factory_f0_review_receipt_intake_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  if (result.generated_receipt_path && result.generated_receipt) {
    const receiptPath = path.resolve(result.generated_receipt_path);
    await mkdir(path.dirname(receiptPath), { recursive: true });
    await writeJson(receiptPath, result.generated_receipt);
  }
}

export async function runFactoryF0ReviewReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryF0ReviewReceiptIntake(args);
    console.log(`Factory F0 Review Receipt Intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_f0_review_receipt_intake_status}`);
    console.log(`Scope: ${result.summary.scope_id}`);
    console.log(`Receipt path: ${result.summary.generated_receipt_path}`);
    console.log(`Prompt SHA256 verified: ${result.summary.prompt_sha256_matches_index}`);
    console.log(`Target preflight passed: ${result.summary.target_preflight_passed}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.summary) console.error(`- target_preflight_passed: ${error.summary.target_preflight_passed}`);
    process.exitCode = 1;
    return null;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "factory-f0-review-receipt-intake.contract.v1",
    generated_at: generatedAt,
    raw_review_output_required: true,
    request_prompt_hash_verified: true,
    receipt_write_target_limited_to_f0_1_review_paths: true,
    failed_claude_cli_result_allowed: false,
    fable_planning_receipt_allowed: false,
    label_only_engine_id_allowed: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildReceipt({ scopeId, scopeConfig, prompt, rawOutput, reviewedCommitSha, engineResolvedModelId, unresolvedFindingCount, findings }) {
  const receipt = {
    schema_version: scopeConfig.schema_version,
    review_engine: "claude_code_opus_max",
    receipt_status: "complete",
    [scopeConfig.scope_field]: true,
    scope_id: scopeId,
    reviewed_commit_sha: reviewedCommitSha,
    prompt_sha256: prompt.sha256,
    raw_output_sha256: rawOutput.sha256,
    engine_resolved_model_id: engineResolvedModelId,
    unresolved_finding_count: unresolvedFindingCount,
    findings,
    summary: {
      review_status: "complete",
      unresolved_finding_count: unresolvedFindingCount,
      blocking_findings: findings,
    },
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
  for (const config of Object.values(SCOPE_CONFIGS)) {
    if (config.scope_field !== scopeConfig.scope_field) receipt[config.scope_field] = false;
  }
  return receipt;
}

async function buildTargetPreflight({ scopeConfig, generatedReceipt, generatedAt }) {
  const inlineReceipts = {
    [scopeConfig.target_id]: generatedReceipt,
  };
  return buildFactoryReceiptPreflight({
    runAt: generatedAt,
    write: false,
    inlineReceipts,
  });
}

function buildReceiptRows(context) {
  const promptSha = context.prompt.sha256 ?? null;
  const expectedPromptSha = context.request?.prompt_sha256 ?? null;
  const receiptPathAllowed = Object.values(SCOPE_CONFIGS).some((config) => config.receipt_path === context.receiptPath);
  const targetSummary = context.targetPreflight?.receipt_targets?.find((target) => target.target_id === context.scopeConfig?.target_id);
  return [
    ["scope.supported", "Scope is one of the two F0.1 review targets", Boolean(context.scopeConfig), context.scopeId],
    ["request.index.available", "F0 review request index is available", context.requestIndex.available === true, context.requestIndex.path],
    ["request.entry.available", "Review request entry exists for scope", Boolean(context.request), context.scopeId],
    ["prompt.available", "Review prompt packet is available", context.prompt.available === true, context.request?.prompt_path ?? "missing"],
    ["prompt.sha256", "Prompt SHA256 matches review request index", Boolean(promptSha && expectedPromptSha && promptSha === expectedPromptSha), context.request?.prompt_path ?? "missing"],
    ["raw_output.available", "Raw independent reviewer output is available", context.rawOutput.available === true, context.rawOutput.path],
    ["raw_output.not_request_packet", "Raw output path is not a request packet or factory-promotion planning document", isRawOutputPathAcceptable(context.rawOutput.path), context.rawOutput.path],
    ["raw_output.not_empty", "Raw output body is non-empty", typeof context.rawOutput.text === "string" && context.rawOutput.text.trim().length > 0, context.rawOutput.path],
    ["raw_output.completed_review", "Raw output is a completed reviewer result, not an auth/API/usage failure", rawOutputCompletedReview(context.rawOutput), context.rawOutput.path],
    ["raw_output.sha256", "Raw output SHA256 can be computed", HEX_64.test(context.rawOutput.sha256 ?? ""), context.rawOutput.path],
    ["reviewed_commit_sha", "Reviewed commit SHA is bound", typeof context.reviewedCommitSha === "string" && GIT_SHA.test(context.reviewedCommitSha), "reviewed_commit_sha"],
    ["engine_resolved_model_id", "Resolved model id is literal and not label-only or Fable", isResolvedModelIdAcceptable(context.engineResolvedModelId), "engine_resolved_model_id"],
    ["findings.count_consistent", "Unresolved finding count is consistent with findings array", Number.isInteger(context.unresolvedFindingCount) && context.unresolvedFindingCount >= 0 && context.findings.length === context.unresolvedFindingCount, "findings"],
    ["receipt.path_allowed", "Receipt output path is limited to the F0.1 target paths", receiptPathAllowed, context.receiptPath ?? "missing"],
    ["receipt.generated", "Target receipt can be generated", Boolean(context.generatedReceipt), context.receiptPath ?? "missing"],
    ["receipt.authority_closed", "Generated receipt keeps approval and trust authority closed", receiptAuthorityClosed(context.generatedReceipt), context.receiptPath ?? "missing"],
    ["target.preflight", "Generated receipt passes target-specific F0 preflight rows", targetSummary?.target_preflight_passed === true, "factory:receipt-preflight"],
  ].map(([rowId, label, observed, evidenceRef]) => intakeRow({
    row_id: rowId,
    category: rowId.split(".")[0],
    label,
    observed,
    evidence_ref: evidenceRef,
    generated_at: context.generatedAt,
    scope_id: context.scopeId ?? null,
    generated_receipt_path: context.receiptPath ?? null,
    prompt_sha256: promptSha,
    raw_output_sha256: context.rawOutput.sha256 ?? null,
    unresolved_finding_count: Number.isInteger(context.unresolvedFindingCount) ? context.unresolvedFindingCount : null,
  }));
}

function buildBoundary({ receiptRows, generatedReceipt, targetPreflight, unresolvedFindingCount }) {
  const targetSummary = targetPreflight?.receipt_targets?.find((target) => target.scope_id === generatedReceipt?.scope_id);
  const targetPreflightPassed = targetSummary?.target_preflight_passed === true;
  const intakeRowPassCount = receiptRows.filter((row) => row.current_verdict === "pass").length;
  return {
    scope_id: generatedReceipt?.scope_id ?? null,
    generated_receipt_available_now: Boolean(generatedReceipt),
    target_preflight_passed: targetPreflightPassed,
    intake_rows_passed: receiptRows.length > 0 && intakeRowPassCount === receiptRows.length,
    unresolved_finding_count: Number.isInteger(unresolvedFindingCount) ? unresolvedFindingCount : null,
    intake_row_count: receiptRows.length,
    intake_row_pass_count: intakeRowPassCount,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    command_execution_allowed_now: false,
    api_write_methods_allowed_now: false,
    store_mutation_allowed_now: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    fable_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems({ packageJson, requestIndex, request, receiptRows, boundary, receiptPath }) {
  return [
    validationItem("package.script", "package", packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/factory-f0-review-receipt-intake.mjs", `${COMMAND_NAME} package script missing`),
    validationItem("request.index.available", "request_index", requestIndex.available === true, "F0 review request index missing", requestIndex.path),
    validationItem("request.entry.available", "request_index", Boolean(request), "No request entry for scope", "scope_id"),
    validationItem("receipt.path.allowed", "boundary", Object.values(SCOPE_CONFIGS).some((config) => config.receipt_path === receiptPath), "Receipt path is outside F0.1 review paths", receiptPath),
    validationItem("rows.present", "contract", receiptRows.length >= 10, "Receipt intake rows incomplete", "receipt_intake_rows"),
    validationItem("authority.closed", "authority", allBoundaryAuthorityFlagsFalse(boundary), "Receipt intake opened forbidden authority", "factory_f0_review_receipt_intake_boundary"),
  ];
}

function buildSummary({ boundary, receiptRows, validation }) {
  const promptRow = receiptRows.find((row) => row.row_id === "prompt.sha256");
  const status = boundary.target_preflight_passed && boundary.intake_rows_passed && validation.valid ? READY_STATUS : BLOCKED_STATUS;
  return {
    factory_f0_review_receipt_intake_status: status,
    program_range: PROGRAM_RANGE,
    scope_id: boundary.scope_id,
    generated_receipt_available_now: boundary.generated_receipt_available_now,
    generated_receipt_path: receiptRows.find((row) => row.generated_receipt_path)?.generated_receipt_path ?? null,
    prompt_sha256_matches_index: promptRow?.current_verdict === "pass",
    target_preflight_passed: boundary.target_preflight_passed,
    intake_rows_passed: boundary.intake_rows_passed,
    unresolved_finding_count: boundary.unresolved_finding_count,
    intake_row_count: boundary.intake_row_count,
    intake_row_pass_count: boundary.intake_row_pass_count,
    blocked_row_ids: receiptRows.filter((row) => row.current_verdict !== "pass").map((row) => row.row_id),
    validation_errors: validation.errors.length,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

async function readFindings(options) {
  if (Array.isArray(options.findings)) return options.findings;
  if (!options.findingsJsonPath) return [];
  const source = await readJsonSource(options.findingsJsonPath);
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(source.data?.findings)) return source.data.findings;
  return [];
}

function findRequest(requestIndex, scopeId) {
  return (requestIndex?.requests ?? []).find((request) => request.scope_id === scopeId) ?? null;
}

function receiptAuthorityClosed(receipt) {
  if (!receipt) return false;
  return receipt.claude_final_approval_allowed === false
    && receipt.production_pass_enabled === false
    && receipt.enterprise_pass_enabled === false;
}

function isRawOutputPathAcceptable(rawOutputPath) {
  if (typeof rawOutputPath !== "string" || rawOutputPath.length === 0) return false;
  if (rawOutputPath.startsWith("inline.")) return true;
  const normalized = rawOutputPath.split(path.sep).join("/");
  if (normalized.includes("docs/factory-promotion/")) return false;
  if (normalized.includes("f0-review-requests/")) return false;
  return true;
}

function isResolvedModelIdAcceptable(value) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const normalized = value.trim().toLowerCase();
  if (LABEL_ONLY_ENGINE_IDS.has(normalized)) return false;
  if (normalized.includes("fable")) return false;
  return true;
}

function rawOutputCompletedReview(rawOutput) {
  const text = typeof rawOutput?.text === "string" ? rawOutput.text.trim() : "";
  if (!text) return false;
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === "object" && parsed.type === "result") {
    return parsed.subtype === "success"
      && parsed.is_error === false
      && (parsed.api_error_status === null || parsed.api_error_status === undefined)
      && typeof parsed.result === "string"
      && parsed.result.trim().length > 0
      && containsFailureMarker(parsed.result) === false;
  }
  return containsFailureMarker(text) === false;
}

function containsFailureMarker(text) {
  const normalized = String(text).toLowerCase();
  return [
    "out of extra usage",
    "not logged in",
    "please run /login",
    "workspace trust",
    "api_error_status\":429",
    "api_error_status\":401",
    "api_error_status\":403",
    "\"is_error\":true",
    "\"is_error\": true",
  ].some((marker) => normalized.includes(marker));
}

function allBoundaryAuthorityFlagsFalse(boundary) {
  return [
    "project_creation_allowed_now",
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "command_execution_allowed_now",
    "api_write_methods_allowed_now",
    "store_mutation_allowed_now",
    "codex_final_approval_allowed",
    "claude_final_approval_allowed",
    "fable_final_approval_allowed",
    "production_pass_enabled",
    "enterprise_pass_enabled",
  ].every((key) => boundary[key] === false);
}

function intakeRow(fields) {
  return {
    schema_version: "factory-f0-review-receipt-intake-row.v1",
    ...fields,
    required: true,
    current_verdict: fields.observed ? "pass" : "blocked",
  };
}

function validationItem(itemId, category, observed, message, pathRef = null) {
  return {
    item_id: itemId,
    category,
    observed,
    current_verdict: observed ? "pass" : "fail",
    message: observed ? "OK" : message,
    path: pathRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function renderMarkdown(result) {
  const lines = [
    "# Factory F0 Review Receipt Intake",
    "",
    `Status: ${result.summary.factory_f0_review_receipt_intake_status}`,
    `Program: ${result.program_range}`,
    `Generated: ${result.generated_at}`,
    `Scope: ${result.summary.scope_id}`,
    `Target preflight passed: ${result.summary.target_preflight_passed}`,
    "",
    "## Rows",
    "",
    "| Row | Verdict | Evidence |",
    "|---|---|---|",
  ];
  for (const row of result.receipt_intake_rows) {
    lines.push(`| ${row.row_id} | ${row.current_verdict} | ${row.evidence_ref} |`);
  }
  lines.push(
    "",
    "## Boundary",
    "",
    `Generated receipt path: ${result.summary.generated_receipt_path}`,
    `Unresolved finding count: ${result.summary.unresolved_finding_count}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Validation",
    "",
    `Valid: ${result.validation.valid}`,
    `Errors: ${result.validation.errors.length}`,
  );
  return `${lines.join("\n")}\n`;
}

async function readJsonSource(filePath) {
  if (!filePath) return { available: false, parseable: false, path: "missing", data: null, error: "Missing path" };
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    try {
      return {
        available: true,
        parseable: true,
        path: filePath,
        data: JSON.parse(text),
      };
    } catch (error) {
      return {
        available: true,
        parseable: false,
        path: filePath,
        data: null,
        error: `Invalid JSON: ${error.message}`,
      };
    }
  } catch (error) {
    return {
      available: false,
      parseable: false,
      path: filePath,
      data: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  if (!filePath) return unavailableTextSource("missing");
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return {
      available: true,
      path: filePath,
      text,
      sha256: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      text: "",
      sha256: null,
      error: error.message,
    };
  }
}

function unavailableTextSource(sourcePath) {
  return {
    available: false,
    path: sourcePath,
    text: "",
    sha256: null,
  };
}

function normalizeInlineJsonSource(sourcePath, value) {
  if (value === null || value === undefined) {
    return {
      available: false,
      parseable: false,
      path: sourcePath,
      data: null,
    };
  }
  return {
    available: true,
    parseable: true,
    path: sourcePath,
    data: value,
  };
}

function normalizeInlineTextSource(sourcePath, value) {
  if (value === null || value === undefined) return unavailableTextSource(sourcePath);
  const text = String(value);
  return {
    available: true,
    path: sourcePath,
    text,
    sha256: sha256(text),
  };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_FACTORY_F0_REVIEW_RECEIPT_INTAKE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_FACTORY_F0_REVIEW_RECEIPT_INTAKE_INPUTS.packagePath,
    request_index_path: options.requestIndexPath ?? DEFAULT_FACTORY_F0_REVIEW_RECEIPT_INTAKE_INPUTS.requestIndexPath,
    scope_id: options.scopeId ?? null,
    raw_output_path: options.rawOutputPath ?? null,
    reviewed_commit_sha: options.reviewedCommitSha ?? null,
    engine_resolved_model_id: options.engineResolvedModelId ?? null,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") {
      args.check = true;
      args.write = false;
    } else if (value === "--require-pass") args.requirePass = true;
    else if (value === "--scope-id") args.scopeId = argv[++index];
    else if (value === "--raw-output-path") args.rawOutputPath = argv[++index];
    else if (value === "--reviewed-commit-sha") args.reviewedCommitSha = argv[++index];
    else if (value === "--engine-resolved-model-id") args.engineResolvedModelId = argv[++index];
    else if (value === "--unresolved-finding-count") args.unresolvedFindingCount = Number(argv[++index]);
    else if (value === "--findings-json-path") args.findingsJsonPath = argv[++index];
    else if (value === "--receipt-path") args.receiptPath = argv[++index];
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--request-index-path") args.requestIndexPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- --scope-id SCOPE --raw-output-path FILE --reviewed-commit-sha SHA --engine-resolved-model-id MODEL [--check] [--require-pass]`);
  console.log("Normalizes a real F0.1 independent review raw output into its target receipt and validates it through the receipt preflight.");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
