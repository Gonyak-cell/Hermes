# Zendd-Hermes Integration Phase Ledger (P521-P760)

P521 starts the Zendd-Hermes integration program after the P520 claim
adjudication slice. The program treats Zendd as an external execution engine
for M&A, VDR, LDD, report, and desktop workflows while Hermes remains the
project operations, evidence, claim, receipt, and freeze harness.

## P521-P525 Safe Integration Setup

- P521: `project:zendd-integration-setup` records the integration ADR. The
  selected option is federated external-project integration; direct directory
  import, immediate subtree/submodule, and monorepo merge remain rejected until
  later evidence proves they are safe.
- P522: `project:zendd-integration-setup` records a read-only Zendd baseline:
  external project root, git head/status, root/frontend package scripts,
  backend `pyproject.toml` metadata, Electron marker, and VDR/LDD capability
  markers. It does not run Zendd build/test commands.
- P523: `project:zendd-integration-setup` classifies the Zendd dirty tree into
  source/test changes, generated/dependency artifacts, domain document/data
  artifacts, secret/env candidates, or documented unclassified blocks. Every row
  keeps `mutation_allowed=false` and records `next_allowed_action`.
- P524: `project:zendd-integration-setup` builds a feature parity matrix across
  Hermes and Zendd. Each feature is classified as standardize in Hermes, bridge
  Zendd to Hermes, improve Hermes from Zendd, improve Zendd from Hermes, mutual
  hardening, bridge status only, or defer until evidence.
- P525: `project:zendd-integration-setup` records the first
  `project.zendd` boundary contract. Zendd remains the source of truth for its
  app/runtime/data, Hermes remains read-only governance, raw VDR material is not
  copied into Hermes, `.env` and secret values are not read, Zendd mutation stays
  blocked, and protected output cannot PASS without evidence, review, and
  receipt.

## P526-P540 Boundary Realization

- P526-P530: implement `project:zendd-boundary -- --check` as a dedicated
  boundary verifier that consumes P521-P525 setup artifacts and fails closed
  when the external project root, dirty-tree policy, secret boundary, or raw
  material boundary is missing.
- P531-P535: add a project-scoped command catalog for Zendd. Commands are
  declared as observed, check-mode candidate, mutating, packaging, database, or
  prohibited; setup phases still do not execute them.
- P536-P540: close the boundary tranche with a documented PASS/BLOCK ledger and
  explicit `next_allowed_action` for every blocked Zendd capability.

Acceptance for P526-P540:

- `project.zendd` is registered as an external subproject under the `law-firm`
  domain pack with `code_directory_move_allowed=false`.
- Observation rows are metadata/presence only: no raw document content, raw VDR
  content, `.env` content, or secret values.
- Zendd package scripts are cataloged but every command keeps
  `execution_allowed_in_boundary_phase=false`.
- Raw VDR/client material remains reference-only. Hermes can receive
  `stable_reference_id`, `redacted_summary`, `evidence_ref`, and
  `review_receipt_ref`, not raw files.
- Every prohibited operation and blocked capability records `block_reason`,
  `responsible_owner`, and `next_allowed_action`.
- Protected Zendd claims remain `pending_human_receipt` or BLOCK until evidence,
  reviewer/hard gate, and required human receipt exist.

## P541-P760 Forward Plan

- P541-P560: Zendd dev harness adapter.
- P561-P580: command evidence bridge.
- P581-P600: VDR/LDD source contract bridge.
- P601-P620: fact/evidence/issue bridge.
- P621-P640: human review receipt bridge.
- P641-P660: client output gate fusion.
- P661-P680: operator surface bridge.
- P681-P700: release and recovery bridge.
- P701-P720: cross-system claim freeze.
- P721-P740: protected action and rollback hardening.
- P741-P760: physical integration decision with subtree/submodule/workspace
  movement deferred unless evidence proves it safer than the external adapter.

## P541-P560 Dev Harness Adapter

`project:zendd-dev-harness -- --check` turns Zendd into a Hermes-managed
development target without permitting edits yet.

Acceptance for P541-P560:

- P541 records `project.zendd` as a read-only development profile under the
  `law-firm` domain pack.
