# Factory State Store

Status: G0 gate opening readiness, FD.1 receipt verification plus FC.5 candidate freeze handoff, FC.4 candidate review docket API, FC.3 candidate review docket, FC.2 candidate lane proof, FC.1 candidate lane, FB.5 workbench, FB.4 starter artifact corpus, FB.3 candidate manifest resolver, FB.2 stage control view, and FA.6 read-only factory products API.
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

## Factory Workbench Read Model

FB.5 adds the integrated read-only factory workbench view:

```bash
npm run factory:workbench -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/workbench
```

The workbench reads the candidate manifest resolver, which already binds the
stage read model and starter artifact corpus. It returns one row per product
with:

- PS state, stage gate status, freshness, blockers, and next operator actions
- candidate manifest preview status, id, hash, and JSON preview when a fresh
  `PS2_receipt_bound` product is eligible
- starter artifact materialization counts
- read-only affordances such as `view_stage_status`,
  `view_candidate_manifest_json`, and `view_candidate_hash`
- forbidden affordances such as `append_ledger`, `advance_ps3`,
  `apply_candidate`, `call_connector`, `deploy`, production PASS, and
  enterprise PASS

The default tracked seed still returns 9 stage-only workbench rows and 0
candidate previews. A fresh operational PS2 fixture returns 1 candidate preview
without opening source writes, ledger appends, candidate manifest writes, apply,
connector, deploy, production, or enterprise authority.

## Factory Candidate Lane

FC.1 adds the read-only candidate lane:

```bash
npm run factory:candidate-lane -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/candidate-lane
```

The candidate lane reads the FB.5 workbench. For each fresh
`PS2_receipt_bound` product with a visible JSON candidate manifest, it builds a
reviewable packet containing:

- a planned isolated git-worktree path
- a real unified diff packet for a generated candidate JSON file
- a draft rollback plan bound to the diff hash
- an executed deterministic preflight record
- a chained candidate hash ledger row

FC.1 still performs no worktree creation and no repository write. The isolated
workspace is a path-scoped plan, not an applied checkout mutation. Default
tracked seed state returns 0 candidate packets because no seed product has
advanced to `PS2_receipt_bound`; operational PS2 fixtures produce candidate
packets for review.

The executable negative fixtures keep these paths closed:

- candidate apply attempt
- write outside the planned isolated worktree
- protected path diff target

These remain false:

