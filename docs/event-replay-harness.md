# Event Replay Harness

Event Replay Harness는 append-only event store를 다시 읽어 Hermes Control Plane의 핵심 projection이 같은 값으로 재구성되는지 검증하는 운영용 회귀 장치다. 이 phase의 목적은 runtime을 다시 실행하는 것이 아니라, 이미 기록된 event만으로 event stream, workflow run summary, dashboard metric을 deterministic하게 재생할 수 있음을 증명하는 것이다.

## 입력

- `artifacts/append-only-event-store/latest/append-only-event-store.json`
- `artifacts/event-correlation/latest/event-correlation-ledger.json`
- `artifacts/workflow-run-ledger/latest/workflow-run-ledger.json`
- `artifacts/dashboard/latest/review-dashboard.json`
- `package.json`
- `docs/implementation-roadmap.md`

Dashboard 입력은 선택 사항이다. `--no-review-dashboard`를 주면 source ledger 값만으로 replay를 검증한다.

## 출력

- `event-replay-harness.json`: 전체 replay harness artifact
- `replayed-event-streams.json`: event stream별 replay 결과
- `replayed-run-summaries.json`: run ledger별 replay summary
- `dashboard-replay-projection.json`: dashboard-facing metric 재구성 결과
- `validation-report.json`: source, replay, dashboard drift validation
- `summary.md`: 사람이 읽는 요약

## 검증 규칙

- stored event 수와 replayed event 수가 같아야 한다.
- source event stream 수와 replayed event stream 수가 같아야 한다.
- stream sequence gap이 없어야 한다.
- global append-only hash chain의 sequence, previous hash, event hash, chain hash가 깨지면 안 된다.
- workflow run ledger record 수와 replayed run summary 수가 같아야 한다.
- replayed run summary의 event count와 terminal state가 source workflow run ledger와 같아야 한다.
- dashboard projection metric은 source ledger 값과 일치해야 하며, dashboard가 있으면 dashboard summary 값과도 일치해야 한다.

## 명령

```bash
npm run events:replay -- --check
```

주요 옵션:

```bash
npm run events:replay -- --no-review-dashboard --check
npm run events:replay -- --out-dir artifacts/event-replay/latest
```

## 운영 의미

이 harness가 통과하면 이벤트 기반 운영 계층이 단순 write log가 아니라 재생 가능한 시스템 기록으로 동작한다는 뜻이다. 향후 retention/archive ledger, ledger API, observability freeze 단계에서는 이 replay 결과를 기준으로 drift와 regression을 잡는다.
