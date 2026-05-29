# DOCX Renderer

Phase 257 adds a deterministic DOCX renderer workflow for the Creative and Document Domain Pack.

## Scope

- Reads the Phase 254 template registry, Phase 255 style registry, and Phase 256 asset registry as source contracts.
- Selects registered `docx` templates and builds review-gated template data packets.
- Generates minimal OpenXML parts and writes a draft `.docx` artifact in the artifact output directory.
- Records DOCX format validation results, binary hashes, OpenXML part hashes, and review gates.

## Safety Posture

- The output is a draft artifact only.
- The renderer does not run an external Document Renderer runtime, does not use network access, and does not deliver output.
- The generated artifact includes an explicit attorney review note and is not legal advice.
- Client-facing readiness stays false until format validation, citation review, and explicit human approval pass.

## Command

```powershell
npm run creative-document:docx-renderer -- --check
```

Main artifact:

```text
artifacts/docx-renderer/latest/docx-renderer.json
```
