# ERP Draft Connector

`connectors:erp-draft` writes the Phase 275 ERP draft connector artifact.

This stage reads operator-provided ERP draft export JSON only. It produces internal estimate, invoice, and tax invoice draft candidates and holds every final ERP issue action behind human review. It does not call a live ERP API, access the network, read credential material, issue/post/finalize ERP records, mutate source/resource/billing/matter/task/workflow state, deliver outputs, or produce client-facing work product.

The connector emits:

- ERP account metadata rows
- ERP draft rows for estimate, invoice, and tax invoice drafts
- ERP draft line item rows
- draft-only output candidate rows
- approval hold rows for every final ERP issue action
- draft sequence cursor state with hash-only resume token storage
- credential-reference-only ERP draft-hold auth boundary
- validation and summary artifacts

Outputs are written under `artifacts/erp-draft-connector/latest/`.

- `erp-draft-connector.json`
- `erp-account-records.json`
- `erp-draft-records.json`
- `erp-line-item-records.json`
- `erp-draft-output-records.json`
- `erp-approval-hold-records.json`
- `cursor-state.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

Validation command:

```powershell
npm run connectors:erp-draft -- --check
```

All ERP draft projections remain internal candidates requiring human review. The artifact does not provide legal advice and does not create client-facing output.
