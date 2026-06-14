# Conversation Source Plane

Program: `P4001-P4300`

This program implements the first executable tranche of the P4001-P8000 Work OS roadmap. Its purpose is to make Codex and Claude Code conversations durable source material for Hermes without turning Hermes into a raw chat viewer, KPI dashboard, or autonomous approval system.

## Operating Contract

```text
raw transcript = source material
summary = claim
plan change = reviewed candidate
Codex/Claude done = evidence candidate
Harness UI status = source of truth
source -> claim -> citation -> review -> Harness truth
```

P4300 does not enable runtime execution, write action, protected action, receipt application, raw transcript body display, Agent final PASS, or Work OS production claims.

## Phase Scope

| Range | Name | Buildout |
|---|---|---|
| `P4001-P4040` | Engine Conversation Source Contract | Required source fields, status enums, first-surface rule, and source/claim/citation/review boundary |
| `P4041-P4080` | Local Transcript Archive | Transcript envelope rows, raw boundary refs, redacted projection refs, provenance-first display |
| `P4081-P4120` | Codex Conversation Adapter | Codex completion, tool lineage, validation summaries, and plan changes as evidence candidates |
| `P4121-P4160` | Claude Code Transcript Adapter | Claude review findings as independent review evidence only |
| `P4161-P4200` | Transcript Redaction and Classification | Secret/client/privileged leakage controls and redaction holds |
| `P4201-P4240` | Conversation-to-Artifact Extractor | Summary, done claim, blocker, decision, review finding, and plan-change candidates |
| `P4241-P4280` | Context Recovery Bundle | Citation-bearing next-session context bundle |
| `P4281-P4300` | Transcript UI v0 | Conversation Source Queue and read-only detail panel contract |

## Conversation Source Queue

The first surface is `Conversation Source Queue`.

Required columns:

```text
source_id
engine
thread_or_session
project_or_goal
source_status
redaction_status
claim_count
plan_candidate_count
reviewer
next_allowed_action
```

The detail panel must show:

- raw transcript boundary
- source citation refs
- redaction/classification result
- extracted claims
- linked artifacts
- context recovery readiness
- blocked claims
- next command

The raw transcript body is not visible by default.

## State Enums

```text
source: ARCHIVED, REDACTION_REQUIRED, REDACTED, CLASSIFIED, EXTRACTED, REVIEW_PENDING, REVIEWED, BLOCKED
claim: CANDIDATE, NEEDS_SOURCE, NEEDS_REVIEW, ACCEPTED, REJECTED, STALE
plan: PROPOSED, REVIEWED_CANDIDATE, ADOPTED, BLOCKED
context: DRAFT, CITATION_MISSING, READY_FOR_NEXT_SESSION, BLOCKED
```

## UI Components

```text
ConversationSourceRow
EngineBadge
RawSourceRef
TranscriptBoundaryBadge
RedactionStatePill
ClassificationLabel
ClaimCandidateRow
PlanChangeCandidateRow
SourceCitationPanel
ContextBundlePreview
AdapterLineageTimeline
NoSourceNoClaimNotice
```

## Copy Rules

Allowed:

- `Conversation archived as source material`
- `Summary is a claim, pending review`
- `Plan change candidate, not adopted`
- `No transcript source; context claim blocked`
- `No source citation; memory recall blocked`
- `Redaction hold: privileged/client/secret span`

Forbidden:

- `AI가 기억했습니다`
- `스마트하게 요약`
- `자동 인사이트`
- `완료됨 as truth without evidence`
- `AI confidence score`
- `context health score`

## Validation

```bash
npm run platform:conversation-source-plane -- --check
```

The generated artifacts live under:

```text
artifacts/conversation-source-plane/latest/
```

