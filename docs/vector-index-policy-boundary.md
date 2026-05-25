# Vector Index Policy Boundary

Phase 149 keeps vector search as a policy-bound contract, not an executable index.

The boundary consumes the Phase 148 search index query plans and binds them to:

- matter wall and retrieval wall filters
- matter access policy
- data classification rules
- external model policy decisions
- policy snapshot references

Each search query plan receives one `vector_policy_gate`. Each gate then receives one `embedding_route_policy` per classification model policy gate. The route records whether external embedding would be allowed, approval-gated, or forbidden by policy, but every route remains `route_executable: false` until a later retrieval compiler and approved vector adapter exist.

Required invariant:

1. No vector route is executable in Phase 149.
2. P2-P5 routes are never externally allowed.
3. Every vector gate requires tenant, matter, classification, and policy snapshot filters.
4. Every vector gate preserves source refs and policy snapshot refs.
5. Every vector gate enforces matter wall, classification policy, external model policy, and audit gates before retrieval.
