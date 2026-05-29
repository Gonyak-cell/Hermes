# LDD Report Draft

Phase 246 adds a deterministic LDD report draft generator for the demo law-firm matter.

This phase reads the Phase 245 RFI generator artifact, the Phase 244 issue detection artifact, the legal citation verifier artifact, and scoped demo matter metadata. It emits draft report sections, draft paragraphs, citation placeholders, issue links, and matter summaries.

The generated rows are internal draft work product only. They are not legal advice, legal conclusions, finalized legal authority, or client-facing-ready output.

## Guardrails

- Every section, paragraph, citation placeholder, and issue link is scoped by `matter_id`.
- Every section has at least one draft paragraph.
- Every paragraph has source refs and at least one citation placeholder.
- Citation placeholders keep currentness and legal-authority review required.
- Every P244 issue candidate is linked to at least one report paragraph.
- Every draft row remains attorney/human-review gated and partner approval is required before client-facing use.
- The phase does not execute tools, deliver output, write matter/task/workflow state, provide legal advice, assert legal conclusions, or finalize legal authority.
- Desktop use remains read-only and is not the source of truth.

## Command

Run the phase with:

```bash
npm run law-firm:report-draft -- --check
```

Primary output: `artifacts/ldd-report-draft/latest/ldd-report-draft.json`.
