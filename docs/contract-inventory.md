# Contract Inventory

Phase 97 starts the Core Contracts, Schema, Migration Spine track by inventorying the current contract surface.

Run:

```bash
npm run contracts:inventory
```

Outputs:

- `artifacts/contract-inventory/latest/contract-inventory.json`
- `artifacts/contract-inventory/latest/schema-inventory.json`
- `artifacts/contract-inventory/latest/script-output-contracts.json`
- `artifacts/contract-inventory/latest/dashboard-api-artifacts.json`
- `artifacts/contract-inventory/latest/owner-map.json`
- `artifacts/contract-inventory/latest/summary.md`

The inventory covers:

- every JSON schema in `schemas/`
- every package script in `package.json`
- every expected artifact declared by the control-plane loop
- every dashboard source contract
- every Review API route declared in the route index
- every dashboard/loop artifact path that acts as an output contract
- an owner map for each inventory item

The owner map is heuristic by design in Phase 97. Its purpose is to make the current contract surface visible before the later dependency map, migration policy, and version compatibility phases tighten ownership further.

Dashboard/API surfaces:

- Dashboard source/stage: `contract_inventory`
- Goal checkpoint: `control-plane-contract-inventory`
- API routes:
  - `/api/contract-inventories`
  - `/api/contract-inventory-items`
  - `/api/contract-schemas`
  - `/api/contract-artifacts`
  - `/api/contract-owner-map`

Completion criteria:

- schema, package script, loop output contract, dashboard source, API route, artifact contract, and owner map counts are all non-zero
- all schema files parse
- dashboard source ids and API route ids are unique
- every inventory item has exactly one owner map entry
- validation error count is zero
