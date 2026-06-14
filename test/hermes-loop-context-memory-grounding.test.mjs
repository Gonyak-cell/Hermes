import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopContextMemoryGrounding,
  runHermesLoopContextMemoryGrounding,
} from "../src/hermes-loop-context-memory-grounding.mjs";
import { buildHermesLoopRunLedgerProjection } from "../src/hermes-loop-run-ledger-projection.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P62000 grounds context, citations, memory candidates, and raw body guards", async () => {
  const result = await buildHermesLoopContextMemoryGrounding({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-context-memory-grounding.v1");
  assert.equal(result.program_range, "P61601-P62000");
  assert.equal(result.source_program_range, "P61201-P61600");
  assert.equal(result.next_program_range, "P62001-P62400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_context_memory_status, "ready_for_p62001_handoff");
  assert.equal(result.summary.p61600_source_ready_now, true);
  assert.equal(result.summary.p62000_contract_ready, true);
  assert.equal(result.context_bundle_contract_rows.length, 12);
  assert.equal(result.citation_source_span_binding_rows.length, 7);
  assert.equal(result.memory_operation_candidate_rows.length, 8);
  assert.equal(result.stale_conflict_domain_guard_rows.length, 7);
  assert.equal(result.raw_body_non_exposure_rows.length, 5);
  assert.equal(result.summary.raw_full_body_exposure_allowed_now, false);
  assert.equal(result.summary.runtime_recall_truth_allowed_now, false);
  assert.equal(result.summary.auto_context_mutation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P61600 source blocks context memory grounding", async () => {
  const sourceRunLedger = await buildHermesLoopRunLedgerProjection({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceRunLedger.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceRunLedger.summary.ready_for_p61601_handoff = false;

  const result = await buildHermesLoopContextMemoryGrounding({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceRunLedger,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_context_memory_status, "blocked_hermes_loop_context_memory_grounding");
  assert.equal(result.hermes_loop_context_memory_boundary.p61600_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p61600"));
});

test("missing context field blocks P62000 closeout", async () => {
  const result = await buildHermesLoopContextMemoryGrounding({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitContextField: "citation map",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.context"));
  assert.equal(result.context_bundle_contract_rows.some((row) => row.marker === "citation map"), false);
});

test("missing raw exposure row blocks P62000 closeout", async () => {
  const result = await buildHermesLoopContextMemoryGrounding({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitRawExposureRow: "raw_full_source_body_false",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.raw_exposure"));
});

test("unsafe raw body authority blocks P62000 closeout", async () => {
  const result = await buildHermesLoopContextMemoryGrounding({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      raw_full_body_exposure_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_context_memory_boundary.raw_full_body_exposure_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing context memory artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-context-memory-"));
  try {
    const result = await runHermesLoopContextMemoryGrounding({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-context-memory-grounding.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
