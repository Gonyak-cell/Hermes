# Review API

`Review API`는 `review-dashboard.json`을 읽기 전용 HTTP API와 정적 HTML로 노출한다. 아직 decision 적용, merge, 발송 같은 protected action은 실행하지 않는다. 이 단계의 목적은 Dashboard/API 계층의 첫 서버 경계를 만드는 것이다.

## 실행

먼저 dashboard 산출물을 만든다.

```bash
npm run dashboard:build
```

그 다음 API를 띄운다.

```bash
npm run api:serve
```

기본 주소:

- `http://127.0.0.1:4177/`
- `http://127.0.0.1:4177/api/dashboard`

## 주요 Route

- `GET /`: 정적 dashboard HTML
- `GET /health`: dashboard artifact 존재 여부와 overall status
- `GET /api`: route index
- `GET /api/dashboard`: 전체 `review-dashboard.v1`
- `GET /api/summary`: summary만 반환
- `GET /api/stages`: control plane stage 상태
- `GET /api/actions`: action queue
- `GET /api/sources`: dashboard source artifact 목록
- `GET /api/evidence-review-drafts`: evidence review draft artifact
- `GET /api/evidence-review-items`: evidence review draft 항목
- `GET /api/policy-matrices`: policy matrix catalog artifact
- `GET /api/policy-classifications`: policy classification level 목록
- `GET /api/runtime-policies`: classification별 runtime 허용/제한 정책
- `GET /api/model-policies`: 외부/로컬 모델 전송 정책
- `GET /api/tool-policies`: tool permission 정책
- `GET /api/output-policies`: output delivery 정책
- `GET /api/gate-policies`: pre/in/post-run gate 정책
- `GET /api/policy-snapshot-ledgers`: policy snapshot ledger artifact
- `GET /api/policy-snapshots`: 실행에 사용된 canonical policy snapshot
- `GET /api/policy-snapshot-instances`: source별 policy snapshot instance
- `GET /api/policy-decisions`: snapshot에서 도출한 model/runtime policy decision
- `GET /api/policy-usages`: workflow/event/run ledger의 policy snapshot reference
- `GET /api/policy-golden-fixtures`: policy golden fixture set artifact
- `GET /api/policy-fixture-cases`: allow/review/deny 대표 policy case
- `GET /api/policy-outcome-matrix`: fixture group별 outcome matrix
- `GET /api/policy-regression-hashes`: locked policy regression hash
- `GET /api/policy-golden-fixture-validations`: policy golden fixture validation item
- `GET /api/policy-operation-surfaces`: policy operations surface artifact
- `GET /api/policy-decision-rows`: unified policy decision rows
- `GET /api/policy-violation-rows`: unified policy violation rows
- `GET /api/policy-pending-approvals`: unified pending policy approval rows
- `GET /api/policy-surface-validations`: policy operations surface validation rows
- `GET /api/matter-boundary-slices`: matter boundary vertical slice artifact
- `GET /api/matter-boundary-resource-paths`: resource ingest부터 retrieval gate까지의 resource boundary path rows
- `GET /api/matter-boundary-retrieval-gates`: store filter와 negative probe를 포함한 retrieval gate checks
- `GET /api/matter-boundary-validations`: matter boundary slice validation rows
- `GET /api/identity-policy-matter-freezes`: identity/policy/matter freeze artifact
- `GET /api/identity-policy-freeze-sources`: P113-P131 freeze source status rows
- `GET /api/identity-policy-freeze-checkpoints`: freeze checkpoint rows
- `GET /api/identity-policy-freeze-validations`: freeze validation rows
- `GET /api/resource-store-interfaces`: resource store interface artifact
- `GET /api/resource-store-records`: Resource v2에서 projection된 resource store records
- `GET /api/resource-version-store-records`: ResourceVersion v2에서 projection된 version store records
- `GET /api/resource-store-adapter-bindings`: registry, ingestion, dashboard adapter binding rows
- `GET /api/resource-store-validations`: resource store interface validation rows
- `GET /api/immutable-object-store-layouts`: immutable object store layout artifact
- `GET /api/object-path-resolvers`: raw source/generated output path resolver rows
- `GET /api/raw-source-object-paths`: raw source namespace object key rows
- `GET /api/generated-output-object-paths`: generated output namespace object key rows
- `GET /api/object-store-collisions`: object key collision rows
- `GET /api/object-store-layout-validations`: immutable object store layout validation rows
- `GET /api/resource-version-ledgers`: resource version ledger artifact
- `GET /api/resource-version-families`: source system/external id별 version family rows
- `GET /api/resource-version-events`: version recorded, changed, duplicate event rows
- `GET /api/resource-version-transitions`: 같은 external id 안의 version transition rows
- `GET /api/resource-duplicate-candidates`: skipped duplicate candidate rows
- `GET /api/resource-version-object-bindings`: ResourceVersion과 raw-source object path binding rows
- `GET /api/resource-version-ledger-validations`: resource version ledger validation rows
- `GET /api/resource-dedup-hash-ledgers`: resource dedup/hash ledger artifact
- `GET /api/resource-hash-groups`: content hash 기준 resource/version group rows
- `GET /api/resource-external-id-groups`: source system/external id 기준 version family rows
- `GET /api/resource-dedup-decisions`: content hash, external id, resource version 기준 dedup classification decisions
- `GET /api/resource-duplicate-candidate-links`: duplicate candidate와 hash/version family link rows
- `GET /api/resource-hash-integrity-checks`: resource 및 resource version sha256 integrity check rows
- `GET /api/resource-dedup-hash-validations`: resource dedup/hash validation rows
- `GET /api/resource-quarantine-models`: resource quarantine model artifact
- `GET /api/resource-quarantine-rules`: 민감/오류/암호화 또는 materialization/대용량/불명확/duplicate hold rule rows
- `GET /api/resource-quarantine-items`: retrieval/external transfer/output delivery가 차단된 held resource rows
- `GET /api/resource-quarantine-review-queue`: quarantine release/correction을 위한 pending human review rows
- `GET /api/resource-quarantine-validations`: resource quarantine validation rows
- `GET /api/normalized-text-contracts`: normalized text contract artifact
- `GET /api/normalized-text-artifacts`: source-span-ready normalized text artifact rows
- `GET /api/normalized-text-location-maps`: page/paragraph/line/char offset maps
- `GET /api/normalized-source-span-seeds`: normalized text에서 생성된 source span seed rows
- `GET /api/normalized-text-validations`: normalized text contract validation rows
- `GET /api/extractor-adapter-contracts`: extractor adapter contract artifact
- `GET /api/extractor-adapters`: registered local parser/OCR adapter rows
- `GET /api/extractor-io-contracts`: shared extractor input/output contract rows
- `GET /api/extractor-document-type-bindings`: document type to extractor adapter bindings
- `GET /api/ocr-fallback-policies`: local/manual OCR fallback policy rows
- `GET /api/extractor-normalized-text-bindings`: P136 normalized text to extractor adapter bindings
- `GET /api/extractor-adapter-validations`: extractor adapter contract validation rows
- `GET /api/source-span-stores`: source span store artifact
- `GET /api/source-spans`: materialized whole-document/page/paragraph/line/char-range source span rows
- `GET /api/source-span-locators`: source span locator rows with page, paragraph, line, char offset, and timestamp status
- `GET /api/source-span-location-units`: normalized location unit rows used by evidence extraction
- `GET /api/source-span-indexes`: source span index rollups by resource, normalized text, location type, and extractor
- `GET /api/source-span-validations`: source span store validation rows
- `GET /api/evidence-item-stores`: evidence item store artifact
- `GET /api/evidence-items`: source-span-derived evidence item rows
- `GET /api/evidence-source-span-bindings`: evidence item to source span binding rows
- `GET /api/evidence-review-queue`: machine-extracted evidence review queue rows
- `GET /api/evidence-item-indexes`: evidence item rollups by matter, classification, review status, evidence type, and location type
- `GET /api/evidence-item-store-validations`: evidence item store validation rows
- `GET /api/evidence-golden-fixtures`: evidence golden fixture artifact
- `GET /api/evidence-golden-cases`: LDD, meeting minutes, contract, and client email extraction golden cases
- `GET /api/evidence-golden-store-matches`: golden case to Evidence Item Store match rows
- `GET /api/evidence-regression-tests`: evidence regression test artifact
- `GET /api/evidence-regression-suites`: extractor, lineage, and coverage regression suite rows
- `GET /api/evidence-regression-test-cases`: deterministic evidence regression case rows
- `GET /api/evidence-regression-hashes`: locked evidence regression hash rows
- `GET /api/evidence-regression-validations`: evidence regression validation rows
- `GET /api/resource-evidence-dashboard-summaries`: resource/evidence dashboard summary artifact
- `GET /api/resource-evidence-panel-rows`: ingest, store, quarantine, evidence, viewer, coverage, export, regression panel rows
- `GET /api/resource-evidence-matter-rollups`: matter별 resource/evidence/quarantine/coverage/export rollup rows
- `GET /api/resource-evidence-classification-rollups`: classification별 resource/evidence/quarantine/coverage/export rollup rows
- `GET /api/resource-evidence-dashboard-validations`: resource/evidence dashboard validation rows
- `GET /api/evidence-plane-freezes`: Evidence Plane freeze artifact
- `GET /api/evidence-plane-freeze-sources`: freeze source status rows for P133-P157 and representative support artifacts
- `GET /api/evidence-plane-freeze-checkpoints`: Evidence Plane freeze checkpoint rows
- `GET /api/evidence-plane-representative-traces`: representative resource-to-evidence-to-output-to-audit trace rows
- `GET /api/evidence-plane-freeze-validations`: Evidence Plane freeze validation rows
- `GET /api/evidence-golden-validations`: evidence golden fixture validation rows
- `GET /api/fact-claim-stores`: fact claim store artifact
- `GET /api/fact-claims`: evidence-derived fact claim rows
- `GET /api/fact-evidence-bindings`: fact claim to evidence item binding rows
- `GET /api/fact-review-queue`: machine-extracted fact review queue rows
- `GET /api/fact-claim-indexes`: fact claim rollups by matter, classification, review status, fact type, reliability, and binding status
- `GET /api/fact-claim-store-validations`: fact claim store validation rows
- `GET /api/issue-graph-stores`: issue graph store artifact
- `GET /api/issues`: fact-derived issue candidate rows
- `GET /api/fact-issue-bindings`: fact claim to issue binding rows
- `GET /api/legal-rules`: attorney-confirmation legal rule placeholder rows
- `GET /api/issue-legal-rule-bindings`: issue to legal rule binding rows
- `GET /api/risk-severity-assessments`: issue risk severity assessment rows
- `GET /api/issue-review-queue`: machine-extracted issue review queue rows
- `GET /api/issue-graph-indexes`: issue graph rollups by matter, classification, issue type, severity, review status, and binding status
- `GET /api/issue-graph-store-validations`: issue graph store validation rows
- `GET /api/citation-object-stores`: citation object store artifact
- `GET /api/output-paragraphs`: review-pending output paragraph candidates
- `GET /api/citations`: citation objects binding output paragraphs to source spans
- `GET /api/paragraph-source-bindings`: output paragraph to source span binding rows
- `GET /api/citation-review-queue`: machine-bound citation review queue rows
- `GET /api/citation-indexes`: citation object store rollups by matter, classification, review status, source binding status, and client-facing readiness
- `GET /api/citation-object-store-validations`: citation object store validation rows
- `GET /api/context-packet-ledgers`: context packet ledger artifact
- `GET /api/context-packets`: runtime별 context packet
- `GET /api/context-items`: packet에 포함된 context item
- `GET /api/context-retrieval-filters`: packet별 matter/classification retrieval filter
- `GET /api/retrieval-filter-compilers`: compiled retrieval filter compiler artifact
- `GET /api/compiled-retrieval-filters`: search/vector query 전 강제되는 tenant/matter/classification/policy/wall/access audit filter
- `GET /api/retrieval-query-bindings`: embedding route policy별 held query binding
- `GET /api/retrieval-filter-probes`: unscoped/cross-matter/missing-filter blocked probe
- `GET /api/retrieval-filter-validations`: retrieval filter compiler validation rows
- `GET /api/model-routing-ledgers`: model routing ledger artifact
- `GET /api/model-routing-decisions`: runtime/model/provider boundary별 routing decision
- `GET /api/cost-budget-ledgers`: cost budget ledger artifact
- `GET /api/cost-budget-decisions`: routing decision별 cost budget gate decision
- `GET /api/token-usage-ledgers`: token usage ledger artifact
- `GET /api/token-usage-records`: routing decision별 recorded/estimated token usage
- `GET /api/cost-attribution-ledgers`: cost attribution ledger artifact
- `GET /api/cost-attribution-records`: matter/runtime/capability별 projected cost attribution
- `GET /api/budget-alert-ledgers`: budget alert ledger artifact
- `GET /api/budget-alert-records`: matter/runtime/capability별 budget alert record
- `GET /api/packs`: domain pack registry의 pack 목록
- `GET /api/capabilities`: domain pack capability 계약 목록
- `GET /api/artifacts`: output artifact catalog의 산출물 목록
- `GET /api/runs`: observability catalog의 workflow run 목록
- `GET /api/events`: observability catalog의 event 목록
- `GET /api/costs`: observability catalog의 cost record 목록
- `GET /api/audit-trails`: control plane audit trail artifact
- `GET /api/audit-events`: 정규화된 control plane audit event
- `GET /api/audit-sources`: audit event source artifact 상태
- `GET /api/delivery-actions`: protected delivery queue의 전달 후보 목록
- `GET /api/matters`: matter cockpit의 matter/project 목록
- `GET /api/approvals`: approval inbox의 사람 검토 항목
- `GET /api/approval-inbox-decisions`: approval inbox 결정 적용 결과
- `GET /api/delivery-execution-candidates`: draft-only delivery execution 후보
- `GET /api/delivery-execution-packets`: 사람이 실행할 draft delivery packet
- `GET /api/delivery-receipts`: 적용된 delivery receipt 목록
- `GET /api/delivery-receipt-events`: delivery receipt audit event 목록
- `GET /api/post-delivery-matters`: receipt 반영 후 matter/project별 전달 상태
- `GET /api/delivered-artifacts`: receipt 반영 후 delivered output artifact 목록
- `GET /api/outstanding-receipts`: 아직 닫히지 않은 delivery receipt 목록
- `GET /api/delivery-closeout-items`: 사람이 처리할 delivery closeout queue
- `GET /api/receipt-input-drafts`: closeout item별 receipt input draft row
- `GET /api/closeout-receipt-validations`: closeout receipt 검증 결과
- `GET /api/closeout-receipt-errors`: closeout receipt 검증 오류
- `GET /api/validated-receipts-to-apply`: `delivery:receipts`에 넘길 검증 완료 receipt
- `GET /api/closeout-receipt-applications`: closeout receipt application artifact
- `GET /api/closeout-applied-receipts`: closeout application으로 적용된 receipt
- `GET /api/pipeline-runs`: control plane pipeline 실행 artifact
- `GET /api/pipeline-steps`: control plane pipeline 단계별 실행 결과
- `GET /api/control-plane-loops`: control plane loop 실행 artifact
- `GET /api/control-plane-loop-steps`: control plane loop 단계별 실행 결과
- `GET /api/goal-checkpoints`: control plane goal checkpoint artifact
- `GET /api/goal-checkpoint-items`: control plane goal checkpoint 항목
- `GET /api/control-plane-health`: control plane health artifact
- `GET /api/health-checks`: control plane health check 목록
- `GET /api/action-plans`: control plane action plan artifact
- `GET /api/action-plan-items`: control plane action plan 항목
- `GET /api/human-gates`: control plane human gate briefing artifact
- `GET /api/human-gate-items`: control plane human gate item
- `GET /api/human-gate-receipts`: human gate receipt draft artifact
- `GET /api/human-gate-receipt-requirements`: human gate receipt requirement
- `GET /api/human-gate-receipt-drafts`: 사람이 채울 human gate receipt draft
- `GET /api/human-review-packet-ledgers`: human review packet ledger artifact
- `GET /api/human-review-packets`: actor/gate type별 human review packet
- `GET /api/human-review-items`: human review packet item
- `GET /api/human-review-agendas`: human review agenda artifact
- `GET /api/human-review-agenda-sections`: required actor별 agenda section
- `GET /api/human-review-agenda-items`: review packet 단위 agenda item
- `GET /api/human-review-decision-template`: 사람이 채울 receipt decision template row
- `GET /api/human-review-agenda-receipt-intakes`: agenda decision template intake artifact
- `GET /api/human-review-agenda-receipt-intake-items`: agenda receipt intake item
- `GET /api/human-review-agenda-receipt-input`: receipt validation에 넘길 표준 human gate receipt input row
- `GET /api/human-review-receipt-workspaces`: actor별 receipt workspace manifest artifact
- `GET /api/human-review-actor-workspaces`: required actor별 editable receipt workspace
- `GET /api/human-review-workspace-entries`: workspace에 포함된 receipt entry
- `GET /api/human-review-receipt-workspace-merges`: actor receipt input merge artifact
- `GET /api/human-review-receipt-merge-items`: merge된 receipt item
- `GET /api/human-review-merged-receipt-input`: validation에 넘길 merged receipt input row
- `GET /api/human-review-context-bundles`: human review context bundle artifact
- `GET /api/human-review-context-cards`: pending receipt별 gate/evidence/approval/matter context card
- `GET /api/human-review-actor-context-bundles`: required actor별 context bundle
- `GET /api/human-review-decision-registers`: human review decision register artifact
- `GET /api/human-review-decision-rows`: context-bound decision row
- `GET /api/human-review-decision-receipt-input`: validation에 넘길 decision register receipt input row
- `GET /api/human-review-decision-register-merges`: actor decision receipt input merge artifact
- `GET /api/human-review-decision-merge-items`: merge된 decision receipt item
- `GET /api/human-review-merged-decision-receipt-input`: validation에 넘길 merged decision receipt input row
- `GET /api/human-gate-receipt-validations`: human gate receipt validation item
- `GET /api/human-gate-receipt-errors`: human gate receipt validation 오류
- `GET /api/human-review-validation-feedbacks`: human review validation feedback artifact
- `GET /api/human-review-feedback-items`: actor별 feedback item
- `GET /api/human-review-actor-feedback`: required actor별 validation feedback bundle
- `GET /api/human-review-correction-workspaces`: human review correction workspace artifact
- `GET /api/human-review-correction-actors`: required actor별 correction workspace
- `GET /api/human-review-correction-items`: actor별 correction item
- `GET /api/human-review-correction-receipt-input`: editable correction receipt input row
- `GET /api/human-review-correction-workspace-merges`: actor correction receipt input merge artifact
- `GET /api/human-review-correction-merge-actors`: correction merge에 포함된 actor input
- `GET /api/human-review-correction-merge-items`: merge된 correction receipt item
- `GET /api/human-review-merged-correction-receipt-input`: validation에 넘길 merged correction receipt input row
- `GET /api/human-review-correction-validations`: merged correction receipt validation artifact
- `GET /api/human-review-correction-validation-items`: merged correction receipt validation item
- `GET /api/human-review-correction-validation-errors`: merged correction receipt validation 오류
- `GET /api/validated-correction-human-gate-receipts`: 향후 적용 가능한 검증 완료 correction receipt
- `GET /api/human-review-correction-feedbacks`: correction validation feedback artifact
- `GET /api/human-review-correction-feedback-items`: actor별 correction feedback item
- `GET /api/human-review-correction-actor-feedback`: required actor별 correction feedback bundle
- `GET /api/human-review-cycle-ledgers`: feedback/correction cycle ledger artifact
- `GET /api/human-review-cycle-items`: gate item별 feedback/correction cycle item
- `GET /api/human-review-actor-cycles`: required actor별 cycle rollup
- `GET /api/human-review-cycle-work-orders`: actor work order artifact
- `GET /api/human-review-cycle-work-order-items`: cycle item에서 파생된 actor work order item
- `GET /api/human-review-actor-work-orders`: required actor별 work order
- `GET /api/human-review-cycle-target-audits`: work order target audit artifact
- `GET /api/human-review-cycle-target-audit-items`: work order target receipt file/row audit item
- `GET /api/human-review-actor-target-audits`: required actor별 target audit
- `GET /api/human-review-cycle-triage-inboxes`: human review cycle triage inbox artifact
- `GET /api/human-review-cycle-triage-items`: actor-ready triage item
- `GET /api/human-review-actor-triage-inboxes`: required actor별 triage inbox
- `GET /api/human-review-cycle-reviewer-consoles`: reviewer console artifact
- `GET /api/human-review-cycle-console-items`: reviewer console item
- `GET /api/human-review-actor-consoles`: required actor별 reviewer console
- `GET /api/human-review-cycle-field-audits`: receipt field audit artifact
- `GET /api/human-review-cycle-field-audit-items`: required receipt field completion audit item
- `GET /api/human-review-actor-field-audits`: required actor별 receipt field audit
- `GET /api/human-review-cycle-completion-packs`: receipt completion pack artifact
- `GET /api/human-review-cycle-completion-items`: manual receipt completion template item
- `GET /api/human-review-actor-completion-packs`: required actor별 receipt completion pack
- `GET /api/human-review-cycle-completion-verifications`: receipt completion verification artifact
- `GET /api/human-review-cycle-completion-verification-items`: manual receipt completion verification item
- `GET /api/human-review-actor-completion-verifications`: required actor별 receipt completion verification
- `GET /api/human-review-cycle-completion-workbenches`: receipt completion workbench artifact
- `GET /api/human-review-cycle-completion-workbench-items`: manual receipt completion workbench item
- `GET /api/human-review-actor-completion-workbenches`: required actor별 receipt completion workbench
- `GET /api/human-review-cycle-completion-runbooks`: receipt completion runbook artifact
- `GET /api/human-review-cycle-completion-runbook-steps`: manual/command receipt completion runbook step
- `GET /api/human-review-actor-completion-runbooks`: required actor별 receipt completion runbook
- `GET /api/human-review-cycle-completion-readiness`: receipt completion readiness artifact
- `GET /api/human-review-cycle-completion-command-gates`: receipt completion command readiness gate
- `GET /api/human-review-actor-completion-readiness`: required actor별 receipt completion readiness
- `GET /api/human-review-cycle-completion-command-queues`: receipt completion command queue artifact
- `GET /api/human-review-cycle-completion-command-queue-items`: 즉시 수동 실행 가능한 receipt completion command
- `GET /api/human-review-cycle-completion-held-commands`: manual input 또는 explicit approval 전 보류된 command
- `GET /api/human-review-actor-completion-command-queues`: required actor별 receipt completion command queue
- `GET /api/human-review-cycle-completion-command-receipts`: receipt completion command receipt draft artifact
- `GET /api/human-review-cycle-completion-command-receipt-requirements`: receipt completion command별 required receipt field
- `GET /api/human-review-cycle-completion-command-receipt-drafts`: 사람이 command 실행 후 채울 receipt draft row
- `GET /api/human-review-cycle-completion-held-command-references`: held command reference
- `GET /api/human-review-cycle-completion-command-receipt-validations`: command receipt validation artifact
- `GET /api/human-review-cycle-completion-command-receipt-validation-items`: command receipt validation item
- `GET /api/human-review-cycle-completion-command-receipt-errors`: command receipt validation error
- `GET /api/validated-human-review-cycle-completion-command-receipts`: 검증 완료 command-run receipt
- `GET /api/human-review-cycle-completion-command-receipt-feedbacks`: command receipt feedback artifact
- `GET /api/human-review-cycle-completion-command-receipt-feedback-items`: actor에게 전달할 command receipt feedback item
- `GET /api/human-review-cycle-completion-command-receipt-actor-feedback`: required actor별 command receipt feedback bundle
- `GET /api/human-review-cycle-completion-command-receipt-workspaces`: command receipt workspace artifact
- `GET /api/human-review-cycle-completion-command-receipt-workspace-items`: actor별 editable command receipt workspace item
- `GET /api/human-review-cycle-completion-command-receipt-actor-workspaces`: required actor별 command receipt workspace
- `GET /api/human-review-cycle-completion-command-receipt-workspace-merges`: command receipt workspace merge artifact
- `GET /api/human-review-cycle-completion-command-receipt-merge-items`: merged command receipt item
- `GET /api/human-review-cycle-completion-command-receipt-actor-inputs`: merge에 포함된 actor별 command receipt input
- `GET /api/merged-human-review-cycle-completion-command-receipt-input`: 검증용 merged command receipt input
- `GET /api/human-review-cycle-completion-command-receipt-workspace-validations`: merged command receipt validation artifact
- `GET /api/human-review-cycle-completion-command-receipt-workspace-validation-items`: merged command receipt validation item
- `GET /api/human-review-cycle-completion-command-receipt-workspace-validation-errors`: merged command receipt validation 오류
- `GET /api/validated-human-review-cycle-completion-command-workspace-receipts`: 검증 완료 merged command receipt
- `GET /api/human-review-cycle-completion-command-receipt-applications`: command receipt application artifact
- `GET /api/applied-human-review-cycle-completion-command-receipts`: 적용된 command receipt
- `GET /api/human-review-cycle-completion-command-receipt-application-pending-receipts`: application 단계에서 보류 중인 command receipt
- `GET /api/human-review-cycle-completion-command-receipt-application-audit-events`: command receipt application audit event
- `GET /api/human-review-cycle-completion-reconciliations`: receipt completion reconciliation artifact
- `GET /api/human-review-cycle-completion-reconciliation-items`: reconciliation item
- `GET /api/human-review-cycle-completion-reconciliation-actors`: actor별 reconciliation 상태
- `GET /api/validated-human-gate-receipts`: 향후 적용 가능한 검증 완료 human gate receipt
- `GET /api/human-gate-receipt-applications`: human gate receipt application artifact
- `GET /api/applied-human-gate-receipts`: 적용된 human gate receipt
- `GET /api/patched-human-gate-items`: receipt 적용으로 patch된 human gate item
- `GET /api/action-work-packets`: control plane work packet 목록
- `GET /api/action-work-items`: control plane work item 목록
- `GET /api/work-packet-receipt-requirements`: work packet closeout에 필요한 receipt requirement
- `GET /api/work-packet-receipt-drafts`: 사람이 채울 work packet receipt draft
- `GET /api/work-packet-receipt-validations`: work packet receipt validation item
- `GET /api/work-packet-receipt-errors`: work packet receipt validation 오류
- `GET /api/validated-work-packet-receipts`: 향후 적용 가능한 검증 완료 work packet receipt
- `GET /api/work-packet-receipt-applications`: work packet receipt application artifact
- `GET /api/applied-work-packet-receipts`: 적용된 work packet receipt
- `GET /api/lineage-graphs`: Lineage Graph Builder artifact
- `GET /api/lineage-nodes`: source/evidence/fact/issue/output lineage node
- `GET /api/lineage-edges`: canonical lineage edge
- `GET /api/lineage-paths`: source-to-output lineage path
- `GET /api/lineage-indexes`: lineage graph index projection
- `GET /api/lineage-graph-validations`: lineage graph validation row
- `GET /api/evidence-viewer-data`: Evidence Viewer Data API artifact
- `GET /api/evidence-viewer-cards`: EvidenceItem, SourceSpan, LineagePath를 결합한 viewer card row
- `GET /api/evidence-viewer-source-spans`: viewer source span panel row
- `GET /api/evidence-viewer-lineage-paths`: viewer lineage path panel row
- `GET /api/evidence-viewer-data-validations`: Evidence Viewer Data API validation row
- `GET /api/evidence-export-bundles`: Evidence Export Bundle artifact
- `GET /api/evidence-export-bundle-records`: source/citation/coverage/exhibit 묶음 row
- `GET /api/evidence-export-source-packages`: export source locator/preview package row
- `GET /api/evidence-export-citation-packages`: export citation/output paragraph package row
- `GET /api/evidence-export-coverage-packages`: export coverage dimension package row
- `GET /api/evidence-export-bundle-validations`: Evidence Export Bundle validation row
- `GET /api/evidence-coverage-scores`: Evidence Coverage Score artifact
- `GET /api/evidence-coverage-records`: per-output coverage score row
- `GET /api/evidence-coverage-dimensions`: claim/date/party/amount/legal-basis dimension row
- `GET /api/evidence-coverage-indexes`: evidence coverage index projection
- `GET /api/evidence-coverage-validations`: evidence coverage validation row
- `GET /api/evidence-flags`: Evidence Flags artifact
- `GET /api/evidence-flag-records`: per-coverage extraction/human/privilege/redaction/external-transfer flag row
- `GET /api/evidence-flag-decisions`: individual evidence flag decision row
- `GET /api/evidence-flag-indexes`: evidence flag index projection
- `GET /api/evidence-flag-validations`: evidence flag validation row
- `GET /api/exhibit-maps`: Exhibit Map artifact
- `GET /api/exhibit-records`: per-evidence exhibit row with Korean reference
- `GET /api/exhibit-bindings`: exhibit-to-evidence/citation/output/lineage binding row
- `GET /api/exhibit-indexes`: exhibit map index projection
- `GET /api/exhibit-map-validations`: exhibit map validation row
- `GET /api/custody-event-ledgers`: Chain of Custody Events artifact
- `GET /api/custody-events`: append-only custody event row
- `GET /api/custody-event-links`: custody event subject link row
- `GET /api/custody-stage-indexes`: custody stage index projection
- `GET /api/custody-event-validations`: custody event validation row
- `GET /api/event-envelope-ledgers`: CloudEvents-style event envelope ledger artifact
- `GET /api/event-envelopes`: EventRecord/AuditEvent에서 projection된 event envelope rows
- `GET /api/event-envelope-source-bindings`: envelope와 원 EventRecord/AuditEvent source binding rows
- `GET /api/event-envelope-validations`: event envelope ledger validation rows
- `GET /api/event-type-registries`: event type registry artifact
- `GET /api/event-types`: event type catalog rows
- `GET /api/event-families`: event family coverage rows
- `GET /api/event-type-bindings`: envelope와 event type binding rows
- `GET /api/event-type-registry-validations`: event type registry validation rows
- `GET /summary.md`: Markdown 요약

