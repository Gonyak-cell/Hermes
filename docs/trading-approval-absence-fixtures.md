# Trading Approval Absence Fixtures

Status: P383 command specification.

`trading:approval-absence-fixtures` consumes the P382 route inventory fixtures
and verifies that missing human approvals keep every future live or automated
Trading path blocked. The command does not complete approvals, accept receipts,
promote stages, enable routes, execute orders, or write broker/exchange state.

## Command

```sh
npm run trading:approval-absence-fixtures -- --check
```

`--check` validates the approval absence fixtures without overwriting existing
artifacts. Without `--check`, generated reports are written under
`artifacts/trading-approval-absence-fixtures/latest/`.

## Covered Absences

- Limited-live approval receipt is absent and limited-live remains disabled.
- Full-auto approval receipt is absent and automatic order submission remains
  disabled.
- First-trade confirmation is absent and live order submission remains blocked.
- Promotion approvals are absent or pending human review, so shadow, limited
  live, full-auto, and model live promotion remain blocked.
- Manual resume and risk override remain human-gated, with the live adapter and
  credential lookup disabled.
