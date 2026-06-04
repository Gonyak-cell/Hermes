# Hermes Verification Trust Activation Phase Ledger

This ledger covers `P3361-P3520`. It consumes `platform:verification-trust-kernel` and opens the first real verification trust activation lane.

## Objective

Turn the trust gaps from `P3201-P3360` into concrete operating mechanisms without overclaiming enterprise readiness. This tranche enables a local standard JSON Schema dual-run using AJV 2020-12 and Hermes' custom validator, defines CI required-check contracts, emits local attestation metadata, and creates an independent review lane.

It does not configure GitHub branch protection, sign external attestations, complete independent human review, enable runtime execution, enable write actions, or claim production/enterprise readiness.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P3361-P3380` | Standard Validator Adapter | Add a local AJV 2020-12 validator lane alongside Hermes custom validation |
| `P3381-P3400` | Dual-Run Result Contract | Compare custom and standard validation outcomes and block mismatch/unsupported keyword drift |
| `P3401-P3420` | Negative Fixture Expansion | Expand fixture checks for maxItems, additionalProperties, nested required, enum/const, fake evidence, stale hashes, and unsupported keywords |
| `P3421-P3440` | CI Required Check Contract | Define the commands that must run in CI before release or enterprise trust claims |
| `P3441-P3460` | GitHub Actions Baseline | Add a repository workflow that runs the core trust commands |
| `P3461-P3480` | Attestation Metadata v0 | Bind command, schema hash, package lock hash, workflow hash, and source artifact hash into local metadata |
| `P3481-P3500` | Independent Review Lane v0 | Create review packet rows for human/security/schema/release adjudication |
| `P3501-P3520` | Activation Freeze | Freeze what is now active and what remains externally blocked |

## Guard Rules

- Hermes custom validator alone cannot create a protected PASS.
- Standard validator dual-run must be active for this tranche to pass.
- Any custom/standard mismatch is a BLOCK until adjudicated.
- Unsupported JSON Schema keywords are blocked before the custom validator can silently pass them.
- CI workflow definition is not the same as branch protection.
- Local attestation metadata is not a signed external attestation.
- Independent review lane creation is not completed independent review.
- Enterprise, production, runtime, write, connector write, and final authority claims remain false.

## Completion Criteria

```text
source verification trust kernel ready
AJV 2020-12 local validator installed
standard validator dual-run active
dual-run schema report matched pass
dual-run fixture rows matched expected outcomes
negative fixture expansion blocked as expected
CI workflow file defined
branch protection required check configured now = false
local attestation metadata generated now = true
external signed attestation present now = false
independent review lane active now = true
independent review completed now = false
enterprise trust claim allowed now = false
runtime/write/production still false
unsafe flag count = 0
ready_for_platform_verification_trust_activation
```

## Validation

Run:

```bash
npm run platform:verification-trust-activation -- --check
```
