# Evidence Flags

Phase 145는 P144 Evidence Coverage Score 위에 human-review 전용 flag ledger를 추가한다. 목적은 자동추출 상태와 사람 확인 상태를 분리하고, privilege/redaction/external-transfer 판단을 산출물 생성 전에 명시적으로 보존하는 것이다.

## Command

```bash
npm run resource:evidence-flags -- --check
```

## Outputs

- `artifacts/evidence-flags/latest/evidence-flags.json`
- `artifacts/evidence-flags/latest/evidence-flag-records.json`
- `artifacts/evidence-flags/latest/flag-decisions.json`
- `artifacts/evidence-flags/latest/flag-indexes.json`
- `artifacts/evidence-flags/latest/validation-report.json`
- `artifacts/evidence-flags/latest/summary.md`

## Contract

- `evidence-flags.v1`: 전체 artifact
- `evidence-flag-record.v1`: coverage score별 flag row
- `evidence-flag-decision.v1`: extraction, human confirmation, privilege, redaction, external transfer decision
- `evidence-flag-indexes.v1`: matter/classification/flag별 count projection

## Safety Rules

- `machine_extracted`와 `pending_human_confirmation`은 별도 flag로 기록한다.
- 모든 record는 `needs_review`, `not_client_facing`, `client_facing_ready=false`를 유지한다.
- P2 client confidential 자료는 external transfer ready가 아니라 approval-required 상태로 둔다.
- P3-P5 또는 민감 signal은 redaction/external transfer gate에서 blocked 또는 review-required 상태로 둔다.
- matter, classification, policy snapshot은 coverage score에서 flag record까지 보존되어야 한다.

## Dashboard And API

Review Dashboard는 `evidence_flags` stage와 summary metric을 노출한다.

Review API는 다음 route를 제공한다.

- `GET /api/evidence-flags`
- `GET /api/evidence-flag-records`
- `GET /api/evidence-flag-decisions`
- `GET /api/evidence-flag-indexes`
- `GET /api/evidence-flag-validations`
