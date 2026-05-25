# Evidence Regression Tests

Evidence Regression Tests는 Evidence Plane의 extractor, lineage, coverage 결과가 이전 단계의 계약을 깨뜨리지 않는지 확인하는 내부 회귀 검증 산출물이다.

이 산출물은 고객 제출물이 아니며, 변호사 검토 전 산출물 전달이나 외부 전송을 허용하지 않는다.

## Inputs

- Evidence Golden Fixtures
- Extractor Adapter Contract
- Lineage Graph Builder
- Evidence Coverage Score
- Evidence Export Bundle

## Command

```bash
npm run evidence:regression-tests -- --check
```

## 검증 범위

- extractor suite: golden fixture가 lock 상태이고 source span/evidence candidate/store match가 유지되는지 확인
- lineage suite: source span -> evidence -> fact -> issue -> output paragraph 경로가 완전하고 citation binding이 유지되는지 확인
- coverage suite: claim/legal basis 등 coverage dimension과 export bundle backing이 유지되는지 확인
- 모든 회귀 test case에는 sha256 regression hash를 남긴다
- 모든 test case는 local deterministic, read-only, human-review-required 상태로 남긴다

## Review API

- `/api/evidence-regression-tests`
- `/api/evidence-regression-suites`
- `/api/evidence-regression-test-cases`
- `/api/evidence-regression-hashes`
- `/api/evidence-regression-validations`
