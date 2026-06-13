import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_AMPLITUDE_UI_REFERENCE_SOURCE_DIR = "/Users/jws/Applications/LazyWeb/Amplitude web Feb 2025";
export const DEFAULT_AMPLITUDE_UI_REFERENCE_OUT_DIR = "artifacts/ui-reference/amplitude-feb-2025/latest";

const COMMAND_NAME = "platform:amplitude-ui-reference-audit";
const SCHEMA_VERSION = "amplitude-ui-reference-audit.v1";
const CAPABILITY_ID = "platform.amplitude_ui_reference_audit";
const READY_STATUS = "ready_for_hermes_ui_execution_package";
const BLOCKED_STATUS = "blocked_amplitude_ui_reference_audit";
const SCREENSHOT_BASENAME = "Amplitude web Feb 2025";
const DEFAULT_EXPECTED_COUNT = 318;
const DEFAULT_EXPECTED_MIN_ID = 0;
const DEFAULT_EXPECTED_MAX_ID = 317;
const EXPECTED_SCREENSHOT_DIMENSIONS = { width: 1920, height: 1320 };
const EXPECTED_PRODUCT_CROP = { x: 0, y: 0, width: 1920, height: 1200 };
const EXPECTED_ATTRIBUTION_FOOTER = { x: 0, y: 1200, width: 1920, height: 120 };
const EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS = { width: 1440, height: 900 };
const PNG_SIGNATURE_HEX = "89504e470d0a1a0a";

const REQUIRED_HERMES_SURFACE_IDS = [
  "surface.global_operator_queue",
  "surface.saved_view_sidebar",
  "surface.object_inspector",
  "surface.review_gate_detail",
  "surface.evidence_timeline",
  "surface.readiness_rule_matrix",
  "surface.review_evidence_trace",
  "surface.receipt_workbench",
  "surface.domain_pack_detail",
  "surface.governance_audit",
];

const SEEDED_SCREEN_FAMILIES = new Map([
  [0, {
    family_id: "family.public_marketing_landing.seed",
    family_label: "Public marketing landing seed",
    classification_status: "seeded_visual_sample",
    observed_patterns: ["top navigation", "hero narrative", "marketing content bands"],
    hermes_usage: "spacing and nav rhythm only; not a Hermes product home screen",
  }],
  [100, {
    family_id: "family.analytics_workspace_modal.seed",
    family_label: "Analytics workspace with save modal seed",
    classification_status: "seeded_visual_sample",
    observed_patterns: ["topbar", "left rail", "chart workspace", "data table", "modal overlay"],
    hermes_usage: "operator queue density, modal sizing, evidence/workspace split",
  }],
  [200, {
    family_id: "family.profile_query_table.seed",
    family_label: "User profile query and table seed",
    classification_status: "seeded_visual_sample",
    observed_patterns: ["full sidebar", "query builder", "profile header", "data table"],
    hermes_usage: "saved views, object detail header, table rhythm, query-filter controls",
  }],
]);

const MEASUREMENT_TARGET_SPECS = [
  ["layout.viewport.reference_width", "Reference screenshot width", "viewport", 1920, "px", "PNG IHDR width for every numbered screenshot"],
  ["layout.viewport.reference_height", "Reference screenshot height", "viewport", 1320, "px", "PNG IHDR height for every numbered screenshot"],
  ["layout.crop.product_height", "Product crop height excluding LazyWeb/Mobbin attribution", "crop", 1200, "px", "Crop manifest y=0..1200"],
  ["layout.footer.attribution_height", "Attribution/footer exclusion band", "crop", 120, "px", "Crop manifest y=1200..1320"],
  ["layout.shell.topbar_height", "Application topbar candidate", "shell", 56, "px", "Measure against internal app screenshots before implementation"],
  ["layout.shell.left_rail_width", "Icon rail candidate", "navigation", 56, "px", "Measure against app console samples"],
  ["layout.shell.sidebar_width", "Saved-view sidebar candidate", "navigation", 248, "px", "Measure against app console samples"],
  ["layout.shell.content_gutter", "Outer content gutter candidate", "layout", 24, "px", "Measure whitespace between shell regions"],
  ["layout.shell.panel_gap", "Panel gap candidate", "layout", 16, "px", "Measure queue to inspector and card/table gutters"],
  ["layout.table.header_height", "Table header height candidate", "table", 36, "px", "Measure table header rows"],
  ["layout.table.row_height", "Table row height candidate", "table", 44, "px", "Measure dense data rows"],
  ["layout.inspector.width", "Right inspector panel candidate", "inspector", 360, "px", "Measure details/right panel examples"],
  ["layout.modal.medium_width", "Medium modal width candidate", "modal", 520, "px", "Measure save/configuration modal examples"],
  ["layout.input.control_height", "Input/control height candidate", "controls", 32, "px", "Measure filters, search, segmented controls"],
  ["layout.icon_button.size", "Icon button square candidate", "controls", 32, "px", "Measure icon-only toolbar controls"],
  ["layout.chart.min_height", "Chart workspace minimum height candidate", "chart", 280, "px", "Measure analytics chart region and translate to receipt/evidence summaries"],
];

