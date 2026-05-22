# Observability Catalog

`Observability Catalog`는 각 vertical slice의 `event-ledger.json`과 workflow runtime을 모아 실행 상태, event 수, gate 결과, approval 대기, runtime cost를 하나의 읽기 전용 운영 카탈로그로 만든다.

```bash
npm run observability:catalog
```

기본 입력:

- `artifacts/vertical-slice/latest/vertical-slice.json`
- `artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json`
- `artifacts/personal-dev-slice/latest/personal-dev-slice.json`
- `artifacts/creative-document-slice/latest/creative-document-slice.json`
- 각 slice 폴더의 `event-ledger.json`

출력:

- `observability-catalog.json`
- `summary.md`

카탈로그는 workflow run, event, cost record를 분리해서 저장한다. 따라서 dashboard/API는 agent 자기보고 대신 ledger와 gate 결과를 기준으로 “어떤 runtime이 무엇을 실행했고, 어떤 gate에서 막혔고, 비용/시간이 얼마나 들었는지”를 재현할 수 있다.

이 단계는 `/goal`의 `Event/Audit/Run Ledger`와 `Output/Observability`를 운영 표면으로 올리는 얇은 slice다.
