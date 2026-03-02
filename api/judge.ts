import type { VercelRequest, VercelResponse } from "@vercel/node";
import { judgeOutput } from "./_lib/openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, candidate, reference } = req.body;

    if (!prompt || !candidate) {
      return res.status(400).json({ error: "Missing required fields: prompt, candidate" });
    }

    const result = await judgeOutput(prompt, candidate, reference);
    res.json(result);
  } catch (error: any) {
    console.error("Judge error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
