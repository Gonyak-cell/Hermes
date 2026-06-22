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
  agentBridgeManifestPath: "artifacts/agent-bridge-manifest/latest/agent-bridge-manifest.json",
  agentBridgeRequestReceiptPath: "artifacts/agent-bridge-request-receipt/latest/agent-bridge-request-receipt.json",
  agentBridgeRequestReceiptSummaryPath: "artifacts/agent-bridge-request-receipt/latest/summary.md",
  agentBridgeRequestPacketExportPath: "artifacts/agent-bridge-request-packet-export/latest/agent-bridge-request-packet-export.json",
  agentBridgeReceiptImportWorkspacePath: "artifacts/agent-bridge-receipt-import-workspace/latest/agent-bridge-receipt-import-workspace.json",
  agentBridgeReviewFindingWorkbenchPath: "artifacts/agent-bridge-review-finding-workbench/latest/agent-bridge-review-finding-workbench.json",
  agentBridgeExecutionCandidatePath: "artifacts/agent-bridge-execution-candidate/latest/agent-bridge-execution-candidate.json",
  agentBridgeLimitedRuntimePlanPath: "artifacts/agent-bridge-limited-runtime-plan/latest/agent-bridge-limited-runtime-plan.json",
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
  "artifacts/agent-bridge-manifest/latest/agent-bridge-manifest.json",
  "artifacts/agent-bridge-request-receipt/latest/agent-bridge-request-receipt.json",
  "artifacts/agent-bridge-request-receipt/latest/summary.md",
  "artifacts/agent-bridge-request-packet-export/latest/agent-bridge-request-packet-export.json",
  "artifacts/agent-bridge-receipt-import-workspace/latest/agent-bridge-receipt-import-workspace.json",
  "artifacts/agent-bridge-review-finding-workbench/latest/agent-bridge-review-finding-workbench.json",
  "artifacts/agent-bridge-execution-candidate/latest/agent-bridge-execution-candidate.json",
  "artifacts/agent-bridge-limited-runtime-plan/latest/agent-bridge-limited-runtime-plan.json",
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
  sourceDefinition("agent_bridge_manifest", "agents", "Agent Bridge manifest", "agentBridgeManifestPath", true),
  sourceDefinition("agent_bridge_request_receipt", "agents", "Agent Bridge request/receipt", "agentBridgeRequestReceiptPath", true),
  sourceDefinition("agent_bridge_request_receipt_summary", "agents", "Agent Bridge request/receipt summary", "agentBridgeRequestReceiptSummaryPath", true),
  sourceDefinition("agent_bridge_request_packet_export", "agents", "Agent Bridge request packet export", "agentBridgeRequestPacketExportPath", true),
  sourceDefinition("agent_bridge_receipt_import_workspace", "agents", "Agent Bridge receipt import workspace", "agentBridgeReceiptImportWorkspacePath", true),
  sourceDefinition("agent_bridge_review_finding_workbench", "agents", "Agent Bridge review finding workbench", "agentBridgeReviewFindingWorkbenchPath", true),
  sourceDefinition("agent_bridge_execution_candidate", "agents", "Agent Bridge execution candidate", "agentBridgeExecutionCandidatePath", true),
  sourceDefinition("agent_bridge_limited_runtime_plan", "agents", "Agent Bridge limited runtime plan", "agentBridgeLimitedRuntimePlanPath", true),
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
  ["agents", "Agents", "Agent identities, capabilities, request queue, receipts, and permission boundaries without execution."],
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
  const agentProjection = buildAgentProjection(sourceRows, generatedAt);
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
    agentProjection,
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
    agent_projection: agentProjection,
    trust_claim_guard_rows: trustClaimGuardRows,
    denylist_fixture_rows: denylistFixtureRows,
    desktop_read_authority: desktopReadAuthority,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRows, sections, screenMap, desktopReadAuthority, projectProjection, agentProjection, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "desktop_read_model")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, sections, screenMap, desktopReadAuthority, projectProjection, agentProjection, validation: result.validation });
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
  const sectionIds = ["projects", "agents", "release", "factory", "reviews", "operator_handbook", "artifacts", "authority_boundary"];
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

