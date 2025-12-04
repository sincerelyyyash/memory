import type { Request, Response } from "express";
import { addMemorySchema, updateMemorySchema, deleteMemorySchema, getUserMemorySchema, getMemorySchema} from "../types/memory.types";


export const addMemory = async(req: Request, res: Response) => {
    const {success, data} = addMemorySchema.safeParse(req.body);

    if(!success || !data){
        return res.status(411).json({
            message: "Invalid input"
        })
    }

    try {
        
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

    }catch(err) {
        return res.status(500).json({
            message: "Intenal server error",
            error: (err as Error).message,
        })
    }
}

