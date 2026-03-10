import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { z } from "zod";
import { and, eq, gt, ilike, lt, sql } from "drizzle-orm";
import OpenAI from "openai";
import { getDb, closeDb } from "../db/client.ts";
import { entities, papers, paragraphs, paragraphEntities, parts, sections } from "../db/schema.ts";
import { detectRefFormat } from "../types/node.ts";
import { enrichWithEntities, wantsEntities } from "../lib/entities.ts";
import { paragraphFields } from "./paragraphs.ts";

export const mcpRoute = new Hono();

// Paragraph field selection for search results (includes rank/similarity)
const searchParagraphFields = {
	id: paragraphs.id,
	standardReferenceId: paragraphs.standardReferenceId,
	sortId: paragraphs.sortId,
	paperId: paragraphs.paperId,
	sectionId: sql<
		string | null
	>`CASE WHEN ${paragraphs.sectionId} IS NOT NULL THEN split_part(${paragraphs.sectionId}, '.', 2) ELSE NULL END`.as(
		"sectionId",
	),
	partId: paragraphs.partId,
	paperTitle: paragraphs.paperTitle,
	sectionTitle: paragraphs.sectionTitle,
	paragraphId: paragraphs.paragraphId,
	text: paragraphs.text,
	htmlText: paragraphs.htmlText,
	labels: paragraphs.labels,
	audio: paragraphs.audio,
} as const;

function buildTsQuery(sanitized: string, type: "phrase" | "and" | "or"): string {
	switch (type) {
		case "phrase":
			return `phraseto_tsquery('english', '${sanitized}')`;
		case "and": {
			const words = sanitized.split(/\s+/).filter(Boolean);
			return `to_tsquery('english', '${words.join(" & ")}')`;
		}
		case "or": {
			const words = sanitized.split(/\s+/).filter(Boolean);
			return `to_tsquery('english', '${words.join(" | ")}')`;
		}
	}
}

async function findParagraphByRef(db: ReturnType<typeof getDb>["db"], ref: string) {
	const format = detectRefFormat(ref);
	switch (format) {
		case "globalId":
			return db.select(paragraphFields).from(paragraphs).where(eq(paragraphs.globalId, ref)).limit(1);
		case "standardReferenceId":
			return db.select(paragraphFields).from(paragraphs).where(eq(paragraphs.standardReferenceId, ref)).limit(1);
		case "paperSectionParagraphId":
			return db.select(paragraphFields).from(paragraphs).where(eq(paragraphs.paperSectionParagraphId, ref)).limit(1);
		default:
			return [];
	}
}

