# TODO

## Next up

- [ ] **Structured logging** — Add Axiom (free tier) or Cloudflare Logpush for production observability. Currently only `console.error` in the error handler, only visible via `wrangler tail`.

- [ ] **Tests** — No tests exist. Priority targets:
  - Search endpoint (most complex — tsquery building, pagination, filters)
  - Paragraph ref format detection (`detectRefFormat`)
  - Rate limiter middleware
  - Cache-control header middleware

- [x] **Semantic search** — `POST /search/semantic` endpoint with pgvector cosine similarity. Embeddings generated via `text-embedding-3-small`, stored in DB + `data/embeddings.json`. HNSW index for fast vector search.

## Future

- [ ] **Hyperdrive** — Cloudflare's edge connection pooler. Would replace per-request DB connections with pooled ones. Requires Workers Paid plan ($5/mo). Not needed yet but worth it at scale.

- [ ] **Staging environment** — Add `[env.staging]` to `wrangler.toml` with a separate `DATABASE_URL` when ready.

- [ ] **OpenAPI spec sync** — The Mintlify docs reference a static `api-reference/openapi.json`. Add a script or CI step to fetch the latest spec from production and update it.

- [ ] **Logo** — Create a combined SVG with icon + "Urantia.dev" wordmark for the Mintlify docs header.
