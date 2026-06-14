# Controlled Execution Write Deploy

P6601-P7000 prepares controlled execution, patch, and deploy contracts without opening execution, write, or deploy authority.

Command:

```bash
npm run platform:controlled-execution-write-deploy -- --check
```

## Current Boundary

This phase is contract-first:

```text
allowlist contract ready
sandbox and timeout policy ready
redaction and secret scanner ready
patch candidate lane ready
receipt-gated apply boundary ready
deploy receipt contract ready
rollback binding ready
post-apply validation ready
```

But the active no-human milestone mode keeps the following disabled:

```text
command_execution_enabled=false
patch_apply_enabled=false
protected_apply_enabled=false
deploy_enabled=false
external_project_write_enabled=false
raw_sensitive_data_access_enabled=false
agent_runtime_execution_enabled=false
write_action_enabled=false
protected_action_enabled=false
work_os_claim_enabled=false
```

## Review Process

Patch and deploy candidates still follow the same review process:

```text
Codex implementation packet
Harness deterministic validation
Claude Code Opus max independent review receipt
Finding loop and revalidation
Receipt registration
Single-owner trust classification
```

Claude review is a required review receipt for risky patch candidates, but it is not product launch approval and it cannot enable protected apply by itself.

## Artifacts

Outputs are written under `artifacts/controlled-execution-write-deploy/latest`:

- `controlled-execution-write-deploy.json`
- `execution-allowlist-rows.json`
- `sandbox-timeout-policy-rows.json`
- `redaction-secret-scanner-rows.json`
- `patch-candidate-lane-rows.json`
- `receipt-gated-apply-boundary-rows.json`
- `deploy-receipt-contract-rows.json`
- `rollback-binding-rows.json`
- `post-apply-validation-rows.json`
- `execution-negative-fixture-rows.json`
- `controlled-execution-write-deploy-freeze-rows.json`
- `controlled-execution-write-deploy-gate-rows.json`
- `controlled-execution-write-deploy-boundary.json`
- `validation-report.json`
- `summary.md`

## Negative Fixtures

This phase blocks:

- free-form command execution
- direct patch apply
- no-human mode as apply authority
- deploy without receipt
- secret exposure in logs or artifacts
- raw sensitive data access
- external service write
- missing rollback target
