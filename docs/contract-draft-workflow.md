# Contract Draft Workflow

Phase 249 adds a deterministic contract draft workflow for law-firm matter operations.

이 워크플로는 Project Alpha의 협상 포인트, RFI 질문, 회의 액션 아이템을 읽어 내부 검토용 계약 조항 초안 행을 만듭니다. 생성되는 문구는 최종 계약 문구가 아니며, 변호사 검토와 파트너 승인이 끝나기 전에는 의뢰인 제출물이나 상대방 송부용 산출물로 사용할 수 없습니다.

## Inputs

- `examples/project-alpha-matter.json`
- `artifacts/ldd-rfi-generator/latest/ldd-rfi-generator.json`
- `artifacts/meeting-minutes-workflow/latest/meeting-minutes-workflow.json`
- `package.json`
- `docs/final-completion-phase-ledger.md`

## Outputs

- `contract-draft-workflow.json`
- `contract-draft-rules.json`
- `contract-draft-packets.json`
- `contract-clause-drafts.json`
- `contract-client-positions.json`
- `contract-clause-consistency-checks.json`
- `contract-attorney-review-gates.json`
- `contract-draft-issue-links.json`
- `contract-draft-matter-summaries.json`
- `contract-draft-workflow-boundary.json`
- `validation-report.json`
- `summary.md`

## Safety Gates

- 모든 행은 `matter_id`로 범위가 고정됩니다.
- 모든 조항 초안은 source reference, client position, consistency check, attorney review gate, issue link를 가져야 합니다.
- `client_facing_ready`, `contract_delivery_ready`, `legal_conclusion_asserted`, `legal_advice_provided`, `matter_data_write_allowed`, `task_state_write_allowed`, `workflow_transition_allowed`, `runtime_execution_allowed`, `delivery_execution_allowed`, `protected_action_allowed`는 모두 false로 유지됩니다.
- Desktop 표면은 읽기 전용 projection이며 source of truth가 아닙니다.
