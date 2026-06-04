# Nous Non-Adoption Reversal Phase Ledger

This ledger covers `P2041-P2120`. It supersedes the future-facing policy of `platform:nous-overlap-audit` because the product decision is now:

```text
Nous is not adopted.
Hermes must restore the runtime-adjacent features that were previously blocked for Nous overlap.
```

## Objective

Reclassify the `P2041+` plan from Nous adapter-only to Hermes-native restoration. This program does not enable runtime execution or writes. It freezes the decision that Hermes owns the runtime governance, API projection, MCP/tool/job policy, Memory Bank, operator console, artifact/event ledger, limited execution lane, and controlled write lane.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P2041-P2060` | Non-Adoption Decision | Record `nous_adopted=false` and mark the prior overlap audit as superseded reference |
| `P2061-P2080` | Surface Restoration Map | Reclassify previously adapter/deprecated/dropped surfaces into Hermes-native restore rows |
| `P2081-P2100` | Restored Capability Roadmap | Freeze restored runtime/API/MCP/tool/job/memory/dashboard capabilities as planned but not enabled |
| `P2101-P2120` | Safety Handoff | Handoff `P2121-P3200` with no execution, no write, no protected action, and no Agent final PASS |

## Source

- Source command: `platform:nous-overlap-audit`
- Source phase: `P2041-P2120`
- Required status: `ready_for_nous_overlap_audit`
- Supersession reason: Nous non-adoption product decision

## Guard Rules

- The prior Nous overlap audit remains evidence of why features were blocked, not the active future policy.
- No direct Nous runtime, API, MCP, memory, job, dashboard, or tool dependency is adopted.
- Hermes-native runtime restoration is allowed only as a plan in this program.
- No command execution, write action, protected action, receipt application, raw material access, legal final authority, release final authority, live trading action, or Agent final PASS is enabled here.
- Every restored function must remain bound to claim, evidence, reviewer, hard gate, receipt where required, rollback where required, and next allowed action.

## Completion Criteria

```text
source Nous overlap audit ready
Nous adopted = false
source audit superseded as historical evidence
12 surface restoration rows present
10 restored capability rows present
P2121-P3200 handoff rows present
execution/write/protected/final authority still false
unsafe flag count = 0
ready_for_platform_nous_non_adoption_reversal
```

## Validation

Run:

```bash
npm run platform:nous-non-adoption-reversal -- --check
```
