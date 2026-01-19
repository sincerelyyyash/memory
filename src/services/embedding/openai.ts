import { OpenRouter } from "@openrouter/sdk";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

class LLMClient {
    private client: OpenRouter | null = null;

    getClient(): OpenRouter {
        if(this.client) {
            return this.client;
        }

        this.client = new OpenRouter({
            apiKey: OPENROUTER_API_KEY
        });
        return this.client;
    }
}

export const openaiClient = new LLMClient();