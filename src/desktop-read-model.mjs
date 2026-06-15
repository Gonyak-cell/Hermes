import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_DESKTOP_READ_MODEL_OUT_DIR = "artifacts/desktop-read-model/latest";
export const DEFAULT_DESKTOP_READ_MODEL_INPUTS = {
  schemaPath: "schemas/desktop-read-model.schema.json",
  packagePath: "package.json",
  desktopAuthorityBoundaryPath: "artifacts/desktop-authority-boundary/latest/desktop-authority-boundary.json",
  releaseOwnerDecisionPath: "docs/release-owner-decision-2026-06-14.md",
  releaseDecisionPacketPath: "docs/release-decision-packet-2026-06-15.md",
  productionLaunchChecklistPath: "docs/production-launch-checklist-2026-06-15.md",
  claudeFinalReviewPacketPath: "docs/claude-final-review-packet-2026-06-15.md",
  releaseNoteTagDraftPath: "docs/release-note-tag-draft-2026-06-15.md",
  desktopPlanPath: "docs/hermes-desktop-app-plan-2026-06-14.md",
  desktopLocalLaunchRunbookPath: "docs/hermes-desktop-local-launch-runbook-2026-06-14.md",
  desktopPackagingManifestSummaryPath: "artifacts/desktop-packaging-manifest/latest/summary.md",
  projectOperatingContractPath: "artifacts/project-operating-contract/latest/project-operating-contract.json",
  projectOperatingContractSummaryPath: "artifacts/project-operating-contract/latest/summary.md",
  operatorHandbookPath: "artifacts/operator-handbook/latest/operator-handbook.json",
  operatorSurfacesPath: "artifacts/operator-handbook/latest/operator-surfaces.json",
  operatorScreensPath: "artifacts/operator-handbook/latest/operator-screens.json",
  operatorWorkflowsPath: "artifacts/operator-handbook/latest/operator-workflows.json",
  operatorGatesPath: "artifacts/operator-handbook/latest/operator-gates.json",
  operatorHandbookBoundaryPath: "artifacts/operator-handbook/latest/operator-handbook-boundary.json",
  releaseReadinessSummaryPath: "artifacts/release-readiness-control-plane/latest/summary.md",
  productionGovernanceSummaryPath: "artifacts/production-governance-hardening/latest/summary.md",
  p16800FreezeSummaryPath: "artifacts/p16800-platform-freeze/latest/summary.md",
  factoryGateOpeningSummaryPath: "artifacts/factory-gate-opening-readiness/latest/summary.md",
  factoryStage67SummaryPath: "artifacts/factory-stage6-7-execution-readiness/latest/summary.md",
};

export const DESKTOP_READ_ALLOWLIST = Object.freeze([
  "docs/release-owner-decision-2026-06-14.md",
  "docs/release-decision-packet-2026-06-15.md",
  "docs/production-launch-checklist-2026-06-15.md",
  "docs/claude-final-review-packet-2026-06-15.md",
  "docs/release-note-tag-draft-2026-06-15.md",
  "docs/hermes-desktop-app-plan-2026-06-14.md",
  "docs/hermes-desktop-local-launch-runbook-2026-06-14.md",
  "artifacts/desktop-packaging-manifest/latest/summary.md",
  "artifacts/project-operating-contract/latest/project-operating-contract.json",
  "artifacts/project-operating-contract/latest/summary.md",
  "docs/operator-handbook.md",
  "docs/dashboard-api-freeze.md",
  "artifacts/desktop-authority-boundary/latest/desktop-authority-boundary.json",
  "artifacts/operator-handbook/latest/operator-handbook.json",
  "artifacts/operator-handbook/latest/operator-surfaces.json",
  "artifacts/operator-handbook/latest/operator-screens.json",
  "artifacts/operator-handbook/latest/operator-workflows.json",
  "artifacts/operator-handbook/latest/operator-gates.json",
  "artifacts/operator-handbook/latest/operator-handbook-boundary.json",
  "artifacts/release-readiness-control-plane/latest/summary.md",
  "artifacts/production-governance-hardening/latest/summary.md",
  "artifacts/p16800-platform-freeze/latest/summary.md",
  "artifacts/factory-gate-opening-readiness/latest/summary.md",
  "artifacts/factory-stage6-7-execution-readiness/latest/summary.md",
]);

export const DESKTOP_READ_DENYLIST = Object.freeze([
  "artifacts/**/raw-output*.json",
  "artifacts/**/raw*.json",
  "artifacts/**/secret*",
  "artifacts/**/provenance/signed-provenance-receipt.json",
  "artifacts/**/review/raw-output.json",
  ".env*",
  "*secret*",
  "*credential*",
  "*token*",
  "*private-key*",
]);

export const FORBIDDEN_TRUST_STRINGS = Object.freeze([
  "production PASS",
  "enterprise PASS",
  "deployment authorization",
  "protected closeout complete",
  "GitHub independent approval complete",
  "desktop write authority enabled",
]);

const SCHEMA_VERSION = "desktop-read-model.v1";
const CAPABILITY_ID = "desktop.read_model";
const COMMAND_NAME = "desktop:read-model";
const READY_STATUS = "ready_for_desktop_shell";
const BLOCKED_STATUS = "blocked_desktop_shell";
const RELEASE_SUMMARY_PRIORITY = Object.freeze([
  "release_decision_packet",
  "release_note_tag_draft",
  "production_launch_checklist",
  "release_owner_decision",
  "desktop_plan",
  "desktop_local_launch_runbook",
  "desktop_packaging_manifest",
]);

const SAFE_PROJECT_AFFORDANCE_TYPES = Object.freeze([
  "inspect",
  "copy_command",
  "open_artifact",
  "prepare_review_packet",
  "draft_owner_decision",
  "refresh_artifact",
]);

const SOURCE_DEFINITIONS = [
  sourceDefinition("release_owner_decision", "release", "Release owner decision", "releaseOwnerDecisionPath", true),
  sourceDefinition("release_decision_packet", "release", "Release decision packet", "releaseDecisionPacketPath", true),
  sourceDefinition("production_launch_checklist", "release", "Production launch checklist", "productionLaunchChecklistPath", true),
  sourceDefinition("release_note_tag_draft", "release", "Release note and tag draft", "releaseNoteTagDraftPath", true),
  sourceDefinition("desktop_plan", "release", "Desktop app plan", "desktopPlanPath", true),
  sourceDefinition("desktop_local_launch_runbook", "release", "Desktop local launch runbook", "desktopLocalLaunchRunbookPath", true),
  sourceDefinition("desktop_packaging_manifest", "release", "Desktop packaging manifest", "desktopPackagingManifestSummaryPath", true),
  sourceDefinition("project_operating_contract", "projects", "Project operating contract", "projectOperatingContractPath", true),
  sourceDefinition("project_operating_contract_summary", "projects", "Project operating contract summary", "projectOperatingContractSummaryPath", true),
  sourceDefinition("factory_gate_opening", "factory", "Factory gate opening readiness", "factoryGateOpeningSummaryPath", true),
  sourceDefinition("factory_stage_6_7", "factory", "Factory Stage6/Stage7 readiness", "factoryStage67SummaryPath", true),
  sourceDefinition("release_readiness", "factory", "Release readiness control plane", "releaseReadinessSummaryPath", true),
  sourceDefinition("production_governance", "factory", "Production governance hardening", "productionGovernanceSummaryPath", true),
  sourceDefinition("p16800_freeze", "factory", "P16800 platform freeze", "p16800FreezeSummaryPath", true),
  sourceDefinition("claude_final_review_packet", "reviews", "Claude final review packet", "claudeFinalReviewPacketPath", true),
  sourceDefinition("operator_handbook", "operator_handbook", "Operator handbook", "operatorHandbookPath", true),
  sourceDefinition("operator_surfaces", "operator_handbook", "Operator surfaces", "operatorSurfacesPath", true),
  sourceDefinition("operator_screens", "operator_handbook", "Operator screens", "operatorScreensPath", true),
  sourceDefinition("operator_workflows", "operator_handbook", "Operator workflows", "operatorWorkflowsPath", true),
  sourceDefinition("operator_gates", "operator_handbook", "Operator gates", "operatorGatesPath", true),
  sourceDefinition("operator_handbook_boundary", "operator_handbook", "Operator handbook boundary", "operatorHandbookBoundaryPath", true),
  sourceDefinition("desktop_authority_boundary", "authority_boundary", "Desktop authority boundary", "desktopAuthorityBoundaryPath", true),
];

