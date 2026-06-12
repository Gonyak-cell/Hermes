# Review API

## FA.6 Factory Product Routes

Factory Product routes expose the read-only SaaS Factory product registry rows
from the factory state store. The route reads `data/factory/local/products.jsonl`
first, then `data/factory/seed/products.jsonl`; it does not silently promote the
legacy fallback projection to factory-store truth.

Supported filters include `product_id`, `product_state`, `receipt_id`,
`source_tier`, `seed_record_kind`, and `limit`.

Routes: `/api/factory/products`.

`GET` and `HEAD` are allowed. Mutation methods are blocked by the Review API
read-only guard and the route-local method guard. `POST`, `PUT`, `PATCH`, and
`DELETE` return `405 method_not_allowed`.

## FB.2 Factory Stage Routes

Factory Stage routes expose the read-only product PS state read model. The
route derives current state from the factory product store and local
state-transition ledger without enabling PS3 transitions, candidate writes, or
apply behavior. The response is explicitly read-only with
`mutation_allowed: false` and `raw_confidential_material_visible: false`.

FB.2 extends the rows with read-only control-view fields:

- `stage_progress`
- `gate_status`
- `blocker_ids` and `blocker_count`
- `next_operator_actions`
- `freshness_status`, `source_age_days`, and `stale_badge_required`
- `candidate_manifest_preview_status`
- `candidate_manifest_queue_depth` and `workbench_queue_depth`

The candidate manifest preview remains unavailable until FB.3, and queue depths
remain `0`. Stale rows display a stale badge and block new adjudication until
the product source is refreshed.

Supported filters include `product_id`, `current_product_state`,
`base_product_state`, `product_source_tier`, `gate_status`,
`freshness_status`, `stale_badge_required`,
`candidate_manifest_preview_status`, and `limit`.

Routes: `/api/factory/stage`.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`.

## FB.3-FB.4 Factory Candidate Manifest Routes

Factory Candidate Manifest routes expose the read-only instantiation resolver.
The route returns one resolver row per product and nests generated
`factory-candidate-manifest.v1` JSON previews for rows that are fresh, already
at `PS2_receipt_bound`, and backed by materialized starter artifact refs.

The route is JSON-only. It does not append ledgers, advance products to PS3,
apply candidates, create projects, write repositories, call connectors, deploy,
or grant production/enterprise trust.

Default tracked seed state returns 9 blocked resolver rows and 0 candidate
manifests because seed products are still `PS0_seed`.

Supported filters include `product_id`, `current_product_state`,
`stage_gate_status`, `freshness_status`, `resolver_status`,
`candidate_manifest_id`, `candidate_manifest_status`,
`candidate_manifest_kind`, `candidate_manifest_json_available`, and `limit`.

Routes: `/api/factory/candidate-manifests`.

`visible_candidate_manifest_count` counts candidate manifests visible after
request filters. `candidate_manifest_count` remains the full resolver manifest
total before filters.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`.

## FB.4 Factory Starter Artifact Routes

Factory Starter Artifact routes expose the read-only starter corpus required by
candidate manifest instantiation. The route returns one row per required starter
artifact with materialization status, content type, byte count, and SHA-256 hash.

Supported filters include `domain_pack_id`, `artifact_path`, `artifact_role`,
`artifact_kind`, `content_type`, `exists_now`, `materialized_status`, and
`limit`.

Routes: `/api/factory/starter-artifacts`.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`.

## FB.5 Factory Workbench Routes

Factory Workbench routes expose the integrated read-only operator view for the
Factory Promotion FB tranche. The route composes product PS state, gate status,
freshness, blockers, next actions, candidate manifest preview status, candidate
manifest hashes, and starter artifact materialization counts into one row per
product.

Allowed affordances are view-only, for example `view_stage_status`,
`view_blockers`, `view_next_operator_actions`, and, when eligible,
`view_candidate_manifest_json`. Forbidden affordances include project creation,
ledger append, PS3 advancement, candidate manifest writes, apply, merge,
connector calls, deploy, production PASS, and enterprise PASS.

Supported filters include `product_id`, `current_product_state`,
`stage_gate_status`, `freshness_status`, `resolver_status`,
`workbench_view_status`, `workbench_queue_status`,
`candidate_manifest_json_available`, `starter_artifact_corpus_status`, and
`limit`.

Routes: `/api/factory/workbench`.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`.

## FC.1 Factory Candidate Lane Routes

Factory Candidate Lane routes expose read-only review packets generated from
visible workbench candidate manifests. The route returns candidate packet rows
as the primary collection and includes the visible packet rows' diff packets,
rollback plans, preflight rows, and hash ledger rows.

FC.1 generates unified diff packet content and rollback/preflight metadata, but
does not create worktrees, write repositories, append ledgers, apply patches,
call connectors, deploy, or grant production/enterprise trust.

Supported filters include `candidate_packet_id`, `candidate_packet_status`,
`product_id`, `candidate_manifest_id`, `worktree_lane_status`,
`diff_packet_status`, `rollback_plan_status`, `preflight_status`, and `limit`.

Routes: `/api/factory/candidate-lane`.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`.

## FC.4 Factory Candidate Review Docket Routes

Factory Candidate Review Docket routes expose the FC.3 candidate review docket
as a read-only review surface. The route returns review docket rows as the
primary collection and includes the visible docket rows' review packets, review
hash-register rows, and negative fixture rows.

The route is for review only. It does not decide review outcomes, approve
candidates, apply patches, create worktrees, write source files, append
persistent ledgers, write repositories, call connectors, deploy, or grant
production/enterprise trust.

Supported filters include `review_docket_id`, `review_status`,
`candidate_packet_id`, `product_id`, `candidate_manifest_id`,
`preflight_status`, `next_allowed_action`, and `limit`.

Routes: `/api/factory/candidate-review-docket`.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`. If the underlying candidate review docket fails validation,
the route returns `503 factory_candidate_review_docket_unavailable`.

Hash-register rows in a filtered response are a visibility subset for the
returned candidate packets. Full chain verification uses the unfiltered route
response or the canonical FC.3 docket artifact. Unexpected build exceptions are
fail-closed and follow the same process-level handling pattern as the sibling
factory routes; blocked validation results return the documented `503` envelope.

## G0 Factory Gate Opening Readiness Routes

Factory Gate Opening Readiness routes expose the read-only G-series gate matrix.
The route returns one row each for G1a, G1b, G2, and G3, plus prerequisite,
deferred-gate, negative-fixture, boundary, and summary data.

The route is for readiness and audit only. It does not create projects, write
repositories, execute commands, deploy, call connectors, approve protected
actions, grant production PASS, grant enterprise PASS, or mark Factory
Promotion complete.

Supported filters include `gate_id`, `gate_name`, `authority_flag`,
`ps_transition`, `prerequisite_status`, `previous_gate_status`, `gate_status`,
`gate_open_now`, `owner_gate_opening_receipt_present`,
`source_literal_gate_open_commit_present`, and `limit`.

Routes: `/api/factory/gate-opening-readiness`.

`GET /api/factory/g1a-opening-packet` returns the packet-only G1a opening
preparation surface: owner receipt template, source-literal opening commit
plan, Law Firm OS-style independent review packet, first-use audit checklist,
negative fixtures, boundary, and summary data.

Supported filters include `packet_item_id`, `item_kind`, `item_status`,
`gate_id`, `authority_flag`, and `limit`.

Routes: `/api/factory/g1a-opening-packet`.

`GET /api/factory/g1a-owner-receipt-intake` returns the read-only owner
`gate_opening` receipt intake rows for G1a. The default current state is
`waiting_for_signed_g1a_owner_receipt`; the route does not sign receipts, open
G1a, or allow project creation.

Supported filters include `row_id`, `category`, `current_verdict`, and `limit`.

Routes: `/api/factory/g1a-owner-receipt-intake`.

`GET /api/factory/g1a-source-literal-preflight` returns the read-only source
literal opening preflight rows for G1a. The route exposes a preview-only future
change shape and never edits source, binds a receipt, claims first-use audit, or
opens project creation.

Supported filters include `row_id`, `category`, `current_verdict`, and `limit`.

Routes: `/api/factory/g1a-source-literal-preflight`.

`GET /api/factory/g1a-opening-closeout-readiness` returns the read-only G1a
gate-opening closeout chain rows plus blocker rows. The default state is
`waiting_for_signed_g1a_owner_receipt`; the route does not sign receipts, edit
source, open G1a, claim first-use audit, or grant project creation authority.

Supported filters include `row_id`, `category`, `current_verdict`, and `limit`.

Routes: `/api/factory/g1a-opening-closeout-readiness`.

`GET /api/factory/g1a-first-use-audit-readiness` returns the read-only G1a
first-use audit readiness rows plus blocker rows and a preview-only
`SOURCE_LITERAL_FIRST_USE_AUDITS` source binding. The default state is
`waiting_for_g1a_opening_source_literal_commit`; the route does not perform
first use, edit source, bind an audit, open G1a, or grant project creation
authority.

Supported filters include `row_id`, `category`, `current_verdict`, and `limit`.

Routes: `/api/factory/g1a-first-use-audit-readiness`.

`GET` and `HEAD` are allowed. Mutation methods return `405
method_not_allowed`.

## P511-P515 Platform Claim Registry Routes

Platform Claim Registry routes expose the read-only P500 operations freeze claim
registry for P501-P520 adjudication operators. Supported filters include
`platform_operations_freeze_status`, `source_phase_slot`, `source_phase_number`,
`source_command_name`, `claim_id`, `claim_type`, `claim_status`, `verdict`,
`current_verdict`, `block_reason`, `responsible_owner`,
`human_receipt_required`, `missing_human_receipt`, `protected_claim`,
`operator_surface_claim`, `hard_gate_result`, `boundary_status`, `status`, and
`limit`.

Routes: `/api/platform-operations-freezes`, `/api/platform-claim-registry`,
`/api/platform-claim-gates`, `/api/platform-claim-boundary`,
`/api/platform-claim-validations`.

## P287 API Route Inventory Routes

API Route Inventory routes expose the read-only route inventory artifact, route group rows, route records, checks, boundary, and validation rows. Supported filters include `api_route_inventory_status`, `api_route_group_status`, `api_route_status`, `api_route_group_key`, `route_group_key`, `route_method`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/api-route-inventories`, `/api/api-route-groups`, `/api/api-route-records`, `/api/api-route-inventory-checks`, `/api/api-route-inventory-boundary`, `/api/api-route-inventory-validations`.

## P288 Review Dashboard Information Architecture Routes

Review Dashboard Information Architecture routes expose the read-only dashboard IA artifact, section rows, navigation items, route bindings, checks, boundary, and validation rows. Supported filters include `dashboard_ia_status`, `ia_section_status`, `ia_section_key`, `navigation_item_status`, `route_binding_status`, `route_method`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/review-dashboard-information-architectures`, `/api/review-dashboard-ia-sections`, `/api/review-dashboard-navigation-items`, `/api/review-dashboard-ia-route-bindings`, `/api/review-dashboard-ia-checks`, `/api/review-dashboard-ia-boundary`, `/api/review-dashboard-ia-validations`.

## P289 Approval Queue UI Routes

Approval Queue UI routes expose the read-only approval queue panel artifact, panel rows, pending approval UI items, target artifact lookup rows, receipt draft previews, protected request previews, checks, boundary, and validation rows. Supported filters include `approval_queue_ui_status`, `approval_queue_ui_panel_status`, `approval_queue_ui_item_status`, `required_actor`, `source_stage`, `target_artifact_lookup_status`, `receipt_preview_status`, `protected_request_preview_status`, `protected_action`, `pending_approval`, `preview_only`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/approval-queue-ui-artifacts`, `/api/approval-queue-ui-panels`, `/api/approval-queue-ui-items`, `/api/approval-queue-target-artifacts`, `/api/approval-queue-receipt-previews`, `/api/approval-queue-protected-request-previews`, `/api/approval-queue-ui-boundary`, `/api/approval-queue-ui-checks`, `/api/approval-queue-ui-validations`.

## P290 Evidence Viewer UI Routes

Evidence Viewer UI routes expose the read-only evidence viewer UI artifact, panel rows, joined evidence cards, source span preview rows, citation rows, coverage rows, flag rows, checks, boundary, and validation rows. Supported filters include `evidence_viewer_ui_status`, `evidence_viewer_ui_panel_status`, `evidence_viewer_ui_card_status`, `source_span_binding_status`, `citation_binding_status`, `card_binding_status`, `coverage_status`, `review_status`, `human_review_required`, `client_facing_ready`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/evidence-viewer-ui-artifacts`, `/api/evidence-viewer-ui-panels`, `/api/evidence-viewer-ui-cards`, `/api/evidence-viewer-ui-source-spans`, `/api/evidence-viewer-ui-citations`, `/api/evidence-viewer-ui-coverage`, `/api/evidence-viewer-ui-flags`, `/api/evidence-viewer-ui-boundary`, `/api/evidence-viewer-ui-checks`, `/api/evidence-viewer-ui-validations`.

## P291 Source Span Inspector Routes

Source Span Inspector routes expose the read-only source span inspector artifact, panel rows, source span comparison rows, location comparisons, normalized text comparisons, extracted fact comparisons, checks, boundary, and validation rows. Supported filters include `source_span_inspector_status`, `source_span_inspector_panel_status`, `source_span_inspector_row_status`, `comparison_status`, `location_comparison_status`, `normalized_text_comparison_status`, `extracted_fact_comparison_status`, `preview_match_status`, `source_span_id`, `normalized_text_id`, `fact_id`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/source-span-inspector-artifacts`, `/api/source-span-inspector-panels`, `/api/source-span-inspector-rows`, `/api/source-span-location-comparisons`, `/api/normalized-text-comparisons`, `/api/extracted-fact-comparisons`, `/api/source-span-inspector-boundary`, `/api/source-span-inspector-checks`, `/api/source-span-inspector-validations`.

## P292 Run Ledger Viewer Routes

Run Ledger Viewer routes expose the read-only run ledger viewer artifact, panel rows, Desktop session rows, workflow progress rows, event-backed history rows, agent activity rows, tool activity rows, log/artifact reference rows, checks, boundary, and validation rows. Supported filters include `run_ledger_viewer_status`, `run_ledger_viewer_panel_status`, `desktop_session_status`, `run_progress_status`, `run_history_status`, `agent_activity_status`, `tool_activity_status`, `log_artifact_view_status`, `workflow_run_id`, `agent_run_id`, `tool_invocation_id`, `runtime_id`, `tool_id`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/run-ledger-viewer-artifacts`, `/api/run-ledger-viewer-panels`, `/api/desktop-session-views`, `/api/run-progress-views`, `/api/run-history-views`, `/api/run-agent-activity-views`, `/api/run-tool-activity-views`, `/api/run-log-artifact-views`, `/api/run-ledger-viewer-boundary`, `/api/run-ledger-viewer-checks`, `/api/run-ledger-viewer-validations`.

## P293 Matter Cockpit UI Routes

