# Approval Authority Ledger

Phase 122 adds a deterministic approval authority ledger. It resolves each output artifact, approval request, and delivery action to the human role that must approve it before a protected action can move forward.

The ledger does not approve work product. It records who is authorized to approve by `tenant_id`, `matter_id`, domain pack, output type, delivery policy, and the matter/team role model.

## Inputs

- `identity-model.json`
- `matter-profile-team-ledger.json`
- `gate-approval-contract-freeze.json`
- `output-delivery-contract-freeze.json`
- `output-destination-policy-enforcement.json`

## Outputs

- `approval-authority-ledger.json`
- `authority-policies.json`
- `artifact-authority-decisions.json`
- `approval-request-authority-decisions.json`
- `delivery-action-authority-decisions.json`
- `validation-report.json`
- `summary.md`

## Rules

- Law-firm outputs always require a human authority role.
- Runtime, model, connector, and script actors are blocked from being final approval authorities.
- Matter roles are preferred for matter-bound outputs.
- Tenant roles are fallback authority only when the tenant identity is known.
- Missing matter profile or tenant identity does not auto-approve anything; it leaves an `assignment_required` decision for human setup.

## Command

```bash
npm run contracts:approval-authority -- --check
```
