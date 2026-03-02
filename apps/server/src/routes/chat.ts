import { Router, Request, Response } from "express";
import { chatCompletion, ChatRequest } from "../providers/openai.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as ChatRequest;

    if (!body.prompt || !body.modelTier) {
      res.status(400).json({ error: "Missing required fields: prompt, modelTier" });
      return;
    }

    if (!["small", "large"].includes(body.modelTier)) {
      res.status(400).json({ error: "modelTier must be 'small' or 'large'" });
      return;
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
        // Reasoning models (GPT-OSS etc.) put output in reasoning_content instead of content
        const content = delta?.content || delta?.reasoning_content || delta?.reasoning || "";

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
      // Handle both regular and reasoning model responses
      const content = message?.content || message?.reasoning_content || message?.reasoning || "";
      res.json({
        content,
        usage: result.usage ?? null,
      });
    }
  } catch (error: any) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