const DESIGN_TOKEN_SEEDS = [
  ["space.0", "spacing", "0px", "edge alignment"],
  ["space.1", "spacing", "4px", "hairline label gap"],
  ["space.2", "spacing", "8px", "control inner gap"],
  ["space.3", "spacing", "12px", "compact row gap"],
  ["space.4", "spacing", "16px", "panel gap"],
  ["space.5", "spacing", "20px", "section gap"],
  ["space.6", "spacing", "24px", "page gutter"],
  ["space.8", "spacing", "32px", "major group gap"],
  ["radius.1", "radius", "4px", "small controls"],
  ["radius.2", "radius", "6px", "cards, inputs, dense panels"],
  ["radius.3", "radius", "8px", "large panels only"],
  ["border.1", "border", "1px", "hairline separation"],
  ["type.size.11", "typography", "11px", "metadata"],
  ["type.size.12", "typography", "12px", "compact labels"],
  ["type.size.13", "typography", "13px", "table cells"],
  ["type.size.14", "typography", "14px", "default UI text"],
  ["type.size.16", "typography", "16px", "panel headings"],
  ["type.size.20", "typography", "20px", "workspace headings"],
  ["color.neutral.canvas", "color", "#f8fafc", "workspace background candidate"],
  ["color.neutral.surface", "color", "#ffffff", "panel surface candidate"],
  ["color.neutral.border", "color", "#e5e7eb", "divider candidate"],
  ["color.neutral.text", "color", "#111827", "primary text candidate"],
  ["color.neutral.muted", "color", "#6b7280", "muted text candidate"],
  ["color.accent.primary", "color", "#4f46e5", "selected/focus candidate only"],
  ["color.semantic.blocked", "color", "#dc2626", "blocked state"],
  ["color.semantic.review", "color", "#d97706", "review/missing evidence state"],
  ["color.semantic.validated", "color", "#059669", "validated evidence state"],
];

const HERMES_SURFACE_MAPPING_SPECS = [
  ["surface.global_operator_queue", "Global Operator Queue", "Amplitude app-shell workspaces", "Use dense table/list rhythm, topbar status area, and scan-first rows for workflow objects."],
  ["surface.saved_view_sidebar", "Saved View Sidebar", "Amplitude left navigation and project sidebars", "Translate to Queue, Projects, Requirements, Evidence, Reviews, Gates, Conversations, Actions, Domain Packs, Governance, Audit."],
  ["surface.object_inspector", "Object Inspector", "Amplitude right/detail panels and profile pages", "Show object summary, source refs, requirement trace, evidence chain, gate state, next action, and authority boundary."],
  ["surface.review_gate_detail", "Review Gate Detail", "Configuration/save modal and detail flows", "Use modal/drawer scale for gate requirements and review evidence; no final approval control."],
  ["surface.evidence_timeline", "Evidence Timeline", "Event/activity/profile history patterns", "Use chronological rows with actor, timestamp, source, artifact, gate, and verdict metadata."],
  ["surface.readiness_rule_matrix", "Readiness Rule Matrix", "Analytics tables and chart legends", "Translate chart/table density into rule rows; never present as KPI scorecard."],
  ["surface.review_evidence_trace", "Review Evidence Trace", "Analytics provenance and saved analysis details", "Represent reviewer receipt, model/effort, findings, revalidation, and authority boundary."],
  ["surface.receipt_workbench", "Receipt Workbench", "Save/share/configuration modal flows", "Adopt modal information hierarchy for receipt requirements and validation state only."],
  ["surface.domain_pack_detail", "Domain Pack Detail", "Workspace/project/account detail screens", "Domain packs remain context overlays, not Hermes product identity."],
  ["surface.governance_audit", "Governance/Audit", "Admin/settings and profile/account surfaces", "Use compact audit rows for owner, timestamp, policy, trust tier, and blocked capabilities."],
];

const FLOW_MAPPING_SPECS = [
  ["flow.nav_to_workspace", "Navigation to workspace", "left navigation -> selected workspace", "Global navigation -> saved view -> object table"],
  ["flow.filter_to_result", "Filter/query to result", "query builder -> table/chart result", "Requirement filter -> evidence-backed queue result"],
  ["flow.record_to_detail", "Record to detail", "row/profile selection -> detail surface", "ObjectRow -> Object Inspector"],
  ["flow.save_modal", "Save/configuration modal", "save chart/report modal", "Receipt requirement or gate record modal"],
  ["flow.profile_activity", "Profile/activity inspection", "user/profile event history", "Evidence Timeline and SourceRef inspection"],
  ["flow.admin_settings", "Admin/settings management", "settings/account workspaces", "Governance/Audit read-only state"],
  ["flow.share_export", "Share/export surfaces", "dashboard/report share affordances", "Review packet handoff only; no protected write execution"],
];

