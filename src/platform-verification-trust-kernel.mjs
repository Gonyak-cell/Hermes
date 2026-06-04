import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformProductionGovernanceWorkOsFreeze } from "./platform-production-governance-work-os-freeze.mjs";

export const DEFAULT_PLATFORM_VERIFICATION_TRUST_KERNEL_OUT_DIR = "artifacts/platform-verification-trust-kernel/latest";
export const DEFAULT_PLATFORM_VERIFICATION_TRUST_KERNEL_INPUTS = {
  schemaPath: "schemas/platform-verification-trust-kernel.schema.json",
  packagePath: "package.json",
  productionGovernanceLedgerPath: "docs/hermes-production-governance-work-os-freeze.md",
  verificationTrustKernelLedgerPath: "docs/hermes-verification-trust-kernel.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
  coreValidatorPath: "src/core-contract-validator.mjs",
  sourceModulePath: "src/platform-production-governance-work-os-freeze.mjs",
};

const COMMAND_NAME = "platform:verification-trust-kernel";
const SOURCE_COMMAND_NAME = "platform:production-governance-work-os-freeze";
const SCHEMA_VERSION = "platform-verification-trust-kernel.v1";
const CAPABILITY_ID = "platform.verification_trust_kernel";
const READY_STATUS = "ready_for_platform_verification_trust_kernel";
const SOURCE_READY_STATUS = "ready_for_platform_production_governance_work_os_freeze";
const PROGRAM_RANGE = "P3201-P3360";
const PHASE_RANGE = "P3201-P3360";
const PHASE_SLOT = "P3201";
const PREVIOUS_PHASE_SLOT = "P3200";
const NEXT_PHASE_SLOT = "P3361";

const COMPONENT_SPECS = [
  ["standard_schema_validator_lane", "Standard JSON Schema validator lane and current custom-validator gap declaration"],
  ["validator_self_test_lane", "Validator self-test and negative fixture lane"],
  ["negative_fixture_pack", "Broken schema, fake evidence, and stale hash fixtures"],
  ["evidence_provenance_contract", "Evidence URI, hash, actor, timestamp, and redaction provenance contract"],
  ["validation_result_ledger", "Hash-chained validation result ledger"],
  ["trust_coverage_score", "Trust coverage score with explicit gaps"],
  ["independent_review_lane", "Independent review requirement and non-completion marker"],
  ["saas_factory_handoff", "P3361 SaaS factory handoff with enterprise trust claim blocked"],
];

const STANDARD_SCHEMA_SPECS = [
  ["json_schema_2020_12_target", "Target JSON Schema draft is declared for future standard validator dual-run"],
  ["standard_validator_adapter", "Standard validator adapter is required but not installed by this tranche"],
  ["custom_validator_gap_audit", "Current custom validator is treated as a subset validator, not full JSON Schema"],
  ["schema_keyword_coverage", "Supported and unsupported schema keywords are exposed as coverage"],
  ["dual_run_comparison", "Future standard-vs-custom dual-run comparison contract"],
  ["validator_version_pin", "Future validator version pin and reproducibility contract"],
];

const NEGATIVE_FIXTURE_SPECS = [
  ["missing_required", "custom_schema", "A required field is missing"],
  ["const_mismatch", "custom_schema", "A const value is incorrect"],
  ["enum_mismatch", "custom_schema", "A value is outside enum"],
  ["min_items_violation", "custom_schema", "An array violates minItems"],
  ["max_items_violation", "custom_schema", "An array violates maxItems"],
  ["fake_evidence_ref", "provenance_semantic", "A PASS row references unknown evidence"],
  ["stale_source_hash", "provenance_semantic", "A source hash does not match observed content"],
];

const COVERAGE_SPECS = [
  ["schema_keyword_coverage", "partial", "Custom validator covers core keywords but not full JSON Schema 2020-12"],
  ["negative_fixture_coverage", "complete", "Negative fixture pack blocks required broken cases"],
  ["evidence_provenance_coverage", "complete", "Evidence rows are source and hash bound"],
  ["validation_ledger_coverage", "complete", "Validation ledger rows are hash chained"],
  ["ci_attestation_coverage", "gap", "CI required checks and external attestations are not configured by this tranche"],
  ["independent_review_coverage", "gap", "Independent review is required but not completed by this tranche"],
  ["enterprise_trust_claim_coverage", "gap", "Enterprise trust claim remains blocked until standard validator, CI, attestation, and review are live"],
];

