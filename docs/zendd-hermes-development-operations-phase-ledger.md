# Zendd-Hermes Development Operations Phase Ledger (P761-P1040)

P761 starts after the P760 physical integration decision. Zendd remains an
external checkout, while Hermes becomes the operator surface for controlled
development, evidence, review, rollback, and human receipt flow. The attached
Supabase-inspired design resources are normalized into Hermes operator design
tokens instead of being copied as a branded frontend.
The P761-P1000 segment remains the frozen Zendd external adapter development
program; P1001-P1040 adds actual checkout preflight on top of that baseline.

## P761-P780 Frontend Shell And External Adapter Operation

`project:zendd-frontend-operation-shell -- --check` creates the first read-only
operator UI shell and external adapter operation contract. It consumes the P741
physical integration decision, the normalized Hermes operator design tokens, and
this phase ledger.

Acceptance for P761-P780:

- P761 consumes P741-P760 and requires
  `external_adapter_selected_for_safe_operation`.
- P762 normalizes attached design resources into Hermes-owned tokens with
  separated light/dark values and no undefined or negative letter spacing.
- P763 records the external adapter operation contract with Zendd source,
  secret, raw VDR, client material, DB migration, release, package, and receipt
  application boundaries intact.
- P764-P766 creates a static operator shell contract for status band, phase
  plan, claim matrix, blocked action queue, and next-action panel.
- P767-P770 records read-only route/API surface rows for future dashboard/API
  integration without starting a server or executing protected actions.
- P771-P775 records protected mutation blocks for code write, raw material
  copy, secret read, DB migration, release/package, receipt application, and
  physical movement.
- P776-P779 writes HTML/CSS artifacts for operator review without adding a
  runtime framework or mutating Zendd.
- P780 closes as `ready_for_zendd_frontend_operation_shell`.

## P781-P800 Work Order Intake

`project:zendd-work-order-intake -- --check` converts Zendd request classes into
deterministic work order rows. A PASS in this phase only means
`accepted_for_planning_only`; it never authorizes Zendd mutation, command
execution, raw VDR/client material copying, secret reading, receipt application,
DB migration, release/package execution, or recovery execution.

Acceptance for P781-P800:

- P781 consumes P761-P780 and requires
  `ready_for_zendd_frontend_operation_shell`.
- P782 records a reference-only intake policy with command execution, mutation,
  secret reads, raw material copy, receipt application, and protected execution
  all disabled.
- P783-P784 declares Zendd feature, bug, VDR/LDD, backend, frontend, Electron,
  release, recovery, secret, and receipt-application request classes without raw
  payloads.
- P785-P787 classifies every request with risk level, reviewer, hard gate,
  receipt requirement, and next action.
- P788-P793 emits work order rows with evidence ref, rollback target, verdict,
  owner, block reason when needed, and next allowed action.
- P794-P797 keeps protected work orders as documented BLOCK until human receipt
  and future protected-action gates exist.
- P798 declares read-only work order route/API surfaces without starting a
  server.
- P799 proves intake performed no Zendd mutation, command execution, raw copy,
  secret read, receipt application, release/package execution, DB migration, or
  recovery execution.
- P800 closes as `ready_for_zendd_work_order_intake`.

## P801-P820 Safe Patch Lane

`project:zendd-safe-patch-lane -- --check` promotes only non-protected
planning work orders into safe patch candidates. This phase opens review
candidates, not automatic writes: the command performs no Zendd file write,
command execution, secret read, raw material copy, receipt application, DB
migration, release/package action, physical movement, or recovery execution.

Acceptance for P801-P820:

- P801 consumes P781-P800 and requires `ready_for_zendd_work_order_intake`.
- P802 re-attaches the P521 dirty-tree inventory as read-only evidence.
- P803 records a safe patch policy where candidate review is open but automatic
  patching, unscoped writes, command execution, and protected actions are false.
- P804-P806 promotes only `accepted_for_planning_only` non-protected work orders
  into patch candidate PASS rows.
- P807-P810 partitions patch scopes into future-eligible frontend/backend/electron
  source scopes and documented BLOCK rows for raw material, secrets, DB
  migrations, release/package, receipt application, and physical movement.
- P811-P812 records dirty-tree guards and blocks unscoped writes when dirty-tree
  rows exist.
- P813-P815 binds every patch candidate to evidence ref, reviewer, hard gate,
  rollback target, and dirty-tree guard.
