# Policy Snapshot Ledger

`Policy Snapshot Ledger`는 각 vertical slice가 실행 시점에 사용한 `policy-snapshot.v1`을 모아 Policy Matrix와 workflow/event/run ledger 사용 기록 사이의 추적선을 만든다.

## Commands

```bash
npm run policy:snapshots
```

검증 실패를 exit code로 받고 싶을 때:

```bash
npm run policy:snapshots -- --check
```

## Outputs

- `artifacts/policy-snapshots/latest/policy-snapshot-ledger.json`: 정규화된 snapshot, policy decision, usage record
- `artifacts/policy-snapshots/latest/policy-snapshot-usages.json`: workflow/event/run ledger별 snapshot reference
- `artifacts/policy-snapshots/latest/summary.md`: 사람이 읽는 요약

## Contract

Ledger는 다음을 확인한다.

- slice의 `identity_policy.policy_snapshots`가 workflow, event, run ledger reference와 연결되는지
- 같은 `policy_snapshot_id`가 서로 다른 rule body를 갖는 conflict가 없는지
- snapshot의 기본 classification이 Policy Matrix Catalog의 model/runtime rule과 맞는지
- snapshot이 matrix에서 forbidden인 runtime을 허용하지 않는지
- snapshot의 외부 모델 전송 정책이 matrix와 어긋나지 않는지

## Dashboard/API

Dashboard는 `policy_snapshot_ledger` stage를 표시하고 snapshot, workflow usage, event reference, runtime violation, validation error count를 summary에 반영한다.

Review API는 다음 route를 제공한다.

- `GET /api/policy-snapshot-ledgers`
- `GET /api/policy-snapshots`
- `GET /api/policy-snapshot-instances`
- `GET /api/policy-decisions`
- `GET /api/policy-usages`

예:

```bash
node scripts/review-api.mjs --once "/api/policy-snapshots?policy_snapshot_id=policy.default.law_firm.v1"
node scripts/review-api.mjs --once "/api/policy-decisions?classification=P2_CLIENT_CONFIDENTIAL"
node scripts/review-api.mjs --once "/api/policy-usages?usage_type=workflow_run"
```

## Goal Position

Phase 49는 Phase 48의 Policy Matrix Catalog를 실행 재현성 계층으로 확장한다. 정책은 단순 문서나 prompt가 아니라 실행 당시 고정된 snapshot으로 남고, 모든 workflow/event/run ledger가 그 snapshot을 참조해야 한다.
