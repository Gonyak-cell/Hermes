# Zendd Client Output Gate

`project:zendd-client-output-gate` is the P641-P660 fusion of Zendd Korean
client-output quality gates and Hermes protected-output review gates.

The command is read-only. It does not generate client output, copy client
documents, apply receipts, or mark protected client-facing claims as PASS.

```bash
npm run project:zendd-client-output-gate -- --check
```

Use `--zendd-root <path>` to point at a different external Zendd checkout:

```bash
npm run project:zendd-client-output-gate -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-client-output-gate/latest` unless
`--check` is used:

- `zendd-client-output-gate.json`
- `client-output-gate-policy.json`
- `client-output-claim-rows.json`
- `korean-language-quality-rows.json`
- `citation-gate-rows.json`
- `client-exposure-control-rows.json`
- `client-receipt-binding-rows.json`
- `client-output-freeze-rows.json`
- `validation-report.json`
- `summary.md`

## Protected Client Output

Client-facing Zendd output cannot PASS merely because it was generated,
accepted, ready, or marked complete. PASS requires source trace, fact claim,
issue ref, citation ref, Korean quality gate evidence, reviewer ref, and human
receipt.

The gate blocks weak Korean wording, vague internal-review phrasing,
unsupported sentences, citationless legal conclusions, raw client document
exposure, privileged detail exposure, unscoped facts, and secret/env exposure.
