# Matter Personal Data Detector

P238 산출물은 Matter Knowledge Graph의 evidence node와 Matter Document Index, Matter Privilege Classifier, Data Classification Rule Engine, Resource Quarantine Model을 함께 읽어 개인정보 후보 탐지 결과를 만든다.

이 detector는 읽기 전용 운영 산출물이다. 개인정보 후보를 policy rule과 quarantine rule에 연결하지만, quarantine을 실제 적용하거나 matter data, task state, workflow, runtime, delivery 상태를 변경하지 않는다.

## Outputs

- `matter-personal-data-detector.json`
- `personal-data-detection-records.json`
- `personal-data-policy-links.json`
- `personal-data-quarantine-links.json`
- `matter-personal-data-summaries.json`
- `matter-personal-data-detector-boundary.json`
- `validation-report.json`
- `summary.md`

## Review Boundary

모든 detection, policy link, quarantine link는 `matter_id`를 보존한다. 모든 후보는 attorney/human review required 상태이며, legal advice 또는 client-facing output으로 간주하지 않는다.

Human review note: 개인정보 후보 탐지 결과는 변호사 및 사람 검토를 위한 운영 신호일 뿐이고, 법률 판단이나 외부 전송 가능한 최종 산출물이 아니다.
