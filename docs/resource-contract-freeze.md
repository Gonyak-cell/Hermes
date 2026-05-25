# Resource Contract Freeze

Phase 99 fixes the Resource and ResourceVersion contract boundary as a v2 projection.

Run:

```bash
npm run contracts:resources
```

Outputs:

- `artifacts/resource-contract-freeze/latest/resource-contract-freeze.json`
- `artifacts/resource-contract-freeze/latest/resource-contract-v2-fixture.json`
- `artifacts/resource-contract-freeze/latest/resource-version-v2-fixture.json`
- `artifacts/resource-contract-freeze/latest/validation-report.json`
- `artifacts/resource-contract-freeze/latest/summary.md`

The freeze consumes `resource-ingest.json` or `resource-evidence.json` and emits explicit `resource-core.v2` and `resource-version.v2` fixtures. The v2 contract makes these fields non-negotiable:

- `content_hash`
- `source_system`
- `external_id`
- `classification`
- `matter_id`
- `latest_resource_version_id`

Validation is recorded as first-class data. Each Resource and ResourceVersion gets individual validation rows for content hash presence, source-system consistency, external-id preservation, classification, matter link, and version linkage. This lets later migration and backfill phases reason about breaking changes before changing the resource plane.

Integration points:

- Package script: `contracts:resources`
- Dashboard source/stage: `resource_contract_freeze`
- Goal checkpoint: `control-plane-resource-contract-freeze`
- Review API routes: `/api/resource-contract-freezes`, `/api/resource-v2-contracts`, `/api/resource-version-v2-contracts`, `/api/resource-contract-validations`
- Control-plane loop step: `resource_contract_freeze`
