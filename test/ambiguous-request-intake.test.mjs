import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  AMBIGUOUS_REQUEST_INTAKE_FALSE_FLAGS,
  buildAmbiguousRequestIntake,
  runAmbiguousRequestIntake,
} from "../src/ambiguous-request-intake.mjs";
import { buildReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage } from "../src/receipt-workbench-operator-queue-static-shell-implementation-handoff-package.mjs";

const RUN_AT = "2026-06-08T00:23:41.628Z";

test("P31600 opens clarifying question engine handoff when P31200 source is ready", async () => {
  const source = await buildP31200Source({ ready: true });
  const result = await buildAmbiguousRequestIntake({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "ambiguous-request-intake.v1");
  assert.equal(result.program_range, "P31201-P31600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.ambiguous_request_intake_status, "ready_for_ambiguous_request_intake");
  assert.equal(result.summary.ready_for_clarifying_question_engine, true);
  assert.equal(result.ambiguous_request_intake_rows.length, 3);
  assert.equal(result.intent_parser_rows.length, 3);
  assert.ok(result.task_type_registry_rows.length >= 8);
  assert.equal(result.spec_schema_selector_rows.length, 3);
  assert.equal(result.slot_clarity_scoring_rows.length, 45);
  assert.equal(result.ambiguity_threshold_policy_rows.length, 3);
  assert.equal(result.no_authority_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_authority_boundary_rows.length >= 300);
  assert.equal(result.ambiguous_request_intake_boundary.p31600_contract_ready, true);
  assert.equal(result.ambiguous_request_intake_boundary.ready_for_clarifying_question_engine, true);

  for (const flag of AMBIGUOUS_REQUEST_INTAKE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.ambiguous_request_intake_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P31600 remains a valid visible block when P31200 source handoff is not ready", async () => {
  const source = await buildP31200Source({ ready: false });
  const result = await buildAmbiguousRequestIntake({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.ambiguous_request_intake_status, "valid_block_ambiguous_request_intake_pending");
  assert.equal(result.summary.source_p31200_ready_for_p31201_handoff, false);
  assert.equal(result.summary.ready_for_clarifying_question_engine, false);
  assert.equal(result.ambiguous_request_intake_boundary.p31600_contract_ready, true);
  assert.equal(result.ambiguous_request_intake_boundary.ready_for_clarifying_question_engine, false);
  assert.equal(result.p31600_clean_checkpoint_rows.find((row) => row.row_id === "p31600_checkpoint.clarifying_question_engine_blocker_visible").current_verdict, "pass");
});

test("ambiguous and protected prompts require clarification while direct execution remains closed", async () => {
  const source = await buildP31200Source({ ready: true });
  const result = await buildAmbiguousRequestIntake({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  const vague = result.ambiguity_threshold_policy_rows.find((row) => row.request_id === "prompt.vague_feature");
  const protectedAction = result.ambiguity_threshold_policy_rows.find((row) => row.request_id === "prompt.protected_release");
  assert.equal(vague.clarification_required, true);
  assert.equal(protectedAction.clarification_required, true);
  assert.equal(protectedAction.risk_tier, "high");
  assert.equal(protectedAction.protected_action_mentioned, true);
  assert.ok(result.ambiguity_threshold_policy_rows.every((row) => row.direct_execution_allowed_now === false));
  assert.ok(result.ambiguous_request_intake_rows.every((row) => row.execution_allowed_now === false));
});

test("slot clarity rows link every prompt to generic specification slots and keep raw prompt exposure closed", async () => {
  const source = await buildP31200Source({ ready: true });
  const result = await buildAmbiguousRequestIntake({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.ok(result.ambiguous_request_intake_rows.every((row) => row.raw_prompt_persisted === false));
  assert.ok(result.ambiguous_request_intake_rows.every((row) => row.raw_prompt_exposed === false));
  assert.ok(result.slot_clarity_scoring_rows.every((row) => [0, 0.25, 0.5, 0.75, 1].includes(row.clarity_score)));
  assert.ok(result.slot_clarity_scoring_rows.every((row) => row.clarity_score >= 0 && row.clarity_score <= 1));
  assert.ok(result.slot_clarity_scoring_rows.every((row) => row.slot_weight > 0));
  assert.ok(result.slot_clarity_scoring_rows.some((row) => row.request_id === "prompt.vague_feature" && row.missing_or_ambiguous === true));
  assert.ok(result.spec_schema_selector_rows.every((row) => row.required_slots.length > 0));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.ambiguous_request_intake_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing ambiguous request intake artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p31600-"));
  try {
    const source = await buildP31200Source({ ready: true });
    const result = await runAmbiguousRequestIntake({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "ambiguous-request-intake.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP31200Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p31201_handoff = ready;
  source.summary.source_p30800_ready_for_p30801_handoff = true;
  source.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_boundary.ready_for_p31201_handoff = ready;
  source.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_boundary.source_p30800_ready_for_p30801_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
