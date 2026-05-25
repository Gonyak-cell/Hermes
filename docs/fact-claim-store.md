# Fact Claim Store

Phase 140은 P139 Evidence Item Store의 `evidence-item.v2` rows를 attorney-reviewable `fact-claim.v2` 후보로 승격한다.

이 단계의 핵심 계약은 fact가 독립 추론 결과처럼 떠다니지 않게 하는 것이다. 각 fact claim은 반드시 `evidence_item_ids`와 `primary_evidence_item_id`를 보존하고, supporting evidence의 `reliability`, `matter_id`, `classification`, `policy_snapshot_id`, `source_span_ids`를 그대로 이어받는다.

## Outputs

- `artifacts/fact-claim-store/latest/fact-claim-store.json`
- `artifacts/fact-claim-store/latest/fact-claims.json`
- `artifacts/fact-claim-store/latest/fact-evidence-bindings.json`
- `artifacts/fact-claim-store/latest/fact-review-queue.json`
- `artifacts/fact-claim-store/latest/fact-claim-indexes.json`
- `artifacts/fact-claim-store/latest/validation-report.json`
- `artifacts/fact-claim-store/latest/summary.md`

## Gate

P140 gate는 다음을 통과해야 한다.

- Evidence Item Store가 `complete` 상태다.
- 모든 evidence item에서 fact claim 후보가 1개씩 생성된다.
- 모든 fact claim이 bound evidence binding과 review queue item을 가진다.
- evidence id, reliability, matter, classification, policy snapshot, source span link가 보존된다.
- machine-extracted fact claim은 자동 승인되지 않고 `needs_review`로 남는다.
