# Human Review Context Bundle

Phase 61 adds a context-only bundle between actor workspace merge and human gate receipt validation.

The bundle reads the merged actor receipt input plus the human gates, action plan, evidence viewer, approval inbox, and matter cockpit artifacts. It produces reviewer-facing context cards so each pending receipt can be decided with its gate reason, action-plan source, evidence span, approval context, matter context, and required receipt contract in one place.

## Command

```bash
npm run control-plane:review-context
```

Useful options:

- `--workspace-merge <path>`: merged actor receipt workspace artifact.
- `--workspace <path>`: actor receipt workspace artifact.
- `--human-gates <path>`: human gate briefing artifact.
- `--action-plan <path>`: control-plane action plan artifact.
- `--evidence-viewer <path>`: evidence viewer artifact.
- `--approval-inbox <path>`: approval inbox artifact.
- `--matter-cockpit <path>`: matter cockpit artifact.
- `--out-dir <dir>`: output directory.
- `--check`: fail when source or safe-handling validation fails.

## Outputs

- `human-review-context-bundle.json`: full bundle with sources, summary, actor bundles, context cards, and validation.
- `context-cards.json`: flat context cards for API/dashboard lookup.
- `actor-context-bundles.json`: required-actor rollups.
- `actors/<required_actor>/context-cards.json`: actor-specific card subset.
- `actors/<required_actor>/context.md`: human-readable context packet for the reviewer.
- `summary.md`: top-level status.

## Safety

This stage is context-only. It does not apply receipts, execute commands, deliver outputs, merge code, send email, or change gate state. `auto_execute_allowed` and `protected_actions_executed` are always false. Human gate receipt validation and application remain separate stages.

## Completion Criteria

- The artifact validates against `schemas/human-review-context-bundle.schema.json`.
- Every merge item has one context card.
- Every context card has safe handling disabled and includes a review contract.
- Evidence gate cards include evidence context when the evidence viewer has the referenced card.
- Dashboard/API expose the bundle, actor bundles, and cards without changing protected state.

After this stage, run `npm run control-plane:review-decisions` to turn context cards into a context-bound decision register and standard receipt input.
