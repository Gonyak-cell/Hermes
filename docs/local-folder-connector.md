# Local Folder Connector

`connectors:local-folder` writes the Phase 268 local folder connector artifact.

The connector reads only configured local path roots, discovers files recursively, processes them in a resumable batch, and writes connector discovery, ingest, cursor, auth-boundary, validation, and summary artifacts under `artifacts/local-folder-connector/latest/`.

The connector uses the P267 `connector.local_folder.v2` contract:

- `source.local_folder.v2` remains the stable source id.
- Cursor state is stored in `resource-expansion/resource-expansion-state.json`.
- Every discovered file receives a deterministic external id and external version id.
- Auth is local path allowlist only; no credentials or external network are used.

Source folders are not mutated. Ingest-ready resource candidates remain human-review gated and are not treated as legal advice or client-facing output.
