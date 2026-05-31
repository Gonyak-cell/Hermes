# Platform Runtime Baseline

Phase 341 adds a deterministic runtime/dependency baseline for the P341-P500
Platform Operations Stability Program.

The baseline checks:

- `.nvmrc` and `.node-version` pin Node `26.0.0`.
- `package.json` pins `packageManager` to `npm@11.12.1`.
- `package.json` keeps the supported engine window at Node `>=20 <27` and npm `>=10 <12`.
- `.npmrc` requires `engine-strict=true` and `package-lock=true`.
- `package-lock.json` exists and matches the root package.
- The P341-P500 ledger records the P340 verified bundle hash.
- Trading live, full-auto, and order submission remain disabled.

Command:

```bash
npm run platform:runtime-baseline -- --check
```

The command is report-only. It does not install dependencies, create releases,
create tags, run deployment, enable Desktop mutation, or enable Trading mutation.
