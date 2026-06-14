# FC.2 Factory Candidate Lane Proof

Status: ready after Law Firm OS-style Claude Opus 4.8 max review.
Date: 2026-06-12

## Scope

FC.2 adds a deterministic proof harness for the FC.1 candidate lane:

```bash
npm run factory:candidate-lane-proof -- --check --require-pass
```

The proof harness creates three temporary operational PS2 products, runs the
existing factory candidate lane against them, and proves that the lane emits
three reviewable candidate packets without applying anything.

## Proof Scenario

The scenario id is `fc2.three_ps2_candidate_packets`.

The harness:

- creates an OS temporary ledger under `os.tmpdir()`
- appends three product rows to that temporary ledger
- appends PS0 -> PS1 and PS1 -> PS2 transition rows for each product
- runs `buildFactoryCandidateLane()` against the temporary ledger
- verifies three ready candidate packets
- verifies three unapplied unified diff packets
- verifies three draft rollback plans
- verifies three executed passing preflights
- verifies three chained candidate hash ledger rows
- deletes the temporary ledger unless `--keep-temp-ledger` is explicitly used

The proof intentionally isolates writes, not all reads. It still reads the
committed seed and starter artifact corpus, so a degraded starter corpus can
make the proof fail closed. It cannot inflate the proof product count because
the stage read model treats operational product rows as single-source truth.

## Boundary

FC.2 performs temporary fixture ledger writes only inside the OS temp directory.
It does not write `data/factory/local/`, does not write `data/factory/seed/`,
does not create git worktrees, does not write source files, does not append
persistent ledgers, and does not apply diffs.

These remain false:

- `default_or_seed_ledger_written_now`
- `actual_git_worktree_created_now`
- `source_file_write_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `patch_apply_enabled`
- `apply_allowed_now`
- production PASS and enterprise PASS

## Artifacts

The default command writes:

- `artifacts/factory-candidate-lane-proof/latest/factory-candidate-lane-proof.json`
- `artifacts/factory-candidate-lane-proof/latest/proof-product-rows.json`
- `artifacts/factory-candidate-lane-proof/latest/candidate-packet-proof-rows.json`
- `artifacts/factory-candidate-lane-proof/latest/boundary.json`
- `artifacts/factory-candidate-lane-proof/latest/validation-items.json`
- `artifacts/factory-candidate-lane-proof/latest/summary.md`
- nested FC.1 candidate lane artifacts under
  `artifacts/factory-candidate-lane-proof/latest/candidate-lane/`

These artifacts are generated evidence and remain outside tracked source.

Candidate packet hashes, proof row hashes, and candidate hash-ledger entry
hashes are environment- and run-scoped because packet metadata includes absolute
workspace paths and the default run timestamp. Manifest, diff, rollback, and
preflight hashes remain stable at their own grain. Use `--run-at` for
deterministic local snapshots.

## Negative Fixtures

FC.2 preserves the executable FC.1 negative fixtures:

- apply attempt blocked
- attempted write outside planned isolated worktree blocked
- protected path target blocked

It adds a proof-level fail-closed fixture: if required starter artifacts cannot
be materialized, the proof remains blocked with 0 candidate packets and closed
authority flags.

## Review Receipt

FC.2 was reviewed with the Law Firm OS closeout pattern:

- model: `claude-opus-4-8`
- effort: `max`
- permission mode: `dontAsk`
- read-only tools: `Read,Grep,Glob`
- compact repo-local prompt plus JSON schema
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 blockers: 0
- P3 findings: documented in this tranche
- raw output captured only after the Claude process exits
- malformed, empty, auth-failed, interrupted, or tool-call-shaped attempts are
  not counted as review evidence

Claude is independent review evidence only. It is not final approval and does
not open protected-action, production, or enterprise authority.

Review receipt: `fc2-claude-opus-4-8-review-receipt.md`.

## Verification

```bash
node --check src/factory-candidate-lane-proof.mjs
node --check scripts/factory-candidate-lane-proof.mjs
node --test test/factory-candidate-lane-proof.test.mjs
npm run factory:candidate-lane-proof -- --check --require-pass
git diff --check
```

Observed post-adjudication result:

- FC.2 targeted tests: 4/4 pass
- proof command: ready, 3 products, 3 candidate packets, 3 hash ledger rows
- temporary ledger cleanup: true
- validation errors: 0
