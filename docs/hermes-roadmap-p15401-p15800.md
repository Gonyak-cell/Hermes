# Hermes Roadmap P15401-P15800 Connector And External App Governance

P15401-P15800은 P15400 SaaS Factory Mode 다음 단계다. 목표는 Hermes가 여러 SaaS/project에서 쓰는 external app과 connector를 project/workflow control-plane 아래에 등록하고, read scope, denied write scope, consent/auth receipt, quarantine, evidence provenance, cross-app boundary, review gate를 같은 Harness 계약으로 관리하게 만드는 것이다.

이 단계는 connector/external app governance signal을 표준화하지만 external app connection, credential lookup, secret read, raw export, raw source exposure, ingestion start, connector provisioning, connector write, external service mutation, cross-app data join, deployment, production PASS, enterprise PASS, enterprise trust claim, protected closeout, release approval, write/protected action, runtime execution, Codex final approval, Claude final approval을 열지 않는다.

P15400 source가 `ready_for_p15401_handoff=false`이면 P15800은 ready가 아니라 explicit BLOCK으로 남아야 한다. 또한 connector/external app boundary는 high-risk tranche이므로 durable Claude Code Opus max connector governance review receipt가 없으면 P15801 Execution/Write Authority Maturity handoff는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P15401-P15440 | P15400 Source Binding | SaaS Factory source, blocked handoff, factory row counts, no-side-effect/no-trust/no-raw boundary를 고정한다. | `connector_governance_source_binding_rows` |
| P15441-P15480 | External App Registry Contract | app id, app class, owner project, auth mode, data boundary, app blocker를 정의한다. | `external_app_registry_rows` |
| P15481-P15520 | Connector Capability Matrix | connector id, read scope, write scope denied, raw export policy, secret handle ref, capability blocker를 정의한다. | `connector_capability_matrix_rows` |
| P15521-P15560 | Consent/Auth Receipt Contract | consent receipt id, auth proof ref, secret handle boundary, expiry revocation, scope diff, missing receipt blocker를 정의한다. | `consent_auth_receipt_rows` |
| P15561-P15600 | Ingestion Quarantine Contract | source classification, quarantine queue, redaction policy, prompt injection scan, schema normalization, quarantine blocker를 정의한다. | `ingestion_quarantine_rows` |
| P15601-P15640 | External App Evidence Mapping | source evidence ref, connector run ref, provenance hash, freshness window, access log ref, evidence blocker를 정의한다. | `external_app_evidence_mapping_rows` |
| P15641-P15680 | Cross-App Boundary Guard | tenant boundary, project boundary, domain pack boundary, client/matter boundary, no cross-app join, boundary blocker를 정의한다. | `cross_app_boundary_guard_rows` |
| P15681-P15720 | Claude Connector Governance Review Gate | Claude Code Opus max connector governance review receipt schema, model effort, connector scope, finding loop, observed receipt state를 고정한다. | `claude_connector_governance_review_rows` |
| P15721-P15760 | Connector Read-Only Projection | read-only external app registry API row, dashboard row, connector preview, quarantine rollup, access scope rollup, no connector execution을 정의한다. | `connector_read_only_projection_rows` |
| P15761-P15800 | Connector Governance Freeze | source, registry, capability, consent/auth, quarantine, evidence, boundary, Claude review, projection, authority guard를 freeze한다. | `p15800_freeze_rows` |

## Connector And External App Governance Contract

- Source binding rows include P15400 source availability, source range, source status, ready_for_p15401_handoff, visible blocker, factory row counts, no factory side effects, no trust/write/final, and no raw/connector boundary.
- External app registry rows include app id, app class, owner project, auth mode, data boundary, app blocker.
- Connector capability rows include connector id, read scope, write scope denied, raw export policy, secret handle ref, capability blocker.
- Consent/auth receipt rows include consent receipt id, auth proof ref, secret handle boundary, expiry revocation, scope diff, missing receipt blocker.
- Ingestion quarantine rows include source classification, quarantine queue, redaction policy, prompt injection scan, schema normalization, quarantine blocker.
- External app evidence rows include source evidence ref, connector run ref, provenance hash, freshness window, access log ref, evidence blocker.
- Cross-app boundary rows include tenant boundary, project boundary, domain pack boundary, client/matter boundary, no cross-app join, boundary blocker.
- Claude connector governance review gate includes Claude Code Opus max connector governance review receipt schema, model effort, connector scope, finding loop, observed receipt state.
- Connector read-only projection rows include read-only external app registry API row, dashboard row, connector preview, quarantine rollup, access scope rollup, no connector execution.
- Authority guards include no connector connection, no credential lookup, no secret read, no raw export, no ingestion start, no connector write, no external service mutation, no final automated approval.

## Completion Criteria

```text
P15400 source 없음 = BLOCK
P15400 ready_for_p15401_handoff=false = P15800 ready 아님
P15400 source blocker는 P15800 source block으로 보존
Claude connector governance review receipt 없음 = P15800 ready 아님
external app registry 없음 = BLOCK
connector capability matrix 없음 = BLOCK
consent/auth receipt contract 없음 = BLOCK
ingestion quarantine contract 없음 = BLOCK
external app evidence mapping 없음 = BLOCK
cross-app boundary guard 없음 = BLOCK
read-only connector projection 없음 = BLOCK
external app connection 없음
credential lookup 없음
secret read 없음
raw export 없음
raw source exposure 없음
ingestion start 없음
connector provisioning 없음
connector write 없음
external service mutation 없음
cross-app data join 없음
deployment 없음
production PASS 없음
enterprise PASS 없음
enterprise trust claim 없음
protected closeout 없음
release approval 없음
write/protected action 없음
runtime execution 없음
Codex/Claude final approval 없음
P15801 Execution/Write Authority Maturity handoff는 P15400 source와 Claude connector governance review evidence가 모두 ready일 때만 가능
```
