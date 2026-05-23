# Human Review Correction Workspace Merge

`Human Review Correction Workspace Merge` combines actor-specific correction receipt inputs into a single validation input.

```sh
npm run control-plane:review-corrections:merge
```

Inputs:

- `artifacts/human-review-correction-workspace/latest/human-review-correction-workspace.json`
- `artifacts/human-review-correction-workspace/latest/actors/<required_actor>/receipt-input.json`

Outputs:

- `artifacts/human-review-correction-workspace-merge/latest/human-review-correction-workspace-merge.json`
- `artifacts/human-review-correction-workspace-merge/latest/receipt-input.json`
- `artifacts/human-review-correction-workspace-merge/latest/merge-items.json`
- `artifacts/human-review-correction-workspace-merge/latest/actor-inputs.json`
- `artifacts/human-review-correction-workspace-merge/latest/summary.md`

The merged `receipt-input.json` is still draft-only. It must be passed through `control-plane-human-gate-receipt-validation` before any receipt application.

Safety:

- Does not write back to actor decision registers.
- Does not apply receipts.
- Does not execute protected actions.
- Validates missing, duplicate, unknown, and invalid correction receipt rows.

Useful checks:

```sh
npm run control-plane:review-corrections:merge -- --check
node scripts/control-plane-human-gate-receipt-validation.mjs \
  --receipt-input artifacts/human-review-correction-workspace-merge/latest/receipt-input.json
```
