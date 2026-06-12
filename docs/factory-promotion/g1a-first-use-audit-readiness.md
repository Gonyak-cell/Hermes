# G1a First-Use Audit Readiness

Status: readiness layer ready locally, waiting for G1a source-literal opening.

This layer prepares the post-opening first-use audit path for G1a. It validates a
future first-use audit candidate and produces a preview-only source binding for
`SOURCE_LITERAL_FIRST_USE_AUDITS`.

It does not perform the first use, bind the audit into source, open G1a, create a
workspace, or grant production or enterprise trust.

## Commands

```bash
npm run factory:g1a-first-use-audit-readiness
npm run factory:g1a-first-use-audit-readiness -- --check
npm run factory:g1a-first-use-audit-readiness -- --audit path/to/audit.json --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-first-use-audit-readiness
```

The default repo state still has no signed owner receipt, no isolated G1a
source-literal opening commit, and no first-use audit. The command therefore
returns `waiting_for_g1a_opening_source_literal_commit`.

## Audit Candidate Contract

A future audit candidate must use:

- `schema_version: factory-g1a-first-use-audit.v1`
- `gate_id: G1a`
- `authority_flag: project_creation_allowed_now`
- `target_action: project_workspace_creation`
- one signed owner receipt id and SHA-256
- one candidate manifest or packet SHA-256
- one product id, one workspace id, one actor id, and action timestamps
- all first-use checklist item ids completed
- no cross-tenant, privileged, confidential, or scope-violating data exposure
- successful first use with no rollback or demotion required

## Boundaries

- `first_use_audit_bound_by_this_command: false`
- `source_mutation_allowed_now: false`
- `project_creation_allowed_now: false`
- `repo_write_allowed_now: false`
- `command_execution_enabled: false`
- `deployment_allowed_now: false`
- `production_pass_enabled: false`
- `enterprise_pass_enabled: false`

## Current Local Result

Current default result:

- status: `waiting_for_g1a_opening_source_literal_commit`
- audit candidate present: false
- ready for first-use audit source binding: false
- G1a gate open now: false
- validation errors: 0

The future ready state requires the signed owner receipt and isolated G1a
source-literal opening commit to be present first. A valid audit candidate can
then become `ready_g1a_first_use_audit_for_source_literal_binding`, still as a
preview-only source binding step.
