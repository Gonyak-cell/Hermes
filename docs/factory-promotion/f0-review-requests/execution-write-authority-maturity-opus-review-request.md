# Independent Review Request: Execution/Write Authority Maturity

You are the independent reviewer lane for Hermes FCORE F0.1.

This is a read-only review. Do not edit files, create commits, apply patches,
stage changes, open PRs, or mark any protected gate as approved.

## Review Target

- Scope ID: `execution_write_authority_maturity`
- Required output receipt:
  `artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json`
- Required current validator command:
  `npm run platform:execution-write-authority-maturity -- --check`
- Required preflight command after receipt creation:
  `npm run factory:receipt-preflight -- --check --require-pass`

## Files To Review

- `src/execution-write-authority-maturity.mjs`
- `scripts/execution-write-authority-maturity.mjs`
- `schemas/execution-write-authority-maturity.schema.json`
- `test/execution-write-authority-maturity.test.mjs`
- `src/connector-external-app-governance.mjs` only as the upstream source contract
- `docs/hermes-roadmap-p15801-p16200.md`
- `docs/architecture.md`
- `CLAUDE.md`
- `REVIEW.md`
- `docs/factory-promotion/f0-receipt-integrity-preflight.md`

## Review Questions

1. Does the module correctly preserve blocked upstream connector governance
   source state without silently converting it to readiness?
2. Does the Claude execution/write authority review receipt gate require the
   current 4-field validator shape, and does it avoid treating request packets
   or planning documents as performed review evidence?
3. Does the module keep receipt application, candidate execution, command
   execution, runtime execution, direct file write, patch apply, protected
   action, connector write, external mutation, deployment, release approval,
   production PASS, enterprise PASS, raw exposure, secret read, and final
   approval authority closed?
4. Do the tests cover ready source, blocked source, missing receipt, missing
   source, authority closure, read-only HTML, and `--check` no-write behavior?
5. Are there any paths where validation errors 0 could mask a real write
   authority opening or forged review receipt?

## Receipt Requirements

Your final receipt must be JSON and must include these exact fields:

```json
{
  "schema_version": "execution-write-authority-claude-review-receipt.v1",
  "review_engine": "claude_code_opus_max",
  "receipt_status": "complete",
  "scope_execution_write_authority_maturity": true,
  "scope_id": "execution_write_authority_maturity",
  "reviewed_commit_sha": "<actual reviewed git commit sha>",
  "prompt_sha256": "<sha256 of this request packet>",
  "raw_output_sha256": "<sha256 of the raw reviewer output>",
  "engine_resolved_model_id": "<actual resolved Opus-family model id>",
  "unresolved_finding_count": 0,
  "findings": [],
  "summary": {
    "review_status": "complete",
    "unresolved_finding_count": 0,
    "blocking_findings": []
  },
  "claude_final_approval_allowed": false,
  "production_pass_enabled": false,
  "enterprise_pass_enabled": false
}
```

If you find any unresolved issue, keep `receipt_status: "complete"` only if the
review was completed, set `unresolved_finding_count` to the actual count, list
the findings, and do not imply approval.
