# Creative Document Slice Runner

`Creative Document Slice Runner`는 `creative-document-brief.v1` 입력을 받아 draft PPTX, deck manifest, markdown outline, format validation gate, human approval gate, event ledger를 생성한다.

이 단계는 완성형 PPTX 디자인 시스템이 아니라, `/goal`에서 요구한 문서/콘텐츠 제작용 domain pack의 첫 실행 경로다. 핵심은 문서 렌더링 결과가 draft-only로 남고, format validation과 human approval을 통과하기 전에는 전달 가능한 산출물로 취급하지 않는 것이다.

## 실행

```bash
npm run creative-document:slice -- --run-at 2026-05-23T09:00:00.000Z
```

출력:

- `creative-document-slice.json`: Identity/Policy, Resource/Evidence, Workflow/Runtime, Governance/Output을 포함한 vertical slice
- `event-ledger.json`: workflow, renderer, gate, output, approval event ledger
- `deck-manifest.json`: slide/layout/style token manifest
- `draft-deck.pptx`: deterministic local PPTX draft
- `deck-outline.md`: 사람이 검토할 수 있는 outline
- `format-validation.json`: ZIP/package and slide-level validation summary
- `summary.json`: Dashboard/API가 읽는 slice summary

## Gate

- `classification_gate`: P0/P1 입력만 기본 허용
- `tool_permission_gate`: local filesystem read/write만 사용
- `cost_budget_gate`: deterministic local rendering, external model cost 없음
- `format_validation_gate`: PPTX package signature, slide count, title/bullet length 확인
- `human_approval_gate`: delivery 전 human review pending/blocking

## Goal 내 위치

이 단계는 Creative Document Pack을 Law Firm/Personal Dev와 같은 Control Plane 계약 아래에 올리는 첫 조각이다. 이후 실제 PPTX template registry, layout validator, overflow checker, DOCX/PDF renderer와 연결해도 `Capability → Workflow → Runtime → Gate → Output → Audit` 경로는 유지된다.
