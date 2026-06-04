# Hermes Controlled Write and Operator Console v2 Phase Ledger

This ledger covers `P2401-P2560`. It consumes `platform:human-approved-limited-execution` and defines the controlled write and operator console v2 contract.

## Objective

Create a patch-first write lane and a richer operator control surface without enabling direct Agent write. The program defines generated patch candidates, diff review packets, human apply receipts, post-apply validation, rollback targets, operator action inbox rows, PASS owner visibility, and the `P2561-P2720` event-plane handoff. It does not generate patches, apply patches, apply receipts, mutate files, start servers, or open protected actions.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2401-P2420` | Patch Candidate Contract | Define generated-patch-only candidates with scope, intent, risk, artifacts, and hash rows |
| `P2421-P2440` | Diff Review Packet | Define diff summary, file scope, semantic risk, test plan, rollback plan, and reviewer verdict rows |
| `P2441-P2460` | Human Apply Receipt | Define apply, rollback, protected write, release candidate, console action, and emergency revert receipts |
| `P2461-P2480` | Post-Apply Validation | Define diff check, targeted tests, validate core, platform check, secret scan, and artifact summary gates |
| `P2481-P2500` | Rollback Target Binding | Define pre-apply snapshot, inverse patch, artifact restore, validation recovery, and receipt revoke rows |
| `P2501-P2520` | Operator Action Inbox | Define read-only action inbox, missing receipt, blocked reason, diff packet, rollback, and next condition routes |
| `P2521-P2540` | PASS Owner Visibility | Define human PASS owners for platform, domain, legal, release, and trading-sensitive authority |
| `P2541-P2560` | Event Plane Handoff | Freeze P2561 handoff with event/write/production authority still closed |

## Source

- Source command: `platform:human-approved-limited-execution`
- Source phase: `P2241-P2400`
- Required status: `ready_for_platform_human_approved_limited_execution`
- Required boundary: command execution and write action are still false

## Guard Rules

- Patch rows are candidates only; direct apply is blocked.
- Diff review is required before any apply receipt can be considered usable.
- Apply receipt rows are required but not applied by this program.
- Post-apply validation rows are required but not run by this program.
- Rollback target rows must exist before controlled write can be opened.
- Operator console v2 routes are read-only projection contracts.
- PASS owner rows must be human-owned; Agent final PASS remains blocked.
- Handoff to `P2561-P2720` does not enable event-plane storage, connector write, or production readiness.

## Completion Criteria

```text
source limited execution ready
patch candidate rows defined
diff review packet rows defined
apply receipt rows defined
post-apply validation rows defined
rollback target rows defined
operator console action rows defined
PASS owner rows defined
P2561 handoff ready
patch generated now = false
patch applied now = false
write/direct-write/protected/final authority still false
unsafe flag count = 0
ready_for_platform_controlled_write_operator_console_v2
```

## Validation

Run:

```bash
npm run platform:controlled-write-operator-console-v2 -- --check
```
