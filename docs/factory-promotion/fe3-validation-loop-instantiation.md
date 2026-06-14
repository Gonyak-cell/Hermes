# FE.3 Validation Loop Instantiation

Status: ready with LawOS-style Claude Opus 4.8 Max review evidence.

## Scope

FE.3 consumes FE.2 `factory_work_packet_candidate_rows` and instantiates
product-scoped P9801-P10000 validation loop candidates for each source-bound
work packet. It is still a candidate and planning surface. It does not execute
validation loops, run worker lanes, grant verifier finality, run commands, write
repositories, open G-series gates, call connectors, deploy, or grant production
or enterprise trust.

The command is:

```bash
npm run factory:validation-loop-instantiation -- --check --require-pass
```

## Output Contract

The command writes, outside `--check` mode:

- `artifacts/factory-validation-loop-instantiation/latest/factory-validation-loop-instantiation.json`
- `artifacts/factory-validation-loop-instantiation/latest/validation-loop-candidate-rows.json`
- `artifacts/factory-validation-loop-instantiation/latest/validation-loop-step-candidate-rows.json`
- `artifacts/factory-validation-loop-instantiation/latest/validation-loop-gate-rows.json`
- `artifacts/factory-validation-loop-instantiation/latest/candidate-bundle.json`
- `artifacts/factory-validation-loop-instantiation/latest/negative-fixture-rows.json`
- `artifacts/factory-validation-loop-instantiation/latest/boundary.json`
- `artifacts/factory-validation-loop-instantiation/latest/validation-items.json`
- `artifacts/factory-validation-loop-instantiation/latest/summary.md`

Each validation loop candidate is locked to one product, one FE.2 work packet,
and one FE.1 source span through `product_id`, `source_work_packet_candidate_id`,
`source_requirement_row_id`, `source_span_id`, `source_sha256`, and
`source_span_sha256`.

Each candidate expands into ten P9801-P10000 step candidates:

- `P9801-P9820` source binding
- `P9821-P9840` feature packet registry
- `P9841-P9860` test evidence binding
- `P9861-P9880` review packet generator
- `P9881-P9900` Claude review receipt intake
- `P9901-P9920` finding normalization
- `P9921-P9940` revalidation evidence binding
- `P9941-P9960` closeout readiness gate
- `P9961-P9980` build verification API projection
- `P9981-P10000` freeze

## Local Evidence

Current local run:

- status: `ready_factory_validation_loop_instantiation`
- source program range: `FCORE-FE.2`
- source candidate bundle SHA-256:
  `5d6992666a0b43ab45bc5601d01c4622bb847799458ff0c7cf73f693c4a67470`
- product scope: `project.hermes_harness`
- source work packet candidates: 15
- validation loop candidates: 15
- validation loop step candidates: 150
- validation loop gate rows: 90
- candidate bundle SHA-256:
  `bf8b55650093869af78e0b2b4718ad740dff6921747e2819666395ee8cef8f1a`
- raw PRD text guard: `ready_no_raw_prd_text_leak_detected`
- raw text guard coverage:
  1,282 source-line probes, 581 normalized probes, 3,893 string fields
- negative fixtures blocked: 6/6
- validation errors: 0

Gate rows intentionally represent the same loop candidate surface, but each
`gate_key` now evaluates its own `evaluated_checks` object. This keeps FE.3
candidate-only while avoiding ambiguous all-gates-share-one-check evidence.

## Negative Fixtures

FE.3 blocks:

- FE.2 work packet decomposition not ready
- missing product scope
- cross-product requirement reference
- missing P9801-P10000 loop step coverage
- validation loop or worker execution flag opened
- verifier finality flag opened
- raw PRD body text leaked into propagated FE.3 candidate fields (unit test)

## Authority Boundary

The following remain false in rows, boundary, and summary:

- `project_creation_allowed_now`
- `review_decision_allowed_now`
- `approval_allowed_now`
- `apply_allowed_now`
- `command_execution_enabled`
- `command_execution_allowed_now`
- `work_packet_execution_allowed_now`
- `work_item_execution_allowed_now`
- `validation_loop_execution_allowed_now`
- `worker_execution_allowed_now`
- `verifier_finality_allowed_now`
- `codex_final_approval_allowed_now`
- `claude_final_approval_allowed_now`
- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`
- `gate_opening_allowed_now`
- `g1a_project_creation_gate_open_now`
- `g1b_repo_write_gate_open_now`
- `g2_command_execution_gate_open_now`
- `g3_deployment_gate_open_now`

## Handoff

FE.4 may freeze the FE.1-FE.3 intake/decomposition/loop-candidate chain and
prepare the final FE review packet. FE.4 still must not execute validation loops
or open command/write/deploy/finality authority unless a later G-series
gate-opening commit and human owner receipt explicitly open the relevant scope.

## Independent Review

The first LawOS-style Claude Opus 4.8 Max review returned
`APPROVE_WITH_FINDINGS` with two non-blocking P3 findings:

- `FE3-P3-01`: gate rows shared one opaque loop-level readiness check
- `FE3-P3-02`: FE.3 had no self-contained raw PRD text guard

Codex remediated those findings by adding gate-specific `evaluated_checks`, a
FE.3 raw-text guard, and a regression test that injects raw PRD body text into a
FE.2 packet title and expects FE.3 to block. The follow-up Opus 4.8 Max guard
returned `APPROVE` with no findings and confirmed both P3 findings fixed.

Receipt: [fe3-claude-opus-4-8-review-receipt.md](fe3-claude-opus-4-8-review-receipt.md)
