import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is required");
}

// Per-request connections — postgres.js cannot reliably reuse connections on
// Cloudflare Workers. idle_timeout auto-closes the connection after 2s of idle,
// preventing leaks without explicit close() calls.
export function getDb() {
	const client = postgres(connectionString!, {
		prepare: false,
		max: 1,
		idle_timeout: 2,
		fetch_types: false,
	});
	return { db: drizzle(client, { schema }) };
}
