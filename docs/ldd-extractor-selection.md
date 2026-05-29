# LDD Extractor Selection

Phase 242는 LDD 문서 분류 결과를 기준으로 문서별 extractor profile을 고르는 결정적 selection ledger입니다.

이 ledger는 Phase 241 `LDD Document Classification` artifact와 local `Extractor Adapter Contract`를 읽고, 분류된 VDR file 또는 missing-data row마다 extractor profile 하나와 선택 근거를 남깁니다. 출력은 운영 라우팅 metadata일 뿐이며, extractor 실행 결과나 법률 판단이 아닙니다.

## 산출물

- `artifacts/ldd-extractor-selection/latest/ldd-extractor-selection.json`
- `artifacts/ldd-extractor-selection/latest/ldd-extractor-registry.json`
- `artifacts/ldd-extractor-selection/latest/ldd-extractor-selection-records.json`
- `artifacts/ldd-extractor-selection/latest/ldd-extractor-selection-rationales.json`
- `artifacts/ldd-extractor-selection/latest/ldd-extractor-matter-summaries.json`
- `artifacts/ldd-extractor-selection/latest/ldd-extractor-selection-boundary.json`
- `artifacts/ldd-extractor-selection/latest/validation-report.json`
- `artifacts/ldd-extractor-selection/latest/summary.md`

## Guardrails

- Extractor는 선택만 하고 실행하지 않습니다.
- Missing-data row는 follow-up planning 용도로만 라우팅하며, 사실 부존재 판단으로 취급하지 않습니다.
- Legal advice, legal conclusion, matter mutation, task mutation, workflow transition, delivery, client-facing output은 생성하지 않습니다.
- 모든 selection/rationale row는 downstream legal 또는 client-facing 사용 전 attorney/human review gate를 유지합니다.
- Desktop/dashboard/API view는 read-only projection이며 source of truth가 아닙니다.

## Command

```powershell
npm run law-firm:extractor-selection -- --check
```
