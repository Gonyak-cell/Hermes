# Human Review Cycle Receipt Completion Runbook

`npm run control-plane:review-cycle:completion-runbook` converts the receipt completion workbench into a read-only operational runbook.

It is intentionally conservative:

- It does not edit target receipt inputs.
- It does not apply receipts.
- It does not execute protected actions.
- It lists the manual receipt fields that still need human input.
- It records the exact verification, dashboard, and API commands to rerun after the human edits are done.
- It includes the command to regenerate the completion readiness gate after the runbook is refreshed.

Default input:

- `artifacts/human-review-cycle-receipt-completion-workbench/latest/human-review-cycle-receipt-completion-workbench.json`
- `artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json`

Default output:

- `artifacts/human-review-cycle-receipt-completion-runbook/latest/human-review-cycle-receipt-completion-runbook.json`
- `artifacts/human-review-cycle-receipt-completion-runbook/latest/runbook-steps.json`
- `artifacts/human-review-cycle-receipt-completion-runbook/latest/actor-runbooks.json`
- `artifacts/human-review-cycle-receipt-completion-runbook/latest/index.html`
- `artifacts/human-review-cycle-receipt-completion-runbook/latest/summary.md`
- `artifacts/human-review-cycle-receipt-completion-runbook/latest/actors/<required_actor>/completion-runbook.html`

After manual receipt edits, rerun:

```bash
npm run control-plane:review-cycle:completion-verify
npm run control-plane:review-cycle:completion-workbench
npm run control-plane:review-cycle:completion-runbook
npm run control-plane:review-cycle:completion-readiness
npm run dashboard:build
npm run api:smoke
```

Only after explicit human approval should any protected application command be considered.
