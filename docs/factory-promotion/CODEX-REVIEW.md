# Codex Review Note: Factory Promotion Package

Status: Codex implementation review note, not approval.
Date: 2026-06-11
Reviewed package: `docs/factory-promotion/`

## Verdict

The Fable 5 package is directionally strong and should be kept as the draft promotion baseline. It correctly reframes Hermes as a SaaS Factory / Product Operating Platform, separates projection from executable implementation, and moves negative fixtures toward observed execution.

Do not start FA implementation until the package-level corrections below are reflected and F0.1-F0.5 are complete.

## Blocking Findings

### P1-1. F0 handoff skips F0.1 and F0.2

`03-fcore-program.md` defines F0.1 as missing review receipt capture and F0.2 as the `multi-engine-orchestration` handoff blocker disposition, but the F0 handoff line only requires F0.3-F0.5 owner receipts before FA can begin.

Required correction applied in package v0.1.1:

- FA entry must require F0.1-F0.5 completion.
- F0.1 must prove the two missing review receipts are valid.
- F0.2 must prove the multi-engine source handoff is resolved or explicitly waived with expiry/conditions.
- No FA implementation should start while `platform:saas-factory-mode` still reports `source_ready_for_p15001_handoff: false` without a recorded waiver.

Evidence:

- `docs/factory-promotion/03-fcore-program.md`
- `npm run platform:multi-engine-orchestration -- --check`
- `npm run platform:saas-factory-mode -- --check`

### P1-2. F0.1 can unblock weak receipt gates before receipt integrity exists

The diagnosis correctly identifies that the connector and execution/write review gates currently accept simple field-matching receipts. That makes F0.1 risky if it merely drops receipt JSON files that satisfy the current four-field shape.

Required correction applied in package v0.1.1:

- Add an F0 receipt-integrity preflight before accepting the two missing review receipts.
- At minimum, each F0.1 receipt must bind:
  - reviewed commit SHA
  - prompt SHA256
  - raw output SHA256
  - resolved model id
  - receipt file SHA256
  - scope id
  - unresolved finding count
- The F0.1 preflight does not need to replace the full FD receipt envelope, but it must prevent label-only receipt spoofing.

Evidence:

- `docs/factory-promotion/01-diagnosis.md`
- `src/connector-external-app-governance.mjs`
- `src/execution-write-authority-maturity.mjs`

## Nonblocking Findings

### P2-1. `data/factory/` needs a storage policy before FA.1

The plan proposes a tracked `data/factory/` state store. Before implementation, decide whether this is:

- tracked seed/test fixture state only, or
- local operational state that should stay outside git, or
- a split model with tracked seed rows and local ignored runtime ledgers.

Do not store raw confidential material, unredacted human notes, secrets, or external connector payloads in tracked JSONL.

### P2-2. FCORE ID migration needs an integration rule

The plan declares FCORE as the new canonical program ID. That is probably right, but existing docs, scripts, artifacts, and roadmap language still use P-ranges heavily. S0-5 should include an explicit migration rule:

- new implementation work uses FCORE IDs,
- legacy P-ranges remain source binding refs,
- package scripts and artifact names may keep existing names until touched,
- no validator may require FCORE text presence in a roadmap document as its pass condition.

### P3-1. Broken link in diagnosis - resolved in package v0.1.1

`docs/factory-promotion/01-diagnosis.md` previously linked to `../../src/saas-factory-mjs`; package v0.1.1 now links to `../../src/saas-factory-mode.mjs`.

## Recommended Next Action

Before FA implementation, confirm the v0.1.1 package corrections remain intact:

1. Change the F0 handoff to require F0.1-F0.5.
2. Add F0.0 or F0.1a receipt-integrity preflight.
3. Add the `data/factory/` storage policy decision to S0-5 or FA.1.
4. Fix the broken link.

After that, the owner can adjudicate S0-1 through S0-5 with less ambiguity, and Codex can verify F0.1/F0.2 before FA.1.

## Checked Locally

These checks were run from `/Users/jws/Documents/Codex/Hermes`:

```bash
npm run platform:multi-engine-orchestration -- --check
npm run platform:saas-factory-mode -- --check
npm run platform:connector-external-app-governance -- --check
npm run platform:execution-write-authority-maturity -- --check
```

Observed status:

- `multi-engine-orchestration`: blocked, validation errors 0
- `saas-factory-mode`: blocked, validation errors 0
- `connector-external-app-governance`: blocked, validation errors 0
- `execution-write-authority-maturity`: blocked, validation errors 0

The blocked statuses are expected and should remain visible until properly resolved or explicitly waived.
