# Client/Counterparty Registry

Phase 114 adds a deterministic registry projection above the Matter/Client/Party v2 contract freeze.

## Purpose

The registry stabilizes party identifiers before conflict check, matter access, retrieval filtering, and future ethical wall logic use them.

- `party_registry` keeps every `party.v2` row under one stable `stable_party_id`.
- `client_registry` exposes the client-facing subset with legal name, aliases, matter links, and default policy reference.
- `counterparty_registry` exposes non-client parties with role, matter links, and classification floor.
- `matter_party_links` materializes each `matter_id -> stable_party_id` relation.
- `conflict_reference_index` gives future conflict-check workflows one canonical id, canonical name, and alias set per party.

## Operating Rules

- The registry is a projection of `artifacts/matter-contract-freeze/latest/matter-contract-freeze.json`.
- It must not invent cross-matter access. Matter links are copied from the Matter Contract Freeze source.
- Alias collisions inside the same tenant fail validation because conflict check must not silently merge unrelated parties.
- A client registry row must point to a stable client party id.
- A counterparty registry row must point to at least one matter.

## Command

```bash
npm run contracts:party-registry -- --check
```

Optional source override:

```bash
npm run contracts:party-registry -- --matter-contract-freeze artifacts/matter-contract-freeze/latest/matter-contract-freeze.json
```

## Outputs

- `artifacts/client-counterparty-registry/latest/client-counterparty-registry.json`
- `artifacts/client-counterparty-registry/latest/party-registry.json`
- `artifacts/client-counterparty-registry/latest/client-registry.json`
- `artifacts/client-counterparty-registry/latest/counterparty-registry.json`
- `artifacts/client-counterparty-registry/latest/matter-party-links.json`
- `artifacts/client-counterparty-registry/latest/conflict-reference-index.json`
- `artifacts/client-counterparty-registry/latest/validation-report.json`
- `artifacts/client-counterparty-registry/latest/summary.md`

## Phase 114 Acceptance

The phase is complete when:

- every Party v2 source row has exactly one stable registry row;
- every Client v2 source row has a client registry row and conflict reference;
- every non-client party has a counterparty registry row and matter link;
- every `matter.party_ids` relation is materialized as a matter-party link;
- the registry is visible through dashboard, API, golden fixtures, validation suite, goal checkpoint, and control-plane loop.
