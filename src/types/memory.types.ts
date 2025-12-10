import {z} from "zod";

export const addMemorySchema = z.object({
    userId: z.number(),
    source: z.string(),
    sourceId: z.string(),
    timestamp: z.coerce.date(),
    content: z.string(),
    metadata: z.object( {
        title: z.string().optional(),
        origin: z.string().optional(),
        tags: z.string(),
        category: z.array(z.string()),
        others: z.string().optional()
    })
})


export const updateMemorySchema = z.object({
    id: z.number(),
    userId: z.number().optional(),
    source: z.string().optional(),
    sourceId: z.string().optional(),
    timestamp: z.coerce.date().optional(),
    content: z.string().optional(),
    metadata: z.object({
        title: z.string().optional(),
        origin: z.string().optional(),
        tags: z.string().optional(),
        category: z.array(z.string()).optional(),
        others: z.string().optional()
    })
})

export const deleteMemorySchema = z.object({
    id: z.number(),
    userId: z.number(),
})

export const getUserMemorySchema = z.object({
    userId: z.string()
}) 

export const getMemorySchema = z.object({
    id: z.number(),
    userId: z.number().optional(),
});

export const addMemoriesSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
    })),
    userId: z.number().optional(),
    agentId: z.string().optional(),
    runId: z.string().optional(),
    source: z.string(),
    sourceId: z.union([z.string(), z.number()]),
    timestamp: z.coerce.date(),
    contentUrl: z.string(),
    title: z.string().optional(),
    origin: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.array(z.string()).optional(),
    summary: z.string().optional(),
    type: z.string().optional(),
    importance: z.number().optional(),
    confidence: z.number().optional(),
    infer: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const searchMemoriesSchema = z.object({
    query: z.string(),
    userId: z.number().optional(),
    agentId: z.string().optional(),
    runId: z.string().optional(),
    limit: z.number().optional(),
    scoreThreshold: z.number().optional(),
});

export const generateAnswerSchema = z.object({
    question: z.string(),
    query: z.string().optional(),
    userId: z.number().optional(),
    agentId: z.string().optional(),
    runId: z.string().optional(),
    limit: z.number().optional(),
    scoreThreshold: z.number().optional(),
    rerank: z.object({
        enabled: z.boolean().optional(),
        topK: z.number().optional(),
        model: z.string().optional(),
    }).optional(),
});

export const askMemorySchema = z.object({
    query: z.string(),
    userId: z.number().optional(),
    agentId: z.string().optional(),
    runId: z.string().optional(),
    limit: z.number().optional(),
    scoreThreshold: z.number().optional(),
    rerank: z.object({
        enabled: z.boolean().optional(),
        topK: z.number().optional(),
        model: z.string().optional(),
    }).optional(),
});

export type CreateMemoryInput = {
    userId: number;
    source: string;
    sourceId: string | number;
    timestamp: Date | string;
    content: string;
    contentUrl: string;
    title?: string;
    origin?: string;
    tags?: string[];
    category?: string[];
    attribute?: Record<string, unknown>;
    summary?: string;
    type?: string;
    importance?: number;
    confidence?: number;
    agentId?: string;
    runId?: string;
    role?: string;
};

export type UpdateMemoryInput = Partial<CreateMemoryInput> & { id: number };

export type MessageInput = {
    role: "system" | "user" | "assistant";
    content: string;
};

export type AddMemoryInput = {
    messages: MessageInput[];
    userId?: number;
    agentId?: string;
    runId?: string;
    source: string;
    sourceId: string | number;
    timestamp: Date | string;
    contentUrl: string;
    title?: string;
    origin?: string;
    tags?: string[];
    category?: string[];
    attribute?: Record<string, unknown>;
    summary?: string;
    type?: string;
    importance?: number;
    confidence?: number;
    infer?: boolean;
    metadata?: Record<string, unknown>;
};

export type MemorySearchInput = {
    query: string;
    userId?: number;
    agentId?: string;
    runId?: string;
    limit?: number;
    scoreThreshold?: number;
};

export type RetrievedMemory = {
    id: string | number;
    score: number;
    text: string;
    payload: Record<string, unknown>;
    rerankScore?: number;
};

export type RerankOptions = {
    enabled?: boolean;
    topK?: number;
    model?: string;
};

export type GenerateAnswerInput = Omit<MemorySearchInput, "query"> & {
    query?: string;
    rerank?: RerankOptions;
};