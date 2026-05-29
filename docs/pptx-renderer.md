# PPTX Renderer

Phase 258 adds a deterministic PPTX renderer workflow for the Creative and Document Domain Pack.

The workflow reads the Phase 254 template registry, Phase 255 style registry, Phase 256 asset registry, runtime freeze, Document Renderer adapter, and Output Delivery contract as read-only source contracts. It then generates local draft PPTX artifacts under `artifacts/pptx-renderer/latest`.

Outputs:

- `pptx-renderer.json`: top-level renderer artifact and validation summary.
- `pptx-render-jobs.json`: one render job per registered PPTX template.
- `pptx-slide-templates.json`: deterministic slide template/placeholder records.
- `pptx-slide-decks.json`: draft slide deck manifests.
- `pptx-openxml-parts.json`: hashed OpenXML package parts used to assemble the PPTX files.
- `pptx-output-artifacts.json`: draft PPTX artifact records and binary hashes.
- `pptx-overflow-checks.json`: title, bullet, and slide-count overflow checks.
- `pptx-format-validation-results.json`: ZIP signature, required OpenXML part, review note, overflow, external relationship, and draft-gate validation.
- `summary.md`: operator-facing summary.

The generated `.pptx` files are draft artifacts only. They are not legal advice, are not client-facing, and are not approved for delivery. Attorney review, source attribution, citation review, format validation, and human approval remain required before any downstream use.
