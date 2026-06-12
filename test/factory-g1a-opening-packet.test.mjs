import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryG1aOpeningPacket,
  runFactoryG1aOpeningPacket,
} from "../src/factory-g1a-opening-packet.mjs";

const RUN_AT = "2026-06-12T19:00:00.000Z";

test("Factory G1a Opening Packet prepares LawOS-style review packet without opening G1a", async () => {
  const result = await buildFactoryG1aOpeningPacket({
    runAt: RUN_AT,
    write: false,
    commitRef: "0aefc2b",
  });

  assert.equal(result.schema_version, "factory-g1a-opening-packet.v1");
  assert.equal(result.program_range, "G-SERIES.1a");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_opening_packet_status, "ready_factory_g1a_opening_packet");
  assert.equal(result.summary.g0_status, "ready_factory_gate_opening_readiness");
  assert.equal(result.summary.g1a_ready_for_owner_receipt_now, true);
  assert.equal(result.summary.owner_gate_opening_receipt_template_ready, true);
  assert.equal(result.owner_gate_opening_receipt_template.receipt_kind, "gate_opening");
  assert.equal(result.owner_gate_opening_receipt_template.receipt_status, "template_not_signed");
  assert.equal(result.owner_gate_opening_receipt_template.human_owner_signed, false);
  assert.equal(result.source_literal_opening_commit_plan.plan_status, "already_applied_waiting_first_use_audit");
  assert.equal(result.source_literal_opening_commit_plan.opens_gate_now, false);
  assert.equal(result.source_literal_opening_commit_plan.source_literal_path, "SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a");
  assert.equal(result.first_use_audit_checklist.first_use_audit_present, false);
  assert.equal(result.independent_review_packet.method, "law_firm_os_style_claude_opus_4_8_max");
  assert.equal(result.independent_review_packet.read_only, true);
  assert.deepEqual(result.independent_review_packet.tools, ["Read", "Grep", "Glob"]);
  assert.equal(result.review_request.model, "claude-opus-4-8");
  assert.equal(result.review_request.opens_gate_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.factory_g1a_opening_negative_fixture_rows.every((row) => row.fixture_status === "blocked_as_expected"), true);
});

test("Factory G1a Opening Packet fails closed when G0 readiness is blocked", async () => {
  const blockedReadiness = {
    validation: { valid: false, errors: [{ item_id: "source.blocked", message: "blocked" }] },
    summary: {
      factory_gate_opening_readiness_status: "blocked_factory_gate_opening_readiness",
      gate_open_count: 0,
    },
    factory_gate_opening_readiness_rows: [
      {
        gate_id: "G1a",
        gate_status: "blocked_prerequisites_missing",
        gate_open_now: false,
        owner_gate_opening_receipt_present: false,
        source_literal_gate_open_commit_present: false,
        first_use_audit_present: false,
      },
    ],
  };

  const result = await buildFactoryG1aOpeningPacket({
    runAt: RUN_AT,
    write: false,
    commitRef: "0aefc2b",
    gateOpeningReadiness: blockedReadiness,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_g1a_opening_packet_status, "blocked_factory_g1a_opening_packet");
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.validation.errors.some((error) => error.item_id === "source.g0_readiness_ready"), true);
});

test("Factory G1a Opening Packet rejects injected open-attempt shapes", async () => {
  const baseRow = {
    gate_id: "G1a",
    gate_status: "ready_for_owner_gate_receipt_and_source_literal_commit",
    gate_open_now: false,
    owner_gate_opening_receipt_present: false,
    source_literal_gate_open_commit_present: false,
    first_use_audit_present: false,
  };
  const attempts = [
    {
      name: "data_only_open",
      row: {
        ...baseRow,
        gate_open_now: true,
      },
      valid: false,
    },
    {
      name: "unsigned_owner_receipt",
      row: {
        ...baseRow,
        owner_gate_opening_receipt_present: true,
      },
      valid: true,
    },
    {
      name: "source_plan_only",
      row: {
        ...baseRow,
        source_literal_gate_open_commit_present: true,
      },
      valid: true,
    },
  ];

  for (const attempt of attempts) {
    const result = await withPreApplySource((gateOpeningSourcePath) => buildFactoryG1aOpeningPacket({
      runAt: RUN_AT,
      write: false,
      commitRef: "0aefc2b",
      gateOpeningSourcePath,
      gateOpeningReadiness: {
        validation: { valid: true, errors: [] },
        summary: {
          factory_gate_opening_readiness_status: "ready_factory_gate_opening_readiness",
          gate_open_count: attempt.row.gate_open_now ? 1 : 0,
        },
        factory_gate_opening_readiness_rows: [attempt.row],
      },
    }));

    assert.equal(result.validation.valid, attempt.valid, attempt.name);
    assert.equal(result.summary.g1a_project_creation_gate_open_now, false, attempt.name);
    assert.equal(result.summary.project_creation_allowed_now, false, attempt.name);
    assert.equal(result.owner_gate_opening_receipt_template.receipt_status, "template_not_signed", attempt.name);
    assert.equal(result.source_literal_opening_commit_plan.opens_gate_now, false, attempt.name);
    assert.equal(result.first_use_audit_checklist.first_use_audit_present, false, attempt.name);
  }
});

test("Factory G1a Opening Packet writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-opening-packet-out-"));
  try {
    const result = await runFactoryG1aOpeningPacket({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "0aefc2b",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-opening-packet.json"), "utf8"));
    const receiptTemplate = JSON.parse(await readFile(path.join(outDir, "owner-gate-opening-receipt-template.json"), "utf8"));
    const reviewRequest = JSON.parse(await readFile(path.join(outDir, "review-request.json"), "utf8"));
    const prompt = await readFile(path.join(outDir, "review-prompt.md"), "utf8");

    assert.equal(result.summary.factory_g1a_opening_packet_status, "ready_factory_g1a_opening_packet");
    assert.equal(artifact.summary.g1a_project_creation_gate_open_now, false);
    assert.equal(receiptTemplate.receipt_status, "template_not_signed");
    assert.equal(reviewRequest.model, "claude-opus-4-8");
    assert.match(prompt, /Return JSON only/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-opening-packet-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-opening-packet.json");
    const sentinel = '{ "sentinel": "factory-g1a-opening-packet" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-opening-packet.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "0aefc2b",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes G1a opening packet as read-only packet data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-opening-packet?item_kind=owner_gate_opening_receipt_template", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_opening_packet_items");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.packet_only, true);
  assert.equal(body.opens_gate_now, false);
  assert.equal(body.count, 1);
  assert.equal(body.items[0].packet_item_id, "g1a.owner_gate_opening_receipt_template");
  assert.equal(body.owner_gate_opening_receipt_template.receipt_status, "template_not_signed");
  assert.equal(body.source_literal_opening_commit_plan.plan_status, "already_applied_waiting_first_use_audit");
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);

  const head = await buildReviewApiResponse("/api/factory/g1a-opening-packet?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-opening-packet", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = JSON.parse(denied.body);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
  }
});

async function withPreApplySource(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-pre-apply-source-"));
  try {
    const sourcePath = path.join(tempDir, "factory-gate-opening-readiness.mjs");
    await writeFile(sourcePath, [
      "const SOURCE_LITERAL_GATE_OPEN_COMMITS = {",
      "  G1a: false,",
      "  G1b: false,",
      "  G2: false,",
      "  G3: false,",
      "};",
      "const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [];",
      "const SOURCE_LITERAL_FIRST_USE_AUDITS = [];",
      "",
    ].join("\n"), "utf8");
    return await callback(sourcePath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
