# Resource Ingest Gate

`Resource Ingest Gate`는 `resource-expansion-job.json`의 결과를 core `resource-evidence.v1` 계약으로 승격하는 단계다.

Expansion job은 대량 파일을 안전하게 발견하고 추출하는 backfill 계층이고, Ingest Gate는 그 중 Evidence OS에 올릴 수 있는 항목만 선별한다.

## 실행

```bash
npm run resource:ingest -- --input artifacts/resource-expansion/latest/resource-expansion-job.json --out-dir artifacts/resource-ingest/latest
```

출력:

- `resource-ingest.json`: gate 결과와 승격 결과 전체
- `resource-evidence.json`: core `resource-evidence.v1` 섹션
- `blocked-items.json`: quarantine 또는 failed 항목
- `summary.md`: 사람이 읽는 요약

## 승격 규칙

| Expansion Status | 처리 |
| --- | --- |
| `extracted` | Resource, ResourceVersion, NormalizedText, SourceSpan, EvidenceItem 후보로 승격 |
| `quarantined` | Evidence OS 승격 차단, `blocked-items.json`에 기록 |
| `failed` | Evidence OS 승격 차단, 오류와 함께 기록 |
| `skipped_duplicate` | 승격하지 않고 duplicate report에 기록 |
| `queued` | 아직 처리 전이므로 승격하지 않음 |

이 단계는 LLM 호출이나 법률 판단을 하지 않는다. 단지 extraction 결과를 core 계약의 lineage root로 바꾸고, 사람이 검토해야 할 항목을 gate로 분리한다.

## Gate

현재 gate:

- `resource_expansion_terminal_gate`: quarantine/failed 항목이 있으면 blocking
- `duplicate_resource_gate`: duplicate 항목은 non-blocking review
- `evidence_candidate_gate`: 승격 가능한 extracted 항목이 하나도 없으면 blocking

## Goal 내 위치

이 단계는 `/goal`의 `Resource/Evidence` 계층을 실제 데이터로 채우는 첫 승격 경로다. 다음 단계에서 이 `resource-evidence.json`을 Matter Boundary, Approval, Evidence Viewer와 연결하면, 로펌용 산출물의 citation lineage를 추적할 수 있다.
