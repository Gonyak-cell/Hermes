import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDesktopReadModel, sanitizeReadModel } from "../src/main/read-model.mjs";

test("desktop read model loader returns visible blocker when artifact is missing", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-loader-"));
  try {
    const result = await loadDesktopReadModel({ repoRoot: tmpDir });

    assert.equal(result.summary.desktop_read_model_status, "blocked_desktop_shell");
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.secret_read_allowed_now, false);
    assert.equal(result.sections[0].status, "blocked");
    assert.match(result.sections[0].blocker, /Missing desktop read model/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("desktop read model loader sanitizes authority flags from artifact input", () => {
  const result = sanitizeReadModel({
    schema_version: "desktop-read-model.v1",
    generated_at: "2026-06-14T00:00:00.000Z",
    summary: {
      desktop_read_model_status: "ready_for_desktop_shell",
      source_count: 1,
      ready_source_count: 1,
      section_count: 1,
      ready_section_count: 1,
      deployment_allowed_now: true,
      production_pass_enabled: true,
    },
    source_rows: [
      {
        source_id: "release_decision_packet",
        section_id: "release",
        label: "Release decision packet",
        source_path: "docs/release-decision-packet-2026-06-14.md",
        source_available: true,
        status: "ready",
        generated_at: "2026-06-14T00:00:00.000Z",
      },
    ],
    sections: [
      {
        section_id: "release",
        label: "Release",
        source_path: "docs/release-decision-packet-2026-06-14.md",
        generated_at: "2026-06-14T00:00:00.000Z",
        status: "ready",
        section_refs: [],
      },
    ],
    desktop_read_authority: {
      deployment_allowed_now: true,
      production_pass_enabled: true,
      unsafe_flag_count: 9,
    },
  });

  assert.equal(result.summary.deployment_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.desktop_read_authority.deployment_allowed_now, false);
  assert.equal(result.desktop_read_authority.production_pass_enabled, false);
  assert.equal(result.desktop_read_authority.unsafe_flag_count, 0);
  assert.equal(result.source_rows[0].status, "ready");
});

test("desktop read model loader reads the repository artifact shape when present", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-loader-"));
  const artifactDir = path.join(tmpDir, "artifacts", "desktop-read-model", "latest");
  try {
    await writeFileTree(path.join(artifactDir, "desktop-read-model.json"), JSON.stringify({
      schema_version: "desktop-read-model.v1",
      generated_at: "2026-06-14T00:00:00.000Z",
      summary: {
        desktop_read_model_status: "ready_for_desktop_shell",
        source_count: 1,
        ready_source_count: 1,
        section_count: 1,
        ready_section_count: 1,
        operator_handbook_bound: true,
        authority_boundary_ready: true,
        validation_error_count: 0,
      },
      source_rows: [],
      sections: [],
      screen_map: [],
      desktop_read_authority: {
        read_only: true,
        ready_for_desktop_shell: true,
      },
    }, null, 2));

    const result = await loadDesktopReadModel({ repoRoot: tmpDir });
    assert.equal(result.summary.desktop_read_model_status, "ready_for_desktop_shell");
    assert.equal(result.summary.operator_handbook_bound, true);
    assert.equal(result.desktop_read_authority.ready_for_desktop_shell, true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

async function writeFileTree(filePath, content) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
