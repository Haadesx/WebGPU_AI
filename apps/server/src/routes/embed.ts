import { Router, Request, Response } from "express";
import { createEmbedding } from "../providers/openai.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing required field: text (string)" });
      return;
    }

    const embedding = await createEmbedding(text);
    res.json({ embedding });
  } catch (error: any) {
    console.error("Embed error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
