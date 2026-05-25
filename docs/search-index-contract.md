# Search Index Contract

Phase 148 adds a deterministic search index manifest layer. It does not build or execute a search engine. It freezes the contract that every future keyword/vector/retrieval index must obey before any matter data can be queried.

## Purpose

- Define which resource, evidence, citation, exhibit, and custody collections are searchable.
- Require `tenant_id`, `matter_id`, `classification`, and `policy_snapshot_id` before index access.
- Keep query plans held until a later retrieval filter compiler creates bounded queries.
- Preserve source references on every future result so evidence lineage remains auditable.

## Command

```sh
npm run resource:search-index -- --check
```

The command writes:

- `artifacts/search-index/latest/search-index-contract.json`
- `artifacts/search-index/latest/search-index-manifest.json`
- `artifacts/search-index/latest/search-index-fields.json`
- `artifacts/search-index/latest/search-index-query-plans.json`
- `artifacts/search-index/latest/validation-report.json`
- `artifacts/search-index/latest/summary.md`

## Contract Rules

Each `search-index-manifest.v1` row represents a searchable collection, but remains `not_materialized`.

Each `search-index-query-plan.v1` row is non-executable and uses `query_status = held_for_retrieval_filter_compiler`.

Every query plan must declare:

- `tenant_filter_required = true`
- `matter_filter_required = true`
- `classification_filter_required = true`
- `policy_snapshot_filter_required = true`
- `pre_retrieval_gate_required = true`
- `matter_wall_enforced = true`
- `classification_enforced = true`
- `policy_snapshot_bound = true`

Any query missing `matter_id` or `classification` is rejected before index access.

## Human Review Boundary

Search results are evidence candidates only. They do not approve legal analysis, client advice, filing choices, delivery, or any client-facing work product.
