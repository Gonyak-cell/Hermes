# Contract Dependency Map

Phase 98 turns the Phase 97 contract inventory into an explicit dependency graph.

Run:

```bash
npm run contracts:dependencies
```

Outputs:

- `artifacts/contract-dependency-map/latest/contract-dependency-map.json`
- `artifacts/contract-dependency-map/latest/dependency-graph.json`
- `artifacts/contract-dependency-map/latest/breaking-change-risks.json`
- `artifacts/contract-dependency-map/latest/owner-dependency-map.json`
- `artifacts/contract-dependency-map/latest/summary.md`

The graph direction is upstream to downstream:

- schema -> artifact contract
- package script -> control-plane loop output contract
- loop output contract -> artifact contract
- artifact contract -> dashboard source
- dashboard source -> Review API route

This keeps the core/domain/runtime/dashboard dependency direction visible as data. A later schema or migration phase can then ask a specific question before changing a contract: which producer, artifact, dashboard source, API route, and owner boundary will be affected?

Breaking-change risks are deliberately warnings, not automatic blockers. The map highlights schemas without pinned `schema_version`, artifacts without mapped schemas, dashboard sources without schema coverage, API routes that could not be matched to a source, indirect package scripts, and loop steps without declared output artifacts.

Integration points:

- Package script: `contracts:dependencies`
- Dashboard source/stage: `contract_dependency_map`
- Goal checkpoint: `control-plane-contract-dependency-map`
- Review API routes: `/api/contract-dependency-maps`, `/api/contract-dependency-nodes`, `/api/contract-dependency-edges`, `/api/contract-breaking-change-risks`, `/api/contract-owner-dependencies`
- Control-plane loop step: `contract_dependency_map`
