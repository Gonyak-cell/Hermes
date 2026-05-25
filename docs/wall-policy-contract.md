# Wall Policy Contract

Phase 116 fixes ethical wall and conflict wall rules as a deterministic projection before retrieval.

Inputs:

- `artifacts/matter-contract-freeze/latest/matter-contract-freeze.json`
- `artifacts/client-counterparty-registry/latest/client-counterparty-registry.json`
- `artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json`

Command:

```bash
npm run contracts:walls -- --check
```

Outputs:

- `artifacts/wall-policy-contract/latest/wall-policy-contract.json`
- `artifacts/wall-policy-contract/latest/wall-policy-rules.json`
- `artifacts/wall-policy-contract/latest/retrieval-wall-filters.json`
- `artifacts/wall-policy-contract/latest/wall-subject-bindings.json`
- `artifacts/wall-policy-contract/latest/conflict-wall-bindings.json`
- `artifacts/wall-policy-contract/latest/validation-report.json`
- `artifacts/wall-policy-contract/latest/summary.md`

Contract objects:

- `wall_policy_rules`: matter boundary wall ids become explicit rules with `pre_retrieval` enforcement and `deny_unless_allowed` decision mode.
- `retrieval_wall_filters`: tenant, client, matter, wall, and classification filters that must be applied before any retrieval.
- `wall_subject_bindings`: per-subject allow/deny effects derived from Matter Profile/Team Ledger access subjects.
- `conflict_wall_bindings`: parties and conflict references bound to each wall before retrieval or conflict-aware search.

Acceptance:

- every source matter boundary wall id has a wall policy rule;
- every wall policy rule has a complete pre-retrieval filter;
- allowed retrieval is possible only for subjects allowed by active matter team membership;
- every wall rule binds all matter profile conflict references and source boundary parties;
- Dashboard, Review API, Contract Golden Fixtures, Contract Validation Suite, Goal Checkpoint, and Control Plane Loop all expose the wall policy contract as its own stage.

This stage does not perform legal analysis or decide representation conflicts. It only makes the technical wall and conflict-reference boundary explicit so later retrieval and policy evaluators can enforce it before context is built.
