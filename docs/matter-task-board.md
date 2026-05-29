# Matter Task Board

P235 Matter Task Board는 matter 운영 화면에서 task, 담당자, 기한, status, workflow binding을 한 줄로 확인하기 위한 read-only 산출물이다.

## Source

- Matter Document Index
- Matter Timeline
- Matter OS Profile
- Workflow Run Dashboard
- safe demo matter files
- Output Catalog
- Protected Delivery Queue

## Output

`npm run matter:task-board -- --check`는 다음 파일을 `artifacts/matter-task-board/latest`에 쓴다.

- `matter-task-board.json`
- `matter-task-records.json`
- `matter-task-board-columns.json`
- `matter-task-workflow-bindings.json`
- `matter-task-board-boundary.json`
- `validation-report.json`
- `summary.md`

## Boundary

이 artifact는 task board row를 생성하지만 task state, matter data, workflow state를 수정하지 않는다. Runtime execution, delivery execution, protected action, legal advice, client-facing output generation은 모두 금지된다. 모든 행은 attorney/human review context로만 사용한다.