- P542 requires every Zendd change request to become a work order packet with
  claim, evidence, reviewer/gate, owner, next action, and human receipt when
  protected.
- P543 maps VDR, LDD fact/issue, client-output, backend, frontend, Electron,
  release/recovery, and security requests into scoped Zendd intake rows.
- P544 models backend, frontend, Electron, VDR, LDD, client-output, release,
  and security lanes while keeping lane/worktree creation blocked.
- P545 requires diff review before mutation and excludes raw VDR and secret
  diffs.
- P546 catalogs test/lint/check scripts as candidates only; execution waits for
  P561-P580 command evidence bridge.
- P547 keeps VDR source, LDD fact/issue, client output, DB migration, release,
  secret, and physical integration routes receipt-gated.
- P548-P550 add update packet, operator status, and mutation preflight records
  that remain BLOCKED with `block_reason`, `responsible_owner`, and
  `next_allowed_action`.
- P551-P560 maps Hermes personal-dev functions to either read-only readiness or
  documented BLOCK with next action.

## P561-P580 Command Evidence Bridge

`project:zendd-command-evidence -- --check` maps Zendd package scripts to
Hermes command evidence claims. It still does not execute Zendd commands.

Acceptance for P561-P580:

- P561 declares that command execution is disabled until command evidence
  capture is explicitly requested.
- P562 assigns every cataloged Zendd command a `claim_id`,
  `command_evidence_ref`, expected artifact ref, reviewer/hard gate ref,
  verdict, block reason, responsible owner, and next allowed action.
- P563-P564 require log redaction: raw logs, secret values, raw VDR payloads,
  and unscoped client documents cannot be stored as evidence.
- P565 binds every command evidence row to a reviewer or hard gate.
- P566 declares the command PASS formula:
  claim -> command evidence -> redaction report -> reviewer/hard gate ->
  human receipt when protected -> PASS or BLOCK.
- P567 keeps runtime, database, packaging, dependency, and mutating commands
  protected and BLOCKED until receipt-backed work orders exist.
- P568 records a future capture plan without executing any Zendd command.
- P569-P580 freezes every command evidence claim as documented BLOCK until
  evidence capture exists; every BLOCK has `block_reason`, `responsible_owner`,
  and `next_allowed_action`.

## P581-P600 VDR/LDD Source Contract Bridge

`project:zendd-source-contract -- --check` compares Hermes resource analysis
gates and Zendd VDR/LDD source gates, records mutual improvement rows, and
creates reference-only source contract rows.

Acceptance for P581-P600:

- P581 declares the source contract policy: Hermes receives stable refs,
  redacted evidence, source gate refs, reviewer refs, and human receipt refs,
  not raw VDR/client material.
- P582-P583 records the difference between Hermes resource gates and Zendd
  VDR/LDD gates. Hermes contributes quarantine, duplicate detection, resource
  lineage, evidence surfaces, and operator status. Zendd contributes
  matter-scoped VDR classification, LDD source control, fact spans, issue
  linkage, citation trace, and client-output source trace.
- P584-P590 creates VDR/LDD source contract rows for upload manifest,
  classification result, source-control state, fact source span, issue linkage,
  client-output trace, redaction report, and citation/evidence surface. Every
  row has `claim_id`, `stable_source_ref`, `evidence_ref`,
  `redacted_summary_ref`, Hermes gate ref, Zendd gate ref, reviewer/hard gate
  ref, `block_reason`, `responsible_owner`, and `next_allowed_action`.
- P591 blocks raw VDR payloads, raw client documents, full OCR text, secret
  values, env values, and unscoped client paths from Hermes source evidence.
- P592-P594 records cross-system improvements: Hermes learns legal
  source-control and fact-span evidence types from Zendd; Zendd learns Hermes
  quarantine lineage, duplicate evidence refs, PASS/BLOCK wording, and operator
  next-action surfaces; both systems share redacted evidence refs and hashes.
- P595 declares that source PASS cannot happen without stable source ref,
  redacted summary, reviewer/hard gate, and protected human receipt.
- P596-P598 binds every source row to review and receipt requirements.
- P599-P600 freezes every source claim as documented BLOCK until source
  evidence, review, and receipt exist.

