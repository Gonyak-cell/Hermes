# Schema Versioning Rules

Phase 109는 Hermes Harness의 schema versioning rule을 고정한다. 목적은 기능이 늘어도 기존 artifact, workflow, output, audit record가 깨지지 않도록 schema 변경 방식을 명시하고 validator로 확인하는 것이다.

## 핵심 규칙

- 모든 신규 schema는 top-level `schema_version` const를 가진다.
- 모든 신규 artifact envelope은 `schema_version`을 required field로 둔다.
- 새 field는 기본적으로 optional로 추가한다.
- 기존 field의 의미를 조용히 바꾸지 않는다.
- field 제거 전에는 deprecation 상태를 먼저 둔다.
- breaking change에는 별도 migration manifest가 필요하다.
- data migration과 index migration은 분리한다.
- adapter와 migration은 알 수 없는 metadata field를 보존한다.
- workflow, output, run ledger는 실행 당시 schema version을 pin할 수 있어야 한다.

## Legacy Exception

현재 `matter.schema.json`과 `dev-projects.schema.json`은 초기 demo schema라 `schema_version` envelope 이전에 만들어졌다. 이 둘은 P109에서 legacy exception으로 명시하되, 새 control-plane artifact가 이 패턴을 복사하지 못하도록 containment를 둔다.

## 산출물

`npm run contracts:versioning`은 다음 산출물을 만든다.

- `artifacts/schema-versioning-rules/latest/schema-versioning-rules.json`
- `artifacts/schema-versioning-rules/latest/schema-versioning-guideline.json`
- `artifacts/schema-versioning-rules/latest/schema-version-records.json`
- `artifacts/schema-versioning-rules/latest/legacy-schema-exceptions.json`
- `artifacts/schema-versioning-rules/latest/validation-report.json`
- `artifacts/schema-versioning-rules/latest/summary.md`

## 완료 기준

- contract inventory가 complete 상태다.
- 모든 non-legacy schema가 `*.vN` 형태의 schema version const를 가진다.
- 모든 non-legacy schema가 top-level `schema_version`을 required field로 가진다.
- schema가 `additionalProperties: false`로 닫혀 있지 않아 optional addition을 막지 않는다.
- legacy schema exception은 reason, containment, migration target을 가진다.
- migration policy가 data migration과 index migration 분리를 요구한다.
- validation failed row가 0개다.
