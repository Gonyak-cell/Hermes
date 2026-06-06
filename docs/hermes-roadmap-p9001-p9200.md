# Hermes Roadmap P9001-P9200 Work OS Project Runtime Handoff

P9001-P9200은 P9000 read-only Work OS API/UI smoke 다음 단계다. 목표는 P9000 artifact와 read-only API projection을 기반으로 여러 project/workflow의 현재 goal, phase, validation, review, session handoff, next action, commit checkpoint 상태를 한 화면에서 추적할 수 있는 goal execution view를 만드는 것이다.

이 단계는 Hermes를 범용 project/workflow control-plane harness로 유지한다. law-firm, Zendd, trading, creative-document, connectors/resource 같은 domain pack은 project/workflow context로 표시될 뿐 Hermes 전체 제품으로 승격되지 않는다. P9000은 과거 source milestone일 뿐이며, P9200 이후 phase range는 계속 증가할 수 있다.

## Boundary

Codex = implementation engine

Claude Code Opus max = independent review lane

Harness = validation, evidence, state, API, and UI control plane

Domain pack = project/workflow context only

Human gate = P9200 범위에서는 완료하지 않음

Execution view = read-only artifact surface

Commit checkpoint view = evidence surface only

## P9001-P9020: Runtime Handoff Source Map

| Range | Name | Output |
|---|---|---|
| `P9001-P9020` | Runtime Handoff Source Map | P9000 source binding and readiness map |

Completion conditions:

P9000 source status is ready

P9000 source path is recorded

Ready for P9001 handoff is true

Missing or blocked P9000 source blocks P9200

## P9021-P9040: Project Registry Projection

| Range | Name | Output |
|---|---|---|
| `P9021-P9040` | Project Registry Projection | project runtime handoff rows |

The view shows multiple project/workflow contexts, project id, project name, domain pack, active goal ref, phase ref, review state ref, and validation state ref.

Rules:

Domain pack is not the whole product

Hermes product identity remains general project/workflow control plane

Registry rows are read-only

Protected action is disabled

## P9041-P9060: Goal And Phase Execution Model

| Range | Name | Output |
|---|---|---|
| `P9041-P9060` | Goal And Phase Execution Model | goal phase execution rows |

The view binds project, active goal, phase range, current phase, owner engine, reviewer engine, harness validator, claim ref, evidence ref, gate ref, check ref, review receipt ref, blocker ref, and next allowed action.

Codex may implement and validate. Claude may review. Neither becomes final approver.

## P9061-P9080: Validation State Lens

| Range | Name | Output |
|---|---|---|
| `P9061-P9080` | Validation State Lens | validation lens rows |

The view shows source readiness, targeted validation state, adjacent Work OS regression state, source gate projection, and conditional full-test state.

The lens is display-only. It does not execute tests, mutate plans, or promote validator-only trust to production trust.

## P9081-P9100: Review Lane View

| Range | Name | Output |
|---|---|---|
| `P9081-P9100` | Review Lane View | Codex, Claude, Harness, and single-owner lane rows |

Review lane rows show:

Codex primary developer lane

Claude Code Opus max review lane

Harness deterministic validation lane

Single-owner lower-trust boundary

Final approval remains false for Codex and Claude.

## P9101-P9120: Session Handoff Refs

| Range | Name | Output |
|---|---|---|
| `P9101-P9120` | Session Handoff Refs | cited redacted session refs |

Session handoff rows show engine id, session id, phase id, transcript ref, redacted summary ref, timeline ref, and citation ref.

Raw body and full transcript body are not visible.

## P9121-P9140: Next Action Queue

| Range | Name | Output |
|---|---|---|
| `P9121-P9140` | Next Action Queue | next action queue rows |

The queue shows read-only operator guidance for project selection, goal phase focus, validation review, Claude review receipt prep, session handoff, and commit checkpoint.

The queue does not execute protected actions.

## P9141-P9160: Commit Checkpoint View

| Range | Name | Output |
|---|---|---|
| `P9141-P9160` | Commit Checkpoint View | commit checkpoint evidence rows |

The view shows dirty/clean checkpoint refs, completed goal commit expectation, and validation/review evidence links.

The UI does not stage, commit, push, merge, or apply patches.

## P9161-P9180: API UI Projection

| Range | Name | Output |
|---|---|---|
| `P9161-P9180` | API UI Projection | read-only goal execution UI artifact |

The view projects project registry, goal execution, validation state, review lanes, session handoff, next action, and commit checkpoint surfaces as a static read-only artifact.

No raw payload, secret material, protected action control, runtime execution, write action, or connector write is enabled.

## P9181-P9200: P9200 Freeze

| Range | Name | Output |
|---|---|---|
| `P9181-P9200` | P9200 Freeze | P9200 freeze packet |

P9200 completion:

P9000 source ready

P9001-P9200 phase rows pass

Project registry projection rows pass

Goal phase execution rows pass

Validation state lens rows pass

Review lane rows pass

Session handoff refs are redacted and cited

Next action queue is read-only

Commit checkpoint view has no git write controls

Negative fixtures pass

P9200 freeze rows pass

Ready for P9201 handoff is true

## P9200 Boundary

P9200 does not enable:

Domain pack as whole product

P9000 as fixed endpoint

Raw/full session body display

Human gate completion

Codex final approval

Claude final approval

Reviewer mutation

Single-owner enterprise-independent trust

Protected closeout

Production PASS

Enterprise PASS

Runtime execution

Write action

External connector write

Git stage/commit/push/merge from UI