function createMcpServer() {
	const server = new McpServer({
		name: "Urantia Papers API",
		version: "1.0.0",
	});

	// 1. get_table_of_contents
	server.tool(
		"get_table_of_contents",
		"Get the full table of contents of the Urantia Book. Returns all 4 parts and 197 papers with their titles. This is the best starting point to understand the book structure.",
		{},
		async () => {
			const { db, close } = getDb();
			try {
				const allParts = await db.select().from(parts).orderBy(parts.sortId);
				const allPapers = await db.select().from(papers).orderBy(papers.sortId);
				const tocParts = allParts.map((part) => ({
					id: part.id,
					title: part.title,
					sponsorship: part.sponsorship,
					papers: allPapers
						.filter((p) => p.partId === part.id)
						.map((p) => ({ id: p.id, title: p.title, labels: p.labels })),
				}));
				return { content: [{ type: "text" as const, text: JSON.stringify({ parts: tocParts }) }] };
			} finally {
				close();
			}
		},
	);

	// 2. list_papers
	server.tool(
		"list_papers",
		"List all 197 papers in the Urantia Book with their metadata (id, title, partId, labels). Use get_table_of_contents for a hierarchical view instead.",
		{},
		async () => {
			const { db, close } = getDb();
			try {
				const allPapers = await db
					.select({ id: papers.id, partId: papers.partId, title: papers.title, sortId: papers.sortId, labels: papers.labels })
					.from(papers)
					.orderBy(papers.sortId);
				return { content: [{ type: "text" as const, text: JSON.stringify(allPapers) }] };
			} finally {
				close();
			}
		},
	);

	// 3. get_paper
	server.tool(
		"get_paper",
		"Get a single paper with all its paragraphs. Paper IDs range from 0 (Foreword) to 196. Optionally include entity mentions.",
		{
			paper_id: z.string().describe("Paper ID (0-196). Example: '1'"),
			include_entities: z.boolean().default(false).describe("Include entity mentions in each paragraph"),
		},
		async ({ paper_id, include_entities }) => {
			const { db, close } = getDb();
			try {
				const paper = await db
					.select({ id: papers.id, partId: papers.partId, title: papers.title, sortId: papers.sortId, labels: papers.labels })
					.from(papers)
					.where(eq(papers.id, paper_id))
					.limit(1);

				if (paper.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Paper ${paper_id} not found` }) }], isError: true };
				}

				const paperParagraphs = await db
					.select(paragraphFields)
					.from(paragraphs)
					.where(eq(paragraphs.paperId, paper_id))
					.orderBy(paragraphs.sortId);

				const enrichedParagraphs = include_entities
					? await enrichWithEntities(db, paperParagraphs)
					: paperParagraphs;

				return { content: [{ type: "text" as const, text: JSON.stringify({ paper: paper[0]!, paragraphs: enrichedParagraphs }) }] };
			} finally {
				close();
			}
		},
	);

	// 4. get_paper_sections
	server.tool(
		"get_paper_sections",
		"Get all sections within a paper, ordered by section number. Useful for understanding paper structure before reading specific sections.",
		{
			paper_id: z.string().describe("Paper ID (0-196). Example: '1'"),
		},
		async ({ paper_id }) => {
			const { db, close } = getDb();
			try {
				const paper = await db.select().from(papers).where(eq(papers.id, paper_id)).limit(1);
				if (paper.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Paper ${paper_id} not found` }) }], isError: true };
				}

				const paperSections = await db
					.select()
					.from(sections)
					.where(eq(sections.paperId, paper_id))
					.orderBy(sections.sortId);

				return { content: [{ type: "text" as const, text: JSON.stringify(paperSections) }] };
			} finally {
				close();
			}
		},
	);

	// 5. get_random_paragraph
	server.tool(
		"get_random_paragraph",
		"Get a random paragraph from the Urantia Book. Great for daily quotes, exploration, or discovering new passages.",
		{
			include_entities: z.boolean().default(false).describe("Include entity mentions"),
		},
		async ({ include_entities }) => {
			const { db, close } = getDb();
			try {
				const result = await db.select(paragraphFields).from(paragraphs).orderBy(sql`RANDOM()`).limit(1);
				if (result.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No paragraphs found" }) }], isError: true };
				}
				const data = include_entities
					? (await enrichWithEntities(db, result))[0]!
					: result[0]!;
				return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
			} finally {
				close();
			}
		},
	);

	// 6. get_paragraph
	server.tool(
		"get_paragraph",
		'Look up a specific paragraph by reference. Supports three formats: globalId ("1:2.0.1"), standardReferenceId ("2:0.1"), or paperSectionParagraphId ("2.0.1"). The format is auto-detected.',
		{
			ref: z.string().describe('Paragraph reference in any format. Examples: "1:2.0.1", "2:0.1", "2.0.1"'),
			include_entities: z.boolean().default(false).describe("Include entity mentions"),
		},
		async ({ ref, include_entities }) => {
			const { db, close } = getDb();
			try {
				const format = detectRefFormat(ref);
				if (format === "unknown") {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid reference format: "${ref}". Expected globalId (1:2.0.1), standardReferenceId (2:0.1), or paperSectionParagraphId (2.0.1)` }) }], isError: true };
				}

				const result = await findParagraphByRef(db, ref);
				if (result.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Paragraph "${ref}" not found` }) }], isError: true };
				}

				const data = include_entities
					? (await enrichWithEntities(db, result))[0]!
					: result[0]!;
				return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
			} finally {
				close();
			}
		},
	);

	// 7. get_paragraph_context
	server.tool(
		"get_paragraph_context",
		"Get a paragraph with surrounding context (N paragraphs before and after within the same paper). Useful for understanding passages in context.",
		{
			ref: z.string().describe('Paragraph reference. Examples: "1:2.0.1", "2:0.1", "2.0.1"'),
			window: z.number().min(1).max(10).default(2).describe("Number of paragraphs before and after (1-10, default 2)"),
			include_entities: z.boolean().default(false).describe("Include entity mentions"),
		},
		async ({ ref, window: windowSize, include_entities }) => {
			const { db, close } = getDb();
			try {
				const format = detectRefFormat(ref);
				if (format === "unknown") {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid reference format: "${ref}"` }) }], isError: true };
				}

				const target = await findParagraphByRef(db, ref);
				if (target.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Paragraph "${ref}" not found` }) }], isError: true };
				}

				const targetParagraph = target[0]!;

				const before = await db
					.select(paragraphFields)
					.from(paragraphs)
					.where(and(eq(paragraphs.paperId, targetParagraph.paperId), lt(paragraphs.sortId, targetParagraph.sortId)))
					.orderBy(sql`${paragraphs.sortId} DESC`)
					.limit(windowSize);

				const after = await db
					.select(paragraphFields)
					.from(paragraphs)
					.where(and(eq(paragraphs.paperId, targetParagraph.paperId), gt(paragraphs.sortId, targetParagraph.sortId)))
					.orderBy(paragraphs.sortId)
					.limit(windowSize);

				if (include_entities) {
					const allParagraphs = [targetParagraph, ...before, ...after];
					const enriched = await enrichWithEntities(db, allParagraphs);
					const enrichedMap = new Map(enriched.map((p) => [p.id, p]));
					return {
						content: [{
							type: "text" as const,
							text: JSON.stringify({
								target: enrichedMap.get(targetParagraph.id)!,
								before: before.reverse().map((p) => enrichedMap.get(p.id)!),
								after: after.map((p) => enrichedMap.get(p.id)!),
							}),
						}],
					};
				}

				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({ target: targetParagraph, before: before.reverse(), after }),
					}],
				};
			} finally {
				close();
			}
		},
	);

	// 8. search
	server.tool(
		"search",
		'Full-text search across all Urantia Book paragraphs. Supports three modes: "and" (all words must appear, default), "or" (any word), "phrase" (exact phrase). Results ranked by relevance.',
		{
			q: z.string().describe('Search query. Example: "nature of God"'),
			type: z.enum(["phrase", "and", "or"]).default("and").describe("Search mode: phrase, and, or"),
			paper_id: z.string().optional().describe("Filter to a specific paper ID"),
			part_id: z.string().optional().describe("Filter to a specific part ID (1-4)"),
			page: z.number().int().min(0).default(0).describe("Page number (0-indexed)"),
			limit: z.number().int().min(1).max(100).default(20).describe("Results per page (1-100)"),
			include_entities: z.boolean().default(false).describe("Include entity mentions"),
		},
		async ({ q, type, paper_id, part_id, page, limit, include_entities }) => {
			const { db, close } = getDb();
			try {
				const sanitized = q.replace(/[^\w\s]/g, " ").trim();
				if (!sanitized) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Search query cannot be empty" }) }], isError: true };
				}

				const tsQuery = buildTsQuery(sanitized, type);
				const offset = page * limit;

				const conditions = [sql`search_vector @@ ${sql.raw(tsQuery)}`];
				if (paper_id) conditions.push(eq(paragraphs.paperId, paper_id));
				if (part_id) conditions.push(eq(paragraphs.partId, part_id));
				const whereClause = and(...conditions);

				const countResult = await db.select({ count: sql<number>`count(*)` }).from(paragraphs).where(whereClause);
				const total = Number(countResult[0]?.count ?? 0);

				const results = await db
					.select({
						...searchParagraphFields,
						rank: sql<number>`ts_rank(search_vector, ${sql.raw(tsQuery)})`,
					})
					.from(paragraphs)
					.where(whereClause)
					.orderBy(sql`ts_rank(search_vector, ${sql.raw(tsQuery)}) DESC`)
					.limit(limit)
					.offset(offset);

				const enrichedResults = include_entities
					? await enrichWithEntities(db, results)
					: results;

				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({
							data: enrichedResults,
							meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
						}),
					}],
				};
			} finally {
				close();
			}
		},
	);

	// 9. semantic_search
	server.tool(
		"semantic_search",
		"Search the Urantia Book using semantic similarity (vector embeddings). Returns conceptually related results even without exact keyword matches. Requires OPENAI_API_KEY.",
		{
			q: z.string().describe('Natural language query. Example: "What is the meaning of life?"'),
			paper_id: z.string().optional().describe("Filter to a specific paper ID"),
			part_id: z.string().optional().describe("Filter to a specific part ID (1-4)"),
			page: z.number().int().min(0).default(0).describe("Page number (0-indexed)"),
			limit: z.number().int().min(1).max(100).default(20).describe("Results per page (1-100)"),
			include_entities: z.boolean().default(false).describe("Include entity mentions"),
		},
		async ({ q, paper_id, part_id, page, limit, include_entities }) => {
			const { db, close } = getDb();
			try {
				const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
				const embeddingResponse = await openai.embeddings.create({
					model: "text-embedding-3-small",
					input: q,
				});
				const queryVector = embeddingResponse.data[0]?.embedding;
				if (!queryVector) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to generate embedding" }) }], isError: true };
				}
				const vectorStr = `[${queryVector.join(",")}]`;

				const offset = page * limit;
				const conditions = [sql`embedding IS NOT NULL`];
				if (paper_id) conditions.push(eq(paragraphs.paperId, paper_id));
				if (part_id) conditions.push(eq(paragraphs.partId, part_id));
				const whereClause = and(...conditions);

				const countResult = await db.select({ count: sql<number>`count(*)` }).from(paragraphs).where(whereClause);
				const total = Number(countResult[0]?.count ?? 0);

				const results = await db
					.select({
						...searchParagraphFields,
						similarity: sql<number>`1 - (embedding <=> ${vectorStr}::vector)`,
					})
					.from(paragraphs)
					.where(whereClause)
					.orderBy(sql`embedding <=> ${vectorStr}::vector`)
					.limit(limit)
					.offset(offset);

				const enrichedResults = include_entities
					? await enrichWithEntities(db, results)
					: results;

				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({
							data: enrichedResults,
							meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
						}),
					}],
				};
			} finally {
				close();
			}
		},
	);

	// 10. list_entities
	server.tool(
		"list_entities",
		"Browse the entity catalog: beings, places, orders, races, religions, and concepts mentioned in the Urantia Book. Supports filtering by type and searching by name.",
		{
			type: z.enum(["being", "place", "order", "race", "religion", "concept"]).optional().describe("Filter by entity type"),
			q: z.string().optional().describe("Search entities by name or alias"),
			page: z.number().int().min(0).default(0).describe("Page number (0-indexed)"),
			limit: z.number().int().min(1).max(100).default(20).describe("Results per page (1-100)"),
		},
		async ({ type, q, page, limit }) => {
			const { db, close } = getDb();
			try {
				const offset = page * limit;
				const conditions = [];
				if (type) conditions.push(eq(entities.type, type));
				if (q) {
					conditions.push(
						sql`(${ilike(entities.name, `%${q}%`)} OR array_to_string(${entities.aliases}, ',') ILIKE ${`%${q}%`})`,
					);
				}
				const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

				const countResult = await db.select({ count: sql<number>`count(*)` }).from(entities).where(whereClause);
				const total = Number(countResult[0]?.count ?? 0);

				const results = await db
					.select({
						id: entities.id,
						name: entities.name,
						type: entities.type,
						aliases: entities.aliases,
						description: entities.description,
						seeAlso: entities.seeAlso,
						citationCount: entities.citationCount,
					})
					.from(entities)
					.where(whereClause)
					.orderBy(entities.name)
					.limit(limit)
					.offset(offset);

				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({ data: results, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }),
					}],
				};
			} finally {
				close();
			}
		},
	);

	// 11. get_entity
	server.tool(
		"get_entity",
		"Get detailed information about a specific entity by its slug ID. Returns name, type, aliases, description, related entities, and citation count.",
		{
			entity_id: z.string().describe('Entity slug ID. Example: "god-the-father"'),
		},
		async ({ entity_id }) => {
			const { db, close } = getDb();
			try {
				const result = await db
					.select({
						id: entities.id,
						name: entities.name,
						type: entities.type,
						aliases: entities.aliases,
						description: entities.description,
						seeAlso: entities.seeAlso,
						citationCount: entities.citationCount,
					})
					.from(entities)
					.where(eq(entities.id, entity_id))
					.limit(1);

				if (result.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Entity "${entity_id}" not found` }) }], isError: true };
				}

				return { content: [{ type: "text" as const, text: JSON.stringify(result[0]!) }] };
			} finally {
				close();
			}
		},
	);

	// 12. get_entity_paragraphs
	server.tool(
		"get_entity_paragraphs",
		"Get all paragraphs that mention a specific entity, ordered by position in the text. Useful for studying everything said about a particular being, place, or concept.",
		{
			entity_id: z.string().describe('Entity slug ID. Example: "god-the-father"'),
			page: z.number().int().min(0).default(0).describe("Page number (0-indexed)"),
			limit: z.number().int().min(1).max(100).default(20).describe("Results per page (1-100)"),
		},
		async ({ entity_id, page, limit }) => {
			const { db, close } = getDb();
			try {
				const entity = await db.select({ id: entities.id }).from(entities).where(eq(entities.id, entity_id)).limit(1);
				if (entity.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Entity "${entity_id}" not found` }) }], isError: true };
				}

				const offset = page * limit;
				const countResult = await db
					.select({ count: sql<number>`count(*)` })
					.from(paragraphEntities)
					.where(eq(paragraphEntities.entityId, entity_id));
				const total = Number(countResult[0]?.count ?? 0);

				const results = await db
					.select(paragraphFields)
					.from(paragraphs)
					.innerJoin(paragraphEntities, eq(paragraphs.id, paragraphEntities.paragraphId))
					.where(eq(paragraphEntities.entityId, entity_id))
					.orderBy(paragraphs.sortId)
					.limit(limit)
					.offset(offset);

				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({ data: results, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }),
					}],
				};
			} finally {
				close();
			}
		},
	);

	// 13. get_audio
	server.tool(
		"get_audio",
		'Get the audio file URL for a specific paragraph. Accepts any paragraph reference format (globalId "1:2.0.1", standardReferenceId "2:0.1", or paperSectionParagraphId "2.0.1").',
		{
			paragraph_ref: z.string().describe('Paragraph reference. Example: "2:0.1"'),
		},
		async ({ paragraph_ref }) => {
			const { db, close } = getDb();
			try {
				const format = detectRefFormat(paragraph_ref);
				const col =
					format === "globalId" ? paragraphs.globalId
					: format === "standardReferenceId" ? paragraphs.standardReferenceId
					: format === "paperSectionParagraphId" ? paragraphs.paperSectionParagraphId
					: null;

				if (!col) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid paragraph reference: "${paragraph_ref}"` }) }], isError: true };
				}

				const result = await db
					.select({ globalId: paragraphs.globalId, audio: paragraphs.audio })
					.from(paragraphs)
					.where(eq(col, paragraph_ref))
					.limit(1);

				if (result.length === 0) {
					return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Paragraph "${paragraph_ref}" not found` }) }], isError: true };
				}

				const row = result[0]!;
				return { content: [{ type: "text" as const, text: JSON.stringify({ paragraphId: row.globalId, audio: row.audio ?? null }) }] };
			} finally {
				close();
			}
		},
	);

	return server;
}

