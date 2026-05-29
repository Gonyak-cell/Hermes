# Matter Privilege Classifier

P237 Matter Privilege Classifier는 Matter Knowledge Graph의 evidence node를 기준으로 privilege, work product, confidentiality, external transfer candidate flag를 붙인다.

## 생성

```bash
npm.cmd run matter:privilege-classifier -- --check
```

기본 입력은 `artifacts/matter-knowledge-graph/latest/matter-knowledge-graph.json`, Matter Document Index, Matter Task Board, 안전한 demo matter files, Output Catalog, Protected Delivery Queue이다.

## 출력

- `artifacts/matter-privilege-classifier/latest/matter-privilege-classifier.json`
- `artifacts/matter-privilege-classifier/latest/privilege-classification-records.json`
- `artifacts/matter-privilege-classifier/latest/privilege-evidence-flags.json`
- `artifacts/matter-privilege-classifier/latest/matter-privilege-summaries.json`
- `artifacts/matter-privilege-classifier/latest/matter-privilege-classifier-boundary.json`
- `artifacts/matter-privilege-classifier/latest/validation-report.json`
- `artifacts/matter-privilege-classifier/latest/summary.md`

## 안전 경계

이 산출물의 flag는 attorney review용 후보 분류이며 최종 privilege determination이 아니다. 법률 조언이나 client-facing output을 만들지 않고, matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action을 수행하지 않는다.
