# Creative Document Citation Renderer

Phase 261 adds a deterministic citation renderer for the creative-document pack.

The renderer reads existing source-span, citation-object, exhibit-map, and layout-validator artifacts as read-only inputs. It emits internal draft citation render rows for:

- footnote text
- exhibit references
- source span links
- per-layout-target citation render packets

The renderer does not mutate DOCX, PPTX, HTML, or PDF files. It writes only its own artifact directory and keeps every row attorney-review gated, citation-currentness-review gated, non-client-facing, and blocked from delivery.

Run:

```powershell
npm run creative-document:citation-renderer -- --check
```
