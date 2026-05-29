# PDF/HTML Renderer

Phase 259 adds a deterministic PDF/HTML renderer workflow for the Creative and Document Domain Pack.

The workflow reads the Phase 254 template registry, Phase 255 style registry, Phase 256 asset registry, runtime freeze, Document Renderer adapter, and Output Delivery contract as read-only source contracts. It then generates local draft HTML preview and PDF export artifacts under `artifacts/pdf-html-renderer/latest`.

Outputs:

- `pdf-html-renderer.json`: top-level renderer artifact and validation summary.
- `pdf-html-render-jobs.json`: one render job per registered HTML template.
- `html-preview-artifacts.json`: deterministic draft HTML preview artifacts.
- `pdf-export-artifacts.json`: deterministic draft PDF export artifacts.
- `pdf-html-output-artifacts.json`: shared output artifact records for HTML and PDF outputs.
- `pdf-html-format-validation-results.json`: HTML/PDF format, review note, external-link, and draft-gate validation rows.
- `summary.md`: operator-facing summary.

The generated `.html` and `.pdf` files are draft artifacts only. They are not legal advice, are not client-facing, and are not approved for delivery. Attorney review, source attribution, citation review, format validation, and human approval remain required before any downstream use.