`/api/actions`와 `/api/stages`는 `status`, `priority`, `source_stage`, `stage_id`, `source_id`, `available`, `limit` query를 지원한다. `/api/evidence-review-drafts`는 `draft_id`, `limit` query를 지원하고, `/api/evidence-review-items`는 `review_item_id`, `queue_item_id`, `evidence_id`, `classification`, `review_status`, `suggested_decision`, `draft_decision`, `auto_approvable`, `priority`, `limit` query를 지원한다. Policy route는 `policy_status`, `matrix_id`, `ledger_id`, `ledger_status`, `policy_snapshot_id`, `decision_id`, `decision_status`, `usage_id`, `usage_type`, `snapshot_declared_in_source`, `classification`, `external_model_policy`, `local_model_policy`, `redaction_policy`, `approval_required`, `tool_id`, `default_policy`, `artifact_type`, `delivery_policy`, `gate_id`, `stage`, `blocking_by_default`, `limit` query를 지원한다. Context route는 `context_packet_id`, `context_item_id`, `retrieval_filter_id`, `packet_status`, `context_mode`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `redaction_required`, `redaction_applied`, `classification_allowed`, `runtime_allowed_by_capability`, `item_type`, `content_mode`, `filter_status`, `limit` query를 지원한다. Model routing route는 `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `route_status`, `route_mode`, `external_transfer`, `provider_boundary`, `runtime_policy_status`, `external_model_policy`, `local_model_policy`, `redaction_status`, `audit_required`, `approval_required`, `ledger_status`, `limit` query를 지원한다. Cost budget route는 `budget_decision_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `route_mode`, `budget_status`, `token_tracking_required`, `token_tracking_status`, `cost_budget_gate_present`, `cost_policy_present`, `ledger_status`, `limit` query를 지원한다. Token usage route는 `token_usage_id`, `budget_decision_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `tracking_status`, `estimated`, `ledger_status`, `limit` query를 지원한다. `/api/packs`와 `/api/capabilities`는 `pack_id`, `capability_id`, `enabled`, `valid`, `limit` query를 지원한다. `/api/artifacts`와 `/api/delivered-artifacts`는 `artifact_id`, `artifact_type`, `domain_pack`, `delivery_state`, `approval_status`, `status`, `matter_id`, `tenant_id`, `limit` query를 지원한다. `/api/runs`, `/api/events`, `/api/costs`는 `run_id`, `workflow_run_id`, `runtime_id`, `event_type`, `cost_type`, `capability_id`, `source_id`, `status`, `limit` query를 지원한다. `/api/audit-trails`는 `audit_trail_id`, `audit_status`, `limit` query를 지원하고, `/api/audit-events`는 `audit_event_id`, `event_type`, `event_category`, `source_id`, `tenant_id`, `actor_type`, `actor_id`, `correlation_id`, `protected_action_event`, `protected_action_executed`, `limit` query를 지원하며, `/api/audit-sources`는 `source_id`, `available`, `limit` query를 지원한다. `/api/delivery-actions`는 `delivery_action_id`, `artifact_id`, `domain_pack`, `delivery_status`, `delivery_channel`, `delivery_target`, `priority`, `limit` query를 지원한다. `/api/matters`와 `/api/post-delivery-matters`는 `matter_key`, `tenant_id`, `matter_id`, `status`, `limit` query를 지원한다. `/api/approvals`는 `approval_item_id`, `item_type`, `approval_id`, `domain_pack`, `matter_id`, `priority`, `required_decision`, `status`, `limit` query를 지원한다. `/api/approval-inbox-decisions`는 `approval_item_id`, `item_type`, `decision`, `status_after`, `priority`, `limit` query를 지원한다. `/api/delivery-execution-candidates`와 `/api/delivery-execution-packets`는 `execution_candidate_id`, `packet_id`, `execution_status`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원한다. `/api/delivery-receipts`와 `/api/closeout-applied-receipts`는 `receipt_id`, `packet_id`, `receipt_status`, `executed_by`, `delivery_channel`, `delivery_target`, `matter_id`, `priority`, `limit` query를 지원하고, `/api/delivery-receipt-events`는 `type`, `tenant_id`, `correlation_id`, `limit` query를 지원한다. `/api/outstanding-receipts`와 `/api/delivery-closeout-items`는 `closeout_item_id`, `packet_id`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `status`, `primary_domain_pack`, `limit` query를 지원한다. `/api/receipt-input-drafts`, `/api/validated-receipts-to-apply`는 `receipt_id`, `packet_id`, `receipt_status`, `limit` query를 지원한다. `/api/closeout-receipt-validations`는 `validation_item_id`, `packet_id`, `validation_status`, `receipt_status`, `delivery_channel`, `delivery_target`, `matter_id`, `tenant_id`, `primary_domain_pack`, `limit` query를 지원하고, `/api/closeout-receipt-errors`는 `packet_id`, `field`, `limit` query를 지원한다. `/api/closeout-receipt-applications`, `/api/human-gate-receipt-applications`, `/api/work-packet-receipt-applications`, `/api/pipeline-runs`, `/api/control-plane-loops`, `/api/goal-checkpoints`는 `application_id`, `application_status`, `pipeline_id`, `loop_id`, `loop_status`, `checkpoint_id`, `checkpoint_status`, `limit` query를 지원한다. `/api/pipeline-steps`와 `/api/control-plane-loop-steps`는 `step_id`, `category`, `status`, `limit` query를 지원한다. `/api/goal-checkpoint-items`는 `checkpoint_item_id`, `category`, `status`, `priority`, `limit` query를 지원한다. `/api/control-plane-health`는 `health_id`, `limit` query를 지원하고, `/api/health-checks`는 `check_id`, `source_stage`, `status`, `severity`, `limit` query를 지원한다. `/api/action-plans`는 `plan_id`, `plan_status`, `limit` query를 지원하고, `/api/action-plan-items`는 `plan_item_id`, `source_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/human-gates`는 `human_gate_id`, `limit` query를 지원하고, `/api/human-gate-items`, `/api/patched-human-gate-items`는 `gate_item_id`, `source_plan_item_id`, `source_stage`, `gate_type`, `priority`, `status`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/human-gate-receipts`는 `receipt_draft_id`, `receipt_status`, `limit` query를 지원하고, `/api/human-gate-receipt-requirements`는 `receipt_requirement_id`, `gate_item_id`, `source_plan_item_id`, `source_stage`, `gate_type`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하며, `/api/human-gate-receipt-drafts`는 `receipt_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `receipt_status`, `outcome`, `limit` query를 지원한다. `/api/human-gate-receipt-validations`는 `validation_item_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `source_stage`, `validation_status`, `receipt_status`, `outcome`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/human-gate-receipt-errors`는 `gate_item_id`, `field`, `limit` query를 지원한다. `/api/validated-human-gate-receipts`와 `/api/applied-human-gate-receipts`는 `receipt_id`, `gate_item_id`, `source_plan_item_id`, `gate_type`, `receipt_status`, `outcome`, `limit` query를 지원한다. `/api/action-work-packets`는 `work_packet_id`, `packet_type`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/action-work-items`는 `work_item_id`, `work_packet_id`, `plan_item_id`, `source_stage`, `status`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원한다. `/api/work-packet-receipt-requirements`는 `receipt_requirement_id`, `work_packet_id`, `packet_type`, `source_stage`, `priority`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-drafts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다. `/api/work-packet-receipt-validations`는 `validation_item_id`, `work_packet_id`, `packet_type`, `source_stage`, `validation_status`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원하고, `/api/work-packet-receipt-errors`는 `work_packet_id`, `field`, `limit` query를 지원한다. `/api/validated-work-packet-receipts`와 `/api/applied-work-packet-receipts`는 `receipt_id`, `work_packet_id`, `packet_type`, `source_stage`, `receipt_status`, `limit` query를 지원한다.

