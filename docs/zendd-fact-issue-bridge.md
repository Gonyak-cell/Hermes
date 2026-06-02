# Zendd Fact Issue Bridge

`project:zendd-fact-issue-bridge` is the P601-P620 bridge that turns Zendd
fact-engine, issue-linkage, source-span, and client-output trace outputs into
Hermes claim rows.

The command is read-only. It does not run Zendd, move Zendd code, copy raw VDR
material, copy raw client documents, or store raw fact text in Hermes.

```bash
npm run project:zendd-fact-issue-bridge -- --check
```

Use `--zendd-root <path>` to point at a different external Zendd checkout:

```bash
npm run project:zendd-fact-issue-bridge -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-fact-issue-bridge/latest` unless
`--check` is used:

- `zendd-fact-issue-bridge.json`
- `fact-issue-bridge-policy.json`
- `fact-claim-rows.json`
- `issue-bridge-rows.json`
- `conflict-fixture-rows.json`
- `fact-issue-review-binding-rows.json`
- `fact-issue-freeze-rows.json`
- `validation-report.json`
- `summary.md`

## PASS Rule

A Zendd fact or issue cannot PASS because it is generated, ready, accepted,
linked, or complete. PASS requires:

- fact ref
- source contract ref
- stable source ref
- evidence ref
- redacted summary ref
- issue linkage
- reviewer or hard gate
- human receipt for protected legal/client-facing outputs

## Fail-Closed Fixtures

The bridge blocks missing source spans, contradictory sources, stale VDR
classification, cross-matter source mixing, unsupported client-facing
sentences, and privileged source exposure. Every blocked row records
`block_reason`, `responsible_owner`, and `next_allowed_action`.
