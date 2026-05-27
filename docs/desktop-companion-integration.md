# Hermes Desktop Companion Integration

## 판단

Hermes Desktop은 core runtime이나 source of truth가 아니라 operator companion surface로 다룬다. 하네스의 source of truth는 pack registry, capability manifest, gate result aggregator, run ledger, event/audit ledger, policy snapshot, approval queue, receipt artifact다.

Desktop Companion v1은 읽기 전용 화면 계약만 소비한다. pack, capability, version, gate, run, approval, policy, observability, diagnostics 상태를 표시할 수 있지만 secret 원문, provider key, installer, gateway, SSH, cron, auto-update, skill install/uninstall, protected execution을 직접 제어하지 않는다.

## P191 계약

P191은 `capabilities:registry-api` slice로 Desktop Companion이 처음 소비할 수 있는 API catalog를 만든다.

- Pack card: pack id, version, dependency, compatibility, validation state.
- Capability card: capability id, pack, input/output schema, runtime, gate, approval requirement.
- Version card: capability version and source workflow binding.
- Gate requirement card: pre/in/post-run gate declaration and aggregate binding.
- Desktop route group: overview, domain packs, capabilities, workflow gates, runs, approvals, policy/observability, diagnostics.

모든 Desktop route group은 `GET` only, `read_only=true`, `mutation_allowed=false`, `protected_mutation_request_allowed=false`, `secret_material_exposed=false`, `installer_or_gateway_control=false`를 요구한다.

## Phase 배치

| Phase range | 반영 내용 |
| --- | --- |
| P190-P194 | Desktop에 보여줄 workflow/gate 상태 언어를 정규화한다. |
| P195-P212 | Desktop을 runtime이 아닌 operator surface로 계약화하고 secrets/runtime/sandbox 경계를 고정한다. |
| P287-P296 | API/Dashboard/UI에서 Desktop-ready route group, navigation IA, approval queue, run ledger viewer, cost/observability rollup을 본격 연결한다. |
| P297-P304 | Desktop companion threat model, provider/model policy, config/key leakage, backup/restore 경계를 검증한다. |
| P309-P312 | 선택적 Desktop companion 배포, operator handbook, release readiness matrix, v1.0 freeze 기준을 문서화한다. |

## Mutation 원칙

Desktop v1은 실행 버튼을 제공하지 않는다. 사용자가 Desktop에서 어떤 변경이나 실행을 요구하는 경우에도 core API는 바로 실행하지 않고 receipt draft 또는 protected action request를 생성하는 방향으로 확장한다. 실제 mutation은 Human Gate, approval authority, policy snapshot binding, audit event를 통과한 뒤 별도 runtime adapter가 수행한다.

## Core naming generalization

현재 core에는 `matter_id` 잔상이 남아 있다. Desktop Companion은 새 core 필드명을 선도하지 않고 pack/capability/readiness/route group 같은 중립 UI 언어만 사용한다. `matter_id`를 `scope_id` 또는 `workspace_id`로 올리고 law-firm pack에서 `matter_id` alias를 제공할지는 별도 core naming/generalization phase에서 다룬다.