## P601-P620 Fact/Evidence/Issue Bridge

`project:zendd-fact-issue-bridge -- --check` turns Zendd fact engine, issue
linkage, source-span, and client-output source trace outputs into Hermes claim
rows. It still does not run Zendd, copy raw source material, or store raw fact
text in Hermes.

Acceptance for P601-P620:

- P601 declares the fact/issue bridge policy. Fact PASS requires fact ref,
  source contract ref, stable source ref, evidence ref, redacted summary ref,
  reviewer/hard gate, and protected human receipt.
- P602-P608 creates fact claim rows for document inventory, VDR
  classification, LDD source control, fact source span, issue linkage,
  client-output trace, redaction report, and citation/evidence surface. Every
  row is tied back to a P581-P600 source contract row.
- P609-P612 creates issue bridge rows linked to fact claims and missing-evidence
  surfaces.
- P613 declares that auto PASS, low-confidence PASS, confidence without source,
  and conflicting-source PASS are not allowed.
- P614-P616 adds fail-closed fixtures for missing source span, contradictory
  source evidence, stale VDR classification, cross-matter source mixing,
  unsupported client-facing sentence, and privileged source exposure.
- P617-P618 binds every fact and issue row to review and human receipt
  requirements.
- P619-P620 freezes every fact and issue claim as documented BLOCK until
  evidence, review, and receipt exist.

## P621-P640 Human Review Receipt Bridge

`project:zendd-review-receipts -- --check` models human review receipts for
protected Zendd fact, issue, source, and client-output claims. It declares
templates, queues, validation rules, workspaces, approval plans, closeout rows,
and freeze rows without collecting or applying any receipt payload.

Acceptance for P621-P640:

- P621 declares that protected PASS without receipt is not allowed, receipt
  payloads are not present, receipt materialization is not allowed now, and
  receipt application is not allowed now.
- P622-P625 creates one receipt template for every P601-P620 fact/issue review
  binding row.
- P626-P628 queues every receipt template as pending human input with
  `receipt_payload_present=false`.
- P629-P631 declares validation rules for reviewer identity, role authority,
  evidence binding, explicit verdict, redaction acknowledgement, timestamp, and
  signature/ack ref. Validation is future-only until a receipt payload exists.
- P632-P634 declares receipt workspaces without materializing receipt inputs.
- P635-P636 declares approval plans by reviewer role while keeping approval
  application blocked.
- P637-P638 closes every protected claim as BLOCKED while validated human
  receipt is missing.
- P639-P640 freezes every receipt-gated claim as documented BLOCK with
  `block_reason`, `responsible_owner`, and `next_allowed_action`.

## P641-P660 Client Output Gate Fusion

`project:zendd-client-output-gate -- --check` fuses Zendd Korean client-output
quality gates with Hermes protected-output review gates. It does not generate
client output or apply receipts.

Acceptance for P641-P660:

- P641 declares that client-output generation, protected client-output PASS,
  raw client document copies, weak Korean wording, unsupported sentences,
  citationless legal conclusions, and internal-review wording cannot PASS.
- P642-P646 creates protected client-output claim rows for LDD summary, issue
  summary, risk factor, recommendation, citation, and executive-summary output.
  Each row binds source trace, fact claim, issue ref, citation ref, Korean
  quality gate, reviewer ref, and human receipt ref.
- P647-P650 requires Korean language quality evidence for particles/endings,
  specific legal wording, absence of internal-review placeholders, and clear
  source-backed support.
- P651-P653 blocks client-facing legal conclusions without citation and source
  trace.
- P654-P656 blocks raw client document exposure, privileged/restricted detail
  exposure, unscoped fact exposure, and secret/env exposure.
- P657-P658 binds client-output claims back to human receipt templates and
  keeps them blocked while receipt payload is missing.
- P659-P660 freezes every client-output claim and quality/exposure gate as
  documented BLOCK with `block_reason`, `responsible_owner`, and
  `next_allowed_action`.

## P661-P680 Operator Surface Bridge

`project:zendd-operator-surface -- --check` exposes P521-P660 Zendd-Hermes
integration results as read-only operator projection rows. It does not start a
server, register live routes, mutate the dashboard, execute Zendd commands, copy
raw material, validate receipts, apply approvals, or promote PASS.

