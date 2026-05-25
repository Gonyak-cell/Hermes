# Contract Validation Suite

Phase 112 adds the one-command validation surface for the contract spine.

```bash
npm run contracts:validate -- --check
```

The command reads the Phase 111 golden fixture set, revalidates every fixture against its JSON schema, recomputes artifact and schema hashes, and checks that the required contract package scripts and roadmap entry exist.

## Outputs

- `artifacts/contract-validation-suite/latest/contract-validation-suite.json`
- `artifacts/contract-validation-suite/latest/fixture-validation-results.json`
- `artifacts/contract-validation-suite/latest/validation-command-manifest.json`
- `artifacts/contract-validation-suite/latest/validation-report.json`
- `artifacts/contract-validation-suite/latest/summary.md`

## Pass Criteria

The suite is complete only when:

- the source golden fixture set is complete
- every fixture validates against its schema
- every fixture content hash still matches the golden fixture hash
- every schema hash still matches the golden fixture hash
- every fixture regression status is passed
- all required contract package scripts exist
- `contracts:policy-golden` is present once policy golden fixtures are part of the fixture set
- `policy:surface` is present once policy operations surface exposes decision, violation, and pending approval rows
- `matter-boundary:slice` is present once the matter boundary vertical slice becomes a golden fixture
- `identity-policy:freeze` is present once the P113-P132 identity/policy/matter freeze becomes a golden fixture
- `resource:store-interface` is present once the P133 resource store interface becomes a golden fixture
- `object-store:layout` is present once the P134 immutable object store layout becomes a golden fixture
- `resource:version-ledger` is present once the P135 resource version ledger becomes a golden fixture
- Phase 112 and `npm run contracts:validate` are recorded in the roadmap

This makes the contract spine testable through one deterministic command before later identity, policy, evidence, runtime, or delivery phases add more behavior.
