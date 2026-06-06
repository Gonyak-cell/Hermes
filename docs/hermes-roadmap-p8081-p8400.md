# Hermes Roadmap P8081-P8400

P8081-P8400은 P8000 closeout 이후 Work OS UI v0로 가기 위한 capture, plan progress, UI, governed development loop 구간이다. 이 범위에서도 Human gate는 제외하며, Codex와 Claude가 최종 승인자가 되는 것도 금지한다.

P8241-P8400은 P8240 plan progress handoff 이후 Project Control Dashboard, Phase Detail View, Conversation Timeline, Review Console, Codex primary lane, Claude review lane, Harness validation lane, P8400 freeze를 하나의 Work OS UI v0 and Harness-governed development loop로 묶는 실행 구간이다.

## P8081-P8160: Conversation Capture Contract

| Range | Goal | Output |
|---|---|---|
| `P8081-P8100` | Codex/Claude Conversation Storage Contract | conversation source schema, transcript ref, session id, engine id |
| `P8101-P8120` | Raw Full Redacted Separation | raw transcript hidden by default, redacted summary exposed to UI |
| `P8121-P8140` | Plan Extraction Contract | extract goal, phase, blocker, decision, validation item |
| `P8141-P8160` | Conversation Capture Validator | missing, duplicate, uncited memory, authority contamination negative fixtures |

Completion criteria:

```text
Codex conversation source rows exist
Claude conversation source rows exist
session id and engine id are stable
raw transcript body default UI exposure is false
redacted summary UI exposure is true
goal, phase, blocker, decision, validation item extraction rows exist
missing transcript is blocked
duplicate transcript is blocked
uncited memory is blocked
authority contamination is blocked
Human gate remains excluded
production and enterprise PASS remain disabled
```

## P8161-P8240: Plan Registry And Progress Engine

| Range | Goal | Output |
|---|---|---|
| `P8161-P8180` | Long-Term Plan Registration Model | plan id, phase id, milestone id, owner engine, status |
| `P8181-P8200` | Phase Progress Calculation | planned, in_progress, blocked, pass, review_pending |
| `P8201-P8220` | Validation Gate Review Linking | validator, evidence, Claude receipt refs per phase |
| `P8221-P8240` | Stale Context Drift Detection | stale plan, missing conversation, unrun validation status |

Completion criteria:

```text
plan registry rows cover P8081-P8240
every phase has owner engine and status
phase status enum includes planned, in_progress, blocked, pass, review_pending
every phase binds validator, evidence, gate, and Claude review refs
stale plan and missing conversation states are visible
validation not run is visible
context drift is visible
Human gate remains excluded
production and enterprise PASS remain disabled
```

## P8241-P8320: Work OS UI v0

| Range | Goal | UI |
|---|---|---|
| `P8241-P8260` | Project Control Dashboard | project selector, current goal, phase status |
| `P8261-P8280` | Phase Detail View | claim, evidence, gate, check, review receipt per phase |
| `P8281-P8300` | Conversation Timeline | Codex/Claude conversation, extracted decision, blocker, validation event |
| `P8301-P8320` | Review Console | Claude review status, finding loop, unresolved finding |

Completion criteria:

```text
project control dashboard rows exist
phase detail rows show claim, evidence, gate, check, review receipt
conversation timeline shows Codex, Claude, decision, blocker, validation event
raw and full transcript bodies remain hidden from UI
redacted conversation summaries are visible with citation refs
review console exposes Claude review status and unresolved findings
reviewer mutation remains disabled
protected action controls remain display-only
```

## P8321-P8400: Harness-Governed Development Loop

| Range | Goal | Output |
|---|---|---|
| `P8321-P8340` | Codex Primary Engine Lane | Codex work auto-attributed to plan and phase |
| `P8341-P8360` | Claude Review Lane | Claude review receipt required at milestones |
| `P8361-P8380` | Harness Validation Lane | validator results reflected into UI and plan status |
| `P8381-P8400` | P8400 Freeze | UI v0 plus capture, progress, review loop freeze |

Completion criteria:

```text
Codex work is attributed to plan_id and phase_id
Claude review receipt is required at milestones
Harness validator results update UI and plan status
P8400 freeze rows cover UI v0, capture, progress, and review loop
Codex cannot final approve Codex work
Claude cannot mutate source or final approve
Human gate remains excluded in P8400 scope
production and enterprise PASS remain disabled
runtime execution and write action remain disabled
```

Core roles:

```text
Codex = development engine
Claude = independent review engine
Harness = validation, status, evidence, control plane
Human gate = excluded in P8400 scope
final production PASS = disabled
enterprise PASS = disabled
```
