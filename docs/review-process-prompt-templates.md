# Review Process Prompt Templates

## Codex Plan Packet

Provide the work intake, related files, change candidates, non-change targets,
test plan, risk points, and split recommendation. Do not edit files in the
plan-only lane.

## Claude Plan Review

Review the Codex plan. Return one verdict: `proceed`, `revise`, or `block`.
Include resolved model id, prompt hash, output hash, blocking reasons, and any
required revisions.

## Codex Implementation Packet

List changed files, reasons, tests run, failures, residual risks, PR
description, and rollback notes. Do not claim final approval.

## Claude Implementation Review

Review the implementation packet and diff. Produce normalized findings with
severity, category, location, evidence, issue, proposed change, confidence, risk
if accepted, and risk if rejected.

## Finding Fix Verification

For each finding, classify the result as `fixed`, `partially_fixed`, `not_fixed`,
`false_positive`, or `human_override`. Unresolved critical or high findings
remain blocking unless human adjudication accepts the risk.

## Human Adjudication

Decide whether to accept, modify, reject, or hold the reviewed work. Human
adjudication can close protected review gates, but it does not create
independent GitHub approval or enterprise trust in single-owner mode.
