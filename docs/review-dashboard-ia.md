# Review Dashboard Information Architecture

Phase 288 adds `review_dashboard_ia`, a read-only information architecture map for the Review Dashboard.

It uses the Phase 287 API Route Inventory as its source and maps every Review API route into these navigation sections:

- Overview
- Domain Packs
- Capabilities
- Runs
- Approvals
- Evidence
- Policies
- Cost
- Diagnostics

Command:

```bash
npm run dashboard:ia -- --check
```

Outputs are written under `artifacts/review-dashboard-ia/latest`:

- `review-dashboard-ia.json`
- `review-dashboard-ia-sections.json`
- `review-dashboard-navigation-items.json`
- `review-dashboard-ia-route-bindings.json`
- `review-dashboard-ia-boundary.json`
- `review-dashboard-ia-checks.json`
- `validation-report.json`
- `summary.md`

The IA artifact is inventory-only. It does not build the dashboard, execute routes, start a server, mutate state, execute protected actions, generate legal advice, or create client-facing output.
