# Hermes Roadmap P22801-P23200 Receipt Workbench API Read Model

P22801-P23200은 P22800 Receipt Completion Operator Workbench가 연 P22801 handoff를 dashboard-ready read model과 read-only API projection 계약으로 바꾸는 단계다. 목표는 operator workbench task, remediation draft, evidence request, review router 상태를 UI와 API가 읽기 쉬운 bounded projection으로 만들되, server start, route handler, API write, mutation, receipt completion, final approval로 승격하지 않는 것이다.

이 단계는 actual API service, route implementation, server start, receipt completion, production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P23200 ready는 read model readiness일 뿐이며, API가 실제로 serving된다는 뜻이 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P22801-P22840 | P22800 Source Binding | P22800 source artifact, source range, validation state, P22801 handoff flag, no-apply boundary를 고정한다. | `p22800_source_binding_rows` |
| P22841-P22920 | Dashboard Read Model | task/remediation/evidence/review 상태를 dashboard가 읽을 수 있는 bounded row로 투영한다. | `dashboard_read_model_rows` |
| P22921-P23000 | Read-Only API Projection | GET/HEAD-only API projection rows를 선언하되 server start와 route handler 등록은 금지한다. | `read_only_api_projection_rows` |
| P23001-P23080 | Sanitized Field Map | raw stdout/stderr, secret, full transcript, protected payload를 제외한 노출 필드를 고정한다. | `sanitized_field_map_rows` |
| P23081-P23140 | UI Status Summary | open task, evidence request, remediation draft, conditional review, blocker 상태를 summary row로 압축한다. | `ui_status_summary_rows` |
| P23141-P23180 | No-Route Boundary | API projection이 server start, route execution, mutation, approval, completion claim으로 승격되지 않도록 boundary를 닫는다. | `no_route_boundary_rows` |
| P23181-P23200 | P23200 Clean Checkpoint | source, dashboard read model, API projection, sanitized field map, UI status, no-route boundary, P23201 blocker를 freeze한다. | `p23200_clean_checkpoint_rows` |

완료 기준:

- P22800 source artifact가 없으면 in-memory P22800 builder로 conservative source를 재계산한다.
- P22800 source가 `ready_for_p22801_handoff=false`이면 P23200은 valid BLOCK이고 blocker가 보여야 한다.
- API projection은 GET/HEAD-only이며 server start, route handler registration, route execution, write/mutation을 모두 금지해야 한다.
- Dashboard read model은 raw stdout/stderr, secret material, full transcript, protected payload를 노출하지 않아야 한다.
- UI status summary는 open task와 blocker를 숨기지 않고 read-only state로 보여야 한다.
- P23201 handoff가 true여도 actual API service, production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
