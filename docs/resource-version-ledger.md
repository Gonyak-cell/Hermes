# Resource Version Ledger

P135 Resource Version Ledger는 `source_system + external_id` 기준으로 ResourceVersion을 묶고, 같은 외부 id 안의 변경본, 중복본, skipped duplicate 후보를 분리해 기록한다.

이 단계는 실제 파일을 수정하지 않는다. P133 Resource Store Interface와 P134 Immutable Object Store Layout을 읽어 다음을 고정한다.

- version family key: `source_system + external_id`
- version event: `version_recorded`, `content_changed`, `duplicate_content`, `duplicate_candidate_skipped`
- version transition: `content_changed` 또는 `duplicate_content`
- duplicate candidate: resource ingest의 `skipped_duplicate` 입력
- object path binding: 모든 ResourceVersion이 P134 raw-source immutable object key에 연결되는지 여부

생성 산출물:

- `resource-version-ledger.json`: ledger contract, family/event/transition/duplicate/binding, validation 전체
- `version-families.json`: external id family별 version set
- `version-events.json`: version 및 duplicate candidate event
- `version-transitions.json`: 같은 external id 안의 version transition
- `duplicate-candidates.json`: skipped duplicate 후보와 기존 content hash 매칭 상태
- `object-path-bindings.json`: ResourceVersion별 immutable object path binding
- `validation-report.json`: P135 validation 결과

이 ledger가 있어야 이후 normalized text, source span, evidence lineage가 같은 외부 파일의 새 버전과 단순 중복을 혼동하지 않는다.
