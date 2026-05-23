# Control Plane Human Gate Receipt Validation

`Control Plane Human Gate Receipt Validation`은 사람이 채운 human gate receipt input을 적용하기 전에 검사한다. 이 단계는 evidence 승인, output 발송, merge, delivery closeout 같은 protected action을 실행하지 않고, 적용 가능한 receipt만 `validated-human-gate-receipts.json`으로 분리한다.

## 실행

```bash
npm run control-plane:human-gate-receipts:validate
```

검증 완료 receipt를 gate ledger에 반영하려면 다음 application 단계를 실행한다.

```bash
npm run control-plane:human-gate-receipts:apply
```

검증 결과를 actor별 reviewer queue로 되돌리려면 application 전에 feedback 단계를 실행한다.

```bash
npm run control-plane:review-feedback
```

feedback을 actor별 editable correction receipt input으로 바꾸려면 이어서 correction workspace를 생성한다.

```bash
npm run control-plane:review-corrections
```

correction workspace actor input을 다시 validation input으로 합치려면 merge 단계를 실행한다.

```bash
npm run control-plane:review-corrections:merge
```

병합된 correction receipt input을 다시 human gate validation에 넣으려면 다음 shortcut을 실행한다.

```bash
npm run control-plane:review-corrections:validate
```

옵션:

```bash
npm run control-plane:human-gate-receipts:validate -- \
  --receipt-drafts artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json \
  --receipt-input artifacts/control-plane-human-gate-receipts/latest/receipt-input-draft.json \
  --out-dir artifacts/control-plane-human-gate-receipt-validation/latest
```

출력:

- `control-plane-human-gate-receipt-validation.json`: validation ledger
- `validated-human-gate-receipts.json`: future application stage로 넘길 검증 완료 receipt 묶음
- `summary.md`: 사람이 읽는 검증 요약

## 검증 규칙

- `pending` receipt는 적용 가능하지 않고 `pending_receipt`로 유지된다.
- non-pending receipt는 `resolved`, `deferred`, `rejected`, `failed`, `cancelled` 중 하나여야 한다.
- `outcome`은 gate type별 allowed outcome 안에 있어야 한다.
- `decided_by`, `decided_at`, `decision_reference`, `decision_notes` 등 requirement가 요구하는 필드를 채워야 한다.
- protected action 또는 receipt-required gate는 `protected_action_reference`가 필요하다.
- unknown gate id를 가진 receipt는 `unknown_human_gate`로 차단된다.

## Dashboard/API

Dashboard는 `control_plane_human_gate_receipt_validation` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/human-gate-receipt-validations`
- `GET /api/human-gate-receipt-errors`
- `GET /api/human-review-validation-feedbacks`
- `GET /api/human-review-feedback-items`
- `GET /api/human-review-correction-workspace-merges`
- `GET /api/human-review-correction-merge-items`
- `GET /api/human-review-merged-correction-receipt-input`
- `GET /api/human-review-correction-validations`
- `GET /api/human-review-correction-validation-items`
- `GET /api/human-review-correction-validation-errors`
- `GET /api/human-review-actor-feedback`
- `GET /api/human-review-correction-workspaces`
- `GET /api/human-review-correction-actors`
- `GET /api/human-review-correction-items`
- `GET /api/human-review-correction-receipt-input`
- `GET /api/validated-human-gate-receipts`
- `GET /api/human-gate-receipt-applications`
- `GET /api/applied-human-gate-receipts`
- `GET /api/patched-human-gate-items`

## Goal 내 위치

이 단계는 Human Approval과 Audit Trail 사이의 검증 관문이다. 사람이 작성한 receipt라도 곧바로 gate를 닫지 않고, contract와 policy에 맞는 행만 다음 단계로 넘긴다.