Acceptance for P661-P680:

- P661 consumes the P641-P660 client-output gate and verifies the preceding
  source chain remains valid before creating operator rows.
- P662-P666 normalize Zendd integration outputs into operator claim rows with
  claim, current verdict, missing evidence, missing reviewer or receipt, hard
  gate result, block reason, responsible owner, and next allowed action.
- P667-P668 create operator filters for all claims, documented BLOCK rows,
  missing evidence, missing reviewer/gate, missing human receipt, protected
  claims, client-output blocks, source-contract blocks, command execution
  disabled rows, raw-material-copy blocked rows, and next-action queues.
- P669-P672 declare dashboard projection rows for claim status, missing input
  queues, protected client-output blocks, source/command boundary flags, and
  next-action queues.
- P673-P675 declare API projection rows for operator claims, filters, missing
  inputs, next actions, and gates while keeping live route registration and
  mutating methods disabled.
- P676-P677 emit missing-input rows for evidence, reviewer/hard gate, and human
  receipt gaps.
- P678 emits next-action rows for documented BLOCK rows without executing those
  actions.
- P679 audits that complete/ready/done/approved wording is not treated as PASS,
  protected PASS without receipt is absent, blocked rows keep next actions, and
  unsafe surface flags remain false.
- P680 closes the operator surface as read-only projection data and advances to
  the release/recovery bridge.

## P681-P700 Release And Recovery Bridge

`project:zendd-release-recovery -- --check` models Zendd release, package,
migration, client export, rollback, and recovery claims as protected,
receipt-gated rows. It does not execute commands, run migrations, export client
reports, publish packages, execute rollback, validate receipts, apply approvals,
or promote PASS.

Acceptance for P681-P700:

- P681 consumes the P661-P680 operator surface and declares that release,
  package, migration, client export, rollback, and recovery execution are
  disabled until evidence, reviewer/hard gate, rollback target, and human
  receipt exist.
- P682-P686 creates protected release claim rows for root build/check,
  frontend build/check, Electron package, backend migration, VDR/source data
  migration, client report export, desktop release, failed output recovery,
  rollback-to-external-adapter, and post-release smoke. Every row is documented
  BLOCK with command evidence ref, release evidence ref, rollback target,
  recovery receipt ref, owner, and next allowed action.
- P687-P690 models stale source data, outage, failed migration, failed package,
  failed client export, missing receipt, dirty-tree conflict, and integration
  rollback as recovery scenarios with draft-only recovery receipt refs.
- P691 records rollback targets as explicit but non-executable, including the
  external adapter, database snapshot, VDR source of truth, client-output safe
  state, and no-release state change.
- P692-P694 blocks protected release actions: command execution, database
  migration, VDR/source write, client export, desktop publish, approval
  application, rollback execution, and physical code movement.
- P695-P697 declares recovery receipt rows without materializing, validating,
  applying, or approving receipt payloads.
- P700 closes release/recovery as documented BLOCK and advances to the
  cross-system claim freeze.

## P701-P720 Cross-System Claim Freeze

`project:zendd-cross-system-freeze -- --check` re-adjudicates all P521-P700
Zendd-Hermes integration rows as final freeze claims. It does not execute Zendd
commands, move code, read secrets, copy raw material, validate receipts, apply
approvals, run release/rollback, or promote PASS.

Acceptance for P701-P720:

- P701 consumes the P661-P680 operator surface and P681-P700 release/recovery
  bridge before making a cross-system freeze decision.
- P702 declares the final formula:
  `CLAIM -> EVIDENCE -> REVIEWER_OR_HARD_GATE -> HUMAN_RECEIPT_IF_PROTECTED -> PASS_OR_DOCUMENTED_BLOCK`.
- P703-P704 collects P521-P700 operator, release, recovery, rollback,
  protected-action, receipt, closeout, and gate rows into freeze claim rows.
- P705-P707 demotes unsupported `complete`, `ready`, `done`, `approved`, and
  pass-like source rows to documented BLOCK unless evidence, reviewer/hard gate,
  protected receipt, and unsafe-false conditions are all present.
