# Immutable Object Store Layout

P134 Immutable Object Store Layout는 raw source와 generated output이 같은 저장소 안에서 충돌하거나 덮어써지지 않도록 하는 deterministic path resolver 계약이다.

이 단계는 실제 파일을 복사하거나 외부 object storage를 붙이지 않는다. 대신 Resource Store Interface와 OutputArtifact/Delivery v2 계약을 읽어 다음을 고정한다.

- raw source namespace: `object-store/immutable/raw-source`
- generated output namespace: `object-store/immutable/generated-output`
- tenant, matter, namespace, stable id, content hash를 모두 포함하는 object key
- 절대 로컬 경로는 metadata로만 보존하고 object key에는 넣지 않는 규칙
- overwrite 금지와 duplicate object key 발생 시 실패하는 collision policy

생성 산출물:

- `immutable-object-store-layout.json`: layout contract, resolver, path catalog, collision report, validation 전체
- `object-path-resolvers.json`: raw source/generated output resolver contract
- `raw-source-object-paths.json`: ResourceVersion store record별 raw source object key
- `generated-output-object-paths.json`: OutputArtifact별 generated output object key
- `object-store-collision-report.json`: object key collision report
- `validation-report.json`: P134 validation 결과

이 계약이 있어야 이후 P135 resource versioning, P136 normalized text, P138 source span store가 실제 파일 위치를 임의 문자열로 다루지 않고 같은 immutable layout 아래에서 동작한다.
