import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is required");
}

// Lazy singleton — reused across requests within the same Workers isolate.
// Automatically recreated if the connection goes stale (e.g. after isolate freeze).
let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function createClient() {
	client = postgres(connectionString!, {
		prepare: false,
		max: 1,
		idle_timeout: 20,
		fetch_types: false,
	});
	db = drizzle(client, { schema });
}

export function getDb() {
	if (!db) createClient();
	return { db: db! };
}

/** Discard the current connection so the next getDb() creates a fresh one. */
export function resetDb() {
	if (client) {
		client.end().catch(() => {});
	}
	client = null;
	db = null;
}
