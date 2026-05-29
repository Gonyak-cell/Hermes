# LDD Fact Extraction

Phase 243 adds a deterministic LDD fact extraction ledger for the demo law-firm matter.

This phase reads the Phase 242 extractor selection artifact and the scoped demo matter metadata, then emits review-gated candidate fact rows for parties, dates, obligations, termination, and change-of-control. Missing source text is recorded as a source gap rather than a completed fact.

## Guardrails

- Every fact row is scoped by `matter_id`.
- Every row requires attorney/human review before legal or client-facing use.
- Termination is recorded as a source-gap review item when clause text is not present.
- The phase does not execute external extractors, call models, generate legal advice, create client-facing output, or mutate matter/task/workflow/runtime/delivery state.
- Desktop use remains read-only and is not the source of truth.

## Command

Run the phase with:

```bash
npm run law-firm:fact-extraction -- --check
```

Primary output: `artifacts/ldd-fact-extraction/latest/ldd-fact-extraction.json`.
