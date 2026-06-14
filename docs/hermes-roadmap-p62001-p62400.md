# Hermes Roadmap P62001-P62400

## P62001-P62400 Hermes Loop DAG And Worker/Verifier Topology

### Phase objective

P62000 context and memory grounding artifact를 source로 받아 Phase D DAG and Worker/Verifier Topology를 구현한다. Bounded DAG, DAG node dependency, worker/verifier separation, correction edge policy, retry/budget consumption, terminal stop node를 row-level artifact로 고정한다.

### Source binding

- Primary source: `artifacts/hermes-loop-context-memory-grounding/latest/hermes-loop-context-memory-grounding.json`
- Rebuild fallback: P62000 context and memory grounding을 source specification에서 in-memory로 재계산
- Source anchors: `2.6 Worker and Verifier Are Separate`, `2.8 DAG Before Autonomy`, `6.4 DAG and Worker/Verifier Topology Layer`, `7.4 HermesLoopDAG`, `7.5 HermesLoopWorkerRun`, `7.6 HermesLoopVerifierRun`, `11 DAG and Worker/Verifier 요구사항`, `21.4 Phase D`

### Output rows

- `p62000_context_memory_source_rows`
- `dag_topology_contract_rows`
- `dag_node_contract_rows`
- `worker_verifier_separation_rows`
- `correction_retry_budget_rows`
- `terminal_stop_node_rows`
- `authority_boundary_carryover_rows`
- `negative_fixture_contract_rows`
- `validation_command_rows`
- `hermes_loop_dag_topology_wiring_rows`
- `p62400_closeout_rows`
- `p62401_next_phase_handoff_rows`

### Schema/script/doc/test change scope

- Schema: `schemas/hermes-loop-dag-topology.schema.json`
- Source module: `src/hermes-loop-dag-topology.mjs`
- CLI script: `scripts/hermes-loop-dag-topology.mjs`
- Test: `test/hermes-loop-dag-topology.test.mjs`
- Package script: `platform:hermes-loop-dag-topology`
- Architecture note: `docs/architecture.md`

### Negative fixtures

- missing P62000 context memory source
- P62000 validation invalid
- missing DAG topology row
- missing DAG node dependency
- worker self-verification
- verifier final approval
- correction edge without retry limit
- retry without budget consumption
- unbounded cycle
- missing terminal stop node
- authority carryover true
- missing P62401 handoff

### Validation commands

- `node --check src/hermes-loop-dag-topology.mjs`
- `node --check scripts/hermes-loop-dag-topology.mjs`
- `node --test test/hermes-loop-dag-topology.test.mjs`
- `npm run platform:hermes-loop-dag-topology -- --check`
- `node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")); JSON.parse(require("node:fs").readFileSync("schemas/hermes-loop-dag-topology.schema.json", "utf8"));'`
- `git diff --check`

### Authority boundary

DAG and topology rows are reviewable topology metadata only. Actual DAG execution, worker execution, verifier execution, retry execution, tool call, source mutation, connector write, protected action, deployment, production PASS, enterprise PASS, Codex final approval, Claude final approval, and final automated approval remain false.

### Closeout criteria

- P62000 source is valid and ready.
- DAG topology contract rows pass.
- DAG node contract rows pass.
- Worker/verifier separation rows pass.
- Correction retry/budget rows pass.
- Terminal stop node rows pass.
- Authority carryover rows remain false.
- Negative fixtures are complete.
- P62401 handoff points to model routing and budget control.

### Next-phase handoff

`P62401-P62800` should implement Model Routing and Budget Control: task class, risk tier, data classification, model route gate, budget cap, downgrade policy, escalation policy, and stop condition binding.
