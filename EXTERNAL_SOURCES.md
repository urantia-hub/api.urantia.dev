# Structured entity data for the Urantia Book: what exists and what's missing

**No single, clean, typed entity dataset for the Urantia Book exists today — but the raw materials to build one are surprisingly rich.** Three major structured resources collectively cover most of the book's named entities, and the full text is freely available in machine-readable JSON under public domain. The gap is not in coverage but in format: existing data sits in custom TXT files, systematic-but-copyrighted HTML indexes, and JavaScript-embedded glossaries rather than in clean JSON/CSV with typed entity schemas. Building a purpose-built entity database is a realistic **2–4 week project** costing under $150 in API fees, thanks to these existing resources and modern LLM extraction pipelines.

---

## Urantiapedia is the single most valuable resource

The **JanHerca/urantiapedia** GitHub repository is the clear starting point for any entity data project. This Wiki.js-based encyclopedia, supported in part by a Urantia Foundation award, contains three critical data layers:

The **Topic Index files** live at `input/txt/topic-index-en/` (with Spanish and French equivalents) in a custom structured TXT format organized alphabetically. The Urantiapedia Tools application has a dedicated "Edit Topic Index" tab with a **"Topic Categories" dropdown** — confirming these files carry typed category labels for each entity (the categories include persons, places, orders of beings, races, concepts, and more). The conversion pipeline reads these TXT files alongside the book's JSON and outputs richly interlinked Wiki.js pages. Estimated coverage is **4,000–5,000+ topic entries** spanning every proper name and concept of interest in the book.

Each generated topic page includes: a canonical name, aliases via redirect mappings (e.g., "Abram → Abraham"), sectioned descriptive prose, extensive inline cross-references to other topics, and **paragraph-level citations** in `paper:section.paragraph` format. The live output at urantiapedia.org demonstrates this richness — the entry for "Nebadon" includes sections on celestial personalities, courts, language, and physical aspects, each sentence backed by specific UB references.

The **Urantia Book text itself** is stored as 197 JSON files per language (25 languages) in `input/json/book-xx/`, with a separate footnoted variant in `input/json/book-xx-footnotes/`. The Paramony cross-references linking the Urantia Book to the Bible exist as structured JSON in `input/json/footnotes-book-xx.json`. The repository has **~2,900 commits** and is actively maintained.

**Critical limitation**: the Topic Index TXT files use a custom format, not standard JSON or CSV. No pre-built JSON export exists. The format is parseable — the JavaScript conversion tools contain the implicit specification — but would require reverse-engineering from the source code or examining the files directly after cloning the repo. **No explicit license file** appears in the repository, though the terms of use on urantiapedia.org state contributions should be shared under "free and open licenses."

---

## The Fellowship Topical Index offers the most parseable alternative

The Urantia Book Fellowship's Topical Index at `archive.urantiabook.org/urantiabook/topical_index/` is arguably the most comprehensive and consistently formatted resource for programmatic extraction. Spanning **200+ static HTML pages** with an estimated **5,000–10,000+ entries**, it follows an extremely regular indentation-based structure:

Top-level entries appear unindented with "See also" cross-references. Sub-entries are indented with a description string followed by one or more citations in the format `paper:section.paragraph(page;paragraph_on_page)`. Hierarchical nesting goes three or more levels deep. For example, the entry "Sumerians" includes sub-entries like "absorbed into northern Semites 78:8.10(876;7)" and "Nodite and Adamite origin 77:2.10(857;7), 77:4.6-9(860;1)." This consistency makes HTML parsing into structured JSON straightforward — a regex-based parser matching citation patterns and indentation levels could handle the bulk of conversion.

The index does not use explicit type labels (PERSON, PLACE, CONCEPT), but contextual descriptions often imply types ("Mesopotamian city-state," "Havona Servital who became Graduate Guide"). **Copyright is held** (© 2004, 2007, "used by permission of the author"), which is a constraint for redistribution, though scraping for personal research use is likely permissible.

---

