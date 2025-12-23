import { getPrismaClient } from "../../db/prisma.client";
import type { EmbeddingResult, SearchResult } from "../embedding/embedding.service";
import { getEmbeddingService } from "../embedding/embedding.service";
import { generateContentHash } from "../../utils/hash";
import { extractFacts } from "../extraction/factExtraction.service";
import { openaiClient } from "../embedding/openai";
import { MEMORY_ANSWER_SYSTEM_PROMPT, RERANK_SYSTEM_PROMPT } from "../../config/prompts";
import type {
    CreateMemoryInput,
    UpdateMemoryInput,
    AddMemoryInput,
    MemorySearchInput,
    RetrievedMemory,
    RerankOptions,
    GenerateAnswerInput,
} from "../../types/memory.types";

const prisma = getPrismaClient();
const embeddingService = getEmbeddingService(prisma);

const ANSWER_MODEL = process.env.ANSWER_MODEL ?? "gpt-4o-mini";
const RERANK_ENABLED_DEFAULT = process.env.RERANK_ENABLED === "true";
const RERANK_MODEL_DEFAULT = process.env.RERANK_MODEL ?? "gpt-4o-mini";
const RERANK_TOP_K_DEFAULT = Number(process.env.RERANK_TOP_K ?? 0);

export const createMemoryWithEmbedding = async(input: CreateMemoryInput) => {
    const contentHash = generateContentHash(input.content);

    const andFilters: Record<string, unknown>[] = [
        { contentHash },
        { userId: input.userId },
    ];
    if (input.agentId) {
        andFilters.push({ attribute: { path: ["agentId"], equals: input.agentId } });
    }
    if (input.runId) {
        andFilters.push({ attribute: { path: ["runId"], equals: input.runId } });
    }

    const existing = await prisma.memory.findFirst({
        where: { AND: andFilters },
    });

    if (existing) {
        return {
            memory: existing,
            isDuplicate: true,
            embeddingResults: [
                {
                    embedding: [],
                    vectorId: `memory_${existing.id}`,
                    hash: existing.contentHash,
                    success: true,
                    isDuplicate: true,
                    existingMemoryId: existing.id,
                },
            ],
        };
    }

    const memory = await prisma.memory.create({
        data: {
            userId: input.userId,
            source: input.source,
            sourceId: String(input.sourceId),
            timestamp: new Date(input.timestamp),
            contentUrl: input.contentUrl,
            title: input.title ?? "",
            origin: input.origin ?? "",
            tags: input.tags ?? [],
            category: input.category ?? [],
            attribute: {
                ...(input.attribute ?? {}),
                agentId: input.agentId,
                runId: input.runId,
                role: input.role,
            },
            summary: input.summary ?? "",
            type: input.type ?? "text",
            importance: input.importance ?? 0,
            confidence: input.confidence ?? 0,
            embeddingRef: 0,
            contentHash,
            createdAt: new Date(),
        },
    });

    const extractedFacts = await extractFacts(input.content, {
        title: input.title,
        source: input.source,
        timestamp: input.timestamp?.toString(),
    });

    if (extractedFacts.length === 0) {
        const updateMemoryNoFacts = await prisma.memory.update({
            where: { id: memory.id },
            data: { embeddingRef: memory.id },
        });

        return {
            memory: updateMemoryNoFacts,
            isDuplicate: false,
            embeddingResults: [],
            note: "No facts extracted; embedding skipped",
        };
    }

    const embeddingResults = await Promise.all(
        extractedFacts.map((fact, index) =>
            embeddingService.generateAndStore(
                fact.fact,
                `memory_${memory.id}_fact_${index}`,
                {
                    memoryId: memory.id,
                    userId: memory.userId,
                    source: memory.source,
                    sourceId: memory.sourceId,
                    timestamp: memory.timestamp.toISOString(),
                    agentId: input.agentId,
                    runId: input.runId,
                    role: input.role,
                    data: fact.fact,
                    hash: contentHash,
                    factIndex: index,
                    fact: fact.fact,
                    importance: fact.importance ?? input.importance ?? 0,
                    confidence: fact.confidence ?? input.confidence ?? 0,
                    contentHash,
                },
                memory.userId,
                false,
            ),
        ),
    );

    const updateMemory = await prisma.memory.update({
        where: {
            id: memory.id,
        },
        data: {
            embeddingRef: memory.id,
            summary: input.summary ?? extractedFacts[0]?.fact ?? "",
        },
    });

    return {
        memory: updateMemory,
        isDuplicate: false,
        embeddingResults,
    }
};

