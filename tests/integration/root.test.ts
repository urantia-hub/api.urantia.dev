import { describe, expect, it } from "bun:test";
import { get } from "../helpers/app.ts";

describe("GET /", () => {
	it("returns 200", async () => {
		const res = await get("/");
		expect(res.status).toBe(200);
	});

	it("returns exactly { name, version, docs, openapi }", async () => {
		const res = await get("/");
		const json = await res.json();
		expect(Object.keys(json).sort()).toEqual(
			["docs", "name", "openapi", "version"].sort(),
		);
		expect(json.name).toBe("Urantia Papers API");
		expect(json.version).toBe("1.0.0");
		expect(json.docs).toBe("/docs");
		expect(json.openapi).toBe("/openapi.json");
	});
});

describe("GET /robots.txt", () => {
	it("returns 200 with text content", async () => {
		const res = await get("/robots.txt");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("User-agent");
	});
});

describe("GET /sitemap.xml", () => {
	it("returns 200 with XML content", async () => {
		const res = await get("/sitemap.xml");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("<?xml");
		expect(text).toContain("<urlset");
	});
});
