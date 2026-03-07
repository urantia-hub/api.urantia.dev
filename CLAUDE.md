# urantia-dev-api

AI/developer-first API for the Urantia Papers.

## Tech Stack

- Runtime: Bun
- Framework: Hono + @hono/zod-openapi
- ORM: Drizzle
- Database: Supabase (Postgres + pgvector)
- Validation: Zod v4
- Linting: Biome

## Commands

- `bun run dev` — Start dev server with hot reload
- `bun run seed` — Seed database from JSON files
- `bun run db:generate` — Generate Drizzle migrations
- `bun run db:push` — Push schema to database
- `bun run typecheck` — Type check
- `bun run lint` — Lint with Biome

## Project Structure

- `src/index.ts` — Hono app entry point
- `src/db/schema.ts` — Drizzle table definitions
- `src/db/client.ts` — Database client
- `src/lib/logger.ts` — BetterStack logger factory (dev fallback to console)
- `src/routes/` — API route handlers (toc, papers, paragraphs, search, audio)
- `src/middleware/` — CORS, structured logging, rate limiting, cache control
- `src/validators/schemas.ts` — Zod schemas for request/response
- `src/types/node.ts` — TypeScript types + ref format detection
- `scripts/seed.ts` — Database seeder from urantia-papers-json
- `scripts/setup-fts.sql` — Full-text search setup SQL

## Observability

- **Logging**: BetterStack via `@logtail/edge`. Structured JSON logs with request metadata.
- **Metrics**: Search queries and endpoint usage are logged as structured events to BetterStack, queryable via SQL dashboards.
- **Error tracking**: Global error handler sends stack traces to BetterStack.
- **Health check**: `GET /health` verifies DB connectivity.
- **Uptime monitoring**: BetterStack uptime monitor on `/health`.

## Changelog

When making user-facing changes to the API (new endpoints, breaking changes, new features), update the changelog in the Mintlify docs at `../urantia-dev-mintlify-docs/changelog.mdx`.
