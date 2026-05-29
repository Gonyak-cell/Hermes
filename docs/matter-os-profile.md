# Matter OS Profile

P232 Matter OS Profile은 Matter Cockpit이 첫 화면에서 읽을 수 있는 matter-scoped profile card를 생성한다.

## 목적

- 고객, 상대방, 사건번호, 보안등급, 담당자를 한 카드에 고정한다.
- `matter_id` 단위로만 데이터를 묶고 다른 matter와 섞지 않는다.
- Law-firm pack의 attorney/human review gate와 `pending_review` output posture를 그대로 보존한다.
- Desktop은 read-only 조회 표면이며 matter data write, runtime execution, delivery execution을 수행하지 않는다.

## 입력

- `artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json`
- `artifacts/client-counterparty-registry/latest/client-counterparty-registry.json`
- `artifacts/matter-contract-freeze/latest/matter-contract-freeze.json`
- `artifacts/law-firm-pack-manifest/latest/law-firm-pack-manifest.json`

## 산출물

- `artifacts/matter-os-profile/latest/matter-os-profile.json`
- `artifacts/matter-os-profile/latest/matter-os-profile-cards.json`
- `artifacts/matter-os-profile/latest/matter-os-display-fields.json`
- `artifacts/matter-os-profile/latest/matter-os-profile-boundary.json`
- `artifacts/matter-os-profile/latest/validation-report.json`
- `artifacts/matter-os-profile/latest/summary.md`

## 검증

`npm run matter-os:profile -- --check`는 모든 profile card가 client, counterparty, matter number, security grade, responsible owner를 표시하고, matter-team boundary와 attorney/human review gate를 보존하는지 확인한다.

Human review note: 이 산출물은 운영 컨텍스트 전용이다. 법률 조언, client-facing output, delivery execution, runtime execution, matter data write는 생성하거나 수행하지 않는다.
