import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentRuntimeActivationBridge } from "./platform-agent-runtime-activation-bridge.mjs";

export const DEFAULT_PLATFORM_DOMAIN_AGENT_NO_WRITE_PILOT_OUT_DIR = "artifacts/platform-domain-agent-no-write-pilot/latest";
export const DEFAULT_PLATFORM_DOMAIN_AGENT_NO_WRITE_PILOT_INPUTS = {
  schemaPath: "schemas/platform-domain-agent-no-write-pilot.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:domain-agent-no-write-pilot";
const SOURCE_COMMAND_NAME = "platform:agent-runtime-activation-bridge";
const SCHEMA_VERSION = "platform-domain-agent-no-write-pilot.v1";
const CAPABILITY_ID = "platform.agent_domain.no_write_pilot";
const PROGRAM_RANGE = "P1321-P1440";
const PHASE_RANGE = "P1321-P1440";
const PHASE_SLOT = "P1321";
const PREVIOUS_PHASE_SLOT = "P1320";
const NEXT_PHASE_SLOT = "P1441";
const SOURCE_READY_STATUS = "ready_for_agent_runtime_activation_bridge";
const READY_STATUS = "ready_for_agent_domain_no_write_pilot_freeze";

const PHASE_SPECS = [
  ["personal_dev_agent_pilot", "P1321-P1340", "personal-dev issue, plan, diff, test, rollback, and release note candidates"],
  ["law_firm_agent_pilot", "P1341-P1360", "law-firm VDR/LDD, citation, review packet, and attorney queue candidates"],
  ["creative_document_agent_pilot", "P1361-P1380", "creative-document template, style, layout, and output review candidates"],
  ["resource_connector_agent_pilot", "P1381-P1400", "resource and connector ingestion, classification, quarantine, and evidence candidates"],
  ["trading_agent_pilot", "P1401-P1420", "trading read-only safety, evidence, backtest review, risk, and shadow candidates"],
  ["domain_pilot_freeze", "P1421-P1440", "all domain pilots close as no-write PASS/BLOCK rows"],
];

const DOMAIN_SPECS = [
  {
    domain_id: "personal-dev",
    phase_range: "P1321-P1340",
    owner: "personal-dev.owner",
    reviewer: "reviewer.platform.domain_pilot.personal_dev",
    human_review_required: true,
    raw_material_label: "repo refs and redacted summaries only",
    capabilities: [
      ["issue_intake_candidate", "create issue intake candidate from normalized project refs"],
      ["plan_candidate", "draft implementation plan candidate"],
      ["diff_review_candidate", "draft diff review packet without applying changes"],
      ["test_plan_candidate", "draft test plan and expected command evidence refs"],
      ["rollback_candidate", "draft rollback target and recovery packet"],
      ["release_note_candidate", "draft release note candidate without publishing"],
    ],
  },
  {
    domain_id: "law-firm",
    phase_range: "P1341-P1360",
    owner: "law-firm.owner",
    reviewer: "reviewer.platform.domain_pilot.law_firm",
    human_review_required: true,
    raw_material_label: "source-span refs only; no raw client/VDR material",
    capabilities: [
      ["vdr_ldd_candidate", "draft VDR/LDD inventory and issue packet through source refs"],
      ["citation_packet_candidate", "draft citation support packet"],
      ["review_packet_candidate", "draft attorney review packet"],
      ["risk_issue_candidate", "draft legal issue/risk candidate without legal final judgment"],
      ["attorney_queue_candidate", "route candidate output to attorney/human review queue"],
    ],
  },
  {
    domain_id: "creative-document",
    phase_range: "P1361-P1380",
    owner: "creative-document.owner",
    reviewer: "reviewer.platform.domain_pilot.creative_document",
    human_review_required: true,
    raw_material_label: "template/style refs and redacted output summaries only",
    capabilities: [
      ["template_mapping_candidate", "draft template mapping candidate"],
      ["style_review_candidate", "draft style review packet"],
      ["layout_plan_candidate", "draft layout plan candidate"],
      ["output_quality_candidate", "draft output quality review packet"],
      ["export_review_candidate", "draft export review candidate without final export"],
    ],
  },
  {
    domain_id: "connectors-resource",
    phase_range: "P1381-P1400",
    owner: "connectors-resource.owner",
    reviewer: "reviewer.platform.domain_pilot.connectors_resource",
    human_review_required: true,
    raw_material_label: "quarantined resource refs and evidence summaries only",
    capabilities: [
      ["ingestion_candidate", "draft ingestion candidate without connector write"],
      ["classification_candidate", "draft classification candidate"],
      ["quarantine_packet_candidate", "draft quarantine review packet"],
      ["evidence_surface_candidate", "draft evidence surface candidate"],
      ["connector_policy_candidate", "draft connector policy review packet"],
    ],
  },
  {
    domain_id: "trading",
    phase_range: "P1401-P1420",
    owner: "trading.owner",
    reviewer: "reviewer.platform.domain_pilot.trading",
    human_review_required: true,
    raw_material_label: "read-only safety/evidence refs only",
    capabilities: [
      ["safety_evidence_candidate", "draft read-only safety evidence packet"],
      ["backtest_review_candidate", "draft backtest review packet"],
      ["risk_report_candidate", "draft risk report review packet"],
      ["promotion_readiness_candidate", "draft promotion readiness candidate without promotion"],
      ["shadow_report_candidate", "draft shadow report candidate without live action"],
    ],
  },
  {
    domain_id: "project.zendd",
    phase_range: "P1281-P1300/P1421-P1440",
    owner: "project.zendd.owner",
    reviewer: "reviewer.platform.domain_pilot.project_zendd",
    human_review_required: true,
    raw_material_label: "external project source refs only; no direct checkout write",
    capabilities: [
      ["work_order_candidate", "draft Zendd work order candidate"],
      ["diff_review_candidate", "draft Zendd diff review candidate without applying patch"],
      ["rollback_plan_candidate", "draft Zendd rollback plan candidate"],
      ["command_evidence_candidate", "draft Zendd command evidence packet without execution"],
      ["vdr_ldd_review_candidate", "draft Zendd VDR/LDD review packet through source refs"],
      ["release_sandbox_candidate", "draft Zendd release sandbox candidate without publish"],
    ],
  },
];

const PROTECTED_BLOCK_SPECS = [
  ["personal-dev.pr_create", "pr_create_forbidden", "draft PR packet only; human receipt required before create"],
  ["personal-dev.merge_release", "merge_or_release_forbidden", "route merge/release through human owner"],
  ["personal-dev.command_execution", "command_execution_requires_receipt", "create command evidence packet only"],
  ["law-firm.legal_final_pass", "legal_final_judgment_forbidden", "route to attorney review"],
  ["law-firm.client_advice", "client_advice_forbidden", "route to qualified human legal reviewer"],
  ["law-firm.filing_or_final_output", "filing_or_final_output_forbidden", "collect attorney/client-facing output receipt"],
  ["law-firm.raw_vdr_client_material", "raw_client_or_vdr_material_forbidden", "use source-span refs and redacted summaries"],
  ["creative-document.file_write", "document_file_write_forbidden", "draft output packet only"],
  ["creative-document.client_delivery", "client_delivery_requires_receipt", "queue delivery receipt"],
  ["creative-document.export_finalization", "export_finalization_forbidden", "route export through human-approved lane"],
  ["connectors-resource.raw_export", "raw_resource_export_forbidden", "route through quarantine review packet"],
  ["connectors-resource.connector_write", "connector_write_forbidden", "keep connector write disabled"],
  ["connectors-resource.secret_read", "secret_read_forbidden", "use secret-handle refs only"],
  ["trading.live_order", "live_order_submission_forbidden", "keep live adapter disabled"],
  ["trading.broker_exchange_write", "broker_or_exchange_write_forbidden", "keep broker/exchange writes disabled"],
  ["trading.full_auto_or_promotion", "full_auto_or_promotion_forbidden", "route promotion through governance receipt"],
  ["project.zendd.direct_write", "direct_zendd_mutation_forbidden", "use safe patch lane with human receipt later"],
  ["project.zendd.raw_vdr_read", "raw_client_or_vdr_material_forbidden", "use VDR/LDD source-span refs only"],
  ["platform.agent_final_pass", "agent_final_authority_forbidden", "route final PASS through human owner and freeze"],
  ["platform.receipt_application", "agent_receipt_application_forbidden", "validate receipt but do not let Agent apply it"],
];

export async function runPlatformDomainAgentNoWritePilot(options = {}) {
  const result = await buildPlatformDomainAgentNoWritePilot(options);
  if (options.write !== false) await writePlatformDomainAgentNoWritePilot(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform domain Agent no-write pilot failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformDomainAgentNoWritePilot(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_DOMAIN_AGENT_NO_WRITE_PILOT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const activationLedger = await readTextSource(inputs.activation_bridge_ledger_path);
  const domainPilotLedger = await readTextSource(inputs.domain_pilot_ledger_path);
  const sourceActivationBridge = options.sourceActivationBridge ?? await buildPlatformAgentRuntimeActivationBridge({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentRuntimeActivationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    write: false,
  });

  const phaseRows = buildPhaseRows();
  const domainRows = buildDomainPilotRows();
  const capabilityRows = buildCapabilityRows();
  const humanGateRows = buildHumanGateRows();
  const boundaryRows = buildBoundaryRows();
  const protectedBlockRows = buildProtectedBlockRows();
  const freezeRows = buildFreezeRows({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows });
  const claimRows = buildClaimRows({ phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, freezeRows, protectedBlockRows });
  const anchor = buildAnchor({ packageJson, activationLedger, domainPilotLedger, sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows });
  const gateRows = buildGateRows({ packageJson, activationLedger, domainPilotLedger, sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows });
  const boundary = buildBoundary({ sourceActivationBridge, domainRows, capabilityRows, boundaryRows, protectedBlockRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_domain_agent_no_write_pilot_id: `platform-domain-agent-no-write-pilot.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    domain_agent_no_write_pilot_anchor: anchor,
    source_agent_runtime_activation_bridge_summary: sourceActivationBridge.summary,
    domain_agent_no_write_phase_rows: phaseRows,
    domain_agent_no_write_domain_rows: domainRows,
    domain_agent_no_write_capability_rows: capabilityRows,
    domain_agent_no_write_human_gate_rows: humanGateRows,
    domain_agent_no_write_boundary_rows: boundaryRows,
    domain_agent_no_write_protected_block_rows: protectedBlockRows,
    domain_agent_no_write_freeze_rows: freezeRows,
    domain_agent_no_write_claim_rows: claimRows,
    domain_agent_no_write_gate_rows: gateRows,
    domain_agent_no_write_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_domain_agent_no_write_pilot")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_domain_agent_no_write_pilot_id = result.platform_domain_agent_no_write_pilot_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformDomainAgentNoWritePilot(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-domain-agent-no-write-pilot.json"), serializableResult(result));
  await writeJson(path.join(outDir, "domain-agent-no-write-phase-rows.json"), collectionEnvelope("domain-agent-no-write-phase-rows.v1", "domain_agent_no_write_phase_rows", result.domain_agent_no_write_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-domain-rows.json"), collectionEnvelope("domain-agent-no-write-domain-rows.v1", "domain_agent_no_write_domain_rows", result.domain_agent_no_write_domain_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-capability-rows.json"), collectionEnvelope("domain-agent-no-write-capability-rows.v1", "domain_agent_no_write_capability_rows", result.domain_agent_no_write_capability_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-human-gate-rows.json"), collectionEnvelope("domain-agent-no-write-human-gate-rows.v1", "domain_agent_no_write_human_gate_rows", result.domain_agent_no_write_human_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-boundary-rows.json"), collectionEnvelope("domain-agent-no-write-boundary-rows.v1", "domain_agent_no_write_boundary_rows", result.domain_agent_no_write_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-protected-block-rows.json"), collectionEnvelope("domain-agent-no-write-protected-block-rows.v1", "domain_agent_no_write_protected_block_rows", result.domain_agent_no_write_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-freeze-rows.json"), collectionEnvelope("domain-agent-no-write-freeze-rows.v1", "domain_agent_no_write_freeze_rows", result.domain_agent_no_write_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-claim-rows.json"), collectionEnvelope("domain-agent-no-write-claim-rows.v1", "domain_agent_no_write_claim_rows", result.domain_agent_no_write_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-gate-rows.json"), collectionEnvelope("domain-agent-no-write-gate-rows.v1", "domain_agent_no_write_gate_rows", result.domain_agent_no_write_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-no-write-boundary.json"), result.domain_agent_no_write_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-domain-agent-no-write-pilot-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformDomainAgentNoWritePilotCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformDomainAgentNoWritePilot(args);
    console.log(`Platform domain Agent no-write pilot ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_domain_agent_no_write_pilot_status}`);
    console.log(`Domains: ${result.summary.domain_count}`);
    console.log(`Capability candidates: ${result.summary.capability_candidate_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.agent_runtime_execution_allowed_now}`);
    console.log(`Write action allowed: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPhaseRows() {
  return PHASE_SPECS.map(([phase_id, phase_range, description], index) => passRow({
    schema_version: "domain-agent-no-write-phase-row.v1",
    row_id: `domain-agent-no-write.phase.row.${String(index + 1).padStart(2, "0")}`,
    phase_id,
    phase_range,
    description,
    source_ready_status_required: SOURCE_READY_STATUS,
    evidence_ref: `evidence.platform.domain_agent_no_write.phase.${phase_id}`,
    reviewer_ref: "reviewer.platform.domain_agent_no_write_phase",
    hard_gate_ref: `gate.platform.domain_agent_no_write.phase.${phase_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "keep phase row attached to domain no-write pilot freeze",
  }));
}

function buildDomainPilotRows() {
  return DOMAIN_SPECS.map((domain, index) => passRow({
    schema_version: "domain-agent-no-write-domain-row.v1",
    row_id: `domain-agent-no-write.domain.row.${String(index + 1).padStart(2, "0")}`,
    domain_id: domain.domain_id,
    phase_range: domain.phase_range,
    pilot_status: "ready_as_no_write_candidate",
    rollout_level: "L0_no_write",
    human_review_required: domain.human_review_required,
    raw_material_policy: domain.raw_material_label,
    capability_candidate_count: domain.capabilities.length,
    runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    tool_execution_allowed_now: false,
    write_action_allowed_now: false,
    raw_secret_allowed_now: false,
    raw_client_or_vdr_material_allowed_now: false,
    protected_action_allowed_now: false,
    final_pass_by_agent_allowed_now: false,
    evidence_ref: `evidence.platform.domain_agent_no_write.domain.${domain.domain_id}`,
    reviewer_ref: domain.reviewer,
    hard_gate_ref: `gate.platform.domain_agent_no_write.domain.${domain.domain_id}`,
    responsible_owner: domain.owner,
    next_allowed_action: "surface no-write domain pilot candidates to P1441 operator visibility",
  }));
}

function buildCapabilityRows() {
  const rows = [];
  for (const domain of DOMAIN_SPECS) {
    for (const [capability_id, description] of domain.capabilities) {
      rows.push(passRow({
        schema_version: "domain-agent-no-write-capability-row.v1",
        row_id: `domain-agent-no-write.capability.row.${String(rows.length + 1).padStart(3, "0")}`,
        domain_id: domain.domain_id,
        capability_id,
        phase_range: domain.phase_range,
        candidate_status: "draft_or_review_packet_only",
        description,
        allowed_inputs: ["normalized_refs", "policy_rows", "source_span_refs", "redacted_summaries"],
        allowed_outputs: ["work_order_candidate", "evidence_candidate", "review_packet_candidate", "rollback_candidate", "next_allowed_action"],
        receipt_payload_present: false,
        human_receipt_required_before_action: true,
        runtime_execution_allowed_now: false,
        terminal_execution_allowed_now: false,
        tool_execution_allowed_now: false,
        file_write_allowed_now: false,
        connector_write_allowed_now: false,
        direct_zendd_mutation_allowed_now: false,
        legal_final_judgment_allowed_now: false,
        release_decision_allowed_now: false,
        live_trading_action_allowed_now: false,
        final_pass_by_agent_allowed_now: false,
        evidence_ref: `evidence.platform.domain_agent_no_write.capability.${domain.domain_id}.${capability_id}`,
        reviewer_ref: domain.reviewer,
        hard_gate_ref: `gate.platform.domain_agent_no_write.capability.${domain.domain_id}.${capability_id}`,
        responsible_owner: domain.owner,
        next_allowed_action: "keep capability as no-write candidate until future operator/human receipt lane",
      }));
    }
  }
  return rows;
}

function buildHumanGateRows() {
  return DOMAIN_SPECS.map((domain, index) => passRow({
    schema_version: "domain-agent-no-write-human-gate-row.v1",
    row_id: `domain-agent-no-write.human_gate.row.${String(index + 1).padStart(2, "0")}`,
    domain_id: domain.domain_id,
    human_gate_ref: `human_gate.platform.domain_agent_no_write.${domain.domain_id}`,
    human_review_required: true,
    receipt_required_before_action: true,
    receipt_payload_present: false,
    receipt_applied: false,
    evidence_ref: `evidence.platform.domain_agent_no_write.human_gate.${domain.domain_id}`,
    reviewer_ref: domain.reviewer,
    hard_gate_ref: `gate.platform.domain_agent_no_write.human_gate.${domain.domain_id}`,
    responsible_owner: domain.owner,
    next_allowed_action: "show missing receipt and next action in P1441 operator surface",
  }));
}

function buildBoundaryRows() {
  return DOMAIN_SPECS.map((domain, index) => passRow({
    schema_version: "domain-agent-no-write-boundary-row.v1",
    row_id: `domain-agent-no-write.boundary.row.${String(index + 1).padStart(2, "0")}`,
    domain_id: domain.domain_id,
    no_write_boundary_status: "active",
    runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    package_install_allowed_now: false,
    provider_secret_setup_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_client_or_vdr_access_allowed_now: false,
    file_write_allowed_now: false,
    connector_write_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    live_trading_action_allowed_now: false,
    final_pass_by_agent_allowed_now: false,
    evidence_ref: `evidence.platform.domain_agent_no_write.boundary.${domain.domain_id}`,
    reviewer_ref: domain.reviewer,
    hard_gate_ref: `gate.platform.domain_agent_no_write.boundary.${domain.domain_id}`,
    responsible_owner: domain.owner,
    next_allowed_action: "preserve no-write boundary until P1441 operator visibility and later P2041 limited execution",
  }));
}

function buildProtectedBlockRows() {
  return PROTECTED_BLOCK_SPECS.map(([protected_block_id, block_reason, next_allowed_action], index) => ({
    schema_version: "domain-agent-no-write-protected-block-row.v1",
    row_id: `domain-agent-no-write.protected_block.row.${String(index + 1).padStart(2, "0")}`,
    protected_block_id,
    domain_id: protected_block_id.split(".")[0],
    current_verdict: "blocked",
    block_reason,
    documented_human_gate_ref: `human_gate.platform.domain_agent_no_write.${protected_block_id.replaceAll(".", "_")}`,
    action_allowed_now: false,
    evidence_ref: `evidence.platform.domain_agent_no_write.protected_block.${protected_block_id}`,
    reviewer_ref: "reviewer.platform.domain_agent_no_write_protected_block",
    hard_gate_ref: `gate.platform.domain_agent_no_write.protected_block.${protected_block_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFreezeRows({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows }) {
  const checks = [
    ["source_activation_bridge_ready", sourceActivationBridge.summary.platform_agent_runtime_activation_bridge_status === SOURCE_READY_STATUS, "source activation bridge is ready"],
    ["phase_rows_complete", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all domain pilot phase rows are present"],
    ["domain_rows_ready", domainRows.length === DOMAIN_SPECS.length && domainRows.every((row) => row.current_verdict === "pass"), "all domain pilot rows are ready"],
    ["capability_candidates_ready", capabilityRows.length === 32 && capabilityRows.every((row) => row.current_verdict === "pass"), "all no-write capability candidates are ready"],
    ["human_gates_ready", humanGateRows.every((row) => row.human_review_required && row.receipt_payload_present === false), "human gates are documented without receipts"],
    ["boundary_rows_safe", boundaryRows.every((row) => row.runtime_execution_allowed_now === false && row.file_write_allowed_now === false), "domain no-write boundaries are safe"],
    ["protected_blocks_documented", protectedBlockRows.length === PROTECTED_BLOCK_SPECS.length && protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "protected actions are documented BLOCK rows"],
    ["no_runtime_execution", sourceActivationBridge.summary.agent_runtime_execution_allowed_now === false, "runtime execution remains disabled"],
    ["no_zendd_write", sourceActivationBridge.summary.direct_zendd_mutation_allowed_now === false, "direct Zendd mutation remains disabled"],
    ["no_final_authority", sourceActivationBridge.summary.agent_final_pass_allowed_now === false, "Agent final authority remains disabled"],
    ["ready_for_operator_visibility", true, "domain pilot freeze can feed P1441 operator surface"],
    ["ready_for_p1500_activation_closeout", true, "domain pilot freeze can feed P1481-P1500 Agent console freeze"],
  ];
  return checks.map(([freeze_id, pass, description], index) => pass ? passRow({
    schema_version: "domain-agent-no-write-freeze-row.v1",
    row_id: `domain-agent-no-write.freeze.row.${String(index + 1).padStart(2, "0")}`,
    freeze_id,
    description,
    evidence_ref: `evidence.platform.domain_agent_no_write.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.platform.domain_agent_no_write_freeze",
    hard_gate_ref: `gate.platform.domain_agent_no_write.freeze.${freeze_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "keep freeze evidence attached",
  }) : {
    schema_version: "domain-agent-no-write-freeze-row.v1",
    row_id: `domain-agent-no-write.freeze.row.${String(index + 1).padStart(2, "0")}`,
    freeze_id,
    current_verdict: "blocked",
    description,
    block_reason: `freeze_check_failed.${freeze_id}`,
    evidence_ref: `evidence.platform.domain_agent_no_write.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.platform.domain_agent_no_write_freeze",
    hard_gate_ref: `gate.platform.domain_agent_no_write.freeze.${freeze_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: `repair ${freeze_id} before P1440 closeout`,
    unsafe_flags_false: false,
    verdict_authority: "harness_only",
  });
}

function buildClaimRows({ phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, freezeRows, protectedBlockRows }) {
  const passSources = [
    ...phaseRows.map((row) => ["phase", row.phase_id, row]),
    ...domainRows.map((row) => ["domain_pilot", row.domain_id, row]),
    ...capabilityRows.map((row) => ["capability_candidate", `${row.domain_id}.${row.capability_id}`, row]),
    ...humanGateRows.map((row) => ["human_gate", row.domain_id, row]),
    ...boundaryRows.map((row) => ["no_write_boundary", row.domain_id, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = protectedBlockRows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claim_type, claim_id, row], index) => ({
    schema_version: "domain-agent-no-write-claim-row.v1",
    row_id: `domain-agent-no-write.claim.row.${String(index + 1).padStart(3, "0")}`,
    claim_type,
    claim_id,
    domain_id: row.domain_id ?? "platform",
    current_verdict: row.current_verdict,
    block_reason: row.current_verdict === "blocked" ? row.block_reason : null,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: row.unsafe_flags_false === true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, activationLedger, domainPilotLedger, sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows }) {
  return {
    schema_version: "domain-agent-no-write-pilot-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    activation_bridge_ledger_present: activationLedger.available,
    domain_pilot_ledger_present: domainPilotLedger.available,
    source_activation_bridge_status: sourceActivationBridge.summary.platform_agent_runtime_activation_bridge_status,
    phase_count: phaseRows.length,
    domain_count: domainRows.length,
    capability_candidate_count: capabilityRows.length,
    human_gate_count: humanGateRows.length,
    boundary_row_count: boundaryRows.length,
    protected_block_count: protectedBlockRows.length,
    freeze_count: freezeRows.length,
    claim_count: claimRows.length,
  };
}

function buildGateRows({ packageJson, activationLedger, domainPilotLedger, sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json registers domain no-write command"],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes domain no-write check"],
    ["activation_bridge_ledger_present", activationLedger.available && activationLedger.text.includes("P1201-P1320"), "activation bridge ledger exists"],
    ["domain_pilot_ledger_present", domainPilotLedger.available && ["P1321-P1440", "P1321-P1340", "P1421-P1440", COMMAND_NAME].every((token) => domainPilotLedger.text.includes(token)), "domain pilot ledger declares full range"],
    ["source_activation_ready", sourceActivationBridge.summary.platform_agent_runtime_activation_bridge_status === SOURCE_READY_STATUS, "source activation bridge is ready"],
    ["phase_rows_ready", phaseRows.every((row) => row.current_verdict === "pass"), "phase rows pass"],
    ["domain_rows_ready", domainRows.every((row) => row.current_verdict === "pass"), "domain rows pass"],
    ["capability_rows_ready", capabilityRows.length === 32 && capabilityRows.every((row) => row.current_verdict === "pass"), "capability rows pass"],
    ["human_gate_rows_ready", humanGateRows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), "human gate rows pass"],
    ["boundary_rows_safe", boundaryRows.every((row) => row.current_verdict === "pass" && row.file_write_allowed_now === false), "boundary rows safe"],
    ["protected_blocks_ready", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "protected blocks ready"],
    ["claims_supported", claimRows.every(isSupportedClaim), "claims support PASS/BLOCK fields"],
    ["freeze_rows_ready", freezeRows.every((row) => row.current_verdict === "pass"), "freeze rows pass"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "domain-agent-no-write-gate-row.v1",
    row_id: `domain-agent-no-write.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.domain_agent_no_write.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform.domain_agent_no_write_gate",
    hard_gate_ref: `gate.platform.domain_agent_no_write.${gate_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1440 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceActivationBridge, domainRows, capabilityRows, boundaryRows, protectedBlockRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    sourceActivationBridge.summary.agent_runtime_execution_allowed_now,
    sourceActivationBridge.summary.direct_zendd_mutation_allowed_now,
    sourceActivationBridge.summary.protected_action_execution_allowed_now,
    sourceActivationBridge.summary.agent_final_pass_allowed_now,
    domainRows.some((row) => row.write_action_allowed_now || row.final_pass_by_agent_allowed_now),
    capabilityRows.some((row) => row.file_write_allowed_now || row.live_trading_action_allowed_now || row.final_pass_by_agent_allowed_now),
    boundaryRows.some((row) => row.file_write_allowed_now || row.raw_secret_read_allowed_now || row.direct_zendd_mutation_allowed_now),
    protectedBlockRows.some((row) => row.action_allowed_now),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "domain-agent-no-write-boundary.v1",
    domain_no_write_pilot_ready_for_operator_visibility: freezeRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    source_activation_bridge_status: sourceActivationBridge.summary.platform_agent_runtime_activation_bridge_status,
    receipt_payload_present: false,
    receipt_applied: false,
    agent_runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    package_install_allowed_now: false,
    provider_secret_setup_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_client_or_vdr_access_allowed_now: false,
    write_action_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    live_trading_action_allowed_now: false,
    agent_final_pass_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary }) {
  return [
    validationItem("source.activation_bridge", "source_ready", sourceActivationBridge.summary.platform_agent_runtime_activation_bridge_status === SOURCE_READY_STATUS, "source activation bridge must be ready"),
    validationItem("phase.count", "phase_rows", phaseRows.length === PHASE_SPECS.length, "all domain pilot phase rows must exist"),
    validationItem("domain.count", "domain_rows", domainRows.length === DOMAIN_SPECS.length, "all domain pilot rows must exist"),
    validationItem("capability.count", "capability_rows", capabilityRows.length === 32, "all capability candidate rows must exist"),
    validationItem("human_gates.ready", "human_gate_rows", humanGateRows.every((row) => row.receipt_payload_present === false && row.receipt_applied === false), "human gates cannot contain receipt payloads"),
    validationItem("boundary.rows_safe", "boundary_rows", boundaryRows.every((row) => row.file_write_allowed_now === false && row.raw_secret_read_allowed_now === false), "boundary rows must be no-write and no-raw-secret"),
    validationItem("protected.blocks", "protected_blocks", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "protected rows must be blocked"),
    validationItem("claims.supported", "claims", claimRows.every(isSupportedClaim), "all claims must support PASS/BLOCK contract"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gate rows must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function isSupportedClaim(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  return false;
}

function buildSummary({ sourceActivationBridge, phaseRows, domainRows, capabilityRows, humanGateRows, boundaryRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary, validation }) {
  return {
    schema_version: "platform-domain-agent-no-write-pilot-summary.v1",
    platform_domain_agent_no_write_pilot_status: validation.valid && boundary.domain_no_write_pilot_ready_for_operator_visibility ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_activation_bridge_status: sourceActivationBridge.summary.platform_agent_runtime_activation_bridge_status,
    phase_count: phaseRows.length,
    domain_count: domainRows.length,
    capability_candidate_count: capabilityRows.length,
    human_gate_count: humanGateRows.length,
    boundary_row_count: boundaryRows.length,
    protected_block_count: protectedBlockRows.length,
    freeze_count: freezeRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    receipt_payload_present: boundary.receipt_payload_present,
    agent_runtime_execution_allowed_now: boundary.agent_runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    direct_zendd_mutation_allowed_now: boundary.direct_zendd_mutation_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    legal_final_judgment_allowed_now: boundary.legal_final_judgment_allowed_now,
    release_decision_allowed_now: boundary.release_decision_allowed_now,
    live_trading_action_allowed_now: boundary.live_trading_action_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Domain Agent No-Write Pilot",
    "",
    `Status: ${result.summary.platform_domain_agent_no_write_pilot_status}`,
    `Program: ${result.summary.program_range}`,
    `Source activation bridge status: ${result.summary.source_activation_bridge_status}`,
    `Domains: ${result.summary.domain_count}`,
    `Capability candidates: ${result.summary.capability_candidate_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Feed P1441-P1500 Agent Operator Console v0 with domain pilot status, missing receipts, block reasons, and next allowed actions.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_DOMAIN_AGENT_NO_WRITE_PILOT_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    activation_bridge_ledger_path: options.activationBridgeLedgerPath ?? defaults.activationBridgeLedgerPath,
    domain_pilot_ledger_path: options.domainPilotLedgerPath ?? defaults.domainPilotLedgerPath,
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

function collectionEnvelope(schema_version, key, rows, generated_at) {
  return {
    schema_version,
    generated_at,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--schema") args.schemaPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--activation-bridge-ledger") args.activationBridgeLedgerPath = argv[++index];
    else if (arg === "--domain-pilot-ledger") args.domainPilotLedgerPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-domain-agent-no-write-pilot.mjs [--check] [--out-dir DIR]\n\nCreates the P1321-P1440 domain Agent no-write pilot expansion while keeping runtime, writes, raw material, protected actions, legal/release decisions, live trading action, receipt application, and Agent final authority disabled.`);
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
