# Source Span Inspector

`Source Span Inspector` is the Phase 291 read-only inspector that compares source span locator metadata, normalized text preview metadata, and extracted fact claims.

Run:

```bash
npm run evidence:source-span-inspector -- --check
```

Outputs:

- `source-span-inspector.json`: complete inspector contract.
- `source-span-inspector-panels.json`: required inspector panel rows.
- `source-span-inspector-rows.json`: one row per source span.
- `source-span-location-comparisons.json`: locator and location-unit comparison rows.
- `normalized-text-comparisons.json`: normalized text preview and object-key comparison rows.
- `extracted-fact-comparisons.json`: extracted fact claim comparison rows.
- `source-span-inspector-boundary.json`: read-only/no-source-read boundary.
- `validation-report.json`: validation items and errors.

Boundary:

- No source file content is read.
- No normalized text object is read beyond existing contract metadata and preview.
- No source ingest, fact mutation, or output delivery is performed.
- No route execution or server start is performed.
- No legal advice or client-facing output is generated.
- Human-review gates and the Windows baseline stability guard remain active.
