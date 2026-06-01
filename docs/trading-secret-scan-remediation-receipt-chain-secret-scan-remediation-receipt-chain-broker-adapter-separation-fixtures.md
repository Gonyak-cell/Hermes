# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Broker Adapter Separation Fixtures

P473 consumes P472 secret scan remediation receipt-chain advisory-remediation receipt chain signoff closeout readiness
and records broker adapter separation fixtures for the post-closeout nested safety
block. It proves simulated and sandbox adapter contracts stay separate from the
disabled live adapter contract, default control-plane paths do not import or
enable live adapter files, and credentials remain reference-only.

## Scope

- Source: P472 `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures`.
- Output: `artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-broker-adapter-separation-fixtures/latest`.
- Workflow: `workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures.v1`.
- Capability: `trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures`.

## Safety Boundary

- Simulated/sandbox contracts are present and simulation-only.
- The live adapter contract is disabled by default and not imported by default.
- Credential references remain disabled/reference-only; plaintext secrets,
  provider keys, environment dumps, and model-context secrets stay absent.
- Secret values, raw secret material, `.env` content, Desktop config content,
  Desktop provider keys, credential lookups, automatic fix, redaction, deletion,
  rotation, and secret scan remediation actions remain absent.
- Live execution, order submission, broker writes, exchange writes, artifact
  reads/writes, command execution, git operations, and protected actions remain
  false.

## Check

```sh
npm run trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-broker-adapter-separation-fixtures -- --check
```
