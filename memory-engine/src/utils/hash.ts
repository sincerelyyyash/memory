import crypto from "crypto";

export const normaliseText = (text: string) => {
    return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\t+/g, " ")
}

export const generateContentHash = (text:string) => {
    if(!text || typeof text !== "string"){
        throw new Error("text must be non empty string")
    }

    const normalised = normaliseText(text);

    if (normalised.length === 0){
        throw new Error("Text cannot be empty after normalzation");
    }
    return crypto.createHash("sha256").update(normalised).digest("hex");
}

export const isValidHash = (hash: string) => {
    return typeof hash === "string" && /^[a-f0-9]{64}$/i.test(hash)
}