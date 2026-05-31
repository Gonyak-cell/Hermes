# Platform Reproducibility Proof Index

Phase 358 records the reproducibility proof index after the P357 evidence
matrix.

`platform:reproducibility-proof-index` consumes P357 reproducibility evidence
matrix in memory and maps each evidence row to expected proof references such as
check summaries, validation transcripts, release freeze outputs, ledger
declarations, and human review notes. It does not materialize proof, read
artifacts, collect evidence, run checks, execute release-check commands, install
dependencies, regenerate artifacts, import history, change checkout state,
perform git operations, submit trading orders, or execute protected actions.

Default output path:

- `artifacts/platform-reproducibility-proof-index/latest/platform-reproducibility-proof-index.json`
- `artifacts/platform-reproducibility-proof-index/latest/reproducibility-proof-rows.json`
- `artifacts/platform-reproducibility-proof-index/latest/reproducibility-proof-gate-rows.json`
- `artifacts/platform-reproducibility-proof-index/latest/reproducibility-proof-boundary.json`
- `artifacts/platform-reproducibility-proof-index/latest/validation-report.json`
- `artifacts/platform-reproducibility-proof-index/latest/summary.md`

Check mode:

```bash
npm run platform:reproducibility-proof-index -- --check
```

`--check` validates the proof index without writing or overwriting artifacts.
Missing package script registration, validation-chain registration, source
evidence matrix readiness, P358 ledger acceptance, or future P359-P360
reservation blocks the proof index.
