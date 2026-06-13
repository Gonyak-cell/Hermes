import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

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
  const pixelMeasurementRows = options.pixelAnalysis === false
    ? []
    : await buildPixelMeasurementRows(screenshotManifest, cropRows, generatedAt);
  const pixelMeasurementSummaryRows = buildPixelMeasurementSummaryRows(pixelMeasurementRows, generatedAt);
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
    pixelMeasurementRows,
    pixelMeasurementSummaryRows,
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
    pixelMeasurementRows,
    pixelMeasurementSummaryRows,
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
    pixel_measurement_rows: pixelMeasurementRows,
    pixel_measurement_summary_rows: pixelMeasurementSummaryRows,
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
      pixelMeasurementRows,
      pixelMeasurementSummaryRows,
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
  await writeJson(path.join(outDir, "pixel-measurement-rows.json"), collectionEnvelope("amplitude-pixel-measurement-rows.v1", "pixel_measurement_rows", result.pixel_measurement_rows, result.generated_at));
  await writeJson(path.join(outDir, "pixel-measurement-summary-rows.json"), collectionEnvelope("amplitude-pixel-measurement-summary-rows.v1", "pixel_measurement_summary_rows", result.pixel_measurement_summary_rows, result.generated_at));
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
  await writeFile(path.join(outDir, "pixel-layout-overlay.html"), renderPixelOverlayHtml(result), "utf8");
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
    console.log(`Pixel measurement rows: ${result.summary.pixel_measurement_complete_count}/${result.summary.pixel_measurement_count}`);
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

async function buildPixelMeasurementRows(screenshotManifest, cropRows, generatedAt) {
  const cropByScreenshotId = new Map(cropRows.map((row) => [row.screenshot_id, row]));
  const rows = [];
  for (const screenshot of screenshotManifest) {
    const crop = cropByScreenshotId.get(screenshot.screenshot_id);
    rows.push(await buildPixelMeasurementRow(screenshot, crop, generatedAt));
  }
  return rows;
}

async function buildPixelMeasurementRow(screenshot, crop, generatedAt) {
  const baseRow = {
    row_id: `pixel.${screenshot.screenshot_id}`,
    screenshot_id: screenshot.screenshot_id,
    screenshot_index: screenshot.screenshot_index,
    filename: screenshot.filename,
    generated_at: generatedAt,
    evidence_ref: screenshot.absolute_path,
    crop_ref: crop?.row_id ?? null,
    analysis_status: "blocked",
    visual_reference_only: true,
    binary_embedded: false,
  };

  try {
    const image = await decodePngRgba(screenshot.absolute_path);
    const productArea = crop?.product_area ?? { x: 0, y: 0, width: image.width, height: image.height };
    const verticalLineCandidates = detectAxisEdges(image, productArea, "vertical");
    const horizontalLineCandidates = detectAxisEdges(image, productArea, "horizontal");
    const derivedMetrics = deriveLayoutMetrics(verticalLineCandidates, horizontalLineCandidates, productArea);
    const dominantColors = dominantQuantizedColors(image, productArea);
    const componentCandidates = buildComponentCandidates(derivedMetrics, productArea);
    const confidence = scorePixelMeasurementConfidence({ verticalLineCandidates, horizontalLineCandidates, derivedMetrics, componentCandidates });

    return {
      ...baseRow,
      analysis_status: "complete",
      decoder: {
        format: "png",
        color_type: image.colorType,
        bit_depth: image.bitDepth,
        interlace_method: image.interlaceMethod,
        decoded_rgba: true,
      },
      product_area: productArea,
      sample_stride_px: 4,
      vertical_line_candidates: verticalLineCandidates,
      horizontal_line_candidates: horizontalLineCandidates,
      dominant_colors: dominantColors,
      derived_metrics: derivedMetrics,
      component_candidates: componentCandidates,
      confidence,
      exact_pixel_measurement_complete: true,
    };
  } catch (error) {
    return {
      ...baseRow,
      analysis_status: "decode_failed",
      error: error.message,
      product_area: crop?.product_area ?? null,
      vertical_line_candidates: [],
      horizontal_line_candidates: [],
      dominant_colors: [],
      derived_metrics: {},
      component_candidates: [],
      confidence: 0,
      exact_pixel_measurement_complete: false,
    };
  }
}

