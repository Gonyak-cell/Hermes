import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_EXECUTION_SCHEMA_REGISTRY_OUT_DIR = "artifacts/execution-schema-registry/latest";
export const DEFAULT_EXECUTION_SCHEMA_REGISTRY_SCHEMA_DIR = "schemas";

const SCHEMA_VERSION = "execution-schema-registry.v1";
const READY_STATUS = "ready_for_execution_schema_registry";
const BLOCKED_STATUS = "blocked_execution_schema_registry";
const ZERO_HASH = "0".repeat(64);
const ONE_HASH = "1".repeat(64);
const TWO_HASH = "2".repeat(64);
const THREE_HASH = "3".repeat(64);

export const EXECUTION_SCHEMA_SPECS = [
  ["execution_request", "execution_request.schema.json"],
  ["execution_policy", "execution_policy.schema.json"],
  ["runtime_adapter", "runtime_adapter.schema.json"],
  ["sandbox_session", "sandbox_session.schema.json"],
  ["command_invocation", "command_invocation.schema.json"],
  ["execution_receipt", "execution_receipt.schema.json"],
  ["diff_artifact", "diff_artifact.schema.json"],
  ["test_artifact", "test_artifact.schema.json"],
  ["rollback_plan", "rollback_plan.schema.json"],
  ["human_review_gate", "human_review_gate.schema.json"],
  ["promotion_decision", "promotion_decision.schema.json"],
  ["desktop_execution_projection", "desktop_execution_projection.schema.json"],
].map(([schema_id, file_name]) => ({ schema_id, file_name }));

const FORBIDDEN_AUTHORITY_FLAGS = [
  "production_allowed",
  "deployment_allowed",
  "protected_output_allowed",
  "connector_write_allowed",
  "desktop_shell_execution_allowed",
  "raw_secret_access_allowed",
  "agent_final_pass_allowed",
];

