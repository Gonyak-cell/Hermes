# Human Review Cycle Receipt Completion Verification

Human Review Cycle Receipt Completion Verification reads the actor completion templates produced by the completion pack and checks whether the target `receipt-input.json` rows were manually filled.

It is verification-only. It does not edit receipt inputs, apply receipts, send delivery actions, merge code, or execute protected actions.

## Command

```bash
npm run control-plane:review-cycle:completion-verify
```

Options:

- `--completion-pack <path>`: override the Human Review Cycle Receipt Completion Pack artifact.
- `--out-dir <dir>`: override the output directory.
- `--run-at <iso>`: use a deterministic timestamp.
- `--check`: fail only on structural validation errors such as missing target files or rows.

## Outputs

Default output directory:

`artifacts/human-review-cycle-receipt-completion-verification/latest`

Files:

- `human-review-cycle-receipt-completion-verification.json`: full verification artifact.
- `verification-items.json`: flattened item-level verification results.
- `actor-verifications.json`: actor-level rollups.
- `summary.md`: human-readable summary.
- `actors/<required_actor>/completion-verification.json`: actor-specific verification artifact.
- `actors/<required_actor>/completion-verification.md`: actor-specific checklist summary.

## Status Model

- `pending_human_input`: prompted fields are still empty, pending, or placeholder-like.
- `ready_for_validation`: all prompted fields have manual values and terminal decision fields are valid.
- `attention`: prompted fields have invalid values, such as an unsupported outcome.
- `blocked`: the source completion pack, target receipt file, or target receipt row is missing.
- `clear`: no prompted field needs verification.

`pending_human_input` is expected until a human reviewer manually fills the target receipt input rows.

## Safety

This stage enforces:

- `auto_execute_allowed: false`
- `protected_actions_executed: false`
- `verification_only: true`
- `receipt_edits_must_be_manual: true`

The next safe path after `ready_for_validation` is to rerun correction merge, correction validation, receipt field audit, and completion verification before any receipt application.
