# Personal Workspace Boundary

Phase 128 adds a deterministic boundary layer between the law-firm matter workspace and the personal development workspace.

The interface reads:

- `identity-model.json`
- `matter-profile-team-ledger.json`
- `store-policy-adapter.json`
- `conflict-check-interface.json`
- `personal-dev-slice.json`
- `domain-pack-registry.json`

It writes:

- `personal-workspace-boundary.json`
- `workspace-boundaries.json`
- `tenant-policy-boundaries.json`
- `search-namespace-policies.json`
- `cross-workspace-probes.json`
- `validation-report.json`
- `summary.md`

The default command is:

```bash
npm run contracts:personal-boundary
```

Use `--check` in CI or in the control-plane loop:

```bash
npm run contracts:personal-boundary -- --check
```

The contract is intentionally strict. Law-firm matter resources and personal project resources must have separate `tenant_id`, `policy_snapshot_id`, `domain_pack_id`, and `search_namespace_id` filters before retrieval/search. Cross-workspace probes are expected to be blocked, and protected actions remain human-reviewed.

This layer does not merge law-firm and personal context. It records enough structure for later retrieval and vector-index phases to compile separate indexes without changing core contracts.
