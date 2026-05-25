# Capability/Workflow Contract Freeze

Phase 103 freezes the Capability and Workflow contract boundary as `capability-workflow-contract-freeze.v1`.

The freeze reads:

- Domain Pack Registry capability manifests.
- Law-firm, personal-dev, and creative-document slice `workflow_runtime` sections.
- Policy and Evidence contract freezes for policy and lineage compatibility.

It writes a v2 projection under `artifacts/capability-workflow-contract-freeze/latest/`:

- `capability-manifest.v2`
- `workflow.v2`
- `workflow-run.v2`
- `agent-run.v2`
- `capability-io-contract.v2`
- `capability-gate-runtime-contract.v2`
- `workflow-execution-binding.v2`

The important point is that input, output, gate, runtime, and version fields are no longer implicit script conventions. They are contract rows with required/optional field declarations and validation items.

Run it with:

```bash
npm run contracts:capabilities
npm run contracts:capabilities -- --check
```

This phase is intentionally still deterministic. It does not invoke Hermes, Claude Code, Codex, or external services; it only freezes the contracts those runtimes must obey before later execution phases can trust them.
