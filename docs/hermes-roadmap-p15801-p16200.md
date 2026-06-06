# Hermes Roadmap P15801-P16200 Execution/Write Authority Maturity

P15801-P16200은 P15800 Connector And External App Governance 다음 단계다. 목표는 Hermes가 여러 SaaS/project workflow에서 제한 실행과 write 후보를 다룰 수 있도록 action class, receipt-gated candidate lane, command allowlist, write scope, rollback/recovery, post-action validation, review gate를 같은 Harness authority 계약으로 관리하게 만드는 것이다.

이 단계는 execution/write authority signal을 성숙시키지만 receipt application, candidate execution, command execution, runtime execution, direct file write, generated patch apply, protected action, connector write, external service mutation, deployment, production PASS, enterprise PASS, enterprise trust claim, protected closeout, release approval, raw source exposure, secret read, Codex final approval, Claude final approval을 열지 않는다.

P15800 source가 `ready_for_p15801_handoff=false`이면 P16200은 ready가 아니라 explicit BLOCK으로 남아야 한다. 또한 execution/write authority boundary는 high-risk tranche이므로 durable Claude Code Opus max execution/write authority review receipt가 없으면 P16201 Production Governance Hardening handoff는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P15801-P15840 | P15800 Source Binding | Connector governance source, blocked handoff, connector row counts, no-connector/no-trust/no-raw boundary를 고정한다. | `execution_authority_source_binding_rows` |
| P15841-P15880 | Action Class Registry | action id, action class, risk tier, protected flag, owner engine, action blocker를 정의한다. | `action_class_registry_rows` |
| P15881-P15920 | Receipt-Gated Candidate Lane | receipt id, scope ref, candidate command/diff, expiry/revocation, preflight blocker, no automatic apply를 정의한다. | `receipt_gated_candidate_lane_rows` |
| P15921-P15960 | Command Allowlist Policy | command id, allowed mode, repo-local sandbox, timeout, redaction, execution blocker를 정의한다. | `command_allowlist_policy_rows` |
| P15961-P16000 | Write Scope Policy | path scope, generated patch only, diff packet, rollback plan, protected path blocker, no direct write를 정의한다. | `write_scope_policy_rows` |
| P16001-P16040 | Rollback And Recovery Binding | rollback target, restore command ref, evidence snapshot, incident hook, recovery owner, rollback blocker를 정의한다. | `rollback_recovery_binding_rows` |
| P16041-P16080 | Post-Action Validation Contract | validator id, pre/post evidence, adjacent regression, negative fixture, status closeout, validation blocker를 정의한다. | `post_action_validation_rows` |
| P16081-P16120 | Claude Execution/Write Authority Review Gate | Claude Code Opus max execution/write authority review receipt schema, model effort, authority scope, finding loop, observed receipt state를 고정한다. | `claude_execution_write_authority_review_rows` |
| P16121-P16160 | Read-Only Authority Projection | read-only action registry API row, dashboard row, candidate preview, receipt rollup, validation rollup, no execution을 정의한다. | `authority_read_only_projection_rows` |
| P16161-P16200 | Execution/Write Authority Freeze | source, action registry, candidate lane, allowlist, write scope, rollback, validation, Claude review, projection, authority guard를 freeze한다. | `p16200_freeze_rows` |

## Execution/Write Authority Maturity Contract

- Source binding rows include P15800 source availability, source range, source status, ready_for_p15801_handoff, visible blocker, connector governance row counts, no connector side effects, no trust/write/final, and no raw/secret boundary.
- Action class rows include action id, action class, risk tier, protected flag, owner engine, action blocker.
- Receipt-gated candidate lane rows include receipt id, scope ref, candidate command/diff, expiry/revocation, preflight blocker, no automatic apply.
- Command allowlist rows include command id, allowed mode, repo-local sandbox, timeout, redaction, execution blocker.
- Write scope rows include path scope, generated patch only, diff packet, rollback plan, protected path blocker, no direct write.
- Rollback/recovery rows include rollback target, restore command ref, evidence snapshot, incident hook, recovery owner, rollback blocker.
- Post-action validation rows include validator id, pre/post evidence, adjacent regression, negative fixture, status closeout, validation blocker.
- Claude execution/write authority review gate includes Claude Code Opus max execution/write authority review receipt schema, model effort, authority scope, finding loop, observed receipt state.
- Read-only authority projection rows include read-only action registry API row, dashboard row, candidate preview, receipt rollup, validation rollup, no execution.
- Authority guards include no receipt application, no candidate execution, no command execution, no runtime execution, no direct file write, no patch apply, no protected action, no final automated approval.

## Completion Criteria

```text
P15800 source 없음 = BLOCK
P15800 ready_for_p15801_handoff=false = P16200 ready 아님
P15800 source blocker는 P16200 source block으로 보존
Claude execution/write authority review receipt 없음 = P16200 ready 아님
action class registry 없음 = BLOCK
receipt-gated candidate lane 없음 = BLOCK
command allowlist policy 없음 = BLOCK
write scope policy 없음 = BLOCK
rollback/recovery binding 없음 = BLOCK
post-action validation 없음 = BLOCK
read-only authority projection 없음 = BLOCK
receipt application 없음
candidate execution 없음
command execution 없음
runtime execution 없음
direct file write 없음
generated patch apply 없음
protected action 없음
connector write 없음
external service mutation 없음
deployment 없음
production PASS 없음
enterprise PASS 없음
enterprise trust claim 없음
protected closeout 없음
release approval 없음
raw source exposure 없음
secret read 없음
Codex/Claude final approval 없음
P16201 Production Governance Hardening handoff는 P15800 source와 Claude execution/write authority review evidence가 모두 ready일 때만 가능
```