function buildPixelMeasurementSummaryRows(pixelMeasurementRows, generatedAt) {
  const completeRows = pixelMeasurementRows.filter((row) => row.analysis_status === "complete");
  const metricSpecs = [
    ["metric.topbar_height_px", "topbar_height_px"],
    ["metric.left_rail_width_px", "left_rail_width_px"],
    ["metric.sidebar_boundary_x", "sidebar_boundary_x"],
    ["metric.sidebar_width_px", "sidebar_width_px"],
    ["metric.inspector_boundary_x", "inspector_boundary_x"],
    ["metric.inspector_width_px", "inspector_width_px"],
    ["metric.table_row_rhythm_px", "table_row_rhythm_px"],
    ["metric.control_height_px", "control_height_px"],
    ["metric.modal_width_px", "modal_width_px"],
  ];
  return metricSpecs.map(([rowId, metricName]) => {
    const values = completeRows
      .map((row) => row.derived_metrics?.[metricName])
      .filter((value) => Number.isFinite(value));
    return {
      row_id: rowId,
      metric_name: metricName,
      sample_count: values.length,
      median_px: median(values),
      min_px: values.length ? Math.min(...values) : null,
      max_px: values.length ? Math.max(...values) : null,
      common_values: commonValues(values, 8),
      generated_at: generatedAt,
      exact_pixel_source: true,
      ready_for_token_promotion: values.length > 0,
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
  const overlayRows = selectOverlayRows(context.pixelMeasurementRows);
  const showcaseComplete = Boolean(preview)
    && preview.width === EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS.width
    && preview.height === EXPECTED_SHOWCASE_PREVIEW_DIMENSIONS.height
    && Boolean(showcaseHtml);
  const coreReady = context.source.available
    && inventoryComplete
    && showcaseComplete
    && context.cropRows.length === context.screenshotManifest.length
    && context.measurementQueueRows.length === context.screenshotManifest.length
    && context.pixelMeasurementRows.length === context.screenshotManifest.length
    && context.pixelMeasurementRows.every((row) => row.exact_pixel_measurement_complete === true)
    && context.pixelMeasurementSummaryRows.some((row) => row.ready_for_token_promotion === true)
    && overlayRows.length >= 3
    && REQUIRED_HERMES_SURFACE_IDS.every((surfaceId) => mappingIds.has(surfaceId));

  return {
    reference_pack_available: context.source.available,
    screenshot_inventory_ready: inventoryComplete,
    showcase_assets_ready: showcaseComplete,
    screenshot_crop_manifest_ready: context.cropRows.length === context.screenshotManifest.length,
    measurement_queue_ready: context.measurementQueueRows.length === context.screenshotManifest.length,
    exact_pixel_measurement_ready: context.pixelMeasurementRows.length === context.screenshotManifest.length
      && context.pixelMeasurementRows.every((row) => row.exact_pixel_measurement_complete === true),
    pixel_measurement_summary_ready: context.pixelMeasurementSummaryRows.some((row) => row.ready_for_token_promotion === true),
    pixel_layout_overlay_ready: overlayRows.length >= 3,
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
  add("pixel.measurement.rows", "measurement", context.pixelMeasurementRows.length === context.screenshotManifest.length, "Pixel measurement row count must match screenshot count", "pixel_measurement_rows");
  add("pixel.measurement.complete", "measurement", context.pixelMeasurementRows.every((row) => row.exact_pixel_measurement_complete === true), "Every screenshot must complete exact pixel measurement", "pixel_measurement_rows");
  add("pixel.measurement.summary", "measurement", context.pixelMeasurementSummaryRows.some((row) => row.ready_for_token_promotion === true), "Pixel measurement summary must include token-promotion candidates", "pixel_measurement_summary_rows");
  add("pixel.overlay.rows", "measurement", selectOverlayRows(context.pixelMeasurementRows).length >= 3, "Pixel overlay must include seeded or high-confidence samples", "pixel-layout-overlay.html");
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
    pixel_measurement_count: context.pixelMeasurementRows.length,
    pixel_measurement_complete_count: context.pixelMeasurementRows.filter((row) => row.exact_pixel_measurement_complete === true).length,
    pixel_measurement_summary_count: context.pixelMeasurementSummaryRows.length,
    pixel_layout_overlay_row_count: selectOverlayRows(context.pixelMeasurementRows).length,
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
    `- Pixel measurement rows: ${result.summary.pixel_measurement_complete_count}/${result.summary.pixel_measurement_count}`,
    `- Pixel measurement summaries: ${result.summary.pixel_measurement_summary_count}`,
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
    "- `pixel-measurement-rows.json`",
    "- `pixel-measurement-summary-rows.json`",
    "- `pixel-layout-overlay.html`",
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
  const pixelSummaryRows = result.pixel_measurement_summary_rows.map((row) => `<tr><td>${escapeHtml(row.metric_name)}</td><td>${escapeHtml(row.sample_count)}</td><td>${escapeHtml(row.median_px ?? "n/a")}</td><td>${escapeHtml(row.common_values.map((item) => `${item.value_px}px (${item.count})`).join(", "))}</td></tr>`).join("");
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
      <div class="metric"><strong>${result.summary.pixel_measurement_complete_count}</strong><span>pixel-complete</span></div>
      <div class="metric"><strong>${result.summary.design_token_seed_count}</strong><span>token seeds</span></div>
      <div class="metric"><strong>${result.summary.validation_error_count}</strong><span>validation errors</span></div>
    </section>
    <h2>Pixel Measurement Summary</h2>
    <table>
      <thead><tr><th>Metric</th><th>Samples</th><th>Median px</th><th>Common Values</th></tr></thead>
      <tbody>${pixelSummaryRows}</tbody>
    </table>
    <h2>Hermes Surface Mapping</h2>
    <table>
      <thead><tr><th>Surface</th><th>Reference Pattern</th><th>Hermes Translation</th></tr></thead>
      <tbody>${surfaceRows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function renderPixelOverlayHtml(result) {
  const selectedRows = selectOverlayRows(result.pixel_measurement_rows);
  const overlaySections = selectedRows.map((row) => renderOverlaySection(row)).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Amplitude Pixel Layout Overlay</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 26px 0 10px; }
    p { color: #4b5563; font-size: 13px; line-height: 1.5; }
    .shot { border: 1px solid #e5e7eb; background: white; border-radius: 6px; padding: 14px; margin: 18px 0; }
    .canvas { position: relative; width: 100%; aspect-ratio: 1920 / 1200; overflow: hidden; border: 1px solid #e5e7eb; background: #f3f4f6; }
    .canvas img { position: absolute; inset: 0; width: 100%; height: auto; }
    .vline, .hline { position: absolute; background: rgba(79, 70, 229, .7); pointer-events: none; }
    .vline { top: 0; bottom: 0; width: 1px; }
    .hline { left: 0; right: 0; height: 1px; background: rgba(220, 38, 38, .65); }
    .box { position: absolute; border: 2px solid rgba(5, 150, 105, .9); background: rgba(5, 150, 105, .08); box-sizing: border-box; }
    .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; font-size: 12px; color: #374151; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Amplitude Pixel Layout Overlay</h1>
    <p>Overlay lines are generated from decoded PNG pixels inside the product crop only. The footer attribution band is excluded and the source images are referenced from their local absolute paths, not copied into Hermes product assets.</p>
    ${overlaySections}
  </main>
</body>
</html>`;
}

function renderOverlaySection(row) {
  const area = row.product_area ?? EXPECTED_PRODUCT_CROP;
  const verticalLines = row.vertical_line_candidates.slice(0, 12).map((line) => `<span class="vline" title="x=${line.x}, score=${line.score}" style="left:${(line.x / area.width) * 100}%"></span>`).join("");
  const horizontalLines = row.horizontal_line_candidates.slice(0, 12).map((line) => `<span class="hline" title="y=${line.y}, score=${line.score}" style="top:${(line.y / area.height) * 100}%"></span>`).join("");
  const boxes = row.component_candidates.slice(0, 8).map((box) => {
    const x = ((box.bounds.x - area.x) / area.width) * 100;
    const y = ((box.bounds.y - area.y) / area.height) * 100;
    const width = (box.bounds.width / area.width) * 100;
    const height = (box.bounds.height / area.height) * 100;
    return `<span class="box" title="${escapeHtml(box.component_kind)} ${escapeHtml(JSON.stringify(box.bounds))}" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%"></span>`;
  }).join("");
  return `<section class="shot">
  <h2>${escapeHtml(row.filename)}</h2>
  <div class="canvas">
    <img src="${escapeHtml(row.evidence_ref)}" alt="${escapeHtml(row.filename)}">
    ${verticalLines}
    ${horizontalLines}
    ${boxes}
  </div>
  <div class="meta">
    <span><strong>topbar</strong> <code>${escapeHtml(row.derived_metrics?.topbar_height_px ?? "n/a")}</code></span>
    <span><strong>rail</strong> <code>${escapeHtml(row.derived_metrics?.left_rail_width_px ?? "n/a")}</code></span>
    <span><strong>sidebar</strong> <code>${escapeHtml(row.derived_metrics?.sidebar_width_px ?? "n/a")}</code></span>
    <span><strong>row rhythm</strong> <code>${escapeHtml(row.derived_metrics?.table_row_rhythm_px ?? "n/a")}</code></span>
  </div>
</section>`;
}

function selectOverlayRows(rows) {
  const byIndex = new Map(rows.map((row) => [row.screenshot_index, row]));
  const seeded = [0, 100, 200].map((index) => byIndex.get(index)).filter(Boolean);
  const highConfidence = rows
    .filter((row) => ![0, 100, 200].includes(row.screenshot_index))
    .filter((row) => row.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 9);
  return [...seeded, ...highConfidence];
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

async function decodePngRgba(filePath) {
  const buffer = await readFile(filePath);
  if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE_HEX) {
    throw new Error("Invalid PNG signature.");
  }

  let offset = 8;
  let width = null;
  let height = null;
  let bitDepth = null;
  let colorType = null;
  let compressionMethod = null;
  let filterMethod = null;
  let interlaceMethod = null;
  const idatChunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      compressionMethod = data.readUInt8(10);
      filterMethod = data.readUInt8(11);
      interlaceMethod = data.readUInt8(12);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height) throw new Error("PNG IHDR chunk missing.");
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (![0, 2, 4, 6].includes(colorType)) throw new Error(`Unsupported PNG color type: ${colorType}`);
  if (compressionMethod !== 0 || filterMethod !== 0 || interlaceMethod !== 0) {
    throw new Error("Unsupported PNG compression/filter/interlace method.");
  }

  const channels = channelsForColorType(colorType);
  const bytesPerPixel = channels;
  const scanlineLength = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * 4);
  let inputOffset = 0;
  let previous = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated.readUInt8(inputOffset);
    inputOffset += 1;
    const raw = inflated.subarray(inputOffset, inputOffset + scanlineLength);
    inputOffset += scanlineLength;
    const current = unfilterScanline(filterType, raw, previous, bytesPerPixel);
    copyScanlineToRgba(current, rgba, y, width, colorType);
    previous = current;
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    interlaceMethod,
    data: rgba,
  };
}

function unfilterScanline(filterType, raw, previous, bytesPerPixel) {
  const current = Buffer.alloc(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] ?? 0 : 0;
    let value;
    if (filterType === 0) value = raw[index];
    else if (filterType === 1) value = raw[index] + left;
    else if (filterType === 2) value = raw[index] + up;
    else if (filterType === 3) value = raw[index] + Math.floor((left + up) / 2);
    else if (filterType === 4) value = raw[index] + paethPredictor(left, up, upLeft);
    else throw new Error(`Unsupported PNG filter type: ${filterType}`);
    current[index] = value & 0xff;
  }
  return current;
}

function copyScanlineToRgba(scanline, rgba, y, width, colorType) {
  const channels = channelsForColorType(colorType);
  for (let x = 0; x < width; x += 1) {
    const source = x * channels;
    const target = (y * width + x) * 4;
    if (colorType === 0) {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source];
      rgba[target + 2] = scanline[source];
      rgba[target + 3] = 255;
    } else if (colorType === 2) {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source + 1];
      rgba[target + 2] = scanline[source + 2];
      rgba[target + 3] = 255;
    } else if (colorType === 4) {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source];
      rgba[target + 2] = scanline[source];
      rgba[target + 3] = scanline[source + 1];
    } else {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source + 1];
      rgba[target + 2] = scanline[source + 2];
      rgba[target + 3] = scanline[source + 3];
    }
  }
}

