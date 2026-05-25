# Runtime/AgentRun Contract Freeze

Phase 104 freezes the runtime execution surface that sits between the capability/workflow contract and actual agent output.

## Purpose

Runtime adapters are now projected into versioned contracts that the control plane can validate without trusting an agent self-report. Each AgentRun is enriched with:

- adapter id and runtime risk level
- output trust policy and deterministic output hash
- log capture requirement and capture status
- artifact capture requirement and linked artifacts
- verification requirement, required gates, verifier runtimes, and acceptance authority

## Contract Families

| Contract | Role |
| --- | --- |
| `RuntimeAdapter v2` | Freezes adapter policy, risk, IO, workspace, lifecycle, observability, and verification flags. |
| `RuntimeExecutionContract v2` | Freezes execution mode, sandbox, workspace isolation, retry, timeout, and command binding. |
| `AgentRunRuntime v2` | Freezes runtime-facing AgentRun evidence: output hash, log ref, artifacts, risk, and verification status. |
| `RuntimeOutputContract v2` | Freezes output refs, content hash, trust level, delivery state, and blocking gates. |
| `RuntimeLogContract v2` | Freezes required log/trace/prompt/cost capture declarations. |
| `RuntimeArtifactContract v2` | Freezes output artifact links back to the AgentRun that produced or consumed them. |
| `RuntimeVerificationContract v2` | Freezes verifier runtimes, gates, acceptance authority, and pending verification state. |

## Validation Gates

The freeze fails if:

- a used AgentRun runtime lacks a registered adapter
- any adapter lacks risk level, output trust, observability flags, or verification flag
- required logs are missing from AgentRun records
- runtime outputs lack a hash
- artifact capture is required but not tracked as either `captured` or `reference_only`
- high-risk or untrusted runtimes do not require verification

Pending human approval remains a valid contract state. The freeze is about making the risk and verification obligations explicit before any output is accepted.

## Command

```bash
npm run contracts:runtimes -- --check
```

Primary artifact:

```text
artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json
```
