# Human Review Validation Feedback

Phase 64 routes Human Gate Receipt Validation results back into actor-specific reviewer bundles. It lets each reviewer see which decision receipt rows are still pending, ready for application, or need correction after validation.

```bash
npm run control-plane:review-feedback
```

Useful options:

- `--merge <path>`: Human Review Decision Register Merge artifact.
- `--validation <path>`: Control Plane Human Gate Receipt Validation artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when validation feedback cannot be built safely.

Outputs:

- `human-review-validation-feedback.json`: full feedback artifact.
- `feedback-items.json`: one feedback row per merged decision receipt.
- `actor-feedback.json`: required-actor rollup.
- `actors/<required_actor>/feedback.json`: actor-specific feedback rows.
- `actors/<required_actor>/feedback.md`: actor-specific reviewer checklist.
- `summary.md`: top-level status.

Safe handling:

- This stage is feedback-only.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, or external actions.
- Pending receipts stay pending until a human fills the required decision fields and validation passes.

This closes the validation feedback loop: actor-local decision receipt inputs feed merge and validation, then validation results come back to the actor as a concrete correction queue.
