# Control Plane Goal Checkpoint

`Control Plane Goal Checkpoint`은 `/goal`의 완성 기준을 현재 artifact와 대조해 어떤 축이 통과했고 어떤 축이 아직 막혀 있는지 기록한다. 다음 heartbeat는 이 checkpoint를 기준으로 다음 작업을 고를 수 있다.

Checkpoint는 구현 완료 여부와 운영상 사람 승인 대기를 분리한다. Evidence review, attorney approval, merge approval, protected delivery처럼 의도적으로 사람 gate에서 멈추는 단계는 artifact와 gate가 정상 생성되면 `passed_with_operational_gate`로 인정하고, 실제 승인·발송·merge는 계속 별도 blocker로 남긴다.

## 실행

```bash
npm run control-plane:goal-checkpoint
```

옵션:

```bash
npm run control-plane:goal-checkpoint -- \
  --dashboard artifacts/dashboard/latest/review-dashboard.json \
  --loop artifacts/control-plane-loop/latest/control-plane-loop.json \
  --health artifacts/control-plane-health/latest/control-plane-health.json \
  --roadmap docs/implementation-roadmap.md \
  --out-dir artifacts/control-plane-goal-checkpoint/latest
```

출력:

- `control-plane-goal-checkpoint.json`: `/goal` coverage checkpoint 계약
- `checkpoint-items.json`: checkpoint item 목록
- `summary.md`: 사람이 읽는 요약

## 체크 항목

- Core contracts
- Identity/Policy matrix
- Policy snapshot ledger
- Context builder and retrieval filters
- Model routing and external transfer decisions
- Cost budget gate ledger
- Token usage ledger
- Cost attribution ledger
- Budget alert ledger
- Plugin-style domain packs
- Resource Expansion / Resource Ingest / Evidence Viewer
- Gate and approval workflow
- Human review packets
- Human review agenda
- Human review agenda receipt intake
- Human review receipt workspace
- Human review receipt workspace merge
- Human review context bundle
- Human review decision register
- Human review decision register merge
- Human review validation feedback
- Human review correction workspace
- Human review correction workspace merge
- Human review correction validation
- Human review correction feedback
- Human review cycle ledger
- Human review cycle work orders
- Human review cycle target audit
- Human review cycle triage inbox
- Human review cycle reviewer console
- Human review cycle receipt field audit
- Human review cycle receipt completion pack
- Human review cycle receipt completion verification
- Human review cycle receipt completion workbench
- Human review cycle receipt completion runbook
- Human review cycle receipt completion readiness
- Human review cycle receipt completion command queue
- Human review cycle receipt completion command receipts
- Human review cycle receipt completion command receipt validation
- Human review cycle receipt completion command receipt feedback
- Human review cycle receipt completion command receipt workspace
- Human review cycle receipt completion command receipt workspace merge
- Law Firm, Personal Dev, Creative Document slices
- Output, Observability, Audit Trail, Delivery, Matter Cockpit
- Control Plane Loop
- Dashboard/API surface

## Gate-Aware Acceptance

일부 stage는 `pending`이나 `blocked`가 구현 실패가 아니라 올바른 통제 동작이다.

