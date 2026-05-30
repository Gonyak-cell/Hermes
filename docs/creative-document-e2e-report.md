# Creative Document E2E Report

Phase 307 adds `creative_document_e2e_report`, a deterministic read-only acceptance report for the representative creative-document workflow.

The report verifies this chain:

- template
- render
- layout
- approval
- output artifact

It reads the P306 Personal Dev E2E Report as the prior Windows baseline, the P266 Creative Document Freeze, and the underlying creative-document template, renderer, layout, approval, and output-delivery artifacts.

Outputs are written under `artifacts/creative-document-e2e-report/latest`:

- `creative-document-e2e-report.json`
- `creative-document-e2e-sources.json`
- `creative-document-e2e-scenario-rows.json`
- `creative-document-e2e-chain-stages.json`
- `creative-document-e2e-gate-results.json`
- `creative-document-e2e-report-boundary.json`
- `validation-report.json`
- `summary.md`

The artifact is report-only. It does not mutate templates, styles, assets, source artifacts, renderer state, document runtime state, approval state, delivery state, protected actions, legal advice, or client-facing output.
