# Hermes Roadmap P60801-P61200

## P60801-P61200 Hermes Loop Agent Control Schema Family

### Phase objective

P60800 overlay contract를 소비해 `HermesLoopWorkerRun`, `HermesLoopVerifierRun`, `HermesLoopModelRouteDecision`, `HermesLoopBudgetDecision`, `HermesLoopGateResult`, `HermesLoopAuthorityBoundary`를 row-level contract로 고정한다. 이 tranche는 worker/verifier separation과 model-route/budget guard를 만들지만 실제 worker execution, model call, tool invocation, protected closeout은 열지 않는다.

### Source binding

- Primary source: `artifacts/hermes-loop-overlay-contract/latest/hermes-loop-overlay-contract.json`
- Rebuild fallback: P60800 overlay contract를 `docs/hermes-loop-system-specification.md`에서 in-memory로 재계산
- Source anchors: `7.5 HermesLoopWorkerRun`, `7.6 HermesLoopVerifierRun`, `7.7 HermesLoopModelRouteDecision`, `7.8 HermesLoopBudgetDecision`, `7.9 HermesLoopGateResult`, `7.10 HermesLoopAuthorityBoundary`, `3.6 Worker Agent`, `3.7 Verifier Agent`, `3.12 Model Route`, `3.13 Budget Gate`, `12 Model Routing and Budget Control`

### Output rows

- `p60800_overlay_source_rows`
- `worker_run_schema_rows`
- `verifier_run_schema_rows`
- `model_route_decision_schema_rows`
- `budget_decision_schema_rows`
- `gate_result_schema_rows`
- `authority_boundary_schema_rows`
- `worker_verifier_separation_rows`
- `model_budget_control_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_agent_control_wiring_rows`
- `p61200_closeout_rows`
- `p61201_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-agent-control-contract.schema.json`
- Source module: `src/hermes-loop-agent-control-contract.mjs`
- CLI script: `scripts/hermes-loop-agent-control-contract.mjs`
- Test: `test/hermes-loop-agent-control-contract.test.mjs`
- Package script: `platform:hermes-loop-agent-control-contract`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P60800 overlay source
- P60800 validation invalid
- missing WorkerRun field
- missing VerifierRun field
- missing ModelRoute field
- missing BudgetDecision field
- missing GateResult field
- missing AuthorityBoundary field
- worker self-approval
- verifier final approval
- high-cost route without budget gate
- budget exceeded but loop continues
- authority carryover true
- missing P61201 handoff

### Validation commands

- `node --check src/hermes-loop-agent-control-contract.mjs`
- `node --check scripts/hermes-loop-agent-control-contract.mjs`
- `node --test test/hermes-loop-agent-control-contract.test.mjs`
- `npm run platform:hermes-loop-agent-control-contract -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-agent-control-contract.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

P60800의 false authority carryover를 유지한다. Worker/Verifier/ModelRoute/Budget/Gate rows가 complete여도 runtime execution, command execution, write action, connector write, protected action, deployment, production PASS, enterprise PASS, Codex final approval, Claude final approval, final automated approval은 모두 false다.

### Closeout criteria

- P60800 source overlay is available or rebuilt, valid, and ready.
- WorkerRun, VerifierRun, ModelRouteDecision, BudgetDecision, GateResult, AuthorityBoundary schema rows pass.
- Worker/verifier separation rows pass.
- Model route and budget control rows pass.
- Authority carryover rows all remain false.
- Negative fixtures are complete.
- Validation commands are declared and non-mutating.
- P61201 handoff points to Phase B Loop Run Ledger Projection.

### Next-phase handoff

`P61201-P61600` should begin Phase B by projecting source event to loop run records, workflow state transitions, gate binding, blocker, and next allowed action rows.