Matter Cockpit UI routes expose the read-only matter cockpit UI artifact, panel rows, profile cards, timeline rows, task rows, document rows, evidence rows, approval rows, checks, boundary, and validation rows. Supported filters include `matter_cockpit_ui_status`, `matter_cockpit_ui_panel_status`, `profile_card_status`, `timeline_row_status`, `task_row_status`, `document_row_status`, `evidence_row_status`, `approval_row_status`, `matter_id`, `tenant_id`, `task_column`, `task_due_status`, `document_status`, `item_status`, `priority`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/matter-cockpit-ui-artifacts`, `/api/matter-cockpit-ui-panels`, `/api/matter-cockpit-profile-cards`, `/api/matter-cockpit-timeline-rows`, `/api/matter-cockpit-task-rows`, `/api/matter-cockpit-document-rows`, `/api/matter-cockpit-evidence-rows`, `/api/matter-cockpit-approval-rows`, `/api/matter-cockpit-ui-boundary`, `/api/matter-cockpit-ui-checks`, `/api/matter-cockpit-ui-validations`.

## P294 Policy Violation Queue Routes

Policy Violation Queue routes expose the read-only policy violation queue artifact, panel rows, queue item rows, actor action rows, checks, boundary, and validation rows. Supported filters include `policy_violation_queue_status`, `policy_violation_queue_panel_status`, `queue_item_status`, `queue_item_type`, `policy_family`, `policy_layer`, `actor_action_status`, `actor_action_type`, `required_actor`, `severity`, `decision`, `gate_status`, `matter_id`, `tenant_id`, `runtime_id`, `classification`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/policy-violation-queue-artifacts`, `/api/policy-violation-queue-panels`, `/api/policy-violation-queue-items`, `/api/policy-violation-actor-actions`, `/api/policy-violation-queue-boundary`, `/api/policy-violation-queue-checks`, `/api/policy-violation-queue-validations`.

## P295 Cost/Observability Dashboard Routes

Cost/Observability Dashboard routes expose the read-only cost observability dashboard artifact, panel rows, cost rows, token rows, latency rows, error rows, retry rows, provider/runtime rollup rows, checks, boundary, and validation rows. Supported filters include `cost_observability_dashboard_status`, `cost_observability_panel_status`, `cost_row_status`, `cost_row_type`, `token_row_status`, `latency_row_status`, `error_row_status`, `retry_row_status`, `provider_runtime_rollup_status`, `cost_category`, `rollup_type`, `runtime_id`, `workflow_run_id`, `domain_pack`, `matter_id`, `error_kind`, `retry_state`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/cost-observability-dashboards`, `/api/cost-observability-panels`, `/api/cost-observability-cost-rows`, `/api/cost-observability-token-rows`, `/api/cost-observability-latency-rows`, `/api/cost-observability-error-rows`, `/api/cost-observability-retry-rows`, `/api/cost-observability-runtime-rollups`, `/api/cost-observability-boundary`, `/api/cost-observability-checks`, `/api/cost-observability-validations`.

## P296 Dashboard/API Freeze Routes

Dashboard/API Freeze routes expose the read-only freeze artifact, source status rows, Desktop-ready API contract, route probe rows, route fixture rows, checks, boundary, and validation rows. Supported filters include `dashboard_api_freeze_status`, `dashboard_api_freeze_source_status`, `desktop_ready_api_contract_status`, `route_probe_status`, `route_fixture_status`, `route_group_key`, `method`, `path`, `read_only`, `preview_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/dashboard-api-freezes`, `/api/dashboard-api-freeze-sources`, `/api/desktop-ready-api-contracts`, `/api/dashboard-api-freeze-route-probes`, `/api/dashboard-api-freeze-route-fixtures`, `/api/dashboard-api-freeze-boundary`, `/api/dashboard-api-freeze-checks`, `/api/dashboard-api-freeze-validations`.

## P297 Threat Model Refresh Routes

Threat Model Refresh routes expose the read-only threat model artifact, source rows, risk rows, control rows, evidence rows, boundary, checks, and validation rows. Supported filters include `threat_model_refresh_status`, `threat_model_source_status`, `risk_category`, `risk_status`, `mitigation_status`, `residual_risk_status`, `control_status`, `evidence_status`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/threat-model-refreshes`, `/api/threat-model-sources`, `/api/threat-model-risks`, `/api/threat-model-controls`, `/api/threat-model-evidence`, `/api/threat-model-boundary`, `/api/threat-model-checks`, `/api/threat-model-validations`.

## P298 Prompt Injection Test Suite Routes

Prompt Injection Test Suite routes expose the read-only synthetic external-document instruction fixtures, test results, instruction promotion checks, boundary, and validation rows. Supported filters include `prompt_injection_test_suite_status`, `fixture_group`, `external_surface`, `test_case_status`, `promotion_check_status`, `check_kind`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/prompt-injection-test-suites`, `/api/prompt-injection-test-fixtures`, `/api/prompt-injection-test-results`, `/api/prompt-injection-promotion-checks`, `/api/prompt-injection-test-boundary`, `/api/prompt-injection-test-validations`.

## P299 External Model Policy Audit Routes

External Model Policy Audit routes expose the read-only audit artifact, classification audit rows, policy snapshot audit rows, model route audit rows, Desktop provider/model audit rows, boundary, and validation rows. Supported filters include `external_model_policy_audit_status`, `audit_status`, `classification`, `policy_snapshot_id`, `provider_transmission_policy`, `snapshot_comparison_status`, `route_policy_status`, `external_transfer`, `provider_boundary`, `desktop_provider_key_visible`, `desktop_external_model_execution_allowed`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/external-model-policy-audits`, `/api/external-model-classification-audits`, `/api/external-model-policy-snapshot-audits`, `/api/external-model-route-audits`, `/api/desktop-provider-model-audits`, `/api/external-model-policy-audit-boundary`, `/api/external-model-policy-audit-validations`.

## P300 Secrets Scan Gate Routes

Secrets Scan Gate routes expose the read-only gate artifact, source status rows, rule result rows, leakage gate result rows, Desktop config leakage checks, boundary, and validation rows. Supported filters include `secrets_scan_gate_status`, `source_status`, `rule_status`, `gate_status`, `check_status`, `leakage_kind`, `leakage_detected`, `gate_fail_on_leakage`, `secret_material_read`, `desktop_config_read`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/secrets-scan-gates`, `/api/secrets-scan-sources`, `/api/secrets-scan-rule-results`, `/api/secrets-scan-gate-results`, `/api/desktop-config-leakage-checks`, `/api/secrets-scan-boundary`, `/api/secrets-scan-validations`.

## P301 Retention Deletion Policy Routes

Retention Deletion Policy routes expose the read-only policy artifact, source status rows, resource/artifact/audit policy rows, deletion hold records, gate result rows, boundary, and validation rows. Supported filters include `retention_deletion_policy_status`, `source_status`, `retention_plane`, `subject_kind`, `deletion_status`, `deletion_allowed`, `deletion_execution_allowed`, `gate_status`, `gate_fail_on_violation`, `policy_report_only`, `records_review_required`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/retention-deletion-policies`, `/api/retention-deletion-sources`, `/api/retention-deletion-policy-rows`, `/api/deletion-hold-records`, `/api/retention-deletion-gate-results`, `/api/retention-deletion-boundary`, `/api/retention-deletion-validations`.

## P302 Access Review Report Routes

Access Review Report routes expose the read-only report artifact, source status rows, tenant/matter/user subject rows, matter access rows, resource access rows, findings, gate result rows, boundary, and validation rows. Supported filters include `access_review_report_status`, `source_status`, `access_review_status`, `access_decision`, `view_status`, `user_id`, `tenant_id`, `matter_id`, `runtime_id`, `gate_status`, `gate_fail_on_violation`, `access_mutation_allowed`, `permission_change_allowed`, `permission_mutation_performed`, `read_only`, `boundary_status`, `status`, and `limit`.

Routes: `/api/access-review-reports`, `/api/access-review-sources`, `/api/access-review-subjects`, `/api/access-review-matter-rows`, `/api/access-review-resource-rows`, `/api/access-review-findings`, `/api/access-review-gate-results`, `/api/access-review-boundary`, `/api/access-review-validations`.

## P303 Performance/Cost Budget Report Routes

Performance/Cost Budget Report routes expose the read-only report artifact, source status rows, performance budget rows, cost budget rows, gate result rows, boundary, and validation rows. Supported filters include `performance_cost_budget_report_status`, `source_status`, `budget_scope`, `budget_kind`, `budget_status`, `budget_report_only`, `budget_mutation_performed`, `cost_mutation_performed`, `runtime_execution_performed`, `metric_write_allowed`, `gate_status`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/performance-cost-budget-reports`, `/api/performance-cost-budget-sources`, `/api/performance-budget-rows`, `/api/cost-budget-rows`, `/api/performance-cost-budget-gate-results`, `/api/performance-cost-budget-boundary`, `/api/performance-cost-budget-validations`.

## P304 Backup/Restore Drill Routes

Backup/Restore Drill routes expose the read-only dry-run report artifact, source status rows, DB/object/artifact/event/audit restore drill rows, source-of-truth rows, gate result rows, boundary, and validation rows. Supported filters include `backup_restore_drill_status`, `source_status`, `restore_plane`, `dry_run_status`, `drill_status`, `restore_execution_allowed`, `restore_execution_performed`, `production_restore_performed`, `canonical_source_of_truth`, `restore_input_allowed`, `desktop_export_import_surface`, `desktop_export_import_source_of_truth`, `source_of_truth_status`, `gate_status`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/backup-restore-drills`, `/api/backup-restore-sources`, `/api/restore-drill-rows`, `/api/backup-restore-source-of-truth-rows`, `/api/backup-restore-gate-results`, `/api/backup-restore-boundary`, `/api/backup-restore-validations`.

## P305 Law Firm E2E Report Routes

Law Firm E2E Report routes expose the read-only P305 scenario report artifact, source status rows, representative scenario rows, matter/resource/evidence/draft/citation/approval/audit chain stage rows, gate result rows, boundary, and validation rows. Supported filters include `law_firm_e2e_report_status`, `source_status`, `scenario_status`, `scenario_kind`, `chain_stage`, `stage_status`, `matter_to_audit_path_complete`, `matter_gate_passed`, `resource_gate_passed`, `evidence_gate_passed`, `draft_gate_passed`, `citation_gate_passed`, `approval_gate_passed`, `audit_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/law-firm-e2e-reports`, `/api/law-firm-e2e-sources`, `/api/law-firm-e2e-scenario-rows`, `/api/law-firm-e2e-chain-stages`, `/api/law-firm-e2e-gate-results`, `/api/law-firm-e2e-report-boundary`, `/api/law-firm-e2e-report-validations`.

## P306 Personal Dev E2E Report Routes

Personal Dev E2E Report routes expose the read-only P306 scenario report artifact, source status rows, representative scenario rows, issue/plan/worktree/diff/test/PR draft/audit chain stage rows, gate result rows, boundary, and validation rows. Supported filters include `personal_dev_e2e_report_status`, `source_status`, `scenario_status`, `scenario_kind`, `chain_stage`, `stage_status`, `issue_to_audit_path_complete`, `issue_gate_passed`, `plan_gate_passed`, `worktree_gate_passed`, `diff_gate_passed`, `test_gate_passed`, `pr_draft_gate_passed`, `audit_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/personal-dev-e2e-reports`, `/api/personal-dev-e2e-report-sources`, `/api/personal-dev-e2e-scenario-rows`, `/api/personal-dev-e2e-chain-stages`, `/api/personal-dev-e2e-gate-results`, `/api/personal-dev-e2e-report-boundary`, `/api/personal-dev-e2e-report-validations`.

## P307 Creative Document E2E Report Routes

Creative Document E2E Report routes expose the read-only P307 scenario report artifact, source status rows, representative scenario rows, template/render/layout/approval/output artifact chain stage rows, gate result rows, boundary, and validation rows. Supported filters include `creative_document_e2e_report_status`, `source_status`, `scenario_status`, `scenario_kind`, `chain_stage`, `stage_status`, `template_to_output_artifact_path_complete`, `template_gate_passed`, `render_gate_passed`, `layout_gate_passed`, `approval_gate_passed`, `output_artifact_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/creative-document-e2e-reports`, `/api/creative-document-e2e-report-sources`, `/api/creative-document-e2e-scenario-rows`, `/api/creative-document-e2e-chain-stages`, `/api/creative-document-e2e-gate-results`, `/api/creative-document-e2e-report-boundary`, `/api/creative-document-e2e-report-validations`.

## P308 Ingestion E2E Report Routes

Ingestion E2E Report routes expose the read-only P308 scenario report artifact, source status rows, representative scenario rows, connector/backfill/quarantine/evidence/dashboard chain stage rows, gate result rows, boundary, and validation rows. Supported filters include `ingestion_e2e_report_status`, `source_status`, `scenario_status`, `scenario_kind`, `chain_stage`, `stage_status`, `connector_to_dashboard_path_complete`, `connector_gate_passed`, `backfill_gate_passed`, `quarantine_gate_passed`, `evidence_gate_passed`, `dashboard_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/ingestion-e2e-reports`, `/api/ingestion-e2e-report-sources`, `/api/ingestion-e2e-scenario-rows`, `/api/ingestion-e2e-chain-stages`, `/api/ingestion-e2e-gate-results`, `/api/ingestion-e2e-report-boundary`, `/api/ingestion-e2e-report-validations`.

## P309 Deployment Runbook Routes

Deployment Runbook routes expose the read-only P309 deployment runbook artifact, source status rows, local/dev/prod-like/Desktop/rollback environment rows, documented command rows, checklist rows, human-gated rollback procedure rows, gate result rows, boundary, and validation rows. Supported filters include `deployment_runbook_status`, `source_status`, `environment_id`, `environment_status`, `command_status`, `command_executed`, `rollback_status`, `deployment_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/deployment-runbooks`, `/api/deployment-runbook-sources`, `/api/deployment-environments`, `/api/deployment-commands`, `/api/deployment-checklists`, `/api/deployment-rollback-procedures`, `/api/deployment-gate-results`, `/api/deployment-runbook-boundary`, `/api/deployment-runbook-validations`.

## P310 Operator Handbook Routes

Operator Handbook routes expose the read-only P310 operator handbook artifact, source status rows, approval/receipt/policy/recovery/Desktop operator surfaces, documented workflows, screen navigation rows, recovery procedure rows, gate rows, boundary, and validation rows. Supported filters include `operator_handbook_status`, `source_status`, `surface_id`, `surface_status`, `workflow_status`, `screen_status`, `recovery_status`, `operator_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/operator-handbooks`, `/api/operator-handbook-sources`, `/api/operator-surfaces`, `/api/operator-workflows`, `/api/operator-screens`, `/api/operator-recovery-procedures`, `/api/operator-gates`, `/api/operator-handbook-boundary`, `/api/operator-handbook-validations`.

## P311 Release Candidate Routes

Release Candidate routes expose the read-only P311 release candidate report artifact, source status rows, validation matrix rows, command checklist rows, gate rows, boundary, and validation rows. Supported filters include `release_candidate_status`, `source_status`, `matrix_id`, `matrix_status`, `command_key`, `command_group`, `release_candidate_command_status`, `release_candidate_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/release-candidate-reports`, `/api/release-candidate-sources`, `/api/release-candidate-matrix`, `/api/release-candidate-commands`, `/api/release-candidate-gates`, `/api/release-candidate-boundary`, `/api/release-candidate-validations`.

## P312 v1 Freeze Routes

v1 Freeze routes expose the read-only P312 Hermes Harness v1.0 freeze artifact, source status rows, checklist rows, gate rows, boundary, and validation rows. Supported filters include `v1_freeze_status`, `source_status`, `v1_freeze_check_status`, `v1_freeze_gate_passed`, `gate_status`, `boundary_status`, `read_only`, `legal_advice_generated`, `client_facing_output_generated`, `status`, and `limit`.

Routes: `/api/v1-freezes`, `/api/v1-freeze-sources`, `/api/v1-freeze-checklist`, `/api/v1-freeze-gates`, `/api/v1-freeze-boundary`, `/api/v1-freeze-validations`.

## P245 LDD RFI Generator Routes

