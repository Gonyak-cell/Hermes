# Approval Inbox

`Approval Inbox`는 Evidence Viewer 기반 approval queue 밖에 흩어진 output/delivery approval blocker를 하나의 사람 검토 inbox로 모은다.

```bash
npm run approval:inbox
```

기본 입력:

- `artifacts/delivery-queue/latest/protected-delivery-queue.json`
- `artifacts/matter-cockpit/latest/matter-cockpit.json`

출력:

- `approval-inbox.json`
- `decision-template.json`
- `summary.md`

Inbox item은 크게 두 종류다.

- `approval_request`: human/attorney/merge approval이 pending인 delivery action
- `gate_blocker_review`: approval 전에 gate blocker를 먼저 풀어야 하는 delivery action

이 단계는 아직 결정을 적용하지 않는다. 다음 단계에서 `decision-template.json`을 읽어 approval decision, gate waiver, audit event, output/delivery 상태 patch를 생성하는 applier로 확장한다.
