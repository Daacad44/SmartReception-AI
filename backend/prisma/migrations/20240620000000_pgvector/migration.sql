-- Enable pgvector for future native vector search (optional; app uses JSON embeddings + cosine similarity)
CREATE EXTENSION IF NOT EXISTS vector;
