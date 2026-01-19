import { openaiClient } from "./openai";
import { qdrantClient } from "../vector/qdrant";
import { generateContentHash, isValidHash } from "../../utils/hash";
import { PrismaClient } from "../../generated/prisma";

const stringToUUID = (str: string): string => {
    const hash = generateContentHash(str);
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};


const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "";
const EMBEDDING_DIMENSION = Number(process.env.EMBEDDING_DIMENSION );
const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME ?? "";

export interface EmbeddingResult {
    embedding: number[];
    vectorId: string;
    hash: string;
    success: boolean;
    isDuplicate: boolean;
    existingMemoryId?: number;
    error?: string;
}

export interface SearchResult {
    id: string | number;
    score: number;
    payload?: Record<string, unknown> ;
}

type SearchOptions = {
    limit?: number;
    scoreThreshold?: number;
    filter?: Record<string, unknown>;
    userId?: number;
    agentId?: string;
    runId?: string;
};

export class EmbeddingService {
    private readonly model: string;
    private readonly dimension: number;
    private readonly collectionName: string;
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.model = EMBEDDING_MODEL;
        this.dimension = EMBEDDING_DIMENSION;
        this.collectionName = QDRANT_COLLECTION_NAME;
        this.prisma = prismaClient ?? new PrismaClient();
    }

    private async checkExistingEmbedding(contentHash: string, userId?: number) {
        if (!isValidHash(contentHash)) {
            throw new Error("Invalid content hash");
        }

        const where: {
            contentHash: string;
            userId?: number;
        } = { contentHash };

        if (userId !== undefined) {
            where.userId = userId;
        }

        const existing = await this.prisma.memory.findFirst({
            where,
            select: {
                id: true,
                embeddingRef: true,
                contentHash: true,
            },
        });

        if (!existing) {
            return { exists: false as const };
        }

        return {
            exists: true as const,
            memoryId: existing.id,
            vectorId: existing.embeddingRef ? `memory_${existing.id}` : undefined,
            hash: existing.contentHash,
        };
    }

    private async retrieveExistingEmbedding(vectorId: string) {
        await qdrantClient.ensureCollection();
        const client = qdrantClient.getClient();
        const uuidId = stringToUUID(vectorId);

        const result = await client.retrieve(this.collectionName, {
            ids: [uuidId],
            with_vector: true,
        });

        if (!result.length || !result[0]?.vector) {
            return null;
        }

        const vector = result[0]?.vector;
        if (Array.isArray(vector) && vector?.length === this.dimension) {
            return vector as number[];
        }

        return null;
    }

    private validateText(text: string) {
        if(!text || typeof text !== "string"){
            return { valid: false, error: "Text cannot be empty"}
        }
        
        if(text.trim().length === 0) {
            return { valid: false, error: "Text cannot be empty"}
        }

        const maxLength = 32000;
        if(text.length > maxLength) {
            return {
                valid: false,
                error: "Text exceeds maximum length of characters"
            }
        }
        return {valid: true};
    }


    async generateEmbedding(text: string) {
        const validation = this.validateText(text);
        if(!validation.valid){
            throw new Error(validation.error);
        }

        try {
            const client = openaiClient.getClient();
            const response = await client.embeddings.create({
                model: this.model,
                input: text.trim(),
                dimensions: this.dimension,
            });

            if(!response.data || response.data.length === 0) {
                throw new Error("No embedding data returned from OpenAI");
            }

            const embedding = response.data[0]?.embedding;

            if(!embedding || embedding.length !== this.dimension) {
                throw new Error(" Invalid embedding dimension")
            };

            return embedding;
        }catch(err) {
            if(err instanceof Error) {
                if(err.message.includes("rate_limit")){
                    throw new Error("Open Ai Apu rate limit exceeded")
                }
                if(err.message.includes("invalid_api_key")){
                    throw new Error("OpenAI API quota exceeded");
                }
            }
            throw new Error("Failed to generate embedding: "+ (err as Error).message)
        }
    }

    async generateEmbeddingsBatch(texts: string[]){
        if(!Array.isArray(texts) || texts.length === 0) {
            throw new Error("Text must not be empty")
        }

        if(texts.length> 2048) {
            throw new Error("Batch size cannot exceed 2048 texts")
        }

        const results = await Promise.allSettled(
            texts.map((text)=> this.generateEmbedding(text)) 
        );

        return results.map((result, index) => {
            if(result.status === "fulfilled") {
                return {
                    text: texts[index],
                    embedding: result.value,
                };
            }else {
                return {
                    text: texts[index],
                    embedding: [],
                    error: result.reason?.message ||"Unknown error"
                };
            }
        });
    }

    async storeEmbedding(vectorId: string, embedding: number[], payload: Record<string, unknown>) {
        if(!vectorId || typeof vectorId !== "string" ) {
            throw new Error("Vector ID must not be empty")
        }

        if(!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error("Embedding must not be empty array")
        }
        if (embedding.length !== this.dimension){
            throw new Error("Embedding dimension mismatch")
        }

        if(!payload || typeof payload !== "object"){
            throw new Error("Payload must be an object");
        }

        try {
            await qdrantClient.ensureCollection();
            const client = qdrantClient.getClient();

            const uuidId = stringToUUID(vectorId);
            await client.upsert(this.collectionName, {
                wait: true,
                points: [
                    {
                        id: uuidId,
                        vector: embedding,
                        payload: {
                            ...payload,
                            vectorId,
                            createdAt: new Date().toISOString(),
                        },
                    },
                ],
            });
            return true;
        } catch(err) {
            throw new Error("Failed to store embedding: "+ (err as Error).message)
        }
    }

    async generateAndStore(text: string, vectorId: string, payload: Record<string, unknown>, userId?: number, skipDuplicationCheck = false){
        try{
            const contentHash = generateContentHash(text);

            if(!skipDuplicationCheck) {
                const existing = await this.checkExistingEmbedding(contentHash, userId);

                if(existing.exists && existing.vectorId) {
                    const existingEmbedding = await this.retrieveExistingEmbedding(
                        existing.vectorId
                    );

                    if(existingEmbedding) {
                        return {
                            embedding: existingEmbedding,
                            vectorId: existing.vectorId,
                            hash: contentHash,
                            success: true,
                            isDuplicate: true,
                            existingMemoryId: existing.memoryId,
                        };
                    }
                }
            }

            const embedding = await this.generateEmbedding(text);

            await this.storeEmbedding(vectorId, embedding, {
                ...payload,
                contentHash,
            });

            return {
                embedding,
                vectorId,
                hash: contentHash,
                success: true,
                isDuplicate: false,
            };
        }catch(err){
            return {
                embedding: [],
                vectorId,
                hash: "",
                success: false,
                isDuplicate: false,
                error: (err as Error).message,
            };
        }
    }

    async searchSimilar(queryText: string, options: SearchOptions = {}){
        const limit = options.limit ?? 10;
        const scoreThreshold = options.scoreThreshold ?? 0.7;

        if (limit <1 || limit> 100){
            throw new Error("Limit must be between 1 and 100")
        }

        if(scoreThreshold <0 || scoreThreshold> 1) {
            throw new Error("score threshold must be between 0 and 1")
        }

        if(!options.userId && !options.agentId && !options.runId){
            throw new Error("At least one of userId, agentId, or runId is required for scoped search");
        }

        try {
            const queryEmbedding = await this.generateEmbedding(queryText);
            await qdrantClient.ensureCollection();
            const client = qdrantClient.getClient();

            const mustFilters: Record<string, unknown>[] = [];
            if(options.userId !== undefined){
                mustFilters.push({ key: "userId", match: { value: options.userId } });
            }
            if(options.agentId){
                mustFilters.push({ key: "agentId", match: { value: options.agentId } });
            }
            if(options.runId){
                mustFilters.push({ key: "runId", match: { value: options.runId } });
            }
            if(options.filter){
                mustFilters.push(options.filter);
            }

            const qdrantFilter = mustFilters.length > 0 ? { must: mustFilters } : undefined;

            const SearchResults = await client.search(this.collectionName, {
                vector: queryEmbedding,
                limit,
                score_threshold: scoreThreshold,
                filter: qdrantFilter,
                with_payload: true,
            });

            return SearchResults.map((result) => ({
                id: result.id as string | number,
                score: result.score || 0,
                payload: result.payload as Record<string, unknown>,
            }))
        }catch(err){
            throw new Error(
                "Failed to search similar memories: " + (err as Error).message,
            )
        }
    }

    async deleteEmbedding(vectorId: string) {
        if(!vectorId || typeof vectorId !== "string"){
            throw new Error("Vector Id must not be empty")
        }

        try{
            await qdrantClient.ensureCollection();
            const client = qdrantClient.getClient();

            await client.delete(this.collectionName, {
                wait: true,
                points: [vectorId],
            });
            return true;
        }catch(err) {
            throw new Error("Failed to delete embedding: "+ (err as Error).message)
        }
    }

    async updateEmbeddingPayload(vectorId: string, payload: Record<string, unknown>){
        if(!vectorId || typeof vectorId !== "string") {
            throw new Error("Vector Id must not be empty string")
        }

        try {
            await qdrantClient.ensureCollection();
            const client = qdrantClient.getClient();

            await client.setPayload(this.collectionName, {
                payload, 
                points: [vectorId],
            });
            return true;
        }catch(err) {
            throw new Error("failed to update embeddings: "+ (err as Error).message);
        }
    }
}

let EmbeddingServiceInstance: EmbeddingService | null = null;

export const getEmbeddingService = (prismaClient?: PrismaClient)=> {
    if(!EmbeddingServiceInstance) {
        EmbeddingServiceInstance = new EmbeddingService(prismaClient);
    }
    return EmbeddingServiceInstance;
};

export const embeddingService = getEmbeddingService();