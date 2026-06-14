# Hermes Global Operator Console Reference

This document is the sanitized design-evidence summary for the local reference pack at `hermes-operator-console-2026-06-06`.

The reference pack is not treated as a product screen or a P9000-only plan. It is a reference evidence pack for the Hermes Global Operator Console design system. Product implementation must convert it into deterministic UI contracts, tokens, components, surfaces, smoke checks, and authority boundaries before any screen can rely on it.

## Reference Evidence Role

| Source | Adopt As | Do Not Adopt As |
|---|---|---|
| `hermes-p9000-ui-plan.md` | Work OS queue/detail principles and read-only non-goals | P9000-locked product plan |
| `report.html` | Comparative UI research evidence | Runtime product shell |
| `report-preview.png` | Visual preview reference | Product asset |
| `references/*.png` | Market/comparable pattern screenshots | Embedded production UI assets |

## Preserved Patterns

| Pattern | Reference Family | Hermes Role |
|---|---|---|
| Operator Queue first screen | Linear, GitHub, Jira | `Global Operator Queue` |
| Left saved views, center records, right decision panel | Linear, Jira, Sentry | `SavedViewSidebar + OperatorQueueTable + ObjectInspectorPanel` |
| Durable work item record | Jira, GitHub Issues | `ObjectRow` and `Object Detail` |
| Linked work references | GitHub Issues/Projects/Actions | `SourceRef`, `EvidenceChain`, `CommitCheckpointRef` |
| Gate record with policy, rollback, timeout | Harness | `GateRecord` and `Review Gate Detail` |
| Typed chronology | Sentry, Datadog | `Evidence Timeline` |
| Catalog and rule progress | Port, Cortex | `Readiness Rule Matrix` |
| LLM/reviewer trace | LangSmith, Langfuse | `Review Evidence Trace` |

## Required Renames

| Original Phrase | Required Hermes Phrase | Reason |
|---|---|---|
| `P9000 UI Reference Plan` | `Hermes Global Operator Console Reference` | Avoid phase-locked UI identity |
| `Conversation Source Queue` as whole home | Conversation Source saved view | Queue is broader than conversations |
| `AI Review Surface` | `Review Evidence Trace` | AI/reviewer output is evidence, not authority |
| `Scorecard` | `Readiness Rule Matrix` | Avoid KPI/vanity score semantics |
| `Approval button` | Gate Record or Receipt Requirement | Avoid false protected action authority |

Exact implementation phrases required by the deterministic contract:

- Saved views, records, inspector panel
- ObjectRow and Object Detail
- SourceRef and EvidenceChain
- GateRecord and Review Gate Detail

## Global Trace Spine

```text
Source -> Claim -> Requirement -> Evidence -> Gate -> Review -> Verdict -> Next Action
```

Every core UI surface must either show this spine directly or link to the object detail where it is visible.

## Product UI Boundaries

- The home surface is `Global Operator Queue`, not a KPI dashboard, card report, hero page, or AI chat front door.
- Card/report layouts from the reference pack remain research artifacts.
- Phase/tranche IDs are metadata and should not dominate the top-level navigation.
- Domain packs are context, not Hermes product identity.
- Next actions are allowed, blocked, or receipt-required state rows, not unsafe execution controls.
- Review lanes show evidence and authority boundaries, not final approval.

## Forbidden UI Claims

- `AI approved`
- `Claude approved`
- `Codex approved`
- `Production ready`
- `Enterprise PASS`
- `Smart insight`
- `Auto resolved`
