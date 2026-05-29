# Creative Document Layout Validator

Phase 260 adds a deterministic, report-only layout validator for Creative and Document Domain Pack outputs.

The validator reads the DOCX, PPTX, and PDF/HTML renderer artifacts and emits layout target rows, layout validation result rows, and flattened layout validation check rows. It checks page count, slide overflow, broken table signals, source hashes, review gates, and no-delivery/no-protected-action safety gates.

The workflow does not execute a renderer, call a network service, mutate registries, deliver output, perform protected actions, generate legal advice, or mark anything client-facing ready. Every result remains an attorney-reviewable draft validation artifact.

Outputs are written under `artifacts/layout-validator/latest`:

- `layout-validator.json`
- `layout-targets.json`
- `layout-validation-results.json`
- `layout-validation-checks.json`
- `validation-report.json`
- `summary.md`
