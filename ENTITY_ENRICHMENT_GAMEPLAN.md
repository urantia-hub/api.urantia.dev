# Plan: Entity & Theme Enrichment for Urantia Papers API

## Context

Paragraphs currently have a `labels` array of flat strings (paper-level only, mostly empty on paragraphs). The goal is to replace this with a rich, typed entity + theme layer that makes every paragraph queryable by the people, places, orders, concepts, and races mentioned in it — and exposes those entities as first-class API resources with relationships between them.

This is a two-part project: **Part A** builds the enriched data (entity extraction + classification), **Part B** exposes it via new API endpoints.

---

## The Target Data Model

### Enriched paragraph object

```typescript
{
  "id": "1:2.0.1",
  // ... existing fields ...

  // Replaces flat labels[] — typed entity mentions with character spans
  "entities": [
    {
      "id": "universal-father",
      "name": "Universal Father",
      "type": "being",          // being | place | order | race | concept
      "subtype": "deity",
      "span": [4, 22]           // char offsets in text — enables UI highlighting
    },
    {
      "id": "havona",
      "name": "Havona",
      "type": "place",
      "subtype": "central-universe",
      "span": [88, 95]
    }
  ],

  // Separate from entities — conceptual motifs the paragraph is *about*
  "themes": ["divine-love", "personality", "sovereignty"]
}
```

**Why `entities` and `themes` are separate:** Entities are proper nouns with discrete identity (navigable, linkable). Themes are motifs a paragraph expresses without necessarily naming — "worship", "free will", "time and eternity". They serve different use cases: entity lookup is navigation, theme lookup is discovery.

**Why `span` matters:** Character offsets let UIs highlight exact mentions and let AI systems know *where* in a paragraph an entity appears, not just that it's present.

### Entity object

```typescript
{
  "id": "thought-adjuster",
  "name": "Thought Adjuster",
  "type": "being",
  "subtype": "fragment-of-deity",
  "aliases": ["Mystery Monitor", "Father fragment", "divine gift", "Adjuster"],
  "description": "A prepersonal fragment of God the Father that indwells the minds of morally conscious human beings.",
  "cosmicLevel": "superuniverse",   // paradise | havona | superuniverse | local-universe | system | planetary
  "paragraphCount": 847,
  "paperIds": ["0", "5", "107", "108", "109", "110", "111", "112"],

  "relations": [
    { "entityId": "soul",              "type": "co-creates" },
    { "entityId": "universal-father",  "type": "originates-from" },
    { "entityId": "seraphim",          "type": "collaborates-with" },
    { "entityId": "supreme-being",     "type": "contributes-to" }
  ],

  "themes": ["indwelling-spirit", "personality-survival", "spiritual-growth"]
}
```

**Why typed relations, not just a flat `related[]`:** The UB describes relationships with precision. Thought Adjusters *originate from* the Father, they *co-create* the soul, they *contribute to* the Supreme. That directionality is what separates a real knowledge graph from a tag cloud.

**Why `cosmicLevel`:** The UB's administrative hierarchy (Paradise → Havona → superuniverse → local universe → system → planet) is central to the book's structure. This field enables filtering like "show me all beings that operate at the local universe level."

### Entity types and subtypes

| type | subtypes |
|------|---------|
| `being` | `deity`, `trinity`, `fragment-of-deity`, `paradise-citizen`, `superuniverse-citizen`, `local-universe-citizen`, `system-citizen`, `planetary-citizen`, `mortal`, `midwayer` |
| `place` | `paradise-isle`, `central-universe`, `superuniverse`, `local-universe`, `constellation`, `system`, `planet`, `location` |
| `order` | `deity-fragment`, `trinitized`, `descending-son`, `ascending-being`, `seraphic`, `midwayer`, `energy-controller`, `messenger` |
| `race` | `primary`, `colored`, `blended`, `special` |
| `concept` | `spiritual`, `cosmological`, `administrative`, `philosophical`, `scientific` |

### Supported relation types

```
originates-from    contributes-to     part-of
created-by         serves             administers
indwells           co-creates         opposes
preceded-by        succeeded-by       collaborates-with
contrasted-with    expressed-through  facilitated-by
```

---

## Data Sources

### Primary: Urantiapedia topic index (github.com/JanHerca/urantiapedia)

The `input/en/topic/` directory contains ~5,000 TXT/MD files, one per entity. Each has:
- Entity name and category (person/place/race/order/concept → maps to our types)
- Prose description with inline links to related topics
- Numbered footnotes citing specific UB paragraphs (`standardReferenceId` format)

This gives us: entity list, descriptions, initial citation mapping, and inter-entity links. It's the seed — not the final product. Coverage gaps, alias resolution, span offsets, and typed relations all require an additional extraction pass.

### Secondary: LLM extraction pass over the full text

