import { Router, Request, Response } from "express";
import { judgeOutput } from "../providers/openai.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { prompt, candidate, reference } = req.body;

    if (!prompt || !candidate) {
      res.status(400).json({ error: "Missing required fields: prompt, candidate" });
      return;
    }

    const result = await judgeOutput(prompt, candidate, reference);
    res.json(result);
  } catch (error: any) {
    console.error("Judge error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
