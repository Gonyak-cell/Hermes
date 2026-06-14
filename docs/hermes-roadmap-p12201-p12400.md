# Hermes Roadmap P12201-P12400 Controlled Execution Sandbox

P12201-P12400은 P12200 Domain Pack SDK v2 다음 단계다. 목표는 Hermes가 여러 SaaS/project workflow에서 제한 실행 후보를 다룰 수 있도록 receipt-gated, allowlisted, repo-local sandbox 계약을 고정하는 것이다.

이 단계는 실제 자유 실행, write action, protected action, connector write, secret read, network-by-default, production PASS, enterprise PASS를 열지 않는다. Controlled Execution Sandbox는 실행을 수행하는 엔진이 아니라, 어떤 조건이 충족되어야 실행 후보가 검토 가능한 상태가 되는지 설명하는 control-plane 계약이다.

P12200 source가 `ready_for_p12201_handoff=false`이면 P12400은 ready가 아니라 explicit BLOCK으로 남아야 한다. 또한 execution/write 전환 계열 milestone이므로 durable Claude Code Opus max review receipt가 없으면 P12401 Patch Candidate Lane handoff는 열리지 않는다.

## Phase Plan

| Range | Name | Goal | Output |
|---|---|---|---|
| P12201-P12220 | P12200 Source Binding | Domain Pack SDK v2 source, blocked source handoff, SDK boundary state를 고정한다. | `controlled_execution_source_binding_rows` |
| P12221-P12240 | Receipt-Gated Command Allowlist | git status, diff check, rg search, targeted test, platform check, doctor/smoke, artifact read 같은 allowlisted command 후보를 receipt-gated로 정의한다. | `controlled_execution_allowlist_rows` |
| P12241-P12260 | Sandbox Backend Profile Matrix | repo-local workdir, tmp artifact dir, no global install, no home secret read, no network by default, no cross-project access를 정의한다. | `controlled_execution_sandbox_rows` |
| P12261-P12280 | Redaction And Secret Scan Contract | stdout redaction, stderr redaction, env redaction, secret pattern scan, raw material redaction을 정의한다. | `controlled_execution_redaction_rows` |
| P12281-P12300 | Timeout Heartbeat Kill Contract | short, medium, long, hard kill, heartbeat timeout policy를 정의한다. | `controlled_execution_timeout_rows` |
| P12301-P12320 | Rollback And Evidence Binding | pre execution status, artifact hash, file restore plan, reversal note, rollback receipt를 정의한다. | `controlled_execution_rollback_rows` |
| P12321-P12340 | Dry-Run No-Op Candidate Ledger | dry-run plan, no-op validation, evidence preview, blocked reason preview, rollback preview를 정의한다. | `controlled_execution_dry_run_rows` |
| P12341-P12360 | High-Risk Claude Review Receipt Gate | Claude Code Opus max review receipt schema, scope, evidence ref, finding loop, observed receipt 상태를 고정한다. | `controlled_execution_claude_review_rows` |
| P12361-P12380 | Read-Only Operator/API Projection | allowed/blocked/next action/source/review state를 GET/HEAD-only operator/API projection으로 정의한다. | `controlled_execution_operator_projection_rows` |
| P12381-P12400 | Controlled Sandbox Freeze | source, receipt, allowlist, sandbox, redaction, timeout, rollback, dry-run, Claude review, operator projection, unsafe invariant를 freeze한다. | `p12400_freeze_rows` |

## Controlled Execution Contract

- receipt-gated command는 receipt 없이는 실행 후보가 아니다.
- Receipt types include command execution receipt, install command receipt, doctor/smoke receipt, MCP health receipt, cron/job receipt, rollback receipt, emergency stop receipt.
- allowlisted command만 execution candidate가 될 수 있다.
- Allowlist command templates include git status --short, git diff --check, rg <pattern>, node --test test/<target>.test.mjs, npm run platform:<command> -- --check, npm run validate:core, npm run <doctor-or-smoke> -- --check, read artifact summary.
- repo-local sandbox 밖의 global install, system mutation, home secret read, cross-project access는 blocked다.
- stdout/stderr/env/raw material은 redacted evidence ref로만 남긴다.
- secret pattern scan은 실행 전후 evidence closeout에 묶인다.
- timeout, heartbeat, hard-kill policy가 없는 command는 candidate가 아니다.
- Timeout policies include short check timeout, medium test timeout, long validation timeout, hard-kill timeout, heartbeat timeout.
- rollback target, pre-execution status, artifact hash, reversal note가 없는 command는 candidate가 아니다.
- dry-run/no-op candidate는 실제 command execution evidence가 아니며 PASS 근거가 아니다.
- Claude Code Opus max review는 execution sandbox milestone의 independent review evidence일 뿐 final approval이 아니다.
- Claude review gate includes controlled execution sandbox review scope, review evidence ref, Claude finding loop, and observed receipt state.
- operator/API projection은 GET/HEAD read-only이고, execution/apply/approve button을 만들지 않는다.
- Operator/API projection includes source status, missing receipt, allowlist state, sandbox state, review state, and next action.

## Completion Criteria

```text
P12200 source 없음 = BLOCK
P12200 ready_for_p12201_handoff=false = P12400 ready 아님
Claude execution sandbox review receipt 없음 = P12400 ready 아님
receipt-gated allowlist 없음 = BLOCK
sandbox profile 없음 = BLOCK
redaction/secret scan 없음 = BLOCK
timeout/heartbeat/kill policy 없음 = BLOCK
rollback/evidence binding 없음 = BLOCK
dry-run/no-op candidate ledger 없음 = BLOCK
read-only operator/API projection 없음 = BLOCK
actual command execution 없음
receipt application 없음
write/protected action 없음
connector write 없음
network by default 없음
secret/raw material read 없음
Codex/Claude final approval 없음
production PASS 없음
enterprise PASS 없음
P12401 Patch Candidate Lane handoff는 P12200 source와 Claude review evidence가 모두 ready일 때만 가능
```