LDD RFI Generator routes expose read-only draft-only RFI packets, draft questions, missing-material links, issue links, matter summaries, and validation/boundary rows. Supported filters include `ldd_rfi_generator_status`, `ldd_rfi_matter_status`, `rfi_rule_type`, `rfi_draft_status`, `rfi_question_type`, `rfi_question_priority`, `rfi_question_status`, `rfi_missing_material_status`, `rfi_issue_link_status`, `deterministic_rfi_generation_performed`, `ldd_rfi_question_id`, `ldd_issue_record_id`, `ldd_vdr_missing_data_record_id`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-rfi-generator-artifacts`, `/api/ldd-rfi-rules`, `/api/ldd-rfi-drafts`, `/api/ldd-rfi-questions`, `/api/ldd-rfi-missing-material-links`, `/api/ldd-rfi-issue-links`, `/api/ldd-rfi-matter-summaries`, `/api/ldd-rfi-generator-boundary`, `/api/ldd-rfi-generator-validations`.

## P246 LDD Report Draft Routes

LDD Report Draft routes expose read-only draft-only report sections, draft paragraphs, citation placeholders, issue links, matter summaries, and validation/boundary rows. Supported filters include `ldd_report_draft_status`, `ldd_report_matter_status`, `section_type`, `section_status`, `paragraph_status`, `paragraph_role`, `citation_placeholder_status`, `currentness_check_status`, `legal_authority_status`, `report_issue_link_status`, `ldd_report_section_id`, `ldd_report_paragraph_id`, `ldd_report_citation_placeholder_id`, `ldd_issue_record_id`, `deterministic_report_draft_generation_performed`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-report-draft-artifacts`, `/api/ldd-report-section-rules`, `/api/ldd-report-sections`, `/api/ldd-report-paragraphs`, `/api/ldd-report-citation-placeholders`, `/api/ldd-report-issue-links`, `/api/ldd-report-matter-summaries`, `/api/ldd-report-draft-boundary`, `/api/ldd-report-draft-validations`.

## P247 Litigation Brief Draft Routes

Litigation Brief Draft routes expose read-only, draft-only litigation brief scaffold rows for claims, sourced facts, evidence links, legal-basis placeholders, citation gate results, matter summaries, and validation/boundary rows. Supported filters include `litigation_brief_draft_status`, `litigation_brief_matter_status`, `brief_rule_type`, `brief_draft_status`, `brief_claim_status`, `brief_fact_status`, `fact_verification_status`, `evidence_link_type`, `brief_evidence_link_status`, `legal_basis_status`, `citation_gate_status`, `citation_gate_passed`, `currentness_check_status`, `legal_authority_status`, `court_filing_ready`, `deterministic_brief_draft_generation_performed`, `litigation_brief_claim_id`, `litigation_brief_fact_id`, `litigation_brief_evidence_link_id`, `litigation_brief_legal_basis_placeholder_id`, `litigation_brief_citation_gate_result_id`, `claim_id`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/litigation-brief-draft-artifacts`, `/api/litigation-brief-rules`, `/api/litigation-brief-drafts`, `/api/litigation-brief-claims`, `/api/litigation-brief-facts`, `/api/litigation-brief-evidence-links`, `/api/litigation-brief-legal-basis-placeholders`, `/api/litigation-brief-citation-gates`, `/api/litigation-brief-matter-summaries`, `/api/litigation-brief-draft-boundary`, `/api/litigation-brief-draft-validations`.

## P248 Meeting Minutes Workflow Routes

Meeting Minutes Workflow routes expose read-only agenda, operational decision, draft action item, evidence link, matter summary, and validation/boundary rows generated from local meeting notes and matter meeting context. Supported filters include `meeting_minutes_workflow_status`, `meeting_minutes_matter_status`, `meeting_minutes_rule_type`, `meeting_minutes_source_status`, `source_kind`, `source_type`, `agenda_status`, `agenda_type`, `decision_status`, `decision_type`, `action_status`, `action_owner`, `evidence_required`, `evidence_source_kind`, `evidence_link_status`, `meeting_minutes_source_id`, `meeting_minutes_agenda_item_id`, `meeting_minutes_decision_id`, `meeting_minutes_action_item_id`, `meeting_minutes_evidence_link_id`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/meeting-minutes-workflow-artifacts`, `/api/meeting-minutes-rules`, `/api/meeting-minutes-sources`, `/api/meeting-minutes-agenda-items`, `/api/meeting-minutes-decisions`, `/api/meeting-minutes-action-items`, `/api/meeting-minutes-evidence-links`, `/api/meeting-minutes-matter-summaries`, `/api/meeting-minutes-workflow-boundary`, `/api/meeting-minutes-workflow-validations`.

## P249 Contract Draft Workflow Routes

Contract Draft Workflow routes expose read-only, draft-only contract clause scaffolds, captured client positions, consistency checks, attorney review gates, source issue links, matter summaries, and validation/boundary rows. Supported filters include `contract_draft_workflow_status`, `contract_draft_matter_status`, `contract_draft_rule_type`, `draft_packet_status`, `clause_draft_status`, `clause_type`, `client_position_status`, `consistency_check_status`, `clause_consistency_passed`, `review_gate_status`, `contract_issue_link_status`, `contract_delivery_ready`, `deterministic_contract_draft_generation_performed`, `contract_clause_draft_id`, `contract_client_position_id`, `contract_clause_consistency_check_id`, `contract_attorney_review_gate_id`, `contract_draft_issue_link_id`, `negotiation_point_id`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/contract-draft-workflow-artifacts`, `/api/contract-draft-rules`, `/api/contract-draft-packets`, `/api/contract-clause-drafts`, `/api/contract-client-positions`, `/api/contract-clause-consistency-checks`, `/api/contract-attorney-review-gates`, `/api/contract-draft-issue-links`, `/api/contract-draft-matter-summaries`, `/api/contract-draft-workflow-boundary`, `/api/contract-draft-workflow-validations`.

## P250 Provided Material Review Routes

Provided Material Review routes expose read-only material review rows, index-status bindings, missing/requested material gap links, attorney review gates, matter summaries, and validation/boundary rows. Supported filters include `provided_material_review_status`, `provided_material_matter_status`, `provided_material_review_rule_type`, `material_review_status`, `index_binding_status`, `index_status`, `gap_link_status`, `absence_not_factual_nonexistence`, `review_gate_status`, `final_review_decision_recorded`, `provided_material_review_item_id`, `provided_material_index_status_id`, `provided_material_gap_link_id`, `provided_material_review_gate_id`, `source_document_id`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/provided-material-review-artifacts`, `/api/provided-material-review-rules`, `/api/provided-material-review-items`, `/api/provided-material-index-statuses`, `/api/provided-material-gap-links`, `/api/provided-material-review-gates`, `/api/provided-material-matter-summaries`, `/api/provided-material-review-boundary`, `/api/provided-material-review-validations`.

## P244 LDD Issue Detection Routes

LDD Issue Detection routes expose read-only deterministic issue candidate rows, red/yellow operational flags, follow-up rows, severity summaries, matter summaries, and validation/boundary rows. Supported filters include `ldd_issue_detection_status`, `ldd_issue_matter_status`, `issue_type`, `issue_status`, `issue_severity`, `issue_flag`, `source_gap`, `follow_up_status`, `follow_up_owner`, `deterministic_issue_detection_performed`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-issue-detection-artifacts`, `/api/ldd-issue-detection-rules`, `/api/ldd-issue-records`, `/api/ldd-issue-follow-ups`, `/api/ldd-issue-severity-summaries`, `/api/ldd-issue-matter-summaries`, `/api/ldd-issue-detection-boundary`, `/api/ldd-issue-detection-validations`.

## P243 LDD Fact Extraction Routes

LDD Fact Extraction routes expose read-only deterministic candidate fact rows, source-gap rows, source bindings, type summaries, matter summaries, and validation/boundary rows. Supported filters include `ldd_fact_extraction_status`, `ldd_fact_matter_status`, `fact_type`, `fact_status`, `fact_confidence`, `source_gap`, `deterministic_fact_extraction_performed`, `external_extractor_execution_performed`, `source_selected_extractor_id`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-fact-extraction-artifacts`, `/api/ldd-fact-extraction-rules`, `/api/ldd-fact-records`, `/api/ldd-fact-source-bindings`, `/api/ldd-fact-type-summaries`, `/api/ldd-fact-matter-summaries`, `/api/ldd-fact-extraction-boundary`, `/api/ldd-fact-extraction-validations`.

## P242 LDD Extractor Selection Routes

LDD Extractor Selection routes expose read-only extractor registry rows, document-level extractor selection rows, rationale rows, matter summaries, and validation/boundary rows. Supported filters include `ldd_extractor_selection_status`, `ldd_extractor_matter_status`, `extractor_id`, `selected_extractor_id`, `extractor_kind`, `extractor_selection_status`, `selection_status`, `rationale_status`, `primary_document_class`, `source_row_kind`, `extractor_execution_performed`, `extraction_result_generated`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-extractor-selection-artifacts`, `/api/ldd-extractor-registry`, `/api/ldd-extractor-selection-records`, `/api/ldd-extractor-selection-rationales`, `/api/ldd-extractor-matter-summaries`, `/api/ldd-extractor-selection-boundary`, `/api/ldd-extractor-selection-validations`.

## P241 LDD Document Classification Routes

LDD Document Classification routes expose read-only document class rules, classification rows, class summaries, matter summaries, and validation/boundary rows. Supported filters include `ldd_document_classification_status`, `ldd_document_matter_classification_status`, `document_class`, `primary_document_class`, `classification_status`, `classification_confidence`, `source_row_kind`, `matter_id`, `classification`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-document-classification-artifacts`, `/api/ldd-document-classification-rules`, `/api/ldd-document-classification-records`, `/api/ldd-document-class-summaries`, `/api/ldd-document-matter-class-summaries`, `/api/ldd-document-classification-boundary`, `/api/ldd-document-classification-validations`.

## P240 LDD VDR Inventory Routes

LDD VDR Inventory routes expose read-only batch, folder, file, version, missing-data, and matter summary rows for diligence VDR review. Supported filters include `ldd_vdr_inventory_status`, `ldd_vdr_matter_status`, `batch_status`, `folder_status`, `inventory_file_status`, `version_status`, `missing_data_status`, `rfi_candidate`, `resource_version_ledger_bound`, `matter_id`, `classification`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/ldd-vdr-inventory-artifacts`, `/api/ldd-vdr-batches`, `/api/ldd-vdr-folders`, `/api/ldd-vdr-files`, `/api/ldd-vdr-versions`, `/api/ldd-vdr-missing-data`, `/api/ldd-vdr-matter-summaries`, `/api/ldd-vdr-inventory-boundary`, `/api/ldd-vdr-inventory-validations`.

## P239 Legal Citation Verifier Routes

Legal Citation Verifier routes expose read-only source and currentness review gates for citation objects. Supported filters include `legal_citation_verifier_status`, `legal_citation_matter_status`, `citation_kind`, `authority_type`, `source_check_status`, `currentness_check_status`, `legal_authority_status`, `legal_rule_binding_status`, `verification_status`, `review_status`, `source_bound`, `currentness_gate_applied`, `currentness_verified`, `attorney_currentness_review_required`, `external_legal_research_performed`, `legal_authority_finalized`, `matter_id`, `classification`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/legal-citation-verifier-artifacts`, `/api/legal-citation-verification-records`, `/api/legal-citation-source-checks`, `/api/legal-citation-currentness-checks`, `/api/legal-citation-matter-summaries`, `/api/legal-citation-verifier-boundary`, `/api/legal-citation-verifier-validations`.

## P238 Matter Personal Data Detector Routes

Matter Personal Data Detector routes expose read-only candidate personal data detections and their policy/quarantine bindings. Supported filters include `matter_personal_data_detector_status`, `matter_personal_data_status`, `personal_data_flag`, `personal_data_detection_status`, `personal_data_category`, `primary_personal_data_category`, `sensitive_personal_data`, `policy_binding_status`, `policy_classification`, `quarantine_binding_status`, `quarantine_category`, `quarantine_action`, `quarantine_applied`, `matter_id`, `boundary_status`, `read_only`, `status`, and `limit`.

Routes: `/api/matter-personal-data-detector-artifacts`, `/api/personal-data-detection-records`, `/api/personal-data-policy-links`, `/api/personal-data-quarantine-links`, `/api/matter-personal-data-summaries`, `/api/matter-personal-data-detector-boundary`, `/api/matter-personal-data-detector-validations`.

## P237 Matter Privilege Classifier Routes

