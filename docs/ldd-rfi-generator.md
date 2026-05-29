# LDD RFI Generator

Phase 245 adds a deterministic LDD RFI generator for the demo law-firm matter.

This phase reads the Phase 244 issue detection artifact, the Phase 240 VDR missing-data artifact, and scoped demo matter metadata. It emits internal attorney-review RFI draft packets, draft questions, missing-material links, issue links, and matter summaries.

The generated rows are draft-only operational work product. They are not legal advice, legal conclusions, or client-facing-ready output.

## Guardrails

- Every RFI draft, question, missing-material link, and issue link is scoped by `matter_id`.
- Every RFI draft question links to a P244 issue candidate.
- Missing/requested material links are tied back to VDR missing-data records and evidence/source refs.
- Every draft includes a human review note, and attorney review plus partner approval remain required before any client-facing use.
- The phase does not execute tools, deliver output, write matter/task/workflow state, provide legal advice, or assert legal conclusions.
- Desktop use remains read-only and is not the source of truth.

## Command

Run the phase with:

```bash
npm run law-firm:rfi-generator -- --check
```

Primary output: `artifacts/ldd-rfi-generator/latest/ldd-rfi-generator.json`.
