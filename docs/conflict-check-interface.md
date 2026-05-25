# Conflict Check Interface

Phase 127 adds a deterministic conflict check interface between the matter identity layer and store/resource access.

The interface reads the Client/Counterparty Registry, Matter Profile/Team Ledger, Wall Policy Contract, and Store Policy Adapter, then writes:

- `conflict-check-interface.json`
- `conflict-check-requests.json`
- `conflict-check-results.json`
- `conflict-signals.json`
- `validation-report.json`
- `summary.md`

The default command is:

```bash
npm run contracts:conflict-check
```

Use `--check` in CI or in the control-plane loop:

```bash
npm run contracts:conflict-check -- --check
```

The artifact is intentionally conservative. Client party references may be recorded as clear conflict signals, but counterparty references produce `review` signals and keep matter intake or resource access in `hold_for_conflict_review`. This layer does not approve representation, legal advice, filings, client delivery, or final work product.

## Contract Shape

- `conflict_check_requests` records the request context before matter intake or resource access.
- `conflict_signals` binds each request to known conflict references and conflict wall bindings.
- `conflict_check_results` converts signals into a final access effect: record, hold, or block.
- `validation_items` prove request/result/signal coverage and source completeness.

The interface must preserve `tenant_id`, `matter_id`, `client_id`, `policy_snapshot_id`, conflict reference IDs, wall binding IDs, and store query plan IDs so later approval and audit phases can reconstruct why an access path was held or allowed to move forward.
