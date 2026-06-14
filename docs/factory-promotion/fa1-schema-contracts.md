# FA.1 Schema Contracts

Status: complete at owner-exception low trust.
Date: 2026-06-11

## Scope

FA.1 establishes the first persistent factory state contracts:

- `product-record.v1`
- `product-state-transition.v1`
- `factory-receipt-envelope.v1`
- split store policy for tracked seed and local operational ledger

This phase does not implement append JSONL writes. FA.2 owns append behavior,
hash-chain enforcement, replay checks, and product-scoped reads.

## Inputs

- F0 aggregate gate: `npm run factory:promotion-f0-gate -- --check --require-pass`
- Owner no-Opus exception:
  [f0-owner-no-opus-exception-receipt.json](f0-owner-no-opus-exception-receipt.json)
- Target architecture schema draft:
  [04-target-architecture.md](04-target-architecture.md)

## Changed Contracts

| Contract | File | Purpose |
|---|---|---|
| `factory-product-registry-store.v1` | `schemas/factory-product-registry-store.schema.json` | FA.1 readiness output plus `product-record.v1` and `product-state-transition.v1` definitions |
| `factory-receipt-envelope.v1` | `schemas/factory-receipt-envelope.schema.json` | common receipt wrapper with payload hash, previous hash, issuer, subject, and closed authority flags |
| split store policy | `docs/factory-state-store.md` | tracked seed vs local operational ledger boundary |

## Verification

Commands run:

```bash
npm run platform:factory-product-registry-store -- --check --require-pass
npm run contracts:validate -- --check
node --test test/factory-product-registry-store.test.mjs test/factory-promotion-f0-gate.test.mjs test/factory-receipt-preflight.test.mjs test/factory-f0-review-receipt-intake.test.mjs test/saas-factory-mode.test.mjs
```

Observed result:

- `platform:factory-product-registry-store`: `ready_factory_product_registry_store_schema_contracts`
- `contracts:validate`: `complete`, 214 fixtures passed
- targeted tests: 33/33 pass

## Authority Boundary

FA.1 keeps these false:

- `project_creation_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`

The active F0.1 no-Opus exception only permits FA implementation to proceed at
`owner_exception_low_trust`.

## Handoff

FA.2 may implement append-only local operational ledger behavior under:

- tracked seed root: `data/factory/seed/`
- local operational ledger root: `data/factory/local/`
- local ledger remains gitignored by default
- raw confidential material remains forbidden in tracked seed fixtures
