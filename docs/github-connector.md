# GitHub Connector

`connectors:github` writes the Phase 272 GitHub connector artifact.

This stage reads operator-provided GitHub export JSON. It does not call the GitHub API, access the network, read credentials, mutate issues, mutate pull requests, push branches, merge, release, deliver outputs, or produce client-facing work product.

The connector emits:

- repository metadata resource candidates
- issue resource candidates and workflow input candidates
- pull request resource candidates and workflow input candidates
- commit resource candidates and workflow input candidates
- pull request review resource candidates and workflow input candidates
- repo event since-cursor state with hash-only resume token storage
- credential-reference-only GitHub auth boundary
- validation and summary artifacts

Outputs are written under `artifacts/github-connector/latest/`.

- `github-connector.json`
- `github-repository-records.json`
- `github-issue-records.json`
- `github-pull-request-records.json`
- `github-commit-records.json`
- `github-review-records.json`
- `github-workflow-input-records.json`
- `cursor-state.json`
- `auth-boundary.json`
- `validation-report.json`
- `summary.md`

Validation command:

```powershell
npm run connectors:github -- --check
```

All repository, issue, pull request, commit, review, and workflow input projections remain internal candidates requiring human review. The artifact does not provide legal advice and does not create client-facing output.
