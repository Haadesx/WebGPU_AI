import type { VercelRequest, VercelResponse } from "@vercel/node";
import { chatCompletion, type ChatRequest } from "./_lib/openai";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as ChatRequest;

    if (!body.prompt || !body.modelTier) {
      return res.status(400).json({ error: "Missing required fields: prompt, modelTier" });
    }

    if (!["small", "large"].includes(body.modelTier)) {
      return res.status(400).json({ error: "modelTier must be 'small' or 'large'" });
    }

    if (body.stream) {
      // Server-Sent Events for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const stream = await chatCompletion(body);
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of stream as any) {
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? 0;
          completionTokens = chunk.usage.completion_tokens ?? 0;
        }

        const delta = chunk.choices?.[0]?.delta;
        // Reasoning models (GPT-OSS etc.) put output in reasoning_content
        const content =
          delta?.content || delta?.reasoning_content || delta?.reasoning || "";

        const data = {
          content,
          finish_reason: chunk.choices?.[0]?.finish_reason ?? null,
          usage: chunk.usage
            ? { prompt_tokens: promptTokens, completion_tokens: completionTokens }
            : undefined,
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } else {
      const response = await chatCompletion(body);
      const result = response as any;
      const message = result.choices[0]?.message;
      const content =
        message?.content || message?.reasoning_content || message?.reasoning || "";
      res.json({
        content,
        usage: result.usage ?? null,
      });
    }
  } catch (error: any) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
