# Zendd Operator Surface

`project:zendd-operator-surface` is the P661-P680 read-only operator
projection for the Zendd-Hermes integration program.

The command consumes the P521-P660 Zendd integration gates in memory and turns
their rows into a common operator shape:

- claim
- current verdict
- missing evidence
- missing reviewer or receipt
- hard gate result
- block reason
- next allowed action

```bash
npm run project:zendd-operator-surface -- --check
```

Use `--zendd-root <path>` to point at a different external Zendd checkout:

```bash
npm run project:zendd-operator-surface -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-operator-surface/latest` unless
`--check` is used:

- `zendd-operator-surface.json`
- `operator-claim-rows.json`
- `operator-filter-rows.json`
- `operator-dashboard-projection-rows.json`
- `operator-api-projection-rows.json`
- `operator-missing-input-rows.json`
- `operator-next-action-rows.json`
- `operator-audit-rows.json`
- `operator-closeout-rows.json`
- `operator-gate-rows.json`
- `operator-surface-boundary.json`
- `source-tranche-summaries.json`
- `validation-report.json`
- `summary.md`

## Safety Boundary

This phase does not start a server, register live API routes, mutate dashboard
source, execute Zendd commands, copy raw VDR or client documents, read secrets,
validate receipts, apply approvals, or promote PASS.

The API and dashboard rows are projection contracts only. They define the data
shape Hermes can safely expose later while keeping every protected Zendd claim
blocked until evidence, reviewer or hard gate, and human receipt are present.