## Other structured resources fill complementary niches

**The USGNY Glossary** at urantia.nyc provides **over 1,500 terms** with three features no other resource offers: pronunciation guides (phonetic transcription for every entry), full definitions, and "quick-view" references to every single occurrence in the text. It runs as a JavaScript single-page application — the underlying data is almost certainly stored in a JSON or JS object but would require either locating the data file in the app bundle or headless browser scraping to extract. A downloadable **17.5 MB 7z archive** on Internet Archive contains the glossary and search engine as offline HTML/JS. Copyright is held by the Fifth Epochal Fellowship Corporation with free personal sharing encouraged.

**The urantia-hub/data repository** on GitHub (MIT license) provides the cleanest machine-readable text corpus: 197 JSON files with paragraph-level granularity including `paperSectionParagraphId`, `standardReferenceId`, `text`, and `htmlText` fields. It contains **zero entity data** but is the ideal input corpus for NLP-based extraction.

**The Master Universe Almanac** at masteruniverse.org offers ~40–50 HTML data tables covering the book's organizational taxonomies: deity designations, personality classifications, administrative hierarchies, racial categories, and cosmological structures. These are semi-structured tables with UB citations — uniquely valuable for extracting hierarchical relationships between entity types, though inconsistent formatting makes parsing moderately difficult.

