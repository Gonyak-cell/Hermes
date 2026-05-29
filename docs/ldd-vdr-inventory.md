# LDD VDR Inventory

`LDD VDR Inventory`는 matter별 VDR source register, VDR 요청, matter 문서, resource version ledger를 읽어 batch 단위 인벤토리를 만드는 내부 운영 산출물이다.

## 범위

- batch: matter와 VDR source register 단위의 inventory 묶음
- folder: issue/status 기반의 deterministic folder row
- file: 기존 matter document/evidence metadata에서 확인되는 received 또는 in-review 파일 row
- version: file row마다 하나의 deterministic version row
- missing data: `missing` 또는 `requested` 상태의 VDR 요청과 matter 문서
- matter summary: batch, folder, file, version, missing data 집계

## 안전 경계

- 외부 VDR 접속을 수행하지 않는다.
- missing 자료는 사실상 부존재로 판단하지 않고 후속 요청 후보로만 표시한다.
- 법률 자문, 법률 결론, client-facing output을 생성하지 않는다.
- 모든 row는 attorney/human review gate를 유지한다.
- Desktop/dashboard/API는 read-only projection이며 source of truth가 아니다.

## 실행

```bash
npm run law-firm:vdr-inventory
npm run law-firm:vdr-inventory -- --check
```

기본 산출물은 `artifacts/ldd-vdr-inventory/latest`에 기록된다.
