# Output Destination Policy Enforcement

Phase 121 fixes the boundary between generated drafts and final destination actions.

The enforcement artifact reads the policy matrix, Output/Delivery contract freeze, protected delivery queue, draft delivery execution plan, and Tool/Runtime policy gates. It then produces three deterministic gate views:

- policy destination rules for each output artifact type
- artifact destination gates for each generated artifact
- delivery action destination gates plus final-action separation gates for protected delivery

Final actions such as email send, ERP billing issuance, GitHub merge, and protected delivery remain separate from draft generation. The gate may allow draft generation, but it marks final delivery as review-required or blocked until the required human approval, destination policy, tool policy, and receipt controls exist.

This keeps law-firm outputs draft-first by default. Attorney-facing, client-facing, billing, public, and repository-changing actions must pass `output_destination_gate` and the relevant human/tool gates before execution.
