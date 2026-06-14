# Hermes Roadmap P8601-P8800 Work OS Live Control Surface

P8601-P8800은 P8600 live session source store UI handoff 다음 단계다. 목표는 P8600 artifact를 실제 Work OS control surface가 읽을 수 있는 artifact-backed read-only API row, session ingestion row, UI runtime contract row로 투영하는 것이다. 이 단계도 실행 플랫폼이 아니라 local control surface freeze이며, Human gate, production PASS, enterprise PASS, protected closeout, runtime execution, write action은 열지 않는다.

핵심 원칙:

```text
P8600 artifact = source of truth candidate
API server row = GET/read-only artifact-backed projection
session ingestion = metadata and redacted summary only
timeline = redacted summary plus citation refs only
UI runtime = bounded read-only view model only
refresh = stale/missing/review state 표시 only
Codex/Claude = final approver 아님
Human gate = P8800 범위에서는 제외
```

## P8601-P8620: Artifact Source Binding

| Range | Goal | Output |
|---|---|---|
| `P8601-P8620` | Artifact Source Binding | source manifest, artifact path registry, freshness row |

Completion criteria:

```text
P8600 artifact path is registered
session source store collection is bound
redacted materializer collection is bound
read-only API projection collection is bound
UI handoff adapter collection is bound
validation report is bound
every source binding is artifact-backed
every source binding is read-only
every source binding has citation
stale source is visible and cannot PASS
```

## P8621-P8640: Read-Only API Server v0

| Range | Goal | Output |
|---|---|---|
| `P8621-P8640` | Read-Only API Server v0 | `/api/work-os/projects`, `/api/work-os/phases`, `/api/work-os/timeline`, `/api/work-os/reviews`, `/api/work-os/gates`, `/api/work-os/session-sources`, `/api/work-os/refresh` |

Completion criteria:

```text
all API route rows are GET
all API route rows are read-only
write_enabled is false
mutates_state is false
raw_body_returns is false
full_body_returns is false
redacted_summary_returns is true where applicable
source_citation_returns is true
stale_badge_returns is true
protected action is disabled
```

## P8641-P8660: Session Ingestion Adapter

| Range | Goal | Output |
|---|---|---|
| `P8641-P8660` | Session Ingestion Adapter | Codex, Claude, Harness validator, UI handoff ingestion rows |

Completion criteria:

```text
session rows preserve engine_id
session rows preserve session_id
session rows preserve run_id
session rows preserve phase_id
session rows preserve transcript_ref
ingestion mode is metadata_and_redacted_summary_only
raw body is not visible
full body is not visible
source store mutation is false
plan mutation is false
source citation is required
```

## P8661-P8680: Redacted Timeline Projection

| Range | Goal | Output |
|---|---|---|
| `P8661-P8680` | Redacted Timeline Projection | decision, blocker, review_event, validation_event, phase_progress timeline rows |

Completion criteria:

```text
timeline event rows exist
every row has event_type
every row has citation_ref
raw transcript body is hidden
full transcript body is hidden
redacted summary is visible
source is cited
stale context badge is visible
timeline projection cannot update plan directly
```

## P8681-P8700: Project Control Surface

| Range | Goal | Output |
|---|---|---|
| `P8681-P8700` | Project Control Surface | Hermes, Law Firm OS, HR Solution, Zendd Bridge, Trading Read-Only project rows |

Completion criteria:

```text
multiple SaaS/project control rows exist
each project has active_goal_ref
each project has current_phase_ref
each project has phase_summary_ref
each project has blocker_count_ref
each project has review_state_ref
each project has validation_state_ref
surface is read-only
protected action is disabled
```

## P8701-P8720: Phase Detail Surface

| Range | Goal | Output |
|---|---|---|
| `P8701-P8720` | Phase Detail Surface | phase claim, evidence, gate, check, review receipt rows |

Completion criteria:

```text
every P8601-P8800 phase has detail row
claim_ref exists
evidence_ref exists
gate_ref exists
check_ref exists
review_receipt_ref exists
raw material is hidden
PASS requires validator evidence
PASS requires review receipt or pending badge
```

## P8721-P8740: Review And Finding Surface

| Range | Goal | Output |
|---|---|---|
| `P8721-P8740` | Review And Finding Surface | Claude review status, finding loop, unresolved finding, receipt refs, authority boundary |

Completion criteria:

```text
Claude review receipt is required
finding loop is visible
unresolved findings are visible
review receipt refs are source-cited
reviewer mutation is false
final approval is false
protected closeout is false
```

## P8741-P8760: Live Progress Refresh

| Range | Goal | Output |
|---|---|---|
| `P8741-P8760` | Live Progress Refresh | freshness, stale context, missing validation, missing review, block count, ready state rows |

Completion criteria:

```text
source freshness row exists
stale context row exists
missing validation row exists
missing review row exists
block count row exists
ready state row exists
refresh is read-only
refresh_mutates_state is false
auto plan update is false
```

## P8761-P8780: UI Handoff Runtime Contract

| Range | Goal | Output |
|---|---|---|
| `P8761-P8780` | UI Handoff Runtime Contract | bounded read-only view models for project, phase, timeline, review, gate surfaces |

Completion criteria:

```text
each UI surface consumes a read-only API path
view_model_ref exists
manifest_ref exists
bounded snapshot ref exists
raw material is not embedded
full transcript is not embedded
raw secret is not embedded
source citation is visible
stale context badge is visible
missing validation badge is visible
unresolved review badge is visible
protected action controls are disabled
```

## P8781-P8800: P8800 Freeze

| Range | Goal | Output |
|---|---|---|
| `P8781-P8800` | P8800 Freeze | live control surface freeze packet |

Completion criteria:

```text
P8601-P8800 phase rows pass
artifact source bindings pass
API server rows are GET-only
session ingestion is metadata-only and redacted-only
timeline projection is cited and redacted
project/phase/review/refresh surfaces are ready
UI runtime contract is bounded and read-only
stale source PASS is blocked
missing artifact PASS is blocked
non-GET API method is blocked
raw transcript API response is blocked
session ingestion raw body is blocked
uncited timeline event is blocked
UI action enablement is blocked
refresh mutation is blocked
Codex final approval is blocked
Claude final approval is blocked
Human gate remains excluded
production and enterprise PASS remain disabled
runtime execution and write action remain disabled
```

P8800 boundary:

```text
source live session handoff ready = required
artifact source binding ready = required
read-only API server ready = required
session ingestion adapter ready = required
redacted timeline projection ready = required
project control surface ready = required
phase detail surface ready = required
review finding surface ready = required
live progress refresh ready = required
UI handoff runtime contract ready = required
raw transcript API visible = false
external connector write enabled = false
ready_for_p8801_handoff = true only when all gates pass
```
