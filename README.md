# Urantia Papers API

A developer and AI-agent friendly API for the Urantia Papers. Provides full-text search, structured content access, and audio URLs for all 14,500+ paragraphs across 197 papers.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/toc` | Table of contents (parts → papers) |
| GET | `/papers` | List all 197 papers |
| GET | `/papers/:id` | Single paper with all paragraphs |
| GET | `/papers/:id/sections` | Sections within a paper |
| GET | `/paragraphs/random` | Random paragraph |
| GET | `/paragraphs/:ref` | Paragraph by any ID format |
| GET | `/paragraphs/:ref/context` | Paragraph with surrounding context |
| POST | `/search` | Full-text search with pagination |
| GET | `/audio/:paragraphId` | Audio info for a paragraph |

Interactive docs available at `/docs` (Swagger UI). OpenAPI spec at `/openapi.json`.

## Paragraph ID Formats

The API accepts three reference formats — auto-detected from the string:

| Format | Example | Structure |
|--------|---------|-----------|
| globalId | `1:2.0.1` | `partId:paperId.sectionId.paragraphId` |
| standardReferenceId | `2:0.1` | `paperId:sectionId.paragraphId` |
| paperSectionParagraphId | `2.0.1` | `paperId.sectionId.paragraphId` |

## Search

```bash
curl -X POST https://api.urantia.dev/search \
  -H "Content-Type: application/json" \
  -d '{"q": "Universal Father", "limit": 10, "type": "and"}'
```

Search modes: `and` (all words, default), `or` (any word), `phrase` (exact match). Optional filters: `paperId`, `partId`.

## Audio

Paragraphs include an `audio` field — a nested object keyed by model and voice, or `null` if no audio exists:

```json
{
  "audio": {
    "tts-1-hd": {
      "nova": { "format": "mp3", "url": "https://audio.urantia.dev/tts-1-hd-nova-3:119.1.5.mp3" },
      "echo": { "format": "mp3", "url": "https://audio.urantia.dev/tts-1-hd-echo-3:119.1.5.mp3" }
    }
  }
}
```

Available models and voices vary per paragraph. The dedicated `/audio/:paragraphId` endpoint returns just the audio data for a given paragraph.

## Caching

Responses include `Cache-Control` headers. Cloudflare's CDN caches at the edge via `s-maxage`:

| Route | CDN (s-maxage) | Browser (max-age) |
|-------|---------------|-------------------|
| `/toc`, `/papers/*`, `/paragraphs/:ref`, `/audio/*` | 24 hours | 1 hour |
| `/search` | 1 hour | 5 minutes |
| `/paragraphs/random` | no-store | no-store |
| `/`, `/docs`, `/openapi.json` | 1 hour | 5 minutes |

## For AI Agents

Recommended flow:

1. `GET /toc` — understand the book structure
2. `POST /search` — find relevant passages
3. `GET /paragraphs/:ref/context?window=3` — get surrounding context
4. `GET /papers/:id` — read a full paper

## Tech Stack

- **Runtime:** [Bun](https://bun.sh) (dev) / [Cloudflare Workers](https://workers.cloudflare.com) (production)
- **Framework:** [Hono](https://hono.dev) + [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
- **Database:** [Supabase](https://supabase.com) (PostgreSQL + pgvector)
- **ORM:** [Drizzle](https://orm.drizzle.team)

## Development

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase DATABASE_URL

# Push schema to database
bun run db:push

# Set up full-text search (run after db:push)
bun scripts/run-fts-setup.ts

# Generate audio manifest (requires ../urantia-hub-api)
bun run generate-manifest

# Seed database from urantia-papers-json
bun run seed

# Start dev server (hot reload)
bun run dev
```

The server runs at `http://localhost:3000` by default.

## Deployment

Deployed to Cloudflare Workers. First-time setup:

```bash
npx wrangler login
npx wrangler secret put DATABASE_URL
# paste your Supabase connection string (use pooler port 6543)
```

Deploy:

```bash
bun run deploy
```

## Data

Content sourced from [urantia-papers-json](https://github.com/nicholasgasior/urantia-papers-json) — 197 papers, 1,626 sections, 14,500+ paragraphs with audio narration via [audio.urantia.dev](https://audio.urantia.dev).

## License

MIT