function channelsForColorType(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type: ${colorType}`);
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function detectAxisEdges(image, area, axis) {
  const scores = axis === "vertical"
    ? buildVerticalEdgeScores(image, area)
    : buildHorizontalEdgeScores(image, area);
  const sorted = scores
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score);
  const selected = [];
  for (const item of sorted) {
    const position = axis === "vertical" ? item.x : item.y;
    const farEnough = selected.every((existing) => Math.abs((axis === "vertical" ? existing.x : existing.y) - position) >= 6);
    if (farEnough) selected.push(item);
    if (selected.length >= 30) break;
  }
  return selected.sort((a, b) => (axis === "vertical" ? a.x - b.x : a.y - b.y));
}

function buildVerticalEdgeScores(image, area) {
  const rows = [];
  const startY = Math.max(0, area.y);
  const endY = Math.min(image.height, area.y + area.height);
  const startX = Math.max(1, area.x + 1);
  const endX = Math.min(image.width, area.x + area.width);
  for (let x = startX; x < endX; x += 1) {
    let score = 0;
    let samples = 0;
    for (let y = startY; y < endY; y += 4) {
      score += colorDistanceAt(image, x, y, x - 1, y);
      samples += 1;
    }
    rows.push({ x, score: round(score / Math.max(1, samples), 2) });
  }
  return rows;
}

function buildHorizontalEdgeScores(image, area) {
  const rows = [];
  const startX = Math.max(0, area.x);
  const endX = Math.min(image.width, area.x + area.width);
  const startY = Math.max(1, area.y + 1);
  const endY = Math.min(image.height, area.y + area.height);
  for (let y = startY; y < endY; y += 1) {
    let score = 0;
    let samples = 0;
    for (let x = startX; x < endX; x += 4) {
      score += colorDistanceAt(image, x, y, x, y - 1);
      samples += 1;
    }
    rows.push({ y, score: round(score / Math.max(1, samples), 2) });
  }
  return rows;
}

function colorDistanceAt(image, x1, y1, x2, y2) {
  const a = (y1 * image.width + x1) * 4;
  const b = (y2 * image.width + x2) * 4;
  return (Math.abs(image.data[a] - image.data[b])
    + Math.abs(image.data[a + 1] - image.data[b + 1])
    + Math.abs(image.data[a + 2] - image.data[b + 2])) / 3;
}

function dominantQuantizedColors(image, area) {
  const counts = new Map();
  const startX = Math.max(0, area.x);
  const endX = Math.min(image.width, area.x + area.width);
  const startY = Math.max(0, area.y);
  const endY = Math.min(image.height, area.y + area.height);
  for (let y = startY; y < endY; y += 12) {
    for (let x = startX; x < endX; x += 12) {
      const index = (y * image.width + x) * 4;
      const key = [image.data[index], image.data[index + 1], image.data[index + 2]]
        .map((value) => Math.round(value / 16) * 16)
        .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
        .join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([hex, count]) => ({ hex: `#${hex}`, sample_count: count }));
}

