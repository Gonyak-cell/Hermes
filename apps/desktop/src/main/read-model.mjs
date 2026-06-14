import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { SHELL_SEED_STATE } from "../shared/shell-state.mjs";

export const DESKTOP_READ_MODEL_RELATIVE_PATH = "artifacts/desktop-read-model/latest/desktop-read-model.json";

export async function loadDesktopReadModel({ repoRoot }) {
  const sourcePath = path.join(repoRoot, DESKTOP_READ_MODEL_RELATIVE_PATH);
  try {
    const raw = await readFile(sourcePath, "utf8");
    return sanitizeReadModel(JSON.parse(raw), sourcePath);
  } catch (error) {
    return {
      schema_version: "desktop-read-model-missing.v1",
      generated_at: new Date().toISOString(),
      summary: {
        desktop_read_model_status: "blocked_desktop_shell",
        validation_error_count: 1,
        source_count: 0,
        ready_source_count: 0,
        blocked_source_count: 1,
        operator_handbook_bound: false,
        authority_boundary_ready: false,
        ...SHELL_SEED_STATE.authority_flags,
      },
      sections: [
        {
          section_id: "artifacts",
          label: "Artifacts",
          source_path: DESKTOP_READ_MODEL_RELATIVE_PATH,
          generated_at: new Date().toISOString(),
          status: "blocked",
          blocker: `Missing desktop read model: ${error.message}`,
          section_refs: [],
        },
      ],
      source_rows: [],
      screen_map: [],
      release_projection: defaultReleaseProjection(),
      factory_projection: defaultFactoryProjection(),
      desktop_read_authority: {
        read_only: true,
        source_of_truth: false,
        ...SHELL_SEED_STATE.authority_flags,
      },
    };
  }
}

export async function loadDesktopSourcePreview({ repoRoot, sourcePath }) {
  const readModel = await loadDesktopReadModel({ repoRoot });
  const normalized = normalizePolicyPath(sourcePath);
  const row = (readModel.source_rows ?? []).find((item) => normalizePolicyPath(item.source_path) === normalized);
  if (!row) return blockedPreview(normalized, "Source path is not part of the desktop read model.");
  if (row.status !== "ready") return blockedPreview(normalized, row.blocker ?? "Source row is blocked.");
  if (isDeniedPreviewPath(normalized)) return blockedPreview(normalized, "Source path is blocked by the desktop preview denylist.");
  if (!normalized.endsWith(".md")) return blockedPreview(normalized, "Preview is limited to allowlisted markdown summaries.");

  try {
    const repoRootRealPath = await realpath(repoRoot);
    const absolutePath = path.resolve(repoRootRealPath, normalized);
    const sourceRealPath = await realpath(absolutePath);
    const rootWithSep = repoRootRealPath.endsWith(path.sep) ? repoRootRealPath : `${repoRootRealPath}${path.sep}`;
    if (sourceRealPath !== repoRootRealPath && !sourceRealPath.startsWith(rootWithSep)) {
      return blockedPreview(normalized, "Source path escapes the repository root.");
    }

    const text = await readFile(sourceRealPath, "utf8");
    const redacted = redactPreviewText(text);
    return {
      schema_version: "desktop-source-preview.v1",
      source_path: normalized,
      status: "ready",
      blocker: null,
      preview_text: redacted.slice(0, 12000),
      truncated: redacted.length > 12000,
      redacted: redacted !== text,
      byte_length: Buffer.byteLength(text),
    };
  } catch (error) {
    return blockedPreview(normalized, error.message);
  }
}

export function sanitizeReadModel(readModel, sourcePath = DESKTOP_READ_MODEL_RELATIVE_PATH) {
  const summary = readModel?.summary ?? {};
  const authority = readModel?.desktop_read_authority ?? {};
  return {
    schema_version: readModel?.schema_version ?? "desktop-read-model.unknown",
    generated_at: readModel?.generated_at ?? null,
    source_path: sourcePath,
    summary: pickSummary(summary),
    sections: safeArray(readModel?.sections).map(pickSection),
    source_rows: safeArray(readModel?.source_rows).map(pickSourceRow),
    screen_map: safeArray(readModel?.screen_map).map(pickScreen),
    release_projection: pickReleaseProjection(readModel?.release_projection),
    factory_projection: pickFactoryProjection(readModel?.factory_projection),
    desktop_read_authority: pickAuthority(authority),
  };
}

