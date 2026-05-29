# Legal Citation Verifier

Phase 239 adds a deterministic legal citation verifier for Hermes law-firm matter operations.

The verifier reads the Citation Object Store, Issue Graph Store, Source Span Store, Evidence Item Store, Fact Claim Store, Lineage Graph, Output Catalog, and Protected Delivery Queue. It creates one verification record, source check, and currentness check for each citation object.

## Boundary

- The artifact is read-only.
- It does not perform legal research.
- It does not certify that any law, case, or secondary source is current.
- It does not provide legal advice or generate client-facing output.
- Every citation remains blocked for attorney/human review before client-facing use.

## Outputs

- `artifacts/legal-citation-verifier/latest/legal-citation-verifier.json`
- `artifacts/legal-citation-verifier/latest/legal-citation-verification-records.json`
- `artifacts/legal-citation-verifier/latest/legal-citation-source-checks.json`
- `artifacts/legal-citation-verifier/latest/legal-citation-currentness-checks.json`
- `artifacts/legal-citation-verifier/latest/legal-citation-matter-summaries.json`
- `artifacts/legal-citation-verifier/latest/legal-citation-verifier-boundary.json`
- `artifacts/legal-citation-verifier/latest/validation-report.json`
- `artifacts/legal-citation-verifier/latest/summary.md`

## Command

```powershell
npm.cmd run legal:citations -- --check
```