export async function runExecutionSchemaRegistry(options = {}) {
  const result = await buildExecutionSchemaRegistry(options);
  if (options.write !== false) await writeExecutionSchemaRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Execution schema registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExecutionSchemaRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXECUTION_SCHEMA_REGISTRY_OUT_DIR);
  const schemaDir = path.resolve(options.schemaDir ?? DEFAULT_EXECUTION_SCHEMA_REGISTRY_SCHEMA_DIR);
  const schemaRows = [];

  for (const spec of EXECUTION_SCHEMA_SPECS) {
    schemaRows.push(await readSchemaRow(spec, schemaDir));
  }

  const fixtureRows = buildFixtureRows(schemaRows, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(schemaRows, generatedAt);
  const boundary = buildExecutionSchemaBoundary(schemaRows, fixtureRows, negativeFixtureRows, generatedAt);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    output_dir: outputDir,
    schema_dir: schemaDir,
    execution_schema_rows: schemaRows,
    execution_schema_fixture_rows: fixtureRows,
    execution_schema_negative_fixture_rows: negativeFixtureRows,
    execution_schema_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  const validation = validateExecutionSchemaRegistryResult(result);
  result.validation_items = validation.validation_items;
  result.validation = validation.validation;
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export function validateExecutionSchemaRegistryResult(result) {
  const items = [
    validationItem(
      "schema_rows.complete",
      result.execution_schema_rows.length === EXECUTION_SCHEMA_SPECS.length,
      "All expected execution schema rows must be present.",
      "execution_schema_rows",
    ),
    validationItem(
      "schema_rows.valid",
      result.execution_schema_rows.every((row) => row.validation.valid),
      "Every execution schema file must satisfy registry structural checks.",
      "execution_schema_rows",
    ),
    validationItem(
      "fixtures.valid",
      result.execution_schema_fixture_rows
        .filter((row) => row.fixture_kind === "valid")
        .every((row) => row.blocked === false && row.validation.valid),
      "Every valid fixture must pass schema and semantic validation.",
      "execution_schema_fixture_rows",
    ),
    validationItem(
      "fixtures.invalid_blocked",
      result.execution_schema_fixture_rows
        .filter((row) => row.fixture_kind === "missing_required")
        .every((row) => row.blocked === true && row.validation.valid === false),
      "Missing-required fixtures must fail closed.",
      "execution_schema_fixture_rows",
    ),
    validationItem(
      "fixtures.forbidden_blocked",
      result.execution_schema_fixture_rows
        .filter((row) => row.fixture_kind === "forbidden_field")
        .every((row) => row.blocked === true && row.validation.valid === false),
      "Forbidden-field fixtures must fail closed.",
      "execution_schema_fixture_rows",
    ),
    validationItem(
      "negative_fixtures.blocked",
      result.execution_schema_negative_fixture_rows.every((row) => row.blocked === true && row.validation.valid === false),
      "Semantic negative fixtures must fail closed.",
      "execution_schema_negative_fixture_rows",
    ),
    validationItem(
      "boundary.closed",
      result.execution_schema_boundary.production_allowed === false &&
        result.execution_schema_boundary.deployment_allowed === false &&
        result.execution_schema_boundary.protected_output_allowed === false &&
        result.execution_schema_boundary.connector_write_allowed === false &&
        result.execution_schema_boundary.desktop_shell_execution_allowed === false &&
        result.execution_schema_boundary.raw_secret_access_allowed === false &&
        result.execution_schema_boundary.agent_final_pass_allowed === false,
      "Execution schema registry must not open production, deployment, protected, connector, desktop shell, raw secret, or agent final-pass authority.",
      "execution_schema_boundary",
    ),
  ];
  return { validation_items: items, validation: summarizeValidation(items) };
}

export async function writeExecutionSchemaRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "execution-schema-registry.json"), serializable);
  await writeJson(path.join(outDir, "schema-rows.json"), collectionEnvelope("execution-schema-rows.v1", "execution_schema_rows", result.execution_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-validation-rows.json"), collectionEnvelope("execution-schema-fixture-rows.v1", "execution_schema_fixture_rows", result.execution_schema_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("execution-schema-negative-fixture-rows.v1", "execution_schema_negative_fixture_rows", result.execution_schema_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-schema-boundary.json"), result.execution_schema_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "execution-schema-registry-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExecutionSchemaRegistryCli(argv = process.argv.slice(2)) {
  try {
    const args = parseExecutionSchemaRegistryArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runExecutionSchemaRegistry(args);
    console.log(`Execution schema registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.execution_schema_registry_status}`);
    console.log(`Schemas: ${result.summary.schema_count}/${result.summary.expected_schema_count}`);
    console.log(`Valid fixtures: ${result.summary.valid_fixture_pass_count}/${result.summary.valid_fixture_count}`);
    console.log(`Blocked fixtures: ${result.summary.blocked_fixture_pass_count}/${result.summary.blocked_fixture_count}`);
    console.log(`Negative fixtures: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Execution authority opened: ${result.summary.execution_authority_opened_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

export function parseExecutionSchemaRegistryArgs(argv = process.argv.slice(2)) {
  const parsed = { outDir: DEFAULT_EXECUTION_SCHEMA_REGISTRY_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--require-pass") {
      parsed.requirePass = true;
    } else if (arg === "--out-dir") {
      parsed.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-dir") {
      parsed.schemaDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--run-at") {
      parsed.runAt = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

async function readSchemaRow(spec, schemaDir) {
  const schemaPath = path.join(schemaDir, spec.file_name);
  try {
    const raw = await readFile(schemaPath, "utf8");
    const schema = JSON.parse(raw);
    const structuralErrors = validateSchemaStructure(spec, schema);
    return {
      schema_id: spec.schema_id,
      file_name: spec.file_name,
      path: schemaPath,
      title: schema.title ?? null,
      schema_sha256: sha256(raw),
      required_field_count: schema.required?.length ?? 0,
      property_count: Object.keys(schema.properties ?? {}).length,
      forbidden_field_count: schema["x-forbidden-fields"]?.length ?? 0,
      invariant_count: schema["x-validation-invariants"]?.length ?? 0,
      schema,
      validation: {
        valid: structuralErrors.length === 0,
        errors: structuralErrors,
      },
    };
  } catch (error) {
    return {
      schema_id: spec.schema_id,
      file_name: spec.file_name,
      path: schemaPath,
      title: null,
      schema_sha256: null,
      required_field_count: 0,
      property_count: 0,
      forbidden_field_count: 0,
      invariant_count: 0,
      schema: null,
      validation: {
        valid: false,
        errors: [{ path: spec.schema_id, message: error.code === "ENOENT" ? "Schema file missing" : error.message }],
      },
    };
  }
}

function validateSchemaStructure(spec, schema) {
  const errors = [];
  if (schema.title !== spec.schema_id) errors.push({ path: `${spec.schema_id}.title`, message: `Expected title ${spec.schema_id}` });
  if (schema.type !== "object") errors.push({ path: `${spec.schema_id}.type`, message: "Execution schemas must describe objects" });
  if (schema.additionalProperties === false) errors.push({ path: `${spec.schema_id}.additionalProperties`, message: "Execution schemas must preserve unknown additive metadata at the top level" });
  if (!Array.isArray(schema.required) || schema.required.length === 0) errors.push({ path: `${spec.schema_id}.required`, message: "Execution schemas must declare required fields" });
  if (!isPlainObject(schema.properties)) errors.push({ path: `${spec.schema_id}.properties`, message: "Execution schemas must declare properties" });
  if (!Array.isArray(schema["x-forbidden-fields"]) || schema["x-forbidden-fields"].length === 0) errors.push({ path: `${spec.schema_id}.x-forbidden-fields`, message: "Execution schemas must declare forbidden fields" });
  if (!Array.isArray(schema["x-validation-invariants"]) || schema["x-validation-invariants"].length === 0) errors.push({ path: `${spec.schema_id}.x-validation-invariants`, message: "Execution schemas must declare validation invariants" });

  const properties = schema.properties ?? {};
  for (const requiredField of schema.required ?? []) {
    if (!properties[requiredField]) errors.push({ path: `${spec.schema_id}.required.${requiredField}`, message: "Required field has no property schema" });
  }
  for (const forbiddenField of schema["x-forbidden-fields"] ?? []) {
    if (properties[forbiddenField]) errors.push({ path: `${spec.schema_id}.x-forbidden-fields.${forbiddenField}`, message: "Forbidden field must not be an allowed property" });
  }
  return errors;
}

function buildFixtureRows(schemaRows, generatedAt) {
  const rows = [];
  for (const row of schemaRows) {
    if (!row.schema) {
      rows.push(fixtureRow(row, "valid", null, [{ path: row.schema_id, message: "Schema unavailable" }], generatedAt));
      continue;
    }
    const validFixture = buildValidFixture(row.schema_id, generatedAt);
    rows.push(fixtureRow(row, "valid", validFixture, validateFixture(row, validFixture), generatedAt));

    const missingRequiredFixture = { ...validFixture };
    delete missingRequiredFixture[row.schema.required[0]];
    rows.push(fixtureRow(row, "missing_required", missingRequiredFixture, validateFixture(row, missingRequiredFixture), generatedAt));

    const forbiddenField = row.schema["x-forbidden-fields"][0];
    const forbiddenFixture = { ...validFixture, [forbiddenField]: "forbidden_fixture_value" };
    rows.push(fixtureRow(row, "forbidden_field", forbiddenFixture, validateFixture(row, forbiddenFixture), generatedAt));
  }
  return rows;
}

function buildNegativeFixtureRows(schemaRows, generatedAt) {
  const fixtures = [
    ["runtime_adapter", "runtime_source_of_truth_true", { runtime_source_of_truth: true }],
    ["desktop_execution_projection", "desktop_shell_execution_action", { desktop_can_execute: true }],
    ["human_review_gate", "owner_as_independent", { is_independent_reviewer: true, reviewer_independence_level: "owner", decision: "approved" }],
    ["promotion_decision", "premature_production", { target_level: "L3", promotion_allowed: true, deployment_allowed: true, production_allowed: true }],
    ["execution_policy", "deploy_policy_open", { allow_deploy: true, allow_connector_write: true }],
    ["sandbox_session", "secret_and_network_open", { network_allowed: true, secret_allowed: true, install_allowed: true }],
    ["command_invocation", "raw_shell_string", { raw_shell_string: "rm -rf ." }],
    ["execution_receipt", "authority_escalation", { authority_opened: true, forbidden_authority_assertions: ["production_allowed"] }],
  ];
  const rows = [];
  for (const [schemaId, fixtureId, patch] of fixtures) {
    const schemaRow = schemaRows.find((row) => row.schema_id === schemaId);
    if (!schemaRow?.schema) {
      rows.push({
        fixture_id: fixtureId,
        schema_id: schemaId,
        fixture_kind: "semantic_negative",
        blocked: true,
        validation: { valid: false, errors: [{ path: schemaId, message: "Schema unavailable" }] },
        generated_at: generatedAt,
      });
      continue;
    }
    const fixture = { ...buildValidFixture(schemaId, generatedAt), ...patch };
    const errors = validateFixture(schemaRow, fixture);
    rows.push({
      fixture_id: fixtureId,
      schema_id: schemaId,
      fixture_kind: "semantic_negative",
      fixture_sha256: sha256(canonicalStringify(fixture)),
      blocked: errors.length > 0,
      validation: { valid: errors.length === 0, errors },
      generated_at: generatedAt,
    });
  }
  return rows;
}

function fixtureRow(schemaRow, fixtureKind, fixture, errors, generatedAt) {
  return {
    fixture_id: `${schemaRow.schema_id}.${fixtureKind}`,
    schema_id: schemaRow.schema_id,
    fixture_kind: fixtureKind,
    fixture_sha256: fixture ? sha256(canonicalStringify(fixture)) : null,
    blocked: errors.length > 0,
    validation: {
      valid: errors.length === 0,
      errors,
    },
    generated_at: generatedAt,
  };
}

function validateFixture(schemaRow, fixture) {
  const errors = validateAgainstSchema(fixture, schemaRow.schema, {}, schemaRow.schema_id);
  errors.push(...validateForbiddenFields(schemaRow, fixture));
  errors.push(...validateExecutionFixtureSemantics(schemaRow.schema_id, fixture));
  return errors;
}

function validateForbiddenFields(schemaRow, fixture) {
  const errors = [];
  for (const forbiddenField of schemaRow.schema?.["x-forbidden-fields"] ?? []) {
    if (Object.hasOwn(fixture, forbiddenField)) {
      errors.push({
        path: `${schemaRow.schema_id}.${forbiddenField}`,
        message: `Forbidden field ${forbiddenField} is not allowed in ${schemaRow.schema_id}`,
      });
    }
  }
  return errors;
}

function validateExecutionFixtureSemantics(schemaId, fixture) {
  const errors = [];
  if (schemaId === "runtime_adapter" && fixture.runtime_source_of_truth !== false) {
    errors.push({ path: "runtime_adapter.runtime_source_of_truth", message: "Runtime adapter cannot be source of truth" });
  }
  if (schemaId === "desktop_execution_projection" && (fixture.desktop_can_execute || fixture.desktop_can_write || fixture.desktop_can_approve)) {
    errors.push({ path: "desktop_execution_projection.authority", message: "Desktop projection cannot execute, write, or approve" });
  }
  if (schemaId === "human_review_gate" && fixture.is_independent_reviewer && ["owner", "single_owner_lower_trust"].includes(fixture.reviewer_independence_level)) {
    errors.push({ path: "human_review_gate.reviewer_independence_level", message: "Owner and single-owner lower-trust review are not independent review" });
  }
  if (schemaId === "promotion_decision") {
    if (fixture.production_allowed && ["L1", "L2", "L3", "L4", "L5"].includes(fixture.target_level)) {
      errors.push({ path: "promotion_decision.production_allowed", message: "Production cannot be allowed before L6" });
    }
    if (fixture.deployment_allowed && ["L1", "L2", "L3", "L4", "L5"].includes(fixture.target_level)) {
      errors.push({ path: "promotion_decision.deployment_allowed", message: "Deployment cannot be allowed before L6" });
    }
  }
  if (schemaId === "execution_policy" && (fixture.allow_deploy || fixture.allow_connector_write || fixture.allow_package_install)) {
    errors.push({ path: "execution_policy.authority", message: "Initial execution schema registry keeps deploy, connector write, and package install closed" });
  }
  if (schemaId === "sandbox_session" && (fixture.network_allowed || fixture.secret_allowed || fixture.install_allowed)) {
    errors.push({ path: "sandbox_session.authority", message: "Initial sandbox sessions keep network, secrets, and installs closed" });
  }
  if (schemaId === "execution_receipt" && fixture.authority_opened) {
    errors.push({ path: "execution_receipt.authority_opened", message: "Execution schema registry fixtures cannot open authority" });
  }
  return errors;
}

function buildValidFixture(schemaId, generatedAt) {
  const common = {
    schema_version: `${schemaId}.v1`,
    created_at: generatedAt,
    payload_sha256: ZERO_HASH,
    product_id: "product.hermes_harness",
    project_id: "project.personal_dev_fixture",
    domain_pack_id: "personal-dev",
  };
  const fixtures = {
    execution_request: {
      ...common,
      execution_request_id: "erq_fixture",
      requested_by: "human_owner",
      candidate_id: "candidate.fixture",
      request_payload_sha256: ONE_HASH,
      candidate_hash: TWO_HASH,
      policy_hint_hash: THREE_HASH,
      max_maturity_level: "L2",
      mutation_requested: false,
      requires_human_review: true,
      requires_independent_review: false,
      review_gate_id: "hrg_fixture",
    },
    execution_policy: {
      ...common,
      execution_policy_id: "ep_fixture",
      policy_version: "2026-06-16",
      policy_sha256: ONE_HASH,
      allowlist_sha256: TWO_HASH,
      denylist_sha256: THREE_HASH,
      allow_command_execution: false,
      allow_file_write: false,
      allow_network: false,
      allow_package_install: false,
      allow_secret_handle: false,
      allow_connector_write: false,
      allow_deploy: false,
      required_reviewer_roles: ["human_owner"],
    },
    runtime_adapter: {
      schema_version: "runtime_adapter.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      runtime_adapter_id: "ra_local_command_limited",
      runtime_type: "local_command_limited",
      adapter_version: "0.1.0",
      adapter_manifest_sha256: ONE_HASH,
      capability_hash: TWO_HASH,
      registered_at: generatedAt,
      last_validated_at: generatedAt,
      supports_dry_run: true,
      supports_worktree: true,
      supports_mutation: false,
      supports_network: false,
      supports_secret_handles: false,
      supports_desktop_surface: false,
      source_of_truth: "harness",
      runtime_source_of_truth: false,
    },
    sandbox_session: {
      ...common,
      sandbox_session_id: "ss_fixture",
      execution_request_id: "erq_fixture",
      worktree_id: "worktree.fixture",
      base_repo_id: "repo.hermes",
      base_commit_hash: "9e24b55200000000000000000000000000000000",
      worktree_root_hash: ONE_HASH,
      session_manifest_sha256: TWO_HASH,
      write_allowed: false,
      network_allowed: false,
      secret_allowed: false,
      install_allowed: false,
    },
    command_invocation: {
      schema_version: "command_invocation.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      command_invocation_id: "ci_fixture",
      sandbox_session_id: "ss_fixture",
      execution_request_id: "erq_fixture",
      command_id: "command.node_test_dry_run",
      argv: ["node", "--test", "test/execution-schema-registry.test.mjs"],
      argv_sha256: ONE_HASH,
      cwd: "/worktrees/hermes-fixture",
      started_at: generatedAt,
      ended_at: null,
      timeout_ms: 30000,
      exit_code: null,
      status: "blocked",
      stdout_sha256: null,
      stderr_sha256: null,
      files_written_count: 0,
      network_attempts_count: 0,
      allowed_by_policy: false,
      blocked_reason: "schema_registry_fixture_no_execution",
    },
    execution_receipt: {
      ...common,
      receipt_id: "erc_fixture",
      receipt_type: "schema_registry_fixture",
      execution_request_id: "erq_fixture",
      sandbox_session_id: "ss_fixture",
      issuer: "system.execution_schema_registry",
      actor_type: "system",
      runtime_adapter_id: "ra_local_command_limited",
      policy_id: "ep_fixture",
      prev_entry_hash: null,
      entry_hash: ONE_HASH,
      nonce: "nonce.fixture",
      authority_snapshot: closedAuthoritySnapshot(),
      authority_opened: false,
      forbidden_authority_assertions: [],
      source_bindings: {},
    },
    diff_artifact: {
      schema_version: "diff_artifact.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      diff_artifact_id: "da_fixture",
      execution_request_id: "erq_fixture",
      sandbox_session_id: "ss_fixture",
      base_commit_hash: "9e24b55200000000000000000000000000000000",
      worktree_state_hash: ONE_HASH,
      diff_sha256: TWO_HASH,
      changed_files: ["src/execution-schema-registry.mjs"],
      changed_files_hash: THREE_HASH,
      protected_path_hits: [],
      outside_scope_hits: [],
      binary_file_hits: [],
      captured_by: "hermes_diff_capture",
    },
    test_artifact: {
      schema_version: "test_artifact.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      test_artifact_id: "ta_fixture",
      execution_request_id: "erq_fixture",
      test_policy_id: "test_policy.fixture",
      test_command_hash: ONE_HASH,
      test_output_hash: TWO_HASH,
      started_at: generatedAt,
      ended_at: generatedAt,
      status: "blocked",
      commands: [],
      failures: [],
      test_command_allowed: false,
      network_allowed: false,
    },
    rollback_plan: {
      schema_version: "rollback_plan.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      rollback_plan_id: "rb_fixture",
      execution_request_id: "erq_fixture",
      diff_artifact_id: "da_fixture",
      rollback_type: "no_op",
      pre_state_hash: ONE_HASH,
      post_state_hash: ONE_HASH,
      reverse_patch_sha256: null,
      verified_at: generatedAt,
      rollback_executor_invoked: false,
      rollback_executable_now: false,
      verified: true,
      manual_steps: [],
    },
    human_review_gate: {
      schema_version: "human_review_gate.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      human_review_gate_id: "hrg_fixture",
      reviewer_id: "human_owner",
      execution_request_id: "erq_fixture",
      review_payload_sha256: ONE_HASH,
      reviewed_artifacts_hash: TWO_HASH,
      assigned_at: generatedAt,
      reviewed_at: null,
      can_approve_candidate: true,
      can_approve_mutation: false,
      can_approve_promotion: false,
      is_independent_reviewer: false,
      reviewer_independence_level: "single_owner_lower_trust",
      decision: "pending",
    },
    promotion_decision: {
      ...common,
      promotion_decision_id: "pd_fixture",
      execution_request_id: "erq_fixture",
      target_level: "L1",
      decided_by: "system.execution_schema_registry",
      promotion_payload_sha256: ONE_HASH,
      required_receipts_hash: TWO_HASH,
      promotion_allowed: false,
      deployment_allowed: false,
      production_allowed: false,
      protected_output_allowed: false,
      review_gate_ids: ["hrg_fixture"],
    },
    desktop_execution_projection: {
      schema_version: "desktop_execution_projection.v1",
      created_at: generatedAt,
      payload_sha256: ZERO_HASH,
      projection_id: "dep_fixture",
      execution_request_id: "erq_fixture",
      source_snapshot_id: "source_snapshot.fixture",
      projection_payload_sha256: ONE_HASH,
      source_bindings_hash: TWO_HASH,
      generated_at: generatedAt,
      desktop_can_execute: false,
      desktop_can_write: false,
      desktop_can_approve: false,
      ready: false,
      blockers: [{ blocker_id: "missing.execution_receipts", reason: "execution_not_open" }],
      source_bindings: {},
    },
  };
  const fixture = fixtures[schemaId];
  if (!fixture) throw new Error(`No fixture for schema ${schemaId}`);
  return fixture;
}

function buildExecutionSchemaBoundary(schemaRows, fixtureRows, negativeFixtureRows, generatedAt) {
  const validationReady = schemaRows.every((row) => row.validation.valid) &&
    fixtureRows.filter((row) => row.fixture_kind === "valid").every((row) => row.validation.valid) &&
    fixtureRows.filter((row) => row.fixture_kind !== "valid").every((row) => row.blocked) &&
    negativeFixtureRows.every((row) => row.blocked);
  return {
    schema_version: "execution-schema-boundary.v1",
    generated_at: generatedAt,
    validation_ready: validationReady,
    execution_schema_registry_ready: validationReady,
    execution_authority_opened_now: false,
    command_execution_allowed_now: false,
    file_write_allowed_now: false,
    network_allowed_now: false,
    package_install_allowed_now: false,
    secret_access_allowed_now: false,
    connector_write_allowed: false,
    deployment_allowed: false,
    production_allowed: false,
    protected_output_allowed: false,
    desktop_shell_execution_allowed: false,
    raw_secret_access_allowed: false,
    agent_final_pass_allowed: false,
    owner_approval_counts_as_independent_review: false,
  };
}

function buildSummary(result) {
  const validFixtures = result.execution_schema_fixture_rows.filter((row) => row.fixture_kind === "valid");
  const blockedFixtures = result.execution_schema_fixture_rows.filter((row) => row.fixture_kind !== "valid");
  const executionAuthorityOpened = FORBIDDEN_AUTHORITY_FLAGS.some((flag) => result.execution_schema_boundary[flag]);
  return {
    execution_schema_registry_status: result.validation.valid ? READY_STATUS : BLOCKED_STATUS,
    expected_schema_count: EXECUTION_SCHEMA_SPECS.length,
    schema_count: result.execution_schema_rows.length,
    valid_schema_count: result.execution_schema_rows.filter((row) => row.validation.valid).length,
    valid_fixture_count: validFixtures.length,
    valid_fixture_pass_count: validFixtures.filter((row) => row.validation.valid && !row.blocked).length,
    blocked_fixture_count: blockedFixtures.length,
    blocked_fixture_pass_count: blockedFixtures.filter((row) => row.blocked && !row.validation.valid).length,
    negative_fixture_count: result.execution_schema_negative_fixture_rows.length,
    negative_fixture_blocked_count: result.execution_schema_negative_fixture_rows.filter((row) => row.blocked && !row.validation.valid).length,
    execution_authority_opened_now: executionAuthorityOpened,
    validation_error_count: result.validation.errors.length,
  };
}

function renderMarkdown(result) {
  const rows = result.execution_schema_rows
    .map((row) => `| ${row.schema_id} | ${row.file_name} | ${row.validation.valid ? "PASS" : "FAIL"} | ${row.required_field_count} | ${row.forbidden_field_count} | ${row.invariant_count} |`)
    .join("\n");
  return [
    "# Execution Schema Registry",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.summary.execution_schema_registry_status}`,
    "",
    "| Schema | File | Validation | Required | Forbidden | Invariants |",
    "|---|---|---:|---:|---:|---:|",
    rows,
    "",
    "## Boundary",
    "",
    `Execution authority opened now: ${result.execution_schema_boundary.execution_authority_opened_now}`,
    `Production allowed: ${result.execution_schema_boundary.production_allowed}`,
    `Deployment allowed: ${result.execution_schema_boundary.deployment_allowed}`,
    `Desktop shell execution allowed: ${result.execution_schema_boundary.desktop_shell_execution_allowed}`,
    `Owner approval counts as independent review: ${result.execution_schema_boundary.owner_approval_counts_as_independent_review}`,
    "",
  ].join("\n");
}

function closedAuthoritySnapshot() {
  return {
    command_execution_allowed_now: false,
    file_write_allowed_now: false,
    network_allowed_now: false,
    package_install_allowed_now: false,
    secret_access_allowed_now: false,
    connector_write_allowed: false,
    deployment_allowed: false,
    production_allowed: false,
    protected_output_allowed: false,
    desktop_shell_execution_allowed: false,
    agent_final_pass_allowed: false,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.pass)
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function validationItem(id, pass, message, path = id) {
  return {
    id,
    path,
    pass: Boolean(pass),
    status: pass ? "pass" : "fail",
    message,
  };
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: rows.length, rows };
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run execution:schema -- [--check] [--out-dir <dir>] [--schema-dir <dir>] [--run-at <iso>]

Validates the execution schema registry and its valid, invalid, forbidden-field,
and semantic negative fixtures. This script never opens runtime authority.`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
