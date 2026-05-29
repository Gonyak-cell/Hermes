# Creative Document Version Comparator

Phase 262 adds a deterministic document comparison artifact for draft outputs produced by the Creative and Document Domain Pack.

The comparator reads DOCX, PPTX, PDF/HTML renderer artifacts plus the layout validator and citation renderer as read-only inputs. It creates one document version pair per layout target, change records for content hash, layout validation, citation rendering, and review-gate posture, and a comparison packet for attorney review.

The artifact is internal and review-only. It does not mutate draft sources, execute document runtimes, call external renderers, access the network, deliver outputs, perform protected actions, generate legal advice, or mark anything client-facing ready.

Command:

```bash
npm run creative-document:version-comparator -- --check
```
