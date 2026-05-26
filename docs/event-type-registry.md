# Event Type Registry

Phase 160 adds a deterministic event type registry on top of the Phase 159 CloudEvents-style event envelope ledger.

## Purpose

The registry turns raw envelope `type` strings into operational catalog records:

- `resource`
- `workflow`
- `agent`
- `gate`
- `approval`
- `output`

The catalog is not an authorization layer. Policy, gate, and approval contracts remain responsible for deciding whether a runtime, tool, or delivery action can proceed.

## Artifacts

Run:

```bash
npm run events:types
```

Outputs:

- `artifacts/event-type-registry/latest/event-type-registry.json`
- `artifacts/event-type-registry/latest/event-type-records.json`
- `artifacts/event-type-registry/latest/event-family-records.json`
- `artifacts/event-type-registry/latest/event-type-bindings.json`
- `artifacts/event-type-registry/latest/validation-report.json`
- `artifacts/event-type-registry/latest/summary.md`

## Completion Rules

P160 is complete only when:

- the source event envelope ledger is complete;
- every source envelope has exactly one event type binding;
- every binding preserves source schema version and dataschema;
- every binding is classified;
- the required families `resource`, `workflow`, `agent`, `gate`, `approval`, and `output` are covered;
- dashboard, API, golden fixtures, contract validation, and goal checkpoint surfaces recognize the registry.
