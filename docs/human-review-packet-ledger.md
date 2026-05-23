# Human Review Packet Ledger

`Human Review Packet Ledger`는 Control Plane Human Gates와 Human Gate Receipt Drafts를 읽어 사람이 검토할 묶음을 actor/gate type 단위로 정리한다. 이 단계는 승인, 발송, merge, ERP 반영 같은 protected action을 실행하지 않는다.

```bash
npm run control-plane:review-packets
```

기본 입력:

- `artifacts/control-plane-human-gates/latest/control-plane-human-gates.json`
- `artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json`

출력:

- `artifacts/human-review-packets/latest/human-review-packet-ledger.json`
- `artifacts/human-review-packets/latest/human-review-packets.json`
- `artifacts/human-review-packets/latest/human-review-items.json`
- `artifacts/human-review-packets/latest/summary.md`

## 계약

- `review_packets`: required actor와 gate type별 검토 묶음
- `review_items`: gate item, receipt draft, allowed outcome, required field, next command 연결
- `packet_status`: `pending_human_review`, `blocked_missing_receipt`, `clear`
- `safe_handling.auto_execute_allowed`: 항상 `false`
- `validation`: source 누락 또는 receipt draft 누락을 오류로 기록

## Dashboard/API

Dashboard는 `human_review_packet_ledger` stage와 review packet summary를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/human-review-packet-ledgers`
- `GET /api/human-review-packets`
- `GET /api/human-review-items`

예:

```bash
node scripts/review-api.mjs --once "/api/human-review-packets?required_actor=attorney_or_designated_reviewer"
node scripts/review-api.mjs --once "/api/human-review-items?gate_type=evidence_decision"
```

## Goal 내 위치

이 단계는 `/goal`의 Gate/Approval 계층을 더 실제 운영에 가깝게 만든다. 기존 Human Gate Receipt Draft가 row 단위 입력 계약이라면, Human Review Packet Ledger는 사람이 어떤 묶음을 어떤 순서로 검토해야 하는지 보여주는 control-plane view다.
