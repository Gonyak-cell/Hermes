# Design System Profile

Phase 263 adds a deterministic design-system profile for PPTX report materials. It connects the PPTX template rows from the template registry to the PPTX style profile, asset bindings, renderer output, and version-comparison review packets.

The profile is read-only and report-only. It does not mutate templates, styles, assets, rendered documents, runtime state, delivery gates, or protected files. Every row remains format-validation, human-review, and attorney-review required.

## Outputs

- `artifacts/design-system-profile/latest/design-system-profile.json`
- `artifacts/design-system-profile/latest/design-system-profiles.json`
- `artifacts/design-system-profile/latest/design-system-rules.json`
- `artifacts/design-system-profile/latest/template-design-bindings.json`
- `artifacts/design-system-profile/latest/asset-design-bindings.json`
- `artifacts/design-system-profile/latest/design-review-packets.json`
- `artifacts/design-system-profile/latest/validation-report.json`

## Gates

- PPTX templates must bind to the registered PPTX style profile.
- PPTX asset bindings stay metadata-only and review-gated.
- PPTX renderer output and version-comparison packets are referenced only as read-only source evidence.
- Legal advice, client-facing output, delivery execution, protected action, and external renderer execution remain disabled.
