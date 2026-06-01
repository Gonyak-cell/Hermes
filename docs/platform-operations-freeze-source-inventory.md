# Platform Operations Freeze Source Inventory

Status: P481 command specification.

`platform:operations-freeze-source-inventory` starts the P481-P500 platform
operations freeze tranche by inventorying every P341-P480 ledger source row.
It checks that each source phase exists exactly once in the platform operations
ledger, has a matching `package.json` script, and is registered in
`npm run validate` or has a documented recursive validation-chain exclusion.

The source inventory does not execute source commands, run package commands,
read generated artifacts, write protected artifacts, mutate packages or
lockfiles, publish releases, run git operations, execute protected recovery,
enable live trading, submit orders, make broker or exchange writes, promote
Hermes Desktop to source of truth, mutate Desktop state, read secret values, or
inspect `.env` or Desktop configuration content.

## Command

```sh
npm run platform:operations-freeze-source-inventory -- --check
```

## Freeze Source Policy

Each P341-P480 source row is `complete` when its ledger command is present
exactly once, the command namespace still matches its tranche (`platform:` for
platform commands and `trading:` for trading commands), the package script
exists, and the command appears in `npm run validate` with `-- --check` or
documents why direct registration would recurse.

Rows that fail any of those conditions are reported as `blocked` with a
documented blocker so an operator can repair the source chain before later
freeze phases rely on it.

## Human Review Note

The inventory is a read-only review surface. It proves registration coverage for
the already-built P341-P480 chain, but it does not rerun those commands or turn
pending human gates into approvals.
