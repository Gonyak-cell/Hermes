import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopDagTopology,
  runHermesLoopDagTopology,
} from "../src/hermes-loop-dag-topology.mjs";
import { buildHermesLoopContextMemoryGrounding } from "../src/hermes-loop-context-memory-grounding.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P62400 projects bounded DAG and worker verifier topology while keeping runtime closed", async () => {
  const result = await buildHermesLoopDagTopology({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-dag-topology.v1");
  assert.equal(result.program_range, "P62001-P62400");
  assert.equal(result.source_program_range, "P61601-P62000");
  assert.equal(result.next_program_range, "P62401-P62800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_dag_topology_status, "ready_for_p62401_handoff");
  assert.equal(result.summary.p62000_source_ready_now, true);
  assert.equal(result.summary.p62400_contract_ready, true);
  assert.equal(result.dag_topology_contract_rows.length, 12);
  assert.equal(result.dag_node_contract_rows.length, 12);
  assert.equal(result.worker_verifier_separation_rows.length, 7);
  assert.equal(result.correction_retry_budget_rows.length, 9);
  assert.equal(result.terminal_stop_node_rows.length, 6);
  assert.equal(result.summary.dag_runtime_execution_allowed_now, false);
  assert.equal(result.summary.worker_runtime_execution_allowed_now, false);
  assert.equal(result.summary.verifier_runtime_execution_allowed_now, false);
  assert.equal(result.summary.retry_execution_allowed_now, false);
  assert.equal(result.summary.source_mutation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P62000 source blocks P62400 topology", async () => {
  const sourceContextMemory = await buildHermesLoopContextMemoryGrounding({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceContextMemory.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceContextMemory.summary.ready_for_p62001_handoff = false;

  const result = await buildHermesLoopDagTopology({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceContextMemory,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_dag_topology_status, "blocked_hermes_loop_dag_topology");
  assert.equal(result.hermes_loop_dag_topology_boundary.p62000_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p62000"));
});

test("missing DAG node dependency blocks P62400 closeout", async () => {
  const result = await buildHermesLoopDagTopology({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitNodeField: "node dependency",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.dag_nodes"));
  assert.equal(result.dag_node_contract_rows.some((row) => row.marker === "node dependency"), false);
});

test("missing worker verifier separation blocks P62400 closeout", async () => {
  const result = await buildHermesLoopDagTopology({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitWorkerVerifierRow: "worker_no_final",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.worker_verifier"));
});

test("missing correction retry budget row blocks P62400 closeout", async () => {
  const result = await buildHermesLoopDagTopology({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitCorrectionRow: "correction_consumes_retry_budget",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.correction_retry_budget"));
});

test("unsafe worker runtime authority blocks P62400 closeout", async () => {
  const result = await buildHermesLoopDagTopology({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      worker_runtime_execution_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_dag_topology_boundary.worker_runtime_execution_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing DAG topology artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-dag-topology-"));
  try {
    const result = await runHermesLoopDagTopology({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-dag-topology.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
