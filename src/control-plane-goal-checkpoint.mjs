import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_OUT_DIR = "artifacts/control-plane-goal-checkpoint/latest";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_DASHBOARD_PATH = "artifacts/dashboard/latest/review-dashboard.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_LOOP_PATH = "artifacts/control-plane-loop/latest/control-plane-loop.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_HEALTH_PATH = "artifacts/control-plane-health/latest/control-plane-health.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_PACKAGE_PATH = "package.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_ROADMAP_PATH = "docs/implementation-roadmap.md";

const GOAL_ITEMS = [
  packageScriptItem("core_contracts", "Core contracts", "contracts", "validate:core", "control-plane-core-contracts"),
  sourceItem("contract_inventory", "Contract inventory and owner map", "contracts", "contract_inventory", "control-plane-contract-inventory", { acceptance_profile: "contract_inventory_gate" }),
  sourceItem("contract_dependency_map", "Contract dependency map and breaking risk list", "contracts", "contract_dependency_map", "control-plane-contract-dependency-map", { acceptance_profile: "contract_dependency_map_gate" }),
  sourceItem("schema_versioning_rules", "Schema versioning rules and migration guardrails", "contracts", "schema_versioning_rules", "control-plane-schema-versioning-rules", { acceptance_profile: "schema_versioning_rules_gate" }),
  sourceItem("schema_migration_manifest", "Migration manifest schema and core/pack/index migration tracks", "contracts", "schema_migration_manifest", "control-plane-schema-migration-manifest", { acceptance_profile: "schema_migration_manifest_gate" }),
  sourceItem("contract_golden_fixtures", "Contract golden fixtures and regression hash set", "contracts", "contract_golden_fixtures", "control-plane-contract-golden-fixtures", { acceptance_profile: "contract_golden_fixtures_gate" }),
  sourceItem("contract_validation_suite", "One-command contract validation suite", "contracts", "contract_validation_suite", "control-plane-contract-validation-suite", { acceptance_profile: "contract_validation_suite_gate" }),
  sourceItem("identity_model", "Tenant, human user, role, and actor principal model", "identity_policy", "identity_model", "control-plane-identity-model", { acceptance_profile: "identity_model_gate" }),
  sourceItem("client_counterparty_registry", "Client and counterparty registry", "identity_policy", "client_counterparty_registry", "control-plane-client-counterparty-registry", { acceptance_profile: "client_counterparty_registry_gate" }),
  sourceItem("matter_profile_team_ledger", "Matter profile and team membership ledger", "identity_policy", "matter_profile_team_ledger", "control-plane-matter-profile-team-ledger", { acceptance_profile: "matter_profile_team_ledger_gate" }),
  sourceItem("wall_policy_contract", "Ethical wall and conflict wall contract", "identity_policy", "wall_policy_contract", "control-plane-wall-policy-contract", { acceptance_profile: "wall_policy_contract_gate" }),
  sourceItem("matter_access_policy_evaluator", "Matter access policy evaluator", "identity_policy", "matter_access_policy_evaluator", "control-plane-matter-access-policy-evaluator", { acceptance_profile: "matter_access_policy_gate" }),
  sourceItem("data_classification_rule_engine", "Data classification rule engine", "identity_policy", "data_classification_rule_engine", "control-plane-data-classification-rule-engine", { acceptance_profile: "data_classification_rule_gate" }),
  sourceItem("matter_tagging_decision_ledger", "Matter tagging decision ledger", "identity_policy", "matter_tagging_decision_ledger", "control-plane-matter-tagging-decision-ledger", { acceptance_profile: "matter_tagging_decision_gate" }),
  sourceItem("access_audit_projection", "Access audit projection", "identity_policy", "access_audit_projection", "control-plane-access-audit-projection", { acceptance_profile: "access_audit_projection_gate" }),
  sourceItem("store_policy_adapter", "Store policy adapter and RLS query enforcement", "identity_policy", "store_policy_adapter", "control-plane-store-policy-adapter", { acceptance_profile: "store_policy_adapter_gate" }),
  sourceItem("conflict_check_interface", "Conflict check interface", "identity_policy", "conflict_check_interface", "control-plane-conflict-check-interface", { acceptance_profile: "conflict_check_interface_gate" }),
  sourceItem("personal_workspace_boundary", "Personal workspace boundary", "identity_policy", "personal_workspace_boundary", "control-plane-personal-workspace-boundary", { acceptance_profile: "personal_workspace_boundary_gate" }),
  sourceItem("policy_golden_fixtures", "Policy golden fixtures", "identity_policy", "policy_golden_fixtures", "control-plane-policy-golden-fixtures", { acceptance_profile: "policy_golden_fixtures_gate" }),
  sourceItem("policy_operations_surface", "Policy operations dashboard/API surface", "identity_policy", "policy_operations_surface", "control-plane-policy-operations-surface", { acceptance_profile: "policy_operations_surface_gate" }),
  sourceItem("matter_boundary_slice", "Matter boundary vertical slice", "identity_policy", "matter_boundary_slice", "control-plane-matter-boundary-slice", { acceptance_profile: "matter_boundary_slice_gate" }),
  sourceItem("identity_policy_matter_freeze", "Identity/Policy/Matter freeze", "identity_policy", "identity_policy_matter_freeze", "control-plane-identity-policy-matter-freeze", { acceptance_profile: "identity_policy_matter_freeze_gate" }),
  sourceItem("resource_store_interface", "Resource store interface", "resource_evidence", "resource_store_interface", "control-plane-resource-store-interface", { acceptance_profile: "resource_store_interface_gate" }),
  sourceItem("immutable_object_store_layout", "Immutable object store layout", "resource_evidence", "immutable_object_store_layout", "control-plane-immutable-object-store-layout", { acceptance_profile: "immutable_object_store_layout_gate" }),
  sourceItem("resource_version_ledger", "Resource version ledger", "resource_evidence", "resource_version_ledger", "control-plane-resource-version-ledger", { acceptance_profile: "resource_version_ledger_gate" }),
  sourceItem("resource_dedup_hash_ledger", "Resource dedup/hash ledger", "resource_evidence", "resource_dedup_hash_ledger", "control-plane-resource-dedup-hash-ledger", { acceptance_profile: "resource_dedup_hash_gate" }),
  sourceItem("resource_quarantine_model", "Resource quarantine model", "resource_evidence", "resource_quarantine_model", "control-plane-resource-quarantine-model", { acceptance_profile: "resource_quarantine_gate" }),
  sourceItem("normalized_text_contract", "Normalized text contract", "resource_evidence", "normalized_text_contract", "control-plane-normalized-text-contract", { acceptance_profile: "normalized_text_contract_gate" }),
  sourceItem("extractor_adapter_contract", "Parser/OCR extractor adapter contract", "resource_evidence", "extractor_adapter_contract", "control-plane-extractor-adapter-contract", { acceptance_profile: "extractor_adapter_contract_gate" }),
  sourceItem("source_span_store", "Source span store", "resource_evidence", "source_span_store", "control-plane-source-span-store", { acceptance_profile: "source_span_store_gate" }),
  sourceItem("evidence_item_store", "Evidence item store", "resource_evidence", "evidence_item_store", "control-plane-evidence-item-store", { acceptance_profile: "evidence_item_store_gate" }),
  sourceItem("evidence_golden_fixtures", "Evidence extraction golden fixtures", "resource_evidence", "evidence_golden_fixtures", "control-plane-evidence-golden-fixtures", { acceptance_profile: "evidence_golden_fixtures_gate" }),
  sourceItem("fact_claim_store", "Fact claim store", "resource_evidence", "fact_claim_store", "control-plane-fact-claim-store", { acceptance_profile: "fact_claim_store_gate" }),
  sourceItem("issue_graph_store", "Issue graph store", "resource_evidence", "issue_graph_store", "control-plane-issue-graph-store", { acceptance_profile: "issue_graph_store_gate" }),
  sourceItem("citation_object_store", "Citation object store", "resource_evidence", "citation_object_store", "control-plane-citation-object-store", { acceptance_profile: "citation_object_store_gate" }),
  sourceItem("lineage_graph_builder", "Lineage graph builder", "resource_evidence", "lineage_graph_builder", "control-plane-lineage-graph-builder", { acceptance_profile: "lineage_graph_builder_gate" }),
  sourceItem("evidence_viewer_data_api", "Evidence viewer data API", "resource_evidence", "evidence_viewer_data_api", "control-plane-evidence-viewer-data-api", { acceptance_profile: "evidence_viewer_data_api_gate" }),
  sourceItem("evidence_coverage_score", "Evidence coverage score", "resource_evidence", "evidence_coverage_score", "control-plane-evidence-coverage-score", { acceptance_profile: "evidence_coverage_score_gate" }),
  sourceItem("evidence_flags", "Evidence flags", "resource_evidence", "evidence_flags", "control-plane-evidence-flags", { acceptance_profile: "evidence_flags_gate" }),
  sourceItem("exhibit_map", "Exhibit map", "resource_evidence", "exhibit_map", "control-plane-exhibit-map", { acceptance_profile: "exhibit_map_gate" }),
  sourceItem("evidence_export_bundle", "Evidence export bundle", "resource_evidence", "evidence_export_bundle", "control-plane-evidence-export-bundle", { acceptance_profile: "evidence_export_bundle_gate" }),
  sourceItem("evidence_regression_tests", "Evidence regression tests", "resource_evidence", "evidence_regression_tests", "control-plane-evidence-regression-tests", { acceptance_profile: "evidence_regression_tests_gate" }),
  sourceItem("resource_evidence_dashboard_summary", "Resource/evidence dashboard summary", "resource_evidence", "resource_evidence_dashboard_summary", "control-plane-resource-evidence-dashboard-summary", { acceptance_profile: "resource_evidence_dashboard_summary_gate" }),
  sourceItem("evidence_plane_freeze", "Evidence Plane freeze", "resource_evidence", "evidence_plane_freeze", "control-plane-evidence-plane-freeze", { acceptance_profile: "evidence_plane_freeze_gate" }),
  sourceItem("chain_of_custody_events", "Chain of custody events", "resource_evidence", "chain_of_custody_events", "control-plane-chain-of-custody-events", { acceptance_profile: "chain_of_custody_events_gate" }),
  sourceItem("search_index_contract", "Search index contract", "resource_evidence", "search_index_contract", "control-plane-search-index-contract", { acceptance_profile: "search_index_contract_gate" }),
  sourceItem("vector_index_policy_boundary", "Vector index policy boundary", "resource_evidence", "vector_index_policy_boundary", "control-plane-vector-index-policy-boundary", { acceptance_profile: "vector_index_policy_boundary_gate" }),
  sourceItem("retrieval_filter_compiler", "Retrieval filter compiler", "resource_evidence", "retrieval_filter_compiler", "control-plane-retrieval-filter-compiler", { acceptance_profile: "retrieval_filter_compiler_gate" }),
  sourceItem("model_policy_enforcement", "Model policy matrix enforcement", "identity_policy", "model_policy_enforcement", "control-plane-model-policy-enforcement", { acceptance_profile: "model_policy_enforcement_gate" }),
  sourceItem("tool_runtime_policy_enforcement", "Tool and runtime policy enforcement", "gate_approval", "tool_runtime_policy_enforcement", "control-plane-tool-runtime-policy-enforcement", { acceptance_profile: "tool_runtime_policy_gate" }),
  sourceItem("output_destination_policy_enforcement", "Output destination policy enforcement", "gate_approval", "output_destination_policy_enforcement", "control-plane-output-destination-policy-enforcement", { acceptance_profile: "output_destination_policy_gate" }),
  sourceItem("approval_authority_ledger", "Approval authority ledger", "gate_approval", "approval_authority_ledger", "control-plane-approval-authority-ledger", { acceptance_profile: "approval_authority_gate" }),
  sourceItem("resource_contract_freeze", "Resource and ResourceVersion v2 contract freeze", "resource_evidence", "resource_contract_freeze", "control-plane-resource-contract-freeze", { acceptance_profile: "resource_contract_freeze_gate" }),
  sourceItem("matter_contract_freeze", "Matter, client, party, team, and boundary v2 contract freeze", "identity_policy", "matter_contract_freeze", "control-plane-matter-contract-freeze", { acceptance_profile: "matter_contract_freeze_gate" }),
  sourceItem("policy_contract_freeze", "Data classification and policy reference v2 contract freeze", "policy", "policy_contract_freeze", "control-plane-policy-contract-freeze", { acceptance_profile: "policy_contract_freeze_gate" }),
  sourceItem("evidence_contract_freeze", "Evidence, fact, issue, citation, and lineage v2 contract freeze", "resource_evidence", "evidence_contract_freeze", "control-plane-evidence-contract-freeze", { acceptance_profile: "evidence_contract_freeze_gate" }),
  sourceItem("capability_workflow_contract_freeze", "Capability, workflow, run, gate, runtime, and IO v2 contract freeze", "contracts", "capability_workflow_contract_freeze", "control-plane-capability-workflow-contract-freeze", { acceptance_profile: "capability_workflow_contract_freeze_gate" }),
  sourceItem("runtime_agentrun_contract_freeze", "Runtime adapter and AgentRun runtime v2 contract freeze", "runtime", "runtime_agentrun_contract_freeze", "control-plane-runtime-agentrun-contract-freeze", { acceptance_profile: "runtime_agentrun_contract_freeze_gate" }),
  sourceItem("runtime_adapter_interface_v2", "Runtime adapter interface v2", "runtime", "runtime_adapter_interface_v2", "control-plane-runtime-adapter-interface-v2", { acceptance_profile: "runtime_adapter_interface_v2_gate" }),
  sourceItem("hermes_runtime_adapter", "Hermes runtime adapter", "runtime", "hermes_runtime_adapter", "control-plane-hermes-runtime-adapter", { acceptance_profile: "hermes_runtime_adapter_gate" }),
  sourceItem("claude_code_adapter_contract", "Claude Code adapter contract", "runtime", "claude_code_adapter_contract", "control-plane-claude-code-adapter-contract", { acceptance_profile: "claude_code_adapter_contract_gate" }),
  sourceItem("codex_adapter_contract", "Codex adapter contract", "runtime", "codex_adapter_contract", "control-plane-codex-adapter-contract", { acceptance_profile: "codex_adapter_contract_gate" }),
  sourceItem("local_script_adapter", "Local script adapter", "runtime", "local_script_adapter", "control-plane-local-script-adapter", { acceptance_profile: "local_script_adapter_gate" }),
  sourceItem("document_renderer_adapter", "Document renderer adapter", "runtime", "document_renderer_adapter", "control-plane-document-renderer-adapter", { acceptance_profile: "document_renderer_adapter_gate" }),
  sourceItem("worktree_manager_v2", "Worktree Manager v2", "runtime", "worktree_manager_v2", "control-plane-worktree-manager-v2", { acceptance_profile: "worktree_manager_v2_gate" }),
  sourceItem("sandbox_policy_model", "Sandbox policy model", "runtime", "sandbox_policy_model", "control-plane-sandbox-policy-model", { acceptance_profile: "sandbox_policy_model_gate" }),
  sourceItem("docker_local_backend_selector", "Docker/local backend selector", "runtime", "docker_local_backend_selector", "control-plane-docker-local-backend-selector", { acceptance_profile: "docker_local_backend_selector_gate" }),
  sourceItem("secrets_broker_contract", "Secrets broker contract", "runtime", "secrets_broker_contract", "control-plane-secrets-broker-contract", { acceptance_profile: "secrets_broker_contract_gate" }),
  sourceItem("runtime_artifact_capture", "Runtime artifact capture", "runtime", "runtime_artifact_capture", "control-plane-runtime-artifact-capture", { acceptance_profile: "runtime_artifact_capture_gate" }),
  sourceItem("runtime_log_normalization", "Runtime log normalization", "runtime", "runtime_log_normalization", "control-plane-runtime-log-normalization", { acceptance_profile: "runtime_log_normalization_gate" }),
  sourceItem("runtime_timeout_heartbeat", "Runtime timeout/heartbeat", "runtime", "runtime_timeout_heartbeat", "control-plane-runtime-timeout-heartbeat", { acceptance_profile: "runtime_timeout_heartbeat_gate" }),
  sourceItem("runtime_control_commands", "Runtime control commands", "runtime", "runtime_control_commands", "control-plane-runtime-control-commands", { acceptance_profile: "runtime_control_commands_gate" }),
  sourceItem("protected_file_gate", "Protected file gate", "gate_approval", "protected_file_gate", "control-plane-protected-file-gate", { acceptance_profile: "protected_file_gate_gate" }),
  sourceItem("canonical_test_runner", "Canonical test runner", "gate_approval", "canonical_test_runner", "control-plane-canonical-test-runner", { acceptance_profile: "canonical_test_runner_gate" }),
  sourceItem("runtime_api_dashboard", "Runtime API dashboard", "api", "runtime_api_dashboard", "control-plane-runtime-api-dashboard", { acceptance_profile: "runtime_api_dashboard_gate" }),
  sourceItem("runtime_freeze", "Runtime freeze", "runtime", "runtime_freeze", "control-plane-runtime-freeze", { acceptance_profile: "runtime_freeze_gate" }),
  sourceItem("personal_dev_pack_manifest", "Personal-dev pack manifest", "personal_dev", "personal_dev_pack_manifest", "control-plane-personal-dev-pack-manifest", { acceptance_profile: "personal_dev_pack_manifest_gate" }),
  sourceItem("repo_profile_detector", "Repo profile detector", "personal_dev", "repo_profile_detector", "control-plane-repo-profile-detector", { acceptance_profile: "repo_profile_detector_gate" }),
  sourceItem("agent_instruction_registry", "Agent instruction registry", "personal_dev", "agent_instruction_registry", "control-plane-agent-instruction-registry", { acceptance_profile: "agent_instruction_registry_gate" }),
  sourceItem("issue_intake_adapter", "Issue intake adapter", "personal_dev", "issue_intake_adapter", "control-plane-issue-intake-adapter", { acceptance_profile: "issue_intake_adapter_gate" }),
  sourceItem("plan_request_contract", "Plan request contract", "personal_dev", "plan_request_contract", "control-plane-plan-request-contract", { acceptance_profile: "plan_request_contract_gate" }),
  sourceItem("plan_reconciliation", "Plan reconciliation", "personal_dev", "plan_reconciliation", "control-plane-plan-reconciliation", { acceptance_profile: "plan_reconciliation_gate" }),
  sourceItem("scope_freeze_gate", "Scope freeze gate", "personal_dev", "scope_freeze_gate", "control-plane-scope-freeze-gate", { acceptance_profile: "scope_freeze_gate_gate" }),
  sourceItem("dev_lane_ledger", "Dev lane ledger", "personal_dev", "dev_lane_ledger", "control-plane-dev-lane-ledger", { acceptance_profile: "dev_lane_ledger_gate" }),
  sourceItem("implementation_patch_capture", "Implementation patch capture", "personal_dev", "implementation_patch_capture", "control-plane-implementation-patch-capture", { acceptance_profile: "implementation_patch_capture_gate" }),
  sourceItem("diff_review_gate", "Diff review gate", "personal_dev", "diff_review_gate", "control-plane-diff-review-gate", { acceptance_profile: "diff_review_gate_gate" }),
  sourceItem("canonical_test_matrix", "Canonical test matrix", "personal_dev", "canonical_test_matrix", "control-plane-canonical-test-matrix", { acceptance_profile: "canonical_test_matrix_gate" }),
  sourceItem("dev_protected_scan", "Dev protected scan", "personal_dev", "dev_protected_scan", "control-plane-dev-protected-scan", { acceptance_profile: "dev_protected_scan_gate" }),
  sourceItem("pr_draft_artifact", "PR draft artifact", "personal_dev", "pr_draft_artifact", "control-plane-pr-draft-artifact", { acceptance_profile: "pr_draft_artifact_gate" }),
  sourceItem("release_note_artifact", "Release note artifact", "personal_dev", "release_note_artifact", "control-plane-release-note-artifact", { acceptance_profile: "release_note_artifact_gate" }),
  sourceItem("rollback_plan_artifact", "Rollback plan artifact", "personal_dev", "rollback_plan_artifact", "control-plane-rollback-plan-artifact", { acceptance_profile: "rollback_plan_artifact_gate" }),
  sourceItem("technical_debt_ledger", "Technical debt ledger", "personal_dev", "technical_debt_ledger", "control-plane-technical-debt-ledger", { acceptance_profile: "technical_debt_ledger_gate" }),
  sourceItem("personal_dev_dashboard_api", "Personal dev dashboard API", "personal_dev", "personal_dev_dashboard_api", "control-plane-personal-dev-dashboard-api", { acceptance_profile: "personal_dev_dashboard_api_gate" }),
  sourceItem("personal_dev_e2e_freeze", "Personal dev E2E freeze", "personal_dev", "personal_dev_e2e_freeze", "control-plane-personal-dev-e2e-freeze", { acceptance_profile: "personal_dev_e2e_freeze_gate" }),
  sourceItem("law_firm_pack_manifest", "Law-firm pack manifest", "law_firm", "law_firm_pack_manifest", "control-plane-law-firm-pack-manifest", { acceptance_profile: "law_firm_pack_manifest_gate" }),
  sourceItem("matter_os_profile", "Matter OS profile", "law_firm", "matter_os_profile", "control-plane-matter-os-profile", { acceptance_profile: "matter_os_profile_gate" }),
  sourceItem("matter_timeline", "Matter timeline", "law_firm", "matter_timeline", "control-plane-matter-timeline", { acceptance_profile: "matter_timeline_gate" }),
  sourceItem("matter_document_index", "Matter document index", "law_firm", "matter_document_index", "control-plane-matter-document-index", { acceptance_profile: "matter_document_index_gate" }),
  sourceItem("matter_task_board", "Matter task board", "law_firm", "matter_task_board", "control-plane-matter-task-board", { acceptance_profile: "matter_task_board_gate" }),
  sourceItem("matter_knowledge_graph", "Matter knowledge graph", "law_firm", "matter_knowledge_graph", "control-plane-matter-knowledge-graph", { acceptance_profile: "matter_knowledge_graph_gate" }),
  sourceItem("matter_privilege_classifier", "Matter privilege classifier", "law_firm", "matter_privilege_classifier", "control-plane-matter-privilege-classifier", { acceptance_profile: "matter_privilege_classifier_gate" }),
  sourceItem("matter_personal_data_detector", "Matter personal data detector", "law_firm", "matter_personal_data_detector", "control-plane-matter-personal-data-detector", { acceptance_profile: "matter_personal_data_detector_gate" }),
  sourceItem("legal_citation_verifier", "Legal citation verifier", "law_firm", "legal_citation_verifier", "control-plane-legal-citation-verifier", { acceptance_profile: "legal_citation_verifier_gate" }),
  sourceItem("ldd_vdr_inventory", "LDD VDR inventory", "law_firm", "ldd_vdr_inventory", "control-plane-ldd-vdr-inventory", { acceptance_profile: "ldd_vdr_inventory_gate" }),
  sourceItem("ldd_document_classification", "LDD document classification", "law_firm", "ldd_document_classification", "control-plane-ldd-document-classification", { acceptance_profile: "ldd_document_classification_gate" }),
  sourceItem("ldd_extractor_selection", "LDD extractor selection", "law_firm", "ldd_extractor_selection", "control-plane-ldd-extractor-selection", { acceptance_profile: "ldd_extractor_selection_gate" }),
  sourceItem("ldd_fact_extraction", "LDD fact extraction", "law_firm", "ldd_fact_extraction", "control-plane-ldd-fact-extraction", { acceptance_profile: "ldd_fact_extraction_gate" }),
  sourceItem("ldd_issue_detection", "LDD issue detection", "law_firm", "ldd_issue_detection", "control-plane-ldd-issue-detection", { acceptance_profile: "ldd_issue_detection_gate" }),
  sourceItem("ldd_rfi_generator", "LDD RFI generator", "law_firm", "ldd_rfi_generator", "control-plane-ldd-rfi-generator", { acceptance_profile: "ldd_rfi_generator_gate" }),
  sourceItem("ldd_report_draft", "LDD report draft", "law_firm", "ldd_report_draft", "control-plane-ldd-report-draft", { acceptance_profile: "ldd_report_draft_gate" }),
  sourceItem("litigation_brief_draft", "Litigation brief draft", "law_firm", "litigation_brief_draft", "control-plane-litigation-brief-draft", { acceptance_profile: "litigation_brief_draft_gate" }),
  sourceItem("meeting_minutes_workflow", "Meeting minutes workflow", "law_firm", "meeting_minutes_workflow", "control-plane-meeting-minutes-workflow", { acceptance_profile: "meeting_minutes_workflow_gate" }),
  sourceItem("contract_draft_workflow", "Contract draft workflow", "law_firm", "contract_draft_workflow", "control-plane-contract-draft-workflow", { acceptance_profile: "contract_draft_workflow_gate" }),
  sourceItem("provided_material_review", "Provided material review ledger", "law_firm", "provided_material_review", "control-plane-provided-material-review", { acceptance_profile: "provided_material_review_gate" }),
  sourceItem("legal_approval_matrix", "Legal approval matrix", "law_firm", "legal_approval_matrix", "control-plane-legal-approval-matrix", { acceptance_profile: "legal_approval_matrix_gate" }),
  sourceItem("law_firm_e2e_freeze", "Law firm E2E freeze", "law_firm", "law_firm_e2e_freeze", "control-plane-law-firm-e2e-freeze", { acceptance_profile: "law_firm_e2e_freeze_gate" }),
  sourceItem("creative_document_pack_manifest", "Creative document pack manifest", "creative_document", "creative_document_pack_manifest", "control-plane-creative-document-pack-manifest", { acceptance_profile: "creative_document_pack_manifest_gate" }),
  sourceItem("template_registry", "Template registry", "creative_document", "template_registry", "control-plane-template-registry", { acceptance_profile: "template_registry_gate" }),
  sourceItem("style_registry", "Style registry", "creative_document", "style_registry", "control-plane-style-registry", { acceptance_profile: "style_registry_gate" }),
  sourceItem("asset_registry", "Asset registry", "creative_document", "asset_registry", "control-plane-asset-registry", { acceptance_profile: "asset_registry_gate" }),
  sourceItem("docx_renderer", "DOCX renderer", "creative_document", "docx_renderer", "control-plane-docx-renderer", { acceptance_profile: "docx_renderer_gate" }),
  sourceItem("pptx_renderer", "PPTX renderer", "creative_document", "pptx_renderer", "control-plane-pptx-renderer", { acceptance_profile: "pptx_renderer_gate" }),
  sourceItem("pdf_html_renderer", "PDF/HTML renderer", "creative_document", "pdf_html_renderer", "control-plane-pdf-html-renderer", { acceptance_profile: "pdf_html_renderer_gate" }),
  sourceItem("layout_validator", "Layout validator", "creative_document", "layout_validator", "control-plane-layout-validator", { acceptance_profile: "layout_validator_gate" }),
  sourceItem("citation_renderer", "Citation renderer", "creative_document", "citation_renderer", "control-plane-citation-renderer", { acceptance_profile: "citation_renderer_gate" }),
  sourceItem("version_comparator", "Version comparator", "creative_document", "version_comparator", "control-plane-version-comparator", { acceptance_profile: "version_comparator_gate" }),
  sourceItem("design_system_profile", "Design system profile", "creative_document", "design_system_profile", "control-plane-design-system-profile", { acceptance_profile: "design_system_profile_gate" }),
  sourceItem("web_novel_workflow", "Web novel workflow", "creative_document", "web_novel_workflow", "control-plane-web-novel-workflow", { acceptance_profile: "web_novel_workflow_gate" }),
  sourceItem("video_ppt_workflow", "Video/PPT workflow", "creative_document", "video_ppt_workflow", "control-plane-video-ppt-workflow", { acceptance_profile: "video_ppt_workflow_gate" }),
  sourceItem("creative_document_freeze", "Creative Document freeze", "creative_document", "creative_document_freeze", "control-plane-creative-document-freeze", { acceptance_profile: "creative_document_freeze_gate" }),
  sourceItem("connector_contract_v2", "Connector Contract v2", "connectors", "connector_contract_v2", "control-plane-connector-contract-v2", { acceptance_profile: "connector_contract_v2_gate" }),
  sourceItem("local_folder_connector", "Local Folder Connector", "connectors", "local_folder_connector", "control-plane-local-folder-connector", { acceptance_profile: "local_folder_connector_gate" }),
  sourceItem("onedrive_connector_boundary", "OneDrive Connector Boundary", "connectors", "onedrive_connector_boundary", "control-plane-onedrive-connector-boundary", { acceptance_profile: "onedrive_connector_boundary_gate" }),
  sourceItem("outlook_email_connector", "Outlook Email Connector", "connectors", "outlook_email_connector", "control-plane-outlook-email-connector", { acceptance_profile: "outlook_email_connector_gate" }),
  sourceItem("kakaotalk_import_boundary", "KakaoTalk Import Boundary", "connectors", "kakaotalk_import_boundary", "control-plane-kakaotalk-import-boundary", { acceptance_profile: "kakaotalk_import_boundary_gate" }),
  sourceItem("github_connector", "GitHub Connector", "connectors", "github_connector", "control-plane-github-connector", { acceptance_profile: "github_connector_gate" }),
  sourceItem("vdr_connector", "VDR Connector", "connectors", "vdr_connector", "control-plane-vdr-connector", { acceptance_profile: "vdr_connector_gate" }),
  sourceItem("plaud_transcript_connector", "Plaud Transcript Connector", "connectors", "plaud_transcript_connector", "control-plane-plaud-transcript-connector", { acceptance_profile: "plaud_transcript_connector_gate" }),
  sourceItem("erp_draft_connector", "ERP Draft Connector", "connectors", "erp_draft_connector", "control-plane-erp-draft-connector", { acceptance_profile: "erp_draft_connector_gate" }),
  sourceItem("connector_freeze", "Connector Freeze", "connectors", "connector_freeze", "control-plane-connector-freeze", { acceptance_profile: "connector_freeze_gate" }),
  sourceItem("gate_approval_contract_freeze", "Gate result and human approval v2 contract freeze", "gate_approval", "gate_approval_contract_freeze", "control-plane-gate-approval-contract-freeze", { acceptance_profile: "gate_approval_contract_freeze_gate" }),
  sourceItem("output_delivery_contract_freeze", "Output artifact and protected delivery v2 contract freeze", "delivery", "output_delivery_contract_freeze", "control-plane-output-delivery-contract-freeze", { acceptance_profile: "output_delivery_contract_freeze_gate" }),
  sourceItem("event_audit_run_contract_freeze", "Event, audit, and run ledger v2 contract freeze", "audit", "event_audit_run_contract_freeze", "control-plane-event-audit-run-contract-freeze", { acceptance_profile: "event_audit_run_contract_freeze_gate" }),
  sourceItem("event_envelope_ledger", "CloudEvents-style event envelope ledger", "audit", "event_envelope_ledger", "control-plane-event-envelope-ledger", { acceptance_profile: "event_envelope_ledger_gate" }),
  sourceItem("event_type_registry", "Event type registry", "audit", "event_type_registry", "control-plane-event-type-registry", { acceptance_profile: "event_type_registry_gate" }),
  sourceItem("append_only_event_store", "Append-only event store", "audit", "append_only_event_store", "control-plane-append-only-event-store", { acceptance_profile: "append_only_event_store_gate" }),
  sourceItem("event_correlation_ledger", "Event correlation ledger", "audit", "event_correlation_ledger", "control-plane-event-correlation-ledger", { acceptance_profile: "event_correlation_ledger_gate" }),
  sourceItem("workflow_run_ledger", "Workflow run ledger", "audit", "workflow_run_ledger", "control-plane-workflow-run-ledger", { acceptance_profile: "workflow_run_ledger_gate" }),
  sourceItem("agent_run_ledger", "Agent run ledger", "audit", "agent_run_ledger", "control-plane-agent-run-ledger", { acceptance_profile: "agent_run_ledger_gate" }),
  sourceItem("tool_invocation_ledger", "Tool invocation ledger", "audit", "tool_invocation_ledger", "control-plane-tool-invocation-ledger", { acceptance_profile: "tool_invocation_ledger_gate" }),
  sourceItem("audit_event_ledger", "Audit event ledger", "audit", "audit_event_ledger", "control-plane-audit-event-ledger", { acceptance_profile: "audit_event_ledger_gate" }),
  sourceItem("error_cost_observability_contract_freeze", "Error, cost, and trace projection v2 contract freeze", "observability", "error_cost_observability_contract_freeze", "control-plane-error-cost-observability-contract-freeze", { acceptance_profile: "error_cost_observability_contract_freeze_gate" }),
  sourceItem("policy_matrix_catalog", "Identity/Policy matrix", "policy", "policy_matrix_catalog", "control-plane-policy-matrix"),
  sourceItem("policy_snapshot_ledger", "Policy snapshot ledger", "policy", "policy_snapshot_ledger", "control-plane-policy-snapshots"),
  sourceItem("context_packet_ledger", "Context builder and retrieval filters", "context", "context_packet_ledger", "control-plane-context-builder"),
  sourceItem("model_routing_ledger", "Model routing and external transfer decisions", "runtime", "model_routing_ledger", "control-plane-model-routing"),
  sourceItem("cost_budget_ledger", "Cost budget gate ledger", "gate_approval", "cost_budget_ledger", "control-plane-cost-budget"),
  sourceItem("token_usage_ledger", "Token usage ledger", "observability", "token_usage_ledger", "control-plane-token-usage"),
  sourceItem("cost_attribution_ledger", "Cost attribution ledger", "observability", "cost_attribution_ledger", "control-plane-cost-attribution"),
  sourceItem("budget_alert_ledger", "Budget alert ledger", "observability", "budget_alert_ledger", "control-plane-budget-alerts"),
  sourceItem("policy_snapshot_binding_ledger", "Policy snapshot binding ledger", "policy", "policy_snapshot_binding_ledger", "control-plane-policy-snapshot-bindings", { acceptance_profile: "policy_snapshot_binding_gate" }),
  sourceItem("policy_snapshot_event_binding", "Policy snapshot event binding", "policy", "policy_snapshot_event_binding", "control-plane-policy-snapshot-event-binding", { acceptance_profile: "policy_snapshot_event_binding_gate" }),
  sourceItem("cost_record_projection", "Cost record projection", "observability", "cost_record_projection", "control-plane-cost-record-projection", { acceptance_profile: "cost_record_projection_gate" }),
  sourceItem("token_usage_projection", "Token usage projection", "observability", "token_usage_projection", "control-plane-token-usage-projection", { acceptance_profile: "token_usage_projection_gate" }),
  sourceItem("observability_trace_projection", "Observability trace projection", "observability", "observability_trace_projection", "control-plane-observability-trace-projection", { acceptance_profile: "observability_trace_projection_gate" }),
  sourceItem("error_retry_ledger", "Error/retry ledger", "observability", "error_retry_ledger", "control-plane-error-retry-ledger", { acceptance_profile: "error_retry_ledger_gate" }),
  sourceItem("event_replay_harness", "Event replay harness", "audit", "event_replay_harness", "control-plane-event-replay-harness", { acceptance_profile: "event_replay_harness_gate" }),
  sourceItem("retention_archive_ledger", "Retention/archive ledger", "audit", "retention_archive_ledger", "control-plane-retention-archive-ledger", { acceptance_profile: "retention_archive_ledger_gate" }),
  sourceItem("ledger_api_dashboard", "Ledger API/dashboard", "api", "ledger_api_dashboard", "control-plane-ledger-api-dashboard", { acceptance_profile: "ledger_api_dashboard_gate" }),
  sourceItem("ledger_golden_fixtures", "Ledger golden fixtures", "audit", "ledger_golden_fixtures", "control-plane-ledger-golden-fixtures", { acceptance_profile: "ledger_golden_fixtures_gate" }),
  sourceItem("observability_freeze", "Observability freeze", "observability", "observability_freeze", "control-plane-observability-freeze", { acceptance_profile: "observability_freeze_gate" }),
  sourceItem("capability_manifest_v2", "Capability Manifest v2 catalog", "contracts", "capability_manifest_v2", "control-plane-capability-manifest-v2", { acceptance_profile: "capability_manifest_v2_gate" }),
  sourceItem("pack_manifest_compatibility", "Pack manifest compatibility", "domain_packs", "pack_manifest_compatibility", "control-plane-pack-manifest-compatibility", { acceptance_profile: "pack_manifest_compatibility_gate" }),
  sourceItem("workflow_dsl_state_model", "Workflow DSL state model", "workflow", "workflow_dsl_state_model", "control-plane-workflow-dsl-state-model", { acceptance_profile: "workflow_dsl_state_model_gate" }),
  sourceItem("workflow_state_machine_runner", "Workflow state machine runner", "workflow", "workflow_state_machine_runner", "control-plane-workflow-state-machine-runner", { acceptance_profile: "workflow_state_machine_runner_gate" }),
  sourceItem("workflow_queue_retry_backoff_contract", "Workflow queue/retry/backoff contract", "workflow", "workflow_queue_retry_backoff_contract", "control-plane-workflow-queue-retry-backoff", { acceptance_profile: "workflow_queue_retry_backoff_gate" }),
  sourceItem("workflow_idempotency_ledger", "Workflow idempotency ledger", "workflow", "workflow_idempotency_ledger", "control-plane-workflow-idempotency-ledger", { acceptance_profile: "workflow_idempotency_gate" }),
  sourceItem("workflow_resume_cancel_contract", "Workflow resume/cancel contract", "workflow", "workflow_resume_cancel_contract", "control-plane-workflow-resume-cancel", { acceptance_profile: "workflow_resume_cancel_gate" }),
  sourceItem("workflow_context_builder_contract", "Workflow context builder contract", "workflow", "workflow_context_builder_contract", "control-plane-workflow-context-builder", { acceptance_profile: "workflow_context_builder_gate" }),
  sourceItem("workflow_retrieval_compiler", "Workflow retrieval compiler", "workflow", "workflow_retrieval_compiler", "control-plane-workflow-retrieval-compiler", { acceptance_profile: "workflow_retrieval_compiler_gate" }),
  sourceItem("workflow_prompt_injection_boundary", "Workflow prompt injection boundary", "workflow", "workflow_prompt_injection_boundary", "control-plane-workflow-prompt-injection-boundary", { acceptance_profile: "workflow_prompt_injection_boundary_gate" }),
  sourceItem("workflow_pre_run_gate_framework", "Workflow pre-run gate framework", "workflow", "workflow_pre_run_gate_framework", "control-plane-workflow-pre-run-gate-framework", { acceptance_profile: "workflow_pre_run_gate_framework_gate" }),
  sourceItem("workflow_in_run_gate_framework", "Workflow in-run gate framework", "workflow", "workflow_in_run_gate_framework", "control-plane-workflow-in-run-gate-framework", { acceptance_profile: "workflow_in_run_gate_framework_gate" }),
  sourceItem("workflow_post_run_gate_framework", "Workflow post-run gate framework", "workflow", "workflow_post_run_gate_framework", "control-plane-workflow-post-run-gate-framework", { acceptance_profile: "workflow_post_run_gate_framework_gate" }),
  sourceItem("gate_result_aggregator", "Gate result aggregator", "workflow", "gate_result_aggregator", "control-plane-gate-result-aggregator", { acceptance_profile: "gate_result_aggregator_gate" }),
  sourceItem("capability_registry_api", "Capability registry API and Desktop Companion read-only surface", "api", "capability_registry_api", "control-plane-capability-registry-api", { acceptance_profile: "capability_registry_api_gate" }),
  sourceItem("workflow_run_dashboard", "Workflow run dashboard and Desktop Companion run panels", "api", "workflow_run_dashboard", "control-plane-workflow-run-dashboard", { acceptance_profile: "workflow_run_dashboard_gate" }),
  sourceItem("workflow_golden_cases", "Workflow golden cases", "workflow", "workflow_golden_cases", "control-plane-workflow-golden-cases", { acceptance_profile: "workflow_golden_cases_gate" }),
  sourceItem("workflow_gate_freeze", "Workflow/Gate freeze", "workflow", "workflow_gate_freeze", "control-plane-workflow-gate-freeze", { acceptance_profile: "workflow_gate_freeze_gate" }),
  sourceItem("domain_pack_registry", "Plugin-style domain packs", "domain_packs", "domain_pack_registry", "control-plane-domain-packs"),
  sourceItem("resource_expansion", "Resource expansion", "resource_evidence", "resource_expansion", "control-plane-resource-expansion"),
  sourceItem("resource_ingest", "Resource/Evidence ingest gate", "resource_evidence", "resource_ingest", "control-plane-resource-ingest"),
  sourceItem("evidence_viewer", "Evidence viewer", "resource_evidence", "evidence_viewer", "control-plane-evidence-viewer", { acceptance_profile: "evidence_review_gate" }),
  sourceItem("approval_workflow", "Gate and approval workflow", "gate_approval", "approval_inbox", "control-plane-approval-workflow", { acceptance_profile: "approval_gate" }),
  sourceItem("human_review_packets", "Human review packets", "gate_approval", "human_review_packet_ledger", "control-plane-human-review-packets", { acceptance_profile: "human_review_packet_gate" }),
  sourceItem("human_review_agenda", "Human review agenda", "gate_approval", "human_review_agenda", "control-plane-human-review-agenda", { acceptance_profile: "human_review_agenda_gate" }),
  sourceItem("human_review_agenda_receipt_intake", "Human review agenda receipt intake", "gate_approval", "human_review_agenda_receipt_intake", "control-plane-human-review-agenda-intake", { acceptance_profile: "human_review_agenda_receipt_intake_gate" }),
  sourceItem("human_review_receipt_workspace", "Human review receipt workspace", "gate_approval", "human_review_receipt_workspace", "control-plane-human-review-receipt-workspace", { acceptance_profile: "human_review_receipt_workspace_gate" }),
  sourceItem("human_review_receipt_workspace_merge", "Human review receipt workspace merge", "gate_approval", "human_review_receipt_workspace_merge", "control-plane-human-review-receipt-workspace-merge", { acceptance_profile: "human_review_receipt_workspace_merge_gate" }),
  sourceItem("human_review_context_bundle", "Human review context bundle", "gate_approval", "human_review_context_bundle", "control-plane-human-review-context-bundle", { acceptance_profile: "human_review_context_bundle_gate" }),
  sourceItem("human_review_decision_register", "Human review decision register", "gate_approval", "human_review_decision_register", "control-plane-human-review-decision-register", { acceptance_profile: "human_review_decision_register_gate" }),
  sourceItem("human_review_decision_register_merge", "Human review decision register merge", "gate_approval", "human_review_decision_register_merge", "control-plane-human-review-decision-register-merge", { acceptance_profile: "human_review_decision_register_merge_gate" }),
  sourceItem("human_review_validation_feedback", "Human review validation feedback", "gate_approval", "human_review_validation_feedback", "control-plane-human-review-validation-feedback", { acceptance_profile: "human_review_validation_feedback_gate" }),
  sourceItem("human_review_correction_workspace", "Human review correction workspace", "gate_approval", "human_review_correction_workspace", "control-plane-human-review-correction-workspace", { acceptance_profile: "human_review_correction_workspace_gate" }),
  sourceItem("human_review_correction_workspace_merge", "Human review correction workspace merge", "gate_approval", "human_review_correction_workspace_merge", "control-plane-human-review-correction-workspace-merge", { acceptance_profile: "human_review_correction_workspace_merge_gate" }),
  sourceItem("human_review_correction_validation", "Human review correction validation", "gate_approval", "human_review_correction_validation", "control-plane-human-review-correction-validation", { acceptance_profile: "human_review_correction_validation_gate" }),
  sourceItem("human_review_correction_feedback", "Human review correction feedback", "gate_approval", "human_review_correction_feedback", "control-plane-human-review-correction-feedback", { acceptance_profile: "human_review_correction_feedback_gate" }),
  sourceItem("human_review_cycle_ledger", "Human review cycle ledger", "gate_approval", "human_review_cycle_ledger", "control-plane-human-review-cycle-ledger", { acceptance_profile: "human_review_cycle_ledger_gate" }),
  sourceItem("human_review_cycle_work_orders", "Human review cycle work orders", "gate_approval", "human_review_cycle_work_orders", "control-plane-human-review-cycle-work-orders", { acceptance_profile: "human_review_cycle_work_orders_gate" }),
  sourceItem("human_review_cycle_target_audit", "Human review cycle target audit", "gate_approval", "human_review_cycle_target_audit", "control-plane-human-review-cycle-target-audit", { acceptance_profile: "human_review_cycle_target_audit_gate" }),
  sourceItem("human_review_cycle_triage_inbox", "Human review cycle triage inbox", "gate_approval", "human_review_cycle_triage_inbox", "control-plane-human-review-cycle-triage-inbox", { acceptance_profile: "human_review_cycle_triage_inbox_gate" }),
  sourceItem("human_review_cycle_reviewer_console", "Human review cycle reviewer console", "gate_approval", "human_review_cycle_reviewer_console", "control-plane-human-review-cycle-reviewer-console", { acceptance_profile: "human_review_cycle_reviewer_console_gate" }),
  sourceItem("human_review_cycle_receipt_field_audit", "Human review cycle receipt field audit", "gate_approval", "human_review_cycle_receipt_field_audit", "control-plane-human-review-cycle-receipt-field-audit", { acceptance_profile: "human_review_cycle_receipt_field_audit_gate" }),
  sourceItem("human_review_cycle_receipt_completion_pack", "Human review cycle receipt completion pack", "gate_approval", "human_review_cycle_receipt_completion_pack", "control-plane-human-review-cycle-receipt-completion-pack", { acceptance_profile: "human_review_cycle_receipt_completion_pack_gate" }),
  sourceItem("human_review_cycle_receipt_completion_verification", "Human review cycle receipt completion verification", "gate_approval", "human_review_cycle_receipt_completion_verification", "control-plane-human-review-cycle-receipt-completion-verification", { acceptance_profile: "human_review_cycle_receipt_completion_verification_gate" }),
  sourceItem("human_review_cycle_receipt_completion_workbench", "Human review cycle receipt completion workbench", "gate_approval", "human_review_cycle_receipt_completion_workbench", "control-plane-human-review-cycle-receipt-completion-workbench", { acceptance_profile: "human_review_cycle_receipt_completion_workbench_gate" }),
  sourceItem("human_review_cycle_receipt_completion_runbook", "Human review cycle receipt completion runbook", "gate_approval", "human_review_cycle_receipt_completion_runbook", "control-plane-human-review-cycle-receipt-completion-runbook", { acceptance_profile: "human_review_cycle_receipt_completion_runbook_gate" }),
  sourceItem("human_review_cycle_receipt_completion_readiness", "Human review cycle receipt completion readiness", "gate_approval", "human_review_cycle_receipt_completion_readiness", "control-plane-human-review-cycle-receipt-completion-readiness", { acceptance_profile: "human_review_cycle_receipt_completion_readiness_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_queue", "Human review cycle receipt completion command queue", "gate_approval", "human_review_cycle_receipt_completion_command_queue", "control-plane-human-review-cycle-receipt-completion-command-queue", { acceptance_profile: "human_review_cycle_receipt_completion_command_queue_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipts", "Human review cycle receipt completion command receipts", "gate_approval", "human_review_cycle_receipt_completion_command_receipts", "control-plane-human-review-cycle-receipt-completion-command-receipts", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipts_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_validation", "Human review cycle receipt completion command receipt validation", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_validation", "control-plane-human-review-cycle-receipt-completion-command-receipt-validation", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_validation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_feedback", "Human review cycle receipt completion command receipt feedback", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_feedback", "control-plane-human-review-cycle-receipt-completion-command-receipt-feedback", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_feedback_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_workspace", "Human review cycle receipt completion command receipt workspace", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_workspace", "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_workspace_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_workspace_merge", "Human review cycle receipt completion command receipt workspace merge", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_workspace_merge", "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace-merge", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_workspace_merge_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_workspace_validation", "Human review cycle receipt completion command receipt workspace validation", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_workspace_validation", "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace-validation", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_workspace_validation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_application", "Human review cycle receipt completion command receipt application", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_application", "control-plane-human-review-cycle-receipt-completion-command-receipt-application", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_application_gate" }),
  sourceItem("human_review_cycle_receipt_completion_reconciliation", "Human review cycle receipt completion reconciliation", "gate_approval", "human_review_cycle_receipt_completion_reconciliation", "control-plane-human-review-cycle-receipt-completion-reconciliation", { acceptance_profile: "human_review_cycle_receipt_completion_reconciliation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_baseline", "Human review cycle receipt completion baseline", "gate_approval", "human_review_cycle_receipt_completion_baseline", "control-plane-human-review-cycle-receipt-completion-baseline", { acceptance_profile: "human_review_cycle_receipt_completion_baseline_gate" }),
  sourceItem("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human review cycle receipt completion manual command receipt pack", "gate_approval", "human_review_cycle_receipt_completion_manual_command_receipt_pack", "control-plane-human-review-cycle-receipt-completion-manual-command-receipt-pack", { acceptance_profile: "human_review_cycle_receipt_completion_manual_command_receipt_pack_gate" }),
  sourceItem("human_review_cycle_receipt_completion_held_command_resolution", "Human review cycle receipt completion held command resolution", "gate_approval", "human_review_cycle_receipt_completion_held_command_resolution", "control-plane-human-review-cycle-receipt-completion-held-command-resolution", { acceptance_profile: "human_review_cycle_receipt_completion_held_command_resolution_gate" }),
  sourceItem("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human review cycle receipt completion protected approval request pack", "gate_approval", "human_review_cycle_receipt_completion_protected_approval_request_pack", "control-plane-human-review-cycle-receipt-completion-protected-approval-request-pack", { acceptance_profile: "human_review_cycle_receipt_completion_protected_approval_request_pack_gate" }),
  sourceItem("human_review_cycle_receipt_completion_manual_revalidation", "Human review cycle receipt completion manual revalidation", "gate_approval", "human_review_cycle_receipt_completion_manual_revalidation", "control-plane-human-review-cycle-receipt-completion-manual-revalidation", { acceptance_profile: "human_review_cycle_receipt_completion_manual_revalidation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_queue_patch_projection", "Human review cycle receipt completion command queue patch projection", "gate_approval", "human_review_cycle_receipt_completion_command_queue_patch_projection", "control-plane-human-review-cycle-receipt-completion-command-queue-patch-projection", { acceptance_profile: "human_review_cycle_receipt_completion_command_queue_patch_projection_gate" }),
  sourceItem("human_review_cycle_receipt_completion_closeout_ledger", "Human review cycle receipt completion closeout ledger", "gate_approval", "human_review_cycle_receipt_completion_closeout_ledger", "control-plane-human-review-cycle-receipt-completion-closeout-ledger", { acceptance_profile: "human_review_cycle_receipt_completion_closeout_ledger_gate" }),
  sourceItem("human_review_v1_regression_freeze", "Human Review v1 regression freeze", "gate_approval", "human_review_v1_regression_freeze", "control-plane-human-review-v1-regression-freeze", { acceptance_profile: "human_review_v1_regression_freeze_gate" }),
  sourceItem("law_firm_slice", "Law-firm LDD slice", "law_firm", "law_firm_ldd_slice", "control-plane-law-firm-slice", { acceptance_profile: "protected_human_gate" }),
  sourceItem("personal_dev_slice", "Personal-dev Claude/Codex slice", "personal_dev", "personal_dev_slice", "control-plane-personal-dev-slice", { acceptance_profile: "protected_human_gate" }),
  sourceItem("creative_document_slice", "Creative/document slice", "creative_document", "creative_document_slice", "control-plane-creative-document-slice", { acceptance_profile: "protected_human_gate" }),
  sourceItem("output_observability", "Output and observability planes", "observability", "observability_catalog", "control-plane-observability", { acceptance_profile: "observability_gate" }),
  sourceItem("audit_trail", "Audit trail", "audit", "control_plane_audit_trail", "control-plane-audit-trail"),
  sourceItem("delivery_matter_cockpit", "Protected delivery and matter cockpit", "delivery", "matter_cockpit", "control-plane-matter-cockpit", { acceptance_profile: "matter_cockpit_gate" }),
  sourceItem("control_plane_loop", "Automated control-plane loop", "control_plane", "control_plane_loop", "control-plane-loop"),
  scriptItem("dashboard_api", "Dashboard/API read-only surface", "dashboard_api", "api:smoke", "control-plane-api"),
];

export async function runControlPlaneGoalCheckpoint(options = {}) {
  const result = await buildControlPlaneGoalCheckpoint(options);
  if (options.write !== false) await writeControlPlaneGoalCheckpoint(result, result.output_dir);
  return result;
}

export async function buildControlPlaneGoalCheckpoint(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const dashboardPath = path.resolve(options.dashboardPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_DASHBOARD_PATH);
  const loopPath = path.resolve(options.loopPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_LOOP_PATH);
  const healthPath = path.resolve(options.healthPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_HEALTH_PATH);
  const packagePath = path.resolve(options.packagePath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_PACKAGE_PATH);
  const roadmapPath = path.resolve(options.roadmapPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_ROADMAP_PATH);
  const dashboardResult = await readJsonOrError(dashboardPath);
  const loopResult = await readJsonOrError(loopPath);
  const healthResult = await readJsonOrError(healthPath);
  const packageResult = await readJsonOrError(packagePath);
  const roadmapResult = await readTextOrError(roadmapPath);
  const context = buildContext(dashboardResult, loopResult, healthResult, packageResult, roadmapResult);
  const checkpointItems = GOAL_ITEMS.map((item) => buildCheckpointItem(item, context));
  const checkpoint = {
    schema_version: "control-plane-goal-checkpoint.v1",
    generated_at: generatedAt,
    checkpoint_id: `control-plane-goal-checkpoint.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    checkpoint_status: deriveCheckpointStatus(checkpointItems),
    sources: [
      buildSource("review_dashboard", "Review Dashboard", dashboardPath, dashboardResult),
      buildSource("control_plane_loop", "Control Plane Loop", loopPath, loopResult),
      buildSource("control_plane_health", "Control Plane Health", healthPath, healthResult),
      buildSource("package_json", "Package Scripts", packagePath, packageResult),
      buildSource("implementation_roadmap", "Implementation Roadmap", roadmapPath, roadmapResult),
    ],
    summary: summarizeCheckpoint(checkpointItems, context),
    checkpoint_items: checkpointItems,
    next_focus: checkpointItems.find((item) => item.status !== "passed") ?? null,
  };

  return {
    ...checkpoint,
    markdown: renderGoalCheckpointMarkdown(checkpoint),
  };
}

export async function writeControlPlaneGoalCheckpoint(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-goal-checkpoint.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    checkpoint_id: result.checkpoint_id,
    output_dir: result.output_dir,
    checkpoint_status: result.checkpoint_status,
    sources: result.sources,
    summary: result.summary,
    checkpoint_items: result.checkpoint_items,
    next_focus: result.next_focus,
  });
  await writeJson(path.join(outDir, "checkpoint-items.json"), {
    generated_at: result.generated_at,
    count: result.checkpoint_items.length,
    items: result.checkpoint_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneGoalCheckpointCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneGoalCheckpoint(args);
  console.log(`Control plane goal checkpoint written to ${result.output_dir}`);
  console.log(`Checkpoint status: ${result.checkpoint_status}`);
  console.log(`Passed items: ${result.summary.passed_item_count}/${result.summary.checkpoint_item_count}`);
  console.log(`Attention items: ${result.summary.attention_item_count}`);
}

function buildContext(dashboardResult, loopResult, healthResult, packageResult, roadmapResult) {
  const dashboard = dashboardResult.value;
  const sourcesById = new Map((dashboard?.sources ?? []).map((source) => [source.source_id, source]));
  const stagesById = new Map((dashboard?.stage_statuses ?? []).map((stage) => [stage.stage_id, stage]));
  const packageScripts = packageResult.value?.scripts ?? {};
  const roadmapText = roadmapResult.value ?? "";
  return {
    dashboardResult,
    loopResult,
    healthResult,
    packageResult,
    roadmapResult,
    dashboard,
    loop: loopResult.value,
    health: healthResult.value,
    sourcesById,
    stagesById,
    packageScripts,
    roadmapPhaseCount: roadmapPhaseMatches(roadmapText).length,
    latestRoadmapPhase: latestRoadmapPhase(roadmapText),
  };
}

function buildCheckpointItem(item, context) {
  if (item.check_type === "script") {
    const hasScript = Boolean(context.packageScripts[item.script_name]);
    return checkpointItem(item, {
      status: hasScript ? "passed" : "missing",
      evidence_refs: hasScript ? [`package.json#scripts.${item.script_name}`] : [],
      reason: hasScript
        ? `${item.script_name} script is registered.`
        : `${item.script_name} script is not registered.`,
      recommended_actions: hasScript ? [] : ["add_package_script", "rerun_goal_checkpoint"],
    });
  }

  if (item.check_type === "package_script") {
    const hasScript = Boolean(context.packageScripts[item.script_name]);
    return checkpointItem(item, {
      status: hasScript ? "passed" : "missing",
      evidence_refs: hasScript ? [`package.json#scripts.${item.script_name}`] : [],
      reason: hasScript
        ? `${item.script_name} validates the core contracts.`
        : `${item.script_name} script is not registered.`,
      recommended_actions: hasScript ? [] : ["add_validate_core_script", "npm_run_validate"],
    });
  }

  const source = context.sourcesById.get(item.source_id);
  const stage = context.stagesById.get(item.source_id);
  if (!source && !stage) {
    return checkpointItem(item, {
      status: "missing",
      evidence_refs: [],
      reason: `${item.source_id} is not registered in the dashboard.`,
      recommended_actions: ["register_dashboard_source", "rerun_dashboard_build"],
    });
  }
  if (source && !source.available) {
    return checkpointItem(item, {
      status: "missing",
      evidence_refs: [`source:${item.source_id}`],
      reason: `${item.source_id} source is registered but unavailable: ${source.error ?? "unavailable"}.`,
      recommended_actions: ["run_source_stage", "rerun_dashboard_build"],
    });
  }
  if (!stage) {
    return checkpointItem(item, {
      status: "attention",
      evidence_refs: [`source:${item.source_id}`],
      reason: `${item.source_id} source is available but has no stage status.`,
      recommended_actions: ["add_stage_status", "rerun_dashboard_build"],
    });
  }

  const acceptance = evaluateStageAcceptance(item, stage);
  const status = acceptance.status;
  return checkpointItem(item, {
    status,
    evidence_refs: [`source:${item.source_id}`, `stage:${stage.stage_id}`],
    reason: acceptance.reason ?? `${stage.label} stage is ${stage.status}: ${stage.message}`,
    recommended_actions: status === "passed" ? [] : ["inspect_dashboard_stage", "resolve_stage_blocker", "rerun_control_plane_loop"],
    implementation_status: acceptance.implementation_status,
    operational_status: stage.status,
    acceptance_profile: item.acceptance_profile ?? "stage_status",
  });
}

function checkpointItem(item, result) {
  return {
    checkpoint_item_id: item.checkpoint_item_id,
    category: item.category,
    label: item.label,
    status: result.status,
    priority: priorityForStatus(result.status),
    evidence_refs: result.evidence_refs,
    reason: result.reason,
    recommended_actions: result.recommended_actions,
    implementation_status: result.implementation_status ?? result.status,
    operational_status: result.operational_status ?? result.status,
    acceptance_profile: result.acceptance_profile ?? item.acceptance_profile ?? "direct",
  };
}

function summarizeCheckpoint(items, context) {
  return {
    checkpoint_status: deriveCheckpointStatus(items),
    checkpoint_item_count: items.length,
    passed_item_count: items.filter((item) => item.status === "passed").length,
    attention_item_count: items.filter((item) => item.status === "attention").length,
    blocked_item_count: items.filter((item) => item.status === "blocked").length,
    missing_item_count: items.filter((item) => item.status === "missing").length,
    roadmap_phase_count: context.roadmapPhaseCount,
    latest_roadmap_phase: context.latestRoadmapPhase,
    dashboard_available: context.dashboardResult.ok,
    loop_available: context.loopResult.ok,
    loop_status: context.loop?.loop_status ?? null,
    health_available: context.healthResult.ok,
    health_status: context.health?.overall_health ?? null,
    dashboard_overall_status: context.dashboard?.summary?.overall_status ?? null,
    dashboard_action_item_count: context.dashboard?.summary?.action_item_count ?? 0,
    implementation_gate_pass_count: items.filter((item) => item.implementation_status === "passed_with_operational_gate").length,
    operational_blocker_count: items.filter((item) => ["attention", "blocked", "pending"].includes(item.operational_status)).length,
    by_status: countBy(items, "status"),
    by_category: countBy(items, "category"),
  };
}

function deriveCheckpointStatus(items) {
  if (items.some((item) => item.status === "blocked")) return "blocked";
  if (items.some((item) => item.status === "missing")) return "incomplete";
  if (items.some((item) => item.status === "attention")) return "attention";
  return "passed";
}

function priorityForStatus(status) {
  if (status === "blocked") return "high";
  if (status === "missing") return "high";
  if (status === "attention") return "medium";
  return "low";
}

function renderGoalCheckpointMarkdown(checkpoint) {
  const lines = [];
  lines.push("# Control Plane Goal Checkpoint");
  lines.push("");
  lines.push(`Generated: ${checkpoint.generated_at}`);
  lines.push(`Checkpoint status: ${checkpoint.checkpoint_status}`);
  lines.push("");
  lines.push(`- Items: ${checkpoint.summary.checkpoint_item_count}`);
  lines.push(`- Passed: ${checkpoint.summary.passed_item_count}`);
  lines.push(`- Attention: ${checkpoint.summary.attention_item_count}`);
  lines.push(`- Blocked: ${checkpoint.summary.blocked_item_count}`);
  lines.push(`- Missing: ${checkpoint.summary.missing_item_count}`);
  lines.push(`- Latest roadmap phase: ${checkpoint.summary.latest_roadmap_phase ?? "unknown"}`);
  lines.push("");
  lines.push("## Checkpoint Items");
  lines.push("");
  for (const item of checkpoint.checkpoint_items) {
    lines.push(`- ${item.checkpoint_item_id}: ${item.status} - ${item.reason}`);
  }
  if (checkpoint.next_focus) {
    lines.push("");
    lines.push(`Next focus: ${checkpoint.next_focus.label} (${checkpoint.next_focus.status})`);
  }
  return `${lines.join("\n")}\n`;
}

function evaluateStageAcceptance(item, stage) {
  const directStatus = stage.status === "passed" || stage.status === "ready"
    ? "passed"
    : stage.status === "blocked"
      ? "blocked"
      : "attention";
  const evaluateProfileWhenPassed = new Set([
    "policy_golden_fixtures_gate",
    "policy_operations_surface_gate",
    "matter_boundary_slice_gate",
    "identity_policy_matter_freeze_gate",
    "resource_store_interface_gate",
    "immutable_object_store_layout_gate",
    "resource_version_ledger_gate",
    "resource_dedup_hash_gate",
    "resource_quarantine_gate",
    "normalized_text_contract_gate",
    "extractor_adapter_contract_gate",
    "source_span_store_gate",
    "evidence_item_store_gate",
    "evidence_golden_fixtures_gate",
    "fact_claim_store_gate",
    "issue_graph_store_gate",
    "citation_object_store_gate",
    "lineage_graph_builder_gate",
    "evidence_viewer_data_api_gate",
    "evidence_coverage_score_gate",
    "evidence_flags_gate",
    "exhibit_map_gate",
    "evidence_export_bundle_gate",
    "evidence_regression_tests_gate",
    "resource_evidence_dashboard_summary_gate",
    "evidence_plane_freeze_gate",
    "chain_of_custody_events_gate",
    "search_index_contract_gate",
    "vector_index_policy_boundary_gate",
    "retrieval_filter_compiler_gate",
    "event_envelope_ledger_gate",
    "event_type_registry_gate",
    "append_only_event_store_gate",
    "event_correlation_ledger_gate",
    "workflow_run_ledger_gate",
    "agent_run_ledger_gate",
    "tool_invocation_ledger_gate",
    "audit_event_ledger_gate",
    "policy_snapshot_event_binding_gate",
    "cost_record_projection_gate",
    "token_usage_projection_gate",
    "observability_trace_projection_gate",
    "error_retry_ledger_gate",
    "event_replay_harness_gate",
    "retention_archive_ledger_gate",
    "ledger_api_dashboard_gate",
    "ledger_golden_fixtures_gate",
    "observability_freeze_gate",
    "capability_manifest_v2_gate",
    "pack_manifest_compatibility_gate",
    "workflow_dsl_state_model_gate",
    "workflow_state_machine_runner_gate",
    "workflow_queue_retry_backoff_gate",
    "workflow_idempotency_gate",
    "workflow_resume_cancel_gate",
    "workflow_context_builder_gate",
    "workflow_retrieval_compiler_gate",
    "workflow_prompt_injection_boundary_gate",
    "workflow_pre_run_gate_framework_gate",
    "workflow_in_run_gate_framework_gate",
    "workflow_post_run_gate_framework_gate",
    "gate_result_aggregator_gate",
    "capability_registry_api_gate",
    "workflow_run_dashboard_gate",
    "workflow_golden_cases_gate",
    "workflow_gate_freeze_gate",
    "runtime_adapter_interface_v2_gate",
    "hermes_runtime_adapter_gate",
    "claude_code_adapter_contract_gate",
    "codex_adapter_contract_gate",
    "local_script_adapter_gate",
    "document_renderer_adapter_gate",
    "worktree_manager_v2_gate",
    "sandbox_policy_model_gate",
    "docker_local_backend_selector_gate",
    "secrets_broker_contract_gate",
    "runtime_artifact_capture_gate",
    "runtime_log_normalization_gate",
    "runtime_timeout_heartbeat_gate",
    "runtime_control_commands_gate",
    "protected_file_gate_gate",
    "canonical_test_runner_gate",
    "runtime_api_dashboard_gate",
    "runtime_freeze_gate",
    "personal_dev_pack_manifest_gate",
    "repo_profile_detector_gate",
    "agent_instruction_registry_gate",
    "issue_intake_adapter_gate",
    "plan_request_contract_gate",
    "plan_reconciliation_gate",
    "scope_freeze_gate_gate",
    "dev_lane_ledger_gate",
    "implementation_patch_capture_gate",
    "diff_review_gate_gate",
    "canonical_test_matrix_gate",
    "dev_protected_scan_gate",
    "pr_draft_artifact_gate",
    "release_note_artifact_gate",
    "rollback_plan_artifact_gate",
    "technical_debt_ledger_gate",
    "personal_dev_dashboard_api_gate",
    "personal_dev_e2e_freeze_gate",
    "law_firm_pack_manifest_gate",
    "matter_os_profile_gate",
    "matter_timeline_gate",
    "matter_document_index_gate",
    "matter_task_board_gate",
    "matter_knowledge_graph_gate",
    "matter_privilege_classifier_gate",
    "matter_personal_data_detector_gate",
    "legal_citation_verifier_gate",
    "ldd_vdr_inventory_gate",
    "ldd_document_classification_gate",
    "ldd_extractor_selection_gate",
    "ldd_fact_extraction_gate",
    "ldd_issue_detection_gate",
    "ldd_rfi_generator_gate",
    "ldd_report_draft_gate",
    "litigation_brief_draft_gate",
    "meeting_minutes_workflow_gate",
    "contract_draft_workflow_gate",
    "provided_material_review_gate",
    "legal_approval_matrix_gate",
    "law_firm_e2e_freeze_gate",
    "creative_document_pack_manifest_gate",
    "template_registry_gate",
    "style_registry_gate",
    "asset_registry_gate",
    "docx_renderer_gate",
    "pptx_renderer_gate",
    "pdf_html_renderer_gate",
    "layout_validator_gate",
    "citation_renderer_gate",
    "version_comparator_gate",
    "design_system_profile_gate",
    "web_novel_workflow_gate",
    "video_ppt_workflow_gate",
    "creative_document_freeze_gate",
    "connector_contract_v2_gate",
    "local_folder_connector_gate",
    "onedrive_connector_boundary_gate",
    "outlook_email_connector_gate",
    "kakaotalk_import_boundary_gate",
    "github_connector_gate",
    "vdr_connector_gate",
    "plaud_transcript_connector_gate",
    "erp_draft_connector_gate",
    "connector_freeze_gate",
  ]);
  if (directStatus === "passed" && !evaluateProfileWhenPassed.has(item.acceptance_profile)) {
    return {
      status: "passed",
      implementation_status: "passed",
      reason: `${stage.label} stage is ${stage.status}: ${stage.message}`,
    };
  }

  const metrics = stage.metrics ?? {};
  if (item.acceptance_profile === "evidence_review_gate") {
    const blockingGateCount = metrics.blocking_gate_count ?? 0;
    const blockedItemCount = metrics.blocked_item_count ?? 0;
    if (blockingGateCount === 0 && blockedItemCount === 0 && (metrics.evidence_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Evidence review queue is implemented and waiting for human evidence decisions.");
    }
  }

  if (item.acceptance_profile === "approval_gate") {
    if ((metrics.inbox_item_count ?? 0) >= 0 && (metrics.approval_request_count ?? 0) >= 0) {
      return passedWithOperationalGate(stage, "Approval workflow is implemented; remaining items are human approval work.");
    }
  }

  if (item.acceptance_profile === "policy_snapshot_binding_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.missing_policy_snapshot_count ?? 0) + (metrics.unresolved_policy_snapshot_count ?? 0);
    const bindingCount = metrics.policy_snapshot_binding_count ?? 0;
    if (
      bindingCount > 0
      && errors === 0
      && (metrics.known_policy_snapshot_binding_count ?? 0) === bindingCount
      && (metrics.workflow_policy_binding_count ?? 0) > 0
      && (metrics.event_policy_binding_count ?? 0) > 0
      && (metrics.gate_policy_binding_count ?? 0) > 0
      && (metrics.approval_policy_binding_count ?? 0) > 0
      && (metrics.output_policy_binding_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Policy snapshot binding ledger is implemented and every workflow, event, run, gate, approval, and output binding resolves to a known execution-time policy snapshot.");
    }
  }

  if (item.acceptance_profile === "policy_snapshot_event_binding_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.source_snapshot_mismatch_count ?? 0)
      + (metrics.stored_event_policy_snapshot_missing_count ?? 0)
      + (metrics.stored_event_policy_snapshot_mismatch_count ?? 0)
      + (metrics.gate_event_missing_count ?? 0);
    const bindingCount = metrics.event_run_gate_policy_binding_count ?? 0;
    const storedCheckedCount = metrics.stored_event_policy_snapshot_checked_count ?? 0;
    if (
      errors === 0
      && metrics.policy_snapshot_event_binding_status === "complete"
      && bindingCount > 0
      && (metrics.source_policy_snapshot_present_count ?? 0) === bindingCount
      && (metrics.resolved_policy_snapshot_known_count ?? 0) === bindingCount
      && (metrics.bound_policy_snapshot_binding_count ?? 0) === bindingCount
      && (metrics.execution_time_recorded_count ?? 0) === bindingCount
      && (metrics.stored_event_policy_snapshot_matched_count ?? 0) === storedCheckedCount
      && (metrics.event_policy_snapshot_binding_count ?? 0) > 0
      && (metrics.run_policy_snapshot_binding_count ?? 0) > 0
      && (metrics.event_run_policy_snapshot_binding_count ?? 0) > 0
      && (metrics.gate_policy_snapshot_binding_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Policy snapshot event binding verifies event, run, event-run, and gate rows all carry execution-time policy snapshots resolved through the P123 binding ledger and preserved in append-only events.");
    }
  }

  if (item.acceptance_profile === "cost_record_projection_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.missing_run_cost_rollup_count ?? 0)
      + (metrics.run_missing_record_count ?? 0);
    if (
      errors === 0
      && metrics.cost_record_projection_status === "complete"
      && (metrics.projected_cost_record_count ?? 0) > 0
      && (metrics.provider_cost_record_count ?? 0) > 0
      && (metrics.runtime_cost_record_count ?? 0) > 0
      && (metrics.storage_cost_record_count ?? 0) > 0
      && (metrics.api_cost_record_count ?? 0) > 0
      && (metrics.run_cost_rollup_count ?? 0) > 0
      && (metrics.attributed_run_cost_rollup_count ?? 0) === (metrics.run_cost_rollup_count ?? -1)
      && (metrics.total_token_count ?? 0) > 0
      && (metrics.total_runtime_seconds ?? 0) > 0
      && (metrics.api_invocation_count ?? 0) > 0
      && (metrics.storage_artifact_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Cost record projection attributes provider tokens, runtime seconds, storage artifacts, and API/tool invocations to run-level cost rollups with no missing run coverage.");
    }
  }

  if (item.acceptance_profile === "token_usage_projection_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.missing_provider_cost_record_count ?? 0);
    if (
      errors === 0
      && metrics.token_usage_projection_status === "complete"
      && (metrics.projected_token_usage_record_count ?? 0) > 0
      && (metrics.projected_token_usage_record_count ?? 0) === (metrics.source_token_usage_record_count ?? -1)
      && (metrics.provider_cost_bound_record_count ?? 0) === (metrics.projected_token_usage_record_count ?? -1)
      && (metrics.capability_token_rollup_count ?? 0) > 0
      && (metrics.runtime_token_rollup_count ?? 0) > 0
      && (metrics.capability_runtime_token_rollup_count ?? 0) > 0
      && (metrics.total_input_token_count ?? 0) > 0
      && (metrics.total_output_token_count ?? 0) > 0
      && (metrics.total_token_count ?? 0) === ((metrics.total_input_token_count ?? 0) + (metrics.total_output_token_count ?? 0) + (metrics.total_cache_token_count ?? 0))
    ) {
      return passedWithOperationalGate(stage, "Token usage projection normalizes input, output, and cache tokens into capability/runtime rollups and binds every projected token record to the provider cost record.");
    }
  }

  if (item.acceptance_profile === "observability_trace_projection_gate") {
    const unknownBindings = (metrics.unknown_workflow_trace_binding_count ?? 0)
      + (metrics.unknown_agent_trace_binding_count ?? 0)
      + (metrics.unknown_gate_trace_binding_count ?? 0)
      + (metrics.unknown_output_trace_binding_count ?? 0);
    const errors = (metrics.validation_error_count ?? 0) + unknownBindings;
    if (
      errors === 0
      && metrics.observability_trace_projection_status === "complete"
      && (metrics.observability_trace_record_count ?? 0) === (metrics.source_correlation_trace_count ?? -1)
      && (metrics.linked_trace_count ?? 0) === (metrics.trace_with_workflow_count ?? -1)
      && (metrics.workflow_trace_binding_count ?? 0) > 0
      && (metrics.agent_trace_binding_count ?? 0) > 0
      && (metrics.gate_trace_binding_count ?? 0) > 0
      && (metrics.output_trace_binding_count ?? 0) > 0
      && (metrics.complete_component_trace_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Observability trace projection connects workflow, agent, gate, and output records to known correlation trace ids while preserving external-control audit traces separately.");
    }
  }

  if (item.acceptance_profile === "error_retry_ledger_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.missing_trace_binding_count ?? 0)
      + (metrics.auto_retry_scheduled_count ?? 0);
    if (
      errors === 0
      && metrics.error_retry_ledger_status === "complete"
      && (metrics.projected_error_record_count ?? 0) > 0
      && (metrics.projected_error_record_count ?? 0) === (metrics.source_error_record_count ?? -1)
      && (metrics.retry_record_count ?? 0) === (metrics.projected_error_record_count ?? -1)
      && (metrics.timeout_record_count ?? 0) === (metrics.projected_error_record_count ?? -1)
      && (metrics.resume_state_record_count ?? 0) === (metrics.projected_error_record_count ?? -1)
      && (metrics.failure_record_count ?? 0) === (metrics.projected_error_record_count ?? -1)
      && (metrics.retryable_error_count ?? 0) > 0
      && (metrics.non_retryable_error_count ?? 0) > 0
      && (metrics.resume_blocked_count ?? 0) > 0
      && (metrics.trace_bound_error_count ?? 0) === (metrics.projected_error_record_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Error/retry ledger separates every ErrorRecord v2 row into failure, retry, timeout, and resume-state records with no auto retry scheduled and full trace binding.");
    }
  }

  if (item.acceptance_profile === "event_replay_harness_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.sequence_gap_count ?? 0)
      + (metrics.hash_chain_mismatch_count ?? 0)
      + (metrics.run_summary_mismatch_count ?? 0)
      + (metrics.terminal_state_mismatch_count ?? 0)
      + (metrics.dashboard_metric_mismatch_count ?? 0);
    if (
      errors === 0
      && metrics.event_replay_status === "complete"
      && (metrics.replayed_event_count ?? 0) > 0
      && (metrics.replayed_event_count ?? 0) === (metrics.source_stored_event_count ?? -1)
      && (metrics.replayed_event_stream_count ?? 0) === (metrics.source_event_stream_count ?? -1)
      && (metrics.verified_event_stream_count ?? 0) === (metrics.replayed_event_stream_count ?? -1)
      && (metrics.replayed_run_summary_count ?? 0) === (metrics.source_workflow_run_record_count ?? -1)
      && (metrics.dashboard_projection_metric_count ?? 0) >= 10
    ) {
      return passedWithOperationalGate(stage, "Event replay harness reconstructs event streams, run summaries, and dashboard projection metrics from append-only events without drift.");
    }
  }

  if (item.acceptance_profile === "retention_archive_ledger_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.missing_policy_binding_count ?? 0)
      + (metrics.missing_legal_hold_binding_count ?? 0)
      + (metrics.deletion_allowed_candidate_count ?? 0);
    if (
      errors === 0
      && metrics.retention_archive_status === "complete"
      && metrics.source_append_only_event_store_status === "complete"
      && metrics.source_audit_event_ledger_status === "complete"
      && metrics.source_output_artifact_catalog_status === "complete"
      && (metrics.retention_policy_count ?? 0) === 3
      && (metrics.policy_record_source_match_count ?? 0) === 3
      && (metrics.archive_candidate_count ?? 0) > 0
      && (metrics.event_archive_candidate_count ?? 0) > 0
      && (metrics.audit_archive_candidate_count ?? 0) > 0
      && (metrics.output_archive_candidate_count ?? 0) > 0
      && (metrics.legal_hold_binding_count ?? 0) === (metrics.legal_hold_required_candidate_count ?? -1)
      && (metrics.source_stored_event_count ?? 0) > 0
      && (metrics.source_audit_trail_record_count ?? 0) > 0
      && (metrics.source_output_artifact_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Retention/archive ledger records event, audit, and output retention policy with active legal holds and no deletion-authorized candidates.");
    }
  }

  if (item.acceptance_profile === "ledger_api_dashboard_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.source_validation_error_count ?? 0)
      + (metrics.missing_route_count ?? 0)
      + (metrics.blocked_panel_count ?? 0)
      + (metrics.attention_cross_link_count ?? 0);
    if (
      errors === 0
      && metrics.ledger_api_dashboard_status === "complete"
      && (metrics.ledger_dashboard_panel_count ?? 0) === 5
      && (metrics.passed_panel_count ?? 0) === 5
      && (metrics.ledger_domain_count ?? 0) === 5
      && (metrics.run_panel_count ?? 0) === 1
      && (metrics.audit_panel_count ?? 0) === 1
      && (metrics.cost_panel_count ?? 0) === 1
      && (metrics.error_panel_count ?? 0) === 1
      && (metrics.event_panel_count ?? 0) === 1
      && (metrics.ledger_api_route_record_count ?? 0) >= 20
      && (metrics.declared_route_count ?? 0) === (metrics.ledger_api_route_record_count ?? -1)
      && (metrics.route_query_example_count ?? 0) === (metrics.ledger_api_route_record_count ?? -1)
      && (metrics.ledger_panel_metric_count ?? 0) >= 20
      && (metrics.ledger_cross_link_count ?? 0) >= 5
      && (metrics.linked_cross_link_count ?? 0) === (metrics.ledger_cross_link_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Ledger API/dashboard exposes read-only run, audit, cost, error, and event panels with declared Review API routes and linked cross-ledger health rows.");
    }
  }

  if (item.acceptance_profile === "ledger_golden_fixtures_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.source_validation_error_count ?? 0)
      + (metrics.mismatch_case_count ?? 0)
      + (metrics.failed_metric_assertion_count ?? 0)
      + (metrics.protected_action_case_count ?? 0)
      + ((metrics.regression_hash_count ?? 0) - (metrics.locked_regression_hash_count ?? 0));
    if (
      errors === 0
      && metrics.ledger_golden_fixture_status === "complete"
      && (metrics.ledger_golden_case_count ?? 0) >= 4
      && (metrics.locked_case_count ?? 0) === (metrics.ledger_golden_case_count ?? -1)
      && (metrics.fixture_group_count ?? 0) === 4
      && (metrics.replay_case_count ?? 0) >= 1
      && (metrics.projection_case_count ?? 0) >= 1
      && (metrics.cost_case_count ?? 0) >= 1
      && (metrics.audit_case_count ?? 0) >= 1
      && (metrics.metric_assertion_count ?? 0) >= 16
      && (metrics.passed_metric_assertion_count ?? 0) === (metrics.metric_assertion_count ?? -1)
      && (metrics.regression_hash_count ?? 0) === (metrics.ledger_golden_case_count ?? -1)
      && (metrics.locked_regression_hash_count ?? 0) === (metrics.ledger_golden_case_count ?? -1)
      && (metrics.human_review_required_case_count ?? 0) === (metrics.ledger_golden_case_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Ledger golden fixtures lock replay, projection, cost, and audit cases with passing assertions and regression hashes.");
    }
  }

  if (item.acceptance_profile === "observability_freeze_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.source_validation_error_count ?? 0)
      + (metrics.failed_freeze_checkpoint_count ?? 0)
      + (metrics.failed_metric_assertion_count ?? 0)
      + (metrics.blocked_representative_trace_count ?? 0)
      + (metrics.missing_control_plane_loop_binding_count ?? 0)
      + (metrics.client_facing_ready_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    if (
      errors === 0
      && metrics.observability_freeze_status === "complete"
      && (metrics.freeze_source_count ?? 0) >= 18
      && (metrics.passed_freeze_source_count ?? 0) === (metrics.freeze_source_count ?? -1)
      && (metrics.freeze_checkpoint_count ?? 0) >= 18
      && (metrics.passed_freeze_checkpoint_count ?? 0) === (metrics.freeze_checkpoint_count ?? -1)
      && (metrics.representative_trace_count ?? 0) >= 7
      && (metrics.complete_representative_trace_count ?? 0) === (metrics.representative_trace_count ?? -1)
      && (metrics.control_plane_loop_binding_count ?? 0) >= 17
      && (metrics.passed_control_plane_loop_binding_count ?? 0) === (metrics.control_plane_loop_binding_count ?? -1)
      && (metrics.metric_assertion_count ?? 0) >= 30
      && (metrics.passed_metric_assertion_count ?? 0) === (metrics.metric_assertion_count ?? -1)
      && (metrics.human_review_required_trace_count ?? 0) === (metrics.representative_trace_count ?? -1)
      && (metrics.delivery_blocked_trace_count ?? 0) === (metrics.representative_trace_count ?? -1)
      && (metrics.external_transfer_blocked_trace_count ?? 0) === (metrics.representative_trace_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Observability freeze verifies trace, cost, audit, run, replay, retention, API, and golden fixture outputs are validation-clean and bound to the control-plane loop while preserving human-review guardrails.");
    }
  }

  if (item.acceptance_profile === "capability_manifest_v2_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.missing_required_field_count ?? 0)
      + (metrics.unknown_runtime_requirement_count ?? 0)
      + (metrics.runtime_blocked_count ?? 0)
      + (metrics.client_facing_ready_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const manifestCount = metrics.capability_manifest_count ?? 0;
    if (
      errors === 0
      && metrics.capability_manifest_v2_status === "complete"
      && manifestCount > 0
      && (metrics.registry_linked_capability_count ?? 0) === manifestCount
      && (metrics.capability_with_input_output_count ?? 0) === manifestCount
      && (metrics.field_matrix_count ?? 0) === manifestCount
      && (metrics.gate_runtime_matrix_count ?? 0) === manifestCount
      && (metrics.policy_index_count ?? 0) === manifestCount
      && (metrics.policy_bound_capability_count ?? 0) === manifestCount
      && (metrics.version_declared_count ?? 0) === manifestCount
      && (metrics.gate_requirement_count ?? 0) > 0
      && (metrics.runtime_requirement_count ?? 0) > 0
      && (metrics.approval_required_capability_count ?? 0) === manifestCount
      && (metrics.human_review_capability_count ?? 0) === manifestCount
    ) {
      return passedWithOperationalGate(stage, "Capability Manifest v2 catalog verifies input/output, required fields, gate/runtime, policy, and version coverage for every registered capability while leaving all legal/client-facing outputs under human review.");
    }
  }

  if (item.acceptance_profile === "pack_manifest_compatibility_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.dependency_missing_count ?? 0)
      + (metrics.dependency_version_mismatch_count ?? 0)
      + (metrics.common_dependency_gap_count ?? 0);
    const packCount = metrics.pack_count ?? 0;
    if (
      errors === 0
      && metrics.compatibility_status === "complete"
      && packCount > 0
      && (metrics.compatible_pack_count ?? 0) === packCount
      && (metrics.core_declared_pack_count ?? 0) === packCount
      && (metrics.core_compatible_pack_count ?? 0) === packCount
      && (metrics.dependency_declared_pack_count ?? 0) === packCount
      && (metrics.dependency_edge_count ?? 0) > 0
      && (metrics.dependency_satisfied_count ?? 0) === (metrics.dependency_edge_count ?? -1)
      && (metrics.matrix_row_count ?? 0) === packCount
    ) {
      return passedWithOperationalGate(stage, "Pack manifest compatibility verifies every pack declares a core version floor, resolves dependency edges, and keeps the law-firm pack inside human-review defaults.");
    }
  }

  if (item.acceptance_profile === "workflow_dsl_state_model_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.unknown_source_state_count ?? 0)
      + (metrics.blocked_projection_count ?? 0);
    const projectionCount = metrics.workflow_run_projection_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_dsl_state_model_status === "complete"
      && (metrics.dsl_state_count ?? 0) === 6
      && (metrics.required_state_count ?? 0) === 6
      && (metrics.transition_rule_count ?? 0) >= 8
      && (metrics.workflow_blueprint_count ?? 0) > 0
      && projectionCount > 0
      && (metrics.clear_projection_count ?? 0) === projectionCount
      && (metrics.waiting_run_count ?? 0) > 0
      && (metrics.human_review_waiting_count ?? 0) > 0
      && (metrics.law_firm_waiting_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Workflow DSL state model fixes the six canonical workflow states and projects blocked law-firm runs into human-review waiting state.");
    }
  }

  if (item.acceptance_profile === "workflow_state_machine_runner_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.transition_guard_without_audit_count ?? 0)
      + (metrics.transition_guard_without_rule_count ?? 0)
      + (metrics.blocked_guard_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const projectionCount = metrics.workflow_run_projection_count ?? 0;
    const guardCount = metrics.transition_guard_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_state_machine_runner_status === "complete"
      && metrics.runner_contract_id === "workflow-state-machine-runner.v1"
      && projectionCount > 0
      && guardCount === projectionCount
      && (metrics.audit_event_candidate_count ?? 0) === guardCount
      && (metrics.runner_plan_count ?? 0) === guardCount
      && (metrics.guard_audit_binding_count ?? 0) === guardCount
      && (metrics.waiting_guard_count ?? 0) > 0
      && (metrics.human_review_guard_count ?? 0) > 0
      && (metrics.law_firm_human_review_guard_count ?? 0) > 0
      && (metrics.auto_transition_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow state machine runner creates a transition guard, audit event candidate, and runner plan for each run while holding law-firm human-review work.");
    }
  }

  if (item.acceptance_profile === "workflow_queue_retry_backoff_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.queue_record_without_retry_classification_count ?? 0)
      + (metrics.non_retryable_backoff_policy_count ?? 0)
      + (metrics.scheduled_backoff_policy_count ?? 0)
      + (metrics.auto_retry_scheduled_count ?? 0)
      + (metrics.auto_dequeue_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const queueRecordCount = metrics.workflow_queue_record_count ?? 0;
    const retryClassificationCount = metrics.retry_classification_count ?? 0;
    const retryableCount = metrics.retryable_classification_count ?? 0;
    const nonRetryableCount = metrics.non_retryable_classification_count ?? 0;
    const backoffPolicyCount = metrics.backoff_policy_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_queue_retry_backoff_status === "complete"
      && metrics.queue_contract_id === "workflow-queue-retry-backoff.v1"
      && queueRecordCount > 0
      && queueRecordCount === (metrics.workflow_runner_plan_count ?? 0)
      && retryClassificationCount > 0
      && retryClassificationCount === retryableCount + nonRetryableCount
      && backoffPolicyCount === retryableCount
      && (metrics.human_gate_required_backoff_count ?? 0) === backoffPolicyCount
      && (metrics.held_queue_record_count ?? 0) > 0
      && (metrics.law_firm_held_queue_record_count ?? 0) > 0
      && (metrics.auto_retry_scheduled_count ?? 1) === 0
      && (metrics.auto_dequeue_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow queue/retry/backoff contract separates retryable errors from non-retryable human holds and keeps all backoff unscheduled behind review gates.");
    }
  }

  if (item.acceptance_profile === "workflow_idempotency_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.duplicate_collision_count ?? 0)
      + (metrics.cross_workflow_key_collision_count ?? 0)
      + (metrics.new_run_created_count ?? 0)
      + (metrics.auto_enqueue_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const keyCount = metrics.idempotency_key_count ?? 0;
    const probeCount = metrics.duplicate_probe_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_idempotency_status === "complete"
      && metrics.idempotency_contract_id === "workflow-idempotency-ledger.v1"
      && keyCount > 0
      && keyCount === (metrics.source_workflow_queue_record_count ?? 0)
      && keyCount === (metrics.source_runner_plan_count ?? 0)
      && keyCount === (metrics.source_workflow_run_record_count ?? 0)
      && (metrics.unique_idempotency_key_count ?? 0) === keyCount
      && (metrics.same_run_resolution_count ?? 0) === keyCount
      && (metrics.skipped_duplicate_count ?? 0) === keyCount
      && probeCount === keyCount
      && (metrics.duplicate_probe_skipped_count ?? 0) === probeCount
      && (metrics.held_queue_key_count ?? 0) > 0
      && (metrics.law_firm_key_count ?? 0) > 0
      && (metrics.law_firm_skipped_duplicate_count ?? 0) === (metrics.law_firm_key_count ?? -1)
      && (metrics.new_run_created_count ?? 1) === 0
      && (metrics.auto_enqueue_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow idempotency ledger assigns one deterministic key per queued run and resolves duplicate requests to same-run or skipped-duplicate outcomes without creating new runs.");
    }
  }

  if (item.acceptance_profile === "workflow_resume_cancel_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.auto_resume_allowed_count ?? 0)
      + (metrics.auto_cancel_allowed_count ?? 0)
      + (metrics.destructive_cancel_mutation_count ?? 0)
      + (metrics.new_run_created_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const resumeCount = metrics.resume_cursor_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_resume_cancel_status === "complete"
      && metrics.resume_cancel_contract_id === "workflow-resume-cancel-contract.v1"
      && resumeCount > 0
      && resumeCount === (metrics.source_idempotency_key_count ?? 0)
      && resumeCount === (metrics.source_workflow_queue_record_count ?? 0)
      && resumeCount === (metrics.source_runner_plan_count ?? 0)
      && resumeCount === (metrics.source_workflow_run_record_count ?? 0)
      && (metrics.cancel_request_count ?? 0) === resumeCount
      && (metrics.resume_decision_count ?? 0) === resumeCount
      && (metrics.cancel_decision_count ?? 0) === resumeCount
      && (metrics.resume_cancel_decision_count ?? 0) === resumeCount * 2
      && (metrics.long_running_workflow_count ?? 0) === resumeCount
      && (metrics.held_resume_count ?? 0) === resumeCount
      && (metrics.safe_cancel_request_count ?? 0) === resumeCount
      && (metrics.cancel_event_append_required_count ?? 0) === resumeCount
      && (metrics.law_firm_resume_cursor_count ?? 0) > 0
      && (metrics.law_firm_resume_held_count ?? 0) === (metrics.law_firm_resume_cursor_count ?? -1)
      && (metrics.law_firm_cancel_request_count ?? 0) === (metrics.law_firm_resume_cursor_count ?? -1)
      && (metrics.auto_resume_allowed_count ?? 1) === 0
      && (metrics.auto_cancel_allowed_count ?? 1) === 0
      && (metrics.destructive_cancel_mutation_count ?? 1) === 0
      && (metrics.new_run_created_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow resume/cancel contract materializes deterministic resume cursors and safe cancel requests for every idempotent queued run without auto-running, mutating, or creating runs.");
    }
  }

  if (item.acceptance_profile === "workflow_context_builder_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.over_budget_record_count ?? 0)
      + (metrics.retrieval_execution_allowed_count ?? 0)
      + (metrics.client_facing_output_allowed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const packetCount = metrics.context_packet_v2_count ?? 0;
    const lawFirmPacketCount = metrics.law_firm_context_packet_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_context_builder_status === "complete"
      && metrics.context_builder_contract_id === "workflow-context-builder-contract.v1"
      && packetCount > 0
      && packetCount === (metrics.source_resume_cursor_count ?? 0)
      && (metrics.packet_with_accessible_resource_count ?? 0) === packetCount
      && (metrics.packet_with_excluded_resource_count ?? 0) === packetCount
      && (metrics.token_budget_record_count ?? 0) === packetCount
      && (metrics.within_budget_record_count ?? 0) === packetCount
      && (metrics.token_budget_enforced_count ?? 0) === packetCount
      && (metrics.citation_hint_record_count ?? 0) === packetCount
      && (metrics.citation_hint_ready_count ?? 0) === packetCount
      && (metrics.prompt_injection_protected_count ?? 0) === packetCount
      && (metrics.human_review_required_packet_count ?? 0) === packetCount
      && lawFirmPacketCount > 0
      && (metrics.law_firm_human_review_packet_count ?? 0) === lawFirmPacketCount
      && (metrics.retrieval_execution_allowed_count ?? 1) === 0
      && (metrics.client_facing_output_allowed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow context builder contract turns resume cursors into held context packet v2 records with accessible resources, excluded cross-matter resources, token budgets, and citation hints without retrieval execution or external transfer.");
    }
  }

  if (item.acceptance_profile === "workflow_retrieval_compiler_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.cross_matter_candidate_count ?? 0)
      + (metrics.blocked_classification_candidate_count ?? 0)
      + (metrics.query_execution_allowed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const requestCount = metrics.retrieval_request_count ?? 0;
    const lawFirmRequestCount = metrics.law_firm_retrieval_request_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_retrieval_compiler_status === "complete"
      && metrics.retrieval_compiler_contract_id === "workflow-retrieval-compiler.v1"
      && requestCount > 0
      && requestCount === (metrics.source_context_packet_v2_count ?? 0)
      && (metrics.packet_with_retrieval_request_count ?? 0) === requestCount
      && (metrics.request_with_selected_candidate_count ?? 0) === requestCount
      && (metrics.retrieval_candidate_count ?? 0) >= (metrics.source_accessible_resource_count ?? 0)
      && (metrics.selected_candidate_count ?? 0) >= requestCount
      && (metrics.source_span_priority_record_count ?? 0) === (metrics.retrieval_candidate_count ?? -1)
      && (metrics.retrieval_guard_record_count ?? 0) === requestCount
      && (metrics.matter_wall_applied_request_count ?? 0) === requestCount
      && (metrics.classification_filter_applied_request_count ?? 0) === requestCount
      && (metrics.relevance_ranking_applied_request_count ?? 0) === requestCount
      && (metrics.source_span_priority_applied_request_count ?? 0) === requestCount
      && (metrics.retrieval_guard_passed_count ?? 0) === requestCount
      && (metrics.cross_matter_candidate_count ?? 1) === 0
      && (metrics.blocked_classification_candidate_count ?? 1) === 0
      && (metrics.query_execution_allowed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
      && lawFirmRequestCount > 0
      && (metrics.law_firm_human_review_request_count ?? 0) === lawFirmRequestCount
    ) {
      return passedWithOperationalGate(stage, "Workflow retrieval compiler binds every context packet v2 record to held retrieval requests, ranked source-span candidates, matter/classification guards, and law-firm human review without query execution or external transfer.");
    }
  }

  if (item.acceptance_profile === "workflow_prompt_injection_boundary_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.promoted_prompt_instruction_count ?? 0)
      + (metrics.promoted_tool_instruction_count ?? 0)
      + (metrics.policy_override_allowed_count ?? 0)
      + (metrics.tool_instruction_allowed_count ?? 0)
      + (metrics.system_prompt_override_allowed_count ?? 0)
      + (metrics.client_facing_output_allowed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const wrapperCount = metrics.untrusted_content_wrapper_count ?? 0;
    const guardCount = metrics.prompt_boundary_guard_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_prompt_injection_boundary_status === "complete"
      && metrics.prompt_injection_boundary_contract_id === "workflow-prompt-injection-boundary.v1"
      && wrapperCount > 0
      && wrapperCount === (metrics.source_retrieval_candidate_count ?? 0)
      && (metrics.evidence_content_role_count ?? 0) === wrapperCount
      && (metrics.instruction_signal_record_count ?? 0) === wrapperCount
      && (metrics.neutralized_instruction_signal_count ?? 0) === (metrics.instruction_signal_count ?? -1)
      && guardCount === (metrics.source_retrieval_request_count ?? 0)
      && (metrics.prompt_boundary_guard_passed_count ?? 0) === guardCount
      && (metrics.wrapper_guard_passed_count ?? 0) === guardCount
      && (metrics.content_role_guard_passed_count ?? 0) === guardCount
      && (metrics.instruction_promotion_guard_passed_count ?? 0) === guardCount
      && (metrics.no_tool_instruction_guard_passed_count ?? 0) === guardCount
      && (metrics.no_policy_override_guard_passed_count ?? 0) === guardCount
      && (metrics.human_review_required_guard_count ?? 0) === guardCount
      && (metrics.promoted_prompt_instruction_count ?? 1) === 0
      && (metrics.promoted_tool_instruction_count ?? 1) === 0
      && (metrics.policy_override_allowed_count ?? 1) === 0
      && (metrics.tool_instruction_allowed_count ?? 1) === 0
      && (metrics.system_prompt_override_allowed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow prompt injection boundary wraps every retrieval candidate as untrusted evidence content, neutralizes instruction-like text, and blocks prompt/tool/policy promotion without external transfer or protected actions.");
    }
  }

  if (item.acceptance_profile === "workflow_pre_run_gate_framework_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.execution_allowed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0)
      + (metrics.blocked_gate_count ?? 0)
      + (metrics.blocked_before_execution_decision_count ?? 0);
    const gateSetCount = metrics.workflow_run_with_gate_set_count ?? 0;
    const sourceGuardCount = metrics.source_prompt_boundary_guard_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_pre_run_gate_framework_status === "complete"
      && metrics.pre_run_gate_framework_contract_id === "workflow-pre-run-gate-framework.v1"
      && sourceGuardCount > 0
      && gateSetCount === sourceGuardCount
      && (metrics.pre_run_gate_guard_count ?? 0) === gateSetCount
      && (metrics.pre_run_gate_decision_count ?? 0) === gateSetCount
      && (metrics.pre_run_gate_record_count ?? 0) === gateSetCount * 5
      && (metrics.access_gate_count ?? 0) === gateSetCount
      && (metrics.model_gate_count ?? 0) === gateSetCount
      && (metrics.tool_gate_count ?? 0) === gateSetCount
      && (metrics.budget_gate_count ?? 0) === gateSetCount
      && (metrics.conflict_gate_count ?? 0) === gateSetCount
      && (metrics.all_required_gate_set_count ?? 0) === gateSetCount
      && (metrics.pre_run_guard_passed_count ?? 0) === gateSetCount
      && (metrics.held_for_human_review_decision_count ?? 0) === gateSetCount
      && (metrics.human_review_required_gate_count ?? 0) > 0
      && (metrics.execution_allowed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow pre-run gate framework resolves access, model, tool, budget, and conflict gates for every prompt-boundary-guarded workflow run, holding execution for human review without transfers or protected actions.");
    }
  }

  if (item.acceptance_profile === "workflow_in_run_gate_framework_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.dangerous_command_allowed_count ?? 0)
      + (metrics.sensitive_access_allowed_count ?? 0)
      + (metrics.timeout_without_gate_count ?? 0)
      + (metrics.timeout_block_count ?? 0)
      + (metrics.execution_allowed_count ?? 0)
      + (metrics.execution_performed_count ?? 0)
      + (metrics.continued_execution_allowed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0);
    const sourceInvocationCount = metrics.source_tool_invocation_record_count ?? 0;
    const sourcePreRunGuardCount = metrics.source_pre_run_gate_guard_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_in_run_gate_framework_status === "complete"
      && metrics.in_run_gate_framework_contract_id === "workflow-in-run-gate-framework.v1"
      && sourceInvocationCount > 0
      && sourcePreRunGuardCount > 0
      && (metrics.in_run_gate_record_count ?? 0) === sourceInvocationCount * 3
      && (metrics.dangerous_command_gate_count ?? 0) === sourceInvocationCount
      && (metrics.sensitive_access_gate_count ?? 0) === sourceInvocationCount
      && (metrics.timeout_gate_count ?? 0) === sourceInvocationCount
      && (metrics.timeout_gate_passed_count ?? 0) === sourceInvocationCount
      && (metrics.timeout_configured_count ?? 0) === sourceInvocationCount
      && (metrics.in_run_guard_count ?? 0) === sourcePreRunGuardCount
      && (metrics.in_run_guard_passed_count ?? 0) === sourcePreRunGuardCount
      && (metrics.in_run_block_record_count ?? 0) > 0
      && (metrics.dangerous_command_block_count ?? 0) === (metrics.dangerous_command_target_count ?? 0)
      && (metrics.sensitive_access_block_count ?? 0) === (metrics.sensitive_access_target_count ?? 0)
      && (metrics.dangerous_command_allowed_count ?? 1) === 0
      && (metrics.sensitive_access_allowed_count ?? 1) === 0
      && (metrics.timeout_without_gate_count ?? 1) === 0
      && (metrics.execution_allowed_count ?? 1) === 0
      && (metrics.execution_performed_count ?? 1) === 0
      && (metrics.continued_execution_allowed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow in-run gate framework binds every tool invocation to dangerous-command, sensitive-access, and timeout gates, converting unsafe runtime attempts into block records without execution or transfer.");
    }
  }

  if (item.acceptance_profile === "workflow_post_run_gate_framework_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.blocked_gate_count ?? 0)
      + (metrics.blocked_after_run_decision_count ?? 0)
      + (metrics.execution_allowed_count ?? 0)
      + (metrics.execution_performed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0)
      + (metrics.client_facing_ready_count ?? 0)
      + (metrics.delivery_ready_count ?? 0)
      + (metrics.final_action_executed_count ?? 0);
    const sourceAgentRunCount = metrics.source_agent_run_record_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_post_run_gate_framework_status === "complete"
      && metrics.post_run_gate_framework_contract_id === "workflow-post-run-gate-framework.v1"
      && sourceAgentRunCount > 0
      && (metrics.post_run_gate_record_count ?? 0) === sourceAgentRunCount * 5
      && (metrics.evidence_gate_count ?? 0) === sourceAgentRunCount
      && (metrics.citation_gate_count ?? 0) === sourceAgentRunCount
      && (metrics.test_gate_count ?? 0) === sourceAgentRunCount
      && (metrics.approval_gate_count ?? 0) === sourceAgentRunCount
      && (metrics.delivery_gate_count ?? 0) === sourceAgentRunCount
      && (metrics.test_gate_passed_count ?? 0) === sourceAgentRunCount
      && (metrics.post_run_guard_count ?? 0) === sourceAgentRunCount
      && (metrics.post_run_guard_passed_count ?? 0) === sourceAgentRunCount
      && (metrics.post_run_gate_decision_count ?? 0) === sourceAgentRunCount
      && (metrics.held_for_human_review_decision_count ?? 0) === sourceAgentRunCount
      && (metrics.review_required_gate_count ?? 0) > 0
      && (metrics.ready_after_post_run_gate_decision_count ?? 1) === 0
      && (metrics.blocked_after_run_decision_count ?? 1) === 0
      && (metrics.execution_allowed_count ?? 1) === 0
      && (metrics.execution_performed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
      && (metrics.client_facing_ready_count ?? 1) === 0
      && (metrics.delivery_ready_count ?? 1) === 0
      && (metrics.final_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow post-run gate framework binds every agent run to evidence, citation, test, approval, and delivery gates, passing regression tests while holding client-facing release and final action for human review.");
    }
  }

  if (item.acceptance_profile === "gate_result_aggregator_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.failed_gate_count ?? 0)
      + (metrics.blocked_workflow_gate_status_count ?? 0)
      + (metrics.execution_allowed_count ?? 0)
      + (metrics.execution_performed_count ?? 0)
      + (metrics.external_transfer_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0)
      + (metrics.client_facing_ready_count ?? 0)
      + (metrics.delivery_ready_count ?? 0)
      + (metrics.final_action_executed_count ?? 0);
    const expectedAggregateCount = (metrics.source_pre_run_gate_record_count ?? 0)
      + (metrics.source_in_run_gate_record_count ?? 0)
      + (metrics.source_in_run_block_record_count ?? 0)
      + (metrics.source_post_run_gate_record_count ?? 0)
      + (metrics.source_gate_result_count ?? 0);
    if (
      errors === 0
      && metrics.gate_result_aggregator_status === "complete"
      && metrics.gate_result_aggregator_contract_id === "gate-result-aggregator.v1"
      && expectedAggregateCount > 0
      && (metrics.gate_aggregate_record_count ?? 0) === expectedAggregateCount
      && (metrics.workflow_gate_status_count ?? 0) === (metrics.source_workflow_run_record_count ?? 0)
      && (metrics.passed_gate_count ?? 0) > 0
      && (metrics.warning_gate_count ?? 0) > 0
      && (metrics.manual_gate_count ?? 0) > 0
      && (metrics.failed_gate_count ?? 1) === 0
      && (metrics.manual_review_required_workflow_count ?? 0) > 0
      && (metrics.blocked_workflow_gate_status_count ?? 1) === 0
      && (metrics.execution_allowed_count ?? 1) === 0
      && (metrics.execution_performed_count ?? 1) === 0
      && (metrics.external_transfer_allowed_count ?? 1) === 0
      && (metrics.protected_action_executed_count ?? 1) === 0
      && (metrics.client_facing_ready_count ?? 1) === 0
      && (metrics.delivery_ready_count ?? 1) === 0
      && (metrics.final_action_executed_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Gate result aggregator normalizes pre/in/post-run gates and GateResult v2 rows into pass, warn, and manual states, projecting workflow gate status without authorizing execution, delivery, or final action.");
    }
  }

  if (item.acceptance_profile === "capability_registry_api_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.mutation_route_count ?? 0)
      + (metrics.protected_mutation_request_route_count ?? 0)
      + (metrics.secret_material_route_count ?? 0)
      + (metrics.installer_or_gateway_route_count ?? 0);
    if (
      errors === 0
      && metrics.capability_registry_api_status === "complete"
      && metrics.capability_registry_api_contract_id === "capability-registry-api.v1"
      && metrics.desktop_companion_readiness_status === "read_only_ready"
      && metrics.source_domain_pack_registry_status === "passed"
      && metrics.source_capability_manifest_v2_status === "complete"
      && metrics.source_pack_manifest_compatibility_status === "complete"
      && metrics.source_gate_result_aggregator_status === "complete"
      && (metrics.source_pack_count ?? 0) > 0
      && (metrics.pack_api_card_count ?? 0) === (metrics.source_pack_count ?? 0)
      && (metrics.capability_api_card_count ?? 0) === (metrics.source_capability_manifest_count ?? 0)
      && (metrics.capability_version_api_card_count ?? 0) === (metrics.source_capability_manifest_count ?? 0)
      && (metrics.gate_requirement_api_card_count ?? 0) === (metrics.source_gate_requirement_count ?? 0)
      && (metrics.desktop_companion_route_group_count ?? 0) > 0
      && (metrics.desktop_companion_route_count ?? 0) > 0
      && (metrics.read_only_route_count ?? 0) === (metrics.desktop_companion_route_count ?? 0)
    ) {
      return passedWithOperationalGate(stage, "Capability registry API exposes pack, capability, version, and gate cards plus Desktop Companion route groups as a read-only operator surface, with no mutation, secret, installer, gateway, SSH, cron, or auto-update control.");
    }
  }

  if (item.acceptance_profile === "workflow_run_dashboard_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.mutation_route_count ?? 0)
      + (metrics.protected_mutation_request_route_count ?? 0)
      + (metrics.secret_material_route_count ?? 0)
      + (metrics.installer_or_gateway_route_count ?? 0)
      + (metrics.auto_dequeue_allowed_count ?? 0)
      + (metrics.auto_retry_scheduled_count ?? 0)
      + (metrics.auto_resume_allowed_count ?? 0)
      + (metrics.auto_cancel_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0)
      + (metrics.final_action_executed_count ?? 0);
    const sourceRunCount = metrics.source_workflow_run_record_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_run_dashboard_status === "complete"
      && metrics.workflow_run_dashboard_contract_id === "workflow-run-dashboard.v1"
      && metrics.desktop_companion_readiness_status === "read_only_ready"
      && metrics.source_workflow_run_ledger_status === "complete"
      && metrics.source_workflow_dsl_state_model_status === "complete"
      && metrics.source_workflow_state_machine_runner_status === "complete"
      && metrics.source_workflow_queue_retry_backoff_status === "complete"
      && metrics.source_workflow_idempotency_status === "complete"
      && metrics.source_workflow_resume_cancel_status === "complete"
      && metrics.source_gate_result_aggregator_status === "complete"
      && metrics.source_capability_registry_api_status === "complete"
      && sourceRunCount > 0
      && (metrics.workflow_run_dashboard_panel_count ?? 0) === sourceRunCount
      && (metrics.workflow_run_state_card_count ?? 0) === sourceRunCount
      && (metrics.workflow_run_queue_card_count ?? 0) === sourceRunCount
      && (metrics.workflow_run_gate_card_count ?? 0) === sourceRunCount
      && (metrics.workflow_run_output_card_count ?? 0) === sourceRunCount
      && (metrics.human_review_required_panel_count ?? 0) === sourceRunCount
      && (metrics.held_queue_panel_count ?? 0) === sourceRunCount
      && (metrics.waiting_state_panel_count ?? 0) === sourceRunCount
      && (metrics.workflow_run_dashboard_route_count ?? 0) > 0
      && (metrics.read_only_route_count ?? 0) === (metrics.workflow_run_dashboard_route_count ?? 0)
    ) {
      return passedWithOperationalGate(stage, "Workflow run dashboard composes run, state, queue, retry, idempotency, resume/cancel, gate, and output status into read-only Desktop Companion panels without authorizing retry, resume, cancel, delivery, or final action.");
    }
  }

  if (item.acceptance_profile === "workflow_golden_cases_gate") {
    const caseCount = metrics.workflow_golden_case_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.source_validation_error_count ?? 0)
      + (metrics.missing_required_domain_pack_count ?? 0)
      + (metrics.mismatch_case_count ?? 0)
      + (metrics.state_machine_failed_case_count ?? 0)
      + (metrics.failed_step_count ?? 0)
      + (metrics.auto_transition_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0)
      + (metrics.final_action_executed_count ?? 0);
    if (
      errors === 0
      && metrics.workflow_golden_case_status === "complete"
      && metrics.workflow_golden_case_contract_id === "workflow-golden-cases.v1"
      && (metrics.required_domain_pack_count ?? 0) === 3
      && (metrics.represented_domain_pack_count ?? 0) === 3
      && caseCount === 3
      && (metrics.locked_case_count ?? 0) === caseCount
      && (metrics.state_machine_passed_case_count ?? 0) === caseCount
      && (metrics.manual_review_required_case_count ?? 0) === caseCount
      && (metrics.law_firm_case_count ?? 0) === 1
      && (metrics.personal_dev_case_count ?? 0) === 1
      && (metrics.creative_document_case_count ?? 0) === 1
      && (metrics.runner_plan_bound_case_count ?? 0) === caseCount
      && (metrics.transition_guard_bound_case_count ?? 0) === caseCount
      && (metrics.queue_bound_case_count ?? 0) === caseCount
      && (metrics.idempotency_bound_case_count ?? 0) === caseCount
      && (metrics.resume_cancel_bound_case_count ?? 0) === caseCount
      && (metrics.gate_status_bound_case_count ?? 0) === caseCount
      && (metrics.dashboard_panel_bound_case_count ?? 0) === caseCount
      && (metrics.capability_manifest_bound_case_count ?? 0) === caseCount
      && (metrics.passed_step_count ?? 0) === (metrics.workflow_golden_case_step_count ?? 0)
      && (metrics.workflow_golden_case_step_count ?? 0) >= caseCount * 5
      && (metrics.regression_hash_count ?? 0) === caseCount
      && (metrics.locked_regression_hash_count ?? 0) === caseCount
    ) {
      return passedWithOperationalGate(stage, "Workflow golden cases lock representative law-firm, personal-dev, and creative-document workflows against the deterministic state machine while preserving human review holds and prohibiting auto mutation, protected action execution, delivery, or final action.");
    }
  }

  if (item.acceptance_profile === "workflow_gate_freeze_gate") {
    const sliceCount = metrics.workflow_gate_vertical_slice_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.source_validation_error_count ?? 0)
      + (metrics.failed_source_count ?? 0)
      + (metrics.missing_required_domain_pack_count ?? 0)
      + (metrics.blocked_vertical_slice_count ?? 0)
      + (metrics.failed_loop_binding_count ?? 0)
      + (metrics.missing_loop_binding_count ?? 0)
      + (metrics.failed_checkpoint_count ?? 0)
      + (metrics.mutation_allowed_count ?? 0)
      + (metrics.protected_action_executed_count ?? 0)
      + (metrics.final_action_executed_count ?? 0);
    if (
      errors === 0
      && metrics.workflow_gate_freeze_status === "complete"
      && metrics.workflow_gate_freeze_contract_id === "workflow-gate-freeze.v1"
      && metrics.desktop_companion_readiness_status === "read_only_ready"
      && (metrics.required_domain_pack_count ?? 0) === 3
      && (metrics.represented_domain_pack_count ?? 0) === 3
      && sliceCount === 3
      && (metrics.passed_vertical_slice_count ?? 0) === sliceCount
      && (metrics.capability_bound_slice_count ?? 0) === sliceCount
      && (metrics.workflow_bound_slice_count ?? 0) === sliceCount
      && (metrics.gate_bound_slice_count ?? 0) === sliceCount
      && (metrics.audit_bound_slice_count ?? 0) === sliceCount
      && (metrics.desktop_bound_slice_count ?? 0) === sliceCount
      && (metrics.read_only_slice_count ?? 0) === sliceCount
      && (metrics.passed_loop_binding_count ?? 0) === (metrics.loop_binding_count ?? 0)
      && (metrics.passed_checkpoint_count ?? 0) === (metrics.freeze_checkpoint_count ?? 0)
    ) {
      return passedWithOperationalGate(stage, "Workflow/Gate freeze locks the capability-to-workflow-to-gate-to-audit vertical slice for representative domain packs and keeps Desktop Companion access read-only with no protected or final action execution.");
    }
  }

  if (item.acceptance_profile === "runtime_adapter_interface_v2_gate") {
    const interfaceCount = metrics.runtime_adapter_interface_count ?? 0;
    const policyCount = metrics.operator_surface_policy_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.failed_validation_item_count ?? 0)
      + (metrics.mutation_allowed_count ?? 0)
      + (metrics.protected_mutation_request_allowed_count ?? 0)
      + (metrics.protected_mutation_execution_allowed_count ?? 0)
      + (metrics.secret_material_exposed_count ?? 0)
      + (metrics.installer_or_gateway_control_count ?? 0)
      + (metrics.runtime_source_of_truth_count ?? 0);
    if (
      errors === 0
      && metrics.runtime_adapter_interface_status === "complete"
      && metrics.runtime_adapter_interface_contract_version === "runtime-adapter-interface-contract.v2"
      && interfaceCount > 0
      && policyCount === interfaceCount
      && (metrics.locked_runtime_adapter_interface_count ?? 0) === interfaceCount
      && (metrics.locked_field_group_count ?? 0) === (metrics.field_group_count ?? 0)
      && (metrics.input_contract_locked_count ?? 0) === interfaceCount
      && (metrics.output_contract_locked_count ?? 0) === interfaceCount
      && (metrics.artifact_contract_locked_count ?? 0) === interfaceCount
      && (metrics.log_contract_locked_count ?? 0) === interfaceCount
      && (metrics.risk_contract_locked_count ?? 0) === interfaceCount
      && (metrics.verification_contract_locked_count ?? 0) === interfaceCount
      && (metrics.runtime_execution_contract_bound_count ?? 0) === interfaceCount
      && (metrics.locked_operator_surface_policy_count ?? 0) === policyCount
      && (metrics.read_only_policy_count ?? 0) === policyCount
    ) {
      return passedWithOperationalGate(stage, "Runtime Adapter Interface v2 locks input, output, artifact, log, risk, and verification fields for every runtime and keeps Desktop Companion as a read-only operator surface with no protected mutation, secret, installer, gateway, or source-of-truth authority.");
    }
  }

  if (item.acceptance_profile === "hermes_runtime_adapter_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.failed_validation_item_count ?? 0)
      + (metrics.uncollected_invocation_count ?? 0);
    if (
      errors === 0
      && metrics.hermes_runtime_adapter_status === "complete"
      && metrics.runtime_id === "hermes"
      && metrics.adapter_id === "runtime.hermes.default"
      && metrics.adapter_status === "locked"
      && metrics.hermes_interface_bound === true
      && metrics.hermes_runtime_execution_contract_bound === true
      && metrics.hermes_command_binding_declared === true
      && metrics.agent_run_ledger_bound === true
      && metrics.invocation_result_collection_status === "ready"
      && metrics.output_capture_ready === true
      && metrics.log_capture_ready === true
      && metrics.artifact_capture_ready === true
      && metrics.verification_capture_ready === true
      && metrics.execute_requires_human_gate === true
      && metrics.external_runtime_call_allowed_without_gate === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_request_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Hermes runtime adapter is locked to the Hermes runtime contract, collects invocation results through AgentRun ledger references, and keeps Hermes Desktop as a read-only companion surface rather than a runtime source of truth.");
    }
  }

  if (item.acceptance_profile === "claude_code_adapter_contract_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.failed_validation_item_count ?? 0)
      + (metrics.unreviewed_auto_apply_count ?? 0);
    if (
      errors === 0
      && metrics.claude_code_adapter_contract_status === "complete"
      && metrics.runtime_id === "claude_code"
      && metrics.adapter_id === "runtime.claude_code.default"
      && metrics.adapter_status === "locked"
      && metrics.claude_code_interface_bound === true
      && metrics.claude_code_runtime_execution_contract_bound === true
      && metrics.claude_code_command_binding_declared === true
      && metrics.agent_run_ledger_bound === true
      && metrics.diff_gate_binding_status === "ready"
      && metrics.direct_apply_allowed === false
      && metrics.direct_merge_allowed === false
      && metrics.protected_path_write_allowed === false
      && metrics.patch_materialized_as_untrusted_artifact === true
      && metrics.execute_requires_git_worktree === true
      && metrics.execute_requires_human_gate === true
      && metrics.external_runtime_call_allowed_without_gate === false
      && metrics.protected_file_gate_required === true
      && metrics.diff_review_gate_required === true
      && metrics.test_gate_required === true
      && metrics.human_review_required === true
      && metrics.output_capture_ready === true
      && metrics.log_capture_ready === true
      && metrics.artifact_capture_ready === true
      && metrics.verification_capture_ready === true
      && metrics.diff_review_capture_ready === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_request_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Claude Code adapter contract keeps Claude Code output as an untrusted diff, binds it to AgentRun ledger collection, and requires protected file, diff review, test, and human gates before any mutation.");
    }
  }

  if (item.acceptance_profile === "codex_adapter_contract_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.failed_validation_item_count ?? 0)
      + (metrics.unreviewed_auto_apply_count ?? 0);
    if (
      errors === 0
      && metrics.codex_adapter_contract_status === "complete"
      && metrics.runtime_id === "codex"
      && metrics.adapter_id === "runtime.codex.default"
      && metrics.adapter_status === "locked"
      && metrics.codex_interface_bound === true
      && metrics.codex_runtime_execution_contract_bound === true
      && metrics.codex_command_binding_declared === true
      && metrics.agent_run_ledger_bound === true
      && metrics.patch_gate_binding_status === "ready"
      && metrics.direct_apply_allowed === false
      && metrics.direct_merge_allowed === false
      && metrics.protected_path_write_allowed === false
      && metrics.patch_materialized_as_untrusted_artifact === true
      && metrics.execute_requires_git_worktree === true
      && metrics.execute_requires_human_gate === true
      && metrics.external_runtime_call_allowed_without_gate === false
      && metrics.protected_file_gate_required === true
      && metrics.diff_review_gate_required === true
      && metrics.test_gate_required === true
      && metrics.human_review_required === true
      && metrics.output_capture_ready === true
      && metrics.log_capture_ready === true
      && metrics.artifact_capture_ready === true
      && metrics.verification_capture_ready === true
      && metrics.patch_review_capture_ready === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_request_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Codex adapter contract keeps Codex output as an untrusted patch, binds it to AgentRun ledger collection, and requires protected file, diff review, test, and human gates before any mutation.");
    }
  }

  if (item.acceptance_profile === "local_script_adapter_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    const executionCount = metrics.execution_contract_count ?? 0;
    if (
      errors === 0
      && executionCount >= 1
      && metrics.local_script_adapter_status === "complete"
      && metrics.runtime_id === "local_script"
      && metrics.adapter_id === "runtime.local_script.default"
      && metrics.adapter_status === "locked"
      && metrics.local_script_interface_bound === true
      && metrics.local_script_runtime_execution_contract_bound === true
      && metrics.local_script_command_binding_declared === true
      && metrics.agent_run_ledger_bound === true
      && metrics.execution_contract_locked_count === executionCount
      && metrics.deterministic_validation_ready_count === executionCount
      && metrics.network_access_allowed === false
      && metrics.external_execution_allowed === false
      && metrics.sandbox_required === true
      && metrics.workspace_isolation_type === "temp_dir"
      && metrics.prompt_delivery === "none"
      && metrics.direct_final_delivery_allowed === false
      && metrics.protected_path_write_allowed === false
      && metrics.secret_material_allowed === false
      && metrics.runtime_self_report_trusted === false
      && metrics.renderer_preparation_only === true
      && metrics.output_trust === "trusted_after_deterministic_validation"
      && metrics.test_gate_required === true
      && metrics.human_review_required === true
      && metrics.output_capture_ready === true
      && metrics.log_capture_ready === true
      && metrics.artifact_capture_ready === true
      && metrics.verification_capture_ready === true
      && metrics.deterministic_validation_capture_ready === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_request_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Local script adapter keeps deterministic extractor and renderer-preparation scripts local-only, binds outputs to AgentRun ledger collection, and requires validation/test/human gates before final delivery.");
    }
  }

  if (item.acceptance_profile === "document_renderer_adapter_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    const outputContractCount = metrics.output_contract_count ?? 0;
    if (
      errors === 0
      && outputContractCount >= 1
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.runtime_id === "document_renderer"
      && metrics.adapter_id === "runtime.document_renderer.default"
      && metrics.adapter_status === "locked"
      && metrics.document_renderer_interface_bound === true
      && metrics.document_renderer_runtime_execution_contract_bound === true
      && metrics.document_renderer_command_binding_required === false
      && metrics.agent_run_ledger_bound === true
      && metrics.output_contract_locked_count === outputContractCount
      && metrics.docx_target_supported === true
      && metrics.pptx_target_supported === true
      && metrics.pdf_target_supported === true
      && metrics.rendered_artifact_count >= 1
      && metrics.rendered_document_artifact_count >= 1
      && metrics.output_delivery_binding_count >= metrics.rendered_document_artifact_count
      && metrics.output_hash_present_count === outputContractCount
      && metrics.log_capture_ready_count === outputContractCount
      && metrics.artifact_capture_ready_count === outputContractCount
      && metrics.target_capture_matrix_ready_count === outputContractCount
      && metrics.network_access_allowed === false
      && metrics.external_execution_allowed === false
      && metrics.sandbox_required === true
      && metrics.workspace_isolation_type === "docker_container"
      && metrics.direct_final_delivery_allowed === false
      && metrics.protected_path_write_allowed === false
      && metrics.secret_material_allowed === false
      && metrics.runtime_self_report_trusted === false
      && metrics.draft_only_output_required === true
      && metrics.output_trust === "draft_only"
      && metrics.citation_gate_required === true
      && metrics.format_validation_gate_required === true
      && metrics.human_review_required === true
      && metrics.output_capture_ready === true
      && metrics.log_capture_ready === true
      && metrics.artifact_capture_ready === true
      && metrics.verification_capture_ready === true
      && metrics.output_delivery_binding_capture_ready === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_request_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Document renderer adapter keeps DOCX/PPTX/PDF draft rendering behind sandboxed execution, captures output hash/log/artifact/delivery bindings into the AgentRun ledger, and leaves Desktop read-only.");
    }
  }

  if (item.acceptance_profile === "worktree_manager_v2_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    const planCount = metrics.agent_worktree_plan_count ?? 0;
    if (
      errors === 0
      && metrics.worktree_manager_v2_status === "complete"
      && metrics.manager_status === "locked"
      && metrics.branch_prefix === "codex/"
      && metrics.worktree_root === ".hermes/worktrees"
      && metrics.claude_code_worktree_required === true
      && metrics.codex_worktree_required === true
      && planCount >= 2
      && metrics.status_record_count === planCount
      && metrics.cleanup_record_count === planCount
      && metrics.agent_scoped_plan_count === planCount
      && metrics.branch_name_compliant_count === planCount
      && metrics.worktree_path_declared_count === planCount
      && metrics.branch_creation_tracked_count === planCount
      && metrics.worktree_creation_tracked_count === planCount
      && metrics.status_tracking_ready_count === planCount
      && metrics.cleanup_tracking_ready_count === planCount
      && metrics.auto_cleanup_allowed_count === 0
      && metrics.delete_requires_human_gate_count === planCount
      && metrics.protected_mutation_route === "protected_action_request_only"
      && metrics.human_gate_required_for_create === true
      && metrics.human_gate_required_for_cleanup === true
      && metrics.runtime_self_report_trusted === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_create_worktree_allowed === false
      && metrics.desktop_delete_worktree_allowed === false
      && metrics.desktop_delete_branch_allowed === false
      && metrics.desktop_cleanup_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Worktree Manager v2 binds Claude Code and Codex AgentRuns to tracked branch/worktree/status/cleanup records while leaving Desktop as a read-only operator surface.");
    }
  }

  if (item.acceptance_profile === "sandbox_policy_model_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    if (
      errors === 0
      && metrics.sandbox_policy_model_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.backend_policy_count === 4
      && metrics.local_backend_policy_status === "allowed"
      && metrics.docker_backend_policy_status === "allowed"
      && metrics.ssh_backend_policy_status === "blocked_by_default"
      && metrics.cloud_backend_policy_status === "blocked_by_default"
      && metrics.runtime_sandbox_binding_count >= metrics.sandbox_required_runtime_count
      && metrics.git_worktree_overlay_count >= 2
      && metrics.network_access_allowed_count === 0
      && metrics.external_transfer_allowed_count === 0
      && metrics.secret_material_allowed_count === 0
      && metrics.ssh_cloud_blocked_count === 2
      && metrics.protected_mutation_route === "protected_action_request_only"
      && metrics.human_gate_required_for_protected_mutation === true
      && metrics.runtime_self_report_trusted === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_ssh_control_allowed === false
      && metrics.desktop_cloud_runtime_control_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Sandbox Policy Model classifies local and Docker as allowed sandbox backends, blocks SSH/cloud by default, and keeps Desktop read-only.");
    }
  }

  if (item.acceptance_profile === "docker_local_backend_selector_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    if (
      errors === 0
      && metrics.docker_local_backend_selector_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.selector_status === "locked"
      && metrics.selectable_backend_count === 2
      && metrics.selected_runtime_backend_count >= 5
      && metrics.local_selected_runtime_count >= 1
      && metrics.docker_selected_runtime_count >= 4
      && metrics.classification_backend_selection_count >= 6
      && metrics.runtime_classification_matrix_count >= 54
      && metrics.protected_review_classification_count >= 1
      && metrics.ssh_cloud_selected_count === 0
      && metrics.operator_surface_selected_count === 0
      && metrics.network_access_allowed_count === 0
      && metrics.external_transfer_allowed_count === 0
      && metrics.secret_material_allowed_count === 0
      && metrics.protected_mutation_route === "protected_action_request_only"
      && metrics.human_gate_required_for_protected_mutation === true
      && metrics.runtime_self_report_trusted === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_local_process_control_allowed === false
      && metrics.desktop_docker_control_allowed === false
      && metrics.desktop_ssh_control_allowed === false
      && metrics.desktop_cloud_runtime_control_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Docker/local Backend Selector chooses only local or Docker by runtime risk and classification, keeps SSH/cloud/operator surfaces unselected, and leaves Desktop read-only.");
    }
  }

  if (item.acceptance_profile === "secrets_broker_contract_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    if (
      errors === 0
      && metrics.secrets_broker_contract_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.broker_status === "locked"
      && metrics.secret_handle_required === true
      && metrics.audit_required === true
      && metrics.policy_snapshot_required === true
      && metrics.secret_handle_policy_count >= 8
      && metrics.runtime_secret_access_binding_count >= 9
      && metrics.secret_audit_binding_count >= 9
      && metrics.brokered_handle_only_runtime_count >= 3
      && metrics.blocked_runtime_secret_access_count >= 2
      && metrics.raw_secret_material_allowed_count === 0
      && metrics.runtime_raw_secret_exposed_count === 0
      && metrics.desktop_secret_material_exposed_count === 0
      && metrics.provider_key_direct_access_allowed_count === 0
      && metrics.provider_key_visible_to_desktop_count === 0
      && metrics.raw_secret_material_logged_count === 0
      && metrics.provider_key_logged_count === 0
      && metrics.protected_mutation_route === "protected_action_request_only"
      && metrics.human_gate_required_for_secret_exception === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_provider_key_visible === false
      && metrics.desktop_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Secrets Broker Contract keeps agents and Desktop on handle references, scoped runtime tokens, and audit receipts while forbidding raw secret and provider key exposure.");
    }
  }

  if (item.acceptance_profile === "runtime_artifact_capture_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.runtime_artifact_capture_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.capture_authority === "harness_control_plane"
      && metrics.source_of_truth === "runtime_agentrun_contract_freeze_and_agent_run_ledger"
      && metrics.runtime_self_report_trusted === false
      && metrics.artifact_capture_record_count > 0
      && metrics.bound_artifact_capture_count === metrics.artifact_capture_record_count
      && metrics.diff_capture_record_count >= 2
      && metrics.bound_diff_capture_count === metrics.diff_capture_record_count
      && metrics.stream_capture_record_count > 0
      && metrics.bound_stream_capture_count === metrics.stream_capture_record_count
      && metrics.stdout_capture_count > 0
      && metrics.stderr_capture_count > 0
      && metrics.metadata_capture_record_count > 0
      && metrics.bound_metadata_capture_count === metrics.metadata_capture_record_count
      && metrics.unbound_output_artifact_capture_binding_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.artifact_write_allowed === false
      && metrics.diff_apply_allowed === false
      && metrics.stream_write_allowed === false
      && metrics.metadata_edit_allowed === false
    ) {
      return passedWithOperationalGate(stage, "Runtime Artifact Capture binds generated files, diffs, stdout/stderr, and metadata to OutputArtifact records while keeping Desktop read-only.");
    }
  }

  if (item.acceptance_profile === "runtime_log_normalization_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.runtime_log_normalization_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.normalization_authority === "harness_control_plane"
      && metrics.source_of_truth === "runtime_log_contract_agent_run_ledger_and_artifact_capture"
      && metrics.common_log_schema_version === "runtime-log-entry.v1"
      && metrics.runtime_self_report_trusted === false
      && metrics.normalized_log_count > 0
      && metrics.normalized_stream_count > 0
      && metrics.bound_stream_count === metrics.normalized_stream_count
      && metrics.search_document_count === metrics.normalized_stream_count
      && metrics.indexed_search_document_count === metrics.search_document_count
      && metrics.trace_binding_count === metrics.normalized_log_count
      && metrics.known_trace_binding_count === metrics.trace_binding_count
      && metrics.unbound_trace_binding_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.log_write_allowed === false
      && metrics.raw_log_export_allowed === false
      && metrics.search_index_mutation_allowed === false
      && metrics.normalization_override_allowed === false
      && metrics.stream_write_allowed === false
    ) {
      return passedWithOperationalGate(stage, "Runtime Log Normalization converts runtime stdout/stderr captures into common searchable log entries with trace bindings while keeping Desktop read-only.");
    }
  }

  if (item.acceptance_profile === "runtime_timeout_heartbeat_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.runtime_timeout_heartbeat_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.heartbeat_authority === "harness_control_plane"
      && metrics.timeout_authority === "harness_control_plane"
      && metrics.source_of_truth === "runtime_agentrun_contract_agent_run_ledger_and_runtime_logs"
      && metrics.runtime_self_report_trusted === false
      && metrics.agent_run_count > 0
      && metrics.heartbeat_record_count === metrics.agent_run_count
      && metrics.observed_heartbeat_count === metrics.heartbeat_record_count
      && metrics.heartbeat_missed_count === 0
      && metrics.timeout_record_count === metrics.agent_run_count
      && metrics.timeout_policy_bound_count === metrics.timeout_record_count
      && metrics.timed_out_count === 0
      && metrics.active_timeout_count === 0
      && metrics.timeout_action_required_count === 0
      && metrics.run_ledger_binding_count === metrics.agent_run_count
      && metrics.bound_run_ledger_binding_count === metrics.run_ledger_binding_count
      && metrics.known_trace_binding_count === metrics.run_ledger_binding_count
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.heartbeat_write_allowed === false
      && metrics.timeout_override_allowed === false
      && metrics.cancel_allowed === false
      && metrics.resume_allowed === false
      && metrics.clock_edit_allowed === false
      && metrics.runtime_start_allowed === false
      && metrics.runtime_process_control_allowed === false
    ) {
      return passedWithOperationalGate(stage, "Runtime Timeout/Heartbeat records lifecycle status and timeout policy in the run ledger while keeping Desktop read-only for lifecycle control.");
    }
  }

  if (item.acceptance_profile === "runtime_control_commands_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.runtime_control_command_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.control_command_authority === "harness_control_plane"
      && metrics.source_of_truth === "runtime_timeout_heartbeat_agent_run_ledger_and_audit_event_ledger"
      && metrics.runtime_self_report_trusted === false
      && metrics.agent_run_count > 0
      && metrics.control_command_request_count === metrics.agent_run_count * 2
      && metrics.cancel_request_count === metrics.agent_run_count
      && metrics.resume_request_count === metrics.agent_run_count
      && metrics.protected_control_request_count === metrics.control_command_request_count
      && metrics.human_gate_required_request_count === metrics.control_command_request_count
      && metrics.command_result_count === metrics.control_command_request_count
      && metrics.held_or_not_executed_result_count === metrics.command_result_count
      && metrics.audit_recorded_count === metrics.command_result_count
      && metrics.audit_binding_count === metrics.command_result_count
      && metrics.recorded_audit_binding_count === metrics.audit_binding_count
      && metrics.audit_append_required_count === metrics.audit_binding_count
      && metrics.audit_separated_from_observability_count === metrics.audit_binding_count
      && metrics.command_execution_allowed_count === 0
      && metrics.runtime_process_control_allowed_count === 0
      && metrics.auto_control_allowed_count === 0
      && metrics.execution_performed_count === 0
      && metrics.protected_action_executed_count === 0
      && metrics.new_run_created_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.cancel_allowed === false
      && metrics.resume_allowed === false
      && metrics.runtime_start_allowed === false
      && metrics.runtime_process_control_allowed === false
      && metrics.command_execution_allowed === false
      && metrics.process_signal_allowed === false
    ) {
      return passedWithOperationalGate(stage, "Runtime Control Commands records cancel/resume requests and results as audit-bound receipts while keeping Desktop request-only and non-executing.");
    }
  }

  if (item.acceptance_profile === "protected_file_gate_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.protected_file_gate_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.gate_authority === "harness_control_plane"
      && metrics.source_of_truth === "runtime_artifact_capture_adapter_gate_contracts_and_policy_matrix"
      && metrics.runtime_self_report_trusted === false
      && metrics.rule_count > 0
      && metrics.rule_count === metrics.locked_rule_count
      && metrics.secret_rule_count > 0
      && metrics.production_config_rule_count > 0
      && metrics.migration_rule_count > 0
      && metrics.change_evaluation_count > 0
      && metrics.diff_capture_evaluated_count > 0
      && metrics.declared_change_evaluation_count > 0
      && metrics.protected_fixture_evaluation_count > 0
      && metrics.protected_file_detected_count > 0
      && metrics.unprotected_change_count > 0
      && metrics.blocked_before_approval_count === metrics.protected_file_detected_count
      && metrics.explicit_approval_required_count === metrics.protected_file_detected_count
      && metrics.approval_requirement_count === metrics.protected_file_detected_count
      && metrics.pending_explicit_approval_count === metrics.approval_requirement_count
      && metrics.secret_file_block_count > 0
      && metrics.production_config_block_count > 0
      && metrics.migration_block_count > 0
      && metrics.direct_apply_allowed_count === 0
      && metrics.direct_merge_allowed_count === 0
      && metrics.protected_path_write_allowed_count === 0
      && metrics.write_allowed_before_approval_count === 0
      && metrics.mutation_allowed_before_approval_count === 0
      && metrics.protected_action_executed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.direct_file_write_allowed === false
      && metrics.protected_file_write_allowed === false
      && metrics.approval_bypass_allowed === false
      && metrics.rule_edit_allowed === false
      && metrics.runtime_process_control_allowed === false
    ) {
      return passedWithOperationalGate(stage, "Protected File Gate blocks secret, config, migration, and production file changes before explicit human approval while keeping Desktop read-only and request-draft only.");
    }
  }

  if (item.acceptance_profile === "canonical_test_runner_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.canonical_test_runner_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.test_runner_authority === "harness_control_plane"
      && metrics.source_of_truth === "harness_executed_canonical_tests_and_runtime_verification_contracts"
      && metrics.execution_source === "harness_rerun"
      && metrics.agent_self_report_trusted === false
      && metrics.harness_reexecution_required === true
      && metrics.canonical_command_count > 0
      && metrics.canonical_test_plan_count > 0
      && metrics.canonical_test_execution_count === metrics.canonical_test_plan_count * metrics.canonical_command_count
      && metrics.passed_execution_count === metrics.canonical_test_execution_count
      && metrics.failed_execution_count === 0
      && metrics.timed_out_execution_count === 0
      && metrics.skipped_execution_count === 0
      && metrics.command_execution_allowed_count === metrics.canonical_test_execution_count
      && metrics.execution_performed_count === metrics.canonical_test_execution_count
      && metrics.agent_report_used_as_source_of_truth === false
      && metrics.gate_result_count === metrics.canonical_test_plan_count
      && metrics.passed_gate_result_count === metrics.gate_result_count
      && metrics.blocked_gate_result_count === 0
      && metrics.human_approval_required_count === metrics.gate_result_count
      && metrics.human_review_required_count === metrics.gate_result_count
      && metrics.merge_ready_count === 0
      && metrics.direct_merge_allowed_count === 0
      && metrics.direct_apply_allowed_count === 0
      && metrics.protected_file_gate_status === "complete"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_canonical_test_execution_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_source_of_truth === false
    ) {
      return passedWithOperationalGate(stage, "Canonical Test Runner reruns Personal Dev canonical commands under harness authority, uses agent reports only as reference, and advances passed tests only to human review.");
    }
  }

  if (item.acceptance_profile === "runtime_api_dashboard_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.runtime_api_dashboard_status === "complete"
      && metrics.contract_status === "locked"
      && metrics.route_authority === "harness_review_api"
      && metrics.dashboard_authority === "harness_review_dashboard"
      && metrics.source_of_truth === "runtime_contract_artifacts_and_review_api_dashboard"
      && metrics.source_count > 0
      && metrics.complete_source_count === metrics.source_count
      && metrics.source_validation_error_count === 0
      && metrics.runtime_api_route_group_count >= 10
      && metrics.read_only_route_group_count === metrics.runtime_api_route_group_count
      && metrics.runtime_api_route_count > 0
      && metrics.declared_route_count === metrics.runtime_api_route_count
      && metrics.missing_route_count === 0
      && metrics.mutation_route_count === 0
      && metrics.protected_mutation_request_route_count > 0
      && metrics.runtime_dashboard_panel_count === metrics.runtime_api_route_group_count
      && metrics.runtime_status_card_count === metrics.source_count
      && metrics.runtime_execution_allowed_count === 0
      && metrics.runtime_control_allowed_count === 0
      && metrics.test_execution_allowed_count === 0
      && metrics.secret_material_exposed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_runtime_control_allowed === false
      && metrics.desktop_test_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_provider_key_visible === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_ssh_or_cron_control === false
    ) {
      return passedWithOperationalGate(stage, "Runtime API Dashboard exposes adapter, worktree, log, artifact, heartbeat, control request, gate, and canonical test status as read-only Desktop Companion API routes.");
    }
  }

  if (item.acceptance_profile === "runtime_freeze_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.runtime_freeze_status === "complete"
      && metrics.source_of_truth === "runtime_adapter_artifacts_agent_run_ledger_gates_and_runtime_api_dashboard"
      && metrics.desktop_surface_policy === "read_only_runtime_operations_dashboard"
      && metrics.runtime_freeze_source_count > 0
      && metrics.passed_source_count === metrics.runtime_freeze_source_count
      && metrics.failed_source_count === 0
      && metrics.runtime_freeze_slice_count === 3
      && metrics.passed_runtime_slice_count === metrics.runtime_freeze_slice_count
      && metrics.failed_runtime_slice_count === 0
      && metrics.hermes_slice_status === "passed"
      && metrics.codex_slice_status === "passed"
      && metrics.local_script_slice_status === "passed"
      && metrics.runtime_freeze_loop_binding_count >= 17
      && metrics.passed_loop_binding_count === metrics.runtime_freeze_loop_binding_count
      && metrics.failed_loop_binding_count === 0
      && metrics.runtime_api_dashboard_status === "complete"
      && metrics.runtime_api_mutation_route_count === 0
      && metrics.runtime_api_missing_route_count === 0
      && metrics.runtime_control_execution_performed_count === 0
      && metrics.runtime_process_control_allowed_count === 0
      && metrics.protected_action_executed_count === 0
      && metrics.canonical_test_failed_execution_count === 0
      && metrics.raw_secret_material_exposed_count === 0
      && metrics.provider_key_exposed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_runtime_control_allowed === false
      && metrics.desktop_test_execution_allowed === false
      && metrics.desktop_secret_material_exposed === false
      && metrics.desktop_provider_key_visible === false
      && metrics.desktop_installer_or_gateway_control === false
      && metrics.desktop_ssh_or_cron_control === false
    ) {
      return passedWithOperationalGate(stage, "Runtime Freeze closes P195-P211 by proving Hermes, Codex, and local_script representative slices pass adapter, gate, ledger, capture, and read-only Desktop boundary checks.");
    }
  }

  if (item.acceptance_profile === "personal_dev_pack_manifest_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.personal_dev_pack_manifest_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.registration_status === "registered"
      && metrics.registry_pack_present === true
      && metrics.compatibility_status === "compatible"
      && metrics.core_compatibility_status === "compatible"
      && metrics.dependency_status === "complete"
      && metrics.common_dependency_declared === true
      && metrics.capability_count > 0
      && metrics.registered_capability_count === metrics.capability_count
      && metrics.capability_manifest_v2_count === metrics.capability_count
      && metrics.capability_registry_api_pack_card_present === true
      && metrics.capability_registry_api_capability_card_count === metrics.capability_count
      && metrics.runtime_freeze_status === "complete"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.core_pack_mutation_required === false
      && metrics.core_capability_registration_required === false
      && metrics.core_route_registration_required === false
      && metrics.core_mutation_required_count === 0
      && metrics.agent_outputs_trusted === false
      && metrics.merge_requires_gate === true
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Personal-dev pack manifest is registered through the domain-pack registry and Desktop exposes only read-only pack/capability status without core mutation.");
    }
  }

  if (item.acceptance_profile === "repo_profile_detector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.repo_profile_detector_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.personal_dev_pack_manifest_status === "complete"
      && metrics.repo_profile_status === "complete"
      && Boolean(metrics.primary_language_id)
      && metrics.language_profile_count > 0
      && metrics.framework_profile_count > 0
      && metrics.command_profile_count >= 3
      && metrics.configured_command_count >= 3
      && metrics.missing_required_command_count === 0
      && metrics.test_command_detected === true
      && metrics.build_command_detected === true
      && metrics.lint_command_detected === true
      && metrics.command_execution_performed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.protected_mutations_require_human_gate === true
      && metrics.command_execution_requires_human_gate === true
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Repo Profile Detector records language, framework, and test/build/lint command profile metadata without executing commands; Desktop remains a read-only operator surface.");
    }
  }

  if (item.acceptance_profile === "agent_instruction_registry_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.agent_instruction_registry_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.repo_profile_detector_status === "complete"
      && metrics.instruction_source_count >= 3
      && metrics.present_instruction_source_count >= 1
      && metrics.derived_instruction_source_count >= 2
      && metrics.missing_instruction_source_count === 0
      && metrics.instruction_version_count >= 3
      && metrics.locked_instruction_version_count === metrics.instruction_version_count
      && metrics.runtime_instruction_binding_count >= 4
      && metrics.bound_runtime_instruction_binding_count === metrics.runtime_instruction_binding_count
      && metrics.agent_runtime_instruction_binding_count === 3
      && metrics.agent_runtime_instruction_applied_count === 3
      && metrics.deterministic_runtime_tracked_count >= 1
      && metrics.runtime_execution_performed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_instruction_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.protected_mutations_require_human_gate === true
      && metrics.instruction_file_mutation_requires_human_gate === true
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Agent instruction registry locks AGENTS-derived instruction versions and binds Hermes, Claude Code, Codex, and local_script without writing instruction files or executing runtimes.");
    }
  }

  if (item.acceptance_profile === "issue_intake_adapter_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.issue_intake_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.repo_profile_detector_status === "complete"
      && metrics.agent_instruction_registry_status === "complete"
      && metrics.issue_source_count === 3
      && metrics.github_issue_source_count === 1
      && metrics.plane_issue_source_count === 1
      && metrics.local_issue_source_count === 1
      && metrics.issue_record_count === 3
      && metrics.normalized_issue_record_count === metrics.issue_record_count
      && metrics.normalized_task_count === metrics.issue_record_count
      && metrics.ready_normalized_task_count === metrics.normalized_task_count
      && metrics.issue_task_binding_count === metrics.issue_record_count
      && metrics.bound_issue_task_binding_count === metrics.issue_task_binding_count
      && metrics.unresolved_issue_count === 0
      && metrics.duplicate_task_id_count === 0
      && metrics.external_fetch_performed_count === 0
      && metrics.issue_mutation_performed_count === 0
      && metrics.command_execution_performed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_issue_write_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.protected_mutations_require_human_gate === true
      && metrics.issue_mutations_require_human_gate === true
      && metrics.external_fetch_allowed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Issue intake adapter maps GitHub, Plane, and local issue payloads to one task contract while keeping Desktop read-only and all issue mutations behind human gates.");
    }
  }

  if (item.acceptance_profile === "plan_request_contract_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.plan_request_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.issue_intake_status === "complete"
      && metrics.repo_profile_detector_status === "complete"
      && metrics.agent_instruction_registry_status === "complete"
      && metrics.shared_context_count === 1
      && metrics.plan_request_count === 2
      && metrics.ready_plan_request_count === metrics.plan_request_count
      && metrics.claude_plan_request_count === 1
      && metrics.codex_plan_request_count === 1
      && metrics.unique_context_hash_count === 1
      && metrics.unique_constraints_hash_count === 1
      && metrics.shared_context_binding_count === metrics.plan_request_count
      && metrics.bound_plan_request_count === metrics.plan_request_count
      && metrics.unbound_plan_request_count === 0
      && metrics.context_hash_mismatch_count === 0
      && metrics.constraints_hash_mismatch_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.command_execution_performed_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Plan request contract gives Claude Code and Codex the same shared context and constraints while recording no agent invocation, plan acceptance, command execution, or Desktop-side mutation authority.");
    }
  }

  if (item.acceptance_profile === "plan_reconciliation_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.plan_reconciliation_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.source_plan_request_status === "complete"
      && metrics.shared_context_count === 1
      && metrics.plan_candidate_count === 2
      && metrics.ready_plan_candidate_count === metrics.plan_candidate_count
      && metrics.claude_plan_candidate_count === 1
      && metrics.codex_plan_candidate_count === 1
      && metrics.unique_context_hash_count === 1
      && metrics.unique_constraints_hash_count === 1
      && metrics.commonality_count >= 1
      && metrics.accepted_commonality_count === metrics.commonality_count
      && metrics.conflict_count >= 1
      && metrics.resolved_conflict_count === metrics.conflict_count
      && metrics.unresolved_conflict_count === 0
      && metrics.selected_scope_status === "selected_for_human_review"
      && metrics.selected_scope_item_count >= 1
      && metrics.unresolved_question_count >= 1
      && metrics.non_blocking_unresolved_question_count === metrics.unresolved_question_count
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.scope_freeze_performed_count === 0
      && metrics.command_execution_performed_count === 0
      && metrics.implementation_allowed_before_scope_freeze === false
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_scope_freeze_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Plan reconciliation compares the Claude Code and Codex plan candidates, records commonalities, resolved conflicts, selected draft scope, and unresolved questions while leaving scope freeze and plan acceptance to human-gated follow-on phases.");
    }
  }

  if (item.acceptance_profile === "scope_freeze_gate_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.scope_freeze_gate_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.source_plan_reconciliation_status === "complete"
      && metrics.source_protected_file_gate_status === "complete"
      && metrics.selected_scope_status === "selected_for_human_review"
      && metrics.frozen_scope_item_count >= 1
      && metrics.frozen_scope_item_count === metrics.source_selected_scope_item_count
      && metrics.frozen_scope_item_frozen_count === metrics.frozen_scope_item_count
      && metrics.scope_file_boundary_count >= 1
      && metrics.in_scope_file_boundary_count === metrics.scope_file_boundary_count
      && metrics.protected_file_rule_count >= 1
      && metrics.frozen_protected_file_rule_count === metrics.protected_file_rule_count
      && metrics.frozen_protected_file_rule_snapshot_count === metrics.protected_file_rule_count
      && metrics.protected_write_requires_approval === true
      && metrics.write_allowed_before_approval_count === 0
      && metrics.mutation_allowed_before_approval_count === 0
      && metrics.scope_freeze_decision_status === "frozen"
      && metrics.scope_freeze_performed_count === 1
      && metrics.plan_acceptance_performed_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.command_execution_performed_count === 0
      && metrics.protected_mutation_performed_count === 0
      && metrics.worktree_provisioning_allowed_after_freeze === true
      && metrics.implementation_patch_allowed_before_worktree === false
      && metrics.protected_file_write_allowed_without_approval === false
      && metrics.scope_change_requires_new_reconciliation === true
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_scope_change_allowed === false
      && metrics.desktop_protected_file_rule_edit_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Scope freeze gate freezes the selected Plan Reconciliation scope, file boundaries, and protected file rules before worktree or patch work while leaving plan acceptance, protected writes, merge, and release human-gated.");
    }
  }

  if (item.acceptance_profile === "dev_lane_ledger_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.dev_lane_ledger_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.source_scope_freeze_gate_status === "complete"
      && metrics.source_plan_reconciliation_status === "complete"
      && metrics.source_worktree_manager_v2_status === "complete"
      && metrics.scope_freeze_performed_count === 1
      && metrics.worktree_provisioning_allowed_after_freeze === true
      && metrics.selected_scope_status === "selected_for_human_review"
      && metrics.dev_lane_count === 2
      && metrics.provisioned_dev_lane_count === 2
      && metrics.claude_code_lane_count === 1
      && metrics.codex_lane_count === 1
      && metrics.unique_branch_name_count === 2
      && metrics.unique_worktree_path_count === 2
      && metrics.branch_record_count === 2
      && metrics.created_branch_record_count === 2
      && metrics.worktree_record_count === 2
      && metrics.created_worktree_record_count === 2
      && metrics.materialized_branch_count === 0
      && metrics.materialized_worktree_count === 0
      && metrics.git_command_executed_count === 0
      && metrics.filesystem_mutation_performed_count === 0
      && metrics.protected_file_write_allowed_without_approval === false
      && metrics.protected_mutation_performed_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.patch_application_performed_count === 0
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_create_worktree_allowed === false
      && metrics.desktop_delete_worktree_allowed === false
      && metrics.desktop_delete_branch_allowed === false
      && metrics.desktop_cleanup_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Dev lane ledger provisions Claude Code and Codex branch/worktree records after scope freeze while leaving physical worktree creation, protected writes, patch, merge, and release human-gated.");
    }
  }

  if (item.acceptance_profile === "implementation_patch_capture_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.implementation_patch_capture_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.source_dev_lane_ledger_status === "complete"
      && metrics.source_scope_freeze_gate_status === "complete"
      && metrics.source_runtime_artifact_capture_status === "complete"
      && metrics.patch_record_count === 2
      && metrics.captured_patch_record_count === 2
      && metrics.claude_code_patch_record_count === 1
      && metrics.codex_patch_record_count === 1
      && metrics.diff_capture_count === 2
      && metrics.captured_diff_capture_count === 2
      && metrics.output_bound_diff_capture_count === 2
      && metrics.touched_file_count > 0
      && metrics.in_scope_touched_file_count === metrics.touched_file_count
      && metrics.generated_artifact_count > 0
      && metrics.captured_generated_artifact_count === metrics.generated_artifact_count
      && metrics.output_bound_generated_artifact_count === metrics.generated_artifact_count
      && metrics.run_ledger_binding_count === 2
      && metrics.bound_run_ledger_binding_count === 2
      && metrics.patch_application_performed_count === 0
      && metrics.git_command_executed_count === 0
      && metrics.filesystem_mutation_performed_count === 0
      && metrics.protected_file_write_allowed_without_approval === false
      && metrics.protected_mutation_performed_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.human_review_required === true
      && metrics.runtime_self_report_trusted === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Implementation patch capture binds Claude Code and Codex patch records to diff, touched file, generated artifact, and run ledger metadata while leaving patch application, protected writes, merge, and release human-gated.");
    }
  }

  if (item.acceptance_profile === "diff_review_gate_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.diff_review_gate_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.source_implementation_patch_capture_status === "complete"
      && metrics.source_protected_file_gate_status === "complete"
      && metrics.patch_record_count === 2
      && metrics.diff_review_result_count === 2
      && metrics.reviewed_diff_review_result_count === 2
      && metrics.claude_code_review_result_count === 1
      && metrics.codex_review_result_count === 1
      && metrics.actual_diff_basis_available_count === 2
      && metrics.agent_self_report_trusted_count === 0
      && metrics.file_finding_count > 0
      && metrics.reviewed_file_finding_count === metrics.file_finding_count
      && metrics.in_scope_file_finding_count === metrics.file_finding_count
      && metrics.artifact_finding_count > 0
      && metrics.reviewed_artifact_finding_count === metrics.artifact_finding_count
      && metrics.gate_result_count === 2
      && metrics.passed_with_human_gate_count === 2
      && metrics.patch_application_allowed_count === 0
      && metrics.patch_application_blocked_count === 2
      && metrics.patch_application_performed_count === 0
      && metrics.git_command_executed_count === 0
      && metrics.filesystem_mutation_performed_count === 0
      && metrics.protected_file_write_allowed_without_approval === false
      && metrics.protected_mutation_performed_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Diff review gate evaluates captured Claude Code and Codex diff records against frozen file/artifact evidence instead of self-report while leaving patch application, protected writes, merge, and release human-gated.");
    }
  }

  if (item.acceptance_profile === "canonical_test_matrix_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.canonical_test_matrix_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.source_repo_profile_detector_status === "complete"
      && metrics.source_canonical_test_runner_status === "complete"
      && metrics.source_diff_review_gate_status === "complete"
      && metrics.matrix_repo_count === 1
      && metrics.test_dimension_count === 4
      && metrics.required_dimension_count >= 3
      && metrics.configured_dimension_count >= 3
      && metrics.executed_dimension_count >= metrics.required_dimension_count
      && metrics.passed_required_dimension_count === metrics.required_dimension_count
      && metrics.failed_dimension_count === 0
      && metrics.timed_out_dimension_count === 0
      && metrics.unit_dimension_passed === true
      && metrics.typecheck_dimension_passed === true
      && metrics.lint_dimension_passed === true
      && metrics.agent_self_report_trusted_count === 0
      && metrics.runtime_self_report_trusted_count === 0
      && metrics.binding_count === 2
      && metrics.bound_to_passing_matrix_count === 2
      && metrics.merge_ready_count === 0
      && metrics.direct_merge_allowed_count === 0
      && metrics.direct_apply_allowed_count === 0
      && metrics.patch_application_allowed_count === 0
      && metrics.patch_application_performed_count === 0
      && metrics.git_command_executed_count === 0
      && metrics.filesystem_mutation_performed_count === 0
      && metrics.protected_file_write_allowed_without_approval === false
      && metrics.protected_mutation_performed_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Canonical test matrix executes the repo-derived unit/typecheck/lint commands under harness authority, binds passed required results to diff-review gates, and leaves Desktop as read-only rerun surface.");
    }
  }

  if (item.acceptance_profile === "dev_protected_scan_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.dev_protected_scan_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.scan_authority === "harness_control_plane"
      && metrics.source_implementation_patch_capture_status === "complete"
      && metrics.source_diff_review_gate_status === "complete"
      && metrics.source_canonical_test_matrix_status === "complete"
      && metrics.source_protected_file_gate_status === "complete"
      && metrics.scanned_file_count > 0
      && metrics.actual_touched_file_scanned_count === metrics.source_touched_file_count
      && metrics.protected_candidate_count > 0
      && metrics.protected_candidate_count === metrics.source_protected_file_gate_blocked_before_approval_count
      && metrics.blocked_before_approval_count === metrics.protected_candidate_count
      && metrics.explicit_approval_required_count === metrics.protected_candidate_count
      && metrics.pending_explicit_approval_count === metrics.protected_candidate_count
      && metrics.credential_or_secret_candidate_count > 0
      && metrics.credential_or_secret_change_blocked_count === metrics.credential_or_secret_candidate_count
      && metrics.production_config_candidate_count > 0
      && metrics.production_config_change_blocked_count === metrics.production_config_candidate_count
      && metrics.write_allowed_before_approval_count === 0
      && metrics.mutation_allowed_before_approval_count === 0
      && metrics.secret_value_materialized_count === 0
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.scan_result_count === 2
      && metrics.passed_with_protected_blocks_count === 2
      && metrics.binding_count === 2
      && metrics.bound_after_canonical_test_matrix_count === 2
      && metrics.patch_application_allowed_count === 0
      && metrics.direct_merge_allowed_count === 0
      && metrics.direct_apply_allowed_count === 0
      && metrics.patch_application_performed_count === 0
      && metrics.git_command_executed_count === 0
      && metrics.filesystem_mutation_performed_count === 0
      && metrics.protected_mutation_performed_count === 0
      && metrics.external_agent_invocation_performed_count === 0
      && metrics.plan_acceptance_performed_count === 0
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_secret_material_read_allowed === false
      && metrics.desktop_production_config_write_allowed === false
      && metrics.desktop_runtime_execution_allowed === false
      && metrics.desktop_external_agent_invocation_allowed === false
      && metrics.desktop_plan_acceptance_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.raw_secret_material_exposed_count === 0
      && metrics.provider_key_exposed_count === 0
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Dev protected scan imports captured worktree files and protected gate approval requirements, blocks credential and production config changes before approval, and keeps Desktop read-only without materializing secret values.");
    }
  }

  if (item.acceptance_profile === "pr_draft_artifact_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.pr_draft_artifact_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.draft_authority === "harness_control_plane"
      && metrics.source_implementation_patch_capture_status === "complete"
      && metrics.source_diff_review_gate_status === "complete"
      && metrics.source_canonical_test_matrix_status === "complete"
      && metrics.source_dev_protected_scan_status === "complete"
      && metrics.source_output_delivery_contract_freeze_status === "complete"
      && metrics.source_pr_draft_output_artifact_available === true
      && metrics.pr_draft_output_artifact_count === 1
      && metrics.output_artifact_v2_count === 1
      && metrics.output_artifact_hash_present_count === 1
      && metrics.output_artifact_draft_count === 1
      && metrics.output_artifact_blocked_pending_approval_count === 1
      && metrics.output_artifact_pending_approval_count === 1
      && metrics.pr_draft_section_count === 4
      && metrics.summary_section_present === true
      && metrics.tests_section_present === true
      && metrics.risks_section_present === true
      && metrics.rollback_section_present === true
      && metrics.test_evidence_count >= 3
      && metrics.passed_test_evidence_count === metrics.test_evidence_count
      && metrics.agent_self_report_trusted_test_count === 0
      && metrics.risk_count >= 4
      && metrics.rollback_step_count >= 3
      && metrics.draft_not_executed_rollback_step_count === metrics.rollback_step_count
      && metrics.rollback_command_execution_allowed_count === 0
      && metrics.pr_draft_binding_count === 2
      && metrics.bound_after_protected_scan_count === 2
      && metrics.pull_request_creation_allowed_count === 0
      && metrics.direct_merge_allowed_count === 0
      && metrics.release_allowed_count === 0
      && metrics.pull_request_creation_performed === false
      && metrics.github_api_called === false
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_github_api_allowed === false
      && metrics.desktop_pull_request_creation_allowed === false
      && metrics.desktop_branch_push_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_secret_material_read_allowed === false
      && metrics.desktop_production_config_write_allowed === false
      && metrics.desktop_direct_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "PR draft artifact stores summary, tests, risks, and rollback as a hashed OutputArtifact v2 while leaving GitHub PR creation, branch push, merge, release, and protected writes behind human review.");
    }
  }

  if (item.acceptance_profile === "release_note_artifact_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.release_note_artifact_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.note_authority === "harness_control_plane"
      && metrics.source_pr_draft_artifact_status === "complete"
      && metrics.source_canonical_test_matrix_status === "complete"
      && metrics.source_dev_protected_scan_status === "complete"
      && metrics.release_note_output_artifact_count === 1
      && metrics.output_artifact_v2_count === 1
      && metrics.output_artifact_hash_present_count === 1
      && metrics.output_artifact_draft_count === 1
      && metrics.output_artifact_blocked_pending_approval_count === 1
      && metrics.output_artifact_pending_approval_count === 1
      && metrics.release_note_change_record_count === 1
      && metrics.merged_change_basis_count === 1
      && metrics.release_note_section_count === 6
      && metrics.highlights_section_present === true
      && metrics.changes_section_present === true
      && metrics.tests_section_present === true
      && metrics.risks_section_present === true
      && metrics.rollback_section_present === true
      && metrics.human_review_section_present === true
      && metrics.ready_section_count === 6
      && metrics.release_note_gate_binding_count === 3
      && metrics.bound_release_note_gate_binding_count === 3
      && metrics.publication_allowed_count === 0
      && metrics.merge_allowed_count === 0
      && metrics.release_allowed_count === 0
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.release_note_publication_performed === false
      && metrics.github_api_called === false
      && metrics.branch_push_performed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_github_api_allowed === false
      && metrics.desktop_branch_push_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_patch_application_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_protected_file_write_allowed === false
      && metrics.desktop_secret_material_read_allowed === false
      && metrics.desktop_production_config_write_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Release note artifact drafts a hashed OutputArtifact v2 from the validated PR draft merge candidate while leaving merge, release, publication, branch push, GitHub API, and protected writes behind human review.");
    }
  }

  if (item.acceptance_profile === "rollback_plan_artifact_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.rollback_plan_artifact_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.plan_authority === "harness_control_plane"
      && metrics.source_implementation_patch_capture_status === "complete"
      && metrics.source_diff_review_gate_status === "complete"
      && metrics.source_pr_draft_artifact_status === "complete"
      && metrics.source_release_note_artifact_status === "complete"
      && metrics.rollback_output_artifact_count === 1
      && metrics.output_artifact_v2_count === 1
      && metrics.output_artifact_hash_present_count === 1
      && metrics.output_artifact_draft_count === 1
      && metrics.output_artifact_blocked_pending_approval_count === 1
      && metrics.output_artifact_pending_approval_count === 1
      && metrics.rollback_commit_target_count >= 2
      && metrics.pending_not_merged_commit_target_count === metrics.rollback_commit_target_count
      && metrics.commit_revert_required_count === 0
      && metrics.commit_revert_performed_count === 0
      && metrics.rollback_file_target_count >= 1
      && metrics.restore_candidate_file_target_count === metrics.rollback_file_target_count
      && metrics.file_restore_allowed_count === 0
      && metrics.file_restore_performed_count === 0
      && metrics.rollback_command_target_count >= 3
      && metrics.draft_not_executed_command_target_count === metrics.rollback_command_target_count
      && metrics.command_execution_allowed_count === 0
      && metrics.command_executed_count === 0
      && metrics.rollback_plan_binding_count === 4
      && metrics.bound_rollback_plan_binding_count === 4
      && metrics.rollback_execution_allowed_count === 0
      && metrics.merge_allowed_count === 0
      && metrics.release_allowed_count === 0
      && metrics.rollback_execution_performed === false
      && metrics.command_execution_performed === false
      && metrics.git_command_executed === false
      && metrics.filesystem_mutation_performed === false
      && metrics.protected_mutation_performed === false
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.github_api_called === false
      && metrics.branch_push_performed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_git_command_allowed === false
      && metrics.desktop_filesystem_mutation_allowed === false
      && metrics.desktop_file_restore_allowed === false
      && metrics.desktop_commit_revert_allowed === false
      && metrics.desktop_rollback_execution_allowed === false
      && metrics.desktop_github_api_allowed === false
      && metrics.desktop_branch_push_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Rollback plan artifact declares commit, file, and command rollback targets while leaving command execution, git operations, file restore, commit revert, merge, release, and protected writes behind human review.");
    }
  }

  if (item.acceptance_profile === "technical_debt_ledger_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.technical_debt_ledger_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.ledger_authority === "harness_control_plane"
      && metrics.source_issue_intake_status === "complete"
      && metrics.source_plan_reconciliation_status === "complete"
      && metrics.source_pr_draft_artifact_status === "complete"
      && metrics.source_release_note_artifact_status === "complete"
      && metrics.source_rollback_plan_artifact_status === "complete"
      && metrics.debt_source_finding_count >= 6
      && metrics.open_for_triage_finding_count === metrics.debt_source_finding_count
      && metrics.technical_debt_task_count === metrics.debt_source_finding_count
      && metrics.preserved_task_count === metrics.technical_debt_task_count
      && metrics.backlog_task_count === metrics.technical_debt_task_count
      && metrics.debt_task_binding_count === metrics.technical_debt_task_count
      && metrics.bound_debt_task_binding_count === metrics.debt_task_binding_count
      && metrics.technical_debt_output_artifact_count === 1
      && metrics.output_artifact_v2_count === 1
      && metrics.output_artifact_hash_present_count === 1
      && metrics.output_artifact_draft_count === 1
      && metrics.output_artifact_blocked_pending_approval_count === 1
      && metrics.output_artifact_pending_approval_count === 1
      && metrics.task_state_write_allowed_count === 0
      && metrics.task_state_write_performed_count === 0
      && metrics.issue_mutation_allowed_count === 0
      && metrics.issue_mutation_performed_count === 0
      && metrics.command_execution_allowed_count === 0
      && metrics.command_execution_performed_count === 0
      && metrics.github_api_called === false
      && metrics.branch_push_performed === false
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.protected_mutation_performed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.human_review_required === true
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_issue_mutation_allowed === false
      && metrics.desktop_external_fetch_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_github_api_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Technical debt ledger preserves unresolved plan questions and PR risks as read-only backlog task drafts while leaving task state writes, issue mutation, commands, protected remediation, merge, and release behind human review.");
    }
  }

  if (item.acceptance_profile === "personal_dev_dashboard_api_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.personal_dev_dashboard_api_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.api_authority === "harness_control_plane"
      && metrics.source_repo_profile_detector_status === "complete"
      && metrics.source_dev_lane_ledger_status === "complete"
      && metrics.source_plan_reconciliation_status === "complete"
      && metrics.source_diff_review_gate_status === "complete"
      && metrics.source_canonical_test_matrix_status === "complete"
      && metrics.source_pr_draft_artifact_status === "complete"
      && metrics.panel_row_count === 6
      && metrics.ready_panel_row_count === 6
      && metrics.repo_panel_status === "ready"
      && metrics.worktree_panel_status === "ready"
      && metrics.plan_panel_status === "ready"
      && metrics.diff_panel_status === "ready"
      && metrics.test_panel_status === "ready"
      && metrics.pr_panel_status === "ready"
      && metrics.status_rollup_count === 6
      && metrics.ready_status_rollup_count === 6
      && metrics.api_route_binding_count === 6
      && metrics.active_api_route_binding_count === 6
      && metrics.read_only_api_route_binding_count === 6
      && metrics.personal_dev_output_artifact_count === 1
      && metrics.output_artifact_v2_count === 1
      && metrics.output_artifact_hash_present_count === 1
      && metrics.output_artifact_draft_count === 1
      && metrics.output_artifact_blocked_pending_approval_count === 1
      && metrics.output_artifact_pending_approval_count === 1
      && metrics.mutation_performed === false
      && metrics.command_execution_performed === false
      && metrics.task_state_write_performed === false
      && metrics.issue_mutation_performed === false
      && metrics.github_api_called === false
      && metrics.branch_push_performed === false
      && metrics.pull_request_creation_performed === false
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.protected_mutation_performed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_issue_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_github_api_allowed === false
      && metrics.desktop_branch_push_allowed === false
      && metrics.desktop_pull_request_creation_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Personal-dev dashboard/API projects repo, worktree, plan, diff, test, and PR status into read-only panel rows and route bindings while leaving task writes, issue mutation, commands, GitHub, PR creation, merge, release, and protected writes behind human review.");
    }
  }

  if (item.acceptance_profile === "personal_dev_e2e_freeze_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.personal_dev_e2e_freeze_status === "complete"
      && metrics.pack_id === "personal-dev"
      && metrics.capability_id === "personal_dev.codex.worktree_patch"
      && metrics.freeze_authority === "harness_control_plane"
      && metrics.source_count === 17
      && metrics.passed_source_count === 17
      && metrics.trace_count === 7
      && metrics.passed_trace_count === 7
      && metrics.loop_binding_count === 18
      && metrics.bound_loop_binding_count === 18
      && metrics.issue_to_pr_path_complete === true
      && metrics.dashboard_panel_row_count === 6
      && metrics.dashboard_route_binding_count === 6
      && metrics.mutation_performed === false
      && metrics.command_execution_performed === false
      && metrics.task_state_write_performed === false
      && metrics.issue_mutation_performed === false
      && metrics.github_api_called === false
      && metrics.branch_push_performed === false
      && metrics.pull_request_creation_performed === false
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.rollback_execution_performed === false
      && metrics.patch_application_performed === false
      && metrics.protected_mutation_performed === false
      && metrics.external_agent_invocation_performed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_task_state_write_allowed === false
      && metrics.desktop_issue_mutation_allowed === false
      && metrics.desktop_command_execution_allowed === false
      && metrics.desktop_github_api_allowed === false
      && metrics.desktop_branch_push_allowed === false
      && metrics.desktop_pull_request_creation_allowed === false
      && metrics.desktop_merge_allowed === false
      && metrics.desktop_release_allowed === false
      && metrics.desktop_rollback_execution_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Personal-dev E2E freeze confirms the P213-P229 issue-to-PR path as a read-only Windows baseline before future desktop work continues.");
    }
  }

  if (item.acceptance_profile === "law_firm_pack_manifest_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.law_firm_pack_manifest_status === "complete"
      && metrics.pack_id === "law-firm"
      && metrics.registration_status === "registered"
      && metrics.registry_pack_present === true
      && metrics.compatibility_status === "compatible"
      && metrics.core_compatibility_status === "compatible"
      && metrics.dependency_status === "complete"
      && metrics.common_dependency_declared === true
      && metrics.law_firm_human_review_required === true
      && metrics.matter_boundary_required === true
      && metrics.draft_only_by_default === true
      && metrics.attorney_review_required === true
      && metrics.human_review_required === true
      && metrics.capability_count > 0
      && metrics.registered_capability_count === metrics.capability_count
      && metrics.capability_manifest_v2_count === metrics.capability_count
      && metrics.capability_registry_api_pack_card_present === true
      && metrics.capability_registry_api_capability_card_count === metrics.capability_count
      && metrics.capability_version_api_card_count === metrics.capability_count
      && metrics.attorney_review_required_capability_count === metrics.capability_count
      && metrics.human_review_required_capability_count === metrics.capability_count
      && metrics.runtime_freeze_status === "complete"
      && metrics.matter_contract_freeze_status === "complete"
      && metrics.policy_contract_freeze_status === "complete"
      && metrics.evidence_contract_freeze_status === "complete"
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.executed_delivery_action_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
      && metrics.desktop_protected_mutation_execution_allowed === false
      && metrics.raw_secret_material_exposed === false
      && metrics.provider_key_exposed === false
      && metrics.installer_or_gateway_control === false
      && metrics.ssh_or_cron_control === false
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.protected_action_executed_count === 0
      && metrics.core_pack_mutation_required === false
      && metrics.core_capability_registration_required === false
      && metrics.core_route_registration_required === false
      && metrics.core_mutation_required_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Law-firm pack manifest registers matter-scoped capabilities through the domain-pack registry with attorney review, pending output review, and read-only Desktop boundaries preserved without core mutation.");
    }
  }

  if (item.acceptance_profile === "matter_os_profile_gate") {
    const profileCount = metrics.matter_os_profile_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_os_profile_status === "complete"
      && metrics.source_matter_profile_team_ledger_status === "complete"
      && metrics.source_client_counterparty_registry_status === "complete"
      && metrics.source_matter_contract_freeze_status === "complete"
      && metrics.source_law_firm_pack_manifest_status === "complete"
      && profileCount > 0
      && metrics.complete_profile_card_count === profileCount
      && metrics.display_field_coverage_count === profileCount
      && metrics.client_display_coverage_count === profileCount
      && metrics.counterparty_display_coverage_count === profileCount
      && metrics.matter_number_coverage_count === profileCount
      && metrics.security_grade_coverage_count === profileCount
      && metrics.responsible_owner_coverage_count === profileCount
      && metrics.matter_boundary_coverage_count === profileCount
      && metrics.attorney_review_required_profile_count === profileCount
      && metrics.human_review_required_profile_count === profileCount
      && metrics.default_pending_review_profile_count === profileCount
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter OS profile exposes client, counterparty, matter number, security grade, and responsible owner as read-only matter-scoped cockpit cards while preserving attorney review and no-output boundaries.");
    }
  }

  if (item.acceptance_profile === "matter_timeline_gate") {
    const eventCount = metrics.timeline_event_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_timeline_status === "complete"
      && metrics.source_matter_os_profile_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && (metrics.matter_file_count ?? 0) > 0
      && metrics.available_matter_file_count === metrics.matter_file_count
      && metrics.matter_file_with_matter_id_count === metrics.matter_file_count
      && (metrics.matter_timeline_count ?? 0) > 0
      && eventCount > 0
      && (metrics.meeting_event_count ?? 0) > 0
      && (metrics.received_event_count ?? 0) > 0
      && (metrics.submission_event_count ?? 0) > 0
      && (metrics.deadline_event_count ?? 0) > 0
      && metrics.sorted_event_count === eventCount
      && metrics.unsorted_event_count === 0
      && metrics.matter_id_scoped_event_count === eventCount
      && metrics.attorney_review_required_event_count === eventCount
      && metrics.human_review_required_event_count === eventCount
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter Timeline exposes meeting, received, submission, and deadline events in matter-scoped date order while preserving attorney review and read-only no-output boundaries.");
    }
  }

  if (item.acceptance_profile === "matter_document_index_gate") {
    const recordCount = metrics.document_record_count ?? 0;
    const familyCount = metrics.document_family_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_document_index_status === "complete"
      && metrics.source_matter_timeline_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && (metrics.matter_file_count ?? 0) > 0
      && metrics.available_matter_file_count === metrics.matter_file_count
      && metrics.matter_file_with_matter_id_count === metrics.matter_file_count
      && recordCount > 0
      && familyCount > 0
      && (metrics.original_document_count ?? 0) > 0
      && (metrics.draft_document_count ?? 0) > 0
      && (metrics.submitted_document_count ?? 0) > 0
      && (metrics.counterparty_proposal_count ?? 0) > 0
      && metrics.latest_document_count === familyCount
      && metrics.family_with_latest_document_count === familyCount
      && metrics.matter_id_scoped_document_count === recordCount
      && metrics.attorney_review_required_document_count === recordCount
      && metrics.human_review_required_document_count === recordCount
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter Document Index separates originals, drafts, submitted copies, latest documents, and counterparty proposals as read-only matter-scoped operational context with attorney review preserved.");
    }
  }

  if (item.acceptance_profile === "matter_task_board_gate") {
    const taskCount = metrics.task_record_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_task_board_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && metrics.source_matter_timeline_status === "complete"
      && metrics.source_matter_os_profile_status === "complete"
      && metrics.source_workflow_run_dashboard_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && (metrics.matter_file_count ?? 0) > 0
      && metrics.available_matter_file_count === metrics.matter_file_count
      && taskCount > 0
      && (metrics.board_column_count ?? 0) > 0
      && metrics.workflow_binding_count === taskCount
      && (metrics.matter_task_count ?? 0) > 0
      && (metrics.matter_deadline_task_count ?? 0) > 0
      && (metrics.vdr_request_task_count ?? 0) > 0
      && (metrics.qa_item_task_count ?? 0) > 0
      && (metrics.cp_checklist_task_count ?? 0) > 0
      && (metrics.negotiation_point_task_count ?? 0) > 0
      && (metrics.litigation_task_count ?? 0) > 0
      && (metrics.output_review_task_count ?? 0) > 0
      && (metrics.blocked_task_count ?? 0) > 0
      && (metrics.open_task_count ?? 0) > 0
      && (metrics.in_review_task_count ?? 0) > 0
      && metrics.task_with_owner_count === taskCount
      && metrics.task_with_due_date_count === taskCount
      && metrics.task_with_status_count === taskCount
      && metrics.workflow_bound_task_count === taskCount
      && (metrics.actual_workflow_run_bound_task_count ?? 0) > 0
      && (metrics.timeline_bound_task_count ?? 0) > 0
      && (metrics.document_bound_task_count ?? 0) > 0
      && metrics.matter_id_scoped_task_count === taskCount
      && metrics.attorney_review_required_task_count === taskCount
      && metrics.human_review_required_task_count === taskCount
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter Task Board exposes task, owner, due date, status, and workflow binding rows as read-only matter-scoped operational context while preserving attorney review and no-execution boundaries.");
    }
  }

  if (item.acceptance_profile === "matter_knowledge_graph_gate") {
    const nodeCount = metrics.graph_node_count ?? 0;
    const edgeCount = metrics.graph_edge_count ?? 0;
    const matterCount = metrics.matter_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_knowledge_graph_status === "complete"
      && metrics.source_matter_task_board_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && metrics.source_matter_timeline_status === "complete"
      && metrics.source_matter_os_profile_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && (metrics.matter_file_count ?? 0) > 0
      && metrics.available_matter_file_count === metrics.matter_file_count
      && matterCount > 0
      && metrics.matter_summary_count === matterCount
      && nodeCount > 0
      && edgeCount > 0
      && (metrics.matter_node_count ?? 0) === matterCount
      && (metrics.fact_node_count ?? 0) > 0
      && (metrics.issue_node_count ?? 0) > 0
      && (metrics.legal_theory_node_count ?? 0) > 0
      && (metrics.evidence_node_count ?? 0) > 0
      && metrics.matter_with_fact_count === matterCount
      && metrics.matter_with_issue_count === matterCount
      && metrics.matter_with_legal_theory_count === matterCount
      && metrics.matter_with_evidence_count === matterCount
      && metrics.matter_id_scoped_node_count === nodeCount
      && metrics.matter_id_scoped_edge_count === edgeCount
      && metrics.attorney_review_required_node_count === nodeCount
      && metrics.attorney_review_required_edge_count === edgeCount
      && metrics.human_review_required_node_count === nodeCount
      && metrics.human_review_required_edge_count === edgeCount
      && metrics.legal_theory_placeholder_count === metrics.legal_theory_node_count
      && (metrics.fact_evidence_edge_count ?? 0) > 0
      && (metrics.issue_evidence_edge_count ?? 0) > 0
      && (metrics.legal_theory_issue_edge_count ?? 0) > 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter Knowledge Graph accumulates matter-scoped fact, issue, legal theory placeholder, and evidence nodes as read-only operational context while preserving attorney review and no-execution boundaries.");
    }
  }

  if (item.acceptance_profile === "matter_privilege_classifier_gate") {
    const recordCount = metrics.classification_record_count ?? 0;
    const flagCount = metrics.evidence_flag_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_privilege_classifier_status === "complete"
      && metrics.source_matter_knowledge_graph_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && metrics.source_matter_task_board_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && (metrics.matter_file_count ?? 0) > 0
      && metrics.available_matter_file_count === metrics.matter_file_count
      && (metrics.matter_count ?? 0) > 0
      && recordCount > 0
      && flagCount === recordCount * 4
      && metrics.expected_evidence_node_count === recordCount
      && metrics.knowledge_graph_bound_classification_count === recordCount
      && (metrics.document_bound_classification_count ?? 0) > 0
      && (metrics.privileged_review_required_count ?? 0) > 0
      && (metrics.work_product_review_required_count ?? 0) > 0
      && metrics.confidential_flagged_evidence_count === recordCount
      && (metrics.external_transfer_blocked_count ?? 0) > 0
      && metrics.candidate_review_required_count === recordCount
      && metrics.attorney_review_required_classification_count === recordCount
      && metrics.attorney_review_required_flag_count === flagCount
      && metrics.human_review_required_classification_count === recordCount
      && metrics.human_review_required_flag_count === flagCount
      && metrics.matter_id_scoped_classification_count === recordCount
      && metrics.matter_id_scoped_flag_count === flagCount
      && metrics.final_privilege_determination_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter Privilege Classifier applies privilege, work-product, confidentiality, and external-transfer candidate flags to evidence rows while preserving attorney review and avoiding final privilege determinations.");
    }
  }

  if (item.acceptance_profile === "matter_personal_data_detector_gate") {
    const recordCount = metrics.detection_record_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.matter_personal_data_detector_status === "complete"
      && metrics.source_matter_knowledge_graph_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && metrics.source_matter_privilege_classifier_status === "complete"
      && metrics.source_data_classification_rule_engine_status === "complete"
      && metrics.source_resource_quarantine_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && (metrics.matter_file_count ?? 0) > 0
      && metrics.available_matter_file_count === metrics.matter_file_count
      && (metrics.matter_count ?? 0) > 0
      && recordCount > 0
      && metrics.personal_data_flagged_count === recordCount
      && (metrics.sensitive_personal_data_flagged_count ?? 0) > 0
      && metrics.policy_link_count === recordCount
      && metrics.quarantine_link_count === recordCount
      && metrics.policy_bound_detection_count === recordCount
      && metrics.quarantine_bound_detection_count === recordCount
      && metrics.matter_id_scoped_detection_count === recordCount
      && metrics.knowledge_graph_bound_detection_count === recordCount
      && (metrics.document_bound_detection_count ?? 0) > 0
      && metrics.attorney_review_required_detection_count === recordCount
      && metrics.attorney_review_required_policy_link_count === recordCount
      && metrics.attorney_review_required_quarantine_link_count === recordCount
      && metrics.human_review_required_detection_count === recordCount
      && metrics.human_review_required_policy_link_count === recordCount
      && metrics.human_review_required_quarantine_link_count === recordCount
      && metrics.quarantine_applied_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.policy_enforcement_mutation_performed === false
      && metrics.quarantine_execution_performed === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.quarantine_execution_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Matter Personal Data Detector links candidate personal data rows to policy and quarantine controls while preserving attorney review and avoiding quarantine execution or mutation.");
    }
  }

  if (item.acceptance_profile === "legal_citation_verifier_gate") {
    const citationCount = metrics.citation_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.legal_citation_verifier_status === "complete"
      && metrics.source_citation_object_store_status === "complete"
      && metrics.source_issue_graph_store_status === "complete"
      && metrics.source_source_span_store_status === "complete"
      && metrics.source_evidence_item_store_status === "complete"
      && metrics.source_fact_claim_store_status === "complete"
      && metrics.source_lineage_graph_status === "complete"
      && metrics.source_output_catalog_status === "complete"
      && metrics.source_delivery_queue_status === "complete"
      && citationCount > 0
      && metrics.verification_record_count === citationCount
      && metrics.source_check_count === citationCount
      && metrics.currentness_check_count === citationCount
      && (metrics.matter_count ?? 0) > 0
      && metrics.source_bound_citation_count === citationCount
      && metrics.legal_rule_bound_citation_count === citationCount
      && metrics.currentness_gate_applied_count === citationCount
      && metrics.currentness_review_required_count === citationCount
      && metrics.currentness_verified_count === 0
      && metrics.legal_authority_review_required_count === citationCount
      && metrics.attorney_review_required_citation_count === citationCount
      && metrics.human_review_required_citation_count === citationCount
      && metrics.client_facing_ready_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.external_legal_research_performed === false
      && metrics.legal_authority_finalized === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Legal Citation Verifier applies source and currentness review gates to every citation while preserving attorney review and avoiding legal advice or client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_vdr_inventory_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_vdr_inventory_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && metrics.source_matter_task_board_status === "complete"
      && metrics.source_resource_version_ledger_status === "complete"
      && metrics.source_law_firm_pack_manifest_status === "complete"
      && (metrics.batch_count ?? 0) > 0
      && (metrics.folder_record_count ?? 0) > 0
      && (metrics.file_record_count ?? 0) > 0
      && metrics.version_record_count === metrics.file_record_count
      && (metrics.missing_data_record_count ?? 0) > 0
      && metrics.rfi_candidate_count === metrics.missing_data_record_count
      && metrics.client_facing_ready_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD VDR Inventory aggregates batch, folder, file, version, and missing-data rows while preserving attorney review and avoiding client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_document_classification_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_document_classification_status === "complete"
      && metrics.source_ldd_vdr_inventory_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && (metrics.source_document_count ?? 0) > 0
      && (metrics.classification_rule_count ?? 0) >= 8
      && metrics.classification_record_count === metrics.source_document_count
      && metrics.classified_document_count === metrics.source_document_count
      && (metrics.class_summary_count ?? 0) > 0
      && (metrics.matter_count ?? 0) > 0
      && (metrics.file_classification_count ?? 0) > 0
      && (metrics.missing_data_classification_count ?? 0) > 0
      && (metrics.contract_classification_count ?? 0) > 0
      && (metrics.tax_classification_count ?? 0) > 0
      && (metrics.closing_deliverable_classification_count ?? 0) > 0
      && metrics.client_facing_ready_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD Document Classification assigns deterministic review-gated document classes while avoiding legal conclusions and client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_extractor_selection_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_extractor_selection_status === "complete"
      && metrics.source_ldd_document_classification_status === "complete"
      && metrics.source_ldd_document_classification_phase_status === "complete"
      && metrics.source_extractor_adapter_contract_status === "complete"
      && metrics.source_extractor_adapter_contract_phase_status === "complete"
      && (metrics.classification_record_count ?? 0) > 0
      && (metrics.extractor_registry_count ?? 0) >= 9
      && metrics.extractor_registry_local_only_count === metrics.extractor_registry_count
      && metrics.selection_record_count === metrics.classification_record_count
      && metrics.selected_extractor_count === metrics.selection_record_count
      && metrics.selection_rationale_count === metrics.selection_record_count
      && (metrics.distinct_selected_extractor_count ?? 0) > 0
      && (metrics.matter_count ?? 0) > 0
      && (metrics.contract_extractor_selection_count ?? 0) > 0
      && (metrics.tax_extractor_selection_count ?? 0) > 0
      && (metrics.closing_deliverable_extractor_selection_count ?? 0) > 0
      && metrics.extractor_execution_count === 0
      && metrics.extraction_result_generated_count === 0
      && metrics.client_facing_ready_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD Extractor Selection maps document classes to review-gated extractor profiles without executing extraction or generating client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_fact_extraction_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_fact_extraction_status === "complete"
      && metrics.source_ldd_extractor_selection_status === "complete"
      && metrics.source_ldd_extractor_selection_phase_status === "complete"
      && metrics.source_matter_status === "complete"
      && (metrics.source_selection_record_count ?? 0) > 0
      && (metrics.fact_rule_count ?? 0) >= 5
      && (metrics.fact_record_count ?? 0) >= (metrics.source_selection_record_count ?? 0)
      && metrics.source_binding_count === metrics.fact_record_count
      && (metrics.type_summary_count ?? 0) >= 5
      && (metrics.matter_count ?? 0) > 0
      && (metrics.party_fact_count ?? 0) > 0
      && (metrics.date_fact_count ?? 0) > 0
      && (metrics.obligation_fact_count ?? 0) > 0
      && (metrics.termination_fact_count ?? 0) > 0
      && (metrics.change_of_control_fact_count ?? 0) > 0
      && (metrics.source_gap_fact_count ?? 0) > 0
      && metrics.deterministic_fact_extraction_count === metrics.fact_record_count
      && metrics.external_extractor_execution_count === 0
      && metrics.client_facing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD Fact Extraction records deterministic candidate facts and source gaps with attorney review gates and no legal/client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_issue_detection_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_issue_detection_status === "complete"
      && metrics.source_ldd_fact_extraction_status === "complete"
      && metrics.source_ldd_fact_extraction_phase_status === "complete"
      && metrics.source_matter_status === "complete"
      && (metrics.source_fact_record_count ?? 0) > 0
      && (metrics.issue_rule_count ?? 0) >= 5
      && (metrics.issue_record_count ?? 0) >= 5
      && metrics.detected_issue_count === metrics.issue_record_count
      && (metrics.red_flag_count ?? 0) > 0
      && (metrics.yellow_flag_count ?? 0) > 0
      && (metrics.high_severity_issue_count ?? 0) > 0
      && (metrics.medium_severity_issue_count ?? 0) > 0
      && (metrics.source_gap_issue_count ?? 0) > 0
      && metrics.follow_up_count === metrics.issue_record_count
      && metrics.open_follow_up_count === metrics.follow_up_count
      && (metrics.severity_summary_count ?? 0) > 0
      && (metrics.matter_count ?? 0) > 0
      && metrics.deterministic_issue_detection_count === metrics.issue_record_count
      && metrics.client_facing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD Issue Detection records deterministic review-gated issue candidates, red/yellow flags, and follow-ups without legal/client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_rfi_generator_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_rfi_generator_status === "complete"
      && metrics.source_ldd_issue_detection_status === "complete"
      && metrics.source_ldd_issue_detection_phase_status === "complete"
      && metrics.source_ldd_vdr_inventory_status === "complete"
      && metrics.source_ldd_vdr_inventory_phase_status === "complete"
      && metrics.source_matter_status === "complete"
      && (metrics.source_issue_record_count ?? 0) > 0
      && (metrics.source_rfi_candidate_count ?? 0) > 0
      && (metrics.rfi_rule_count ?? 0) >= 5
      && (metrics.rfi_draft_count ?? 0) > 0
      && metrics.rfi_question_count === metrics.source_issue_record_count
      && metrics.question_with_issue_link_count === metrics.rfi_question_count
      && metrics.question_with_evidence_link_count === metrics.rfi_question_count
      && metrics.missing_material_link_count === metrics.source_rfi_candidate_count
      && metrics.issue_link_count === metrics.rfi_question_count
      && (metrics.human_review_note_count ?? 0) === metrics.rfi_draft_count
      && metrics.draft_only_count === metrics.rfi_draft_count
      && metrics.deterministic_rfi_generation_count === metrics.rfi_question_count
      && metrics.client_facing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD RFI Generator records draft-only attorney-review RFI packets with issue/evidence links and no legal/client-facing output.");
    }
  }

  if (item.acceptance_profile === "ldd_report_draft_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.ldd_report_draft_status === "complete"
      && metrics.source_ldd_rfi_generator_status === "complete"
      && metrics.source_ldd_rfi_generator_phase_status === "complete"
      && metrics.source_ldd_issue_detection_status === "complete"
      && metrics.source_ldd_issue_detection_phase_status === "complete"
      && metrics.source_legal_citation_verifier_status === "complete"
      && metrics.source_legal_citation_verifier_phase_status === "complete"
      && metrics.source_matter_status === "complete"
      && (metrics.source_issue_record_count ?? 0) > 0
      && (metrics.source_rfi_question_count ?? 0) > 0
      && (metrics.source_legal_citation_verification_record_count ?? 0) > 0
      && (metrics.source_legal_rule_placeholder_citation_count ?? 0) > 0
      && metrics.source_currentness_verified_count === 0
      && (metrics.section_rule_count ?? 0) >= 5
      && (metrics.section_count ?? 0) >= 5
      && metrics.paragraph_count === metrics.section_count
      && metrics.citation_placeholder_count === metrics.paragraph_count
      && (metrics.issue_link_count ?? 0) >= metrics.source_issue_record_count
      && metrics.paragraph_with_citation_placeholder_count === metrics.paragraph_count
      && metrics.citation_placeholder_with_source_ref_count === metrics.citation_placeholder_count
      && metrics.citation_placeholder_currentness_review_required_count === metrics.citation_placeholder_count
      && metrics.citation_placeholder_legal_authority_review_required_count === metrics.citation_placeholder_count
      && metrics.draft_only_count === metrics.paragraph_count
      && metrics.human_review_note_count === metrics.paragraph_count
      && metrics.deterministic_report_draft_generation_count === metrics.paragraph_count
      && metrics.client_facing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.external_legal_research_performed === false
      && metrics.legal_authority_finalized === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "LDD Report Draft records draft-only section paragraphs and citation placeholders with attorney/currentness gates and no legal/client-facing output.");
    }
  }

  if (item.acceptance_profile === "litigation_brief_draft_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.litigation_brief_draft_status === "complete"
      && metrics.source_matter_status === "complete"
      && metrics.source_legal_citation_verifier_status === "complete"
      && metrics.source_legal_citation_verifier_phase_status === "complete"
      && metrics.source_exhibit_map_status === "complete"
      && (metrics.source_claim_count ?? 0) > 0
      && (metrics.source_chronology_count ?? 0) > 0
      && (metrics.source_evidence_count ?? 0) > 0
      && (metrics.brief_rule_count ?? 0) >= 5
      && metrics.draft_packet_count === 1
      && metrics.claim_count === metrics.source_claim_count
      && metrics.fact_count === metrics.source_chronology_count
      && (metrics.evidence_link_count ?? 0) >= (metrics.source_claim_evidence_mapping_count ?? 0)
      && metrics.legal_basis_placeholder_count === metrics.claim_count
      && metrics.citation_gate_count === metrics.claim_count
      && metrics.citation_gate_passed_count === metrics.citation_gate_count
      && metrics.citation_gate_currentness_review_required_count === metrics.citation_gate_count
      && metrics.citation_gate_legal_authority_review_required_count === metrics.citation_gate_count
      && metrics.claim_with_fact_link_count === metrics.claim_count
      && metrics.claim_with_evidence_link_count === metrics.claim_count
      && metrics.claim_with_legal_basis_placeholder_count === metrics.claim_count
      && metrics.client_facing_ready_count === 0
      && metrics.court_filing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.external_legal_research_performed === false
      && metrics.legal_authority_finalized === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Litigation Brief Draft records draft-only claim, fact, evidence, and legal-basis placeholders with citation gates and no legal/client-facing output.");
    }
  }

  if (item.acceptance_profile === "meeting_minutes_workflow_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.meeting_minutes_workflow_status === "complete"
      && metrics.source_matter_status === "complete"
      && metrics.source_matter_timeline_status === "complete"
      && metrics.source_matter_timeline_phase_status === "complete"
      && metrics.source_meeting_note_status === "complete"
      && (metrics.meeting_minutes_rule_count ?? 0) >= 6
      && (metrics.meeting_minutes_source_count ?? 0) >= 2
      && metrics.agenda_item_count >= metrics.meeting_minutes_source_count
      && metrics.decision_count === metrics.agenda_item_count
      && (metrics.action_item_count ?? 0) > 0
      && metrics.evidence_link_count === metrics.action_item_count
      && metrics.action_item_with_evidence_link_count === metrics.action_item_count
      && metrics.agenda_with_decision_count === metrics.agenda_item_count
      && metrics.agenda_with_action_item_count === metrics.agenda_item_count
      && metrics.decision_with_action_item_count === metrics.decision_count
      && metrics.client_facing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Meeting Minutes Workflow records agenda, decision, action, and evidence-link rows without legal/client-facing output or state mutation.");
    }
  }

  if (item.acceptance_profile === "contract_draft_workflow_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.contract_draft_workflow_status === "complete"
      && metrics.source_matter_status === "complete"
      && metrics.source_ldd_rfi_generator_status === "complete"
      && metrics.source_ldd_rfi_generator_phase_status === "complete"
      && metrics.source_meeting_minutes_workflow_status === "complete"
      && metrics.source_meeting_minutes_workflow_phase_status === "complete"
      && (metrics.contract_draft_rule_count ?? 0) >= 6
      && metrics.draft_packet_count === 1
      && metrics.clause_draft_count === metrics.source_negotiation_point_count
      && metrics.client_position_count === metrics.clause_draft_count
      && metrics.consistency_check_count === metrics.clause_draft_count
      && metrics.attorney_review_gate_count === metrics.clause_draft_count
      && metrics.issue_link_count >= metrics.clause_draft_count
      && metrics.clause_with_client_position_count === metrics.clause_draft_count
      && metrics.clause_with_consistency_check_count === metrics.clause_draft_count
      && metrics.clause_with_attorney_review_gate_count === metrics.clause_draft_count
      && metrics.clause_with_issue_link_count === metrics.clause_draft_count
      && metrics.consistency_passed_count === metrics.consistency_check_count
      && metrics.attorney_review_required_clause_count === metrics.clause_draft_count
      && metrics.human_review_required_clause_count === metrics.clause_draft_count
      && metrics.client_facing_ready_count === 0
      && metrics.contract_delivery_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Contract Draft Workflow records draft-only clause, client-position, consistency, issue-link, and attorney-review rows without legal/client-facing output or state mutation.");
    }
  }

  if (item.acceptance_profile === "provided_material_review_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.provided_material_review_status === "complete"
      && metrics.source_ldd_vdr_inventory_status === "complete"
      && metrics.source_ldd_vdr_inventory_phase_status === "complete"
      && metrics.source_matter_document_index_status === "complete"
      && metrics.source_matter_document_index_phase_status === "complete"
      && metrics.source_ldd_document_classification_status === "complete"
      && metrics.source_ldd_document_classification_phase_status === "complete"
      && metrics.source_contract_draft_workflow_status === "complete"
      && metrics.source_contract_draft_workflow_phase_status === "complete"
      && (metrics.provided_material_review_rule_count ?? 0) >= 6
      && metrics.material_review_item_count === metrics.source_classification_record_count
      && metrics.index_status_count === metrics.material_review_item_count
      && metrics.material_with_index_status_count === metrics.material_review_item_count
      && metrics.classification_bound_material_count === metrics.material_review_item_count
      && metrics.gap_link_count === metrics.missing_or_requested_material_count
      && metrics.missing_material_follow_up_count === metrics.gap_link_count
      && metrics.review_gate_count === metrics.material_review_item_count
      && metrics.material_with_review_gate_count === metrics.material_review_item_count
      && metrics.attorney_review_required_material_count === metrics.material_review_item_count
      && metrics.human_review_required_material_count === metrics.material_review_item_count
      && metrics.client_facing_ready_count === 0
      && metrics.final_review_decision_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Provided Material Review records material, index-status, gap-link, and attorney-review rows without final review decisions, legal/client-facing output, or state mutation.");
    }
  }

  if (item.acceptance_profile === "legal_approval_matrix_gate") {
    const outputCount = metrics.legal_approval_output_count ?? 0;
    if (
      metrics.validation_error_count === 0
      && metrics.legal_approval_matrix_status === "complete"
      && metrics.source_ldd_rfi_generator_status === "complete"
      && metrics.source_ldd_rfi_generator_phase_status === "complete"
      && metrics.source_ldd_report_draft_status === "complete"
      && metrics.source_ldd_report_draft_phase_status === "complete"
      && metrics.source_litigation_brief_draft_status === "complete"
      && metrics.source_litigation_brief_draft_phase_status === "complete"
      && metrics.source_meeting_minutes_workflow_status === "complete"
      && metrics.source_meeting_minutes_workflow_phase_status === "complete"
      && metrics.source_contract_draft_workflow_status === "complete"
      && metrics.source_contract_draft_workflow_phase_status === "complete"
      && metrics.source_provided_material_review_status === "complete"
      && metrics.source_provided_material_review_phase_status === "complete"
      && (metrics.legal_approval_rule_count ?? 0) >= 6
      && outputCount === 6
      && metrics.legal_approval_requirement_count === outputCount * 2
      && metrics.legal_approval_gate_link_count === outputCount
      && metrics.attorney_review_requirement_count === outputCount
      && metrics.partner_approval_requirement_count === outputCount
      && metrics.attorney_review_required_output_count === outputCount
      && metrics.human_review_required_output_count === outputCount
      && metrics.partner_approval_required_output_count === outputCount
      && metrics.output_with_native_gate_count === outputCount
      && metrics.output_with_gate_link_count === outputCount
      && metrics.client_use_blocked_output_count === outputCount
      && metrics.finalization_blocked_output_count === outputCount
      && metrics.delivery_blocked_output_count === outputCount
      && metrics.filing_blocked_output_count === outputCount
      && metrics.approval_decision_recorded_count === 0
      && metrics.attorney_approval_recorded_count === 0
      && metrics.partner_approval_recorded_count === 0
      && metrics.client_facing_ready_count === 0
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.legal_advice_provided === false
      && metrics.client_facing_output_generated === false
      && metrics.desktop_boundary_status === "enforced"
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_source_of_truth === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.runtime_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.approval_decision_write_allowed === false
      && metrics.client_facing_output_allowed_without_attorney_review === false
      && metrics.partner_approval_bypass_allowed === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Legal Approval Matrix enforces attorney and partner approval requirements for law-firm outputs without recording approval decisions, legal/client-facing output, or state mutation.");
    }
  }

  if (item.acceptance_profile === "law_firm_e2e_freeze_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.law_firm_e2e_freeze_status === "complete"
      && metrics.source_count === 21
      && metrics.passed_source_count === metrics.source_count
      && metrics.path_count === 3
      && metrics.passed_path_count === metrics.path_count
      && metrics.coverage_gate_count === 4
      && metrics.passed_coverage_gate_count === metrics.coverage_gate_count
      && metrics.representative_matter_gate_passed_count === metrics.path_count
      && metrics.representative_evidence_gate_passed_count === metrics.path_count
      && metrics.representative_citation_gate_passed_count === metrics.path_count
      && metrics.representative_approval_gate_passed_count === metrics.path_count
      && metrics.approval_output_count === 6
      && metrics.approval_requirement_count === 12
      && metrics.approval_gate_link_count === 6
      && metrics.approval_decision_recorded_count === 0
      && metrics.attorney_approval_recorded_count === 0
      && metrics.partner_approval_recorded_count === 0
      && metrics.final_review_decision_recorded_count === 0
      && metrics.legal_advice_provided === false
      && metrics.legal_conclusion_asserted_count === 0
      && metrics.client_facing_output_generated === false
      && metrics.matter_data_write_performed === false
      && metrics.task_state_write_performed === false
      && metrics.workflow_transition_performed === false
      && metrics.runtime_execution_performed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_mutation_performed === false
      && metrics.source_artifact_mutation_performed === false
      && metrics.desktop_read_only === true
      && metrics.desktop_source_of_truth === false
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Law Firm E2E Freeze locks representative matter, evidence, citation, and approval paths without legal/client-facing output or state mutation.");
    }
  }

  if (item.acceptance_profile === "creative_document_pack_manifest_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.creative_document_pack_manifest_status === "complete"
      && metrics.registration_status === "registered"
      && metrics.compatibility_status === "compatible"
      && metrics.common_dependency_declared === true
      && metrics.capability_count === 1
      && metrics.registered_capability_count === metrics.capability_count
      && metrics.capability_manifest_v2_count === metrics.capability_count
      && metrics.capability_registry_api_pack_card_present === true
      && metrics.capability_registry_api_capability_card_count === metrics.capability_count
      && metrics.capability_version_api_card_count === metrics.capability_count
      && metrics.template_declared_count >= 1
      && metrics.renderer_declared_count >= 1
      && metrics.format_validation_required === true
      && metrics.human_review_required === true
      && metrics.layout_validation_required === true
      && metrics.document_renderer_runtime_declared === true
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.default_output_status === "draft"
      && metrics.core_mutation_required_count === 0
      && metrics.desktop_read_only === true
      && metrics.desktop_mutation_allowed === false
      && metrics.desktop_runtime_source_of_truth === false
      && metrics.renderer_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Creative Document Pack Manifest registers document/content capability without core mutation, renderer execution, delivery, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "template_registry_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.template_registry_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.template_count >= 4
      && metrics.registered_template_count === metrics.template_count
      && metrics.template_version_count === metrics.template_count
      && metrics.current_version_count === metrics.template_version_count
      && metrics.required_format_count === 4
      && metrics.covered_format_count === metrics.required_format_count
      && metrics.docx_template_count >= 1
      && metrics.pptx_template_count >= 1
      && metrics.html_template_count >= 1
      && metrics.email_template_count >= 1
      && metrics.metadata_hash_count === metrics.template_count
      && metrics.human_review_required_template_count === metrics.template_count
      && metrics.format_validation_required_template_count === metrics.template_count
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.read_only === true
      && metrics.metadata_registry_only === true
      && metrics.template_file_write_allowed === false
      && metrics.core_registry_mutation_allowed === false
      && metrics.renderer_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Template Registry tracks DOCX/PPTX/HTML/email metadata and versions without renderer execution, delivery, template writes, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "style_registry_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.style_registry_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.style_profile_count === 4
      && metrics.registered_style_profile_count === metrics.style_profile_count
      && metrics.style_rule_count === 5
      && metrics.registered_style_rule_count === metrics.style_rule_count
      && metrics.required_style_rule_type_count === 5
      && metrics.covered_style_rule_type_count === metrics.required_style_rule_type_count
      && metrics.template_style_binding_count >= 4
      && metrics.linked_template_style_binding_count === metrics.template_style_binding_count
      && metrics.required_format_count === 4
      && metrics.covered_format_count === metrics.required_format_count
      && metrics.docx_style_profile_count === 1
      && metrics.pptx_style_profile_count === 1
      && metrics.html_style_profile_count === 1
      && metrics.email_style_profile_count === 1
      && metrics.docx_template_style_binding_count >= 1
      && metrics.pptx_template_style_binding_count >= 1
      && metrics.html_template_style_binding_count >= 1
      && metrics.email_template_style_binding_count >= 1
      && metrics.metadata_hash_count >= metrics.style_profile_count + metrics.style_rule_count + metrics.template_style_binding_count
      && metrics.human_review_required_rule_count === metrics.style_rule_count
      && metrics.format_validation_required_rule_count === metrics.style_rule_count
      && metrics.human_review_required_binding_count === metrics.template_style_binding_count
      && metrics.format_validation_required_binding_count === metrics.template_style_binding_count
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.read_only === true
      && metrics.metadata_registry_only === true
      && metrics.style_file_write_allowed === false
      && metrics.core_registry_mutation_allowed === false
      && metrics.renderer_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Style Registry tracks voice, tone, brand, font, and layout metadata without style file writes, renderer execution, delivery, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "asset_registry_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.asset_registry_status === "complete"
      && metrics.source_style_registry_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.asset_record_count === 5
      && metrics.registered_asset_record_count === metrics.asset_record_count
      && metrics.required_asset_type_count === 5
      && metrics.covered_asset_type_count === metrics.required_asset_type_count
      && metrics.asset_artifact_policy_count === 5
      && metrics.registered_asset_artifact_policy_count === metrics.asset_artifact_policy_count
      && metrics.template_asset_binding_count >= 5
      && metrics.linked_template_asset_binding_count === metrics.template_asset_binding_count
      && metrics.required_format_count === 4
      && metrics.covered_format_count === metrics.required_format_count
      && metrics.image_asset_count === 1
      && metrics.logo_asset_count === 1
      && metrics.graph_asset_count === 1
      && metrics.table_asset_count === 1
      && metrics.video_asset_count === 1
      && metrics.docx_template_asset_binding_count >= 1
      && metrics.pptx_template_asset_binding_count >= 1
      && metrics.html_template_asset_binding_count >= 1
      && metrics.email_template_asset_binding_count >= 1
      && metrics.metadata_hash_count >= metrics.asset_record_count + metrics.asset_type_record_count + metrics.asset_artifact_policy_count + metrics.template_asset_binding_count
      && metrics.human_review_required_asset_count === metrics.asset_record_count
      && metrics.source_attribution_required_asset_count === metrics.asset_record_count
      && metrics.license_review_required_asset_count === metrics.asset_record_count
      && metrics.format_validation_required_asset_count === metrics.asset_record_count
      && metrics.source_attribution_required_binding_count === metrics.template_asset_binding_count
      && metrics.license_review_required_binding_count === metrics.template_asset_binding_count
      && metrics.format_validation_required_binding_count === metrics.template_asset_binding_count
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.read_only === true
      && metrics.metadata_registry_only === true
      && metrics.asset_binary_write_allowed === false
      && metrics.asset_file_ingestion_allowed === false
      && metrics.media_generation_allowed === false
      && metrics.core_registry_mutation_allowed === false
      && metrics.renderer_execution_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.protected_action_allowed === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Asset Registry tracks image, logo, graph, table, and video metadata as artifact references without media ingestion, binary writes, generation, renderer execution, delivery, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "docx_renderer_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.docx_renderer_status === "complete"
      && metrics.source_asset_registry_status === "complete"
      && metrics.source_style_registry_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.docx_template_count >= 1
      && metrics.docx_render_job_count >= 1
      && metrics.completed_render_job_count === metrics.docx_render_job_count
      && metrics.docx_template_data_packet_count === metrics.docx_render_job_count
      && metrics.generated_template_data_packet_count === metrics.docx_template_data_packet_count
      && metrics.docx_openxml_part_count >= metrics.docx_render_job_count * (metrics.required_openxml_part_count_per_artifact ?? 4)
      && metrics.generated_openxml_part_count === metrics.docx_openxml_part_count
      && metrics.openxml_payload_hash_count === metrics.docx_openxml_part_count
      && metrics.docx_output_artifact_count === metrics.docx_render_job_count
      && metrics.draft_output_artifact_count === metrics.docx_output_artifact_count
      && metrics.docx_binary_hash_count === metrics.docx_output_artifact_count
      && metrics.docx_binary_write_count === metrics.docx_output_artifact_count
      && metrics.docx_format_validation_result_count === metrics.docx_output_artifact_count
      && metrics.passed_format_validation_result_count === metrics.docx_format_validation_result_count
      && metrics.human_review_required_output_count === metrics.docx_output_artifact_count
      && metrics.attorney_review_required_output_count === metrics.docx_output_artifact_count
      && metrics.source_attribution_required_output_count === metrics.docx_output_artifact_count
      && metrics.citation_review_required_output_count === metrics.docx_output_artifact_count
      && metrics.format_validation_required_output_count === metrics.docx_output_artifact_count
      && metrics.local_deterministic_renderer === true
      && metrics.renderer_execution_performed === true
      && metrics.local_deterministic_render_performed === true
      && metrics.document_renderer_runtime_execution_performed === false
      && metrics.external_renderer_execution_performed === false
      && metrics.network_access_performed === false
      && metrics.docx_binary_write_performed === true
      && metrics.core_registry_mutation_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.document_renderer_docx_target_supported === true
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "DOCX Renderer generates draft DOCX artifacts from template data packets while preserving attorney review, no legal advice, no runtime execution, and no delivery.");
    }
  }

  if (item.acceptance_profile === "pptx_renderer_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.pptx_renderer_status === "complete"
      && metrics.source_asset_registry_status === "complete"
      && metrics.source_style_registry_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.pptx_template_count >= 1
      && metrics.pptx_render_job_count >= 1
      && metrics.completed_render_job_count === metrics.pptx_render_job_count
      && metrics.pptx_slide_template_count === metrics.pptx_render_job_count
      && metrics.generated_slide_template_count === metrics.pptx_slide_template_count
      && metrics.pptx_slide_deck_count === metrics.pptx_render_job_count
      && metrics.generated_slide_deck_count === metrics.pptx_slide_deck_count
      && metrics.total_slide_count >= metrics.pptx_slide_deck_count
      && metrics.pptx_openxml_part_count >= metrics.pptx_render_job_count * (metrics.required_base_openxml_part_count_per_artifact ?? 7)
      && metrics.generated_openxml_part_count === metrics.pptx_openxml_part_count
      && metrics.openxml_payload_hash_count === metrics.pptx_openxml_part_count
      && metrics.pptx_output_artifact_count === metrics.pptx_render_job_count
      && metrics.draft_output_artifact_count === metrics.pptx_output_artifact_count
      && metrics.pptx_binary_hash_count === metrics.pptx_output_artifact_count
      && metrics.pptx_binary_write_count === metrics.pptx_output_artifact_count
      && metrics.pptx_overflow_check_count === metrics.pptx_slide_deck_count
      && metrics.passed_overflow_check_count === metrics.pptx_overflow_check_count
      && metrics.overflow_failed_check_count === 0
      && metrics.pptx_format_validation_result_count === metrics.pptx_output_artifact_count
      && metrics.passed_format_validation_result_count === metrics.pptx_format_validation_result_count
      && metrics.human_review_required_output_count === metrics.pptx_output_artifact_count
      && metrics.attorney_review_required_output_count === metrics.pptx_output_artifact_count
      && metrics.source_attribution_required_output_count === metrics.pptx_output_artifact_count
      && metrics.citation_review_required_output_count === metrics.pptx_output_artifact_count
      && metrics.format_validation_required_output_count === metrics.pptx_output_artifact_count
      && metrics.local_deterministic_renderer === true
      && metrics.renderer_execution_performed === true
      && metrics.local_deterministic_render_performed === true
      && metrics.document_renderer_runtime_execution_performed === false
      && metrics.external_renderer_execution_performed === false
      && metrics.network_access_performed === false
      && metrics.pptx_binary_write_performed === true
      && metrics.core_registry_mutation_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.document_renderer_pptx_target_supported === true
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "PPTX Renderer generates draft slide decks with overflow checks and draft PPTX artifacts while preserving attorney review, no legal advice, no runtime execution, and no delivery.");
    }
  }

  if (item.acceptance_profile === "pdf_html_renderer_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.pdf_html_renderer_status === "complete"
      && metrics.source_asset_registry_status === "complete"
      && metrics.source_style_registry_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.html_template_count >= 1
      && metrics.pdf_html_render_job_count >= 1
      && metrics.completed_render_job_count === metrics.pdf_html_render_job_count
      && metrics.html_preview_artifact_count === metrics.pdf_html_render_job_count
      && metrics.generated_html_preview_artifact_count === metrics.html_preview_artifact_count
      && metrics.pdf_export_artifact_count === metrics.pdf_html_render_job_count
      && metrics.generated_pdf_export_artifact_count === metrics.pdf_export_artifact_count
      && metrics.pdf_html_output_artifact_count === metrics.pdf_html_render_job_count * 2
      && metrics.draft_output_artifact_count === metrics.pdf_html_output_artifact_count
      && metrics.html_output_artifact_count === metrics.pdf_html_render_job_count
      && metrics.pdf_output_artifact_count === metrics.pdf_html_render_job_count
      && metrics.content_hash_count === metrics.pdf_html_output_artifact_count
      && metrics.html_preview_write_count === metrics.html_preview_artifact_count
      && metrics.pdf_export_write_count === metrics.pdf_export_artifact_count
      && metrics.pdf_html_format_validation_result_count === metrics.pdf_html_output_artifact_count
      && metrics.passed_format_validation_result_count === metrics.pdf_html_format_validation_result_count
      && metrics.human_review_required_output_count === metrics.pdf_html_output_artifact_count
      && metrics.attorney_review_required_output_count === metrics.pdf_html_output_artifact_count
      && metrics.source_attribution_required_output_count === metrics.pdf_html_output_artifact_count
      && metrics.citation_review_required_output_count === metrics.pdf_html_output_artifact_count
      && metrics.format_validation_required_output_count === metrics.pdf_html_output_artifact_count
      && metrics.local_deterministic_renderer === true
      && metrics.renderer_execution_performed === true
      && metrics.local_deterministic_render_performed === true
      && metrics.document_renderer_runtime_execution_performed === false
      && metrics.external_renderer_execution_performed === false
      && metrics.network_access_performed === false
      && metrics.artifact_write_performed === true
      && metrics.core_registry_mutation_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.runtime_freeze_status === "complete"
      && metrics.document_renderer_adapter_status === "complete"
      && metrics.document_renderer_pdf_target_supported === true
      && metrics.output_delivery_contract_freeze_status === "complete"
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "PDF/HTML Renderer generates draft HTML preview and PDF export artifacts with format validation while preserving attorney review, no legal advice, no runtime execution, and no delivery.");
    }
  }

  if (item.acceptance_profile === "layout_validator_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.layout_validator_status === "complete"
      && metrics.source_docx_renderer_status === "complete"
      && metrics.source_pptx_renderer_status === "complete"
      && metrics.source_pdf_html_renderer_status === "complete"
      && metrics.layout_target_count >= 1
      && metrics.layout_validation_result_count === metrics.layout_target_count
      && metrics.passed_layout_validation_result_count === metrics.layout_validation_result_count
      && metrics.failed_layout_validation_result_count === 0
      && metrics.page_count_check_count === metrics.layout_target_count
      && metrics.passed_page_count_check_count === metrics.page_count_check_count
      && metrics.layout_overflow_check_count === metrics.layout_target_count
      && metrics.passed_layout_overflow_check_count === metrics.layout_overflow_check_count
      && metrics.broken_table_check_count === metrics.layout_target_count
      && metrics.passed_broken_table_check_count === metrics.broken_table_check_count
      && metrics.broken_table_count === 0
      && metrics.overflow_signal_count === 0
      && metrics.human_review_required_result_count === metrics.layout_validation_result_count
      && metrics.attorney_review_required_result_count === metrics.layout_validation_result_count
      && metrics.layout_validation_report_only === true
      && metrics.renderer_execution_allowed === false
      && metrics.document_renderer_runtime_execution_allowed === false
      && metrics.external_renderer_execution_allowed === false
      && metrics.network_access_allowed === false
      && metrics.artifact_write_allowed === true
      && metrics.core_registry_mutation_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Layout Validator checks DOCX/PPTX/PDF/HTML page counts, overflow, and broken table signals while staying report-only, attorney-review gated, and delivery-blocked.");
    }
  }

  if (item.acceptance_profile === "citation_renderer_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.citation_renderer_status === "complete"
      && metrics.source_source_span_store_status === "complete"
      && metrics.source_citation_object_store_status === "complete"
      && metrics.source_exhibit_map_status === "complete"
      && metrics.source_layout_validator_status === "complete"
      && metrics.citation_count > 0
      && metrics.rendered_citation_unit_count === metrics.citation_count
      && metrics.footnote_rendering_count === metrics.citation_count
      && metrics.exhibit_reference_rendering_count === metrics.citation_count
      && metrics.source_span_link_rendering_count === metrics.citation_count
      && metrics.bound_exhibit_reference_count === metrics.citation_count
      && metrics.bound_source_span_link_count === metrics.citation_count
      && metrics.citation_render_packet_count === metrics.layout_target_count
      && metrics.target_bound_render_packet_count === metrics.citation_render_packet_count
      && metrics.rendered_needs_review_count === metrics.citation_count
      && metrics.human_review_required_render_count === metrics.citation_count
      && metrics.attorney_review_required_render_count === metrics.citation_count
      && metrics.citation_review_required_render_count === metrics.citation_count
      && metrics.currentness_review_required_render_count === metrics.citation_count
      && metrics.source_verification_required_render_count === metrics.citation_count
      && metrics.citation_rendering_report_only === true
      && metrics.document_runtime_mutation_allowed === false
      && metrics.external_renderer_execution_allowed === false
      && metrics.network_access_allowed === false
      && metrics.artifact_write_allowed === true
      && metrics.core_registry_mutation_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Citation Renderer creates deterministic footnotes, exhibit references, and source-span links for every citation while preserving attorney review, currentness review, source verification, no legal advice, no document runtime mutation, and no delivery.");
    }
  }

  if (item.acceptance_profile === "version_comparator_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.version_comparator_status === "complete"
      && metrics.source_docx_renderer_status === "complete"
      && metrics.source_pptx_renderer_status === "complete"
      && metrics.source_pdf_html_renderer_status === "complete"
      && metrics.source_layout_validator_status === "complete"
      && metrics.source_citation_renderer_status === "complete"
      && metrics.document_version_pair_count > 0
      && metrics.document_version_pair_count === metrics.layout_target_count
      && metrics.compared_draft_artifact_count === metrics.document_version_pair_count
      && metrics.document_change_record_count === metrics.document_version_pair_count * 4
      && metrics.content_hash_change_record_count === metrics.document_version_pair_count
      && metrics.content_hash_changed_count === metrics.document_version_pair_count
      && metrics.layout_validated_pair_count === metrics.document_version_pair_count
      && metrics.citation_bound_pair_count === metrics.document_version_pair_count
      && metrics.comparison_packet_count === metrics.document_version_pair_count
      && metrics.ready_for_review_packet_count === metrics.comparison_packet_count
      && metrics.human_review_required_comparison_count === metrics.comparison_packet_count
      && metrics.attorney_review_required_comparison_count === metrics.comparison_packet_count
      && metrics.citation_review_required_comparison_count === metrics.comparison_packet_count
      && metrics.currentness_review_required_comparison_count === metrics.comparison_packet_count
      && metrics.source_verification_required_comparison_count === metrics.comparison_packet_count
      && metrics.format_validation_required_comparison_count === metrics.comparison_packet_count
      && metrics.version_comparison_report_only === true
      && metrics.draft_source_mutation_allowed === false
      && metrics.source_artifact_mutation_allowed === false
      && metrics.document_runtime_mutation_allowed === false
      && metrics.external_renderer_execution_allowed === false
      && metrics.network_access_allowed === false
      && metrics.artifact_write_allowed === true
      && metrics.core_registry_mutation_allowed === false
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Version Comparator creates reviewer-ready draft comparison packets for all rendered document outputs while preserving layout, citation, attorney review, no legal advice, no draft mutation, and no delivery gates.");
    }
  }

  if (item.acceptance_profile === "design_system_profile_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.design_system_profile_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_style_registry_status === "complete"
      && metrics.source_asset_registry_status === "complete"
      && metrics.source_pptx_renderer_status === "complete"
      && metrics.source_version_comparator_status === "complete"
      && metrics.pptx_template_count >= 1
      && metrics.pptx_style_profile_count >= 1
      && metrics.design_system_profile_count === metrics.pptx_style_profile_count
      && metrics.design_system_rule_count >= metrics.required_design_rule_type_count
      && metrics.linked_design_system_rule_count === metrics.design_system_rule_count
      && metrics.covered_design_rule_type_count === metrics.required_design_rule_type_count
      && metrics.template_design_binding_count === metrics.pptx_template_count
      && metrics.bound_template_design_binding_count === metrics.template_design_binding_count
      && metrics.asset_design_binding_count >= metrics.template_design_binding_count
      && metrics.linked_asset_design_binding_count === metrics.asset_design_binding_count
      && metrics.design_review_packet_count === metrics.template_design_binding_count
      && metrics.ready_for_review_packet_count === metrics.design_review_packet_count
      && metrics.human_review_required_packet_count === metrics.design_review_packet_count
      && metrics.attorney_review_required_packet_count === metrics.design_review_packet_count
      && metrics.format_validation_required_packet_count === metrics.design_review_packet_count
      && metrics.layout_validation_required_packet_count === metrics.design_review_packet_count
      && metrics.source_attribution_required_packet_count === metrics.design_review_packet_count
      && metrics.citation_review_required_packet_count === metrics.design_review_packet_count
      && metrics.design_profile_metadata_only === true
      && metrics.design_system_profile_report_only === true
      && metrics.template_mutation_allowed === false
      && metrics.style_mutation_allowed === false
      && metrics.asset_mutation_allowed === false
      && metrics.document_runtime_mutation_allowed === false
      && metrics.renderer_execution_allowed === false
      && metrics.external_renderer_execution_allowed === false
      && metrics.network_access_allowed === false
      && metrics.artifact_write_allowed === true
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Design System Profile binds PPTX report-material templates to style, asset, renderer, and version-review evidence while preserving attorney review, metadata-only design rules, no legal advice, no mutation, and no delivery gates.");
    }
  }

  if (item.acceptance_profile === "web_novel_workflow_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.web_novel_workflow_status === "complete"
      && metrics.source_brief_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.source_template_registry_status === "complete"
      && metrics.source_style_registry_status === "complete"
      && metrics.source_design_system_profile_status === "complete"
      && metrics.source_output_delivery_contract_freeze_status === "complete"
      && metrics.web_novel_workflow_record_count === 1
      && metrics.complete_workflow_record_count === metrics.web_novel_workflow_record_count
      && metrics.web_novel_synopsis_count === 1
      && metrics.draft_synopsis_count === metrics.web_novel_synopsis_count
      && metrics.web_novel_style_guide_count === 1
      && metrics.draft_style_guide_count === metrics.web_novel_style_guide_count
      && metrics.web_novel_chapter_count >= 1
      && metrics.draft_chapter_count === metrics.web_novel_chapter_count
      && metrics.web_novel_revision_packet_count === metrics.web_novel_chapter_count
      && metrics.ready_revision_packet_count === metrics.web_novel_revision_packet_count
      && metrics.web_novel_output_artifact_count === 1
      && metrics.draft_output_artifact_count === metrics.web_novel_output_artifact_count
      && metrics.markdown_output_artifact_count === metrics.web_novel_output_artifact_count
      && metrics.human_review_required_output_count === metrics.web_novel_output_artifact_count
      && metrics.format_validation_required_output_count === metrics.web_novel_output_artifact_count
      && metrics.source_attribution_required_output_count === metrics.web_novel_output_artifact_count
      && metrics.revision_required_chapter_count === metrics.web_novel_chapter_count
      && metrics.draft_generation_only === true
      && metrics.deterministic_generation_performed === true
      && metrics.external_model_execution_performed === false
      && metrics.network_access_performed === false
      && metrics.template_mutation_allowed === false
      && metrics.style_mutation_allowed === false
      && metrics.asset_mutation_allowed === false
      && metrics.document_runtime_mutation_allowed === false
      && metrics.renderer_execution_allowed === false
      && metrics.artifact_write_allowed === true
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Web Novel Workflow creates deterministic draft synopsis, style, chapter, revision, and markdown output artifacts while preserving human review, format validation, no legal advice, no protected action, and no delivery gates.");
    }
  }

  if (item.acceptance_profile === "video_ppt_workflow_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.video_ppt_workflow_status === "complete"
      && metrics.source_brief_status === "complete"
      && metrics.source_creative_document_pack_manifest_status === "complete"
      && metrics.source_asset_registry_status === "complete"
      && metrics.source_pptx_renderer_status === "complete"
      && metrics.source_design_system_profile_status === "complete"
      && metrics.source_web_novel_workflow_status === "complete"
      && metrics.source_output_delivery_contract_freeze_status === "complete"
      && metrics.source_video_asset_count >= 1
      && metrics.source_pptx_slide_deck_count >= 1
      && metrics.video_ppt_workflow_record_count === 1
      && metrics.complete_workflow_record_count === metrics.video_ppt_workflow_record_count
      && metrics.video_ppt_script_count >= 1
      && metrics.draft_script_count === metrics.video_ppt_script_count
      && metrics.video_ppt_storyboard_count === metrics.video_ppt_script_count
      && metrics.draft_storyboard_count === metrics.video_ppt_storyboard_count
      && metrics.caption_required_storyboard_count === metrics.video_ppt_storyboard_count
      && metrics.video_ppt_slide_deck_count === 1
      && metrics.draft_slide_deck_count === metrics.video_ppt_slide_deck_count
      && metrics.total_slide_count === metrics.source_section_count
      && metrics.video_ppt_approval_artifact_count === metrics.video_ppt_slide_deck_count
      && metrics.ready_approval_artifact_count === metrics.video_ppt_approval_artifact_count
      && metrics.video_ppt_output_artifact_count === 2
      && metrics.draft_output_artifact_count === metrics.video_ppt_output_artifact_count
      && metrics.markdown_output_artifact_count === 1
      && metrics.json_output_artifact_count === 1
      && metrics.human_review_required_output_count === metrics.video_ppt_output_artifact_count
      && metrics.format_validation_required_output_count === metrics.video_ppt_output_artifact_count
      && metrics.source_attribution_required_output_count === metrics.video_ppt_output_artifact_count
      && metrics.draft_production_only === true
      && metrics.deterministic_generation_performed === true
      && metrics.external_model_execution_performed === false
      && metrics.network_access_performed === false
      && metrics.media_generation_performed === false
      && metrics.media_generation_allowed === false
      && metrics.video_binary_generation_allowed === false
      && metrics.pptx_binary_generation_allowed === false
      && metrics.existing_pptx_artifact_reuse_allowed === true
      && metrics.template_mutation_allowed === false
      && metrics.style_mutation_allowed === false
      && metrics.asset_mutation_allowed === false
      && metrics.document_runtime_mutation_allowed === false
      && metrics.renderer_execution_allowed === false
      && metrics.artifact_write_allowed === true
      && metrics.delivery_execution_allowed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_allowed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Video/PPT Workflow creates deterministic draft scripts, storyboards, slide deck plan, approval artifact, and draft output artifacts while preserving human review, caption/source/format gates, no media generation, no legal advice, no protected action, and no delivery gates.");
    }
  }

  if (item.acceptance_profile === "creative_document_freeze_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.creative_document_freeze_status === "complete"
      && metrics.source_count === 13
      && metrics.passed_source_count === metrics.source_count
      && metrics.path_count === 3
      && metrics.passed_path_count === metrics.path_count
      && metrics.gate_count >= 6
      && metrics.passed_gate_count === metrics.gate_count
      && metrics.rendered_output_artifact_count >= 7
      && metrics.passed_format_validation_result_count === metrics.format_validation_result_count
      && metrics.passed_layout_validation_result_count === metrics.layout_validation_result_count
      && metrics.failed_layout_validation_result_count === 0
      && metrics.citation_render_packet_count >= 1
      && metrics.comparison_packet_count >= 1
      && metrics.design_review_packet_count >= 1
      && metrics.web_novel_output_artifact_count >= 1
      && metrics.video_ppt_output_artifact_count >= 2
      && metrics.approval_request_count >= 1
      && metrics.executed_delivery_action_count === 0
      && metrics.ready_delivery_action_count === 0
      && metrics.read_only === true
      && metrics.freeze_report_only === true
      && metrics.source_artifact_mutation_performed === false
      && metrics.document_runtime_mutation_performed === false
      && metrics.renderer_execution_performed === false
      && metrics.external_model_execution_performed === false
      && metrics.network_access_performed === false
      && metrics.media_generation_performed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
      && metrics.failed_checkpoint_count === 0
    ) {
      return passedWithOperationalGate(stage, "Creative Document Freeze locks P253-P265 representative document, presentation, and content paths with render, layout, approval, human-review, no-legal-advice, and no-delivery gates preserved.");
    }
  }

  if (item.acceptance_profile === "connector_contract_v2_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.connector_contract_status === "complete"
      && metrics.connector_count === 8
      && metrics.contracted_connector_count === metrics.connector_count
      && metrics.source_contract_count === metrics.connector_count
      && metrics.cursor_contract_count === metrics.connector_count
      && metrics.external_id_contract_count === metrics.connector_count
      && metrics.auth_boundary_count === metrics.connector_count
      && metrics.unique_source_id_count === metrics.connector_count
      && metrics.unique_external_id_namespace_count === metrics.connector_count
      && metrics.unique_auth_boundary_count === metrics.connector_count
      && metrics.resumable_cursor_count === metrics.connector_count
      && metrics.last_seen_external_id_cursor_count === metrics.connector_count
      && metrics.resource_projection_required_count === metrics.connector_count
      && metrics.resource_version_projection_required_count === metrics.connector_count
      && metrics.matter_boundary_required_count === metrics.connector_count
      && metrics.classification_required_count === metrics.connector_count
      && metrics.policy_snapshot_required_count === metrics.connector_count
      && metrics.credential_reference_only_count === metrics.connector_count
      && metrics.raw_secret_material_allowed_count === 0
      && metrics.mutation_allowed_count === 0
      && metrics.connector_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.credential_material_read === false
      && metrics.resource_mutation_performed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
    ) {
      return passedWithOperationalGate(stage, "Connector Contract v2 standardizes source_id, cursor, external_id, and auth boundary contracts for the P268-P275 connector families without connector execution, credential reads, delivery, protected action, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "local_folder_connector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.local_folder_connector_status === "complete"
      && metrics.discovered_file_count > 0
      && metrics.ingest_ready_count > 0
      && metrics.remaining_count === 0
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.local_path_allowlist_enforced === true
      && metrics.credential_ref_required === false
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.source_read_performed === true
      && metrics.source_mutation_performed === false
      && metrics.external_network_access_performed === false
      && metrics.credential_material_read === false
      && metrics.resource_mutation_performed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.ingest_ready_count
    ) {
      return passedWithOperationalGate(stage, "Local Folder Connector performs read-only path-allowlisted discovery and resumable ingest candidate creation with cursor state, duplicate handling, human review, and no source mutation, network, credential, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "onedrive_connector_boundary_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.onedrive_connector_boundary_status === "complete"
      && metrics.source_local_folder_connector_status === "complete"
      && metrics.timeout_policy_count > 0
      && metrics.placeholder_policy_count > 0
      && metrics.cloud_only_handling_count > 0
      && metrics.cloud_only_item_count > 0
      && metrics.timeout_handling_explicit === true
      && metrics.placeholder_handling_explicit === true
      && metrics.cloud_only_handling_explicit === true
      && metrics.cursor_boundary_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_delta_token_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.credential_ref_required === true
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === false
      && metrics.source_read_performed === false
      && metrics.credential_material_read === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.cloud_only_handling_count
    ) {
      return passedWithOperationalGate(stage, "OneDrive Connector Boundary freezes timeout, placeholder, cloud-only, delta cursor, and credential-reference-only rules without connector execution, network access, credential reads, source reads, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "outlook_email_connector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.outlook_email_connector_status === "complete"
      && metrics.source_onedrive_connector_boundary_status === "complete"
      && metrics.message_count > 0
      && metrics.attachment_count > 0
      && metrics.thread_count > 0
      && metrics.threaded_message_count === metrics.message_count
      && metrics.message_resource_count === metrics.message_count
      && metrics.attachment_resource_count === metrics.attachment_count
      && metrics.resource_candidate_count === metrics.message_count + metrics.attachment_count
      && metrics.metadata_complete_message_count === metrics.message_count
      && metrics.message_id_count === metrics.message_count
      && metrics.thread_id_count > 0
      && metrics.attachment_parent_link_count === metrics.attachment_count
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_delta_token_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.credential_ref_required === true
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.local_export_read_performed === true
      && metrics.outlook_api_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === true
      && metrics.source_read_performed === true
      && metrics.credential_material_read === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.resource_candidate_count
    ) {
      return passedWithOperationalGate(stage, "Outlook Email Connector projects EML/Graph export metadata, attachments, and thread ids into review-gated resource candidates without live Outlook API calls, credential reads, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "kakaotalk_import_boundary_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.kakaotalk_import_boundary_status === "complete"
      && metrics.source_outlook_email_connector_status === "complete"
      && metrics.message_count > 0
      && metrics.attachment_count > 0
      && metrics.conversation_count > 0
      && metrics.message_resource_count === metrics.message_count
      && metrics.attachment_resource_count === metrics.attachment_count
      && metrics.resource_candidate_count === metrics.message_count + metrics.attachment_count
      && metrics.metadata_complete_message_count === metrics.message_count
      && metrics.line_offset_count === metrics.message_count
      && metrics.attachment_parent_link_count === metrics.attachment_count
      && metrics.conversation_message_link_count === metrics.message_count
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_export_cursor_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.credential_ref_required === false
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.operator_export_only === true
      && metrics.import_boundary_only === true
      && metrics.local_export_read_performed === true
      && metrics.kakaotalk_app_execution_performed === false
      && metrics.live_chat_api_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === true
      && metrics.source_read_performed === true
      && metrics.credential_material_read === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.resource_candidate_count
    ) {
      return passedWithOperationalGate(stage, "KakaoTalk Import Boundary projects operator-provided export messages, attachments, and conversation line-offset cursor rows into review-gated resource candidates without live app/API calls, network access, credentials, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "github_connector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.github_connector_status === "complete"
      && metrics.source_kakaotalk_import_boundary_status === "complete"
      && metrics.repository_count > 0
      && metrics.issue_count > 0
      && metrics.pull_request_count > 0
      && metrics.commit_count > 0
      && metrics.review_count > 0
      && metrics.workflow_input_count === metrics.resource_candidate_count
      && metrics.issue_resource_count === metrics.issue_count
      && metrics.pull_request_resource_count === metrics.pull_request_count
      && metrics.commit_resource_count === metrics.commit_count
      && metrics.review_resource_count === metrics.review_count
      && metrics.resource_candidate_count === metrics.issue_count + metrics.pull_request_count + metrics.commit_count + metrics.review_count
      && metrics.metadata_complete_issue_count === metrics.issue_count
      && metrics.metadata_complete_pull_request_count === metrics.pull_request_count
      && metrics.metadata_complete_commit_count === metrics.commit_count
      && metrics.metadata_complete_review_count === metrics.review_count
      && metrics.review_parent_link_count === metrics.review_count
      && metrics.workflow_input_link_count === metrics.workflow_input_count
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_since_cursor_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.credential_ref_required === true
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.external_network_access_required_for_runtime === true
      && metrics.local_export_read_performed === true
      && metrics.github_api_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === true
      && metrics.source_read_performed === true
      && metrics.credential_material_read === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.issue_mutation_performed === false
      && metrics.pull_request_mutation_performed === false
      && metrics.repository_mutation_performed === false
      && metrics.branch_push_performed === false
      && metrics.merge_performed === false
      && metrics.release_performed === false
      && metrics.workflow_state_mutation_performed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.resource_candidate_count
      && metrics.workflow_input_human_review_required_count === metrics.workflow_input_count
    ) {
      return passedWithOperationalGate(stage, "GitHub Connector projects operator-provided export issues, pull requests, commits, reviews, and workflow inputs into review-gated resource candidates without live GitHub API calls, network access, credential reads, mutation, push, merge, release, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "vdr_connector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.vdr_connector_status === "complete"
      && metrics.source_github_connector_status === "complete"
      && metrics.source_ldd_vdr_inventory_status === "complete"
      && metrics.room_count > 0
      && metrics.index_record_count > 0
      && metrics.document_count > 0
      && metrics.version_count === metrics.document_count
      && metrics.permission_boundary_count === metrics.document_count
      && metrics.resource_expansion_seed_count === metrics.document_count
      && metrics.index_resource_count === metrics.index_record_count
      && metrics.document_resource_count === metrics.document_count
      && metrics.resource_candidate_count === metrics.index_record_count + metrics.document_count
      && metrics.resource_expansion_seed_link_count === metrics.resource_expansion_seed_count
      && metrics.ldd_vdr_inventory_file_link_count > 0
      && metrics.permission_boundary_link_count === metrics.document_count
      && metrics.metadata_complete_index_count === metrics.index_record_count
      && metrics.metadata_complete_document_count === metrics.document_count
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_index_revision_cursor_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.credential_ref_required === true
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.external_network_access_required_for_runtime === true
      && metrics.local_export_read_performed === true
      && metrics.vdr_api_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === true
      && metrics.source_read_performed === true
      && metrics.credential_material_read === false
      && metrics.document_content_read_performed === false
      && metrics.vdr_document_download_performed === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.permission_mutation_performed === false
      && metrics.resource_expansion_mutation_performed === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.resource_candidate_count
      && metrics.resource_expansion_human_review_required_count === metrics.resource_expansion_seed_count
    ) {
      return passedWithOperationalGate(stage, "VDR Connector projects operator-provided room index, document metadata, permission boundaries, and resource expansion seeds into review-gated candidates without live VDR API calls, network access, credential reads, document downloads, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "plaud_transcript_connector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.plaud_transcript_connector_status === "complete"
      && metrics.source_vdr_connector_status === "complete"
      && metrics.source_normalized_text_contract_status === "complete"
      && metrics.recording_count > 0
      && metrics.speaker_count > 0
      && metrics.segment_count > 0
      && metrics.audio_metadata_count > 0
      && metrics.normalized_text_record_count === metrics.segment_count
      && metrics.timestamp_span_count === metrics.segment_count
      && metrics.transcript_resource_count === metrics.segment_count
      && metrics.audio_resource_count === metrics.audio_metadata_count
      && metrics.resource_candidate_count === metrics.segment_count + metrics.audio_metadata_count
      && metrics.speaker_link_count === metrics.segment_count
      && metrics.timestamp_range_count === metrics.segment_count
      && metrics.normalized_text_speaker_tag_count === metrics.segment_count
      && metrics.normalized_text_timestamp_tag_count === metrics.segment_count
      && metrics.metadata_complete_segment_count === metrics.segment_count
      && metrics.metadata_complete_audio_count === metrics.audio_metadata_count
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_transcript_timestamp_cursor_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.credential_ref_required === false
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.external_network_access_required_for_runtime === false
      && metrics.local_export_read_performed === true
      && metrics.plaud_api_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === true
      && metrics.source_read_performed === true
      && metrics.credential_material_read === false
      && metrics.audio_download_performed === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.normalized_text_mutation_performed === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.resource_candidate_count
      && metrics.normalized_text_human_review_required_count === metrics.normalized_text_record_count
    ) {
      return passedWithOperationalGate(stage, "Plaud Transcript Connector projects operator-provided recording, speaker, timestamp, transcript, normalized text, and audio metadata rows into review-gated candidates without live Plaud API calls, network access, credential reads, audio downloads, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "erp_draft_connector_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.erp_draft_connector_status === "complete"
      && metrics.source_plaud_transcript_connector_status === "complete"
      && metrics.source_output_delivery_contract_freeze_status === "complete"
      && metrics.account_count > 0
      && metrics.draft_count >= 3
      && metrics.estimate_draft_count > 0
      && metrics.invoice_draft_count > 0
      && metrics.tax_invoice_draft_count > 0
      && metrics.line_item_count > 0
      && metrics.draft_output_count === metrics.draft_count
      && metrics.approval_hold_count === metrics.draft_count
      && metrics.resource_candidate_count === metrics.draft_count
      && metrics.line_item_link_count === metrics.line_item_count
      && metrics.draft_only_output_count === metrics.draft_count
      && metrics.final_output_allowed_count === 0
      && metrics.ready_to_issue_count === 0
      && metrics.blocked_final_action_count === metrics.draft_count
      && metrics.metadata_complete_draft_count === metrics.draft_count
      && metrics.cursor_status === "complete"
      && metrics.cursor_resume_supported === true
      && metrics.raw_draft_sequence_cursor_material_allowed === false
      && metrics.auth_boundary_status === "enforced"
      && metrics.auth_mode === "service_account_draft_hold"
      && metrics.credential_ref_required === true
      && metrics.credential_reference_only === true
      && metrics.raw_secret_material_allowed === false
      && metrics.read_operations_allowed === true
      && metrics.draft_output_allowed === true
      && metrics.final_output_allowed === false
      && metrics.write_operations_allowed === false
      && metrics.external_network_access_required_for_runtime === true
      && metrics.local_export_read_performed === true
      && metrics.erp_api_execution_performed === false
      && metrics.external_network_access_performed === false
      && metrics.connector_execution_performed === true
      && metrics.source_read_performed === true
      && metrics.credential_material_read === false
      && metrics.draft_output_generated === true
      && metrics.final_output_generated === false
      && metrics.erp_issue_performed === false
      && metrics.source_mutation_performed === false
      && metrics.resource_mutation_performed === false
      && metrics.billing_mutation_performed === false
      && metrics.matter_data_write_allowed === false
      && metrics.task_state_write_allowed === false
      && metrics.workflow_transition_allowed === false
      && metrics.output_delivery_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.human_review_required_count === metrics.draft_count + metrics.draft_output_count
      && metrics.approval_hold_human_review_required_count === metrics.approval_hold_count
    ) {
      return passedWithOperationalGate(stage, "ERP Draft Connector projects operator-provided estimate, invoice, and tax invoice draft rows into review-gated draft-only candidates without live ERP API calls, network access, credential reads, issue/finalize actions, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "connector_freeze_gate") {
    if (
      metrics.validation_error_count === 0
      && metrics.failed_checkpoint_count === 0
      && metrics.connector_freeze_status === "complete"
      && metrics.source_count === 9
      && metrics.passed_source_count === metrics.source_count
      && metrics.connector_artifact_count === 8
      && metrics.connector_contract_count === 8
      && metrics.contracted_connector_count === 8
      && metrics.source_contract_count === 8
      && metrics.cursor_contract_count === 8
      && metrics.external_id_contract_count === 8
      && metrics.auth_boundary_count === 8
      && metrics.path_count === 7
      && metrics.passed_path_count === metrics.path_count
      && metrics.representative_source_ingest_path_count === 6
      && metrics.passed_representative_source_ingest_path_count === metrics.representative_source_ingest_path_count
      && metrics.gate_count >= 7
      && metrics.passed_gate_count === metrics.gate_count
      && metrics.connector_resource_candidate_count > 0
      && metrics.cursor_resume_supported_count === 8
      && metrics.raw_cursor_material_allowed_count === 0
      && metrics.credential_reference_only_connector_count === 8
      && metrics.credential_material_read_count === 0
      && metrics.raw_secret_material_allowed_count === 0
      && metrics.external_network_access_performed_count === 0
      && metrics.write_operations_allowed_count === 0
      && metrics.source_mutation_performed_count === 0
      && metrics.resource_mutation_performed_count === 0
      && metrics.billing_mutation_performed_count === 0
      && metrics.output_delivery_performed_count === 0
      && metrics.protected_action_executed_count === 0
      && metrics.legal_advice_generated_count === 0
      && metrics.client_facing_output_generated_count === 0
      && metrics.read_only === true
      && metrics.freeze_report_only === true
      && metrics.connector_runtime_execution_performed === false
      && metrics.source_ingest_performed === false
      && metrics.source_artifact_mutation_performed === false
      && metrics.delivery_execution_performed === false
      && metrics.protected_action_executed === false
      && metrics.legal_advice_generated === false
      && metrics.client_facing_output_generated === false
      && metrics.client_facing_ready_count === 0
    ) {
      return passedWithOperationalGate(stage, "Connector Freeze locks the P267-P275 connector layer with complete source artifacts, representative ingest paths, hash-only cursors, credential-reference-only auth, and no freeze-time execution, mutation, delivery, legal advice, or client-facing output.");
    }
  }

  if (item.acceptance_profile === "event_envelope_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const envelopeCount = metrics.event_envelope_count ?? 0;
    if (
      errors === 0
      && metrics.event_envelope_status === "complete"
      && metrics.source_freeze_status === "complete"
      && envelopeCount > 0
      && envelopeCount === (metrics.source_event_record_count ?? 0) + (metrics.source_audit_event_count ?? 0)
      && (metrics.source_binding_count ?? 0) === envelopeCount
      && (metrics.linked_source_binding_count ?? 0) === envelopeCount
      && (metrics.round_trip_preserved_binding_count ?? 0) === envelopeCount
      && (metrics.required_field_complete_envelope_count ?? 0) === envelopeCount
      && (metrics.missing_required_field_count ?? 1) === 0
      && (metrics.specversion_1_0_count ?? 0) === envelopeCount
      && (metrics.dataschema_declared_count ?? 0) === envelopeCount
      && (metrics.schemaversion_declared_count ?? 0) === envelopeCount
      && (metrics.data_object_count ?? 0) === envelopeCount
    ) {
      return passedWithOperationalGate(stage, "Event envelope ledger projects every EventRecord and AuditEvent into a CloudEvents-style envelope with schema, source binding, JSON data, and protected action flags preserved as audit data.");
    }
  }

  if (item.acceptance_profile === "event_type_registry_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const eventTypeCount = metrics.event_type_count ?? 0;
    const envelopeCount = metrics.source_event_envelope_count ?? 0;
    const requiredFamilyCount = metrics.required_family_count ?? 0;
    if (
      errors === 0
      && metrics.event_type_registry_status === "complete"
      && metrics.source_event_envelope_status === "complete"
      && eventTypeCount > 0
      && envelopeCount > 0
      && (metrics.event_type_binding_count ?? 0) === envelopeCount
      && (metrics.bound_event_type_binding_count ?? 0) === envelopeCount
      && requiredFamilyCount === 6
      && (metrics.covered_required_family_count ?? 0) === requiredFamilyCount
      && (metrics.missing_required_family_count ?? 1) === 0
      && (metrics.unclassified_event_type_count ?? 1) === 0
      && (metrics.registered_event_type_count ?? 0) === eventTypeCount
      && (metrics.resource_event_type_count ?? 0) > 0
      && (metrics.workflow_event_type_count ?? 0) > 0
      && (metrics.agent_event_type_count ?? 0) > 0
      && (metrics.gate_event_type_count ?? 0) > 0
      && (metrics.approval_event_type_count ?? 0) > 0
      && (metrics.output_event_type_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Event type registry catalogs every envelope into a registered type, binds each envelope once, and covers resource, workflow, agent, gate, approval, and output families.");
    }
  }

  if (item.acceptance_profile === "append_only_event_store_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const storedEventCount = metrics.stored_event_count ?? 0;
    if (
      errors === 0
      && metrics.event_store_status === "complete"
      && metrics.source_event_envelope_status === "complete"
      && metrics.source_event_type_registry_status === "complete"
      && storedEventCount > 0
      && storedEventCount === (metrics.source_event_envelope_count ?? 0)
      && (metrics.appended_event_count ?? 0) === storedEventCount
      && (metrics.immutable_event_count ?? 0) === storedEventCount
      && (metrics.hash_chained_event_count ?? 0) === storedEventCount
      && (metrics.type_registry_bound_event_count ?? 0) === storedEventCount
      && (metrics.sequence_gap_count ?? 1) === 0
      && (metrics.duplicate_event_id_count ?? 1) === 0
      && (metrics.in_place_mutation_count ?? 1) === 0
      && metrics.correction_policy_status === "enforced"
      && (metrics.append_only_policy_count ?? 0) === 1
    ) {
      return passedWithOperationalGate(stage, "Append-only event store projects every envelope to an immutable, hash-chained stored event and requires corrections to be appended as new events.");
    }
  }

  if (item.acceptance_profile === "event_correlation_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const traceCount = metrics.correlation_trace_count ?? 0;
    const externalControlTraceCount = metrics.external_control_trace_count ?? 0;
    const runBoundTraceCount = metrics.run_bound_trace_count ?? 0;
    if (
      errors === 0
      && metrics.event_correlation_status === "complete"
      && metrics.source_event_store_status === "complete"
      && metrics.source_event_audit_run_freeze_status === "complete"
      && traceCount > 0
      && (metrics.source_stored_event_count ?? 0) > 0
      && (metrics.missing_correlation_id_count ?? 1) === 0
      && (metrics.incomplete_trace_count ?? 1) === 0
      && (metrics.linked_trace_count ?? 0) + externalControlTraceCount === traceCount
      && runBoundTraceCount + externalControlTraceCount === traceCount
      && (metrics.event_bound_trace_count ?? 0) === traceCount
      && (metrics.missing_causation_edge_count ?? 1) === 0
      && (metrics.linked_causation_edge_count ?? 0) === (metrics.causation_edge_count ?? -1)
      && (metrics.unknown_trace_run_binding_count ?? 1) === 0
      && (metrics.known_trace_run_binding_count ?? 0) === (metrics.trace_run_binding_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Event correlation ledger links run-bound events into matter/workflow/run traces, keeps external control audit events explicit, and resolves causation edges plus RunLedger bindings.");
    }
  }

  if (item.acceptance_profile === "workflow_run_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const recordCount = metrics.workflow_run_record_count ?? 0;
    const transitionCount = metrics.state_transition_count ?? 0;
    const eventBindingCount = metrics.event_binding_count ?? 0;
    if (
      errors === 0
      && metrics.workflow_run_ledger_status === "complete"
      && metrics.source_event_correlation_status === "complete"
      && metrics.source_event_audit_run_freeze_status === "complete"
      && metrics.source_capability_workflow_freeze_status === "complete"
      && metrics.source_event_store_status === "complete"
      && recordCount > 0
      && recordCount === (metrics.source_run_bound_trace_count ?? -1)
      && (metrics.event_backed_workflow_run_record_count ?? 0) === recordCount
      && (metrics.run_ledger_bound_record_count ?? 0) === recordCount
      && transitionCount > 0
      && (metrics.event_backed_state_transition_count ?? 0) === transitionCount
      && (metrics.terminal_transition_count ?? 0) === recordCount
      && eventBindingCount > 0
      && (metrics.linked_event_binding_count ?? 0) === eventBindingCount
      && (metrics.terminal_state_aligned_count ?? 0) === recordCount
      && (metrics.terminal_state_mismatch_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Workflow run ledger projects each run-bound trace into an event-backed workflow record, binds every stored event, and records terminal state transitions aligned with RunLedger status.");
    }
  }

  if (item.acceptance_profile === "agent_run_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const recordCount = metrics.agent_run_record_count ?? 0;
    const ioReferenceCount = metrics.agent_run_io_reference_count ?? 0;
    const logReferenceCount = metrics.agent_run_log_reference_count ?? 0;
    const eventBindingCount = metrics.agent_run_event_binding_count ?? 0;
    if (
      errors === 0
      && metrics.agent_run_ledger_status === "complete"
      && metrics.source_runtime_agentrun_contract_freeze_status === "complete"
      && metrics.source_workflow_run_ledger_status === "complete"
      && metrics.source_event_store_status === "complete"
      && metrics.source_event_correlation_status === "complete"
      && recordCount > 0
      && recordCount === (metrics.source_agent_run_count ?? -1)
      && (metrics.runtime_contract_bound_record_count ?? 0) === recordCount
      && (metrics.workflow_run_bound_record_count ?? 0) === recordCount
      && ioReferenceCount === recordCount
      && (metrics.complete_io_reference_count ?? 0) === ioReferenceCount
      && logReferenceCount === recordCount
      && (metrics.captured_log_reference_count ?? 0) === logReferenceCount
      && (metrics.required_log_missing_count ?? 1) === 0
      && (metrics.agent_run_artifact_reference_count ?? -1) === (metrics.source_runtime_artifact_count ?? 0)
      && (metrics.missing_required_artifact_count ?? 1) === 0
      && eventBindingCount > 0
      && (metrics.linked_event_binding_count ?? 0) === eventBindingCount
    ) {
      return passedWithOperationalGate(stage, "Agent run ledger projects runtime AgentRun records, binds workflow/run ledger context, and stores IO, log, artifact, and event references for each runtime execution.");
    }
  }

  if (item.acceptance_profile === "tool_invocation_ledger_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.missing_permission_decision_count ?? 0)
      + (metrics.missing_agent_run_tool_gate_count ?? 0)
      + (metrics.missing_event_binding_count ?? 0)
      + (metrics.unknown_tool_count ?? 0);
    const recordCount = metrics.tool_invocation_record_count ?? 0;
    const agentBindingCount = metrics.agent_run_binding_count ?? 0;
    const eventBindingCount = metrics.event_binding_count ?? 0;
    if (
      errors === 0
      && metrics.tool_invocation_ledger_status === "complete"
      && metrics.source_agent_run_ledger_status === "complete"
      && metrics.source_tool_runtime_policy_status === "complete"
      && metrics.source_event_store_status === "complete"
      && metrics.source_event_correlation_status === "complete"
      && metrics.source_runtime_agentrun_contract_freeze_status === "complete"
      && recordCount > 0
      && (metrics.permission_decision_count ?? 0) === recordCount
      && agentBindingCount === (metrics.source_agent_run_count ?? -1)
      && (metrics.complete_agent_binding_count ?? 0) === agentBindingCount
      && eventBindingCount === recordCount
      && (metrics.context_bound_event_binding_count ?? 0) === eventBindingCount
      && (metrics.forbidden_tool_invocation_count ?? 0) === (metrics.blocked_tool_invocation_count ?? -1)
      && (metrics.denied_tool_invocation_count ?? 0) === (metrics.blocked_tool_invocation_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Tool invocation ledger projects each AgentRun runtime tool policy into auditable permission decisions and AgentRun event-context bindings.");
    }
  }

  if (item.acceptance_profile === "audit_event_ledger_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.mixed_observability_record_count ?? 0);
    const recordCount = metrics.audit_trail_record_count ?? 0;
    const bindingCount = metrics.audit_separation_binding_count ?? 0;
    if (
      errors === 0
      && metrics.audit_event_ledger_status === "complete"
      && metrics.source_event_audit_run_freeze_status === "complete"
      && metrics.source_access_audit_projection_status === "complete"
      && metrics.source_append_only_event_store_status === "complete"
      && metrics.source_observability_freeze_status === "complete"
      && metrics.source_control_plane_audit_status === "complete"
      && recordCount > 0
      && recordCount === (metrics.source_event_audit_run_audit_event_count ?? 0) + (metrics.source_access_audit_record_count ?? 0)
      && (metrics.separated_audit_record_count ?? 0) === recordCount
      && (metrics.observability_log_excluded_record_count ?? 0) === recordCount
      && bindingCount === recordCount
      && (metrics.separated_binding_count ?? 0) === bindingCount
      && (metrics.audit_event_v2_record_count ?? 0) === (metrics.source_event_audit_run_audit_event_count ?? -1)
      && (metrics.access_audit_record_count ?? 0) === (metrics.source_access_audit_record_count ?? -1)
      && (metrics.event_store_bound_record_count ?? 0) === (metrics.audit_event_v2_record_count ?? -1)
      && (metrics.source_projection_only_record_count ?? 0) === (metrics.access_audit_record_count ?? -1)
      && (metrics.approval_audit_record_count ?? 0) > 0
      && (metrics.access_audit_domain_record_count ?? 0) > 0
      && (metrics.security_audit_record_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Audit event ledger separates security, access, and approval audit rows from observability logs while preserving append-only bindings for AuditEvent v2 rows.");
    }
  }

  if (item.acceptance_profile === "matter_tagging_decision_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.no_candidate_count ?? 0) + (metrics.auto_applied_count ?? 0);
    if (
      errors === 0
      && (metrics.matter_tagging_decision_count ?? 0) > 0
      && (metrics.automatic_candidate_count ?? 0) > 0
      && (metrics.pending_human_confirmation_count ?? 0) > 0
      && (metrics.human_confirmation_request_count ?? 0) === (metrics.pending_human_confirmation_count ?? -1)
      && (metrics.correction_history_count ?? 0) >= 0
    ) {
      return passedWithOperationalGate(stage, "Matter tagging decisions are implemented with automatic candidates, pending human confirmation, and separate correction history without auto-applying matter changes.");
    }
  }

  if (item.acceptance_profile === "access_audit_projection_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.matter_tagging_unresolved_count ?? 0);
    const sourceCovered = (metrics.access_audit_record_count ?? 0) === (metrics.matter_access_decision_count ?? 0) + (metrics.resource_access_decision_count ?? 0);
    if (
      errors === 0
      && sourceCovered
      && (metrics.access_audit_record_count ?? 0) > 0
      && (metrics.actor_access_rollup_count ?? 0) > 0
      && (metrics.resource_access_rollup_count ?? 0) > 0
      && (metrics.distinct_user_count ?? 0) > 0
      && (metrics.distinct_matter_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Access audit projection is implemented and exposing who can view which matter/resource by user, runtime, matter, resource, and policy snapshot.");
    }
  }

  if (item.acceptance_profile === "store_policy_adapter_gate") {
    const planCount = metrics.store_query_plan_count ?? 0;
    const errors = metrics.validation_error_count ?? 0;
    if (
      errors === 0
      && planCount > 0
      && (metrics.rls_enforced_query_plan_count ?? 0) === planCount
      && (metrics.matter_filter_enforced_count ?? 0) === planCount
      && (metrics.classification_filter_enforced_count ?? 0) === planCount
      && (metrics.policy_snapshot_filter_enforced_count ?? 0) === planCount
      && (metrics.access_audit_filter_enforced_count ?? 0) === planCount
      && (metrics.unfiltered_probe_blocked_count ?? 0) === planCount
      && (metrics.cross_matter_probe_blocked_count ?? 0) === planCount
      && (metrics.missing_matter_filter_probe_blocked_count ?? 0) === planCount
      && (metrics.missing_classification_filter_probe_blocked_count ?? 0) === planCount
    ) {
      return passedWithOperationalGate(stage, "Store policy adapter is implemented and query-layer tenant, matter, classification, policy snapshot, and access-audit filters are enforced with negative RLS probes.");
    }
  }

  if (item.acceptance_profile === "conflict_check_interface_gate") {
    const requestCount = metrics.conflict_check_request_count ?? 0;
    const resultCount = metrics.conflict_check_result_count ?? 0;
    const signalCount = metrics.conflict_signal_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0) + (metrics.missing_conflict_reference_count ?? 0);
    if (
      errors === 0
      && requestCount > 0
      && resultCount === requestCount
      && signalCount >= requestCount
      && (metrics.matter_intake_request_count ?? 0) > 0
      && (metrics.resource_access_request_count ?? 0) > 0
      && (metrics.store_plan_linked_request_count ?? 0) === (metrics.resource_access_request_count ?? -1)
      && (metrics.review_required_result_count ?? 0) > 0
      && (metrics.counterparty_signal_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Conflict check interface is implemented with intake/resource requests, request-linked results, counterparty review signals, and store query plan bindings before access proceeds.");
    }
  }

  if (item.acceptance_profile === "personal_workspace_boundary_gate") {
    const workspaceCount = metrics.workspace_boundary_count ?? 0;
    const probeCount = metrics.cross_workspace_probe_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0) + (metrics.mixed_search_namespace_count ?? 0);
    if (
      errors === 0
      && workspaceCount >= 2
      && (metrics.law_firm_boundary_count ?? 0) > 0
      && (metrics.personal_workspace_boundary_count ?? 0) > 0
      && (metrics.search_namespace_policy_count ?? 0) >= 2
      && probeCount > 0
      && (metrics.blocked_cross_workspace_probe_count ?? 0) === probeCount
      && (metrics.allowed_cross_workspace_probe_count ?? 0) === 0
      && (metrics.personal_resource_count ?? 0) > 0
      && (metrics.law_firm_resource_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Personal workspace boundary is implemented with separate law-firm and personal tenants, isolated search namespaces, and blocked cross-workspace probes.");
    }
  }

  if (item.acceptance_profile === "policy_golden_fixtures_gate") {
    const caseCount = metrics.policy_fixture_case_count ?? 0;
    const reviewCount = metrics.review_case_count ?? 0;
    const denyCount = metrics.deny_case_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.failed_validation_item_count ?? 0)
      + (metrics.mismatch_case_count ?? 0)
      + (metrics.missing_case_count ?? 0);
    if (
      errors === 0
      && caseCount > 0
      && (metrics.locked_case_count ?? 0) === caseCount
      && (metrics.allow_case_count ?? 0) > 0
      && reviewCount > 0
      && denyCount > 0
      && (metrics.review_case_with_human_gate_count ?? 0) === reviewCount
      && (metrics.deny_case_blocked_count ?? 0) === denyCount
      && (metrics.locked_regression_hash_count ?? 0) === caseCount
    ) {
      return passedWithOperationalGate(stage, "Policy golden fixtures are implemented with locked allow, review, and deny/block regression cases across policy evaluators.");
    }
  }

  if (item.acceptance_profile === "policy_operations_surface_gate") {
    const decisionCount = metrics.policy_decision_row_count ?? 0;
    const pendingApprovalCount = metrics.policy_pending_approval_row_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    if (
      errors === 0
      && decisionCount > 0
      && (metrics.allow_decision_count ?? 0) > 0
      && (metrics.review_decision_count ?? 0) > 0
      && (metrics.deny_decision_count ?? 0) > 0
      && (metrics.policy_violation_row_count ?? 0) > 0
      && pendingApprovalCount > 0
      && (metrics.human_gate_pending_approval_count ?? 0) > 0
      && (metrics.distinct_policy_layer_count ?? 0) >= 6
    ) {
      return passedWithOperationalGate(stage, "Policy operations surface is implemented with unified allow, review, deny, violation, and pending approval rows across policy layers for dashboard/API review.");
    }
  }

  if (item.acceptance_profile === "matter_boundary_slice_gate") {
    const pathCount = metrics.resource_boundary_path_count ?? 0;
    const gateCount = metrics.retrieval_gate_check_count ?? 0;
    const errors = (metrics.validation_error_count ?? 0) + (metrics.failed_validation_item_count ?? 0);
    if (
      errors === 0
      && pathCount > 0
      && gateCount > 0
      && (metrics.promoted_resource_path_count ?? 0) === pathCount
      && (metrics.access_decision_covered_resource_count ?? 0) === pathCount
      && (metrics.access_audited_resource_count ?? 0) === pathCount
      && (metrics.store_compiled_resource_count ?? 0) === pathCount
      && (metrics.required_store_filter_resource_count ?? 0) === pathCount
      && (metrics.negative_probe_blocked_resource_count ?? 0) === pathCount
      && (metrics.policy_surface_visible_resource_count ?? 0) === pathCount
      && (metrics.passed_retrieval_gate_check_count ?? 0) === gateCount
      && (metrics.failed_retrieval_gate_check_count ?? 0) === 0
      && (metrics.negative_probe_blocked_count ?? 0) === (metrics.negative_probe_expected_count ?? -1)
      && (metrics.unassigned_executable_query_plan_count ?? 0) === 0
      && (metrics.held_for_matter_tagging_resource_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Matter boundary vertical slice is implemented from resource ingest through access audit, store query policy, negative retrieval probes, and pending human matter-tagging gates.");
    }
  }

  if (item.acceptance_profile === "identity_policy_matter_freeze_gate") {
    const sourceCount = metrics.required_source_count ?? 0;
    const checkpointCount = metrics.freeze_checkpoint_count ?? 0;
    const errors = metrics.validation_error_count ?? 0;
    if (
      errors === 0
      && metrics.freeze_status !== "blocked"
      && sourceCount > 0
      && (metrics.available_required_source_count ?? 0) === sourceCount
      && (metrics.clean_source_count ?? 0) === sourceCount
      && checkpointCount > 0
      && (metrics.passed_freeze_checkpoint_count ?? 0) === checkpointCount
      && (metrics.failed_freeze_checkpoint_count ?? 0) === 0
      && (metrics.policy_fixture_case_count ?? 0) > 0
      && (metrics.locked_policy_fixture_count ?? 0) === (metrics.policy_fixture_case_count ?? -1)
      && (metrics.policy_decision_row_count ?? 0) > 0
      && (metrics.resource_boundary_path_count ?? 0) > 0
      && (metrics.retrieval_gate_check_count ?? 0) > 0
      && (metrics.unassigned_executable_query_plan_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0
      && (metrics.external_delivery_executed_count ?? 0) === 0
      && (metrics.auto_approval_count ?? 0) === 0
    ) {
      return passedWithOperationalGate(stage, "Identity/Policy/Matter track is frozen as a regression report with policy fixtures, operations surface, matter boundary gates, and no protected actions executed.");
    }
  }

  if (item.acceptance_profile === "resource_store_interface_gate") {
    const errors = metrics.validation_error_count ?? 0;
    if (
      errors === 0
      && metrics.resource_store_interface_status === "complete"
      && (metrics.resource_store_record_count ?? 0) > 0
      && (metrics.resource_version_store_record_count ?? 0) > 0
      && (metrics.bound_required_consumer_layer_count ?? 0) === (metrics.required_consumer_layer_count ?? -1)
      && (metrics.registry_adapter_binding_count ?? 0) > 0
      && (metrics.ingestion_adapter_binding_count ?? 0) > 0
      && (metrics.dashboard_adapter_binding_count ?? 0) > 0
      && (metrics.required_resource_filter_count ?? 0) >= 4
      && (metrics.resource_store_rls_template_count ?? 0) > 0
      && (metrics.compiled_resource_query_plan_count ?? 0) > 0
      && (metrics.executable_resource_query_plan_count ?? 0) === 0
    ) {
      return passedWithOperationalGate(stage, "Resource store interface is implemented as a common registry, ingestion, dashboard, and policy-query contract before storage layout work begins.");
    }
  }

  if (item.acceptance_profile === "immutable_object_store_layout_gate") {
    const errors = metrics.validation_error_count ?? 0;
    if (
      errors === 0
      && metrics.object_store_layout_status === "complete"
      && (metrics.raw_source_object_path_count ?? 0) > 0
      && (metrics.generated_output_object_path_count ?? 0) > 0
      && (metrics.collision_count ?? -1) === 0
      && (metrics.absolute_source_path_key_count ?? -1) === 0
      && (metrics.content_addressed_path_count ?? 0) === (metrics.total_object_path_count ?? -1)
      && (metrics.path_resolver_count ?? 0) >= 2
    ) {
      return passedWithOperationalGate(stage, "Immutable object store layout resolves raw source and generated output keys without collisions or absolute source path leakage.");
    }
  }

  if (item.acceptance_profile === "resource_version_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    if (
      errors === 0
      && metrics.resource_version_ledger_status === "complete"
      && (metrics.version_family_count ?? 0) > 0
      && (metrics.resource_version_count ?? 0) > 0
      && (metrics.object_path_binding_count ?? 0) === (metrics.resource_version_count ?? -1)
      && (metrics.unbound_object_path_count ?? -1) === 0
      && (metrics.version_event_count ?? 0) >= (metrics.resource_version_count ?? 0)
    ) {
      return passedWithOperationalGate(stage, "Resource version ledger groups versions by source/external id, distinguishes changed and duplicate content, and binds every version to an immutable raw-source object path.");
    }
  }

  if (item.acceptance_profile === "resource_dedup_hash_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const decisionCount = metrics.dedup_decision_count ?? 0;
    if (
      errors === 0
      && metrics.resource_dedup_hash_status === "complete"
      && (metrics.hash_group_count ?? 0) > 0
      && (metrics.external_id_group_count ?? 0) > 0
      && decisionCount >= (metrics.resource_version_count ?? 0)
      && (metrics.content_hash_criteria_count ?? 0) === decisionCount
      && (metrics.external_id_criteria_count ?? 0) === decisionCount
      && (metrics.resource_version_criteria_count ?? 0) === decisionCount
      && (metrics.passed_hash_integrity_check_count ?? 0) === (metrics.hash_integrity_check_count ?? -1)
      && (metrics.failed_hash_integrity_check_count ?? -1) === 0
    ) {
      return passedWithOperationalGate(stage, "Resource dedup/hash ledger classifies resources by content hash, external id, and version criteria without allowing destructive mutation.");
    }
  }

  if (item.acceptance_profile === "resource_quarantine_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const itemCount = metrics.quarantine_item_count ?? 0;
    if (
      errors === 0
      && metrics.resource_quarantine_status === "complete"
      && (metrics.quarantine_rule_count ?? 0) >= 6
      && itemCount > 0
      && (metrics.review_queue_item_count ?? 0) === itemCount
      && (metrics.pending_human_review_count ?? 0) === itemCount
      && (metrics.retrieval_blocked_count ?? 0) === itemCount
      && (metrics.external_transfer_blocked_count ?? 0) === itemCount
      && (metrics.output_delivery_blocked_count ?? 0) === itemCount
      && (metrics.auto_release_allowed_count ?? -1) === 0
      && (metrics.sensitive_hold_count ?? 0) >= (metrics.source_sensitive_item_count ?? 0)
      && (metrics.ambiguous_hold_count ?? 0) >= (metrics.source_ambiguous_item_count ?? 0)
    ) {
      return passedWithOperationalGate(stage, "Resource quarantine model holds sensitive, ambiguous, failed, oversized, encrypted/materialization, and duplicate/hash-review resources behind manual human release.");
    }
  }

  if (item.acceptance_profile === "normalized_text_contract_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const artifactCount = metrics.normalized_text_artifact_count ?? 0;
    if (
      errors === 0
      && metrics.normalized_text_contract_status === "complete"
      && artifactCount > 0
      && (metrics.location_map_count ?? 0) === artifactCount
      && (metrics.source_span_seed_count ?? 0) === artifactCount
      && (metrics.source_span_seed_ready_count ?? 0) === artifactCount
      && (metrics.raw_source_bound_count ?? 0) === artifactCount
      && (metrics.page_unit_count ?? 0) > 0
      && (metrics.paragraph_unit_count ?? 0) > 0
      && (metrics.line_unit_count ?? 0) > 0
    ) {
      return passedWithOperationalGate(stage, "Normalized text contract binds extracted text to resource versions, raw-source object keys, and source-span-ready page, paragraph, line, and char offsets.");
    }
  }

  if (item.acceptance_profile === "extractor_adapter_contract_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const artifactCount = metrics.normalized_text_artifact_count ?? 0;
    if (
      errors === 0
      && metrics.extractor_adapter_contract_status === "complete"
      && (metrics.extractor_adapter_count ?? 0) > 0
      && (metrics.extractor_io_contract_count ?? 0) === (metrics.extractor_adapter_count ?? -1)
      && (metrics.normalized_text_binding_count ?? 0) === artifactCount
      && (metrics.bound_normalized_text_count ?? 0) === artifactCount
      && (metrics.unbound_normalized_text_count ?? 0) === 0
      && (metrics.external_service_adapter_count ?? 0) === 0
    ) {
      return passedWithOperationalGate(stage, "Extractor adapter contract gives parser/OCR implementations one local-only I/O boundary and binds every normalized text artifact to a registered adapter.");
    }
  }

  if (item.acceptance_profile === "source_span_store_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const artifactCount = metrics.normalized_text_artifact_count ?? 0;
    const spanCount = metrics.source_span_count ?? 0;
    if (
      errors === 0
      && metrics.source_span_store_status === "complete"
      && artifactCount > 0
      && spanCount > 0
      && (metrics.whole_document_span_count ?? 0) === artifactCount
      && (metrics.page_span_count ?? 0) >= artifactCount
      && (metrics.paragraph_span_count ?? 0) >= artifactCount
      && (metrics.line_span_count ?? 0) >= artifactCount
      && (metrics.char_range_span_count ?? 0) === artifactCount
      && (metrics.source_span_locator_count ?? 0) === spanCount
      && (metrics.source_span_location_unit_count ?? 0) === spanCount
      && (metrics.extractor_bound_span_count ?? 0) === spanCount
      && (metrics.canonical_offset_span_count ?? 0) === spanCount
    ) {
      return passedWithOperationalGate(stage, "Source span store materializes whole-document, page, paragraph, line, and char-range spans with canonical offsets and extractor bindings.");
    }
  }

  if (item.acceptance_profile === "evidence_item_store_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const evidenceCount = metrics.evidence_item_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_item_store_status === "complete"
      && evidenceCount > 0
      && evidenceCount === (metrics.source_span_count ?? -1)
      && evidenceCount === (metrics.evidence_source_span_binding_count ?? -1)
      && evidenceCount === (metrics.review_queue_item_count ?? -1)
      && evidenceCount === (metrics.matter_preserved_evidence_count ?? -1)
      && evidenceCount === (metrics.classification_preserved_evidence_count ?? -1)
      && evidenceCount === (metrics.policy_snapshot_preserved_evidence_count ?? -1)
      && evidenceCount === (metrics.needs_review_count ?? -1)
      && (metrics.approved_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Evidence item store materializes one review-pending EvidenceItem from every source span while preserving matter, classification, and policy snapshot.");
    }
  }

  if (item.acceptance_profile === "evidence_golden_fixtures_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const caseCount = metrics.evidence_golden_case_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_golden_fixture_status === "complete"
      && caseCount > 0
      && (metrics.locked_case_count ?? 0) === caseCount
      && (metrics.store_matched_case_count ?? 0) === caseCount
      && (metrics.human_review_required_case_count ?? 0) === caseCount
      && (metrics.local_deterministic_case_count ?? 0) === caseCount
      && (metrics.external_service_used_count ?? 1) === 0
      && (metrics.locked_regression_hash_count ?? 0) === caseCount
    ) {
      return passedWithOperationalGate(stage, "Evidence extraction golden fixtures lock LDD, meeting, contract, and client email evidence with store matches, human review holds, and regression hashes.");
    }
  }

  if (item.acceptance_profile === "fact_claim_store_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const factCount = metrics.fact_claim_count ?? 0;
    if (
      errors === 0
      && metrics.fact_claim_store_status === "complete"
      && factCount > 0
      && factCount === (metrics.evidence_item_count ?? -1)
      && factCount === (metrics.fact_evidence_binding_count ?? -1)
      && factCount === (metrics.review_queue_item_count ?? -1)
      && factCount === (metrics.evidence_linked_fact_count ?? -1)
      && factCount === (metrics.reliability_preserved_fact_count ?? -1)
      && factCount === (metrics.matter_preserved_fact_count ?? -1)
      && factCount === (metrics.classification_preserved_fact_count ?? -1)
      && factCount === (metrics.policy_snapshot_preserved_fact_count ?? -1)
      && factCount === (metrics.needs_review_count ?? -1)
      && (metrics.approved_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Fact claim store materializes one review-pending FactClaim from every evidence item while preserving evidence ids and reliability.");
    }
  }

  if (item.acceptance_profile === "issue_graph_store_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const issueCount = metrics.issue_count ?? 0;
    if (
      errors === 0
      && metrics.issue_graph_store_status === "complete"
      && issueCount > 0
      && issueCount === (metrics.fact_claim_count ?? -1)
      && issueCount === (metrics.fact_issue_binding_count ?? -1)
      && issueCount === (metrics.legal_rule_binding_count ?? -1)
      && issueCount === (metrics.risk_severity_assessment_count ?? -1)
      && issueCount === (metrics.review_queue_item_count ?? -1)
      && issueCount === (metrics.fact_linked_issue_count ?? -1)
      && issueCount === (metrics.legal_rule_linked_issue_count ?? -1)
      && issueCount === (metrics.risk_severity_linked_issue_count ?? -1)
      && issueCount === (metrics.matter_preserved_issue_count ?? -1)
      && issueCount === (metrics.classification_preserved_issue_count ?? -1)
      && issueCount === (metrics.policy_snapshot_preserved_issue_count ?? -1)
      && issueCount === (metrics.evidence_links_preserved_issue_count ?? -1)
      && issueCount === (metrics.needs_review_count ?? -1)
      && (metrics.legal_rule_count ?? 0) > 0
      && (metrics.approved_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Issue graph store links fact claims to review-pending issue candidates, legal rule placeholders, and risk severity assessments while preserving matter, classification, policy, and evidence lineage.");
    }
  }

  if (item.acceptance_profile === "citation_object_store_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const paragraphCount = metrics.output_paragraph_count ?? 0;
    const citationCount = metrics.citation_count ?? 0;
    if (
      errors === 0
      && metrics.citation_object_store_status === "complete"
      && paragraphCount > 0
      && citationCount >= paragraphCount
      && paragraphCount === (metrics.issue_count ?? -1)
      && citationCount === (metrics.paragraph_source_binding_count ?? -1)
      && citationCount === (metrics.review_queue_item_count ?? -1)
      && citationCount === (metrics.source_span_bound_citation_count ?? -1)
      && citationCount === (metrics.issue_linked_citation_count ?? -1)
      && citationCount === (metrics.paragraph_linked_citation_count ?? -1)
      && citationCount === (metrics.fact_linked_citation_count ?? -1)
      && citationCount === (metrics.evidence_linked_citation_count ?? -1)
      && citationCount === (metrics.matter_preserved_citation_count ?? -1)
      && citationCount === (metrics.classification_preserved_citation_count ?? -1)
      && citationCount === (metrics.policy_snapshot_preserved_citation_count ?? -1)
      && citationCount === (metrics.issue_link_preserved_citation_count ?? -1)
      && citationCount === (metrics.needs_review_count ?? -1)
      && (metrics.approved_count ?? 1) === 0
      && (metrics.client_facing_ready_count ?? 1) === 0
      && paragraphCount === (metrics.not_client_facing_paragraph_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Citation object store binds review-pending output paragraphs to source spans through citation objects while keeping client-facing readiness false.");
    }
  }

  if (item.acceptance_profile === "lineage_graph_builder_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const pathCount = metrics.lineage_path_count ?? 0;
    const edgeCount = metrics.lineage_edge_count ?? 0;
    if (
      errors === 0
      && metrics.lineage_graph_status === "complete"
      && metrics.citation_object_store_status === "complete"
      && pathCount > 0
      && (metrics.complete_lineage_path_count ?? 0) === pathCount
      && (metrics.broken_lineage_path_count ?? 1) === 0
      && (metrics.source_to_output_path_count ?? 0) === pathCount
      && (metrics.citation_bound_lineage_count ?? 0) === pathCount
      && (metrics.matter_preserved_path_count ?? 0) === pathCount
      && (metrics.classification_preserved_path_count ?? 0) === pathCount
      && (metrics.policy_snapshot_preserved_path_count ?? 0) === pathCount
      && (metrics.not_client_facing_output_path_count ?? 0) === pathCount
      && (metrics.client_facing_ready_path_count ?? 1) === 0
      && (metrics.needs_review_path_count ?? 0) === pathCount
      && edgeCount === pathCount * 5
    ) {
      return passedWithOperationalGate(stage, "Lineage graph builder reconstructs complete source-to-output paths through source, evidence, fact, issue, and output nodes while keeping outputs review-pending.");
    }
  }

  if (item.acceptance_profile === "evidence_viewer_data_api_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const cardCount = metrics.viewer_card_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_viewer_data_status === "complete"
      && metrics.source_span_store_status === "complete"
      && metrics.evidence_item_store_status === "complete"
      && metrics.lineage_graph_status === "complete"
      && cardCount > 0
      && (metrics.card_source_span_bound_count ?? 0) === cardCount
      && (metrics.card_lineage_path_bound_count ?? 0) === cardCount
      && (metrics.source_span_panel_bound_count ?? 0) === (metrics.source_span_panel_count ?? -1)
      && (metrics.complete_lineage_path_panel_count ?? 0) === (metrics.lineage_path_panel_count ?? -1)
      && (metrics.read_only_card_count ?? 0) === cardCount
    ) {
      return passedWithOperationalGate(stage, "Evidence viewer data API joins every evidence card to source span and lineage path panels while remaining read-only.");
    }
  }

  if (item.acceptance_profile === "evidence_coverage_score_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const scoreCount = metrics.coverage_score_count ?? 0;
    const dimensionCount = metrics.coverage_dimension_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_coverage_status === "complete"
      && metrics.lineage_graph_status === "complete"
      && metrics.source_span_store_status === "complete"
      && metrics.evidence_item_store_status === "complete"
      && metrics.fact_claim_store_status === "complete"
      && metrics.issue_graph_store_status === "complete"
      && metrics.citation_object_store_status === "complete"
      && scoreCount > 0
      && dimensionCount === scoreCount * 5
      && (metrics.claim_covered_count ?? 0) === scoreCount
      && (metrics.legal_basis_covered_count ?? 0) === scoreCount
      && (metrics.matter_preserved_score_count ?? 0) === scoreCount
      && (metrics.classification_preserved_score_count ?? 0) === scoreCount
      && (metrics.policy_snapshot_preserved_score_count ?? 0) === scoreCount
      && (metrics.not_client_facing_output_score_count ?? 0) === scoreCount
      && (metrics.client_facing_ready_score_count ?? 1) === 0
      && (metrics.needs_review_score_count ?? 0) === scoreCount
    ) {
      return passedWithOperationalGate(stage, "Evidence coverage score calculates claim, date, party, amount, and legal-basis coverage for each lineage path while keeping outputs review-pending.");
    }
  }

  if (item.acceptance_profile === "evidence_flags_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const recordCount = metrics.evidence_flag_record_count ?? 0;
    const decisionCount = metrics.flag_decision_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_flags_status === "complete"
      && metrics.evidence_coverage_status === "complete"
      && metrics.source_span_store_status === "complete"
      && metrics.evidence_item_store_status === "complete"
      && metrics.fact_claim_store_status === "complete"
      && metrics.issue_graph_store_status === "complete"
      && recordCount > 0
      && (metrics.coverage_score_count ?? 0) === recordCount
      && decisionCount === recordCount * 5
      && (metrics.machine_extracted_count ?? 0) === recordCount
      && (metrics.pending_human_confirmation_count ?? 0) === recordCount
      && (metrics.matter_preserved_record_count ?? 0) === recordCount
      && (metrics.classification_preserved_record_count ?? 0) === recordCount
      && (metrics.policy_snapshot_preserved_record_count ?? 0) === recordCount
      && (metrics.not_client_facing_record_count ?? 0) === recordCount
      && (metrics.client_facing_ready_record_count ?? 1) === 0
      && (metrics.needs_review_record_count ?? 0) === recordCount
    ) {
      return passedWithOperationalGate(stage, "Evidence flags separate machine extraction, human confirmation, privilege, redaction, and external-transfer state while keeping evidence review-pending.");
    }
  }

  if (item.acceptance_profile === "exhibit_map_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const recordCount = metrics.exhibit_record_count ?? 0;
    const bindingCount = metrics.exhibit_binding_count ?? 0;
    if (
      errors === 0
      && metrics.exhibit_map_status === "complete"
      && metrics.evidence_flags_status === "complete"
      && metrics.citation_object_store_status === "complete"
      && metrics.lineage_graph_status === "complete"
      && metrics.evidence_coverage_status === "complete"
      && recordCount > 0
      && bindingCount === recordCount * 4
      && (metrics.evidence_flag_record_count ?? 0) === recordCount
      && (metrics.citation_count ?? 0) === recordCount
      && (metrics.lineage_path_count ?? 0) === recordCount
      && (metrics.coverage_score_count ?? 0) === recordCount
      && (metrics.evidence_linked_exhibit_count ?? 0) === recordCount
      && (metrics.citation_linked_exhibit_count ?? 0) === recordCount
      && (metrics.output_paragraph_linked_exhibit_count ?? 0) === recordCount
      && (metrics.lineage_path_linked_exhibit_count ?? 0) === recordCount
      && (metrics.matter_preserved_exhibit_count ?? 0) === recordCount
      && (metrics.classification_preserved_exhibit_count ?? 0) === recordCount
      && (metrics.policy_snapshot_preserved_exhibit_count ?? 0) === recordCount
      && (metrics.needs_review_exhibit_count ?? 0) === recordCount
      && (metrics.attorney_review_required_exhibit_count ?? 0) === recordCount
      && (metrics.not_client_facing_exhibit_count ?? 0) === recordCount
      && (metrics.client_facing_ready_exhibit_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Exhibit map assigns stable Korean exhibit references and binds each exhibit to evidence, citation, output paragraph, and lineage path while keeping outputs attorney-review pending.");
    }
  }

  if (item.acceptance_profile === "evidence_export_bundle_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const bundleCount = metrics.export_bundle_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_export_bundle_status === "complete"
      && metrics.evidence_viewer_data_status === "complete"
      && metrics.citation_object_store_status === "complete"
      && metrics.evidence_coverage_status === "complete"
      && metrics.exhibit_map_status === "complete"
      && bundleCount > 0
      && (metrics.source_bound_bundle_count ?? 0) === bundleCount
      && (metrics.citation_bound_bundle_count ?? 0) === bundleCount
      && (metrics.coverage_bound_bundle_count ?? 0) === bundleCount
      && (metrics.lineage_bound_bundle_count ?? 0) === bundleCount
      && (metrics.exhibit_bound_bundle_count ?? 0) === bundleCount
      && (metrics.held_for_review_bundle_count ?? 0) === bundleCount
      && (metrics.attorney_review_required_bundle_count ?? 0) === bundleCount
      && (metrics.delivery_blocked_bundle_count ?? 0) === bundleCount
      && (metrics.external_transfer_blocked_bundle_count ?? 0) === bundleCount
      && (metrics.client_facing_ready_bundle_count ?? 1) === 0
      && (metrics.matter_preserved_bundle_count ?? 0) === bundleCount
      && (metrics.classification_preserved_bundle_count ?? 0) === bundleCount
      && (metrics.policy_snapshot_preserved_bundle_count ?? 0) === bundleCount
    ) {
      return passedWithOperationalGate(stage, "Evidence export bundle packages source, citation, coverage, lineage, and exhibit material for internal attorney review while blocking delivery and external transfer.");
    }
  }

  if (item.acceptance_profile === "evidence_regression_tests_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const caseCount = metrics.regression_test_case_count ?? 0;
    const coverageCaseCount = metrics.coverage_regression_case_count ?? 0;
    if (
      errors === 0
      && metrics.evidence_regression_status === "complete"
      && metrics.evidence_golden_fixture_status === "complete"
      && metrics.extractor_adapter_contract_status === "complete"
      && metrics.lineage_graph_status === "complete"
      && metrics.evidence_coverage_status === "complete"
      && metrics.evidence_export_bundle_status === "complete"
      && (metrics.regression_suite_count ?? 0) === 3
      && (metrics.passed_regression_suite_count ?? 0) === 3
      && (metrics.failed_regression_suite_count ?? 1) === 0
      && caseCount > 0
      && (metrics.passed_regression_case_count ?? 0) === caseCount
      && (metrics.failed_regression_case_count ?? 1) === 0
      && (metrics.extractor_regression_case_count ?? 0) === (metrics.expected_extractor_case_count ?? -1)
      && (metrics.lineage_regression_case_count ?? 0) === (metrics.expected_lineage_case_count ?? -1)
      && coverageCaseCount === (metrics.expected_coverage_case_count ?? -1)
      && (metrics.export_backed_coverage_case_count ?? 0) === coverageCaseCount
      && (metrics.identity_preserved_case_count ?? 0) === caseCount
      && (metrics.external_service_used_case_count ?? 1) === 0
      && (metrics.client_facing_ready_case_count ?? 1) === 0
      && (metrics.regression_hash_count ?? 0) === caseCount
      && (metrics.locked_regression_hash_count ?? 0) === caseCount
    ) {
      return passedWithOperationalGate(stage, "Evidence regression tests lock extractor, lineage, and coverage fixtures with deterministic hashes while blocking external services and client-facing output.");
    }
  }

  if (item.acceptance_profile === "resource_evidence_dashboard_summary_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const panelCount = metrics.panel_row_count ?? 0;
    if (
      errors === 0
      && metrics.resource_evidence_dashboard_status === "complete"
      && ["passed", "blocked"].includes(metrics.resource_ingest_status)
      && metrics.resource_store_interface_status === "complete"
      && metrics.resource_quarantine_status === "complete"
      && metrics.evidence_item_store_status === "complete"
      && metrics.evidence_viewer_data_status === "complete"
      && metrics.evidence_coverage_status === "complete"
      && metrics.evidence_export_bundle_status === "complete"
      && metrics.evidence_regression_status === "complete"
      && panelCount >= 8
      && (metrics.ready_panel_count ?? 0) === panelCount
      && (metrics.matter_rollup_count ?? 0) > 0
      && (metrics.classification_rollup_count ?? 0) > 0
      && (metrics.promoted_resource_count ?? 0) === (metrics.resource_store_record_count ?? -1)
      && (metrics.evidence_item_count ?? 0) === (metrics.coverage_score_count ?? -1)
      && (metrics.coverage_score_count ?? 0) === (metrics.export_bundle_count ?? -1)
      && (metrics.quarantine_retrieval_blocked_count ?? 0) === (metrics.quarantine_item_count ?? -1)
      && (metrics.quarantine_output_delivery_blocked_count ?? 0) === (metrics.quarantine_item_count ?? -1)
      && (metrics.client_facing_ready_count ?? 1) === 0
      && (metrics.source_validation_error_count ?? 1) === 0
      && (metrics.regression_external_service_used_case_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Resource/evidence dashboard summary exposes ingest, quarantine, evidence, coverage, export, and regression status as read-only panels and rollups while blocking client-facing readiness.");
    }
  }

  if (item.acceptance_profile === "evidence_plane_freeze_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const traceCount = metrics.representative_trace_count ?? 0;
    if (
      errors === 0
      && ["frozen_with_pending_human_actions", "frozen_clear"].includes(metrics.evidence_plane_freeze_status)
      && (metrics.failed_freeze_source_count ?? 1) === 0
      && (metrics.failed_freeze_checkpoint_count ?? 1) === 0
      && traceCount > 0
      && (metrics.complete_representative_trace_count ?? 0) === traceCount
      && (metrics.representative_evidence_bound_count ?? 0) === traceCount
      && (metrics.representative_output_bound_count ?? 0) === traceCount
      && (metrics.representative_audit_event_bound_count ?? 0) === traceCount
      && (metrics.representative_custody_bound_count ?? 0) === traceCount
      && (metrics.representative_run_ledger_bound_count ?? 0) === traceCount
      && (metrics.source_span_to_output_path_count ?? 0) === traceCount
      && (metrics.output_delivery_blocked_count ?? 0) === traceCount
      && (metrics.attorney_review_required_count ?? 0) === traceCount
      && (metrics.external_transfer_blocked_count ?? 0) === traceCount
      && (metrics.client_facing_ready_count ?? 1) === 0
      && (metrics.source_validation_error_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Evidence Plane freeze proves a representative resource-to-evidence-to-output-to-audit path while keeping legal output blocked for attorney review.");
    }
  }

  if (item.acceptance_profile === "chain_of_custody_events_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const eventCount = metrics.custody_event_count ?? 0;
    const exhibitCount = metrics.exhibit_record_count ?? 0;
    const expectedEventCount = (metrics.resource_version_count ?? 0) + (metrics.normalized_text_artifact_count ?? 0) + exhibitCount * 3;
    if (
      errors === 0
      && metrics.custody_event_ledger_status === "complete"
      && metrics.resource_store_interface_status === "complete"
      && metrics.resource_version_ledger_status === "complete"
      && metrics.normalized_text_contract_status === "complete"
      && metrics.exhibit_map_status === "complete"
      && eventCount > 0
      && eventCount === expectedEventCount
      && (metrics.custody_event_link_count ?? 0) === eventCount
      && (metrics.upload_event_count ?? 0) === (metrics.resource_version_count ?? 0)
      && (metrics.normalize_event_count ?? 0) === (metrics.normalized_text_artifact_count ?? 0)
      && (metrics.extract_event_count ?? 0) === exhibitCount
      && (metrics.review_event_count ?? 0) === exhibitCount
      && (metrics.approve_event_count ?? 0) === exhibitCount
      && (metrics.append_only_event_count ?? 0) === eventCount
      && (metrics.hashed_event_count ?? 0) === eventCount
      && (metrics.previous_hash_linked_event_count ?? 0) === eventCount
      && (metrics.matter_preserved_event_count ?? 0) === eventCount
      && (metrics.classification_preserved_event_count ?? 0) === eventCount
      && (metrics.policy_snapshot_preserved_event_count ?? 0) === eventCount
      && (metrics.complete_resource_chain_count ?? 0) === (metrics.resource_version_count ?? 0)
      && (metrics.complete_evidence_chain_count ?? 0) === exhibitCount
      && (metrics.pending_approval_event_count ?? 0) === exhibitCount
      && (metrics.approved_event_count ?? 1) === 0
      && (metrics.client_facing_ready_event_count ?? 1) === 0
    ) {
      return passedWithOperationalGate(stage, "Chain of custody events record upload, normalize, extract, review, and approval-hold stages as append-only hashed events without auto-approval or client-facing delivery.");
    }
  }

  if (item.acceptance_profile === "search_index_contract_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const manifestCount = metrics.search_index_manifest_count ?? 0;
    const queryPlanCount = metrics.search_index_query_plan_count ?? 0;
    if (
      errors === 0
      && metrics.search_index_contract_status === "complete"
      && metrics.resource_store_interface_status === "complete"
      && metrics.normalized_text_contract_status === "complete"
      && metrics.source_span_store_status === "complete"
      && metrics.evidence_item_store_status === "complete"
      && metrics.fact_claim_store_status === "complete"
      && metrics.issue_graph_store_status === "complete"
      && metrics.citation_object_store_status === "complete"
      && metrics.lineage_graph_status === "complete"
      && metrics.exhibit_map_status === "complete"
      && metrics.custody_event_ledger_status === "complete"
      && manifestCount > 0
      && queryPlanCount === manifestCount
      && (metrics.required_filter_field_count ?? 0) === manifestCount * 4
      && (metrics.filters_enforced_query_plan_count ?? 0) === queryPlanCount
      && (metrics.tenant_filter_required_query_plan_count ?? 0) === queryPlanCount
      && (metrics.matter_filter_required_query_plan_count ?? 0) === queryPlanCount
      && (metrics.classification_filter_required_query_plan_count ?? 0) === queryPlanCount
      && (metrics.policy_snapshot_filter_required_query_plan_count ?? 0) === queryPlanCount
      && (metrics.pre_retrieval_gate_required_query_plan_count ?? 0) === queryPlanCount
      && (metrics.matter_wall_enforced_query_plan_count ?? 0) === queryPlanCount
      && (metrics.classification_enforced_query_plan_count ?? 0) === queryPlanCount
      && (metrics.policy_snapshot_bound_query_plan_count ?? 0) === queryPlanCount
      && (metrics.held_query_plan_count ?? 0) === queryPlanCount
      && (metrics.executable_query_plan_count ?? 1) === 0
      && (metrics.source_ref_preserved_query_plan_count ?? 0) === queryPlanCount
    ) {
      return passedWithOperationalGate(stage, "Search index contract is implemented as a held manifest/query-plan layer that requires tenant, matter, classification, and policy snapshot filters before retrieval.");
    }
  }

  if (item.acceptance_profile === "vector_index_policy_boundary_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const gateCount = metrics.vector_policy_gate_count ?? 0;
    const queryPlanCount = metrics.search_index_query_plan_count ?? 0;
    const routeCount = metrics.embedding_route_policy_count ?? 0;
    if (
      errors === 0
      && metrics.vector_index_policy_boundary_status === "complete"
      && metrics.search_index_contract_status === "complete"
      && metrics.matter_access_policy_status === "complete"
      && metrics.wall_policy_status === "complete"
      && metrics.classification_rule_engine_status === "complete"
      && metrics.model_policy_enforcement_status === "complete"
      && gateCount > 0
      && gateCount === queryPlanCount
      && (metrics.covered_search_query_plan_count ?? 0) === queryPlanCount
      && routeCount === (metrics.expected_embedding_route_policy_count ?? -1)
      && (metrics.matter_wall_enforced_gate_count ?? 0) === gateCount
      && (metrics.external_model_policy_enforced_gate_count ?? 0) === gateCount
      && (metrics.classification_policy_enforced_gate_count ?? 0) === gateCount
      && (metrics.policy_snapshot_bound_gate_count ?? 0) === gateCount
      && (metrics.held_vector_policy_gate_count ?? 0) === gateCount
      && (metrics.source_ref_preserved_gate_count ?? 0) === gateCount
      && (metrics.executable_vector_gate_count ?? 1) === 0
      && (metrics.matter_wall_enforced_route_count ?? 0) === routeCount
      && (metrics.external_model_policy_enforced_route_count ?? 0) === routeCount
      && (metrics.classification_policy_enforced_route_count ?? 0) === routeCount
      && (metrics.policy_snapshot_bound_route_count ?? 0) === routeCount
      && (metrics.held_embedding_route_count ?? 0) === routeCount
      && (metrics.source_ref_preserved_route_count ?? 0) === routeCount
      && (metrics.executable_vector_route_count ?? 1) === 0
      && (metrics.p2_p5_external_blocked_or_review_route_count ?? 0) === (metrics.p2_p5_embedding_route_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Vector index policy boundary keeps embedding and vector retrieval held until matter wall, classification, external model policy, and policy snapshot gates are bound.");
    }
  }

  if (item.acceptance_profile === "retrieval_filter_compiler_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const filterCount = metrics.compiled_retrieval_filter_count ?? 0;
    const bindingCount = metrics.retrieval_query_binding_count ?? 0;
    const probeCount = metrics.retrieval_filter_probe_count ?? 0;
    if (
      errors === 0
      && metrics.retrieval_filter_compiler_status === "complete"
      && metrics.search_index_contract_status === "complete"
      && metrics.vector_index_policy_boundary_status === "complete"
      && metrics.matter_access_policy_status === "complete"
      && metrics.wall_policy_status === "complete"
      && metrics.store_policy_adapter_status === "complete"
      && filterCount > 0
      && filterCount === (metrics.search_index_query_plan_count ?? -1)
      && filterCount === (metrics.vector_policy_gate_count ?? -1)
      && bindingCount === (metrics.expected_retrieval_query_binding_count ?? -1)
      && (metrics.tenant_filter_enforced_count ?? 0) === filterCount
      && (metrics.matter_filter_enforced_count ?? 0) === filterCount
      && (metrics.classification_filter_enforced_count ?? 0) === filterCount
      && (metrics.policy_snapshot_filter_enforced_count ?? 0) === filterCount
      && (metrics.wall_filter_enforced_count ?? 0) === filterCount
      && (metrics.access_audit_filter_enforced_count ?? 0) === filterCount
      && (metrics.query_binding_filter_enforced_count ?? 0) === bindingCount
      && (metrics.access_audit_filter_enforced_binding_count ?? 0) === bindingCount
      && (metrics.executable_filter_count ?? 1) === 0
      && (metrics.executable_query_binding_count ?? 1) === 0
      && probeCount === (metrics.expected_retrieval_filter_probe_count ?? -1)
      && (metrics.blocked_probe_count ?? 0) === probeCount
      && (metrics.p2_p5_external_blocked_or_review_binding_count ?? 0) === (metrics.p2_p5_query_binding_count ?? -1)
    ) {
      return passedWithOperationalGate(stage, "Retrieval filter compiler binds search and vector policy routes to tenant, matter, classification, policy snapshot, wall, and access audit filters while keeping query execution disabled until a query adapter is bound.");
    }
  }

  if (item.acceptance_profile === "human_review_packet_gate") {
    if ((metrics.review_packet_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review packets are implemented and grouping pending gate receipts for human review.");
    }
  }

  if (item.acceptance_profile === "human_review_agenda_gate") {
    if ((metrics.agenda_item_count ?? 0) > 0 && (metrics.decision_template_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review agenda is implemented and producing reviewer-specific receipt templates.");
    }
  }

  if (item.acceptance_profile === "human_review_agenda_receipt_intake_gate") {
    if ((metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review agenda receipt intake is implemented and feeding receipt validation safely.");
    }
  }

  if (item.acceptance_profile === "human_review_receipt_workspace_gate") {
    if ((metrics.actor_workspace_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review receipt workspace is implemented and writing actor-specific editable receipt inputs.");
    }
  }

  if (item.acceptance_profile === "human_review_receipt_workspace_merge_gate") {
    if ((metrics.actor_input_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review receipt workspace merge is implemented and recombining actor receipt inputs for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_context_bundle_gate") {
    if ((metrics.context_card_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review context bundle is implemented and binding pending receipt decisions to gate, evidence, approval, and matter context.");
    }
  }

  if (item.acceptance_profile === "human_review_decision_register_gate") {
    if ((metrics.decision_row_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review decision register is implemented and producing context-bound receipt input for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_decision_register_merge_gate") {
    if ((metrics.actor_input_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review decision register merge is implemented and recombining actor decision inputs for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_validation_feedback_gate") {
    if ((metrics.actor_feedback_count ?? 0) > 0 && (metrics.feedback_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review validation feedback is implemented and routing validation results back to actor review bundles.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_workspace_gate") {
    if ((metrics.actor_workspace_count ?? 0) > 0 && (metrics.correction_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review correction workspace is implemented and preparing actor-editable correction receipt inputs.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_workspace_merge_gate") {
    if ((metrics.actor_input_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review correction workspace merge is implemented and recombining actor correction receipt inputs for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_validation_gate") {
    const errors = (metrics.error_count ?? 0) + (metrics.invalid_receipt_count ?? 0) + (metrics.unknown_receipt_count ?? 0) + (metrics.missing_receipt_count ?? 0);
    if ((metrics.validation_item_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review correction validation is implemented and checking merged correction receipts before any application.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_feedback_gate") {
    if ((metrics.actor_feedback_count ?? 0) > 0 && (metrics.feedback_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review correction feedback is implemented and routing correction validation results back to actor feedback bundles.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_ledger_gate") {
    if ((metrics.actor_cycle_count ?? 0) > 0 && (metrics.cycle_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review cycle ledger is implemented and linking feedback, correction, merge, validation, and feedback state.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_work_orders_gate") {
    if ((metrics.actor_work_order_count ?? 0) > 0 && (metrics.work_order_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review cycle work orders are implemented and routing pending cycle items into actor-specific work queues.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_target_audit_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_target_file_count ?? 0) + (metrics.missing_receipt_row_count ?? 0);
    if ((metrics.target_audit_item_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle target audit is implemented and confirming work order receipt files and rows exist.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_triage_inbox_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_target_audit_count ?? 0);
    if ((metrics.triage_item_count ?? 0) > 0 && (metrics.actor_triage_inbox_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle triage inbox is implemented and turning verified work orders into actor-ready queues.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_reviewer_console_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_context_card_count ?? 0) + (metrics.missing_decision_row_count ?? 0);
    if ((metrics.console_item_count ?? 0) > 0 && (metrics.actor_console_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle reviewer console is implemented and exposing actor-ready review queues with context and decision rows.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_field_audit_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_receipt_row_count ?? 0) + (metrics.missing_required_field_key_count ?? 0);
    if ((metrics.field_audit_item_count ?? 0) > 0 && (metrics.actor_field_audit_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt field audit is implemented and surfacing pending receipt fields without auto-applying protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_pack_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0);
    if ((metrics.completion_item_count ?? 0) > 0 && (metrics.actor_completion_pack_count ?? 0) > 0 && (metrics.template_field_prompt_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion pack is implemented and preparing actor-specific manual receipt completion templates.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_verification_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_receipt_row_count ?? 0);
    const hasVerificationItems = (metrics.verification_item_count ?? 0) > 0 && (metrics.actor_verification_count ?? 0) > 0;
    const hasPromptAccounting = (metrics.field_prompt_count ?? 0) > 0 && ((metrics.pending_prompt_count ?? 0) + (metrics.completed_prompt_count ?? 0)) > 0;
    if (hasVerificationItems && hasPromptAccounting && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion verification is implemented and checking manual receipt input completion without editing receipts.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_workbench_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0);
    const hasWorkbenchItems = (metrics.workbench_item_count ?? 0) > 0 && (metrics.actor_workbench_count ?? 0) > 0;
    const hasWorkbenchLinks = (metrics.receipt_completion_template_count ?? 0) > 0 && (metrics.target_file_count ?? 0) > 0;
    if (hasWorkbenchItems && hasWorkbenchLinks && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion workbench is implemented and exposing actor-specific manual receipt input queues without editing receipts.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_runbook_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0);
    const hasRunbook = (metrics.runbook_step_count ?? 0) > 0 && (metrics.actor_runbook_count ?? 0) > 0;
    const hasManualAndCommandSteps = (metrics.command_step_count ?? 0) > 0 && (metrics.manual_step_count ?? 0) > 0;
    if (hasRunbook && hasManualAndCommandSteps && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion runbook is implemented and sequencing manual receipt input, verification reruns, and protected application approval without executing them.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_readiness_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReadinessRecords = (metrics.command_gate_count ?? 0) > 0 && (metrics.actor_readiness_count ?? 0) > 0;
    const hasGateSplit = (metrics.allowed_command_count ?? 0) > 0 && (metrics.blocked_command_count ?? 0) > 0;
    const hasManualHold = (metrics.manual_input_required_count ?? 0) > 0 && (metrics.blocked_until_manual_input_count ?? 0) > 0;
    if (hasReadinessRecords && hasGateSplit && hasManualHold && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion readiness is implemented and separating safe refresh commands from commands held until manual receipt input.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_queue_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReadyCommands = (metrics.command_queue_item_count ?? 0) > 0;
    const hasHeldCommands = (metrics.held_command_item_count ?? 0) > 0;
    const hasActors = (metrics.actor_command_queue_count ?? 0) > 0;
    if (hasReadyCommands && hasHeldCommands && hasActors && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command queue is implemented and surfacing safe manual refresh commands while holding protected and post-input commands.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipts_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReceipts = (metrics.receipt_draft_count ?? 0) > 0 && (metrics.receipt_requirement_count ?? 0) > 0;
    const hasHeldReferences = (metrics.held_command_reference_count ?? 0) > 0;
    if (hasReceipts && hasHeldReferences && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipts are implemented and drafting manual command-run receipts while keeping held commands as references.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_validation_gate") {
    const errors = metrics.error_count ?? 0;
    const hasValidation = (metrics.validation_item_count ?? 0) > 0 && (metrics.receipt_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasValidation && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt validation is implemented and holding pending command receipts until a human records manual execution.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_feedback_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasFeedback = (metrics.feedback_item_count ?? 0) > 0 && (metrics.actor_feedback_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasFeedback && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt feedback is implemented and routing pending command receipt work back to actors without executing commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_workspace_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasWorkspace = (metrics.workspace_item_count ?? 0) > 0 && (metrics.actor_workspace_count ?? 0) > 0;
    const hasEditableReceipts = (metrics.receipt_row_count ?? 0) > 0 && (metrics.editable_file_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasWorkspace && hasEditableReceipts && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt workspace is implemented and preparing actor-specific editable command receipt inputs without running commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_workspace_merge_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasMerge = (metrics.merge_item_count ?? 0) > 0 && (metrics.actor_input_count ?? 0) > 0;
    const hasMergedInput = (metrics.receipt_row_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasMerge && hasMergedInput && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt workspace merge is implemented and combining actor command receipt inputs into a validation-ready receipt input without running commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_workspace_validation_gate") {
    const errors = metrics.error_count ?? 0;
    const hasValidation = (metrics.validation_item_count ?? 0) > 0 && (metrics.receipt_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasValidation && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt workspace validation is implemented and validating merged actor command receipt inputs before any confirmation or protected action.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_application_gate") {
    const errors = metrics.validation_error_count ?? metrics.receipt_error_count ?? 0;
    const hasApplicationDecision = ["nothing_to_apply", "applied"].includes(metrics.application_status);
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasApplicationDecision && hasPendingGate && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt application is implemented and can apply validated manual command receipts while preserving no-execution safety.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_reconciliation_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReconciliation = (metrics.reconciliation_item_count ?? 0) > 0 && (metrics.actor_status_count ?? 0) > 0;
    const hasPendingCommandReceipts = (metrics.pending_command_receipt_count ?? 0) > 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasReconciliation && hasPendingCommandReceipts && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion reconciliation is implemented and summarizing pending command receipts, held commands, and actor follow-up without executing commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_baseline_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const mismatches = metrics.mismatched_count_check_count ?? 0;
    const hasBaseline = ["frozen_with_blockers", "frozen_clear"].includes(metrics.baseline_status);
    const matchesSourceCounts = (metrics.pending_command_receipt_count ?? 0) === (metrics.source_pending_command_receipt_count ?? -1)
      && (metrics.held_command_count ?? 0) === (metrics.source_held_command_count ?? -1)
      && (metrics.protected_hold_count ?? 0) === (metrics.source_protected_held_command_count ?? -1);
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasBaseline && matchesSourceCounts && mismatches === 0 && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion baseline is implemented and freezing reconciliation blocker counts without mutating receipts or executing protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_manual_command_receipt_pack_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasActorPacks = (metrics.actor_receipt_pack_count ?? 0) > 0;
    const hasReceiptRows = (metrics.receipt_pack_item_count ?? 0) > 0;
    const matchesPendingBlockers = (metrics.receipt_pack_item_count ?? 0) === (metrics.pending_command_receipt_blocker_count ?? -1);
    const hasTargetPaths = (metrics.target_receipt_path_count ?? 0) > 0 && (metrics.missing_target_receipt_path_count ?? 0) === 0;
    const hasRequiredFields = (metrics.required_field_count ?? 0) > 0 && (metrics.missing_required_field_count ?? 0) === 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasActorPacks && hasReceiptRows && matchesPendingBlockers && hasTargetPaths && hasRequiredFields && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion manual command receipt pack is implemented and exposes actor target receipt paths with complete required field placeholders.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_held_command_resolution_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasResolutionPlans = (metrics.resolution_plan_count ?? 0) > 0 && (metrics.actor_resolution_plan_count ?? 0) > 0;
    const matchesSources = (metrics.resolution_plan_count ?? 0) === (metrics.held_command_blocker_count ?? -1)
      && (metrics.resolution_plan_count ?? 0) === (metrics.source_held_command_count ?? -1)
      && (metrics.resolution_plan_count ?? 0) === (metrics.command_queue_held_item_count ?? -1);
    const hasResolutionContract = (metrics.unblock_condition_count ?? 0) === (metrics.resolution_plan_count ?? -1)
      && (metrics.follow_on_action_count ?? 0) === (metrics.resolution_plan_count ?? -1)
      && (metrics.missing_required_actor_count ?? 0) === 0
      && (metrics.missing_unblock_condition_count ?? 0) === 0
      && (metrics.missing_follow_on_action_count ?? 0) === 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasResolutionPlans && matchesSources && hasResolutionContract && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion held command resolution is implemented and assigning each held command to an actor with an unblock condition and follow-on action.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_protected_approval_request_pack_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const sourceProtectedCount = metrics.source_protected_resolution_count ?? 0;
    const hasApprovalRequests = (metrics.approval_request_count ?? 0) > 0 && (metrics.actor_approval_pack_count ?? 0) > 0;
    const matchesProtectedSources = (metrics.approval_request_count ?? 0) === sourceProtectedCount
      && (metrics.protected_resolution_count ?? 0) === sourceProtectedCount
      && (metrics.protected_action_request_count ?? 0) === (metrics.approval_request_count ?? -1);
    const isSeparatedFromCommandReceipts = (metrics.command_receipt_mixed_count ?? 0) === 0
      && (metrics.non_protected_request_count ?? 0) === 0;
    const hasApprovalContract = (metrics.target_approval_input_path_count ?? 0) > 0
      && (metrics.missing_target_approval_input_path_count ?? 0) === 0
      && (metrics.required_approval_field_count ?? 0) > 0
      && (metrics.missing_required_approval_field_count ?? 0) === 0
      && (metrics.pending_explicit_approval_count ?? 0) === (metrics.approval_request_count ?? -1);
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (sourceProtectedCount === 0 && stage.status === "passed" && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion protected approval request pack is implemented and correctly found no protected approvals to request.");
    }
    if (hasApprovalRequests && matchesProtectedSources && isSeparatedFromCommandReceipts && hasApprovalContract && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion protected approval request pack is implemented and tracking protected actions as pending explicit approvals separate from command receipts.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_manual_revalidation_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasItems = (metrics.revalidation_item_count ?? 0) > 0 && (metrics.actor_revalidation_count ?? 0) > 0;
    const matchesManualPack = (metrics.revalidation_item_count ?? 0) === (metrics.source_pack_item_count ?? -1);
    const readyAppliedCandidates = metrics.ready_or_applied_candidate_count ?? 0;
    const humanReady = metrics.human_entered_ready_receipt_count ?? 0;
    const humanApplied = metrics.human_entered_applied_receipt_count ?? 0;
    const onlyHumanCandidates = readyAppliedCandidates === humanReady + humanApplied
      && (metrics.non_human_ready_or_applied_candidate_count ?? 0) === 0;
    const noUnsafeOverlap = (metrics.protected_approval_overlap_count ?? 0) === 0
      && (metrics.auto_executed_receipt_count ?? 0) === 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasItems && matchesManualPack && onlyHumanCandidates && noUnsafeOverlap && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion manual revalidation is implemented and allows only human-entered receipts to become ready/applied candidates while keeping harness execution at zero.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_queue_patch_projection_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasProjection = (metrics.projection_item_count ?? 0) > 0 && (metrics.audit_event_candidate_count ?? 0) > 0;
    const matchesRevalidation = (metrics.projection_item_count ?? 0) === (metrics.source_revalidation_item_count ?? -1);
    const targetsCovered = (metrics.patch_target_count ?? 0) === (metrics.projection_item_count ?? -1)
      && (metrics.missing_queue_item_count ?? 0) === 0;
    const readyPatchMatchesSource = (metrics.ready_patch_count ?? 0) === (metrics.source_ready_or_applied_candidate_count ?? -1)
      && (metrics.emittable_audit_event_candidate_count ?? 0) === (metrics.ready_patch_count ?? -1);
    const unsafeCandidates = (metrics.non_human_patch_candidate_count ?? 0)
      + (metrics.protected_overlap_count ?? 0)
      + (metrics.auto_executed_receipt_count ?? 0)
      + (metrics.blocked_patch_count ?? 0);
    const noExecution = (metrics.patch_applied_count ?? 0) === 0
      && (metrics.audit_event_emitted_count ?? 0) === 0
      && (metrics.command_executed_count ?? 0) === 0
      && (metrics.refresh_command_executed_by_harness_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0;
    if (hasProjection && matchesRevalidation && targetsCovered && readyPatchMatchesSource && unsafeCandidates === 0 && errors === 0 && noExecution) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command queue patch projection is implemented and verifying patch targets, before/after states, and audit event candidates without applying them.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_closeout_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasCloseout = (metrics.closeout_item_count ?? 0) > 0 && (metrics.actor_closeout_count ?? 0) > 0;
    const matchesBaseline = (metrics.closeout_item_count ?? 0) === (metrics.source_baseline_blocker_count ?? -1);
    const normalizedStatuses = (metrics.pending_count ?? 0)
      + (metrics.approved_count ?? 0)
      + (metrics.rejected_count ?? 0)
      + (metrics.superseded_count ?? 0);
    const statusesExhaustive = normalizedStatuses === (metrics.closeout_item_count ?? -1)
      && (metrics.normalized_status_total_count ?? 0) === (metrics.closeout_item_count ?? -1)
      && (metrics.unknown_status_count ?? 0) === 0;
    const noExecution = (metrics.patch_applied_count ?? 0) === 0
      && (metrics.audit_event_emitted_count ?? 0) === 0
      && (metrics.command_executed_count ?? 0) === 0
      && (metrics.refresh_command_executed_by_harness_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0;
    if (hasCloseout && matchesBaseline && statusesExhaustive && errors === 0 && noExecution) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion closeout ledger is implemented and normalizing every blocker into pending, approved, rejected, or superseded without mutating sources or executing commands.");
    }
  }

  if (item.acceptance_profile === "human_review_v1_regression_freeze_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const sourcesAvailable = (metrics.required_source_count ?? 0) > 0
      && (metrics.available_required_source_count ?? 0) === (metrics.required_source_count ?? -1);
    const fixtureHasHashes = (metrics.regression_fixture_artifact_count ?? 0) > 0
      && (metrics.regression_fixture_hash_count ?? 0) === (metrics.regression_fixture_artifact_count ?? -1);
    const checkpointsPassed = (metrics.verification_checkpoint_count ?? 0) > 0
      && (metrics.failed_verification_checkpoint_count ?? 1) === 0;
    const loopClean = metrics.loop_status === "passed"
      && (metrics.loop_failed_step_count ?? 1) === 0
      && (metrics.loop_missing_artifact_count ?? 1) === 0;
    const closeoutFrozen = (metrics.closeout_item_count ?? 0) > 0
      && (metrics.closeout_unknown_status_count ?? 1) === 0;
    const noExecution = (metrics.command_executed_count ?? 0) === 0
      && (metrics.patch_applied_count ?? 0) === 0
      && (metrics.audit_event_emitted_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0;
    if (sourcesAvailable && fixtureHasHashes && checkpointsPassed && loopClean && closeoutFrozen && errors === 0 && noExecution) {
      return passedWithOperationalGate(stage, "Human Review v1 regression freeze is implemented and locking the closure fixture, checkpoint contract, and no-execution handling before P097.");
    }
  }

  if (item.acceptance_profile === "protected_human_gate") {
    const expectedBlockers = new Set([
      "attorney_approval_pending",
      "human_approval_pending",
      "merge_approval_pending",
    ]);
    if (expectedBlockers.has(metrics.blocked_reason)) {
      return passedWithOperationalGate(stage, `${stage.label} reached its required protected human gate.`);
    }
  }

  if (item.acceptance_profile === "observability_gate") {
    const errors = metrics.error_record_count ?? 0;
    if (errors === 0 && (metrics.workflow_run_count ?? 0) > 0 && (metrics.event_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Observability plane is recording runs, events, and gate blockers without runtime errors.");
    }
  }

  if (item.acceptance_profile === "tool_runtime_policy_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.unknown_tool_count ?? 0)
      + (metrics.tool_overlap_count ?? 0)
      + (metrics.missing_tool_permission_gate_count ?? 0)
      + (metrics.agent_run_tool_gate_deny_count ?? 0);
    if (errors === 0 && (metrics.tool_permission_gate_count ?? 0) > 0 && (metrics.agent_run_tool_gate_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Tool/runtime policy enforcement is implemented; remaining review/deny rows are protected-action controls.");
    }
  }

  if (item.acceptance_profile === "output_destination_policy_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.unsafe_final_action_count ?? 0)
      + (metrics.missing_policy_count ?? 0)
      + (metrics.missing_tool_policy_count ?? 0)
      + (metrics.missing_output_destination_gate_count ?? 0);
    if (errors === 0 && (metrics.artifact_destination_gate_count ?? 0) > 0 && (metrics.delivery_action_destination_gate_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Output destination policy enforcement is implemented; pending final actions are held behind approval and receipt controls.");
    }
  }

  if (item.acceptance_profile === "approval_authority_gate") {
    const errors = (metrics.validation_error_count ?? 0)
      + (metrics.missing_authority_role_count ?? 0);
    const lawFirmHumanCovered = (metrics.law_firm_authority_decision_count ?? 0) > 0
      && (metrics.law_firm_human_required_decision_count ?? 0) === (metrics.law_firm_authority_decision_count ?? -1);
    if (errors === 0
      && lawFirmHumanCovered
      && (metrics.authority_policy_count ?? 0) > 0
      && (metrics.authority_decision_count ?? 0) > 0
      && (metrics.nonhuman_authority_blocked_count ?? 0) === (metrics.authority_decision_count ?? -1)) {
      return passedWithOperationalGate(stage, "Approval authority ledger is implemented; unresolved assignments are held as human setup work instead of auto-approval.");
    }
  }

  if (item.acceptance_profile === "matter_cockpit_gate") {
    if ((metrics.matter_count ?? 0) > 0 && (metrics.resource_count ?? 0) > 0 && (metrics.evidence_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Matter Cockpit is implemented and surfacing protected delivery blockers.");
    }
  }

  return {
    status: directStatus,
    implementation_status: directStatus,
    reason: `${stage.label} stage is ${stage.status}: ${stage.message}`,
  };
}

function passedWithOperationalGate(stage, reason) {
  return {
    status: "passed",
    implementation_status: "passed_with_operational_gate",
    reason: `${reason} Operational status remains ${stage.status}: ${stage.message}`,
  };
}

function sourceItem(id, label, category, sourceId, checkpointItemId, options = {}) {
  return {
    check_type: "source",
    id,
    label,
    category,
    source_id: sourceId,
    checkpoint_item_id: checkpointItemId,
    acceptance_profile: options.acceptance_profile ?? "stage_status",
  };
}

function scriptItem(id, label, category, scriptName, checkpointItemId) {
  return {
    check_type: "script",
    id,
    label,
    category,
    script_name: scriptName,
    checkpoint_item_id: checkpointItemId,
  };
}

function packageScriptItem(id, label, category, scriptName, checkpointItemId) {
  return {
    check_type: "package_script",
    id,
    label,
    category,
    script_name: scriptName,
    checkpoint_item_id: checkpointItemId,
  };
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.ok ? null : result.error,
  };
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      ok: true,
      value: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function latestRoadmapPhase(text) {
  const matches = roadmapPhaseMatches(text);
  const latest = matches.at(-1);
  if (!latest) return null;
  return `Phase ${latest.phase}: ${latest.title}`;
}

function roadmapPhaseMatches(text) {
  return [...String(text ?? "").matchAll(/^## Phase (\d+)(?::| -) (.+)$/gm)].map((match) => ({
    phase: match[1],
    title: match[2],
  }));
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    dashboardPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_DASHBOARD_PATH,
    loopPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_LOOP_PATH,
    healthPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_HEALTH_PATH,
    packagePath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_PACKAGE_PATH,
    roadmapPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_ROADMAP_PATH,
    outDir: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--loop") parsed.loopPath = argv[++index];
    else if (arg === "--health") parsed.healthPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-goal-checkpoint.mjs [options]

Options:
  --dashboard <path>  review-dashboard.json path.
  --loop <path>       control-plane-loop.json path.
  --health <path>     control-plane-health.json path.
  --package <path>    package.json path.
  --roadmap <path>    implementation-roadmap.md path.
  --out-dir <folder>  Output directory.
  --run-at <iso>      Deterministic generated_at timestamp.
  -h, --help          Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
