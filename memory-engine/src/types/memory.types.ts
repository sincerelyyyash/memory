import {optional, z} from "zod";

export const addMemorySchema = z.object({
    userId: z.number(),
    source: z.string(),
    sourceId: z.string(),
    timestamp: z.coerce.date(),
    content: z.string(),
    metadata: {
        title: z.string().optional(),
        origin: z.string().optional(),
        tags: z.string(),
        category: z.array(z.string()),
        others: z.string().optional()
    }
})


export const updateMemorySchema = z.object({
    id: z.number(),
    userId: z.number().optional(),
    source: z.string().optional(),
    sourceId: z.string().optional(),
    timestamp: z.coerce.date().optional(),
    content: z.string().optional(),
    metadata: {
        title: z.string().optional(),
        origin: z.string().optional(),
        tags: z.string().optional(),
        category: z.array(z.string()).optional(),
        others: z.string().optional()
    }
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
})   