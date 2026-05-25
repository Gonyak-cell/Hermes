# Resource Store Interface

P133 Resource Store Interface는 Resource/Data/Evidence 트랙의 첫 공통 저장소 계약이다. 실제 DB나 object store를 만들기 전, registry, ingestion, dashboard가 동일한 Resource v2 / ResourceVersion v2 / store filter 계약을 사용하도록 고정한다.

## 산출물

- `artifacts/resource-store-interface/latest/resource-store-interface.json`
- `artifacts/resource-store-interface/latest/resource-store-records.json`
- `artifacts/resource-store-interface/latest/resource-version-store-records.json`
- `artifacts/resource-store-interface/latest/resource-store-adapter-bindings.json`
- `artifacts/resource-store-interface/latest/resource-store-query-interface.json`
- `artifacts/resource-store-interface/latest/validation-report.json`
- `artifacts/resource-store-interface/latest/summary.md`

## 계약

- canonical resource schema는 `resource-core.v2`, canonical version schema는 `resource-version.v2`이다.
- `resource_store` record는 `resource_id`, `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `content_hash`, `latest_resource_version_id`를 반드시 보존한다.
- `resource_version_store` record는 `resource_version_id`, `resource_id`, `tenant_id`, `matter_id`, `classification`, `content_hash`, `version_status`를 반드시 보존한다.
- registry, ingestion, dashboard adapter binding은 모두 `resource-store-interface.v1`을 참조한다.
- query interface는 `tenant_id`, `matter_id`, `classification`, `resource_id` filter를 retrieval 전 단계에서 요구한다.

## 검증

```bash
npm run resource:store-interface -- --check
```

검증은 Resource Contract Freeze, Resource Ingest, Store Policy Adapter, Identity/Policy/Matter Freeze를 읽고 다음을 확인한다.

- Resource v2와 ResourceVersion v2 fixture가 store record로 1:1 projection되는지
- registry, ingestion, dashboard consumer가 같은 interface contract를 참조하는지
- `resource_store` RLS/filter template과 resource query plan이 존재하는지
- unconfirmed resource query plan이 실행 가능 상태로 열리지 않았는지
- P133 roadmap record와 package script가 등록되었는지
