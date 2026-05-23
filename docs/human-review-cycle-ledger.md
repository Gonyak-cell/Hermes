# Human Review Cycle Ledger

Phase 69 links the human review feedback loop into one read-only ledger. It compares validation feedback, correction workspace, correction merge, correction validation, and correction feedback so the current actor workload is visible in one artifact.

```bash
npm run control-plane:review-cycle
```

Useful options:

- `--validation-feedback <path>`: Human Review Validation Feedback artifact.
- `--correction-workspace <path>`: Human Review Correction Workspace artifact.
- `--correction-merge <path>`: Human Review Correction Workspace Merge artifact.
- `--correction-validation <path>`: Human Review Correction Validation artifact.
- `--correction-feedback <path>`: Human Review Correction Feedback artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when the cycle ledger cannot be built safely.

Outputs:

- `human-review-cycle-ledger.json`: full cycle ledger artifact.
- `cycle-items.json`: one row per gate item across the feedback/correction loop.
- `actor-cycles.json`: required-actor rollup.
- `actors/<required_actor>/cycle.json`: actor-specific cycle items.
- `actors/<required_actor>/cycle.md`: actor-specific cycle checklist.
- `summary.md`: top-level status.

Safe handling:

- This stage is ledger-only.
- It does not apply receipts.
- It does not execute protected delivery, merge, ERP, command, or external actions.
- Pending actor work stays pending until a human updates the relevant correction receipt input and validation passes.

Next stage:

- `npm run control-plane:review-cycle:work-orders` converts this ledger into actor-specific work orders and preserves the same draft-only/protected-action boundary.
