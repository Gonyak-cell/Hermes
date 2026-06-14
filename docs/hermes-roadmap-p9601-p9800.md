# Hermes Roadmap P9601-P9800 Requirement Traceability Kernel

P9601-P9800은 P9600 Multi-Project SaaS Control Plane 다음 단계다. 목표는 여러 SaaS/project의 requirement, PRD, spec, issue, test, evidence, claim, gate, check, release note, closeout state를 하나의 read-only trace graph로 연결하는 것이다.

이 단계부터는 단순 운영 가시성이 아니라 evidence trust에 직접 영향을 준다. 따라서 Claude Code Opus 4.8 max 또는 최신 Opus equivalent의 read-only closeout review가 required evidence다. Claude review는 최종 승인, mutation 권한, production PASS, enterprise PASS가 아니며, blocking finding이 있으면 P9800 closeout은 BLOCK이다.

## Boundary

Codex = implementation engine

Claude Code Opus max = required read-only review evidence lane for this tranche

Harness = deterministic trace graph, validation, evidence, API, boundary, and status control plane

Trace API = artifact-backed GET/HEAD only

Requirement trace = read-only graph, not release approval

## P9601-P9620: P9600 Source Binding

| Range | Name | Output |
|---|---|---|
| `P9601-P9620` | P9600 Source Binding | source binding rows |

P9600 source must be ready and read-only. Missing or blocked P9600 source blocks P9800.

## P9621-P9640: Requirement Source Registry

| Range | Name | Output |
|---|---|---|
| `P9621-P9640` | Requirement Source Registry | `/api/trace/requirements` |

Every trace row gets a stable requirement id, project id, source ref, acceptance kind, and requirement status.

No requirement row may be anonymous.

This tranche intentionally starts with goal and boundary acceptance rows per project. Broader compliance, security, observability, and domain-specific requirement classes should be added by a later tranche instead of widening P9800 after freeze.

## P9641-P9660: PRD Spec Issue Link Model

| Range | Name | Output |
|---|---|---|
| `P9641-P9660` | PRD Spec Issue Link Model | `/api/trace/spec-links` |

Each requirement links to PRD, spec, and issue refs.

Cross-project data mixing remains false.

`link_present = true` means the trace projection has a deterministic wiring ref. It is not yet an external existence verification of the underlying PRD, spec, issue, validator, evidence, release note, or closeout artifact.

## P9661-P9680: Test Evidence Coverage Map

| Range | Name | Output |
|---|---|---|
| `P9661-P9680` | Test Evidence Coverage Map | `/api/trace/test-evidence` |

Each requirement links to test, validator, and evidence refs.

Missing test or evidence coverage blocks P9800.

## P9681-P9700: Claim Gate Check Trace Graph

| Range | Name | Output |
|---|---|---|
| `P9681-P9700` | Claim Gate Check Trace Graph | `/api/trace/claim-gate-check` |

Each requirement links to claim, gate, check, and artifact refs.

Auto PASS remains false.

## P9701-P9720: Release Note Closeout Linkage

| Range | Name | Output |
|---|---|---|
| `P9701-P9720` | Release Note Closeout Linkage | `/api/trace/release-closeout` |

Each requirement links to release note and closeout refs.

The linkage does not create release approval, production PASS, or enterprise PASS.

## P9721-P9740: Coverage Gap Blocker Detector

| Range | Name | Output |
|---|---|---|
| `P9721-P9740` | Coverage Gap Blocker Detector | `/api/trace/coverage-gaps` |

Missing PRD/spec/issue, test/evidence, claim/gate/check, or release/closeout links create blockers.

Coverage gaps block P9800 closeout.

## P9741-P9760: Trace API Projection

| Range | Name | Output |
|---|---|---|
| `P9741-P9760` | Trace API Projection | GET/HEAD-only API routes |

Routes:

- `/health`
- `/api/trace/requirements`
- `/api/trace/spec-links`
- `/api/trace/test-evidence`
- `/api/trace/claim-gate-check`
- `/api/trace/release-closeout`
- `/api/trace/coverage-gaps`
- `/api/trace/review-packet`
- `/api/trace/boundary`

All write methods return read-only rejection.

## P9761-P9780: Claude Review Packet And Required Review Boundary

| Range | Name | Output |
|---|---|---|
| `P9761-P9780` | Claude Review Packet And Required Review Boundary | review packet, review receipt gate |

The review packet is generated from current traceability state.

Completion requires a real Claude review receipt with:

```text
review_status = completed
blocking_finding_count = 0
reviewer_mutation_allowed = false
claude_final_approval_allowed = false
```

No placeholder review counts.

## P9781-P9800: P9800 Freeze

| Range | Name | Output |
|---|---|---|
| `P9781-P9800` | P9800 Freeze | freeze rows, gate rows, boundary |

Completion conditions:

P9600 source ready

Requirement ids stable

PRD/spec/issue links present

Test/evidence links present

Claim/gate/check links present

Release/closeout links present

Coverage gaps clear

Claude review receipt completed

API/browser smoke pass

Negative fixtures block unsafe claims

## P9800 Completion Criteria

```text
P9600 source 없음 = P9800 없음
requirement id 없음 = BLOCK
spec/issue link 없음 = BLOCK
test/evidence link 없음 = BLOCK
claim/gate/check link 없음 = BLOCK
coverage gap 있음 = BLOCK
Claude review receipt 없음 = BLOCK
Claude blocking finding 있음 = BLOCK
Codex/Claude final approval = BLOCK
production/enterprise PASS = BLOCK
runtime/write/connector action = BLOCK
raw/full transcript body or secret key response = BLOCK
```
