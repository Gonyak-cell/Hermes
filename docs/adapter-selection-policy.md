# Adapter Selection Policy

이 문서는 LiteParse, PaddleOCR, 기존 OpenXML/PDF probe를 Hermes resource extraction 단계에 안전하게 붙이는 기준이다.

## 적용 위치

- `src/adapter-selection-policy.mjs`가 extension별 parser chain을 결정한다.
- `src/resource-extract.mjs`는 이 policy를 읽어 PDF/image, Office 문서의 추출 순서를 선택한다.
- `schemas/adapter-selection-policy.schema.json`은 policy artifact의 안전 조건을 고정한다.

## 교체 결론

- PDF와 이미지: `liteparse_local`을 1차 후보로 승격한다.
- OCR fallback: `paddleocr_local`만 허용하며 외부 OCR API나 cloud document AI는 차단한다.
- DOCX/PPTX/XLSX: 기존 OpenXML probe가 primary이고 LiteParse는 layout sidecar로만 실행한다.
- 모든 결과는 internal, pending review 상태로 남긴다.

## Trading Pack

이 policy는 Trading Pack domain pack, schema, scripts, tests를 수정하지 않는 것을 invariant로 둔다.
