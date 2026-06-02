# Platform Claim Receipt Workspace

`platform:claim-receipt-workspace` covers P502-P505 of Claim Adjudication and
Human Receipt Realization. It consumes the P501 intake contract in memory and
declares the external workspace, source registry, `human_receipt_ref` format,
and invalid receipt quarantine boundary needed before any receipt can be
validated.

The command does not receive receipt payloads, read external receipt content,
bind `human_receipt_ref`, validate receipts, apply approval, promote PASS, run
commands, mutate packages or lockfiles, publish releases, run git, inspect
secrets, mutate Desktop state, or enable trading writes.

## Check

```bash
npm run platform:claim-receipt-workspace -- --check
```

Expected status:

- `ready_for_claim_receipt_workspace`
- 40 workspace rows
- 40 source registry rows
- 40 `human_receipt_ref` format rows
- 40 invalid receipt quarantine rows
- 14 ready gates
- zero validation errors
