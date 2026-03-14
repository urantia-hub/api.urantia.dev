import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is required");
}

// Singleton connection — reused across requests within the same Workers isolate.
// On Workers, isolates are ephemeral; the runtime cleans up when the isolate dies.
const client = postgres(connectionString, {
	prepare: false,
	max: 5,
	idle_timeout: 20,
	fetch_types: false,
});
const db = drizzle(client, { schema });

export function getDb() {
	return { db };
}
