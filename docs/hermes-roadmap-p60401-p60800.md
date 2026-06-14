# Hermes Roadmap P60401-P60800

## P60401-P60800 Hermes Loop Overlay Contract Projection

### Phase objective

P60400 source binding baseline을 소비해 `HermesLoopDefinition`, `HermesLoopRun`, `HermesLoopDAG`의 required field inventory와 기존 Hermes workflow/run/evidence/review/gate mapping을 row-level control-plane artifact로 고정한다. 이 tranche는 Phase A Loop Overlay Contract를 구체화하지만 runtime execution, write action, connector write, protected action, deployment, production PASS, enterprise PASS, Codex/Claude final approval은 열지 않는다.

### Source binding

- Primary source: `artifacts/hermes-loop-source-binding/latest/hermes-loop-source-binding.json`
- Rebuild fallback: `docs/hermes-loop-system-specification.md`에서 P60400 source binding을 in-memory로 재계산
- Source anchors: `3.2 Loop Definition`, `3.3 Loop Run`, `7.1 HermesLoopDefinition`, `7.2 HermesLoopRun`, `7.4 HermesLoopDAG`, `4.1 개념 매핑`, `4.2 State Mapping`, `4.3 Authority Mapping`

### Output rows

- `p60400_source_binding_rows`
- `loop_definition_schema_rows`
- `loop_run_schema_rows`
- `loop_dag_schema_rows`
- `existing_mapping_projection_rows`
- `state_mapping_projection_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_overlay_wiring_rows`
- `p60800_closeout_rows`
- `p60801_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-overlay-contract.schema.json`
- Source module: `src/hermes-loop-overlay-contract.mjs`
- CLI script: `scripts/hermes-loop-overlay-contract.mjs`
- Test: `test/hermes-loop-overlay-contract.test.mjs`
- Package script: `platform:hermes-loop-overlay-contract`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P60400 source binding
- P60400 validation invalid
- P60400 not ready for handoff
- missing LoopDefinition required field
- missing LoopRun required field
- missing LoopDAG required field
- missing existing concept mapping
- missing state mapping
- authority carryover true
- unbounded DAG cycle allowed
- missing P60801 handoff

### Validation commands

- `node --check src/hermes-loop-overlay-contract.mjs`
- `node --check scripts/hermes-loop-overlay-contract.mjs`
- `node --test test/hermes-loop-overlay-contract.test.mjs`
- `npm run platform:hermes-loop-overlay-contract -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-overlay-contract.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

The P60400 false authority baseline is carried forward. Runtime execution, command execution, write action, direct file write, generated patch apply, connector ingestion/write, external service mutation, raw material access, cross-domain access, secret read, protected action, protected closeout, deployment, release approval, production PASS, enterprise PASS, enterprise trust claim, Codex final approval, Claude final approval, and final automated approval all remain false.

### Closeout criteria

- P60400 source binding is available or rebuilt, valid, and ready for P60401.
- LoopDefinition, LoopRun, and LoopDAG required field rows all pass.
- Existing concept mapping and state mapping rows all pass.
- Authority carryover rows all remain false.
- Negative fixtures are complete.
- Validation commands are declared and non-mutating.
- Package, roadmap, and architecture wiring rows pass.
- P60801 handoff points to WorkerRun, VerifierRun, ModelRouteDecision, and BudgetDecision projection.

### Next-phase handoff

`P60801-P61200` should extend the overlay contract into `HermesLoopWorkerRun`, `HermesLoopVerifierRun`, `HermesLoopModelRouteDecision`, and `HermesLoopBudgetDecision` rows, with explicit verifier separation and budget/model-route control.
