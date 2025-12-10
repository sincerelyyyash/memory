# Memory 

Memory is a TypeScript/Bun service that ingests, stores, and retrieves “memories” (text snippets and extracted facts) with semantic search and retrieval-augmented generation (RAG). It uses Express for the API, Prisma/PostgreSQL for structured storage, Qdrant for vector search, and OpenAI for embeddings, fact extraction, reranking, and answer generation.

## Features
- REST API for creating, updating, deleting, and querying memories
- Fact-first storage: extracts atomic facts before embedding for richer recall
- Semantic search via Qdrant vector DB with scoped filters (userId, agentId, runId)
- RAG Q&A: retrieves memories, optionally reranks, then generates answers with LLMs
- Deduplication using normalized content hashing
- Validation with Zod schemas on all inputs
- Configurable models for embedding, rerank, fact extraction, and answer generation

## Architecture
<img width="2816" height="1536" alt="Memory Architecture" src="https://github.com/user-attachments/assets/647d68bb-cea1-45c6-b7ac-b817ebdac7e0" />


- **API Layer**: Express routes under `/api` with controllers handling validation and responses.
- **Services**:
  - Memory Service: core orchestration (create, batch ingest, search, ask/answer, dedupe).
  - Fact Extraction Service: OpenAI chat completion to produce concise facts.
  - Embedding Service: generates embeddings (OpenAI), stores/searches vectors in Qdrant.
  - Rerank & Answer: optional reranking plus answer generation via OpenAI chat.
- **Data Stores**:
  - PostgreSQL (Prisma): memory metadata (source, tags, categories, attributes, summary, contentHash).
  - Qdrant: embeddings with payload metadata for filtered search.
- **Utilities**: hashing for deduplication, prompt templates for RAG flows.

## Data Model (Prisma)
`Memory` fields include: `userId`, `agentId`, `runId`, `role`, `source`, `sourceId`, `timestamp`, `contentUrl`, `title`, `origin`, `tags[]`, `category[]`, `attribute` (JSON), `summary`, `type`, `importance`, `confidence`, `embeddingRef`, `contentHash` (unique), `createdAt`, `updatedAt`. Indexed on `contentHash`, `userId + contentHash`, and `userId + agentId + runId`.

## API Endpoints
Base path: `/api`

- `POST /memory` — Create a memory (fact extraction + embeddings).
- `PUT /memory` — Update memory metadata/content (does not currently re-embed).
- `DELETE /memory` — Delete a memory (controller does not delete vector; use Embedding Service if needed).
- `GET /memory` — Get memory by id.
- `GET /memory/user` — List memories for a user.
- `POST /memories` — Batch ingest messages; defaults to fact extraction unless `infer=false`.
- `POST /memories/search` — Semantic search with filters (`userId`/`agentId`/`runId`, limit, scoreThreshold).
- `POST /memories/answer` — Ask with optional query override; returns answer + source memories.
- `POST /memories/ask` — Similar to answer; returns answer, memories, count, models.

Request/response schemas are enforced via Zod in `src/types/memory.types.ts`.

## Key Flows
- **Create**: controller validates → Memory Service dedupes by hash → save row → extract facts → embed each fact → store vectors in Qdrant → update memory summary/embeddingRef → respond.
- **Batch**: iterate messages; `infer=true` follows Create flow per message; `infer=false` stores full-content embedding once.
- **Search**: generate query embedding → Qdrant search with filters → return scored payloads.
- **Ask/Answer (RAG)**: search → optional rerank via LLM scores → format memories → answer via LLM.

## Environment Variables
- `PORT` — API port (default 8000)
- `OPENAI_API_KEY` — OpenAI key
- `EMBEDDING_MODEL` — OpenAI embedding model name
- `EMBEDDING_DIMENSION` — Embedding vector dimension (must match Qdrant collection)
- `QDRANT_URL` — Qdrant endpoint
- `QDRANT_API_KEY` — Qdrant API key (if required)
- `QDRANT_COLLECTION_NAME` or `COLLECTION_NAME` — Target collection
- `ANSWER_MODEL` — Model for answer generation (default `gpt-4o-mini`)
- `RERANK_MODEL` — Model for reranking (default `gpt-4o-mini`)
- `RERANK_ENABLED` — `"true"` to enable rerank by default
- `RERANK_TOP_K` — Max docs after rerank
- `FACT_MODEL` — Model for fact extraction (default `gpt-4o-mini`)
- `NODE_ENV` — Controls Prisma logging

## Setup
1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Install deps: `bun install`
3. Configure environment variables (e.g., `.env`).
4. Prepare Postgres database and run Prisma generate (ensure `prisma/generator` output matches `src/generated/prisma`).
5. Ensure Qdrant is reachable and collection matches dimension.

## Running
- Dev/serve: `bun run index.ts`
- The server listens on `PORT` and exposes `/api/...` routes.

## Operational Notes
- Deduplication is per `userId` (and agent/run attributes) using `contentHash`.
- Fact extraction is mandatory in the create flow; if no facts are extracted, the memory is stored without embeddings.
- Embedding updates on memory updates are not automatic in current controllers.
- Qdrant collection is auto-created on first use with cosine distance and configured dimension.
- Rerank is optional and can be toggled per request or via env defaults.

## File Map (high level)
- `src/index.ts` — Express bootstrap
- `src/routes/memory.routes.ts` — Route definitions
- `src/controllers/memory.controller.ts` — HTTP handlers + validation
- `src/services/memory/memory.service.ts` — Core domain logic
- `src/services/extraction/factExtraction.service.ts` — Fact extraction (OpenAI)
- `src/services/embedding/embedding.service.ts` — Embeddings + Qdrant I/O
- `src/services/vector/qdrant.ts` — Qdrant client wrapper
- `src/services/embedding/openai.ts` — OpenAI client wrapper
- `src/types/memory.types.ts` — Zod schemas and TS types
- `src/utils/hash.ts` — Normalization and content hashing
- `src/prisma/schema.prisma` — Data model
