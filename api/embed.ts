import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createEmbedding } from "./_lib/openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing required field: text (string)" });
    }

    const embedding = await createEmbedding(text);
    res.json({ embedding });
  } catch (error: any) {
    console.error("Embed error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
