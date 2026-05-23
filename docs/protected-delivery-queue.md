# Protected Delivery Queue

`Protected Delivery Queue`는 Output Artifact Catalog의 산출물을 실제 전달 후보로 변환하되, 고객 발송, GitHub merge, 문서 전달 같은 protected action은 절대 자동 실행하지 않는다.

```bash
npm run delivery:queue
```

기본 입력:

- `artifacts/output-catalog/latest/output-catalog.json`
- `artifacts/observability/latest/observability-catalog.json`

출력:

- `protected-delivery-queue.json`
- `summary.md`

각 delivery action은 다음을 가진다.

- artifact와 workflow run 연결
- delivery target/channel
- approval 상태
- blocking gate 목록
- recommended action
- runtime seconds

이 단계는 `/goal`의 Output/Delivery Plane에서 생성과 전달을 분리하는 보호 계층이다. Law Firm 보고서, Creative PPTX, Personal Dev PR draft가 모두 같은 delivery queue 계약으로 들어오지만, 사람 승인과 gate가 통과되기 전에는 `blocked_*` 상태로 남는다.
