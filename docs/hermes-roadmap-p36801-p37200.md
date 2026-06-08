# Hermes P36801-P37200 Work OS Plan State Static Bundle Handoff

P36801-P37200 turns the P36800 static UI adapter metadata into static bundle manifest, file plan, handoff package, and operator preview bundle candidates. It does not write generated files, apply generated files, persist artifacts, copy assets, overwrite shells, publish manifests, start preview servers, deploy, approve, or claim production readiness.

| Range | Slice | Output |
| --- | --- | --- |
| P36801-P36840 | P36800 Source Binding | `p36800_source_binding_rows` |
| P36841-P36900 | Static Bundle Manifest Candidate | `static_bundle_manifest_candidate_rows` |
| P36901-P36960 | Static Bundle File Plan Candidate | `static_bundle_file_plan_candidate_rows` |
| P36961-P37020 | Static Bundle Handoff Package | `static_bundle_handoff_package_rows` |
| P37021-P37080 | Operator Preview Bundle Rows | `operator_preview_bundle_rows` |
| P37081-P37140 | No Generated File Apply Boundary | `no_generated_file_apply_boundary_rows` |
| P37141-P37200 | P37200 Clean Checkpoint | `p37200_clean_checkpoint_rows` |

## Contract

- Source: `artifacts/work-os-plan-state-static-ui-adapter/latest/work-os-plan-state-static-ui-adapter.json`
- Command: `npm run platform:work-os-plan-state-static-bundle-handoff -- --check`
- Schema: `schemas/work-os-plan-state-static-bundle-handoff.schema.json`
- Artifact root: `artifacts/work-os-plan-state-static-bundle-handoff/latest`

## Boundary

`ready_for_work_os_preview_bundle_handoff=true` means Hermes can expose generated static bundle metadata for review. It is not generated file write, generated file apply, artifact persistence, asset copy, shell overwrite, manifest publish, preview server start, live mount, review completion, final approval, production PASS, or enterprise trust.

The following remain false:

- `work_os_static_bundle_file_write_allowed_now`
- `work_os_static_bundle_file_apply_allowed_now`
- `work_os_static_bundle_generated_file_apply_allowed_now`
- `work_os_static_bundle_artifact_persist_allowed_now`
- `work_os_static_bundle_asset_copy_allowed_now`
- `work_os_static_bundle_shell_overwrite_allowed_now`
- `work_os_static_bundle_manifest_publish_allowed_now`
- `work_os_static_bundle_preview_server_allowed_now`
- `work_os_static_bundle_live_mount_allowed_now`
- `work_os_static_bundle_operator_apply_button_allowed_now`
- `work_os_static_bundle_runtime_execution_allowed_now`
- `work_os_static_bundle_write_action_allowed_now`
- `work_os_static_bundle_protected_action_allowed_now`
- `work_os_static_bundle_final_approval_allowed_now`
- `work_os_static_bundle_production_pass_allowed_now`
