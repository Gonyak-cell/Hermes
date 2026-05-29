# Matter Document Index

P234 Matter Document Index는 matter 운영 화면에서 원본, 초안, 제출본, 최신본, 상대방안을 구분해 볼 수 있게 하는 read-only 산출물이다.

## 목적

- `matter_id`별 문서를 original, draft, submitted, counterparty proposal 역할로 분류한다.
- 문서 family마다 최신본을 하나씩 지정해 현재 작업 기준 문서가 무엇인지 표시한다.
- output catalog와 protected delivery queue의 law-firm review packet은 submitted 문서로 연결하되 실제 전달은 수행하지 않는다.
- Desktop은 조회만 하며 matter data write, runtime execution, delivery execution을 수행하지 않는다.

## 입력

- `artifacts/matter-timeline/latest/matter-timeline.json`
- `examples/project-alpha-matter.json`
- `examples/project-beta-litigation-matter.json`
- `artifacts/output-catalog/latest/output-catalog.json`
- `artifacts/delivery-queue/latest/protected-delivery-queue.json`

## 산출물

- `artifacts/matter-document-index/latest/matter-document-index.json`
- `artifacts/matter-document-index/latest/matter-document-records.json`
- `artifacts/matter-document-index/latest/matter-document-families.json`
- `artifacts/matter-document-index/latest/matter-latest-documents.json`
- `artifacts/matter-document-index/latest/matter-document-index-boundary.json`
- `artifacts/matter-document-index/latest/validation-report.json`
- `artifacts/matter-document-index/latest/summary.md`

## 검증

`npm run matter:document-index -- --check`는 original, draft, submitted, counterparty proposal role이 모두 존재하는지, 모든 document record가 `matter_id`로 scoped 되었는지, 각 document family에 최신본이 하나씩 지정되었는지, 그리고 read-only/no-output boundary가 유지되는지 확인한다.

Human review note: 이 산출물은 운영 맥락 확인용이다. 법률 조언, client-facing output, delivery execution, runtime execution, matter data write를 생성하거나 수행하지 않으며 attorney/human review가 계속 필요하다.
