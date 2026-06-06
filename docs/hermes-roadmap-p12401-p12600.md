# Hermes Roadmap P12401-P12600 Patch Candidate Lane

P12401-P12600은 P12400 Controlled Execution Sandbox 다음 단계다. 목표는 Hermes가 여러 SaaS/project workflow에서 generated patch candidate, diff packet, rollback plan, validation ref를 control-plane artifact로 다룰 수 있게 만드는 것이다.

이 단계는 patch를 실제 생성하거나 적용하지 않는다. Agent나 engine이 patch candidate lane을 사용할 수 있더라도 direct apply, file write, protected action, connector write, runtime execution, production PASS, enterprise PASS는 계속 blocked다.

P12400 source가 `ready_for_p12401_handoff=false`이면 P12600은 ready가 아니라 explicit BLOCK으로 남아야 한다. 또한 patch/write 전환 계열 milestone이므로 durable Claude Code Opus max patch candidate review receipt가 없으면 P12601 Human/Owner Adjudication Option handoff는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P12401-P12420 | P12400 Source Binding | Controlled Execution Sandbox source, blocked source handoff, no-execution boundary를 고정한다. | `patch_candidate_source_binding_rows` |
| P12421-P12440 | Generated Patch Candidate Contract | scope intent, file scope, risk tier, generated patch artifact, patch hash, no direct apply를 정의한다. | `generated_patch_candidate_rows` |
| P12441-P12460 | Diff Packet Contract | diff summary, file scope, semantic risk, test plan, rollback plan, reviewer refs를 정의한다. | `patch_diff_packet_rows` |
| P12461-P12480 | Rollback Plan Binding | pre-change status, artifact hash, inverse patch note, restore plan, rollback receipt를 정의한다. | `patch_rollback_binding_rows` |
| P12481-P12500 | Validation Ref Binding | git diff --check, targeted tests, validate core, platform check, secret scan, artifact summary를 정의한다. | `patch_validation_ref_rows` |
| P12501-P12520 | High-Risk Claude Patch Review Gate | Claude Code Opus max patch candidate review receipt schema, review scope, evidence ref, finding loop, observed receipt 상태를 고정한다. | `patch_claude_review_rows` |
| P12521-P12540 | Protected Scope Negative Fixtures | protected file, restricted path, secret file, cross-project access, raw material exposure, unscoped dirty tree를 negative fixture로 고정한다. | `patch_protected_scope_negative_rows` |
| P12541-P12560 | Read-Only Operator/API Patch Projection | patch candidate state, diff packet state, rollback state, missing review, blocked reason, next condition을 GET/HEAD-only projection으로 정의한다. | `patch_operator_projection_rows` |
| P12561-P12580 | No-Direct-Apply Authority Guard | no patch generated now, no direct apply, no file write, no protected action, no connector write, no final/trust를 고정한다. | `patch_authority_guard_rows` |
| P12581-P12600 | Patch Candidate Lane Freeze | source, patch candidate, diff, rollback, validation, Claude review, protected fixtures, projection, authority guard를 freeze한다. | `p12600_freeze_rows` |

## Patch Candidate Contract

- Patch candidate rows include scope intent, file scope, risk tier, generated patch artifact, patch hash, no direct apply.
- Diff packet rows include diff summary, file scope, semantic risk, test plan, rollback plan, reviewer refs.
- Rollback binding rows include pre-change status, artifact hash, inverse patch note, restore plan, rollback receipt.
- Validation ref rows include git diff --check, targeted tests, validate core, platform check, secret scan, artifact summary.
- Claude review gate includes Claude Code Opus max patch candidate review receipt schema, patch candidate review scope, review evidence ref, Claude finding loop, and observed receipt state.
- Protected scope negative fixtures include protected file, restricted path, secret file, cross-project access, raw material exposure, unscoped dirty tree.
- Operator/API projection includes patch candidate state, diff packet state, rollback state, missing review, blocked reason, next condition.
- Authority guards include no patch generated now, no direct apply, no file write, no protected action, no connector write, no final/trust.

## Completion Criteria

```text
P12400 source 없음 = BLOCK
P12400 ready_for_p12401_handoff=false = P12600 ready 아님
Claude patch candidate review receipt 없음 = P12600 ready 아님
generated patch candidate contract 없음 = BLOCK
diff packet contract 없음 = BLOCK
rollback binding 없음 = BLOCK
validation ref 없음 = BLOCK
protected scope negative fixture 없음 = BLOCK
operator/API projection 없음 = BLOCK
patch generated now 없음
patch applied now 없음
direct apply 없음
file write 없음
protected action 없음
connector write 없음
runtime execution 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
P12601 Human/Owner Adjudication Option handoff는 P12400 source와 Claude patch review evidence가 모두 ready일 때만 가능
```
