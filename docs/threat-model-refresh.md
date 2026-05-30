# Threat Model Refresh

Phase 297 adds `threat_model_refresh`, a read-only threat model report for the Hermes Harness v1.0 freeze track.

The refresh tracks the required P297 risk classes:

- prompt injection
- data leak
- over-agency
- insecure tool
- Desktop installer control
- Desktop auto-update control
- Desktop SSH control
- Desktop cron control
- Desktop gateway control
- provider key exposure

The report is generated from existing control artifacts only. It does not read source content, ingest new resources, invoke agents, execute tools, start a server, expose raw secret material, materialize provider keys, apply approvals, execute protected actions, deliver output, generate legal advice, or produce client-facing output.

## Outputs

`npm run security:threat-model` writes the following files under `artifacts/threat-model-refresh/latest`:

- `threat-model-refresh.json`
- `threat-model-sources.json`
- `threat-model-risks.json`
- `threat-model-controls.json`
- `threat-model-evidence.json`
- `threat-model-boundary.json`
- `threat-model-checks.json`
- `validation-report.json`
- `summary.md`

## Evidence Sources

The P297 guard starts from the P296 `dashboard_api_freeze` artifact, then binds the existing prompt injection, secret, runtime, Desktop API, capability registry, dev protected scan, and control-plane loop evidence. The report keeps human review gates and Windows baseline stability as explicit controls so Mac/Windows differences do not destabilize completed phases.
