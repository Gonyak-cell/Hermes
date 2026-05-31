# Swarm Topology Contract

Kanban Swarm integration은 Hermes CLI를 바로 실행하지 않고 deterministic topology artifact를 먼저 만든다.

## 적용 위치

- `src/swarm-topology-contract.mjs`가 workflow runner plan과 control-plane work packet에서 swarm 후보를 찾는다.
- `scripts/swarm-topology-contract.mjs`와 `npm run workflows:swarm-topology`가 dry-run projection을 생성한다.
- `schemas/swarm-topology.schema.json`은 root, workers, verifier, synthesizer, shared blackboard, human review gate를 고정한다.

## 실행 경계

- worker execution은 수행하지 않는다.
- protected action execution은 허용하지 않는다.
- Hermes command는 `hermes kanban swarm ... --dry-run` projection으로만 저장한다.
- verifier, synthesizer, human review gate는 필수이다.
