# Matter Contract Freeze

Phase 100 fixes the matter boundary contract as a v2 projection over the existing `identity_policy.v1` source.

The freeze does not mutate the source identity policy. It produces stable fixtures for:

- `client.v2`
- `party.v2`
- `matter-core.v2`
- `matter-team.v2`
- `matter-boundary.v2`

Run:

```sh
npm run contracts:matters
```

Key outputs:

- `artifacts/matter-contract-freeze/latest/matter-contract-freeze.json`
- `artifacts/matter-contract-freeze/latest/matter-contract-v2-fixture.json`
- `artifacts/matter-contract-freeze/latest/party-contract-v2-fixture.json`
- `artifacts/matter-contract-freeze/latest/matter-boundary-v2-fixture.json`
- `artifacts/matter-contract-freeze/latest/validation-report.json`
- `artifacts/matter-contract-freeze/latest/summary.md`

The validation gate checks that clients, parties, matter teams, wall ids, policy snapshots, and retrieval filters are present before later identity and access-policy phases build stricter enforcement.
