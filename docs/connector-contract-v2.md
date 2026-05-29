# Connector Contract v2

`connectors:contract-v2` writes the Phase 267 connector interface contract.

The contract is report-only. It does not execute connectors, read credential material, access external systems, ingest source data, mutate resources, deliver outputs, or create legal/client-facing work product.

The v2 interface standardizes four fields for every planned connector family:

- Stable `source_id` scoped by tenant, matter, and source system.
- Resumable cursor state with `last_seen_external_id`, high-watermark, and hashed resume token fields.
- External ID namespace mapped to Resource v2 `external_id` and ResourceVersion v2 `external_version_id`.
- Auth boundary with credential-reference-only handling and least-privilege scopes.

Outputs are written under `artifacts/connector-contract-v2/latest/`:

- `connector-contract-v2.json`
- `connector-interface-schema.json`
- `connector-definitions.json`
- `connector-source-contracts.json`
- `connector-cursor-contracts.json`
- `connector-external-id-contracts.json`
- `connector-auth-boundaries.json`
- `validation-report.json`
- `summary.md`

Human review, matter boundary, classification, policy snapshot, no-legal-advice, and no-client-facing-output gates remain required for downstream connector work.
