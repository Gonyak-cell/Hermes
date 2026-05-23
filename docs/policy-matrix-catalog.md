# Policy Matrix Catalog

`Policy Matrix Catalog`는 `examples/core/policy-matrix.json`을 검증하고 Identity/Policy Plane의 운영 상태를 Dashboard/API가 읽을 수 있는 `policy-matrix-catalog.v1` artifact로 정규화한다.

이 단계는 policy를 prompt 지시가 아니라 실행 전 계약으로 다루기 위한 얇은 slice다. 분류등급, runtime 제한, 외부 모델 전송 정책, tool 권한, output delivery 정책, gate rule을 한곳에서 조회할 수 있게 한다.

## 실행

```bash
npm run policy:catalog
```

검증 실패 시 non-zero로 끝내려면:

```bash
npm run policy:catalog -- --check
```

옵션:

```bash
npm run policy:catalog -- \
  --policy-matrix examples/core/policy-matrix.json \
  --out-dir artifacts/policy-matrix/latest
```

출력:

- `policy-matrix-catalog.json`: dashboard/API가 읽는 catalog 계약
- `policy-rules.json`: classification/runtime/model/tool/output/gate rule 목록
- `summary.md`: 사람이 읽는 요약

## Dashboard/API

Dashboard는 `policy_matrix_catalog` stage를 표시하고 summary에 classification, gate, external-model restriction, validation error count를 반영한다. Review API는 다음 route를 제공한다.

- `GET /api/policy-matrices`
- `GET /api/policy-classifications`
- `GET /api/runtime-policies`
- `GET /api/model-policies`
- `GET /api/tool-policies`
- `GET /api/output-policies`
- `GET /api/gate-policies`

예:

```bash
node scripts/review-api.mjs --once "/api/model-policies?classification=P3_PRIVILEGED"
node scripts/review-api.mjs --once "/api/tool-policies?default_policy=approval_required"
node scripts/review-api.mjs --once "/api/gate-policies?blocking_by_default=true"
```

## Goal 내 위치

이 단계는 `/goal`의 `Identity/Policy` 축을 운영 산출물로 올린다. Domain Pack, Runtime Adapter, Gate, Delivery 단계는 이 catalog를 통해 같은 분류/모델/도구/산출물 정책을 참조할 수 있다.
