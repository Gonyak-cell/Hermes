# Law Firm Pack Manifest

P231은 `law-firm` domain pack이 core 수정 없이 등록되어 있고, Desktop이 이를 read-only operator surface로만 노출한다는 기준선을 고정한다.

## 목적

- `packs/law-firm/pack.json`과 domain pack registry 등록 상태를 대조한다.
- law-firm capability가 capability manifest v2와 capability registry API에 모두 노출되는지 확인한다.
- matter boundary, privileged classification, external model approval, attorney/human review gate, pending review output status를 보존한다.
- runtime, matter, policy, evidence, output delivery freeze와 연결해 client/court-facing 산출물이 attorney review 전에는 전달되지 않음을 기록한다.

## 산출물

기본 출력 위치는 `artifacts/law-firm-pack-manifest/latest`이다.

- `law-firm-pack-manifest.json`: P231 대표 artifact
- `law-firm-pack-registration.json`: pack registration 행
- `law-firm-capability-registrations.json`: capability별 registration 행
- `law-firm-pack-boundary.json`: Desktop/core/runtime/delivery boundary
- `validation-report.json`: checkpoint validation 결과
- `summary.md`: 사람이 읽는 요약

## 안전 경계

이 단계는 보고서 전용이다. 법률 자문, client-facing output 생성, runtime execution, protected mutation, delivery execution, core registry mutation, secret/provider exposure는 수행하지 않는다. 생성되는 모든 law-firm output 기준은 attorney review와 human approval gate를 필요로 하는 `pending_review` 상태로 유지된다.

## 실행

```bash
npm run law-firm:pack-manifest
npm run law-firm:pack-manifest -- --check
```

`--check`는 checkpoint validation이 실패하면 non-zero로 종료한다.