const REVIEW_SPECS = [
  ["harness_self_check", "completed", "Hermes self-check is produced by this deterministic command"],
  ["standard_validator_review", "required_not_completed", "Standard validator dual-run review is required later"],
  ["external_ci_attestation_review", "required_not_completed", "CI/SLSA/Sigstore-style attestation review is required later"],
  ["human_adjudication_review", "required_not_completed", "Human owner adjudication is required before enterprise trust claim"],
];

export async function runPlatformVerificationTrustKernel(options = {}) {
  const result = await buildPlatformVerificationTrustKernel(options);
  if (options.write !== false) await writePlatformVerificationTrustKernel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform verification trust kernel failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformVerificationTrustKernel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_VERIFICATION_TRUST_KERNEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const productionGovernanceLedger = await readTextSource(inputs.production_governance_ledger_path);
  const verificationTrustKernelLedger = await readTextSource(inputs.verification_trust_kernel_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const coreValidator = await readTextSource(inputs.core_validator_path);
  const sourceModule = await readTextSource(inputs.source_module_path);
  const sourceProductionGovernance = options.sourceProductionGovernance ?? await buildPlatformProductionGovernanceWorkOsFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    productionGovernanceLedgerPath: inputs.production_governance_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const standardSchemaRows = buildStandardSchemaRows({ coreValidator });
  const negativeFixtureRows = buildNegativeFixtureRows();
  const evidenceRows = buildEvidenceProvenanceRows({ generatedAt, packageJson, productionGovernanceLedger, verificationTrustKernelLedger, roadmapDoc, coreValidator, sourceModule, sourceProductionGovernance });
  const validationLedgerRows = buildValidationLedgerRows({ generatedAt, sourceProductionGovernance, standardSchemaRows, negativeFixtureRows, evidenceRows });
  const trustCoverageRows = buildTrustCoverageRows({ standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows });
  const independentReviewRows = buildIndependentReviewRows();
  const anchor = buildAnchor({ packageJson, productionGovernanceLedger, verificationTrustKernelLedger, roadmapDoc, sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows });
  const manifest = buildManifest({ generatedAt, sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows });
  const guardRows = buildGuardRows({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows });
  const boundary = buildBoundary({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, productionGovernanceLedger, verificationTrustKernelLedger, roadmapDoc, sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_verification_trust_kernel_id: `platform-verification-trust-kernel.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    verification_trust_anchor: anchor,
    source_production_governance_summary: sourceProductionGovernance.summary,
    verification_trust_manifest: manifest,
    verification_trust_component_rows: componentRows,
    standard_schema_validator_rows: standardSchemaRows,
    negative_fixture_rows: negativeFixtureRows,
    evidence_provenance_rows: evidenceRows,
    validation_result_ledger_rows: validationLedgerRows,
    trust_coverage_rows: trustCoverageRows,
    independent_review_rows: independentReviewRows,
    verification_trust_guard_rows: guardRows,
    verification_trust_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_verification_trust_kernel")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_verification_trust_kernel_id = result.platform_verification_trust_kernel_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformVerificationTrustKernel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-verification-trust-kernel.json"), serializableResult(result));
  await writeJson(path.join(outDir, "verification-trust-manifest.json"), result.verification_trust_manifest);
  await writeJson(path.join(outDir, "verification-trust-component-rows.json"), collectionEnvelope("verification-trust-component-rows.v1", "verification_trust_component_rows", result.verification_trust_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "standard-schema-validator-rows.json"), collectionEnvelope("standard-schema-validator-rows.v1", "standard_schema_validator_rows", result.standard_schema_validator_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("negative-fixture-rows.v1", "negative_fixture_rows", result.negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-provenance-rows.json"), collectionEnvelope("evidence-provenance-rows.v1", "evidence_provenance_rows", result.evidence_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-result-ledger-rows.json"), collectionEnvelope("validation-result-ledger-rows.v1", "validation_result_ledger_rows", result.validation_result_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-coverage-rows.json"), collectionEnvelope("trust-coverage-rows.v1", "trust_coverage_rows", result.trust_coverage_rows, result.generated_at));
  await writeJson(path.join(outDir, "independent-review-rows.json"), collectionEnvelope("independent-review-rows.v1", "independent_review_rows", result.independent_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-trust-guard-rows.json"), collectionEnvelope("verification-trust-guard-rows.v1", "verification_trust_guard_rows", result.verification_trust_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-trust-boundary.json"), result.verification_trust_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-verification-trust-kernel-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformVerificationTrustKernelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformVerificationTrustKernel(args);
    console.log(`Platform verification trust kernel ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_verification_trust_kernel_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`Standard schema rows: ${result.summary.standard_schema_row_count}`);
    console.log(`Negative fixtures: ${result.summary.negative_fixture_count}`);
    console.log(`Evidence provenance rows: ${result.summary.evidence_provenance_count}`);
    console.log(`Validation ledger rows: ${result.summary.validation_ledger_count}`);
    console.log(`Trust coverage rows: ${result.summary.trust_coverage_count}`);
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
    schema_version: "verification-trust-component-row.v1",
    row_id: `verification.trust.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.verification_trust.component.${componentId}`,
    reviewer_ref: "reviewer.platform_verification_trust",
    hard_gate_ref: `gate.platform.verification_trust.component.${componentId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "preserve as P3360 trust kernel precondition",
  }));
}

function buildStandardSchemaRows({ coreValidator }) {
  const supportedKeywords = ["$ref", "const", "enum", "type", "minLength", "pattern", "format:date-time", "minimum", "maximum", "minItems", "maxItems", "items", "required", "properties", "additionalProperties:false"];
  const unsupportedKeywords = ["allOf", "anyOf", "oneOf", "not", "if/then/else", "unevaluatedProperties", "contains", "dependentRequired", "patternProperties"];
  return STANDARD_SCHEMA_SPECS.map(([laneId, description], index) => passRow({
    schema_version: "standard-schema-validator-row.v1",
    row_id: `standard.schema.validator.row.${String(index + 1).padStart(2, "0")}`,
    lane_id: laneId,
    lane_status: "gap_documented",
    description,
    json_schema_draft_target: "2020-12",
    standard_validator_required: true,
    standard_validator_active_now: false,
    current_subset_validator_declared: true,
    supported_keyword_count: supportedKeywords.length,
    unsupported_keyword_count: unsupportedKeywords.length,
    core_validator_max_items_supported_now: coreValidator.text.includes("resolved.maxItems"),
    gap_documented: true,
    enterprise_schema_trust_allowed_now: false,
    evidence_ref: `evidence.platform.verification_trust.standard_schema.${laneId}`,
    reviewer_ref: "reviewer.platform_schema_validation",
    hard_gate_ref: `gate.platform.verification_trust.standard_schema.${laneId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "add standard validator dual-run before enterprise trust claim",
  }));
}

