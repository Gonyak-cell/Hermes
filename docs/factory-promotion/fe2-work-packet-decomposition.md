# FE.2 Work Packet Decomposition

Status: ready with LawOS-style Claude Opus 4.8 Max review evidence.

## Scope

FE.2 consumes FE.1 `factory_prd_tuw_seed_rows` and creates source-bound work
packet candidates for the Hermes Enterprise SaaS PRD. It is still a planning and
decomposition surface. It does not execute work packets, run commands, write
repositories, open G-series gates, call connectors, deploy, or grant production
or enterprise trust.

The command is:

```bash
npm run factory:work-packet-decomposition -- --check --require-pass
```

## Output Contract

The command writes, outside `--check` mode:

- `artifacts/factory-work-packet-decomposition/latest/factory-work-packet-decomposition.json`
- `artifacts/factory-work-packet-decomposition/latest/work-packet-candidate-rows.json`
- `artifacts/factory-work-packet-decomposition/latest/work-item-candidate-rows.json`
- `artifacts/factory-work-packet-decomposition/latest/dependency-rows.json`
- `artifacts/factory-work-packet-decomposition/latest/candidate-bundle.json`
- `artifacts/factory-work-packet-decomposition/latest/negative-fixture-rows.json`
- `artifacts/factory-work-packet-decomposition/latest/boundary.json`
- `artifacts/factory-work-packet-decomposition/latest/validation-items.json`
- `artifacts/factory-work-packet-decomposition/latest/summary.md`

Each work packet candidate is locked to one FE.1 source span through
`source_tuw_seed_id`, `source_requirement_row_id`, `source_span_id`,
`source_sha256`, and `source_span_sha256`. Each packet expands into four work
item candidates:

- `contract_slice`
- `implementation_slice`
- `verification_slice`
- `review_gate_slice`

## Local Evidence

Current local run:

- status: `ready_factory_work_packet_decomposition`
- source program range: `FCORE-FE.1`
- source PRD SHA-256:
  `1ee0a4f1ef32a204ab790962f54afa81837d550baed284f5b505a8676aa55471`
- source TUW seed rows: 15
- work packet candidates: 15
- work item candidates: 60
- dependency rows: 14
- candidate bundle SHA-256:
  `5d6992666a0b43ab45bc5601d01c4622bb847799458ff0c7cf73f693c4a67470`
- raw PRD text leak scan: `ready_no_raw_prd_text_leak_detected`
- raw text leak scan modes:
  `raw_substring`, `json_escaped_raw_substring`,
  `normalized_high_entropy_field_substring`
- raw text leak scan coverage:
  485 source-line probes, 206 normalized probes, 2,144 string fields
- negative fixtures blocked: 6/6
- validation errors: 0

## Negative Fixtures

FE.2 blocks:

- FE.1 PRD intake not ready
- TUW seed source span hash missing
- duplicate work packet candidate ids
- command/work-packet execution flag opened
- raw PRD text exposure
- dependency row pointing to a missing work packet id

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

FE.3 may consume the candidate bundle to instantiate product-specific validation
loop candidates. FE.3 must keep loop execution closed unless a later G-series
gate-opening commit and human owner receipt explicitly open the relevant scope.

## Independent Review

The final LawOS-style Claude Opus 4.8 Max guard returned `APPROVE` with no
P0/P1/P2/P3 findings. The review confirmed `FE2-FF-P3-03` fixed after the
raw-text leak scan hardening and reconfirmed the earlier FE.2 findings as fixed.

Receipt: [fe2-claude-opus-4-8-review-receipt.md](fe2-claude-opus-4-8-review-receipt.md)
