# Hermes Roadmap P8401-P8600

P8401-P8600은 P8400 Work OS UI v0와 governed development loop 다음 단계다. 목표는 Codex, Claude, Harness validator, UI handoff에서 생기는 live session source를 보존하고, UI와 API에는 redacted, cited, read-only projection만 넘기는 것이다. 이 단계도 Human gate는 제외하며, production PASS, enterprise PASS, protected closeout, runtime execution, write action은 열지 않는다.

핵심 원칙:

```text
raw transcript = store/object ref only
full transcript = store/object ref only
UI/API = redacted summary plus citation refs only
API = GET/read-only only
session restore = cited redacted bundle only
Codex/Claude = final approver 아님
Human gate = P8600 범위에서는 제외
```

## P8401-P8440: Live Session Source Store

| Range | Goal | Output |
|---|---|---|
| `P8401-P8440` | Live Session Source Store | Codex, Claude, Harness validator, UI handoff session source rows |

Completion criteria:

```text
session source rows contain engine_id
session source rows contain session_id
session source rows contain run_id
session source rows contain phase_id
session source rows contain transcript_ref
raw_transcript_ref exists but raw body is not UI visible
full_transcript_ref exists but full body is not UI visible
source store is append-only
overwrite and delete are blocked
write-back is disabled
protected action is disabled
```

## P8441-P8480: Redacted Conversation Materializer

| Range | Goal | Output |
|---|---|---|
| `P8441-P8480` | Redacted Conversation Materializer | decision, blocker, review_event, validation_event, phase_progress rows |

Completion criteria:

```text
goal, phase, blocker, decision, validation item, review item can be extracted
raw transcript is input ref only
raw transcript is not output visible
full transcript is not output visible
redacted summary output is visible
every materialized event has source citation
materializer cannot update plan directly
```

## P8481-P8520: Work OS Read-Only API Projection

| Range | Goal | Output |
|---|---|---|
| `P8481-P8520` | Work OS Read-Only API Projection | `/api/work-os/projects`, `/api/work-os/phases`, `/api/work-os/timeline`, `/api/work-os/reviews`, `/api/work-os/gates`, `/api/work-os/session-sources` |

Completion criteria:

```text
all API projection rows are GET-only
write_enabled is false
mutates_state is false
raw_body_returns is false
full_body_returns is false
redacted_summary_returns is true
source_citation_returns is true
protected action is disabled
```

## P8521-P8560: UI Handoff Adapter

| Range | Goal | Output |
|---|---|---|
| `P8521-P8560` | UI Handoff Adapter | project control dashboard, phase detail, conversation timeline, review console, evidence gate panel manifests and snapshots |

Completion criteria:

```text
manifest_ref exists for every UI surface
snapshot_ref exists for every UI surface
snapshot is bounded
handoff is read-only
raw material is not embedded
full transcript is not embedded
raw secret is not embedded
source citation is visible
stale context badge is visible
unresolved review badge is visible
protected action controls remain disabled
```

## P8561-P8600: P8600 Freeze

| Range | Goal | Output |
|---|---|---|
| `P8561-P8600` | P8600 Freeze | live session store, redacted materializer, read-only API, UI handoff, session restore bundle freeze |

Completion criteria:

```text
P8401-P8600 phase rows pass
live session source store is append-only and cited
redacted materializer emits cited summaries only
Work OS API projection is GET-only and non-mutating
UI handoff adapter uses bounded read-only snapshots
next-session restore bundle is cited and redacted
duplicate session event is blocked
raw transcript API response is blocked
write API method is blocked
uncited restore context is blocked
stale context pass is blocked
Codex final approval is blocked
Claude source mutation is blocked
Human gate remains excluded
production and enterprise PASS remain disabled
runtime execution and write action remain disabled
```

P8600 boundary:

```text
source Work OS UI v0 ready = required
live session source store ready = required
redacted materializer ready = required
read-only API projection ready = required
UI handoff adapter ready = required
session restore bundle ready = required
raw transcript API visible = false
external connector write enabled = false
ready_for_p8601_handoff = true only when all gates pass
```
