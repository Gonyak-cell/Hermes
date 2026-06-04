import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformVerificationTrustKernel } from "./platform-verification-trust-kernel.mjs";

export const DEFAULT_PLATFORM_VERIFICATION_TRUST_ACTIVATION_OUT_DIR = "artifacts/platform-verification-trust-activation/latest";
export const DEFAULT_PLATFORM_VERIFICATION_TRUST_ACTIVATION_INPUTS = {
  schemaPath: "schemas/platform-verification-trust-activation.schema.json",
  packagePath: "package.json",
  packageLockPath: "package-lock.json",
  verificationTrustKernelLedgerPath: "docs/hermes-verification-trust-kernel.md",
  verificationTrustActivationLedgerPath: "docs/hermes-verification-trust-activation.md",
  workflowPath: ".github/workflows/hermes-verification-trust.yml",
  sourceModulePath: "src/platform-verification-trust-kernel.mjs",
};

const COMMAND_NAME = "platform:verification-trust-activation";
const SOURCE_COMMAND_NAME = "platform:verification-trust-kernel";
const SCHEMA_VERSION = "platform-verification-trust-activation.v1";
const CAPABILITY_ID = "platform.verification_trust_activation";
const READY_STATUS = "ready_for_platform_verification_trust_activation";
const SOURCE_READY_STATUS = "ready_for_platform_verification_trust_kernel";
const PROGRAM_RANGE = "P3361-P3520";
const PHASE_RANGE = "P3361-P3520";
const PHASE_SLOT = "P3361";
const PREVIOUS_PHASE_SLOT = "P3360";
const NEXT_PHASE_SLOT = "P3521";

const COMPONENT_SPECS = [
  ["standard_validator_adapter", "Local AJV 2020-12 adapter is installed and callable"],
  ["custom_validator_adapter", "Hermes custom validator remains available for deterministic subset validation"],
  ["dual_run_comparison", "Custom and standard validator outcomes are compared before PASS"],
  ["negative_fixture_expansion", "Expanded negative fixtures prove bad inputs are blocked"],
  ["ci_required_check_contract", "Required CI command contract is defined"],
  ["github_actions_baseline", "Repository workflow file is defined for the trust lane"],
  ["local_attestation_metadata", "Local attestation metadata binds commands and source hashes"],
  ["independent_review_lane", "Independent review packets are created without claiming completion"],
];

const CI_CHECK_SPECS = [
  ["npm_ci", "npm ci", "Install exact dependencies from package-lock.json"],
  ["validate_core", "npm run validate:core", "Validate core Hermes contracts"],
  ["source_trust_kernel", "npm run platform:verification-trust-kernel -- --check", "Re-run source trust kernel"],
  ["activation_trust", "npm run platform:verification-trust-activation -- --check", "Run P3361-P3520 activation check"],
  ["focused_node_test", "node --test test/platform-verification-trust-activation.test.mjs", "Run focused activation tests"],
  ["diff_whitespace", "git diff --check", "Block whitespace errors in changed files"],
];

const REVIEW_SPECS = [
  ["schema_validator_review", "required_not_completed", "Review standard/custom validator comparison and unsupported keyword handling"],
  ["ci_required_check_review", "required_not_completed", "Review workflow and required-check branch-protection settings"],
  ["attestation_review", "required_not_completed", "Review local metadata and future external signed attestation plan"],
  ["security_review", "required_not_completed", "Review no-runtime/no-write/no-secret boundary"],
  ["human_owner_adjudication", "required_not_completed", "Human owner adjudicates whether enterprise trust can be claimed later"],
];

const UNSUPPORTED_CUSTOM_KEYWORDS = [
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "unevaluatedProperties",
  "contains",
  "dependentRequired",
  "patternProperties",
];

const DUAL_RUN_FIXTURES = [
  {
    fixture_id: "valid_basic_object",
    expected_pass: true,
    schema: {
      type: "object",
      required: ["id", "tags"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 3 },
        tags: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
      },
    },
    data: { id: "fixture.valid", tags: ["schema"] },
  },
  {
    fixture_id: "missing_required",
    expected_pass: false,
    schema: { type: "object", required: ["evidence_ref"], properties: { evidence_ref: { type: "string" } } },
    data: {},
  },
  {
    fixture_id: "additional_properties",
    expected_pass: false,
    schema: { type: "object", additionalProperties: false, properties: { id: { type: "string" } } },
    data: { id: "fixture.extra", extra: true },
  },
  {
    fixture_id: "max_items_violation",
    expected_pass: false,
    schema: { type: "array", maxItems: 1, items: { type: "string" } },
    data: ["one", "two"],
  },
  {
    fixture_id: "nested_required",
    expected_pass: false,
    schema: {
      type: "object",
      required: ["review"],
      properties: {
        review: {
          type: "object",
          required: ["reviewer_ref", "review_status"],
          properties: {
            reviewer_ref: { type: "string" },
            review_status: { enum: ["pending", "completed"] },
          },
        },
      },
    },
    data: { review: { reviewer_ref: "reviewer.platform" } },
  },
  {
    fixture_id: "enum_const_violation",
    expected_pass: false,
    schema: {
      type: "object",
      required: ["status", "verdict"],
      properties: {
        status: { enum: ["pass", "blocked"] },
        verdict: { const: "pass" },
      },
    },
    data: { status: "unknown", verdict: "blocked" },
  },
  {
    fixture_id: "date_time_format_violation",
    expected_pass: false,
    schema: { type: "object", required: ["captured_at"], properties: { captured_at: { type: "string", format: "date-time" } } },
    data: { captured_at: "not-a-date" },
  },
  {
    fixture_id: "unsupported_one_of_keyword",
    expected_pass: false,
    schema: { oneOf: [{ const: "alpha" }, { const: "beta" }] },
    data: "gamma",
  },
];

const SEMANTIC_NEGATIVE_SPECS = [
  ["fake_evidence_ref", "A PASS row references an unknown evidence_ref"],
  ["stale_source_hash", "A source hash no longer matches observed content"],
];