Human review packet route는 `review_packet_id`, `review_item_id`, `packet_type`, `packet_status`, `required_actor`, `gate_item_id`, `gate_type`, `source_stage`, `priority`, `receipt_status`, `requires_human`, `protected_action`, `limit` query를 지원한다. Human review agenda route는 `agenda_id`, `agenda_section_id`, `agenda_item_id`, `agenda_status`, `section_status`, `review_packet_id`, `packet_type`, `required_actor`, `priority`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review agenda receipt intake route는 `intake_id`, `intake_item_id`, `intake_status`, `template_row_present`, `ready_for_validation`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `required_actor`, `protected_action`, `limit` query를 지원한다. Human review receipt workspace route는 `workspace_id`, `actor_workspace_id`, `workspace_entry_id`, `workspace_status`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review receipt workspace merge route는 `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review context bundle route는 `bundle_id`, `bundle_status`, `actor_context_bundle_id`, `context_card_id`, `context_status`, `subject_type`, `subject_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review decision register route는 `register_id`, `register_status`, `actor_decision_register_id`, `decision_row_id`, `decision_status`, `context_card_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review decision register merge route는 `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `actor_decision_register_id`, `decision_row_id`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review validation feedback route는 `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `required_actor`, `validation_status`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review correction workspace route는 `correction_workspace_id`, `actor_correction_workspace_id`, `correction_item_id`, `correction_status`, `workspace_status`, `required_actor`, `receipt_id`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review correction merge, validation, feedback route는 `merge_id`, `merge_item_id`, `validation_item_id`, `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `required_actor`, `validation_status`, `receipt_status`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review cycle route는 `cycle_id`, `actor_cycle_id`, `cycle_item_id`, `cycle_status`, `required_actor`, `gate_item_id`, `gate_type`, `protected_action`, `limit` query를 지원한다. Human review cycle field audit, completion pack, completion verification, completion workbench, completion runbook, completion readiness, completion command queue, completion command receipts, completion command receipt validation, completion command receipt feedback, completion command receipt workspace, completion command receipt workspace merge, completion command receipt workspace validation, completion command receipt application, completion reconciliation route는 `field_audit_id`, `actor_field_audit_id`, `field_audit_item_id`, `field_audit_status`, `completion_pack_id`, `actor_completion_pack_id`, `completion_item_id`, `completion_status`, `verification_id`, `actor_verification_id`, `verification_item_id`, `verification_status`, `workbench_id`, `actor_workbench_id`, `workbench_item_id`, `workbench_status`, `runbook_id`, `actor_runbook_id`, `runbook_step_id`, `runbook_status`, `step_status`, `step_type`, `step_key`, `readiness_id`, `actor_readiness_id`, `command_gate_id`, `manual_requirement_id`, `readiness_status`, `command_status`, `command_allowed_now`, `requirement_status`, `command_queue_id`, `queue_item_id`, `held_command_id`, `actor_command_queue_id`, `command_receipt_draft_id`, `receipt_requirement_id`, `receipt_id`, `held_command_ref_id`, `validation_id`, `validation_item_id`, `validation_status`, `ready_to_confirm`, `feedback_id`, `actor_feedback_id`, `feedback_item_id`, `feedback_status`, `workspace_id`, `actor_workspace_id`, `workspace_item_id`, `workspace_status`, `merge_id`, `merge_item_id`, `merge_status`, `actor_input_id`, `application_id`, `application_status`, `applied_command_status`, `ready_for_validation`, `field`, `queue_status`, `hold_status`, `command_kind`, `command`, `command_result`, `executed_by`, `output_reference`, `requires_explicit_human_approval`, `required_actor`, `gate_item_id`, `gate_type`, `protected_action`, `receipt_status`, `limit` query를 지원한다.

