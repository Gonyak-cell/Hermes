# G1a First-Use Audit Readiness

Status: first-use audit fixture is source-bound; protected authority remains closed.

This layer validates the post-opening first-use audit path for G1a. The default
repo state now includes a source-controlled audit fixture at
`examples/factory/g1a-first-use-audit-gonyak-cell-alpha.json` and a source-literal
binding in `SOURCE_LITERAL_FIRST_USE_AUDITS`.

It does not perform a new first use, mutate source by command, open protected
runtime authority, create another workspace, or grant production or enterprise
trust.

## Commands

```bash
npm run factory:g1a-first-use-audit-readiness
npm run factory:g1a-first-use-audit-readiness -- --check
npm run factory:g1a-first-use-audit-readiness -- --check --require-pass
npm run factory:g1a-first-use-audit-readiness -- --audit path/to/audit.json --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-first-use-audit-readiness
```

The default repo state has the signed owner receipt, source-literal G1a opening
marker, and first-use audit fixture bound. The command therefore returns
`g1a_first_use_audit_already_bound`.

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

- status: `g1a_first_use_audit_already_bound`
- audit candidate present: true
- first-use audit already bound: true
- ready for first-use audit source binding: false
- readiness rows pass/wait/fail: 17/0/0
- G1a gate open now: false
- validation errors: 0

The prior ready-to-bind state is still supported for injected candidates and
pre-binding tests. The default path is now the post-binding state: evidence is
closed, while protected runtime authority remains closed.