- P816-P818 keeps protected work orders and protected file scopes as documented
  BLOCK with block reason, owner, hard gate, receipt requirement, rollback target,
  and next action.
- P819 proves the phase performed no Zendd write, command execution, raw copy,
  secret read, receipt application, release/package, DB migration, or recovery
  execution.
- P820 closes as `ready_for_zendd_safe_patch_lane`.

## P821-P840 Command Evidence Execution Bridge

`project:zendd-command-evidence-execution-bridge -- --check` converts the
P561 command catalog and P801 safe patch lane into future execution packets.
This phase still does not run Zendd commands. It prepares evidence capture rows
for test, lint, typecheck, validate, and verify commands; keeps build commands
blocked until artifact isolation exists; and keeps database migration,
runtime/server, release/package, dependency, receipt application, raw material,
secret, and unclassified command execution as documented BLOCK.

Acceptance for P821-P840:

- P821 consumes P801-P820 and requires `ready_for_zendd_safe_patch_lane`.
- P822 consumes P561-P580 and requires
  `ready_for_vdr_ldd_source_contract_bridge`.
- P823 records an execution bridge policy where check-mode command execution,
  Zendd file write, raw log storage, raw stdout/stderr storage, secret read, raw
  material copy, DB migration, build artifact execution, release/package,
  receipt application, and protected action execution are all false.
- P824-P826 classifies test, lint, typecheck, validate, check, and verify
  commands as future verification execution candidates with evidence refs,
  reviewer refs, hard gates, redaction report refs, stdout/stderr hash refs,
  cwd refs, timeout policy refs, and no execution in check.
- P827-P831 prepares command execution packet rows for each verification
  candidate without running the command.
- P832-P835 binds command outputs to pending hash refs, redaction report refs,
  and safe excerpt refs while storing no raw logs, secrets, raw VDR material, or
  client material.
- P836 blocks build commands until a later artifact-isolated sandbox exists.
- P837-P838 blocks database migration, runtime/server, release/package,
  dependency/mutating, receipt application, and unclassified commands with block
  reason, owner, hard gate, human gate when protected, rollback target, and next
  allowed action.
- P839 proves the phase performed no Zendd command execution, file write, raw
  copy, secret read, receipt application, DB migration, release/package, build
  artifact execution, or protected recovery.
- P840 closes as `ready_for_zendd_command_evidence_execution_bridge`.

## P841-P860 Protected Action Escalation

`project:zendd-protected-action-escalation -- --check` converts protected
command blocks and domain protected actions into escalation packets. This phase
opens a protected-action queue only; it does not execute Zendd commands, run
database migrations, package releases, export client materials, apply receipts,
execute rollback, copy raw VDR/client material, read secrets, move code, or grant
synthetic receipts.

Acceptance for P841-P860:

- P841 consumes P821-P840 and requires
  `ready_for_zendd_command_evidence_execution_bridge`.
- P842 reuses the P721-P740 protected action rollback hardening as the rollback
  and protected-action source.
- P843 records an escalation policy where protected execution, command
  execution, release/package, DB migration, client export, receipt application,
  rollback execution, physical code movement, raw copy, secret read, and
  synthetic receipt are all false.
- P844-P846 converts protected command execution blocks into protected action
  request rows with evidence ref, hard gate, human receipt ref, rollback target,
  owner, block reason, and next action.
- P847-P850 converts domain protected actions such as client export, receipt
  application, rollback execution, physical movement, external checkout
  mutation, and VDR/LDD source write into escalation request rows.
- P851-P854 creates draft-only escalation packet rows for every request. Packets
  are not submitted, do not create PASS candidates, and cannot execute protected
  actions.
- P855-P856 binds every packet to a human gate where real human receipt is
  required, synthetic receipt is forbidden, and missing receipt remains BLOCK.
- P857-P858 proves fail-closed behavior for required protected classes, draft
  packets, human gates, receipt application, rollback execution, raw material,
  and secrets.
- P859 proves the phase performed no Zendd command execution, protected action,
  release/package, DB migration, receipt application, rollback execution, raw
  copy, secret read, or code movement.
- P860 closes as `ready_for_zendd_protected_action_escalation`.

## P861-P880 Diff Review And Rollback Binding

`project:zendd-diff-review-rollback-binding -- --check` converts Zendd dirty
tree metadata into review packets, rollback target bindings, protected diff
blocks, and operator next actions. This phase does not read raw diffs, store raw
file content, apply Zendd diffs, write Zendd files, run Zendd commands, apply
receipts, execute rollback, copy raw VDR/client material, read secrets, or move
code.

