# Review Dashboard

`Review Dashboard`는 Resource Expansion부터 Health/Action Plan까지의 산출물을 하나의 운영 상태판으로 합친다. 나중에 웹 API를 붙일 때도 `review-dashboard.json`을 그대로 응답 계약으로 사용할 수 있게 만든 얇은 dashboard/API slice다.

## 실행

```bash
npm run dashboard:build -- \
  --resource-expansion artifacts/resource-expansion/latest/resource-expansion-job.json \
  --resource-ingest artifacts/resource-ingest/latest/resource-ingest.json \
  --evidence-viewer artifacts/evidence-viewer/latest/evidence-viewer.json \
  --approval-queue artifacts/approval-queue/latest/approval-queue.json \
  --evidence-review-draft artifacts/evidence-review-draft/latest/evidence-review-draft.json \
  --approval-decisions artifacts/approval-decisions/latest/approval-decision-result.json \
  --approval-inbox artifacts/approval-inbox/latest/approval-inbox.json \
  --approval-inbox-decisions artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json \
  --policy-matrix-catalog artifacts/policy-matrix/latest/policy-matrix-catalog.json \
  --domain-pack-registry artifacts/domain-packs/latest/domain-pack-registry.json \
  --output-catalog artifacts/output-catalog/latest/output-catalog.json \
  --observability-catalog artifacts/observability/latest/observability-catalog.json \
  --delivery-queue artifacts/delivery-queue/latest/protected-delivery-queue.json \
  --matter-cockpit artifacts/matter-cockpit/latest/matter-cockpit.json \
  --delivery-execution artifacts/delivery-execution/latest/delivery-execution-draft.json \
  --delivery-receipts artifacts/delivery-receipts/latest/delivery-receipt-ledger.json \
  --post-delivery-reconciliation artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json \
  --delivery-closeout artifacts/delivery-closeout/latest/delivery-closeout-queue.json \
  --closeout-receipt-validation artifacts/delivery-closeout-validation/latest/closeout-receipt-validation.json \
  --closeout-receipt-application artifacts/delivery-closeout-application/latest/closeout-receipt-application.json \
  --control-plane-pipeline artifacts/control-plane-pipeline/latest/control-plane-pipeline.json \
  --control-plane-loop artifacts/control-plane-loop/latest/control-plane-loop.json \
  --control-plane-goal-checkpoint artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json \
  --control-plane-audit-trail artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json \
  --context-packet-ledger artifacts/context-packets/latest/context-packet-ledger.json \
  --model-routing-ledger artifacts/model-routing/latest/model-routing-ledger.json \
  --cost-budget-ledger artifacts/cost-budget/latest/cost-budget-ledger.json \
  --token-usage-ledger artifacts/token-usage/latest/token-usage-ledger.json \
  --control-plane-health artifacts/control-plane-health/latest/control-plane-health.json \
  --control-plane-action-plan artifacts/control-plane-action-plan/latest/control-plane-action-plan.json \
  --control-plane-human-gates artifacts/control-plane-human-gates/latest/control-plane-human-gates.json \
  --control-plane-human-gate-receipts artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json \
  --control-plane-human-gate-receipt-validation artifacts/control-plane-human-gate-receipt-validation/latest/control-plane-human-gate-receipt-validation.json \
  --control-plane-human-gate-receipt-application artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json \
  --control-plane-work-packets artifacts/control-plane-work-packets/latest/control-plane-work-packets.json \
  --control-plane-work-packet-receipts artifacts/control-plane-work-packet-receipts/latest/control-plane-work-packet-receipt-drafts.json \
  --control-plane-work-packet-receipt-validation artifacts/control-plane-work-packet-receipt-validation/latest/control-plane-work-packet-receipt-validation.json \
  --control-plane-work-packet-receipt-application artifacts/control-plane-work-packet-receipt-application/latest/control-plane-work-packet-receipt-application.json \
  --law-firm-ldd-summary artifacts/law-firm-ldd-slice/latest/summary.json \
  --personal-dev-summary artifacts/personal-dev-slice/latest/summary.json \
  --creative-document-summary artifacts/creative-document-slice/latest/summary.json \
  --out-dir artifacts/dashboard/latest
```

