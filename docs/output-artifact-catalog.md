# Output Artifact Catalog

`Output Artifact Catalog`는 각 vertical slice 안에 흩어진 `governance_output.output_artifacts`를 하나의 읽기 전용 카탈로그로 모은다.

핵심 목적은 산출물 생성과 전달을 분리하는 것이다. 어떤 파일이 생성됐는지, 어떤 capability/workflow에서 나왔는지, citation이 몇 개 붙었는지, approval과 blocking gate 때문에 아직 전달 불가인지 한 번에 확인할 수 있다.

## 실행

```bash
npm run output:catalog -- \
  --law-firm-slice artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json \
  --personal-dev-slice artifacts/personal-dev-slice/latest/personal-dev-slice.json \
  --creative-document-slice artifacts/creative-document-slice/latest/creative-document-slice.json \
  --out-dir artifacts/output-catalog/latest
```

출력:

- `output-catalog.json`: 산출물별 delivery readiness 계약
- `summary.md`: 사람이 읽는 요약

## Delivery State

- `draft_only`: 생성됐지만 아직 전달 대상으로 볼 수 없음
- `blocked_pending_approval`: 승인 대기 때문에 전달 불가
- `blocked_by_gate`: gate 실패 또는 blocking gate 때문에 전달 불가
- `blocked_by_decision`: 반려 또는 수정 요청 때문에 전달 불가
- `ready_for_delivery`: 승인과 gate를 통과해 전달 준비됨
- `delivered`: 전달 완료

## Goal 내 위치

이 단계는 `/goal`의 Output/Delivery Plane을 실제 운영 표면으로 만드는 첫 조각이다. Law Firm, Personal Dev, Creative Document 산출물이 모두 같은 `OutputArtifact` 계약으로 모이기 때문에, 이후 이메일 발송, PR merge, 고객 전달, ERP 반영 같은 protected delivery action을 붙여도 생성 단계와 전달 단계가 섞이지 않는다.
