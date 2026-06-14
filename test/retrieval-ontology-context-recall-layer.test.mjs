import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildRetrievalOntologyContextRecallLayer,
  runRetrievalOntologyContextRecallLayer,
} from "../src/retrieval-ontology-context-recall-layer.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildRetrievalOntologyContextRecallLayer({ runAt: RUN_AT, write: false });

test("retrieval ontology context recall consumes the memory event plane", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.retrieval_ontology_context_recall_layer_status, "ready_for_retrieval_ontology_context_recall_layer_v0");
  assert.equal(result.program_range, "P7301-P7600");
  assert.equal(result.summary.memory_bank_event_observability_plane_status, "ready_for_memory_bank_event_observability_plane_v0");
});

test("retrieval ontology context recall covers all P7301-P7600 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.retrieval_ontology_context_recall_phase_rows.map((row) => row.phase_range));

  assert.equal(result.retrieval_ontology_context_recall_phase_rows.length, 10);
  for (const phase of ["P7301-P7330", "P7331-P7360", "P7361-P7390", "P7391-P7420", "P7421-P7450", "P7451-P7480", "P7481-P7510", "P7511-P7540", "P7541-P7570", "P7571-P7600"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.retrieval_ontology_context_recall_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("retrieval ontology context recall requires the Codex-Harness-Claude review process", async () => {
  const result = await resultPromise;
  const contract = result.retrieval_ontology_context_recall_contract;
  const boundary = result.retrieval_ontology_context_recall_boundary;
  const bundle = result.next_session_recall_bundle_rows[0];

  assert.equal(contract.codex_implementation_packet_required, true);
  assert.equal(contract.harness_deterministic_validation_required, true);
  assert.equal(contract.claude_code_opus_max_review_receipt_required, true);
  assert.equal(contract.finding_loop_and_revalidation_required, true);
  assert.equal(contract.review_receipt_registration_required, true);
  assert.equal(contract.single_owner_trust_classification_required, true);
  assert.equal(boundary.claude_code_opus_max_review_receipt_required, true);
  assert.equal(bundle.claude_code_opus_max_review_receipt_required_for_milestone, true);
  assert.equal(bundle.codex_self_approval_allowed, false);
  assert.equal(bundle.claude_final_approval_allowed, false);
});

test("retrieval ontology context recall builds cited ontology, search, and fact recall rows", async () => {
  const result = await resultPromise;

  assert.equal(result.retrieval_ontology_rows.length, 5);
  assert.equal(result.retrieval_ontology_rows.every((row) => row.source_citation_required), true);
  assert.equal(result.source_cited_search_rows.length, 5);
  assert.equal(result.source_cited_search_rows.every((row) => row.uncited_search_result_allowed === false), true);
  assert.equal(result.extracted_fact_claim_recall_rows.length, 5);
  assert.equal(result.extracted_fact_claim_recall_rows.every((row) => row.truth_claim_without_review_allowed === false), true);
});

test("retrieval ontology context recall preserves conflict, boundary, and staleness controls", async () => {
  const result = await resultPromise;

  assert.equal(result.consolidation_conflict_resolution_rows.every((row) => row.hidden_conflict_allowed === false), true);
  assert.equal(result.relation_graph_context_compiler_rows.every((row) => row.cross_domain_relation_requires_boundary_check), true);
  assert.equal(result.domain_project_boundary_filter_rows.length, 4);
  assert.equal(result.domain_project_boundary_filter_rows.every((row) => row.cross_domain_recall_allowed === false), true);
  assert.equal(result.staleness_freshness_policy_rows.every((row) => row.stale_fact_as_current_allowed === false), true);
});

test("retrieval ontology context recall negative fixtures block unsafe recall claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.recall_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.recall_negative_fixture_rows.length, 8);
  for (const fixture of ["negative.uncited_recall", "negative.raw_transcript_recall", "negative.stale_fact_as_current", "negative.cross_domain_recall", "negative.conflict_hidden", "negative.missing_claude_review_receipt", "negative.auto_context_mutation", "negative.recall_as_final_approval"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.recall_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.recall_negative_fixture_rows.every((row) => row.unsafe_recall_claim_allowed === false), true);
});

test("retrieval ontology context recall remains no-auto-mutation, no-human, no-enterprise, and no-Work-OS", async () => {
  const result = await resultPromise;
  const boundary = result.retrieval_ontology_context_recall_boundary;

  assert.equal(boundary.retrieval_ontology_context_recall_layer_ready, true);
  assert.equal(boundary.next_session_recall_bundle_ready, true);
  assert.equal(boundary.uncited_recall_allowed, false);
  assert.equal(boundary.raw_transcript_recall_allowed, false);
  assert.equal(boundary.stale_fact_as_current_allowed, false);
  assert.equal(boundary.cross_domain_recall_allowed, false);
  assert.equal(boundary.auto_context_mutation_enabled, false);
  assert.equal(boundary.recall_as_final_approval_enabled, false);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("retrieval ontology context recall --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "retrieval-ontology-context-recall-layer-"));
  const sentinelPath = path.join(outDir, "retrieval-ontology-context-recall-layer.json");
  const sentinel = "{ \"sentinel\": \"retrieval-ontology-context-recall-layer\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runRetrievalOntologyContextRecallLayer({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
