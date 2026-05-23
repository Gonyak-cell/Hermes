# Human Review Cycle Receipt Completion Workbench

Human Review Cycle Receipt Completion Workbench turns completion verification results into a read-only actor workbench. It shows each actor which target `receipt-input.json` file to edit manually, which fields are still pending, and which completion template to use.

It does not edit receipt inputs, apply receipts, send delivery actions, merge code, or execute protected actions.

## Command

```bash
npm run control-plane:review-cycle:completion-workbench
```

Options:

- `--completion-verification <path>`: override the completion verification artifact.
- `--completion-pack <path>`: override the completion pack artifact.
- `--out-dir <dir>`: override the output directory.
- `--run-at <iso>`: use a deterministic timestamp.
- `--check`: fail only on structural validation errors.

## Outputs

Default output directory:

`artifacts/human-review-cycle-receipt-completion-workbench/latest`

Files:

- `human-review-cycle-receipt-completion-workbench.json`: full workbench artifact.
- `workbench-items.json`: flattened item-level manual input queue.
- `actor-workbenches.json`: actor-level workbench rollups.
- `index.html`: static read-only workbench.
- `summary.md`: human-readable summary.
- `actors/<required_actor>/completion-workbench.json`: actor-specific workbench artifact.
- `actors/<required_actor>/completion-workbench.md`: actor-specific checklist.
- `actors/<required_actor>/completion-workbench.html`: actor-specific static workbench.

## Safe Flow

1. Open the actor workbench.
2. Open the linked `receipt-completion-template.json`.
3. Manually edit only the linked target `receipt-input.json`.
4. Rerun `npm run control-plane:review-cycle:completion-verify`.
5. Rerun `npm run control-plane:review-cycle:completion-workbench`.
6. Rerun `npm run control-plane:review-cycle:completion-runbook`.
7. If verification becomes `ready_for_validation`, rerun correction merge and validation before any application.
