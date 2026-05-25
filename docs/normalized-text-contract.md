# Normalized Text Contract

Phase 136 promotes the ingest-time `normalized-text.v1` records into a source-span-ready artifact contract.

The contract is intentionally deterministic. It does not ask an LLM to infer document locations. Instead it preserves the best available extraction coordinates as char offsets, synthetic or detected page units, paragraph offsets, line offsets, and a whole-document source-span seed.

## Command

```bash
npm run resource:normalized-text -- --check
```

The command writes:

- `normalized-text-contract.json`
- `normalized-text-artifacts.json`
- `normalized-text-location-maps.json`
- `source-span-seeds.json`
- `validation-report.json`
- `summary.md`

## Contract

Each normalized text artifact preserves:

- tenant, matter, classification, resource, and resource version boundary
- Resource Version Ledger family link
- raw-source immutable object key binding
- text hash, extractor, language, quality, and preview/full-text coverage state
- `utf16_code_unit` char offsets for the preview text
- page, paragraph, and line location units
- one source-span seed that P138 can promote into the source span store

This phase does not replace attorney review and does not create legal conclusions. It prepares deterministic text coordinates for later evidence, citation, and lineage gates.
