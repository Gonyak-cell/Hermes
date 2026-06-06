import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildGlobalUiGovernanceFreeze } from "./global-ui-governance-freeze.mjs";

export const DEFAULT_SAAS_QUALITY_GATE_PACKS_OUT_DIR = "artifacts/saas-quality-gate-packs/latest";
export const DEFAULT_SAAS_QUALITY_GATE_PACKS_INPUTS = {
  schemaPath: "schemas/saas-quality-gate-packs.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p11801-p12000.md",
  architectureDocPath: "docs/architecture.md",
  sourceGlobalUiGovernanceFreezePath: "artifacts/global-ui-governance-freeze/latest/global-ui-governance-freeze.json",
};

const COMMAND_NAME = "platform:saas-quality-gate-packs";
const SCHEMA_VERSION = "saas-quality-gate-packs.v1";
const CAPABILITY_ID = "platform.saas_quality_gate_packs";
const PROGRAM_RANGE = "P11801-P12000";
const SOURCE_PROGRAM_RANGE = "P11601-P11800";
const READY_STATUS = "ready_for_saas_quality_gate_packs";
const BLOCKED_STATUS = "blocked_saas_quality_gate_packs";

const PHASE_SPECS = [
  ["P11801-P11820", "P11800 Source Binding", "saas_quality_gate_source_binding_rows"],
  ["P11821-P11840", "Security Gate Pack", "saas_quality_gate_pack_rows.security"],
  ["P11841-P11860", "Permissions Gate Pack", "saas_quality_gate_pack_rows.permissions"],
  ["P11861-P11880", "Data Model Gate Pack", "saas_quality_gate_pack_rows.data_model"],
  ["P11881-P11900", "UX Gate Pack", "saas_quality_gate_pack_rows.ux"],
  ["P11901-P11920", "API Gate Pack", "saas_quality_gate_pack_rows.api"],
  ["P11921-P11940", "Performance Gate Pack", "saas_quality_gate_pack_rows.performance"],
  ["P11941-P11960", "Docs Gate Pack", "saas_quality_gate_pack_rows.docs"],
  ["P11961-P11980", "Deployment And Rollback Gate Pack", "saas_quality_gate_pack_rows.deployment_rollback"],
  ["P11981-P12000", "Gate Pack Freeze", "p12000_freeze_rows"],
];

const GATE_PACK_SPECS = [
  ["security", "Security Gate Pack", ["secret exposure", "raw body exposure", "dependency risk", "prompt injection", "audit trail"]],
  ["permissions", "Permissions Gate Pack", ["role boundary", "owner boundary", "protected action", "final approval", "independent review"]],
  ["data_model", "Data Model Gate Pack", ["stable ID", "schema contract", "migration risk", "retention quarantine", "cross-project isolation"]],
  ["ux", "UX Gate Pack", ["Global Operator Console language", "status vocabulary", "no unsafe copy", "accessibility", "visual regression"]],
  ["api", "API Gate Pack", ["read-only projection", "method policy", "redaction", "error envelope", "timeout budget"]],
  ["performance", "Performance Gate Pack", ["validation duration", "artifact size", "fixture count", "UI payload budget", "stale evidence"]],
  ["docs", "Docs Gate Pack", ["roadmap", "architecture", "operator handbook", "evidence ref", "next action clarity"]],
  ["deployment_rollback", "Deployment And Rollback Gate Pack", ["deploy preflight", "migration plan", "rollback binding", "incident plan", "release freeze"]],
  ["provenance", "Provenance Gate Pack", ["signed provenance", "source hash", "artifact hash", "reviewer ref", "validation ref"]],
  ["registry", "Reusable Gate Pack Registry", ["reusable gate pack registry", "blocked/ready boundary", "P12001 handoff", "Hermes control-plane", "domain pack context"]],
];

