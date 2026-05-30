# Hermes Harness v1.0 Freeze

Phase 312 adds `v1_freeze`, a deterministic read-only freeze report for the Hermes Harness v1.0 acceptance envelope.

The report records:

- P311 release candidate status and P312 handoff.
- Dashboard/API Desktop readiness and zero blocking gates.
- Contract golden fixture and validation-suite status.
- Control-plane checkpoint and loop status.
- Final ledger/roadmap closure status.
- Human-review backlog visibility.
- Tag/release checklist rows that remain documented but unexecuted.

The freeze report does not create tags, publish releases, run commands, start servers, deploy, recover, rollback, restore, execute protected actions, generate legal advice, or generate client-facing output.

Primary command:

```bash
npm run release:freeze -- --check
```

Primary artifact:

```text
artifacts/v1-freeze/latest/v1-freeze.json
```
