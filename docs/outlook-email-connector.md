# Outlook Email Connector

`connectors:outlook-email` writes the Phase 270 Outlook EML/email connector artifact.

This stage reads safe local `.eml` and Microsoft Graph-style JSON exports. It does not call the Outlook API, perform OAuth, read credential material, send email, mutate mailbox state, or produce client-facing output.

The connector emits:

- email message resource candidates with subject, sender, recipients, timestamp, message id, conversation/thread id, external id, and resource version id
- attachment resource candidates linked to their parent message and thread
- thread records that group message and attachment membership under stable thread ids
- a mail-folder delta cursor boundary with hash-only resume token storage
- an OAuth delegated read-only auth boundary that remains credential-reference-only
- validation and summary artifacts

Outputs are written under `artifacts/outlook-email-connector/latest/`.

- `outlook-email-connector.json`
- `email-message-records.json`
- `email-attachment-records.json`
- `email-thread-records.json`
- `cursor-state.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

Validation command:

```powershell
npm run connectors:outlook-email -- --check
```

All message, attachment, and thread projections remain internal resource candidates requiring human review. The artifact does not provide legal advice and does not create client-facing work product.