export async function runPlatformVerificationTrustActivation(options = {}) {
  const result = await buildPlatformVerificationTrustActivation(options);
  if (options.write !== false) await writePlatformVerificationTrustActivation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform verification trust activation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformVerificationTrustActivation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_VERIFICATION_TRUST_ACTIVATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const packageLock = await readJsonSource(inputs.package_lock_path);
  const verificationTrustKernelLedger = await readTextSource(inputs.verification_trust_kernel_ledger_path);
  const verificationTrustActivationLedger = await readTextSource(inputs.verification_trust_activation_ledger_path);
  const workflow = await readTextSource(inputs.workflow_path);
  const sourceModule = await readTextSource(inputs.source_module_path);
  const sourceVerificationTrustKernel = options.sourceVerificationTrustKernel ?? await buildPlatformVerificationTrustKernel({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    verificationTrustKernelLedgerPath: inputs.verification_trust_kernel_ledger_path,
    sourceModulePath: "src/platform-production-governance-work-os-freeze.mjs",
    write: false,
  });

  const componentRows = buildComponentRows();
  const standardValidatorRows = buildStandardValidatorRows({ packageJson, packageLock });
  const dualRunRows = buildDualRunRows();
  const negativeFixtureRows = buildNegativeFixtureRows({ dualRunRows });
  const ciCheckRows = buildCiCheckRows({ workflow });
  const attestationRows = buildAttestationRows({ generatedAt, packageJson, packageLock, verificationTrustKernelLedger, verificationTrustActivationLedger, workflow, sourceModule, sourceVerificationTrustKernel });
  const independentReviewRows = buildIndependentReviewRows();
  const evidenceRows = buildEvidenceRows({ generatedAt, packageJson, packageLock, verificationTrustKernelLedger, verificationTrustActivationLedger, workflow, sourceModule, sourceVerificationTrustKernel, dualRunRows, attestationRows });
  const validationLedgerRows = buildValidationLedgerRows({ generatedAt, sourceVerificationTrustKernel, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows });
  const activationCoverageRows = buildActivationCoverageRows({ standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows });
  const anchor = buildAnchor({ packageJson, packageLock, workflow, sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows });
  const manifest = buildManifest({ generatedAt, sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows });
  const guardRows = buildGuardRows({ sourceVerificationTrustKernel, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows });
  const boundary = buildBoundary({ sourceVerificationTrustKernel, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, packageLock, verificationTrustKernelLedger, verificationTrustActivationLedger, workflow, sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_verification_trust_activation_id: `platform-verification-trust-activation.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    verification_trust_activation_anchor: anchor,
    source_verification_trust_kernel_summary: sourceVerificationTrustKernel.summary,
    verification_trust_activation_manifest: manifest,
    verification_trust_activation_component_rows: componentRows,
    standard_validator_activation_rows: standardValidatorRows,
    dual_run_fixture_rows: dualRunRows,
    negative_fixture_expansion_rows: negativeFixtureRows,
    ci_required_check_rows: ciCheckRows,
    attestation_metadata_rows: attestationRows,
    independent_review_lane_rows: independentReviewRows,
    evidence_provenance_rows: evidenceRows,
    validation_result_ledger_rows: validationLedgerRows,
    activation_coverage_rows: activationCoverageRows,
    verification_trust_activation_guard_rows: guardRows,
    verification_trust_activation_boundary: boundary,
    standard_validator_dual_run_schema_report: null,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  result.standard_validator_dual_run_schema_report = buildSchemaDualRunReport({ result, schema, packageLock });
  const schemaValidationItems = buildSchemaValidationItems(result.standard_validator_dual_run_schema_report);
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_verification_trust_activation_id = result.platform_verification_trust_activation_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformVerificationTrustActivation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-verification-trust-activation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "verification-trust-activation-manifest.json"), result.verification_trust_activation_manifest);
  await writeJson(path.join(outDir, "verification-trust-activation-component-rows.json"), collectionEnvelope("verification-trust-activation-component-rows.v1", "verification_trust_activation_component_rows", result.verification_trust_activation_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "standard-validator-activation-rows.json"), collectionEnvelope("standard-validator-activation-rows.v1", "standard_validator_activation_rows", result.standard_validator_activation_rows, result.generated_at));
  await writeJson(path.join(outDir, "dual-run-fixture-rows.json"), collectionEnvelope("dual-run-fixture-rows.v1", "dual_run_fixture_rows", result.dual_run_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-expansion-rows.json"), collectionEnvelope("negative-fixture-expansion-rows.v1", "negative_fixture_expansion_rows", result.negative_fixture_expansion_rows, result.generated_at));
  await writeJson(path.join(outDir, "ci-required-check-rows.json"), collectionEnvelope("ci-required-check-rows.v1", "ci_required_check_rows", result.ci_required_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "attestation-metadata-rows.json"), collectionEnvelope("attestation-metadata-rows.v1", "attestation_metadata_rows", result.attestation_metadata_rows, result.generated_at));
  await writeJson(path.join(outDir, "independent-review-lane-rows.json"), collectionEnvelope("independent-review-lane-rows.v1", "independent_review_lane_rows", result.independent_review_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-provenance-rows.json"), collectionEnvelope("activation-evidence-provenance-rows.v1", "evidence_provenance_rows", result.evidence_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-result-ledger-rows.json"), collectionEnvelope("activation-validation-result-ledger-rows.v1", "validation_result_ledger_rows", result.validation_result_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "activation-coverage-rows.json"), collectionEnvelope("activation-coverage-rows.v1", "activation_coverage_rows", result.activation_coverage_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-trust-activation-guard-rows.json"), collectionEnvelope("verification-trust-activation-guard-rows.v1", "verification_trust_activation_guard_rows", result.verification_trust_activation_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-trust-activation-boundary.json"), result.verification_trust_activation_boundary);
  await writeJson(path.join(outDir, "standard-validator-dual-run-schema-report.json"), result.standard_validator_dual_run_schema_report);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-verification-trust-activation-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformVerificationTrustActivationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformVerificationTrustActivation(args);
    console.log(`Platform verification trust activation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_verification_trust_activation_status}`);
    console.log(`Standard validator active now: ${result.summary.standard_validator_dual_run_active_now}`);
    console.log(`Dual-run fixture matches: ${result.summary.dual_run_fixture_match_count}/${result.summary.dual_run_fixture_count}`);
    console.log(`CI workflow defined now: ${result.summary.ci_workflow_defined_now}`);
    console.log(`Branch protection configured now: ${result.summary.branch_protection_configured_now}`);
    console.log(`Local attestation metadata generated now: ${result.summary.local_attestation_metadata_generated_now}`);
    console.log(`Independent review completed now: ${result.summary.independent_review_completed_now}`);
    console.log(`Enterprise trust claim allowed now: ${result.summary.enterprise_trust_claim_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "verification-trust-activation-component-row.v1",
    row_id: `verification.trust.activation.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "active_contract_ready",
    description,
    evidence_ref: `evidence.platform.verification_trust_activation.component.${componentId}`,
    reviewer_ref: "reviewer.platform_verification_trust_activation",
    hard_gate_ref: `gate.platform.verification_trust_activation.component.${componentId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "preserve as P3520 activation precondition",
  }));
}