Acceptance for P861-P880:

- P861 consumes P841-P860 and requires
  `ready_for_zendd_protected_action_escalation`.
- P862 keeps the P801-P820 safe patch lane and P521 dirty tree inventory as
  metadata-only sources.
- P863 records a diff review policy where diff apply, Zendd file write, command
  execution, protected action execution, receipt application, rollback
  execution, raw diff storage, raw file content read, raw material copy, secret
  read, unreviewed diff PASS, and protected-path PASS without receipt are all
  false.
- P864-P866 turns each dirty tree row into a diff inventory row with
  `diff_ref`, `evidence_ref`, `reviewer_ref`, `hard_gate_ref`,
  `rollback_target_ref`, owner, block reason, and next action. Clean checkout
  metadata may PASS; dirty diffs remain BLOCK.
- P867-P870 creates blocked review packet rows for every dirty diff. Packets
  are pending human review, require human receipt, store no raw diff payload,
  and cannot become PASS candidates.
- P871-P873 binds each review packet to a rollback target while rollback
  execution stays future-only.
- P874-P877 blocks protected diffs including secret/env candidates, raw
  domain/VDR/client materials, generated artifacts, dependency or lockfile
  changes, database migration paths, release/package paths, receipt paths, and
  unclassified paths.
- P878-P879 proves fail-closed behavior for source readiness, raw-content
  absence, review packets, rollback targets, protected diff blocks, no
  execution/write, and blocked next actions.
- P880 closes as `ready_for_zendd_diff_review_rollback_binding`.

## P881-P900 Release Candidate Sandbox

`project:zendd-release-candidate-sandbox -- --check` creates a release-candidate
sandbox view over Zendd release/recovery claims, command evidence packets, and
diff-review rollback bindings. This phase does not execute commands, build or
package artifacts, publish, deliver client outputs, write Zendd files, apply
receipts, execute rollback, copy raw artifacts or VDR/client material, read
secrets, or promote release candidate PASS.

Acceptance for P881-P900:

- P881 consumes P861-P880 and requires
  `ready_for_zendd_diff_review_rollback_binding`.
- P882 reuses P681-P700 release/recovery claims and rollback targets as the
  release source.
- P883 reuses P821-P840 command evidence execution packets and protected build
  or package command blocks as command/artifact sources.
- P884 records a sandbox-only policy where release candidate PASS, command
  execution, build artifact execution, package build, publish, client export,
  client delivery, database migration, Zendd file write, artifact
  materialization/upload, receipt application, rollback execution, raw artifact
  copy, raw VDR/client copy, raw log storage, secret read, and synthetic receipt
  are all false.
- P885-P888 creates blocked release candidate sandbox rows for every release
  claim with sandbox packet, command evidence ref, artifact isolation ref,
  artifact hash ref, diff review ref, reviewer, hard gate, human receipt, and
  rollback target.
- P889-P891 blocks build/package artifact paths until artifact-isolated evidence
  and human receipt exist.
- P892-P894 blocks client export and delivery behind attorney/operator receipt
  and redacted release evidence.
- P895-P897 creates draft-only sandbox evidence packet rows. Packets do not have
  command execution evidence, artifact hash, or human receipt payload yet.
- P898-P899 proves fail-closed behavior for source readiness, blocked release
  candidates, artifact isolation, client delivery, sandbox packets, no
  execution/write/publish/delivery, no raw exposure, and no PASS without
  receipt.
- P900 closes as `ready_for_zendd_release_candidate_sandbox`.

## P901-P920 VDR/LDD Workflow Adapter

`project:zendd-vdr-ldd-workflow-adapter -- --check` connects Zendd VDR/LDD
workflows to Hermes by stable refs and redacted summaries only. It does not copy
raw VDR/client material, does not store raw fact/OCR text, does not mutate Zendd,
does not generate client output, does not deliver client material, does not
apply receipts, does not publish a release candidate, and does not grant
automatic legal PASS.

Acceptance for P901-P920:

- P901 consumes the P641-P660 client output gate and P881-P900 release
  candidate sandbox.
- P902-P903 declares the workflow adapter as a reference-only/no-mutation
  surface. VDR source mutation, LDD workflow mutation, client-output generation,
  client delivery, receipt application, release publish, raw material copy, raw
  fact/OCR storage, secret reads, and automatic legal PASS remain false.
