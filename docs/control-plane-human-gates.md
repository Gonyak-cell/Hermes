# Control Plane Human Gates

`Control Plane Human Gates` turns the Action Plan into a single review briefing for evidence decisions, approvals, protected delivery, closeout receipts, and other manual blockers.

It never approves evidence, sends output, merges code, records a delivery receipt, or performs a protected action. Every gate item is marked `auto_execute_allowed: false`.

## Run

```bash
npm run control-plane:human-gates
```

Options:

```bash
npm run control-plane:human-gates -- \
  --action-plan artifacts/control-plane-action-plan/latest/control-plane-action-plan.json \
  --out-dir artifacts/control-plane-human-gates/latest
```

Outputs:

- `control-plane-human-gates.json`: machine-readable human gate briefing
- `human-gate-items.json`: flat gate item list
- `summary.md`: human-readable agenda

## Gate Types

- `evidence_decision`: approve/reject/reextract/assign matter
- `approval_request`: output artifact approval inbox items
- `attorney_review`: law-firm review gates
- `merge_review`: personal-dev merge approval
- `content_review`: creative-document approval
- `protected_delivery`: manual delivery or merge actions
- `closeout_receipt`: manual receipt recording and validation
- `matter_cockpit_blocker`: matter-level blocker surfaced by the cockpit

## Goal Role

This stage keeps the control plane honest after implementation checkpoint passes. When the harness cannot safely proceed without a person, it produces an agenda instead of pretending that a local command can resolve the blocker.
