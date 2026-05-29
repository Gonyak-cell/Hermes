# Provided Material Review Ledger

Phase 250 adds a deterministic provided-material review ledger for law-firm matter operations.

이 레저는 VDR 재고, matter document index, LDD document classification, contract draft workflow 문맥을 읽어 Project Alpha 제공자료의 전수검토 상태와 인덱싱 상태를 한 화면에서 추적할 수 있게 합니다. 생성되는 행은 내부 운영 검토용이며 최종 법률 판단, 최종 자료검토 결정, 의뢰인 제출물, 상대방 송부 자료가 아닙니다.

## Inputs

- `artifacts/ldd-vdr-inventory/latest/ldd-vdr-inventory.json`
- `artifacts/matter-document-index/latest/matter-document-index.json`
- `artifacts/ldd-document-classification/latest/ldd-document-classification.json`
- `artifacts/contract-draft-workflow/latest/contract-draft-workflow.json`
- `package.json`
- `docs/final-completion-phase-ledger.md`

## Outputs

- `provided-material-review-ledger.json`
- `provided-material-review-rules.json`
- `provided-material-review-items.json`
- `provided-material-index-statuses.json`
- `provided-material-gap-links.json`
- `provided-material-review-gates.json`
- `provided-material-matter-summaries.json`
- `provided-material-review-boundary.json`
- `validation-report.json`
- `summary.md`

## Safety Gates

- 모든 행은 `matter_id`로 범위가 고정됩니다.
- 누락 또는 요청 상태 자료는 follow-up cue로만 기록하며, 실제 부존재를 단정하지 않습니다.
- 분류값은 routing metadata일 뿐 법률 분석이나 최종 판단이 아닙니다.
- 최종 자료검토 결정, client-facing output, matter/task/workflow/runtime/delivery/protected mutation은 생성하지 않습니다.
- Desktop 표면은 읽기 전용 projection이며 source of truth가 아닙니다.
