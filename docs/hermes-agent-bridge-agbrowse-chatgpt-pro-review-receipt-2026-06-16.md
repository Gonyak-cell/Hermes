# Hermes Agent Bridge Agbrowse ChatGPT Pro Review Receipt - 2026-06-16

Status: review received.

Review target:

- Plan: `docs/hermes-agent-bridge-tuw-plan-2026-06-16.md`
- Prompt: `docs/hermes-agent-bridge-agbrowse-review-prompt-2026-06-16.md`
- Attempt log: `docs/hermes-agent-bridge-agbrowse-review-attempt-2026-06-16.md`
- Vendor: ChatGPT web via Agbrowse
- Requested model flag: `--model pro`
- URL: `https://chatgpt.com/`

This receipt is independent planning review evidence only. It is not production launch approval, production PASS, enterprise PASS, protected closeout, GitHub independent approval, deployment authorization, owner adjudication, receipt application, or authority-opening approval.

## Command

```bash
agbrowse web-ai query \
  --vendor chatgpt \
  --url https://chatgpt.com/ \
  --model pro \
  --inline-only \
  --allow-copy-markdown-fallback \
  --timeout 1800 \
  --file /Users/jws/Documents/Codex/Hermes/docs/hermes-agent-bridge-tuw-plan-2026-06-16.md \
  --prompt "$(cat /Users/jws/Documents/Codex/Hermes/docs/hermes-agent-bridge-agbrowse-review-prompt-2026-06-16.md)"
```

## Normalized Summary

| Field | Value |
|---|---|
| Review verdict | `APPROVE_WITH_FINDINGS` |
| Blocking findings | None, provided implementation is split into smaller reviewed tranches and no execution/protected authority opens |
| Top recommendation | Implement Slice A only first |
| First-slice warning | TUW-001 through TUW-080 is too large as one implementation unit |
| Authority result | Keep Desktop execution, commit, push, merge, deploy, approve, apply, receipt-apply, production, enterprise, and protected-closeout authority closed |

## Review Findings Extract

### Blocking Findings

None, provided the first implementation is split into smaller reviewed tranches and no Desktop execution, commit, push, merge, deploy, approve, apply, receipt-apply, production, enterprise, or protected-closeout authority is introduced.

### P1 Findings

- First slice is too large as a single Codex implementation unit. TUW-001 through TUW-080 is acceptable as a Phase 1 non-execution epic, but too large as the first implementation slice.
- Installed must become a first-class state, not merely explanatory text. Installed must never imply observed, requestable, allowed, approved, or executable.
- Runtime self-report needs stronger provenance typing. Every Codex/Claude/ChatGPT/Agbrowse assertion should carry `source_type`, `collector`, `collected_at`, `trust_class`, `hash`, and `authority_effect: none`.
- Receipt intake is a prompt-injection and authority-poisoning boundary. More negative fixtures are needed for fake approval, fake owner receipt, fake enterprise pass, markdown/HTML injection, and instruction-smuggling.
- Developer preflight command execution and Desktop command execution authority must be separated into namespaces.
- Agbrowse must be treated as browser automation, not authority proof.

### P2 Findings

- Capability inventory needs `fresh`, `stale`, `unknown`, `unavailable`, `blocked`, `untrusted`, and `malformed` states.
- Command canonicalization is missing and protected-action blocking must not rely only on substring checks.
- L7 UI should not render latent execution affordances.
- Malicious manifest fixtures should move from L10 to earlier L1/L3 gates.
- Adapter package provenance should be moved earlier, including package version, source, lockfile, hash, license, and optional SBOM row.

### P3 Findings

- The word `allowed` should be disambiguated into explicit fields such as `display_allowed`, `request_packet_allowed`, `receipt_import_allowed`, `desktop_execute_allowed`, and `protected_action_allowed`.
- Review cadence should be formalized at L0/L1, L4, L6, and pre-L7, not only L8/L10.

## Missing TUWs Recommended by Review

The review recommended inserting the following TUWs:

