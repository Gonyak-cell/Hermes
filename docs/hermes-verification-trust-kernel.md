# Hermes Verification Trust Kernel Phase Ledger

This ledger covers `P3201-P3360`. It consumes `platform:production-governance-work-os-freeze` and hardens Hermes validation trust after the P3200 governance freeze.

## Objective

Make validation itself more reviewable. This tranche does not claim enterprise-grade assurance, configure CI, install a standard JSON Schema validator, run external attestations, or complete independent human review. It defines the trust kernel, adds negative fixtures, binds evidence rows to content hashes, and emits a tamper-evident validation ledger so later SaaS factory work can rely on a clearer trust boundary.

## Phase Slices

| Range | Slice | Goal |
|---|---|---|
| `P3201-P3240` | Standard Schema Validator Lane | Declare the JSON Schema 2020-12 target, current custom validator limits, and future dual-run adapter |
| `P3241-P3280` | Negative Fixture Pack | Prove broken schema, fake evidence, and stale source-hash fixtures are blocked |
| `P3281-P3320` | Evidence Provenance Contract | Bind evidence references to source URI, content hash, capture actor, timestamp, and redaction policy |
| `P3321-P3340` | Validation Result Ledger | Emit append-only style validation rows with chained hashes |
| `P3341-P3360` | Trust Kernel Freeze | Freeze current trust level as contract-hardened, not enterprise-attested |

## Source

- Source command: `platform:production-governance-work-os-freeze`
- Source phase: `P3041-P3200`
- Required status: `ready_for_platform_production_governance_work_os_freeze`
- Required boundary: production, runtime, write, connector write, pack install, final authority, and Work OS final claim remain false

## Guard Rules

- A validation PASS is not trusted unless the validator lane is identified.
- A schema PASS is not trusted unless negative fixtures show expected failures.
- An evidence reference is not trusted unless it has a source URI and content hash.
- A validation run is not trusted unless it is recorded in a chained ledger.
- A trust score is not trusted unless gaps are explicit.
- Standard validator, CI, attestation, and independent review gaps must remain visible.

## Completion Criteria

```text
source production governance freeze ready
standard schema validator lane documented
negative fixtures blocked as expected
evidence provenance rows hash-bound
validation ledger rows hash-chained
trust coverage rows emit explicit gaps
enterprise trust claim allowed now = false
standard validator active now = false
CI required check configured now = false
external attestation present now = false
independent review completed now = false
runtime/write/production still false
unsafe flag count = 0
ready_for_platform_verification_trust_kernel
```

## Validation

Run:

```bash
npm run platform:verification-trust-kernel -- --check
```