function deriveLayoutMetrics(verticalLines, horizontalLines, area) {
  const topbar = firstPositionInRange(horizontalLines, "y", 40, 96);
  const rail = firstPositionInRange(verticalLines, "x", 40, 96);
  const sidebarBoundary = firstPositionInRange(verticalLines, "x", 180, 380);
  const inspectorBoundary = lastPositionInRange(verticalLines, "x", area.width - 620, area.width - 260);
  const modalPair = findCenteredPair(verticalLines.map((line) => line.x), area.width, 360, 780);
  const rhythm = repeatedGap(horizontalLines.map((line) => line.y), 28, 72);
  const controlHeight = repeatedGap(horizontalLines.map((line) => line.y), 24, 44);

  return {
    topbar_height_px: topbar,
    left_rail_width_px: rail,
    sidebar_boundary_x: sidebarBoundary,
    sidebar_width_px: Number.isFinite(rail) && Number.isFinite(sidebarBoundary) && sidebarBoundary > rail ? sidebarBoundary - rail : null,
    inspector_boundary_x: inspectorBoundary,
    inspector_width_px: Number.isFinite(inspectorBoundary) ? area.width - inspectorBoundary : null,
    modal_left_x: modalPair?.left ?? null,
    modal_right_x: modalPair?.right ?? null,
    modal_width_px: modalPair?.width ?? null,
    table_row_rhythm_px: rhythm,
    control_height_px: controlHeight,
  };
}