Matter Privilege Classifier route는 `matter_privilege_classifier_status`, `matter_privilege_status`, `privilege_flag`, `work_product_flag`, `confidentiality_flag`, `external_transfer_flag`, `classification_status`, `flag_type`, `flag_value`, `final_privilege_determination`, `matter_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/matter-privilege-classifier-artifacts`, `/api/privilege-classification-records`, `/api/privilege-evidence-flags`, `/api/matter-privilege-summaries`, `/api/matter-privilege-classifier-boundary`, `/api/matter-privilege-classifier-validations`는 candidate privilege/work-product/confidentiality/external-transfer flag를 read-only로 노출하며, final privilege determination, legal advice, client-facing output generation, matter data writes, task state writes, workflow transition, runtime execution, delivery execution은 수행하지 않는다.

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
- `GET /api/policy-golden-fixtures`: policy golden fixture set artifact
- `GET /api/policy-fixture-cases`: allow/review/deny 대표 policy case
- `GET /api/policy-outcome-matrix`: fixture group별 outcome matrix
- `GET /api/policy-regression-hashes`: locked policy regression hash
- `GET /api/policy-golden-fixture-validations`: policy golden fixture validation item
- `GET /api/policy-operation-surfaces`: policy operations surface artifact
- `GET /api/policy-decision-rows`: unified policy decision rows
- `GET /api/policy-violation-rows`: unified policy violation rows
- `GET /api/policy-pending-approvals`: unified pending policy approval rows
- `GET /api/policy-surface-validations`: policy operations surface validation rows
- `GET /api/matter-boundary-slices`: matter boundary vertical slice artifact
- `GET /api/matter-boundary-resource-paths`: resource ingest부터 retrieval gate까지의 resource boundary path rows
- `GET /api/matter-boundary-retrieval-gates`: store filter와 negative probe를 포함한 retrieval gate checks
- `GET /api/matter-boundary-validations`: matter boundary slice validation rows
- `GET /api/identity-policy-matter-freezes`: identity/policy/matter freeze artifact
- `GET /api/identity-policy-freeze-sources`: P113-P131 freeze source status rows
- `GET /api/identity-policy-freeze-checkpoints`: freeze checkpoint rows
- `GET /api/identity-policy-freeze-validations`: freeze validation rows
- `GET /api/resource-store-interfaces`: resource store interface artifact
- `GET /api/resource-store-records`: Resource v2에서 projection된 resource store records
- `GET /api/resource-version-store-records`: ResourceVersion v2에서 projection된 version store records
- `GET /api/resource-store-adapter-bindings`: registry, ingestion, dashboard adapter binding rows
- `GET /api/resource-store-validations`: resource store interface validation rows
- `GET /api/immutable-object-store-layouts`: immutable object store layout artifact
- `GET /api/object-path-resolvers`: raw source/generated output path resolver rows
- `GET /api/raw-source-object-paths`: raw source namespace object key rows
- `GET /api/generated-output-object-paths`: generated output namespace object key rows
- `GET /api/object-store-collisions`: object key collision rows
- `GET /api/object-store-layout-validations`: immutable object store layout validation rows
- `GET /api/resource-version-ledgers`: resource version ledger artifact
- `GET /api/resource-version-families`: source system/external id별 version family rows
- `GET /api/resource-version-events`: version recorded, changed, duplicate event rows
- `GET /api/resource-version-transitions`: 같은 external id 안의 version transition rows
- `GET /api/resource-duplicate-candidates`: skipped duplicate candidate rows
- `GET /api/resource-version-object-bindings`: ResourceVersion과 raw-source object path binding rows
- `GET /api/resource-version-ledger-validations`: resource version ledger validation rows
- `GET /api/resource-dedup-hash-ledgers`: resource dedup/hash ledger artifact
- `GET /api/resource-hash-groups`: content hash 기준 resource/version group rows
- `GET /api/resource-external-id-groups`: source system/external id 기준 version family rows
- `GET /api/resource-dedup-decisions`: content hash, external id, resource version 기준 dedup classification decisions
- `GET /api/resource-duplicate-candidate-links`: duplicate candidate와 hash/version family link rows
- `GET /api/resource-hash-integrity-checks`: resource 및 resource version sha256 integrity check rows
- `GET /api/resource-dedup-hash-validations`: resource dedup/hash validation rows
- `GET /api/resource-quarantine-models`: resource quarantine model artifact
- `GET /api/resource-quarantine-rules`: 민감/오류/암호화 또는 materialization/대용량/불명확/duplicate hold rule rows
- `GET /api/resource-quarantine-items`: retrieval/external transfer/output delivery가 차단된 held resource rows
- `GET /api/resource-quarantine-review-queue`: quarantine release/correction을 위한 pending human review rows
- `GET /api/resource-quarantine-validations`: resource quarantine validation rows
- `GET /api/normalized-text-contracts`: normalized text contract artifact
- `GET /api/normalized-text-artifacts`: source-span-ready normalized text artifact rows
- `GET /api/normalized-text-location-maps`: page/paragraph/line/char offset maps
- `GET /api/normalized-source-span-seeds`: normalized text에서 생성된 source span seed rows
- `GET /api/normalized-text-validations`: normalized text contract validation rows
- `GET /api/extractor-adapter-contracts`: extractor adapter contract artifact
- `GET /api/extractor-adapters`: registered local parser/OCR adapter rows
- `GET /api/extractor-io-contracts`: shared extractor input/output contract rows
- `GET /api/extractor-document-type-bindings`: document type to extractor adapter bindings
- `GET /api/ocr-fallback-policies`: local/manual OCR fallback policy rows
- `GET /api/extractor-normalized-text-bindings`: P136 normalized text to extractor adapter bindings
- `GET /api/extractor-adapter-validations`: extractor adapter contract validation rows
- `GET /api/source-span-stores`: source span store artifact
- `GET /api/source-spans`: materialized whole-document/page/paragraph/line/char-range source span rows
- `GET /api/source-span-locators`: source span locator rows with page, paragraph, line, char offset, and timestamp status
- `GET /api/source-span-location-units`: normalized location unit rows used by evidence extraction
- `GET /api/source-span-indexes`: source span index rollups by resource, normalized text, location type, and extractor
- `GET /api/source-span-validations`: source span store validation rows
- `GET /api/evidence-item-stores`: evidence item store artifact
- `GET /api/evidence-items`: source-span-derived evidence item rows
- `GET /api/evidence-source-span-bindings`: evidence item to source span binding rows
- `GET /api/evidence-review-queue`: machine-extracted evidence review queue rows
- `GET /api/evidence-item-indexes`: evidence item rollups by matter, classification, review status, evidence type, and location type
- `GET /api/evidence-item-store-validations`: evidence item store validation rows
- `GET /api/evidence-golden-fixtures`: evidence golden fixture artifact
- `GET /api/evidence-golden-cases`: LDD, meeting minutes, contract, and client email extraction golden cases
- `GET /api/evidence-golden-store-matches`: golden case to Evidence Item Store match rows
- `GET /api/evidence-regression-tests`: evidence regression test artifact
- `GET /api/evidence-regression-suites`: extractor, lineage, and coverage regression suite rows
- `GET /api/evidence-regression-test-cases`: deterministic evidence regression case rows
- `GET /api/evidence-regression-hashes`: locked evidence regression hash rows
- `GET /api/evidence-regression-validations`: evidence regression validation rows
- `GET /api/resource-evidence-dashboard-summaries`: resource/evidence dashboard summary artifact
- `GET /api/resource-evidence-panel-rows`: ingest, store, quarantine, evidence, viewer, coverage, export, regression panel rows
- `GET /api/resource-evidence-matter-rollups`: matter별 resource/evidence/quarantine/coverage/export rollup rows
- `GET /api/resource-evidence-classification-rollups`: classification별 resource/evidence/quarantine/coverage/export rollup rows
- `GET /api/resource-evidence-dashboard-validations`: resource/evidence dashboard validation rows
- `GET /api/evidence-plane-freezes`: Evidence Plane freeze artifact
- `GET /api/evidence-plane-freeze-sources`: freeze source status rows for P133-P157 and representative support artifacts
- `GET /api/evidence-plane-freeze-checkpoints`: Evidence Plane freeze checkpoint rows
- `GET /api/evidence-plane-representative-traces`: representative resource-to-evidence-to-output-to-audit trace rows
- `GET /api/evidence-plane-freeze-validations`: Evidence Plane freeze validation rows
- `GET /api/evidence-golden-validations`: evidence golden fixture validation rows
- `GET /api/fact-claim-stores`: fact claim store artifact
- `GET /api/fact-claims`: evidence-derived fact claim rows
- `GET /api/fact-evidence-bindings`: fact claim to evidence item binding rows
- `GET /api/fact-review-queue`: machine-extracted fact review queue rows
- `GET /api/fact-claim-indexes`: fact claim rollups by matter, classification, review status, fact type, reliability, and binding status
- `GET /api/fact-claim-store-validations`: fact claim store validation rows
- `GET /api/issue-graph-stores`: issue graph store artifact
- `GET /api/issues`: fact-derived issue candidate rows
- `GET /api/fact-issue-bindings`: fact claim to issue binding rows
- `GET /api/legal-rules`: attorney-confirmation legal rule placeholder rows
- `GET /api/issue-legal-rule-bindings`: issue to legal rule binding rows
- `GET /api/risk-severity-assessments`: issue risk severity assessment rows
- `GET /api/issue-review-queue`: machine-extracted issue review queue rows
- `GET /api/issue-graph-indexes`: issue graph rollups by matter, classification, issue type, severity, review status, and binding status
- `GET /api/issue-graph-store-validations`: issue graph store validation rows
- `GET /api/citation-object-stores`: citation object store artifact
- `GET /api/output-paragraphs`: review-pending output paragraph candidates
- `GET /api/citations`: citation objects binding output paragraphs to source spans
- `GET /api/paragraph-source-bindings`: output paragraph to source span binding rows
- `GET /api/citation-review-queue`: machine-bound citation review queue rows
- `GET /api/citation-indexes`: citation object store rollups by matter, classification, review status, source binding status, and client-facing readiness
- `GET /api/citation-object-store-validations`: citation object store validation rows
- `GET /api/context-packet-ledgers`: context packet ledger artifact
- `GET /api/context-packets`: runtime별 context packet
- `GET /api/context-items`: packet에 포함된 context item
- `GET /api/context-retrieval-filters`: packet별 matter/classification retrieval filter
- `GET /api/retrieval-filter-compilers`: compiled retrieval filter compiler artifact
- `GET /api/compiled-retrieval-filters`: search/vector query 전 강제되는 tenant/matter/classification/policy/wall/access audit filter
- `GET /api/retrieval-query-bindings`: embedding route policy별 held query binding
- `GET /api/retrieval-filter-probes`: unscoped/cross-matter/missing-filter blocked probe
- `GET /api/retrieval-filter-validations`: retrieval filter compiler validation rows
- `GET /api/model-routing-ledgers`: model routing ledger artifact
- `GET /api/model-routing-decisions`: runtime/model/provider boundary별 routing decision
- `GET /api/cost-budget-ledgers`: cost budget ledger artifact
- `GET /api/cost-budget-decisions`: routing decision별 cost budget gate decision
- `GET /api/token-usage-ledgers`: token usage ledger artifact
- `GET /api/token-usage-records`: routing decision별 recorded/estimated token usage
- `GET /api/cost-attribution-ledgers`: cost attribution ledger artifact
- `GET /api/cost-attribution-records`: matter/runtime/capability별 projected cost attribution
- `GET /api/cost-record-projections`: provider/runtime/storage/API 비용 projection artifact
- `GET /api/projected-cost-records`: run에 귀속된 projected cost record
- `GET /api/run-cost-rollups`: workflow/run별 비용 rollup
- `GET /api/cost-category-rollups`: provider/runtime/storage/API category rollup
- `GET /api/cost-record-projection-validations`: cost record projection validation row
- `GET /api/token-usage-projections`: input/output/cache token projection artifact
- `GET /api/projected-token-usage-records`: provider cost record와 bound된 projected token usage record
- `GET /api/capability-token-rollups`: capability별 token usage rollup
- `GET /api/runtime-token-rollups`: runtime별 token usage rollup
- `GET /api/capability-runtime-token-rollups`: capability/runtime 조합 token usage rollup
- `GET /api/token-usage-projection-validations`: token usage projection validation row
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
- `GET /api/human-review-cycle-target-audits`: work order target audit artifact
- `GET /api/human-review-cycle-target-audit-items`: work order target receipt file/row audit item
- `GET /api/human-review-actor-target-audits`: required actor별 target audit
- `GET /api/human-review-cycle-triage-inboxes`: human review cycle triage inbox artifact
- `GET /api/human-review-cycle-triage-items`: actor-ready triage item
- `GET /api/human-review-actor-triage-inboxes`: required actor별 triage inbox
- `GET /api/human-review-cycle-reviewer-consoles`: reviewer console artifact
- `GET /api/human-review-cycle-console-items`: reviewer console item
- `GET /api/human-review-actor-consoles`: required actor별 reviewer console
- `GET /api/human-review-cycle-field-audits`: receipt field audit artifact
- `GET /api/human-review-cycle-field-audit-items`: required receipt field completion audit item
- `GET /api/human-review-actor-field-audits`: required actor별 receipt field audit
- `GET /api/human-review-cycle-completion-packs`: receipt completion pack artifact
- `GET /api/human-review-cycle-completion-items`: manual receipt completion template item
- `GET /api/human-review-actor-completion-packs`: required actor별 receipt completion pack
- `GET /api/human-review-cycle-completion-verifications`: receipt completion verification artifact
- `GET /api/human-review-cycle-completion-verification-items`: manual receipt completion verification item
- `GET /api/human-review-actor-completion-verifications`: required actor별 receipt completion verification
- `GET /api/human-review-cycle-completion-workbenches`: receipt completion workbench artifact
- `GET /api/human-review-cycle-completion-workbench-items`: manual receipt completion workbench item
- `GET /api/human-review-actor-completion-workbenches`: required actor별 receipt completion workbench
- `GET /api/human-review-cycle-completion-runbooks`: receipt completion runbook artifact
- `GET /api/human-review-cycle-completion-runbook-steps`: manual/command receipt completion runbook step
- `GET /api/human-review-actor-completion-runbooks`: required actor별 receipt completion runbook
- `GET /api/human-review-cycle-completion-readiness`: receipt completion readiness artifact
- `GET /api/human-review-cycle-completion-command-gates`: receipt completion command readiness gate
- `GET /api/human-review-actor-completion-readiness`: required actor별 receipt completion readiness
- `GET /api/human-review-cycle-completion-command-queues`: receipt completion command queue artifact
- `GET /api/human-review-cycle-completion-command-queue-items`: 즉시 수동 실행 가능한 receipt completion command
- `GET /api/human-review-cycle-completion-held-commands`: manual input 또는 explicit approval 전 보류된 command
- `GET /api/human-review-actor-completion-command-queues`: required actor별 receipt completion command queue
- `GET /api/human-review-cycle-completion-command-receipts`: receipt completion command receipt draft artifact
- `GET /api/human-review-cycle-completion-command-receipt-requirements`: receipt completion command별 required receipt field
- `GET /api/human-review-cycle-completion-command-receipt-drafts`: 사람이 command 실행 후 채울 receipt draft row
- `GET /api/human-review-cycle-completion-held-command-references`: held command reference
- `GET /api/human-review-cycle-completion-command-receipt-validations`: command receipt validation artifact
- `GET /api/human-review-cycle-completion-command-receipt-validation-items`: command receipt validation item
- `GET /api/human-review-cycle-completion-command-receipt-errors`: command receipt validation error
- `GET /api/validated-human-review-cycle-completion-command-receipts`: 검증 완료 command-run receipt
- `GET /api/human-review-cycle-completion-command-receipt-feedbacks`: command receipt feedback artifact
- `GET /api/human-review-cycle-completion-command-receipt-feedback-items`: actor에게 전달할 command receipt feedback item
- `GET /api/human-review-cycle-completion-command-receipt-actor-feedback`: required actor별 command receipt feedback bundle
- `GET /api/human-review-cycle-completion-command-receipt-workspaces`: command receipt workspace artifact
- `GET /api/human-review-cycle-completion-command-receipt-workspace-items`: actor별 editable command receipt workspace item
- `GET /api/human-review-cycle-completion-command-receipt-actor-workspaces`: required actor별 command receipt workspace
- `GET /api/human-review-cycle-completion-command-receipt-workspace-merges`: command receipt workspace merge artifact
- `GET /api/human-review-cycle-completion-command-receipt-merge-items`: merged command receipt item
- `GET /api/human-review-cycle-completion-command-receipt-actor-inputs`: merge에 포함된 actor별 command receipt input
- `GET /api/merged-human-review-cycle-completion-command-receipt-input`: 검증용 merged command receipt input
- `GET /api/human-review-cycle-completion-command-receipt-workspace-validations`: merged command receipt validation artifact
- `GET /api/human-review-cycle-completion-command-receipt-workspace-validation-items`: merged command receipt validation item
- `GET /api/human-review-cycle-completion-command-receipt-workspace-validation-errors`: merged command receipt validation 오류
- `GET /api/validated-human-review-cycle-completion-command-workspace-receipts`: 검증 완료 merged command receipt
- `GET /api/human-review-cycle-completion-command-receipt-applications`: command receipt application artifact
- `GET /api/applied-human-review-cycle-completion-command-receipts`: 적용된 command receipt
- `GET /api/human-review-cycle-completion-command-receipt-application-pending-receipts`: application 단계에서 보류 중인 command receipt
- `GET /api/human-review-cycle-completion-command-receipt-application-audit-events`: command receipt application audit event
- `GET /api/human-review-cycle-completion-reconciliations`: receipt completion reconciliation artifact
- `GET /api/human-review-cycle-completion-reconciliation-items`: reconciliation item
- `GET /api/human-review-cycle-completion-reconciliation-actors`: actor별 reconciliation 상태
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
- `GET /api/lineage-graphs`: Lineage Graph Builder artifact
- `GET /api/lineage-nodes`: source/evidence/fact/issue/output lineage node
- `GET /api/lineage-edges`: canonical lineage edge
- `GET /api/lineage-paths`: source-to-output lineage path
- `GET /api/lineage-indexes`: lineage graph index projection
- `GET /api/lineage-graph-validations`: lineage graph validation row
- `GET /api/evidence-viewer-data`: Evidence Viewer Data API artifact
- `GET /api/evidence-viewer-cards`: EvidenceItem, SourceSpan, LineagePath를 결합한 viewer card row
- `GET /api/evidence-viewer-source-spans`: viewer source span panel row
- `GET /api/evidence-viewer-lineage-paths`: viewer lineage path panel row
- `GET /api/evidence-viewer-data-validations`: Evidence Viewer Data API validation row
- `GET /api/evidence-export-bundles`: Evidence Export Bundle artifact
- `GET /api/evidence-export-bundle-records`: source/citation/coverage/exhibit 묶음 row
- `GET /api/evidence-export-source-packages`: export source locator/preview package row
- `GET /api/evidence-export-citation-packages`: export citation/output paragraph package row
- `GET /api/evidence-export-coverage-packages`: export coverage dimension package row
- `GET /api/evidence-export-bundle-validations`: Evidence Export Bundle validation row
- `GET /api/evidence-coverage-scores`: Evidence Coverage Score artifact
- `GET /api/evidence-coverage-records`: per-output coverage score row
- `GET /api/evidence-coverage-dimensions`: claim/date/party/amount/legal-basis dimension row
- `GET /api/evidence-coverage-indexes`: evidence coverage index projection
- `GET /api/evidence-coverage-validations`: evidence coverage validation row
- `GET /api/evidence-flags`: Evidence Flags artifact
- `GET /api/evidence-flag-records`: per-coverage extraction/human/privilege/redaction/external-transfer flag row
- `GET /api/evidence-flag-decisions`: individual evidence flag decision row
- `GET /api/evidence-flag-indexes`: evidence flag index projection
- `GET /api/evidence-flag-validations`: evidence flag validation row
- `GET /api/exhibit-maps`: Exhibit Map artifact
- `GET /api/exhibit-records`: per-evidence exhibit row with Korean reference
- `GET /api/exhibit-bindings`: exhibit-to-evidence/citation/output/lineage binding row
- `GET /api/exhibit-indexes`: exhibit map index projection
- `GET /api/exhibit-map-validations`: exhibit map validation row
- `GET /api/custody-event-ledgers`: Chain of Custody Events artifact
- `GET /api/custody-events`: append-only custody event row
- `GET /api/custody-event-links`: custody event subject link row
- `GET /api/custody-stage-indexes`: custody stage index projection
- `GET /api/custody-event-validations`: custody event validation row
- `GET /api/event-envelope-ledgers`: CloudEvents-style event envelope ledger artifact
- `GET /api/event-envelopes`: EventRecord/AuditEvent에서 projection된 event envelope rows
- `GET /api/event-envelope-source-bindings`: envelope와 원 EventRecord/AuditEvent source binding rows
- `GET /api/event-envelope-validations`: event envelope ledger validation rows
- `GET /api/event-type-registries`: event type registry artifact
- `GET /api/event-types`: event type catalog rows
- `GET /api/event-families`: event family coverage rows
- `GET /api/event-type-bindings`: envelope와 event type binding rows
- `GET /api/event-type-registry-validations`: event type registry validation rows
- `GET /api/append-only-event-stores`: append-only event store artifact
- `GET /api/stored-events`: hash-chained stored event rows
- `GET /api/event-streams`: append-only event stream rows
- `GET /api/event-correction-policies`: append-only correction policy rows
- `GET /api/event-store-validations`: append-only event store validation rows
- `GET /api/event-correlation-ledgers`: event correlation ledger artifact
- `GET /api/correlation-traces`: correlation trace rows
- `GET /api/causation-edges`: causation edge rows
- `GET /api/trace-run-bindings`: trace to RunLedger binding rows
- `GET /api/event-correlation-validations`: event correlation validation rows
- `GET /api/workflow-run-ledgers`: workflow run ledger artifact
- `GET /api/workflow-run-records`: event-backed workflow run records
- `GET /api/workflow-state-transitions`: event-backed workflow state transition rows
- `GET /api/workflow-event-bindings`: workflow run to stored event binding rows
- `GET /api/workflow-run-ledger-validations`: workflow run ledger validation rows
- `GET /api/agent-run-ledgers`: agent run ledger artifact
- `GET /api/agent-run-records`: runtime AgentRun records
- `GET /api/agent-run-io-references`: AgentRun input/output reference rows
- `GET /api/agent-run-artifact-references`: AgentRun artifact reference rows
- `GET /api/agent-run-log-references`: AgentRun log reference rows
- `GET /api/agent-run-event-bindings`: AgentRun event binding rows
- `GET /api/agent-run-ledger-validations`: agent run ledger validation rows
- `GET /api/tool-invocation-ledgers`: tool invocation ledger artifact
- `GET /api/tool-invocation-records`: runtime tool invocation records
- `GET /api/tool-invocation-permission-decisions`: tool invocation permission decision rows
- `GET /api/tool-invocation-agent-bindings`: AgentRun to tool invocation binding rows
- `GET /api/tool-invocation-event-bindings`: tool invocation to AgentRun event context binding rows
- `GET /api/tool-invocation-ledger-validations`: tool invocation ledger validation rows
- `GET /api/audit-event-ledgers`: audit event ledger artifact
- `GET /api/audit-trail-records`: observability log와 분리된 audit trail records
- `GET /api/audit-separation-bindings`: audit plane과 observability plane separation bindings
- `GET /api/audit-source-rollups`: audit source/domain rollup rows
- `GET /api/audit-event-ledger-validations`: audit event ledger validation rows
- `GET /api/retention-archive-ledgers`: retention/archive ledger artifact
- `GET /api/retention-policy-records`: event/audit/output retention policy rows
- `GET /api/archive-candidate-records`: legal-hold-required archive candidate rows
- `GET /api/legal-hold-bindings`: active legal hold binding rows
- `GET /api/retention-archive-validations`: retention/archive validation rows
- `GET /api/ledger-api-dashboards`: run/audit/cost/error/event ledger API/dashboard artifact
- `GET /api/ledger-dashboard-panels`: ledger domain panel rows
- `GET /api/ledger-api-route-records`: Review API route mapping rows for ledger panels
- `GET /api/ledger-panel-metrics`: ledger panel metric rows
- `GET /api/ledger-cross-links`: cross-ledger health link rows
- `GET /api/ledger-api-dashboard-validations`: ledger API/dashboard validation rows
- `GET /api/ledger-golden-fixtures`: ledger golden fixture artifact
- `GET /api/ledger-golden-cases`: replay/projection/cost/audit 대표 fixture case rows
- `GET /api/ledger-fixture-matrix`: fixture group별 source/assertion/regression matrix
- `GET /api/ledger-regression-hashes`: ledger golden fixture regression hash rows
- `GET /api/ledger-golden-validations`: ledger golden fixture validation rows
- `GET /api/observability-freezes`: observability freeze artifact
- `GET /api/observability-freeze-sources`: P159-P175 freeze source status rows
- `GET /api/observability-freeze-checkpoints`: observability freeze checkpoint rows
- `GET /api/observability-freeze-traces`: trace/cost/audit/run representative freeze traces
- `GET /api/observability-freeze-loop-bindings`: control-plane loop binding rows for P159-P175
- `GET /api/observability-freeze-validations`: observability freeze validation rows
- `GET /api/capability-manifest-v2-catalogs`: capability manifest v2 catalog artifact
- `GET /api/capability-manifest-v2-records`: registered capability manifest v2 records
- `GET /api/capability-manifest-field-matrix`: required-field and input/output matrix rows
- `GET /api/capability-manifest-gate-runtime-matrix`: gate/runtime requirement matrix rows
- `GET /api/capability-manifest-policy-index`: data, approval, idempotency, cost, and observability policy rows
- `GET /api/capability-manifest-version-policy-index`: schema/version/source workflow policy rows
- `GET /api/capability-manifest-v2-validations`: capability manifest v2 validation rows
- `GET /api/pack-manifest-compatibility`: pack manifest compatibility artifact
- `GET /api/pack-compatibility-records`: pack별 core version/dependency compatibility rows
- `GET /api/pack-dependency-edges`: pack dependency edge compatibility rows
- `GET /api/pack-compatibility-matrix`: pack compatibility matrix rows
- `GET /api/pack-manifest-compatibility-validations`: pack manifest compatibility validation rows
- `GET /api/capability-registry-apis`: capability registry API artifact
- `GET /api/capability-registry-packs`: Desktop-ready pack API cards
- `GET /api/capability-registry-capabilities`: Desktop-ready capability API cards
- `GET /api/capability-registry-versions`: Desktop-ready capability version cards
- `GET /api/capability-registry-gates`: Desktop-ready gate requirement cards
- `GET /api/desktop-companion-route-groups`: read-only Desktop Companion route groups
- `GET /api/capability-registry-api-validations`: capability registry API validation rows
- `GET /api/workflow-run-dashboards`: workflow run dashboard artifact
- `GET /api/workflow-run-dashboard-panels`: Desktop-ready workflow run panels
- `GET /api/workflow-run-state-cards`: workflow run state summary cards
- `GET /api/workflow-run-queue-cards`: queue/retry/idempotency/resume/cancel summary cards
- `GET /api/workflow-run-gate-cards`: workflow gate status cards
- `GET /api/workflow-run-output-cards`: output and delivery status cards
- `GET /api/workflow-run-dashboard-validations`: workflow run dashboard validation rows
- `GET /api/workflow-golden-case-suites`: workflow golden case suite artifact
- `GET /api/workflow-golden-cases`: representative law-firm, personal-dev, and creative-document workflow golden cases
- `GET /api/workflow-golden-case-steps`: workflow golden case state-machine step rows
- `GET /api/workflow-golden-case-validations`: workflow golden case validation rows
- `GET /api/workflow-gate-freezes`: Workflow/Gate freeze artifact
- `GET /api/workflow-gate-freeze-sources`: Workflow/Gate freeze source status rows
- `GET /api/workflow-gate-freeze-checkpoints`: Workflow/Gate freeze checkpoint rows
- `GET /api/workflow-gate-vertical-slices`: capability->workflow->gate->audit vertical slices
- `GET /api/workflow-gate-loop-bindings`: Workflow/Gate freeze control-plane loop binding rows
- `GET /api/workflow-gate-freeze-validations`: Workflow/Gate freeze validation rows
- `GET /api/workflow-dsl-state-models`: workflow DSL state model artifact
- `GET /api/workflow-dsl-states`: started/waiting/gated/approved/failed/completed state definitions
- `GET /api/workflow-dsl-transition-rules`: workflow DSL transition rule rows
- `GET /api/workflow-state-blueprints`: workflow contract to DSL state blueprint rows
- `GET /api/workflow-run-state-projections`: event-backed workflow run state projections
- `GET /api/workflow-dsl-state-validations`: workflow DSL state model validation rows
- `GET /api/workflow-state-machine-runners`: workflow state machine runner artifact
- `GET /api/workflow-transition-guards`: workflow run별 transition guard rows
- `GET /api/workflow-runner-audit-events`: transition guard audit event candidate rows
- `GET /api/workflow-runner-plans`: protected action 실행 전 runner plan rows
- `GET /api/workflow-runner-validations`: workflow state machine runner validation rows
- `GET /api/workflow-queue-retry-backoff-contracts`: queue/retry/backoff contract artifact
- `GET /api/workflow-queue-records`: workflow run queue rows, held/manual dequeue status 포함
- `GET /api/workflow-retry-classifications`: retry 가능/불가 오류 classification rows
- `GET /api/workflow-backoff-policies`: retryable 오류에만 붙는 unscheduled backoff policy rows
- `GET /api/workflow-queue-validations`: workflow queue/retry/backoff validation rows
- `GET /api/workflow-idempotency-ledgers`: workflow idempotency ledger artifact
- `GET /api/workflow-idempotency-keys`: deterministic idempotency key rows
- `GET /api/workflow-idempotency-decisions`: same-run 또는 skipped duplicate decision rows
- `GET /api/workflow-duplicate-probes`: duplicate request probe rows
- `GET /api/workflow-idempotency-validations`: workflow idempotency validation rows
- `GET /api/workflow-resume-cancel-contracts`: workflow resume/cancel contract artifact
- `GET /api/workflow-resume-cursors`: idempotent workflow run resume cursor rows
- `GET /api/workflow-cancel-requests`: safe cancel request rows
- `GET /api/workflow-resume-cancel-decisions`: resume/cancel control decision rows
- `GET /api/workflow-resume-cancel-validations`: workflow resume/cancel validation rows
- `GET /api/workflow-context-builder-contracts`: workflow context builder contract artifact
- `GET /api/context-packet-v2-records`: context packet v2 rows
- `GET /api/context-resource-selections`: accessible/excluded resource selection rows
- `GET /api/context-token-budgets`: context token budget rows
- `GET /api/context-citation-hints`: context citation hint rows
- `GET /api/workflow-context-builder-validations`: workflow context builder validation rows
- `GET /api/workflow-retrieval-compilers`: workflow retrieval compiler artifact
- `GET /api/retrieval-request-records`: held retrieval request rows
- `GET /api/retrieval-candidate-records`: matter/classification-screened retrieval candidate rows
- `GET /api/source-span-priority-records`: source span priority ranking rows
- `GET /api/retrieval-guard-records`: retrieval guard rows
- `GET /api/workflow-retrieval-validations`: workflow retrieval compiler validation rows
- `GET /api/workflow-prompt-injection-boundaries`: workflow prompt injection boundary artifact
- `GET /api/untrusted-content-wrappers`: untrusted evidence content wrapper rows
- `GET /api/instruction-signal-records`: prompt injection instruction signal rows
- `GET /api/prompt-boundary-guard-records`: prompt boundary guard rows
- `GET /api/prompt-injection-boundary-validations`: prompt injection boundary validation rows
- `GET /api/workflow-pre-run-gate-frameworks`: workflow pre-run gate framework artifact
- `GET /api/pre-run-gate-records`: access/model/tool/budget/conflict pre-run gate rows
- `GET /api/pre-run-gate-decisions`: workflow pre-run gate decision rows
- `GET /api/pre-run-gate-guards`: required pre-run gate set guard rows
- `GET /api/pre-run-gate-validations`: pre-run gate framework validation rows
- `GET /api/workflow-in-run-gate-frameworks`: workflow in-run gate framework artifact
- `GET /api/in-run-gate-records`: dangerous command/sensitive access/timeout in-run gate rows
- `GET /api/in-run-block-records`: in-run block records for unsafe runtime attempts
- `GET /api/in-run-guard-records`: workflow-level in-run gate guard rows
- `GET /api/in-run-gate-validations`: in-run gate framework validation rows
- `GET /api/workflow-post-run-gate-frameworks`: workflow post-run gate framework artifact
- `GET /api/post-run-gate-records`: evidence/citation/test/approval/delivery post-run gate rows
- `GET /api/post-run-gate-decisions`: agent-run post-run gate decision rows
- `GET /api/post-run-gate-guards`: required post-run gate set guard rows
- `GET /api/post-run-gate-validations`: post-run gate framework validation rows
- `GET /api/gate-result-aggregators`: gate result aggregator artifact
- `GET /api/gate-aggregate-records`: normalized pass/warn/manual/fail gate aggregate rows
- `GET /api/workflow-gate-statuses`: workflow-level gate status rows
- `GET /api/gate-result-aggregate-validations`: gate result aggregate validation rows
- `GET /api/runtime-adapter-interface-v2`: Runtime Adapter Interface v2 artifact
- `GET /api/runtime-adapter-interfaces`: runtime adapter interface rows
- `GET /api/runtime-adapter-interface-fields`: runtime adapter interface field groups
- `GET /api/runtime-operator-surface-policies`: runtime operator/Desktop surface policy rows
- `GET /api/runtime-adapter-interface-validations`: Runtime Adapter Interface v2 validation rows
- `GET /api/hermes-runtime-adapter`: Hermes Runtime Adapter artifact
- `GET /api/hermes-invocation-result-contracts`: Hermes invocation result collection contracts
- `GET /api/hermes-agent-run-ledger-bindings`: Hermes AgentRun ledger binding rows
- `GET /api/hermes-runtime-desktop-boundary`: Hermes Desktop companion boundary row
- `GET /api/hermes-runtime-adapter-validations`: Hermes Runtime Adapter validation rows
- `GET /api/claude-code-adapter-contract`: Claude Code Adapter Contract artifact
- `GET /api/claude-code-diff-gate-contracts`: Claude Code diff gate contract rows
- `GET /api/claude-code-agent-run-ledger-bindings`: Claude Code AgentRun ledger binding rows
- `GET /api/claude-code-desktop-boundary`: Claude Code Desktop boundary row
- `GET /api/claude-code-adapter-validations`: Claude Code Adapter Contract validation rows
- `GET /api/codex-adapter-contract`: Codex Adapter Contract artifact
- `GET /api/codex-patch-gate-contracts`: Codex patch gate contract rows
- `GET /api/codex-agent-run-ledger-bindings`: Codex AgentRun ledger binding rows
- `GET /api/codex-desktop-boundary`: Codex Desktop boundary row
- `GET /api/codex-adapter-validations`: Codex Adapter Contract validation rows
- `GET /api/local-script-adapter`: Local Script Adapter artifact
- `GET /api/local-script-execution-contracts`: Local Script execution contract rows
- `GET /api/local-script-agent-run-ledger-bindings`: Local Script AgentRun ledger binding rows
- `GET /api/local-script-desktop-boundary`: Local Script Desktop boundary row
- `GET /api/local-script-adapter-validations`: Local Script Adapter validation rows
- `GET /api/document-renderer-adapter`: Document Renderer Adapter artifact
- `GET /api/document-renderer-output-contracts`: Document Renderer output contract rows
- `GET /api/document-renderer-agent-run-ledger-bindings`: Document Renderer AgentRun ledger binding rows
- `GET /api/document-renderer-desktop-boundary`: Document Renderer Desktop boundary row
- `GET /api/document-renderer-adapter-validations`: Document Renderer Adapter validation rows
- `GET /api/worktree-manager-v2`: Worktree Manager v2 artifact
- `GET /api/agent-worktree-plans`: Agent worktree plan rows
- `GET /api/worktree-status-records`: Worktree status records
- `GET /api/worktree-cleanup-records`: Worktree cleanup records
- `GET /api/worktree-desktop-boundary`: Worktree Manager Desktop boundary row
- `GET /api/worktree-manager-v2-validations`: Worktree Manager v2 validation rows
- `GET /api/sandbox-policy-model`: Sandbox Policy Model artifact
- `GET /api/sandbox-backend-policies`: Sandbox backend policy rows
- `GET /api/runtime-sandbox-bindings`: Runtime sandbox binding rows
- `GET /api/sandbox-policy-decisions`: Sandbox policy decision rows
- `GET /api/sandbox-desktop-boundary`: Sandbox Policy Model Desktop boundary row
- `GET /api/sandbox-policy-model-validations`: Sandbox Policy Model validation rows
- `GET /api/docker-local-backend-selector`: Docker/local Backend Selector artifact
- `GET /api/backend-selection-rules`: backend selection rule rows
- `GET /api/runtime-backend-selections`: runtime backend selection rows
- `GET /api/classification-backend-selections`: classification backend selection rows
- `GET /api/runtime-classification-backend-matrix`: runtime/classification backend matrix rows
- `GET /api/backend-selector-desktop-boundary`: Backend Selector Desktop boundary row
- `GET /api/backend-selector-validations`: Backend Selector validation rows
- `GET /api/secrets-broker-contract`: Secrets Broker Contract artifact
- `GET /api/secret-handle-policies`: secret handle policy rows
- `GET /api/runtime-secret-access-bindings`: runtime secret access binding rows
- `GET /api/secret-audit-bindings`: secret audit binding rows
- `GET /api/secrets-desktop-boundary`: Secrets Broker Desktop boundary row
- `GET /api/secrets-broker-validations`: Secrets Broker validation rows
- `GET /api/runtime-artifact-capture`: Runtime Artifact Capture artifact
- `GET /api/artifact-capture-records`: generated runtime artifact capture rows bound to OutputArtifact
- `GET /api/diff-capture-records`: Claude/Codex diff or patch capture rows
- `GET /api/stream-capture-records`: stdout/stderr capture rows
- `GET /api/metadata-capture-records`: runtime artifact metadata capture rows
- `GET /api/output-artifact-capture-bindings`: capture-to-OutputArtifact binding rows
- `GET /api/runtime-artifact-desktop-boundary`: Runtime Artifact Capture Desktop boundary row
- `GET /api/runtime-artifact-capture-validations`: Runtime Artifact Capture validation rows
- `GET /api/runtime-log-normalization`: Runtime Log Normalization artifact
- `GET /api/normalized-runtime-logs`: runtime log rows normalized to `runtime-log-entry.v1`
- `GET /api/normalized-log-streams`: normalized stdout/stderr stream rows
- `GET /api/runtime-log-search-documents`: indexed runtime log search document rows
- `GET /api/runtime-log-trace-bindings`: runtime log to observability trace binding rows
- `GET /api/runtime-log-desktop-boundary`: Runtime Log Normalization Desktop boundary row
- `GET /api/runtime-log-normalization-validations`: Runtime Log Normalization validation rows
- `GET /api/runtime-timeout-heartbeat`: Runtime Timeout/Heartbeat artifact
- `GET /api/runtime-heartbeat-records`: Runtime heartbeat ledger rows
- `GET /api/runtime-timeout-records`: Runtime timeout ledger rows
- `GET /api/runtime-lifecycle-ledger-bindings`: Runtime lifecycle ledger binding rows
- `GET /api/runtime-heartbeat-desktop-boundary`: Runtime Timeout/Heartbeat Desktop boundary row
- `GET /api/runtime-timeout-heartbeat-validations`: Runtime Timeout/Heartbeat validation rows
- `GET /api/runtime-control-commands`: Runtime Control Commands artifact
- `GET /api/runtime-control-command-requests`: cancel/resume command request rows
- `GET /api/runtime-control-command-results`: cancel/resume command result rows
- `GET /api/runtime-control-audit-bindings`: runtime control audit binding rows
- `GET /api/runtime-control-desktop-boundary`: Runtime Control Commands Desktop boundary row
- `GET /api/runtime-control-command-validations`: Runtime Control Commands validation rows
- `GET /api/protected-file-gate`: Protected File Gate artifact
- `GET /api/protected-file-gate-rules`: protected file rule rows
- `GET /api/protected-file-change-evaluations`: protected file change evaluation rows
- `GET /api/protected-file-approval-requirements`: pending explicit approval rows for protected file changes
- `GET /api/protected-file-gate-desktop-boundary`: Protected File Gate Desktop boundary row
- `GET /api/protected-file-gate-validations`: Protected File Gate validation rows
- `GET /api/canonical-test-runner`: Canonical Test Runner artifact
- `GET /api/canonical-test-plans`: canonical test plan rows
- `GET /api/canonical-test-executions`: harness-rerun canonical test execution rows
- `GET /api/canonical-test-gate-results`: canonical test gate result rows
- `GET /api/canonical-test-desktop-boundary`: Canonical Test Runner Desktop boundary row
- `GET /api/canonical-test-validations`: Canonical Test Runner validation rows
- `GET /api/runtime-freezes`: Runtime Freeze artifact
- `GET /api/runtime-freeze-sources`: Runtime Freeze source status rows
- `GET /api/runtime-freeze-slices`: Hermes, Codex, local_script representative runtime slice rows
- `GET /api/runtime-freeze-loop-bindings`: P195-P211 control-plane loop binding rows
- `GET /api/runtime-freeze-validations`: Runtime Freeze validation rows
- `GET /api/policy-snapshot-event-bindings`: policy snapshot event binding artifact
- `GET /api/event-run-gate-policy-bindings`: event/run/gate execution-time policy snapshot binding rows
- `GET /api/event-policy-snapshot-bindings`: event and audit event policy snapshot binding rows
- `GET /api/run-policy-snapshot-bindings`: RunLedger policy snapshot binding rows
- `GET /api/gate-policy-snapshot-bindings`: GateResult policy snapshot binding rows
- `GET /api/policy-snapshot-event-binding-validations`: policy snapshot event binding validation rows
- `GET /summary.md`: Markdown 요약

