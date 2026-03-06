-- Run this after the initial Drizzle migration creates the tables.
-- Adds the full-text search generated column and GIN index.

-- Enable pgvector extension (for future semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the column if it exists (for re-running)
ALTER TABLE paragraphs DROP COLUMN IF EXISTS search_vector;

-- Add tsvector generated column
ALTER TABLE paragraphs ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS paragraphs_fts_gin_idx
  ON paragraphs USING GIN (search_vector);

-- Create HNSW index for vector search (only useful when embeddings are populated)
CREATE INDEX IF NOT EXISTS paragraphs_embedding_hnsw_idx
  ON paragraphs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
