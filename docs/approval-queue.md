# Approval Queue

`Approval Queue`는 Evidence Viewer의 review packet을 사람이 처리할 수 있는 queue artifact로 변환한다.

이 단계는 아직 외부 시스템에 task를 만들거나 이메일을 보내지 않는다. `needs_review` evidence, blocking gate, quarantined resource를 하나의 승인/검토 목록으로 정렬하고, 사람이 결정을 기록할 수 있는 `decision-template.json`을 만든다.

## 실행

```bash
npm run approval:queue -- --input artifacts/evidence-viewer/latest/evidence-viewer.json --out-dir artifacts/approval-queue/latest
```

출력:

- `approval-queue.json`: pending review item 목록
- `decision-template.json`: 사람이 승인/반려/재추출 요청을 기록할 빈 결정 파일
- `summary.md`: 사람이 읽는 queue 요약

## Queue Item

현재 item type:

- `blocking_gate_review`: blocking gate 해소 또는 waiver 필요
- `blocked_resource_review`: quarantined/failed resource 처리 필요
- `evidence_review`: machine-extracted evidence 승인, 반려, 재추출 요청, matter 배정 필요

Priority:

- `critical`: secret/credential 위험 또는 blocking gate
- `high`: client confidential evidence, unsupported/failed resource
- `medium`: internal evidence review
- `low`: non-blocking 참고 항목

## Goal 내 위치

이 단계는 `/goal`의 Human Approval을 실제 작업 목록으로 만드는 첫 단계다. 다음 단계에서는 `decision-template.json`에 기록된 결정을 적용해 Evidence review status를 바꾸고, audit event를 남기는 `approval decision applier`로 확장한다.
