import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL environment variable is required");
	process.exit(1);
}

const sql = postgres(DATABASE_URL);

console.log("Creating HNSW index on embedding column (this may take a moment)...");
await sql`
  CREATE INDEX IF NOT EXISTS paragraphs_embedding_hnsw_idx
    ON paragraphs USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
`;

console.log("HNSW index created successfully.");

// Verify
const check = await sql`
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'paragraphs' AND indexname = 'paragraphs_embedding_hnsw_idx'
`;
console.log(`Verification: index exists = ${check.length > 0}`);

await sql.end();
console.log("Done.");
