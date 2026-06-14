# Hermes Review Process

Hermes review work follows this order:

1. Work intake captures purpose, success criteria, non-goals, forbidden areas,
   risk tier, test bar, rollback needs, and stop conditions.
2. Codex submits a plan-only packet before file edits.
3. Claude reviews the plan as `proceed`, `revise`, or `block`.
4. Codex implements and submits an implementation packet.
5. Codex self-review may remove obvious noise but has no approval authority.
6. Claude performs the required review passes and emits normalized findings.
7. Codex fixes findings with minimal changes.
8. Claude verifies each finding resolution.
9. The human owner adjudicates protected closeout.

Authority boundaries:

- Codex cannot finally approve Codex-created implementation.
- Claude review cannot replace human adjudication.
- Human adjudication cannot replace independent GitHub approval.
- Single-owner mode is lower-trust merge readiness only.
- Enterprise trust requires actual independent GitHub approval, signed
  attestation, required checks, Claude review, and human adjudication.

Unresolved critical or high findings block closeout unless the human owner
explicitly adjudicates the risk with a receipt.