- P904-P908 creates VDR/LDD workflow adapter rows with `claim_id`,
  `source_trace_ref`, `fact_claim_ref`, `issue_ref`, `citation_ref`,
  `redacted_summary_ref`, quality/conflict/privilege gates, reviewer/hard gate,
  and human receipt refs. Every row is documented BLOCK.
- P909-P911 creates source-span mapping rows that preserve source span and
  citation refs without raw source text.
- P912-P915 binds Korean quality, citation, conflict, privilege, exposure, and
  receipt gates. Missing gate evidence remains BLOCK.
- P916-P918 exposes operator rows with current verdict, missing evidence,
  missing reviewer/receipt, block reason, responsible owner, and next action.
- P919 proves fail-closed behavior for no raw copy, no mutation, no client
  delivery, no receipt application, no release publish, and no automatic legal
  PASS.
- P920 closes as `ready_for_zendd_vdr_ldd_workflow_adapter`.

## P921-P940 Human Receipt Intake For Zendd

`project:zendd-human-receipt-intake -- --check` creates the Zendd-specific
human receipt intake surface for VDR/LDD workflow claims and protected-action
human gates. It creates templates, queues, validation packets, quarantine rows,
and approval closeout rows, but it does not materialize receipt payloads,
validate receipts, apply receipts, grant protected PASS, accept synthetic
receipts, store raw receipt attachments, copy raw VDR/client material, or read
secrets.

Acceptance for P921-P940:

- P921 consumes the P901-P920 VDR/LDD workflow adapter and P841-P860 protected
  action escalation.
- P922-P923 declares receipt intake as future-only: queue surfaces may exist,
  but payload materialization, payload validation, receipt application,
  protected PASS, synthetic receipts, unbound receipts, cross-project receipts,
  raw attachment storage, raw VDR/client copy, and secret reads remain false.
- P924-P926 creates receipt templates for every VDR/LDD workflow claim and every
  protected-action human gate. Each template has claim, source, evidence,
  reviewer, hard gate, human receipt, reviewer role, required fields, block
  reason, owner, and next action.
- P927-P929 creates pending queue rows without receipt payloads or raw
  attachments.
- P930-P932 creates validation packets but keeps validation future-only until an
  explicit human payload exists.
- P933-P935 quarantines unknown-claim, cross-project, synthetic, raw VDR/client,
  secret-like, overbroad, unsigned, and role-mismatch receipt candidates.
- P936-P938 creates approval closeout rows that keep every protected PASS
  blocked while receipts are missing.
- P939 proves fail-closed behavior for no payload, no validation, no application,
  no protected PASS, no synthetic receipt, no raw material, and no secret read.
- P940 closes as `ready_for_zendd_human_receipt_intake`.

## P941-P960 Recovery And Incident Drafts

`project:zendd-recovery-incident-drafts -- --check` converts failure and
recovery situations into incident draft rows that still obey the external Zendd
adapter boundary. It consumes P921-P940 human receipt intake, P881-P900 release
candidate sandbox, and P861-P880 diff review rollback binding. The layer does
not run recovery, rollback, commands, migrations, file writes, receipt
application, client delivery, raw log storage, raw VDR/client copy, or secret
reads.

Acceptance for P941-P960:

- P941-P943 verify that human receipt intake, release candidate sandbox, and
  diff review rollback binding are ready before incident drafts are produced.
- P944 fixes a draft-only incident policy with every protected execution flag
  false.
- P945-P948 model broken build, failed command capture, stale VDR/LDD data, bad
  migration draft, dirty tree conflict, receipt intake failure, release sandbox
  failure, client-output recovery, backend outage, and rollback-to-clean-checkout
  as documented BLOCK rows.
- P949-P951 bind every incident to a rollback target while keeping rollback
  target materialization and execution disabled.
- P952-P954 create recovery receipt drafts without payloads, validation, or
  application.
- P955-P957 expose incident verdict, missing evidence, missing receipt, hard
  gate, block reason, owner, and next action for the operator dashboard.
- P958-P959 fail-close if recovery execution, rollback, command execution,
  Zendd writes, migrations, client delivery, raw logs, raw VDR/client material,
  secrets, or receipt application become available.
- P960 closes with recovery incident drafts ready and advances only to the
  active operator dashboard.

## P961-P980 Active Operator Dashboard

`project:zendd-active-operator-dashboard -- --check` promotes the P761 shell
into an active, deterministic operator dashboard and read-only API projection.
It consumes work order intake, command evidence, protected action escalation,
and recovery incident drafts. The dashboard is an inspection surface over
Hermes artifacts, not a Zendd source of truth and not a protected-action
executor.

