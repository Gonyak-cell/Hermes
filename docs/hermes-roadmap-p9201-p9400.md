# Hermes Roadmap P9201-P9400 Work OS Goal Drilldown Surface

P9201-P9400은 P9200 Work OS goal execution view 다음 단계다. 목표는 P9200 artifact를 read-only API/UI drilldown surface로 연결해서 운영자가 project, goal, phase, evidence, validation, review, next action, commit checkpoint, session handoff 상태를 더 직접적으로 탐색할 수 있게 만드는 것이다.

이 단계는 routine read-only projection tranche이므로 Claude Code Opus 4.8 max review는 기본적으로 생략한다. 단, review, next action, commit checkpoint의 authority semantics가 read-only projection을 넘어 변경되면 closeout 시 review packet을 준비한다.

## Boundary

Codex = implementation engine

Claude Code Opus max = optional review evidence lane for this tranche

Harness = validation, evidence, API, UI, gate, and status control plane

API = artifact-backed GET/HEAD only

UI = read-only browser drilldown surface

Domain pack = project/workflow context only

## P9201-P9220: P9200 Source Binding

| Range | Name | Output |
|---|---|---|
| `P9201-P9220` | P9200 Source Binding | source binding rows |

Completion conditions:

P9200 source status is ready

P9200 ready for P9201 handoff is true

Source binding is read-only

Missing or blocked P9200 source blocks P9400

## P9221-P9240: Goal API Projection

| Range | Name | Output |
|---|---|---|
| `P9221-P9240` | Goal API Projection | `/api/work-os/goals` |

The goal route exposes project id, goal id, goal name, phase range, status, claim ref, evidence ref, gate ref, check ref, and review receipt ref.

It does not expose final approval controls.

## P9241-P9260: Next Action API Projection

| Range | Name | Output |
|---|---|---|
| `P9241-P9260` | Next Action API Projection | `/api/work-os/next-actions` |

The next action route exposes blocked reason, missing evidence, review pending, validation pending, and commit checkpoint guidance as read-only operator guidance.

It does not execute protected actions.

## P9261-P9280: Commit Checkpoint API Projection

| Range | Name | Output |
|---|---|---|
| `P9261-P9280` | Commit Checkpoint API Projection | `/api/work-os/commits` |

The commit route exposes checkpoint id, evidence ref, clean/dirty state ref, and closeout evidence links.

It does not stage, commit, push, merge, or apply patches.

## P9281-P9300: Session Handoff API Projection

| Range | Name | Output |
|---|---|---|
| `P9281-P9300` | Session Handoff API Projection | `/api/work-os/session-handoffs` |

The session route exposes engine id, session id, transcript ref, redacted summary ref, and citation ref.

Raw body and full transcript body remain hidden.

## P9301-P9320: Project Drilldown Model

| Range | Name | Output |
|---|---|---|
| `P9301-P9320` | Project Drilldown Model | `/api/work-os/project-drilldown` |

The project drilldown groups project, domain pack, goal count, validation state, review lane count, next action count, commit checkpoint count, and session handoff count.

Domain pack remains a project/workflow context, not the Hermes product identity.

## P9321-P9340: Goal Detail Model

| Range | Name | Output |
|---|---|---|
| `P9321-P9340` | Goal Detail Model | `/api/work-os/goal-detail` |

The goal detail route binds claim, evidence, gate, check, review receipt, validation state, and combined status refs.

Codex final approval and Claude final approval remain false.

## P9341-P9360: Combined Status Model

| Range | Name | Output |
|---|---|---|
| `P9341-P9360` | Combined Status Model | `/api/work-os/combined-status` |

The combined status route computes validation readiness, review boundary readiness, next action readiness, commit checkpoint readiness, session handoff readiness, and blocker count.

Combined status does not create production PASS or enterprise PASS.

## P9361-P9380: Browser Drilldown Smoke

| Range | Name | Output |
|---|---|---|
| `P9361-P9380` | Browser Drilldown Smoke | browser smoke rows |

Smoke checks:

HTML route returns 200

HTML shell is nonblank

HTML declares drilldown API bindings

HTML has no raw/full transcript body

HTML has no secret-bearing keys

HTML has no protected action controls

HTML has no git write controls

HTML fetch bindings use GET

## P9381-P9400: P9400 Freeze

| Range | Name | Output |
|---|---|---|
| `P9381-P9400` | P9400 Freeze | P9400 freeze packet |

P9400 completion:

P9200 source ready

P9201-P9400 phase rows pass

Read-only drilldown API route rows pass

Drilldown UI binding rows pass

Goal API projection rows pass

Next action API projection rows pass

Commit checkpoint API projection rows pass

Session handoff API projection rows pass

Project drilldown rows pass

Goal detail rows pass

Combined status rows pass

API smoke rows pass

Browser drilldown smoke rows pass

Negative fixtures pass

Ready for P9401 handoff is true

## P9400 Boundary

P9400 does not enable:

POST/PUT/PATCH/DELETE API

Raw/full transcript body display

Secret-bearing response keys

Domain pack as Hermes product identity

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

UI git stage/commit/push/merge/apply
