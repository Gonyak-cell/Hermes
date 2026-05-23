# Human Review Cycle Receipt Completion Command Queue

`npm run control-plane:review-cycle:completion-command-queue` turns completion readiness command gates into a read-only manual command queue.

It is intentionally conservative:

- It does not execute commands.
- It does not edit target receipt inputs.
- It does not apply receipts or protected actions.
- It separates `available_now` refresh commands from held commands.
- It keeps protected application commands in the held list.

Default input:

- `artifacts/human-review-cycle-receipt-completion-readiness/latest/human-review-cycle-receipt-completion-readiness.json`

Default output:

- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/command-queue-items.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/held-command-items.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/actor-command-queues.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/index.html`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/summary.md`

Typical query points:

- `/api/human-review-cycle-completion-command-queues?queue_status=ready_with_holds`
- `/api/human-review-cycle-completion-command-queue-items?queue_status=ready_to_run_manually`
- `/api/human-review-cycle-completion-held-commands?hold_status=held_until_manual_input`
- `/api/human-review-actor-completion-command-queues?required_actor=attorney_or_designated_reviewer`

This queue is a visibility layer only. A human may use it to decide which refresh commands to run, but the harness itself does not run them.