Acceptance for P961-P980:

- P961 confirms the frontend operation shell is ready.
- P962-P963 confirm work orders, command evidence, protected escalation, and
  recovery incident drafts are ready.
- P964-P966 create widgets for work orders, blocked actions, missing evidence,
  missing receipts, command evidence, incident drafts, release/client blocks,
  and next actions.
- P967-P968 define GET-only API route projections and do not start a server.
- P969-P970 bind widgets and routes to deterministic artifact refs only.
- P971-P973 surface missing evidence, hard gate, human receipt, owner, and next
  action rows.
- P974-P976 surface next allowed actions without executing them.
- P977 emits deterministic read-only HTML/CSS/API-manifest artifacts.
- P978-P979 fail-close if the dashboard starts a server, mutates routes,
  executes commands/protected actions, applies receipts, promotes PASS, copies
  raw VDR/client material, stores raw logs, or reads secrets.
- P980 closes with active operator dashboard ready and advances only to the
  final development freeze cockpit.

## P981-P1000 Development Freeze Cockpit

`project:zendd-development-freeze-cockpit -- --check` re-adjudicates the full
P761-P980 Zendd development adapter program as freeze claims. The cockpit
accepts only two outcomes: PASS with evidence/reviewer/hard-gate/rollback target
and unsafe flags false, or documented BLOCK with block reason, owner, protected
human gate where needed, rollback target, and next allowed action.

Acceptance for P981-P1000:

- P981 verifies the active operator dashboard source.
- P982 verifies the human receipt intake source so protected claims can be
  tested against receipt/gate refs.
- P983 fixes a no-mutation freeze policy.
- P984-P985 convert P761-P980 phase readiness into PASS claims only when source
  statuses are ready and evidence/reviewer/gate/rollback refs are present.
- P986-P991 convert unresolved dashboard missing inputs and next actions into
  documented BLOCK claims.
- P992-P994 expose read-only cockpit panels for freeze status, PASS count,
  documented BLOCK count, missing inputs, next actions, and unsafe flags.
- P995-P997 adjudicate every claim as PASS or documented BLOCK.
- P998-P999 fail-close if any PASS lacks evidence, reviewer/gate, required
  protected receipt, rollback target, or unsafe false, or if any BLOCK lacks
  reason, owner, or next action.
- P1000 closes the Zendd external adapter development program without command
  execution, recovery, rollback, receipt application, PASS promotion, raw copy,
  raw log storage, route mutation, server start, or secret read.

## P1001-P1040 Actual Zendd Checkout Preflight

`project:zendd-actual-checkout-preflight -- --check` inspects the real external
Zendd checkout as a read-only reference target after the P1000 development
freeze. It does not move Zendd code, edit files, install packages, run Zendd
commands, start servers, read env files, read raw logs, read raw VDR/client
material, run Alembic, or promote any Zendd claim to PASS solely because a
script or marker exists.

Acceptance for P1001-P1040:

- P1001-P1005 locate the configured external Zendd root, git identity, source of
  truth, read-only probe policy, and dirty-path redaction rule.
- P1006-P1010 keep dirty checkout information hashed or classified only, with no
  raw path values required for Hermes operation.
- P1011-P1020 inventory root package, frontend package, lockfiles, Vite,
  frontend source, backend pyproject, backend tests, Alembic config, and
  migrations as stack markers.
- P1021-P1022 classify env/secret, raw material, client-output, and raw-log
  surfaces as reference-only BLOCK rows without opening their contents.
- P1023-P1028 classify build, package, runtime, setup, database, migration, and
  checkout mutation actions as protected and human-receipt gated.
- P1029-P1030 lock the external checkout mutation and claim-preflight freeze
  boundaries before any future Zendd work loop.
- P1031-P1034 convert root/frontend/backend test, lint, build, runtime, and
  Alembic candidates into evidence command candidates without executing them.
- P1035-P1037 attach reviewer, hard gate, human receipt where protected,
  rollback target, block reason, responsible owner, and next action to protected
  command/action candidates.
- P1038-P1039 convert locator, stack, command, protected action, and boundary
  rows into PASS or documented BLOCK claims.
- P1040 closes the actual checkout preflight only if every PASS has evidence,
  reviewer/gate, rollback target, and unsafe=false, and every BLOCK has block
  reason, owner, next action, and protected human gate where needed.
