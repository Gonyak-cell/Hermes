# Hermes Roadmap P13401-P13800 Observability And Cost Plane

P13401-P13800은 P13400 Enterprise Trust Hardening Control Plane 다음 단계다. 목표는 Hermes가 여러 SaaS/project workflow에서 test duration, flaky checks, review latency, token and cost, evidence freshness, gate failures, validation drift를 읽기 전용 운영 지표로 추적할 수 있게 만드는 것이다.

이 단계는 observability signal을 표준화하지만 telemetry collector, metric write, budget mutation, external provider call, deployment, production PASS, enterprise PASS, enterprise trust claim, protected closeout, Codex final approval, Claude final approval을 열지 않는다.

P13400 source가 `ready_for_p13401_handoff=false`이면 P13800은 ready가 아니라 explicit BLOCK으로 남아야 한다. P13800은 operator가 "왜 느린지", "어떤 gate가 자주 실패하는지", "어떤 evidence가 오래됐는지", "어떤 validation drift가 있는지"를 볼 수 있게 하지만, 자동으로 승인하거나 비용 정책을 바꾸지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P13401-P13440 | P13400 Source Binding | Enterprise Trust Hardening source, blocked handoff, no-trust/no-write boundary를 고정한다. | `observability_source_binding_rows` |
| P13441-P13480 | Test Duration Signal | test command id, duration ms, started at, completed at, exit status, timeout state를 정의한다. | `test_duration_signal_rows` |
| P13481-P13520 | Flaky Check Signal | historical pass/fail count, retry count, quarantine status, owner route, flake reason, stability window를 정의한다. | `flaky_check_signal_rows` |
| P13521-P13560 | Review Latency Signal | review requested at, review completed at, review engine, finding count, turnaround minutes, stale review blocker를 정의한다. | `review_latency_signal_rows` |
| P13561-P13600 | Token And Cost Signal | engine id, input token count, output token count, estimated cost, budget policy ref, cost overrun blocker를 정의한다. | `token_cost_signal_rows` |
| P13601-P13640 | Evidence Freshness Signal | evidence ref, generated at, freshness ttl, stale evidence blocker, source binding, uncited memory blocker를 정의한다. | `evidence_freshness_signal_rows` |
| P13641-P13680 | Gate Failure Signal | gate id, failure count, last failure reason, blocking severity, owner route, next action ref를 정의한다. | `gate_failure_signal_rows` |
| P13681-P13720 | Validation Drift Signal | validator id, expected status, observed status, drift detected at, schema version, drift blocker를 정의한다. | `validation_drift_signal_rows` |
| P13721-P13760 | Read-Only Projection Surface | read-only API row, dashboard row, phase status rollup, blocker summary, metric snapshot ref, no metric mutation을 정의한다. | `observability_projection_rows` |
| P13761-P13800 | Observability And Cost Freeze | source, duration, flaky, review latency, token/cost, evidence freshness, gate failure, validation drift, projection, authority guard를 freeze한다. | `p13800_freeze_rows` |

## Observability And Cost Contract

- Test duration rows include test command id, duration ms, started at, completed at, exit status, timeout state.
- Flaky check rows include historical pass/fail count, retry count, quarantine status, owner route, flake reason, stability window.
- Review latency rows include review requested at, review completed at, review engine, finding count, turnaround minutes, stale review blocker.
- Token and cost rows include engine id, input token count, output token count, estimated cost, budget policy ref, cost overrun blocker.
- Evidence freshness rows include evidence ref, generated at, freshness ttl, stale evidence blocker, source binding, uncited memory blocker.
- Gate failure rows include gate id, failure count, last failure reason, blocking severity, owner route, next action ref.
- Validation drift rows include validator id, expected status, observed status, drift detected at, schema version, drift blocker.
- Projection rows include read-only API row, dashboard row, phase status rollup, blocker summary, metric snapshot ref, no metric mutation.
- Authority guards include no metric write, no telemetry collector start, no budget mutation, no external provider call, no raw source exposure, no production PASS, no enterprise trust claim, no final automated approval.

## Completion Criteria

```text
P13400 source 없음 = BLOCK
P13400 ready_for_p13401_handoff=false = P13800 ready 아님
test duration signal 없음 = BLOCK
flaky check signal 없음 = BLOCK
review latency signal 없음 = BLOCK
token/cost signal 없음 = BLOCK
evidence freshness signal 없음 = BLOCK
gate failure signal 없음 = BLOCK
validation drift signal 없음 = BLOCK
read-only projection 없음 = BLOCK
metric write 없음
telemetry collector start 없음
budget mutation 없음
external provider call 없음
raw transcript/source exposure 없음
enterprise trust claim 없음
production PASS 없음
enterprise PASS 없음
protected closeout 없음
deployment 없음
release approval 없음
write/protected action 없음
connector write 없음
runtime execution 없음
Codex/Claude final approval 없음
P13801 Product Ops Automation handoff는 P13400 source가 ready일 때만 가능
```