`/api/actions`와 `/api/stages`는 `status`, `priority`, `source_stage`, `stage_id`, `source_id`, `available`, `limit` query를 지원한다. Workflow run ledger route는 `workflow_run_ledger_status`, `workflow_run_record_status`, `workflow_run_record_id`, `workflow_run_id`, `run_ledger_id`, `workflow_state_transition_id`, `workflow_event_binding_id`, `transition_status`, `from_state`, `to_state`, `terminal_state`, `terminal_state_alignment_status`, `state_effect`, `binding_status`, `capability_contract_status`, `run_ledger_binding_status`, `matter_id`, `domain_pack`, `status`, `limit` query를 지원한다. Agent run ledger route는 `agent_run_ledger_status`, `agent_run_record_id`, `agent_run_id`, `agent_run_status`, `workflow_run_id`, `run_ledger_id`, `runtime_id`, `runtime_output_id`, `runtime_log_id`, `runtime_artifact_id`, `input_reference_status`, `output_reference_status`, `output_hash_status`, `io_reference_status`, `log_reference_status`, `artifact_reference_status`, `event_binding_status`, `event_effect`, `workflow_run_binding_status`, `runtime_contract_binding_status`, `verification_status`, `status`, `limit` query를 지원한다. Tool invocation ledger route는 `tool_invocation_ledger_status`, `tool_invocation_id`, `tool_invocation_permission_decision_id`, `tool_invocation_agent_binding_id`, `tool_invocation_event_binding_id`, `agent_run_id`, `workflow_run_id`, `run_ledger_id`, `runtime_id`, `adapter_id`, `tool_id`, `tool_permission_gate_id`, `agent_run_tool_gate_id`, `requested_state`, `permission_decision`, `permission_status`, `invocation_state`, `execution_allowed`, `protected_action`, `approval_required`, `human_approval_required`, `event_binding_status`, `event_context`, `direct_tool_event`, `binding_status`, `status`, `limit` query를 지원한다. Audit event ledger route는 `audit_event_ledger_status`, `audit_trail_record_id`, `audit_separation_binding_id`, `audit_source_rollup_id`, `source_kind`, `source_record_id`, `audit_domain`, `audit_type`, `audit_severity`, `audit_plane_status`, `event_store_binding_status`, `observability_log_status`, `trace_projection_status`, `separation_status`, `actor_id`, `tenant_id`, `matter_id`, `policy_snapshot_id`, `status`, `limit` query를 지원한다. `/api/evidence-review-drafts`는 `draft_id`, `limit` query를 지원하고, `/api/evidence-review-items`는 `review_item_id`, `queue_item_id`, `evidence_id`, `classification`, `review_status`, `suggested_decision`, `draft_decision`, `auto_approvable`, `priority`, `limit` query를 지원한다. Policy route는 `policy_status`, `matrix_id`, `ledger_id`, `ledger_status`, `policy_snapshot_id`, `decision_id`, `decision_status`, `usage_id`, `usage_type`, `snapshot_declared_in_source`, `classification`, `external_model_policy`, `local_model_policy`, `redaction_policy`, `approval_required`, `tool_id`, `default_policy`, `artifact_type`, `delivery_policy`, `gate_id`, `stage`, `blocking_by_default`, `limit` query를 지원한다. Context route는 `context_packet_id`, `context_item_id`, `retrieval_filter_id`, `packet_status`, `context_mode`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `redaction_required`, `redaction_applied`, `classification_allowed`, `runtime_allowed_by_capability`, `item_type`, `content_mode`, `filter_status`, `limit` query를 지원한다. Model routing route는 `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `route_status`, `route_mode`, `external_transfer`, `provider_boundary`, `runtime_policy_status`, `external_model_policy`, `local_model_policy`, `redaction_status`, `audit_required`, `approval_required`, `ledger_status`, `limit` query를 지원한다. Cost budget route는 `budget_decision_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `route_mode`, `budget_status`, `token_tracking_required`, `token_tracking_status`, `cost_budget_gate_present`, `cost_policy_present`, `ledger_status`, `limit` query를 지원한다. Token usage route는 `token_usage_id`, `budget_decision_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `tracking_status`, `estimated`, `ledger_status`, `limit` query를 지원한다. `/api/packs`와 `/api/capabilities`는 `pack_id`, `capability_id`, `enabled`, `valid`, `limit` query를 지원한다. `/api/artifacts`와 `/api/delivered-artifacts`는 `artifact_id`, `artifact_type`, `domain_pack`, `delivery_state`, `approval_status`, `status`, `matter_id`, `tenant_id`, `limit` query를 지원한다. `/api/runs`, `/api/events`, `/api/costs`는 `run_id`, `workflow_run_id`, `runtime_id`, `event_type`, `cost_type`, `capability_id`, `source_id`, `status`, `limit` query를 지원한다. `/api/audit-trails`는 `audit_trail_id`, `audit_status`, `limit` query를 지원하고, `/api/audit-events`는 `audit_event_id`, `event_type`, `event_category`, `source_id`, `tenant_id`, `actor_type`, `actor_id`, `correlation_id`, `protected_action_event`, `protected_action_executed`, `limit` query를 지원하며, `/api/audit-sources`는 `source_id`, `available`, `limit` query를 지원한다. `/api/delivery-actions`는 `delivery_action_id`, `artifact_id`, `domain_pack`, `delivery_status`, `delivery_channel`, `delivery_target`, `priority`, `limit` query를 지원한다. `/api/matters`와 `/api/post-delivery-matters`는 `matter_key`, `tenant_id`, `matter_id`, `status`, `limit` query를 지원한다. `/api/approvals`는 `approval_item_id`, `item_type`, `approval_id`, `domain_pack`, `matter_id`, `priority`, `required_decision`, `status`, `limit` query를 지원한다. `/api/approval-inbox-decisions`는 `approval_item_id`, `item_type`, `decision`, `status_after`, `priority`, `limit` query를 지원한다. `/api/delivery-execution-candidates`와 `/api/delivery-execution-packets`는 `execution_candidate_id`, `packet_id`, `execution_status`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원한다. `/api/delivery-receipts`와 `/api/closeout-applied-receipts`는 `receipt_id`, `packet_id`, `receipt_status`, `executed_by`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원하고, `/api/delivery-receipt-events`는 `type`, `tenant_id`, `correlation_id`, `limit` query를 지원한다. `/api/outstanding-receipts`와 `/api/delivery-closeout-items`는 `closeout_item_id`, `packet_id`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `status`, `primary_domain_pack`, `limit` query를 지원한다. `/api/receipt-input-drafts`, `/api/validated-receipts-to-apply`는 `receipt_id`, `packet_id`, `receipt_status`, `limit` query를 지원한다. `/api/closeout-receipt-validations`는 `validation_item_id`, `packet_id`, `validation_status`, `receipt_status`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `primary_domain_pack`, `limit` query를 지원하고, `/api/closeout-receipt-errors`는 `packet_id`, `field`, `limit` query를 지원한다. `/api/closeout-receipt-applications`, `/api/human-gate-receipt-applications`, `/api/work-packet-receipt-applications`, `/api/pipeline-runs`, `/api/control-plane-loops`, `/api/goal-checkpoints`는 `application_id`, `application_status`, `pipeline_id`, `loop_id`, `loop_status`, `checkpoint_id`, `checkpoint_status`, `limit` query를 지원한다. `/api/pipeline-steps`와 `/api/control-plane-loop-steps`는 `step_id`, `category`, `status`, `limit` query를 지원한다. `/api/goal-checkpoint-items`는 `checkpoint_item_id`, `category`, `status`, `priority`, `limit` query를 지원한다. `/api/control-plane-health`는 `health_id`, `limit` query를 지원하고, `/api/health-checks`는 `check_id`, `source_stage`, `status`, `severity`, `limit` query를 지원한다. `/api/action-plans`는 `plan_id`, `plan_status`, `limit` query를 지원하고, `/api/action-plan-items`는 `plan_item_id`, `source_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/human-gates`는 `human_gate_id`, `limit` query를 지원하고, `/api/human-gate-items`, `/api/patched-human-gate-items`는 `gate_item_id`, `source_plan_item_id`, `source_stage`, `gate_type`, `priority`, `status`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/human-gate-receipts`는 `receipt_draft_id`, `receipt_status`, `limit` query를 지원하고, `/api/human-gate-receipt-requirements`는 `receipt_requirement_id`, `gate_item_id`, `source_plan_item_id`, `source_stage`, `gate_type`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하며, `/api/human-gate-receipt-drafts`는 `receipt_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `receipt_status`, `outcome`, `limit` query를 지원한다. `/api/human-gate-receipt-validations`는 `validation_item_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `source_stage`, `validation_status`, `receipt_status`, `outcome`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/human-gate-receipt-errors`는 `gate_item_id`, `field`, `limit` query를 지원한다. `/api/validated-human-gate-receipts`와 `/api/applied-human-gate-receipts`는 `receipt_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `receipt_status`, `outcome`, `limit` query를 지원한다. `/api/action-work-packets`는 `work_packet_id`, `packet_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/action-work-items`는 `work_item_id`, `work_packet_id`, `plan_item_id`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/work-packet-receipt-requirements`는 `receipt_requirement_id`, `work_packet_id`, `packet_type`, `source_stage`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-drafts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다. `/api/work-packet-receipt-validations`는 `validation_item_id`, `work_packet_id`, `packet_type`, `source_stage`, `validation_status`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-errors`는 `work_packet_id`, `field`, `limit` query를 지원한다. `/api/validated-work-packet-receipts`와 `/api/applied-work-packet-receipts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다.

Human review packet route는 `review_packet_id`, `review_item_id`, `packet_type`, `packet_status`, `required_actor`, `gate_item_id`, `gate_type`, `source_stage`, `priority`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원한다. Human review agenda route는 `agenda_id`, `agenda_section_id`, `agenda_item_id`, `agenda_status`, `section_status`, `review_packet_id`, `packet_type`, `required_actor`, `priority`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review agenda receipt intake route는 `intake_id`, `intake_item_id`, `intake_status`, `template_row_present`, `ready_for_validation`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `required_actor`, `protected_action`, `limit` query를 지원한다. Human review receipt workspace route는 `workspace_id`, `actor_workspace_id`, `workspace_entry_id`, `workspace_status`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review receipt workspace merge route는 `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review context bundle route는 `bundle_id`, `bundle_status`, `actor_context_bundle_id`, `context_card_id`, `context_status`, `subject_type`, `subject_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review decision register route는 `register_id`, `register_status`, `actor_decision_register_id`, `decision_row_id`, `decision_status`, `context_card_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review decision register merge route는 `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `actor_decision_register_id`, `decision_row_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review validation feedback route는 `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `required_actor`, `validation_status`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review correction workspace route는 `correction_workspace_id`, `actor_correction_workspace_id`, `correction_item_id`, `correction_status`, `workspace_status`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review correction merge, validation, feedback route는 `merge_id`, `merge_item_id`, `validation_item_id`, `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `required_actor`, `validation_status`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review cycle route는 `cycle_id`, `actor_cycle_id`, `cycle_item_id`, `cycle_status`, `required_actor`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review cycle field audit, completion pack, completion verification, completion workbench, completion runbook, completion readiness, completion command queue, completion command receipts, completion command receipt validation, completion command receipt feedback, completion command receipt workspace, completion command receipt workspace merge, completion command receipt workspace validation, completion command receipt application, completion reconciliation route는 `field_audit_id`, `actor_field_audit_id`, `field_audit_item_id`, `field_audit_status`, `completion_pack_id`, `actor_completion_pack_id`, `completion_item_id`, `completion_status`, `verification_id`, `actor_verification_id`, `verification_item_id`, `verification_status`, `workbench_id`, `actor_workbench_id`, `workbench_item_id`, `workbench_status`, `runbook_id`, `actor_runbook_id`, `runbook_step_id`, `runbook_status`, `step_status`, `step_type`, `step_key`, `readiness_id`, `actor_readiness_id`, `command_gate_id`, `manual_requirement_id`, `readiness_status`, `command_status`, `command_allowed_now`, `requirement_status`, `command_queue_id`, `queue_item_id`, `held_command_id`, `actor_command_queue_id`, `command_receipt_draft_id`, `receipt_requirement_id`, `receipt_id`, `held_command_ref_id`, `validation_id`, `validation_item_id`, `validation_status`, `ready_to_confirm`, `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `workspace_id`, `actor_workspace_id`, `workspace_item_id`, `workspace_status`, `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `application_id`, `application_status`, `applied_command_status`, `ready_for_validation`, `field`, `queue_status`, `hold_status`, `command_kind`, `command`, `command_result`, `executed_by`, `output_reference`, `requires_explicit_human_approval`, `required_actor`, `gate_item_id`, `gate_type`, `protected_action`, `receipt_status`, `limit` query를 지원한다.

