# Control Plane Work Packet Receipt Drafts

`Control Plane Work Packet Receipt Drafts`는 work packet을 닫기 전에 사람이 어떤 확인값을 기록해야 하는지 정리한다. protected action, human review, command rerun 결과를 자동으로 완료 처리하지 않고, pending receipt row로만 남긴다.

## 실행

```bash
npm run control-plane:work-receipts
```

옵션:

```bash
npm run control-plane:work-receipts -- \
  --work-packets artifacts/control-plane-work-packets/latest/control-plane-work-packets.json \
  --out-dir artifacts/control-plane-work-packet-receipts/latest
```

출력:

- `control-plane-work-packet-receipt-drafts.json`: receipt requirement와 input draft 계약
- `receipt-input-draft.json`: 사람이 채울 pending receipt row 목록
- `summary.md`: 사람이 읽는 요약

## Receipt Draft

각 receipt row는 다음 기본 필드를 가진다.

- `receipt_status`
- `resolved_by`
- `resolved_at`
- `resolution_reference`
- `resolution_notes`
- `completed_work_item_ids`

packet 성격에 따라 `reviewer`, `protected_action_reference`, `command_result`, `commands_run`이 추가된다.

## Dashboard/API

Dashboard는 `control_plane_work_packet_receipts` stage를 표시하고 summary에 receipt draft 수를 포함한다. Review API는 다음 route를 제공한다.

- `GET /api/work-packet-receipt-requirements`
- `GET /api/work-packet-receipt-drafts`

예:

```bash
node scripts/review-api.mjs --once "/api/work-packet-receipt-drafts?receipt_status=pending"
node scripts/review-api.mjs --once "/api/work-packet-receipt-requirements?protected_action=true"
```

## Goal 내 위치

이 단계는 Work Packet handoff의 audit 준비 계층이다. 실제 완료 적용은 하지 않지만, 나중에 packet closeout validation/application을 만들 수 있도록 receipt 입력 계약을 먼저 고정한다.