After seeding from Urantiapedia, run a structured extraction pass over all 14,500+ paragraphs using the Anthropic API to:
1. Resolve aliases (Jesus / the Master / Michael of Nebadon → same entity)
2. Extract character-level span offsets
3. Classify themes
4. Infer typed relations not explicit in Urantiapedia

---

## Part A: Build the Enriched Data

### Files to create

```
scripts/entities/
  01-parse-urantiapedia.ts     # Parse topic files → seed entity list
  02-extract-entities.ts       # LLM pass: entity mentions + spans per paragraph
  03-classify-themes.ts        # LLM pass: theme classification per paragraph
  04-resolve-aliases.ts        # Merge alias variants → canonical entity IDs
  05-infer-relations.ts        # LLM pass: typed relations between entities
  06-validate.ts               # Coverage checks, orphan detection
  config.ts                    # Type definitions, entity type maps

data/entities/
  seed-entities.json           # Output of step 01
  paragraph-entities.json      # Output of step 02 — paragraphId → entities[]
  paragraph-themes.json        # Output of step 03 — paragraphId → themes[]
  alias-map.json               # Output of step 04 — alias → canonical ID
  entity-relations.json        # Output of step 05
  entities-final.json          # Merged, validated entity catalog
```

### Step A1: Parse Urantiapedia topic files

Clone `github.com/JanHerca/urantiapedia`. Target: `input/en/topic/*.md` (or `.txt`).

Parse each file to extract:
- Entity name (filename = slug)
- Category (maps to our `type`)
- Description (first prose block)
- Footnote citations (extract `standardReferenceId` patterns like `2:0.1`)
- Inline topic links (extract `[[Topic Name]]` wiki links → related entity IDs)

Output: `seed-entities.json` — array of ~5,000 entities with name, type, description, citedParagraphs[], and rawRelated[].

### Step A2: LLM entity extraction per paragraph

For each paragraph, call the Anthropic API to extract entity mentions with spans.

**System prompt:**
```
You are extracting named entity mentions from passages of the Urantia Book.

Given a paragraph and a dictionary of known entities (with aliases), identify:
1. Every entity mentioned, by canonical ID
2. The character span [start, end] of the mention in the text
3. Which alias/name variant was used

Return ONLY a JSON array. No explanation.

Entity dictionary: {entityDictionary}
```

**Batching strategy:** Process one full paper per API call (not paragraph-by-paragraph). Include the paper's full entity context in the prompt. This maintains consistency — if Paper 32 introduces a character, all downstream mentions in that paper resolve correctly.

**Cost estimate:**
- ~197 papers, avg ~500 tokens/paper for entity dict + text
- ~1,500 tokens output per paper
- Total: ~200K input tokens + ~300K output tokens ≈ **~$5** with Sonnet

### Step A3: Theme classification per paragraph

Themes are a closed vocabulary — define them upfront, then classify. Suggested theme taxonomy:

```typescript
const THEMES = [
  // Spiritual practice
  "worship", "prayer", "faith", "service", "love",
  // Cosmological
  "time-and-eternity", "space", "energy", "gravity", "paradise-pattern",
  // Personal growth
  "personality-survival", "spiritual-growth", "moral-choice", "free-will",
  // Administrative
  "universe-administration", "divine-government", "sovereignty",
  // Philosophical
  "reality", "truth-beauty-goodness", "evil-and-sin", "mercy-and-justice",
  // Biographical (Part IV)
  "jesus-teachings", "kingdom-of-heaven", "gospel", "atonement-doctrine"
] as const;
```

**Prompt approach:** Classify in batches of 10-20 paragraphs per call. Return `{ paragraphId: string, themes: ThemeId[] }[]`. Themes should be sparse — 0-4 per paragraph. Not every paragraph needs theme tags.

### Step A4: Alias resolution

The UB uses many names for the same entity. Build a canonical alias map:

```typescript
// Examples of required merges
const KNOWN_ALIASES: Record<string, string[]> = {
  "jesus":              ["the Master", "Michael of Nebadon", "Son of Man", "Son of God",
                         "the bestowal Son", "Joshua ben Joseph"],
  "thought-adjuster":   ["Mystery Monitor", "Father fragment", "divine Monitor",
                         "Adjuster", "divine gift", "the indweller"],
  "universal-father":   ["God", "First Source and Center", "the Father",
                         "Paradise Father", "I AM"],
  "lucifer":            ["the Lucifer", "the fallen Son"],
  // ... ~200 more
};
```

Seed from Urantiapedia's alias data, then run an LLM pass to catch remaining variants in the text. Output: `alias-map.json` (variant → canonical ID).

### Step A5: Infer typed relations

After entities and aliases are resolved, infer typed relations. Use semantic search to find co-occurring entities, then classify the relationship type from context.

**Prompt approach:** For each entity pair that co-occurs in 5+ paragraphs, provide the 3 most representative paragraphs and ask: "What is the relationship between these two entities? Choose from: [relation types list]".

