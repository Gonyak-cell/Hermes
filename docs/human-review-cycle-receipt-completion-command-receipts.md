# Human Review Cycle Receipt Completion Command Receipts

`npm run control-plane:review-cycle:completion-command-receipts` turns the read-only completion command queue into manual receipt draft rows.

It is intentionally conservative:

- It does not execute queued commands.
- It does not mark any command complete.
- It does not edit target receipt inputs.
- It does not apply receipts or protected actions.
- It keeps held commands as references for the human reviewer.

Default input:

- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json`

Default output:

- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/receipt-input-draft.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/receipt-requirements.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/held-command-references.json`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/index.html`
- `artifacts/human-review-cycle-receipt-completion-command-receipts/latest/summary.md`

Typical query points:

- `/api/human-review-cycle-completion-command-receipts?receipt_status=pending_command_receipts`
- `/api/human-review-cycle-completion-command-receipt-requirements?command_kind=verification_refresh`
- `/api/human-review-cycle-completion-command-receipt-drafts?command_result=not_run`
- `/api/human-review-cycle-completion-held-command-references?requires_explicit_human_approval=true`

This stage gives the human reviewer a receipt form for commands they choose to run manually. Pending rows are not treated as proof of execution.

The next validation layer is `npm run control-plane:review-cycle:completion-command-receipts:validate`, which checks filled command-run receipt rows before any later refresh confirmation step.
