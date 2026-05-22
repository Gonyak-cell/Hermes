# Evidence Viewer

`Evidence Viewer`는 `resource-evidence.v1` 또는 `resource-ingest.json`을 사람이 검토할 수 있는 review packet으로 렌더링한다.

초기 버전은 별도 서버가 아니라 정적 HTML과 Markdown을 생성한다. 이렇게 하면 Evidence OS의 데이터 계약을 먼저 고정하면서도, 나중에 dashboard/API로 확장할 UI 구조를 미리 잡을 수 있다.

## 실행

```bash
npm run evidence:viewer -- --input artifacts/resource-ingest/latest/resource-ingest.json --out-dir artifacts/evidence-viewer/latest
```

출력:

- `evidence-viewer.html`: 정적 evidence review 화면
- `evidence-viewer.json`: UI가 쓰는 review packet
- `summary.md`: 터미널/리뷰용 요약

## 표시 항목

- Resource count
- Evidence candidate count
- Needs review count
- Blocking gate count
- Blocked item count
- Gate status
- Evidence review queue
- Source URI, resource id, classification, preview text

## Goal 내 위치

이 단계는 `/goal`의 Evidence Lineage와 Human Approval 사이에 있는 사람 검토 표면이다. 이후 dashboard/API를 만들 때도 이 review packet shape를 유지하면, UI가 바뀌어도 core Resource/Evidence 계약은 흔들리지 않는다.