**UrantiaBookStudy.com** hosts a digitized version of the historic Topical Index begun in the 1940s (distinct from the Fellowship's index), the Paramony, a timeline, and Sadler's workbooks, all interlinked with the full text. Everything is HTML; nothing is downloadable as structured data.

The **Clyde Bedell Concordex** (published 1971–1986, 803+ topics) is access-restricted on Internet Archive and has no known digital database version. It remains a print artifact.

**TruthBook.com** (Jesusonian Foundation) provides a modest glossary focused on non-standard terms plus "73 Important Urantia Book Definitions" and ~50 topical studies — all prose HTML, not structured data.

---

## Wikidata and the semantic web have almost zero coverage

A search across Wikidata, DBpedia, and the broader linked-data ecosystem reveals a near-total absence of Urantia Book entity representation. Wikidata has exactly two relevant items: **Q784683** (The Urantia Book as a published work) and **Q7899761** (Urantia Foundation as an organization). None of the book's internal entities — Nebadon, Thought Adjuster, Melchizedek order, seraphim, Salvington, Andonites — exist as Wikidata items. DBpedia extracts only what Wikipedia's article provides (basic book metadata). No RDF, OWL, or SKOS ontologies exist. No SPARQL endpoints serve Urantia Book data. No datasets appear on Kaggle, data.world, or similar platforms. No academic knowledge graph projects were found. **This is a completely greenfield opportunity for structured semantic representation.**

---

## Building a dataset from scratch: the hybrid pipeline approach

Given that standard NER models fail catastrophically on the Urantia Book's invented terminology — **spaCy trained on OntoNotes achieves 0% recall on biblical-style names**, and the book's proper nouns like "Caligastia" and "Salvington" are entirely absent from all training corpora — a hybrid approach combining existing glossary data, LLM extraction, and targeted manual curation offers the best path.

**Phase 1: Seed dictionary (1–2 days).** Scrape the Fellowship Topical Index, the USGNY Glossary, and Urantiapedia's topic pages to build an initial entity list with names, aliases, descriptions, and citations. This alone yields **1,500–5,000 entities** with substantial metadata, though without clean type labels.

**Phase 2: LLM-based extraction and typing (1–2 days, ~$50–100 API cost).** Process the Urantia Book's 197 papers through an LLM (GPT-4.1 or Claude) with a custom schema prompt defining entity types: CELESTIAL_BEING, MORTAL_BEING, UNIVERSE_LOCATION, PLANET, ORDER_OF_BEINGS, RACE, CONCEPT, HISTORICAL_PERSON, ORGANIZATION, EVENT, EPOCH. Few-shot examples drawn from manually annotated sample paragraphs guide extraction. The full text is approximately **1.5 million tokens** of input; with chunking, overlap, and multi-pass extraction (entities first, then relationships), total API cost runs $50–150. This phase catches entities the existing indexes may miss and produces clean JSON with type labels, confidence scores, and source citations.

**A promising zero-shot alternative is GLiNER**, a compact bidirectional transformer that outperforms ChatGPT on zero-shot NER benchmarks and allows specifying custom entity types at runtime. It runs locally, costs nothing, and could serve as a fast first pass before the LLM refinement stage. The D&D monster name fine-tuning precedent — achieving **87.86% F1** on fantasy domain-specific entities — is directly analogous to this use case.

**Phase 3: Entity resolution and deduplication (1 day).** Use sentence-BERT embeddings and cosine similarity to merge duplicates across extraction sources. Match against seed glossaries. Flag novel entities for review.

**Phase 4: Manual curation (5–15 days).** This is the bottleneck. Expect **20–30% of auto-extracted entities** to need correction — primarily disambiguation (e.g., "Adam" the concept vs. "Adam" the Material Son), hierarchical classification, and type assignment for ambiguous terms. The estimated total unique entity count is **1,500–3,000**, breaking down roughly to:

- **200–400** invented celestial being names and universe locations
- **300–500** real-world historical and biblical persons
- **200–400** geographic locations (real and cosmological)
- **300–600** specialized concepts and terminology
- **200–400** orders and classifications of beings
- Plus aliases and variant forms

**Phase 5: Knowledge graph construction (2–3 days).** Load validated entities into Neo4j or a graph database. Run relationship extraction between entities. Build the ontological hierarchy reflecting the book's cosmological structure — from Paradise through superuniverses to local universes and individual planets.

---

## Comparative assessment of all resources found

| Resource | Format | Entity count | Typed? | Machine-readable? | License | Best for |
|----------|--------|-------------|--------|-------------------|---------|----------|
| **Urantiapedia** (GitHub) | Custom TXT + JSON | ~4,000–5,000 | Yes (categories) | High (needs parsing) | No explicit license | Comprehensive entity + citation database |
| **Fellowship Topical Index** | Static HTML (200+ pages) | ~5,000–10,000 | Implicit only | High (very consistent) | © 2004/2007 | Most parseable comprehensive index |
| **USGNY Glossary** | JavaScript SPA | ~1,500 | Implicit | Moderate (needs JS) | © Fellowship | Definitions + pronunciations |
| **urantia-hub/data** | JSON (197 files) | 0 (text only) | N/A | Excellent | MIT | NLP input corpus |
| **Master Universe Almanac** | HTML tables | ~40–50 tables | Partial (tabular) | Moderate | Unknown | Hierarchical taxonomies |
| **UrantiaBookStudy.com** | HTML (interlinked) | Thousands | Implicit | Moderate | Unknown | Integrated study resource |
| **Wikidata** | RDF/JSON | 2 items | Yes | Excellent | CC0 | Negligible coverage |
| **Bedell Concordex** | Print only | 803+ topics | No | Not available | © estate | Historical reference only |

## Conclusion

The Urantia Book entity data landscape is a case of **abundance without interoperability**. Thousands of entities have been meticulously cataloged by multiple independent projects over decades — Urantiapedia's 4,000+ encyclopedia entries, the Fellowship's 5,000–10,000+ index entries, USGNY's 1,500-term glossary — but none exist in a clean, typed, downloadable format like JSON or CSV. The most actionable path forward is not building from scratch but **harvesting and reconciling** these existing resources: clone Urantiapedia's repo and parse the TXT topic index files (which already carry category types), supplement with the Fellowship index's richer citation data via HTML scraping, add USGNY's definitions and pronunciations, then use LLM extraction on the raw text to fill gaps and assign clean type labels. The total effort is roughly 2–4 weeks with under $150 in compute costs — feasible for a solo developer — to produce what would be the first-ever typed, machine-readable entity dataset for one of the 20th century's most structurally complex religious texts.