- `source_file_write_allowed_now`
- `ledger_append_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `patch_apply_enabled`
- `apply_allowed_now`
- production PASS and enterprise PASS

## Factory Candidate Lane Proof

FC.2 adds the deterministic proof harness:

```bash
npm run factory:candidate-lane-proof -- --check --require-pass
```

The proof harness builds a temporary OS-ledger scenario with three
`PS2_receipt_bound` products, then runs the FC.1 candidate lane against that
temporary ledger. A ready proof must show:

- 3 proof products
- 3 ready candidate packets
- 3 unapplied unified diff packets
- 3 draft rollback plans
- 3 executed passing preflights
- 3 chained candidate hash ledger rows
- passed apply/path/protected-path negative fixtures
- temporary ledger cleanup completed

The proof writes only to an OS temporary ledger during execution and deletes it
after the build unless `--keep-temp-ledger` is explicitly supplied. It does not
write `data/factory/local/`, does not write `data/factory/seed/`, does not
create git worktrees, does not write source files, does not append persistent
ledgers, does not call connectors, does not deploy, and does not open
production or enterprise trust.

The proof isolates writes, while intentionally reading the committed seed and
starter artifact corpus. A degraded starter corpus can therefore block the
proof, but it cannot inflate the three proof products because operational
product rows are single-source truth in the stage read model. Candidate packet
hashes, proof row hashes, and candidate hash-ledger entry hashes are
environment- and run-scoped because they include absolute workspace metadata and
the run timestamp; use `--run-at` for deterministic local snapshots.

## Factory Candidate Review Docket

FC.3 adds the deterministic candidate review docket:

```bash
npm run factory:candidate-review-docket -- --check --require-pass
```

The docket consumes the FC.2 proof scenario by default and emits one review
docket row plus one review packet row per candidate packet. Each row binds the
candidate packet hash, candidate manifest hash, diff hash, rollback hash,
preflight hash, and candidate hash-ledger entry hash. It then records a chained
review hash register over the review docket and review packet hashes.

The docket is a review surface only. It requires human owner and independent
review lanes before any future apply phase, while keeping
`review_decision_allowed_now`, `approval_allowed_now`, `apply_allowed_now`,
source writes, persistent ledger appends, repo writes, connector writes,
deployment, protected action, production PASS, and enterprise PASS false.

Negative fixtures execute guards that block auto-approval, apply without a
review receipt, and mismatched candidate hash binding. The default tracked seed
candidate lane has zero candidate packets, so FC.3 fails closed unless the FC.2
proof scenario or an explicit candidate-lane JSON source provides three
packets. Explicit candidate-lane JSON files are operator-supplied artifacts:
FC.3 validates required hash fields and manifest-binding flags before a ready
docket, but it does not convert those files into approval or apply authority.

## Factory Candidate Review Docket API

FC.4 exposes the candidate review docket through the read-only Review API:

```bash
node scripts/review-api.mjs --once '/api/factory/candidate-review-docket?limit=1'
```

The route returns `factory_candidate_review_docket_rows` as the primary
collection and includes visible review packet rows, visible review hash-register
rows, negative fixture rows, the source candidate-lane summary, and closed
authority boundary fields. `GET` and `HEAD` are allowed. `POST`, `PUT`,
`PATCH`, and `DELETE` return `405 method_not_allowed`. A blocked underlying
candidate review docket returns `503 factory_candidate_review_docket_unavailable`.

The route is a review surface only. It does not decide review outcomes, approve
candidates, apply patches, create worktrees, write source files, append
persistent ledgers, write repositories, call connectors, deploy, or grant
production/enterprise trust.

## Factory Candidate Freeze Handoff

FC.5 closes the FC tranche with a deterministic freeze and FD handoff artifact:

```bash
npm run factory:candidate-freeze-handoff -- --check --require-pass
```

The artifact binds FC.2 proof, FC.3 review docket, FC.4 Review API smoke,
FC.1-FC.4 Claude review evidence status, and a chained canonical run hash
register. It can set `fd_implementation_handoff_allowed_now: true` only when
candidate packet proof, review docket visibility, API visibility, clean review
evidence, canonical hash-chain integrity, and authority closure are all ready.

This handoff allows FD implementation planning and code work only. It does not
enable runtime apply, source writes, persistent ledger appends, repository
writes, connector writes, deployment, protected action, production PASS, or
enterprise PASS.

## Factory Receipt Verification

FD.1 verifies receipt integrity for candidate packets without making the apply
engine reachable:

```bash
npm run factory:receipt-verify -- --check --require-pass
```

The verifier consumes the FC.5 freeze handoff, FC.3 review docket, tracked seed
receipt ledger, and `factory-receipt-envelope.v1`. It creates three
owner-attestation receipt rows bound to candidate packet hashes as deterministic
verification fixtures, not final owner approval. It rejects four executable
negative fixtures: forged candidate hash, missing/forged owner attestation,
nonce replay, and apply-engine-open attempt.

The apply engine and rollback executor stay contractually closed:
`receipt_apply_engine_reachable_now`, `apply_engine_runtime_enabled_now`, and
`rollback_executor_runtime_enabled_now` are false. FD.1 does not write source
files, append persistent ledgers, write repositories, call connectors, deploy,
or grant protected/production/enterprise authority.

## Factory Gate Opening Readiness

G0 adds the read-only G-series gate opening readiness model:

```bash
npm run factory:gate-opening-readiness -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/gate-opening-readiness
```

The model exposes one row each for G1a, G1b, G2, and G3. It proves that G1a is
ready for the owner `gate_opening` receipt and isolated source literal opening
commit, while G1b/G2/G3 remain blocked by gate order or missing usage/release
evidence.

All authority flags remain false. Runtime data cannot open a gate; future
gate-opening commits must change source literals in isolation, pass independent
review, bind an owner receipt, and capture the first-use audit.

## Factory G1a Opening Packet

G1a adds the packet-only preparation surface for opening project creation later:

```bash
npm run factory:g1a-opening-packet -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-opening-packet
```

The packet creates the owner `gate_opening` receipt template, the isolated
`SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a` change plan, the Law Firm OS-style Claude
Opus 4.8 Max review packet, and the first-use audit checklist. It does not sign
the receipt, apply the source literal change, complete independent review, run
the first-use audit, or open `project_creation_allowed_now`.

## Factory G1a Owner Receipt Intake

G1a owner receipt intake validates a future signed owner `gate_opening` receipt
before the isolated source-literal commit can be prepared:

```bash
npm run factory:g1a-owner-receipt-intake -- --check
node scripts/review-api.mjs --once /api/factory/g1a-owner-receipt-intake
```

The current default owner receipt is the unsigned G1a template, so the intake
status is `waiting_for_signed_g1a_owner_receipt`. A valid signed receipt can
make the intake ready for the source-literal commit, but this still does not
open G1a, create a workspace, or enable `project_creation_allowed_now`.

## Factory G1a Source Literal Preflight

G1a source literal preflight validates the future isolated commit shape that can
bind one signed owner receipt to `SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a`:

```bash
npm run factory:g1a-source-literal-preflight -- --check
node scripts/review-api.mjs --once /api/factory/g1a-source-literal-preflight
```

The default state is still `waiting_for_signed_g1a_owner_receipt`. The preflight
is read-only and preview-only: it does not edit `src/factory-gate-opening-readiness.mjs`,
does not add receipt literals, does not claim first-use audit, and does not open
`project_creation_allowed_now`.

## Factory G1a Opening Closeout Readiness

G1a opening closeout readiness aggregates the G0, packet, owner receipt intake,
and source-literal preflight layers into one read-only blocker surface:

```bash
npm run factory:g1a-opening-closeout-readiness -- --check
node scripts/review-api.mjs --once /api/factory/g1a-opening-closeout-readiness
```

The current chain is 4 pass / 6 wait / 0 fail. The waiting blockers are the
signed owner receipt, receipt intake with that signed receipt, source-literal
preflight with that receipt, the isolated source-literal commit, source receipt
binding, and the first-use audit. The command does not open G1a or grant project
creation authority.

## Factory G1a First-Use Audit Readiness

G1a first-use audit readiness validates a future first workspace-creation audit
candidate and renders a preview-only source binding for
`SOURCE_LITERAL_FIRST_USE_AUDITS`:

```bash
npm run factory:g1a-first-use-audit-readiness -- --check
npm run factory:g1a-first-use-audit-readiness -- --audit path/to/audit.json --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-first-use-audit-readiness
```

The default state is `waiting_for_g1a_opening_source_literal_commit` because
G1a is still closed. The command does not perform first use, bind an audit into
source, mutate `src/factory-gate-opening-readiness.mjs`, open G1a, or grant
project creation authority.

## Factory G1a Owner Signing Handoff

G1a owner signing handoff packages the exact owner-facing signing work order
between the unsigned opening packet and the signed receipt intake:

```bash
npm run factory:g1a-owner-signing-handoff -- --check --require-pass
node scripts/review-api.mjs --once /api/factory/g1a-owner-signing-handoff
```

The default state is `ready_g1a_owner_signature_handoff`. The command writes a
signable unsigned receipt draft, owner completion checklist, work order, and
Law Firm OS-style Opus review packet. It does not sign the receipt, mutate
source, apply the G1a source-literal opening commit, perform first use, open
G1a, or grant project creation authority.

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
- `factory:candidate-lane-proof` proves 3 PS2 fixture candidate packets in a
  temporary ledger and cleans that ledger up afterward
- `factory:candidate-review-docket` binds those 3 candidate packets into review
  docket rows and keeps approval/apply closed
- `/api/factory/candidate-review-docket` exposes those review docket rows as a
  read-only Review API collection and blocks mutation methods
- `factory:candidate-freeze-handoff` freezes FC.1-FC.4 evidence and opens FD
  implementation handoff while keeping runtime apply/write authority closed
- `factory:receipt-verify` verifies candidate-bound owner attestation receipts
  and keeps apply/rollback runtime unreachable
- `factory:starter-artifacts` returns 19 materialized starter refs by default
- `/api/factory/starter-artifacts` exposes read-only starter artifact rows
- `factory:workbench` returns 9 stage-only workbench rows and 0 candidate
  previews by default
- `/api/factory/workbench` exposes one integrated read-only row per product
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
