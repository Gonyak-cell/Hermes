import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_FACTORY_RECEIPT_PREFLIGHT_OUT_DIR = "artifacts/factory-receipt-preflight/latest";
export const DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS = {
  schemaPath: "schemas/factory-receipt-preflight.schema.json",
  packagePath: "package.json",
  ownerAdjudicationReceiptPath: "docs/factory-promotion/s0-owner-adjudication-receipt.json",
  connectorReviewReceiptPath: "artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json",
  executionReviewReceiptPath: "artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json",
};

const COMMAND_NAME = "factory:receipt-preflight";
const SCHEMA_VERSION = "factory-receipt-preflight.v1";
const CAPABILITY_ID = "factory.receipt_preflight";
const PROGRAM_RANGE = "FCORE-F0.1";
const READY_STATUS = "ready_for_f0_1_receipt_preflight";
const BLOCKED_STATUS = "blocked_f0_1_receipt_preflight";

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
const UNSAFE_AUTHORITY_FIELDS = new Set([
  "project_creation_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "connector_write_enabled",
  "external_app_connection_allowed_now",
  "credential_lookup_allowed_now",
  "secret_read_allowed_now",
  "raw_export_allowed_now",
  "raw_source_exposure_allowed",
  "ingestion_start_allowed_now",
  "connector_provisioning_allowed_now",
  "external_service_mutation_allowed_now",
  "cross_app_data_join_allowed_now",
  "receipt_application_allowed_now",
  "candidate_execution_allowed_now",
  "runtime_execution_allowed_now",
  "direct_file_write_allowed_now",
  "patch_apply_allowed_now",
  "release_approval_allowed_now",
  "write_action_allowed_now",
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
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "final_approval_allowed",
  "final_approval_ui_enabled",
]);

const DEFAULT_TARGETS = [
  {
    target_id: "f0_1.connector_external_app_governance",
    label: "Connector external app governance independent review receipt",
    receipt_path_key: "connector_review_receipt_path",
    receipt_path: DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.connectorReviewReceiptPath,
    required_review_engine: "claude_code_opus_max",
    required_scope_field: "scope_connector_external_app_governance",
    required_scope_id: "connector_external_app_governance",
    subject_ref: "P15401-P15800 connector-external-app-governance",
    current_validator_script: "npm run platform:connector-external-app-governance -- --check",
  },
  {
    target_id: "f0_1.execution_write_authority_maturity",
    label: "Execution/write authority maturity independent review receipt",
    receipt_path_key: "execution_review_receipt_path",
    receipt_path: DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.executionReviewReceiptPath,
    required_review_engine: "claude_code_opus_max",
    required_scope_field: "scope_execution_write_authority_maturity",
    required_scope_id: "execution_write_authority_maturity",
    subject_ref: "P15801-P16200 execution-write-authority-maturity",
    current_validator_script: "npm run platform:execution-write-authority-maturity -- --check",
  },
];

