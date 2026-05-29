# Web Novel Workflow

Phase 264 adds a deterministic creative-document web novel workflow. The workflow reads the creative-document brief, the creative-document pack manifest, template and style registries, the Phase 263 design-system profile, and the output-delivery freeze as read-only inputs.

The generated artifact is draft-only. It creates one synopsis, one style guide, chapter drafts from the brief sections, one revision packet per chapter, and one markdown draft output artifact. Every generated row stays behind human review and format-validation gates.

The workflow does not call an external model, does not access the network, does not mutate templates, styles, assets, or runtime documents, does not execute delivery, and does not create legal advice or client-facing-ready work product.

Run it with:

```bash
npm run creative-document:web-novel-workflow
npm run creative-document:web-novel-workflow -- --check
```

Primary output:

```text
artifacts/web-novel-workflow/latest/web-novel-workflow.json
artifacts/web-novel-workflow/latest/web-novel-draft.md
```