function buildComponentCandidates(metrics, area) {
  const candidates = [];
  if (Number.isFinite(metrics.topbar_height_px)) {
    candidates.push(componentCandidate("topbar", 0, 0, area.width, metrics.topbar_height_px, "horizontal edge candidate"));
  }
  if (Number.isFinite(metrics.left_rail_width_px)) {
    candidates.push(componentCandidate("left_icon_rail", 0, metrics.topbar_height_px ?? 0, metrics.left_rail_width_px, area.height - (metrics.topbar_height_px ?? 0), "vertical edge candidate"));
  }
  if (Number.isFinite(metrics.sidebar_width_px)) {
    candidates.push(componentCandidate("saved_view_sidebar", metrics.left_rail_width_px, metrics.topbar_height_px ?? 0, metrics.sidebar_width_px, area.height - (metrics.topbar_height_px ?? 0), "two vertical edge candidates"));
  }
  if (Number.isFinite(metrics.inspector_width_px)) {
    candidates.push(componentCandidate("right_inspector", metrics.inspector_boundary_x, metrics.topbar_height_px ?? 0, metrics.inspector_width_px, area.height - (metrics.topbar_height_px ?? 0), "right vertical edge candidate"));
  }
  if (Number.isFinite(metrics.modal_width_px)) {
    candidates.push(componentCandidate("center_modal", metrics.modal_left_x, Math.round(area.height * 0.18), metrics.modal_width_px, Math.round(area.height * 0.5), "centered vertical pair candidate"));
  }
  return candidates;
}

