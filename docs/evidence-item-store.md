# Evidence Item Store

Phase 139는 P138 Source Span Store의 `source-span.v2` rows를 attorney-reviewable `evidence-item.v2` 후보로 승격한다.

이 단계의 원칙:

- source span마다 evidence item 후보를 하나 생성한다.
- `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `resource_id`, `resource_version_id`는 source span에서 그대로 상속한다.
- machine extraction 결과는 자동 승인하지 않고 모두 `needs_review`와 `machine_extracted_pending_review`로 남긴다.
- evidence item과 source span의 연결은 별도 binding row로 보존한다.
- 사람 검토가 필요한 항목은 review queue row로 노출한다.

## Command

```bash
npm run resource:evidence-items -- --check
```

기본 입력은 `artifacts/source-span-store/latest/source-span-store.json`이다.

출력:

- `evidence-item-store.json`
- `evidence-items.json`
- `evidence-source-span-bindings.json`
- `evidence-review-queue.json`
- `evidence-item-indexes.json`
- `validation-report.json`
- `summary.md`

## Completion Gate

P139는 다음을 만족해야 한다.

- Source Span Store가 `complete` 상태다.
- 모든 source span이 evidence item 후보 하나로 materialize된다.
- 모든 evidence item이 source span binding과 review queue row를 가진다.
- matter, classification, policy snapshot이 source span에서 보존된다.
- 자동 승인된 evidence item 수는 0이다.
- dashboard/API/checkpoint/golden fixture/validation suite/control loop가 같은 artifact를 읽는다.
