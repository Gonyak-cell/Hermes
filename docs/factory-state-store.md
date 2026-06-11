# Factory State Store

Status: FA.1 schema contract, not runtime write authority.
Date: 2026-06-11

## Purpose

The Factory State Store defines the first persistent contract for Hermes as a
SaaS Factory / Product Operating Platform.

It separates two things:

- tracked seed fixtures that can be committed and reviewed
- local operational ledgers that can hold append-only runtime state but must not
  be committed by default

## Split Store Policy

| Store | Path | Git status | Purpose |
|---|---|---|---|
| Tracked seed baseline | `data/factory/seed/` | commit allowed | redacted seed fixtures, schema examples, migration receipts |
| Local operational ledger | `data/factory/local/` | gitignored | append JSONL operational state, local product runs, replay scratch |
| Derived artifacts | `artifacts/factory-product-registry-store/` | gitignored | generated check output and projections |

Rules:

- raw confidential material must not be stored in tracked seed fixtures
- unredacted human notes, secrets, connector payloads, raw transcripts, and
  privileged source bodies must stay out of tracked JSONL
- local operational ledger entries are the operational truth during local runs
- tracked seed fixtures are reviewable baselines, not production truth
- projections are derived views and can be regenerated

## Core Schemas

### `product-record.v1`

`product-record.v1` is the durable product row. It binds:

- `product_id`
- `tenant_id`
- `workspace_id`
- `domain_pack_ids`
- `product_state`
- timestamps
- closed authority flags

Initial FA.1 states are schema-only. FA.2 will add append behavior.

### `product-state-transition.v1`

`product-state-transition.v1` is the append row for product state movement. It
binds:

- `transition_id`
- `product_id`
- `from_state`
- `to_state`
- `receipt_id`
- `payload_sha256`
- `prev_entry_hash`
- closed authority flags

FA.1 defines the shape. FA.2 will enforce append-only hash chaining.

### `factory-receipt-envelope.v1`

`factory-receipt-envelope.v1` is the common receipt wrapper. It binds:

- receipt identity and kind
- issuer role and id
- subject product/artifact/scope
- `payload_sha256`
- `prev_entry_hash`
- closed authority flags

It is not final approval by itself.

## Product State Ladder

| State | Meaning |
|---|---|
| `PS0_seed` | Product row exists as seed or initial intake |
| `PS1_schema_valid` | Required product schema is valid |
| `PS2_receipt_bound` | State movement is tied to a receipt envelope |
| `PS3_candidate_ready` | Candidate generation can be prepared |
| `PS4_apply_ready` | Apply candidate can be considered after protected gate |
| `PS5_limited_execution` | Limited execution candidate exists |
| `PS6_release_candidate` | Release candidate can be evaluated |
| `PS7_deploy_ready` | Deploy-ready classification can be considered |

FA.1 does not enable PS3 or later behavior.

## Authority Boundary

FA.1 keeps these false:

- `project_creation_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`

The owner no-Opus exception allows FA implementation to start at
`owner_exception_low_trust`; it does not change this authority boundary.

## Verification

Run:

```bash
npm run platform:factory-product-registry-store -- --check --require-pass
```

Expected result:

- schema contracts ready
- `data/factory/local/` is gitignored
- sample `product-record.v1` validates
- sample `product-state-transition.v1` validates
- sample `factory-receipt-envelope.v1` validates
- authority flags remain false
