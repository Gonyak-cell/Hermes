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
- `GET /api/evidence-review-drafts`: evidence review draft artifact
- `GET /api/evidence-review-items`: evidence review draft 항목
- `GET /api/policy-matrices`: policy matrix catalog artifact
- `GET /api/policy-classifications`: policy classification level 목록
- `GET /api/runtime-policies`: classification별 runtime 허용/제한 정책
- `GET /api/model-policies`: 외부/로컬 모델 전송 정책
- `GET /api/tool-policies`: tool permission 정책
- `GET /api/output-policies`: output delivery 정책
- `GET /api/gate-policies`: pre/in/post-run gate 정책
- `GET /api/policy-snapshot-ledgers`: policy snapshot ledger artifact
- `GET /api/policy-snapshots`: 실행에 사용된 canonical policy snapshot
- `GET /api/policy-snapshot-instances`: source별 policy snapshot instance
- `GET /api/policy-decisions`: snapshot에서 도출한 model/runtime policy decision
- `GET /api/policy-usages`: workflow/event/run ledger의 policy snapshot reference
- `GET /api/context-packet-ledgers`: context packet ledger artifact
- `GET /api/context-packets`: runtime별 context packet
- `GET /api/context-items`: packet에 포함된 context item
- `GET /api/context-retrieval-filters`: packet별 matter/classification retrieval filter
- `GET /api/model-routing-ledgers`: model routing ledger artifact
- `GET /api/model-routing-decisions`: runtime/model/provider boundary별 routing decision
- `GET /api/cost-budget-ledgers`: cost budget ledger artifact
- `GET /api/cost-budget-decisions`: routing decision별 cost budget gate decision
- `GET /api/token-usage-ledgers`: token usage ledger artifact
- `GET /api/token-usage-records`: routing decision별 recorded/estimated token usage
- `GET /api/cost-attribution-ledgers`: cost attribution ledger artifact
- `GET /api/cost-attribution-records`: matter/runtime/capability별 projected cost attribution
- `GET /api/budget-alert-ledgers`: budget alert ledger artifact
- `GET /api/budget-alert-records`: matter/runtime/capability별 budget alert record
- `GET /api/packs`: domain pack registry의 pack 목록
- `GET /api/capabilities`: domain pack capability 계약 목록
- `GET /api/artifacts`: output artifact catalog의 산출물 목록
- `GET /api/runs`: observability catalog의 workflow run 목록
- `GET /api/events`: observability catalog의 event 목록
- `GET /api/costs`: observability catalog의 cost record 목록
- `GET /api/audit-trails`: control plane audit trail artifact
- `GET /api/audit-events`: 정규화된 control plane audit event
- `GET /api/audit-sources`: audit event source artifact 상태
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
- `GET /api/goal-checkpoints`: control plane goal checkpoint artifact
- `GET /api/goal-checkpoint-items`: control plane goal checkpoint 항목
- `GET /api/control-plane-health`: control plane health artifact
- `GET /api/health-checks`: control plane health check 목록
- `GET /api/action-plans`: control plane action plan artifact
- `GET /api/action-plan-items`: control plane action plan 항목
- `GET /api/human-gates`: control plane human gate briefing artifact
- `GET /api/human-gate-items`: control plane human gate item
- `GET /api/human-gate-receipts`: human gate receipt draft artifact
- `GET /api/human-gate-receipt-requirements`: human gate receipt requirement
- `GET /api/human-gate-receipt-drafts`: 사람이 채울 human gate receipt draft
- `GET /api/human-review-packet-ledgers`: human review packet ledger artifact
- `GET /api/human-review-packets`: actor/gate type별 human review packet
- `GET /api/human-review-items`: human review packet item
- `GET /api/human-review-agendas`: human review agenda artifact
- `GET /api/human-review-agenda-sections`: required actor별 agenda section
- `GET /api/human-review-agenda-items`: review packet 단위 agenda item
- `GET /api/human-review-decision-template`: 사람이 채울 receipt decision template row
- `GET /api/human-review-agenda-receipt-intakes`: agenda decision template intake artifact
- `GET /api/human-review-agenda-receipt-intake-items`: agenda receipt intake item
- `GET /api/human-review-agenda-receipt-input`: receipt validation에 넘길 표준 human gate receipt input row
- `GET /api/human-review-receipt-workspaces`: actor별 receipt workspace manifest artifact
- `GET /api/human-review-actor-workspaces`: required actor별 editable receipt workspace
- `GET /api/human-review-workspace-entries`: workspace에 포함된 receipt entry
- `GET /api/human-review-receipt-workspace-merges`: actor receipt input merge artifact
- `GET /api/human-review-receipt-merge-items`: merge된 receipt item
- `GET /api/human-review-merged-receipt-input`: validation에 넘길 merged receipt input row
- `GET /api/human-review-context-bundles`: human review context bundle artifact
- `GET /api/human-review-context-cards`: pending receipt별 gate/evidence/approval/matter context card
- `GET /api/human-review-actor-context-bundles`: required actor별 context bundle
- `GET /api/human-review-decision-registers`: human review decision register artifact
- `GET /api/human-review-decision-rows`: context-bound decision row
- `GET /api/human-review-decision-receipt-input`: validation에 넘길 decision register receipt input row
- `GET /api/human-review-decision-register-merges`: actor decision receipt input merge artifact
- `GET /api/human-review-decision-merge-items`: merge된 decision receipt item
- `GET /api/human-review-merged-decision-receipt-input`: validation에 넘길 merged decision receipt input row
- `GET /api/human-gate-receipt-validations`: human gate receipt validation item
- `GET /api/human-gate-receipt-errors`: human gate receipt validation 오류
- `GET /api/human-review-validation-feedbacks`: human review validation feedback artifact
- `GET /api/human-review-feedback-items`: actor별 feedback item
- `GET /api/human-review-actor-feedback`: required actor별 validation feedback bundle
- `GET /api/human-review-correction-workspaces`: human review correction workspace artifact
- `GET /api/human-review-correction-actors`: required actor별 correction workspace
- `GET /api/human-review-correction-items`: actor별 correction item
- `GET /api/human-review-correction-receipt-input`: editable correction receipt input row
- `GET /api/human-review-correction-workspace-merges`: actor correction receipt input merge artifact
- `GET /api/human-review-correction-merge-actors`: correction merge에 포함된 actor input
- `GET /api/human-review-correction-merge-items`: merge된 correction receipt item
- `GET /api/human-review-merged-correction-receipt-input`: validation에 넘길 merged correction receipt input row
- `GET /api/human-review-correction-validations`: merged correction receipt validation artifact
- `GET /api/human-review-correction-validation-items`: merged correction receipt validation item
- `GET /api/human-review-correction-validation-errors`: merged correction receipt validation 오류
- `GET /api/validated-correction-human-gate-receipts`: 향후 적용 가능한 검증 완료 correction receipt
- `GET /api/human-review-correction-feedbacks`: correction validation feedback artifact
- `GET /api/human-review-correction-feedback-items`: actor별 correction feedback item
- `GET /api/human-review-correction-actor-feedback`: required actor별 correction feedback bundle
- `GET /api/human-review-cycle-ledgers`: feedback/correction cycle ledger artifact
- `GET /api/human-review-cycle-items`: gate item별 feedback/correction cycle item
- `GET /api/human-review-actor-cycles`: required actor별 cycle rollup
- `GET /api/human-review-cycle-work-orders`: actor work order artifact
- `GET /api/human-review-cycle-work-order-items`: cycle item에서 파생된 actor work order item
- `GET /api/human-review-actor-work-orders`: required actor별 work order
- `GET /api/validated-human-gate-receipts`: 향후 적용 가능한 검증 완료 human gate receipt
- `GET /api/human-gate-receipt-applications`: human gate receipt application artifact
- `GET /api/applied-human-gate-receipts`: 적용된 human gate receipt
- `GET /api/patched-human-gate-items`: receipt 적용으로 patch된 human gate item
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

