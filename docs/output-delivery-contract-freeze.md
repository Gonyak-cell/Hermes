# Output/Delivery Contract Freeze

Phase 106 freezes the contract boundary between generated outputs and protected delivery actions.

## Purpose

Output artifacts must not become implicit delivery receipts. A generated brief, deck, PR draft, or report remains a draft artifact until a separate delivery action and, later, a separate delivery receipt records what actually happened.

The freeze writes:

- `OutputArtifact v2`: generated artifact metadata, hash, matter boundary, approval links, delivery links.
- `DeliveryAction v2`: protected or ready delivery action, destination, channel, approval requirement, draft-only state.
- `DeliveryReceipt v2`: human or system receipt after manual delivery execution.
- `OutputDeliveryBinding v2`: explicit link between output, approval, delivery action, and receipt.
- `DeliveryStateTransition v2`: state movement from catalog to queue and from delivery receipt to final state.

## Default Command

```bash
npm run contracts:outputs -- --check
```

Default output:

```text
artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json
```

## Guardrails

- Every OutputArtifact v2 must keep `tenant_id`, `matter_id`, `workflow_run_id`, and `content_hash`.
- Pending output artifacts must link to a separate ApprovalRequest v2.
- Every output artifact must link to a separate DeliveryAction v2.
- Protected delivery actions must require human approval and remain draft-only unless a delivery receipt proves execution.
- Delivered receipts must carry execution fields: `executed_by`, `executed_at`, and `delivery_reference`.

## Dashboard/API

Dashboard source id:

```text
output_delivery_contract_freeze
```

Read-only API routes:

- `/api/output-delivery-contract-freezes`
- `/api/output-artifact-v2-contracts`
- `/api/delivery-action-v2-contracts`
- `/api/delivery-receipt-v2-contracts`
- `/api/output-delivery-bindings`
- `/api/delivery-state-transitions`
- `/api/output-delivery-contract-validations`
