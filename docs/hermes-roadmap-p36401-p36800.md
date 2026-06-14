# Hermes P36401-P36800 Work OS Plan State Static UI Adapter

P36401-P36800 turns the P36400 API read model and UI smoke fixture metadata into static UI adapter candidates. It does not mount a live UI, fetch at runtime, persist state, submit forms, navigate routes, enable action buttons, write files, execute commands, deploy, approve, or claim production readiness.

| Range | Slice | Output |
| --- | --- | --- |
| P36401-P36440 | P36400 Source Binding | `p36400_source_binding_rows` |
| P36441-P36500 | Static UI Adapter Candidate | `static_ui_adapter_candidate_rows` |
| P36501-P36560 | Screen Slot Binding | `screen_slot_binding_rows` |
| P36561-P36620 | Static Shell Fixture | `static_shell_fixture_rows` |
| P36621-P36680 | Interaction Smoke Rows | `interaction_smoke_rows` |
| P36681-P36740 | No Live UI Mutation Boundary | `no_live_ui_mutation_boundary_rows` |
| P36741-P36800 | P36800 Clean Checkpoint | `p36800_clean_checkpoint_rows` |

## Contract

- Source: `artifacts/work-os-plan-state-api-read-model/latest/work-os-plan-state-api-read-model.json`
- Command: `npm run platform:work-os-plan-state-static-ui-adapter -- --check`
- Schema: `schemas/work-os-plan-state-static-ui-adapter.schema.json`
- Artifact root: `artifacts/work-os-plan-state-static-ui-adapter/latest`

## Boundary

`ready_for_work_os_static_ui_handoff=true` means Hermes can expose static UI adapter, screen slot, shell fixture, and interaction smoke metadata. It is not live UI mount, runtime fetch, form submit, route navigation, state persistence, event mutation, action authority, review completion, final approval, production PASS, or enterprise trust.

The following remain false:

- `work_os_static_ui_live_mount_allowed_now`
- `work_os_static_ui_runtime_fetch_allowed_now`
- `work_os_static_ui_event_handler_mutation_allowed_now`
- `work_os_static_ui_form_submit_allowed_now`
- `work_os_static_ui_state_persist_allowed_now`
- `work_os_static_ui_route_navigation_allowed_now`
- `work_os_static_ui_action_button_allowed_now`
- `work_os_static_ui_status_edit_allowed_now`
- `work_os_static_ui_write_api_allowed_now`
- `work_os_static_ui_runtime_execution_allowed_now`
- `work_os_static_ui_write_action_allowed_now`
- `work_os_static_ui_protected_action_allowed_now`
- `work_os_static_ui_final_approval_allowed_now`
- `work_os_static_ui_production_pass_allowed_now`
