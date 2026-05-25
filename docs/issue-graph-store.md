# Issue Graph Store

Phase 141은 P140 Fact Claim Store의 `fact-claim.v2` rows를 attorney-reviewable `issue.v2` 후보와 legal rule placeholder, risk severity assessment로 연결한다.

이 단계는 법률 결론을 만들지 않는다. fact에서 issue 후보를 만들고, 어떤 법률 검토 범주와 위험도 검토가 필요한지만 구조화한다. legal rule row는 모두 `requires_attorney_confirmation` 상태로 남고, issue는 client-facing output에 쓰이기 전 human review gate를 통과해야 한다.

## Outputs

- `artifacts/issue-graph-store/latest/issue-graph-store.json`
- `artifacts/issue-graph-store/latest/issues.json`
- `artifacts/issue-graph-store/latest/fact-issue-bindings.json`
- `artifacts/issue-graph-store/latest/legal-rules.json`
- `artifacts/issue-graph-store/latest/issue-legal-rule-bindings.json`
- `artifacts/issue-graph-store/latest/risk-severity-assessments.json`
- `artifacts/issue-graph-store/latest/issue-review-queue.json`
- `artifacts/issue-graph-store/latest/issue-graph-indexes.json`
- `artifacts/issue-graph-store/latest/validation-report.json`
- `artifacts/issue-graph-store/latest/summary.md`

## Gate

P141 gate는 다음을 통과해야 한다.

- Fact Claim Store가 `complete` 상태다.
- 모든 fact claim에서 issue 후보가 1개씩 생성된다.
- 모든 issue가 fact binding, legal rule binding, risk severity assessment, review queue item을 가진다.
- issue가 fact의 matter, classification, policy snapshot, evidence link를 보존한다.
- legal rule placeholder와 risk severity assessment는 attorney review required 상태로 남는다.
