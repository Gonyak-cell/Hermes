# Extractor Adapter Contract

Phase 137 gives every parser/OCR extractor a shared adapter boundary before downstream Resource/Evidence workflows consume normalized text.

Run:

```sh
npm run resource:extractor-adapters -- --check
```

Outputs:

- `extractor-adapter-contract.json`
- `extractor-adapters.json`
- `extractor-io-contracts.json`
- `extractor-document-type-bindings.json`
- `ocr-fallback-policies.json`
- `normalized-text-bindings.json`
- `validation-report.json`
- `summary.md`

The contract keeps extractor execution local-only by default, preserves tenant/matter/classification fields, binds P136 normalized text artifacts back to the extractor that produced them, and requires PDF OCR fallback to remain local or manual unless a separate policy snapshot explicitly authorizes external processing.
