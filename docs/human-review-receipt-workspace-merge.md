# Human Review Receipt Workspace Merge

`Human Review Receipt Workspace Merge` reads the actor-specific receipt inputs from `Human Review Receipt Workspace` and recombines them into one standard `control-plane-human-gate-receipts-input.v1` file for receipt validation.

```bash
npm run control-plane:review-workspace:merge
```

Outputs:

- `human-review-receipt-workspace-merge.json`: merge manifest, actor inputs, merge items, safe handling, and validation
- `receipt-input.json`: merged receipt input for `control-plane-human-gate-receipts:validate`
- `merge-items.json`: one merge row per actor receipt or missing expected receipt
- `actor-inputs.json`: actor receipt input availability and row counts
- `summary.md`: human-readable merge summary

Safe handling:

- The merge only combines actor receipt input files.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, or external actions.
- Duplicate, missing, unknown, or actor-mismatched receipts block the merge before receipt application.

This closes the loop between per-actor review folders and deterministic validation: humans can edit actor-local files, then the control plane merges them into the same receipt contract already enforced by the human gate receipt validator.

After merge, run `npm run control-plane:review-context` before receipt validation when reviewers need a single packet tying each pending receipt to its gate, action-plan item, evidence span, approval item, and matter context.
