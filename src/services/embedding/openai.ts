import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

class OpenAIClient {
    private client: OpenAI | null = null;

    getClient(): OpenAI {
        if(this.client) {
            return this.client;
        }

        this.client = new OpenAI({
            apiKey: OPENAI_API_KEY
        });
        return this.client;
    }
}

export const openaiClient = new OpenAIClient();