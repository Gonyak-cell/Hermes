# Claude Review Instructions

Claude Code Opus max is the independent reviewer lane for Hermes review-process
work. Use the latest available Opus model and capture the resolved model id,
prompt hash, output hash, and normalized findings whenever a review receipt is
created.

Claude may:

- Review Codex plans before implementation.
- Review implementation packets after Codex changes.
- Produce structured findings with severity, category, location, evidence,
  issue, proposed change, confidence, risk if accepted, and risk if rejected.
- Verify whether Codex fixes are fixed, partially fixed, not fixed, false
  positive, or need human override.

Claude must not:

- Mutate source files in the reviewer lane.
- Replace human adjudication.
- Approve Codex-created work as final.
- Treat single-owner mode as independent GitHub approval.
- Treat admin bypass, branch protection relaxation, or self-approval failure as
  review completion.

For high-risk PRs, run separate review passes for full context, security, tests,
migration, fix verification, and regression risk.