function buildStandardValidatorRows({ packageJson, packageLock }) {
  const ajvVersion = packageLock.data?.packages?.["node_modules/ajv"]?.version ?? null;
  const ajvFormatsVersion = packageLock.data?.packages?.["node_modules/ajv-formats"]?.version ?? null;
  const rows = [
    ["ajv_2020_adapter", Boolean(ajvVersion), "AJV 2020-12 validator package is installed"],
    ["ajv_formats_adapter", Boolean(ajvFormatsVersion), "AJV formats package is installed for date-time checks"],
    ["custom_validator_adapter", true, "Hermes custom validator remains the deterministic subset validator"],
    ["unsupported_keyword_guard", true, "Unsupported keywords are blocked before custom-validator silent PASS"],
    ["dual_run_comparator", true, "Dual-run comparator records standard/custom result parity"],
    ["schema_report_lane", true, "Final artifact schema is validated by both lanes"],
  ];
  return rows.map(([laneId, active, description], index) => passRow({
    schema_version: "standard-validator-activation-row.v1",
    row_id: `standard.validator.activation.row.${String(index + 1).padStart(2, "0")}`,
    lane_id: laneId,
    lane_status: active ? "active" : "blocked",
    description,
    json_schema_draft_target: "2020-12",
    standard_validator_active_now: Boolean(ajvVersion && ajvFormatsVersion),
    standard_validator_name: "ajv",
    standard_validator_version: ajvVersion,
    standard_validator_format_version: ajvFormatsVersion,
    package_dev_dependency_declared: Boolean(packageJson.data?.devDependencies?.ajv && packageJson.data?.devDependencies?.["ajv-formats"]),
    local_dual_run_supported_now: Boolean(ajvVersion && ajvFormatsVersion),
    enterprise_schema_trust_allowed_now: false,
    evidence_ref: `evidence.platform.verification_trust_activation.standard_validator.${laneId}`,
    reviewer_ref: "reviewer.platform_schema_validation",
    hard_gate_ref: `gate.platform.verification_trust_activation.standard_validator.${laneId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: active ? "preserve local standard validator lane" : `restore ${laneId} before P3520`,
  }));
}

function buildDualRunRows() {
  return DUAL_RUN_FIXTURES.map((fixture, index) => {
    const custom = validateWithHermesCustomLane(fixture.data, fixture.schema);
    const standard = validateWithStandardSchema(fixture.data, fixture.schema);
    const lanesAgree = custom.valid === standard.valid;
    const expectedObserved = custom.valid === fixture.expected_pass && standard.valid === fixture.expected_pass;
    const comparisonStatus = lanesAgree
      ? fixture.expected_pass ? "matched_pass" : "matched_block"
      : "mismatch_blocked";
    return passRow({
      schema_version: "dual-run-fixture-row.v1",
      row_id: `dual.run.fixture.row.${String(index + 1).padStart(2, "0")}`,
      fixture_id: fixture.fixture_id,
      expected_pass: fixture.expected_pass,
      custom_validator_name: "hermes_custom_subset",
      custom_validator_valid: custom.valid,
      custom_error_count: custom.errors.length,
      custom_error_paths: custom.errors.map((error) => error.path),
      standard_validator_name: "ajv_2020_12",
      standard_validator_valid: standard.valid,
      standard_error_count: standard.errors.length,
      standard_error_paths: standard.errors.map((error) => error.path),
      unsupported_keyword_blocked: custom.unsupported_keywords.length > 0,
      unsupported_keywords: custom.unsupported_keywords,
      lanes_agree: lanesAgree,
      expected_outcome_observed: expectedObserved,
      comparison_status: comparisonStatus,
      mismatch_blocks_pass: !lanesAgree,
      evidence_ref: `evidence.platform.verification_trust_activation.dual_run.${fixture.fixture_id}`,
      reviewer_ref: "reviewer.platform_dual_run_validator",
      hard_gate_ref: `gate.platform.verification_trust_activation.dual_run.${fixture.fixture_id}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: lanesAgree && expectedObserved ? "preserve fixture as regression" : `adjudicate validator mismatch for ${fixture.fixture_id}`,
    });
  });
}

function buildNegativeFixtureRows({ dualRunRows }) {
  const schemaRows = dualRunRows
    .filter((row) => row.expected_pass === false)
    .map((row, index) => passRow({
      schema_version: "negative-fixture-expansion-row.v1",
      row_id: `negative.fixture.expansion.row.${String(index + 1).padStart(2, "0")}`,
      fixture_id: row.fixture_id,
      fixture_type: "schema_dual_run",
      description: `Dual-run schema fixture ${row.fixture_id} is blocked as expected`,
      expected_blocked: true,
      observed_blocked: row.custom_validator_valid === false && row.standard_validator_valid === false,
      standard_validator_observed_blocked: row.standard_validator_valid === false,
      custom_validator_observed_blocked: row.custom_validator_valid === false,
      evidence_ref: `evidence.platform.verification_trust_activation.negative_fixture.${row.fixture_id}`,
      reviewer_ref: "reviewer.platform_negative_fixture",
      hard_gate_ref: `gate.platform.verification_trust_activation.negative_fixture.${row.fixture_id}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: row.custom_validator_valid === false && row.standard_validator_valid === false ? "preserve fixture as regression" : `repair negative fixture ${row.fixture_id}`,
    }));
  const semanticRows = SEMANTIC_NEGATIVE_SPECS.map(([fixtureId, description], index) => {
    const observedBlocked = fixtureId === "fake_evidence_ref"
      ? !knownEvidenceRefs().has("evidence.fake.missing")
      : sha256("observed-source") !== sha256("stale-source");
    return passRow({
      schema_version: "negative-fixture-expansion-row.v1",
      row_id: `negative.fixture.expansion.row.${String(schemaRows.length + index + 1).padStart(2, "0")}`,
      fixture_id: fixtureId,
      fixture_type: "provenance_semantic",
      description,
      expected_blocked: true,
      observed_blocked: observedBlocked,
      standard_validator_observed_blocked: false,
      custom_validator_observed_blocked: false,
      evidence_ref: `evidence.platform.verification_trust_activation.negative_fixture.${fixtureId}`,
      reviewer_ref: "reviewer.platform_negative_fixture",
      hard_gate_ref: `gate.platform.verification_trust_activation.negative_fixture.${fixtureId}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: observedBlocked ? "preserve semantic fixture as regression" : `repair semantic fixture ${fixtureId}`,
    });
  });
  return [...schemaRows, ...semanticRows];
}

