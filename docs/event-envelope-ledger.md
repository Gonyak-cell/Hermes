# Event Envelope Ledger

Phase 159 adds a CloudEvents-style projection layer over the existing EventRecord v2 and AuditEvent v2 contracts.

This does not replace the authoritative event, audit, or run ledger contracts. It gives runtime adapters, replay tooling, dashboard/API readers, and future event bus work a narrow common envelope:

- `id`
- `specversion`
- `type`
- `source`
- `time`
- `dataschema`
- `datacontenttype`
- `data`

The projection preserves Hermes-specific extension fields such as `schemaversion`, `correlationid`, `tenantid`, `matterid`, `workflowrunid`, `runledgerid`, `policysnapshotid`, `actortype`, `actorid`, `sourcekind`, and `sourceid`.

## Guardrails

- Event data remains JSON content, not executable instructions.
- EventRecord v2 and AuditEvent v2 remain the source of truth.
- Every envelope has a source binding that round-trips back to the source event id.
- Protected action execution flags are preserved as audit data; this projection does not execute protected actions.

## Command

```bash
npm run events:envelopes -- --check
```

Outputs are written to `artifacts/event-envelope-ledger/latest/`:

- `event-envelope-ledger.json`
- `event-envelopes.json`
- `event-envelope-source-bindings.json`
- `validation-report.json`
- `summary.md`
