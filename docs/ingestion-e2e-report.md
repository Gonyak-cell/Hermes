# Ingestion E2E Report

Phase 308 adds `ingestion_e2e_report`, a deterministic read-only acceptance report for the representative connector/resource expansion ingestion workflow.

The report verifies this chain:

- connector
- backfill
- quarantine
- evidence
- dashboard

It reads the P307 Creative Document E2E Report as the prior Windows baseline, Connector Freeze, Resource Expansion Freeze, backfill/cursor/dedup/quarantine ledgers, Evidence Item Store, Resource/Evidence Dashboard, Expansion Status Dashboard, and Evidence Plane Freeze.

Outputs are written under `artifacts/ingestion-e2e-report/latest`:

- `ingestion-e2e-report.json`
- `ingestion-e2e-sources.json`
- `ingestion-e2e-scenario-rows.json`
- `ingestion-e2e-chain-stages.json`
- `ingestion-e2e-gate-results.json`
- `ingestion-e2e-report-boundary.json`
- `validation-report.json`
- `summary.md`

The artifact is report-only. It does not execute connectors, backfill, ingestion, extraction retry, quarantine release, dashboard routes, delivery, protected actions, legal advice, or client-facing output.
