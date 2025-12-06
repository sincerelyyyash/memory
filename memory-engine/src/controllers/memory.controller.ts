import type { Request, Response } from "express";
import { addMemorySchema, updateMemorySchema, deleteMemorySchema, getUserMemorySchema, getMemorySchema, addMemoriesSchema, searchMemoriesSchema, generateAnswerSchema, askMemorySchema, type UpdateMemoryInput} from "../types/memory.types";
import { createMemoryWithEmbedding, updateMemory as updateMemoryService, deleteMemory as deleteMemoryService, getMemoryById, getMemoriesByUser, addMemories, searchMemories, askMemory as askMemoryService } from "../services/memory/memory.service";


export const addMemory = async(req: Request, res: Response) => {
    const {success, data} = addMemorySchema.safeParse(req.body);

    if(!success || !data){
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try {
        const tagsArray = data.metadata.tags ? data.metadata.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
        const result = await createMemoryWithEmbedding({
            userId: data.userId,
            source: data.source,
            sourceId: data.sourceId,
            timestamp: data.timestamp,
            content: data.content,
            contentUrl: data.metadata.others || "",
            title: data.metadata.title,
            origin: data.metadata.origin,
            tags: tagsArray,
            category: data.metadata.category,
        });
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const updateMemory = async(req: Request, res: Response) => {
    const {success, data} = updateMemorySchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const updateData: UpdateMemoryInput = {
            id: data.id,
        };
        if (data.userId !== undefined) updateData.userId = data.userId;
        if (data.source !== undefined) updateData.source = data.source;
        if (data.sourceId !== undefined) updateData.sourceId = data.sourceId;
        if (data.timestamp !== undefined) updateData.timestamp = data.timestamp;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.metadata) {
            if (data.metadata.title !== undefined) updateData.title = data.metadata.title;
            if (data.metadata.origin !== undefined) updateData.origin = data.metadata.origin;
            if (data.metadata.tags !== undefined) {
                updateData.tags = data.metadata.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
            }
            if (data.metadata.category !== undefined) updateData.category = data.metadata.category;
            if (data.metadata.others !== undefined) updateData.contentUrl = data.metadata.others;
        }
        const result = await updateMemoryService(updateData);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const deleteMemory = async(req: Request, res: Response) => {
    const {success, data} = deleteMemorySchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const result = await deleteMemoryService(data.id);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}


export const getMemory = async(req: Request, res: Response) => {
    const {success, data} = getMemorySchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const result = await getMemoryById(data.id);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const getUserMemory = async(req: Request, res: Response) => {
    const {success, data} = getUserMemorySchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const userId = Number(data.userId);
        if (isNaN(userId)) {
            return res.status(411).json({
                message: "Invalid userId"
            })
        }
        const result = await getMemoriesByUser(userId);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const addMemoriesController = async(req: Request, res: Response) => {
    const {success, data} = addMemoriesSchema.safeParse(req.body);

    if(!success || !data){
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try {
        const result = await addMemories(data);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const searchMemoriesController = async(req: Request, res: Response) => {
    const {success, data} = searchMemoriesSchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const result = await searchMemories(data);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const generateAnswer = async(req: Request, res: Response) => {
    const {success, data} = generateAnswerSchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const { question, ...searchInput } = data;
        const result = await askMemoryService(question, searchInput);
        return res.status(200).json(result);
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

export const askMemory = async(req: Request, res: Response) => {
    const {success, data} = askMemorySchema.safeParse(req.body);

    if(!success || !data) {
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try{
        const result = await askMemoryService(data.query, data);
        return res.status(200).json({
            answer: result.answer,
            memories: result.memories,
            count: result.memories.length,
            model: result.model,
            rerankModel: result.rerankModel,
        });
    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

