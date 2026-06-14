# Hermes Roadmap P9401-P9600 Multi-Project SaaS Control Plane

P9401-P9600은 P9400 Work OS goal drilldown surface 다음 단계다. 목표는 여러 SaaS repo/project를 Hermes의 범용 project/workflow control plane 안에 등록하고, current goal, risk, validation, review, blocker, next action, repo metadata 상태를 read-only 운영 표면으로 묶는 것이다.

이 단계는 여러 프로젝트를 함께 보는 control plane이지만 source mutation, git write, connector write, protected closeout, production PASS, enterprise PASS를 열지 않는다. Claude Code Opus max review는 domain/product boundary 또는 multi-project authority semantics가 확장될 때 closeout에서 선택적으로 요청한다. 이번 tranche의 기본 의도는 read-only aggregation과 boundary guard다.

## Boundary

Codex = implementation engine

Claude Code Opus max = optional review evidence lane for this tranche

Harness = validation, evidence, API, boundary, and status control plane

API = artifact-backed GET/HEAD only

Repo inventory = observed metadata only

Domain pack = project/workflow context only

## P9401-P9420: P9400 Drilldown Source Binding

| Range | Name | Output |
|---|---|---|
| `P9401-P9420` | P9400 Drilldown Source Binding | source binding rows |

Completion conditions:

P9400 source status is ready

P9400 ready for P9401 handoff is true

Source binding is read-only

Missing or blocked P9400 source blocks P9600

## P9421-P9440: SaaS Project Registry

| Range | Name | Output |
|---|---|---|
| `P9421-P9440` | SaaS Project Registry | `/api/saas/projects` |

The registry exposes project id, project name, domain pack, active goal, phase range, owner engine, reviewer engine, and project status.

It must keep Hermes product identity as a general project/workflow control plane.

## P9441-P9460: SaaS Repo Inventory

| Range | Name | Output |
|---|---|---|
| `P9441-P9460` | SaaS Repo Inventory | `/api/saas/repos` |

Repo inventory exposes repo metadata refs and current goal binding.

It does not stage, commit, push, merge, apply patches, or imply GitHub independent approval.

## P9461-P9480: Current Goal Risk Ledger

| Range | Name | Output |
|---|---|---|
| `P9461-P9480` | Current Goal Risk Ledger | `/api/saas/current-goals` |

The risk ledger exposes project current goal, phase, risk level, risk reason, validation requirement, and Claude review marker.

It does not create production PASS or enterprise PASS.

## P9481-P9500: Validation And Review Aggregation

| Range | Name | Output |
|---|---|---|
| `P9481-P9500` | Validation And Review Aggregation | `/api/saas/validation-review` |

The aggregation exposes validation readiness, review boundary readiness, and review receipt refs.

Codex final approval, Claude final approval, reviewer mutation, and human gate completion remain false.

## P9501-P9520: Blocker And Next Action Matrix

| Range | Name | Output |
|---|---|---|
| `P9501-P9520` | Blocker And Next Action Matrix | `/api/saas/blockers` |

The matrix exposes blocker count, next action count, commit checkpoint count, and session handoff count.

It does not execute next actions.

## P9521-P9540: Domain Boundary Guard

| Range | Name | Output |
|---|---|---|
| `P9521-P9540` | Domain Boundary Guard | domain boundary guard rows |

The guard verifies that law-firm, trading, creative-document, personal-dev, connectors/resource, and other packs remain project/workflow contexts.

Domain packs must not become the Hermes product identity.

## P9541-P9560: Multi-Project API Projection

| Range | Name | Output |
|---|---|---|
| `P9541-P9560` | Multi-Project API Projection | GET/HEAD-only API routes |

Routes:

- `/health`
- `/api/saas/projects`
- `/api/saas/repos`
- `/api/saas/current-goals`
- `/api/saas/validation-review`
- `/api/saas/blockers`
- `/api/saas/operator-summary`
- `/api/saas/boundary`

All write methods return blocked/read-only response.

## P9561-P9580: Operator Control Summary And Smoke

| Range | Name | Output |
|---|---|---|
| `P9561-P9580` | Operator Control Summary And Smoke | operator summary rows, API smoke, browser smoke |

The operator summary shows current project operating state without approving, executing, or mutating it.

Smoke verifies that API and browser surfaces expose read-only views only.

## P9581-P9600: P9600 Freeze

| Range | Name | Output |
|---|---|---|
| `P9581-P9600` | P9600 Freeze | freeze rows, gate rows, boundary |

Completion conditions:

P9400 source ready

Project registry ready

Repo inventory read-only

Current goal risk rows ready

Validation/review aggregation ready

Blocker matrix read-only

Domain boundary guard ready

API/browser smoke pass

Negative fixtures block unsafe claims

Claude review decision is explicit

## P9600 Completion Criteria

```text
P9400 source 없음 = P9600 없음
project registry 없음 = control plane 없음
repo inventory write enabled = BLOCK
domain pack promoted to product = BLOCK
cross-project data mixing = BLOCK
Codex final approval = BLOCK
Claude final approval = BLOCK
production/enterprise PASS = BLOCK
runtime/write/connector action = BLOCK
raw/full transcript body or secret key response = BLOCK
```

