# FA.3 Receipt-Driven Transitions

Status: complete at owner-exception low trust.
Date: 2026-06-11

## Scope

FA.3 adds receipt-driven product state transition handlers for PS0-PS2 only:

- `PS0_seed -> PS1_schema_valid`
- `PS1_schema_valid -> PS2_receipt_bound`

The handler validates product scope, current state, receipt reuse, and
`subject.bound_transition_payload_sha256` before appending receipt and transition
rows to the local operational ledger.

## Changed Contracts

| Contract | File | Change |
|---|---|---|
| `factory-product-registry-store.v1` | `schemas/factory-product-registry-store.schema.json` | FA.3 status, receipt-driven transition readiness, PS3 handler disabled flag |
| `factory-receipt-envelope.v1` | `schemas/factory-receipt-envelope.schema.json` | `subject.bound_transition_payload_sha256` |
| state-store manual | `docs/factory-state-store.md` | PS0-PS2 transition rules and PS3+ absence |

## Verification

Commands run:

```bash
node --check src/factory-product-registry-store.mjs
node --check test/factory-product-registry-store.test.mjs
node --test test/factory-product-registry-store.test.mjs
npm run platform:factory-product-registry-store -- --check --require-pass
```

Observed result:

- `platform:factory-product-registry-store`: `ready_factory_receipt_driven_state_transitions`
- FA.3 targeted tests: 16/16 pass
- default ledger entries: 0
- validation errors: 0

## Executable Negative Fixtures

The FA.3 test suite executes and observes these blocked paths:

- forged transition receipt hash -> reject
- reused receipt -> reject
- PS3 transition attempt -> reject
- missing product scope read -> reject
- cross-product scoped read -> reject

## Authority Boundary

FA.3 records product state only. It does not record or derive authority. These
remain false:

- `project_creation_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`

The active no-Opus exception remains `owner_exception_low_trust`; independent
review receipts are still deferred before production or enterprise trust.

## Handoff

FA.4 may migrate committed seed fixtures and control-plan project rows into
store records with a migration receipt. Existing `const` arrays remain fallback
fixtures until FA.5 projection redirection.
