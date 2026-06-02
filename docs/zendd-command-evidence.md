# Zendd Command Evidence

`project:zendd-command-evidence` is the P561-P580 bridge from Zendd package
scripts to Hermes evidence refs. It does not execute Zendd commands.

## Command

```bash
npm run project:zendd-command-evidence -- --check
```

Optional:

```bash
npm run project:zendd-command-evidence -- --zendd-root <path>
```

## Outputs

- `artifacts/zendd-command-evidence/latest/zendd-command-evidence.json`
- `artifacts/zendd-command-evidence/latest/command-evidence-policy.json`
- `artifacts/zendd-command-evidence/latest/command-evidence-rows.json`
- `artifacts/zendd-command-evidence/latest/command-review-binding-rows.json`
- `artifacts/zendd-command-evidence/latest/protected-command-rows.json`
- `artifacts/zendd-command-evidence/latest/command-evidence-freeze-rows.json`
- `artifacts/zendd-command-evidence/latest/validation-report.json`
- `artifacts/zendd-command-evidence/latest/summary.md`

## Safety Boundary

- Every Zendd command is assigned a `claim_id`, `command_evidence_ref`,
  `expected_artifact_ref`, reviewer/gate ref, verdict, block reason, owner, and
  next allowed action.
- `test`, `lint`, `validate`, and similar scripts are evidence candidates only.
  They remain blocked until an explicit work order and capture request exist.
- Runtime, database, packaging, dependency, and mutating commands remain
  protected or blocked commands.
- PASS is impossible without command evidence, redaction report, review or hard
  gate, and human receipt when protected.
- Raw logs, secret values, raw VDR payloads, and unscoped client documents are
  forbidden capture fields.
