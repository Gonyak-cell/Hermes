# Dashboard/API Freeze

Phase 296 emits `dashboard_api_freeze`, a read-only freeze report for the Review Dashboard and Review API surface. It checks API Route Inventory, Review Dashboard IA, the dashboard build artifact, representative Review API smoke probes, route fixtures, and the P295 Cost/Observability Dashboard guard.

Run `npm run dashboard:api-freeze -- --check` to verify `artifacts/dashboard-api-freeze/latest/dashboard-api-freeze.json`, source rows, the Desktop-ready API contract, route probes, route fixtures, boundary, checks, validation report, and summary markdown.

The freeze is report-only: it does not ingest sources, mutate dashboard/API state, execute routes, start a server, apply approvals, execute protected actions, deliver output, generate legal advice, or produce client-facing output.
