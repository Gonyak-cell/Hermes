# Matter Timeline

P233 Matter Timeline은 matter 운영 화면에서 회의, 수신, 제출, 기한을 날짜순으로 확인하기 위한 read-only 산출물이다.

## 목적

- `matter_id`별로 회의, 수신 커뮤니케이션/문서, 제출 또는 review packet, 기한을 하나의 정렬된 타임라인으로 묶는다.
- Matter OS Profile과 연결되는 matter는 client, matter number, security grade 같은 표시 정보를 같이 유지한다.
- 모든 이벤트는 attorney/human review gate와 `pending_review` 기본 자세를 보존한다.
- Desktop companion은 조회만 하며 matter data write, runtime execution, delivery execution을 수행하지 않는다.

## 입력

- `artifacts/matter-os-profile/latest/matter-os-profile.json`
- `examples/project-alpha-matter.json`
- `examples/project-beta-litigation-matter.json`
- `artifacts/output-catalog/latest/output-catalog.json`
- `artifacts/delivery-queue/latest/protected-delivery-queue.json`

## 산출물

- `artifacts/matter-timeline/latest/matter-timeline.json`
- `artifacts/matter-timeline/latest/matter-timeline-events.json`
- `artifacts/matter-timeline/latest/matter-timeline-matters.json`
- `artifacts/matter-timeline/latest/matter-timeline-boundary.json`
- `artifacts/matter-timeline/latest/validation-report.json`
- `artifacts/matter-timeline/latest/summary.md`

## 검증

`npm run matter:timeline -- --check`는 네 가지 이벤트 타입이 모두 존재하는지, 모든 이벤트가 `matter_id`로 scoped 되었는지, 날짜순 정렬이 유지되는지, 그리고 read-only/no-output boundary가 유지되는지 확인한다.

Human review note: 이 산출물은 운영 맥락 확인용이다. 법률 조언, client-facing output, delivery execution, runtime execution, matter data write를 생성하거나 수행하지 않으며 attorney/human review가 계속 필요하다.
