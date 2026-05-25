# Evidence Contract Freeze

Phase 102는 Law Firm LDD slice, Resource contract freeze, Matter contract freeze, Policy contract freeze를 입력으로 삼아 Evidence plane의 핵심 lineage 계약을 v2 fixture로 고정한다.

실행:

```sh
npm run contracts:evidence
```

주요 산출물:

- `artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json`
- `artifacts/evidence-contract-freeze/latest/source-span-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/evidence-item-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/fact-claim-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/issue-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/citation-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/lineage-edge-v2-fixture.json`
- `artifacts/evidence-contract-freeze/latest/validation-report.json`
- `artifacts/evidence-contract-freeze/latest/summary.md`

완료 기준:

- SourceSpan, EvidenceItem, FactClaim, Issue, Citation, LineageEdge가 각각 v2 fixture로 생성되어야 한다.
- 모든 SourceSpan은 Resource v2, ResourceVersion, matter boundary, classification, policy snapshot을 보존해야 한다.
- 모든 EvidenceItem은 하나 이상의 SourceSpan에 연결되어야 한다.
- 모든 FactClaim은 EvidenceItem에 연결되어야 한다.
- 모든 Issue는 FactClaim과 EvidenceItem lineage를 보존해야 한다.
- 모든 Citation은 `source_span -> evidence -> fact -> issue -> citation` 경로를 완성해야 한다.
