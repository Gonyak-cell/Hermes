# Human Review Cycle Receipt Completion Command Queue Patch Projection

Phase 94 adds a pre-application projection stage for command queue receipt patches.

The stage reads the command queue, manual receipt revalidation, and command receipt application artifacts, then produces a non-mutating projection of:

- command queue patch targets,
- before and after queue state,
- patch operations that would be applied later,
- audit event candidates that would be emitted only after an explicit apply step.

This stage never runs commands, edits receipt inputs, applies command queue patches, or emits audit events. Pending manual receipts are represented as held projections with unchanged before and after state.

Default command:

```sh
npm run control-plane:review-cycle:completion-command-queue-patch-projection
```

Default outputs:

- `artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/human-review-cycle-receipt-completion-command-queue-patch-projection.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/projection-items.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/patch-operations.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/audit-event-candidates.json`
- `artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/summary.md`

Acceptance checks:

- every manual revalidation item has a projection item,
- every projection item has a command queue target, before state, after state, and audit event candidate,
- ready patch count matches human-entered ready/applied receipt candidates,
- non-human, protected-overlap, and auto-executed receipts stay blocked,
- patch application, command execution, and audit emission counts remain zero.
