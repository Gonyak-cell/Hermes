# Platform Claim Receipt Intake Contract

Status: P501 command specification.

`platform:claim-receipt-intake-contract` starts the P501-P520 Claim
Adjudication and Human Receipt Realization tranche. It consumes the P500
claim-freeze output in memory and turns every `missing_human_receipt` BLOCK
claim into a stable human receipt intake contract.

This command does not receive a receipt, validate a receipt, apply an approval,
or promote a claim to PASS. It only defines the fields a future receipt must
carry before later adjudication phases can consider a verdict change.

## Command

```sh
npm run platform:claim-receipt-intake-contract -- --check
```

## Human Review Note

P501 preserves all P500 BLOCK verdicts. A claim can become a PASS candidate only
after a later phase receives and validates a human receipt bound to the frozen
`claim_id`, `source_phase_slot`, evidence reference, reviewer/gate linkage, and
responsible owner.
