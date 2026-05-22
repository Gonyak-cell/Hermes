# Approval Decisions

`Approval Decisions`는 `approval-queue.json`과 `decision-template.json`을 읽어 사람이 기록한 결정을 적용한다.

이 단계는 실제 외부 발송, merge, billing 같은 protected action을 실행하지 않는다. 대신 review status patch, follow-up action, audit event를 생성한다.

## 실행

```bash
npm run approval:apply -- \
  --queue artifacts/approval-queue/latest/approval-queue.json \
  --decisions artifacts/approval-queue/latest/decision-template.json \
  --resource-evidence artifacts/resource-ingest/latest/resource-evidence.json \
  --out-dir artifacts/approval-decisions/latest
```

출력:

- `approval-decision-result.json`: 적용 결과
- `resource-evidence.patched.json`: evidence review status가 반영된 Resource/Evidence 섹션
- `audit-events.json`: `approval.decided` audit event 목록
- `summary.md`: 사람이 읽는 결과 요약

## Decision 값

지원되는 decision 예:

- `approved`, `approve_evidence`
- `rejected`, `reject_evidence`
- `changes_requested`, `request_reextract`
- `resolved`
- `waived`
- `cancelled`
- `pending`

`pending`은 적용하지 않고 `unapplied_items`에 남긴다.

## Goal 내 위치

이 단계는 `/goal`의 Human Approval과 Audit Trail을 실제 데이터로 연결한다. 다음 단계에서는 이 결과를 기반으로 Evidence Viewer를 다시 렌더링하거나, matter-scoped review dashboard/API로 확장할 수 있다.
