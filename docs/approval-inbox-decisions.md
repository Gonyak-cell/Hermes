# Approval Inbox Decisions

`Approval Inbox Decisions`는 사람이 채운 Approval Inbox decision file을 읽고, output/delivery 상태에 대한 보호된 patch와 audit event를 생성한다.

```bash
npm run approval:inbox:apply
```

기본 입력:

- `artifacts/approval-inbox/latest/approval-inbox.json`
- `artifacts/approval-inbox/latest/decision-template.json`
- `artifacts/delivery-queue/latest/protected-delivery-queue.json`
- `artifacts/output-catalog/latest/output-catalog.json`

출력:

- `approval-inbox-decision-result.json`
- `patched-delivery-queue.json`
- `patched-output-catalog.json`
- `audit-events.json`
- `summary.md`

결정 규칙:

- `approval_request`: `approve`, `request_changes`, `reject`, `defer`
- `gate_blocker_review`: `mark_resolved`, `waive_for_now`, `keep_blocked`, `defer`

이 단계는 실제 고객 발송, GitHub merge, 이메일 전송, 파일 삭제를 실행하지 않는다. 승인과 gate 판단을 상태 patch로만 반영하고, 이후 Protected Delivery Queue 또는 dashboard에서 사람이 다시 확인하도록 둔다.
