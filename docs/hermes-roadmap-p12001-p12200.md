# Hermes Roadmap P12001-P12200 Domain Pack SDK v2

P12001-P12200은 P12000 SaaS Quality Gate Packs 다음 단계다. 목표는 HR, law-firm, CRM, ERP, document, trading, future SaaS 같은 여러 project/workflow context가 같은 SDK 계약으로 Hermes에 붙도록 Domain Pack SDK v2를 고정하는 것이다.

이 단계는 domain pack을 Hermes 전체 제품으로 승격하지 않는다. Domain pack은 project/workflow context이고, protected output, final approval, production PASS, enterprise PASS, runtime execution, connector write는 계속 Harness gate 밖에 있다.

P12000 source가 `ready_for_p12001_handoff=false`이면 P12200은 ready가 아니라 explicit BLOCK으로 남아야 한다. SDK v2 registry는 만들어도 P12201 Controlled Execution Sandbox handoff는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P12001-P12020 | P12000 Source Binding | SaaS Quality Gate Packs source, blocked source handoff, gate pack registry state를 고정한다. | `domain_pack_sdk_source_binding_rows` |
| P12021-P12040 | SDK Domain Matrix | HR, law-firm, CRM, ERP, document, trading, future SaaS context rows를 정의한다. | `domain_pack_sdk_domain_rows` |
| P12041-P12060 | Pack Manifest v2 Contract | pack id, version, capability ids, data classes, review authority, boundary refs를 정의한다. | `pack_manifest_v2_contract_rows` |
| P12061-P12080 | Capability Interface Contract | inputs, outputs, protected outputs, validator refs, evidence refs, rollback refs를 정의한다. | `capability_interface_contract_rows` |
| P12081-P12100 | Data Boundary Contract | project isolation, tenant isolation, client/resource isolation, raw body policy, quarantine, retention을 정의한다. | `domain_data_boundary_rows` |
| P12101-P12120 | Review And Authority Contract | Codex developer, Claude reviewer, human owner, independent review, no final approval expansion을 정의한다. | `domain_review_authority_rows` |
| P12121-P12140 | Gate Pack Binding Contract | security, permissions, data model, UX, API, performance, docs, deployment/rollback, provenance gate refs를 정의한다. | `domain_gate_pack_binding_rows` |
| P12141-P12160 | Compatibility And Migration Contract | sdk version, compatibility, migration plan, deprecated fields, fixture coverage를 정의한다. | `domain_compatibility_migration_rows` |
| P12161-P12180 | Domain Contribution Contract | contribution checklist, registry entry, negative fixtures, docs, owner refs를 정의한다. | `domain_contribution_contract_rows` |
| P12181-P12200 | SDK v2 Freeze | reusable SDK registry, blocked source preservation, P12201 sandbox handoff를 고정한다. | `p12200_freeze_rows` |

## SDK v2 Contract

- HR context는 people module context일 뿐 Hermes 제품 identity가 아니다.
- law-firm context는 legal/matter context일 뿐 lawyer substitute가 아니다.
- CRM context는 customer/workflow context일 뿐 external send/write 권한을 열지 않는다.
- ERP context는 operations/finance workflow context일 뿐 production approval을 열지 않는다.
- document context는 creative/document workflow context일 뿐 client delivery finalization을 열지 않는다.
- trading context는 research/backtest/paper context일 뿐 live trading이나 order execution을 열지 않는다.
- future SaaS context는 project/workflow context일 뿐 domain-specific product identity를 열지 않는다.
- Pack Manifest v2는 pack id, version, capability ids, data classes, review authority, boundary refs를 가져야 한다.
- Capability interface는 inputs, outputs, protected outputs, validator refs, evidence refs, rollback refs를 가져야 한다.
- Data boundary는 project isolation, tenant isolation, client/resource isolation, raw body policy, quarantine, retention을 가져야 한다.
- Review authority는 Codex developer, Claude reviewer, human owner, independent review, no final approval expansion을 구분해야 한다.
- Gate pack binding은 security, permissions, data model, UX, API, performance, docs, deployment/rollback, provenance gate refs를 가져야 한다.
- Compatibility and migration은 sdk version, compatibility, migration plan, deprecated fields, fixture coverage를 가져야 한다.
- Contribution contract는 contribution checklist, registry entry, negative fixtures, docs, owner refs를 가져야 한다.

## Completion Criteria

```text
P12000 source 없음 = BLOCK
P12000 ready_for_p12001_handoff=false = P12200 ready 아님
HR/law-firm/CRM/ERP/document/trading/future SaaS context rows 없음 = BLOCK
Pack Manifest v2 contract 없음 = BLOCK
Capability interface contract 없음 = BLOCK
Data boundary contract 없음 = BLOCK
Review authority contract 없음 = BLOCK
Gate pack binding contract 없음 = BLOCK
Compatibility/migration contract 없음 = BLOCK
Contribution contract 없음 = BLOCK
raw/full body exposure 없음
secret-bearing key exposure 없음
write/protected action 없음
connector write 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
domain pack product identity 없음
P12201 Controlled Execution Sandbox handoff는 P12000 source가 ready일 때만 가능
```