function componentCandidate(componentKind, x, y, width, height, reason) {
  return {
    component_kind: componentKind,
    bounds: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    },
    detection_reason: reason,
  };
}

function scorePixelMeasurementConfidence(context) {
  let score = 0;
  if (context.verticalLineCandidates.length >= 3) score += 0.18;
  if (context.horizontalLineCandidates.length >= 3) score += 0.18;
  if (Number.isFinite(context.derivedMetrics.topbar_height_px)) score += 0.14;
  if (Number.isFinite(context.derivedMetrics.left_rail_width_px)) score += 0.12;
  if (Number.isFinite(context.derivedMetrics.sidebar_width_px)) score += 0.12;
  if (Number.isFinite(context.derivedMetrics.table_row_rhythm_px)) score += 0.12;
  if (context.componentCandidates.length >= 2) score += 0.14;
  return round(Math.min(1, score), 2);
}

function firstPositionInRange(lines, field, min, max) {
  const match = lines.find((line) => line[field] >= min && line[field] <= max);
  return match ? match[field] : null;
}

function lastPositionInRange(lines, field, min, max) {
  const matches = lines.filter((line) => line[field] >= min && line[field] <= max);
  return matches.length ? matches.at(-1)[field] : null;
}

function findCenteredPair(positions, width, minWidth, maxWidth) {
  const center = width / 2;
  let best = null;
  for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
      const left = positions[leftIndex];
      const right = positions[rightIndex];
      const candidateWidth = right - left;
      if (candidateWidth < minWidth || candidateWidth > maxWidth) continue;
      const candidateCenter = left + candidateWidth / 2;
      const centerDistance = Math.abs(center - candidateCenter);
      if (!best || centerDistance < best.centerDistance) {
        best = { left, right, width: candidateWidth, centerDistance };
      }
    }
  }
  return best;
}

function repeatedGap(positions, min, max) {
  const counts = new Map();
  const sorted = [...positions].sort((a, b) => a - b);
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index] - sorted[index - 1];
    if (gap >= min && gap <= max) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return best ? best[0] : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return round((sorted[middle - 1] + sorted[middle]) / 2, 2);
}

function commonValues(values, limit) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([value, count]) => ({ value_px: value, count }));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
    else if (value === "--skip-pixel-analysis") args.pixelAnalysis = false;
    else if (value === "--expected-screenshot-count") args.expectedScreenshotCount = Number(argv[++index]);
    else if (value === "--expected-min-index") args.expectedMinIndex = Number(argv[++index]);
    else if (value === "--expected-max-index") args.expectedMaxIndex = Number(argv[++index]);
    else if (value === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--source-dir PATH] [--out-dir PATH] [--skip-pixel-analysis]`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
