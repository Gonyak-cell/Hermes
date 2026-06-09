# Hermes Roadmap P61201-P61600

## P61201-P61600 Hermes Loop Run Ledger Projection

### Phase objective

P61200 agent-control schema family를 source로 받아 Phase B Loop Run Ledger Projection을 구현한다. Source event는 직접 실행이 아니라 Loop Run candidate row로 투영되고, workflow state transition, gate result binding, blocker, next allowed action, worker/verifier/model/budget ref가 같은 ledger projection에 묶인다.

### Source binding

- Primary source: `artifacts/hermes-loop-agent-control-contract/latest/hermes-loop-agent-control-contract.json`
- Rebuild fallback: P61200 agent-control contract를 source specification에서 in-memory로 재계산
- Source anchors: `8 Trigger 요구사항`, `4.2 State Mapping`, `7.2 HermesLoopRun`, `7.9 HermesLoopGateResult`, `14 Verification 요구사항`, `21.2 Phase B`

### Output rows

- `p61200_agent_control_source_rows`
- `source_event_to_loop_run_projection_rows`
- `workflow_state_transition_binding_rows`
- `gate_result_binding_rows`
- `blocker_next_action_projection_rows`
- `agent_ref_projection_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_run_ledger_wiring_rows`
- `p61600_closeout_rows`
- `p61601_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-run-ledger-projection.schema.json`
- Source module: `src/hermes-loop-run-ledger-projection.mjs`
- CLI script: `scripts/hermes-loop-run-ledger-projection.mjs`
- Test: `test/hermes-loop-run-ledger-projection.test.mjs`
- Package script: `platform:hermes-loop-run-ledger-projection`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P61200 agent-control source
- P61200 validation invalid
- missing trigger mapping
- missing state transition binding
- terminal alignment unchecked
- missing gate result binding
- missing blocker
- missing next allowed action
- missing worker/verifier ref
- missing model/budget ref
- authority carryover true
- missing P61601 handoff

### Validation commands

- `node --check src/hermes-loop-run-ledger-projection.mjs`
- `node --check scripts/hermes-loop-run-ledger-projection.mjs`
- `node --test test/hermes-loop-run-ledger-projection.test.mjs`
- `npm run platform:hermes-loop-run-ledger-projection -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-run-ledger-projection.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

Loop Run ledger projection is status computation only. Trigger rows, state rows, gate rows, blocker rows, and next action rows do not open runtime execution, command execution, write action, connector write, protected closeout, deployment, production PASS, enterprise PASS, Codex final approval, Claude final approval, or final automated approval.

### Closeout criteria

- P61200 source is valid and ready.
- Trigger to Loop Run projection rows pass.
- Workflow state transition rows pass.
- Gate result binding rows pass.
- Blocker and next allowed action rows pass.
- Worker/verifier/model/budget reference rows pass.
- Authority carryover rows remain false.
- Negative fixtures are complete.
- P61601 handoff points to Context and Memory Grounding.

### Next-phase handoff

`P61601-P62000` should implement Context and Memory Grounding: context bundle contract, citation/source span binding, memory operation candidate, stale/conflict/domain guard, and raw/full body non-exposure.
