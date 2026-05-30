import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TEMPLATE_REGISTRY_OUT_DIR = "artifacts/template-registry/latest";
export const DEFAULT_TEMPLATE_REGISTRY_INPUTS = {
  creativeDocumentPackManifestPath: "artifacts/creative-document-pack-manifest/latest/creative-document-pack-manifest.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  documentRendererAdapterPath: "artifacts/document-renderer-adapter/latest/document-renderer-adapter.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "template-registry.v1";
const REQUIRED_FORMATS = ["docx", "pptx", "html", "email"];
const FORMAT_BY_TEMPLATE_PATH = new Map([
  ["templates/common/review-summary.md", "html"],
  ["templates/law-firm/ldd-report.md", "docx"],
  ["templates/law-firm/client-memo.md", "email"],
  ["templates/personal-dev/pr-draft.md", "email"],
  ["templates/personal-dev/review-summary.md", "html"],
  ["templates/creative-document/report-outline.md", "pptx"],
  ["templates/creative-document/pptx-style-profile.json", "pptx"],
]);

export async function runTemplateRegistry(options = {}) {
  const result = await buildTemplateRegistry(options);
  if (options.write !== false) await writeTemplateRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Template registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTemplateRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TEMPLATE_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const creativeDocumentPackManifest = sourceById.creative_document_pack_manifest;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const runtimeFreeze = sourceById.runtime_freeze;
  const documentRendererAdapter = sourceById.document_renderer_adapter;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;

  const templateRecords = buildTemplateRecords(domainPackRegistry, generatedAt);
  const templateVersionRecords = buildTemplateVersionRecords(templateRecords, generatedAt);
  const formatCoverage = buildFormatCoverage(templateRecords, generatedAt);
  const packBindings = buildPackBindings(templateRecords, generatedAt);
  const boundary = buildTemplateRegistryBoundary({
    generatedAt,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
  });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    templateRecords,
    templateVersionRecords,
    formatCoverage,
    packBindings,
    boundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeTemplateRegistry({
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    templateRecords,
    templateVersionRecords,
    formatCoverage,
    packBindings,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    template_registry_id: `template-registry.${dateStamp(generatedAt)}`,
    template_registry_status: summary.template_registry_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    template_registry_contract: buildContract(generatedAt),
    template_registry_boundary: boundary,
    template_records: templateRecords,
    template_version_records: templateVersionRecords,
    template_format_coverage: formatCoverage,
    template_pack_bindings: packBindings,
    template_registry_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderTemplateRegistryMarkdown(result),
  };
}

export async function writeTemplateRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableTemplateRegistry(result);
  await writeJson(path.join(outDir, "template-registry.json"), serializable);
  await writeJson(path.join(outDir, "template-records.json"), {
    schema_version: "template-records.v1",
    generated_at: result.generated_at,
    template_record_count: result.template_records.length,
    template_records: result.template_records,
  });
  await writeJson(path.join(outDir, "template-version-records.json"), {
    schema_version: "template-version-records.v1",
    generated_at: result.generated_at,
    template_version_record_count: result.template_version_records.length,
    template_version_records: result.template_version_records,
  });
  await writeJson(path.join(outDir, "template-format-coverage.json"), {
    schema_version: "template-format-coverage.v1",
    generated_at: result.generated_at,
    template_format_coverage: result.template_format_coverage,
  });
  await writeJson(path.join(outDir, "template-pack-bindings.json"), {
    schema_version: "template-pack-bindings.v1",
    generated_at: result.generated_at,
    template_pack_binding_count: result.template_pack_bindings.length,
    template_pack_bindings: result.template_pack_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "template-registry-validation-report.v1",
    generated_at: result.generated_at,
    template_registry_id: result.template_registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTemplateRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTemplateRegistry(args);
    console.log(`Template registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.template_registry_status}`);
    console.log(`Templates: ${result.summary.template_count}`);
    console.log(`Formats covered: ${result.summary.covered_format_count}/${result.summary.required_format_count}`);
    console.log(`Versions: ${result.summary.current_version_count}/${result.summary.template_version_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "template-registry-contract.v1",
    contract_id: CONTRACT_ID,
    registry_scope: "creative_and_document_domain_pack",
    source_of_truth: "domain_pack_manifest_template_declarations",
    required_formats: REQUIRED_FORMATS,
    versioning_rule: "template_version_records_are_derived_from_pack_version_and_declared_template_path",
    safety_rule: "template_registry_tracks_metadata_only_and_never_executes_renderers_delivery_or_client_facing_output",
    human_review_rule: "all_templates_remain_draft_or_pending_review_until_format_validation_and_human_approval",
    created_at: generatedAt,
  };
}

function buildTemplateRecords(domainPackRegistry, generatedAt) {
  const packs = domainPackRegistry?.packs ?? [];
  const records = [];
  for (const pack of packs) {
    const manifest = pack.manifest ?? {};
    for (const [index, templatePath] of (manifest.templates ?? []).entries()) {
      const templateFormat = inferTemplateFormat(templatePath);
      const templateFamily = inferTemplateFamily(templatePath);
      const templateId = `template.${slug(pack.pack_id)}.${slug(templatePath)}`;
      const recordBase = {
        schema_version: "template-record.v1",
        template_id: templateId,
        template_registry_id: "template-registry.current",
        pack_id: pack.pack_id,
        pack_version: pack.pack_version,
        template_path: templatePath,
        template_name: path.basename(templatePath),
        template_family: templateFamily,
        template_format: templateFormat,
        template_index: index,
        declared_in_pack_manifest: true,
        source_pack_manifest_path: pack.path ?? null,
        version: pack.pack_version,
        latest_version_id: `${templateId}.version.${slug(pack.pack_version)}`,
        latest_version: true,
        version_source: "pack_manifest_version_and_declared_path",
        metadata_hash: null,
        metadata_status: "registered",
        template_status: "registered",
        file_presence_status: "declared_metadata_only",
        file_content_required_for_phase: false,
        default_output_status: manifest.permissions?.default_output_status ?? "draft",
        max_classification: manifest.permissions?.max_classification ?? null,
        external_model_policy: manifest.permissions?.external_model_policy ?? null,
        human_review_required: true,
        format_validation_required: true,
        layout_validation_required: templateFormat === "pptx" || templateFormat === "docx",
        renderer_required_later: true,
        renderer_execution_performed: false,
        delivery_execution_performed: false,
        protected_action_executed: false,
        client_facing_ready: false,
        client_facing_output_generated: false,
        generated_at: generatedAt,
      };
      records.push({
        ...recordBase,
        metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
      });
    }
  }
  return records.sort((left, right) => `${left.pack_id}:${left.template_path}`.localeCompare(`${right.pack_id}:${right.template_path}`));
}

function buildTemplateVersionRecords(templateRecords, generatedAt) {
  return templateRecords.map((record) => ({
    schema_version: "template-version-record.v1",
    template_version_id: record.latest_version_id,
    template_id: record.template_id,
    pack_id: record.pack_id,
    template_path: record.template_path,
    template_format: record.template_format,
    version: record.version,
    version_status: "current",
    version_source: record.version_source,
    metadata_hash: record.metadata_hash,
    previous_version_id: null,
    supersedes_version: false,
    latest_version: true,
    migration_required: false,
    renderer_execution_performed: false,
    delivery_execution_performed: false,
    generated_at: generatedAt,
  }));
}

function buildFormatCoverage(templateRecords, generatedAt) {
  return REQUIRED_FORMATS.map((templateFormat) => {
    const matchingTemplates = templateRecords.filter((record) => record.template_format === templateFormat);
    return {
      schema_version: "template-format-coverage.v1",
      template_format: templateFormat,
      format_coverage_status: matchingTemplates.length > 0 ? "covered" : "missing",
      template_count: matchingTemplates.length,
      template_ids: matchingTemplates.map((record) => record.template_id),
      current_version_count: matchingTemplates.filter((record) => record.latest_version).length,
      human_review_required_count: matchingTemplates.filter((record) => record.human_review_required).length,
      format_validation_required_count: matchingTemplates.filter((record) => record.format_validation_required).length,
      generated_at: generatedAt,
    };
  });
}

function buildPackBindings(templateRecords, generatedAt) {
  const recordsByPack = new Map();
  for (const record of templateRecords) {
    if (!recordsByPack.has(record.pack_id)) recordsByPack.set(record.pack_id, []);
    recordsByPack.get(record.pack_id).push(record);
  }
  return [...recordsByPack.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([packId, records]) => ({
    schema_version: "template-pack-binding.v1",
    template_pack_binding_id: `template-pack-binding.${slug(packId)}`,
    pack_id: packId,
    binding_status: records.length > 0 ? "linked" : "missing",
    template_count: records.length,
    template_ids: records.map((record) => record.template_id),
    template_formats: [...new Set(records.map((record) => record.template_format))].sort(),
    version_count: records.length,
    generated_at: generatedAt,
  }));
}

function buildTemplateRegistryBoundary({ generatedAt, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze }) {
  return {
    schema_version: "template-registry-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    metadata_registry_only: true,
    template_file_write_allowed: false,
    core_registry_mutation_allowed: false,
    renderer_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    desktop_runtime_source_of_truth: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, sourceReads, creativeDocumentPackManifest, domainPackRegistry, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, templateRecords, templateVersionRecords, formatCoverage, packBindings, boundary }) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.creative_document_pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.domain_pack_registry", domainPackRegistry?.validation?.valid === true && (domainPackRegistry?.summary?.pack_count ?? 0) > 0, "Domain pack registry is valid and readable."));
  checkpoints.push(checkpoint("templates.registered", templateRecords.length > 0 && templateRecords.every((record) => record.template_status === "registered" && record.metadata_hash?.startsWith("sha256:")), `${templateRecords.length} declared template metadata record(s) are registered with hashes.`));
  checkpoints.push(checkpoint("versions.current", templateVersionRecords.length === templateRecords.length && templateVersionRecords.every((record) => record.version_status === "current" && record.latest_version === true), `${templateVersionRecords.filter((record) => record.version_status === "current").length}/${templateVersionRecords.length} template version record(s) are current.`));
  checkpoints.push(checkpoint("formats.covered", formatCoverage.length === REQUIRED_FORMATS.length && formatCoverage.every((record) => record.format_coverage_status === "covered"), `${formatCoverage.filter((record) => record.format_coverage_status === "covered").length}/${REQUIRED_FORMATS.length} required template format(s) are covered.`));
  checkpoints.push(checkpoint("packs.bound", packBindings.length > 0 && packBindings.every((binding) => binding.binding_status === "linked" && binding.template_count > 0), `${packBindings.length} pack template binding(s) are linked.`));
  checkpoints.push(checkpoint("gates.human_format", templateRecords.every((record) => record.human_review_required === true && record.format_validation_required === true && record.client_facing_ready === false), "Every registered template remains human-review and format-validation gated."));
  checkpoints.push(checkpoint("runtime.boundary", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop execution disabled."));
  checkpoints.push(checkpoint("renderer.boundary", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.desktop_read_only === true, "Document renderer adapter is available only as a read-only contract."));
  checkpoints.push(checkpoint("delivery.boundary", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && boundary.delivery_execution_allowed === false, "Output delivery contract is frozen while template registry delivery execution stays disabled."));
  checkpoints.push(checkpoint("boundary.read_only", boundary.boundary_status === "enforced" && boundary.read_only === true && boundary.template_file_write_allowed === false && boundary.renderer_execution_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false, "Template registry boundary is read-only and metadata-only."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:template-registry"]), "package.json registers creative-document:template-registry."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P254") && roadmapText.includes("template registry"), "Roadmap ledger keeps the P254 template registry slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All template registry source contracts were readable."));
  return checkpoints;
}

function summarizeTemplateRegistry({ creativeDocumentPackManifest, domainPackRegistry, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, templateRecords, templateVersionRecords, formatCoverage, packBindings, boundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const byFormat = countBy(templateRecords, "template_format");
  return {
    template_registry_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    template_registry_contract_id: CONTRACT_ID,
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_domain_pack_registry_status: domainPackRegistry?.validation?.valid === true ? "complete" : "blocked",
    template_count: templateRecords.length,
    registered_template_count: templateRecords.filter((record) => record.template_status === "registered").length,
    template_version_count: templateVersionRecords.length,
    current_version_count: templateVersionRecords.filter((record) => record.version_status === "current").length,
    pack_binding_count: packBindings.length,
    linked_pack_binding_count: packBindings.filter((binding) => binding.binding_status === "linked").length,
    required_format_count: REQUIRED_FORMATS.length,
    covered_format_count: formatCoverage.filter((record) => record.format_coverage_status === "covered").length,
    docx_template_count: byFormat.docx ?? 0,
    pptx_template_count: byFormat.pptx ?? 0,
    html_template_count: byFormat.html ?? 0,
    email_template_count: byFormat.email ?? 0,
    metadata_hash_count: templateRecords.filter((record) => record.metadata_hash?.startsWith("sha256:")).length,
    human_review_required_template_count: templateRecords.filter((record) => record.human_review_required).length,
    format_validation_required_template_count: templateRecords.filter((record) => record.format_validation_required).length,
    layout_validation_required_template_count: templateRecords.filter((record) => record.layout_validation_required).length,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    read_only: boundary.read_only,
    metadata_registry_only: boundary.metadata_registry_only,
    template_file_write_allowed: boundary.template_file_write_allowed,
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    renderer_execution_allowed: boundary.renderer_execution_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    protected_action_allowed: boundary.protected_action_allowed,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    template_registry_generated: true,
    metadata_registry_only: true,
    human_review_required: true,
    format_validation_required: true,
    renderer_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    template_file_write_performed: false,
    core_registry_mutation_performed: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "template-registry-checkpoint.v1",
    checkpoint_id: `template-registry.${checkpointId}`,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.check_id,
    message: item.message,
    status: item.status,
  }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    package_json: contractRef("package.json", packageJson),
    roadmap: textContractRef("docs/final-completion-phase-ledger.md", roadmapText),
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [
      source.source_id,
      contractRef(source.source_id, source),
    ])),
  };
}

async function readSourceArtifacts(inputs) {
  return [
    await sourceRead("creative_document_pack_manifest", inputs.creative_document_pack_manifest_path, readJsonOrError),
    await sourceRead("domain_pack_registry", inputs.domain_pack_registry_path, readJsonOrError),
    await sourceRead("runtime_freeze", inputs.runtime_freeze_path, readJsonOrError),
    await sourceRead("document_renderer_adapter", inputs.document_renderer_adapter_path, readJsonOrError),
    await sourceRead("output_delivery_contract_freeze", inputs.output_delivery_contract_freeze_path, readJsonOrError),
  ];
}

async function sourceRead(sourceId, sourcePath, reader) {
  const result = await reader(sourcePath);
  return {
    source_id: sourceId,
    path: sourcePath,
    readable: !result.error,
    value: result.value,
    error: result.error,
  };
}

function inferTemplateFormat(templatePath) {
  const normalized = templatePath.replaceAll("\\", "/");
  if (FORMAT_BY_TEMPLATE_PATH.has(normalized)) return FORMAT_BY_TEMPLATE_PATH.get(normalized);
  if (normalized.includes("pptx")) return "pptx";
  if (normalized.includes("docx") || normalized.includes("report")) return "docx";
  if (normalized.includes("email") || normalized.includes("memo")) return "email";
  return "html";
}

function inferTemplateFamily(templatePath) {
  const baseName = path.basename(templatePath, path.extname(templatePath));
  return slug(baseName).replaceAll("-", "_");
}

function serializableTemplateRegistry(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function renderTemplateRegistryMarkdown(result) {
  const lines = [];
  lines.push("# Template Registry");
  lines.push("");
  lines.push(`Status: ${result.summary.template_registry_status}`);
  lines.push(`Templates: ${result.summary.template_count}`);
  lines.push(`Versions: ${result.summary.current_version_count}/${result.summary.template_version_count}`);
  lines.push(`Formats covered: ${result.summary.covered_format_count}/${result.summary.required_format_count}`);
  lines.push(`Read-only: ${result.summary.read_only}`);
  lines.push("");
  lines.push("## Format Coverage");
  for (const row of result.template_format_coverage) {
    lines.push(`- ${row.template_format}: ${row.format_coverage_status} (${row.template_count})`);
  }
  lines.push("");
  lines.push("## Templates");
  for (const record of result.template_records) {
    lines.push(`- ${record.template_id}: ${record.template_format} ${record.version} (${record.template_status})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.creativeDocumentPackManifestPath),
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.domainPackRegistryPath),
    runtime_freeze_path: path.resolve(options.runtimeFreezePath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.runtimeFreezePath),
    document_renderer_adapter_path: path.resolve(options.documentRendererAdapterPath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.documentRendererAdapterPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_TEMPLATE_REGISTRY_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--creative-document-pack-manifest") parsed.creativeDocumentPackManifestPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--runtime-freeze") parsed.runtimeFreezePath = argv[++index];
    else if (arg === "--document-renderer-adapter") parsed.documentRendererAdapterPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-template-registry.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --creative-document-pack-manifest <path>    Creative-document pack manifest path.
  --domain-pack-registry <path>               Domain pack registry path.
  --runtime-freeze <path>                     Runtime freeze path.
  --document-renderer-adapter <path>          Document renderer adapter path.
  --output-delivery-contract-freeze <path>    Output delivery contract freeze path.
  --package <path>                            package.json path.
  --roadmap <path>                            Roadmap/ledger path.
`);
}

async function readJsonOrError(filePath) {
  try {
    return {
      value: JSON.parse(await readFile(filePath, "utf8")),
    };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      value: await readFile(filePath, "utf8"),
    };
  } catch (error) {
    return {
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function contractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  const value = result?.value ?? result;
  return {
    label,
    available: true,
    schema_version: value?.schema_version ?? null,
    content_hash: `sha256:${hashJson(value ?? {})}`,
  };
}

function textContractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  return {
    label,
    available: true,
    content_hash: `sha256:${hashText(result?.value ?? "")}`,
  };
}

function hashJson(value) {
  return hashText(stableStringify(value));
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  return counts;
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
