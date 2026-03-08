import { ApiCheck, AssertionBuilder } from "checkly/constructs";

const BASE_URL = "https://api.urantia.dev";
const defaults = {
	tags: ["api", "urantia"],
	frequency: 10,
	locations: ["us-east-1", "eu-west-1"],
};

// ── Health ──

new ApiCheck("health-check", {
	name: "GET /health",
	...defaults,
	frequency: 5,
	request: {
		url: `${BASE_URL}/health`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.status").equals("healthy"),
			AssertionBuilder.jsonBody("$.db").equals("connected"),
			AssertionBuilder.jsonBody("$.timestamp").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

// ── Root ──

new ApiCheck("root-check", {
	name: "GET /",
	...defaults,
	request: {
		url: `${BASE_URL}/`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.name").equals("Urantia Papers API"),
			AssertionBuilder.jsonBody("$.version").equals("1.0.0"),
			AssertionBuilder.jsonBody("$.docs").equals("/docs"),
			AssertionBuilder.jsonBody("$.openapi").equals("/openapi.json"),
		],
	},
});

// ── Table of Contents ──

new ApiCheck("toc-check", {
	name: "GET /toc",
	...defaults,
	request: {
		url: `${BASE_URL}/toc`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.parts").isNotNull(),
			AssertionBuilder.jsonBody("$.data.parts.length").equals(5),
			AssertionBuilder.jsonBody("$.data.parts[0].id").isNotNull(),
			AssertionBuilder.jsonBody("$.data.parts[0].title").isNotNull(),
			AssertionBuilder.jsonBody("$.data.parts[0].papers").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

// ── Papers ──

new ApiCheck("papers-list-check", {
	name: "GET /papers",
	...defaults,
	request: {
		url: `${BASE_URL}/papers`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data").isNotNull(),
			AssertionBuilder.jsonBody("$.data.length").equals(197),
			AssertionBuilder.jsonBody("$.data[0].id").isNotNull(),
			AssertionBuilder.jsonBody("$.data[0].title").isNotNull(),
			AssertionBuilder.jsonBody("$.data[0].partId").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

new ApiCheck("paper-detail-check", {
	name: "GET /papers/2",
	...defaults,
	request: {
		url: `${BASE_URL}/papers/2`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.paper.id").equals("2"),
			AssertionBuilder.jsonBody("$.data.paper.title").equals("The Nature of God"),
			AssertionBuilder.jsonBody("$.data.paragraphs").isNotNull(),
			AssertionBuilder.jsonBody("$.data.paragraphs.length").greaterThan(0),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

new ApiCheck("paper-not-found-check", {
	name: "GET /papers/999 (404)",
	...defaults,
	request: {
		url: `${BASE_URL}/papers/999`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(404),
			AssertionBuilder.jsonBody("$.error").isNotNull(),
		],
	},
});

new ApiCheck("paper-sections-check", {
	name: "GET /papers/1/sections",
	...defaults,
	request: {
		url: `${BASE_URL}/papers/1/sections`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data").isNotNull(),
			AssertionBuilder.jsonBody("$.data.length").greaterThan(0),
			AssertionBuilder.jsonBody("$.data[0].sectionId").isNotNull(),
			AssertionBuilder.jsonBody("$.data[0].title").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

// ── Paragraphs ──

new ApiCheck("paragraph-random-check", {
	name: "GET /paragraphs/random",
	...defaults,
	request: {
		url: `${BASE_URL}/paragraphs/random`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.id").isNotNull(),
			AssertionBuilder.jsonBody("$.data.text").isNotNull(),
			AssertionBuilder.jsonBody("$.data.paperId").isNotNull(),
			AssertionBuilder.jsonBody("$.data.standardReferenceId").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

new ApiCheck("paragraph-by-global-id-check", {
	name: "GET /paragraphs/1:2.0.1 (globalId)",
	...defaults,
	request: {
		url: `${BASE_URL}/paragraphs/1:2.0.1`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.paperId").equals("2"),
			AssertionBuilder.jsonBody("$.data.text").isNotNull(),
			AssertionBuilder.jsonBody("$.data.htmlText").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

new ApiCheck("paragraph-by-std-ref-check", {
	name: "GET /paragraphs/2:0.1 (standardReferenceId)",
	...defaults,
	request: {
		url: `${BASE_URL}/paragraphs/2:0.1`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.paperId").equals("2"),
			AssertionBuilder.jsonBody("$.data.text").isNotNull(),
		],
	},
});

new ApiCheck("paragraph-by-psp-check", {
	name: "GET /paragraphs/2.0.1 (paperSectionParagraphId)",
	...defaults,
	request: {
		url: `${BASE_URL}/paragraphs/2.0.1`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.paperId").equals("2"),
			AssertionBuilder.jsonBody("$.data.text").isNotNull(),
		],
	},
});

new ApiCheck("paragraph-invalid-ref-check", {
	name: "GET /paragraphs/not-a-ref (400)",
	...defaults,
	request: {
		url: `${BASE_URL}/paragraphs/not-a-ref`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(400),
			AssertionBuilder.jsonBody("$.error").isNotNull(),
		],
	},
});

new ApiCheck("paragraph-context-check", {
	name: "GET /paragraphs/2:0.1/context",
	...defaults,
	request: {
		url: `${BASE_URL}/paragraphs/2:0.1/context?window=2`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.target").isNotNull(),
			AssertionBuilder.jsonBody("$.data.target.text").isNotNull(),
			AssertionBuilder.jsonBody("$.data.before").isNotNull(),
			AssertionBuilder.jsonBody("$.data.after").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

// ── Search ──

new ApiCheck("search-fulltext-check", {
	name: "POST /search (full-text)",
	...defaults,
	request: {
		url: `${BASE_URL}/search`,
		method: "POST",
		headers: [{ key: "Content-Type", value: "application/json" }],
		body: JSON.stringify({ q: "God", limit: 5 }),
		bodyType: "RAW",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data").isNotNull(),
			AssertionBuilder.jsonBody("$.data.length").greaterThan(0),
			AssertionBuilder.jsonBody("$.data[0].text").isNotNull(),
			AssertionBuilder.jsonBody("$.data[0].rank").isNotNull(),
			AssertionBuilder.jsonBody("$.meta.total").greaterThan(0),
			AssertionBuilder.jsonBody("$.meta.page").equals(0),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

new ApiCheck("search-phrase-check", {
	name: 'POST /search (phrase: "nature of God")',
	...defaults,
	request: {
		url: `${BASE_URL}/search`,
		method: "POST",
		headers: [{ key: "Content-Type", value: "application/json" }],
		body: JSON.stringify({ q: "nature of God", type: "phrase", limit: 5 }),
		bodyType: "RAW",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data").isNotNull(),
			AssertionBuilder.jsonBody("$.data.length").greaterThan(0),
			AssertionBuilder.jsonBody("$.meta.total").greaterThan(0),
		],
	},
});

new ApiCheck("search-with-filter-check", {
	name: "POST /search (filtered by paperId)",
	...defaults,
	request: {
		url: `${BASE_URL}/search`,
		method: "POST",
		headers: [{ key: "Content-Type", value: "application/json" }],
		body: JSON.stringify({ q: "God", paperId: "2", limit: 5 }),
		bodyType: "RAW",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data").isNotNull(),
			AssertionBuilder.jsonBody("$.data.length").greaterThan(0),
			AssertionBuilder.jsonBody("$.meta.total").greaterThan(0),
		],
	},
});

new ApiCheck("search-empty-query-check", {
	name: "POST /search (empty query → 400)",
	...defaults,
	request: {
		url: `${BASE_URL}/search`,
		method: "POST",
		headers: [{ key: "Content-Type", value: "application/json" }],
		body: JSON.stringify({ q: "" }),
		bodyType: "RAW",
		assertions: [AssertionBuilder.statusCode().equals(400)],
	},
});

// ── Audio ──

new ApiCheck("audio-check", {
	name: "GET /audio/1:2.0.1",
	...defaults,
	request: {
		url: `${BASE_URL}/audio/1:2.0.1`,
		method: "GET",
		assertions: [
			AssertionBuilder.statusCode().equals(200),
			AssertionBuilder.jsonBody("$.data.paragraphId").isNotNull(),
			AssertionBuilder.jsonBody("$.data.audio").isNotNull(),
			AssertionBuilder.responseTime().lessThan(5000),
		],
	},
});

new ApiCheck("audio-not-found-check", {
	name: "GET /audio/not-a-ref (404)",
	...defaults,
	request: {
		url: `${BASE_URL}/audio/not-a-ref`,
		method: "GET",
		assertions: [AssertionBuilder.statusCode().equals(404)],
	},
});