export async function runSaasQualityGatePacks(options = {}) {
  const result = await buildSaasQualityGatePacks(options);
  if (options.write !== false) await writeSaasQualityGatePacks(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`SaaS quality gate packs failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSaasQualityGatePacks(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SAAS_QUALITY_GATE_PACKS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "globalUiGovernanceFreeze")
    ? normalizeInlineJsonSource("inline.global_ui_governance_freeze", options.globalUiGovernanceFreeze)
    : await readJsonOrBuildGlobalUiGovernanceFreeze(inputs.source_global_ui_governance_freeze_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const packRows = buildGatePackRows(roadmapDoc.text, generatedAt);
  const componentRows = buildGateComponentRows(roadmapDoc.text, generatedAt);
  const registryRows = buildRegistryRows({ packRows, componentRows, generatedAt });
  const freezeRows = buildFreezeRows({ sourceRows, packRows, componentRows, registryRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, packRows, componentRows, registryRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, sourceRows, phaseRows, packRows, componentRows, registryRows, freezeRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      global_ui_governance_freeze_path: source.path,
    },
    source_global_ui_governance_freeze_summary: source.data?.summary ?? null,
    saas_quality_gate_contract: contract,
    saas_quality_gate_phase_rows: phaseRows,
    saas_quality_gate_source_binding_rows: sourceRows,
    saas_quality_gate_pack_rows: packRows,
    saas_quality_gate_component_rows: componentRows,
    saas_quality_gate_registry_rows: registryRows,
    p12000_freeze_rows: freezeRows,
    saas_quality_gate_boundary: boundary,
    saas_quality_gate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, packRows, componentRows, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "saas_quality_gate_packs")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.saas_quality_gate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.saas_quality_gate_validation_items);
  result.summary = buildSummary({ boundary, packRows, componentRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeSaasQualityGatePacks(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "saas-quality-gate-packs.json"), serializableResult(result));
  await writeJson(path.join(outDir, "saas-quality-gate-phase-rows.json"), collectionEnvelope("saas-quality-gate-phase-rows.v1", "saas_quality_gate_phase_rows", result.saas_quality_gate_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-quality-gate-source-binding-rows.json"), collectionEnvelope("saas-quality-gate-source-binding-rows.v1", "saas_quality_gate_source_binding_rows", result.saas_quality_gate_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-quality-gate-pack-rows.json"), collectionEnvelope("saas-quality-gate-pack-rows.v1", "saas_quality_gate_pack_rows", result.saas_quality_gate_pack_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-quality-gate-component-rows.json"), collectionEnvelope("saas-quality-gate-component-rows.v1", "saas_quality_gate_component_rows", result.saas_quality_gate_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-quality-gate-registry-rows.json"), collectionEnvelope("saas-quality-gate-registry-rows.v1", "saas_quality_gate_registry_rows", result.saas_quality_gate_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "p12000-freeze-rows.json"), collectionEnvelope("p12000-freeze-rows.v1", "p12000_freeze_rows", result.p12000_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-quality-gate-boundary.json"), result.saas_quality_gate_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "saas-quality-gate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.saas_quality_gate_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runSaasQualityGatePacksCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runSaasQualityGatePacks(args);
    console.log(`SaaS quality gate packs ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.saas_quality_gate_packs_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P11801: ${result.summary.source_ready_for_p11801_handoff}`);
    console.log(`Ready for P12001 handoff: ${result.summary.ready_for_p12001_handoff}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "saas-quality-gate-packs.contract.v1",
    generated_at: generatedAt,
    source_global_ui_governance_freeze_required: true,
    reusable_gate_pack_registry_required: true,
    gate_pack_categories: GATE_PACK_SPECS.map(([gateId]) => gateId),
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    release_approval_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p11801-p12000.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.global_ui_governance_freeze_boundary ?? {};
  const sourceStatus = summary.global_ui_governance_freeze_status ?? "missing";
  const sourceReady = summary.ready_for_p11801_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P11601-P11800 source artifact available", source.available],
    ["source.range", "P11601-P11800 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P11800 source status visible", sourceStatus === "ready_for_global_ui_governance_freeze" || sourceStatus === "blocked_global_ui_governance_freeze"],
    ["source.handoff", "P11800 ready_for_p11801_handoff", sourceReady],
    ["source.block_visible", "P11800 blocker visible", sourceReady || sourceBlocked],
    ["source.no_write", "P11800 source did not open write control", boundary.write_control_enabled === false],
    ["source.no_final", "P11800 source did not open final approval", boundary.final_approval_ui_enabled === false],
    ["source.no_production_enterprise", "P11800 source did not open production or enterprise PASS", boundary.production_pass_ui_enabled === false && boundary.enterprise_pass_ui_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: sourceStatus,
  }));
}

