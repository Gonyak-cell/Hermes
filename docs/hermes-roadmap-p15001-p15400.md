# Hermes Roadmap P15001-P15400 SaaS Factory Mode

P15001-P15400은 P15000 Multi-Engine Orchestration 다음 단계다. 목표는 Hermes가 여러 SaaS/project 개발을 시작할 때 필요한 template, requirement matrix, validation plan, review lane, domain pack composition, release gate blueprint를 같은 Harness control-plane 계약으로 찍어낼 수 있게 만드는 것이다.

이 단계는 SaaS Factory Mode를 read-only blueprint와 bootstrap projection으로 표준화하지만 project creation, repo write, secret generation, connector provisioning, deployment, production PASS, enterprise PASS, enterprise trust claim, protected closeout, release approval, write/protected action, connector write, runtime execution, Codex final approval, Claude final approval을 열지 않는다.

P15000 source가 `ready_for_p15001_handoff=false`이면 P15400은 ready가 아니라 explicit BLOCK으로 남아야 한다. P15400은 factory/template read-only tranche이므로 routine Claude review receipt를 새 필수 조건으로 추가하지 않는다. 다만 source P15000이 authority high-risk tranche였기 때문에 P15000 blocker와 review blocker는 그대로 보존되어야 한다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P15001-P15040 | P15000 Source Binding | Multi-engine source, blocked handoff, orchestration row counts, no-engine/no-trust/no-write boundary를 고정한다. | `saas_factory_source_binding_rows` |
| P15041-P15080 | Project Template Contract | template id, project type, domain pack set, owner engine, starter artifact ref, template blocker를 정의한다. | `project_template_contract_rows` |
| P15081-P15120 | Requirement Matrix Contract | requirement id, coverage target, acceptance criterion, source evidence ref, priority, traceability blocker를 정의한다. | `requirement_matrix_contract_rows` |
| P15121-P15160 | Validation Plan Contract | validator id, command ref, expected evidence, negative fixture, adjacent check, validation blocker를 정의한다. | `validation_plan_contract_rows` |
| P15161-P15200 | Review Lane Contract | review lane id, reviewer engine, review scope, finding loop, authority boundary, stale review blocker를 정의한다. | `review_lane_contract_rows` |
| P15201-P15240 | Domain Pack Composition | domain pack id, capability map, data boundary, protected output rule, pack compatibility, composition blocker를 정의한다. | `domain_pack_composition_rows` |
| P15241-P15280 | Release Gate Blueprint | release gate id, candidate evidence, rollback requirement, attestation requirement, production blocker, no auto deploy를 정의한다. | `release_gate_blueprint_rows` |
| P15281-P15320 | Bootstrap Read-Only Projection | read-only factory API row, dashboard row, template preview, requirement rollup, gate rollup, no project creation을 정의한다. | `bootstrap_projection_rows` |
| P15321-P15360 | Factory Authority Guard | no project creation, no repo write, no secret generation, no connector provisioning, no deployment, no production PASS, no enterprise trust claim, no final automated approval을 정의한다. | `factory_authority_guard_rows` |
| P15361-P15400 | SaaS Factory Freeze | source, template, requirement, validation, review lane, domain composition, release gate, bootstrap projection, authority guard를 freeze한다. | `p15400_freeze_rows` |

## SaaS Factory Mode Contract

- Source binding rows include P15000 source availability, source range, source status, ready_for_p15001_handoff, visible blocker, engine registry, role authority, routing decision contract, no engine authority, no trust write final boundary.
- Project template rows include template id, project type, domain pack set, owner engine, starter artifact ref, template blocker.
- Requirement matrix rows include requirement id, coverage target, acceptance criterion, source evidence ref, priority, traceability blocker.
- Validation plan rows include validator id, command ref, expected evidence, negative fixture, adjacent check, validation blocker.
- Review lane rows include review lane id, reviewer engine, review scope, finding loop, authority boundary, stale review blocker.
- Domain pack composition rows include domain pack id, capability map, data boundary, protected output rule, pack compatibility, composition blocker.
- Release gate blueprint rows include release gate id, candidate evidence, rollback requirement, attestation requirement, production blocker, no auto deploy.
- Bootstrap projection rows include read-only factory API row, dashboard row, template preview, requirement rollup, gate rollup, no project creation.
- Authority guards include no project creation, no repo write, no secret generation, no connector provisioning, no deployment, no production PASS, no enterprise trust claim, no final automated approval.

## Completion Criteria

```text
P15000 source 없음 = BLOCK
P15000 ready_for_p15001_handoff=false = P15400 ready 아님
P15000 source blocker는 P15400 source block으로 보존
project template contract 없음 = BLOCK
requirement matrix contract 없음 = BLOCK
validation plan contract 없음 = BLOCK
review lane contract 없음 = BLOCK
domain pack composition 없음 = BLOCK
release gate blueprint 없음 = BLOCK
read-only bootstrap projection 없음 = BLOCK
project creation 없음
repo write 없음
secret generation 없음
connector provisioning 없음
deployment 없음
production PASS 없음
enterprise PASS 없음
enterprise trust claim 없음
protected closeout 없음
release approval 없음
write/protected action 없음
connector write 없음
runtime execution 없음
raw source exposure 없음
Codex/Claude final approval 없음
P15401 Connector And External App Governance handoff는 P15000 source와 P15400 factory contract가 모두 ready일 때만 가능
```
