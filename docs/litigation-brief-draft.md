# Litigation Brief Draft

Phase 247 adds a deterministic litigation brief draft scaffold for the demo litigation matter.

This phase reads `examples/project-beta-litigation-matter.json`, the Legal Citation Verifier artifact, and the Exhibit Map artifact. It emits draft claim scaffolds, fact rows, evidence links, legal-basis placeholders, citation gate results, and matter summaries.

The generated rows are internal draft work product only. They are not legal advice, legal conclusions, finalized legal authority, filed pleading language, or client-facing-ready output.

## Guardrails

- Every draft row is scoped by `matter_id`.
- Every source claim becomes a draft claim scaffold.
- Every chronology entry becomes a sourced fact row with verification status preserved.
- Supporting, contrary, and missing evidence are represented as evidence link rows.
- Every claim has a legal-basis placeholder and a citation gate result.
- Citation gates are source-bound and pass only with currentness/legal-authority review still required.
- Every row remains attorney/human-review gated and partner approval is required before filing or client-facing use.
- The phase does not execute tools, file anything, deliver output, write matter/task/workflow state, provide legal advice, assert legal conclusions, or finalize legal authority.
- Desktop use remains read-only and is not the source of truth.

## Command

Run the phase with:

```bash
npm run law-firm:litigation-brief-draft -- --check
```

Primary output: `artifacts/litigation-brief-draft/latest/litigation-brief-draft.json`.