function buildGatePackRows(roadmapText, generatedAt) {
  return GATE_PACK_SPECS.map(([gateId, label, checks]) => verdictRow({
    row_id: `gate_pack.${gateId}`,
    category: "gate_pack",
    label,
    required: true,
    observed: includesAll(roadmapText, [label, ...checks]),
    evidence_ref: "docs/hermes-roadmap-p11801-p12000.md#gate-pack-contract",
    generated_at: generatedAt,
    gate_pack_id: gateId,
    reusable_across_saas_projects: true,
    check_count: checks.length,
    checks,
    opens_runtime_execution: false,
    opens_write_action: false,
    opens_release_approval: false,
    opens_production_pass: false,
    opens_enterprise_pass: false,
  }));
}

function buildGateComponentRows(roadmapText, generatedAt) {
  const rows = [];
  for (const [gateId, label, checks] of GATE_PACK_SPECS) {
    for (const check of checks) {
      rows.push(verdictRow({
        row_id: `gate_component.${gateId}.${slug(check)}`,
        category: "gate_component",
        label: `${label}: ${check}`,
        required: true,
        observed: includesText(roadmapText, check),
        evidence_ref: "docs/hermes-roadmap-p11801-p12000.md#gate-pack-contract",
        generated_at: generatedAt,
        gate_pack_id: gateId,
        check_id: slug(check),
        deterministic_check_required: true,
        evidence_ref_required: true,
        reviewer_ref_allowed: true,
        human_final_approval_required_now: false,
      }));
    }
  }
  return rows;
}

function buildRegistryRows(context) {
  return GATE_PACK_SPECS.map(([gateId, label]) => {
    const pack = context.packRows.find((row) => row.gate_pack_id === gateId);
    const components = context.componentRows.filter((row) => row.gate_pack_id === gateId);
    return verdictRow({
      row_id: `registry.${gateId}`,
      category: "gate_registry",
      label: `${label} registry entry`,
      required: true,
      observed: pack?.current_verdict === "pass" && components.length >= 5 && components.every((row) => row.current_verdict === "pass"),
      evidence_ref: "saas_quality_gate_pack_rows",
      generated_at: context.generatedAt,
      gate_pack_id: gateId,
      component_count: components.length,
      portable_to_domain_packs: true,
      domain_pack_product_identity_enabled: false,
    });
  });
}

