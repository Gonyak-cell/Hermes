# Human Review Decision Register

Phase 62 turns the Human Review Context Bundle into a context-bound decision register. It gives each reviewer a structured row that links the receipt they must decide to the relevant gate, action plan, evidence, approval item, and matter context.

## Command

```bash
npm run control-plane:review-decisions
```

Useful options:

- `--context-bundle <path>`: Human Review Context Bundle artifact.
- `--out-dir <dir>`: output directory.
- `--run-at <iso>`: override `generated_at`.
- `--check`: fail when validation fails.

## Outputs

- `human-review-decision-register.json`: full register artifact.
- `decision-rows.json`: flat decision row list.
- `actor-decision-registers.json`: required-actor rollup.
- `receipt-input.json`: standard `control-plane-human-gate-receipts-input.v1` generated from the decision rows.
- `actors/<required_actor>/decision-register.json`: actor-specific decision rows.
- `actors/<required_actor>/receipt-input.json`: actor-specific receipt input subset.
- `actors/<required_actor>/review.md`: reviewer checklist.
- `summary.md`: top-level status.

## Safety

This stage is draft-only and register-only. It does not approve, reject, apply, send, delete, deliver, or execute protected actions. Actor-specific receipt inputs should be merged by `npm run control-plane:review-decisions:merge`, and that merged `receipt-input.json` remains subject to Human Gate Receipt Validation before any application stage can consume it.

## Completion Criteria

- The artifact validates against `schemas/human-review-decision-register.schema.json`.
- Decision row count equals context card count.
- Receipt input row count equals decision row count.
- All rows keep `auto_execute_allowed: false` and `protected_actions_executed: false`.
- Dashboard/API expose the register, decision rows, and actor registers.
- `Human Review Decision Register Merge` can recombine actor-local edits before validation.
