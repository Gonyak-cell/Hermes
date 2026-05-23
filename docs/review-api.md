# Review API

`Review API`는 `review-dashboard.json`을 읽기 전용 HTTP API와 정적 HTML로 노출한다. 아직 decision 적용, merge, 발송 같은 protected action은 실행하지 않는다. 이 단계의 목적은 Dashboard/API 계층의 첫 서버 경계를 만드는 것이다.

## 실행

먼저 dashboard 산출물을 만든다.

```bash
npm run dashboard:build
```

그 다음 API를 띄운다.

```bash
npm run api:serve
```

기본 주소:

- `http://127.0.0.1:4177/`
- `http://127.0.0.1:4177/api/dashboard`

## 주요 Route

- `GET /`: 정적 dashboard HTML
- `GET /health`: dashboard artifact 존재 여부와 overall status
- `GET /api`: route index
- `GET /api/dashboard`: 전체 `review-dashboard.v1`
- `GET /api/summary`: summary만 반환
- `GET /api/stages`: control plane stage 상태
- `GET /api/actions`: action queue
- `GET /api/sources`: dashboard source artifact 목록
- `GET /api/packs`: domain pack registry의 pack 목록
- `GET /api/capabilities`: domain pack capability 계약 목록
- `GET /api/artifacts`: output artifact catalog의 산출물 목록
- `GET /api/runs`: observability catalog의 workflow run 목록
- `GET /api/events`: observability catalog의 event 목록
- `GET /api/costs`: observability catalog의 cost record 목록
- `GET /api/delivery-actions`: protected delivery queue의 전달 후보 목록
- `GET /api/matters`: matter cockpit의 matter/project 목록
- `GET /api/approvals`: approval inbox의 사람 검토 항목
- `GET /api/approval-inbox-decisions`: approval inbox 결정 적용 결과
- `GET /api/delivery-execution-candidates`: draft-only delivery execution 후보
- `GET /api/delivery-execution-packets`: 사람이 실행할 draft delivery packet
- `GET /api/delivery-receipts`: 적용된 delivery receipt 목록
- `GET /api/delivery-receipt-events`: delivery receipt audit event 목록
- `GET /api/post-delivery-matters`: receipt 반영 후 matter/project별 전달 상태
- `GET /api/delivered-artifacts`: receipt 반영 후 delivered output artifact 목록
- `GET /api/outstanding-receipts`: 아직 닫히지 않은 delivery receipt 목록
- `GET /api/delivery-closeout-items`: 사람이 처리할 delivery closeout queue
- `GET /api/receipt-input-drafts`: closeout item별 receipt input draft row
- `GET /api/closeout-receipt-validations`: closeout receipt 검증 결과
- `GET /api/closeout-receipt-errors`: closeout receipt 검증 오류
- `GET /api/validated-receipts-to-apply`: `delivery:receipts`에 넘길 검증 완료 receipt
- `GET /api/closeout-receipt-applications`: closeout receipt application artifact
- `GET /api/closeout-applied-receipts`: closeout application으로 적용된 receipt
- `GET /api/pipeline-runs`: control plane pipeline 실행 artifact
- `GET /api/pipeline-steps`: control plane pipeline 단계별 실행 결과
- `GET /api/control-plane-loops`: control plane loop 실행 artifact
- `GET /api/control-plane-loop-steps`: control plane loop 단계별 실행 결과
- `GET /api/control-plane-health`: control plane health artifact
- `GET /api/health-checks`: control plane health check 목록
- `GET /api/action-plans`: control plane action plan artifact
- `GET /api/action-plan-items`: control plane action plan 항목
- `GET /api/action-work-packets`: control plane work packet 목록
- `GET /api/action-work-items`: control plane work item 목록
- `GET /api/work-packet-receipt-requirements`: work packet closeout에 필요한 receipt requirement
- `GET /api/work-packet-receipt-drafts`: 사람이 채울 work packet receipt draft
- `GET /api/work-packet-receipt-validations`: work packet receipt validation item
- `GET /api/work-packet-receipt-errors`: work packet receipt validation 오류
- `GET /api/validated-work-packet-receipts`: 향후 적용 가능한 검증 완료 work packet receipt
- `GET /api/work-packet-receipt-applications`: work packet receipt application artifact
- `GET /api/applied-work-packet-receipts`: 적용된 work packet receipt
- `GET /summary.md`: Markdown 요약

