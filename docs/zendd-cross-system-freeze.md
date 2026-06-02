# Zendd Cross-System Freeze

`project:zendd-cross-system-freeze` is the P701-P720 top-level freeze for
Zendd-Hermes integration claims. It re-adjudicates P521-P700 outputs by formula:

```text
CLAIM -> EVIDENCE -> REVIEWER / HARD GATE -> HUMAN RECEIPT, if protected
-> PASS or documented BLOCK -> next_allowed_action when BLOCKED
```

The command does not execute Zendd commands, move Zendd code, read secrets, copy
raw VDR/client material, validate receipts, apply approvals, run release or
rollback, or promote PASS.

## Command

```bash
npm run project:zendd-cross-system-freeze -- --check
```

To inspect a different external Zendd checkout:

```bash
npm run project:zendd-cross-system-freeze -- --zendd-root <path>
```

Artifacts are written to `artifacts/zendd-cross-system-freeze/latest` unless
`--check` is used:

- `zendd-cross-system-freeze.json`
- `cross-system-freeze-policy.json`
- `cross-system-freeze-claim-rows.json`
- `cross-system-freeze-audit-rows.json`
- `cross-system-freeze-closeout-rows.json`
- `cross-system-freeze-gate-rows.json`
- `validation-report.json`
- `summary.md`

## Freeze Behavior

- Source `complete`, `ready`, `done`, `approved`, or `governance_complete`
  wording is not treated as PASS by itself.
- PASS requires evidence refs, reviewer or hard gate refs, protected human
  receipt refs when applicable, and unsafe flags false.
- Unsupported pass-like source rows are demoted to documented BLOCK.
- BLOCK rows require `freeze_block_reason`, `responsible_owner`, and
  `next_allowed_action`.
- Protected BLOCK rows must expose a receipt ref or documented human gate state.
- Release, rollback, receipt application, raw material copy, and physical Zendd
  code movement remain disabled.

## Next Phase

P721-P740 should harden protected action rollback gates before any future
release, rollback, receipt application, or physical code integration decision.
