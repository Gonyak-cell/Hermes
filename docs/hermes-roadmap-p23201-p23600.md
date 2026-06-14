# Hermes Roadmap P23201-P23600 Receipt Workbench Dashboard Handoff Smoke

P23201-P23600은 P23200 Receipt Workbench API Read Model 이후의 dashboard-ready projection을 실제 operator dashboard가 소비할 수 있는 handoff smoke contract로 바꾸는 단계다. 목표는 dashboard consumer rows, API-to-surface adapter smoke matrix, operator visibility rules, no-serve/no-mutation boundary를 고정해 UI가 무엇을 보여야 하는지 검증하되, live server, route handler, route execution, network fetch, write, receipt completion, final approval로 승격하지 않는 것이다.

이 단계는 actual API service, UI route implementation, server start, route handler registration, live fetch, dashboard mutation, receipt completion, production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval을 열지 않는다. P23600 ready는 dashboard handoff smoke readiness일 뿐이며, UI가 실제 production control surface로 serving된다는 뜻이 아니다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P23201-P23240 | P23200 Source Binding | P23200 source artifact, source range, validation state, P23201 handoff flag, no-route boundary를 고정한다. | `p23200_source_binding_rows` |
| P23241-P23320 | Dashboard Consumer Contract | dashboard card/list/detail slot이 소비할 bounded row shape를 고정한다. | `dashboard_consumer_contract_rows` |
| P23321-P23400 | Handoff Adapter Smoke Matrix | read-only API projection route와 dashboard surface slot의 ready/empty/blocked/error smoke case를 매핑한다. | `handoff_adapter_smoke_rows` |
| P23401-P23480 | Operator Visibility Rules | blocker, required evidence, next action, owner lane, sanitized field, review state가 UI에서 숨겨지지 않는 규칙을 고정한다. | `operator_visibility_rule_rows` |
| P23481-P23540 | No-Serve/No-Mutation Boundary | server start, route mount, live fetch, UI event submit, dashboard mutation, write/action을 계속 금지한다. | `no_serve_boundary_rows` |
| P23541-P23600 | P23600 Clean Checkpoint | source, consumer contract, adapter smoke, visibility rules, no-serve boundary, P23601 blocker를 freeze한다. | `p23600_clean_checkpoint_rows` |

완료 기준:

- P23200 source artifact가 없으면 in-memory P23200 builder로 conservative source를 재계산한다.
- P23200 source가 `ready_for_p23201_handoff=false`이면 P23600은 valid BLOCK이고 blocker가 보여야 한다.
- Dashboard consumer contract는 bounded card/list/detail row만 제공하며 raw stdout/stderr, secret, full transcript, protected payload를 노출하지 않아야 한다.
- Handoff adapter smoke matrix는 ready/empty/blocked/error 상태를 모두 표현하지만 live server, route handler, route execution, network fetch를 열지 않아야 한다.
- Operator visibility rule은 blocker, required evidence, next action, owner lane, sanitized field, conditional review state를 숨기지 않아야 한다.
- P23601 handoff가 true여도 actual API service, production/enterprise/release/write/runtime/connector/raw/final approval 권한은 모두 false다.
