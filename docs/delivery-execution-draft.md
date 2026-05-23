# Delivery Execution Draft

`Delivery Execution Draft`는 `ready_for_delivery` 상태가 된 delivery action을 실제로 실행하지 않고, 사람이 최종 확인할 실행 초안 packet으로 묶는다.

```bash
npm run delivery:execution:draft
```

기본 입력:

- `artifacts/approval-inbox-decisions/latest/patched-delivery-queue.json`
- `artifacts/approval-inbox-decisions/latest/patched-output-catalog.json`

출력:

- `delivery-execution-draft.json`
- `execution-packets.json`
- `summary.md`

이 단계의 기본값은 항상 `draft_only`다. GitHub merge, 고객 발송, 이메일 전송, 문서 전달 같은 protected action은 실행하지 않는다. 대신 delivery channel/target/matter별 packet과 final checklist를 생성해 사람이 검토하고 별도로 실행하도록 한다.
