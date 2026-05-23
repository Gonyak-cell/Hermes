# Human Review Correction Feedback

Phase 68 routes correction validation results back into actor-specific feedback bundles. It closes the loop from validation feedback to correction workspace, correction merge, correction validation, and back to reviewer action queues.

```bash
npm run control-plane:review-corrections:feedback
```

Useful options:

- `--merge <path>`: Human Review Correction Workspace Merge artifact.
- `--validation <path>`: Human Review Correction Validation artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when correction feedback cannot be built safely.

Outputs:

- `human-review-correction-feedback.json`: full correction feedback artifact.
- `feedback-items.json`: one feedback row per merged correction receipt.
- `actor-feedback.json`: required-actor rollup.
- `actors/<required_actor>/feedback.json`: actor-specific feedback rows.
- `actors/<required_actor>/feedback.md`: actor-specific reviewer checklist.
- `summary.md`: top-level status.

Safe handling:

- This stage is feedback-only.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, or external actions.
- Pending correction receipts stay pending until a human fills the required decision fields and validation passes.
