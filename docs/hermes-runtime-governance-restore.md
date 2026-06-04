# Hermes Runtime Governance Restore Phase Ledger

This ledger covers `P2121-P2240`. It consumes `platform:nous-non-adoption-reversal` and restores the runtime-adjacent Hermes features as governance contracts, not as live execution.

## Objective

Restore Hermes-owned runtime governance after the Nous non-adoption decision. The program defines runtime API contracts, MCP registry rows, tool gateway policy, job scheduler ledger, install/doctor/health evidence, and hard hook scaffold rows. It prepares `P2241-P2400` limited execution but does not start servers, connect live MCP, run jobs, execute tools, apply receipts, or perform writes.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2121-P2140` | Source Restore Intake | Consume P2041-P2120 reversal and restored capability rows |
| `P2141-P2160` | Runtime API Contract Restore | Define read-only runtime governance API route contracts |
| `P2161-P2180` | MCP and Tool Gateway Policy Restore | Define MCP registry, tool allowlist, redaction, timeout, and secret boundary rows |
| `P2181-P2200` | Job and Doctor Evidence Restore | Define scheduled job ledger plus install, doctor, smoke, and health evidence rows |
| `P2201-P2220` | Hard Hook Scaffold Restore | Define evidence, receipt, secret scan, rollback, timeout, and no-final-PASS hooks |
| `P2221-P2240` | Limited Execution Handoff | Freeze P2241 handoff with all runtime/write/protected authority still closed |

## Source

- Source command: `platform:nous-non-adoption-reversal`
- Source phase: `P2041-P2120`
- Required status: `ready_for_platform_nous_non_adoption_reversal`
- Required decision: `nous_adopted=false`

## Guard Rules

- Runtime API routes are contracts only; no API server is started.
- MCP rows are registry and health contracts only; no live MCP connection is opened.
- Tool gateway rows are policy only; no terminal, write, browser, network, or install command is executed.
- Job rows are scheduler ledger contracts only; no cron/job is run.
- Doctor and smoke evidence rows are expected evidence classes only; no raw stdout or secret-bearing output is exposed.
- Hard hooks are scaffolded as deterministic gate contracts; enforcement opens only in later execution/write phases.
- `P2241-P2400` may consume this handoff, but this program itself enables no execution or write.

## Completion Criteria

```text
source Nous non-adoption reversal ready
runtime API contracts restored
MCP registry contracts restored
tool gateway policy restored
job scheduler ledger restored
install/doctor/health evidence classes restored
hard hook scaffold restored
P2241 handoff ready
runtime/write/protected/final authority still false
unsafe flag count = 0
ready_for_platform_runtime_governance_restore
```

## Validation

Run:

```bash
npm run platform:runtime-governance-restore -- --check
```
