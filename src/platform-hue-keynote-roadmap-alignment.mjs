import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_HUE_KEYNOTE_ROADMAP_ALIGNMENT_OUT_DIR = "artifacts/platform-hue-keynote-roadmap-alignment/latest";
export const DEFAULT_PLATFORM_HUE_KEYNOTE_ROADMAP_ALIGNMENT_INPUTS = {
  schemaPath: "schemas/platform-hue-keynote-roadmap-alignment.schema.json",
  packagePath: "package.json",
  principleDocPath: "docs/hue-keynote-harness-operating-loop.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
  architectureDocPath: "docs/architecture.md",
};

const COMMAND_NAME = "platform:hue-keynote-roadmap-alignment";
const SCHEMA_VERSION = "platform-hue-keynote-roadmap-alignment.v1";
const CAPABILITY_ID = "platform.hue_keynote_roadmap_alignment";
const READY_STATUS = "ready_for_platform_hue_keynote_roadmap_alignment";
const PROGRAM_RANGE = "P1200-P3200";
const SOURCE_REFERENCE = "Hue_Keynote.pdf";
const SOURCE_PAGE_COUNT = 50;

const PRINCIPLE_SPECS = [
  ["claim_not_evidence", "Completion claim is not evidence", ["Completion claim is not evidence", "claim -> evidence", "evidence_ref"]],
  ["completion_contract", "Completion is a contract", ["Completion is a contract", "reviewer_ref", "hard_gate_ref"]],
  ["soft_to_hard_gate", "Soft rules must become hard gates", ["Soft instruction is not a gate", "exit 2", "hard gate"]],
  ["apology_not_state_change", "Apology is not state change", ["Apology is not state change", "change a condition"]],
  ["memory_next_execution_condition", "Memory changes the next execution condition", ["Memory is the next execution condition", "Archive", "Recall"]],
  ["closed_loop", "The loop is signal, patch, verify, ack, rollback", ["signal", "patch", "verify", "rollback"]],
  ["harness_levels_l0_l7", "Harness maturity is L0-L7", ["L0", "L6", "L7", "Work OS"]],
  ["pass_ownership", "PASS has an owner", ["PASS requires an owner", "Whose PASS standard"]],
  ["enterprise_scaling", "Scale depends on domain, goal, workflow", ["DOMAIN", "GOAL", "WORKFLOW"]],
  ["good_result_definition", "Good result is repeatable, verifiable, recoverable, memorable, scalable", ["repeatable", "reviewable", "recoverable", "memorable", "scalable"]],
];

const PHASE_SPECS = [
  ["P1200", "Agent Runtime Pilot Readiness Freeze"],
  ["P1201-P1320", "Agent Runtime Activation Bridge"],
  ["P1321-P1440", "Domain Agent No-Write Pilot Expansion"],
  ["P1441-P1500", "Agent Operator Console v0"],
  ["P1501-P1640", "Kernel Manifest and Contract Baseline"],
  ["P1641-P1760", "Spec/Status Reconciliation and Hard Gate Promotion"],
  ["P1761-P1880", "Claim/Evidence/Gate and Artifact/Check/Receipt Kernel"],
  ["P1881-P2040", "Harness-Native Cutover Freeze"],
  ["P2041-P2120", "Nous Non-Adoption Reversal"],
  ["P2121-P2240", "Hermes Runtime Governance Restore"],
  ["P2241-P2400", "Human-Approved Limited Execution"],
  ["P2401-P2560", "Controlled Write and Operator Console v2"],
  ["P2561-P2720", "Memory Bank, Storage/Event, and Observability Plane"],
  ["P2721-P2880", "Connectors and Data Governance"],
  ["P2881-P3040", "Domain Pack Ecosystem"],
  ["P3041-P3200", "Production Governance and Work OS Freeze"],
];

const ARCHITECTURE_TERMS = [
  "completion claim",
  "evidence",
  "PASS",
  "Memory Bank",
  "Hue Keynote",
];

