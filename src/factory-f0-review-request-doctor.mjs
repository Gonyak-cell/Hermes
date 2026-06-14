import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_FACTORY_F0_REVIEW_REQUEST_DOCTOR_OUT_DIR = "artifacts/factory-f0-review-request-doctor/latest";
export const DEFAULT_FACTORY_F0_REVIEW_REQUEST_DOCTOR_INPUTS = {
  schemaPath: "schemas/factory-f0-review-request-doctor.schema.json",
  packagePath: "package.json",
  requestIndexPath: "docs/factory-promotion/f0-review-requests/review-request-index.json",
};

const COMMAND_NAME = "factory:f0-review-request-doctor";
const SCHEMA_VERSION = "factory-f0-review-request-doctor.v1";
const CAPABILITY_ID = "factory.f0_review_request_doctor";
const PROGRAM_RANGE = "FCORE-F0.1";
const READY_STATUS = "ready_f0_review_request_doctor";
const BLOCKED_STATUS = "blocked_f0_review_request_doctor";

const EXPECTED_REQUESTS = {
  connector_external_app_governance: {
    prompt_path: "docs/factory-promotion/f0-review-requests/connector-external-app-governance-opus-review-request.md",
    required_receipt_path: "artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json",
    required_validator_command: "npm run platform:connector-external-app-governance -- --check",
  },
  execution_write_authority_maturity: {
    prompt_path: "docs/factory-promotion/f0-review-requests/execution-write-authority-maturity-opus-review-request.md",
    required_receipt_path: "artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json",
    required_validator_command: "npm run platform:execution-write-authority-maturity -- --check",
  },
};

