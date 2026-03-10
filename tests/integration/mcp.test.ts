import { describe, expect, it } from "bun:test";
import { app } from "../../src/index.ts";

function mcpRequest(body: unknown) {
	return app.request("/mcp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			...body,
		}),
	});
}

async function parseMcpResponse(res: Response) {
	const text = await res.text();
	// SSE format: lines starting with "data: " contain JSON
	const lines = text.split("\n").filter((l) => l.startsWith("data: "));
	const results = lines.map((l) => JSON.parse(l.slice(6)));
	return results;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
	// First initialize
	const initRes = await mcpRequest({
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: "2025-03-26",
			capabilities: {},
			clientInfo: { name: "test", version: "1.0.0" },
		},
	});
	const initResults = await parseMcpResponse(initRes);
	expect(initResults.length).toBeGreaterThan(0);

	// Then call tool
	const toolRes = await mcpRequest({
		id: 2,
		method: "tools/call",
		params: { name, arguments: args },
	});
	const toolResults = await parseMcpResponse(toolRes);
	return toolResults;
}

describe("MCP Server", () => {
	it("rejects GET /mcp without SSE accept header", async () => {
		const res = await app.request("/mcp", { method: "GET" });
		// MCP Streamable HTTP spec requires Accept: text/event-stream for GET
		expect(res.status).toBeGreaterThanOrEqual(400);
	});

	it("handles initialize request", async () => {
		const res = await mcpRequest({
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-03-26",
				capabilities: {},
				clientInfo: { name: "test", version: "1.0.0" },
			},
		});
		expect(res.status).toBe(200);
		const results = await parseMcpResponse(res);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].result.serverInfo.name).toBe("Urantia Papers API");
	});

	it("lists all 13 tools", async () => {
		// Initialize first
		await mcpRequest({
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-03-26",
				capabilities: {},
				clientInfo: { name: "test", version: "1.0.0" },
			},
		});

		const res = await mcpRequest({
			id: 2,
			method: "tools/list",
		});
		expect(res.status).toBe(200);
		const results = await parseMcpResponse(res);
		expect(results.length).toBeGreaterThan(0);
		const tools = results[0].result.tools;
		expect(tools.length).toBe(13);

		const toolNames = tools.map((t: { name: string }) => t.name).sort();
		expect(toolNames).toEqual([
			"get_audio",
			"get_entity",
			"get_entity_paragraphs",
			"get_paper",
			"get_paper_sections",
			"get_paragraph",
			"get_paragraph_context",
			"get_random_paragraph",
			"get_table_of_contents",
			"list_entities",
			"list_papers",
			"search",
			"semantic_search",
		]);
	});

	it("get_table_of_contents returns parts with papers", async () => {
		const results = await callTool("get_table_of_contents");
		expect(results.length).toBeGreaterThan(0);
		const content = JSON.parse(results[0].result.content[0].text);
		expect(content.parts).toBeArray();
		expect(content.parts.length).toBeGreaterThan(0);
		expect(content.parts[0]).toHaveProperty("title");
		expect(content.parts[0].papers).toBeArray();
	});

	it("get_paragraph returns a paragraph by ref", async () => {
		const results = await callTool("get_paragraph", { ref: "0.0.1" });
		expect(results.length).toBeGreaterThan(0);
		const content = JSON.parse(results[0].result.content[0].text);
		expect(content).toHaveProperty("text");
		expect(content).toHaveProperty("standardReferenceId");
	});

	it("get_paragraph returns error for invalid ref", async () => {
		const results = await callTool("get_paragraph", { ref: "invalid" });
		expect(results.length).toBeGreaterThan(0);
		const result = results[0].result;
		expect(result.isError).toBe(true);
		const content = JSON.parse(result.content[0].text);
		expect(content.error).toContain("Invalid reference format");
	});

	it("search returns results for a query", async () => {
		const results = await callTool("search", { q: "God", limit: 3 });
		expect(results.length).toBeGreaterThan(0);
		const content = JSON.parse(results[0].result.content[0].text);
		expect(content.data).toBeArray();
		expect(content.data.length).toBeGreaterThan(0);
		expect(content.meta).toHaveProperty("total");
	});

	it("list_entities returns paginated results", async () => {
		const results = await callTool("list_entities", { limit: 5 });
		expect(results.length).toBeGreaterThan(0);
		const content = JSON.parse(results[0].result.content[0].text);
		expect(content.data).toBeArray();
		expect(content.meta).toHaveProperty("total");
	});
});
