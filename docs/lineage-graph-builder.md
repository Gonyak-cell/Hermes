# Lineage Graph Builder

Phase 143 adds the Lineage Graph Builder as the first explicit source-to-output reconstruction layer in the resource/evidence plane.

## Purpose

The builder turns the already reviewed resource/evidence chain into a reproducible graph:

`source span -> evidence item -> fact claim -> issue -> output paragraph`

It also keeps the direct `source span -> output paragraph` citation edge so that a reviewer can inspect both the full reasoning path and the rendered citation binding.

## Inputs

- `source-span-store.json`
- `evidence-item-store.json`
- `fact-claim-store.json`
- `issue-graph-store.json`
- `citation-object-store.json`

Every path preserves `tenant_id`, `matter_id`, `classification`, and `policy_snapshot_id`. Missing references, broken citation bindings, or client-facing readiness before approval fail the builder gate.

## Outputs

- `artifacts/lineage-graph/latest/lineage-graph.json`
- `artifacts/lineage-graph/latest/lineage-nodes.json`
- `artifacts/lineage-graph/latest/lineage-edges.json`
- `artifacts/lineage-graph/latest/lineage-paths.json`
- `artifacts/lineage-graph/latest/lineage-indexes.json`
- `artifacts/lineage-graph/latest/validation-report.json`
- `artifacts/lineage-graph/latest/summary.md`

## Gate Criteria

- one lineage path per citation object
- five canonical edges per complete path
- all nodes and edges resolved
- all paths complete and citation-bound
- matter, classification, and policy snapshot preserved across the path
- output remains `not_client_facing`
- every path remains `needs_review`

## Command

```sh
npm run resource:lineage-graph -- --check
```

The phase is also wired into the dashboard, API routes, contract golden fixtures, contract validation suite, control-plane checkpoint, and control-plane loop.
