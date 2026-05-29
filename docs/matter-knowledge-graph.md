# Matter Knowledge Graph

P236 Matter Knowledge Graph는 안전한 demo matter file과 P233-P235 Matter OS 산출물을 읽어 `matter_id`별 fact, issue, legal theory placeholder, evidence를 read-only graph row로 정리한다.

## 생성

```bash
npm.cmd run matter:knowledge-graph -- --check
```

기본 입력은 `artifacts/matter-task-board/latest/matter-task-board.json`, `artifacts/matter-document-index/latest/matter-document-index.json`, `artifacts/matter-timeline/latest/matter-timeline.json`, `artifacts/matter-os-profile/latest/matter-os-profile.json`, demo matter files, Output Catalog, Protected Delivery Queue이다.

## 출력

- `artifacts/matter-knowledge-graph/latest/matter-knowledge-graph.json`
- `artifacts/matter-knowledge-graph/latest/matter-knowledge-nodes.json`
- `artifacts/matter-knowledge-graph/latest/matter-knowledge-edges.json`
- `artifacts/matter-knowledge-graph/latest/matter-knowledge-matter-summaries.json`
- `artifacts/matter-knowledge-graph/latest/matter-knowledge-graph-boundary.json`
- `artifacts/matter-knowledge-graph/latest/validation-report.json`
- `artifacts/matter-knowledge-graph/latest/summary.md`

## 안전 경계

Legal theory node는 변호사 검토가 필요한 placeholder일 뿐 법률 결론이나 조언이 아니다. 이 산출물은 client-facing output을 만들지 않고, matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action을 수행하지 않는다.
