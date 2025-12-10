import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL ?? "";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? "";
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME ?? process.env.COLLECTION_NAME ?? "";
const EMBEDDING_DIMENSION = Number(process.env.EMBEDDING_DIMENSION ?? 1536); 

class Qdrant {
    private client: QdrantClient | null = null;
    private isInitialised = false;
    
    private initialiseClient(): QdrantClient {
        if(this.client){
            return this.client;
        }
    

    const config: {
        url: string,
        apiKey?: string 
    } = {
        url : QDRANT_URL,
        apiKey: QDRANT_API_KEY
    };


    this.client = new QdrantClient(config);
    return this.client   
}

async ensureCollection(){
    if (this.isInitialised) {
        return;
    }
    
    const client = this.initialiseClient();
    const collectionName = COLLECTION_NAME;

    try {
        const collections = await client.getCollections()
        const collectionExists = collections.collections.some(
            (col) => col.name === collectionName
        );

        if (!collectionExists) {
            await client.createCollection(collectionName, {
                vectors: {
                    size: EMBEDDING_DIMENSION,
                    distance: "Cosine",
                }
            });
            console.log("Qdrant collection created")
        }else {
            console.log("Qdrant collection already exists")
        }
    }catch(err) {
        throw new Error("Failed to init qdrant collection")
    }
}

getClient(): QdrantClient {
    if(!this.client) {
        return this.initialiseClient();
    }
    return this.client;
}
}

export const qdrantClient = new Qdrant();