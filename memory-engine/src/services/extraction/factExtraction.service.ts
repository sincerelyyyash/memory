import { openaiClient } from "../embedding/openai";
import { factSchema, factsResponseSchema } from "../../types/fact.types";



const buildPrompt = (
    content: string,
    context?: {
        title?: string;
        source?: string;
        timestamp?: string;
    },
) => `
You are an expert fact extractor. Return only concise, self-contained facts that are directly supported by the content.
Output strictly as JSON: { "facts": [ { "fact": "...", "importance": 0-1, "confidence": 0-1, "tags": ["optional","tags"] } ] }
- Facts must be atomic, declarative, and <= 240 characters.
- No opinions, advice, speculation, instructions, greetings, or boilerplate.
- Avoid duplicates; keep only distinct, recall-worthy facts.

Context:
title: ${context?.title ?? "n/a"}
source: ${context?.source ?? "n/a"}
timestamp: ${context?.timestamp ?? "n/a"}

Content:
${content}
`;

export const extractFacts = async (
    content: string,
    context?: { title?: string; source?: string; timestamp?: string },
) => {
    if (!content?.trim()) {
        throw new Error("Content is empty");
    }

    const client = openaiClient.getClient();
 
    const completion = await client.chat.completions.create({
        model: process.env.FACT_MODEL ?? "gpt-4o-mini",
        messages: [
            { role: "system", content: "You extract concise, verifiable facts. Respond ONLY with strict JSON. Avoid opinions, advice, speculation, instructions, greetings, and duplicates. Each fact must be self-contained, <=240 characters, and phrased as a declarative statement grounded solely in the provided content." },
            { role: "user", content: buildPrompt(content, context) },
        ],
        temperature: 0.0,
        max_tokens: 600,
        response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Failed to parse fact extraction response");
    }

    const result = factsResponseSchema.parse(parsed);
    return result.facts;
};

