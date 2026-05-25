# Citation Object Store

Phase 142 adds the first object-level bridge from review-pending issue candidates to review-pending output paragraph candidates.

The store is intentionally draft-only. It does not decide legal analysis, does not approve prose, and does not mark any output as client-facing ready. Its job is to make the output paragraph to source span relationship inspectable before an attorney reviews it.

## Command

```bash
npm run resource:citations -- --check
```

## Inputs

- `artifacts/issue-graph-store/latest/issue-graph-store.json`
- `package.json`
- `docs/implementation-roadmap.md`

## Outputs

- `artifacts/citation-object-store/latest/citation-object-store.json`
- `artifacts/citation-object-store/latest/output-paragraphs.json`
- `artifacts/citation-object-store/latest/citations.json`
- `artifacts/citation-object-store/latest/paragraph-source-bindings.json`
- `artifacts/citation-object-store/latest/citation-review-queue.json`
- `artifacts/citation-object-store/latest/citation-indexes.json`
- `artifacts/citation-object-store/latest/validation-report.json`
- `artifacts/citation-object-store/latest/summary.md`

## Guarantees

- One `output-paragraph.v1` candidate is created for each `issue.v2` issue candidate.
- One `citation.v2` object is created for each issue source span.
- Every citation points to an output paragraph, issue, fact, evidence item, and source span.
- Every paragraph-source binding preserves matter, classification, policy snapshot, and issue link metadata.
- All citation objects stay `needs_review`.
- All output paragraph candidates stay `not_client_facing`.
- `client_facing_ready` remains `false` until a later human approval workflow changes it.

## Validation

The store fails validation if the roadmap does not document Phase 142, the package script is missing, the issue graph source is incomplete, citation counts do not cover the issue/output paragraph set, binding rows are missing, review queue rows are missing, or any citation becomes client-facing ready without review.