Cost attribution route는 `attribution_id`, `budget_decision_id`, `token_usage_id`, `routing_decision_id`, `context_packet_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `attribution_status`, `over_budget`, `untracked_cost`, `matter_id`, `tenant_id`, `ledger_status`, `limit` query를 지원한다.

Budget alert route는 `alert_record_id`, `attribution_id`, `budget_decision_id`, `token_usage_id`, `routing_decision_id`, `runtime_id`, `workflow_run_id`, `capability_id`, `classification`, `alert_status`, `requires_human`, `matter_id`, `tenant_id`, `ledger_status`, `limit` query를 지원한다.

Lineage graph route는 `lineage_graph_status`, `lineage_node_id`, `lineage_edge_id`, `lineage_path_id`, `node_type`, `edge_type`, `path_status`, `from_subject_id`, `to_subject_id`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Evidence viewer data route는 `evidence_viewer_data_status`, `viewer_card_id`, `source_span_panel_id`, `lineage_path_panel_id`, `source_span_id`, `evidence_id`, `lineage_path_id`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `binding_status`, `path_status`, `status`, `limit` query를 지원한다.

Evidence export bundle route는 `evidence_export_bundle_status`, `export_bundle_id`, `export_status`, `bundle_status`, `source_package_id`, `citation_package_id`, `coverage_package_id`, `source_span_id`, `evidence_id`, `citation_id`, `coverage_score_id`, `lineage_path_id`, `output_paragraph_id`, `exhibit_id`, `matter_id`, `classification`, `policy_snapshot_id`, `package_status`, `status`, `limit` query를 지원한다.

Evidence coverage route는 `evidence_coverage_status`, `coverage_score_id`, `coverage_dimension_id`, `coverage_status`, `dimension`, `coverage_subject_id`, `covered`, `required`, `missing_required_dimension_count`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Evidence flags route는 `evidence_flags_status`, `evidence_flag_record_id`, `coverage_score_id`, `flag_decision_id`, `flag_type`, `flag_value`, `extraction_flag`, `human_confirmation_flag`, `privilege_flag`, `redaction_flag`, `external_transfer_flag`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Exhibit map route는 `exhibit_map_status`, `exhibit_id`, `exhibit_number`, `exhibit_label`, `exhibit_reference`, `binding_type`, `exhibit_status`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `review_status`, `limit` query를 지원한다.

Custody event route는 `custody_event_ledger_status`, `custody_event_id`, `custody_event_link_id`, `custody_chain_id`, `event_stage`, `event_type`, `event_status`, `subject_type`, `subject_id`, `link_status`, `schema_version`, `status`, `matter_id`, `classification`, `policy_snapshot_id`, `limit` query를 지원한다.

Search index route는 `search_index_contract_status`, `search_index_id`, `search_index_field_id`, `search_index_query_plan_id`, `collection_id`, `source_artifact_id`, `index_status`, `field_role`, `field_name`, `query_profile`, `query_status`, `executable`, `schema_version`, `status`, `limit` query를 지원한다.

Vector policy route는 `vector_index_policy_boundary_status`, `vector_policy_gate_id`, `embedding_route_policy_id`, `collection_id`, `source_artifact_id`, `gate_status`, `route_status`, `embedding_execution_status`, `retrieval_execution_status`, `route_executable`, `classification`, `policy_external_embedding_decision`, `external_embedding_transfer_status`, `external_embedding_allowed`, `schema_version`, `status`, `limit` query를 지원한다.

Evidence regression route는 `evidence_regression_status`, `suite_type`, `suite_status`, `status`, `regression_suite_id`, `regression_test_case_id`, `subject_id`, `matter_id`, `classification`, `external_service_used`, `locked`, `limit` query를 지원한다.

Resource/evidence dashboard route는 `resource_evidence_dashboard_status`, `panel_id`, `panel_type`, `panel_status`, `source_artifact_id`, `matter_id`, `classification`, `rollup_status`, `status`, `limit` query를 지원한다.

Evidence Plane freeze route는 `evidence_plane_freeze_status`, `source_status`, `checkpoint_status`, `trace_status`, `trace_id`, `matter_id`, `classification`, `policy_snapshot_id`, `status`, `limit` query를 지원한다.

Event envelope route는 `event_envelope_status`, `envelope_kind`, `event_type`, `type`, `specversion`, `source`, `source_kind`, `binding_status`, `round_trip_status`, `required_field_status`, `status`, `limit` query를 지원한다.

Event type registry route는 `event_type_registry_status`, `event_family`, `event_category`, `registry_status`, `classification_status`, `coverage_status`, `required_family`, `binding_status`, `event_type`, `status`, `limit` query를 지원한다.

## 검증

```bash
npm run api:smoke
```

smoke test는 임시 포트에서 API를 띄운 뒤 `/health`, `/api`, `/api/dashboard`, `/api/stages`, `/api/actions`, `/`를 확인하고 서버를 닫는다.

## Goal 내 위치

이 단계는 `/goal`의 `dashboard/API` 완성 기준 중 API의 첫 얇은 slice다. 쓰기는 아직 금지하고, 모든 상태는 기존 Event/Audit/Approval 산출물에서 파생된 읽기 전용 view로만 제공한다.