function buildAgentProjection(sourceRows, generatedAt) {
  const manifestSource = sourceRows.find((row) => row.source_id === "agent_bridge_manifest");
  const requestReceiptSource = sourceRows.find((row) => row.source_id === "agent_bridge_request_receipt");
  const requestPacketExportSource = sourceRows.find((row) => row.source_id === "agent_bridge_request_packet_export");
  const receiptImportWorkspaceSource = sourceRows.find((row) => row.source_id === "agent_bridge_receipt_import_workspace");
  const reviewFindingWorkbenchSource = sourceRows.find((row) => row.source_id === "agent_bridge_review_finding_workbench");
  const executionCandidateSource = sourceRows.find((row) => row.source_id === "agent_bridge_execution_candidate");
  const limitedRuntimePlanSource = sourceRows.find((row) => row.source_id === "agent_bridge_limited_runtime_plan");
  const manifestSummary = manifestSource?.data_summary ?? {};
  const requestReceiptSummary = requestReceiptSource?.data_summary ?? {};
  const requestPacketExportSummary = requestPacketExportSource?.data_summary ?? {};
  const receiptImportWorkspaceSummary = receiptImportWorkspaceSource?.data_summary ?? {};
  const reviewFindingWorkbenchSummary = reviewFindingWorkbenchSource?.data_summary ?? {};
  const executionCandidateSummary = executionCandidateSource?.data_summary ?? {};
  const limitedRuntimePlanSummary = limitedRuntimePlanSource?.data_summary ?? {};
  const runtimeRows = Array.isArray(manifestSummary.runtime_rows) ? manifestSummary.runtime_rows : [];
  const capabilityRows = Array.isArray(manifestSummary.capability_rows) ? manifestSummary.capability_rows : [];
  const permissionRows = Array.isArray(manifestSummary.permission_rows) ? manifestSummary.permission_rows : [];
  const requestRows = Array.isArray(requestReceiptSummary.request_rows) ? requestReceiptSummary.request_rows : [];
  const receiptRows = Array.isArray(requestReceiptSummary.receipt_rows) ? requestReceiptSummary.receipt_rows : [];
  const evidenceBindingRows = Array.isArray(requestReceiptSummary.evidence_binding_rows) ? requestReceiptSummary.evidence_binding_rows : [];
  const packetExportRows = Array.isArray(requestPacketExportSummary.packet_export_rows) ? requestPacketExportSummary.packet_export_rows : [];
  const receiptImportCandidateRows = Array.isArray(receiptImportWorkspaceSummary.receipt_import_candidate_rows) ? receiptImportWorkspaceSummary.receipt_import_candidate_rows : [];
  const receiptNormalizedSummaryRows = Array.isArray(receiptImportWorkspaceSummary.receipt_normalized_summary_rows) ? receiptImportWorkspaceSummary.receipt_normalized_summary_rows : [];
  const reviewFindingRows = Array.isArray(reviewFindingWorkbenchSummary.review_finding_seed_rows) ? reviewFindingWorkbenchSummary.review_finding_seed_rows : [];
  const reviewFindingActionRows = Array.isArray(reviewFindingWorkbenchSummary.review_finding_action_rows) ? reviewFindingWorkbenchSummary.review_finding_action_rows : [];
  const executionCandidateRows = Array.isArray(executionCandidateSummary.execution_candidate_rows) ? executionCandidateSummary.execution_candidate_rows : [];
  const blockedCommandFixtureRows = Array.isArray(executionCandidateSummary.blocked_command_fixture_rows) ? executionCandidateSummary.blocked_command_fixture_rows : [];
  const executionGateRows = Array.isArray(executionCandidateSummary.execution_gate_rows) ? executionCandidateSummary.execution_gate_rows : [];
  const dryRunExecutorRows = Array.isArray(limitedRuntimePlanSummary.dry_run_executor_rows) ? limitedRuntimePlanSummary.dry_run_executor_rows : [];
  const providerAdapterRows = Array.isArray(limitedRuntimePlanSummary.provider_adapter_request_rows) ? limitedRuntimePlanSummary.provider_adapter_request_rows : [];
  const ownerLimitedExecutionGateRows = Array.isArray(limitedRuntimePlanSummary.owner_limited_execution_gate_rows) ? limitedRuntimePlanSummary.owner_limited_execution_gate_rows : [];
  const l10PreflightCandidateRows = Array.isArray(limitedRuntimePlanSummary.l10_preflight_candidate_rows) ? limitedRuntimePlanSummary.l10_preflight_candidate_rows : [];
  const limitedRuntimeGateRows = Array.isArray(limitedRuntimePlanSummary.limited_runtime_gate_rows) ? limitedRuntimePlanSummary.limited_runtime_gate_rows : [];
  const agentControlRows = buildAgentControlRows(generatedAt);
  const ready = manifestSource?.status === "ready"
    && requestReceiptSource?.status === "ready"
    && requestPacketExportSource?.status === "ready"
    && receiptImportWorkspaceSource?.status === "ready"
    && reviewFindingWorkbenchSource?.status === "ready"
    && executionCandidateSource?.status === "ready"
    && limitedRuntimePlanSource?.status === "ready"
    && manifestSummary.agent_bridge_manifest_status === "ready_for_agent_bridge_manifest"
    && requestReceiptSummary.agent_bridge_request_receipt_status === "ready_for_agent_bridge_request_receipt"
    && requestPacketExportSummary.agent_bridge_request_packet_export_status === "ready_for_agent_bridge_request_packet_export"
    && receiptImportWorkspaceSummary.agent_bridge_receipt_import_workspace_status === "ready_for_agent_bridge_receipt_import_workspace"
    && reviewFindingWorkbenchSummary.agent_bridge_review_finding_workbench_status === "ready_for_agent_bridge_review_finding_workbench"
    && executionCandidateSummary.agent_bridge_execution_candidate_status === "ready_for_agent_bridge_execution_candidate"
    && limitedRuntimePlanSummary.agent_bridge_limited_runtime_plan_status === "ready_for_agent_bridge_limited_runtime_plan";
  const projection = {
    schema_version: "desktop-agent-projection.v1",
    generated_at: generatedAt,
    agent_bridge_manifest_status: manifestSummary.agent_bridge_manifest_status ?? "not recorded",
    agent_bridge_request_receipt_status: requestReceiptSummary.agent_bridge_request_receipt_status ?? "not recorded",
    agent_bridge_request_packet_export_status: requestPacketExportSummary.agent_bridge_request_packet_export_status ?? "not recorded",
    agent_bridge_receipt_import_workspace_status: receiptImportWorkspaceSummary.agent_bridge_receipt_import_workspace_status ?? "not recorded",
    agent_bridge_review_finding_workbench_status: reviewFindingWorkbenchSummary.agent_bridge_review_finding_workbench_status ?? "not recorded",
    agent_bridge_execution_candidate_status: executionCandidateSummary.agent_bridge_execution_candidate_status ?? "not recorded",
    agent_bridge_limited_runtime_plan_status: limitedRuntimePlanSummary.agent_bridge_limited_runtime_plan_status ?? "not recorded",
    source_status: ready ? "ready" : "blocked",
    runtime_count: Number(manifestSummary.runtime_count ?? runtimeRows.length),
    capability_count: Number(manifestSummary.capability_count ?? capabilityRows.length),
    permission_row_count: Number(manifestSummary.permission_row_count ?? permissionRows.length),
    request_count: Number(requestReceiptSummary.request_count ?? requestRows.length),
    receipt_count: Number(requestReceiptSummary.receipt_count ?? receiptRows.length),
    evidence_binding_count: Number(requestReceiptSummary.evidence_binding_count ?? evidenceBindingRows.length),
    request_packet_export_count: Number(requestPacketExportSummary.packet_count ?? packetExportRows.length),
    request_packet_markdown_count: Number(requestPacketExportSummary.markdown_packet_count ?? packetExportRows.length),
    receipt_import_candidate_count: Number(receiptImportWorkspaceSummary.import_candidate_count ?? receiptImportCandidateRows.length),
    receipt_normalized_summary_count: Number(receiptImportWorkspaceSummary.normalized_summary_count ?? receiptNormalizedSummaryRows.length),
    review_finding_count: Number(reviewFindingWorkbenchSummary.finding_seed_count ?? reviewFindingRows.length),
    blocking_finding_count: Number(reviewFindingWorkbenchSummary.blocking_finding_count ?? reviewFindingRows.filter((row) => row.blocking === true).length),
    execution_candidate_count: Number(executionCandidateSummary.execution_candidate_count ?? executionCandidateRows.length),
    blocked_command_fixture_count: Number(executionCandidateSummary.blocked_command_fixture_count ?? blockedCommandFixtureRows.length),
    execution_gate_count: Number(executionCandidateSummary.gate_count ?? executionGateRows.length),
    execution_gate_pass_count: Number(executionCandidateSummary.gate_pass_count ?? executionGateRows.filter((row) => row.current_verdict === "pass").length),
    dry_run_executor_count: Number(limitedRuntimePlanSummary.dry_run_executor_count ?? dryRunExecutorRows.length),
    provider_adapter_request_count: Number(limitedRuntimePlanSummary.provider_adapter_request_count ?? providerAdapterRows.length),
    owner_limited_execution_gate_count: Number(limitedRuntimePlanSummary.owner_gate_count ?? ownerLimitedExecutionGateRows.length),
    l10_preflight_candidate_count: Number(limitedRuntimePlanSummary.l10_preflight_candidate_count ?? l10PreflightCandidateRows.length),
    limited_runtime_gate_count: Number(limitedRuntimePlanSummary.gate_count ?? limitedRuntimeGateRows.length),
    limited_runtime_gate_pass_count: Number(limitedRuntimePlanSummary.gate_pass_count ?? limitedRuntimeGateRows.filter((row) => row.current_verdict === "pass").length),
    ready_for_desktop_agents_projection: ready,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    request_queue_enabled_now: requestReceiptSummary.request_queue_enabled_now === true,
    receipt_intake_enabled_now: requestReceiptSummary.receipt_intake_enabled_now === true,
    request_packet_export_enabled_now: requestPacketExportSummary.request_packet_export_enabled_now === true,
    copy_markdown_allowed_now: requestPacketExportSummary.copy_markdown_allowed_now === true,
    file_export_allowed_now: requestPacketExportSummary.file_export_allowed_now === true,
    receipt_import_workspace_enabled_now: receiptImportWorkspaceSummary.receipt_import_workspace_enabled_now === true,
    normalized_summary_import_allowed_now: receiptImportWorkspaceSummary.normalized_summary_import_allowed_now === true,
    import_preview_allowed_now: receiptImportWorkspaceSummary.import_preview_allowed_now === true,
    review_finding_workbench_enabled_now: reviewFindingWorkbenchSummary.review_finding_workbench_enabled_now === true,
    finding_seed_visible_now: reviewFindingWorkbenchSummary.finding_seed_visible_now === true,
    finding_action_visible_now: reviewFindingWorkbenchSummary.finding_action_visible_now === true,
    finding_resolution_allowed_now: false,
    clean_checkpoint_allowed_now: false,
    patch_apply_allowed_now: false,
    controlled_execution_candidate_enabled_now: executionCandidateSummary.controlled_execution_candidate_enabled_now === true,
    candidate_queue_enabled_now: executionCandidateSummary.candidate_queue_enabled_now === true,
    candidate_export_allowed_now: executionCandidateSummary.candidate_export_allowed_now === true,
    candidate_validation_allowed_now: executionCandidateSummary.candidate_validation_allowed_now === true,
    dry_run_executor_enabled_now: limitedRuntimePlanSummary.dry_run_executor_enabled_now === true,
    owner_limited_execution_gate_enabled_now: limitedRuntimePlanSummary.owner_limited_execution_gate_enabled_now === true,
    provider_adapter_request_projection_enabled_now: limitedRuntimePlanSummary.provider_adapter_request_projection_enabled_now === true,
    l10_preflight_candidate_enabled_now: limitedRuntimePlanSummary.l10_preflight_candidate_enabled_now === true,
    request_transport_submission_allowed_now: false,
    execution_allowed_now: false,
    command_executed_now: false,
    command_output_captured_now: false,
    mutation_performed: false,
    dry_run_only: true,
    human_receipt_required_before_execution: true,
    limited_execution_receipt_required: true,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    connector_write_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    desktop_write_authority_enabled: false,
    no_latent_execution_ui: true,
    runtime_rows: runtimeRows.map((row) => ({
      runtime_id: String(row.runtime_id ?? "unknown"),
      runtime_kind: String(row.runtime_kind ?? "unknown"),
      display_name: String(row.display_name ?? row.runtime_id ?? "Unknown runtime"),
      model_label_observed: String(row.model_label_observed ?? "not recorded"),
      model_proof_trusted: false,
      state: String(row.state ?? "blocked"),
      trust_class: String(row.trust_class ?? "unknown"),
      requestable: false,
      executable: false,
      can_execute_from_desktop_now: false,
    })),
    capability_rows: capabilityRows.map((row) => ({
      capability_id: String(row.capability_id ?? "unknown"),
      capability_kind: String(row.capability_kind ?? "unknown"),
      capability_name: String(row.capability_name ?? row.capability_id ?? "Unknown capability"),
      runtime_id: String(row.runtime_id ?? "unknown"),
      state: String(row.state ?? "blocked"),
      passive_collection_only: row.passive_collection_only === true,
      requestable: false,
      executable: false,
      trust_class: String(row.trust_class ?? "unknown"),
    })),
    permission_rows: permissionRows.map((row) => ({
      capability_id: String(row.capability_id ?? "unknown"),
      runtime_id: String(row.runtime_id ?? "unknown"),
      authority_namespace: String(row.authority_namespace ?? "unknown"),
      capability_state: String(row.capability_state ?? "blocked"),
      desktop_display_allowed: row.desktop_display_allowed === true,
      requestable: false,
      executable: false,
      opens_authority: false,
    })),
    request_rows: requestRows.map((row) => ({
      request_id: String(row.request_id ?? "unknown"),
      request_type: String(row.request_type ?? "unknown"),
      request_status: String(row.request_status ?? "blocked"),
      target_runtime_id: String(row.target_runtime_id ?? "unknown"),
      request_title: String(row.request_title ?? "Untitled request"),
      risk_level: String(row.risk_level ?? "unknown"),
      request_packet_generated: row.request_packet_generated === true,
      transport_submitted_now: false,
      execution_allowed_now: false,
      command_executed_now: false,
      receipt_applied: false,
    })),
    receipt_rows: receiptRows.map((row) => ({
      receipt_id: String(row.receipt_id ?? "unknown"),
      request_id: String(row.request_id ?? "unknown"),
      request_type: String(row.request_type ?? "unknown"),
      receipt_kind: String(row.receipt_kind ?? "unknown"),
      normalized_verdict: String(row.normalized_verdict ?? "missing"),
      receipt_validated: row.receipt_validated === true,
      receipt_quarantined: row.receipt_quarantined === true,
      raw_output_included: false,
      receipt_applied: false,
      opens_authority: false,
    })),
    evidence_binding_rows: evidenceBindingRows.map((row) => ({
      binding_id: String(row.binding_id ?? "unknown"),
      request_id: String(row.request_id ?? "unknown"),
      receipt_id: row.receipt_id ? String(row.receipt_id) : null,
      binding_status: String(row.binding_status ?? "unknown"),
      target_runtime_id: String(row.target_runtime_id ?? "unknown"),
      target_capability_id: String(row.target_capability_id ?? "unknown"),
      opens_authority: false,
      receipt_applied: false,
    })),
    packet_export_rows: packetExportRows.map((row) => ({
      packet_id: String(row.packet_id ?? "unknown"),
      request_id: String(row.request_id ?? "unknown"),
      request_type: String(row.request_type ?? "unknown"),
      request_title: String(row.request_title ?? "Untitled packet"),
      target_runtime_id: String(row.target_runtime_id ?? "unknown"),
      target_capability_id: String(row.target_capability_id ?? "unknown"),
      packet_status: String(row.packet_status ?? "blocked"),
      packet_file_name: String(row.packet_file_name ?? "packet.md"),
      packet_markdown_hash: String(row.packet_markdown_hash ?? ""),
      copy_allowed_now: row.copy_allowed_now === true,
      file_export_allowed_now: row.file_export_allowed_now === true,
      request_transport_submission_allowed_now: false,
      provider_automation_allowed_now: false,
      raw_prompt_included: false,
      execution_allowed_now: false,
      opens_authority: false,
    })),
    receipt_import_candidate_rows: receiptImportCandidateRows.map((row) => ({
      import_candidate_id: String(row.import_candidate_id ?? "unknown"),
      receipt_id: String(row.receipt_id ?? "unknown"),
      request_id: String(row.request_id ?? "unknown"),
      packet_id: row.packet_id ? String(row.packet_id) : null,
      request_type: String(row.request_type ?? "unknown"),
      receipt_kind: String(row.receipt_kind ?? "unknown"),
      workspace_status: String(row.workspace_status ?? "blocked"),
      normalized_verdict: String(row.normalized_verdict ?? "missing"),
      normalized_summary_only: true,
      raw_output_included: false,
      raw_receipt_stored: false,
      receipt_validated: row.receipt_validated === true,
      receipt_quarantined: row.receipt_quarantined === true,
      receipt_applied: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      opens_authority: false,
    })),
    receipt_normalized_summary_rows: receiptNormalizedSummaryRows.map((row) => ({
      import_candidate_id: String(row.import_candidate_id ?? "unknown"),
      receipt_id: String(row.receipt_id ?? "unknown"),
      request_id: String(row.request_id ?? "unknown"),
      request_type: String(row.request_type ?? "unknown"),
      normalized_verdict: String(row.normalized_verdict ?? "missing"),
      summary_label: String(row.summary_label ?? "Receipt summary"),
      displayable_in_desktop: row.displayable_in_desktop === true,
      normalized_summary_only: true,
      raw_output_included: false,
      receipt_applied: false,
      opens_authority: false,
    })),
    review_finding_seed_rows: reviewFindingRows.map((row) => ({
      finding_id: String(row.finding_id ?? "unknown"),
      receipt_id: String(row.receipt_id ?? "unknown"),
      request_id: String(row.request_id ?? "unknown"),
      request_type: String(row.request_type ?? "unknown"),
      finding_category: String(row.finding_category ?? "unknown"),
      severity: String(row.severity ?? "unknown"),
      blocking: row.blocking === true,
      finding_status: String(row.finding_status ?? "blocked"),
      finding_summary: String(row.finding_summary ?? "not recorded"),
      finding_resolution_allowed_now: false,
      clean_checkpoint_allowed_now: false,
      patch_apply_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
      opens_authority: false,
    })),
    review_finding_action_rows: reviewFindingActionRows.map((row) => ({
      finding_id: String(row.finding_id ?? "unknown"),
      action_status: String(row.action_status ?? "blocked"),
      action_label: String(row.action_label ?? "Inspect finding"),
      next_allowed_action: String(row.next_allowed_action ?? "inspect finding"),
      action_mutates_state: false,
      action_executes_command: false,
      action_applies_patch: false,
      finding_resolution_allowed_now: false,
      opens_authority: false,
    })),
    execution_candidate_rows: executionCandidateRows.map((row) => ({
      candidate_id: String(row.candidate_id ?? "unknown"),
      candidate_type: String(row.candidate_type ?? "unknown"),
      candidate_title: String(row.candidate_title ?? "Untitled candidate"),
      candidate_status: String(row.candidate_status ?? "blocked"),
      command_text: String(row.command_text ?? ""),
      command_family: String(row.command_family ?? "unknown"),
      allowlist_match: row.allowlist_match === true,
      timeout_ms: Number(row.timeout_ms ?? 0),
      sandbox_profile: String(row.sandbox_profile ?? "repo_local_read_only"),
      human_receipt_required_before_execution: true,
      limited_execution_receipt_required: true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    blocked_command_fixture_rows: blockedCommandFixtureRows.map((row) => ({
      fixture_id: String(row.fixture_id ?? "unknown"),
      command_text: String(row.command_text ?? ""),
      expected_protected_action_type: String(row.expected_protected_action_type ?? "unknown"),
      observed_protected_action_type: String(row.observed_protected_action_type ?? "unknown"),
      blocked: row.blocked === true,
      blocked_reason: String(row.blocked_reason ?? "blocked"),
      allowlist_match: false,
      execution_allowed_now: false,
      command_executed_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    execution_gate_rows: executionGateRows.map((row) => ({
      gate_id: String(row.gate_id ?? "unknown"),
      gate_status: String(row.gate_status ?? "blocked"),
      description: String(row.description ?? "not recorded"),
      current_verdict: String(row.current_verdict ?? "blocked"),
      blocks_execution_when_failed: row.blocks_execution_when_failed === true,
      execution_allowed_now: false,
      command_executed_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    dry_run_executor_rows: dryRunExecutorRows.map((row) => ({
      candidate_id: String(row.candidate_id ?? "unknown"),
      candidate_type: String(row.candidate_type ?? "unknown"),
      command_text: String(row.command_text ?? ""),
      printed_intended_command: String(row.printed_intended_command ?? ""),
      executor_adapter_status: String(row.executor_adapter_status ?? "blocked"),
      dry_run_trace_created: row.dry_run_trace_created === true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    provider_adapter_request_rows: providerAdapterRows.map((row) => ({
      adapter_id: String(row.adapter_id ?? "unknown"),
      adapter_kind: String(row.adapter_kind ?? "unknown"),
      adapter_title: String(row.adapter_title ?? "Unknown adapter"),
      target_runtime_id: String(row.target_runtime_id ?? "unknown"),
      request_type: String(row.request_type ?? "unknown"),
      packet_id: row.packet_id ? String(row.packet_id) : null,
      adapter_request_status: String(row.adapter_request_status ?? "blocked"),
      request_transport_submission_allowed_now: false,
      provider_automation_allowed_now: false,
      execution_allowed_now: false,
      command_executed_now: false,
      opens_authority: false,
    })),
    owner_limited_execution_gate_rows: ownerLimitedExecutionGateRows.map((row) => ({
      candidate_id: String(row.candidate_id ?? "unknown"),
      owner_gate_status: String(row.owner_gate_status ?? "blocked"),
      owner_approval_observed: false,
      limited_execution_receipt_required: true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    l10_preflight_candidate_rows: l10PreflightCandidateRows.map((row) => ({
      preflight_id: String(row.preflight_id ?? "unknown"),
      preflight_type: String(row.preflight_type ?? "unknown"),
      command_text: String(row.command_text ?? ""),
      preflight_status: String(row.preflight_status ?? "blocked"),
      package_script_registered: row.package_script_registered === true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    limited_runtime_gate_rows: limitedRuntimeGateRows.map((row) => ({
      gate_id: String(row.gate_id ?? "unknown"),
      gate_status: String(row.gate_status ?? "blocked"),
      description: String(row.description ?? "not recorded"),
      current_verdict: String(row.current_verdict ?? "blocked"),
      execution_allowed_now: false,
      command_executed_now: false,
      mutation_performed: false,
      opens_authority: false,
    })),
    agent_control_rows: agentControlRows,
    projection_rows: [
      projectionRow("agent_runtimes", "Agent runtimes", String(manifestSummary.runtime_count ?? runtimeRows.length), ready ? "observed" : "blocked", false, generatedAt),
      projectionRow("agent_capabilities", "Agent capabilities", String(manifestSummary.capability_count ?? capabilityRows.length), ready ? "observed" : "blocked", false, generatedAt),
      projectionRow("agent_requests", "Request packets", String(requestReceiptSummary.request_count ?? requestRows.length), "request_only", false, generatedAt),
      projectionRow("agent_packet_export", "Packet export", String(requestPacketExportSummary.packet_count ?? packetExportRows.length), "copy_only", false, generatedAt),
      projectionRow("agent_receipts", "Receipts", String(requestReceiptSummary.receipt_count ?? receiptRows.length), "normalized_only", false, generatedAt),
      projectionRow("agent_receipt_import", "Receipt import workspace", String(receiptImportWorkspaceSummary.import_candidate_count ?? receiptImportCandidateRows.length), "normalized_preview_only", false, generatedAt),
      projectionRow("agent_review_findings", "Review findings", String(reviewFindingWorkbenchSummary.finding_seed_count ?? reviewFindingRows.length), "visible_unresolved_only", false, generatedAt),
      projectionRow("agent_execution_candidates", "Execution candidates", String(executionCandidateSummary.execution_candidate_count ?? executionCandidateRows.length), "candidate_only", false, generatedAt),
      projectionRow("agent_execution_gates", "Execution gates", `${executionCandidateSummary.gate_pass_count ?? 0}/${executionCandidateSummary.gate_count ?? executionGateRows.length}`, ready ? "pass" : "blocked", false, generatedAt),
      projectionRow("agent_dry_run_executor", "Dry-run executor", String(limitedRuntimePlanSummary.dry_run_executor_count ?? dryRunExecutorRows.length), "dry_run_only", false, generatedAt),
      projectionRow("agent_provider_adapters", "Provider adapters", String(limitedRuntimePlanSummary.provider_adapter_request_count ?? providerAdapterRows.length), "transport_closed", false, generatedAt),
      projectionRow("agent_l10_preflight", "L10 preflight", `${limitedRuntimePlanSummary.gate_pass_count ?? 0}/${limitedRuntimePlanSummary.gate_count ?? limitedRuntimeGateRows.length}`, ready ? "candidate_only" : "blocked", false, generatedAt),
      projectionRow("agent_execution", "Execution", "closed", "closed", false, generatedAt),
      projectionRow("agent_receipt_apply", "Receipt apply", "closed", "closed", false, generatedAt),
    ],
  };
  return { ...projection, projection_hash: sha256(projection) };
}

function buildAgentControlRows(generatedAt) {
  return [
    ["submit_prompt", "Submit prompt", "disabled_request_packet_only"],
    ["execute_command", "Execute command", "disabled_no_execution_policy"],
    ["approve", "Approve", "disabled_agent_cannot_approve"],
    ["apply_receipt", "Apply receipt", "disabled_receipt_import_only"],
    ["deploy", "Deploy", "disabled_protected_action"],
    ["git_write", "Git write", "disabled_protected_action"],
  ].map(([controlId, label, disabledReason], index) => ({
    schema_version: "desktop-agent-control-row.v1",
    row_id: `desktop.agent.control.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    label,
    control_enabled: false,
    disabled_reason: disabledReason,
    opens_authority: false,
    generated_at: generatedAt,
  }));
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
    validationItem("policy.allowlist.explicit", context.artifactAccessPolicy.allowlist.length >= 26 && context.artifactAccessPolicy.denylist_precedence === true, "Desktop read policy must use explicit allowlist with denylist precedence.", "artifact_access_policy"),
    validationItem("sources.blocker_visible", context.sourceRows.every((row) => row.status === "ready" || row.blocker), "Missing or blocked sources must render visible blockers.", "source_rows"),
    validationItem("sources.no_denied_reads", context.sourceRows.every((row) => row.source_allowed_by_policy === true), "Desktop read model attempted to read a denied or non-allowlisted source.", "source_rows"),
    validationItem("sections.required", ["release", "projects", "agents", "factory", "reviews", "operator_handbook", "artifacts", "authority_boundary"].every((sectionId) => context.sections.some((section) => section.section_id === sectionId)), "Desktop sections are incomplete.", "sections"),
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
    validationItem("agent_projection.ready", context.agentProjection.source_status === "ready" && context.agentProjection.ready_for_desktop_agents_projection === true && context.agentProjection.runtime_count >= 4 && context.agentProjection.review_finding_count >= 4 && context.agentProjection.execution_candidate_count >= 5 && context.agentProjection.dry_run_executor_count >= 13 && context.agentProjection.provider_adapter_request_count >= 3, "Agent projection must bind Agent Bridge manifest, request/receipt, review finding, execution candidate, and limited runtime sources.", "agent_projection"),
    validationItem("agent_projection.authority_closed", context.agentProjection.execution_allowed_now === false && context.agentProjection.command_output_captured_now === false && context.agentProjection.receipt_application_allowed_now === false && context.agentProjection.approval_application_allowed_now === false && context.agentProjection.production_pass_enabled === false && context.agentProjection.enterprise_pass_enabled === false, "Agent projection opened execution, output capture, receipt, approval, production, or enterprise authority.", "agent_projection"),
    validationItem("agent_projection.findings_closed", context.agentProjection.finding_resolution_allowed_now === false && context.agentProjection.clean_checkpoint_allowed_now === false && context.agentProjection.patch_apply_allowed_now === false && context.agentProjection.review_finding_seed_rows.every((row) => row.finding_resolution_allowed_now === false && row.clean_checkpoint_allowed_now === false && row.patch_apply_allowed_now === false && row.opens_authority === false) && context.agentProjection.review_finding_action_rows.every((row) => row.action_mutates_state === false && row.action_executes_command === false && row.action_applies_patch === false && row.opens_authority === false), "Agent review finding projection opened finding resolution, clean checkpoint, patch, mutation, or authority.", "agent_projection.review_finding_seed_rows"),
    validationItem("agent_projection.execution_candidates_closed", context.agentProjection.execution_candidate_rows.every((row) => row.execution_allowed_now === false && row.command_executed_now === false && row.command_output_captured_now === false && row.mutation_performed === false && row.opens_authority === false), "Agent execution candidate rows must remain display-only.", "agent_projection.execution_candidate_rows"),
    validationItem("agent_projection.execution_gates_closed", context.agentProjection.execution_gate_rows.every((row) => row.execution_allowed_now === false && row.command_executed_now === false && row.mutation_performed === false && row.opens_authority === false), "Agent execution gate rows must remain display-only.", "agent_projection.execution_gate_rows"),
    validationItem("agent_projection.limited_runtime_closed", context.agentProjection.dry_run_executor_rows.every((row) => row.execution_allowed_now === false && row.command_executed_now === false && row.command_output_captured_now === false && row.mutation_performed === false && row.opens_authority === false) && context.agentProjection.provider_adapter_request_rows.every((row) => row.request_transport_submission_allowed_now === false && row.provider_automation_allowed_now === false && row.execution_allowed_now === false && row.opens_authority === false) && context.agentProjection.l10_preflight_candidate_rows.every((row) => row.execution_allowed_now === false && row.command_executed_now === false && row.mutation_performed === false && row.opens_authority === false), "Agent limited runtime projection opened execution, transport, output capture, mutation, or authority.", "agent_projection.dry_run_executor_rows"),
    validationItem("agent_projection.no_latent_execution_ui", context.agentProjection.no_latent_execution_ui === true && context.agentProjection.agent_control_rows.every((row) => row.control_enabled === false && row.opens_authority === false), "Agent projection exposed latent execution UI controls.", "agent_projection.agent_control_rows"),
  ];
}

function buildSummary({ sourceRows, sections, screenMap, desktopReadAuthority, projectProjection, agentProjection, validation }) {
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
    agent_runtime_count: agentProjection?.runtime_count ?? 0,
    agent_request_count: agentProjection?.request_count ?? 0,
    agent_receipt_count: agentProjection?.receipt_count ?? 0,
    agent_execution_candidate_count: agentProjection?.execution_candidate_count ?? 0,
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
  if (data?.schema_version === "agent-bridge-manifest.v1") {
    const summary = data.summary ?? {};
    const boundary = data.agent_bridge_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_manifest_status: summary.agent_bridge_manifest_status,
      runtime_count: Number(summary.runtime_count ?? 0),
      capability_count: Number(summary.capability_count ?? 0),
      permission_row_count: Number(summary.permission_row_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      production_pass_enabled: boundary.production_pass_enabled === true,
      enterprise_pass_enabled: boundary.enterprise_pass_enabled === true,
      protected_closeout_enabled: boundary.protected_closeout_enabled === true,
      runtime_rows: (data.runtime_identity_rows ?? []).map((row) => ({
        runtime_id: row.runtime_id,
        runtime_kind: row.runtime_kind,
        display_name: row.display_name,
        model_label_observed: row.model_label_observed,
        model_proof_trusted: false,
        state: row.state,
        trust_class: row.trust_class,
        requestable: false,
        executable: false,
        can_execute_from_desktop_now: false,
      })),
      capability_rows: (data.capability_inventory_rows ?? []).map((row) => ({
        capability_id: row.capability_id,
        capability_kind: row.capability_kind,
        capability_name: row.capability_name,
        runtime_id: row.runtime_id,
        state: row.state,
        passive_collection_only: row.passive_collection_only === true,
        requestable: false,
        executable: false,
        trust_class: row.trust_class,
      })),
      permission_rows: (data.permission_matrix_rows ?? []).map((row) => ({
        capability_id: row.capability_id,
        runtime_id: row.runtime_id,
        authority_namespace: row.authority_namespace,
        capability_state: row.capability_state,
        desktop_display_allowed: row.desktop_display_allowed === true,
        requestable: false,
        executable: false,
        opens_authority: false,
      })),
    };
  }
  if (data?.schema_version === "agent-bridge-request-receipt.v1") {
    const summary = data.summary ?? {};
    const boundary = data.agent_request_receipt_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_request_receipt_status: summary.agent_bridge_request_receipt_status,
      source_agent_bridge_manifest_status: summary.source_agent_bridge_manifest_status,
      request_count: Number(summary.request_count ?? 0),
      receipt_count: Number(summary.receipt_count ?? 0),
      evidence_binding_count: Number(summary.evidence_binding_count ?? 0),
      request_queue_enabled_now: summary.request_queue_enabled_now === true,
      receipt_intake_enabled_now: summary.receipt_intake_enabled_now === true,
      request_transport_submission_allowed_now: false,
      execution_allowed_now: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      request_rows: (data.agent_task_request_queue_rows ?? []).map((row) => ({
        request_id: row.request_id,
        request_type: row.request_type,
        request_status: row.request_status,
        target_runtime_id: row.target_runtime_id,
        request_title: row.request_title,
        risk_level: row.risk_level,
        request_packet_generated: row.request_packet_generated === true,
        transport_submitted_now: false,
        execution_allowed_now: false,
        command_executed_now: false,
        receipt_applied: false,
      })),
      receipt_rows: (data.agent_receipt_intake_rows ?? []).map((row) => ({
        receipt_id: row.receipt_id,
        request_id: row.request_id,
        request_type: row.request_type,
        receipt_kind: row.receipt_kind,
        normalized_verdict: row.normalized_verdict,
        receipt_validated: row.receipt_validated === true,
        receipt_quarantined: row.receipt_quarantined === true,
        raw_output_included: false,
        receipt_applied: false,
        opens_authority: false,
      })),
      evidence_binding_rows: (data.agent_evidence_binding_rows ?? []).map((row) => ({
        binding_id: row.binding_id,
        request_id: row.request_id,
        receipt_id: row.receipt_id ?? null,
        binding_status: row.binding_status,
        target_runtime_id: row.target_runtime_id,
        target_capability_id: row.target_capability_id,
        opens_authority: false,
        receipt_applied: false,
      })),
    };
  }
  if (data?.schema_version === "agent-bridge-request-packet-export.v1") {
    const summary = data.summary ?? {};
    const boundary = data.agent_request_packet_export_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_request_packet_export_status: summary.agent_bridge_request_packet_export_status,
      source_agent_bridge_request_receipt_status: summary.source_agent_bridge_request_receipt_status,
      packet_count: Number(summary.packet_count ?? 0),
      markdown_packet_count: Number(summary.markdown_packet_count ?? 0),
      blocked_export_fixture_count: Number(summary.blocked_export_fixture_count ?? 0),
      request_packet_export_enabled_now: summary.request_packet_export_enabled_now === true,
      copy_markdown_allowed_now: summary.copy_markdown_allowed_now === true,
      file_export_allowed_now: summary.file_export_allowed_now === true,
      request_transport_submission_allowed_now: false,
      provider_automation_allowed_now: false,
      execution_allowed_now: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      packet_export_rows: (data.agent_request_packet_export_rows ?? []).map((row) => ({
        packet_id: row.packet_id,
        request_id: row.request_id,
        request_type: row.request_type,
        request_title: row.request_title,
        target_runtime_id: row.target_runtime_id,
        target_capability_id: row.target_capability_id,
        packet_status: row.packet_status,
        packet_file_name: row.packet_file_name,
        packet_markdown_hash: row.packet_markdown_hash,
        copy_allowed_now: row.copy_allowed_now === true,
        file_export_allowed_now: row.file_export_allowed_now === true,
        request_transport_submission_allowed_now: false,
        provider_automation_allowed_now: false,
        raw_prompt_included: false,
        execution_allowed_now: false,
        opens_authority: false,
      })),
      blocked_export_fixture_rows: (data.blocked_export_fixture_rows ?? []).map((row) => ({
        fixture_id: row.fixture_id,
        expected_blocker: row.expected_blocker,
        observed_blocker: row.observed_blocker,
        blocked: row.blocked === true,
        copy_allowed_now: false,
        file_export_allowed_now: false,
        opens_authority: false,
      })),
    };
  }
  if (data?.schema_version === "agent-bridge-receipt-import-workspace.v1") {
    const summary = data.summary ?? {};
    const boundary = data.agent_receipt_import_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_receipt_import_workspace_status: summary.agent_bridge_receipt_import_workspace_status,
      source_agent_bridge_request_receipt_status: summary.source_agent_bridge_request_receipt_status,
      source_agent_bridge_request_packet_export_status: summary.source_agent_bridge_request_packet_export_status,
      import_candidate_count: Number(summary.import_candidate_count ?? 0),
      normalized_summary_count: Number(summary.normalized_summary_count ?? 0),
      blocked_import_fixture_count: Number(summary.blocked_import_fixture_count ?? 0),
      receipt_import_workspace_enabled_now: summary.receipt_import_workspace_enabled_now === true,
      normalized_summary_import_allowed_now: summary.normalized_summary_import_allowed_now === true,
      import_preview_allowed_now: summary.import_preview_allowed_now === true,
      raw_receipt_storage_allowed: false,
      raw_prompt_storage_allowed: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
      provider_output_authoritative: false,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      receipt_import_candidate_rows: (data.agent_receipt_import_candidate_rows ?? []).map((row) => ({
        import_candidate_id: row.import_candidate_id,
        receipt_id: row.receipt_id,
        request_id: row.request_id,
        packet_id: row.packet_id ?? null,
        request_type: row.request_type,
        receipt_kind: row.receipt_kind,
        workspace_status: row.workspace_status,
        normalized_verdict: row.normalized_verdict,
        normalized_summary_only: true,
        raw_output_included: false,
        raw_receipt_stored: false,
        receipt_validated: row.receipt_validated === true,
        receipt_quarantined: row.receipt_quarantined === true,
        receipt_applied: false,
        receipt_application_allowed_now: false,
        approval_application_allowed_now: false,
        opens_authority: false,
      })),
      receipt_normalized_summary_rows: (data.agent_receipt_normalized_summary_rows ?? []).map((row) => ({
        import_candidate_id: row.import_candidate_id,
        receipt_id: row.receipt_id,
        request_id: row.request_id,
        request_type: row.request_type,
        normalized_verdict: row.normalized_verdict,
        summary_label: row.summary_label,
        displayable_in_desktop: row.displayable_in_desktop === true,
        normalized_summary_only: true,
        raw_output_included: false,
        receipt_applied: false,
        opens_authority: false,
      })),
      blocked_import_fixture_rows: (data.blocked_import_fixture_rows ?? []).map((row) => ({
        fixture_id: row.fixture_id,
        expected_blocker: row.expected_blocker,
        observed_blocker: row.observed_blocker,
        blocked: row.blocked === true,
        receipt_quarantined: row.receipt_quarantined === true,
        receipt_applied: false,
        opens_authority: false,
      })),
    };
  }
  if (data?.schema_version === "agent-bridge-review-finding-workbench.v1") {
    const summary = data.summary ?? {};
    const boundary = data.agent_review_finding_workbench_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_review_finding_workbench_status: summary.agent_bridge_review_finding_workbench_status,
      source_agent_bridge_receipt_import_workspace_status: summary.source_agent_bridge_receipt_import_workspace_status,
      finding_seed_count: Number(summary.finding_seed_count ?? 0),
      finding_action_count: Number(summary.finding_action_count ?? 0),
      blocking_finding_count: Number(summary.blocking_finding_count ?? 0),
      blocked_finding_fixture_count: Number(summary.blocked_finding_fixture_count ?? 0),
      review_finding_workbench_enabled_now: summary.review_finding_workbench_enabled_now === true,
      finding_seed_visible_now: summary.finding_seed_visible_now === true,
      finding_action_visible_now: summary.finding_action_visible_now === true,
      blocking_findings_visible_now: summary.blocking_findings_visible_now === true,
      finding_resolution_allowed_now: false,
      clean_checkpoint_allowed_now: false,
      patch_apply_allowed_now: false,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      execution_allowed_now: false,
      provider_output_authoritative: false,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      review_finding_seed_rows: (data.agent_review_finding_seed_rows ?? []).map((row) => ({
        finding_id: row.finding_id,
        receipt_id: row.receipt_id,
        request_id: row.request_id,
        request_type: row.request_type,
        finding_category: row.finding_category,
        severity: row.severity,
        blocking: row.blocking === true,
        finding_status: row.finding_status,
        finding_summary: row.finding_summary,
        finding_resolution_allowed_now: false,
        clean_checkpoint_allowed_now: false,
        patch_apply_allowed_now: false,
        approval_application_allowed_now: false,
        execution_allowed_now: false,
        opens_authority: false,
      })),
      review_finding_action_rows: (data.agent_review_finding_action_rows ?? []).map((row) => ({
        finding_id: row.finding_id,
        action_status: row.action_status,
        action_label: row.action_label,
        next_allowed_action: row.next_allowed_action,
        action_mutates_state: false,
        action_executes_command: false,
        action_applies_patch: false,
        finding_resolution_allowed_now: false,
        opens_authority: false,
      })),
    };
  }
  if (data?.schema_version === "agent-bridge-execution-candidate.v1") {
    const summary = data.summary ?? {};
    const boundary = data.agent_bridge_execution_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_execution_candidate_status: summary.agent_bridge_execution_candidate_status,
      source_agent_bridge_manifest_status: summary.source_agent_bridge_manifest_status,
      source_agent_bridge_request_receipt_status: summary.source_agent_bridge_request_receipt_status,
      source_controlled_execution_sandbox_status: summary.source_controlled_execution_sandbox_status,
      source_human_approved_limited_execution_status: summary.source_human_approved_limited_execution_status,
      execution_candidate_count: Number(summary.execution_candidate_count ?? 0),
      blocked_command_fixture_count: Number(summary.blocked_command_fixture_count ?? 0),
      gate_count: Number(summary.gate_count ?? 0),
      gate_pass_count: Number(summary.gate_pass_count ?? 0),
      controlled_execution_candidate_enabled_now: summary.controlled_execution_candidate_enabled_now === true,
      candidate_queue_enabled_now: summary.candidate_queue_enabled_now === true,
      candidate_export_allowed_now: summary.candidate_export_allowed_now === true,
      candidate_validation_allowed_now: summary.candidate_validation_allowed_now === true,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      dry_run_only: true,
      human_receipt_required_before_execution: true,
      limited_execution_receipt_required: true,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      execution_candidate_rows: (data.agent_bridge_execution_candidate_rows ?? []).map((row) => ({
        candidate_id: row.candidate_id,
        candidate_type: row.candidate_type,
        candidate_title: row.candidate_title,
        candidate_status: row.candidate_status,
        command_text: row.command_text,
        command_family: row.command_family,
        allowlist_match: row.allowlist_match === true,
        timeout_ms: Number(row.timeout_ms ?? 0),
        sandbox_profile: row.sandbox_profile,
        human_receipt_required_before_execution: true,
        limited_execution_receipt_required: true,
        execution_allowed_now: false,
        command_executed_now: false,
        command_output_captured_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
      blocked_command_fixture_rows: (data.blocked_command_fixture_rows ?? []).map((row) => ({
        fixture_id: row.fixture_id,
        command_text: row.command_text,
        expected_protected_action_type: row.expected_protected_action_type,
        observed_protected_action_type: row.observed_protected_action_type,
        blocked: row.blocked === true,
        blocked_reason: row.blocked_reason,
        allowlist_match: false,
        execution_allowed_now: false,
        command_executed_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
      execution_gate_rows: (data.agent_bridge_execution_gate_rows ?? []).map((row) => ({
        gate_id: row.gate_id,
        gate_status: row.gate_status,
        description: row.description,
        current_verdict: row.current_verdict,
        blocks_execution_when_failed: row.blocks_execution_when_failed === true,
        execution_allowed_now: false,
        command_executed_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
    };
  }
  if (data?.schema_version === "agent-bridge-limited-runtime-plan.v1") {
    const summary = data.summary ?? {};
    const boundary = data.limited_runtime_boundary ?? {};
    return {
      schema_version: data.schema_version,
      agent_bridge_limited_runtime_plan_status: summary.agent_bridge_limited_runtime_plan_status,
      source_agent_bridge_execution_candidate_status: summary.source_agent_bridge_execution_candidate_status,
      source_agent_bridge_request_packet_export_status: summary.source_agent_bridge_request_packet_export_status,
      dry_run_executor_count: Number(summary.dry_run_executor_count ?? 0),
      owner_gate_count: Number(summary.owner_gate_count ?? 0),
      provider_adapter_request_count: Number(summary.provider_adapter_request_count ?? 0),
      blocked_runtime_command_fixture_count: Number(summary.blocked_runtime_command_fixture_count ?? 0),
      l10_preflight_candidate_count: Number(summary.l10_preflight_candidate_count ?? 0),
      gate_count: Number(summary.gate_count ?? 0),
      gate_pass_count: Number(summary.gate_pass_count ?? 0),
      dry_run_executor_enabled_now: summary.dry_run_executor_enabled_now === true,
      owner_limited_execution_gate_enabled_now: summary.owner_limited_execution_gate_enabled_now === true,
      provider_adapter_request_projection_enabled_now: summary.provider_adapter_request_projection_enabled_now === true,
      l10_preflight_candidate_enabled_now: summary.l10_preflight_candidate_enabled_now === true,
      request_transport_submission_allowed_now: false,
      provider_automation_allowed_now: false,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      dry_run_only: true,
      human_receipt_required_before_execution: true,
      limited_execution_receipt_required: true,
      receipt_application_allowed_now: false,
      approval_application_allowed_now: false,
      unsafe_flag_count: Number(boundary.unsafe_flag_count ?? 0),
      validation_error_count: Number(summary.validation_error_count ?? 0),
      dry_run_executor_rows: (data.dry_run_executor_rows ?? []).map((row) => ({
        candidate_id: row.candidate_id,
        candidate_type: row.candidate_type,
        command_text: row.command_text,
        printed_intended_command: row.printed_intended_command,
        executor_adapter_status: row.executor_adapter_status,
        dry_run_trace_created: row.dry_run_trace_created === true,
        execution_allowed_now: false,
        command_executed_now: false,
        command_output_captured_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
      provider_adapter_request_rows: (data.provider_adapter_request_rows ?? []).map((row) => ({
        adapter_id: row.adapter_id,
        adapter_kind: row.adapter_kind,
        adapter_title: row.adapter_title,
        target_runtime_id: row.target_runtime_id,
        request_type: row.request_type,
        packet_id: row.packet_id ?? null,
        adapter_request_status: row.adapter_request_status,
        request_transport_submission_allowed_now: false,
        provider_automation_allowed_now: false,
        execution_allowed_now: false,
        command_executed_now: false,
        opens_authority: false,
      })),
      owner_limited_execution_gate_rows: (data.owner_limited_execution_gate_rows ?? []).map((row) => ({
        candidate_id: row.candidate_id,
        owner_gate_status: row.owner_gate_status,
        owner_approval_observed: false,
        limited_execution_receipt_required: true,
        execution_allowed_now: false,
        command_executed_now: false,
        command_output_captured_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
      l10_preflight_candidate_rows: (data.l10_preflight_candidate_rows ?? []).map((row) => ({
        preflight_id: row.preflight_id,
        preflight_type: row.preflight_type,
        command_text: row.command_text,
        preflight_status: row.preflight_status,
        package_script_registered: row.package_script_registered === true,
        execution_allowed_now: false,
        command_executed_now: false,
        command_output_captured_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
      limited_runtime_gate_rows: (data.limited_runtime_gate_rows ?? []).map((row) => ({
        gate_id: row.gate_id,
        gate_status: row.gate_status,
        description: row.description,
        current_verdict: row.current_verdict,
        execution_allowed_now: false,
        command_executed_now: false,
        mutation_performed: false,
        opens_authority: false,
      })),
    };
  }
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
    agents: "Agents",
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
