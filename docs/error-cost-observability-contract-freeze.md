# Error/Cost/Observability Contract Freeze

Phase 108은 실패, retry, token 사용량, 비용, latency를 운영 가능한 관측 계약으로 고정한다.

## 목적

이 phase는 기존 observability, token, cost, budget alert ledger를 세 가지 안정적인 v2 계약군으로 투영한다.

- `ErrorRecord v2`
- `CostObservation v2`
- `TraceProjection v2`

목표는 human review 때문에 막힌 run을 모두 시스템 장애로 취급하는 것이 아니다. 목표는 blocked run, failed gate, retry 상태, token 추정, cost projection, latency 측정값을 구조화된 데이터로 조회 가능하게 만드는 것이다.

## 산출물

`npm run contracts:observability`를 실행하면 다음 산출물이 생성된다.

- `artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json`
- `artifacts/error-cost-observability-contract-freeze/latest/error-record-v2-fixture.json`
- `artifacts/error-cost-observability-contract-freeze/latest/cost-observation-v2-fixture.json`
- `artifacts/error-cost-observability-contract-freeze/latest/trace-projection-v2-fixture.json`
- `artifacts/error-cost-observability-contract-freeze/latest/validation-report.json`
- `artifacts/error-cost-observability-contract-freeze/latest/summary.md`

## 계약

`ErrorRecord v2`는 run blocker, failed gate, severity, retry 가능성, retry 횟수, policy snapshot, actor, source reference를 포함한 운영 실패 상태를 기록한다.

`CostObservation v2`는 budget attribution, token usage, alert status, projected USD, observed runtime seconds, token count, cost source id, matter/runtime/capability ownership을 기록한다.

`TraceProjection v2`는 workflow run 하나에 대한 event id, audit id, agent run id, error id, cost id, token id, latency, retry state, projected cost, total token count를 기록한다.

## Gate

이 phase는 다음 조건을 만족할 때만 완료로 본다.

- Phase 107 Event/Audit/Run Ledger freeze가 complete 상태다.
- Observability, token usage, cost budget, cost attribution, budget alert source가 모두 사용 가능하다.
- 모든 RunLedger v2가 TraceProjection v2를 가진다.
- 모든 cost attribution record가 CostObservation v2를 가진다.
- blocked run과 failed gate가 ErrorRecord v2 projection을 가진다.
- 모든 trace가 latency와 retry status를 가진다.
- validation failed row가 0개다.
