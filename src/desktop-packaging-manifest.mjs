import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_DESKTOP_PACKAGING_MANIFEST_OUT_DIR = "artifacts/desktop-packaging-manifest/latest";
export const DEFAULT_DESKTOP_PACKAGING_MANIFEST_INPUTS = {
  schemaPath: "schemas/desktop-packaging-manifest.schema.json",
  rootPackagePath: "package.json",
  desktopPackagePath: "apps/desktop/package.json",
  desktopLockfilePath: "apps/desktop/package-lock.json",
  desktopMainPath: "apps/desktop/src/main/main.mjs",
  desktopRunbookPath: "docs/hermes-desktop-local-launch-runbook-2026-06-14.md",
};

const SCHEMA_VERSION = "desktop-packaging-manifest.v1";
const CAPABILITY_ID = "desktop.packaging_manifest";
const READY_STATUS = "local_build_ready_packaging_closed";
const BLOCKED_STATUS = "blocked_desktop_packaging_manifest";

const REQUIRED_ROOT_SCRIPTS = [
  "desktop:build",
  "desktop:start",
  "desktop:local-preflight",
  "desktop:smoke:render",
];

const REQUIRED_DESKTOP_SCRIPTS = [
  "build",
  "start",
  "smoke:render",
];

const FORBIDDEN_UPDATE_DEPENDENCIES = [
  "electron-updater",
  "update-electron-app",
];

const FORBIDDEN_MAIN_TERMS = [
  "autoUpdater",
  "setFeedURL",
  "checkForUpdates",
  "checkForUpdatesAndNotify",
];

