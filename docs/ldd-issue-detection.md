# LDD Issue Detection

Phase 244 adds a deterministic LDD issue detection ledger for the demo law-firm matter.

This phase reads the Phase 243 fact extraction artifact and scoped demo matter metadata, then emits attorney-reviewable issue candidates, red/yellow flags, follow-up rows, and severity summaries. The rows are operational review cues only and are not legal conclusions.

## Guardrails

- Every issue and follow-up row is scoped by `matter_id`.
- Every issue and follow-up row requires attorney/human review before legal or client-facing use.
- Missing/requested material and fact source gaps become follow-up issue candidates only.
- The phase does not execute extractors, call models, generate legal advice, create client-facing output, or mutate matter/task/workflow/runtime/delivery state.
- Desktop use remains read-only and is not the source of truth.

## Command

Run the phase with:

```bash
npm run law-firm:issue-detection -- --check
```

Primary output: `artifacts/ldd-issue-detection/latest/ldd-issue-detection.json`.
