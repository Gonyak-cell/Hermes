# Agbrowse ChatGPT Pro Review Prompt - Hermes Agent Bridge TUW Plan

You are acting as an independent architecture and safety reviewer for the Hermes Agent Bridge plan.

Review target:

- Repository: `/Users/jws/Documents/Codex/Hermes`
- Plan file: `docs/hermes-agent-bridge-tuw-plan-2026-06-16.md`
- Product: Hermes Desktop, a local-only read-only operator surface for multi-project control.
- Proposed future: Agent Bridge that records and eventually coordinates Codex, Claude Code, ChatGPT web via Agbrowse, local scripts, plugins, skills, MCP tools, permissions, commands, evidence, and receipts.

Important boundary:

- This review is not production launch approval.
- This review is not enterprise PASS.
- This review is not GitHub independent approval.
- This review is not owner adjudication.
- This review must not recommend opening commit/push/merge/deploy/approve/apply/receipt-apply/production/enterprise authority in the first implementation slice.

Please review the attached plan for:

1. Architecture correctness.
2. Safety and authority boundary correctness.
3. TUW ordering and missing dependencies.
4. Missing contracts, schemas, negative fixtures, or test gates.
5. Risks around treating installed plugins/skills as executable authority.
6. Risks around Codex/Claude/ChatGPT runtime self-report.
7. Whether the first implementation slice should stop at TUW-080 or be smaller.

Return in this structure:

```markdown
# Review Verdict
Verdict: APPROVE_WITH_FINDINGS | BLOCKING_FINDINGS | APPROVE

## Blocking Findings
- If none, write "None."

## Non-Blocking Findings
- List concrete findings with severity P1/P2/P3.

## Missing TUWs
- List any additional TUWs that should be inserted, with suggested layer.

## Recommended Reordering
- State any TUWs that should move earlier/later.

## First Slice Scope
- Say whether TUW-001 through TUW-080 is acceptable or too large.

## Security Boundary Notes
- Check whether installed/observed/requestable/executable are separated enough.

## Final Recommendation
- Concise recommendation for Codex before implementation.
```

Plan content follows.

---
