# LDD Document Classification

`LDD Document Classification`은 P240 `LDD VDR Inventory`의 file row와 missing/requested data row를 읽어 계약, 등기, 인허가, 소송, 노동, 세무 등 운영 문서유형을 분류하는 내부 ledger다.

## 분류 범위

- `contract`
- `registry`
- `license_permit`
- `litigation`
- `labor_employment`
- `tax`
- `corporate_governance`
- `closing_deliverable`
- `other`

## 안전 경계

- 분류는 deterministic metadata routing label이며 법률 판단이 아니다.
- missing/requested row는 후속 요청 후보로만 분류하고 부존재 판단을 하지 않는다.
- 법률 자문, client-facing output, 외부 VDR 접속, matter/task/workflow/runtime/delivery/protected mutation을 수행하지 않는다.
- 모든 분류 row는 attorney/human review gate를 유지한다.
- Desktop/dashboard/API는 read-only projection이며 source of truth가 아니다.

## 실행

```bash
npm run law-firm:document-classification
npm run law-firm:document-classification -- --check
```

기본 산출물은 `artifacts/ldd-document-classification/latest`에 기록된다.
