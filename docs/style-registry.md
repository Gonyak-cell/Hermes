# Style Registry

Phase 255 adds a deterministic metadata registry for document and creative output style. It records voice, tone, brand, font, and layout rules for the template formats already registered in Phase 254.

The registry is read-only. It does not write template or style files, execute renderers, deliver outputs, mutate core registries, run protected actions, or generate client-facing material.

## Outputs

- `artifacts/style-registry/latest/style-registry.json`
- `artifacts/style-registry/latest/style-profile-records.json`
- `artifacts/style-registry/latest/style-rule-records.json`
- `artifacts/style-registry/latest/template-style-bindings.json`
- `artifacts/style-registry/latest/style-format-coverage.json`
- `artifacts/style-registry/latest/validation-report.json`

## Gates

- All style profiles and template bindings remain human-review required.
- All registered formats remain format-validation required.
- Legal and client-facing outputs stay draft-only until attorney/human approval passes.
- The Windows baseline keeps renderer, delivery, protected action, and style-file writes disabled.