export const updateMemory = async (input: UpdateMemoryInput) => {
    const { id, content, ...rest } = input;

    if (!id) throw new Error("Memory id is required");

    const existing = await prisma.memory.findUnique({ where: { id } });
    if (!existing) throw new Error("Memory not found");

    const contentChanged = typeof content === "string";
    const contentHash = contentChanged ? generateContentHash(content) : undefined;

    const updated = await prisma.memory.update({
        where: { id },
        data: {
            ...rest,
            ...(contentChanged ? { content } : {}),
            ...(contentHash ? { contentHash } : {}),
            timestamp: rest.timestamp ? new Date(rest.timestamp) : undefined,
        },
    });

    if (!contentChanged) {
        return updated;
    }

    const extractedFacts = await extractFacts(content, {
        title: rest.title ?? existing.title,
        source: rest.source ?? existing.source,
        timestamp: (rest.timestamp ?? existing.timestamp)?.toString(),
    });

    if (extractedFacts.length === 0) {
        const updateMemoryNoFacts = await prisma.memory.update({
            where: { id },
            data: { embeddingRef: updated.id },
        });
        return updateMemoryNoFacts;
    }

    await Promise.all(
        extractedFacts.map((fact, index) =>
            embeddingService.generateAndStore(
                fact.fact,
                `memory_${id}_fact_${index}`,
                {
                    memoryId: id,
                    userId: updated.userId,
                    source: updated.source,
                    sourceId: updated.sourceId,
                    timestamp: updated.timestamp
                        ? updated.timestamp.toISOString()
                        : new Date().toISOString(),
                    agentId: updated.attribute?.agentId,
                    runId: updated.attribute?.runId,
                    role: updated.attribute?.role,
                    data: fact.fact,
                    hash: contentHash ?? updated.contentHash,
                    factIndex: index,
                    fact: fact.fact,
                    importance: fact.importance ?? updated.importance ?? 0,
                    confidence: fact.confidence ?? updated.confidence ?? 0,
                    contentHash: contentHash ?? updated.contentHash,
                },
                updated.userId,
                false,
            ),
        ),
    );

    const updatedWithEmbeddings = await prisma.memory.update({
        where: {
            id,
        },
        data: {
            embeddingRef: updated.id,
            summary: rest.summary ?? extractedFacts[0]?.fact ?? updated.summary,
        },
    });

    return updatedWithEmbeddings;
};

export const deleteMemory = async(id: number) => {
    if(!id) throw new Error("Memory id is required");
    return prisma.memory.delete({where: {id}});
};


export const getMemoryById = async (id: number) => {
    if (!id) throw new Error("Memory id is required");
    return prisma.memory.findUnique({ where: { id } });
  };
  
  export const getMemoriesByUser = async (userId: number) => {
    if (!userId) throw new Error("userId is required");
    return prisma.memory.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
    });
  };

export const addMemories = async (input: AddMemoryInput) => {
    const infer = input.infer ?? true;
    if (!input.userId) {
        throw new Error("userId is required to store memories");
    }

    const normalizedMessages = (input.messages ?? []).filter(
        (m) => m.content?.trim() && m.role !== "system",
    );

    if (normalizedMessages.length === 0) {
        return { memories: [], results: [], note: "No storable messages" };
    }

    const results: EmbeddingResult[] = [];
    const memories: unknown[] = [];

    for (const message of normalizedMessages) {
        const baseInput: CreateMemoryInput = {
            userId: input.userId,
            source: input.source,
            sourceId: input.sourceId,
            timestamp: input.timestamp,
            content: message.content,
            contentUrl: input.contentUrl,
            title: input.title,
            origin: input.origin,
            tags: input.tags,
            category: input.category,
            agentId: input.agentId,
            runId: input.runId,
            role: message.role,
            attribute: {
                ...(input.attribute ?? {}),
                agentId: input.agentId,
                runId: input.runId,
                role: message.role,
                metadata: input.metadata,
            },
            summary: input.summary,
            type: input.type,
            importance: input.importance,
            confidence: input.confidence,
        };

        if (infer) {
            const created = await createMemoryWithEmbedding(baseInput);
            memories.push(created.memory);
            results.push(...(created.embeddingResults as EmbeddingResult[]));
        } else {
            const contentHash = generateContentHash(message.content);
            const memory = await prisma.memory.create({
                data: {
                    userId: baseInput.userId,
                    source: baseInput.source,
                    sourceId: String(baseInput.sourceId),
                    timestamp: new Date(baseInput.timestamp),
                    contentUrl: baseInput.contentUrl,
                    title: baseInput.title ?? "",
                    origin: baseInput.origin ?? "",
                    tags: baseInput.tags ?? [],
                    category: baseInput.category ?? [],
                    attribute: baseInput.attribute ?? {},
                    summary: baseInput.summary ?? "",
                    type: baseInput.type ?? "text",
                    importance: baseInput.importance ?? 0,
                    confidence: baseInput.confidence ?? 0,
                    embeddingRef: 0,
                    contentHash,
                    createdAt: new Date(),
                },
            });

            const vectorId = `memory_${memory.id}`;
            const embeddingResult = await embeddingService.generateAndStore(
                message.content,
                vectorId,
                {
                    memoryId: memory.id,
                    userId: memory.userId,
                    source: memory.source,
                    sourceId: memory.sourceId,
                    timestamp: memory.timestamp.toISOString(),
                    agentId: input.agentId,
                    runId: input.runId,
                    role: message.role,
                    data: message.content,
                    hash: contentHash,
                    metadata: input.metadata,
                },
                memory.userId,
                false,
            );

            const updatedMemory = await prisma.memory.update({
                where: { id: memory.id },
                data: { embeddingRef: memory.id },
            });

            memories.push(updatedMemory);
            results.push(embeddingResult);
        }
    }

    return { memories, results };
};

