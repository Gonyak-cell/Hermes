# External Model Policy Audit

Phase 299 adds `external_model_policy_audit`, a read-only audit report that compares classification-level external provider transmission policy and Desktop provider/model settings against the active policy snapshot evidence.

The audit reads existing policy, model-routing, runtime dashboard, capability registry, and P298 prompt-injection guard artifacts. It does not read source content, ingest sources, call an external model, send provider requests, access the network, mutate Desktop settings, materialize provider keys, execute routes, start a server, execute protected actions, deliver output, generate legal advice, or produce client-facing output.

## Outputs

`npm run security:external-model-policy-audit` writes the following files under `artifacts/external-model-policy-audit/latest`:

- `external-model-policy-audit.json`
- `external-model-classification-audits.json`
- `external-model-policy-snapshot-audits.json`
- `external-model-route-audits.json`
- `desktop-provider-model-audits.json`
- `external-model-policy-audit-boundary.json`
- `validation-report.json`
- `summary.md`

## Audit Coverage

- Classification rows show whether external provider transmission is allowed with audit, requires approval, or is forbidden.
- Policy snapshot rows show the snapshot external model policy used for each covered classification.
- Route rows verify external runtime routes remain low-sensitivity, audited, and policy-snapshot aligned.
- Desktop rows verify provider keys are hidden, Desktop is not a runtime source of truth, and model/runtime execution remains disabled from the operator surface.
