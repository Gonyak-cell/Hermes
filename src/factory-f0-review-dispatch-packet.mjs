import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildFactoryF0ReviewRequestDoctor } from "./factory-f0-review-request-doctor.mjs";

const execFileAsync = promisify(execFile);

export const DEFAULT_FACTORY_F0_REVIEW_DISPATCH_PACKET_OUT_DIR = "artifacts/factory-f0-review-dispatch-packet/latest";
export const DEFAULT_FACTORY_F0_REVIEW_DISPATCH_PACKET_INPUTS = {
  schemaPath: "schemas/factory-f0-review-dispatch-packet.schema.json",
  packagePath: "package.json",
};

const COMMAND_NAME = "factory:f0-review-dispatch-packet";
const SCHEMA_VERSION = "factory-f0-review-dispatch-packet.v1";
const CAPABILITY_ID = "factory.f0_review_dispatch_packet";
const PROGRAM_RANGE = "FCORE-F0.1";
const READY_STATUS = "ready_f0_review_dispatch_packet";
const BLOCKED_STATUS = "blocked_f0_review_dispatch_packet";

export async function runFactoryF0ReviewDispatchPacket(options = {}) {
  const result = await buildFactoryF0ReviewDispatchPacket(options);
  if (options.write !== false) await writeFactoryF0ReviewDispatchPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory F0 Review Dispatch Packet failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.f0_review_dispatch_packet_ready !== true) {
    const error = new Error("Factory F0 Review Dispatch Packet is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryF0ReviewDispatchPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_F0_REVIEW_DISPATCH_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const doctor = Object.prototype.hasOwnProperty.call(options, "reviewRequestDoctor")
    ? normalizeInlineSource("inline.review_request_doctor", options.reviewRequestDoctor)
    : normalizeBuiltSource("built.review_request_doctor", await buildFactoryF0ReviewRequestDoctor(buildDoctorOptions(options, generatedAt)));
  const gitState = Object.prototype.hasOwnProperty.call(options, "gitState")
    ? normalizeInlineGitState(options.gitState)
    : await readGitState(options.cwd ?? process.cwd());
  const dispatchRequests = buildDispatchRequests({ doctor: doctor.data, gitState });
  const dispatchRows = buildDispatchRows({ packageJson, doctor, gitState, dispatchRequests, generatedAt });
  const boundary = buildBoundary({ doctor, gitState, dispatchRows });
  const validationItems = buildValidationItems({ packageJson, dispatchRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const dispatchPacket = buildDispatchPacket({ generatedAt, gitState, dispatchRequests, boundary });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      review_request_doctor_path: doctor.path,
      reviewed_commit_sha: gitState.head_sha,
      branch: gitState.branch,
    },
    factory_f0_review_dispatch_packet_contract: buildContract(generatedAt),
    dispatch_packet: dispatchPacket,
    dispatch_rows: dispatchRows,
    factory_f0_review_dispatch_packet_boundary: boundary,
    factory_f0_review_dispatch_packet_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, dispatchRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "factory_f0_review_dispatch_packet")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_f0_review_dispatch_packet_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_f0_review_dispatch_packet_validation_items);
  result.summary = buildSummary({ boundary, dispatchRows, validation: result.validation });
  result.dispatch_packet.dispatch_status = result.summary.factory_f0_review_dispatch_packet_status;
  result.dispatch_packet.dispatch_ready = result.summary.f0_review_dispatch_packet_ready;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryF0ReviewDispatchPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-f0-review-dispatch-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "dispatch-packet.json"), result.dispatch_packet);
  await writeJson(path.join(outDir, "dispatch-rows.json"), collectionEnvelope("factory-f0-review-dispatch-rows.v1", "dispatch_rows", result.dispatch_rows, result.generated_at));
  await writeJson(path.join(outDir, "factory-f0-review-dispatch-packet-boundary.json"), result.factory_f0_review_dispatch_packet_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryF0ReviewDispatchPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryF0ReviewDispatchPacket(args);
    console.log(`Factory F0 Review Dispatch Packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_f0_review_dispatch_packet_status}`);
    console.log(`Reviewed commit SHA: ${result.summary.reviewed_commit_sha ?? "missing"}`);
    console.log(`Worktree clean: ${result.summary.worktree_clean}`);
    console.log(`Doctor passed: ${result.summary.review_request_doctor_passed}`);
    console.log(`Dispatch ready: ${result.summary.f0_review_dispatch_packet_ready}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.summary) console.error(`- f0_review_dispatch_packet_ready: ${error.summary.f0_review_dispatch_packet_ready}`);
    process.exitCode = 1;
    return null;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "factory-f0-review-dispatch-packet.contract.v1",
    generated_at: generatedAt,
    clean_worktree_required: true,
    review_request_doctor_required: true,
    reviewed_commit_sha_required: true,
    dispatch_packet_is_review_evidence: false,
    dispatch_packet_is_validation_substrate: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildDoctorOptions(options, generatedAt) {
  const doctorOptions = {
    runAt: generatedAt,
    write: false,
  };
  if (Object.prototype.hasOwnProperty.call(options, "requestIndex")) doctorOptions.requestIndex = options.requestIndex;
  if (Object.prototype.hasOwnProperty.call(options, "promptTexts")) doctorOptions.promptTexts = options.promptTexts;
  return doctorOptions;
}

function buildDispatchRequests({ doctor, gitState }) {
  const requests = doctor?.source_refs?.prompt_paths?.length
    ? doctor.source_refs.prompt_paths.map((promptPath) => {
      const scopeRows = doctor.review_request_rows?.filter((row) => row.evidence_ref === promptPath || row.scope_id) ?? [];
      const shaRow = scopeRows.find((row) => row.row_id.endsWith(".prompt_sha256") && row.evidence_ref === promptPath);
      const scopeId = shaRow?.scope_id ?? inferScopeIdFromPromptPath(promptPath);
      const receiptRow = doctor.review_request_rows?.find((row) => row.row_id === `${scopeId}.receipt_path`);
      const validatorRow = doctor.review_request_rows?.find((row) => row.row_id === `${scopeId}.validator`);
      return {
        scope_id: scopeId,
        prompt_path: promptPath,
        prompt_sha256: shaRow?.observed_prompt_sha256 ?? null,
        required_receipt_path: receiptRow?.evidence_ref ?? null,
        required_validator_command: validatorRow?.evidence_ref ?? null,
        reviewed_commit_sha: gitState.head_sha,
        intake_dry_run_command: `npm run factory:f0-review-receipt-intake -- --scope-id ${scopeId} --raw-output-path <raw-opus-review-output.txt> --reviewed-commit-sha ${gitState.head_sha ?? "<reviewed-commit-sha>"} --engine-resolved-model-id <actual-resolved-opus-model-id> --unresolved-finding-count 0 --check --require-pass`,
      };
    })
    : [];
  return requests.filter((request) => request.scope_id);
}

function buildDispatchRows({ packageJson, doctor, gitState, dispatchRequests, generatedAt }) {
  const doctorSummary = doctor.data?.summary ?? {};
  const rows = [
    dispatchRow("package.script", "package", "package.json registers factory:f0-review-dispatch-packet", packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/factory-f0-review-dispatch-packet.mjs", "package.json", generatedAt),
    dispatchRow("doctor.available", "doctor", "Review request doctor result is available", doctor.available === true, doctor.path, generatedAt),
    dispatchRow("doctor.passed", "doctor", "Review request doctor passed", doctorSummary.f0_review_request_doctor_passed === true, doctor.path, generatedAt),
    dispatchRow("git.head", "git", "Reviewed commit SHA is available", typeof gitState.head_sha === "string" && gitState.head_sha.length >= 7, "git rev-parse HEAD", generatedAt),
    dispatchRow("git.branch", "git", "Branch name is available", typeof gitState.branch === "string" && gitState.branch.length > 0, "git branch --show-current", generatedAt),
    dispatchRow("git.clean", "git", "Worktree is clean before dispatch", gitState.clean === true, "git status --short", generatedAt, { dirty_path_count: gitState.dirty_paths.length }),
    dispatchRow("requests.count", "dispatch", "Dispatch includes exactly two review requests", dispatchRequests.length === 2, "dispatch_packet.requests", generatedAt),
    dispatchRow("requests.receipt_paths", "dispatch", "Dispatch requests bind receipt output paths", dispatchRequests.length === 2 && dispatchRequests.every((request) => typeof request.required_receipt_path === "string" && request.required_receipt_path.includes("/review/")), "dispatch_packet.requests", generatedAt),
    dispatchRow("requests.prompt_hashes", "dispatch", "Dispatch requests bind prompt SHA256 values", dispatchRequests.length === 2 && dispatchRequests.every((request) => /^[a-f0-9]{64}$/i.test(request.prompt_sha256 ?? "")), "dispatch_packet.requests", generatedAt),
    dispatchRow("boundary.no_evidence", "boundary", "Dispatch packet is not review evidence or validation substrate", true, "factory_f0_review_dispatch_packet_boundary", generatedAt),
  ];
  return rows;
}

function buildBoundary({ doctor, gitState, dispatchRows }) {
  const rowsPass = dispatchRows.length > 0 && dispatchRows.every((row) => row.current_verdict === "pass");
  return {
    review_request_doctor_passed: doctor.data?.summary?.f0_review_request_doctor_passed === true,
    reviewed_commit_sha: gitState.head_sha ?? null,
    branch: gitState.branch ?? null,
    worktree_clean: gitState.clean === true,
    dirty_path_count: gitState.dirty_paths.length,
    dirty_paths: gitState.dirty_paths,
    dispatch_rows_passed: rowsPass,
    dispatch_packet_is_review_evidence: false,
    dispatch_packet_is_validation_substrate: false,
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

function buildValidationItems({ packageJson, dispatchRows, boundary }) {
  return [
    validationItem("package.script", "package", packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/factory-f0-review-dispatch-packet.mjs", `${COMMAND_NAME} package script missing`),
    validationItem("rows.present", "contract", dispatchRows.length >= 10, "Dispatch packet rows incomplete", "dispatch_rows"),
    validationItem("authority.closed", "authority", allBoundaryAuthorityFlagsFalse(boundary), "Dispatch packet opened forbidden authority", "factory_f0_review_dispatch_packet_boundary"),
    validationItem("not.evidence", "boundary", boundary.dispatch_packet_is_review_evidence === false && boundary.dispatch_packet_is_validation_substrate === false, "Dispatch packet became review evidence or validation substrate", "factory_f0_review_dispatch_packet_boundary"),
  ];
}

function buildDispatchPacket({ generatedAt, gitState, dispatchRequests, boundary }) {
  return {
    schema_version: "factory-f0-review-dispatch-packet.payload.v1",
    generated_at: generatedAt,
    reviewed_commit_sha: gitState.head_sha ?? null,
    branch: gitState.branch ?? null,
    worktree_clean: gitState.clean === true,
    dirty_paths: gitState.dirty_paths,
    dispatch_ready: false,
    dispatch_status: BLOCKED_STATUS,
    is_review_evidence: false,
    is_validation_substrate: false,
    requests: dispatchRequests,
    post_receipt_commands: [
      "npm run factory:receipt-preflight -- --check --require-pass",
      "npm run factory:promotion-f0-gate -- --check --require-pass",
      "npm run platform:connector-external-app-governance -- --check",
      "npm run platform:execution-write-authority-maturity -- --check",
    ],
    blocked_reason: boundary.worktree_clean ? null : "worktree_dirty",
  };
}

function buildSummary({ boundary, dispatchRows, validation }) {
  const ready = boundary.dispatch_rows_passed === true && validation.valid === true;
  return {
    factory_f0_review_dispatch_packet_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    f0_review_dispatch_packet_ready: ready,
    review_request_doctor_passed: boundary.review_request_doctor_passed,
    reviewed_commit_sha: boundary.reviewed_commit_sha,
    branch: boundary.branch,
    worktree_clean: boundary.worktree_clean,
    dirty_path_count: boundary.dirty_path_count,
    blocked_row_ids: dispatchRows.filter((row) => row.current_verdict !== "pass").map((row) => row.row_id),
    dispatch_packet_is_review_evidence: false,
    dispatch_packet_is_validation_substrate: false,
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

async function readGitState(cwd) {
  const head = await git(["rev-parse", "HEAD"], cwd);
  const branch = await git(["branch", "--show-current"], cwd);
  const status = await git(["status", "--short"], cwd);
  const dirtyPaths = status.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    head_sha: head.ok ? head.stdout.trim() : null,
    branch: branch.ok ? branch.stdout.trim() : null,
    clean: status.ok && dirtyPaths.length === 0,
    dirty_paths: dirtyPaths,
    errors: [head, branch, status].filter((result) => !result.ok).map((result) => result.error_message),
  };
}

async function git(args, cwd) {
  try {
    const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
    return { ok: true, stdout: result.stdout, stderr: result.stderr, error_message: null };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      error_message: error.message,
    };
  }
}

function normalizeInlineGitState(value) {
  return {
    head_sha: value?.head_sha ?? value?.headSha ?? null,
    branch: value?.branch ?? null,
    clean: value?.clean === true,
    dirty_paths: Array.isArray(value?.dirty_paths) ? value.dirty_paths : Array.isArray(value?.dirtyPaths) ? value.dirtyPaths : [],
    errors: [],
  };
}

function normalizeBuiltSource(sourcePath, value) {
  return {
    available: true,
    parseable: true,
    path: sourcePath,
    data: value,
  };
}

function normalizeInlineSource(sourcePath, value) {
  if (value === null || value === undefined) {
    return { available: false, parseable: false, path: sourcePath, data: null };
  }
  return { available: true, parseable: true, path: sourcePath, data: value };
}

function inferScopeIdFromPromptPath(promptPath) {
  if (promptPath.includes("connector-external-app-governance")) return "connector_external_app_governance";
  if (promptPath.includes("execution-write-authority-maturity")) return "execution_write_authority_maturity";
  return null;
}

function dispatchRow(rowId, category, label, observed, evidenceRef, generatedAt, extras = {}) {
  return {
    schema_version: "factory-f0-review-dispatch-row.v1",
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

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
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
    "# Factory F0 Review Dispatch Packet",
    "",
    `Status: ${result.summary.factory_f0_review_dispatch_packet_status}`,
    `Program: ${result.program_range}`,
    `Generated: ${result.generated_at}`,
    `Reviewed commit SHA: ${result.summary.reviewed_commit_sha ?? "missing"}`,
    `Worktree clean: ${result.summary.worktree_clean}`,
    "",
    "## Requests",
    "",
    "| Scope | Prompt | Receipt |",
    "|---|---|---|",
  ];
  for (const request of result.dispatch_packet.requests) {
    lines.push(`| ${request.scope_id} | ${request.prompt_path} | ${request.required_receipt_path} |`);
  }
  lines.push(
    "",
    "## Rows",
    "",
    "| Row | Verdict | Evidence |",
    "|---|---|---|",
  );
  for (const row of result.dispatch_rows) {
    lines.push(`| ${row.row_id} | ${row.current_verdict} | ${row.evidence_ref} |`);
  }
  lines.push(
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
      return { available: true, parseable: true, path: filePath, data: JSON.parse(text) };
    } catch (error) {
      return { available: true, parseable: false, path: filePath, data: null, error: `Invalid JSON: ${error.message}` };
    }
  } catch (error) {
    return { available: false, parseable: false, path: filePath, data: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_FACTORY_F0_REVIEW_DISPATCH_PACKET_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_FACTORY_F0_REVIEW_DISPATCH_PACKET_INPUTS.packagePath,
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
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--require-pass]`);
  console.log("Builds the external Opus review dispatch packet, binding prompt hashes to a clean reviewed commit SHA.");
}