export async function runDesktopPackagingManifest(options = {}) {
  const result = await buildDesktopPackagingManifest(options);
  if (options.write !== false) await writeDesktopPackagingManifest(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Desktop packaging manifest failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDesktopPackagingManifest(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DESKTOP_PACKAGING_MANIFEST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const rootPackage = await readJsonSource(inputs.root_package_path);
  const desktopPackage = await readJsonSource(inputs.desktop_package_path);
  const desktopLockfile = await readJsonSource(inputs.desktop_lockfile_path);
  const desktopMain = await readTextSource(inputs.desktop_main_path);
  const desktopRunbook = await readTextSource(inputs.desktop_runbook_path);

  const scriptRows = buildScriptRows({ rootPackage, desktopPackage, generatedAt });
  const autoUpdateRows = buildAutoUpdateRows({ desktopPackage, desktopLockfile, desktopMain, generatedAt });
  const packagingRows = buildPackagingRows({ desktopPackage, desktopLockfile, desktopRunbook, generatedAt });
  const boundary = buildPackagingBoundary({ scriptRows, autoUpdateRows, packagingRows, generatedAt });
  const validationItems = buildValidationItems({ rootPackage, desktopPackage, desktopLockfile, desktopMain, desktopRunbook, scriptRows, autoUpdateRows, packagingRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    script_rows: scriptRows,
    auto_update_rows: autoUpdateRows,
    packaging_rows: packagingRows,
    desktop_packaging_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, scriptRows, autoUpdateRows, packagingRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "desktop_packaging_manifest")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ boundary, scriptRows, autoUpdateRows, packagingRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeDesktopPackagingManifest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "desktop-packaging-manifest.json"), serializable);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "desktop-packaging-manifest-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDesktopPackagingManifestCli(argv = process.argv.slice(2)) {
  try {
    const args = parseDesktopPackagingManifestArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runDesktopPackagingManifest(args);
    console.log(`Desktop packaging manifest ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.desktop_packaging_status}`);
    console.log(`Required scripts ready: ${result.summary.ready_script_count}/${result.summary.script_count}`);
    console.log(`Auto update closed: ${result.summary.auto_update_enabled === false}`);
    console.log(`Packaging authority closed: ${result.summary.packaging_authority_open === false}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildScriptRows({ rootPackage, desktopPackage, generatedAt }) {
  const rootScripts = rootPackage.data?.scripts ?? {};
  const desktopScripts = desktopPackage.data?.scripts ?? {};
  const rows = [];
  for (const scriptName of REQUIRED_ROOT_SCRIPTS) {
    rows.push(scriptRow("root", scriptName, rootScripts[scriptName], generatedAt));
  }
  for (const scriptName of REQUIRED_DESKTOP_SCRIPTS) {
    rows.push(scriptRow("apps/desktop", scriptName, desktopScripts[scriptName], generatedAt));
  }
  return rows;
}

function scriptRow(scope, scriptName, command, generatedAt) {
  const ready = typeof command === "string" && command.trim().length > 0;
  const row = {
    schema_version: "desktop-packaging-script-row.v1",
    row_id: `desktop.packaging.script.${scope.replaceAll("/", "_")}.${scriptName.replaceAll(":", "_")}`,
    scope,
    script_name: scriptName,
    command: command ?? null,
    status: ready ? "ready" : "blocked",
    blocker: ready ? null : `Missing required ${scope} script: ${scriptName}`,
    generated_at: generatedAt,
  };
  return { ...row, row_hash: sha256(row) };
}

function buildAutoUpdateRows({ desktopPackage, desktopLockfile, desktopMain, generatedAt }) {
  const packageText = JSON.stringify(desktopPackage.data ?? {});
  const lockText = JSON.stringify(desktopLockfile.data ?? {});
  const mainText = desktopMain.text ?? "";
  const rows = [];
  for (const dependency of FORBIDDEN_UPDATE_DEPENDENCIES) {
    const observed = packageText.includes(`"${dependency}"`) || lockText.includes(`node_modules/${dependency}`);
    rows.push(autoUpdateRow(`dependency.${dependency}`, "dependency", dependency, observed, generatedAt));
  }
  for (const term of FORBIDDEN_MAIN_TERMS) {
    const observed = mainText.includes(term);
    rows.push(autoUpdateRow(`main.${term}`, "main_process_term", term, observed, generatedAt));
  }
  return rows;
}

function autoUpdateRow(rowId, probeType, probe, observed, generatedAt) {
  const row = {
    schema_version: "desktop-auto-update-row.v1",
    row_id: `desktop.auto_update.${rowId}`,
    probe_type: probeType,
    probe,
    observed,
    required_value: false,
    status: observed ? "blocked" : "ready",
    blocker: observed ? `Forbidden auto-update surface observed: ${probe}` : null,
    generated_at: generatedAt,
  };
  return { ...row, row_hash: sha256(row) };
}

function buildPackagingRows({ desktopPackage, desktopLockfile, desktopRunbook, generatedAt }) {
  void desktopRunbook;
  const combined = `${JSON.stringify(desktopPackage.data ?? {})}\n${JSON.stringify(desktopLockfile.data ?? {})}`;
  const specs = [
    ["macos_app_packaged", "macOS .app packaging", false, /electron-builder|electron-forge|@electron\/packager/i.test(combined)],
    ["signing_configured", "Code signing configuration", false, /CSC_LINK|APPLE_ID|codesign|identity|hardenedRuntime/i.test(combined)],
    ["notarization_configured", "Notarization configuration", false, /notarize|notarytool|APPLE_TEAM_ID/i.test(combined)],
    ["publish_configured", "Release publish configuration", false, /publish|GitHub Release published:\s*true/i.test(combined)],
  ];
  return specs.map(([rowId, label, requiredValue, observed]) => {
    const row = {
      schema_version: "desktop-packaging-boundary-row.v1",
      row_id: `desktop.packaging.${rowId}`,
      label,
      observed,
      required_value: requiredValue,
      status: observed === requiredValue ? "ready" : "blocked",
      blocker: observed === requiredValue ? null : `${label} is configured before packaging authority is approved.`,
      generated_at: generatedAt,
    };
    return { ...row, row_hash: sha256(row) };
  });
}

function buildPackagingBoundary({ scriptRows, autoUpdateRows, packagingRows, generatedAt }) {
  const scriptsReady = scriptRows.every((row) => row.status === "ready");
  const autoUpdateClosed = autoUpdateRows.every((row) => row.status === "ready");
  const packagingClosed = packagingRows.every((row) => row.status === "ready");
  return {
    schema_version: "desktop-packaging-boundary.v1",
    generated_at: generatedAt,
    local_build_supported: scriptsReady,
    local_preflight_supported: scriptsReady,
    macos_app_packaged: false,
    signing_configured: false,
    notarization_configured: false,
    auto_update_enabled: false,
    auto_update_dependency_present: autoUpdateRows.some((row) => row.probe_type === "dependency" && row.observed === true),
    auto_update_import_present: autoUpdateRows.some((row) => row.probe_type === "main_process_term" && row.observed === true),
    external_update_url_present: false,
    update_write_authority_enabled: false,
    packaging_authority_open: false,
    production_release_packaged: false,
    ready_for_local_desktop_start: scriptsReady && autoUpdateClosed && packagingClosed,
  };
}

function buildValidationItems({ rootPackage, desktopPackage, desktopLockfile, desktopMain, desktopRunbook, scriptRows, autoUpdateRows, packagingRows, boundary }) {
  const items = [
    validationItem("source.root_package", rootPackage.available, rootPackage.error ?? "root package available", rootPackage.path),
    validationItem("source.desktop_package", desktopPackage.available, desktopPackage.error ?? "desktop package available", desktopPackage.path),
    validationItem("source.desktop_lockfile", desktopLockfile.available, desktopLockfile.error ?? "desktop lockfile available", desktopLockfile.path),
    validationItem("source.desktop_main", desktopMain.available, desktopMain.error ?? "desktop main available", desktopMain.path),
    validationItem("source.desktop_runbook", desktopRunbook.available, desktopRunbook.error ?? "desktop runbook available", desktopRunbook.path),
    validationItem("scripts.ready", scriptRows.every((row) => row.status === "ready"), "Required desktop scripts are missing.", "package.json"),
    validationItem("auto_update.closed", autoUpdateRows.every((row) => row.status === "ready"), "Auto-update dependency or main-process term is present.", "apps/desktop"),
    validationItem("packaging.closed", packagingRows.every((row) => row.status === "ready"), "Packaging/signing/notarization/publish is configured before approval.", "apps/desktop/package.json"),
    validationItem("boundary.no_update_write", boundary.auto_update_enabled === false && boundary.update_write_authority_enabled === false, "Auto-update write authority opened.", "desktop_packaging_boundary"),
    validationItem("boundary.local_ready", boundary.ready_for_local_desktop_start === true, "Local desktop start is not ready.", "desktop_packaging_boundary"),
  ];
  return items;
}

function buildSummary({ boundary, scriptRows, autoUpdateRows, packagingRows, validation }) {
  const readyScriptCount = scriptRows.filter((row) => row.status === "ready").length;
  return {
    schema_version: "desktop-packaging-summary.v1",
    desktop_packaging_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    script_count: scriptRows.length,
    ready_script_count: readyScriptCount,
    auto_update_probe_count: autoUpdateRows.length,
    auto_update_blocker_count: autoUpdateRows.filter((row) => row.status !== "ready").length,
    packaging_row_count: packagingRows.length,
    packaging_blocker_count: packagingRows.filter((row) => row.status !== "ready").length,
    local_build_supported: boundary.local_build_supported,
    local_preflight_supported: boundary.local_preflight_supported,
    ready_for_local_desktop_start: boundary.ready_for_local_desktop_start,
    macos_app_packaged: false,
    signing_configured: false,
    notarization_configured: false,
    auto_update_enabled: false,
    auto_update_dependency_present: boundary.auto_update_dependency_present,
    auto_update_import_present: boundary.auto_update_import_present,
    external_update_url_present: false,
    update_write_authority_enabled: false,
    packaging_authority_open: false,
    production_release_packaged: false,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Desktop Packaging Manifest",
    "",
    "This artifact records local desktop build readiness while packaging, signing, notarization, updater, publish, deployment, production trust, enterprise trust, and protected closeout authority remain closed.",
    "",
    `Status: ${result.summary.desktop_packaging_status}`,
    `Local build supported: ${result.summary.local_build_supported}`,
    `Ready for local desktop start: ${result.summary.ready_for_local_desktop_start}`,
    `Auto update enabled: ${result.summary.auto_update_enabled}`,
    `Auto update dependency present: ${result.summary.auto_update_dependency_present}`,
    `Auto update import present: ${result.summary.auto_update_import_present}`,
    `Packaging authority open: ${result.summary.packaging_authority_open}`,
    `macOS app packaged: ${result.summary.macos_app_packaged}`,
    `Signing configured: ${result.summary.signing_configured}`,
    `Notarization configured: ${result.summary.notarization_configured}`,
    `Production release packaged: ${result.summary.production_release_packaged}`,
    "",
    "## Scripts",
    "",
    "| Scope | Script | Status |",
    "|---|---|---|",
    ...result.script_rows.map((row) => `| ${row.scope} | ${row.script_name} | ${row.status} |`),
    "",
    "## Auto Update Probes",
    "",
    "| Probe | Observed | Status |",
    "|---|---:|---|",
    ...result.auto_update_rows.map((row) => `| ${row.probe} | ${row.observed} | ${row.status} |`),
    "",
    "## Packaging Boundary",
    "",
    "| Check | Observed | Status |",
    "|---|---:|---|",
    ...result.packaging_rows.map((row) => `| ${row.label} | ${row.observed} | ${row.status} |`),
  ];
  return `${lines.join("\n")}\n`;
}

async function readJsonSource(filePath) {
  try {
    return { path: filePath, available: true, data: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    return { path: filePath, available: true, text: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_DESKTOP_PACKAGING_MANIFEST_INPUTS)) {
    normalized[camelToSnake(key)] = options[key] ?? options[camelToSnake(key)] ?? defaultValue;
  }
  return normalized;
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return { path: pathValue, check_id: pathValue, status: passed ? "passed" : "failed", message: passed ? "ok" : message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, evidence_ref: item.evidence_ref }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

export function parseDesktopPackagingManifestArgs(argv) {
  const valueFlags = new Map([
    ["--out-dir", "outDir"],
    ["--run-at", "runAt"],
    ...Object.keys(DEFAULT_DESKTOP_PACKAGING_MANIFEST_INPUTS).map((key) => [`--${camelToKebab(key)}`, key]),
  ]);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--no-write") parsed.write = false;
    else if (valueFlags.has(arg)) parsed[valueFlags.get(arg)] = readRequiredArgValue(argv, ++index, arg);
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/desktop-packaging-manifest.mjs [--check] [--out-dir path]\n\nWith --check, validates without writing artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function readRequiredArgValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}
