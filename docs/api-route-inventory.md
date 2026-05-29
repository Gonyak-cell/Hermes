# API Route Inventory

Phase 287 adds `api_route_inventory`, a read-only inventory over the Review API route index.

The inventory groups the current `GET` routes into the required `core`, `review`, `evidence`, `policy`, `runtime`, and `desktop_companion` route groups. It reads the live Review API index builder, Contract Inventory, P286 Resource Expansion Freeze, Review API docs, Review Dashboard source, and Desktop Companion integration docs as source evidence.

The artifact is inventory-only. It does not start the API server, execute routes, mutate state, run protected actions, generate legal advice, or create client-facing output.

Run:

```bash
npm run api:route-inventory -- --check
```

Outputs are written under `artifacts/api-route-inventory/latest`:

- `api-route-inventory.json`
- `api-route-groups.json`
- `api-route-records.json`
- `api-route-inventory-boundary.json`
- `api-route-inventory-checks.json`
- `validation-report.json`
- `summary.md`
