# Legal Approval Matrix

Phase 251 adds a deterministic legal approval matrix for law-firm outputs.

The matrix reads the current LDD RFI Generator, LDD Report Draft, Litigation Brief Draft, Meeting Minutes Workflow, Contract Draft Workflow, and Provided Material Review Ledger artifacts. It creates one approval row per output artifact, two requirement rows per output (`attorney_review` and `partner_approval`), native gate links, and matter summaries.

The matrix is a requirement ledger only. It does not approve, reject, finalize, file, deliver, or make any client-facing output. Attorney review, human review, and partner approval remain required before any client-facing, final, filing, delivery, or legal-use step.

Run:

```bash
npm run law-firm:approval-matrix -- --check
```

Outputs are written under `artifacts/legal-approval-matrix/latest/`.
