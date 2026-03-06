import type { Context } from "hono";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is required");
}

export function getDb() {
	const client = postgres(connectionString!, { prepare: false, max: 1, idle_timeout: 2, fetch_types: false });
	return { db: drizzle(client, { schema }), close: () => client.end() };
}

/**
 * Close the DB connection using executionCtx.waitUntil (Cloudflare Workers)
 * or falling back to await (Bun dev mode).
 */
export function closeDb(c: Context, close: () => Promise<void>) {
	try {
		c.executionCtx.waitUntil(close());
	} catch {
		close();
	}
}