function pickSummary(summary) {
  return {
    desktop_read_model_status: summary.desktop_read_model_status ?? "blocked_desktop_shell",
    source_count: Number(summary.source_count ?? 0),
    ready_source_count: Number(summary.ready_source_count ?? 0),
    blocked_source_count: Number(summary.blocked_source_count ?? 0),
    section_count: Number(summary.section_count ?? 0),
    ready_section_count: Number(summary.ready_section_count ?? 0),
    blocked_section_count: Number(summary.blocked_section_count ?? 0),
    screen_count: Number(summary.screen_count ?? 0),
    ready_screen_count: Number(summary.ready_screen_count ?? 0),
    operator_handbook_bound: summary.operator_handbook_bound === true,
    authority_boundary_ready: summary.authority_boundary_ready === true,
    validation_error_count: Number(summary.validation_error_count ?? 0),
    read_only: summary.read_only !== false,
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
  };
}

function pickAuthority(authority) {
  return {
    read_only: authority.read_only !== false,
    operator_handbook_bound: authority.operator_handbook_bound === true,
    authority_boundary_ready: authority.authority_boundary_ready === true,
    all_sections_ready: authority.all_sections_ready === true,
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
    unsafe_flag_count: 0,
    ready_for_desktop_shell: authority.ready_for_desktop_shell === true,
  };
}

function pickSourceRow(row) {
  return {
    source_id: String(row?.source_id ?? "unknown"),
    section_id: String(row?.section_id ?? "artifacts"),
    label: String(row?.label ?? row?.source_id ?? "Unknown source"),
    source_path: String(row?.source_path ?? ""),
    source_available: row?.source_available === true,
    status: row?.status === "ready" ? "ready" : "blocked",
    blocker: row?.blocker ?? null,
    generated_at: row?.generated_at ?? null,
    source_content_hash: row?.source_content_hash ?? null,
  };
}

function pickSection(section) {
  return {
    section_id: String(section?.section_id ?? "unknown"),
    label: String(section?.label ?? section?.section_id ?? "Unknown"),
    source_path: section?.source_path ?? null,
    generated_at: section?.generated_at ?? null,
    status: section?.status === "ready" ? "ready" : "blocked",
    blocker: section?.blocker ?? null,
    section_refs: safeArray(section?.section_refs).map((ref) => ({
      source_id: String(ref?.source_id ?? "unknown"),
      source_path: String(ref?.source_path ?? ""),
      status: ref?.status === "ready" ? "ready" : "blocked",
      blocker: ref?.blocker ?? null,
    })),
  };
}

function pickScreen(screen) {
  return {
    screen_id: String(screen?.screen_id ?? "unknown"),
    label: String(screen?.label ?? screen?.screen_id ?? "Unknown"),
    status: screen?.status === "ready" ? "ready" : "blocked",
    blocker_state: screen?.blocker_state ?? null,
    no_action_authority_notice: screen?.no_action_authority_notice ?? "Read-only screen.",
  };
}

function pickReleaseProjection(projection = {}) {
  return {
    schema_version: "desktop-release-projection.v1",
    generated_at: projection?.generated_at ?? null,
    candidate_commit: String(projection?.candidate_commit ?? "unknown"),
    local_rc_tag: String(projection?.local_rc_tag ?? "not recorded"),
    trust_mode: "single-owner lower-trust RC",
    release_candidate_freeze_observed: projection?.release_candidate_freeze_observed === true,
    github_independent_approval_status: projection?.github_independent_approval_status === "not_pursued_single_owner_local_rc"
      ? "not_pursued_single_owner_local_rc"
      : "missing",
    production_launch_approval_status: projection?.production_launch_approval_status === "missing" ? "missing" : "not_approved",
    deployment_authorized: false,
    tag_pushed: false,
    github_release_published: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    projection_rows: safeArray(projection?.projection_rows).map(pickProjectionRow),
  };
}

