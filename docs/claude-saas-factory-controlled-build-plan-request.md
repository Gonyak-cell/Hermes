# Claude Planning Request: Hermes SaaS Factory Controlled Build Plan

## Requested Engine

- Target reviewer/planner: Claude Code Fable 5 Ultracode
- Requested effort: xhigh
- Requested mode: workflow planning only
- Permission mode: plan/read-only

## Non-Negotiable Boundary

Do not mutate source files.
Do not apply patches.
Do not create commits.
Do not run deployment.
Do not connect external services.
Do not request or inspect secrets.
Do not claim final approval, production PASS, enterprise PASS, protected closeout, or launch readiness.

Treat this response as an implementation plan proposal only. Codex and the human owner will review it once before any implementation starts.

## Product Premise

Hermes is not primarily an end-user SaaS application.

Hermes is a SaaS Factory / Product Operating Platform: a control-plane system for creating, governing, verifying, reviewing, and preparing other SaaS products and domain workflows.

The next strategic step is not "build the vertical SaaS app." The next step is to move Hermes from control-plan-only factory readiness toward a controlled build factory that can safely prepare project templates, work packets, patch candidates, validation plans, review packets, and eventually receipt-gated write/deploy candidates.

## Current Known State

The following surfaces already exist and should be treated as source context:

- `docs/product-domain-saas-factory.md`
- `docs/controlled-execution-write-deploy.md`
- `docs/hermes-roadmap-p15001-p15400.md`
- `docs/hermes-roadmap-p15401-p15800.md`
- `docs/hermes-roadmap-p15801-p16200.md`
- `docs/architecture.md`
- `src/product-domain-saas-factory.mjs`
- `src/controlled-execution-write-deploy.mjs`
- `src/saas-factory-mode.mjs`
- `src/connector-external-app-governance.mjs`
- `src/execution-write-authority-maturity.mjs`
- `src/product-build-verification-loop.mjs`
- `artifacts/product-domain-saas-factory/latest/product-domain-saas-factory.json`
- `artifacts/controlled-execution-write-deploy/latest/controlled-execution-write-deploy.json`
- `artifacts/saas-factory-mode/latest/saas-factory-mode.json`
- `artifacts/connector-external-app-governance/latest/connector-external-app-governance.json`
- `artifacts/execution-write-authority-maturity/latest/execution-write-authority-maturity.json`
- `artifacts/product-build-verification-loop/latest/product-build-verification-loop.json`

Recent validation observations:

- `npm run platform:product-domain-saas-factory -- --check` passes and reports `ready_for_product_domain_saas_factory_v0`.
- `npm run platform:product-build-verification-loop -- --check` passes and reports `ready_for_product_build_verification_loop`.
- `npm run platform:saas-factory-mode -- --check` validates but remains `blocked_saas_factory_mode`, with project creation, repo write, and deployment disabled.
- `npm run platform:connector-external-app-governance -- --check` validates but remains `blocked_connector_external_app_governance`, with external app connection and connector write disabled.
- `npm run platform:execution-write-authority-maturity -- --check` may remain blocked until its source and Claude execution/write receipt requirements are satisfied.

## Planning Objective

Produce a detailed implementation plan for the currently missing core needed to evolve Hermes into a practical SaaS-building SaaS Factory.

Focus on the transition from:

```text
read-only control plans and verification projections
```

to:

```text
reviewed, receipt-gated, operator-controlled build factory lanes
```

The plan must preserve Hermes authority boundaries while making the system operationally useful.

## Missing Core To Plan

Cover all of these areas:

1. Factory Operator Workbench
   - UI/API surfaces for project registry, templates, requirements, work packets, validation, reviews, blockers, candidate patches, receipts, and next actions.

2. Project Template And Instantiation Lane
   - Template contract for new SaaS projects.
   - Domain-pack composition.
   - Starter artifact references.
   - Approval boundary before repo/worktree creation.

3. Persistent Product Registry And State Store
   - Product/project registry.
   - Requirement graph.
   - Work packet ledger.
   - Evidence graph.
   - Review receipt and finding loop store.
   - State transition model.