const extractTextFromPayload = (payload: Record<string, unknown>)=> {
    const maybeStrings = [
        payload.fact,
        payload.data,
        payload.text,
        payload.content,
        payload.summary,
    ];

    const firstString = maybeStrings.find(
        (value) => typeof value === "string" && value.trim().length > 0,
    );

    if (typeof firstString === "string") {
        return firstString;
    }

    const stringified = JSON.stringify(payload);
    return stringified === "{}" ? "No payload text available" : stringified;
};

const formatMemoriesAsBullets = (memories: RetrievedMemory[])=> {
    if (!memories.length) {
        return "- No relevant memories found";
    }

    return memories
        .map((memory, index) => {
            const chosenScore = memory.rerankScore ?? memory.score;
            const score = Number.isFinite(chosenScore)
                ? chosenScore.toFixed(3)
                : "n/a";
            return `- [${index + 1}] (score: ${score}) ${memory.text}`;
        })
        .join("\n");
};

const rerankMemories = async (
    query: string,
    memories: RetrievedMemory[],
    options?: RerankOptions,
)=> {
    const enabled = options?.enabled ?? RERANK_ENABLED_DEFAULT;
    if (!enabled || memories.length === 0) {
        return memories;
    }

    const model = options?.model ?? RERANK_MODEL_DEFAULT;
    const topKEnv = options?.topK ?? RERANK_TOP_K_DEFAULT;
    const topK =
        Number.isFinite(topKEnv) && topKEnv > 0
            ? Math.min(topKEnv, memories.length)
            : memories.length;

    const client = openaiClient.getClient();
    const scored = await Promise.all(
        memories.map(async (memory) => {
            const completion = await client.chat.completions.create({
                model,
                temperature: 0,
                messages: [
                    { role: "system", content: RERANK_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: `Query: "${query}"\n\nDocument: "${memory.text}"`,
                    },
                ],
            });

            const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";
            const numeric = Number.parseFloat(raw);
            const rerankScore =
                Number.isFinite(numeric) && numeric >= 0 && numeric <= 1
                    ? numeric
                    : undefined;

            return { ...memory, rerankScore };
        }),
    );

    const sorted = scored
        .slice()
        .sort((a, b) => (b.rerankScore ?? -1) - (a.rerankScore ?? -1));

    return sorted.slice(0, topK);
};

export const searchMemories = async (
    input: MemorySearchInput,
)=> {
    if (!input.query?.trim()) {
        throw new Error("Query is required for memory search");
    }

    const results: SearchResult[] = await embeddingService.searchSimilar(
        input.query,
        {
            limit: input.limit,
            scoreThreshold: input.scoreThreshold,
            userId: input.userId,
            agentId: input.agentId,
            runId: input.runId,
        },
    );

    return results.map((result) => {
        const payload = (result.payload ?? {}) as Record<string, unknown>;
        const text = extractTextFromPayload(payload);
        return {
            id: result.id,
            score: result.score,
            text,
            payload,
        };
    });
};

export const askMemory = async (
    question: string,
    searchInput: GenerateAnswerInput,
) => {
    if (!question?.trim()) {
        throw new Error("Question is required");
    }

    const finalQuery = searchInput.query ?? question;
    const retrievedMemories = await searchMemories({
        ...searchInput,
        query: finalQuery,
    });

    const rerankedMemories = await rerankMemories(finalQuery, retrievedMemories, {
        enabled: searchInput.rerank?.enabled,
        topK: searchInput.rerank?.topK,
        model: searchInput.rerank?.model,
    });

    const formattedMemories = formatMemoriesAsBullets(rerankedMemories);

    const client = openaiClient.getClient();
    const completion = await client.chat.completions.create({
        model: ANSWER_MODEL,
        temperature: 0.2,
        messages: [
            { role: "system", content: MEMORY_ANSWER_SYSTEM_PROMPT },
            {
                role: "user",
                content: `Memories:\n${formattedMemories}\n\nUser question:\n${question}`,
            },
        ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() ?? "";

    return {
        answer,
        memories: rerankedMemories,
        model: ANSWER_MODEL,
        rerankModel: searchInput.rerank?.enabled
            ? searchInput.rerank?.model ?? RERANK_MODEL_DEFAULT
            : undefined,
    };
};