# Verification Orchestration Runtime

Program: `P5001-P5400`

This program creates the verification orchestration layer above the Development Control Console. It does not make a completion claim trustworthy by itself. It registers the checks, dual-run comparisons, negative fixtures, CI required check contracts, attestation verify contracts, and Claude Code Opus max review receipt completion rules that decide what remains open.

## Operating Contract

```text
standard validator adapter required
dual-run result required
negative fixtures required
CI required check contract required
GitHub Actions evidence binding required
signed attestation verify contract required
Claude review completion receipt required
durable Claude raw JSON required
local-only PASS cannot claim enterprise trust
```

The runtime contract can be ready while `P5400` closeout is still blocked. That is expected when live external evidence has not been captured.

## Phase Scope

| Range | Name | Buildout |
|---|---|---|
| `P5001-P5040` | Standard Validator Adapter Registry | Register standard validators and validate-chain presence |
| `P5041-P5080` | Dual-Run Result Contract | Compare schema, summary, boundary, review process, and milestone gate results |
| `P5081-P5120` | Negative Fixture Expansion | Block local-only enterprise trust, missing Claude raw JSON, self-review, unsigned attestation prose, and assumed human gate |
| `P5121-P5160` | CI Required Check Contract | Define required checks for targeted tests, validate chain, GitHub Actions, attestation verify, and Claude review receipt |
| `P5161-P5200` | GitHub Actions Evidence Binding | Require workflow run id, conclusion, and commit SHA evidence before closeout |
| `P5201-P5240` | Signed Attestation Verify Contract | Require signed attestation presence, verification pass, and subject digest binding |
| `P5241-P5280` | Claude Review Receipt Completion Contract | Require Claude Code Opus max review completion, durable raw JSON, normalized findings, and no source mutation |
| `P5281-P5320` | Verification Result Normalization | Normalize PASS/BLOCK/PENDING into contract-readiness and closeout-readiness rows |
| `P5321-P5360` | Milestone Trust Decision Rows | Separate lower-trust readiness from P5400 closeout and enterprise trust |
| `P5361-P5400` | Verification Orchestration Freeze | Freeze runtime schema, artifacts, tests, boundary, and open external evidence rows |

## P5400 Boundary

These may be ready:

```text
verification_orchestration_runtime_ready
standard_validator_contract_ready
dual_run_contract_ready
negative_fixtures_ready
ci_required_check_contract_ready
lower_trust_readiness_allowed
```

These stay false until live evidence exists:

```text
github_actions_passed_now
attestation_verification_passed_now
claude_review_completed_now
durable_claude_raw_json_present_now
p5400_milestone_closeout_ready
enterprise_trust_claim_enabled
protected_closeout_enabled
```

## Validation

```bash
npm run platform:verification-orchestration-runtime -- --check
```

Outputs are written under:

```text
artifacts/verification-orchestration-runtime/latest/
```