- Capability State Lattice Contract after TUW-003.
- Authority Namespace Contract after TUW-004.
- Untrusted Provider Output Rule after TUW-007.
- `provenance-source.v1` after TUW-016.
- `authority-decision-record.v1` after TUW-016.
- `redaction-policy.v1` after TUW-016.
- Malicious Manifest Fixture Suite after TUW-018.
- Agbrowse Collection Boundary before TUW-031.
- Adapter Package Provenance after TUW-037.
- Command Canonicalization and Denylist Bypass Fixtures after TUW-044.
- No-Override-Without-Policy Fixture after TUW-047.
- Request Packet Data-Minimization Gate after TUW-054.
- Malicious Receipt Fixture Suite after TUW-067.
- UI Authority Copy Guard before TUW-071.
- No Latent Execution UI Fixture before TUW-080.

## Recommended Reordering

- Move protected action classification earlier to L0/L1.
- Move malicious manifest fixtures from L10 to L1/L3.
- Define the disabled-by-default execution policy schema early, but keep all execution behavior out of the first implementation phase.
- Move sandbox/worktree requirements into a pre-L8 design ADR.
- Add independent review packets after L4 and after L6.
- Build the Agents tab only after L6 closeout review.

## Recommended First Slice

The review recommends implementing **Slice A only** first:

- L0-L4 contracts.
- Schema validation.
- Authority lattice.
- Provenance model.
- Capability inventory.
- Permission matrix.
- Protected-action classifier.
- Negative fixtures.

The review explicitly recommends not implementing TUW-049 through TUW-080 in the first Codex work packet.

## Raw Review Output Excerpt

