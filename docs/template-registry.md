# Template Registry

Phase 254 adds a read-only template registry for DOCX, PPTX, HTML, and email template metadata.

Run:

```powershell
npm run creative-document:template-registry -- --check
```

The registry reads domain-pack template declarations and records template family, output format, current version, metadata hash, and pack binding rows. It is metadata-only: it does not write template files, execute renderers, deliver outputs, run protected actions, or generate client-facing work product.

All registered templates remain subject to format validation and human review before any external or client-facing use.
