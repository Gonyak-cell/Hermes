# Policy Golden Fixtures

Phase 129 adds a deterministic policy regression fixture set. It does not create new policy rules; it locks representative outcomes from the existing Matter Access, Model Policy, Tool/Runtime Policy, Output Destination, Store Policy, and Personal Workspace Boundary artifacts.

The fixture set is meant to answer one operational question before policy work expands further: do we have stable allow, review, and deny/block examples that can be tested repeatedly without trusting agent self-report?

## Command

```bash
npm run contracts:policy-golden -- --check
```

Default output:

- `artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json`
- `artifacts/policy-golden-fixtures/latest/policy-fixture-cases.json`
- `artifacts/policy-golden-fixtures/latest/policy-outcome-matrix.json`
- `artifacts/policy-golden-fixtures/latest/policy-regression-manifest.json`
- `artifacts/policy-golden-fixtures/latest/validation-report.json`
- `artifacts/policy-golden-fixtures/latest/summary.md`

## Locked Case Groups

- `matter_access`: allow/review/deny from matter access decisions.
- `model_policy`: allow/review/deny from classification model gates.
- `tool_runtime`: allow/review/deny from tool permission gates.
- `output_destination`: allow/review from final-action separation gates.
- `store_policy`: executable/held/blocked query plans mapped to allow/review/deny.
- `workspace_boundary`: blocked cross-workspace probe mapped to deny.

## Completion Rule

The artifact is complete only when:

- At least one locked allow, review, and deny case exists.
- Core policy groups include all three outcomes.
- Review cases are held behind a human/approval/confirmation gate or equivalent status.
- Deny cases block execution, retrieval, or cross-workspace access.
- Every representative case has a regression hash.

This makes later policy dashboard, API, and matter-boundary slices harder to accidentally weaken.
