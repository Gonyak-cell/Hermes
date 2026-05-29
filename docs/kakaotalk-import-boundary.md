# KakaoTalk Import Boundary

`connectors:kakaotalk-import-boundary` writes the Phase 271 KakaoTalk import boundary artifact.

This stage reads operator-provided KakaoTalk text exports and an attachment manifest. It does not execute the KakaoTalk app, call live chat APIs, access the network, read credentials, mutate source exports, deliver outputs, or produce client-facing work product.

The boundary emits:

- chat message resource candidates with export id, chat room id, source line offset, author, date/time, external id, and resource version id
- chat attachment resource candidates linked to parent message lines and conversation rows
- conversation records that group message and attachment membership under stable chat room ids
- a line-offset cursor state with hash-only resume token storage
- an operator-provided-export auth boundary with no credential requirement
- validation and summary artifacts

Outputs are written under `artifacts/kakaotalk-import-boundary/latest/`.

- `kakaotalk-import-boundary.json`
- `kakaotalk-message-records.json`
- `kakaotalk-attachment-records.json`
- `kakaotalk-conversation-records.json`
- `cursor-state.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

Validation command:

```powershell
npm run connectors:kakaotalk-import-boundary -- --check
```

All message, attachment, and conversation projections remain internal resource candidates requiring human review. The artifact does not provide legal advice and does not create client-facing output.
