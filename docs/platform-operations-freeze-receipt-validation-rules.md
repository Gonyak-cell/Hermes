# Platform Operations Freeze Receipt Validation Rules

`platform:operations-freeze-receipt-validation-rules` records the P491 validation rules for the P490 operations-freeze receipt queue. It consumes the queue rows in memory and declares the future receipt payload fields and decisions required before any operations-freeze signoff can advance.

The validation-rules ledger is report-only. It does not receive receipt payloads, validate receipts, mark rows ready for validation, complete signoff, apply approval, run acceptance commands, run package scripts, read generated artifacts, write protected artifacts, mutate dependencies or lockfiles, publish releases, run git operations, execute protected recovery, enable trading live/full-auto/order submission, mutate Desktop state, inspect secrets, read `.env`, or perform credential lookup.

## Acceptance

- P490 operations-freeze receipt queue is ready.
- `package.json` registers `platform:operations-freeze-receipt-validation-rules`.
- `npm run validate` includes `npm run platform:operations-freeze-receipt-validation-rules -- --check`.
- P491 is recorded in `docs/platform-operations-stability-phase-ledger.md`.
- Seven validation rule rows declare required receipt fields and allowed decisions.
- No receipt payload is received or validated by this phase.