export async function runPlatformHueKeynoteRoadmapAlignment(options = {}) {
  const result = await buildPlatformHueKeynoteRoadmapAlignment(options);
  if (options.write !== false) await writePlatformHueKeynoteRoadmapAlignment(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Hue keynote roadmap alignment failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformHueKeynoteRoadmapAlignment(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_HUE_KEYNOTE_ROADMAP_ALIGNMENT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const principleDoc = await readTextSource(inputs.principle_doc_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const principleText = principleDoc.text;
  const roadmapText = roadmapDoc.text;
  const architectureText = architectureDoc.text;
  const combinedText = [principleText, roadmapText, architectureText].join("\n");
  const principleRows = buildPrincipleRows(combinedText);
  const phaseRows = buildPhaseRows(roadmapText);
  const docRows = buildDocRows({ principleDoc, roadmapDoc, architectureDoc });
  const gateRows = buildGateRows({ packageJson, principleRows, phaseRows, docRows, architectureText });
  const boundary = buildBoundary({ principleRows, phaseRows, docRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, principleRows, phaseRows, docRows, gateRows, boundary, architectureText });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_hue_keynote_roadmap_alignment_id: `platform-hue-keynote-roadmap-alignment.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_reference: {
      schema_version: "hue-keynote-source-reference.v1",
      file_name: SOURCE_REFERENCE,
      reviewed_page_count: SOURCE_PAGE_COUNT,
      reviewed_on: "2026-06-04",
      extraction_note: "Image-based PDF reviewed through OCR and rendered page checks; repository stores the paraphrased operating requirements, not deck text.",
    },
    keynote_principle_rows: principleRows,
    roadmap_phase_alignment_rows: phaseRows,
    roadmap_document_rows: docRows,
    roadmap_gate_rows: gateRows,
    roadmap_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ principleRows, phaseRows, docRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_hue_keynote_roadmap_alignment")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ principleRows, phaseRows, docRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_hue_keynote_roadmap_alignment_id = result.platform_hue_keynote_roadmap_alignment_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformHueKeynoteRoadmapAlignment(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-hue-keynote-roadmap-alignment.json"), serializableResult(result));
  await writeJson(path.join(outDir, "keynote-principle-rows.json"), collectionEnvelope("keynote-principle-rows.v1", "keynote_principle_rows", result.keynote_principle_rows, result.generated_at));
  await writeJson(path.join(outDir, "roadmap-phase-alignment-rows.json"), collectionEnvelope("roadmap-phase-alignment-rows.v1", "roadmap_phase_alignment_rows", result.roadmap_phase_alignment_rows, result.generated_at));
  await writeJson(path.join(outDir, "roadmap-document-rows.json"), collectionEnvelope("roadmap-document-rows.v1", "roadmap_document_rows", result.roadmap_document_rows, result.generated_at));
  await writeJson(path.join(outDir, "roadmap-gate-rows.json"), collectionEnvelope("roadmap-gate-rows.v1", "roadmap_gate_rows", result.roadmap_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "roadmap-boundary.json"), result.roadmap_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-hue-keynote-roadmap-alignment-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformHueKeynoteRoadmapAlignmentCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformHueKeynoteRoadmapAlignment(args);
    console.log(`Platform Hue keynote roadmap alignment ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_hue_keynote_roadmap_alignment_status}`);
    console.log(`Principles: ${result.summary.principle_count}`);
    console.log(`Phases: ${result.summary.phase_count}`);
    console.log(`Gates: pass ${result.summary.pass_gate_count}, total ${result.summary.gate_count}`);
    console.log(`Runtime execution enabled: ${result.summary.runtime_execution_enabled}`);
    console.log(`Write action enabled: ${result.summary.write_action_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPrincipleRows(text) {
  return PRINCIPLE_SPECS.map(([principleId, title, terms], index) => {
    const matchedTerms = terms.filter((term) => includesToken(text, term));
    const pass = matchedTerms.length === terms.length;
    return verdictRow({
      schema_version: "keynote-principle-row.v1",
      row_id: `keynote.principle.row.${String(index + 1).padStart(2, "0")}`,
      principle_id: principleId,
      principle_title: title,
      principle_status: pass ? "reflected" : "missing",
      required_terms: terms,
      matched_terms: matchedTerms,
      evidence_ref: `docs.hue_keynote.${principleId}`,
      reviewer_ref: "reviewer.platform_roadmap_owner",
      hard_gate_ref: `gate.platform.hue_keynote.${principleId}`,
      responsible_owner: "platform_roadmap_owner",
      next_allowed_action: pass ? "preserve principle in roadmap and Kernel gates" : `add missing ${principleId} keynote principle`,
    }, pass);
  });
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phaseRange, phaseName], index) => {
    const pass = includesToken(roadmapText, phaseRange) && includesToken(roadmapText, phaseName);
    return verdictRow({
      schema_version: "roadmap-phase-alignment-row.v1",
      row_id: `roadmap.phase.alignment.row.${String(index + 1).padStart(2, "0")}`,
      phase_range: phaseRange,
      phase_name: phaseName,
      phase_alignment_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_long_range_roadmap.${phaseRange}`,
      reviewer_ref: "reviewer.platform_roadmap_owner",
      hard_gate_ref: `gate.platform.roadmap.phase.${phaseRange}`,
      responsible_owner: "platform_roadmap_owner",
      next_allowed_action: pass ? "keep phase aligned with keynote operating loop" : `add roadmap phase ${phaseRange}`,
    }, pass);
  });
}

function buildDocRows({ principleDoc, roadmapDoc, architectureDoc }) {
  const specs = [
    ["hue_keynote_principles", principleDoc, ["Hue_Keynote.pdf", "Harness Invariants", "Memory Bank Requirement", "Enterprise Scaling Constraint"]],
    ["long_range_roadmap", roadmapDoc, ["P1200-P3200", "P2041-P2120", "P3041-P3200", "no L6 closed loop = no Work OS claim"]],
    ["architecture_alignment", architectureDoc, ARCHITECTURE_TERMS],
  ];
  return specs.map(([docId, source, terms], index) => {
    const matchedTerms = terms.filter((term) => includesToken(source.text, term));
    const pass = source.available && matchedTerms.length === terms.length;
    return verdictRow({
      schema_version: "roadmap-document-row.v1",
      row_id: `roadmap.document.row.${String(index + 1).padStart(2, "0")}`,
      document_id: docId,
      document_path: source.path,
      document_available: source.available,
      document_status: pass ? "aligned" : "missing_or_incomplete",
      required_terms: terms,
      matched_terms: matchedTerms,
      evidence_ref: `docs.${docId}`,
      reviewer_ref: "reviewer.platform_roadmap_owner",
      hard_gate_ref: `gate.platform.roadmap.document.${docId}`,
      responsible_owner: "platform_roadmap_owner",
      next_allowed_action: pass ? "keep document linked to keynote roadmap alignment" : `repair ${docId}`,
    }, pass);
  });
}

function buildGateRows({ packageJson, principleRows, phaseRows, docRows, architectureText }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must expose the alignment command"],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate script must include the alignment command"],
    ["principles_reflected", principleRows.every((row) => row.current_verdict === "pass"), "all keynote principles must be reflected"],
    ["phases_reflected", phaseRows.every((row) => row.current_verdict === "pass"), "all P1200-P3200 phase rows must be reflected"],
    ["documents_aligned", docRows.every((row) => row.current_verdict === "pass"), "all roadmap documents must be aligned"],
    ["architecture_linked", includesToken(architectureText, "Hue Keynote"), "architecture must link the keynote operating loop"],
  ];
  return gates.map(([gateId, pass, description], index) => ({
    schema_version: "roadmap-gate-row.v1",
    row_id: `roadmap.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gateId}`,
    evidence_ref: `evidence.platform.hue_keynote.gate.${gateId}`,
    reviewer_ref: "reviewer.platform_roadmap_owner",
    hard_gate_ref: `gate.platform.hue_keynote.${gateId}`,
    responsible_owner: "platform_roadmap_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gateId} before declaring roadmap aligned`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ principleRows, phaseRows, docRows, gateRows }) {
  const unsafeFlags = [
    principleRows.some((row) => row.current_verdict !== "pass"),
    phaseRows.some((row) => row.current_verdict !== "pass"),
    docRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "roadmap-alignment-boundary.v1",
    source_reference: SOURCE_REFERENCE,
    reviewed_page_count: SOURCE_PAGE_COUNT,
    program_range: PROGRAM_RANGE,
    keynote_alignment_ready: unsafeFlags.filter(Boolean).length === 0,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    receipt_application_enabled: false,
    raw_material_access_enabled: false,
    agent_final_pass_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, principleRows, phaseRows, docRows, gateRows, boundary, architectureText }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include alignment command"),
    validationItem("principles.count", "principles", principleRows.length === PRINCIPLE_SPECS.length, "all keynote principle rows must exist"),
    validationItem("principles.pass", "principles", principleRows.every((row) => row.current_verdict === "pass"), "all keynote principles must pass"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all roadmap phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all roadmap phase rows must pass"),
    validationItem("documents.pass", "documents", docRows.every((row) => row.current_verdict === "pass"), "all required documents must be aligned"),
    validationItem("architecture.link", "architecture", includesToken(architectureText, "Hue Keynote"), "architecture must reference Hue Keynote operating loop"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "all roadmap alignment gates must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false, "roadmap alignment must not enable execution or write"),
  ];
}

function buildSummary({ principleRows, phaseRows, docRows, gateRows, boundary, validation }) {
  return {
    schema_version: "platform-hue-keynote-roadmap-alignment-summary.v1",
    platform_hue_keynote_roadmap_alignment_status: validation.valid && boundary.keynote_alignment_ready ? READY_STATUS : "blocked",
    source_reference: SOURCE_REFERENCE,
    reviewed_page_count: SOURCE_PAGE_COUNT,
    program_range: PROGRAM_RANGE,
    principle_count: principleRows.length,
    pass_principle_count: principleRows.filter((row) => row.current_verdict === "pass").length,
    phase_count: phaseRows.length,
    pass_phase_count: phaseRows.filter((row) => row.current_verdict === "pass").length,
    document_count: docRows.length,
    pass_document_count: docRows.filter((row) => row.current_verdict === "pass").length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    agent_final_pass_enabled: boundary.agent_final_pass_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_keynote_alignment.${fields.principle_id ?? fields.phase_range ?? fields.document_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function renderMarkdown(result) {
  return [
    "# Platform Hue Keynote Roadmap Alignment",
    "",
    `Status: ${result.summary.platform_hue_keynote_roadmap_alignment_status}`,
    `Source: ${result.summary.source_reference}`,
    `Reviewed pages: ${result.summary.reviewed_page_count}`,
    `Program: ${result.summary.program_range}`,
    `Principles: ${result.summary.pass_principle_count}/${result.summary.principle_count}`,
    `Phases: ${result.summary.pass_phase_count}/${result.summary.phase_count}`,
    `Documents: ${result.summary.pass_document_count}/${result.summary.document_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Runtime execution enabled: ${result.summary.runtime_execution_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Use the aligned P1200-P3200 roadmap as planning input. This alignment does not enable runtime execution, write action, protected action, or Agent final PASS.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_HUE_KEYNOTE_ROADMAP_ALIGNMENT_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    principle_doc_path: options.principleDocPath ?? defaults.principleDocPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
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
    principleDocPath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
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
    } else if (arg === "--principle-doc") {
      args.principleDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-hue-keynote-roadmap-alignment.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --principle-doc <path>          Hue keynote principle document path.
  --roadmap-doc <path>            Long-range roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --help                          Show this help.
`);
}
