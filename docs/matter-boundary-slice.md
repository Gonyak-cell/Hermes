# Matter Boundary Slice

Phase 131 adds a deterministic vertical slice that proves matter boundary controls survive the full path from resource ingest to retrieval gate.

`npm run matter-boundary:slice` reads:

- Resource Ingest
- Resource Contract Freeze
- Matter Access Policy Evaluator
- Access Audit Projection
- Store Policy Adapter
- Policy Operations Surface

It writes `artifacts/matter-boundary-slice/latest/`:

- `matter-boundary-slice.json`
- `resource-boundary-paths.json`
- `retrieval-gate-checks.json`
- `validation-report.json`
- `summary.md`

The slice does not approve or execute retrieval. It checks whether every promoted resource is preserved in Resource v2, receives matter access decisions, is recorded in access audit, compiles to store query plans, and is exposed through policy operations rows.

If Resource Ingest also has quarantined or blocked non-promoted items, the slice can still pass for the promoted subset. Those blocked items remain outside the boundary path until a separate human/resource correction flow promotes them.

For unassigned resources, the expected passing outcome is not retrieval-ready. The resource must remain held behind matter-tagging or human confirmation gates, with zero executable resource query plans. This protects law-firm matter boundaries before retrieval or context construction.

Validation checks:

- every promoted resource has a resource boundary path
- every resource access decision has an access audit record
- every resource access audit record compiles to a store query plan
- every store query plan enforces tenant, matter, classification, policy snapshot, access audit, and resource filters
- missing-filter, cross-matter, and unfiltered retrieval probes are blocked
- policy operations rows expose the same boundary decisions and pending gates
