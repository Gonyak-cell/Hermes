# Extractor Coverage Report

Phase 284 adds `extractor_coverage_report`, a read-only aggregation over Resource Expansion, P280 quarantine decisions, P281 batch classification, and the P283 Extractor Registry.

The report answers three operational questions before any extractor execution:

- Which document types and extensions are covered by the registry?
- What processing, coverage, failure, quarantine, and unsupported-type rates exist for the current batch?
- Which rows require human review before later extraction phases can proceed?

Run it with:

```bash
npm run resource:extractor-coverage -- --check
```

The output is written to `artifacts/extractor-coverage-report/latest/extractor-coverage-report.json` and companion row files for document types, extensions, statuses, unsupported types, failure/hold rows, checks, and validation.

The phase is report-only. It does not execute extractors, read source file contents, run OCR, call external services, use the network, mutate resources or state, produce legal advice, or create client-facing output.
