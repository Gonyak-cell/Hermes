# Plaud Transcript Connector

`connectors:plaud-transcript` writes the Phase 274 Plaud transcript connector artifact.

This stage reads operator-provided Plaud transcript export JSON. It does not call a live Plaud API, access the network, read credential material, download audio, mutate source/resource/normalized-text state, deliver outputs, or produce client-facing work product.

The connector emits:

- Plaud recording metadata rows
- Plaud speaker rows
- Plaud transcript speaker segment resource candidates
- normalized text rows with speaker labels and timestamp ranges
- timestamp span rows for transcript offsets
- audio metadata resource candidates without audio download
- transcript timestamp cursor state with hash-only resume token storage
- credential-reference-only Plaud auth boundary
- validation and summary artifacts

Outputs are written under `artifacts/plaud-transcript-connector/latest/`.

- `plaud-transcript-connector.json`
- `plaud-recording-records.json`
- `plaud-speaker-records.json`
- `plaud-transcript-segments.json`
- `plaud-normalized-text-records.json`
- `plaud-timestamp-spans.json`
- `plaud-audio-metadata-records.json`
- `cursor-state.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

Validation command:

```powershell
npm run connectors:plaud-transcript -- --check
```

All transcript and audio metadata projections remain internal candidates requiring human review. The artifact does not provide legal advice and does not create client-facing output.
