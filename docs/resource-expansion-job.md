# Resource Expansion Job

`Resource Expansion Job`은 OneDrive, VDR, 로컬 폴더처럼 파일 수가 많은 source를 Harness의 `Resource/Evidence Plane`으로 올리기 전 실행하는 resumable backfill 계층이다.

이 단계의 목적은 파일 본문을 무작정 LLM에 넣는 것이 아니다. 각 파일을 상태 있는 job item으로 만들고, materialization 필요 파일, secret 후보, unsupported 파일, 중복 파일, extraction 실패 파일을 명시적으로 분리한다.

## 실행

```bash
npm run resource:expand -- --root examples --out-dir artifacts/resource-expansion/latest --batch-size 10 --reset
```

기본 출력:

- `resource-expansion-job.json`: 이번 실행 결과
- `resource-expansion-state.json`: 다음 실행에서 재개할 상태
- `next-batch.json`: 아직 queued 상태인 다음 batch
- `quarantine-queue.json`: 사람이 확인해야 할 파일
- `summary.md`: 사람이 읽는 요약

같은 `--out-dir`로 다시 실행하면 이전 `resource-expansion-state.json`을 읽고 terminal 상태의 파일은 재처리하지 않는다.

## 상태 모델

| Status | 의미 |
| --- | --- |
| `queued` | 처리 대기 |
| `extracted` | hash, classification, normalized text probe, local index event까지 완료 |
| `quarantined` | materialization 필요, secret 후보, unsupported type, 대용량 등으로 보류 |
| `failed` | 읽기 또는 extractor 실패 |
| `skipped_duplicate` | 같은 content hash가 이미 처리됨 |

각 item은 `status_history`를 가진다. 성공한 파일은 `discovered -> queued -> ingested -> classified -> normalized -> indexed -> extracted` 경로를 남긴다.

## Quarantine 기준

초기 기준:

- OneDrive dataless placeholder: `materialization_required`
- `.env`, secret, token, credential, password, private-key 경로: `secret_or_credential_path`
- 등록되지 않은 확장자 또는 legacy type: `unsupported_or_unknown_type:<ext>`
- 기본 크기 제한 초과: `file_too_large_for_default_expansion`

Quarantine 항목은 Evidence OS나 외부 LLM으로 보내지 않는다. 사람이 source, matter, data classification, extractor 필요성을 확인한 뒤 별도 정책으로 해제한다.

## Goal 내 위치

이 job은 `/goal`의 `Resource/Evidence`, `Event/Audit/Run Ledger`, `Gate/Approval`을 연결하기 위한 선행 계층이다.

대량 resource expansion 완료 기준:

1. 모든 파일이 `extracted`, `skipped_duplicate`, `quarantined`, `failed` 중 하나의 terminal status를 가진다.
2. `failed`는 재시도 또는 waiver가 남는다.
3. `quarantined`는 materialization, secret, unsupported, large file 등 이유별 queue로 검토된다.
4. Law Firm Pack으로 승격되는 resource는 `P2_CLIENT_CONFIDENTIAL` 이상 gate를 유지한다.
5. 이후 Evidence OS는 이 job의 `resource_id`, `resource_version_id`, `raw_hash_sha256`, `text_hash_sha256`를 lineage root로 사용한다.
