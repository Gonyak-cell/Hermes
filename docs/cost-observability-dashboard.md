# Cost/Observability Dashboard

`cost_observability_dashboard` is a read-only Desktop projection for Phase 295. It combines cost budget, token usage, cost attribution, cost record projection, token projection, observability trace projection, error/retry ledger, observability freeze, and the P294 Policy Violation Queue guard.

The dashboard emits cost, token, latency, error, retry, and provider/runtime rollup rows under `artifacts/cost-observability-dashboard/latest`. It does not read source content, ingest sources, write metrics, mutate budgets, control runtimes, execute retries, apply approvals, execute delivery, start routes or servers, generate legal advice, or produce client-facing output.
