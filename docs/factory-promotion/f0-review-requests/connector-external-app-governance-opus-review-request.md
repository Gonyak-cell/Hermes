# Independent Review Request: Connector External App Governance

You are the independent reviewer lane for Hermes FCORE F0.1.

This is a read-only review. Do not edit files, create commits, apply patches,
stage changes, open PRs, or mark any protected gate as approved.

## Review Target

- Scope ID: `connector_external_app_governance`
- Required output receipt:
  `artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json`
- Required current validator command:
  `npm run platform:connector-external-app-governance -- --check`
- Required preflight command after receipt creation:
  `npm run factory:receipt-preflight -- --check --require-pass`

## Files To Review

- `src/connector-external-app-governance.mjs`
- `scripts/connector-external-app-governance.mjs`
- `schemas/connector-external-app-governance.schema.json`
- `test/connector-external-app-governance.test.mjs`
- `src/saas-factory-mode.mjs` only as the upstream source contract
- `docs/hermes-roadmap-p15401-p15800.md`
- `docs/architecture.md`
- `CLAUDE.md`
- `REVIEW.md`
- `docs/factory-promotion/f0-receipt-integrity-preflight.md`

## Review Questions

1. Does the module correctly preserve blocked upstream source state without
   silently converting it to readiness?
2. Does the Claude review receipt gate require the current 4-field validator
   shape, and does it avoid treating request packets or planning documents as
   performed review evidence?
3. Does the module keep connector, credential, secret, raw export, ingestion,
   mutation, deployment, protected closeout, production PASS, enterprise PASS,
   runtime execution, and final approval authority closed?
4. Do the tests cover ready source, blocked source, missing receipt, missing
   source, authority closure, read-only HTML, and `--check` no-write behavior?
5. Are there any paths where validation errors 0 could mask a real authority
   opening or forged review receipt?

## Receipt Requirements

Your final receipt must be JSON and must include these exact fields:

```json
{
  "schema_version": "connector-governance-claude-review-receipt.v1",
  "review_engine": "claude_code_opus_max",
  "receipt_status": "complete",
  "scope_connector_external_app_governance": true,
  "scope_id": "connector_external_app_governance",
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