`/api/actions`와 `/api/stages`는 `status`, `priority`, `source_stage`, `stage_id`, `source_id`, `available`, `limit` query를 지원한다. `/api/packs`와 `/api/capabilities`는 `pack_id`, `capability_id`, `enabled`, `valid`, `limit` query를 지원한다. `/api/artifacts`와 `/api/delivered-artifacts`는 `artifact_id`, `artifact_type`, `domain_pack`, `delivery_state`, `approval_status`, `status`, `matter_id`, `tenant_id`, `limit` query를 지원한다. `/api/runs`, `/api/events`, `/api/costs`는 `run_id`, `workflow_run_id`, `runtime_id`, `event_type`, `cost_type`, `capability_id`, `source_id`, `status`, `limit` query를 지원한다. `/api/delivery-actions`는 `delivery_action_id`, `artifact_id`, `domain_pack`, `delivery_status`, `delivery_channel`, `delivery_target`, `priority`, `limit` query를 지원한다. `/api/matters`와 `/api/post-delivery-matters`는 `matter_key`, `tenant_id`, `matter_id`, `status`, `limit` query를 지원한다. `/api/approvals`는 `approval_item_id`, `item_type`, `approval_id`, `domain_pack`, `matter_id`, `priority`, `required_decision`, `status`, `limit` query를 지원한다. `/api/approval-inbox-decisions`는 `approval_item_id`, `item_type`, `decision`, `status_after`, `priority`, `limit` query를 지원한다. `/api/delivery-execution-candidates`와 `/api/delivery-execution-packets`는 `execution_candidate_id`, `packet_id`, `execution_status`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원한다. `/api/delivery-receipts`와 `/api/closeout-applied-receipts`는 `receipt_id`, `packet_id`, `receipt_status`, `executed_by`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원하고, `/api/delivery-receipt-events`는 `type`, `tenant_id`, `correlation_id`, `limit` query를 지원한다. `/api/outstanding-receipts`와 `/api/delivery-closeout-items`는 `closeout_item_id`, `packet_id`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `status`, `primary_domain_pack`, `limit` query를 지원한다. `/api/receipt-input-drafts`, `/api/validated-receipts-to-apply`는 `receipt_id`, `packet_id`, `receipt_status`, `limit` query를 지원한다. `/api/closeout-receipt-validations`는 `validation_item_id`, `packet_id`, `validation_status`, `receipt_status`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `primary_domain_pack`, `limit` query를 지원하고, `/api/closeout-receipt-errors`는 `packet_id`, `field`, `limit` query를 지원한다. `/api/closeout-receipt-applications`, `/api/work-packet-receipt-applications`, `/api/pipeline-runs`, `/api/control-plane-loops`는 `application_id`, `application_status`, `pipeline_id`, `loop_id`, `loop_status`, `limit` query를 지원한다. `/api/pipeline-steps`와 `/api/control-plane-loop-steps`는 `step_id`, `category`, `status`, `limit` query를 지원한다. `/api/control-plane-health`는 `health_id`, `limit` query를 지원하고, `/api/health-checks`는 `check_id`, `source_stage`, `status`, `severity`, `limit` query를 지원한다. `/api/action-plans`는 `plan_id`, `plan_status`, `limit` query를 지원하고, `/api/action-plan-items`는 `plan_item_id`, `source_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/action-work-packets`는 `work_packet_id`, `packet_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/action-work-items`는 `work_item_id`, `work_packet_id`, `plan_item_id`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/work-packet-receipt-requirements`는 `receipt_requirement_id`, `work_packet_id`, `packet_type`, `source_stage`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-drafts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다. `/api/work-packet-receipt-validations`는 `validation_item_id`, `work_packet_id`, `packet_type`, `source_stage`, `validation_status`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-errors`는 `work_packet_id`, `field`, `limit` query를 지원한다. `/api/validated-work-packet-receipts`와 `/api/applied-work-packet-receipts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다.

## 검증

```bash
npm run api:smoke
```

smoke test는 임시 포트에서 API를 띄운 뒤 `/health`, `/api`, `/api/dashboard`, `/api/stages`, `/api/actions`, `/`를 확인하고 서버를 닫는다.

## Goal 내 위치

이 단계는 `/goal`의 `dashboard/API` 완성 기준 중 API의 첫 얇은 slice다. 쓰기는 아직 금지하고, 모든 상태는 기존 Event/Audit/Approval 산출물에서 파생된 읽기 전용 view로만 제공한다.
