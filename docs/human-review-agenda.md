# Human Review Agenda

Human Review Agenda turns Human Review Packet Ledger output into reviewer-facing agenda sections and a receipt decision template.

Run:

```bash
npm run control-plane:review-agenda
```

Artifacts:

- `artifacts/human-review-agenda/latest/human-review-agenda.json`
- `artifacts/human-review-agenda/latest/agenda-sections.json`
- `artifacts/human-review-agenda/latest/agenda-items.json`
- `artifacts/human-review-agenda/latest/decision-template.json`
- `artifacts/human-review-agenda/latest/summary.md`

Safety contract:

- `safe_handling.auto_execute_allowed` is always `false`.
- Protected delivery or merge remains manual and receipt-gated.
- Pending decision-template rows do not close gates.
- Completed rows must be validated with `npm run control-plane:human-gate-receipts:validate` before any application command.

The agenda is intentionally not an execution layer. It is a controlled review surface that helps an attorney, authorized operator, developer owner, content owner, or human reviewer see the packet priority, required actor, receipt rows, protected-action warnings, and follow-up commands in one place.