Cost attribution route는 `attribution_id`, `budget_decision_id`, `token_usage_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `attribution_status`, `over_budget`, `untracked_cost`, `matter_id`, `tenant_id`, `ledger_status`, `limit` query를 지원한다.

Token usage projection route는 `token_usage_projection_status`, `token_usage_projection_id`, `projected_token_usage_record_id`, `token_usage_id`, `workflow_run_id`, `agent_run_id`, `runtime_id`, `capability_id`, `domain_pack`, `matter_id`, `classification`, `tracking_status`, `provider_cost_binding_status`, `token_rollup_id`, `rollup_type`, `rollup_key`, `status`, `limit` query를 지원한다.

Observability trace projection route는 `observability_trace_projection_status`, `observability_trace_projection_id`, `observability_trace_id`, `correlation_trace_id`, `trace_binding_id`, `trace_component_status`, `binding_type`, `binding_status`, `workflow_run_id`, `agent_run_id`, `gate_result_id`, `output_artifact_id`, `correlation_id`, `trace_status`, `status`, `limit` query를 지원한다.

Error/retry ledger route는 `error_retry_ledger_status`, `error_retry_ledger_id`, `projected_error_record_id`, `source_error_record_id`, `retry_record_id`, `timeout_record_id`, `resume_state_record_id`, `failure_state`, `error_kind`, `error_type`, `error_status`, `retry_state`, `timeout_state`, `resume_state`, `auto_retry_scheduled`, `timeout_observed`, `resume_required`, `resume_blocked`, `trace_binding_status`, `observability_trace_id`, `correlation_trace_id`, `workflow_run_id`, `run_ledger_id`, `status`, `limit` query를 지원한다.

Event replay route는 `event_replay_status`, `event_replay_harness_id`, `replayed_event_stream_id`, `event_stream_replay_status`, `replayed_run_summary_id`, `run_replay_status`, `event_count_match_status`, `terminal_state_match_status`, `dashboard_projection_status`, `projection_status`, `metric_key`, `metric_status`, `source_match_status`, `dashboard_match_status`, `event_stream_id`, `run_ledger_id`, `workflow_run_id`, `correlation_id`, `status`, `limit` query를 지원한다.

Retention/archive route는 `retention_archive_status`, `retention_policy_id`, `retention_plane`, `archive_candidate_id`, `archive_state`, `archive_action`, `deletion_status`, `legal_hold_status`, `legal_hold_binding_id`, `hold_scope`, `hold_status`, `status`, `limit` query를 지원한다.

Budget alert route는 `alert_record_id`, `attribution_id`, `budget_decision_id`, `token_usage_id`, `routing_decision_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `alert_status`, `requires_human`, `matter_id`, `tenant_id`, `ledger_status`, `limit` query를 지원한다.

