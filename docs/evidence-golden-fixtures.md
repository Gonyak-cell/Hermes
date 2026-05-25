# Evidence Golden Fixtures

Phase 151 locks representative evidence extraction cases for LDD, meeting minutes, contract negotiation, and client email follow-up material.

The fixture runner is deterministic and local-only. It does not call an LLM, OCR service, or external API. It checks that each golden case:

- declares expected terms and a stable source span locator
- produces a local evidence candidate with `needs_review`
- resolves a current Evidence Item Store candidate
- preserves the classification floor
- receives a regression hash

Command:

```sh
npm run evidence:golden-fixtures -- --check
```

Outputs are written under `artifacts/evidence-golden-fixtures/latest/`.