This step is the most expensive and least critical for MVP — can be done in a second pass. Seed relations from Urantiapedia's inline links first.

### Step A6: Validate

```typescript
// Coverage checks
assert(entities.length > 4000, "Entity count too low")
assert(paragraphsWithEntities / totalParagraphs > 0.7, "Coverage too low")

// Orphan detection — entities with no paragraph citations
const orphans = entities.filter(e => e.paragraphCount === 0);
console.log(`Orphan entities: ${orphans.length}`); // Should be ~0

// Alias collision detection — two different entities sharing an alias
const aliasConflicts = findAliasConflicts(aliasMap);

// Span validation — spans must be within text length
validateSpans(paragraphEntities, paragraphTexts);
```

---

## Part B: API Endpoints

### DB schema additions

```sql
-- New tables
CREATE TABLE entities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,   -- being | place | order | race | concept
  subtype     TEXT,
  description TEXT,
  cosmic_level TEXT,
  aliases     JSONB,           -- string[]
  relations   JSONB,           -- { entityId, type }[]
  themes      JSONB,           -- string[]
  paper_ids   JSONB,           -- string[]
  paragraph_count INTEGER
);

CREATE TABLE themes (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL   -- spiritual | cosmological | philosophical | etc.
);

-- New columns on paragraphs
ALTER TABLE paragraphs ADD COLUMN entities JSONB;  -- { id, name, type, subtype, span }[]
ALTER TABLE paragraphs ADD COLUMN themes   JSONB;  -- string[]
```

### New endpoints

```
GET  /entities                           List entities
GET  /entities/{id}                      Get entity with full detail
GET  /entities/{id}/paragraphs           All paragraphs mentioning this entity
GET  /entities/{id}/related              Related entities (graph adjacency)

GET  /themes                             List all themes
GET  /themes/{id}/paragraphs             All paragraphs tagged with a theme
```

**`GET /entities` query params:**
- `type` — filter by entity type (`being`, `place`, etc.)
- `subtype` — filter by subtype
- `cosmicLevel` — filter by cosmic level
- `q` — name search
- `limit`, `offset` — pagination

**`GET /entities/{id}/paragraphs` query params:**
- `paperId` — filter to a specific paper
- `limit`, `offset`

### Updated paragraph response

The `labels` field is deprecated and replaced. Existing consumers using `labels` still get an array (populated from entity names) for backward compatibility. New consumers use `entities` and `themes`.

```typescript
// labels — deprecated, kept for backward compat
"labels": ["Universal Father", "Havona"],

// entities — new
"entities": [
  { "id": "universal-father", "name": "Universal Father",
    "type": "being", "subtype": "deity", "span": [4, 22] }
],

// themes — new
"themes": ["divine-love", "sovereignty"]
```

---

## Step-by-Step Execution Order

### Phase 1: Data (Part A)
1. Clone Urantiapedia, parse topic files → `seed-entities.json`
2. Build alias map from seed + known aliases list
3. LLM entity extraction pass over all paragraphs → `paragraph-entities.json`
4. LLM theme classification pass → `paragraph-themes.json`
5. Validate coverage + spans
6. LLM relation inference pass (can be deferred to Phase 2)

### Phase 2: Schema + endpoints (Part B)
1. DB schema additions (entities table, paragraph columns)
2. Seed entities table from `entities-final.json`
3. Update paragraphs table with `entities` and `themes` JSONB
4. Build entity endpoints (`/entities`, `/entities/{id}`, etc.)
5. Update paragraph response to include `entities` + `themes`
6. Deprecate `labels` (keep populated for backward compat)

### Phase 3: Relations + graph (deferred)
1. Complete typed relation inference
2. Add graph traversal endpoint (`/entities/{id}/related?depth=2`)
3. Consider semantic entity search (`/entities/search/semantic`)

---

## Cost Estimate

| Item | Estimate |
|------|---------|
| LLM entity extraction (Sonnet, 197 papers) | ~$5 |
| LLM theme classification (~14,500 paragraphs) | ~$8 |
| LLM alias resolution + validation | ~$2 |
| LLM relation inference (deferred) | ~$10 |
| **Total Phase 1+2** | **~$15** |

---

## Verification

```bash
# After Part A:
bun run scripts/entities/06-validate.ts
# Expected: >4,000 entities, >70% paragraph coverage, 0 span errors

# After Part B:
curl https://api.urantia.dev/entities?type=being&subtype=deity
curl https://api.urantia.dev/entities/thought-adjuster
curl https://api.urantia.dev/entities/thought-adjuster/paragraphs?limit=5
curl https://api.urantia.dev/paragraphs/110:0.1  # Should have entities[] and themes[]
curl https://api.urantia.dev/themes/worship/paragraphs?limit=10
```