Lineage graph route는 `lineage_graph_status`, `lineage_node_id`, `lineage_edge_id`, `lineage_path_id`, `node_type`, `edge_type`, `path_status`, `from_subject_id`, `to_subject_id`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Evidence viewer data route는 `evidence_viewer_data_status`, `viewer_card_id`, `source_span_panel_id`, `lineage_path_panel_id`, `source_span_id`, `evidence_id`, `lineage_path_id`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `binding_status`, `path_status`, `status`, `limit` query를 지원한다.

Evidence export bundle route는 `evidence_export_bundle_status`, `export_bundle_id`, `export_status`, `bundle_status`, `source_package_id`, `citation_package_id`, `coverage_package_id`, `source_span_id`, `evidence_id`, `citation_id`, `coverage_score_id`, `lineage_path_id`, `output_paragraph_id`, `exhibit_id`, `matter_id`, `classification`, `policy_snapshot_id`, `package_status`, `status`, `limit` query를 지원한다.

Evidence coverage route는 `evidence_coverage_status`, `coverage_score_id`, `coverage_dimension_id`, `coverage_status`, `dimension`, `coverage_subject_id`, `covered`, `required`, `missing_required_dimension_count`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Evidence flags route는 `evidence_flags_status`, `evidence_flag_record_id`, `coverage_score_id`, `flag_decision_id`, `flag_type`, `flag_value`, `extraction_flag`, `human_confirmation_flag`, `privilege_flag`, `redaction_flag`, `external_transfer_flag`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Exhibit map route는 `exhibit_map_status`, `exhibit_id`, `exhibit_number`, `exhibit_label`, `exhibit_reference`, `binding_type`, `exhibit_status`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Custody event route는 `custody_event_ledger_status`, `custody_event_id`, `custody_event_link_id`, `custody_chain_id`, `event_stage`, `event_type`, `event_status`, `subject_type`, `subject_id`, `link_status`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `limit` query를 지원한다.

Search index route는 `search_index_contract_status`, `search_index_id`, `search_index_field_id`, `search_index_query_plan_id`, `collection_id`, `source_artifact_id`, `index_status`, `field_role`, `field_name`, `query_profile`, `query_status`, `executable`, `schema_version`, `status`, `limit` query를 지원한다.

Vector policy route는 `vector_index_policy_boundary_status`, `vector_policy_gate_id`, `embedding_route_policy_id`, `collection_id`, `source_artifact_id`, `gate_status`, `route_status`, `embedding_execution_status`, `retrieval_execution_status`, `route_executable`, `classification`, `policy_external_embedding_decision`, `external_embedding_transfer_status`, `external_embedding_allowed`, `schema_version`, `status`, `limit` query를 지원한다.

Evidence regression route는 `evidence_regression_status`, `suite_type`, `suite_status`, `status`, `regression_suite_id`, `regression_test_case_id`, `subject_id`, `matter_id`, `classification`, `external_service_used`, `locked`, `limit` query를 지원한다.

Resource/evidence dashboard route는 `resource_evidence_dashboard_status`, `panel_id`, `panel_type`, `panel_status`, `source_artifact_id`, `matter_id`, `classification`, `rollup_status`, `status`, `limit` query를 지원한다.

Evidence Plane freeze route는 `evidence_plane_freeze_status`, `source_status`, `checkpoint_status`, `trace_status`, `trace_id`, `matter_id`, `classification`, `policy_snapshot_id`, `status`, `limit` query를 지원한다.

Event envelope route는 `event_envelope_status`, `envelope_kind`, `event_type`, `type`, `specversion`, `source`, `source_kind`, `binding_status`, `round_trip_status`, `required_field_status`, `status`, `limit` query를 지원한다.

Event type registry route는 `event_type_registry_status`, `event_family`, `event_category`, `registry_status`, `classification_status`, `coverage_status`, `required_family`, `binding_status`, `event_type`, `status`, `limit` query를 지원한다.

Append-only event store route는 `event_store_status`, `event_stream_id`, `stream_scope`, `stream_status`, `append_status`, `immutable_status`, `mutation_status`, `hash_chain_status`, `correction_status`, `sequence_status`, `correction_policy_status`, `event_type`, `event_family`, `source_kind`, `status`, `limit` query를 지원한다.

Event correlation route는 `event_correlation_status`, `correlation_id`, `correlation_trace_id`, `trace_status`, `causation_status`, `run_binding_status`, `cause_event_envelope_id`, `effect_event_envelope_id`, `matter_id`, `workflow_run_id`, `run_ledger_id`, `event_type`, `status`, `limit` query를 지원한다.

Ledger API/dashboard route는 `ledger_api_dashboard_status`, `ledger_domain`, `panel_id`, `panel_status`, `route_id`, `route_path`, `route_method`, `route_status`, `source_ledger_id`, `metric_id`, `metric_key`, `metric_status`, `link_id`, `link_type`, `link_status`, `from_ledger_domain`, `to_ledger_domain`, `status`, `limit` query를 지원한다.

Ledger golden fixture route는 `ledger_golden_fixture_status`, `ledger_golden_case_id`, `fixture_group`, `case_status`, `source_artifact_id`, `lock_status`, `assertion_status`, `expected_outcome`, `status`, `limit` query를 지원한다.

Gate result aggregator route는 `gate_result_aggregator_status`, `gate_result_aggregator_contract_id`, `aggregate_gate_state`, `aggregate_gate_stage`, `workflow_gate_status`, `gate_aggregate_record_id`, `workflow_gate_status_id`, `workflow_run_id`, `agent_run_id`, `gate_type`, `status`, `limit` query를 지원한다.

Secrets broker route는 `secrets_broker_contract_status`, `broker_status`, `secret_access_status`, `secret_kind`, `audit_event_type`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. Desktop Companion은 raw secret, provider key, local secret store write, installer/gateway/SSH/cron control을 source of truth로 삼거나 실행하지 않고 read-only secret handle status와 audit receipt metadata만 소비한다.

Capability registry API route는 `capability_registry_api_status`, `desktop_companion_readiness_status`, `pack_api_card_id`, `capability_api_card_id`, `capability_version_api_card_id`, `gate_requirement_api_card_id`, `pack_id`, `domain_pack`, `capability_id`, `version_status`, `gate_id`, `gate_phase`, `desktop_surface`, `desktop_card_status`, `desktop_route_group_id`, `route_group_id`, `route_path`, `route_method`, `read_only`, `mutation_allowed`, `protected_mutation_request_allowed`, `secret_material_exposed`, `installer_or_gateway_control`, `status`, `limit` query를 지원한다. Desktop Companion route group은 v1에서 모두 GET/read-only이며 mutation, secret, installer, gateway, SSH, cron, auto-update control을 노출하지 않는다.

Runtime API Dashboard route는 `runtime_api_dashboard_status`, `runtime_api_route_group_status`, `runtime_dashboard_panel_status`, `runtime_status_card_status`, `route_group_kind`, `panel_kind`, `card_kind`, `source_artifact_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/runtime-api-dashboard`, `/api/runtime-api-route-groups`, `/api/runtime-dashboard-panels`, `/api/runtime-status-cards`, `/api/runtime-api-desktop-boundary`, `/api/runtime-api-dashboard-validations`는 adapter/worktree/sandbox/secrets/artifact/log/heartbeat/control/gate/test 상태를 Desktop Companion read-only operator surface로 묶어 제공하며 runtime execution, process control, test execution, file write, direct apply/merge, secret/provider key, installer/gateway/SSH/cron control을 노출하지 않는다.

Runtime Freeze route는 `runtime_freeze_status`, `runtime_freeze_source_status`, `runtime_freeze_slice_status`, `runtime_freeze_loop_binding_status`, `runtime_id`, `status`, `limit` query를 지원한다. `/api/runtime-freezes`, `/api/runtime-freeze-sources`, `/api/runtime-freeze-slices`, `/api/runtime-freeze-loop-bindings`, `/api/runtime-freeze-validations`는 P195-P211 runtime track을 freeze report로 노출하며 Hermes Desktop은 readiness, blocked reason, loop binding 상태만 읽고 runtime execution/control/test/secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Personal Dev Pack Manifest route는 `personal_dev_pack_manifest_status`, `personal_dev_capability_registration_status`, `registration_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/personal-dev-pack-manifests`, `/api/personal-dev-pack-registration`, `/api/personal-dev-capability-registrations`, `/api/personal-dev-pack-boundary`, `/api/personal-dev-pack-validations`는 P213 personal-dev pack registration을 read-only로 노출하며 Hermes Desktop은 pack/capability/gate 상태를 조회할 수 있지만 core mutation, direct apply/merge, protected mutation execution, secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Law Firm Pack Manifest route는 `law_firm_pack_manifest_status`, `law_firm_capability_registration_status`, `registration_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/law-firm-pack-manifests`, `/api/law-firm-pack-registration`, `/api/law-firm-capability-registrations`, `/api/law-firm-pack-boundary`, `/api/law-firm-pack-validations`는 P231 law-firm pack registration을 read-only로 노출하며 matter boundary, attorney/human review, pending review output status를 확인할 수 있지만 legal advice, client-facing output generation, delivery execution, core mutation, runtime execution, protected mutation, secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Matter OS Profile route는 `matter_os_profile_status`, `profile_card_status`, `display_field_status`, `matter_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/matter-os-profile-artifacts`, `/api/matter-os-profiles`, `/api/matter-os-display-fields`, `/api/matter-os-profile-boundary`, `/api/matter-os-profile-validations`는 P232 Matter OS profile을 read-only로 노출하며 client, counterparty, matter number, security grade, responsible owner 표시 필드와 attorney/human review gate, pending review output posture를 확인할 수 있지만 legal advice, client-facing output generation, matter data writes, runtime execution, delivery execution은 수행하지 않는다.

