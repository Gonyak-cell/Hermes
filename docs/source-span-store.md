# Source Span Store

Phase 138 promotes normalized text location maps into queryable `source-span.v2` records.

Run:

```sh
npm run resource:source-spans -- --check
```

Outputs:

- `source-span-store.json`
- `source-spans.json`
- `source-span-locators.json`
- `source-span-location-units.json`
- `source-span-indexes.json`
- `validation-report.json`
- `summary.md`

The store creates whole-document, page, paragraph, line, and char-range spans for every P136 normalized text artifact. Timestamp fields are present on every locator, but file-based resources use `timestamp_status: not_applicable` until a timestamped connector supplies offsets.
