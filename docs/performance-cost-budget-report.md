# Performance/Cost Budget Report

Phase 303 adds a read-only performance/cost budget report over the already stabilized Windows baseline.

The report reads Access Review Report, Cost/Observability Dashboard, Cost Budget Ledger, Workflow Run Ledger, Runtime Freeze, and Control Plane Loop artifacts. It does not execute workflows, start servers, mutate budgets, write cost records, or produce client-facing legal output.

## Output

- `artifacts/performance-cost-budget/latest/performance-cost-budget-report.json`
- `artifacts/performance-cost-budget/latest/performance-cost-budget-sources.json`
- `artifacts/performance-cost-budget/latest/performance-budget-rows.json`
- `artifacts/performance-cost-budget/latest/cost-budget-rows.json`
- `artifacts/performance-cost-budget/latest/performance-cost-budget-gate-results.json`
- `artifacts/performance-cost-budget/latest/performance-cost-budget-boundary.json`
- `artifacts/performance-cost-budget/latest/validation-report.json`
- `artifacts/performance-cost-budget/latest/summary.md`

## Guards

- Batch, workflow, and runtime scopes each have performance and cost/token budget rows.
- Any observed value above the report limit fails the gate.
- Budget mutation, cost mutation, runtime execution, route execution, server start, protected action execution, external transfer, and network access stay disabled.
- Legal/client-facing gates remain human-review-only and not client-facing-ready.
- Windows baseline stability and Mac/Windows completion-instability guards remain explicit in the summary and boundary.
