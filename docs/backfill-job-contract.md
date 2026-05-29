# Backfill Job Contract

Phase 277 locks the backfill job schema before new resource expansion phases continue.

The contract validates the existing `resource-expansion-job.json` shape without running a backfill. It requires stable job identity, source binding, cursor and resumability fields, batch fields, summary counts, and a policy snapshot id. The report is read-only and keeps the Windows baseline posture explicit so Mac and Windows absolute path differences do not make completed phases unstable.

Generated artifacts:

- `artifacts/backfill-job-contract/latest/backfill-job-contract.json`
- `artifacts/backfill-job-contract/latest/backfill-job-field-requirements.json`
- `artifacts/backfill-job-contract/latest/backfill-job-source-bindings.json`
- `artifacts/backfill-job-contract/latest/backfill-job-cursor-contracts.json`
- `artifacts/backfill-job-contract/latest/backfill-job-batch-contracts.json`
- `artifacts/backfill-job-contract/latest/backfill-job-count-contracts.json`
- `artifacts/backfill-job-contract/latest/backfill-job-policy-bindings.json`
- `artifacts/backfill-job-contract/latest/validation-report.json`

Command:

```bash
npm run resource:backfill-job-contract -- --check
```

This command does not execute connector runtime, perform source ingest, read source file contents, mutate source or resource records, deliver output, execute protected actions, generate legal advice, or create client-facing output.