출력:

- `review-dashboard.json`: dashboard/API 계약
- `index.html`: 정적 운영 상태판
- `summary.md`: 사람이 읽는 요약

## 포함하는 상태

- Resource Expansion의 discovered, extracted, quarantined, failed, remaining 상태
- Resource Ingest의 promoted, blocked, duplicate 상태
- Evidence Viewer의 evidence count, needs review, blocking gate 상태
- Approval Queue의 priority별 pending item
- Evidence Review Draft의 review item, attorney review, suggested decision 상태
- Approval Decisions의 applied, pending, audit event, follow-up action
- Approval Inbox의 output/delivery approval request와 gate blocker review 상태
- Approval Inbox Decisions의 applied decision, patched ready delivery, decision error 상태
- Policy Matrix Catalog의 classification, model/tool/output/gate policy와 validation 상태
- Policy Snapshot Ledger의 snapshot, workflow/event/run ledger usage, matrix alignment 상태
- Context Packet Ledger의 runtime별 context packet, redaction mode, retrieval filter 상태
- Model Routing Ledger의 runtime/provider boundary, 외부전송, redaction enforcement, approval/block 상태
- Cost Budget Ledger의 capability cost policy, observed cost, token tracking 상태
- Token Usage Ledger의 recorded/estimated token usage와 validation 상태
- Domain Pack Registry의 pack, capability, validation 상태
- Output Artifact Catalog의 artifact, approval, delivery readiness 상태
- Observability Catalog의 workflow run, event, runtime cost, blocked run 상태
- Protected Delivery Queue의 delivery action, blocked/ready, delivery channel 상태
- Matter Cockpit의 matter/project별 resource, output, run, delivery blocker 상태
- Delivery Execution Draft의 ready candidate, draft packet, final manual checklist 상태
- Delivery Receipt Ledger의 receipt applied/pending, delivered artifact, audit event 상태
- Post-Delivery Reconciliation의 delivered matter/artifact, outstanding receipt 상태
- Delivery Closeout Queue의 수동 closeout item, receipt input draft 상태
- Closeout Receipt Validation의 ready/pending/invalid receipt 상태
- Closeout Receipt Application의 applied receipt, delivered artifact, audit event 상태
- Control Plane Pipeline의 단계별 실행 성공/실패와 artifact check 상태
- Control Plane Loop의 heartbeat 운영 루프 실행 성공/실패와 artifact check 상태
- Control Plane Goal Checkpoint의 `/goal` coverage와 next focus 상태
- Control Plane Audit Trail의 audit event, source, protected action trace 상태
- Control Plane Health의 건강도 check, blocker, action 상태
- Control Plane Action Plan의 우선순위별 처리 항목, 사람 검토 필요 여부, 다음 명령 상태
- Control Plane Human Gates의 evidence decision, approval, protected delivery agenda
- Control Plane Human Gate Receipts의 pending receipt 입력 초안과 필수 확인값
- Control Plane Human Gate Receipt Validation의 pending/invalid/ready receipt gate 상태
- Control Plane Human Gate Receipt Application의 applied receipt, patched gate, audit event 상태
- Control Plane Work Packets의 protected action, human review, command rerun 묶음 상태
- Control Plane Work Packet Receipts의 pending receipt 입력 초안과 필수 확인값
- Control Plane Work Packet Receipt Validation의 pending/invalid/ready receipt gate 상태
- Control Plane Work Packet Receipt Application의 applied receipt, patched packet, audit event 상태
- Law Firm LDD Slice의 issue, RFI, citation, attorney approval 상태
- Personal Dev Slice의 worktree isolation과 merge approval 상태
- Creative Document Slice의 slide, artifact, format validation, human approval 상태

## Goal 내 위치

이 단계는 `/goal`의 Dashboard/API 기준을 향한 첫 조각이다. 아직 서버를 띄우지 않고 정적 HTML과 JSON 계약만 생성하지만, Control Plane의 실행 상태, gate, approval, audit, follow-up을 한 화면에서 추적할 수 있게 한다.
