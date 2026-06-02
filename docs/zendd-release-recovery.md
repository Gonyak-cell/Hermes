# Zendd Release Recovery

`project:zendd-release-recovery` is the P681-P700 release and recovery bridge
for Zendd inside Hermes.

The command is read-only. It does not execute Zendd commands, run database
migrations, package Electron, export client reports, publish releases, execute
rollback, validate recovery receipts, apply approvals, or promote PASS.

```bash
npm run project:zendd-release-recovery -- --check
```

Use `--zendd-root <path>` to point at a different external Zendd checkout:

```bash
npm run project:zendd-release-recovery -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-release-recovery/latest` unless
`--check` is used:

- `zendd-release-recovery.json`
- `release-recovery-policy.json`
- `release-claim-rows.json`
- `recovery-scenario-rows.json`
- `rollback-target-rows.json`
- `protected-release-action-rows.json`
- `recovery-receipt-rows.json`
- `release-recovery-closeout-rows.json`
- `release-recovery-gate-rows.json`
- `validation-report.json`
- `summary.md`

## Release Rule

Zendd release, package, migration, client-export, rollback, and recovery claims
remain documented BLOCK unless they have release evidence, command evidence,
reviewer/hard gate, human receipt, and rollback target.

Failures are modeled as recovery scenarios, not silent retries. Each scenario
keeps a rollback target, recovery receipt ref, block reason, owner, and next
allowed action.
