# FC.5 Factory Candidate Freeze Handoff

Status: ready locally and Law Firm OS-style Claude Opus 4.8 max reviewed.
Date: 2026-06-12

## Scope

FC.5 closes the FC tranche with a deterministic freeze and FD handoff artifact:

```bash
npm run factory:candidate-freeze-handoff -- --check --require-pass
```

The artifact consumes FC.1-FC.4 evidence and proves that the candidate end of
the factory is ready for the FD tranche while keeping runtime apply/write
authority closed.

## Freeze Inputs

The freeze binds:

- FC.2 candidate lane proof: 3 candidate packets, 3 diff packets, 3 rollback
  plans, 3 preflight rows, and 3 candidate hash-ledger rows
- FC.3 candidate review docket: 3 docket rows, 3 review packets, 3 review
  hash-register rows, and negative fixture rows
- FC.4 Review API smoke: `/api/factory/candidate-review-docket?limit=1`
- FC.1-FC.4 Claude review evidence status from
  `docs/factory-promotion/99-structured-summary.json`
- docs for the FC.4 route and review-only authority boundary
- the reserved FD validation command:
  `npm run factory:receipt-verify -- --check`

## Canonical Run Hash Register

FC.5 writes a chained canonical run hash register over:

- FC.2 proof summary
- FC.3 docket summary
- FC.4 API smoke summary
- FC.1-FC.4 review evidence vector
- FC authority boundary vector
- structured summary FC status vector

These hashes are run-scoped evidence. They are meant to freeze the local
candidate surface that FD consumes, not to grant apply authority.

## FD Handoff Boundary

`fd_implementation_handoff_allowed_now` can be true only when every FC exit row,
canonical hash row, and FD handoff gate is ready. These remain false:

- `review_decision_allowed_now`
- `approval_allowed_now`
- `apply_allowed_now`
- `fd_runtime_apply_enabled_now`
- `apply_engine_runtime_enabled_now`
- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- production PASS and enterprise PASS

FC.5 may hand off implementation work to FD. It does not enable runtime apply,
write, deploy, protected action, production, or enterprise trust.

## Negative Fixtures

The blocked-source fixture keeps a blocked FC.3 review docket as a valid visible
handoff blocker. In that state validation remains structurally valid, but
`fd_implementation_handoff_allowed_now` is false and `--require-pass` rejects
the artifact.

`--check` does not overwrite existing artifacts.

## Claude Review Receipt

FC.5 has a valid Law Firm OS-style Claude Opus 4.8 max read-only review:

- receipt doc: `docs/factory-promotion/fc5-claude-opus-4-8-review-receipt.md`
- raw artifact:
  `artifacts/factory-promotion/fc5-review-lawos-style-final-retry-2/raw-output.json`
- normalized receipt:
  `artifacts/factory-promotion/fc5-review-lawos-style-final-retry-2/review-receipt.json`
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 findings: 0
- final P3 finding: 1, fixed after review
- rejected invalid attempts: two API 529 overloaded runs, not counted as review
  evidence

Claude is independent review evidence only. It is not final owner approval and
does not grant runtime apply/write/deploy, protected action, production, or
enterprise authority.

## Verification

```bash
node --check src/factory-candidate-freeze-handoff.mjs
node --check scripts/factory-candidate-freeze-handoff.mjs
node --test test/factory-candidate-freeze-handoff.test.mjs
npm run factory:candidate-freeze-handoff -- --check --require-pass
git diff --check
```

Observed local result before Claude review:

- FC.5 targeted tests: 4/4 pass
- freeze command: ready, 3 candidate packets, 10/10 FC evidence rows, 6
  canonical hash rows, FD handoff allowed true
- approval/apply/write/deploy/trust: false
- validation errors: 0
