# Evidence Export Bundle

`Evidence Export Bundle`은 변호사 검토자가 산출물 문단별 근거를 한 번에 확인할 수 있도록 source, citation, coverage, lineage, exhibit 정보를 하나의 read-only bundle로 묶는다.

이 bundle은 고객 제출, 외부 전송, 법원 제출, 최종 의견 제공을 허용하지 않는다. 모든 bundle은 `held_for_attorney_review` 상태이고, 명시적 사람 승인 전에는 `output_delivery_allowed=false`, `external_transfer_allowed=false`, `client_facing_ready=false`를 유지한다.

## 실행

```bash
npm run evidence:export-bundle -- --check
```

출력:

- `evidence-export-bundle.json`: export bundle 계약 전체
- `export-bundles.json`: output paragraph 중심 검토 bundle
- `export-source-packages.json`: source span locator와 preview 패키지
- `export-citation-packages.json`: citation과 draft paragraph 패키지
- `export-coverage-packages.json`: coverage score와 dimension 패키지
- `validation-report.json`: bundle 연결 검증 결과
- `summary.md`: 요약

## Review API Routes

- `GET /api/evidence-export-bundles`
- `GET /api/evidence-export-bundle-records`
- `GET /api/evidence-export-source-packages`
- `GET /api/evidence-export-citation-packages`
- `GET /api/evidence-export-coverage-packages`
- `GET /api/evidence-export-bundle-validations`

## Gate

- 모든 coverage score는 하나의 export bundle에 포함된다.
- 모든 bundle은 source, citation, coverage, lineage, exhibit package를 가져야 한다.
- 모든 source package는 source locator와 preview를 포함해야 한다.
- 모든 citation package는 source-bound 상태여야 한다.
- 모든 coverage package는 coverage dimension을 포함해야 한다.
- matter, classification, policy snapshot이 bundle 전체에서 보존되어야 한다.
- 모든 bundle은 attorney review 전까지 delivery와 external transfer를 차단한다.
