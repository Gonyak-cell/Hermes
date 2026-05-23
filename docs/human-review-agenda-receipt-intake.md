# Human Review Agenda Receipt Intake

Human Review Agenda Receipt Intake converts the agenda `decision-template.json` into the standard `control-plane-human-gate-receipts-input.v1` format used by receipt validation.

Run:

```bash
npm run control-plane:review-agenda:intake
```

Artifacts:

- `artifacts/human-review-agenda-receipt-intake/latest/human-review-agenda-receipt-intake.json`
- `artifacts/human-review-agenda-receipt-intake/latest/receipt-input.json`
- `artifacts/human-review-agenda-receipt-intake/latest/receipt-intake-items.json`
- `artifacts/human-review-agenda-receipt-intake/latest/summary.md`

Safety contract:

- It never applies receipts.
- It never executes protected actions.
- It keeps `safe_handling.auto_execute_allowed` as `false`.
- It preserves pending rows as pending.
- Filled rows must still pass `npm run control-plane:human-gate-receipts:validate` before `npm run control-plane:human-gate-receipts:apply`.

This is the bridge between the human-facing agenda and the deterministic receipt validation/application pipeline.

For actor-specific editing folders, run `npm run control-plane:review-workspace` after intake. The workspace keeps the same receipt input contract, but splits pending rows by required actor.