`/api/actions`와 `/api/stages`는 `status`, `priority`, `source_stage`, `stage_id`, `source_id`, `available`, `limit` query를 지원한다. `/api/evidence-review-drafts`는 `draft_id`, `limit` query를 지원하고, `/api/evidence-review-items`는 `review_item_id`, `queue_item_id`, `evidence_id`, `classification`, `review_status`, `suggested_decision`, `draft_decision`, `auto_approvable`, `priority`, `limit` query를 지원한다. Policy route는 `policy_status`, `matrix_id`, `ledger_id`, `ledger_status`, `policy_snapshot_id`, `decision_id`, `decision_status`, `usage_id`, `usage_type`, `snapshot_declared_in_source`, `classification`, `external_model_policy`, `local_model_policy`, `redaction_policy`, `approval_required`, `tool_id`, `default_policy`, `artifact_type`, `delivery_policy`, `gate_id`, `stage`, `blocking_by_default`, `limit` query를 지원한다. Context route는 `context_packet_id`, `context_item_id`, `retrieval_filter_id`, `packet_status`, `context_mode`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `redaction_required`, `redaction_applied`, `classification_allowed`, `runtime_allowed_by_capability`, `item_type`, `content_mode`, `filter_status`, `limit` query를 지원한다. Model routing route는 `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `route_status`, `route_mode`, `external_transfer`, `provider_boundary`, `runtime_policy_status`, `external_model_policy`, `local_model_policy`, `redaction_status`, `audit_required`, `approval_required`, `ledger_status`, `limit` query를 지원한다. Cost budget route는 `budget_decision_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `route_mode`, `budget_status`, `token_tracking_required`, `token_tracking_status`, `cost_budget_gate_present`, `cost_policy_present`, `ledger_status`, `limit` query를 지원한다. Token usage route는 `token_usage_id`, `budget_decision_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `tracking_status`, `estimated`, `ledger_status`, `limit` query를 지원한다. `/api/packs`와 `/api/capabilities`는 `pack_id`, `capability_id`, `enabled`, `valid`, `limit` query를 지원한다. `/api/artifacts`와 `/api/delivered-artifacts`는 `artifact_id`, `artifact_type`, `domain_pack`, `delivery_state`, `approval_status`, `status`, `matter_id`, `tenant_id`, `limit` query를 지원한다. `/api/runs`, `/api/events`, `/api/costs`는 `run_id`, `workflow_run_id`, `runtime_id`, `event_type`, `cost_type`, `capability_id`, `source_id`, `status`, `limit` query를 지원한다. `/api/audit-trails`는 `audit_trail_id`, `audit_status`, `limit` query를 지원하고, `/api/audit-events`는 `audit_event_id`, `event_type`, `event_category`, `source_id`, `tenant_id`, `actor_type`, `actor_id`, `correlation_id`, `protected_action_event`, `protected_action_executed`, `limit` query를 지원하며, `/api/audit-sources`는 `source_id`, `available`, `limit` query를 지원한다. `/api/delivery-actions`는 `delivery_action_id`, `artifact_id`, `domain_pack`, `delivery_status`, `delivery_channel`, `delivery_target`, `priority`, `limit` query를 지원한다. `/api/matters`와 `/api/post-delivery-matters`는 `matter_key`, `tenant_id`, `matter_id`, `status`, `limit` query를 지원한다. `/api/approvals`는 `approval_item_id`, `item_type`, `approval_id`, `domain_pack`, `matter_id`, `priority`, `required_decision`, `status`, `limit` query를 지원한다. `/api/approval-inbox-decisions`는 `approval_item_id`, `item_type`, `decision`, `status_after`, `priority`, `limit` query를 지원한다. `/api/delivery-execution-candidates`와 `/api/delivery-execution-packets`는 `execution_candidate_id`, `packet_id`, `execution_status`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원한다. `/api/delivery-receipts`와 `/api/closeout-applied-receipts`는 `receipt_id`, `packet_id`, `receipt_status`, `executed_by`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원하고, `/api/delivery-receipt-events`는 `type`, `tenant_id`, `correlation_id`, `limit` query를 지원한다. `/api/outstanding-receipts`와 `/api/delivery-closeout-items`는 `closeout_item_id`, `packet_id`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `status`, `primary_domain_pack`, `limit` query를 지원한다. `/api/receipt-input-drafts`, `/api/validated-receipts-to-apply`는 `receipt_id`, `packet_id`, `receipt_status`, `limit` query를 지원한다. `/api/closeout-receipt-validations`는 `validation_item_id`, `packet_id`, `validation_status`, `receipt_status`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `primary_domain_pack`, `limit` query를 지원하고, `/api/closeout-receipt-errors`는 `packet_id`, `field`, `limit` query를 지원한다. `/api/closeout-receipt-applications`, `/api/human-gate-receipt-applications`, `/api/work-packet-receipt-applications`, `/api/pipeline-runs`, `/api/control-plane-loops`, `/api/goal-checkpoints`는 `application_id`, `application_status`, `pipeline_id`, `loop_id`, `loop_status`, `checkpoint_id`, `checkpoint_status`, `limit` query를 지원한다. `/api/pipeline-steps`와 `/api/control-plane-loop-steps`는 `step_id`, `category`, `status`, `limit` query를 지원한다. `/api/goal-checkpoint-items`는 `checkpoint_item_id`, `category`, `status`, `priority`, `limit` query를 지원한다. `/api/control-plane-health`는 `health_id`, `limit` query를 지원하고, `/api/health-checks`는 `check_id`, `source_stage`, `status`, `severity`, `limit` query를 지원한다. `/api/action-plans`는 `plan_id`, `plan_status`, `limit` query를 지원하고, `/api/action-plan-items`는 `plan_item_id`, `source_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/human-gates`는 `human_gate_id`, `limit` query를 지원하고, `/api/human-gate-items`, `/api/patched-human-gate-items`는 `gate_item_id`, `source_plan_item_id`, `source_stage`, `gate_type`, `priority`, `status`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/human-gate-receipts`는 `receipt_draft_id`, `receipt_status`, `limit` query를 지원하고, `/api/human-gate-receipt-requirements`는 `receipt_requirement_id`, `gate_item_id`, `source_plan_item_id`, `source_stage`, `gate_type`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하며, `/api/human-gate-receipt-drafts`는 `receipt_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `receipt_status`, `outcome`, `limit` query를 지원한다. `/api/human-gate-receipt-validations`는 `validation_item_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `source_stage`, `validation_status`, `receipt_status`, `outcome`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/human-gate-receipt-errors`는 `gate_item_id`, `field`, `limit` query를 지원한다. `/api/validated-human-gate-receipts`와 `/api/applied-human-gate-receipts`는 `receipt_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `receipt_status`, `outcome`, `limit` query를 지원한다. `/api/action-work-packets`는 `work_packet_id`, `packet_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/action-work-items`는 `work_item_id`, `work_packet_id`, `plan_item_id`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/work-packet-receipt-requirements`는 `receipt_requirement_id`, `work_packet_id`, `packet_type`, `source_stage`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-drafts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다. `/api/work-packet-receipt-validations`는 `validation_item_id`, `work_packet_id`, `packet_type`, `source_stage`, `validation_status`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-errors`는 `work_packet_id`, `field`, `limit` query를 지원한다. `/api/validated-work-packet-receipts`와 `/api/applied-work-packet-receipts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다.

Human review packet route는 `review_packet_id`, `review_item_id`, `packet_type`, `packet_status`, `required_actor`, `gate_item_id`, `gate_type`, `source_stage`, `priority`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원한다. Human review agenda route는 `agenda_id`, `agenda_section_id`, `agenda_item_id`, `agenda_status`, `section_status`, `review_packet_id`, `packet_type`, `required_actor`, `priority`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review agenda receipt intake route는 `intake_id`, `intake_item_id`, `intake_status`, `template_row_present`, `ready_for_validation`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `required_actor`, `protected_action`, `limit` query를 지원한다. Human review receipt workspace route는 `workspace_id`, `actor_workspace_id`, `workspace_entry_id`, `workspace_status`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review receipt workspace merge route는 `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review context bundle route는 `bundle_id`, `bundle_status`, `actor_context_bundle_id`, `context_card_id`, `context_status`, `subject_type`, `subject_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review decision register route는 `register_id`, `register_status`, `actor_decision_register_id`, `decision_row_id`, `decision_status`, `context_card_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review decision register merge route는 `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `actor_decision_register_id`, `decision_row_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review validation feedback route는 `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `required_actor`, `validation_status`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review correction workspace route는 `correction_workspace_id`, `actor_correction_workspace_id`, `correction_item_id`, `correction_status`, `workspace_status`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review correction merge, validation, feedback route는 `merge_id`, `merge_item_id`, `validation_item_id`, `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `required_actor`, `validation_status`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review cycle route는 `cycle_id`, `actor_cycle_id`, `cycle_item_id`, `cycle_status`, `required_actor`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다.

Cost attribution route는 `attribution_id`, `budget_decision_id`, `token_usage_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `attribution_status`, `over_budget`, `untracked_cost`, `matter_id`, `tenant_id`, `ledger_status`, `limit` query를 지원한다.

Budget alert route는 `alert_record_id`, `attribution_id`, `budget_decision_id`, `token_usage_id`, `routing_decision_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `alert_status`, `requires_human`, `matter_id`, `tenant_id`, `ledger_status`, `limit` query를 지원한다.

## 검증

```bash
npm run api:smoke
```

smoke test는 임시 포트에서 API를 띄운 뒤 `/health`, `/api`, `/api/dashboard`, `/api/stages`, `/api/actions`, `/`를 확인하고 서버를 닫는다.

## Goal 내 위치

이 단계는 `/goal`의 `dashboard/API` 완성 기준 중 API의 첫 얇은 slice다. 쓰기는 아직 금지하고, 모든 상태는 기존 Event/Audit/Approval 산출물에서 파생된 읽기 전용 view로만 제공한다.