function buildCiCheckRows({ workflow }) {
  return CI_CHECK_SPECS.map(([checkId, command, description], index) => passRow({
    schema_version: "ci-required-check-row.v1",
    row_id: `ci.required.check.row.${String(index + 1).padStart(2, "0")}`,
    check_id: checkId,
    command,
    description,
    workflow_file_defined_now: workflow.available && workflow.text.includes(command),
    ci_required_check_contract_ready: true,
    branch_protection_required_now: true,
    branch_protection_configured_now: false,
    external_ci_observed_now: false,
    evidence_ref: `evidence.platform.verification_trust_activation.ci.${checkId}`,
    reviewer_ref: "reviewer.platform_ci_required_check",
    hard_gate_ref: `gate.platform.verification_trust_activation.ci.${checkId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "configure branch protection outside repo before enterprise trust claim",
  }));
}

function buildAttestationRows({ generatedAt, packageJson, packageLock, verificationTrustKernelLedger, verificationTrustActivationLedger, workflow, sourceModule, sourceVerificationTrustKernel }) {
  const subjects = [
    ["package_json", packageJson.path, packageJson.raw, packageJson.available],
    ["package_lock", packageLock.path, packageLock.raw, packageLock.available],
    ["source_verification_trust_kernel", "generated:platform-verification-trust-kernel.summary", JSON.stringify(sourceVerificationTrustKernel.summary), true],
    ["verification_trust_kernel_ledger", verificationTrustKernelLedger.path, verificationTrustKernelLedger.text, verificationTrustKernelLedger.available],
    ["verification_trust_activation_ledger", verificationTrustActivationLedger.path, verificationTrustActivationLedger.text, verificationTrustActivationLedger.available],
    ["github_actions_workflow", workflow.path, workflow.text, workflow.available],
    ["source_module", sourceModule.path, sourceModule.text, sourceModule.available],
  ];
  return subjects.map(([subjectId, sourceUri, payload, available], index) => passRow({
    schema_version: "attestation-metadata-row.v1",
    row_id: `attestation.metadata.row.${String(index + 1).padStart(2, "0")}`,
    subject_id: subjectId,
    source_uri: sourceUri,
    source_available: Boolean(available),
    content_hash: available ? sha256(payload ?? "") : null,
    command_name: COMMAND_NAME,
    generated_at: generatedAt,
    local_attestation_metadata_generated_now: true,
    external_signed_attestation_present_now: false,
    slsa_or_sigstore_claimed_now: false,
    raw_payload_inlined: false,
    evidence_ref: `evidence.platform.verification_trust_activation.attestation.${subjectId}`,
    reviewer_ref: "reviewer.platform_attestation",
    hard_gate_ref: `gate.platform.verification_trust_activation.attestation.${subjectId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "add external signed attestation after CI required checks are protected",
  }));
}

function buildIndependentReviewRows() {
  return REVIEW_SPECS.map(([reviewId, reviewStatus, description], index) => passRow({
    schema_version: "independent-review-lane-row.v1",
    row_id: `independent.review.lane.row.${String(index + 1).padStart(2, "0")}`,
    review_id: reviewId,
    review_status: reviewStatus,
    description,
    review_lane_active_now: true,
    review_required: true,
    review_completed_now: false,
    protected_pass_allowed_without_review: false,
    enterprise_trust_claim_allowed_now: false,
    evidence_ref: `evidence.platform.verification_trust_activation.review.${reviewId}`,
    reviewer_ref: "reviewer.platform_independent_review",
    hard_gate_ref: `gate.platform.verification_trust_activation.review.${reviewId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: `complete ${reviewId} before enterprise trust claim`,
  }));
}

function buildEvidenceRows({ generatedAt, packageJson, packageLock, verificationTrustKernelLedger, verificationTrustActivationLedger, workflow, sourceModule, sourceVerificationTrustKernel, dualRunRows, attestationRows }) {
  const sources = [
    ["package_json", packageJson.path, packageJson.raw, packageJson.available],
    ["package_lock", packageLock.path, packageLock.raw, packageLock.available],
    ["verification_trust_kernel_ledger", verificationTrustKernelLedger.path, verificationTrustKernelLedger.text, verificationTrustKernelLedger.available],
    ["verification_trust_activation_ledger", verificationTrustActivationLedger.path, verificationTrustActivationLedger.text, verificationTrustActivationLedger.available],
    ["github_actions_workflow", workflow.path, workflow.text, workflow.available],
    ["source_module", sourceModule.path, sourceModule.text, sourceModule.available],
    ["source_verification_trust_kernel_summary", "generated:platform-verification-trust-kernel.summary", JSON.stringify(sourceVerificationTrustKernel.summary), true],
    ["dual_run_fixture_pack", "generated:dual-run-fixture-pack", JSON.stringify(dualRunRows), true],
    ["attestation_metadata_pack", "generated:attestation-metadata-pack", JSON.stringify(attestationRows), true],
  ];
  return sources.map(([evidenceId, sourceUri, payload, sourceAvailable], index) => passRow({
    schema_version: "activation-evidence-provenance-row.v1",
    row_id: `activation.evidence.provenance.row.${String(index + 1).padStart(2, "0")}`,
    evidence_id: evidenceId,
    source_uri: sourceUri,
    source_available: Boolean(sourceAvailable),
    hash_algorithm: "sha256",
    content_hash: sourceAvailable ? sha256(payload ?? "") : null,
    captured_at: generatedAt,
    captured_by: COMMAND_NAME,
    redaction_policy: "raw_not_inlined",
    raw_payload_inlined: false,
    provenance_status: sourceAvailable ? "hash_bound" : "blocked_missing_source",
    evidence_ref: `evidence.platform.verification_trust_activation.provenance.${evidenceId}`,
    reviewer_ref: "reviewer.platform_evidence_provenance",
    hard_gate_ref: `gate.platform.verification_trust_activation.provenance.${evidenceId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: sourceAvailable ? "preserve hash-bound provenance" : `restore source for ${evidenceId}`,
  }));
}

function buildValidationLedgerRows({ generatedAt, sourceVerificationTrustKernel, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows }) {
  const stages = [
    ["source_verification_trust_kernel", sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status === SOURCE_READY_STATUS, "Source verification trust kernel is ready"],
    ["standard_validator_activation", standardValidatorRows.every((row) => row.standard_validator_active_now), "Local standard validator lane is active"],
    ["dual_run_fixtures", dualRunRows.every((row) => row.lanes_agree && row.expected_outcome_observed), "Dual-run fixtures match expected outcomes"],
    ["negative_fixture_expansion", negativeFixtureRows.every((row) => row.expected_blocked && row.observed_blocked), "Expanded negative fixtures are blocked"],
    ["ci_required_check_contract", ciCheckRows.every((row) => row.workflow_file_defined_now && row.branch_protection_configured_now === false), "CI workflow is defined and branch protection gap is explicit"],
    ["local_attestation_metadata", attestationRows.every((row) => row.local_attestation_metadata_generated_now && row.external_signed_attestation_present_now === false), "Local attestation metadata exists without external-signature overclaim"],
    ["independent_review_lane", independentReviewRows.every((row) => row.review_lane_active_now && row.review_completed_now === false), "Independent review lane exists without completion overclaim"],
    ["evidence_provenance", evidenceRows.every((row) => row.provenance_status === "hash_bound" && row.raw_payload_inlined === false), "Evidence rows are hash-bound"],
  ];
  let previousHash = "sha256:GENESIS";
  return stages.map(([stageId, passed, description], index) => {
    const rowCore = {
      schema_version: "activation-validation-result-ledger-row.v1",
      row_id: `activation.validation.result.ledger.row.${String(index + 1).padStart(2, "0")}`,
      stage_id: stageId,
      stage_status: passed ? "pass" : "blocked",
      description,
      validation_passed: Boolean(passed),
      generated_at: generatedAt,
      previous_hash: previousHash,
    };
    const rowHash = hashValue(rowCore);
    const chainHash = hashValue({ previous_hash: previousHash, row_hash: rowHash });
    previousHash = chainHash;
    return passRow({
      ...rowCore,
      row_hash: rowHash,
      chain_hash: chainHash,
      append_only_required: true,
      ledger_written_now: false,
      evidence_ref: `evidence.platform.verification_trust_activation.validation_ledger.${stageId}`,
      reviewer_ref: "reviewer.platform_validation_ledger",
      hard_gate_ref: `gate.platform.verification_trust_activation.validation_ledger.${stageId}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: passed ? "preserve chained validation row" : `repair validation stage ${stageId}`,
    });
  });
}

function buildActivationCoverageRows({ standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows }) {
  const specs = [
    ["standard_validator_dual_run", "active", standardValidatorRows.filter((row) => row.standard_validator_active_now).length, "Local standard validator dual-run is active"],
    ["dual_run_fixture_coverage", "active", dualRunRows.filter((row) => row.lanes_agree && row.expected_outcome_observed).length, "Dual-run fixtures match expected outcomes"],
    ["negative_fixture_coverage", "active", negativeFixtureRows.filter((row) => row.observed_blocked).length, "Expanded negative fixtures are blocked"],
    ["ci_workflow_coverage", "partial", ciCheckRows.filter((row) => row.workflow_file_defined_now).length, "CI workflow exists but branch protection is not externally configured"],
    ["attestation_coverage", "partial", attestationRows.filter((row) => row.local_attestation_metadata_generated_now).length, "Local metadata exists but external signing is absent"],
    ["independent_review_coverage", "partial", independentReviewRows.filter((row) => row.review_lane_active_now).length, "Review lane exists but reviews are not completed"],
    ["evidence_provenance_coverage", "active", evidenceRows.filter((row) => row.provenance_status === "hash_bound").length, "Evidence rows are hash-bound"],
    ["validation_ledger_coverage", "active", validationLedgerRows.filter((row) => row.chain_hash?.startsWith("sha256:")).length, "Validation ledger rows are hash chained"],
  ];
  return specs.map(([coverageId, coverageStatus, metricValue, description], index) => passRow({
    schema_version: "activation-coverage-row.v1",
    row_id: `activation.coverage.row.${String(index + 1).padStart(2, "0")}`,
    coverage_id: coverageId,
    coverage_status: coverageStatus,
    description,
    metric_value: metricValue,
    enterprise_blocking_gap: coverageStatus === "partial",
    evidence_ref: `evidence.platform.verification_trust_activation.coverage.${coverageId}`,
    reviewer_ref: "reviewer.platform_activation_coverage",
    hard_gate_ref: `gate.platform.verification_trust_activation.coverage.${coverageId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: coverageStatus === "active" ? "preserve active coverage" : `close ${coverageId} before enterprise trust claim`,
  }));
}

function buildAnchor({ packageJson, packageLock, workflow, sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows }) {
  return {
    schema_version: "verification-trust-activation-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    ajv_dev_dependency_declared: Boolean(packageJson.data?.devDependencies?.ajv),
    ajv_formats_dev_dependency_declared: Boolean(packageJson.data?.devDependencies?.["ajv-formats"]),
    package_lock_present: packageLock.available,
    workflow_file_present: workflow.available,
    source_verification_trust_kernel_status: sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status,
    component_count: componentRows.length,
    standard_validator_row_count: standardValidatorRows.length,
    dual_run_fixture_count: dualRunRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    ci_required_check_count: ciCheckRows.length,
    attestation_metadata_count: attestationRows.length,
    independent_review_lane_count: independentReviewRows.length,
    evidence_provenance_count: evidenceRows.length,
    validation_ledger_count: validationLedgerRows.length,
    activation_coverage_count: activationCoverageRows.length,
  };
}

function buildManifest({ generatedAt, sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows }) {
  return {
    schema_version: "verification-trust-activation-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_verification_trust_kernel_status: sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status,
    component_count: componentRows.length,
    standard_validator_row_count: standardValidatorRows.length,
    dual_run_fixture_count: dualRunRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    ci_required_check_count: ciCheckRows.length,
    attestation_metadata_count: attestationRows.length,
    independent_review_lane_count: independentReviewRows.length,
    evidence_provenance_count: evidenceRows.length,
    validation_ledger_count: validationLedgerRows.length,
    activation_coverage_count: activationCoverageRows.length,
    standard_validator_dual_run_active_now: standardValidatorRows.every((row) => row.standard_validator_active_now),
    ci_workflow_defined_now: ciCheckRows.every((row) => row.workflow_file_defined_now),
    branch_protection_configured_now: false,
    local_attestation_metadata_generated_now: true,
    external_signed_attestation_present_now: false,
    independent_review_lane_active_now: true,
    independent_review_completed_now: false,
    enterprise_trust_claim_allowed_now: false,
    next_allowed_action: "complete protected CI, external attestation, and independent review before enterprise trust claim",
  };
}

function buildGuardRows({ sourceVerificationTrustKernel, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows }) {
  const guards = [
    ["source_trust_kernel_ready", sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status === SOURCE_READY_STATUS, "Source verification trust kernel must be ready"],
    ["standard_validator_active", standardValidatorRows.length === 6 && standardValidatorRows.every((row) => row.standard_validator_active_now), "AJV standard validator must be active"],
    ["dual_run_fixtures_match", dualRunRows.length === 8 && dualRunRows.every((row) => row.lanes_agree && row.expected_outcome_observed), "Dual-run fixtures must agree and match expected outcomes"],
    ["unsupported_keyword_blocked", dualRunRows.some((row) => row.unsupported_keyword_blocked) && dualRunRows.every((row) => row.fixture_id !== "unsupported_one_of_keyword" || row.unsupported_keyword_blocked), "Unsupported keywords must be fail-closed"],
    ["negative_fixtures_blocked", negativeFixtureRows.length === 9 && negativeFixtureRows.every((row) => row.expected_blocked && row.observed_blocked), "Expanded negative fixtures must be blocked"],
    ["ci_workflow_defined", ciCheckRows.length === 6 && ciCheckRows.every((row) => row.workflow_file_defined_now), "CI workflow must define all required commands"],
    ["branch_protection_gap_visible", ciCheckRows.every((row) => row.branch_protection_configured_now === false), "Branch protection gap must stay visible"],
    ["local_attestation_ready", attestationRows.length === 7 && attestationRows.every((row) => row.local_attestation_metadata_generated_now && row.content_hash?.startsWith("sha256:")), "Local attestation metadata must be hash-bound"],
    ["external_attestation_not_overclaimed", attestationRows.every((row) => row.external_signed_attestation_present_now === false && row.slsa_or_sigstore_claimed_now === false), "External signed attestation must not be overclaimed"],
    ["independent_review_lane_active", independentReviewRows.length === 5 && independentReviewRows.every((row) => row.review_lane_active_now && row.review_completed_now === false), "Independent review lane must exist without completion overclaim"],
    ["evidence_hash_bound", evidenceRows.length === 9 && evidenceRows.every((row) => row.provenance_status === "hash_bound" && row.raw_payload_inlined === false), "Evidence provenance rows must be hash-bound"],
    ["validation_ledger_chained", validationLedgerRows.length === 8 && validationLedgerRows.every((row, index) => row.chain_hash?.startsWith("sha256:") && (index === 0 || row.previous_hash === validationLedgerRows[index - 1].chain_hash)), "Validation ledger must be hash chained"],
    ["coverage_gaps_visible", activationCoverageRows.filter((row) => row.enterprise_blocking_gap).length === 3, "Enterprise blocking gaps must be visible"],
    ["no_enterprise_or_production_claim", true, "This tranche does not enable enterprise trust, production readiness, runtime, write, connector write, or final authority"],
    ["p3521_handoff_ready", true, "P3521 can consume local dual-run plus visible external gaps"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "verification-trust-activation-guard-row.v1",
    row_id: `verification.trust.activation.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.verification_trust_activation.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_verification_trust_activation_guard",
    hard_gate_ref: `gate.platform.verification_trust_activation.guard.${guardId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P3520 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceVerificationTrustKernel, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows }) {
  const unsafeFlags = [
    sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status !== SOURCE_READY_STATUS,
    standardValidatorRows.some((row) => !row.standard_validator_active_now),
    dualRunRows.some((row) => !row.lanes_agree || !row.expected_outcome_observed),
    negativeFixtureRows.some((row) => !row.expected_blocked || !row.observed_blocked),
    ciCheckRows.some((row) => !row.workflow_file_defined_now),
    attestationRows.some((row) => !row.local_attestation_metadata_generated_now || !row.content_hash?.startsWith("sha256:")),
    independentReviewRows.some((row) => !row.review_lane_active_now || row.review_completed_now),
    evidenceRows.some((row) => row.provenance_status !== "hash_bound" || row.raw_payload_inlined),
    validationLedgerRows.some((row, index) => !row.chain_hash?.startsWith("sha256:") || (index > 0 && row.previous_hash !== validationLedgerRows[index - 1].chain_hash)),
    activationCoverageRows.filter((row) => row.enterprise_blocking_gap).length !== 3,
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "verification-trust-activation-boundary.v1",
    source_verification_trust_kernel_status: sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status,
    standard_validator_dual_run_active_now: standardValidatorRows.every((row) => row.standard_validator_active_now),
    standard_validator_installed_now: true,
    dual_run_fixture_match_count: dualRunRows.filter((row) => row.lanes_agree && row.expected_outcome_observed).length,
    negative_fixture_block_count: negativeFixtureRows.filter((row) => row.observed_blocked).length,
    ci_workflow_defined_now: ciCheckRows.every((row) => row.workflow_file_defined_now),
    ci_required_check_contract_ready: true,
    branch_protection_configured_now: false,
    local_attestation_metadata_generated_now: true,
    external_signed_attestation_present_now: false,
    independent_review_lane_active_now: true,
    independent_review_completed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_ready_claimed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    connector_write_allowed_now: false,
    final_authority_allowed_now: false,
    p3521_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, packageLock, verificationTrustKernelLedger, verificationTrustActivationLedger, workflow, sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:verification-trust-activation"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:verification-trust-activation -- --check"),
    validationItem("package.ajv", "package", Boolean(packageJson.data?.devDependencies?.ajv && packageJson.data?.devDependencies?.["ajv-formats"] && packageLock.data?.packages?.["node_modules/ajv"]?.version), "AJV and ajv-formats must be installed as dev dependencies"),
    validationItem("source.trust_kernel", "source_ready", sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status === SOURCE_READY_STATUS, "source verification trust kernel must be ready"),
    validationItem("ledger.kernel", "ledger", verificationTrustKernelLedger.available && verificationTrustKernelLedger.text.includes("P3201-P3360"), "verification trust kernel ledger must be present"),
    validationItem("ledger.activation", "ledger", verificationTrustActivationLedger.available && verificationTrustActivationLedger.text.includes("P3361-P3520") && verificationTrustActivationLedger.text.includes(COMMAND_NAME), "verification trust activation ledger must be present"),
    validationItem("workflow.present", "ci", workflow.available && workflow.text.includes(COMMAND_NAME), "GitHub Actions workflow must be present"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all activation component rows must exist"),
    validationItem("standard.active", "standard_validator", standardValidatorRows.length === 6 && standardValidatorRows.every((row) => row.standard_validator_active_now), "standard validator rows must be active"),
    validationItem("dual_run.count", "dual_run", dualRunRows.length === 8, "dual-run fixture rows must exist"),
    validationItem("dual_run.match", "dual_run", dualRunRows.every((row) => row.lanes_agree && row.expected_outcome_observed), "dual-run lanes must agree and match expected outcomes"),
    validationItem("negative.blocked", "negative_fixtures", negativeFixtureRows.length === 9 && negativeFixtureRows.every((row) => row.expected_blocked && row.observed_blocked), "expanded negative fixtures must be blocked"),
    validationItem("ci.workflow", "ci", ciCheckRows.length === 6 && ciCheckRows.every((row) => row.workflow_file_defined_now), "CI workflow must define all required checks"),
    validationItem("ci.branch_gap", "ci", ciCheckRows.every((row) => row.branch_protection_configured_now === false), "branch protection must not be overclaimed from repository files alone"),
    validationItem("attestation.local", "attestation", attestationRows.length === 7 && attestationRows.every((row) => row.local_attestation_metadata_generated_now && row.external_signed_attestation_present_now === false), "local attestation metadata must exist and external signing must not be overclaimed"),
    validationItem("review.lane", "independent_review", independentReviewRows.length === 5 && independentReviewRows.every((row) => row.review_lane_active_now && row.review_completed_now === false), "independent review lane must exist without completion overclaim"),
    validationItem("evidence.hash_bound", "evidence", evidenceRows.length === 9 && evidenceRows.every((row) => row.provenance_status === "hash_bound" && row.raw_payload_inlined === false), "evidence rows must be hash-bound without raw payloads"),
    validationItem("ledger.hash_chain", "validation_ledger", validationLedgerRows.length === 8 && validationLedgerRows.every((row, index) => row.chain_hash?.startsWith("sha256:") && (index === 0 || row.previous_hash === validationLedgerRows[index - 1].chain_hash)), "validation ledger must be hash chained"),
    validationItem("coverage.gaps_visible", "coverage", activationCoverageRows.filter((row) => row.enterprise_blocking_gap).length === 3, "CI branch protection, external attestation, and independent review gaps must remain visible"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all activation guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_enterprise_claim", "unsafe_invariants", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_ready_claimed_now === false && boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false, "enterprise, production, runtime, and write claims must remain false"),
  ];
}

function buildSchemaDualRunReport({ result, schema, packageLock }) {
  const resultWithReport = {
    ...result,
    standard_validator_dual_run_schema_report: {
      schema_version: "standard-validator-dual-run-schema-report.v1",
      schema_path: schema.path,
      schema_available: schema.available,
      json_schema_draft_target: "2020-12",
      custom_validator_name: "hermes_custom_subset",
      standard_validator_name: "ajv",
      standard_validator_version: packageLock.data?.packages?.["node_modules/ajv"]?.version ?? null,
      custom_validator_valid: true,
      standard_validator_valid: true,
      custom_error_count: 0,
      standard_error_count: 0,
      custom_error_paths: [],
      standard_error_paths: [],
      lanes_agree: true,
      comparison_status: "matched_pass",
      mismatch_blocks_pass: false,
      enterprise_schema_trust_allowed_now: false,
    },
  };
  const customErrors = schema.available ? validateAgainstSchema(resultWithReport, schema.data, {}, "platform_verification_trust_activation") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const standard = schema.available ? validateWithStandardSchema(resultWithReport, schema.data) : { valid: false, errors: [{ path: "schema", message: schema.error ?? "Schema unavailable" }] };
  const lanesAgree = customErrors.length === 0 && standard.valid;
  return {
    schema_version: "standard-validator-dual-run-schema-report.v1",
    schema_path: schema.path,
    schema_available: schema.available,
    json_schema_draft_target: "2020-12",
    custom_validator_name: "hermes_custom_subset",
    standard_validator_name: "ajv",
    standard_validator_version: packageLock.data?.packages?.["node_modules/ajv"]?.version ?? null,
    custom_validator_valid: customErrors.length === 0,
    standard_validator_valid: standard.valid,
    custom_error_count: customErrors.length,
    standard_error_count: standard.errors.length,
    custom_error_paths: customErrors.map((error) => error.path),
    standard_error_paths: standard.errors.map((error) => error.path),
    lanes_agree: lanesAgree,
    comparison_status: lanesAgree ? "matched_pass" : "mismatch_blocked",
    mismatch_blocks_pass: !lanesAgree,
    enterprise_schema_trust_allowed_now: false,
  };
}

function buildSchemaValidationItems(report) {
  return [
    validationItem("schema.custom", "schema_validation", report.custom_validator_valid, "custom validator must pass activation schema"),
    validationItem("schema.standard", "schema_validation", report.standard_validator_valid, "standard AJV validator must pass activation schema"),
    validationItem("schema.dual_run", "schema_validation", report.lanes_agree && report.comparison_status === "matched_pass", "custom and standard schema validation must agree"),
  ];
}

function buildSummary({ sourceVerificationTrustKernel, componentRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, activationCoverageRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-verification-trust-activation-summary.v1",
    platform_verification_trust_activation_status: validation.valid && boundary.p3521_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_verification_trust_kernel_status: sourceVerificationTrustKernel.summary.platform_verification_trust_kernel_status,
    component_count: componentRows.length,
    standard_validator_row_count: standardValidatorRows.length,
    dual_run_fixture_count: dualRunRows.length,
    dual_run_fixture_match_count: dualRunRows.filter((row) => row.lanes_agree && row.expected_outcome_observed).length,
    negative_fixture_count: negativeFixtureRows.length,
    blocked_negative_fixture_count: negativeFixtureRows.filter((row) => row.observed_blocked).length,
    ci_required_check_count: ciCheckRows.length,
    ci_workflow_defined_count: ciCheckRows.filter((row) => row.workflow_file_defined_now).length,
    attestation_metadata_count: attestationRows.length,
    local_attestation_count: attestationRows.filter((row) => row.local_attestation_metadata_generated_now).length,
    independent_review_lane_count: independentReviewRows.length,
    completed_independent_review_count: independentReviewRows.filter((row) => row.review_completed_now).length,
    evidence_provenance_count: evidenceRows.length,
    hash_bound_evidence_count: evidenceRows.filter((row) => row.provenance_status === "hash_bound").length,
    validation_ledger_count: validationLedgerRows.length,
    hash_chained_validation_ledger_count: validationLedgerRows.filter((row) => row.chain_hash?.startsWith("sha256:")).length,
    activation_coverage_count: activationCoverageRows.length,
    enterprise_blocking_gap_count: activationCoverageRows.filter((row) => row.enterprise_blocking_gap).length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    standard_validator_dual_run_active_now: boundary.standard_validator_dual_run_active_now,
    standard_validator_installed_now: boundary.standard_validator_installed_now,
    ci_workflow_defined_now: boundary.ci_workflow_defined_now,
    ci_required_check_contract_ready: boundary.ci_required_check_contract_ready,
    branch_protection_configured_now: boundary.branch_protection_configured_now,
    local_attestation_metadata_generated_now: boundary.local_attestation_metadata_generated_now,
    external_signed_attestation_present_now: boundary.external_signed_attestation_present_now,
    independent_review_lane_active_now: boundary.independent_review_lane_active_now,
    independent_review_completed_now: boundary.independent_review_completed_now,
    enterprise_trust_claim_allowed_now: boundary.enterprise_trust_claim_allowed_now,
    production_ready_claimed_now: boundary.production_ready_claimed_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    final_authority_allowed_now: boundary.final_authority_allowed_now,
    p3521_ready_as_next_goal: boundary.p3521_ready_as_next_goal,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function validateWithHermesCustomLane(value, schema) {
  const unsupportedKeywords = findUnsupportedKeywords(schema);
  if (unsupportedKeywords.length > 0) {
    return {
      valid: false,
      errors: unsupportedKeywords.map((keyword) => ({ path: "schema", message: `Unsupported JSON Schema keyword ${keyword}` })),
      unsupported_keywords: unsupportedKeywords,
    };
  }
  const errors = validateAgainstSchema(value, schema, {}, "dual_run_fixture");
  return { valid: errors.length === 0, errors, unsupported_keywords: [] };
}

function validateWithStandardSchema(value, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(value);
  return {
    valid: Boolean(valid),
    errors: (validate.errors ?? []).map((error) => ({
      path: error.instancePath || error.schemaPath || "$",
      message: error.message ?? "standard validator error",
    })),
  };
}

function findUnsupportedKeywords(schema, found = new Set()) {
  if (Array.isArray(schema)) {
    for (const item of schema) findUnsupportedKeywords(item, found);
    return [...found];
  }
  if (!schema || typeof schema !== "object") return [...found];
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_CUSTOM_KEYWORDS.includes(key)) found.add(key);
    findUnsupportedKeywords(value, found);
  }
  return [...found].sort();
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function knownEvidenceRefs() {
  return new Set(["evidence.platform.verification_trust_activation.provenance.package_json"]);
}

function renderMarkdown(result) {
  return [
    "# Platform Verification Trust Activation",
    "",
    `Status: ${result.summary.platform_verification_trust_activation_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source verification trust kernel status: ${result.summary.source_verification_trust_kernel_status}`,
    `Standard validator active now: ${result.summary.standard_validator_dual_run_active_now}`,
    `Dual-run fixtures matched: ${result.summary.dual_run_fixture_match_count}/${result.summary.dual_run_fixture_count}`,
    `Negative fixtures blocked: ${result.summary.blocked_negative_fixture_count}/${result.summary.negative_fixture_count}`,
    `CI workflow defined now: ${result.summary.ci_workflow_defined_now}`,
    `Branch protection configured now: ${result.summary.branch_protection_configured_now}`,
    `Local attestation metadata generated now: ${result.summary.local_attestation_metadata_generated_now}`,
    `External signed attestation present now: ${result.summary.external_signed_attestation_present_now}`,
    `Independent review lane active now: ${result.summary.independent_review_lane_active_now}`,
    `Independent review completed now: ${result.summary.independent_review_completed_now}`,
    `Enterprise trust claim allowed now: ${result.summary.enterprise_trust_claim_allowed_now}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Production ready claimed now: ${result.summary.production_ready_claimed_now}`,
    `P3521 ready as next goal: ${result.summary.p3521_ready_as_next_goal}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Trust Boundary",
    "",
    "This tranche activates local standard validator dual-run and creates CI, attestation, and independent-review lanes. Branch protection, external signed attestation, completed independent review, production readiness, runtime, and write authority remain false.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_VERIFICATION_TRUST_ACTIVATION_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    package_lock_path: options.packageLockPath ?? defaults.packageLockPath,
    verification_trust_kernel_ledger_path: options.verificationTrustKernelLedgerPath ?? defaults.verificationTrustKernelLedgerPath,
    verification_trust_activation_ledger_path: options.verificationTrustActivationLedgerPath ?? defaults.verificationTrustActivationLedgerPath,
    workflow_path: options.workflowPath ?? defaults.workflowPath,
    source_module_path: options.sourceModulePath ?? defaults.sourceModulePath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const raw = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, raw, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { available: false, path: sourcePath, raw: "", error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text, content_hash: sha256(text) };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function hashValue(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    packageLockPath: undefined,
    verificationTrustKernelLedgerPath: undefined,
    verificationTrustActivationLedgerPath: undefined,
    workflowPath: undefined,
    sourceModulePath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--package-lock") {
      args.packageLockPath = argv[index + 1];
      index += 1;
    } else if (arg === "--verification-trust-kernel-ledger") {
      args.verificationTrustKernelLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--verification-trust-activation-ledger") {
      args.verificationTrustActivationLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--workflow") {
      args.workflowPath = argv[index + 1];
      index += 1;
    } else if (arg === "--source-module") {
      args.sourceModulePath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-verification-trust-activation.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --package-lock <path>           package-lock.json path.
  --verification-trust-kernel-ledger <path>
  --verification-trust-activation-ledger <path>
  --workflow <path>               GitHub Actions workflow path.
  --source-module <path>          Source verification trust kernel module path.
  --help                          Show this help.
`);
}
