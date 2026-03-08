import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "./db/client.ts";
import { cacheControl } from "./middleware/cache.ts";
import { corsMiddleware } from "./middleware/cors.ts";
import { loggerMiddleware } from "./middleware/logger.ts";
import { rateLimiter } from "./middleware/rate-limit.ts";
import { audioRoute } from "./routes/audio.ts";
import { entitiesRoute } from "./routes/entities.ts";
import { papersRoute } from "./routes/papers.ts";
import { paragraphsRoute } from "./routes/paragraphs.ts";
import { searchRoute } from "./routes/search.ts";
import { tocRoute } from "./routes/toc.ts";

const app = new OpenAPIHono();

// Global error handler
app.onError((err, c) => {
	const logger = c.get("logger");
	const ip =
		c.req.header("cf-connecting-ip") ??
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown";

	if (logger) {
		logger.error(err.message, {
			method: c.req.method,
			path: c.req.path,
			stack: err.stack,
			cf_ray: c.req.header("cf-ray") ?? undefined,
			ip,
		});
	} else {
		console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
	}

	return c.json({ error: "Internal server error" }, 500);
});

// Global middleware
app.use("*", corsMiddleware);
app.use("*", loggerMiddleware);
app.use("*", rateLimiter({ windowMs: 60_000, max: 100 }));
app.use("*", cacheControl());

// Health check
app.get("/", (c) =>
	c.json({
		name: "Urantia Papers API",
		version: "1.0.0",
		docs: "/docs",
		openapi: "/openapi.json",
	}),
);

// Health check with DB connectivity
app.get("/health", async (c) => {
	const timestamp = new Date().toISOString();
	try {
		const { db, close } = getDb();
		await db.execute(sql`SELECT 1`);
		closeDb(c, close);
		c.header("Cache-Control", "no-store");
		return c.json({ status: "healthy", db: "connected", timestamp });
	} catch (err) {
		c.header("Cache-Control", "no-store");
		return c.json(
			{
				status: "unhealthy",
				db: "error",
				error: err instanceof Error ? err.message : "Unknown error",
				timestamp,
			},
			503,
		);
	}
});

// robots.txt
app.get("/robots.txt", (c) => {
	const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://api.urantia.dev/sitemap.xml
`;
	return c.text(robotsTxt, 200, { "Content-Type": "text/plain" });
});

// sitemap.xml
app.get("/sitemap.xml", (c) => {
	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://api.urantia.dev</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://api.urantia.dev/docs</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://api.urantia.dev/openapi.json</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;
	return c.text(sitemap, 200, { "Content-Type": "application/xml" });
});

// Routes
app.route("/toc", tocRoute);
app.route("/papers", papersRoute);
app.route("/paragraphs", paragraphsRoute);
app.route("/search", searchRoute);
app.route("/entities", entitiesRoute);
app.route("/audio", audioRoute);

// OpenAPI spec
app.doc("/openapi.json", {
	openapi: "3.1.0",
	info: {
		title: "Urantia Papers API",
		version: "1.0.0",
		description:
			"A developer and AI-agent friendly API for the Urantia Papers. Provides full-text search, structured content access, and audio URLs for all 17,000+ paragraphs across 197 papers.",
	},
	servers: [
		{ url: "https://api.urantia.dev", description: "Production" },
		{ url: "http://localhost:3000", description: "Local development" },
	],
});

// Swagger UI
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

const port = Number(process.env.PORT) || 3000;

export { app };

export default {
	port,
	fetch: app.fetch,
};

console.log(`Urantia Papers API running on http://localhost:${port}`);
console.log(`Docs: http://localhost:${port}/docs`);
console.log(`OpenAPI: http://localhost:${port}/openapi.json`);
