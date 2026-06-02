import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildZenddActualCheckoutPreflight,
  runZenddActualCheckoutPreflight,
} from "../src/zendd-actual-checkout-preflight.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("zendd actual checkout preflight identifies the external checkout without mutation", async () => {
  const result = await buildZenddActualCheckoutPreflight({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.zendd_actual_checkout_preflight_status, "ready_for_zendd_actual_checkout_preflight");
  assert.equal(result.actual_checkout_identity.project_id, "project.zendd");
  assert.equal(result.actual_checkout_identity.project_root_exists, true);
  assert.equal(result.actual_checkout_identity.source_of_truth, "external_zendd_checkout");
  assert.equal(result.actual_checkout_identity.actual_checkout_mutation_allowed_now, false);
  assert.equal(result.actual_checkout_read_only_probe.checkout_mutation_performed, false);
  assert.equal(result.actual_checkout_read_only_probe.protected_command_executed, false);
  assert.equal(result.actual_checkout_read_only_probe.dirty_path_values_stored, false);

  const requiredMarkers = result.actual_checkout_stack_inventory_rows.filter((row) => row.required_marker);
  assert.ok(requiredMarkers.length >= 8);
  assert.equal(requiredMarkers.every((row) => row.current_verdict === "pass"), true);
  assert.ok(result.actual_checkout_stack_inventory_rows.some((row) => row.stack_marker_id === "backend_alembic_ini"));
  assert.ok(result.actual_checkout_stack_inventory_rows.some((row) => row.stack_marker_id === "backend_migrations"));
});

test("zendd actual checkout preflight blocks commands, protected actions, raw surfaces, and secrets", async () => {
  const result = await buildZenddActualCheckoutPreflight({ runAt: RUN_AT, write: false });

  assert.ok(result.actual_checkout_command_candidate_rows.some((row) => row.command_candidate_id === "frontend.test"));
  assert.ok(result.actual_checkout_command_candidate_rows.some((row) => row.command_candidate_id === "backend.pytest"));
  assert.equal(result.actual_checkout_command_candidate_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.actual_checkout_command_candidate_rows.every((row) => row.command_execution_allowed_now === false), true);

  assert.ok(result.actual_checkout_protected_action_rows.some((row) => row.action_class === "database_migration"));
  assert.equal(result.actual_checkout_protected_action_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.actual_checkout_protected_action_rows.every((row) => row.human_receipt_ref), true);
  assert.equal(result.actual_checkout_protected_action_rows.every((row) => row.action_execution_allowed_now === false), true);

  assert.equal(result.actual_checkout_boundary_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.actual_checkout_boundary_rows.every((row) => row.content_read_performed === false), true);
  assert.equal(result.actual_checkout_boundary_rows.every((row) => row.raw_payload_stored === false), true);
  assert.equal(result.summary.command_execution_allowed_now, false);
  assert.equal(result.summary.raw_material_copy_allowed_now, false);
  assert.equal(result.summary.secret_read_allowed_now, false);
  assert.ok(result.summary.blocked_claim_count > result.summary.pass_claim_count);
});

test("zendd actual checkout preflight --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "zendd-actual-preflight-"));
  const sentinelPath = path.join(outDir, "zendd-actual-checkout-preflight.json");
  const sentinel = "{ \"sentinel\": \"zendd-actual-checkout-preflight\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runZenddActualCheckoutPreflight({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
