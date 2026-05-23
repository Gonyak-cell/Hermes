# Human Review Cycle Receipt Completion Readiness

`npm run control-plane:review-cycle:completion-readiness` turns the receipt completion runbook into a read-only command readiness gate.

It is intentionally conservative:

- It does not edit target receipt inputs.
- It does not execute runbook commands.
- It does not apply receipts or protected actions.
- It marks safe refresh commands as available now.
- It holds correction merge, correction validation, receipt field audit, and protected apply commands until manual receipt input is complete.

Default input:

- `artifacts/human-review-cycle-receipt-completion-runbook/latest/human-review-cycle-receipt-completion-runbook.json`
- `artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json`

Default output:

- `artifacts/human-review-cycle-receipt-completion-readiness/latest/human-review-cycle-receipt-completion-readiness.json`
- `artifacts/human-review-cycle-receipt-completion-readiness/latest/command-gates.json`
- `artifacts/human-review-cycle-receipt-completion-readiness/latest/actor-readiness.json`
- `artifacts/human-review-cycle-receipt-completion-readiness/latest/manual-requirements.json`
- `artifacts/human-review-cycle-receipt-completion-readiness/latest/index.html`
- `artifacts/human-review-cycle-receipt-completion-readiness/latest/summary.md`

Typical query points:

- `/api/human-review-cycle-completion-readiness?readiness_status=waiting_for_human_input`
- `/api/human-review-cycle-completion-command-gates?command_status=available_now`
- `/api/human-review-actor-completion-readiness?required_actor=attorney_or_designated_reviewer`

Protected application remains approval-only even when all manual input is complete.
