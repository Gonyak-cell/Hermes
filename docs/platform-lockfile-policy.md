# Platform Lockfile Policy

Phase 352 records the lockfile policy detail for the P351-P355 replay handoff
sequence.

`platform:lockfile-policy` consumes P351 Mac/Windows replay notes in memory,
checks package manager and lockfile evidence, and records that dependency
installs, package mutation, lockfile mutation, and artifact regeneration remain
outside this report. Future lockfile changes require human review and a
dedicated replay note.

Default output path:

- `artifacts/platform-lockfile-policy/latest/platform-lockfile-policy.json`
- `artifacts/platform-lockfile-policy/latest/lockfile-policy-rows.json`
- `artifacts/platform-lockfile-policy/latest/lockfile-gate-rows.json`
- `artifacts/platform-lockfile-policy/latest/lockfile-policy-boundary.json`
- `artifacts/platform-lockfile-policy/latest/validation-report.json`
- `artifacts/platform-lockfile-policy/latest/summary.md`

Check mode:

```bash
npm run platform:lockfile-policy -- --check
```

`--check` validates lockfile policy readiness without writing or overwriting
artifacts. Missing package script registration, validation-chain registration,
package-lock evidence, or ledger acceptance blocks the policy.
