# TODO

## Next up

- [x] **Structured logging** — BetterStack via `@logtail/edge`. Structured JSON logs with request metadata, search query metrics, and error tracking with stack traces. Health check at `GET /health`.

- [x] **Tests** — 70 integration + unit tests across all endpoints, middleware, and `detectRefFormat`. Run with `bun test`. Semantic search tests conditional on `OPENAI_API_KEY`.

- [x] **Semantic search** — `POST /search/semantic` endpoint with pgvector cosine similarity. Embeddings generated via `text-embedding-3-small`, stored in DB + `data/embeddings.json`. HNSW index for fast vector search.

## Future

- [ ] **Hyperdrive** — Cloudflare's edge connection pooler. Would replace per-request DB connections with pooled ones. Requires Workers Paid plan ($5/mo). Not needed yet but worth it at scale.

- [ ] **Staging environment** — Add `[env.staging]` to `wrangler.toml` with a separate `DATABASE_URL` when ready.

- [ ] **OpenAPI spec sync** — The Mintlify docs reference a static `api-reference/openapi.json`. Add a script or CI step to fetch the latest spec from production and update it.

- [ ] **Logo** — Create a combined SVG with icon + "Urantia.dev" wordmark for the Mintlify docs header.

- [ ] **ElevenLabs TTS audio** — Multi-voice narration of the entire Urantia Book using ElevenLabs Eleven v3. ~14,500 paragraphs with dynamic voice assignment based on paper author and dialogue speaker. Separate Python project. See `TTS_GAMEPLAN.md` for full plan. Estimated cost: $1,000-$2,000. Phases: data extraction → voice design & pronunciation dictionary → batch generation → QA & upload.

- [ ] **Multi-language support** — Add `?lang=` query parameter to all endpoints with AI-generated translations. Top 5 languages: Spanish, French, Portuguese, German, Korean. Part A: API schema/route changes (backwards compatible, defaults to English). Part B: Translation generation script using Claude Sonnet (~$150 for all 5 languages). See `MULTI_LANGUAGE_GAMEPLAN.md` for full plan.
