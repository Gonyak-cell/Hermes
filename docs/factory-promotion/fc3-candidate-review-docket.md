# FC.3 Factory Candidate Review Docket

Status: ready locally and Law Firm OS-style Claude Opus 4.8 max reviewed.
Date: 2026-06-12

## Scope

FC.3 adds the deterministic candidate review docket:

```bash
npm run factory:candidate-review-docket -- --check --require-pass
```

The docket consumes the FC.2 proof scenario by default, takes the three FC.1
candidate packets, and creates a review-ready but not-approved register for
human/independent review before any future apply phase.

## Docket Rows

Each `factory-candidate-review-docket-row.v1` binds:

- candidate packet id and product id
- candidate packet hash and candidate manifest hash
- diff packet id and diff hash
- rollback plan id and rollback hash
- preflight id and preflight hash
- candidate hash-ledger row id and entry hash
- required reviewer lanes: `human_owner` and `independent_reviewer`
- next action: review and capture a receipt without applying

Every row remains `review_required_not_approved`.

## Review Packets

Each `factory-candidate-review-packet-row.v1` is ready for review and points to:

- an unapplied unified diff packet
- a draft rollback plan
- an executed passing preflight

Review packets are not apply packets. They do not approve, merge, write, deploy,
or open protected actions.

## Hash Register

FC.3 creates a chained review hash register over:

- candidate packet hash
- review docket row hash
- review packet hash
- previous register entry hash

This is a review evidence register only. It is not appended to the persistent
factory ledger in FC.3.

Review hash-register entry hashes are environment- and run-scoped because they
inherit candidate packet hashes from FC.1/FC.2, which include workspace metadata
and the run timestamp. Use `--run-at` for deterministic local snapshots.

## Boundary

These remain false:

- `review_decision_allowed_now`
- `approval_allowed_now`
- `apply_allowed_now`
- `actual_git_worktree_created_now`
- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- production PASS and enterprise PASS

## Negative Fixtures

FC.3 includes executable negative rows for:

- auto-approval attempt blocked
- apply without review receipt blocked
- mismatched candidate hash binding blocked

It also fails closed when the source candidate lane has fewer than three
candidate packets; the default tracked seed candidate lane has zero candidate
packets and stays blocked for FC.3 review docket readiness.

When `--source-candidate-lane` is used, the source file is treated as an
operator-supplied candidate-lane artifact. FC.3 validates required hash fields
and candidate-manifest binding flags before emitting a ready docket, but it
does not convert that source file into approval or apply authority.

## Review Receipt

FC.3 received one valid Law Firm OS-style Claude review after a superseded
blocking review was fixed:

- model: `claude-opus-4-8`
- effort: `max`
- permission mode: `dontAsk`
- read-only tools: `Read,Grep,Glob`
- compact repo-local prompt plus JSON schema
- raw output captured only after the Claude process exits
- malformed, empty, auth-failed, interrupted, or tool-call-shaped attempts are
  not counted as review evidence

Claude is independent review evidence only. It is not final approval and does
not open protected-action, production, or enterprise authority.

Final review receipt:

- receipt doc: `docs/factory-promotion/fc3-claude-opus-4-8-review-receipt.md`
- raw artifact: `artifacts/factory-promotion/fc3-review-lawos-style-followup/raw-output.json`
- normalized receipt: `artifacts/factory-promotion/fc3-review-lawos-style-followup/review-receipt.json`
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 findings: 0
- P3 findings: 2
- initial blocking P2: fixed and superseded

## Verification

```bash
node --check src/factory-candidate-review-docket.mjs
node --check scripts/factory-candidate-review-docket.mjs
node --test test/factory-candidate-review-docket.test.mjs
npm run factory:candidate-review-docket -- --check --require-pass
git diff --check
```

Observed post-adjudication result:

- FC.3 targeted tests: 6/6 pass
- candidate review docket command: ready, 3 candidate packets, 3 docket rows,
  3 review hash register rows
- approval/apply: false
- validation errors: 0
- FB.1-FC.3 targeted suite: 49/49 pass
- contract validation: 214/214 pass
- diff check: pass
