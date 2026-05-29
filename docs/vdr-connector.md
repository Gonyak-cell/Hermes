# VDR Connector

`connectors:vdr` writes the Phase 273 VDR connector artifact.

This stage reads operator-provided VDR export JSON. It does not call a live VDR API, access the network, read credentials, download document content, mutate permissions, mutate source/resource state, deliver outputs, or produce client-facing work product.

The connector emits:

- VDR room metadata rows
- VDR index revision resource candidates
- VDR document metadata resource candidates
- VDR document version rows
- enforced permission boundary rows
- resource expansion seed rows for later human-reviewed materialization
- VDR index revision cursor state with hash-only resume token storage
- credential-reference-only VDR auth boundary
- validation and summary artifacts

Outputs are written under `artifacts/vdr-connector/latest/`.

- `vdr-connector.json`
- `vdr-room-records.json`
- `vdr-index-records.json`
- `vdr-document-records.json`
- `vdr-version-records.json`
- `vdr-permission-boundaries.json`
- `vdr-resource-expansion-seeds.json`
- `cursor-state.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

Validation command:

```powershell
npm run connectors:vdr -- --check
```

All VDR resource and resource-expansion seed projections remain internal candidates requiring human review before content materialization. The artifact does not provide legal advice and does not create client-facing output.
