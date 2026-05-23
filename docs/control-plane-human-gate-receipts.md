# Control Plane Human Gate Receipt Drafts

`Control Plane Human Gate Receipt Drafts`는 Human Gate agenda를 사람이 채울 receipt 입력 양식으로 변환한다. 이 단계는 evidence 승인, output 발송, merge, closeout 같은 protected action을 실행하지 않는다.

## 실행

```bash
npm run control-plane:human-gate-receipts
```

옵션:

```bash
npm run control-plane:human-gate-receipts -- \
  --human-gates artifacts/control-plane-human-gates/latest/control-plane-human-gates.json \
  --out-dir artifacts/control-plane-human-gate-receipts/latest
```

출력:

- `control-plane-human-gate-receipt-drafts.json`: gate별 receipt requirement와 input draft 계약
- `receipt-input-draft.json`: 사람이 채울 pending receipt row 목록
- `summary.md`: 사람이 읽는 요약

## Receipt Draft

각 receipt row는 다음 기본 필드를 가진다.

- `receipt_status`
- `outcome`
- `decided_by`
- `decided_at`
- `decision_reference`
- `decision_notes`
- `completed_action_refs`

gate 성격에 따라 `reviewer`, `protected_action_reference`, `command_result`, `commands_run`이 추가된다. 모든 row는 기본 `pending`이며, pending row는 gate를 닫거나 protected action을 실행하지 않는다.

## Dashboard/API

Dashboard는 `control_plane_human_gate_receipts` stage를 표시하고 summary에 receipt draft 수를 포함한다. Review API는 다음 route를 제공한다.

- `GET /api/human-gate-receipts`
- `GET /api/human-gate-receipt-requirements`
- `GET /api/human-gate-receipt-drafts`

다음 검증 단계는 `npm run control-plane:human-gate-receipts:validate`가 담당한다.

## Goal 내 위치

이 단계는 `/goal`의 Human Approval, Gate/Approval, Audit 원칙을 연결한다. 사람이 내린 결정이 나중에 ledger로 적용될 수 있도록 입력 계약을 먼저 만들고, 실행은 별도 검증 단계 전까지 막아둔다.
