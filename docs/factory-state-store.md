# Factory State Store

Status: FB.4 starter artifact corpus plus FB.3 candidate manifest resolver, FB.2 stage control view, and FA.6 read-only factory products API.
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
| Derived artifacts | `artifacts/factory-*/` | gitignored | generated check output and projections |

Rules:

- raw confidential material must not be stored in tracked seed fixtures
- unredacted human notes, secrets, connector payloads, raw transcripts, and
  privileged source bodies must stay out of tracked JSONL
- local operational ledger entries are the operational truth during local runs
- tracked seed fixtures are reviewable baselines, not production truth
- projections are derived views and can be regenerated

## Local Ledger Files

FA.2 defines three local JSONL ledgers:

| File | Row schema | Purpose |
|---|---|---|
| `products.jsonl` | `product-record.v1` | product registry rows |
| `state-transitions.jsonl` | `product-state-transition.v1` | product PS state movement |
| `receipts-index.jsonl` | `factory-receipt-envelope.v1` | receipt envelopes visible to the factory store |

Each row carries:

- `payload_sha256`: hash of the canonical row payload, excluding chain fields
- `prev_entry_hash`: previous row hash in the same ledger file, or `null`
- `entry_hash`: hash of the ledger name and canonical row including
  `payload_sha256` and `prev_entry_hash`

Append rejects rows when the existing ledger is invalid, the supplied payload
hash is stale, the previous hash is not the current tail, or the row fails its
schema.

Recovery is local-only and truncates a damaged JSONL file to the last valid
prefix. It does not create production or enterprise evidence.

## Tracked Seed Migration

FA.4 introduces the explicit migration command:

```bash
npm run factory:seed-migration -- --check --require-pass
```

The command owns writes to `data/factory/seed/`. It migrates:

- 4 control-plan products from `src/product-domain-saas-factory.mjs`
- 5 fixture portfolio products from `src/work-os-live-control-surface.mjs`
- 1 `factory-receipt-envelope.v1` migration receipt

The original `const` arrays stay as fallback fixtures. FA.5 redirects
`multi-project-saas-control-plane` to read from the store first while keeping the
fallback visible.

## Projection Redirection

FA.5 redirects one projection:

```bash
npm run platform:multi-project-saas-control-plane -- --check
```

Read order:

1. `data/factory/local/products.jsonl`
2. `data/factory/seed/products.jsonl`
3. existing P9400 source projection fallback

The projection exposes `factory_product_source_tier`,
`factory_product_source_fallback_used`, and selected product counts in its
summary and registry rows. The default tracked seed path selects 5
`fixture_portfolio` rows for the multi-project registry.

## Review API Projection

FA.6 adds the read-only Review API route:

```bash
node scripts/review-api.mjs --once /api/factory/products
```

Read order:

1. `data/factory/local/products.jsonl`
2. `data/factory/seed/products.jsonl`
3. fail closed with `503 factory_products_unavailable`

The API response exposes `source_tier`, `read_only: true`,
`mutation_allowed: false`, `method_allowlist: ["GET", "HEAD"]`, and
`raw_confidential_material_visible: false`. It deliberately does not expose raw
confidential material flags from the source rows and does not convert the P9400
fallback projection into factory-store truth.

`POST`, `PUT`, `PATCH`, and `DELETE` on `/api/factory/products` are executable
negative fixtures and return `405 method_not_allowed`.

## Factory Stage Read Model

FB.1 adds the deterministic stage projection command, and FB.2 extends the
same projection into a read-only control view:

```bash
npm run factory:stage -- --check --require-pass
```

The read model:

- reads products from `data/factory/local/products.jsonl` first, then
  `data/factory/seed/products.jsonl`
- reads state transitions from the tracked seed and local operational ledger
- treats products as single-source operational-first truth, while transitions
  are append events unioned across seed and local tiers
- computes `current_product_state` from the latest transition for each product
- exposes `/api/factory/stage` as a read-only collection
- marks the API response as `raw_confidential_material_visible: false`
- blocks the read model when PS3 or later transition rows are present before FB
  promotion
- exposes `gate_status`, visible `blocker_ids`, `next_operator_actions`, and
  `stage_progress` without opening execution authority
- applies a seven-day freshness window; stale rows require a stale badge and
  block new adjudication until sources are refreshed
- exposes candidate/workbench queue depth as `0`; candidate JSON previews are
  resolved by the separate FB.3 candidate manifest resolver

FB.2, FB.3, and FB.4 keep these false:

- `ps3_transition_append_allowed_now`
- `candidate_manifest_write_allowed_now`
- `apply_allowed_now`
- all project/repo/connector/deploy/protected-action/production/enterprise
  authority flags

## Candidate Manifest Resolver

FB.3 adds the deterministic JSON-only candidate manifest resolver, and FB.4
binds its planned starter artifact refs to the tracked starter corpus:

```bash
npm run factory:candidate-manifests -- --check --require-pass
```

The resolver:

- reads the FB.2 stage read model as its source of truth
- returns one resolver row per product
- creates a `factory-candidate-manifest.v1` JSON preview only for fresh
  `PS2_receipt_bound` products whose starter artifact refs are materialized