4. Controlled Repo/Worktree Write Lane
   - Candidate-only patch generation.
   - Diff packet.
   - Rollback plan.
   - Preflight validation.
   - Human receipt requirement.
   - No direct apply until explicit protected gate.

5. Connector Provisioning And Sync Governance
   - External app registry.
   - OAuth/consent plan.
   - Quarantine and redaction.
   - Read-only sync first.
   - Future write connector gate.

6. End-To-End SaaS Build Workflow
   - Spec or PRD intake.
   - Requirement/TUW decomposition.
   - Implementation packet.
   - Test/evidence binding.
   - Claude review packet.
   - Finding loop.
   - Revalidation.
   - Release candidate readiness.

7. Promotion Gates
   - Control-plan-only to read-only factory.
   - Read-only factory to candidate generation.
   - Candidate generation to receipt-gated apply.
   - Receipt-gated apply to limited execution.
   - Limited execution to release candidate.
   - Release candidate to deploy-ready.

## Required Output Shape

Return one Markdown plan with these sections:

1. Executive Decision
   - One-paragraph recommendation.
   - Whether to implement as one tranche or multiple tranches.

2. Current State Diagnosis
   - What is already implemented.
   - What is blocked by design.
   - What is genuinely missing.

3. Target Architecture
   - Components.
   - Data contracts.
   - State machine.
   - UI/API surfaces.
   - Validation/review/receipt gates.

4. Proposed Phase Plan
   - Use concrete phase IDs.
   - Each phase must include:
     - Objective
     - Source bindings
     - Files likely to change
     - New or updated schemas
     - New or updated scripts
     - New or updated tests
     - New or updated docs
     - Validation commands
     - Negative fixtures
     - Authority boundary
     - Acceptance criteria
     - Handoff condition

5. First Executable Slice
   - Recommend the smallest high-leverage first implementation slice.
   - It must be safe to implement after one human/Codex review.
   - It must not open direct write, deployment, external connector write, or final approval.

6. Risks And Design Tradeoffs
   - Include over-automation risk.
   - Include false readiness risk.
   - Include reviewer authority drift.
   - Include cross-project data boundary risk.
   - Include UI action affordance risk.

7. Review Checklist For Codex And Human Owner
   - A short checklist we can use before implementation.

8. Structured Plan Summary
   - Provide a JSON block with:
     - `recommended_program_range`
     - `first_slice_id`
     - `first_slice_title`
     - `phase_count`
     - `requires_human_approval_before_implementation`
     - `opens_project_creation_now`
     - `opens_repo_write_now`
     - `opens_connector_write_now`
     - `opens_deployment_now`
     - `opens_production_pass_now`
     - `opens_enterprise_pass_now`
     - `recommended_validation_commands`
     - `primary_files_to_review`

## Required Planning Constraints

- Prefer existing Hermes patterns over new frameworks.
- Use deterministic scripts and schemas before prose-only documentation.
- Use `node --test` for tests.
- Keep dependencies light.
- Do not introduce external services, API keys, or network requirements.
- Preserve project/domain boundaries.
- Every generated protected output needs a human review note.
- Claude output is planning evidence, not approval.
- Codex output is implementation material, not final approval.
- Human owner review is required before implementation.
- Single-owner mode must remain lower-trust internal readiness only.

## Important Negative Requirements

The plan must explicitly keep these false in the first executable slice:

- `project_creation_allowed_now`
- `repo_write_allowed_now`
- `connector_write_allowed_now`
- `deployment_allowed_now`
- `protected_action_allowed_now`
- `codex_final_approval_allowed`
- `claude_final_approval_allowed`
- `production_pass_enabled`
- `enterprise_pass_enabled`

## Reviewer Note

If the best plan is to re-sequence existing roadmap items rather than create new product areas, say so clearly.

If existing artifacts already cover a missing core area, distinguish between:

- contract exists
- projection exists
- UI exists
- executable implementation exists
- receipt-gated execution exists

Do not collapse those into a single "implemented" claim.
