# Error/Retry Ledger

`Error/Retry Ledger`는 ErrorRecord v2를 운영자가 처리 가능한 상태 장부로 분리한다. 이 단계는 실패를 재실행하지 않고, failure, retry, timeout, resume state를 각각 별도 record family로 투영한다.

## 산출물

- `artifacts/error-retry-ledger/latest/error-retry-ledger.json`
- `artifacts/error-retry-ledger/latest/projected-error-records.json`
- `artifacts/error-retry-ledger/latest/retry-records.json`
- `artifacts/error-retry-ledger/latest/timeout-records.json`
- `artifacts/error-retry-ledger/latest/resume-state-records.json`
- `artifacts/error-retry-ledger/latest/validation-report.json`
- `artifacts/error-retry-ledger/latest/summary.md`

## 실행

```bash
npm run observability:errors -- --check
```

## 불변 조건

- 모든 ErrorRecord v2는 projected error, retry, timeout, resume-state record를 각각 1개씩 가진다.
- projected error는 `observability_trace_id`와 `correlation_trace_id`에 binding된다.
- `auto_retry_scheduled`는 항상 `false`로 유지한다.
- blocking error는 사람이 승인하거나 operator resolution을 남기기 전까지 resume blocked 상태다.
