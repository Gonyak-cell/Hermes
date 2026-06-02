# Zendd Source Contract Bridge

`project:zendd-source-contract` is the P581-P600 bridge between Hermes resource
analysis gates and Zendd VDR/LDD source gates.

The command is read-only. It compares the two systems, records cross-system
improvement rows, and creates source contract rows that allow Hermes to track
Zendd VDR/LDD sources without copying raw source material.

```bash
npm run project:zendd-source-contract -- --check
```

Use `--zendd-root <path>` to point at a different external Zendd checkout:

```bash
npm run project:zendd-source-contract -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-source-contract/latest` unless
`--check` is used:

- `zendd-source-contract.json`
- `source-contract-policy.json`
- `gate-comparison-rows.json`
- `vdr-ldd-source-contract-rows.json`
- `cross-gate-improvement-rows.json`
- `source-review-binding-rows.json`
- `source-freeze-rows.json`
- `validation-report.json`
- `summary.md`

## Gate Difference

Hermes resource gates are domain-neutral. Their strength is quarantine,
duplicate detection, extraction evidence, stable resource IDs, and operator
surfaces.

Zendd VDR/LDD gates are legal-domain gates. Their strength is matter-scoped VDR
classification, LDD source control, fact-span tracing, issue linkage, citation
tracking, and Korean client-output quality.

P581-P600 does not choose one gate over the other. It records how each should
improve the other:

- Hermes should learn legal source-control blocker codes and fact-span evidence
  types from Zendd.
- Zendd should learn Hermes quarantine lineage, duplicate evidence refs,
  PASS/BLOCK wording, and operator next-action surfaces.
- Both systems should share redacted evidence refs, output hashes, review gates,
  human receipt requirements, and documented BLOCK rows.

## Safety Rules

- Raw VDR files, raw client documents, full OCR text, `.env` values, and secret
  values cannot be copied into Hermes.
- Hermes receives `stable_source_ref`, `evidence_ref`,
  `redacted_summary_ref`, reviewer/gate refs, and human receipt refs only.
- Every protected source row remains BLOCKED until source evidence, review or
  hard gate, and human receipt are present.
- A source claim cannot PASS because Zendd says it is ready, done, complete, or
  accepted.
