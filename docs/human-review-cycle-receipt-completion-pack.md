# Human Review Cycle Receipt Completion Pack

`npm run control-plane:review-cycle:completion-pack` turns the receipt field audit into actor-specific manual completion packs.

This stage is template-only:

- It does not edit target `receipt-input.json` files.
- It does not apply receipts.
- It does not execute protected actions.
- It only produces JSON/Markdown checklists that a human reviewer can use while filling receipts.
- Pending rows include prompts for changing `receipt_status` and `outcome` to terminal human decision values.

## Inputs

- `artifacts/human-review-cycle-receipt-field-audit/latest/human-review-cycle-receipt-field-audit.json`

## Outputs

- `human-review-cycle-receipt-completion-pack.json`: full completion pack artifact.
- `completion-items.json`: one item per receipt field audit item.
- `actor-completion-packs.json`: actor rollups.
- `summary.md`: top-level summary.
- `actors/<required_actor>/completion-pack.json`
- `actors/<required_actor>/completion-pack.md`
- `actors/<required_actor>/receipt-completion-template.json`

## Status Rules

- `ready_for_human_input`: the receipt row exists and the pack has field prompts for manual completion.
- `ready_for_validation`: the receipt row already has terminal values and can be revalidated.
- `attention`: the field audit item needs manual repair before a clean template can be trusted.
- `blocked`: the source receipt field audit or source receipt row is blocked.

## Useful Commands

```bash
npm run control-plane:review-cycle:completion-pack
npm run control-plane:review-cycle:completion-pack -- --check
npm run dashboard:build
npm run api:smoke
```

The Review API exposes:

- `/api/human-review-cycle-completion-packs`
- `/api/human-review-cycle-completion-items`
- `/api/human-review-actor-completion-packs`
