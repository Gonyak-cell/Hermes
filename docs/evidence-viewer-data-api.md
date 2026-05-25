# Evidence Viewer Data API

`Evidence Viewer Data API`는 Source Span Store, Evidence Item Store, Lineage Graph Builder를 하나의 read-only viewer 데이터 계약으로 묶는다.

이 단계의 목적은 UI를 만들기 전에 evidence card, source span panel, lineage path panel이 같은 id와 policy boundary를 공유하도록 고정하는 것이다. 이 API 데이터는 검토 화면에서 조회할 수 있지만 evidence 승인, output delivery, quarantine release 같은 실행 행위를 허용하지 않는다.

## 실행

```bash
npm run evidence:viewer-data -- --check
```

출력:

- `evidence-viewer-data-api.json`: viewer 데이터 API 계약 전체
- `viewer-cards.json`: evidence item 중심 검토 카드
- `source-span-panels.json`: source span 중심 원문 위치 패널
- `lineage-path-panels.json`: source span에서 output paragraph까지의 lineage 경로 패널
- `validation-report.json`: 데이터 연결 검증 결과
- `summary.md`: 요약

## Review API Routes

- `GET /api/evidence-viewer-data`
- `GET /api/evidence-viewer-cards`
- `GET /api/evidence-viewer-source-spans`
- `GET /api/evidence-viewer-lineage-paths`
- `GET /api/evidence-viewer-data-validations`

## Gate

- 모든 evidence item은 viewer card 하나로 노출된다.
- 모든 viewer card는 source span 하나 이상과 lineage path 하나 이상을 가져야 한다.
- 모든 source span panel은 evidence item과 연결되어야 한다.
- 모든 lineage path panel은 node sequence와 edge sequence를 포함해야 한다.
- viewer data는 read-only이며 output delivery를 허용하지 않는다.
