# Human Review Cycle Receipt Completion Protected Approval Request Pack

Phase 92 separates protected held commands from manual command receipts. It turns protected held command resolution plans into explicit human approval requests, with actor-specific approval input templates. It does not approve, run, apply, merge, or edit protected actions.

Inputs:

- `artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json`

Outputs:

- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json`
- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/approval-requests.json`
- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/actor-approval-packs.json`
- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/approval-input-template.json`
- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/actors/<actor>/protected-approval-request-pack.json`
- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/actors/<actor>/approval-input.json`
- `artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/actors/<actor>/README.md`

Safety invariants:

- Protected approval requests are separate from command receipts.
- Every request remains `pending_explicit_approval`.
- Approval templates are placeholders only.
- Commands and protected actions executed by the harness remain 0.
- Source artifact mutation and command receipt edits are disallowed.

Validation:

- Approval request count must match the held command resolution protected resolution count.
- Every protected resolution must become exactly one approval request.
- Non-protected resolution plans must not appear in approval requests.
- Each actor approval pack must include target input path and required approval fields.
- Required approval template fields must be present.

CLI:

```bash
npm run control-plane:review-cycle:completion-protected-approval-request-pack
```

Review API:

- `/api/human-review-cycle-completion-protected-approval-request-packs`
- `/api/human-review-cycle-completion-protected-approval-requests`
- `/api/human-review-cycle-completion-protected-approval-actors`