// Discovery response for browser/GET requests without SSE accept header
mcpRoute.get("/", async (c) => {
	if (c.req.header("Accept")?.includes("text/event-stream")) {
		// Proper MCP SSE request — let the transport handle it
		const server = createMcpServer();
		const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined });
		await server.connect(transport);
		return transport.handleRequest(c);
	}

	// Browser or curl — return a friendly discovery response
	return c.json({
		server: {
			name: "Urantia Papers API",
			version: "1.0.0",
			transport: "streamable-http",
			docs: "https://urantia.dev/mcp",
		},
		capabilities: {
			tools: {
				get_table_of_contents: { description: "Get the full table of contents — all 4 parts and 197 papers" },
				list_papers: { description: "List all 197 papers with metadata" },
				get_paper: { description: "Get a single paper with all its paragraphs", params: ["paper_id", "include_entities"] },
				get_paper_sections: { description: "Get all sections within a paper", params: ["paper_id"] },
				get_random_paragraph: { description: "Get a random paragraph", params: ["include_entities"] },
				get_paragraph: { description: "Look up a paragraph by reference (3 formats auto-detected)", params: ["ref", "include_entities"] },
				get_paragraph_context: { description: "Get a paragraph with surrounding context", params: ["ref", "window", "include_entities"] },
				search: { description: "Full-text search (and/or/phrase modes)", params: ["q", "type", "paper_id", "part_id", "page", "limit", "include_entities"] },
				semantic_search: { description: "Semantic similarity search via vector embeddings", params: ["q", "paper_id", "part_id", "page", "limit", "include_entities"] },
				list_entities: { description: "Browse 4,400+ entities (beings, places, orders, races, religions, concepts)", params: ["type", "q", "page", "limit"] },
				get_entity: { description: "Get entity details by slug ID", params: ["entity_id"] },
				get_entity_paragraphs: { description: "Get all paragraphs mentioning an entity", params: ["entity_id", "page", "limit"] },
				get_audio: { description: "Get audio file URLs for a paragraph", params: ["paragraph_ref"] },
			},
		},
		usage: {
			config: {
				mcpServers: {
					"urantia-papers": {
						url: "https://api.urantia.dev/mcp",
					},
				},
			},
			compatible_with: ["Claude Desktop", "Claude Code", "Cursor", "Windsurf"],
		},
	});
});

// POST/DELETE — MCP Streamable HTTP transport
mcpRoute.post("/", async (c) => {
	const server = createMcpServer();
	const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined });
	await server.connect(transport);
	return transport.handleRequest(c);
});

mcpRoute.delete("/", async (c) => {
	const server = createMcpServer();
	const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined });
	await server.connect(transport);
	return transport.handleRequest(c);
});