function buildFreezeRows(context) {
  const packsReady = allPass(context.packRows);
  const componentsReady = allPass(context.componentRows);
  const registryReady = allPass(context.registryRows);
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  return [
    ["freeze.source", "P11800 source ready for P11801", sourceReady],
    ["freeze.source_block_visible", "P11800 source blocker visible when not ready", true],
    ["freeze.security", "security gate pack ready", gateReady(context.registryRows, "security")],
    ["freeze.permissions", "permissions gate pack ready", gateReady(context.registryRows, "permissions")],
    ["freeze.data_model", "data model gate pack ready", gateReady(context.registryRows, "data_model")],
    ["freeze.ux", "UX gate pack ready", gateReady(context.registryRows, "ux")],
    ["freeze.api", "API gate pack ready", gateReady(context.registryRows, "api")],
    ["freeze.performance", "performance gate pack ready", gateReady(context.registryRows, "performance")],
    ["freeze.docs", "docs gate pack ready", gateReady(context.registryRows, "docs")],
    ["freeze.deployment_rollback", "deployment and rollback gate pack ready", gateReady(context.registryRows, "deployment_rollback")],
    ["freeze.provenance", "provenance gate pack ready", gateReady(context.registryRows, "provenance")],
    ["freeze.registry", "reusable gate pack registry ready", packsReady && componentsReady && registryReady],
    ["freeze.no_release_trust", "no release approval production PASS or enterprise PASS opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p12000_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p12000-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceAvailable = context.source.available === true;
  const packsReady = allPass(context.packRows) && allPass(context.componentRows) && allPass(context.registryRows);
  const freezeReady = sourceReady && packsReady && allPass(context.freezeRows);
  return {
    source_global_ui_governance_freeze_available: sourceAvailable,
    source_ready_for_p11801_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false,
    quality_gate_packs_ready: packsReady,
    p12000_quality_gate_freeze_ready: freezeReady,
    ready_for_p12001_handoff: freezeReady,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    form_button_execution_enabled: false,
    api_write_methods_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    release_approval_enabled: false,
    domain_pack_product_identity_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P11801-P12000 phase rows incomplete", "docs/hermes-roadmap-p11801-p12000.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P11801-P12000"), "Architecture doc missing P11801-P12000 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P11800 source state must be available and blocker-visible", "saas_quality_gate_source_binding_rows");
  add("packs.ready", "packs", context.packRows.length === GATE_PACK_SPECS.length && allPass(context.packRows), "SaaS quality gate packs incomplete", "saas_quality_gate_pack_rows");
  add("components.ready", "packs", context.componentRows.length >= 50 && allPass(context.componentRows), "SaaS quality gate components incomplete", "saas_quality_gate_component_rows");
  add("registry.ready", "registry", context.registryRows.length === GATE_PACK_SPECS.length && allPass(context.registryRows), "SaaS quality gate registry incomplete", "saas_quality_gate_registry_rows");
  add("freeze.state", "freeze", context.freezeRows.length >= 12, "P12000 freeze rows missing", "p12000_freeze_rows");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false && context.boundary.form_button_execution_enabled === false && context.boundary.api_write_methods_enabled === false, "Quality gate packs opened write/protected/form/API mutation", "saas_quality_gate_boundary");
  add("boundary.no.final", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Quality gate packs opened final approval", "saas_quality_gate_boundary");
  add("boundary.no.trust", "boundary", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.release_approval_enabled === false, "Quality gate packs opened release or trust PASS", "saas_quality_gate_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p12001_handoff === context.boundary.p12000_quality_gate_freeze_ready, "P12001 handoff state must match P12000 freeze state", "saas_quality_gate_boundary");
  return items;
}

function buildSummary(context) {
  return {
    saas_quality_gate_packs_status: context.boundary.ready_for_p12001_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p11801_handoff: context.boundary.source_ready_for_p11801_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    quality_gate_pack_count: context.packRows.length,
    quality_gate_component_count: context.componentRows.length,
    p12000_quality_gate_freeze_ready: context.boundary.p12000_quality_gate_freeze_ready,
    ready_for_p12001_handoff: context.boundary.ready_for_p12001_handoff,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    release_approval_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# SaaS Quality Gate Packs",
    "",
    `Status: ${result.summary.saas_quality_gate_packs_status}`,
    `Program: ${result.program_range}`,
    `Gate packs: ${result.summary.quality_gate_pack_count}`,
    `Source ready for P11801: ${result.summary.source_ready_for_p11801_handoff}`,
    `Ready for P12001 handoff: ${result.summary.ready_for_p12001_handoff}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.saas_quality_gate_registry_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.component_count)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes SaaS Quality Gate Packs</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes SaaS Quality Gate Packs</h1>
    <p class="notice">Reusable gate pack registry. Source blockers remain visible; release authority, trust badges, write controls, and final approval remain disabled.</p>
    <table><thead><tr><th>Gate Pack</th><th>Verdict</th><th>Checks</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildGlobalUiGovernanceFreeze(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildGlobalUiGovernanceFreeze({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.global_ui_governance_freeze", built);
}

function gateReady(rows, gateId) {
  return rows.some((row) => row.gate_pack_id === gateId && row.current_verdict === "pass");
}

function verdictRow(row) {
  return { block_reason: row.observed ? null : `${row.label} missing or blocked.`, ...row, current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked") };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_SAAS_QUALITY_GATE_PACKS_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_SAAS_QUALITY_GATE_PACKS_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_SAAS_QUALITY_GATE_PACKS_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_SAAS_QUALITY_GATE_PACKS_INPUTS.architectureDocPath,
    source_global_ui_governance_freeze_path: options.sourceGlobalUiGovernanceFreezePath ?? DEFAULT_SAAS_QUALITY_GATE_PACKS_INPUTS.sourceGlobalUiGovernanceFreezePath,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { available: Boolean(data), path: sourceId, text: "", data };
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-global-ui-governance-freeze-path") args.sourceGlobalUiGovernanceFreezePath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P11801-P12000 SaaS Quality Gate Packs artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