const SCREEN_SPECS = [
  ["queue", "Queue", "Global operator queue across local-only RC, review, gate, and evidence blockers."],
  ["projects", "Projects", "Project and operator-handbook surfaces for the local Hermes workspace."],
  ["requirements", "Requirements", "Release requirements and launch-class boundaries without production authority."],
  ["evidence", "Evidence", "Safe evidence rows from release, factory, review, operator, and authority sources."],
  ["reviews", "Reviews", "Review packet status and independent-review caveats without treating review as approval."],
  ["gates", "Gates", "Factory readiness, Stage6/Stage7 evidence, and production governance blockers."],
  ["conversations", "Conversations", "Conversation and operator context placeholders backed only by safe source refs."],
  ["governance", "Governance", "Authority boundary and policy surfaces that keep protected actions closed."],
  ["sources", "Sources", "Complete safe source index with ready and blocked evidence rows."],
  ["release", "Release", "Release baseline, local tag, launch checklist, and single-owner lower-trust RC status."],
  ["factory", "Factory", "Factory readiness, Stage6/Stage7 evidence, and production governance blockers."],
  ["settings", "Settings", "Language, local paths, and read-only authority notices."],
];

export async function runDesktopReadModel(options = {}) {
  const result = await buildDesktopReadModel(options);
  if (options.write !== false) await writeDesktopReadModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Desktop read model failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDesktopReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DESKTOP_READ_MODEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path, { skipPolicy: true });
  const packageJson = await readJsonSource(inputs.package_path, { skipPolicy: true });
  const artifactAccessPolicy = buildArtifactAccessPolicy(options, generatedAt);
  const sourceRows = [];
  for (const definition of SOURCE_DEFINITIONS) {
    sourceRows.push(await readDesktopSource(definition, inputs, artifactAccessPolicy, generatedAt));
  }
  const sections = buildSections(sourceRows, generatedAt);
  const screenMap = buildScreenMap(sections, generatedAt);
  const trustClaimGuardRows = buildTrustClaimGuardRows(generatedAt);
  const denylistFixtureRows = buildDenylistFixtureRows(generatedAt);
  const desktopReadAuthority = buildDesktopReadAuthority({ sourceRows, sections, trustClaimGuardRows, denylistFixtureRows, generatedAt });
  const releaseProjection = buildReleaseProjection(sourceRows, generatedAt);
  const factoryProjection = buildFactoryProjection(sourceRows, generatedAt);
  const projectProjection = buildProjectProjection(sourceRows, generatedAt);
  const validationItems = buildValidationItems({
    packageJson,
    sourceRows,
    sections,
    trustClaimGuardRows,
    denylistFixtureRows,
    desktopReadAuthority,
    artifactAccessPolicy,
    releaseProjection,
    factoryProjection,
    projectProjection,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    artifact_access_policy: artifactAccessPolicy,
    source_rows: sourceRows,
    sections,
    screen_map: screenMap,
    release_projection: releaseProjection,
    factory_projection: factoryProjection,
    project_projection: projectProjection,
    trust_claim_guard_rows: trustClaimGuardRows,
    denylist_fixture_rows: denylistFixtureRows,
    desktop_read_authority: desktopReadAuthority,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRows, sections, screenMap, desktopReadAuthority, projectProjection, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "desktop_read_model")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, sections, screenMap, desktopReadAuthority, projectProjection, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeDesktopReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "desktop-read-model.json"), serializable);
  await writeJson(path.join(outDir, "source-rows.json"), collectionEnvelope("desktop-read-model-source-rows.v1", "source_rows", result.source_rows, result.generated_at));
  await writeJson(path.join(outDir, "sections.json"), collectionEnvelope("desktop-read-model-sections.v1", "sections", result.sections, result.generated_at));
  await writeJson(path.join(outDir, "screen-map.json"), collectionEnvelope("desktop-screen-map.v1", "screen_map", result.screen_map, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "desktop-read-model-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDesktopReadModelCli(argv = process.argv.slice(2)) {
  try {
    const args = parseDesktopReadModelArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runDesktopReadModel(args);
    console.log(`Desktop read model ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.desktop_read_model_status}`);
    console.log(`Sections ready: ${result.summary.ready_section_count}/${result.summary.section_count}`);
    console.log(`Sources ready: ${result.summary.ready_source_count}/${result.summary.source_count}`);
    console.log(`Operator handbook bound: ${result.summary.operator_handbook_bound}`);
    console.log(`Authority boundary ready: ${result.summary.authority_boundary_ready}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

export function isDeniedDesktopReadPath(filePath) {
  const normalized = normalizePolicyPath(filePath);
  const base = path.posix.basename(normalized);
  if (base.startsWith(".env")) return true;
  if (/(^|\/)[^/]*(secret|credential|token|private-key)[^/]*($|\/)/i.test(normalized)) return true;
  if (normalized.startsWith("artifacts/") && /^raw.*\.json$/i.test(base)) return true;
  if (normalized.startsWith("artifacts/") && /^raw-output.*\.json$/i.test(base)) return true;
  if (normalized.startsWith("artifacts/") && normalized.endsWith("/provenance/signed-provenance-receipt.json")) return true;
  if (normalized.startsWith("artifacts/") && normalized.endsWith("/review/raw-output.json")) return true;
  return false;
}

export function isAllowedDesktopReadPath(filePath, allowlist = DESKTOP_READ_ALLOWLIST) {
  const normalized = normalizePolicyPath(filePath);
  return !isDeniedDesktopReadPath(normalized) && allowlist.includes(normalized);
}

export function containsForbiddenTrustString(value) {
  const text = String(value ?? "").toLowerCase();
  return FORBIDDEN_TRUST_STRINGS.some((forbidden) => text.includes(forbidden.toLowerCase()));
}

function sourceDefinition(sourceId, sectionId, label, inputKey, required) {
  return { source_id: sourceId, section_id: sectionId, label, input_key: inputKey, required };
}

function buildArtifactAccessPolicy(options, generatedAt) {
  return {
    schema_version: "desktop-artifact-access-policy.v1",
    generated_at: generatedAt,
    mode: "explicit_allowlist_with_denylist_precedence",
    allowlist: [...(options.allowlist ?? DESKTOP_READ_ALLOWLIST)].map(normalizePolicyPath),
    denylist: [...(options.denylist ?? DESKTOP_READ_DENYLIST)],
    raw_payload_read_allowed: false,
    secret_like_path_read_allowed: false,
    denylist_precedence: true,
  };
}

async function readDesktopSource(definition, inputs, artifactAccessPolicy, generatedAt) {
  const sourcePath = inputs[camelToSnake(definition.input_key)];
  const normalizedPath = normalizePolicyPath(sourcePath);
  const denied = isDeniedDesktopReadPath(normalizedPath);
  const allowed = isAllowedDesktopReadPath(normalizedPath, artifactAccessPolicy.allowlist);
  if (denied || !allowed) {
    return sourceRow({
      definition,
      sourcePath,
      allowed: false,
      available: false,
      parseStatus: "not_read",
      contentHash: null,
      dataSummary: null,
      status: "blocked",
      blocker: denied ? "Source path is blocked by the desktop denylist." : "Source path is not in the desktop allowlist.",
      generatedAt,
    });
  }
  const source = await readAnySource(sourcePath);
  if (!source.available) {
    return sourceRow({
      definition,
      sourcePath,
      allowed: true,
      available: false,
      parseStatus: "missing",
      contentHash: null,
      dataSummary: null,
      status: "blocked",
      blocker: `Missing required source: ${sourcePath}`,
      generatedAt,
    });
  }
  const isJson = normalizedPath.endsWith(".json");
  const parseStatus = isJson ? (source.json_available ? "parsed" : "malformed") : "text";
  const status = isJson && !source.json_available ? "blocked" : "ready";
  return sourceRow({
    definition,
    sourcePath,
    allowed: true,
    available: true,
    parseStatus,
    contentHash: source.content_hash,
    dataSummary: source.json_available ? compactJsonSummary(source.data) : compactTextSummary(source.text),
    status,
    blocker: status === "ready" ? null : "JSON source is malformed.",
    generatedAt,
  });
}

function sourceRow({ definition, sourcePath, allowed, available, parseStatus, contentHash, dataSummary, status, blocker, generatedAt }) {
  const row = {
    schema_version: "desktop-read-model-source-row.v1",
    source_id: definition.source_id,
    section_id: definition.section_id,
    label: definition.label,
    required: definition.required,
    source_path: sourcePath,
    source_allowed_by_policy: allowed,
    source_available: available,
    parse_status: parseStatus,
    source_content_hash: contentHash,
    data_summary: dataSummary,
    status,
    blocker,
    generated_at: generatedAt,
  };
  return { ...row, source_row_hash: sha256(row) };
}

function buildSections(sourceRows, generatedAt) {
  const sectionIds = ["projects", "release", "factory", "reviews", "operator_handbook", "artifacts", "authority_boundary"];
  return sectionIds.map((sectionId) => {
    const rows = sectionId === "artifacts"
      ? sourceRows
      : sourceRows.filter((row) => row.section_id === sectionId);
    const requiredRows = rows.filter((row) => row.required);
    const blockers = requiredRows.filter((row) => row.status !== "ready").map((row) => `${row.source_id}: ${row.blocker}`);
    const status = blockers.length === 0 && rows.length > 0 ? "ready" : "blocked";
    const section = {
      schema_version: "desktop-read-model-section.v1",
      section_id: sectionId,
      label: sectionLabel(sectionId),
      source_path: rows[0]?.source_path ?? null,
      generated_at: generatedAt,
      status,
      blocker: blockers.length === 0 ? null : blockers.join("; "),
      section_refs: rows.map((row) => ({
        source_id: row.source_id,
        source_path: row.source_path,
        status: row.status,
        blocker: row.blocker,
        source_content_hash: row.source_content_hash,
      })),
      primary_row_count: rows.length,
      ready_row_count: rows.filter((row) => row.status === "ready").length,
      blocked_row_count: rows.filter((row) => row.status !== "ready").length,
      no_action_authority_notice: "Desktop displays evidence only. It cannot approve, deploy, write, execute commands, read secrets, or claim production/enterprise pass.",
    };
    return { ...section, section_hash: sha256(section) };
  });
}

function buildScreenMap(sections, generatedAt) {
  return SCREEN_SPECS.map(([screenId, label, purpose], index) => {
    const sectionIds = screenId === "settings" ? ["authority_boundary"] : screenId === "artifacts" ? ["artifacts"] : [screenId];
    const boundSections = sections.filter((section) => sectionIds.includes(section.section_id));
    const blocked = boundSections.some((section) => section.status !== "ready");
    const row = {
      schema_version: "desktop-screen-map-row.v1",
      screen_id: screenId,
      ordinal: index + 1,
      label,
      purpose,
      section_ids: sectionIds,
      source_refs: boundSections.flatMap((section) => section.section_refs.map((ref) => ref.source_path)),
      empty_state: "No safe evidence is available for this screen.",
      blocker_state: blocked ? boundSections.filter((section) => section.status !== "ready").map((section) => section.blocker).join("; ") : null,
      no_action_authority_notice: "Read-only screen. Protected actions stay outside Desktop.",
      status: blocked ? "blocked" : "ready",
      generated_at: generatedAt,
    };
    return { ...row, screen_hash: sha256(row) };
  });
}

function buildTrustClaimGuardRows(generatedAt) {
  return FORBIDDEN_TRUST_STRINGS.map((claim, index) => {
    const row = {
      schema_version: "desktop-trust-claim-guard-row.v1",
      row_id: `desktop.trust_claim.${slug(claim)}`,
      ordinal: index + 1,
      claim_text: claim,
      claim_allowed: false,
      status: "ready",
      blocker: null,
      generated_at: generatedAt,
    };
    return { ...row, row_hash: sha256(row) };
  });
}

function buildDenylistFixtureRows(generatedAt) {
  const fixtures = [
    "artifacts/example/review/raw-output.json",
    "artifacts/example/raw-capture.json",
    "artifacts/example/provenance/signed-provenance-receipt.json",
    "artifacts/example/secret-material.json",
    ".env.local",
    "docs/private-key-notes.md",
  ];
  return fixtures.map((fixturePath, index) => {
    const denied = isDeniedDesktopReadPath(fixturePath);
    const row = {
      schema_version: "desktop-denylist-fixture-row.v1",
      row_id: `desktop.denylist_fixture.${index + 1}`,
      fixture_path: fixturePath,
      denied_by_policy: denied,
      status: denied ? "ready" : "blocked",
      blocker: denied ? null : "Denylist fixture was not blocked.",
      generated_at: generatedAt,
    };
    return { ...row, row_hash: sha256(row) };
  });
}

function buildReleaseProjection(sourceRows, generatedAt) {
  const summaries = sourceRows.filter((row) => row.section_id === "release").map((row) => row.data_summary ?? {});
  const candidateCommit = prioritizedReleaseSummaryValue(sourceRows, "candidate_commit") ?? "unknown";
  const localRcTag = prioritizedReleaseSummaryValue(sourceRows, "local_rc_tag") ?? "not recorded";
  const githubIndependentApprovalNotPursued = summaries.some((summary) => summary.github_independent_approval_not_pursued === true);
  const ownerProductionApprovalMissing = summaries.some((summary) => summary.owner_production_launch_approval_missing === true);
  const projection = {
    schema_version: "desktop-release-projection.v1",
    generated_at: generatedAt,
    candidate_commit: candidateCommit,
    local_rc_tag: localRcTag,
    trust_mode: "single-owner lower-trust RC",
    release_candidate_freeze_observed: true,
    github_independent_approval_status: githubIndependentApprovalNotPursued ? "not_pursued_single_owner_local_rc" : "missing",
    production_launch_approval_status: ownerProductionApprovalMissing ? "missing" : "not_approved",
    deployment_authorized: false,
    // Artifact-supplied publish state is observed only; desktop never opens tag or release publish authority.
    tag_pushed: false,
    github_release_published: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    projection_rows: [
      projectionRow("candidate_commit", "Candidate commit", candidateCommit, "observed", false, generatedAt),
      projectionRow("local_rc_tag", "Local RC tag", localRcTag, "local_only_not_pushed", false, generatedAt),
      projectionRow("github_independent_approval", "Independent review", githubIndependentApprovalNotPursued ? "not pursued" : "missing", "closed", false, generatedAt),
      projectionRow("production_launch_approval", "Launch approval", ownerProductionApprovalMissing ? "missing" : "not approved", "closed", false, generatedAt),
      projectionRow("deployment_authorization", "Deploy authority", "not authorized", "closed", false, generatedAt),
    ],
  };
  return { ...projection, projection_hash: sha256(projection) };
}

function prioritizedReleaseSummaryValue(sourceRows, key) {
  const releaseRows = sourceRows.filter((row) => row.section_id === "release");
  for (const sourceId of RELEASE_SUMMARY_PRIORITY) {
    const summary = releaseRows.find((row) => row.source_id === sourceId)?.data_summary ?? {};
    if (summary[key] !== undefined) return summary[key];
  }
  return firstSummaryValue(releaseRows.map((row) => row.data_summary ?? {}), key);
}

function buildFactoryProjection(sourceRows, generatedAt) {
  const factoryGateSummary = sourceRows.find((row) => row.source_id === "factory_gate_opening")?.data_summary ?? {};
  const stage67Summary = sourceRows.find((row) => row.source_id === "factory_stage_6_7")?.data_summary ?? {};
  const summaries = sourceRows.filter((row) => row.section_id === "factory").map((row) => row.data_summary ?? {});
  const observedGateOpenNow = Number(firstSummaryValue(summaries, "gate_open_now") ?? 0);
  const factoryGateReadinessStatus = factoryGateSummary.status ?? "not recorded";
  const stage67Status = stage67Summary.status ?? "not recorded";
  const g1aStatus = factoryGateSummary.g1a_status ?? firstSummaryValue(summaries, "g1a_status") ?? "not recorded";
  const runtimeAuthorityOpen = firstBooleanSummaryValue(summaries, "runtime_authority_open") ?? false;
  const stage6LimitedExecutionAllowed = firstBooleanSummaryValue(summaries, "stage6_limited_execution_allowed") ?? false;
  const stage7ReleaseCandidateAllowed = firstBooleanSummaryValue(summaries, "stage7_release_candidate_allowed") ?? false;
  const projection = {
    schema_version: "desktop-factory-projection.v1",
    generated_at: generatedAt,
    factory_gate_readiness_status: factoryGateReadinessStatus,
    stage6_stage7_status: stage67Status,
    observed_gate_open_now_input: observedGateOpenNow,
    gate_open_now: 0,
    g1a_status: g1aStatus,
    runtime_authority_open: false,
    stage6_limited_execution_allowed: false,
    stage7_release_candidate_allowed: false,
    contract_development_allowed: stage67Summary.contract_development_allowed === true,
    factory_goal_complete_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    projection_rows: [
      projectionRow("gate_readiness", "Factory gate readiness", factoryGateReadinessStatus, "evidence_ready", false, generatedAt),
      projectionRow("gate_open_now", "Gate open now", "0", observedGateOpenNow === 0 ? "closed" : "input_rejected_closed", false, generatedAt),
      projectionRow("g1a_status", "G1a status", g1aStatus, "evidence_ready_runtime_closed", false, generatedAt),
      projectionRow("runtime_authority", "Runtime authority", runtimeAuthorityOpen ? "open input rejected" : "closed", "closed", false, generatedAt),
      projectionRow("stage6_limited_execution", "Stage6 limited execution", stage6LimitedExecutionAllowed ? "open input rejected" : "closed", "closed", false, generatedAt),
      projectionRow("stage7_release_candidate", "Stage7 release candidate", stage7ReleaseCandidateAllowed ? "open input rejected" : "closed", "closed", false, generatedAt),
    ],
  };
  return { ...projection, projection_hash: sha256(projection) };
}

function buildProjectProjection(sourceRows, generatedAt) {
  const projectSource = sourceRows.find((row) => row.source_id === "project_operating_contract");
  const summary = projectSource?.data_summary ?? {};
  const projectRows = Array.isArray(summary.project_rows) ? summary.project_rows : [];
  const projectDetailRows = Array.isArray(summary.project_detail_rows) ? summary.project_detail_rows : [];
  const projectDriftRows = Array.isArray(summary.project_drift_rows) ? summary.project_drift_rows : [];
  const projectAttentionRows = Array.isArray(summary.project_attention_rows) ? summary.project_attention_rows : [];
  const safeAffordanceRows = Array.isArray(summary.safe_affordance_rows) ? summary.safe_affordance_rows : [];
  const refreshRequiredCount = projectDriftRows.filter((row) => row.refresh_required === true).length;
  const projection = {
    schema_version: "desktop-project-projection.v1",
    generated_at: generatedAt,
    project_operating_contract_status: summary.project_operating_contract_status ?? "not recorded",
    source_status: projectSource?.status ?? "blocked",
    project_count: Number(summary.project_count ?? 0),
    ready_project_count: Number(summary.ready_project_count ?? 0),
    blocked_project_count: Number(summary.blocked_project_count ?? 0),
    review_needed_project_count: Number(summary.review_needed_project_count ?? 0),
    stale_project_count: Number(summary.stale_project_count ?? 0),
    ready_for_desktop_multi_project_projection: summary.ready_for_desktop_multi_project_projection === true,
    read_only: true,
    local_only: true,
    source_of_truth: false,
    command_execution_allowed_now: false,
    git_write_allowed_now: false,
    deploy_allowed_now: false,
    approval_application_allowed_now: false,
    receipt_application_allowed_now: false,
    connector_write_allowed_now: false,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    project_rows: projectRows.map((row) => ({
      project_id: String(row.project_id ?? "unknown"),
      project_name: String(row.project_name ?? row.project_id ?? "Unknown project"),
      domain_pack: String(row.domain_pack ?? "unknown"),
      project_state: String(row.project_state ?? "blocked"),
      current_goal_id: row.current_goal_id ?? null,
      current_phase_range: row.current_phase_range ?? null,
      blocker_count: Number(row.blocker_count ?? 0),
      freshness_status: String(row.freshness_status ?? "missing"),
      progress_confidence: String(row.progress_confidence ?? "unknown"),
      next_allowed_action: String(row.next_allowed_action ?? "inspect project state"),
    })),
    project_detail_rows: projectDetailRows.map((row) => ({
      project_id: String(row.project_id ?? "unknown"),
      state_reason: String(row.state_reason ?? "not recorded"),
      blocker_type: row.blocker_type ? String(row.blocker_type) : null,
      blocker_hint: String(row.blocker_hint ?? "No blocker remediation hint recorded."),
      risk_level: String(row.risk_level ?? "unknown"),
      validation_ready: row.validation_ready === true,
      review_boundary_ready: row.review_boundary_ready === true,
      completed_units: Number(row.completed_units ?? 0),
      remaining_units: Number(row.remaining_units ?? 0),
      next_action_count: Number(row.next_action_count ?? 0),
      source_generated_at: row.source_generated_at ?? null,
      source_age_days: Number(row.source_age_days ?? 0),
      source_artifact_path: String(row.source_artifact_path ?? ""),
      source_artifact_sha256: String(row.source_artifact_sha256 ?? ""),
      source_parse_status: String(row.source_parse_status ?? "unknown"),
      refresh_required: row.refresh_required === true,
      unsafe_flag_count: Number(row.unsafe_flag_count ?? 0),
      authority_boundary_closed: row.authority_boundary_closed === true,
      data_boundary_closed: row.data_boundary_closed === true,
      next_allowed_action: String(row.next_allowed_action ?? "inspect project detail"),
    })),
    project_drift_rows: projectDriftRows.map((row) => ({
      project_id: String(row.project_id ?? "unknown"),
      source_generated_at: row.source_generated_at ?? null,
      source_age_days: Number(row.source_age_days ?? 0),
      freshness_status: String(row.freshness_status ?? "missing"),
      refresh_required: row.refresh_required === true,
      source_hash: String(row.source_hash ?? ""),
      next_allowed_action: String(row.next_allowed_action ?? "inspect freshness"),
    })),
    project_attention_rows: projectAttentionRows.map((row) => ({
      project_id: String(row.project_id ?? "unknown"),
      attention_type: String(row.attention_type ?? "status"),
      severity: String(row.severity ?? "info"),
      label: String(row.label ?? row.attention_type ?? "Project attention"),
      detail: String(row.detail ?? ""),
      next_safe_action: String(row.next_safe_action ?? "inspect project state"),
      mutates_state: false,
      opens_authority: false,
    })),
    safe_affordance_rows: safeAffordanceRows.map((row) => ({
      action_type: String(row.action_type ?? "inspect"),
      action_class: String(row.action_class ?? "safe_read_only"),
      allowed: row.allowed === true
        && row.action_class === "safe_read_only"
        && SAFE_PROJECT_AFFORDANCE_TYPES.includes(row.action_type),
      mutates_state: false,
      opens_authority: false,
      display_label: String(row.display_label ?? row.action_type ?? "inspect"),
      hint: String(row.hint ?? "Display only."),
    })),
    projection_rows: [
      projectionRow("project_count", "Projects", String(summary.project_count ?? 0), summary.project_count > 0 ? "observed" : "blocked", false, generatedAt),
      projectionRow("ready_projects", "Ready", String(summary.ready_project_count ?? 0), "read_only", false, generatedAt),
      projectionRow("blocked_projects", "Blocked", String(summary.blocked_project_count ?? 0), Number(summary.blocked_project_count ?? 0) > 0 ? "attention" : "clear", false, generatedAt),
      projectionRow("review_needed_projects", "Review needed", String(summary.review_needed_project_count ?? 0), Number(summary.review_needed_project_count ?? 0) > 0 ? "attention" : "clear", false, generatedAt),
      projectionRow("stale_projects", "Stale", String(summary.stale_project_count ?? 0), Number(summary.stale_project_count ?? 0) > 0 ? "refresh" : "clear", false, generatedAt),
      projectionRow("refresh_required", "Refresh required", String(refreshRequiredCount), refreshRequiredCount > 0 ? "refresh" : "clear", false, generatedAt),
      projectionRow("project_authority", "Project authority", Number(summary.unsafe_flag_count ?? 0) === 0 ? "closed" : "input rejected", "closed", false, generatedAt),
    ],
  };
  return { ...projection, projection_hash: sha256(projection) };
}

function projectionRow(rowId, label, value, status, authorityOpen, generatedAt) {
  const row = {
    schema_version: "desktop-projection-row.v1",
    row_id: rowId,
    label,
    value,
    status,
    // Artifact-supplied projection authority is observed only; desktop never opens it.
    authority_open: false,
    generated_at: generatedAt,
  };
  return { ...row, row_hash: sha256(row) };
}

function buildDesktopReadAuthority({ sourceRows, sections, trustClaimGuardRows, denylistFixtureRows, generatedAt }) {
  const authoritySource = sourceRows.find((row) => row.source_id === "desktop_authority_boundary");
  const authoritySummary = authoritySource?.data_summary ?? {};
  const operatorBoundarySource = sourceRows.find((row) => row.source_id === "operator_handbook_boundary");
  const operatorBoundarySummary = operatorBoundarySource?.data_summary ?? {};
  const operatorHandbookBound = sourceRows
    .filter((row) => row.section_id === "operator_handbook")
    .every((row) => row.status === "ready")
    && operatorBoundarySummary.desktop_read_only === true
    && operatorBoundarySummary.desktop_source_of_truth === false;
  const authorityBoundaryReady = authoritySource?.status === "ready"
    && authoritySummary.unsafe_flag_count === 0
    && authoritySummary.desktop_authority_boundary_status === "enforced_read_only_desktop_boundary";
  const allSectionsReady = sections.every((section) => section.status === "ready");
  const trustClaimsClosed = trustClaimGuardRows.every((row) => row.claim_allowed === false && row.status === "ready");
  const denylistReady = denylistFixtureRows.every((row) => row.denied_by_policy === true && row.status === "ready");
  return {
    schema_version: "desktop-read-authority.v1",
    generated_at: generatedAt,
    read_only: true,
    operator_handbook_bound: operatorHandbookBound,
    authority_boundary_ready: authorityBoundaryReady,
    all_sections_ready: allSectionsReady,
    source_of_truth: false,
    raw_payload_read_allowed: false,
    secret_like_path_read_allowed: false,
    command_execution_allowed_now: false,
    shell_execution_allowed_now: false,
    deployment_allowed_now: false,
    git_push_allowed_now: false,
    approval_application_allowed_now: false,
    receipt_application_allowed_now: false,
    connector_write_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    desktop_write_authority_enabled: false,
    trust_claims_closed: trustClaimsClosed,
    denylist_fixtures_ready: denylistReady,
    unsafe_flag_count: 0,
    ready_for_desktop_shell: operatorHandbookBound && authorityBoundaryReady && allSectionsReady && trustClaimsClosed && denylistReady,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script.desktop_read_model", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json"),
    validationItem("policy.allowlist.explicit", context.artifactAccessPolicy.allowlist.length >= 22 && context.artifactAccessPolicy.denylist_precedence === true, "Desktop read policy must use explicit allowlist with denylist precedence.", "artifact_access_policy"),
    validationItem("sources.blocker_visible", context.sourceRows.every((row) => row.status === "ready" || row.blocker), "Missing or blocked sources must render visible blockers.", "source_rows"),
    validationItem("sources.no_denied_reads", context.sourceRows.every((row) => row.source_allowed_by_policy === true), "Desktop read model attempted to read a denied or non-allowlisted source.", "source_rows"),
    validationItem("sections.required", ["release", "projects", "factory", "reviews", "operator_handbook", "artifacts", "authority_boundary"].every((sectionId) => context.sections.some((section) => section.section_id === sectionId)), "Desktop sections are incomplete.", "sections"),
    validationItem("sections.ready", context.sections.every((section) => section.status === "ready"), "Required desktop read-model sections must be ready; missing inputs must fail closed with blocker rows.", "sections"),
    validationItem("operator_handbook.bound", context.desktopReadAuthority.operator_handbook_bound === true, "Desktop read model must bind to existing operator-handbook artifacts.", "operator_handbook"),
    validationItem("authority_boundary.ready", context.desktopReadAuthority.authority_boundary_ready === true, "Desktop read model requires a ready desktop authority boundary artifact.", "desktop_authority_boundary"),
    validationItem("authority.no_write_or_trust", context.desktopReadAuthority.unsafe_flag_count === 0 && context.desktopReadAuthority.source_of_truth === false && context.desktopReadAuthority.production_pass_enabled === false && context.desktopReadAuthority.enterprise_pass_enabled === false && context.desktopReadAuthority.desktop_write_authority_enabled === false, "Desktop read model opened write/trust authority.", "desktop_read_authority"),
    validationItem("trust_claims.closed", context.trustClaimGuardRows.every((row) => row.claim_allowed === false && row.status === "ready"), "Forbidden trust claim guard rows must stay closed.", "trust_claim_guard_rows"),
    validationItem("denylist.fixtures", context.denylistFixtureRows.every((row) => row.denied_by_policy === true && row.status === "ready"), "Denylist fixtures must all be blocked.", "denylist_fixture_rows"),
    validationItem("release_projection.authority_closed", context.releaseProjection.deployment_authorized === false && context.releaseProjection.production_pass_enabled === false && context.releaseProjection.enterprise_pass_enabled === false && context.releaseProjection.github_independent_approval_status !== "approved", "Release projection opened production, enterprise, deployment, or independent approval authority.", "release_projection"),
    validationItem("factory_projection.gate_closed", context.factoryProjection.gate_open_now === 0 && context.factoryProjection.runtime_authority_open === false && context.factoryProjection.stage6_limited_execution_allowed === false && context.factoryProjection.stage7_release_candidate_allowed === false, "Factory projection opened gate/runtime/stage authority.", "factory_projection"),
    validationItem("project_projection.ready", context.projectProjection.source_status === "ready" && context.projectProjection.ready_for_desktop_multi_project_projection === true && context.projectProjection.project_count > 0, "Project projection must bind the project operating contract source.", "project_projection"),
    validationItem("project_projection.authority_closed", context.projectProjection.git_write_allowed_now === false && context.projectProjection.deploy_allowed_now === false && context.projectProjection.production_pass_enabled === false && context.projectProjection.enterprise_pass_enabled === false, "Project projection opened write, deploy, production, or enterprise authority.", "project_projection"),
    validationItem("project_projection.safe_affordances_closed", context.projectProjection.safe_affordance_rows.every((row) => row.mutates_state === false && row.opens_authority === false), "Project safe affordances must remain display-only.", "project_projection.safe_affordance_rows"),
    validationItem("project_projection.detail_rows", context.projectProjection.project_rows.length === context.projectProjection.project_detail_rows.length, "Project projection must expose one detail row per project row.", "project_projection.project_detail_rows"),
  ];
}

function buildSummary({ sourceRows, sections, screenMap, desktopReadAuthority, projectProjection, validation }) {
  const readySourceCount = sourceRows.filter((row) => row.status === "ready").length;
  const readySectionCount = sections.filter((section) => section.status === "ready").length;
  return {
    schema_version: "desktop-read-model-summary.v1",
    desktop_read_model_status: validation.errors.length === 0 && desktopReadAuthority.ready_for_desktop_shell ? READY_STATUS : BLOCKED_STATUS,
    source_count: sourceRows.length,
    ready_source_count: readySourceCount,
    blocked_source_count: sourceRows.length - readySourceCount,
    section_count: sections.length,
    ready_section_count: readySectionCount,
    blocked_section_count: sections.length - readySectionCount,
    screen_count: screenMap.length,
    ready_screen_count: screenMap.filter((screen) => screen.status === "ready").length,
    project_count: projectProjection?.project_count ?? 0,
    ready_project_count: projectProjection?.ready_project_count ?? 0,
    blocked_project_count: projectProjection?.blocked_project_count ?? 0,
    stale_project_count: projectProjection?.stale_project_count ?? 0,
    operator_handbook_bound: desktopReadAuthority.operator_handbook_bound,
    authority_boundary_ready: desktopReadAuthority.authority_boundary_ready,
    read_only: desktopReadAuthority.read_only,
    source_of_truth: desktopReadAuthority.source_of_truth,
    raw_payload_read_allowed: desktopReadAuthority.raw_payload_read_allowed,
    secret_like_path_read_allowed: desktopReadAuthority.secret_like_path_read_allowed,
    command_execution_allowed_now: desktopReadAuthority.command_execution_allowed_now,
    shell_execution_allowed_now: desktopReadAuthority.shell_execution_allowed_now,
    deployment_allowed_now: desktopReadAuthority.deployment_allowed_now,
    git_push_allowed_now: desktopReadAuthority.git_push_allowed_now,
    approval_application_allowed_now: desktopReadAuthority.approval_application_allowed_now,
    receipt_application_allowed_now: desktopReadAuthority.receipt_application_allowed_now,
    connector_write_allowed_now: desktopReadAuthority.connector_write_allowed_now,
    secret_read_allowed_now: desktopReadAuthority.secret_read_allowed_now,
    raw_source_exposure_allowed: desktopReadAuthority.raw_source_exposure_allowed,
    production_pass_enabled: desktopReadAuthority.production_pass_enabled,
    enterprise_pass_enabled: desktopReadAuthority.enterprise_pass_enabled,
    protected_closeout_enabled: desktopReadAuthority.protected_closeout_enabled,
    desktop_write_authority_enabled: desktopReadAuthority.desktop_write_authority_enabled,
    unsafe_flag_count: desktopReadAuthority.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Desktop Read Model",
    "",
    `- Status: ${result.summary.desktop_read_model_status}`,
    `- Sources: ${result.summary.ready_source_count}/${result.summary.source_count}`,
    `- Sections: ${result.summary.ready_section_count}/${result.summary.section_count}`,
    `- Screens: ${result.summary.ready_screen_count}/${result.summary.screen_count}`,
    `- Operator handbook bound: ${result.summary.operator_handbook_bound}`,
    `- Authority boundary ready: ${result.summary.authority_boundary_ready}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "The desktop read model is an explicit allowlist projection. Denied, missing, or malformed sources render blocker rows; no command, write, deployment, approval, receipt, connector, secret, raw payload, production PASS, or enterprise PASS authority is opened.",
  ].join("\n");
}

async function readJsonSource(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!options.skipPolicy && !isAllowedDesktopReadPath(filePath)) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, error: "Path is not allowed by desktop read policy." };
  }
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { available: true, path: filePath, resolved_path: resolvedPath, text, data: JSON.parse(text), error: null };
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, error: error.message };
  }
}

