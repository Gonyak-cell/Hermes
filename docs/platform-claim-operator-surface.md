# Platform Claim Operator Surface

`platform:claim-operator-surface` covers P511-P515 of the claim adjudication
track. It connects the frozen P500 claim registry to operator-facing dashboard
and Review API surfaces without changing claim verdicts.

## Scope

- Source registry: `operations_freeze_claim_registry_rows` from P500.
- API route: `/api/platform-claim-registry`.
- Dashboard source: `platform_operations_freeze`.
- Phase boundary: P511-P515 remains read-only and report-only.

## Guarantees

- All 140 frozen claims are queryable.
- The 40 documented BLOCK claims remain BLOCK.
- The 100 PASS claims remain PASS.
- Claims can be filtered by verdict, claim type, source phase, owner, human
  receipt requirement, protected-claim flag, and operator-surface flag.
- No receipt payload is received, validated, or bound.
- No approval is applied and no PASS promotion occurs.
- No server start, package command execution, protected action, trading write,
  Desktop mutation, credential lookup, or secret read occurs.

## Operator Filters

- `/api/platform-claim-registry?verdict=blocked`
- `/api/platform-claim-registry?verdict=pass`
- `/api/platform-claim-registry?human_receipt_required=true`
- `/api/platform-claim-registry?responsible_owner=approval_owner&verdict=blocked`
- `/api/platform-claim-registry?responsible_owner=recovery_owner&verdict=blocked`
- `/api/platform-claim-registry?protected_claim=true&verdict=blocked`

## Closeout Rule

P511-P515 only makes the frozen claim registry visible and filterable for
operators. Receipt-backed adjudication remains P516-P520. Until that later
layer validates external human receipts, every unsupported claim remains a
documented BLOCK row with owner, reason, and next action.
