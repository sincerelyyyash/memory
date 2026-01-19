import OpenAI from "openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

class LLMClient {
    private client: OpenAI | null = null;

    getClient(): OpenAI {
        if(this.client) {
            return this.client;
        }

        this.client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: OPENROUTER_API_KEY,
        });
        return this.client;
    }
}

export const openaiClient = new LLMClient();