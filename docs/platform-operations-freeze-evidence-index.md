# Platform Operations Freeze Evidence Index

Status: P483 evidence specification.

`platform:operations-freeze-evidence-index` consumes the P482 command matrix in
memory and maps each freeze acceptance command to a proof slot:

- generated report evidence for platform release-check, trading release-check,
  contract validation, release freeze, and control-plane loop commands
- command-result capture evidence for `npm run validate`
- test-result capture evidence for `npm test`

The evidence index declares expected report paths and human-review slots. It does
not run acceptance commands, read generated artifacts, or promote evidence as
complete human signoff.

## Command

```sh
npm run platform:operations-freeze-evidence-index -- --check
```

## Evidence Policy

Rows are `ready` only when the P482 command matrix is ready, the source command
row is ready, the package script and ledger acceptance proof are present, the
check-mode policy is satisfied, and the row declares either an expected report
path or a command/test result capture policy.

## Human Review Note

This artifact is a read-only proof index for the operations freeze. Operators
must still run and review the acceptance commands before treating the freeze as
approved.