export async function runFactoryReceiptPreflight(options = {}) {
  const result = await buildFactoryReceiptPreflight(options);
  if (options.write !== false) await writeFactoryReceiptPreflight(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Receipt Preflight failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.f0_1_receipt_preflight_passed !== true) {
    const error = new Error("Factory Receipt Preflight did not pass all F0.1 receipt targets.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryReceiptPreflight(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_RECEIPT_PREFLIGHT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const ownerReceipt = Object.prototype.hasOwnProperty.call(options, "ownerAdjudicationReceipt")
    ? normalizeInlineJsonSource("inline.owner_adjudication_receipt", options.ownerAdjudicationReceipt)
    : await readJsonSource(inputs.owner_adjudication_receipt_path);
  const targets = normalizeTargets(inputs, options);
  const targetResults = [];
  for (const target of targets) {
    targetResults.push(await buildTargetResult(target, options, generatedAt));
  }

  const rows = targetResults.flatMap((target) => target.preflight_rows);
  const boundary = buildBoundary({ targetResults, ownerReceipt });
  const validationItems = buildValidationItems({ packageJson, ownerReceipt, targets, rows, boundary });
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
      owner_adjudication_receipt_path: ownerReceipt.path,
      receipt_target_paths: targets.map((target) => target.receipt_path),
    },
    factory_receipt_preflight_contract: buildContract(generatedAt),
    owner_adjudication_summary: ownerReceipt.data?.scope ?? null,
    receipt_targets: targetResults.map((target) => target.summary),
    receipt_preflight_rows: rows,
    factory_receipt_preflight_boundary: boundary,
    factory_receipt_preflight_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ targetResults, boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "factory_receipt_preflight")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_receipt_preflight_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_receipt_preflight_validation_items);
  result.summary = buildSummary({ targetResults, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryReceiptPreflight(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-receipt-preflight.json"), serializableResult(result));
  await writeJson(path.join(outDir, "receipt-preflight-rows.json"), collectionEnvelope("factory-receipt-preflight-rows.v1", "receipt_preflight_rows", result.receipt_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-targets.json"), collectionEnvelope("factory-receipt-targets.v1", "receipt_targets", result.receipt_targets, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryReceiptPreflightCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryReceiptPreflight(args);
    console.log(`Factory Receipt Preflight ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_receipt_preflight_status}`);
    console.log(`Program: ${result.program_range}`);
    console.log(`Owner adjudication receipt: ${result.summary.owner_adjudication_receipt_present_now}`);
    console.log(`Targets passed: ${result.summary.receipt_target_pass_count}/${result.summary.receipt_target_count}`);
    console.log(`F0.1 preflight passed: ${result.summary.f0_1_receipt_preflight_passed}`);
    console.log(`Authority flags opened: ${result.summary.unsafe_authority_true_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    if (error.summary) console.error(`- f0_1_receipt_preflight_passed: ${error.summary.f0_1_receipt_preflight_passed}`);
    process.exitCode = 1;
    return null;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "factory-receipt-preflight.contract.v1",
    generated_at: generatedAt,
    receipt_targets_required: 2,
    current_validator_shape_required: true,
    reviewed_commit_sha_required: true,
    prompt_sha256_required: true,
    raw_output_sha256_required: true,
    engine_resolved_model_id_required: true,
    receipt_file_sha256_computed: true,
    fable_planning_receipt_allowed: false,
    label_only_engine_id_allowed: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    ai_final_approval_allowed: false,
  };
}

async function buildTargetResult(target, options, generatedAt) {
  const receipt = await readTargetReceipt(target, options);
  const data = receipt.data ?? {};
  const unresolvedFindingCount = Number(data.unresolved_finding_count ?? data.summary?.unresolved_finding_count);
  const engineResolvedModelId = typeof data.engine_resolved_model_id === "string" ? data.engine_resolved_model_id.trim() : "";
  const rawOutputSha256 = typeof data.raw_output_sha256 === "string" ? data.raw_output_sha256 : "";
  const unsafeAuthorityTrueCount = countUnsafeAuthorityFields(data);
  const rowInputs = [
    ["receipt.available", "Receipt file is available", receipt.available === true, receipt.path],
    ["receipt.json_parseable", "Receipt JSON is parseable", receipt.parseable === true, receipt.path],
    ["current.review_engine", "Current validator review_engine matches claude_code_opus_max", data.review_engine === target.required_review_engine, target.current_validator_script],
    ["current.receipt_status", "Current validator receipt_status is complete", data.receipt_status === "complete", target.current_validator_script],
    ["current.scope_field", `Current validator scope field ${target.required_scope_field} is true`, data[target.required_scope_field] === true, target.current_validator_script],
    ["current.unresolved_findings", "Current validator unresolved_finding_count is zero", Number.isFinite(unresolvedFindingCount) && unresolvedFindingCount === 0, target.current_validator_script],
    ["integrity.reviewed_commit_sha", "Receipt binds reviewed commit SHA", typeof data.reviewed_commit_sha === "string" && GIT_SHA.test(data.reviewed_commit_sha), receipt.path],
    ["integrity.prompt_sha256", "Receipt binds prompt SHA256", typeof data.prompt_sha256 === "string" && HEX_64.test(data.prompt_sha256), receipt.path],
    ["integrity.raw_output_sha256", "Receipt binds raw output SHA256", HEX_64.test(rawOutputSha256), receipt.path],
    ["integrity.engine_resolved_model_id", "Receipt records actual resolved model id, not a label", isResolvedModelIdAcceptable(engineResolvedModelId), receipt.path],
    ["integrity.scope_id", `Receipt scope_id equals ${target.required_scope_id}`, data.scope_id === target.required_scope_id, receipt.path],
    ["integrity.receipt_file_sha256", "Receipt file SHA256 can be computed", receipt.available === true && HEX_64.test(receipt.receipt_file_sha256 ?? ""), receipt.path],
    ["independence.not_fable_planning", "Receipt is not from the Fable planning package lane", !isFablePlanningReceipt(data), receipt.path],
    ["authority.flags_false", "Receipt does not open write/deploy/protected/pass/final approval authority", unsafeAuthorityTrueCount === 0, receipt.path],
  ];
  const preflightRows = rowInputs.map(([rowId, label, observed, evidenceRef]) => preflightRow({
    target_id: target.target_id,
    row_id: `${target.target_id}.${rowId}`,
    category: rowId.split(".")[0],
    label,
    observed,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    receipt_path: receipt.path,
    receipt_file_sha256: receipt.receipt_file_sha256 ?? null,
    engine_resolved_model_id: engineResolvedModelId || null,
    scope_id: data.scope_id ?? null,
    unresolved_finding_count: Number.isFinite(unresolvedFindingCount) ? unresolvedFindingCount : null,
    unsafe_authority_true_count: unsafeAuthorityTrueCount,
  }));
  const targetPassed = preflightRows.every((row) => row.current_verdict === "pass");
  return {
    target,
    preflight_rows: preflightRows,
    summary: {
      target_id: target.target_id,
      label: target.label,
      receipt_path: receipt.path,
      receipt_available_now: receipt.available === true,
      receipt_parseable_now: receipt.parseable === true,
      receipt_file_sha256: receipt.receipt_file_sha256 ?? null,
      review_engine: data.review_engine ?? null,
      engine_resolved_model_id: engineResolvedModelId || null,
      scope_id: data.scope_id ?? null,
      required_scope_id: target.required_scope_id,
      unresolved_finding_count: Number.isFinite(unresolvedFindingCount) ? unresolvedFindingCount : null,
      unsafe_authority_true_count: unsafeAuthorityTrueCount,
      target_preflight_passed: targetPassed,
      blocked_row_count: preflightRows.filter((row) => row.current_verdict !== "pass").length,
    },
  };
}

function buildBoundary({ targetResults, ownerReceipt }) {
  const unsafeAuthorityTrueCount = targetResults.reduce((sum, target) => sum + Number(target.summary.unsafe_authority_true_count ?? 0), 0);
  const targetPassCount = targetResults.filter((target) => target.summary.target_preflight_passed === true).length;
  return {
    owner_adjudication_receipt_present_now: ownerReceipt.available === true,
    owner_adjudication_receipt_id: ownerReceipt.data?.receipt_id ?? null,
    receipt_target_count: targetResults.length,
    receipt_target_pass_count: targetPassCount,
    f0_1_receipt_preflight_passed: targetResults.length > 0 && targetPassCount === targetResults.length,
    missing_receipt_count: targetResults.filter((target) => target.summary.receipt_available_now === false).length,
    unsafe_authority_true_count: unsafeAuthorityTrueCount,
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

function buildValidationItems({ packageJson, ownerReceipt, targets, rows, boundary }) {
  return [
    validationItem("package.script", "package", packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/factory-receipt-preflight.mjs", `${COMMAND_NAME} package script missing`),
    validationItem("owner.receipt.visible", "owner_adjudication", ownerReceipt.available === true, "S0 owner adjudication receipt missing"),
    validationItem("targets.count", "contract", targets.length === 2, "F0.1 preflight must track exactly two missing independent review receipts"),
    validationItem("rows.present", "contract", rows.length >= targets.length * 10, "Preflight rows incomplete"),
    validationItem("authority.closed", "authority", boundary.unsafe_authority_true_count === 0, "Receipt input opens forbidden authority"),
    validationItem("boundary.flags.false", "authority", allBoundaryAuthorityFlagsFalse(boundary), "Preflight boundary opened authority"),
  ];
}

function buildSummary({ targetResults, boundary, validation }) {
  const status = boundary.f0_1_receipt_preflight_passed === true ? READY_STATUS : BLOCKED_STATUS;
  return {
    factory_receipt_preflight_status: status,
    program_range: PROGRAM_RANGE,
    owner_adjudication_receipt_present_now: boundary.owner_adjudication_receipt_present_now,
    receipt_target_count: boundary.receipt_target_count,
    receipt_target_pass_count: boundary.receipt_target_pass_count,
    missing_receipt_count: boundary.missing_receipt_count,
    f0_1_receipt_preflight_passed: boundary.f0_1_receipt_preflight_passed,
    blocked_target_ids: targetResults.filter((target) => target.summary.target_preflight_passed !== true).map((target) => target.summary.target_id),
    unsafe_authority_true_count: boundary.unsafe_authority_true_count,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_errors: validation.errors.length,
    ready_for_fa_implementation_now: false,
  };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.packagePath,
    owner_adjudication_receipt_path: options.ownerAdjudicationReceiptPath ?? DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.ownerAdjudicationReceiptPath,
    connector_review_receipt_path: options.connectorReceiptPath ?? DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.connectorReviewReceiptPath,
    execution_review_receipt_path: options.executionReceiptPath ?? DEFAULT_FACTORY_RECEIPT_PREFLIGHT_INPUTS.executionReviewReceiptPath,
  };
}

function normalizeTargets(inputs, options) {
  if (Array.isArray(options.targets)) return options.targets;
  return DEFAULT_TARGETS.map((target) => ({
    ...target,
    receipt_path: inputs[target.receipt_path_key],
  }));
}

async function readTargetReceipt(target, options) {
  const inlineReceipts = options.inlineReceipts ?? {};
  if (Object.prototype.hasOwnProperty.call(inlineReceipts, target.target_id)) {
    return normalizeInlineJsonSource(`inline.${target.target_id}`, inlineReceipts[target.target_id]);
  }
  return readJsonSource(target.receipt_path);
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
        receipt_file_sha256: sha256(text),
      };
    } catch (error) {
      return {
        available: true,
        parseable: false,
        path: filePath,
        data: null,
        error: `Invalid JSON: ${error.message}`,
        receipt_file_sha256: sha256(text),
      };
    }
  } catch (error) {
    return {
      available: false,
      parseable: false,
      path: filePath,
      data: null,
      error: error.message,
      receipt_file_sha256: null,
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
      receipt_file_sha256: null,
    };
  }
  const text = canonicalJson(value);
  return {
    available: true,
    parseable: true,
    path: sourcePath,
    data: value,
    receipt_file_sha256: sha256(text),
  };
}

function isResolvedModelIdAcceptable(value) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const normalized = value.trim().toLowerCase();
  if (LABEL_ONLY_ENGINE_IDS.has(normalized)) return false;
  if (normalized.includes("fable")) return false;
  return true;
}

function isFablePlanningReceipt(data) {
  const engine = `${data?.engine_resolved_model_id ?? ""}`.toLowerCase();
  const lane = `${data?.author_lane ?? data?.review_lane ?? data?.source_lane ?? ""}`.toLowerCase();
  const subject = `${data?.subject_ref ?? data?.scope?.subject_ref ?? ""}`.toLowerCase();
  const source = `${data?.source_ref ?? data?.evidence_ref ?? ""}`.toLowerCase();
  return engine.includes("fable") || lane.includes("planning") || subject.includes("factory-promotion") || source.includes("factory-promotion");
}

function countUnsafeAuthorityFields(value) {
  let count = 0;
  function visit(item) {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) {
      for (const entry of item) visit(entry);
      return;
    }
    for (const [key, nested] of Object.entries(item)) {
      if (UNSAFE_AUTHORITY_FIELDS.has(key) && nested === true) count += 1;
      visit(nested);
    }
  }
  visit(value);
  return count;
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

function preflightRow(fields) {
  return {
    schema_version: "factory-receipt-preflight-row.v1",
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
    "# Factory Receipt Preflight",
    "",
    `Status: ${result.summary.factory_receipt_preflight_status}`,
    `Program: ${result.program_range}`,
    `Generated: ${result.generated_at}`,
    "",
    "## Targets",
    "",
    "| Target | Receipt | Passed | Blocked Rows | SHA256 |",
    "|---|---|---:|---:|---|",
  ];
  for (const target of result.receipt_targets) {
    lines.push(`| ${target.target_id} | ${target.receipt_path} | ${target.target_preflight_passed} | ${target.blocked_row_count} | ${target.receipt_file_sha256 ?? "missing"} |`);
  }
  lines.push(
    "",
    "## Boundary",
    "",
    `- project_creation_allowed_now: ${result.factory_receipt_preflight_boundary.project_creation_allowed_now}`,
    `- repo_write_allowed_now: ${result.factory_receipt_preflight_boundary.repo_write_allowed_now}`,
    `- connector_write_allowed_now: ${result.factory_receipt_preflight_boundary.connector_write_allowed_now}`,
    `- deployment_allowed_now: ${result.factory_receipt_preflight_boundary.deployment_allowed_now}`,
    `- production_pass_enabled: ${result.factory_receipt_preflight_boundary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.factory_receipt_preflight_boundary.enterprise_pass_enabled}`,
    "",
    "This artifact is a preflight report only. It does not create review receipts, approve work, open write authority, or mark FA implementation ready.",
  );
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--require-pass") args.requirePass = true;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema") args.schemaPath = argv[++index];
    else if (value === "--owner-receipt") args.ownerAdjudicationReceiptPath = argv[++index];
    else if (value === "--connector-receipt") args.connectorReceiptPath = argv[++index];
    else if (value === "--execution-receipt") args.executionReceiptPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--require-pass] [--out-dir DIR] [--connector-receipt FILE] [--execution-receipt FILE]`);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