export async function runAmplitudeUiReferenceAudit(options = {}) {
  const result = await buildAmplitudeUiReferenceAudit(options);
  if (!options.check && options.write !== false) await writeAmplitudeUiReferenceAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Amplitude UI reference audit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAmplitudeUiReferenceAudit(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceDir = path.resolve(options.sourceDir ?? DEFAULT_AMPLITUDE_UI_REFERENCE_SOURCE_DIR);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AMPLITUDE_UI_REFERENCE_OUT_DIR);
  const expected = normalizeExpected(options);
  const source = await readReferenceSource(sourceDir);
  const screenshotManifest = await buildScreenshotManifest(source, generatedAt);
  const assetManifest = await buildAssetManifest(source, generatedAt);
  const cropRows = buildCropRows(screenshotManifest, generatedAt);
  const screenFamilyRows = buildScreenFamilyRows(screenshotManifest, generatedAt);
  const measurementQueueRows = buildMeasurementQueueRows(screenshotManifest, generatedAt);
  const measurementPlanRows = buildMeasurementPlanRows(generatedAt);
  const designTokenSeedRows = buildDesignTokenSeedRows(generatedAt);
  const hermesSurfaceMappingRows = buildHermesSurfaceMappingRows(generatedAt);
  const flowMappingRows = buildFlowMappingRows(generatedAt);
  const boundary = buildBoundary({
    source,
    screenshotManifest,
    assetManifest,
    cropRows,
    screenFamilyRows,
    measurementQueueRows,
    measurementPlanRows,
    designTokenSeedRows,
    hermesSurfaceMappingRows,
    flowMappingRows,
    expected,
  });
  const validationItems = buildValidationItems({
    source,
    screenshotManifest,
    assetManifest,
    cropRows,
    screenFamilyRows,
    measurementQueueRows,
    measurementPlanRows,
    designTokenSeedRows,
    hermesSurfaceMappingRows,
    flowMappingRows,
    boundary,
    expected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    source_dir: sourceDir,
    output_dir: outputDir,
    expected,
    reference_source: source.summary,
    screenshot_manifest: screenshotManifest,
    asset_manifest: assetManifest,
    crop_manifest_rows: cropRows,
    screen_family_rows: screenFamilyRows,
    measurement_queue_rows: measurementQueueRows,
    measurement_plan_rows: measurementPlanRows,
    design_token_seed_rows: designTokenSeedRows,
    hermes_surface_mapping_rows: hermesSurfaceMappingRows,
    flow_mapping_rows: flowMappingRows,
    ui_reference_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary: buildSummary({
      source,
      screenshotManifest,
      assetManifest,
      cropRows,
      screenFamilyRows,
      measurementQueueRows,
      measurementPlanRows,
      designTokenSeedRows,
      hermesSurfaceMappingRows,
      flowMappingRows,
      boundary,
      validation,
    }),
  };
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeAmplitudeUiReferenceAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "amplitude-ui-reference-audit.json"), serializableResult(result));
  await writeJson(path.join(outDir, "screenshot-manifest.json"), collectionEnvelope("amplitude-screenshot-manifest.v1", "screenshots", result.screenshot_manifest, result.generated_at));
  await writeJson(path.join(outDir, "asset-manifest.json"), collectionEnvelope("amplitude-asset-manifest.v1", "assets", result.asset_manifest, result.generated_at));
  await writeJson(path.join(outDir, "crop-manifest.json"), collectionEnvelope("amplitude-crop-manifest.v1", "crop_manifest_rows", result.crop_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "screen-family-rows.json"), collectionEnvelope("amplitude-screen-family-rows.v1", "screen_family_rows", result.screen_family_rows, result.generated_at));
  await writeJson(path.join(outDir, "measurement-queue-rows.json"), collectionEnvelope("amplitude-measurement-queue-rows.v1", "measurement_queue_rows", result.measurement_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "measurement-plan.json"), collectionEnvelope("amplitude-measurement-plan.v1", "measurement_plan_rows", result.measurement_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "design-token-seed.json"), collectionEnvelope("amplitude-design-token-seed.v1", "design_token_seed_rows", result.design_token_seed_rows, result.generated_at));
  await writeJson(path.join(outDir, "hermes-surface-mapping-rows.json"), collectionEnvelope("amplitude-hermes-surface-mapping-rows.v1", "hermes_surface_mapping_rows", result.hermes_surface_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "flow-mapping-rows.json"), collectionEnvelope("amplitude-flow-mapping-rows.v1", "flow_mapping_rows", result.flow_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-reference-boundary.json"), result.ui_reference_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "amplitude-ui-reference-audit-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runAmplitudeUiReferenceAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runAmplitudeUiReferenceAudit(args);
    console.log(`Amplitude UI reference audit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.amplitude_ui_reference_status}`);
    console.log(`Screenshots: ${result.summary.screenshot_count}`);
    console.log(`Measurement queue rows: ${result.summary.measurement_queue_count}`);
    console.log(`Hermes surface mappings: ${result.summary.hermes_surface_mapping_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

async function readReferenceSource(sourceDir) {
  try {
    const entries = await readdir(sourceDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    return {
      available: true,
      path: sourceDir,
      files,
      summary: {
        available: true,
        path: sourceDir,
        file_count: files.length,
        screenshot_candidate_count: files.filter((name) => parseScreenshotName(name) !== null).length,
        showcase_preview_available: files.includes("showcase-preview.png"),
        showcase_html_available: files.includes("showcase.html"),
      },
    };
  } catch (error) {
    return {
      available: false,
      path: sourceDir,
      files: [],
      error: error.message,
      summary: {
        available: false,
        path: sourceDir,
        file_count: 0,
        screenshot_candidate_count: 0,
        showcase_preview_available: false,
        showcase_html_available: false,
        error: error.message,
      },
    };
  }
}

async function buildScreenshotManifest(source, generatedAt) {
  if (!source.available) return [];
  const rows = [];
  for (const filename of source.files) {
    const screenshotIndex = parseScreenshotName(filename);
    if (screenshotIndex === null) continue;
    const absolutePath = path.join(source.path, filename);
    const file = await readFileMetadata(absolutePath);
    const png = await readPngMetadata(absolutePath);
    rows.push({
      screenshot_id: `amplitude_web_feb_2025_${String(screenshotIndex).padStart(3, "0")}`,
      screenshot_index: screenshotIndex,
      filename,
      absolute_path: absolutePath,
      relative_path: filename,
      asset_kind: "reference_screenshot",
      width: png.width,
      height: png.height,
      png_valid: png.valid,
      bytes: file.bytes,
      sha256: file.sha256,
      generated_at: generatedAt,
      binary_embedded: false,
      product_asset_enabled: false,
      visual_reference_only: true,
      crop_required: true,
      ui_measurement_required: true,
    });
  }
  return rows.sort((a, b) => a.screenshot_index - b.screenshot_index);
}

async function buildAssetManifest(source, generatedAt) {
  if (!source.available) return [];
  const assetNames = ["showcase-preview.png", "showcase.html"];
  const rows = [];
  for (const filename of assetNames) {
    if (!source.files.includes(filename)) continue;
    const absolutePath = path.join(source.path, filename);
    const file = await readFileMetadata(absolutePath);
    const png = filename.endsWith(".png") ? await readPngMetadata(absolutePath) : null;
    rows.push({
      asset_id: filename.replaceAll(".", "_").replaceAll("-", "_"),
      filename,
      absolute_path: absolutePath,
      relative_path: filename,
      asset_kind: filename.endsWith(".png") ? "showcase_preview" : "showcase_html",
      width: png?.width ?? null,
      height: png?.height ?? null,
      png_valid: png?.valid ?? null,
      bytes: file.bytes,
      sha256: file.sha256,
      generated_at: generatedAt,
      body_embedded: false,
      binary_embedded: false,
      product_asset_enabled: false,
      visual_reference_only: true,
    });
  }
  return rows;
}

function buildCropRows(screenshotManifest, generatedAt) {
  return screenshotManifest.map((screenshot) => {
    const usesDefaultProductCrop = screenshot.width === EXPECTED_SCREENSHOT_DIMENSIONS.width && screenshot.height === EXPECTED_SCREENSHOT_DIMENSIONS.height;
    const productArea = usesDefaultProductCrop
      ? { ...EXPECTED_PRODUCT_CROP }
      : { x: 0, y: 0, width: screenshot.width, height: screenshot.height };
    const attributionFooter = usesDefaultProductCrop ? { ...EXPECTED_ATTRIBUTION_FOOTER } : null;
    return {
      row_id: `crop.${screenshot.screenshot_id}`,
      screenshot_id: screenshot.screenshot_id,
      screenshot_index: screenshot.screenshot_index,
      filename: screenshot.filename,
      coordinate_system: "source_pixel_space",
      full_image: { x: 0, y: 0, width: screenshot.width, height: screenshot.height },
      product_area: productArea,
      attribution_footer: attributionFooter,
      attribution_footer_excluded_from_measurements: attributionFooter !== null,
      crop_status: usesDefaultProductCrop ? "ready" : "needs_dimension_review",
      generated_at: generatedAt,
      evidence_ref: screenshot.absolute_path,
    };
  });
}

function buildScreenFamilyRows(screenshotManifest, generatedAt) {
  return screenshotManifest.map((screenshot) => {
    const seeded = SEEDED_SCREEN_FAMILIES.get(screenshot.screenshot_index);
    const bucketHint = bucketHintForIndex(screenshot.screenshot_index);
    return {
      row_id: `family.${screenshot.screenshot_id}`,
      screenshot_id: screenshot.screenshot_id,
      screenshot_index: screenshot.screenshot_index,
      filename: screenshot.filename,
      family_id: seeded?.family_id ?? `family.${bucketHint}.pending`,
      family_label: seeded?.family_label ?? `${bucketHint.replaceAll("_", " ")} pending visual review`,
      classification_status: seeded?.classification_status ?? "pending_manual_visual_review",
      bucket_hint: bucketHint,
      observed_patterns: seeded?.observed_patterns ?? [],
      hermes_usage: seeded?.hermes_usage ?? "queued for exact component and spacing measurement before implementation",
      generated_at: generatedAt,
      visual_reference_only: true,
      product_copy_allowed: false,
      brand_asset_allowed: false,
    };
  });
}

function buildMeasurementQueueRows(screenshotManifest, generatedAt) {
  return screenshotManifest.map((screenshot) => {
    const seeded = SEEDED_SCREEN_FAMILIES.has(screenshot.screenshot_index);
    return {
      row_id: `measure.${screenshot.screenshot_id}`,
      screenshot_id: screenshot.screenshot_id,
      screenshot_index: screenshot.screenshot_index,
      filename: screenshot.filename,
      measurement_status: seeded ? "seeded_sample_measurement_required" : "queued_exact_pixel_measurement",
      product_area_ref: `crop.${screenshot.screenshot_id}`,
      required_measurements: [
        "topbar_height",
        "left_navigation_width",
        "sidebar_width",
        "content_gutter",
        "panel_gap",
        "table_header_height",
        "table_row_height",
        "control_height",
        "modal_width",
        "inspector_width",
      ],
      exclude_regions: ["attribution_footer"],
      generated_at: generatedAt,
      evidence_ref: screenshot.absolute_path,
      ready_for_pixel_annotation: screenshot.png_valid === true,
      visual_reference_only: true,
    };
  });
}

function buildMeasurementPlanRows(generatedAt) {
  return MEASUREMENT_TARGET_SPECS.map(([rowId, label, category, seedPx, unit, method]) => ({
    row_id: rowId,
    category,
    label,
    seed_value: seedPx,
    unit,
    measurement_method: method,
    exact_pixel_pass_required: true,
    source_crop_required: true,
    product_implementation_token: rowId.replace("layout.", "hermes."),
    generated_at: generatedAt,
    final_value_status: ["viewport", "crop"].includes(category) ? "verified_from_png_header_or_crop" : "candidate_pending_full_pixel_annotation",
  }));
}

function buildDesignTokenSeedRows(generatedAt) {
  return DESIGN_TOKEN_SEEDS.map(([rowId, category, value, usage]) => ({
    row_id: rowId,
    category,
    token_name: rowId,
    seed_value: value,
    usage,
    source_reference: "Amplitude web Feb 2025 reference pack",
    hermes_translation_required: true,
    exact_copy_of_brand_identity_allowed: false,
    generated_at: generatedAt,
  }));
}

function buildHermesSurfaceMappingRows(generatedAt) {
  return HERMES_SURFACE_MAPPING_SPECS.map(([surfaceId, label, sourcePattern, hermesInstruction]) => ({
    row_id: surfaceId,
    surface_id: surfaceId,
    label,
    source_pattern: sourcePattern,
    hermes_instruction: hermesInstruction,
    read_only_reference_intake: true,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    product_brand_copy_allowed: false,
    generated_at: generatedAt,
  }));
}

function buildFlowMappingRows(generatedAt) {
  return FLOW_MAPPING_SPECS.map(([rowId, label, sourceFlow, hermesFlow]) => ({
    row_id: rowId,
    label,
    source_flow: sourceFlow,
    hermes_flow: hermesFlow,
    flow_translation_status: "ready_for_ui_design_handoff",
    exact_interaction_copy_allowed: false,
    protected_action_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildBoundary(context) {
  const mappingIds = new Set(context.hermesSurfaceMappingRows.map((row) => row.surface_id));
  const screenshotIndexes = context.screenshotManifest.map((row) => row.screenshot_index);
  const missingIndexes = [];
  for (let index = context.expected.min_index; index <= context.expected.max_index; index += 1) {
    if (!screenshotIndexes.includes(index)) missingIndexes.push(index);
  }
  const inventoryComplete = context.screenshotManifest.length === context.expected.screenshot_count
    && missingIndexes.length === 0
    && findDuplicateIndexes(screenshotIndexes).length === 0
    && context.screenshotManifest.every((row) => row.png_valid === true)
    && context.screenshotManifest.every((row) => row.width === EXPECTED_SCREENSHOT_DIMENSIONS.width && row.height === EXPECTED_SCREENSHOT_DIMENSIONS.height);
  const preview = context.assetManifest.find((row) => row.filename === "showcase-preview.png");
  const showcaseHtml = context.assetManifest.find((row) => row.filename === "showcase.html");
  const showcaseComplete = Boolean(preview)
    && preview.width === EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS.width
    && preview.height === EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS.height
    && Boolean(showcaseHtml);
  const coreReady = context.source.available
    && inventoryComplete
    && showcaseComplete
    && context.cropRows.length === context.screenshotManifest.length
    && context.measurementQueueRows.length === context.screenshotManifest.length
    && REQUIRED_HERMES_SURFACE_IDS.every((surfaceId) => mappingIds.has(surfaceId));

  return {
    reference_pack_available: context.source.available,
    screenshot_inventory_ready: inventoryComplete,
    showcase_assets_ready: showcaseComplete,
    screenshot_crop_manifest_ready: context.cropRows.length === context.screenshotManifest.length,
    measurement_queue_ready: context.measurementQueueRows.length === context.screenshotManifest.length,
    measurement_plan_ready: context.measurementPlanRows.length >= MEASUREMENT_TARGET_SPECS.length,
    design_token_seed_ready: context.designTokenSeedRows.length >= DESIGN_TOKEN_SEEDS.length,
    hermes_surface_mapping_ready: REQUIRED_HERMES_SURFACE_IDS.every((surfaceId) => mappingIds.has(surfaceId)),
    flow_mapping_ready: context.flowMappingRows.length === FLOW_MAPPING_SPECS.length,
    ready_for_hermes_ui_execution_package: coreReady,
    read_only_reference_intake: true,
    visual_reference_only: true,
    source_body_embedded: false,
    binary_body_embedded: false,
    screenshot_binary_copied_to_repo: false,
    amplitude_brand_assets_copied: false,
    amplitude_logo_or_copy_allowed: false,
    mobbin_footer_used_as_ui: false,
    literal_clone_allowed: false,
    hermes_rebrand_required: true,
    product_asset_enabled: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => {
    items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  };
  const screenshotIndexes = context.screenshotManifest.map((row) => row.screenshot_index);
  const missingIndexes = [];
  for (let index = context.expected.min_index; index <= context.expected.max_index; index += 1) {
    if (!screenshotIndexes.includes(index)) missingIndexes.push(index);
  }
  const duplicateIndexes = findDuplicateIndexes(screenshotIndexes);
  const invalidDimensions = context.screenshotManifest.filter((row) => row.width !== EXPECTED_SCREENSHOT_DIMENSIONS.width || row.height !== EXPECTED_SCREENSHOT_DIMENSIONS.height);
  const invalidPngRows = context.screenshotManifest.filter((row) => row.png_valid !== true);
  const preview = context.assetManifest.find((row) => row.filename === "showcase-preview.png");
  const html = context.assetManifest.find((row) => row.filename === "showcase.html");
  const mappingIds = new Set(context.hermesSurfaceMappingRows.map((row) => row.surface_id));

  add("source.available", "source", context.source.available, `Source directory unavailable: ${context.source.error ?? context.source.path}`, context.source.path);
  add("screenshots.count", "inventory", context.screenshotManifest.length === context.expected.screenshot_count, `Expected ${context.expected.screenshot_count} screenshots, found ${context.screenshotManifest.length}`, context.source.path);
  add("screenshots.range", "inventory", missingIndexes.length === 0, `Missing screenshot indexes: ${missingIndexes.slice(0, 20).join(", ")}${missingIndexes.length > 20 ? "..." : ""}`, "screenshot_manifest");
  add("screenshots.duplicates", "inventory", duplicateIndexes.length === 0, `Duplicate screenshot indexes: ${duplicateIndexes.join(", ")}`, "screenshot_manifest");
  add("screenshots.png", "inventory", invalidPngRows.length === 0, `${invalidPngRows.length} screenshot PNG headers are invalid`, "screenshot_manifest");
  add("screenshots.dimensions", "inventory", invalidDimensions.length === 0, `${invalidDimensions.length} screenshots do not match 1920x1320`, "screenshot_manifest");
  add("showcase.preview", "asset", Boolean(preview), "showcase-preview.png missing", "asset_manifest");
  add("showcase.preview.dimensions", "asset", Boolean(preview) && preview.width === EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS.width && preview.height === EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS.height, "showcase-preview.png must be 1440x900", "asset_manifest");
  add("showcase.html", "asset", Boolean(html), "showcase.html missing", "asset_manifest");
  add("crop.rows", "crop", context.cropRows.length === context.screenshotManifest.length, "Crop row count must match screenshot count", "crop_manifest_rows");
  add("crop.footer.excluded", "crop", context.cropRows.every((row) => row.attribution_footer_excluded_from_measurements === true), "Attribution/footer must be excluded from every numbered screenshot measurement", "crop_manifest_rows");
  add("measurement.queue.rows", "measurement", context.measurementQueueRows.length === context.screenshotManifest.length, "Measurement queue row count must match screenshot count", "measurement_queue_rows");
  add("measurement.plan.rows", "measurement", context.measurementPlanRows.length >= MEASUREMENT_TARGET_SPECS.length, "Measurement plan rows incomplete", "measurement_plan_rows");
  add("design.tokens", "tokens", context.designTokenSeedRows.length >= DESIGN_TOKEN_SEEDS.length, "Design token seed rows incomplete", "design_token_seed_rows");
  for (const surfaceId of REQUIRED_HERMES_SURFACE_IDS) {
    add(`surface.${surfaceId}`, "surface_mapping", mappingIds.has(surfaceId), `${surfaceId} missing from Hermes surface mapping`, "hermes_surface_mapping_rows");
  }
  add("flow.rows", "flow_mapping", context.flowMappingRows.length === FLOW_MAPPING_SPECS.length, "Flow mapping rows incomplete", "flow_mapping_rows");
  add("boundary.no.brand.copy", "boundary", context.boundary.amplitude_brand_assets_copied === false && context.boundary.literal_clone_allowed === false, "Reference audit allowed brand copy or literal clone", "ui_reference_boundary");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false, "Reference audit opened write/protected action", "ui_reference_boundary");
  add("boundary.no.final.approval", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Reference audit opened final approval UI", "ui_reference_boundary");
  add("boundary.ready", "boundary", context.boundary.ready_for_hermes_ui_execution_package === true, "Reference audit is not ready for Hermes UI execution package", "ui_reference_boundary");
  return items;
}

function buildSummary(context) {
  return {
    amplitude_ui_reference_status: context.validation.valid ? READY_STATUS : BLOCKED_STATUS,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    reference_pack_available: context.source.available,
    screenshot_count: context.screenshotManifest.length,
    asset_count: context.assetManifest.length,
    crop_row_count: context.cropRows.length,
    screen_family_count: context.screenFamilyRows.length,
    measurement_queue_count: context.measurementQueueRows.length,
    measurement_plan_count: context.measurementPlanRows.length,
    design_token_seed_count: context.designTokenSeedRows.length,
    hermes_surface_mapping_count: context.hermesSurfaceMappingRows.length,
    flow_mapping_count: context.flowMappingRows.length,
    seeded_visual_sample_count: context.screenFamilyRows.filter((row) => row.classification_status === "seeded_visual_sample").length,
    pending_manual_visual_review_count: context.screenFamilyRows.filter((row) => row.classification_status === "pending_manual_visual_review").length,
    ready_for_hermes_ui_execution_package: context.boundary.ready_for_hermes_ui_execution_package,
    read_only_reference_intake: context.boundary.read_only_reference_intake,
    visual_reference_only: context.boundary.visual_reference_only,
    literal_clone_allowed: context.boundary.literal_clone_allowed,
    amplitude_brand_assets_copied: context.boundary.amplitude_brand_assets_copied,
    mobbin_footer_used_as_ui: context.boundary.mobbin_footer_used_as_ui,
    write_control_enabled: context.boundary.write_control_enabled,
    protected_action_enabled: context.boundary.protected_action_enabled,
    final_approval_ui_enabled: context.boundary.final_approval_ui_enabled,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Amplitude UI Reference Audit",
    "",
    `- Status: ${result.summary.amplitude_ui_reference_status}`,
    `- Source: ${result.source_dir}`,
    `- Screenshots inventoried: ${result.summary.screenshot_count}`,
    `- Measurement queue rows: ${result.summary.measurement_queue_count}`,
    `- Crop rows: ${result.summary.crop_row_count}`,
    `- Token seed rows: ${result.summary.design_token_seed_count}`,
    `- Hermes surface mappings: ${result.summary.hermes_surface_mapping_count}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "- Reference screenshots remain visual evidence only.",
    "- Amplitude logos, copy, brand assets, and the LazyWeb/Mobbin attribution footer are not product UI.",
    "- Hermes must translate layout rhythm, density, spacing, and component relationships into its own Global Operator Console.",
    "- This audit opens no write control, protected action, final approval UI, production claim, or enterprise trust claim.",
    "",
    "## Required Output Files",
    "",
    "- `screenshot-manifest.json`",
    "- `crop-manifest.json`",
    "- `measurement-queue-rows.json`",
    "- `measurement-plan.json`",
    "- `design-token-seed.json`",
    "- `hermes-surface-mapping-rows.json`",
    "- `flow-mapping-rows.json`",
    "- `validation-report.json`",
    "",
    "## Hermes Surfaces",
    "",
    ...result.hermes_surface_mapping_rows.map((row) => `- ${row.label}: ${row.hermes_instruction}`),
    "",
  ].join("\n");
}

function renderHtml(result) {
  const surfaceRows = result.hermes_surface_mapping_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.source_pattern)}</td><td>${escapeHtml(row.hermes_instruction)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Amplitude UI Reference Audit</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    h2 { font-size: 16px; margin: 28px 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; background: white; }
    .metric strong { display: block; font-size: 22px; }
    .metric span { color: #6b7280; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 13px; vertical-align: top; }
    th { color: #6b7280; font-weight: 600; background: #f9fafb; }
    .notice { border: 1px solid #d1d5db; background: #ffffff; border-radius: 6px; padding: 14px; font-size: 13px; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>Amplitude UI Reference Audit</h1>
    <div class="notice">This is a read-only Hermes reference intake package. It translates layout evidence into Hermes UI contracts without copying brand assets, screenshots, or product claims.</div>
    <h2>Summary</h2>
    <section class="grid">
      <div class="metric"><strong>${result.summary.screenshot_count}</strong><span>screenshots</span></div>
      <div class="metric"><strong>${result.summary.measurement_queue_count}</strong><span>measurement rows</span></div>
      <div class="metric"><strong>${result.summary.design_token_seed_count}</strong><span>token seeds</span></div>
      <div class="metric"><strong>${result.summary.validation_error_count}</strong><span>validation errors</span></div>
    </section>
    <h2>Hermes Surface Mapping</h2>
    <table>
      <thead><tr><th>Surface</th><th>Reference Pattern</th><th>Hermes Translation</th></tr></thead>
      <tbody>${surfaceRows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

async function readFileMetadata(filePath) {
  const [fileStat, buffer] = await Promise.all([stat(filePath), readFile(filePath)]);
  return {
    bytes: fileStat.size,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function readPngMetadata(filePath) {
  try {
    const buffer = await readFile(filePath);
    const signature = buffer.subarray(0, 8).toString("hex");
    const chunkType = buffer.subarray(12, 16).toString("ascii");
    const valid = signature === PNG_SIGNATURE_HEX && chunkType === "IHDR" && buffer.length >= 24;
    return {
      valid,
      width: valid ? buffer.readUInt32BE(16) : null,
      height: valid ? buffer.readUInt32BE(20) : null,
    };
  } catch (error) {
    return {
      valid: false,
      width: null,
      height: null,
      error: error.message,
    };
  }
}

function parseScreenshotName(filename) {
  const match = filename.match(/^Amplitude web Feb 2025 (\d+)\.png$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function bucketHintForIndex(index) {
  if (index < 50) return "public_marketing_or_landing";
  if (index < 140) return "analytics_workspace_or_charting";
  if (index < 220) return "profiles_queries_or_tables";
  if (index < 280) return "admin_settings_or_governance";
  return "sharing_reporting_or_export";
}

function findDuplicateIndexes(indexes) {
  const seen = new Set();
  const duplicates = new Set();
  for (const index of indexes) {
    if (seen.has(index)) duplicates.add(index);
    seen.add(index);
  }
  return [...duplicates].sort((a, b) => a - b);
}

function normalizeExpected(options) {
  return {
    screenshot_count: Number(options.expectedScreenshotCount ?? DEFAULT_EXPECTED_COUNT),
    min_index: Number(options.expectedMinIndex ?? DEFAULT_EXPECTED_MIN_ID),
    max_index: Number(options.expectedMaxIndex ?? DEFAULT_EXPECTED_MAX_ID),
    screenshot_dimensions: { ...EXPECTED_SCREENSHOT_DIMENSIONS },
    product_crop: { ...EXPECTED_PRODUCT_CROP },
    attribution_footer: { ...EXPECTED_ATTRIBUTION_FOOTER },
    showcase_preview_dimensions: { ...EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS },
  };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return {
    item_id: itemId,
    category,
    ok: Boolean(ok),
    current_verdict: ok ? "pass" : "block",
    message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.ok !== true);
  return {
    valid: errors.length === 0,
    checked_count: items.length,
    error_count: errors.length,
    errors,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, html, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") {
      args.check = true;
      args.write = false;
    } else if (value === "--source-dir") args.sourceDir = argv[++index];
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--expected-screenshot-count") args.expectedScreenshotCount = Number(argv[++index]);
    else if (value === "--expected-min-index") args.expectedMinIndex = Number(argv[++index]);
    else if (value === "--expected-max-index") args.expectedMaxIndex = Number(argv[++index]);
    else if (value === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--source-dir PATH] [--out-dir PATH]`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
