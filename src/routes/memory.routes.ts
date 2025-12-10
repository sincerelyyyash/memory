import Router from "express";

import {
    addMemory,
    updateMemory,
    deleteMemory,
    getMemory,
    getUserMemory,
    addMemoriesController,
    searchMemoriesController,
    generateAnswer,
    askMemory,
} from "../controllers/memory.controller";

const router = Router();

router.route("/memory").post(addMemory);
router.route("/memory").put(updateMemory);
router.route("/memory").delete(deleteMemory);
router.route("/memory").get(getMemory);
router.route("/memory/user").get(getUserMemory);
router.route("/memories").post(addMemoriesController);
router.route("/memories/search").post(searchMemoriesController);
router.route("/memories/answer").post(generateAnswer);
router.route("/memories/ask").post(askMemory);

export default router;

