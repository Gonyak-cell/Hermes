# Hue Keynote Harness Operating Loop

Source: `Hue_Keynote.pdf`, reviewed from the image-based 50 page deck on 2026-06-04.

This note does not treat the deck as a marketing story. It turns the keynote into Hermes operating requirements. The central point is simple: a good structure does not guarantee a good result unless the structure doubts completion claims, demands evidence, blocks unsafe PASS, and changes the next execution condition after failure.

## Core Question

The keynote asks whether good structure guarantees good results. Hermes should answer no. Structure is only useful when it makes results observable, reviewable, repeatable, recoverable, memorable, and scalable.

The platform therefore treats every completion message as a claim, not as truth. A claim becomes a PASS only when it is tied to evidence, reviewed by an owner, and accepted by a hard gate.

## Harness Invariants

| Invariant | Hermes meaning |
|---|---|
| Good structure does not guarantee good results | Every phase must produce evidence, not only a status sentence |
| Completion claim is not evidence | `current_verdict=pass` requires `evidence_ref`, `reviewer_ref`, and `hard_gate_ref` |
| Completion is a contract | DONE means claim plus evidence plus reviewer plus gate plus next action |
| Soft instruction is not a gate | `AGENTS.md`, `SKILL.md`, and docs guide behavior; deterministic scripts enforce behavior |
| Apology is not state change | After a failed loop, Hermes must change a condition, rule, scaffold, receipt, or gate |
| Memory is the next execution condition | Memory is not archive alone; it changes future task selection, validation, and review context |
| Failure must teach the system | FAIL leads to correction, rollback, rule extraction, or hard gate promotion |
| Harness reliability belongs around the model | Better models reduce variance, but external verification creates operational consistency |
| PASS criteria must have an owner | Scaling fails when nobody owns the definition of PASS |
| A demo proves a loop, not a feature | The important proof is doubt, evidence, gate, correction, and next-condition change |

## Claim Evidence Gate Contract

Hermes should model every significant result as:

```text
claim -> evidence -> reviewer -> hard_gate -> verdict -> next_allowed_action
```

Required evidence classes:

- build and typecheck evidence
- real interaction or smoke evidence
- database, file, or artifact consistency evidence
- screenshot or visual confirmation evidence when UI is involved
- cross-agent or cross-model review evidence for risky changes
- regression test evidence
- doctor and configuration evidence for runtime enablement
- receipt evidence for protected action approval

This is why the Kernel extraction work must keep `claim`, `evidence`, `gate`, `artifact`, `check`, and `receipt` as common platform primitives instead of domain-specific conventions.

## Hard Gate Promotion

Natural-language rules are soft. They can be forgotten, deprioritized, or skipped under tool pressure. Hermes should keep them, but must promote repeated or high-risk misses into deterministic gates.

Promotion rule:

```text
soft rule miss -> repeated miss or high risk -> hard gate candidate -> deterministic check -> exit 2 style BLOCK -> memory update
```

Hard gates should be machine-checkable, deterministic, and unskippable for the protected action they guard. Examples include QA cycle evidence before push, secret scan before release, no raw client material in public artifacts, no direct Zendd write without receipt, no legal/release final authority by Agent, and no command execution without the approved lane.

## Closed Loop

The operating loop from the deck maps directly to Hermes:

```text
execute -> completion claim -> evidence capture -> gate judgment
  -> PASS: acknowledge and preserve evidence
  -> FAIL: correct, rollback if needed, extract rule, change next execution condition
```

The critical distinction is that FAIL must not only ask the Agent to try again. It must alter the operating surface: a receipt requirement, a checklist item, a scaffold, a reviewer assignment, a hard gate, a memory entry, or a rollback target.

## Memory Bank Requirement

The deck's Memory Bank idea should become the storage and retrieval shape for Hermes after the Kernel cutover. The lifecycle is:

1. Archive raw run metadata and tool-call lineage without mixing domain boundaries.
2. Sync new events into an indexed store.
3. Search before planning or declaring readiness.
4. Extract facts, failures, decisions, rules, and evidence references.
5. Consolidate duplicates, conflicts, and evolution.
6. Relate facts by domain, project, workflow, owner, and gate.
7. Recall with citations into the next execution context.

Hermes memory must be retrieval-first and grounded. A recalled fact should carry source, timestamp, confidence, owner, and review status. Memory that does not affect the next action is only storage; it is not yet a Harness feature.

## Harness Maturity Levels

| Level | Operating meaning |
|---|---|
| `L0` | Manual prompt and manual review |
| `L1` | Reusable instructions and templates |
| `L2` | Skills, scripts, and partial automation |
| `L3` | Completion claims require evidence |
| `L4` | Memory prevents repeated failures |
| `L5` | Soft rules become hard, checkable gates |
| `L6` | Signal, patch, verify, acknowledge, or rollback forms a closed loop |
| `L7` | User, project, plugin, MCP, domain, and trend workflows become a Work OS |

Hermes should not call itself Harness-native merely because Agents or MCP tools exist. The minimum target is `L6` closed-loop operation, with `L7` as the long-range Work OS direction.

## Enterprise Scaling Constraint

The deck's organization-level warning is important: scaling a personal harness is not tool cloning. The hard part is PASS ownership.

Hermes must represent three things per domain pack:

- `DOMAIN`: the field-specific context and risk surface
- `GOAL`: the team or organization-specific definition of success
- `WORKFLOW`: the order, review lane, evidence, rollback, and gate sequence

The operator console and domain pack registry must answer:

```text
Whose PASS standard is this?
Who can review it?
What evidence is required?
What action is blocked until that evidence exists?
What changes after a FAIL?
```

The deck also points out the interaction cost of many rules and teams. Hermes should therefore treat rule growth as a governance problem, not only as automation coverage. Rule conflicts, duplicated checks, inconsistent PASS standards, and distributed rollback risk must be visible first-class rows.

## Product Updates Required

- P1201-P1500 Agent activation must stay focused on safe enablement conditions, not autonomy.
- P1501-P2040 Kernel must keep claim/evidence/gate/artifact/check/receipt as common primitives.
- P2041-P2120 must supersede the prior Nous adapter-only policy when Nous is not adopted and restore Hermes-native feature ownership as planning input.
- P2121-P2240 runtime governance must restore API/MCP/tool/job policy and hard hook scaffolding before execution opens.
- P2241-P2400 limited execution must begin with allowlists, redaction, timeout, rollback binding, and receipt closeout.
- P2401-P2560 controlled write and operator console must generate patches first, apply only through human receipt, and show PASS owner, missing evidence, blocked reason, next action, and maturity level.
- P2561-P2720 storage/event plane must implement Memory Bank lifecycle and grounded recall.
- P2721-P2880 connectors must ingest through quarantine and evidence references, not raw uncontrolled material.
- P2881-P3040 domain packs must ship domain, goal, workflow, PASS owner, and compatibility gates.
- P3041-P3200 production freeze must prove `L6` closed loop and declare which surfaces, if any, reach `L7` Work OS maturity.

## Final Rule

Hermes should never trust an LLM result just because the model, Agent, or tool says it is complete. The platform exists to require evidence, review, gates, rollback, and a changed next execution condition before the result can move forward.
