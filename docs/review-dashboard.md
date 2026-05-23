# Review Dashboard

`Review Dashboard`는 Resource Expansion부터 Approval Decisions까지의 산출물을 하나의 운영 상태판으로 합친다. 나중에 웹 API를 붙일 때도 `review-dashboard.json`을 그대로 응답 계약으로 사용할 수 있게 만든 얇은 dashboard/API slice다.

## 실행

```bash
npm run dashboard:build -- \
  --resource-expansion artifacts/resource-expansion/latest/resource-expansion-job.json \
  --resource-ingest artifacts/resource-ingest/latest/resource-ingest.json \
  --evidence-viewer artifacts/evidence-viewer/latest/evidence-viewer.json \
  --approval-queue artifacts/approval-queue/latest/approval-queue.json \
  --approval-decisions artifacts/approval-decisions/latest/approval-decision-result.json \
  --approval-inbox artifacts/approval-inbox/latest/approval-inbox.json \
  --domain-pack-registry artifacts/domain-packs/latest/domain-pack-registry.json \
  --output-catalog artifacts/output-catalog/latest/output-catalog.json \
  --observability-catalog artifacts/observability/latest/observability-catalog.json \
  --delivery-queue artifacts/delivery-queue/latest/protected-delivery-queue.json \
  --matter-cockpit artifacts/matter-cockpit/latest/matter-cockpit.json \
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
- Approval Decisions의 applied, pending, audit event, follow-up action
- Approval Inbox의 output/delivery approval request와 gate blocker review 상태
- Domain Pack Registry의 pack, capability, validation 상태
- Output Artifact Catalog의 artifact, approval, delivery readiness 상태
- Observability Catalog의 workflow run, event, runtime cost, blocked run 상태
- Protected Delivery Queue의 delivery action, blocked/ready, delivery channel 상태
- Matter Cockpit의 matter/project별 resource, output, run, delivery blocker 상태
- Law Firm LDD Slice의 issue, RFI, citation, attorney approval 상태
- Personal Dev Slice의 worktree isolation과 merge approval 상태
- Creative Document Slice의 slide, artifact, format validation, human approval 상태

## Goal 내 위치

이 단계는 `/goal`의 Dashboard/API 기준을 향한 첫 조각이다. 아직 서버를 띄우지 않고 정적 HTML과 JSON 계약만 생성하지만, Control Plane의 실행 상태, gate, approval, audit, follow-up을 한 화면에서 추적할 수 있게 한다.
