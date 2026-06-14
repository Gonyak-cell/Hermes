import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryF0ReviewDispatchPacket,
  runFactoryF0ReviewDispatchPacket,
} from "../src/factory-f0-review-dispatch-packet.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const HEAD_SHA = "f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7";

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    gitState: {
      head_sha: HEAD_SHA,
      branch: "codex/p3840-review-hardening",
      clean: true,
      dirty_paths: [],
    },
    ...overrides,
  };
}

test("Factory F0 Review Dispatch Packet is ready when doctor passes and git state is clean", async () => {
  const result = await buildFactoryF0ReviewDispatchPacket(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-f0-review-dispatch-packet.v1");
  assert.equal(result.summary.factory_f0_review_dispatch_packet_status, "ready_f0_review_dispatch_packet");
  assert.equal(result.summary.f0_review_dispatch_packet_ready, true);
  assert.equal(result.summary.review_request_doctor_passed, true);
  assert.equal(result.summary.worktree_clean, true);
  assert.equal(result.dispatch_packet.dispatch_ready, true);
  assert.equal(result.dispatch_packet.reviewed_commit_sha, HEAD_SHA);
  assert.equal(result.dispatch_packet.requests.length, 2);
  assert.equal(result.dispatch_packet.requests.every((request) => request.reviewed_commit_sha === HEAD_SHA), true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory F0 Review Dispatch Packet blocks dispatch on dirty worktree without schema failure", async () => {
  const result = await buildFactoryF0ReviewDispatchPacket(options({
    gitState: {
      head_sha: HEAD_SHA,
      branch: "codex/p3840-review-hardening",
      clean: false,
      dirty_paths: [" M package.json", "?? src/new-file.mjs"],
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_f0_review_dispatch_packet_status, "blocked_f0_review_dispatch_packet");
  assert.equal(result.summary.f0_review_dispatch_packet_ready, false);
  assert.equal(result.summary.worktree_clean, false);
  assert.equal(result.summary.dirty_path_count, 2);
  assert.deepEqual(result.summary.blocked_row_ids, ["git.clean"]);
});

test("Factory F0 Review Dispatch Packet blocks when request doctor is not passed", async () => {
  const result = await buildFactoryF0ReviewDispatchPacket(options({
    reviewRequestDoctor: {
      summary: { f0_review_request_doctor_passed: false },
      source_refs: { prompt_paths: [] },
      review_request_rows: [],
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.f0_review_dispatch_packet_ready, false);
  assert.equal(result.summary.review_request_doctor_passed, false);
  assert.equal(result.summary.blocked_row_ids.includes("doctor.passed"), true);
  assert.equal(result.summary.blocked_row_ids.includes("requests.count"), true);
});

test("Factory F0 Review Dispatch Packet --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-f0-review-dispatch-packet-"));
  const sentinelPath = path.join(outDir, "factory-f0-review-dispatch-packet.json");
  const sentinel = "{ \"sentinel\": \"factory-f0-review-dispatch-packet\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFactoryF0ReviewDispatchPacket(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory F0 Review Dispatch Packet --require-pass rejects dirty worktree", async () => {
  await assert.rejects(
    () => runFactoryF0ReviewDispatchPacket(options({
      requirePass: true,
      gitState: {
        head_sha: HEAD_SHA,
        branch: "codex/p3840-review-hardening",
        clean: false,
        dirty_paths: [" M package.json"],
      },
    })),
    /not ready/,
  );
});
