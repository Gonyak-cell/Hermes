# Trading Safety Regression Fixtures

Status: P381 command specification.

`trading:safety-regression-fixtures` consumes the P380 release-check receipt
closeout in memory and declares fail-fast regression fixtures for unsafe Trading
enablement booleans.

The fixtures fail when `limited_live_enabled`, `full_auto_enabled`,
`automatic_order_submission_allowed`, or `live_order_submission_allowed` is
true. The command reads limited-live and full-auto governance artifacts, but it
does not execute trading commands, submit orders, write broker or exchange
state, publish releases, run git, or execute protected actions.

## Command

```sh
npm run trading:safety-regression-fixtures -- --check
```

## Regression Policy

Each regression fixture records the observed governance value, the expected safe
value `false`, and the unsafe value `true`. P381 is ready only while all required
fixtures pass and every unsafe flag remains false.

## Human Review Note

This command is a safety proof surface. It does not grant live, limited-live, or
full-auto permission; later phases add route and secret isolation checks while
the live trading boundary remains disabled.