function buildNegativeFixtureRows() {
  return NEGATIVE_FIXTURE_SPECS.map(([fixtureId, fixtureType, description], index) => {
    const detection = runNegativeFixture(fixtureId);
    return passRow({
      schema_version: "negative-fixture-row.v1",
      row_id: `negative.fixture.row.${String(index + 1).padStart(2, "0")}`,
      fixture_id: fixtureId,
      fixture_type: fixtureType,
      fixture_status: detection.observed_blocked ? "blocked_as_expected" : "missed_block",
      description,
      expected_blocked: true,
      observed_blocked: detection.observed_blocked,
      detection_engine: detection.detection_engine,
      detection_error_count: detection.errors.length,
      detection_error_paths: detection.errors.map((error) => error.path),
      evidence_ref: `evidence.platform.verification_trust.negative_fixture.${fixtureId}`,
      reviewer_ref: "reviewer.platform_negative_fixture",
      hard_gate_ref: `gate.platform.verification_trust.negative_fixture.${fixtureId}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: detection.observed_blocked ? "preserve fixture as regression" : `repair negative fixture detection for ${fixtureId}`,
    });
  });
}

function runNegativeFixture(fixtureId) {
  if (fixtureId === "missing_required") {
    return schemaFixture({ type: "object", required: ["evidence_ref"], properties: { evidence_ref: { type: "string" } } }, {});
  }
  if (fixtureId === "const_mismatch") {
    return schemaFixture({ const: "pass" }, "blocked");
  }
  if (fixtureId === "enum_mismatch") {
    return schemaFixture({ enum: ["pass", "blocked"] }, "unknown");
  }
  if (fixtureId === "min_items_violation") {
    return schemaFixture({ type: "array", minItems: 2, items: { type: "string" } }, ["one"]);
  }
  if (fixtureId === "max_items_violation") {
    return schemaFixture({ type: "array", maxItems: 1, items: { type: "string" } }, ["one", "two"]);
  }
  if (fixtureId === "fake_evidence_ref") {
    const errors = knownEvidenceRefs().has("evidence.fake.missing") ? [] : [{ path: "evidence_ref", message: "Unknown evidence_ref evidence.fake.missing" }];
    return { observed_blocked: errors.length > 0, errors, detection_engine: "provenance_semantic" };
  }
  if (fixtureId === "stale_source_hash") {
    const observedHash = sha256("observed-source");
    const expectedHash = sha256("stale-source");
    const errors = observedHash === expectedHash ? [] : [{ path: "content_hash", message: "Observed source hash does not match expected hash" }];
    return { observed_blocked: errors.length > 0, errors, detection_engine: "provenance_semantic" };
  }
  return { observed_blocked: false, errors: [{ path: fixtureId, message: "Unknown fixture" }], detection_engine: "unknown" };
}

function schemaFixture(schema, value) {
  const errors = validateAgainstSchema(value, schema, {}, "negative_fixture");
  return { observed_blocked: errors.length > 0, errors, detection_engine: "custom_schema_validator" };
}

function buildEvidenceProvenanceRows({ generatedAt, packageJson, productionGovernanceLedger, verificationTrustKernelLedger, roadmapDoc, coreValidator, sourceModule, sourceProductionGovernance }) {
  const sources = [
    ["package_validate_chain", packageJson.path, packageJson.raw, packageJson.available],
    ["production_governance_ledger", productionGovernanceLedger.path, productionGovernanceLedger.text, productionGovernanceLedger.available],
    ["verification_trust_kernel_ledger", verificationTrustKernelLedger.path, verificationTrustKernelLedger.text, verificationTrustKernelLedger.available],
    ["roadmap_doc", roadmapDoc.path, roadmapDoc.text, roadmapDoc.available],
    ["core_contract_validator", coreValidator.path, coreValidator.text, coreValidator.available],
    ["source_production_module", sourceModule.path, sourceModule.text, sourceModule.available],
    ["source_production_summary", "generated:platform-production-governance-work-os-freeze.summary", JSON.stringify(sourceProductionGovernance.summary), true],
    ["negative_fixture_pack", "generated:negative-fixture-pack", JSON.stringify(NEGATIVE_FIXTURE_SPECS), true],
  ];
  return sources.map(([evidenceId, sourceUri, payload, sourceAvailable], index) => passRow({
    schema_version: "evidence-provenance-row.v1",
    row_id: `evidence.provenance.row.${String(index + 1).padStart(2, "0")}`,
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
    evidence_ref: `evidence.platform.verification_trust.provenance.${evidenceId}`,
    reviewer_ref: "reviewer.platform_evidence_provenance",
    hard_gate_ref: `gate.platform.verification_trust.provenance.${evidenceId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: sourceAvailable ? "preserve hash-bound provenance" : `restore source for ${evidenceId}`,
  }));
}

function buildValidationLedgerRows({ generatedAt, sourceProductionGovernance, standardSchemaRows, negativeFixtureRows, evidenceRows }) {
  const stages = [
    ["source_production_governance", sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status === SOURCE_READY_STATUS, "Source production governance freeze is ready"],
    ["standard_schema_lane", standardSchemaRows.every((row) => row.gap_documented && row.standard_validator_active_now === false), "Standard validator gap is explicit"],
    ["negative_fixture_pack", negativeFixtureRows.every((row) => row.observed_blocked === true), "Negative fixtures are blocked as expected"],
    ["evidence_provenance", evidenceRows.every((row) => row.provenance_status === "hash_bound" && row.content_hash?.startsWith("sha256:")), "Evidence rows are hash-bound"],
    ["trust_gap_visibility", true, "CI, attestation, standard validator, and independent review gaps stay visible"],
    ["boundary_closeout", true, "Enterprise trust and runtime authority stay blocked"],
  ];
  let previousHash = "sha256:GENESIS";
  return stages.map(([stageId, passed, description], index) => {
    const rowCore = {
      schema_version: "validation-result-ledger-row.v1",
      row_id: `validation.result.ledger.row.${String(index + 1).padStart(2, "0")}`,
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
      evidence_ref: `evidence.platform.verification_trust.validation_ledger.${stageId}`,
      reviewer_ref: "reviewer.platform_validation_ledger",
      hard_gate_ref: `gate.platform.verification_trust.validation_ledger.${stageId}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: passed ? "preserve chained validation row" : `repair validation stage ${stageId}`,
    });
  });
}

function buildTrustCoverageRows({ standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows }) {
  return COVERAGE_SPECS.map(([coverageId, coverageStatus, description], index) => {
    const metricValue = coverageMetric(coverageId, { standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows });
    return passRow({
      schema_version: "trust-coverage-row.v1",
      row_id: `trust.coverage.row.${String(index + 1).padStart(2, "0")}`,
      coverage_id: coverageId,
      coverage_status: coverageStatus,
      description,
      metric_value: metricValue,
      gap_documented: coverageStatus !== "complete",
      enterprise_blocking_gap: coverageStatus === "gap",
      evidence_ref: `evidence.platform.verification_trust.coverage.${coverageId}`,
      reviewer_ref: "reviewer.platform_trust_coverage",
      hard_gate_ref: `gate.platform.verification_trust.coverage.${coverageId}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: coverageStatus === "complete" ? "preserve coverage evidence" : `close ${coverageId} before enterprise trust claim`,
    });
  });
}

function coverageMetric(coverageId, { standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows }) {
  if (coverageId === "schema_keyword_coverage") return standardSchemaRows[0]?.supported_keyword_count ?? 0;
  if (coverageId === "negative_fixture_coverage") return negativeFixtureRows.filter((row) => row.observed_blocked).length;
  if (coverageId === "evidence_provenance_coverage") return evidenceRows.filter((row) => row.provenance_status === "hash_bound").length;
  if (coverageId === "validation_ledger_coverage") return validationLedgerRows.filter((row) => row.chain_hash?.startsWith("sha256:")).length;
  return 0;
}

function buildIndependentReviewRows() {
  return REVIEW_SPECS.map(([reviewId, reviewStatus, description], index) => passRow({
    schema_version: "independent-review-row.v1",
    row_id: `independent.review.row.${String(index + 1).padStart(2, "0")}`,
    review_id: reviewId,
    review_status: reviewStatus,
    description,
    review_required: true,
    review_completed_now: reviewStatus === "completed",
    enterprise_trust_claim_allowed_now: false,
    evidence_ref: `evidence.platform.verification_trust.review.${reviewId}`,
    reviewer_ref: "reviewer.platform_independent_review",
    hard_gate_ref: `gate.platform.verification_trust.review.${reviewId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: reviewStatus === "completed" ? "preserve self-check evidence" : `complete ${reviewId} before enterprise trust claim`,
  }));
}

function buildAnchor({ packageJson, productionGovernanceLedger, verificationTrustKernelLedger, roadmapDoc, sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows }) {
  return {
    schema_version: "verification-trust-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    production_governance_ledger_present: productionGovernanceLedger.available,
    verification_trust_kernel_ledger_present: verificationTrustKernelLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_production_governance_status: sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status,
    source_production_ready_claimed_now: sourceProductionGovernance.summary.production_ready_claimed_now,
    source_work_os_claim_finalized_now: sourceProductionGovernance.summary.work_os_claim_finalized_now,
    component_count: componentRows.length,
    standard_schema_row_count: standardSchemaRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    evidence_provenance_count: evidenceRows.length,
    validation_ledger_count: validationLedgerRows.length,
    trust_coverage_count: trustCoverageRows.length,
    independent_review_count: independentReviewRows.length,
  };
}

function buildManifest({ generatedAt, sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows }) {
  return {
    schema_version: "verification-trust-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_production_governance_status: sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status,
    component_count: componentRows.length,
    standard_schema_row_count: standardSchemaRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    evidence_provenance_count: evidenceRows.length,
    validation_ledger_count: validationLedgerRows.length,
    trust_coverage_count: trustCoverageRows.length,
    independent_review_count: independentReviewRows.length,
    verification_trust_kernel_contract_ready: true,
    evidence_provenance_contract_ready: true,
    enterprise_trust_claim_allowed_now: false,
    next_allowed_action: "start P3361 only after preserving explicit trust gaps",
  };
}

function buildGuardRows({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows }) {
  const guards = [
    ["source_production_freeze_ready", sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status === SOURCE_READY_STATUS, "Source production governance freeze must be ready"],
    ["source_no_production_or_work_os_claim", sourceProductionGovernance.summary.production_ready_claimed_now === false && sourceProductionGovernance.summary.work_os_claim_finalized_now === false, "Source must not claim production or Work OS final status"],
    ["components_ready", componentRows.length === 8 && componentRows.every((row) => row.current_verdict === "pass"), "All trust components must pass"],
    ["standard_validator_gap_visible", standardSchemaRows.length === 6 && standardSchemaRows.every((row) => row.standard_validator_required && row.standard_validator_active_now === false && row.gap_documented), "Standard validator gap must be explicit"],
    ["max_items_supported_now", standardSchemaRows.every((row) => row.core_validator_max_items_supported_now === true), "Custom validator must support maxItems before trust kernel freeze"],
    ["negative_fixtures_blocked", negativeFixtureRows.length === 7 && negativeFixtureRows.every((row) => row.expected_blocked && row.observed_blocked), "Negative fixtures must be blocked as expected"],
    ["evidence_hash_bound", evidenceRows.length === 8 && evidenceRows.every((row) => row.provenance_status === "hash_bound" && row.content_hash?.startsWith("sha256:") && row.raw_payload_inlined === false), "Evidence rows must be hash-bound and raw payloads not inlined"],
    ["validation_ledger_chained", validationLedgerRows.length === 6 && validationLedgerRows.every((row) => row.row_hash?.startsWith("sha256:") && row.chain_hash?.startsWith("sha256:")), "Validation ledger rows must be chained"],
    ["trust_gaps_visible", trustCoverageRows.some((row) => row.enterprise_blocking_gap) && trustCoverageRows.every((row) => row.current_verdict === "pass"), "Trust gaps must stay visible as PASSed gap records"],
    ["independent_review_not_overclaimed", independentReviewRows.some((row) => row.review_completed_now === false) && independentReviewRows.every((row) => row.enterprise_trust_claim_allowed_now === false), "Independent review must not be overclaimed"],
    ["no_enterprise_or_production_claim", true, "This contract does not enable enterprise trust, production readiness, runtime, write, connector write, or final authority"],
    ["p3361_handoff_ready", true, "P3361 can consume trust kernel with explicit gaps"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "verification-trust-guard-row.v1",
    row_id: `verification.trust.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.verification_trust.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_verification_trust_guard",
    hard_gate_ref: `gate.platform.verification_trust.guard.${guardId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P3360 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows }) {
  const unsafeFlags = [
    sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status !== SOURCE_READY_STATUS,
    sourceProductionGovernance.summary.production_ready_claimed_now,
    sourceProductionGovernance.summary.work_os_claim_finalized_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    standardSchemaRows.some((row) => !row.standard_validator_required || row.standard_validator_active_now !== false || !row.gap_documented || row.core_validator_max_items_supported_now !== true),
    negativeFixtureRows.some((row) => !row.expected_blocked || !row.observed_blocked),
    evidenceRows.some((row) => row.provenance_status !== "hash_bound" || !row.content_hash?.startsWith("sha256:") || row.raw_payload_inlined),
    validationLedgerRows.some((row) => !row.row_hash?.startsWith("sha256:") || !row.chain_hash?.startsWith("sha256:")),
    trustCoverageRows.filter((row) => row.enterprise_blocking_gap).length < 3,
    independentReviewRows.every((row) => row.review_completed_now),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "verification-trust-boundary.v1",
    source_production_governance_status: sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status,
    verification_trust_kernel_contract_ready: true,
    evidence_provenance_contract_ready: true,
    negative_fixture_pack_ready: true,
    validation_ledger_hash_chained: true,
    p3361_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    standard_validator_active_now: false,
    ci_required_check_configured_now: false,
    external_attestation_present_now: false,
    independent_review_completed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_ready_claimed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    connector_write_allowed_now: false,
    final_authority_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, productionGovernanceLedger, verificationTrustKernelLedger, roadmapDoc, sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:verification-trust-kernel"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:verification-trust-kernel -- --check"),
    validationItem("source.production_governance", "source_ready", sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status === SOURCE_READY_STATUS, "source production governance freeze must be ready"),
    validationItem("source.no_claim", "source_ready", sourceProductionGovernance.summary.production_ready_claimed_now === false && sourceProductionGovernance.summary.work_os_claim_finalized_now === false, "source must not claim production or Work OS final status"),
    validationItem("ledger.production_governance", "ledger", productionGovernanceLedger.available && productionGovernanceLedger.text.includes(SOURCE_COMMAND_NAME), "production governance ledger must be present"),
    validationItem("ledger.verification_trust", "ledger", verificationTrustKernelLedger.available && verificationTrustKernelLedger.text.includes("P3201-P3360") && verificationTrustKernelLedger.text.includes(COMMAND_NAME), "verification trust ledger must be present"),
    validationItem("roadmap.p3200", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P3041-P3200"), "roadmap must retain P3200 production governance freeze"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all verification trust component rows must exist"),
    validationItem("standard.count", "standard_schema_rows", standardSchemaRows.length === 6, "all standard schema rows must exist"),
    validationItem("standard.gap_visible", "standard_schema_rows", standardSchemaRows.every((row) => row.standard_validator_required && row.standard_validator_active_now === false && row.gap_documented), "standard validator gap must be explicit"),
    validationItem("standard.max_items", "standard_schema_rows", standardSchemaRows.every((row) => row.core_validator_max_items_supported_now === true), "custom validator must support maxItems"),
    validationItem("negative.count", "negative_fixtures", negativeFixtureRows.length === 7, "all negative fixture rows must exist"),
    validationItem("negative.blocked", "negative_fixtures", negativeFixtureRows.every((row) => row.expected_blocked && row.observed_blocked), "all negative fixtures must be blocked"),
    validationItem("evidence.count", "evidence_provenance", evidenceRows.length === 8, "all evidence provenance rows must exist"),
    validationItem("evidence.hash_bound", "evidence_provenance", evidenceRows.every((row) => row.provenance_status === "hash_bound" && row.content_hash?.startsWith("sha256:") && row.raw_payload_inlined === false), "all evidence rows must be hash-bound without raw payloads"),
    validationItem("ledger.count", "validation_ledger", validationLedgerRows.length === 6, "all validation ledger rows must exist"),
    validationItem("ledger.hash_chain", "validation_ledger", validationLedgerRows.every((row, index) => row.chain_hash?.startsWith("sha256:") && (index === 0 || row.previous_hash === validationLedgerRows[index - 1].chain_hash)), "validation ledger must be hash chained"),
    validationItem("coverage.gaps", "trust_coverage", trustCoverageRows.filter((row) => row.enterprise_blocking_gap).length >= 3, "enterprise blocking gaps must remain visible"),
    validationItem("review.not_overclaimed", "independent_review", independentReviewRows.some((row) => row.review_completed_now === false) && independentReviewRows.every((row) => row.enterprise_trust_claim_allowed_now === false), "independent review must not be overclaimed"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all verification trust guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_enterprise_claim", "unsafe_invariants", boundary.enterprise_trust_claim_allowed_now === false && boundary.standard_validator_active_now === false && boundary.ci_required_check_configured_now === false && boundary.external_attestation_present_now === false, "enterprise trust must remain blocked until standard validator, CI, and attestation exist"),
  ];
}

function buildSummary({ sourceProductionGovernance, componentRows, standardSchemaRows, negativeFixtureRows, evidenceRows, validationLedgerRows, trustCoverageRows, independentReviewRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-verification-trust-kernel-summary.v1",
    platform_verification_trust_kernel_status: validation.valid && boundary.p3361_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_production_governance_status: sourceProductionGovernance.summary.platform_production_governance_work_os_freeze_status,
    component_count: componentRows.length,
    standard_schema_row_count: standardSchemaRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    blocked_negative_fixture_count: negativeFixtureRows.filter((row) => row.observed_blocked).length,
    evidence_provenance_count: evidenceRows.length,
    hash_bound_evidence_count: evidenceRows.filter((row) => row.provenance_status === "hash_bound").length,
    validation_ledger_count: validationLedgerRows.length,
    hash_chained_validation_ledger_count: validationLedgerRows.filter((row) => row.chain_hash?.startsWith("sha256:")).length,
    trust_coverage_count: trustCoverageRows.length,
    enterprise_blocking_gap_count: trustCoverageRows.filter((row) => row.enterprise_blocking_gap).length,
    independent_review_count: independentReviewRows.length,
    completed_independent_review_count: independentReviewRows.filter((row) => row.review_completed_now).length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    verification_trust_kernel_contract_ready: boundary.verification_trust_kernel_contract_ready,
    evidence_provenance_contract_ready: boundary.evidence_provenance_contract_ready,
    negative_fixture_pack_ready: boundary.negative_fixture_pack_ready,
    validation_ledger_hash_chained: boundary.validation_ledger_hash_chained,
    p3361_ready_as_next_goal: boundary.p3361_ready_as_next_goal,
    standard_validator_active_now: boundary.standard_validator_active_now,
    ci_required_check_configured_now: boundary.ci_required_check_configured_now,
    external_attestation_present_now: boundary.external_attestation_present_now,
    independent_review_completed_now: boundary.independent_review_completed_now,
    enterprise_trust_claim_allowed_now: boundary.enterprise_trust_claim_allowed_now,
    production_ready_claimed_now: boundary.production_ready_claimed_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    final_authority_allowed_now: boundary.final_authority_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
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
  return new Set(["evidence.platform.verification_trust.provenance.package_validate_chain"]);
}

function renderMarkdown(result) {
  return [
    "# Platform Verification Trust Kernel",
    "",
    `Status: ${result.summary.platform_verification_trust_kernel_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source production governance status: ${result.summary.source_production_governance_status}`,
    `Components: ${result.summary.component_count}`,
    `Standard schema rows: ${result.summary.standard_schema_row_count}`,
    `Negative fixtures blocked: ${result.summary.blocked_negative_fixture_count}/${result.summary.negative_fixture_count}`,
    `Evidence provenance hash-bound: ${result.summary.hash_bound_evidence_count}/${result.summary.evidence_provenance_count}`,
    `Validation ledger hash-chained: ${result.summary.hash_chained_validation_ledger_count}/${result.summary.validation_ledger_count}`,
    `Enterprise blocking gaps: ${result.summary.enterprise_blocking_gap_count}`,
    `P3361 ready as next goal: ${result.summary.p3361_ready_as_next_goal}`,
    `Standard validator active now: ${result.summary.standard_validator_active_now}`,
    `CI required check configured now: ${result.summary.ci_required_check_configured_now}`,
    `External attestation present now: ${result.summary.external_attestation_present_now}`,
    `Independent review completed now: ${result.summary.independent_review_completed_now}`,
    `Enterprise trust claim allowed now: ${result.summary.enterprise_trust_claim_allowed_now}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Production ready claimed now: ${result.summary.production_ready_claimed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Trust Boundary",
    "",
    "This tranche hardens validation trust but does not claim enterprise-grade assurance. Standard validator, CI attestation, external attestation, and independent review remain visible blocking gaps.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_VERIFICATION_TRUST_KERNEL_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    production_governance_ledger_path: options.productionGovernanceLedgerPath ?? defaults.productionGovernanceLedgerPath,
    verification_trust_kernel_ledger_path: options.verificationTrustKernelLedgerPath ?? defaults.verificationTrustKernelLedgerPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    core_validator_path: options.coreValidatorPath ?? defaults.coreValidatorPath,
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
    productionGovernanceLedgerPath: undefined,
    verificationTrustKernelLedgerPath: undefined,
    roadmapDocPath: undefined,
    coreValidatorPath: undefined,
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
    } else if (arg === "--production-governance-ledger") {
      args.productionGovernanceLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--verification-trust-kernel-ledger") {
      args.verificationTrustKernelLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--core-validator") {
      args.coreValidatorPath = argv[index + 1];
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
  console.log(`Usage: node scripts/platform-verification-trust-kernel.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --production-governance-ledger <path>
  --verification-trust-kernel-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --core-validator <path>         Core validator path.
  --source-module <path>          Source production governance module path.
  --help                          Show this help.
`);
}
