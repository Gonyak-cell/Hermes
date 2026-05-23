# Human Review Cycle Receipt Field Audit

`npm run control-plane:review-cycle:field-audit` reads the Human Review Cycle Reviewer Console and audits the target `receipt-input.json` rows that a human reviewer must complete.

It is deliberately read-only:

- It does not edit receipt files.
- It does not apply receipts.
- It does not execute protected actions.
- Empty human decision fields are reported as pending work, not silently treated as complete.

## Inputs

- `artifacts/human-review-cycle-reviewer-console/latest/human-review-cycle-reviewer-console.json`
- actor-specific receipt inputs referenced by each console item

## Outputs

- `human-review-cycle-receipt-field-audit.json`: full audit artifact.
- `field-audit-items.json`: one item per reviewer console item.
- `actor-field-audits.json`: actor rollups.
- `summary.md`: top-level summary.
- `actors/<required_actor>/field-audit.json`
- `actors/<required_actor>/field-audit.md`

## Status Rules

- `pending_human_review`: the target receipt row exists and still has pending/empty human decision fields.
- `ready_for_validation`: the target receipt row has terminal status/outcome and all required field values are present.
- `attention`: the row is terminal but incomplete, or required metadata mismatches.
- `blocked`: the target file or receipt row is missing.

Pending human fields do not fail `--check`; missing files, missing rows, missing required field keys, and unsafe handling do.

## Useful Commands

```bash
npm run control-plane:review-cycle:field-audit
npm run control-plane:review-cycle:field-audit -- --check
npm run dashboard:build
npm run api:smoke
```

The Review API exposes:

- `/api/human-review-cycle-field-audits`
- `/api/human-review-cycle-field-audit-items`
- `/api/human-review-actor-field-audits`

Next stage:

- `npm run control-plane:review-cycle:completion-pack` turns the pending field list into actor-specific manual completion templates.
