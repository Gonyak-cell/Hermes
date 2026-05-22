# Hermes Vertical Slice Runner

작성일: 2026-05-23

## 목적

6단계 vertical slice runner는 정적인 예시가 아니라 실제 파일 하나를 읽어 Harness의 핵심 계층을 끝까지 통과시키는 최소 실행 경로다.

실행 경로:

```text
local file
→ Resource
→ ResourceVersion
→ NormalizedText
→ SourceSpan
→ EvidenceItem
→ Fact
→ Issue
→ OutputArtifact
→ Citation
→ GateResult
→ Approval
→ AuditEvent
→ EventLedger / RunLedger
```

## 실행

```bash
npm run slice:run
```

또는:

```bash
node scripts/run-vertical-slice.mjs examples/core/sample-board-minutes.md --out-dir artifacts/vertical-slice/latest
```

## 산출물

기본 산출 위치는 `artifacts/vertical-slice/latest`다.

| 파일 | 설명 |
|---|---|
| `vertical-slice.json` | core contracts의 실제 실행 결과 |
| `event-ledger.json` | workflow/run/event/cost ledger |
| `summary.json` | 주요 ID와 상태 요약 |
| `output.md` | evidence-backed issue candidate 초안 |

## 완료 기준

6단계는 다음이 충족되면 완료다.

- 실제 로컬 파일을 읽어 content hash와 normalized text를 만든다.
- source span, evidence, fact, issue, citation을 생성한다.
- output artifact는 citation에 묶이고 `pending_review` 상태로 남는다.
- evidence gate는 통과하고 human approval gate는 pending/blocking으로 남는다.
- event ledger와 run ledger가 같은 `workflow_run_id`로 연결된다.
- 생성된 vertical slice와 event ledger가 기존 core validator를 통과한다.
- `npm run validate`, `npm test`, `npm run slice:run`이 통과한다.