- blocks stale products, PS0/PS1 products, and PS3+ rows from candidate manifest
  availability
- blocks otherwise eligible products when required starter artifact files are
  missing
- exposes `/api/factory/candidate-manifests` as a read-only collection
- marks responses as `raw_confidential_material_visible: false`
- reports starter artifact `exists_now`, `content_sha256`, `byte_count`, and
  `content_type` on planned refs
- keeps source writes, ledger appends, candidate manifest writes, apply behavior,
  PS3 transition append, project/repo/connector/deploy/protected-action,
  production PASS, and enterprise PASS closed

Default tracked seed state still returns 9 resolver rows and 0 candidate
manifests because all tracked seed products remain `PS0_seed`.

## Starter Artifact Corpus

FB.4 materializes the starter templates referenced by domain pack manifests and
factory candidate manifests:

```bash
npm run factory:starter-artifacts -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/starter-artifacts
```

The corpus validator reads:

- `packs/*/pack.json` template refs
- factory candidate starter refs for `pack.law_firm`, `pack.personal_dev`,
  `pack.platform`, `pack.human_resources`, `pack.external_adapter`, and
  `pack.trading`
- tracked files under `templates/`

The validator refuses unsafe paths, missing files, empty files, invalid JSON
starter files, and obvious sensitive markers. It returns SHA-256 hashes for all
materialized starter files. It does not instantiate products, append ledgers,
write candidate manifests, apply diffs, or open production/enterprise trust.

## Claude Review Evidence Validator

Factory promotion review artifacts are classified before they can be counted:

```bash
npm run factory:claude-review-evidence -- --raw-review <raw.json> --prompt <prompt.md> --review-id <id> --program-range <range> --check --require-valid
```

The validator rejects auth/login failures, quota or rate-limit output,
interrupted captures, tool-call-shaped output, missing verdict payloads, final
approval claims, production/enterprise PASS claims, and source mutation claims.

## Receipt-Driven State Transitions

FA.3 enables only these receipt-driven transitions:

- `PS0_seed -> PS1_schema_valid`
- `PS1_schema_valid -> PS2_receipt_bound`

A transition receipt must:

- validate as `factory-receipt-envelope.v1`
- match the requested `product_id`
- carry `subject.bound_transition_payload_sha256`
- bind that hash to the exact canonical transition payload
- be unused in the product state transition ledger

`PS3_candidate_ready` and later states have no handler in FA.3.

## Core Schemas

### `product-record.v1`

`product-record.v1` is the durable product row. It binds:

- `product_id`
- `tenant_id`
- `workspace_id`
- `domain_pack_ids`
- `product_state`
- `receipt_id`
- `payload_sha256`
- `prev_entry_hash`
- timestamps
- closed authority flags

FA.2 append behavior is local-ledger only.

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

FA.2 enforces append-only hash chaining.

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

FA.5 keeps these false:

- `project_creation_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `production_pass_enabled`
- `enterprise_pass_enabled`

The owner no-Opus exception allows FA implementation to start at
`owner_exception_low_trust`; it does not change this authority boundary.

## Scoped Reads

Product reads require an explicit `product_id`. A read with no scope, or a read
that asks for a different `product_id` than the current scope, is rejected.
Cross-product mixing is not a projection concern; it is blocked at the store
read boundary.

## Verification

Run:

```bash
npm run platform:factory-product-registry-store -- --check --require-pass
```

Expected result:

- schema contracts ready
- `data/factory/local/` is gitignored
- `data/factory/seed/` contains 9 product records and 1 migration receipt
- `multi-project-saas-control-plane` reads factory products from tracked seed by default
- `/api/factory/products` exposes factory products as a read-only Review API collection
- `HEAD /api/factory/products` returns a bodyless 200-class read
- mutating `/api/factory/products` methods are rejected with `405 method_not_allowed`
- `factory:stage` projects 9 tracked seed products as PS0 stage rows by default
- `/api/factory/stage` exposes read-only product PS state rows
- `/api/factory/stage` exposes FB.2 control fields: `gate_status`,
  `freshness_status`, `stale_badge_required`,
  `candidate_manifest_preview_status`, blocker IDs, queue depths, and next
  operator actions
- `factory:candidate-manifests` returns 9 blocked tracked-seed resolver rows and
  0 candidate manifests by default
- `factory:claude-review-evidence` rejects the FB.3 429 invalid attempt as
  `invalid_not_review_evidence`
- `/api/factory/candidate-manifests` exposes read-only JSON-only candidate
  resolver rows
- stale stage rows display a stale badge and block new adjudication
- PS3+ transition rows block the stage read model before FB promotion
- projection fallback, if needed, is visible in summary and row fields
- sample `product-record.v1` validates
- sample `product-state-transition.v1` validates
- sample `factory-receipt-envelope.v1` validates
- existing JSONL ledgers validate when present
- receipt-driven PS0-PS2 handlers are ready
- PS3 transition handler remains disabled
- `factory:seed-migration` validates the tracked seed hash chain
- `--check` does not write ledger or artifact files
- authority flags remain false
