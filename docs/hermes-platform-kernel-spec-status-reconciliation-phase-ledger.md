# Hermes Platform Kernel Spec/Status Reconciliation Phase Ledger (P1561-P1640)

P1561 starts after `platform:kernel-contract-baseline -- --check` closes as
`ready_for_platform_kernel_contract_baseline`. This slice makes the Kernel
usable as a Harness-native control plane by separating desired specs from
current statuses and reconciling them without mutating runtime state.

The reconciliation layer is read-only. It does not start runtime, execute tools,
apply receipts, write files, mutate Zendd, expose raw secrets or raw client/VDR
material, make legal or release decisions, submit trading actions, or grant
Agent final PASS.

Validation command:

```bash
npm run platform:kernel-spec-status-reconciliation -- --check
```

## P1561-P1580 Kernel Spec Model

Acceptance for P1561-P1580:

- P1561 consumes P1501-P1560 Kernel contract baseline and requires
  `ready_for_platform_kernel_contract_baseline`.
- P1562-P1568 emits desired spec rows for Kernel primitives, Kernel contracts,
  and Kernel source bindings.
- P1569-P1574 requires every spec row to carry evidence, reviewer, hard gate,
  responsible owner, and next action.
- P1575-P1580 keeps specs as declarations only; no migration, command,
  mutation, or runtime route is opened.

## P1581-P1600 Kernel Status Model

Acceptance for P1581-P1600:

- P1581-P1586 emits current status rows corresponding one-to-one with spec
  rows.
- P1587-P1592 marks observed specs as `current_status: observed` and
  `drift_status: none`.
- P1593-P1600 keeps missing or drifted specs fail-closed behind BLOCK
  reconciliation rows.

## P1601-P1620 Reconciliation and Drift

Acceptance for P1601-P1620:

- P1601-P1608 reconciles spec rows to status rows without applying changes.
- P1609-P1614 emits drift rows for Kernel checks and requires
  `drift_detected: false`.
- P1615-P1620 preserves protected BLOCK rows from the Kernel baseline as
  blocked claims with owner, gate, evidence, and next action.

## P1621-P1640 Reconciliation Freeze

Acceptance for P1621-P1640:

- P1621-P1626 verifies no-execution, no-write, no-receipt-application, no raw
  material, no Zendd mutation, and no Agent final PASS invariants.
- P1627-P1632 declares read-only API projection rows for Kernel specs, statuses,
  reconciliations, and invariants.
- P1633-P1636 closes reconciliation gates and supported PASS/BLOCK claim rows.
- P1637-P1640 closes as `ready_for_platform_kernel_spec_status_reconciliation`
  and feeds P1641-P1720 Kernel claim/evidence/gate engine extraction.
