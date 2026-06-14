# Hermes Roadmap P62401-P62800

## P62401-P62800 Hermes Loop Model Routing And Budget Control

### Phase objective

P62400 DAG topology artifact를 source로 받아 Phase E Model Routing and Budget Control을 구현한다. DAG node별 model route decision, budget decision, route gate policy, budget guardrail, downgrade/stop policy를 row-level artifact로 고정한다.

### Source binding

- Primary source: `artifacts/hermes-loop-dag-topology/latest/hermes-loop-dag-topology.json`
- Rebuild fallback: P62400 DAG topology를 source specification에서 in-memory로 재계산
- Source anchors: `6.5 Model Routing and Budget Gate Layer`, `7.7 HermesLoopModelRouteDecision`, `7.8 HermesLoopBudgetDecision`, `12 Model Routing and Budget Control 요구사항`, `21.5 Phase E`

### Output rows

- `p62400_dag_topology_source_rows`
- `model_route_decision_contract_rows`
- `budget_decision_contract_rows`
- `route_gate_policy_rows`
- `budget_guardrail_rows`
- `downgrade_stop_policy_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_model_budget_wiring_rows`
- `p62800_closeout_rows`
- `p62801_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-model-budget-control.schema.json`
- Source module: `src/hermes-loop-model-budget-control.mjs`
- CLI script: `scripts/hermes-loop-model-budget-control.mjs`
- Test: `test/hermes-loop-model-budget-control.test.mjs`
- Package script: `platform:hermes-loop-model-budget-control`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P62400 DAG topology source
- P62400 validation invalid
- missing model route decision field
- missing budget decision field
- external model route auto pass
- privileged/sensitive route without review or deny
- expensive model escalation without gate
- budget exceeded but loop continues
- unbudgeted route
- downgrade or stop missing
- authority carryover true
- missing P62801 handoff

### Validation commands

- `node --check src/hermes-loop-model-budget-control.mjs`
- `node --check scripts/hermes-loop-model-budget-control.mjs`
- `node --test test/hermes-loop-model-budget-control.test.mjs`
- `npm run platform:hermes-loop-model-budget-control -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-model-budget-control.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

Model and budget rows are route candidate and budget guard metadata only. Actual model call, runtime model selection, high-cost escalation, budget spend, external model transfer, connector write, protected action, deployment, production PASS, enterprise PASS, Codex final approval, Claude final approval, and final automated approval remain false.

### Closeout criteria

- P62400 source is valid and ready.
- Model route decision rows pass.
- Budget decision rows pass.
- Route gate policy rows pass.
- Budget guardrail rows pass.
- Downgrade/stop policy rows pass.
- Authority carryover rows remain false.
- Negative fixtures are complete.
- P62801 handoff points to runtime and tool governance.

### Next-phase handoff

`P62801-P63200` should implement Runtime and Tool Governance: tool allowlist, runtime policy, secret/raw redaction, timeout, evidence capture, and no-write/no-execution boundaries.
