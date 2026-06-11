# FE.1 PRD Intake Source Binding

Status: ready with LawOS-style Claude Opus 4.8 Max review evidence.

## Scope

FE.1 starts the FCORE FE tranche by binding the target PRD source
`docs/hermes-enterprise-saas-specification.md` into deterministic factory intake
rows. It does not create projects, open G-series gates, execute commands, write
repositories, apply candidates, call connectors, deploy, or grant production or
enterprise trust.

The command is:

```bash
npm run factory:prd-intake -- --check --require-pass
```

## Output Contract

The command writes, outside `--check` mode:

- `artifacts/factory-prd-intake/latest/factory-prd-intake.json`
- `artifacts/factory-prd-intake/latest/source-span-rows.json`
- `artifacts/factory-prd-intake/latest/requirement-rows.json`
- `artifacts/factory-prd-intake/latest/tuw-seed-rows.json`
- `artifacts/factory-prd-intake/latest/negative-fixture-rows.json`
- `artifacts/factory-prd-intake/latest/boundary.json`
- `artifacts/factory-prd-intake/latest/validation-items.json`
- `artifacts/factory-prd-intake/latest/summary.md`

The artifact intentionally does not persist the raw PRD text. It stores source
path, document hash, line spans, span hashes, requirement rows, and TUW seed rows
so FE.2 can decompose work packets without losing source provenance.

FE.1 validation rows use `current_verdict: pass | block`. This mirrors the
factory intake/gate row style for operator-facing blocked states; aggregate
contract-suite rows may continue to use `passed | failed` and should normalize
verdict vocabulary at the consumer boundary.

## Local Evidence

Current local run:

- status: `ready_factory_prd_intake`
- source program range: `FCORE-FD.5`
- PRD source SHA-256:
  `1ee0a4f1ef32a204ab790962f54afa81837d550baed284f5b505a8676aa55471`
- source spans: 100
- functional requirement rows: 15
- TUW seed rows: 15
- negative fixtures blocked: 5/5
- validation errors: 0

## Negative Fixtures

FE.1 blocks:

- missing PRD source
- empty PRD source
- expected source hash mismatch
- missing functional requirement sections
- command execution attempts before G2 gate opening

## Authority Boundary

The following remain false in rows, boundary, and summary:

- `project_creation_allowed_now`
- `review_decision_allowed_now`
- `approval_allowed_now`
- `apply_allowed_now`
- `command_execution_enabled`
- `command_execution_allowed_now`
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

FE.2 may consume `factory_prd_tuw_seed_rows` to create bounded work-packet
candidate rows. FE.2 must keep each work packet bound to exactly one source span
or explicitly record a composite source binding. FE.2 still must not execute the
work packets unless the relevant G-series gate has been opened through the
separate gate-opening program.