```markdown
# Review Verdict

Verdict: **APPROVE_WITH_FINDINGS**

This is a sound plan-level architecture for a **read-only, artifact-backed Agent Bridge**, but it should not be implemented as one large TUW-001 through TUW-080 work packet. The architecture correctly treats Hermes Desktop as an operator surface rather than a privileged source of truth, and it correctly keeps execution authority out of L0-L7.

This verdict is **not** production approval, enterprise PASS, GitHub approval, owner adjudication, deployment authorization, receipt-apply authorization, or authority-opening approval.

## Blocking Findings

* **None**, provided the first implementation is split into smaller reviewed tranches and no Desktop execution, commit, push, merge, deploy, approve, apply, receipt-apply, production, enterprise, or protected-closeout authority is introduced.

## Non-Blocking Findings

* **P1 — First slice is too large as a single Codex implementation unit.** TUW-001 through TUW-080 is acceptable as a **Phase 1 non-execution epic**, but too large as the first implementation slice. It spans boundary policy, schemas, runtime identity, capability inventory, permission matrix, request queue, receipt intake, evidence binding, and Desktop UI. That is too much surface area to verify atomically.

* **P1 — “Installed” must become a first-class state, not merely explanatory text.** The plan’s state table separates Observed, Requestable, and Executable, while later schema language references installed/observed/requestable/executable/blocked. Installed should be explicitly modeled as its own low-trust fact. Installed must never imply observed, requestable, allowed, approved, or executable.

* **P1 — Runtime self-report is correctly distrusted, but the plan needs stronger provenance typing.** TUW-007 and TUW-025 are directionally correct. However, every Codex/Claude/ChatGPT/Agbrowse assertion should carry a `source_type`, `collector`, `collected_at`, `trust_class`, `hash`, and `authority_effect: none`. A runtime saying “I used model X,” “I have plugin Y,” or “task approved” should be evidence only of the report, not proof of the underlying fact.

* **P1 — Receipt intake is a prompt-injection and authority-poisoning boundary.** External review outputs from Claude, ChatGPT, Codex, or Agbrowse are untrusted provider output. They may contain text such as “approved,” “production ready,” “execute this command,” or “owner authorized.” The plan has TUW-067, but needs more negative fixtures for fake approval, fake owner receipt, fake enterprise pass, markdown/HTML injection, and instruction-smuggling.

* **P1 — The plan blurs “developer preflight command execution” and “Desktop command execution authority.”** The plan says `command_execution_allowed_now` and `shell_execution_allowed_now` stay false through L0-L7, but the verification envelope necessarily runs npm/node commands, and TUW-023/TUW-031 reference Agbrowse status commands. That is not necessarily wrong, but it needs a namespace distinction: `desktop_execution_authority = false`, `developer_preflight_commands = allowed only by local operator`, and `agent_runtime_execution = false`.

* **P1 — Agbrowse must be treated as browser automation, not as authority proof.** Browser state, cookies, UI text, copied output, and provider self-report should be treated as low-trust observational evidence, not proof of ChatGPT Pro capability, permission, entitlement, approval, or safe execution.

* **P2 — Capability inventory needs a stale/unknown/error state.** Capability freshness and hash are listed, but missing states should be explicit: `fresh`, `stale`, `unknown`, `unavailable`, `blocked`, `untrusted`, `malformed`. A stale plugin or missing MCP registry should not silently disappear; it should render as a blocker row.

* **P2 — Command canonicalization is missing.** Protected action blocking cannot rely only on substring checks for `commit`, `push`, `deploy`, `approve`, or `apply`. It needs canonicalization for absolute paths, symlinks, npm script indirection, shell metacharacters, environment interpolation, aliases, nested scripts, and command chains.

* **P2 — The UI layer should not render latent execution affordances in L7.** Even disabled execution buttons create future coupling and operator confusion. L7 should render only display, copy request packet, and import receipt surfaces. Any “execute,” “approve,” “apply,” “send,” “commit,” or “deploy” UI element should wait until after L8 review.

* **P2 — L10 malicious manifest fixtures are too late.** TUW-103 should not wait for release hardening. Malicious manifest, malicious capability, malicious receipt, and malicious UI-copy fixtures should exist before L3/L4 are considered closed.

* **P2 — Supply-chain treatment is under-specified.** Any adapter package, including Agbrowse or future MCP tooling, should have pinned version, package source, lockfile status, hash, license, and optional SBOM row.

* **P3 — “Allowed” should be disambiguated.** The plan says installed is not allowed and allowed is not executable. That is right, but “allowed” can mean policy-allowed, request-allowed, display-allowed, or execution-allowed. Prefer explicit fields: `display_allowed`, `request_packet_allowed`, `receipt_import_allowed`, `desktop_execute_allowed`, `protected_action_allowed`.

* **P3 — Review cadence should be formalized.** The plan says independent review at L8/L10, but there should also be review packets at L0/L1 closeout, L4 closeout, L6 closeout, and pre-L7 UI closeout.

## First Slice Scope

**TUW-001 through TUW-080 is too large as the first implementation slice.**

Recommended slicing:

* **Slice A: TUW-001 through TUW-048 plus the inserted L0/L1/L3/L4 safety TUWs.** Deliver contracts, schema validation, authority lattice, provenance, capability inventory, permission matrix, protected-action classifiers, and negative fixtures. No Desktop UI except existing read-model checks.

* **Slice B: TUW-049 through TUW-068 plus malicious receipt/data-minimization TUWs.** Deliver request packet generation and receipt intake. Still no execution, no receipt application, no UI execution affordances.

* **Slice C: TUW-069 through TUW-080.** Deliver Desktop Agents projection only after Slice A/B closeouts pass. The UI should be display/copy/import only.

If Codex must start immediately, the safest first work contract is **Slice A only**, not TUW-001 through TUW-080.

## Final Recommendation

Tell Codex to **implement Slice A only first**: L0-L4 contracts, schemas, authority lattice, provenance model, permission matrix, protected-action classifier, and negative fixtures. Do **not** implement TUW-049 through TUW-080 in the first Codex work packet. Do **not** add execution buttons, execution adapters, Agbrowse prompt submission, Claude/Codex auto-invocation, commit/push/merge/deploy/apply/approve authority, receipt application, production PASS, enterprise PASS, or protected closeout.
```