Matter Timeline route는 `matter_timeline_status`, `timeline_event_type`, `timeline_event_status`, `timeline_review_status`, `timeline_matter_status`, `matter_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/matter-timeline-artifacts`, `/api/matter-timeline-events`, `/api/matter-timeline-matters`, `/api/matter-timeline-boundary`, `/api/matter-timeline-validations`는 P233 Matter Timeline을 read-only로 노출하며 회의, 수신, 제출, 기한 이벤트가 `matter_id` 기준으로 날짜순 정렬되어 있는지 확인할 수 있지만 legal advice, client-facing output generation, matter data writes, runtime execution, delivery execution은 수행하지 않는다.

Matter Document Index route는 `matter_document_index_status`, `document_role`, `document_status`, `document_family_status`, `latest_document`, `document_source_kind`, `matter_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/matter-document-index-artifacts`, `/api/matter-document-records`, `/api/matter-document-families`, `/api/matter-latest-documents`, `/api/matter-document-index-boundary`, `/api/matter-document-index-validations`는 P234 Matter Document Index를 read-only로 노출하며 원본, 초안, 제출본, 최신본, 상대방안을 `matter_id` 경계 안에서 구분할 수 있지만 legal advice, client-facing output generation, matter data writes, runtime execution, delivery execution은 수행하지 않는다.

Repo Profile Detector route는 `repo_profile_detector_status`, `repo_profile_status`, `language_id`, `framework_id`, `framework_status`, `command_kind`, `command_status`, `signal_type`, `signal_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/repo-profile-detectors`, `/api/repo-profiles`, `/api/repo-profile-languages`, `/api/repo-profile-frameworks`, `/api/repo-profile-commands`, `/api/repo-profile-signals`, `/api/repo-profile-desktop-boundary`, `/api/repo-profile-validations`는 P214 repo language/framework/test-build-lint command catalog를 read-only로 노출하며 Hermes Desktop은 command status를 볼 수 있지만 command execution, direct mutation, source-of-truth role, secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Agent Instruction Registry route는 `agent_instruction_registry_status`, `instruction_source_status`, `instruction_kind`, `instruction_version_status`, `version_status`, `runtime_instruction_binding_status`, `binding_status`, `runtime_kind`, `instruction_application_status`, `section_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/agent-instruction-registries`, `/api/agent-instruction-sources`, `/api/agent-instruction-versions`, `/api/runtime-instruction-bindings`, `/api/agent-instruction-sections`, `/api/agent-instruction-desktop-boundary`, `/api/agent-instruction-validations`는 P215 AGENTS/CLAUDE/Codex instruction source와 Hermes/Claude Code/Codex/local_script runtime binding 상태를 read-only로 노출하며 Hermes Desktop은 instruction version과 적용 상태를 볼 수 있지만 instruction file write, runtime execution, source-of-truth role, secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Issue Intake Adapter route는 `issue_intake_status`, `issue_source_status`, `source_system`, `issue_record_status`, `issue_status`, `issue_kind`, `normalized_task_status`, `task_status`, `task_priority`, `priority`, `issue_task_binding_status`, `binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/issue-intake-adapters`, `/api/issue-intake-sources`, `/api/issue-intake-records`, `/api/normalized-task-contracts`, `/api/issue-task-bindings`, `/api/issue-intake-desktop-boundary`, `/api/issue-intake-validations`는 P216 GitHub/Plane/local issue payload를 동일한 personal-dev task contract로 정규화한 상태를 read-only로 노출하며 Hermes Desktop은 source/record/task/binding 상태를 볼 수 있지만 external fetch, issue write, task state mutation, runtime execution, source-of-truth role, secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Plan Request Contract route는 `plan_request_status`, `request_status`, `agent`, `binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/plan-request-contracts`, `/api/shared-planning-contexts`, `/api/plan-requests`, `/api/plan-request-bindings`, `/api/plan-request-desktop-boundary`, `/api/plan-request-validations`는 P217 Claude Code/Codex plan request가 동일 shared planning context와 constraints hash를 사용하는 상태를 read-only로 노출하며 Hermes Desktop은 plan request와 binding 상태를 볼 수 있지만 agent invocation, plan acceptance, command execution, task state mutation, source-of-truth role, secret/provider key/installer/gateway/SSH/cron control은 수행하지 않는다.

Plan Reconciliation route는 `plan_reconciliation_status`, `candidate_status`, `agent`, `commonality_status`, `conflict_status`, `selected_scope_status`, `question_status`, `blocker_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/plan-reconciliations`, `/api/plan-candidates`, `/api/plan-commonalities`, `/api/plan-conflicts`, `/api/selected-plan-scopes`, `/api/unresolved-plan-questions`, `/api/plan-reconciliation-desktop-boundary`, `/api/plan-reconciliation-validations`는 P218 Claude Code/Codex plan candidate의 commonality, resolved conflict, selected human-review scope, unresolved question을 read-only로 노출하며 scope freeze, plan acceptance, external agent invocation, task mutation은 후속 human-gated phase에 남긴다.

Scope Freeze Gate route는 `scope_freeze_gate_status`, `frozen_scope_status`, `file_boundary_status`, `rule_snapshot_status`, `decision_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/scope-freeze-gates`, `/api/frozen-scope-items`, `/api/scope-file-boundaries`, `/api/scope-protected-file-rules`, `/api/scope-freeze-decisions`, `/api/scope-freeze-desktop-boundary`, `/api/scope-freeze-validations`는 P219에서 고정한 selected scope, file boundary, protected file rule snapshot, freeze decision을 read-only로 노출하며 protected file write, plan acceptance, patch, merge, release는 계속 human-gated로 유지한다.

Dev Lane Ledger route는 `dev_lane_ledger_status`, `lane_status`, `lane_role`, `agent`, `branch_record_status`, `worktree_record_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/dev-lane-ledgers`, `/api/dev-lanes`, `/api/dev-lane-branch-records`, `/api/dev-lane-worktree-records`, `/api/dev-lane-desktop-boundary`, `/api/dev-lane-validations`는 P220에서 고정한 Claude Code/Codex lane, branch record, worktree record를 read-only로 노출하며 실제 worktree 생성, git command, patch application, protected file write, merge, release는 계속 human-gated로 유지한다.

Implementation Patch Capture route는 `implementation_patch_capture_status`, `patch_record_status`, `diff_capture_status`, `touched_file_status`, `generated_artifact_status`, `run_ledger_binding_status`, `agent`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/implementation-patch-captures`, `/api/implementation-patch-records`, `/api/implementation-diff-captures`, `/api/implementation-touched-files`, `/api/implementation-generated-artifacts`, `/api/implementation-run-ledger-bindings`, `/api/implementation-patch-desktop-boundary`, `/api/implementation-patch-validations`는 P221에서 고정한 patch/diff/touched-file/generated-artifact/run-ledger binding을 read-only로 노출하며 diff review, canonical test, protected file scan, patch application, merge, release는 계속 human-gated로 유지한다.

Diff Review Gate route는 `diff_review_gate_status`, `diff_review_status`, `file_finding_status`, `artifact_finding_status`, `gate_result_status`, `review_decision`, `agent`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/diff-review-gates`, `/api/diff-review-results`, `/api/diff-review-file-findings`, `/api/diff-review-artifact-findings`, `/api/diff-review-gate-results`, `/api/diff-review-desktop-boundary`, `/api/diff-review-validations`는 P222에서 self-report 대신 captured diff/touched-file/output-artifact 기준으로 검토한 결과를 read-only로 노출하며 patch application, protected write, merge, release는 계속 human-gated로 유지한다.

## 검증

```bash
npm run api:smoke
```

smoke test는 임시 포트에서 API를 띄운 뒤 `/health`, `/api`, `/api/dashboard`, `/api/stages`, `/api/actions`, `/`를 확인하고 서버를 닫는다.

## Goal 내 위치

이 단계는 `/goal`의 `dashboard/API` 완성 기준 중 API의 첫 얇은 slice다. 쓰기는 아직 금지하고, 모든 상태는 기존 Event/Audit/Approval 산출물에서 파생된 읽기 전용 view로만 제공한다.
## P223 Canonical Test Matrix Routes

Canonical Test Matrix route는 `canonical_test_matrix_status`, `repo_matrix_status`, `test_dimension`, `matrix_command_status`, `execution_status`, `matrix_result_status`, `binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/canonical-test-matrices`, `/api/canonical-test-matrix-repos`, `/api/canonical-test-matrix-commands`, `/api/canonical-test-matrix-executions`, `/api/canonical-test-matrix-results`, `/api/canonical-test-matrix-bindings`, `/api/canonical-test-matrix-desktop-boundary`, `/api/canonical-test-matrix-validations`는 P223에서 repo-derived unit/typecheck/lint/e2e 행렬과 diff-review binding을 read-only로 노출하며 Desktop은 rerun 요청 표면일 뿐 command execution source of truth가 아니다.

Dev Protected Scan route는 `dev_protected_scan_status`, `finding_status`, `secret_finding_status`, `prod_config_finding_status`, `scan_result_status`, `binding_status`, `candidate_origin`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/dev-protected-scans`, `/api/dev-protected-file-findings`, `/api/dev-secret-findings`, `/api/dev-prod-config-findings`, `/api/dev-protected-scan-results`, `/api/dev-protected-scan-bindings`, `/api/dev-protected-scan-desktop-boundary`, `/api/dev-protected-scan-validations`는 P224에서 protected file, credential/secret, production config 후보가 명시 승인 전 차단되었는지 read-only로 노출하며 raw secret material은 materialize하지 않는다.

PR Draft Artifact route는 `pr_draft_artifact_status`, `artifact_type`, `output_status`, `section_type`, `section_status`, `test_evidence_status`, `risk_status`, `rollback_status`, `pr_draft_binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/pr-draft-artifacts`, `/api/pr-draft-output-artifacts`, `/api/pr-draft-sections`, `/api/pr-draft-test-evidence`, `/api/pr-draft-risks`, `/api/pr-draft-rollback-plan`, `/api/pr-draft-bindings`, `/api/pr-draft-desktop-boundary`, `/api/pr-draft-validations`는 P225에서 summary/tests/risks/rollback이 포함된 draft OutputArtifact를 read-only로 노출하며 PR 생성, branch push, merge, release는 수행하지 않는다.

Release Note Artifact route는 `release_note_artifact_status`, `artifact_type`, `output_status`, `change_record_status`, `merged_change_basis`, `section_type`, `section_status`, `release_note_binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/release-note-artifacts`, `/api/release-note-output-artifacts`, `/api/release-note-change-records`, `/api/release-note-sections`, `/api/release-note-gate-bindings`, `/api/release-note-desktop-boundary`, `/api/release-note-validations`는 P226에서 validated PR draft merge candidate 기준 release note 초안을 read-only로 노출하며 merge, release, publication, branch push, GitHub API 호출은 수행하지 않는다.

Rollback Plan Artifact route는 `rollback_plan_artifact_status`, `artifact_type`, `output_status`, `rollback_commit_status`, `rollback_file_status`, `rollback_command_status`, `rollback_plan_binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/rollback-plan-artifacts`, `/api/rollback-plan-output-artifacts`, `/api/rollback-commit-targets`, `/api/rollback-file-targets`, `/api/rollback-command-targets`, `/api/rollback-plan-bindings`, `/api/rollback-plan-desktop-boundary`, `/api/rollback-plan-validations`는 P227에서 되돌릴 commit/file/command target을 read-only로 노출하며 rollback execution, git command, file restore, commit revert, merge, release, branch push는 수행하지 않는다.

Technical Debt Ledger route는 `technical_debt_ledger_status`, `artifact_type`, `output_status`, `finding_status`, `debt_source_type`, `debt_task_status`, `debt_preservation_status`, `debt_task_binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/technical-debt-ledgers`, `/api/technical-debt-output-artifacts`, `/api/debt-source-findings`, `/api/technical-debt-tasks`, `/api/debt-task-bindings`, `/api/technical-debt-desktop-boundary`, `/api/technical-debt-validations`는 P228에서 unresolved question과 PR risk를 read-only backlog task draft로 보존한 상태를 노출하며 task state write, issue tracker mutation, command execution, protected remediation은 수행하지 않는다.

Personal Dev Dashboard API route는 `personal_dev_dashboard_status`, `artifact_type`, `output_status`, `panel_section`, `panel_status`, `rollup_key`, `rollup_status`, `route_group`, `route_binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/personal-dev-dashboard-apis`, `/api/personal-dev-output-artifacts`, `/api/personal-dev-panel-rows`, `/api/personal-dev-status-rollups`, `/api/personal-dev-api-route-bindings`, `/api/personal-dev-dashboard-desktop-boundary`, `/api/personal-dev-dashboard-validations`는 P229에서 repo/worktree/plan/diff/test/PR 상태를 read-only panel row와 route binding으로 노출하며 task state write, issue mutation, command execution, GitHub API, PR creation, branch push, merge, release는 수행하지 않는다.

Personal Dev E2E Freeze route는 `personal_dev_e2e_freeze_status`, `personal_dev_e2e_source_status`, `personal_dev_e2e_checkpoint_status`, `e2e_trace_status`, `e2e_trace_stage`, `e2e_loop_binding_status`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/personal-dev-e2e-freezes`, `/api/personal-dev-e2e-freeze-sources`, `/api/personal-dev-e2e-freeze-checkpoints`, `/api/personal-dev-e2e-traces`, `/api/personal-dev-e2e-loop-bindings`, `/api/personal-dev-e2e-freeze-desktop-boundary`, `/api/personal-dev-e2e-freeze-validations`는 P230에서 P213-P229 personal-dev source artifact 17개, E2E trace 7개, loop binding 18개를 read-only freeze report로 노출하며 issue/task write, command execution, GitHub API, PR creation, merge, release, rollback execution, protected mutation, external agent invocation, secret exposure는 수행하지 않는다.
Matter Task Board route는 `matter_task_board_status`, `task_status`, `task_owner`, `task_category`, `task_column`, `task_due_status`, `task_workflow_binding_status`, `workflow_run_bound`, `matter_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/matter-task-board-artifacts`, `/api/matter-task-records`, `/api/matter-task-board-columns`, `/api/matter-task-workflow-bindings`, `/api/matter-task-board-boundary`, `/api/matter-task-board-validations`는 P235 Matter Task Board를 read-only로 노출하며 task, 담당자, 기한, status, workflow binding을 `matter_id` 경계 안에서 점검할 수 있지만 legal advice, client-facing output generation, matter data writes, task state writes, workflow transition, runtime execution, delivery execution은 수행하지 않는다.

Matter Knowledge Graph route는 `matter_knowledge_graph_status`, `matter_knowledge_status`, `knowledge_node_type`, `knowledge_node_status`, `knowledge_edge_type`, `knowledge_edge_status`, `legal_theory_placeholder`, `matter_id`, `boundary_status`, `read_only`, `status`, `limit` query를 지원한다. `/api/matter-knowledge-graph-artifacts`, `/api/matter-knowledge-nodes`, `/api/matter-knowledge-edges`, `/api/matter-knowledge-summaries`, `/api/matter-knowledge-graph-boundary`, `/api/matter-knowledge-graph-validations`는 P236 Matter Knowledge Graph를 read-only로 노출하며 fact, issue, legal theory placeholder, evidence를 `matter_id` 경계 안에서 점검할 수 있지만 legal advice, client-facing output generation, matter data writes, task state writes, workflow transition, runtime execution, delivery execution은 수행하지 않는다.
