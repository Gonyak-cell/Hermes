# Conversation Improvement Signal

Program: `P4301-P4600`

This program consumes the P4001-P4300 Conversation Source Plane and turns prior conversation into reviewed improvement candidates. It does not silently rewrite policy, adopt plan changes, enforce hooks, or inject next-session context.

## Operating Contract

```text
conversation improvement signal exists
user correction has source_turn_ref
assistant miss has root_cause
plan amendment candidate has reviewer_ref
soft rule promotion has hook_candidate_ref
next execution condition changes only after review
```

## Source Boundary

The source program is `P4001-P4300`. This program requires:

```text
source plane status = ready_for_conversation_source_plane_v0
raw transcript = source material
summary = claim
plan change = reviewed candidate
```

## Signal Types

```text
USER_CORRECTION
ASSISTANT_MISS
REVIEW_CONFLICT
BLOCKED_COMMAND
FAILED_VALIDATION
REPEATED_CONTEXT_LOSS
```

## Root Causes

```text
PLAN_SURFACE_UNDER_SPECIFIED
COMPLETION_OVERCLAIM
AUTHORITY_BOUNDARY_CONFUSION
SOURCE_CITATION_MISSING
VALIDATION_CONTRACT_DRIFT
SESSION_CONTEXT_EPHEMERAL
```

## Phase Scope

| Range | Name | Buildout |
|---|---|---|
| `P4301-P4340` | Improvement Signal Schema | Required fields, signal types, root causes, source turn refs, affected gate, owner, reviewer, proposed change, next condition |
| `P4341-P4380` | User Correction Classifier | User correction, pushback, planning mismatch, and trust objection rows |
| `P4381-P4420` | Assistant Miss Classifier | Overclaim, missing evidence, failed validation, stale memory, and context-loss rows |
| `P4421-P4460` | Plan Amendment Candidate Lane | Phase edits, gate edits, reviewer changes, UI requirements, and test candidates |
| `P4461-P4500` | Soft Rule Promotion Queue | Hook candidates with deterministic check descriptions and future exit-2 behavior |
| `P4501-P4540` | Self-Improvement Review Packet | Signal, source, proposed rule, expected effect, rollback, reviewer, and Claude Code Opus max review receipt requirement |
| `P4541-P4580` | Next-Session Context Injection | Review-pending next-condition candidates |
| `P4581-P4600` | Improvement Signal Freeze | PASS/BLOCK rows and unsafe-boundary freeze |

## Safety Boundary

P4600 keeps these false:

```text
unreviewed_self_modification_allowed
self_modification_applied_now
policy_rewrite_applied_now
plan_adoption_applied_now
hard_hook_enforced_now
next_condition_injected_now
runtime_execution_enabled
write_action_enabled
protected_action_enabled
human_adjudication_required
work_os_claim_enabled
```

The current P8000 operating mode removes human adjudication from milestone gates. That does not convert Claude review into final protected approval; it keeps protected closeout and enterprise-trust claims disabled while requiring Claude Code Opus max review receipts for review-dependent progress.

## Validation

```bash
npm run platform:conversation-improvement-signal -- --check
```

Outputs are written under:

```text
artifacts/conversation-improvement-signal/latest/
```
