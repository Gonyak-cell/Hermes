# Human Review Cycle Receipt Completion Held Command Resolution

Phase 91 turns the non-receipt held command blockers into actor-specific resolution plans. It does not run commands, edit source artifacts, or execute protected actions. Its job is to say who must act, what condition unblocks each held command, and what command/action follows after the condition is satisfied.

Inputs:

- `artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json`
- `artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json`

Outputs:

- `artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json`
- `artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/resolution-plans.json`
- `artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/actor-resolution-plans.json`
- `artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/actors/<actor>/held-command-resolution-plan.json`
- `artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/actors/<actor>/README.md`

Safety invariants:

- The resolution ledger is read-only with respect to source artifacts.
- It does not run refresh commands.
- It does not execute protected actions.
- Protected application remains blocked until explicit human approval is recorded.

Validation:

- Each baseline held command blocker must have one resolution plan.
- The manual command receipt pack non-receipt blocker count must match resolution plans.
- The command queue held item count must match resolution plans.
- Every held command resolution plan must include `required_actor`, `unblock_condition`, and `follow_on_action`.
- Protected held commands must use explicit human approval as their unblock condition.

CLI:

```bash
npm run control-plane:review-cycle:completion-held-command-resolution
```

Review API:

- `/api/human-review-cycle-completion-held-command-resolutions`
- `/api/human-review-cycle-completion-held-command-resolution-plans`
- `/api/human-review-cycle-completion-held-command-resolution-actors`
