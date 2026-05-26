# Evidence Plane Freeze

Evidence Plane Freeze는 Resource/Data/Evidence/Lineage Plane의 내부 완료 상태를 고정하는 검증 산출물이다. 이 단계는 법률 판단이나 고객 전달을 승인하지 않는다. 대표 resource가 evidence, output, event/run ledger, custody event까지 연결되는지 확인하고, attorney review 전에는 delivery와 external transfer가 막혀 있음을 증명한다.

## Command

```bash
npm run resource:evidence-plane-freeze -- --check
```

기본 출력 위치:

- `artifacts/evidence-plane-freeze/latest/evidence-plane-freeze.json`
- `artifacts/evidence-plane-freeze/latest/freeze-source-statuses.json`
- `artifacts/evidence-plane-freeze/latest/freeze-checkpoints.json`
- `artifacts/evidence-plane-freeze/latest/representative-traces.json`
- `artifacts/evidence-plane-freeze/latest/freeze-note.md`

## Freeze Inputs

P158은 P133-P157 산출물을 읽기 전용으로 검사한다. 추가로 Law Firm LDD Slice, Output/Delivery Contract Freeze, Event/Audit/Run Ledger Contract Freeze를 읽어 representative trace를 만든다.

대표 trace는 다음 경로를 요구한다.

```text
Resource -> Source Span -> Evidence Item -> Citation -> Output Artifact -> Event Record -> Run Ledger -> Custody Event
```

## Guardrails

- source artifact mutation 금지
- protected action 실행 금지
- external delivery 실행 금지
- external model call 실행 금지
- auto approval 금지
- client-facing ready는 항상 0
- law-firm output은 attorney review 전 `blocked_pending_approval` 상태 유지

## API Routes

- `/api/evidence-plane-freezes`
- `/api/evidence-plane-freeze-sources`
- `/api/evidence-plane-freeze-checkpoints`
- `/api/evidence-plane-representative-traces`
- `/api/evidence-plane-freeze-validations`

## Human Review Note

이 freeze는 하네스 내부 품질/통제 기준을 만족했다는 뜻이다. 법률 자문, 제출, 고객 전달, filing, 외부 전송은 별도 human approval object와 delivery gate를 통과해야 한다.
