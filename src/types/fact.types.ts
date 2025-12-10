import {z } from "zod"

export const factSchema = z.object({
    fact: z.string().min(8),
    importance: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    tags: z.array(z.string()).optional(),
});

export const factsResponseSchema = z.object({
    facts: z.array(factSchema).max(32),
});

export type ExtractedFact = z.infer<typeof factSchema>;