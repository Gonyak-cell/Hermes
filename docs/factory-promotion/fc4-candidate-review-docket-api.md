# FC.4 Factory Candidate Review Docket API

Status: ready locally and Law Firm OS-style Claude Opus 4.8 max reviewed.
Date: 2026-06-12

## Scope

FC.4 exposes the FC.3 candidate review docket through the read-only Review API:

```bash
node scripts/review-api.mjs --once '/api/factory/candidate-review-docket?limit=1'
```

The route makes candidate review docket rows visible to operators and reviewers
without creating review decisions, approvals, apply authority, source writes,
ledger appends, repository writes, connector writes, deployments, protected
actions, production PASS, or enterprise PASS.

## Route Contract

`GET /api/factory/candidate-review-docket` returns a
`review-api-collection.v1` envelope with:

- `collection: "factory_candidate_review_docket_rows"`
- primary `items`: FC.3 review docket rows
- visible review packet rows for the requested docket rows
- visible review hash-register rows for the requested candidate packets
- negative fixture rows
- source candidate-lane summary
- boundary and summary objects

Supported filters:

- `review_docket_id`
- `review_status`
- `candidate_packet_id`
- `product_id`
- `candidate_manifest_id`
- `preflight_status`
- `next_allowed_action`
- `limit`

## Boundary

These remain false in the route response:

- `review_decision_allowed_now`
- `approval_allowed_now`
- `apply_allowed_now`
- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `persistent_ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- production PASS and enterprise PASS

`GET` and `HEAD` are allowed. Mutation methods return `405 method_not_allowed`.
If the underlying FC.3 candidate review docket is blocked, the route returns
`503 factory_candidate_review_docket_unavailable`.

Filtered responses expose only the review hash-register rows visible for the
requested candidate packet rows. Use the unfiltered route response or the
canonical FC.3 docket artifact when a reviewer needs to verify the full chained
register from its first row.

The route returns a clean `503 factory_candidate_review_docket_unavailable`
when the underlying docket returns a blocked validation result. Unexpected build
exceptions remain fail-closed and follow the same process-level handling pattern
as the sibling factory Review API routes.

## Verification

```bash
node --check src/review-api.mjs
node --test test/factory-candidate-review-docket.test.mjs
node scripts/review-api.mjs --once '/api/factory/candidate-review-docket?limit=1'
git diff --check
```

Observed local result before Claude review:

- FC.3/FC.4 targeted tests: 9/9 pass
- API smoke: 200, collection `factory_candidate_review_docket_rows`, 1 visible
  row with 3 total rows
- approval/apply/write/deploy/trust: false
- mutation methods: 405
- blocked source fixture: 503 fail-closed

## Review Receipt

FC.4 received one valid Law Firm OS-style Claude review:

- receipt doc: `docs/factory-promotion/fc4-claude-opus-4-8-review-receipt.md`
- raw artifact: `artifacts/factory-promotion/fc4-review-lawos-style/raw-output.json`
- normalized receipt: `artifacts/factory-promotion/fc4-review-lawos-style/review-receipt.json`
- verdict: `PASS_WITH_FINDINGS`
- P0/P1/P2 findings: 0
- P3 findings: 3

Claude is independent review evidence only. It is not final approval and does
not open protected-action, production, or enterprise authority.
