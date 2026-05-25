# Evidence Coverage Score

`Evidence Coverage Score`는 P143 Lineage Graph Builder가 만든 source-to-output path를 기준으로 산출물 문단별 근거 충족도를 계산하는 deterministic artifact다.

## 목적

- 각 output paragraph가 source span, evidence item, fact claim, issue, citation에 연결되어 있는지 확인한다.
- claim, date, party, amount, legal_basis 5개 dimension을 모두 계산한다.
- claim과 legal_basis는 항상 required로 본다.
- date, party, amount는 source/evidence/fact/output에서 signal이 탐지될 때 required로 본다.
- 모든 coverage score는 `needs_review`, `human_review_required=true`, `client_facing_ready=false`로 유지한다.

## 실행

```bash
npm run resource:evidence-coverage -- --check
```

기본 산출물:

- `artifacts/evidence-coverage/latest/evidence-coverage-score.json`
- `artifacts/evidence-coverage/latest/coverage-scores.json`
- `artifacts/evidence-coverage/latest/coverage-dimensions.json`
- `artifacts/evidence-coverage/latest/coverage-indexes.json`
- `artifacts/evidence-coverage/latest/validation-report.json`
- `artifacts/evidence-coverage/latest/summary.md`

## Gate 원칙

- validation error가 없어야 `complete`다.
- 모든 lineage path마다 coverage score가 하나씩 있어야 한다.
- 모든 coverage score마다 5개 dimension이 있어야 한다.
- claim과 legal_basis dimension은 covered여야 한다.
- matter, classification, policy snapshot preservation이 유지되어야 한다.
- missing date/party/amount dimension은 자동 제출 차단 사유가 아니라 human review에서 보완할 coverage signal로 남긴다.

## Dashboard/API

Review Dashboard는 `evidence_coverage_score` stage와 summary metric을 노출한다.

Review API route:

- `GET /api/evidence-coverage-scores`
- `GET /api/evidence-coverage-records`
- `GET /api/evidence-coverage-dimensions`
- `GET /api/evidence-coverage-indexes`
- `GET /api/evidence-coverage-validations`

## Goal 내 위치

이 단계는 Resource/Data/Evidence/Lineage Plane의 coverage scoring slot이다. 법률 산출물의 사실 주장, 날짜, 당사자, 금액, 법률근거가 근거 path와 함께 검토될 수 있게 하며, 최종 판단과 client-facing 사용은 human approval 이후에만 가능하다.
