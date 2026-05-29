# Evidence Viewer UI

`Evidence Viewer UI` is the Phase 290 read-only projection that joins Evidence Viewer Data API cards with source span panels, citation rows, coverage scores, and evidence review flags.

Run:

```bash
npm run evidence:viewer-ui -- --check
```

Outputs:

- `evidence-viewer-ui.json`: complete UI projection contract.
- `evidence-viewer-ui-panels.json`: required panel rows.
- `evidence-viewer-ui-cards.json`: joined evidence cards.
- `evidence-viewer-ui-source-spans.json`: source span preview rows.
- `evidence-viewer-ui-citations.json`: citation review rows.
- `evidence-viewer-ui-coverage.json`: coverage score rows.
- `evidence-viewer-ui-flags.json`: evidence review flag rows.
- `evidence-viewer-ui-boundary.json`: read-only/no-output boundary.
- `validation-report.json`: validation items and errors.

Boundary:

- No source file content is read.
- No source ingest, evidence mutation, citation approval, or output delivery is performed.
- No route execution or server start is performed.
- No legal advice or client-facing output is generated.
- Human-review gates and the Windows baseline stability guard remain active.
