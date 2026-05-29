# Connector Freeze

`connectors:freeze` writes the Phase 276 Connector Freeze artifact.

This stage reads the completed P267-P275 connector artifacts and produces a read-only freeze report. It does not execute connectors, access live source systems, read credential material, mutate source/resource/billing/matter/task/workflow state, deliver output, execute protected actions, or produce legal/client-facing output.

The freeze emits:

- connector freeze source rows for Connector Contract v2 and each P268-P275 connector artifact
- representative connector ingest path rows
- freeze gate rows for contract coverage, cursor resumability, auth boundaries, source projection, mutation/delivery boundaries, and dashboard/API/loop binding
- a freeze boundary row
- freeze checkpoints
- validation and summary artifacts

Outputs are written under `artifacts/connector-freeze/latest/`.

- `connector-freeze.json`
- `connector-freeze-sources.json`
- `connector-freeze-ingest-paths.json`
- `connector-freeze-gates.json`
- `connector-freeze-boundary.json`
- `connector-freeze-checkpoints.json`
- `freeze-note.json`
- `validation-report.json`
- `freeze-note.md`
- `summary.md`

Validation command:

```powershell
npm run connectors:freeze -- --check
```

All connector outputs remain internal operational artifacts requiring human review where applicable. The freeze is not legal advice and is not approved for client delivery.
