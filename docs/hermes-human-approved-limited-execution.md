# Hermes Human-Approved Limited Execution Phase Ledger

This ledger covers `P2241-P2400`. It consumes `platform:runtime-governance-restore` and defines the first limited execution lane as a human-approved contract.

## Objective

Restore Hermes-native limited execution without opening free-form automation. The program defines receipt intake, allowlisted command candidates, repo-local sandbox policy, stdout/stderr redaction, timeout policy, rollback binding, and execution closeout rows. It prepares `P2401-P2560` controlled write and operator console v2, but it does not execute commands, apply receipts, mutate files, start servers, connect MCP, run jobs, or open protected actions.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2241-P2260` | Receipt Intake Contract | Define command/install/doctor/MCP/job/emergency/rollback receipt rows |
| `P2261-P2280` | Allowlist Candidate Policy | Define command candidates that remain non-executing until human receipt validation |
| `P2281-P2300` | Repo-Local Sandbox Policy | Require repo-local workdir, artifact output scope, no global install, no home secret read, no default network |
| `P2301-P2320` | Redaction and Evidence Policy | Require stdout, stderr, env, secret-pattern, and raw-material redaction before persistence |
| `P2321-P2340` | Timeout Policy | Bind short, medium, long, and hard-kill timeout rows to every candidate command |
| `P2341-P2360` | Rollback Binding Policy | Require pre-execution status, artifact snapshot, file restore plan, reversal note, and rollback receipt policy |
| `P2361-P2380` | Execution Closeout Policy | Require evidence refs, reviewer verdict, PASS/BLOCK, receipt expiry, and next execution condition |
| `P2381-P2400` | Controlled Write Handoff | Freeze P2401 handoff with write/protected/final authority still closed |

## Source

- Source command: `platform:runtime-governance-restore`
- Source phase: `P2121-P2240`
- Required status: `ready_for_platform_runtime_governance_restore`
- Required boundary: runtime execution and write action are still false

## Guard Rules

- Allowlisted commands are candidates only; this program does not execute them.
- Receipt rows are required but not applied by this program.
- Sandbox policy must be proven before any future execution.
- Raw stdout, stderr, environment variables, secrets, and domain raw material are not persisted.
- Every future execution candidate requires timeout and hard-kill policy.
- Rollback evidence is required before execution or controlled write.
- Closeout converts command evidence into PASS/BLOCK, block reason, owner, and next condition.
- Handoff to `P2401-P2560` does not itself enable write, protected action, final legal/release authority, or Agent final PASS.

## Completion Criteria

```text
source runtime governance restore ready
receipt rows defined
allowlist command candidates defined
repo-local sandbox policy defined
redaction policy defined
timeout policy defined
rollback binding policy defined
execution closeout policy defined
P2401 handoff ready
command executed now = false
receipt applied now = false
runtime/write/protected/final authority still false
unsafe flag count = 0
ready_for_platform_human_approved_limited_execution
```

## Validation

Run:

```bash
npm run platform:human-approved-limited-execution -- --check
```