export async function runFactoryF0ReviewRequestDoctor(options = {}) {
  const result = await buildFactoryF0ReviewRequestDoctor(options);
  if (options.write !== false) await writeFactoryF0ReviewRequestDoctor(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory F0 Review Request Doctor failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.f0_review_request_doctor_passed !== true) {
    const error = new Error("Factory F0 Review Request Doctor did not pass.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryF0ReviewRequestDoctor(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_F0_REVIEW_REQUEST_DOCTOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const requestIndex = Object.prototype.hasOwnProperty.call(options, "requestIndex")
    ? normalizeInlineJsonSource("inline.request_index", options.requestIndex)
    : await readJsonSource(inputs.request_index_path);
  const promptSources = {};
  for (const request of requestIndex.data?.requests ?? []) {
    promptSources[request.scope_id] = Object.prototype.hasOwnProperty.call(options, "promptTexts") && Object.prototype.hasOwnProperty.call(options.promptTexts, request.scope_id)
      ? normalizeInlineTextSource(`inline.prompt.${request.scope_id}`, options.promptTexts[request.scope_id])
      : await readTextSource(request.prompt_path);
  }

  const requestRows = buildRequestRows({ requestIndex, promptSources, generatedAt });
  const boundary = buildBoundary({ requestIndex, requestRows });
  const validationItems = buildValidationItems({ packageJson, requestIndex, requestRows, boundary });
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
      prompt_paths: (requestIndex.data?.requests ?? []).map((request) => request.prompt_path),
    },
    factory_f0_review_request_doctor_contract: buildContract(generatedAt),
    review_request_rows: requestRows,
    factory_f0_review_request_doctor_boundary: boundary,
    factory_f0_review_request_doctor_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, requestRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "factory_f0_review_request_doctor")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_f0_review_request_doctor_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_f0_review_request_doctor_validation_items);
  result.summary = buildSummary({ boundary, requestRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryF0ReviewRequestDoctor(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-f0-review-request-doctor.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-request-rows.json"), collectionEnvelope("factory-f0-review-request-rows.v1", "review_request_rows", result.review_request_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-f0-review-request-doctor-boundary.json"), result.factory_f0_review_request_doctor_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryF0ReviewRequestDoctorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryF0ReviewRequestDoctor(args);
    console.log(`Factory F0 Review Request Doctor ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_f0_review_request_doctor_status}`);
    console.log(`Requests passed: ${result.summary.request_pass_count}/${result.summary.request_count}`);
    console.log(`Doctor passed: ${result.summary.f0_review_request_doctor_passed}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.summary) console.error(`- f0_review_request_doctor_passed: ${error.summary.f0_review_request_doctor_passed}`);
    process.exitCode = 1;
    return null;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "factory-f0-review-request-doctor.contract.v1",
    generated_at: generatedAt,
    request_count_required: 2,
    prompt_sha256_must_match_index: true,
    request_packets_are_review_evidence: false,
    request_packets_are_validation_substrate: false,
    receipt_targets_limited_to_f0_1_paths: true,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildRequestRows({ requestIndex, promptSources, generatedAt }) {
  const rows = [
    doctorRow("index.available", "index", "Review request index is available", requestIndex.available === true, requestIndex.path, generatedAt),
    doctorRow("index.schema", "index", "Review request index has expected schema", requestIndex.data?.schema_version === "factory-f0-review-request-index.v1", requestIndex.path, generatedAt),
    doctorRow("index.status", "index", "Index is request-packets-only, not review evidence", requestIndex.data?.status === "request_packets_only_not_review_evidence", requestIndex.path, generatedAt),
    doctorRow("index.not_evidence", "index", "Index explicitly denies review evidence status", requestIndex.data?.is_review_evidence === false, requestIndex.path, generatedAt),
    doctorRow("index.not_validation_substrate", "index", "Index explicitly denies validation substrate status", requestIndex.data?.is_validation_substrate === false, requestIndex.path, generatedAt),
  ];
  const requests = Array.isArray(requestIndex.data?.requests) ? requestIndex.data.requests : [];
  rows.push(doctorRow("requests.count", "request", "Exactly two F0.1 requests are listed", requests.length === 2, requestIndex.path, generatedAt));
  for (const [scopeId, expected] of Object.entries(EXPECTED_REQUESTS)) {
    const request = requests.find((entry) => entry.scope_id === scopeId);
    const prompt = promptSources[scopeId] ?? { available: false, path: expected.prompt_path, text: "", sha256: null };
    rows.push(
      doctorRow(`${scopeId}.entry`, "request", `${scopeId} request entry exists`, Boolean(request), requestIndex.path, generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.prompt_path`, "request", `${scopeId} prompt path matches expected file`, request?.prompt_path === expected.prompt_path, request?.prompt_path ?? "missing", generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.receipt_path`, "request", `${scopeId} receipt path matches expected target`, request?.required_receipt_path === expected.required_receipt_path, request?.required_receipt_path ?? "missing", generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.validator`, "request", `${scopeId} validator command matches expected check`, request?.required_validator_command === expected.required_validator_command, request?.required_validator_command ?? "missing", generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.prompt_available`, "prompt", `${scopeId} prompt packet is available`, prompt.available === true, prompt.path, generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.prompt_sha256`, "prompt", `${scopeId} prompt SHA256 matches index`, Boolean(prompt.sha256 && request?.prompt_sha256 && prompt.sha256 === request.prompt_sha256), prompt.path, generatedAt, { scope_id: scopeId, observed_prompt_sha256: prompt.sha256, indexed_prompt_sha256: request?.prompt_sha256 ?? null }),
      doctorRow(`${scopeId}.prompt_read_only`, "prompt", `${scopeId} prompt declares read-only review`, includesAll(prompt.text, ["read-only review", "Do not edit files", "Do not edit files, create commits"]), prompt.path, generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.prompt_receipt_requirements`, "prompt", `${scopeId} prompt declares integrity receipt fields`, includesAll(prompt.text, ["reviewed_commit_sha", "prompt_sha256", "raw_output_sha256", "engine_resolved_model_id", "unresolved_finding_count"]), prompt.path, generatedAt, { scope_id: scopeId }),
      doctorRow(`${scopeId}.prompt_no_approval`, "prompt", `${scopeId} prompt forbids protected approval claim`, includesAll(prompt.text, ["do not imply approval", "production_pass_enabled", "enterprise_pass_enabled"]), prompt.path, generatedAt, { scope_id: scopeId }),
    );
  }
  return rows;
}

function buildBoundary({ requestIndex, requestRows }) {
  const requestPassCount = Object.keys(EXPECTED_REQUESTS).filter((scopeId) => {
    const scopedRows = requestRows.filter((row) => row.scope_id === scopeId);
    return scopedRows.length > 0 && scopedRows.every((row) => row.current_verdict === "pass");
  }).length;
  const rowsPass = requestRows.length > 0 && requestRows.every((row) => row.current_verdict === "pass");
  return {
    request_index_available_now: requestIndex.available === true,
    request_count: Object.keys(EXPECTED_REQUESTS).length,
    request_pass_count: requestPassCount,
    review_request_rows_passed: rowsPass,
    request_packets_are_review_evidence: requestIndex.data?.is_review_evidence === true,
    request_packets_are_validation_substrate: requestIndex.data?.is_validation_substrate === true,
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

function buildValidationItems({ packageJson, requestIndex, requestRows, boundary }) {
  return [
    validationItem("package.script", "package", packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/factory-f0-review-request-doctor.mjs", `${COMMAND_NAME} package script missing`),
    validationItem("request.index.available", "request_index", requestIndex.available === true, "F0 review request index missing", requestIndex.path),
    validationItem("requests.count", "request_index", boundary.request_count === 2, "F0.1 doctor must cover exactly two review requests", requestIndex.path),
    validationItem("rows.present", "contract", requestRows.length >= 20, "Review request doctor rows incomplete", "review_request_rows"),
    validationItem("authority.closed", "authority", allBoundaryAuthorityFlagsFalse(boundary), "Review request doctor opened forbidden authority", "factory_f0_review_request_doctor_boundary"),
    validationItem("not.evidence", "boundary", boundary.request_packets_are_review_evidence === false && boundary.request_packets_are_validation_substrate === false, "Request packets were treated as evidence or validation substrate", "factory_f0_review_request_doctor_boundary"),
  ];
}

function buildSummary({ boundary, requestRows, validation }) {
  const passed = boundary.review_request_rows_passed === true && validation.valid === true;
  return {
    factory_f0_review_request_doctor_status: passed ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    request_count: boundary.request_count,
    request_pass_count: boundary.request_pass_count,
    f0_review_request_doctor_passed: passed,
    blocked_row_ids: requestRows.filter((row) => row.current_verdict !== "pass").map((row) => row.row_id),
    request_packets_are_review_evidence: boundary.request_packets_are_review_evidence,
    request_packets_are_validation_substrate: boundary.request_packets_are_validation_substrate,
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

function doctorRow(rowId, category, label, observed, evidenceRef, generatedAt, extras = {}) {
  return {
    schema_version: "factory-f0-review-request-doctor-row.v1",
    row_id: rowId,
    category,
    label,
    observed,
    required: true,
    current_verdict: observed ? "pass" : "blocked",
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    ...extras,
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

function includesAll(text, needles) {
  if (typeof text !== "string") return false;
  return needles.every((needle) => text.includes(needle));
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
    "# Factory F0 Review Request Doctor",
    "",
    `Status: ${result.summary.factory_f0_review_request_doctor_status}`,
    `Program: ${result.program_range}`,
    `Generated: ${result.generated_at}`,
    `Requests passed: ${result.summary.request_pass_count}/${result.summary.request_count}`,
    "",
    "## Rows",
    "",
    "| Row | Verdict | Evidence |",
    "|---|---|---|",
  ];
  for (const row of result.review_request_rows) {
    lines.push(`| ${row.row_id} | ${row.current_verdict} | ${row.evidence_ref} |`);
  }
  lines.push(
    "",
    "## Boundary",
    "",
    `Request packets are review evidence: ${result.summary.request_packets_are_review_evidence}`,
    `Request packets are validation substrate: ${result.summary.request_packets_are_validation_substrate}`,
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
  if (value === null || value === undefined) {
    return {
      available: false,
      path: sourcePath,
      text: "",
      sha256: null,
    };
  }
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
    schema_path: options.schemaPath ?? DEFAULT_FACTORY_F0_REVIEW_REQUEST_DOCTOR_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_FACTORY_F0_REVIEW_REQUEST_DOCTOR_INPUTS.packagePath,
    request_index_path: options.requestIndexPath ?? DEFAULT_FACTORY_F0_REVIEW_REQUEST_DOCTOR_INPUTS.requestIndexPath,
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
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--request-index-path") args.requestIndexPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--require-pass]`);
  console.log("Verifies F0.1 independent review request packets and prompt hashes before external review execution.");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
