# Exhibit Mapping

Phase 146은 P145 Evidence Flags 위에 별첨 번호 체계를 얹는다. 각 evidence flag record는 `별첨 n` 참조와 `EX-000n` label을 가진 exhibit record 하나로 승격되고, 그 exhibit는 evidence item, citation object, output paragraph, lineage path에 각각 deterministic binding을 가진다.

이 단계의 목적은 보고서나 소송서면이 나중에 citation renderer를 붙이기 전에 이미 어떤 별첨번호가 어떤 근거에 연결되는지 검증 가능하게 만드는 것이다.

## 산출물

- `artifacts/exhibit-map/latest/exhibit-map.json`
- `artifacts/exhibit-map/latest/exhibit-records.json`
- `artifacts/exhibit-map/latest/exhibit-bindings.json`
- `artifacts/exhibit-map/latest/exhibit-indexes.json`
- `artifacts/exhibit-map/latest/validation-report.json`
- `artifacts/exhibit-map/latest/summary.md`

## Gate

- 모든 evidence flag record는 exhibit record 하나를 가져야 한다.
- 모든 exhibit record는 evidence, citation, output paragraph, lineage path binding을 모두 가져야 한다.
- matter, classification, policy snapshot은 상위 evidence chain에서 보존되어야 한다.
- 모든 exhibit는 attorney review 전까지 `not_client_facing` 상태여야 한다.
- 외부전송 승인 필요 상태는 exhibit summary와 API filter에서 보존된다.
