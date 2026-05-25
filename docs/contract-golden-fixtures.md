# Contract Golden Fixtures

Phase 111 freezes representative control-plane contract artifacts as golden fixtures. These fixtures are not legal work product. They are deterministic regression anchors used to verify that future schema, dashboard, API, and migration changes do not silently alter the contract spine.

## Command

```bash
npm run contracts:golden-fixtures
```

The command writes:

- `artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json`
- `artifacts/contract-golden-fixtures/latest/golden-fixture-manifest.json`
- `artifacts/contract-golden-fixtures/latest/golden-fixture-records.json`
- `artifacts/contract-golden-fixtures/latest/regression-hash-manifest.json`
- `artifacts/contract-golden-fixtures/latest/validation-report.json`
- `artifacts/contract-golden-fixtures/latest/summary.md`

## Fixture Coverage

The first fixture set covers the contract spine:

- contract inventory and dependency map
- schema versioning rules and schema migration manifest
- Resource, Matter, Policy, Evidence, Capability/Workflow, Runtime/AgentRun, Gate/Approval, Output/Delivery, Event/Audit/Run, Error/Cost/Observability freezes
- identity/policy implementation artifacts through policy golden fixtures, policy operations surface, matter boundary slice, identity/policy/matter freeze, resource store interface, immutable object store layout, resource version ledger, normalized text contract, extractor adapter contract, source span store, evidence item store, fact claim store, issue graph store, citation object store, lineage graph builder, evidence coverage score, evidence flags, exhibit map, and chain of custody events, including matter access, classification, model/tool/output policy, store policy, conflict check, personal workspace boundary, locked allow/review/deny regression cases, unified decision/violation/pending approval rows, resource-to-retrieval boundary validation, P113-P132 freeze checkpoints, the P133 registry/ingestion/dashboard resource store contract, the P134 raw-source/generated-output object key resolver, the P135 external-id version family ledger, the P136 normalized text offset/page map, the P137 parser/OCR adapter boundary, the P138 source span locator/unit/index store, the P139 review-pending evidence item binding store, the P140 fact claim/evidence reliability binding store, the P141 fact/issue/legal rule/risk severity binding store, the P142 output paragraph/source span citation object store, the P143 source-to-output lineage graph store, the P144 claim/date/party/amount/legal-basis coverage score artifact, the P145 extraction/human-confirmation/privilege/redaction/external-transfer flag artifact, the P146 Korean exhibit reference binding artifact, and the P147 append-only custody event ledger

Each fixture records its source artifact path, schema path, artifact schema version, content hash, schema hash, validation status, and regression lock status.

## Completion Gate

P111 is complete only when every fixture:

- is available at the declared source path
- validates against its JSON schema
- has an artifact `schema_version`
- has a locked content hash
- appears in the regression hash manifest

The fixture ledger is then exposed through the dashboard, Review API, goal checkpoint, and control-plane loop.
