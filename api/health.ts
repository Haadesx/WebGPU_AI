import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const hasKey =
    !!process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== "sk-REPLACE_ME";

  res.json({
    status: "ok",
    apiKeyConfigured: hasKey,
    cloudModelSmall: process.env.CLOUD_MODEL_SMALL || "gpt-4o-mini",
    cloudModelLarge: process.env.CLOUD_MODEL_LARGE || "gpt-4o",
    embedModel: process.env.EMBED_MODEL || "text-embedding-3-small",
  });
}
