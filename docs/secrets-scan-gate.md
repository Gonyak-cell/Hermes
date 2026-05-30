# Secrets Scan Gate

Phase 300 adds `secrets_scan_gate`, a read-only gate report that verifies credential, token, `.env`, provider-key, and Desktop/production config leakage is treated as a gate failure.

The gate consumes existing contract artifacts only. It does not read secret values, read `.env` files, inspect Desktop config content, scan arbitrary source content, execute routes, start a server, call a provider, use network access, perform protected actions, deliver output, provide legal advice, or produce client-facing output.

`npm run security:secrets-scan-gate` writes the following files under `artifacts/secrets-scan-gate/latest`:

- `secrets-scan-gate.json`
- `secrets-scan-source-statuses.json`
- `secrets-scan-rule-results.json`
- `secrets-scan-gate-results.json`
- `desktop-config-leakage-checks.json`
- `secrets-scan-boundary.json`
- `validation-report.json`
- `summary.md`

The Review Dashboard and Review API expose the artifact, source statuses, rule results, gate results, Desktop config leakage checks, boundary, and validation rows. Any detected credential/token/env/Desktop config leakage must surface as an attention state and a failing operational gate before Phase 301 can proceed.
