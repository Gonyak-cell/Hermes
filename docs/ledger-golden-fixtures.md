# Ledger Golden Fixtures

Phase 175 adds regression-locked ledger fixtures for replay, projection, cost, and audit invariants. The suite is read-only and does not approve legal, client-facing, retry, retention, delivery, or deletion decisions.

## 산출물

- `artifacts/ledger-golden-fixtures/latest/ledger-golden-fixtures.json`
- `artifacts/ledger-golden-fixtures/latest/ledger-golden-cases.json`
- `artifacts/ledger-golden-fixtures/latest/ledger-fixture-matrix.json`
- `artifacts/ledger-golden-fixtures/latest/ledger-regression-manifest.json`
- `artifacts/ledger-golden-fixtures/latest/validation-report.json`
- `artifacts/ledger-golden-fixtures/latest/summary.md`

## Fixture 범위

- Replay: event replay parity, stream verification, hash-chain mismatch 0
- Projection: token projection과 provider cost binding
- Cost: projected cost record와 run cost rollup attribution
- Audit: audit separation binding, event-store binding, protected action execution 0

## 검증

```bash
npm run ledgers:golden-fixtures -- --check
npm run dashboard:build
npm run api:smoke
```

모든 fixture case는 metric assertion이 통과하고 regression hash가 locked 상태여야 한다. Fixture lock은 운영 invariant 고정만 의미하며, 법률 판단이나 대외 산출물 승인을 대체하지 않는다.