- P708-P710 verifies every BLOCK row has `freeze_block_reason`,
  `responsible_owner`, `next_allowed_action`, and a documented human gate when
  protected.
- P711-P719 audits formula coverage, pass-like demotion, PASS requirements,
  protected human gates, documented BLOCK next actions, unsafe flags, disabled
  release/recovery execution, result-wording skepticism, and blocked physical
  code movement.
- P720 closes the cross-system freeze as read-only evidence and advances to
  protected action and rollback hardening.

## P721-P740 Protected Action And Rollback Hardening

`project:zendd-protected-action-rollback -- --check` converts the P701-P720
freeze result into protected action, rollback target, work order, fail-closed,
and next-action rows. It does not execute protected actions, run release
commands, run database migrations, export client reports, apply receipts,
rehearse or execute rollback, mutate Zendd, or move Zendd code.

Acceptance for P721-P740:

- P721 consumes the cross-system claim freeze and requires
  `ready_for_protected_action_rollback_hardening` before hardening rows can
  close.
- P722 declares a protected-action rollback policy with release command,
  database migration, client export, rollback rehearsal/execution, receipt
  application, and physical code movement disabled.
- P723-P726 records protected action rows for release command execution, build
  or package, database migration, VDR/LDD write, client export, desktop publish,
  approval/receipt application, rollback execution, code movement, and external
  Zendd mutation. Every row is documented BLOCK with freeze ref, work order ref,
  rollback target ref, hard gate ref, human receipt ref, recovery receipt ref,
  owner, and next action.
- P727-P730 records rollback targets for checkout, package, database, source,
  client-output, receipt quarantine, and integration states while rollback
  rehearsal/execution stays disabled.
- P731-P733 declares protected work orders without materializing or validating
  payloads.
- P734-P738 adds fail-closed fixtures for missing work order, missing rollback
  target, missing human receipt, unsafe true flag, receipt application, rollback
  rehearsal, physical movement, and dirty-tree mutation.
- P739 exposes protected next-action rows without executing those actions.
- P740 closes protected action rollback hardening and advances to the physical
  integration decision.

## P741-P760 Physical Integration Decision

`project:zendd-physical-integration-decision -- --check` consumes the protected
action and rollback hardening layer and decides whether Zendd should stay in the
external checkout or be physically imported into Hermes. The closeout selects
the external-project adapter as the only current PASS mode. Submodule, subtree,
workspace link, monorepo directory move, raw project copy, and future mutation
options remain documented BLOCK.

The command does not move Zendd code, create submodules or subtrees, create
workspace links, copy raw project files, mutate Zendd, apply receipts, execute
rollback, or promote physical movement PASS.

Acceptance for P741-P760:

- P741 consumes P721-P740 and requires
  `ready_for_physical_integration_decision` before any physical integration
  decision can close.
- P742 declares the integration policy: external adapter selected; physical
  movement, subtree, submodule, workspace movement, monorepo directory move,
  raw project copy, and adapter writes disabled.
- P743-P745 records the integration option matrix and selects exactly one mode:
  `external_project_adapter`.
- P746-P750 compares boundary preservation, rollback simplicity, dirty-tree
  safety, receipt boundary, operator visibility, and migration evidence gaps.
- P751-P754 records movement and mutation block rows for every non-selected
  physical or future-mutation option.
- P755-P758 records the operating mode where Hermes controls Zendd by reference
  and the Zendd code directory remains unmoved.
- P759 records next actions for blocked options, movement blocks, and operating
  mode continuation.
- P760 closes as `ready_for_external_adapter_operation`; future physical
  movement requires a new evidence-backed migration work order with rollback
  target, hard gate, owner, next action, and human receipt where protected.

## Global Safety Rules

- Zendd code is not moved during P521-P760.
- Hermes never treats Zendd `complete`, `ready`, `done`, or `accepted` as PASS
  without evidence, reviewer/gate, and human receipt when protected.
- Raw VDR/client/domain material remains in Zendd; Hermes receives stable refs,
  redacted summaries, and review/receipt evidence only.
- Dirty Zendd worktree rows block mutation until classified and reviewed.
- Every BLOCK row must keep `block_reason` or equivalent gate message plus
  `next_allowed_action`.
