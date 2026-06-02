# Hermes Platform Claim Adjudication Phase Ledger (P501-P520)

P500 freezes claim judgment rules. P501-P520 handles adjudication: it receives
human receipts and evidence references, tests whether blocked claims can move
toward PASS, and keeps unsupported claims as documented BLOCK rows.

## P501-P520 Claim Adjudication and Human Receipt Realization

| Phase Range | Theme | Status | Purpose |
| --- | --- | --- | --- |
| P501-P505 | Human receipt intake contracts | active | Standardize the human receipt fields needed to bind `human_receipt_ref` to frozen claim rows. |
| P506-P510 | Blocked claim action feasibility | planned | Check whether each `next_allowed_action` is executable, still safe, and still owned. |
| P511-P515 | Operator claim registry surfaces | active | Connect claim registry filtering to operator dashboard/API rows without mutating claim verdicts. |
| P516-P520 | Receipt-backed verdict refresh | active | Promote only claims with validated receipts to PASS candidates while preserving documented BLOCK for the rest. |

## Phase Rows

- P501: `platform:claim-receipt-intake-contract` consumes the P500 claim-freeze registry in memory and declares one intake contract for every frozen BLOCK claim that requires a human receipt. It standardizes `receipt_id`, `source_phase_slot`, `claim_id`, `claim_type`, `receipt_actor`, `receipt_decision`, `receipt_evidence_refs`, `receipt_signed_at`, `receipt_status`, and future `human_receipt_ref` fields while no receipt payload is received, no validation begins, no approval is applied, no claim is promoted to PASS, no command is executed, no generated artifact is read, no artifact is written, no dependency/package/lockfile is mutated, no release is published, no git operation occurs, no protected recovery runs, no trading live/full-auto/order submission, no broker or exchange write, no Desktop mutation/source-of-truth promotion, no credential lookup, no secret value read, no `.env` read, no Desktop config inspection, no secret exposure, and no protected action occurs.
- P502: `platform:claim-receipt-workspace` consumes the P501 intake contract in memory and declares one external receipt workspace row for each frozen BLOCK claim while no external receipt payload is materialized, no receipt source is registered, no receipt is validated, no approval is applied, no claim is promoted to PASS, and documented BLOCK state remains preserved.
- P503: `platform:claim-receipt-workspace` declares the external receipt source registry for the P502 workspace rows, including allowed source types and required `receipt_source_ref`, while no external source payload is read, copied, or trusted without validation.
- P504: `platform:claim-receipt-workspace` declares the deterministic `human_receipt_ref` namespace, required components, template, and pattern for every frozen claim while no ref is bound, no receipt is validated, and no verdict is mutated.
- P505: `platform:claim-receipt-workspace` declares invalid receipt quarantine rows and reason codes for every frozen claim while invalid receipts cannot validate, cannot apply approval, cannot promote PASS, and cannot erase documented BLOCK.
- P506: `platform:claim-action-feasibility` consumes the P502-P505 claim receipt workspace in memory and classifies every documented BLOCK claim's `next_allowed_action` as external human receipt collection plus a future check-mode `platform:operations-freeze -- --check` rerun while no action or command is executed.
- P507: `platform:claim-action-feasibility` checks that every blocked-claim action is still owned by the frozen `responsible_owner` and reviewer while owner receipts remain absent, owner acknowledgement remains pending, and action execution stays fail-closed.
- P508: `platform:claim-action-feasibility` checks protected-action boundaries for every blocked claim so target commands stay prior evidence only, future reruns stay check-mode only, and trading, Desktop, secret, release, git, package, and protected recovery writes stay disabled.
- P509: `platform:claim-action-feasibility` indexes every blocked claim's evidence gap, preserving command-result evidence and human-receipt gates while marking missing `receipt_source_ref`, `human_receipt_ref`, and validated receipt payload as open gaps.
- P510: `platform:claim-action-feasibility` closes the action feasibility slice as documented BLOCK for every claim until valid receipt, owner receipt, and evidence gaps are resolved; no claim is promoted to PASS.
- P511: `platform:claim-operator-surface` consumes the P500 claim registry and P506-P510 action feasibility in memory and declares direct operator filters for all claims, documented BLOCK claims, PASS claims, human-receipt-required claims, owner queues, protected blocked claims, and operator-surface claims through `/api/platform-claim-registry`.
- P512: `platform:claim-operator-surface` verifies Review Dashboard source/stage wiring for `platform_operations_freeze`, including BLOCK/PASS/human-receipt metrics and the claim registry route link, while no dashboard mutation or claim verdict mutation occurs.
- P513: `platform:claim-operator-surface` verifies read-only Review API routes for claim registry rows, claim gates, claim boundary, and claim validations, including supported claim filters, while no server is started and no mutating method is enabled.
- P514: `platform:claim-operator-surface` projects adjudication audit checks from the frozen registry, proving unsupported complete PASS claims, PASS-without-gate/reviewer rows, protected PASS without receipt, and BLOCK without next action remain absent.
- P515: `platform:claim-operator-surface` closes the operator surface with all 40 documented BLOCK claims retained; no receipt is validated, no approval is applied, and no claim is promoted to PASS.
- P516: `platform:claim-receipt-verdict-refresh` consumes the frozen P500 claim registry and P511-P515 operator surface in memory, validates optional external claim receipt input, and keeps rows without receipt payloads waiting for external receipts while no human receipt is auto-created.
- P517: `platform:claim-receipt-verdict-refresh` validates receipt-to-claim binding through `claim_id`, `source_phase_slot`, and deterministic `human-receipt` refs while invalid or missing receipts fail closed.
- P518: `platform:claim-receipt-verdict-refresh` marks PASS candidates only when a validated receipt is bound to the frozen claim and explicitly approves a PASS candidate; no frozen claim registry row is mutated.
- P519: `platform:claim-receipt-verdict-refresh` retains documented BLOCK for every claim without a validated receipt, preserving owner, block reason, and `next_allowed_action`.
- P520: `platform:claim-receipt-verdict-refresh` closes the adjudication slice by balancing PASS candidates plus retained documented BLOCK rows back to the 40 frozen BLOCK claims while no command is executed, no artifact is written in `--check`, no dependency/package/lockfile is mutated, no release is published, no git operation occurs, no protected recovery runs, no trading live/full-auto/order submission, no broker or exchange write, no Desktop mutation/source-of-truth promotion, no credential lookup, no secret value read, no `.env` read, no Desktop config inspection, no secret exposure, and no protected action occurs.

## Acceptance Criteria

- P500 remains the frozen claim baseline.
- P501-P520 does not erase documented BLOCK rows.
- Human receipts are explicit external inputs, never auto-created by the harness.
- Claims without validated receipts remain documented BLOCK with owner and next action.
- Trading, Desktop, secret, release, git, package, and protected-recovery boundaries remain disabled unless a later human-approved phase explicitly changes the policy.
