# Zendd Review Receipts

`project:zendd-review-receipts` is the P621-P640 bridge that models human review
receipts for protected Zendd fact, issue, source, and client-output claims.

The command is read-only. It does not collect receipt payloads, materialize
receipt workspaces, apply approvals, or change protected claim verdicts.

```bash
npm run project:zendd-review-receipts -- --check
```

Use `--zendd-root <path>` to point at a different external Zendd checkout:

```bash
npm run project:zendd-review-receipts -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-review-receipts/latest` unless
`--check` is used:

- `zendd-review-receipts.json`
- `review-receipt-policy.json`
- `receipt-template-rows.json`
- `receipt-queue-rows.json`
- `receipt-validation-rule-rows.json`
- `receipt-workspace-rows.json`
- `receipt-approval-plan-rows.json`
- `receipt-closeout-rows.json`
- `receipt-freeze-rows.json`
- `validation-report.json`
- `summary.md`

## Receipt Boundary

Receipt templates and queues are not approvals. A protected Zendd claim remains
BLOCKED until a human receipt payload is supplied, validated, and bound to the
claim/evidence scope.

Required receipt fields include human reviewer identity, reviewer role, claim
ID, evidence ref, explicit verdict, review timestamp, scope statement, and
signature or acknowledgement ref.