async function readAnySource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    let data = null;
    let jsonAvailable = false;
    try {
      data = JSON.parse(text);
      jsonAvailable = true;
    } catch {
      data = null;
    }
    return {
      available: true,
      path: filePath,
      resolved_path: resolvedPath,
      text,
      data,
      json_available: jsonAvailable,
      content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`,
      error: null,
    };
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, json_available: false, content_hash: null, error: error.message };
  }
}

function compactJsonSummary(data) {
  if (data?.schema_version === "project-operating-contract.v1") {
    const summary = data.summary ?? {};
    const boundary = data.project_operating_boundary ?? {};
    const identityByProject = new Map((data.project_identity_rows ?? []).map((row) => [row.project_id, row]));
    const progressByProject = new Map((data.project_progress_rows ?? []).map((row) => [row.project_id, row]));
    const sourceByProject = new Map((data.project_source_inventory_rows ?? []).map((row) => [row.project_id, row]));
    const authorityByProject = new Map((data.project_authority_boundary_rows ?? []).map((row) => [row.project_id, row]));
    const freshnessByProject = new Map((data.project_freshness_rows ?? []).map((row) => [row.project_id, row]));
    return {
      schema_version: data.schema_version,
      project_operating_contract_status: summary.project_operating_contract_status,
      project_count: Number(summary.project_count ?? 0),
      ready_project_count: Number(summary.ready_project_count ?? 0),
      blocked_project_count: Number(summary.blocked_project_count ?? 0),
      review_needed_project_count: Number(summary.review_needed_project_count ?? 0),
      stale_project_count: Number(summary.stale_project_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      ready_for_desktop_multi_project_projection: boundary.ready_for_desktop_multi_project_projection === true,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      production_pass_enabled: boundary.production_pass_enabled === true,
      enterprise_pass_enabled: boundary.enterprise_pass_enabled === true,
      protected_closeout_enabled: boundary.protected_closeout_enabled === true,
      project_rows: (data.project_state_rows ?? []).map((stateRow) => {
        const identity = identityByProject.get(stateRow.project_id) ?? {};
        const progress = progressByProject.get(stateRow.project_id) ?? {};
        return {
          project_id: stateRow.project_id,
          project_name: identity.project_name ?? stateRow.project_id,
          domain_pack: identity.domain_pack ?? "unknown",
          project_state: stateRow.project_state,
          current_goal_id: progress.current_goal_id ?? null,
          current_phase_range: progress.current_phase_range ?? null,
          blocker_count: Number(stateRow.blocker_count ?? 0),
          freshness_status: stateRow.freshness_status ?? "missing",
          progress_confidence: stateRow.progress_confidence ?? "unknown",
          next_allowed_action: stateRow.next_allowed_action ?? "inspect project state",
        };
      }),
      project_detail_rows: (data.project_state_rows ?? []).map((stateRow) => {
        const progress = progressByProject.get(stateRow.project_id) ?? {};
        const source = sourceByProject.get(stateRow.project_id) ?? {};
        const authority = authorityByProject.get(stateRow.project_id) ?? {};
        const freshness = freshnessByProject.get(stateRow.project_id) ?? {};
        return {
          project_id: stateRow.project_id,
          state_reason: stateRow.state_reason ?? "not recorded",
          blocker_type: stateRow.blocker_type ?? null,
          blocker_hint: blockerHintForState(stateRow),
          risk_level: progress.risk_level ?? "unknown",
          validation_ready: stateRow.validation_ready === true,
          review_boundary_ready: stateRow.review_boundary_ready === true,
          completed_units: Number(progress.completed_units ?? 0),
          remaining_units: Number(progress.remaining_units ?? 0),
          next_action_count: Number(progress.next_action_count ?? 0),
          source_generated_at: source.source_generated_at ?? freshness.source_generated_at ?? null,
          source_age_days: Number(freshness.source_age_days ?? 0),
          source_artifact_path: source.source_artifact_path ?? "",
          source_artifact_sha256: source.source_artifact_sha256 ?? freshness.source_hash ?? "",
          source_parse_status: source.source_parse_status ?? "unknown",
          refresh_required: freshness.refresh_required === true,
          unsafe_flag_count: Number(authority.unsafe_flag_count ?? 0),
          authority_boundary_closed: authority.unsafe_flag_count === 0,
          data_boundary_closed: authority.cross_project_data_mixing_allowed === false,
          next_allowed_action: stateRow.next_allowed_action ?? "inspect project detail",
        };
      }),
      project_drift_rows: (data.project_freshness_rows ?? []).map((row) => ({
        project_id: row.project_id,
        source_generated_at: row.source_generated_at ?? null,
        source_age_days: Number(row.source_age_days ?? 0),
        freshness_status: row.freshness_status ?? "missing",
        refresh_required: row.refresh_required === true,
        source_hash: row.source_hash ?? "",
        next_allowed_action: row.refresh_required === true ? "refresh artifact request draft only" : "inspect freshness",
      })),
      project_attention_rows: buildProjectAttentionSummaryRows({
        stateRows: data.project_state_rows ?? [],
        freshnessRows: data.project_freshness_rows ?? [],
        progressRows: data.project_progress_rows ?? [],
      }),
      safe_affordance_rows: (data.project_next_action_taxonomy_rows ?? []).map((row) => ({
        action_type: row.action_type,
        action_class: row.action_class,
        allowed: row.allowed === true,
        mutates_state: false,
        opens_authority: false,
        display_label: displayLabelForAction(row.action_type),
        hint: row.allowed === true
          ? "Display-only affordance. It may guide inspection or draft preparation but cannot execute protected work."
          : "Forbidden action remains closed in Desktop.",
      })),
    };
  }
  const summary = data?.summary ?? data?.desktop_authority_boundary ?? data?.operator_handbook_boundary ?? data;
  const picked = {};
  for (const key of [
    "schema_version",
    "desktop_authority_boundary_status",
    "operator_handbook_status",
    "operator_handbook_id",
    "boundary_status",
    "desktop_read_only",
    "desktop_source_of_truth",
    "unsafe_flag_count",
    "ready_for_desktop_read_model",
    "production_pass_enabled",
    "enterprise_pass_enabled",
    "protected_closeout_enabled",
    "desktop_write_authority_enabled",
    "validation_error_count",
  ]) {
    if (summary && Object.prototype.hasOwnProperty.call(summary, key)) picked[key] = summary[key];
  }
  return picked;
}

function buildProjectAttentionSummaryRows({ stateRows, freshnessRows, progressRows }) {
  const rows = [];
  const freshnessByProject = new Map(freshnessRows.map((row) => [row.project_id, row]));
  const progressByProject = new Map(progressRows.map((row) => [row.project_id, row]));
  for (const stateRow of stateRows) {
    const freshness = freshnessByProject.get(stateRow.project_id) ?? {};
    const progress = progressByProject.get(stateRow.project_id) ?? {};
    if (Number(stateRow.blocker_count ?? 0) > 0 || stateRow.project_state === "blocked") {
      rows.push(projectAttentionRow(stateRow.project_id, "blocked", "high", "Blocked project", blockerHintForState(stateRow), stateRow.next_allowed_action ?? "inspect blockers"));
    }
    if (stateRow.project_state === "review_needed" || stateRow.review_boundary_ready === false) {
      rows.push(projectAttentionRow(stateRow.project_id, "review_needed", "medium", "Review needed", "Prepare a read-only review packet. Desktop does not submit or approve review.", "prepare review packet draft"));
    }
    if (stateRow.project_state === "owner_action_needed") {
      rows.push(projectAttentionRow(stateRow.project_id, "owner_action_needed", "medium", "Owner action needed", "Prepare an owner decision draft. Desktop does not apply owner approval.", "draft owner decision"));
    }
    if (stateRow.project_state === "stale" || freshness.refresh_required === true) {
      rows.push(projectAttentionRow(stateRow.project_id, "stale", "medium", "Refresh needed", "Project source is stale. Create a refresh request or rerun the deterministic source generator outside Desktop.", "refresh artifact request draft only"));
    }
    if (String(progress.progress_confidence ?? stateRow.progress_confidence ?? "") === "low") {
      rows.push(projectAttentionRow(stateRow.project_id, "low_confidence", "medium", "Low confidence", "Progress confidence is low; inspect source binding before relying on this projection.", "inspect source binding"));
    }
  }
  return rows;
}

function projectAttentionRow(projectId, attentionType, severity, label, detail, nextSafeAction) {
  return {
    project_id: projectId,
    attention_type: attentionType,
    severity,
    label,
    detail,
    next_safe_action: nextSafeAction,
    mutates_state: false,
    opens_authority: false,
  };
}

function blockerHintForState(stateRow) {
  const blockerType = stateRow.blocker_type ?? (Number(stateRow.blocker_count ?? 0) > 0 ? "blocked" : null);
  if (blockerType === "missing_review") return "Prepare a read-only review packet; do not approve or submit it from Desktop.";
  if (blockerType === "missing_owner_decision") return "Draft an owner decision note; do not apply approval from Desktop.";
  if (blockerType === "failed_validation") return "Inspect validation evidence and rerun deterministic checks outside Desktop.";
  if (blockerType === "stale_artifact") return "Create a refresh request draft; Desktop does not mutate artifacts.";
  if (blockerType === "external_auth") return "External authentication is required outside Desktop.";
  if (blockerType === "protected_action_required") return "Protected action remains closed; prepare a request packet only.";
  if (blockerType === "data_boundary_risk") return "Inspect project boundary evidence before any handoff.";
  if (blockerType) return "Inspect blocker evidence and choose a safe next action.";
  return "No blocker remediation hint recorded.";
}

function displayLabelForAction(actionType) {
  return {
    inspect: "Inspect",
    copy_command: "Copy command text",
    open_artifact: "Preview artifact",
    prepare_review_packet: "Prepare review packet",
    draft_owner_decision: "Draft owner decision",
    refresh_artifact: "Draft refresh request",
  }[actionType] ?? String(actionType ?? "inspect").replaceAll("_", " ");
}

function compactTextSummary(text) {
  const summary = {
    kind: "markdown_summary",
    line_count: text.split(/\r?\n/).length,
    byte_length: Buffer.byteLength(text),
    has_forbidden_trust_string: containsForbiddenTrustString(text),
  };
  const candidateCommit = matchText(text, /Candidate commit(?:\s*\|\s*`?|:\s*)([a-f0-9]{40})/i);
  const localRcTag = matchText(text, /Proposed local RC tag(?:\s*\|\s*`?|:\s*`?)(v[0-9][^\s`|]+)/i)
    ?? matchText(text, /^\s*(?:\|\s*)?Local RC tag(?:\s*\|\s*`?|:\s*`?)(v[0-9][^\s`|]+)/im)
    ?? matchText(text, /^\s*(?:\|\s*)?Tag(?:\s*\|\s*`?|:\s*`?)(v[0-9][^\s`|]+)/im);
  if (candidateCommit) summary.candidate_commit = candidateCommit;
  if (localRcTag) summary.local_rc_tag = localRcTag;
  const tagPushed = matchBoolean(text, /(?:Tag pushed|Pushed to GitHub)(?:\s*\|\s*`?|:\s*)(true|false)/i);
  const githubReleasePublished = matchBoolean(text, /(?:GitHub Release published)(?:\s*\|\s*`?|:\s*)(true|false)/i);
  if (tagPushed !== null) summary.tag_pushed = tagPushed;
  if (githubReleasePublished !== null) summary.github_release_published = githubReleasePublished;
  summary.github_independent_approval_not_pursued = /GitHub independent approval[^.\n|]*(?:not pursued|not pursue)/i.test(text)
    || /not pursue GitHub independent approval/i.test(text);
  summary.owner_production_launch_approval_missing = /Owner production launch approval\s*\|\s*missing/i.test(text)
    || /Owner production launch decision is not recorded/i.test(text);

  for (const key of ["Status", "G1a status"]) {
    const value = matchText(text, new RegExp(`^${key}:\\s*([^\\n]+)`, "im"));
    if (value) summary[slug(key)] = value.trim();
  }
  const gateOpenNow = matchText(text, /^Gate open now:\s*(\d+)/im);
  if (gateOpenNow) summary.gate_open_now = Number(gateOpenNow);
  for (const [key, pattern] of [
    ["runtime_authority_open", /^Runtime authority open:\s*(true|false)/im],
    ["stage6_limited_execution_allowed", /^Stage6 limited execution allowed:\s*(true|false)/im],
    ["stage7_release_candidate_allowed", /^Stage7 release candidate allowed:\s*(true|false)/im],
    ["contract_development_allowed", /^Contract development allowed:\s*(true|false)/im],
    ["factory_goal_complete_allowed", /^Factory goal complete allowed:\s*(true|false)/im],
    ["production_pass_enabled", /^Production PASS enabled:\s*(true|false)/im],
    ["enterprise_pass_enabled", /^Enterprise PASS enabled:\s*(true|false)/im],
  ]) {
    const value = matchBoolean(text, pattern);
    if (value !== null) summary[key] = value;
  }
  return summary;
}

function firstSummaryValue(summaries, key) {
  return summaries.find((summary) => summary[key] !== undefined)?.[key];
}

function firstBooleanSummaryValue(summaries, key) {
  const value = firstSummaryValue(summaries, key);
  return typeof value === "boolean" ? value : null;
}

function matchText(text, pattern) {
  return text.match(pattern)?.[1]?.replace(/`/g, "").trim() ?? null;
}

function matchBoolean(text, pattern) {
  const value = matchText(text, pattern);
  if (value === null) return null;
  return value.toLowerCase() === "true";
}

function sectionLabel(sectionId) {
  return {
    projects: "Projects",
    release: "Release",
    factory: "Factory",
    reviews: "Reviews",
    operator_handbook: "Operator Handbook",
    artifacts: "Artifacts",
    authority_boundary: "Authority Boundary",
  }[sectionId] ?? sectionId;
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_DESKTOP_READ_MODEL_INPUTS)) {
    normalized[camelToSnake(key)] = options[key] ?? options[camelToSnake(key)] ?? defaultValue;
  }
  return normalized;
}

function normalizePolicyPath(filePath) {
  return String(filePath ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return { path: pathValue, check_id: pathValue, status: passed ? "passed" : "failed", message: passed ? "ok" : message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, evidence_ref: item.evidence_ref }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${key}_count`]: rows.length, [key]: rows };
}

export function parseDesktopReadModelArgs(argv) {
  const valueFlags = new Map([
    ["--out-dir", "outDir"],
    ["--run-at", "runAt"],
    ...Object.keys(DEFAULT_DESKTOP_READ_MODEL_INPUTS).map((key) => [`--${camelToKebab(key)}`, key]),
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
  console.log("Usage: node scripts/desktop-read-model.mjs [--check] [--out-dir path]\n\nWith --check, validates without writing artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
