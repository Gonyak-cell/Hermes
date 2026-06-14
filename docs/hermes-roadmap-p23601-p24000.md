# Hermes Roadmap P23601-P24000 Receipt Workbench Operator Dashboard Screen Contract

P23601-P24000은 P23600 Receipt Workbench Dashboard Handoff Smoke 이후의 read-only handoff rows를 operator dashboard screen contract로 투영하는 단계다. 목표는 화면 슬롯, interaction state checklist, read-only data binding, screen resilience guard, no-action boundary를 고정해 operator UI가 무엇을 보여야 하는지 검증하되, 실제 UI implementation, server start, route handler, live fetch, click action, write, approval, receipt completion으로 승격하지 않는 것이다.

이 단계는 actual UI route, API service, server start, route handler registration, live fetch, event submit, dashboard mutation, click-to-apply, approval, merge, deploy, receipt completion, production PASS, enterprise trust, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P24000 ready는 screen contract readiness일 뿐이며, UI가 실제 production operator console로 serving된다는 뜻이 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P23601-P23640 | P23600 Source Binding | P23600 source artifact, source range, validation state, P23601 handoff flag, no-serve boundary를 고정한다. | `p23600_source_binding_rows` |
| P23641-P23720 | Operator Dashboard Screen Contract | header, summary, task, evidence, review, blocker, detail, next-action screen slot을 bounded read-only row로 고정한다. | `operator_dashboard_screen_contract_rows` |
| P23721-P23800 | Interaction State Checklist | ready, empty, loading, error, blocked, stale, review-pending, redacted-payload 상태가 숨겨지지 않는지 확인한다. | `interaction_state_checklist_rows` |
| P23801-P23880 | Read-Only Data Binding Matrix | source consumer row와 screen slot, route ref, visible field, sanitized boundary를 연결한다. | `read_only_data_binding_rows` |
| P23881-P23940 | Screen Resilience Guard | bounded payload, redaction, overflow, stale/context drift, hidden blocker, missing source 상태를 guard row로 고정한다. | `screen_resilience_guard_rows` |
| P23941-P23980 | No-Action Boundary | click/apply/submit/approve/merge/deploy/live refresh/detail write/state persistence를 계속 금지한다. | `no_action_boundary_rows` |
| P23981-P24000 | P24000 Clean Checkpoint | source, screen contract, interaction state, data binding, resilience, no-action boundary, P24001 blocker를 freeze한다. | `p24000_clean_checkpoint_rows` |

완료 기준:

- P23600 source artifact가 없으면 in-memory P23600 builder로 conservative source를 재계산한다.
- P23600 source가 `ready_for_p23601_handoff=false`이면 P24000은 valid BLOCK이고 blocker가 보여야 한다.
- Screen contract는 operator dashboard가 표시해야 할 bounded slot을 정의하지만 UI route implementation이나 serving을 열지 않아야 한다.
- Interaction state checklist는 ready/empty/loading/error/blocked/stale/review-pending/redacted-payload 상태를 모두 표시해야 한다.
- Data binding matrix는 raw stdout/stderr, secret material, full transcript, protected payload를 노출하지 않아야 한다.
- P24001 handoff가 true여도 actual UI service, production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
