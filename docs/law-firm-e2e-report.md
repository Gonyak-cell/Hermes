# Law Firm E2E Report

`law_firm_e2e_report` is the Phase 305 representative law-firm scenario report. It verifies the read-only chain:

`matter -> resource -> evidence -> draft -> citation -> approval -> audit`

The report uses the Phase 304 backup/restore drill as the immediate Windows baseline source, then reads the existing law-firm E2E freeze, resource contract freeze, evidence contract freeze, LDD report draft, citation object store, legal approval matrix, and audit event ledger.

It does not execute legal work, record approval decisions, mutate matter/resource/evidence/draft/citation/audit stores, perform workflow transitions, run runtimes, deliver artifacts, provide legal advice, assert legal conclusions, or produce client-facing output.

Expected outputs under `artifacts/law-firm-e2e-report/latest`:

- `law-firm-e2e-report.json`
- `law-firm-e2e-sources.json`
- `law-firm-e2e-scenario-rows.json`
- `law-firm-e2e-chain-stages.json`
- `law-firm-e2e-gate-results.json`
- `law-firm-e2e-report-boundary.json`
- `validation-report.json`
- `summary.md`

Run:

```bash
npm run law-firm:e2e-report -- --check
```
