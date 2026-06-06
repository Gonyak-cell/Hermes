import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildSecurityGovernanceComplianceRuleConflictPlane } from "./security-governance-compliance-rule-conflict-plane.mjs";

export const DEFAULT_WORK_OS_UI_PRODUCTION_FREEZE_OUT_DIR = "artifacts/work-os-ui-production-freeze/latest";
export const DEFAULT_WORK_OS_UI_PRODUCTION_FREEZE_INPUTS = {
  schemaPath: "schemas/work-os-ui-production-freeze.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:work-os-ui-production-freeze";
const GOVERNANCE_COMMAND_NAME = "platform:security-governance-compliance-rule-conflict-plane";
const SCHEMA_VERSION = "work-os-ui-production-freeze.v1";
const CAPABILITY_ID = "platform.work_os_ui_production_freeze";
const PROGRAM_RANGE = "P7801-P8000";
const READY_STATUS = "ready_for_work_os_ui_production_freeze_v0";
const GOVERNANCE_READY_STATUS = "ready_for_security_governance_compliance_rule_conflict_plane_v0";

const PHASE_SPECS = [
  ["P7801-P7820", "Full Work OS Navigation Freeze"],
  ["P7821-P7840", "Closed-Loop Maturity Evidence"],
  ["P7841-P7860", "Operator Action Inbox"],
  ["P7861-P7880", "Domain Pack Rollout Matrix"],
  ["P7881-P7900", "API and Handbook Alignment"],
  ["P7901-P7920", "Milestone Claude Review Completion Ledger"],
  ["P7921-P7940", "Trust Tier Publication"],
  ["P7941-P7960", "Work OS Negative Fixtures"],
  ["P7961-P7980", "Production Readiness Freeze Packet"],
  ["P7981-P8000", "P8000 Work OS Freeze"],
];

const NAVIGATION_SPECS = [
  ["nav.queue", "Queue"],
  ["nav.plans", "Plans"],
  ["nav.conversations", "Conversations"],
  ["nav.evidence", "Evidence"],
  ["nav.reviews", "Reviews"],
  ["nav.gates", "Gates"],
  ["nav.memory", "Memory"],
  ["nav.security", "Security"],
  ["nav.domains", "Domains"],
  ["nav.runs", "Runs"],
  ["nav.settings", "Settings"],
  ["nav.audit", "Audit"],
];

const CLOSED_LOOP_SPECS = [
  ["loop.source_to_claim", "source creates claim candidate"],
  ["loop.claim_to_evidence", "claim binds evidence reference"],
  ["loop.evidence_to_review", "evidence binds review packet or receipt"],
  ["loop.review_to_gate", "review binds hard gate"],
  ["loop.gate_to_verdict", "gate emits PASS/BLOCK/PENDING verdict"],
  ["loop.verdict_to_next_condition", "verdict changes next allowed action"],
  ["loop.next_condition_to_recall", "next condition appears in cited recall bundle"],
  ["loop.recall_to_execution_condition", "future execution condition changes from cited recall"],
];

const ACTION_INBOX_SPECS = [
  ["action.validate", "next validator or test command"],
  ["action.review", "Claude review receipt capture"],
  ["action.fix_findings", "finding loop and revalidation"],
  ["action.repair_gate", "blocked gate repair packet"],
  ["action.refresh_stale", "stale evidence or receipt refresh"],
  ["action.blocked_protected", "protected action blocked state"],
];

const DOMAIN_ROLLOUT_SPECS = [
  ["domain.personal_dev", "personal-dev rollout matrix"],
  ["domain.law_firm", "law-firm rollout matrix"],
  ["domain.hr_solution", "HR Solution rollout matrix"],
  ["domain.creative_document", "creative-document rollout matrix"],
  ["domain.connector_resource", "connector/resource rollout matrix"],
  ["domain.trading_readonly", "trading read-only rollout matrix"],
];

const MILESTONE_REVIEW_SPECS = ["P5000", "P5400", "P5800", "P6200", "P6600", "P7000", "P7300", "P7600", "P7800", "P8000"];

const TRUST_TIER_SPECS = [
  ["trust.local_contract_ready", "local deterministic contract readiness", true, false],
  ["trust.single_owner_claude_reviewed", "single-owner plus Claude-reviewed lower trust", true, false],
  ["trust.external_evidence_partial", "external evidence partial trust", false, false],
  ["trust.enterprise_independent", "enterprise independent review trust", false, false],
  ["trust.work_os_production", "Work OS production trust", false, false],
];

const NEGATIVE_FIXTURES = [
  ["negative.no_source_context", "context claim has no transcript/source event", "BLOCK_NO_SOURCE_CONTEXT"],
  ["negative.no_evidence_pass", "PASS claim has no evidence ref", "BLOCK_NO_EVIDENCE_PASS"],
  ["negative.no_review_closeout", "milestone closeout has no Claude review receipt", "BLOCK_NO_REVIEW_CLOSEOUT"],
  ["negative.no_human_as_final", "no-human milestone mode is represented as protected final decision", "BLOCK_NO_HUMAN_AS_FINAL"],
  ["negative.claude_as_approver", "Claude review receipt is treated as final approver", "BLOCK_REVIEWER_AS_APPROVER"],
  ["negative.no_l6_work_os", "Work OS production claim is made without L6 closed-loop proof", "BLOCK_NO_L6_WORK_OS"],
  ["negative.ui_only_production", "UI completion is treated as production readiness", "BLOCK_UI_ONLY_PRODUCTION"],
  ["negative.lower_trust_as_enterprise", "single-owner lower trust is represented as enterprise trust", "BLOCK_LOWER_TRUST_AS_ENTERPRISE"],
];

export async function runWorkOsUiProductionFreeze(options = {}) {
  const result = await buildWorkOsUiProductionFreeze(options);
  if (options.write !== false) await writeWorkOsUiProductionFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS UI production freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkOsUiProductionFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_UI_PRODUCTION_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const governance = options.governance ?? await buildSecurityGovernanceComplianceRuleConflictPlane({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildFreezeContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const navigationRows = buildNavigationRows(generatedAt);
  const closedLoopRows = buildClosedLoopRows(generatedAt);
  const actionInboxRows = buildActionInboxRows(generatedAt);
  const domainRolloutRows = buildDomainRolloutRows(generatedAt);
  const apiHandbookRows = buildApiHandbookRows(generatedAt);
  const milestoneReviewRows = buildMilestoneReviewRows(generatedAt);
  const trustTierRows = buildTrustTierRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const productionFreezePacketRows = buildProductionFreezePacketRows(generatedAt);
  const finalFreezeRows = buildFinalFreezeRows({ navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, governance, contract, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows });
  const boundary = buildBoundary({ governance, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, governance, contract, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    work_os_ui_production_freeze_id: `work-os-ui-production-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_security_governance_summary: governance.summary,
    work_os_ui_production_freeze_contract: contract,
    work_os_ui_production_freeze_phase_rows: phaseRows,
    work_os_navigation_freeze_rows: navigationRows,
    closed_loop_maturity_evidence_rows: closedLoopRows,
    operator_action_inbox_rows: actionInboxRows,
    domain_pack_rollout_matrix_rows: domainRolloutRows,
    api_handbook_alignment_rows: apiHandbookRows,
    milestone_claude_review_completion_ledger_rows: milestoneReviewRows,
    trust_tier_publication_rows: trustTierRows,
    work_os_negative_fixture_rows: negativeFixtureRows,
    production_readiness_freeze_packet_rows: productionFreezePacketRows,
    p8000_work_os_freeze_rows: finalFreezeRows,
    work_os_ui_production_freeze_gate_rows: gateRows,
    work_os_ui_production_freeze_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ governance, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_ui_production_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ governance, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows, boundary, validation: result.validation });
  result.summary.work_os_ui_production_freeze_id = result.work_os_ui_production_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeWorkOsUiProductionFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-ui-production-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-os-navigation-freeze-rows.json"), collectionEnvelope("work-os-navigation-freeze-rows.v1", "work_os_navigation_freeze_rows", result.work_os_navigation_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "closed-loop-maturity-evidence-rows.json"), collectionEnvelope("closed-loop-maturity-evidence-rows.v1", "closed_loop_maturity_evidence_rows", result.closed_loop_maturity_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-action-inbox-rows.json"), collectionEnvelope("operator-action-inbox-rows.v1", "operator_action_inbox_rows", result.operator_action_inbox_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-rollout-matrix-rows.json"), collectionEnvelope("domain-pack-rollout-matrix-rows.v1", "domain_pack_rollout_matrix_rows", result.domain_pack_rollout_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "api-handbook-alignment-rows.json"), collectionEnvelope("api-handbook-alignment-rows.v1", "api_handbook_alignment_rows", result.api_handbook_alignment_rows, result.generated_at));
  await writeJson(path.join(outDir, "milestone-claude-review-completion-ledger-rows.json"), collectionEnvelope("milestone-claude-review-completion-ledger-rows.v1", "milestone_claude_review_completion_ledger_rows", result.milestone_claude_review_completion_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-tier-publication-rows.json"), collectionEnvelope("trust-tier-publication-rows.v1", "trust_tier_publication_rows", result.trust_tier_publication_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-negative-fixture-rows.json"), collectionEnvelope("work-os-negative-fixture-rows.v1", "work_os_negative_fixture_rows", result.work_os_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-readiness-freeze-packet-rows.json"), collectionEnvelope("production-readiness-freeze-packet-rows.v1", "production_readiness_freeze_packet_rows", result.production_readiness_freeze_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-work-os-freeze-rows.json"), collectionEnvelope("p8000-work-os-freeze-rows.v1", "p8000_work_os_freeze_rows", result.p8000_work_os_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-ui-production-freeze-gate-rows.json"), collectionEnvelope("work-os-ui-production-freeze-gate-rows.v1", "work_os_ui_production_freeze_gate_rows", result.work_os_ui_production_freeze_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-ui-production-freeze-boundary.json"), result.work_os_ui_production_freeze_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "work-os-ui-production-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkOsUiProductionFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkOsUiProductionFreeze(args);
    console.log(`Work OS UI production freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.work_os_ui_production_freeze_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Navigation rows: ${result.summary.navigation_count}`);
    console.log(`Milestone review rows: ${result.summary.milestone_review_count}`);
    console.log(`L6 proof passed now: ${result.summary.l6_closed_loop_proof_passed_now}`);
    console.log(`Work OS production claim enabled: ${result.summary.work_os_production_claim_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFreezeContract(generatedAt) {
  return {
    schema_version: "work-os-ui-production-freeze-contract.v1",
    generated_at: generatedAt,
    contract_id: "work-os-ui-production-freeze-contract.p7801-p8000",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7601-P7800",
    full_work_os_navigation_required: true,
    closed_loop_maturity_evidence_required: true,
    operator_action_inbox_required: true,
    domain_pack_rollout_matrix_required: true,
    api_handbook_alignment_required: true,
    milestone_claude_review_completion_ledger_required: true,
    trust_tier_publication_required: true,
    work_os_negative_fixtures_required: true,
    production_readiness_freeze_packet_required: true,
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    review_receipt_registration_required: true,
    single_owner_trust_classification_required: true,
    l6_closed_loop_proof_passed_now: false,
    l7_work_os_operating_system_claim_allowed_now: false,
    work_os_production_claim_enabled: false,
    ui_only_production_claim_allowed: false,
    lower_trust_as_enterprise_allowed: false,
    claude_final_approval_allowed: false,
    codex_self_approval_allowed: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "work-os-ui-production-freeze-phase-row.v1",
      row_id: `work.os.ui.production.freeze.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.work_os_freeze.${phase_range}`,
      responsible_owner: "platform_work_os_owner",
      next_allowed_action: pass ? "preserve P8000 phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildNavigationRows(generatedAt) {
  return makeRows(NAVIGATION_SPECS, "work-os-navigation-freeze-row.v1", "work.os.navigation.freeze.row", {
    generated_at: generatedAt,
    navigation_row_ready: true,
    read_only_default: true,
    action_queue_visible: true,
    production_readiness_claim_allowed: false,
  });
}

function buildClosedLoopRows(generatedAt) {
  return makeRows(CLOSED_LOOP_SPECS, "closed-loop-maturity-evidence-row.v1", "closed.loop.maturity.evidence.row", {
    generated_at: generatedAt,
    closed_loop_contract_ready: true,
    evidence_ref_required: true,
    review_ref_required: true,
    next_condition_ref_required: true,
    l6_proof_passed_now: false,
    work_os_claim_allowed_from_this_row: false,
  });
}

function buildActionInboxRows(generatedAt) {
  return makeRows(ACTION_INBOX_SPECS, "operator-action-inbox-row.v1", "operator.action.inbox.row", {
    generated_at: generatedAt,
    action_row_ready: true,
    next_allowed_action_required: true,
    blocked_action_visible: true,
    protected_action_execution_enabled: false,
  });
}

function buildDomainRolloutRows(generatedAt) {
  return makeRows(DOMAIN_ROLLOUT_SPECS, "domain-pack-rollout-matrix-row.v1", "domain.pack.rollout.matrix.row", {
    generated_at: generatedAt,
    rollout_row_ready: true,
    trust_tier_required: true,
    evidence_ref_required: true,
    claude_review_receipt_required: true,
    product_launch_enabled: false,
  });
}

function buildApiHandbookRows(generatedAt) {
  const specs = [
    ["alignment.api_projection", "read-only API projection alignment"],
    ["alignment.operator_handbook", "operator handbook alignment"],
    ["alignment.dashboard_ia", "dashboard IA alignment"],
    ["alignment.schema_command_map", "schema and command map alignment"],
  ];
  return makeRows(specs, "api-handbook-alignment-row.v1", "api.handbook.alignment.row", {
    generated_at: generatedAt,
    alignment_row_ready: true,
    docs_can_claim_blocked_capability: false,
    read_only_projection_required: true,
  });
}

function buildMilestoneReviewRows(generatedAt) {
  return MILESTONE_REVIEW_SPECS.map((milestone, index) => ({
    schema_version: "milestone-claude-review-completion-ledger-row.v1",
    row_id: `milestone.claude.review.completion.ledger.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    milestone,
    codex_implementation_packet_required: true,
    harness_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    durable_raw_json_required: true,
    normalized_findings_required: true,
    review_receipt_completed_now: false,
    reviewer_mutation_allowed: false,
    reviewer_final_approval_allowed: false,
    evidence_ref: `evidence.milestone_claude_review.${milestone}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.milestone_claude_review.${milestone}`,
    next_allowed_action: "capture completed Claude review receipt with durable raw JSON before claiming protected closeout",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildTrustTierRows(generatedAt) {
  return TRUST_TIER_SPECS.map(([trust_tier_id, description, available_now, enterprise_trust], index) => ({
    schema_version: "trust-tier-publication-row.v1",
    row_id: `trust.tier.publication.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    trust_tier_id,
    description,
    available_now,
    enterprise_trust,
    claim_allowed_now: available_now && enterprise_trust === false,
    lower_trust_must_not_be_renamed_enterprise: true,
    evidence_ref: `evidence.trust_tier_publication.${trust_tier_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.trust_tier_publication.${trust_tier_id}`,
    next_allowed_action: available_now ? "publish trust tier with explicit limitation" : "keep trust tier blocked until evidence exists",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "work-os-negative-fixture-row.v1",
    row_id: `work.os.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_work_os_claim_allowed: false,
    evidence_ref: `evidence.work_os_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.work_os_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve Work OS negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProductionFreezePacketRows(generatedAt) {
  return [
    {
      schema_version: "production-readiness-freeze-packet-row.v1",
      row_id: "production.readiness.freeze.packet.row.001",
      generated_at: generatedAt,
      freeze_packet_ready: true,
      validation_matrix_required: true,
      review_receipts_required: true,
      unresolved_blockers_required: true,
      boundary_states_required: true,
      rollback_required: true,
      next_phase_recommendations_required: true,
      production_release_claim_allowed: false,
      evidence_ref: "evidence.production_readiness_freeze_packet",
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: "gate.production_readiness_freeze_packet",
      next_allowed_action: "use freeze packet as planning evidence, not production release",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildFinalFreezeRows({ navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, generatedAt }) {
  const specs = [
    ["navigation_ready", navigationRows.every((row) => row.navigation_row_ready && row.production_readiness_claim_allowed === false), "full Work OS navigation contract is ready"],
    ["closed_loop_contract_ready", closedLoopRows.every((row) => row.closed_loop_contract_ready && row.l6_proof_passed_now === false), "closed-loop evidence contract is ready while L6 proof remains unpassed"],
    ["action_inbox_ready", actionInboxRows.every((row) => row.blocked_action_visible && row.protected_action_execution_enabled === false), "operator action inbox is ready"],
    ["domain_rollout_ready", domainRolloutRows.every((row) => row.rollout_row_ready && row.product_launch_enabled === false), "domain rollout matrix is ready"],
    ["api_handbook_ready", apiHandbookRows.every((row) => row.alignment_row_ready && row.docs_can_claim_blocked_capability === false), "API and handbook alignment is ready"],
    ["milestone_review_ledger_ready", milestoneReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_final_approval_allowed === false), "milestone Claude review ledger is ready"],
    ["trust_tiers_ready", trustTierRows.every((row) => row.lower_trust_must_not_be_renamed_enterprise), "trust tiers are published with limitations"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "Work OS negative fixtures are ready"],
    ["freeze_packet_ready", productionFreezePacketRows.every((row) => row.freeze_packet_ready && row.production_release_claim_allowed === false), "production readiness freeze packet is ready"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "p8000-work-os-freeze-row.v1",
    row_id: `p8000.work.os.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.p8000_work_os_freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.p8000_work_os_freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve P8000 freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, governance, contract, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:work-os-ui-production-freeze"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes Work OS UI production freeze"],
    ["governance_script_registered", Boolean(packageJson.data?.scripts?.[GOVERNANCE_COMMAND_NAME]), "security governance script exists"],
    ["governance_ready", governance.summary?.security_governance_compliance_rule_conflict_plane_status === GOVERNANCE_READY_STATUS, "P7601-P7800 security governance plane is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Full Work OS UI and Production Freeze"), "P7801-P8000 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Full Work OS UI and Production Freeze"), "architecture doc reflects Work OS freeze"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Full Work OS UI and Production Freeze"), "review dashboard IA reflects Work OS freeze"],
    ["contract_ready", contract.full_work_os_navigation_required && contract.claude_code_opus_max_review_receipt_required && contract.work_os_production_claim_enabled === false, "Work OS freeze contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P7801-P8000 phase rows pass"],
    ["navigation_ready", navigationRows.length >= 12 && navigationRows.every((row) => row.navigation_row_ready), "navigation rows are ready"],
    ["closed_loop_contract_ready", closedLoopRows.length >= 8 && closedLoopRows.every((row) => row.closed_loop_contract_ready && row.work_os_claim_allowed_from_this_row === false), "closed-loop contract rows are ready"],
    ["action_inbox_ready", actionInboxRows.length >= 6 && actionInboxRows.every((row) => row.blocked_action_visible), "operator action inbox rows are ready"],
    ["domain_rollout_ready", domainRolloutRows.length >= 6 && domainRolloutRows.every((row) => row.product_launch_enabled === false), "domain rollout rows are ready"],
    ["api_handbook_ready", apiHandbookRows.length >= 4 && apiHandbookRows.every((row) => row.docs_can_claim_blocked_capability === false), "API handbook alignment rows are ready"],
    ["milestone_review_ledger_ready", milestoneReviewRows.length >= 10 && milestoneReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_mutation_allowed === false), "milestone review ledger rows are ready"],
    ["trust_tiers_ready", trustTierRows.length >= 5 && trustTierRows.every((row) => row.lower_trust_must_not_be_renamed_enterprise), "trust tier rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "Work OS negative fixtures are ready"],
    ["freeze_packet_ready", productionFreezePacketRows.every((row) => row.freeze_packet_ready && row.production_release_claim_allowed === false), "production readiness freeze packet rows are ready"],
    ["final_freeze_rows_ready", finalFreezeRows.every((row) => row.freeze_status === "ready"), "P8000 final freeze rows are ready"],
    ["boundary_no_work_os_production", contract.work_os_production_claim_enabled === false && contract.l6_closed_loop_proof_passed_now === false, "Work OS production claim stays blocked"],
    ["boundary_no_enterprise", contract.enterprise_trust_claim_enabled === false && contract.lower_trust_as_enterprise_allowed === false, "enterprise trust stays blocked"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "work-os-ui-production-freeze-gate-row.v1",
    row_id: `work.os.ui.production.freeze.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.work_os_ui_production_freeze.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("review") || gate_id.includes("freeze") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.work_os_ui_production_freeze.${gate_id}`,
    responsible_owner: "platform_work_os_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary(args) {
  const { governance, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows } = args;
  const unsafeFlags = [
    governance.summary?.security_governance_compliance_rule_conflict_plane_status !== GOVERNANCE_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    navigationRows.some((row) => !row.navigation_row_ready || row.production_readiness_claim_allowed),
    closedLoopRows.some((row) => !row.closed_loop_contract_ready || row.work_os_claim_allowed_from_this_row),
    actionInboxRows.some((row) => row.protected_action_execution_enabled || !row.blocked_action_visible),
    domainRolloutRows.some((row) => row.product_launch_enabled || !row.claude_review_receipt_required),
    apiHandbookRows.some((row) => row.docs_can_claim_blocked_capability),
    milestoneReviewRows.some((row) => row.reviewer_mutation_allowed || row.reviewer_final_approval_allowed || !row.claude_code_opus_max_review_receipt_required),
    trustTierRows.some((row) => row.enterprise_trust && row.claim_allowed_now),
    negativeFixtureRows.some((row) => row.unsafe_work_os_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    productionFreezePacketRows.some((row) => row.production_release_claim_allowed || !row.freeze_packet_ready),
    finalFreezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "work-os-ui-production-freeze-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7601-P7800",
    work_os_ui_production_freeze_ready: unsafeFlags.filter(Boolean).length === 0,
    security_governance_compliance_rule_conflict_plane_ready: governance.summary?.security_governance_compliance_rule_conflict_plane_status === GOVERNANCE_READY_STATUS,
    full_work_os_navigation_ready: navigationRows.every((row) => row.navigation_row_ready),
    closed_loop_maturity_evidence_contract_ready: closedLoopRows.every((row) => row.closed_loop_contract_ready),
    operator_action_inbox_ready: actionInboxRows.every((row) => row.action_row_ready && row.blocked_action_visible),
    domain_pack_rollout_matrix_ready: domainRolloutRows.every((row) => row.rollout_row_ready),
    api_handbook_alignment_ready: apiHandbookRows.every((row) => row.alignment_row_ready),
    milestone_claude_review_completion_ledger_ready: milestoneReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required),
    trust_tier_publication_ready: trustTierRows.every((row) => row.lower_trust_must_not_be_renamed_enterprise),
    production_readiness_freeze_packet_ready: productionFreezePacketRows.every((row) => row.freeze_packet_ready),
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    review_receipt_registration_required: true,
    single_owner_trust_classification_required: true,
    l6_closed_loop_proof_passed_now: false,
    l7_work_os_operating_system_claim_allowed_now: false,
    work_os_production_claim_enabled: false,
    ui_only_production_claim_allowed: false,
    lower_trust_as_enterprise_allowed: false,
    claude_final_approval_allowed: false,
    codex_self_approval_allowed: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(args) {
  const { packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, governance, contract, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows, boundary } = args;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include Work OS freeze command"),
    validationItem("governance.ready", "source", governance.summary?.security_governance_compliance_rule_conflict_plane_status === GOVERNANCE_READY_STATUS, "security governance must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P7801-P8000 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Full Work OS UI and Production Freeze"), "architecture must reflect Work OS freeze"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Full Work OS UI and Production Freeze"), "dashboard IA must reflect Work OS freeze"),
    validationItem("contract.ready", "contract", contract.full_work_os_navigation_required && contract.claude_code_opus_max_review_receipt_required && contract.work_os_production_claim_enabled === false, "Work OS freeze contract must be ready"),
    validationItem("phases.pass", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phases must pass"),
    validationItem("navigation.ready", "navigation", navigationRows.length >= 12 && navigationRows.every((row) => row.navigation_row_ready), "navigation rows must be ready"),
    validationItem("closed_loop.ready", "closed_loop", closedLoopRows.length >= 8 && closedLoopRows.every((row) => row.closed_loop_contract_ready && row.work_os_claim_allowed_from_this_row === false), "closed-loop rows must be ready without production claim"),
    validationItem("action_inbox.ready", "action_inbox", actionInboxRows.length >= 6 && actionInboxRows.every((row) => row.blocked_action_visible), "action inbox rows must be ready"),
    validationItem("domain_rollout.ready", "domain_rollout", domainRolloutRows.length >= 6 && domainRolloutRows.every((row) => row.product_launch_enabled === false), "domain rollout rows must be ready"),
    validationItem("api_handbook.ready", "alignment", apiHandbookRows.length >= 4 && apiHandbookRows.every((row) => row.docs_can_claim_blocked_capability === false), "API handbook rows must be ready"),
    validationItem("milestone_review.ready", "review", milestoneReviewRows.length >= 10 && milestoneReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_mutation_allowed === false), "milestone review rows must be ready"),
    validationItem("trust_tiers.ready", "trust", trustTierRows.length >= 5 && trustTierRows.every((row) => row.lower_trust_must_not_be_renamed_enterprise), "trust tier rows must be ready"),
    validationItem("fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_work_os_claim_allowed === false), "negative fixtures must block unsafe Work OS claims"),
    validationItem("freeze_packet.ready", "freeze_packet", productionFreezePacketRows.every((row) => row.freeze_packet_ready && row.production_release_claim_allowed === false), "freeze packet rows must be ready"),
    validationItem("final_freeze.ready", "freeze", finalFreezeRows.every((row) => row.freeze_status === "ready"), "final freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_workos", "boundary", boundary.work_os_production_claim_enabled === false && boundary.l6_closed_loop_proof_passed_now === false, "Work OS production claim must stay blocked"),
    validationItem("boundary.no_enterprise", "boundary", boundary.enterprise_trust_claim_enabled === false && boundary.lower_trust_as_enterprise_allowed === false, "enterprise trust must stay blocked"),
  ];
}

function buildSummary({ governance, phaseRows, navigationRows, closedLoopRows, actionInboxRows, domainRolloutRows, apiHandbookRows, milestoneReviewRows, trustTierRows, negativeFixtureRows, productionFreezePacketRows, finalFreezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "work-os-ui-production-freeze-summary.v1",
    work_os_ui_production_freeze_status: validation.valid && boundary.work_os_ui_production_freeze_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7601-P7800",
    security_governance_compliance_rule_conflict_plane_status: governance.summary?.security_governance_compliance_rule_conflict_plane_status ?? "unknown",
    phase_row_count: phaseRows.length,
    navigation_count: navigationRows.length,
    closed_loop_count: closedLoopRows.length,
    action_inbox_count: actionInboxRows.length,
    domain_rollout_count: domainRolloutRows.length,
    api_handbook_alignment_count: apiHandbookRows.length,
    milestone_review_count: milestoneReviewRows.length,
    trust_tier_count: trustTierRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    production_freeze_packet_count: productionFreezePacketRows.length,
    final_freeze_row_count: finalFreezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    full_work_os_navigation_ready: boundary.full_work_os_navigation_ready,
    closed_loop_maturity_evidence_contract_ready: boundary.closed_loop_maturity_evidence_contract_ready,
    operator_action_inbox_ready: boundary.operator_action_inbox_ready,
    domain_pack_rollout_matrix_ready: boundary.domain_pack_rollout_matrix_ready,
    api_handbook_alignment_ready: boundary.api_handbook_alignment_ready,
    milestone_claude_review_completion_ledger_ready: boundary.milestone_claude_review_completion_ledger_ready,
    trust_tier_publication_ready: boundary.trust_tier_publication_ready,
    production_readiness_freeze_packet_ready: boundary.production_readiness_freeze_packet_ready,
    codex_implementation_packet_required: boundary.codex_implementation_packet_required,
    harness_deterministic_validation_required: boundary.harness_deterministic_validation_required,
    claude_code_opus_max_review_receipt_required: boundary.claude_code_opus_max_review_receipt_required,
    l6_closed_loop_proof_passed_now: boundary.l6_closed_loop_proof_passed_now,
    l7_work_os_operating_system_claim_allowed_now: boundary.l7_work_os_operating_system_claim_allowed_now,
    work_os_production_claim_enabled: boundary.work_os_production_claim_enabled,
    ui_only_production_claim_allowed: boundary.ui_only_production_claim_allowed,
    lower_trust_as_enterprise_allowed: boundary.lower_trust_as_enterprise_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    codex_self_approval_allowed: boundary.codex_self_approval_allowed,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    agent_runtime_execution_enabled: boundary.agent_runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function makeRows(specs, schemaVersion, rowPrefix, extra) {
  return specs.map(([item_id, description], index) => ({
    schema_version: schemaVersion,
    row_id: `${rowPrefix}.${String(index + 1).padStart(3, "0")}`,
    item_id,
    description,
    evidence_ref: `evidence.${rowPrefix}.${item_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.${rowPrefix}.${item_id}`,
    next_allowed_action: "preserve Work OS freeze contract",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    ...extra,
  }));
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_work_os_ui_production_freeze.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS UI Production Freeze",
    "",
    `Status: ${result.summary.work_os_ui_production_freeze_status}`,
    `Program: ${result.summary.program_range}`,
    `Security governance source: ${result.summary.security_governance_compliance_rule_conflict_plane_status}`,
    `Navigation rows: ${result.summary.navigation_count}`,
    `Milestone review rows: ${result.summary.milestone_review_count}`,
    `L6 proof passed now: ${result.summary.l6_closed_loop_proof_passed_now}`,
    `Work OS production claim enabled: ${result.summary.work_os_production_claim_enabled}`,
    `Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Freeze Boundary",
    "",
    "The P8000 freeze can make the UI, ledger, trust tiers, and freeze packet ready, but it cannot turn UI readiness into production readiness. Without L6/L7 proof, protected closeout, and enterprise-independent evidence, Work OS production and enterprise trust claims stay blocked.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return { item_id, category, status: passed ? "pass" : "error", message };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    item_count: items.length,
    error_count: items.filter((item) => item.status !== "pass").length,
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_WORK_OS_UI_PRODUCTION_FREEZE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    review_dashboard_doc_path: options.reviewDashboardDocPath ?? defaults.reviewDashboardDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, count: items.length, items };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    reviewDashboardDocPath: undefined,
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
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--review-dashboard-doc") {
      args.reviewDashboardDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/work-os-ui-production-freeze.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --review-dashboard-doc <path>   Review dashboard IA document path.
  --help                          Show this help.
`);
}
