# Extractor Registry

Phase 283 adds a read-only extractor registry and compatibility catalog for the Resource Expansion lane.

The registry records document type, extension, extractor chain, fact schema, cross-document rules, citation rules, confidence policy, fallback policy, and per-resource compatibility rows. It reads the Extractor Adapter Contract, Resource Expansion Job, P281 Batch Classification Result, and P282 Batch Matter Tagging Result.

The phase does not execute extractors or OCR, read source file contents, call external services, use models, mutate resources/state/matter data, deliver output, perform protected actions, generate legal advice, or produce client-facing output. All compatibility rows stay human-review gated.

Run:

```bash
npm run resource:extractor-registry -- --check
```
