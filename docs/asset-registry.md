# Asset Registry

Phase 256 adds a deterministic metadata registry for creative and document assets. It registers image, logo, graph, table, and video asset classes as managed artifact metadata and binds them to the DOCX, PPTX, HTML, and email template surface.

The registry does not import media files, write binary assets, generate images or videos, execute renderers, deliver outputs, mutate core registries, run protected actions, or produce client-facing material.

## Outputs

- `artifacts/asset-registry/latest/asset-registry.json`
- `artifacts/asset-registry/latest/asset-records.json`
- `artifacts/asset-registry/latest/asset-type-records.json`
- `artifacts/asset-registry/latest/asset-artifact-policies.json`
- `artifacts/asset-registry/latest/template-asset-bindings.json`
- `artifacts/asset-registry/latest/asset-format-coverage.json`
- `artifacts/asset-registry/latest/validation-report.json`

## Gates

- Every asset remains metadata-only for this phase.
- Every asset and binding requires source attribution, license review, accessibility text, format validation, and human review.
- Legal and client-facing outputs stay draft-only until attorney/human approval passes.
- The Windows baseline keeps asset ingestion, binary writes, media generation, renderer execution, delivery, and protected actions disabled.
