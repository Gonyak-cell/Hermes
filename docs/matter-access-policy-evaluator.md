# Matter Access Policy Evaluator

Phase 117 adds the Matter Access Policy Evaluator. It turns the matter team ledger, wall policy contract, runtime adapter contract, and resource contract into explicit access decisions before retrieval.

The evaluator is intentionally deterministic. It does not ask a model whether a user or runtime may read matter data. It projects the policy inputs into `allow`, `review`, or `deny` rows that can be audited by matter, user, runtime, and resource.

## Inputs

- `artifacts/resource-contract-freeze/latest/resource-contract-freeze.json`
- `artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json`
- `artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json`
- `artifacts/wall-policy-contract/latest/wall-policy-contract.json`

## Outputs

- `artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json`
- `artifacts/matter-access-policy/latest/matter-access-policy.json`
- `artifacts/matter-access-policy/latest/access-policy-rules.json`
- `artifacts/matter-access-policy/latest/matter-access-decisions.json`
- `artifacts/matter-access-policy/latest/resource-access-decisions.json`
- `artifacts/matter-access-policy/latest/runtime-access-matrix.json`
- `artifacts/matter-access-policy/latest/validation-report.json`
- `artifacts/matter-access-policy/latest/summary.md`

## Decision Model

Matter-level decisions combine an access subject, a runtime adapter, and a wall policy rule. A team member bound to the wall may receive raw access only when the runtime contract allows the matter classification. If the runtime only allows redacted context, the decision is `review` and a human/redaction gate is required. If the runtime cannot handle the classification, the decision is `deny`.

Resource-level decisions add the resource boundary. A resource may not be allowed unless its `matter_id` and `tenant_id` match the target matter boundary. Unassigned resources are always `review` and require matter tagging before retrieval.

## Command

```bash
npm run contracts:matter-access -- --check
```

The command exits non-zero when any source contract is incomplete, decision ids are duplicated, runtime/resource coverage is missing, unassigned resources are allowed, or review decisions do not require human review.
