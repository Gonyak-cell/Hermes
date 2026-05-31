# Platform Artifact Guard

Phase 345 closes the first runtime/dependency drift-report sequence with a
read-only artifact guard.

`platform:artifact-guard` consumes the P344 operator handoff in memory and checks
that P341-P345 generated outputs stay under the ignored `artifacts/` tree, that
the platform reproducibility commands are registered in `package.json`, and that
the validation chain includes those checks. It does not run those commands,
overwrite artifacts, regenerate artifacts, mutate package files, import git
history, publish releases, or execute recovery.

Default output path:

- `artifacts/platform-artifact-guard/latest/platform-artifact-guard.json`
- `artifacts/platform-artifact-guard/latest/artifact-guard-rows.json`
- `artifacts/platform-artifact-guard/latest/check-mode-rows.json`
- `artifacts/platform-artifact-guard/latest/source-policy-rows.json`
- `artifacts/platform-artifact-guard/latest/artifact-guard-boundary.json`
- `artifacts/platform-artifact-guard/latest/validation-report.json`
- `artifacts/platform-artifact-guard/latest/summary.md`

Check mode:

```bash
npm run platform:artifact-guard -- --check
```

`--check` validates the guard without writing or overwriting artifacts. If a
P341-P345 platform command is missing from `package.json`, the generated
artifact tree is no longer ignored, or the source P344 handoff is blocked, this
guard fails.
