# Law Firm LDD Slice Runner

`Law Firm LDD Slice Runner`는 `resource-evidence.json`을 입력으로 받아 LDD issue/RFI 후보, fact, citation, gate, approval, output artifact, event ledger를 생성한다.

이 단계는 완성형 LDD 자동생성기가 아니라, `/goal`에서 요구한 로펌용 vertical slice의 첫 실행 경로다. 핵심은 모든 후보가 source span과 citation에 묶이고, attorney approval 전에는 `pending_review` 상태로 멈추는 것이다.

## 실행

```bash
npm run law-firm:slice -- \
  --input artifacts/resource-ingest/latest/resource-evidence.json \
  --out-dir artifacts/law-firm-ldd-slice/latest
```

출력:

- `law-firm-ldd-slice.json`: Identity/Policy, Resource/Evidence, Workflow/Runtime, Governance/Output을 포함한 core slice
- `event-ledger.json`: workflow, issue, gate, output, approval event ledger
- `issue-candidates.json`: 사람이 검토할 issue/RFI 후보
- `ldd-issue-report.md`: draft report
- `summary.json`: 실행 요약

## Gate

현재 slice는 다음 gate를 생성한다.

- `matter_access_gate`: passed
- `classification_gate`: passed
- `evidence_coverage_gate`: passed
- `citation_gate`: passed
- `human_approval_gate`: pending, blocking

## Goal 내 위치

이 단계는 `/goal`의 로펌용 산출물 원칙을 실제 실행물로 만든다. LDD issue 후보는 Evidence Lineage와 Citation Gate를 통과하고, 사람이 승인하기 전까지 외부 전달 가능한 산출물이 아니다.