- Evidence Viewer: evidence queue가 생성되고 blocking ingest gate가 없으면 구현 통과
- Approval Workflow: approval inbox와 gate review 항목이 생성되면 구현 통과
- Human Review Packets: review packet과 receipt item 연결이 생성되고 validation error가 없으면 구현 통과
- Human Review Agenda: reviewer별 agenda와 receipt decision template이 생성되고 validation error가 없으면 구현 통과
- Human Review Agenda Receipt Intake: agenda decision template이 표준 human gate receipt input으로 변환되고 validation error가 없으면 구현 통과
- Human Review Receipt Workspace: actor별 editable receipt input과 review checklist가 생성되고 validation error가 없으면 구현 통과
- Human Review Receipt Workspace Merge: actor별 receipt input이 표준 receipt input으로 병합되고 validation error가 없으면 구현 통과
- Human Review Context Bundle: pending receipt마다 gate/evidence/approval/matter context card가 생성되고 validation error가 없으면 구현 통과
- Human Review Decision Register: context-bound decision row와 표준 receipt input이 생성되고 validation error가 없으면 구현 통과
- Human Review Decision Register Merge: actor별 decision receipt input이 표준 receipt input으로 병합되고 validation error가 없으면 구현 통과
- Human Review Validation Feedback: receipt validation 결과가 actor별 feedback bundle로 환류되고 validation error가 없으면 구현 통과
- Human Review Correction Workspace: feedback이 actor별 editable correction receipt input으로 변환되고 validation error가 없으면 구현 통과
- Human Review Correction Workspace Merge: actor별 correction receipt input이 표준 receipt input으로 병합되고 validation error가 없으면 구현 통과
- Human Review Correction Validation: 병합된 correction receipt input이 missing/invalid/unknown 오류 없이 validation 단계에 재진입하면 구현 통과
- Human Review Correction Feedback: correction validation 결과가 actor별 feedback bundle로 환류되고 validation error가 없으면 구현 통과
- Human Review Cycle Ledger: feedback, correction workspace, merge, validation, feedback 상태가 gate item 단위로 연결되고 validation error가 없으면 구현 통과
- Human Review Cycle Work Orders: cycle ledger item이 actor별 work order queue로 변환되고 validation error가 없으면 구현 통과
- Human Review Cycle Target Audit: work order별 target receipt input과 gate row가 확인되고 validation error가 없으면 구현 통과
- Human Review Cycle Triage Inbox: verified work order와 target audit이 actor-ready triage queue로 변환되고 validation error가 없으면 구현 통과
- Human Review Cycle Reviewer Console: triage item이 context card와 decision row까지 연결된 actor console로 렌더링되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Field Audit: reviewer console이 가리키는 receipt row와 required field 상태가 audit되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Pack: receipt field audit이 actor별 manual completion template로 변환되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Verification: completion template가 target receipt input에 수동 반영됐는지 read-only로 검증하고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Workbench: actor별 manual receipt input 작업판과 template link가 생성되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Runbook: manual receipt input 이후의 검증 명령과 actor별 runbook이 생성되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Readiness: manual input 전 실행 가능한 refresh command와 보류해야 할 command가 분리되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Command Queue: 실행 가능한 manual refresh command와 held command가 별도 queue로 노출되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Command Receipts: ready command의 manual execution receipt draft와 held command reference가 생성되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Command Receipt Validation: command-run receipt input이 pending/ready/invalid로 판정되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Command Receipt Feedback: command receipt validation 결과가 actor별 feedback bundle로 환류되고 validation error가 없으면 구현 통과
- Human Review Cycle Receipt Completion Command Receipt Workspace: command receipt feedback이 actor별 editable command receipt input으로 변환되고 validation error가 없으면 구현 통과
- Law Firm / Personal Dev / Creative Document slices: attorney, merge, human approval gate에 도달하면 구현 통과
- Observability: run/event/gate blocker가 오류 없이 기록되면 구현 통과
- Matter Cockpit: matter/resource/evidence와 protected delivery blocker가 표시되면 구현 통과

이 경우 checkpoint item은 `status: passed`, `implementation_status: passed_with_operational_gate`, `operational_status: pending|blocked|attention`을 함께 기록한다.

## Dashboard/API

Dashboard는 `control_plane_goal_checkpoint` stage를 표시한다. Review API는 다음 route를 제공한다.

- `GET /api/goal-checkpoints`
- `GET /api/goal-checkpoint-items`

예:

```bash
node scripts/review-api.mjs --once "/api/goal-checkpoints"
node scripts/review-api.mjs --once "/api/goal-checkpoint-items?status=attention"
```

## Goal 내 위치

이 단계는 `/goal`의 “각 단계마다 계획 대비 100% 구현 여부를 검증한 뒤 다음 단계로 넘어간다”는 원칙을 상태 artifact로 고정한다. 단순히 테스트 통과 여부가 아니라, core plane과 policy, domain pack, runtime/approval/dashboard 계층이 목표 축별로 살아 있는지 확인한다.
