import { describe, expect, it } from "bun:test";
import { post } from "../helpers/app.ts";
import {
	assertMetaShape,
	assertSearchResultShape,
	assertSemanticResultShape,
} from "../helpers/shapes.ts";

describe("POST /search (full-text)", () => {
	it("returns 200 for valid query", async () => {
		const res = await post("/search", { q: "God" });
		expect(res.status).toBe(200);
	});

	it("each result has paragraph shape + rank", async () => {
		const res = await post("/search", { q: "God", limit: 3 });
		const { data } = await res.json();
		expect(data.length).toBeGreaterThan(0);
		for (const r of data) {
			assertSearchResultShape(r);
		}
	});

	it("meta has correct shape", async () => {
		const res = await post("/search", { q: "God" });
		const { meta } = await res.json();
		assertMetaShape(meta);
	});

	it("respects limit parameter", async () => {
		const res = await post("/search", { q: "God", limit: 5 });
		const { data } = await res.json();
		expect(data.length).toBeLessThanOrEqual(5);
	});

	it("respects page parameter", async () => {
		const res = await post("/search", { q: "God", limit: 5, page: 1 });
		expect(res.status).toBe(200);
		const { meta } = await res.json();
		expect(meta.page).toBe(1);
	});

	it("type='phrase' works", async () => {
		const res = await post("/search", {
			q: "nature of God",
			type: "phrase",
			limit: 5,
		});
		expect(res.status).toBe(200);
	});

	it("type='or' returns results", async () => {
		const res = await post("/search", {
			q: "love truth",
			type: "or",
			limit: 5,
		});
		expect(res.status).toBe(200);
		const { data } = await res.json();
		expect(data.length).toBeGreaterThan(0);
	});

	it("paperId filter narrows results", async () => {
		const res = await post("/search", { q: "God", paperId: "2", limit: 5 });
		expect(res.status).toBe(200);
		const { data } = await res.json();
		for (const r of data) {
			expect(r.paperId).toBe("2");
		}
	});

	it("partId filter narrows results", async () => {
		const res = await post("/search", { q: "God", partId: "1", limit: 5 });
		expect(res.status).toBe(200);
		const { data } = await res.json();
		for (const r of data) {
			expect(r.partId).toBe("1");
		}
	});

	it("returns 400 for empty query", async () => {
		const res = await post("/search", { q: "" });
		expect(res.status).toBe(400);
	});
});

const hasOpenAI = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasOpenAI)("POST /search/semantic", () => {
	it("returns 200 for valid query", async () => {
		const res = await post("/search/semantic", {
			q: "meaning of life",
			limit: 3,
		});
		expect(res.status).toBe(200);
	});

	it("each result has paragraph shape + similarity", async () => {
		const res = await post("/search/semantic", {
			q: "meaning of life",
			limit: 3,
		});
		const { data } = await res.json();
		expect(data.length).toBeGreaterThan(0);
		for (const r of data) {
			assertSemanticResultShape(r);
		}
	});

	it("meta has correct shape", async () => {
		const res = await post("/search/semantic", {
			q: "meaning of life",
			limit: 3,
		});
		const { meta } = await res.json();
		assertMetaShape(meta);
	});

	it("respects paperId filter", async () => {
		const res = await post("/search/semantic", {
			q: "God",
			paperId: "2",
			limit: 3,
		});
		expect(res.status).toBe(200);
		const { data } = await res.json();
		for (const r of data) {
			expect(r.paperId).toBe("2");
		}
	});
});
