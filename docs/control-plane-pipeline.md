# Control Plane Pipeline

`Control Plane Pipeline`은 이미 구현된 운영 단계들을 안전한 순서로 실행하고, 단계별 command result와 expected artifact 존재 여부를 ledger로 남긴다. 외부 발송, merge, ERP 반영 같은 protected action은 하지 않는다.

```bash
npm run control-plane:pipeline
```

기본 실행 단계:

- Policy Matrix Catalog
- Policy Snapshot Ledger
- Domain Pack Registry
- Context Packet Ledger
- Model Routing Ledger
- Output Artifact Catalog
- Observability Catalog
- Cost Budget Ledger
- Token Usage Ledger
- Cost Attribution Ledger
- Budget Alert Ledger
- Protected Delivery Queue
- Matter Cockpit
- Approval Inbox
- Approval Inbox Decisions
- Delivery Execution Draft
- Post-Delivery Reconciliation
- Delivery Closeout Queue
- Closeout Receipt Validation
- Closeout Receipt Application
- Control Plane Audit Trail

출력:

- `control-plane-pipeline.json`
- `summary.md`

핵심 계약:

- `step_results`: 각 단계의 command, exit code, stdout/stderr, expected artifact check
- `summary`: passed/failed/skipped/missing artifact count
- `continue_on_error`: 실패 후에도 나머지 단계를 실행했는지

운영 dashboard에 반영하려면 pipeline 실행 후 `npm run dashboard:build`를 다시 실행한다.
