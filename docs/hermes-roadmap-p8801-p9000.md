# Hermes Roadmap P8801-P9000 Read-Only Work OS API Server

P8801-P9000은 P8800 Work OS live control surface 다음 단계다. 목표는 P8800 artifact를 실제 local read-only API와 browser UI shell이 소비할 수 있게 만들고, 그 동작을 smoke evidence로 고정하는 것이다. 이 단계는 운영자가 화면으로 계획, phase, timeline, review, gate 상태를 볼 수 있게 만드는 첫 live control surface이지만, production PASS, enterprise PASS, runtime execution, write action, connector write, protected closeout, Codex final approval, Claude final approval은 열지 않는다.

## Boundary

Codex = implementation engine

Claude = independent review lane

Harness = validation, evidence, state, API, and UI control plane

Human gate = P9000 범위에서는 제외

API = artifact-backed GET/HEAD only

UI = read-only browser surface

Refresh = read-only recomputation or refetch only

## P8801-P8820: API Source Contract Freeze

| Range | Name | Output |
|---|---|---|
| `P8801-P8820` | API Source Contract Freeze | P8800 source artifact binding |

Completion conditions:

P8800 source status is ready

P8800 source path is recorded

API source is artifact-backed

No DB, connector, MCP, or remote service is required

Missing source blocks P9000

## P8821-P8840: Read-Only API Server v0

| Range | Name | Output |
|---|---|---|
| `P8821-P8840` | Read-Only API Server v0 | local node:http server |

Routes:

`/health`

`/api/work-os`

`/api/work-os/summary`

`/api/work-os/projects`

`/api/work-os/phases`

`/api/work-os/timeline`

`/api/work-os/reviews`

`/api/work-os/gates`

`/api/work-os/session-sources`

`/api/work-os/boundary`

`/api/work-os/refresh`

Rules:

GET and HEAD only

POST, PUT, PATCH, DELETE return 405

API response is sanitized view model

Raw payload keys are not returned

Secret-bearing keys are not returned

Refresh does not mutate state

## P8841-P8860: API Projection Validator

| Range | Name | Output |
|---|---|---|
| `P8841-P8860` | API Projection Validator | route smoke rows |

Validation:

Every required route returns 200

Every response is nonblank

Every mutating method is rejected

Route output has no raw payload keys

Route output has no secret keys

Refresh mutation remains false

## P8861-P8880: UI Data Binding Adapter

| Range | Name | Output |
|---|---|---|
| `P8861-P8880` | UI Data Binding Adapter | `index.html` Work OS shell |

UI binding rows:

Work OS shell consumes `/api/work-os/summary`

Project control consumes `/api/work-os/projects`

Phase detail consumes `/api/work-os/phases`

Timeline consumes `/api/work-os/timeline`

Review console consumes `/api/work-os/reviews`

Gate console consumes `/api/work-os/gates`

Refresh status consumes `/api/work-os/refresh`

## P8881-P8900: Project Control View

| Range | Name | Output |
|---|---|---|
| `P8881-P8900` | Project Control View | project status surface |

The UI shows project id, current goal, current phase, and verdict state as a read-only surface.

## P8901-P8920: Phase Detail View

| Range | Name | Output |
|---|---|---|
| `P8901-P8920` | Phase Detail View | claim/evidence/gate/check/review surface |

The UI shows phase claim, evidence ref, gate ref, check ref, review ref, and verdict state.

## P8921-P8940: Timeline And Review View

| Range | Name | Output |
|---|---|---|
| `P8921-P8940` | Timeline And Review View | redacted timeline and finding surface |

The UI shows redacted event types, citation refs, review receipt refs, and unresolved review state. It does not show raw or full transcript payloads.

## P8941-P8960: Live Refresh Smoke

| Range | Name | Output |
|---|---|---|
| `P8941-P8960` | Live Refresh Smoke | refresh route smoke evidence |

Refresh means read-only refetch or recomputation. It does not write artifacts, mutate plan state, mutate source state, execute runtime commands, or apply receipts.

## P8961-P8980: Browser Smoke Evidence

| Range | Name | Output |
|---|---|---|
| `P8961-P8980` | Browser Smoke Evidence | HTML nonblank and binding smoke rows |

Smoke checks:

HTML route returns 200

HTML shell is nonblank

HTML declares all API bindings

HTML does not embed raw payload keys

HTML does not embed secret keys

HTML has no protected action controls

Refresh binding uses GET

## P8981-P9000: P9000 Freeze

| Range | Name | Output |
|---|---|---|
| `P8981-P9000` | P9000 Freeze | P9000 freeze packet |

P9000 completion:

P8800 source ready

P8801-P9000 phase rows pass

Read-only API route projection rows pass

UI binding rows pass

API smoke rows pass

Browser smoke rows pass

Negative fixtures pass

P9000 freeze rows pass

Ready for P9001 handoff is true

## P9000 Boundary

P9000 does not enable:

POST/PUT/PATCH/DELETE API

Raw/full transcript payload response

Secret-bearing response keys

Plan mutation by refresh

Protected UI action controls

Human gate

Codex final approval

Claude final approval

Production PASS

Enterprise PASS

Runtime execution

Write action

Connector write
