# Retrieval Filter Compiler

Phase 150 compiles retrieval filters before any search or vector query can run.

The compiler consumes:

- Search Index Contract
- Vector Index Policy Boundary
- Matter Access Policy
- Wall Policy Contract
- Store Policy Adapter

It produces one `compiled_retrieval_filter` per search query plan and one `retrieval_query_binding` per embedding route policy. The filters require `tenant_id`, `matter_id`, `classification`, `policy_snapshot_id`, `wall_ids`, and `access_audit_record_id` before query access, and also preserve wall, matter access, store policy, audit, and source references.

This phase still does not execute retrieval. Query bindings remain `query_execution_allowed: false` and `executable: false` because a concrete query adapter is not yet bound.

Required invariant:

1. Every search query plan has a compiled retrieval filter.
2. Every embedding route policy has a retrieval query binding.
3. Missing-filter, unscoped, and cross-matter probes are blocked for every filter.
4. P2-P5 bindings preserve external model approval or denial controls.
5. No query binding is executable in Phase 150.