function pickFactoryProjection(projection = {}) {
  return {
    schema_version: "desktop-factory-projection.v1",
    generated_at: projection?.generated_at ?? null,
    factory_gate_readiness_status: String(projection?.factory_gate_readiness_status ?? "not recorded"),
    stage6_stage7_status: String(projection?.stage6_stage7_status ?? "not recorded"),
    observed_gate_open_now_input: Number(projection?.observed_gate_open_now_input ?? 0),
    gate_open_now: 0,
    g1a_status: String(projection?.g1a_status ?? "not recorded"),
    runtime_authority_open: false,
    stage6_limited_execution_allowed: false,
    stage7_release_candidate_allowed: false,
    contract_development_allowed: projection?.contract_development_allowed === true,
    factory_goal_complete_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    projection_rows: safeArray(projection?.projection_rows).map(pickProjectionRow).map((row) => (
      row.row_id === "gate_open_now" ? { ...row, value: "0", authority_open: false } : row
    )),
  };
}

function pickProjectionRow(row) {
  const rowId = String(row?.row_id ?? "unknown");
  return {
    row_id: rowId,
    label: safeProjectionLabel(rowId, row?.label),
    value: String(row?.value ?? ""),
    status: String(row?.status ?? "closed"),
    authority_open: false,
    generated_at: row?.generated_at ?? null,
  };
}

function defaultReleaseProjection() {
  return pickReleaseProjection({
    projection_rows: [
      { row_id: "deployment_authorization", label: "Deploy authority", value: "not authorized", status: "closed" },
    ],
  });
}

function defaultFactoryProjection() {
  return pickFactoryProjection({
    projection_rows: [
      { row_id: "gate_open_now", label: "Gate open now", value: "0", status: "closed" },
    ],
  });
}

function blockedPreview(sourcePath, blocker) {
  return {
    schema_version: "desktop-source-preview.v1",
    source_path: sourcePath,
    status: "blocked",
    blocker,
    preview_text: "",
    truncated: false,
    redacted: false,
    byte_length: 0,
  };
}

function isDeniedPreviewPath(sourcePath) {
  const normalized = normalizePolicyPath(sourcePath);
  const base = path.posix.basename(normalized);
  return base.startsWith(".env")
    || /(^|\/)[^/]*(secret|credential|token|private-key)[^/]*($|\/)/i.test(normalized)
    || (normalized.startsWith("artifacts/") && /^raw.*\.json$/i.test(base))
    || (normalized.startsWith("artifacts/") && /^raw-output.*\.json$/i.test(base))
    || normalized.endsWith("/provenance/signed-provenance-receipt.json")
    || normalized.endsWith("/review/raw-output.json");
}

function safeProjectionLabel(rowId, fallback) {
  const labels = {
    github_independent_approval: "Independent review",
    production_launch_approval: "Launch approval",
    deployment_authorization: "Deploy authority",
  };
  return labels[rowId] ?? String(fallback ?? rowId ?? "Unknown");
}

function redactPreviewText(text) {
  return String(text ?? "")
    .replace(/production PASS/gi, "[redacted production trust claim]")
    .replace(/enterprise PASS/gi, "[redacted enterprise trust claim]")
    .replace(/enterprise trust/gi, "[redacted enterprise trust claim]")
    .replace(/GitHub independent approval/gi, "[redacted independent approval claim]")
    .replace(/independently approved/gi, "[redacted independent approval claim]")
    .replace(/production launch approval/gi, "[redacted production launch claim]")
    .replace(/production launch approved/gi, "[redacted production launch claim]")
    .replace(/deployment authorization/gi, "[redacted deployment claim]")
    .replace(/protected closeout/gi, "[redacted protected closeout claim]")
    .replace(/desktop write authority enabled/gi, "[redacted desktop write authority claim]");
}

function normalizePolicyPath(filePath) {
  return String(filePath ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
