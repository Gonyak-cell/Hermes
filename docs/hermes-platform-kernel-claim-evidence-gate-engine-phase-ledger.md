# Hermes Platform Kernel Claim/Evidence/Gate Engine Phase Ledger (P1641-P1720)

P1641 starts after `platform:kernel-spec-status-reconciliation -- --check`
closes as `ready_for_platform_kernel_spec_status_reconciliation`. This slice
extracts the reusable Kernel claim/evidence/gate engine from the reconciled
spec/status rows.

The engine is still read-only. It evaluates whether PASS/BLOCK rows are
supported, but it does not start runtime, execute tools, apply receipts, write
files, mutate Zendd, expose raw secrets or raw client/VDR material, make legal
or release decisions, submit trading actions, or grant Agent final PASS.

Validation command:

```bash
npm run platform:kernel-claim-evidence-gate-engine -- --check
```

## P1641-P1660 Engine Components and Verdict Rules

Acceptance for P1641-P1660:

- P1641 consumes P1561-P1640 reconciliation and requires
  `ready_for_platform_kernel_spec_status_reconciliation`.
- P1642-P1648 declares claim, evidence, gate, artifact, check, and receipt
  engine components.
- P1649-P1654 declares fail-closed verdict rules for PASS evidence, reviewer,
  hard gate, owner, next action, BLOCK reason, unsafe flag, harness authority,
  and protected BLOCK preservation.
- P1655-P1660 keeps all components read-only and non-mutating.

## P1661-P1680 Claim Input and Evidence Binding

Acceptance for P1661-P1680:

- P1661-P1666 imports reconciled Kernel claim rows as claim input rows.
- P1667-P1674 binds every claim input to evidence_ref without exposing raw
  material.
- P1675-P1680 verifies every PASS and BLOCK claim remains supported by evidence,
  reviewer, hard gate, owner, next action, unsafe flag, and harness authority.

## P1681-P1700 Gate Binding and Evaluation

Acceptance for P1681-P1700:

- P1681-P1686 binds every claim input to reviewer and hard gate refs.
- P1687-P1694 emits evaluation rows with no mutation required and no execution
  allowed.
- P1695-P1700 preserves protected BLOCK rows from the source reconciliation.

## P1701-P1720 Engine Freeze

Acceptance for P1701-P1720:

- P1701-P1706 declares read-only API projection rows for claim inputs, evidence
  bindings, gate bindings, and evaluations.
- P1707-P1712 verifies runtime, write, protected action, receipt application,
  raw material, Zendd mutation, legal/release/live trading, and Agent final PASS
  remain disabled.
- P1713-P1716 closes engine gates and supported PASS/BLOCK claim rows.
- P1717-P1720 closes as `ready_for_platform_kernel_claim_evidence_gate_engine`
  and feeds P1721-P1800 Kernel artifact/check/receipt engine extraction.
