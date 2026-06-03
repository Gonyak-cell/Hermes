# Hermes Platform Kernel Contract Baseline Phase Ledger (P1501-P1560)

P1501 starts after `platform:agent-operator-console-v0 -- --check` closes as
`ready_for_agent_operator_console_v0_freeze`. This slice begins the
P1501-P2040 Platform Kernel and Harness-native cutover by extracting common
Kernel primitives from the Agent activation, domain no-write pilot, and operator
console outputs.

The baseline does not start runtime, execute tools, apply receipts, write files,
mutate Zendd, expose raw secrets or raw client/VDR material, make legal or
release decisions, submit trading actions, or grant Agent final PASS.

Validation command:

```bash
npm run platform:kernel-contract-baseline -- --check
```

## P1501-P1520 Kernel Primitive Manifest

Acceptance for P1501-P1520:

- P1501 consumes P1441-P1500 console output and requires
  `ready_for_agent_operator_console_v0_freeze`.
- P1502-P1506 declares common Kernel primitives: claim, evidence, gate,
  artifact, check, and receipt.
- P1507-P1512 binds P1201-P1320, P1321-P1440, and P1441-P1500 as Kernel source
  rows.
- P1513-P1520 emits a manifest with primitive, source, contract, claim, gate,
  check, and boundary counts.

## P1521-P1540 Contract Baseline Mapping

Acceptance for P1521-P1540:

- P1521-P1526 maps capability, block, receipt, next-action, API route, claim,
  gate, and boundary collections into Kernel contracts.
- P1527-P1532 preserves protected BLOCK rows as Kernel block projections.
- P1533-P1536 requires every Kernel PASS/BLOCK claim to carry evidence,
  reviewer, hard gate, owner, and next action.
- P1537-P1540 keeps raw payloads and protected actions outside the Kernel
  baseline.

## P1541-P1560 Kernel Baseline Freeze

Acceptance for P1541-P1560:

- P1541-P1546 verifies source readiness, primitive completeness, contract
  coverage, protected block preservation, and no-execution invariants.
- P1547-P1552 closes cutover rows for manifest stability, common primitive
  readiness, and console binding.
- P1553-P1556 keeps runtime, write, receipt application, raw material, protected
  action, legal/release/live trading, and Agent final authority disabled.
- P1557-P1560 closes as `ready_for_platform_kernel_contract_baseline` and feeds
  P1561-P1640 Kernel spec/status reconciliation.
