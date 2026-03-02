/* ──────────────────────────────────────────────
 *  Cloud LLM engine — calls backend SSE proxy
 * ────────────────────────────────────────────── */

import type {
  InferenceEngine,
  InferenceResult,
  GenerationSettings,
  SystemId,
} from "../types";

export class CloudEngine implements InferenceEngine {
  id: SystemId;
  name: string;
  isReady = true;

  private modelTier: "small" | "large";

  constructor(tier: "small" | "large") {
    this.modelTier = tier;
    this.id = tier === "small" ? "cloud_small" : "cloud_large";
    this.name = tier === "small" ? "Cloud Small" : "Cloud Large";
  }

  async generate(
    prompt: string,
    settings: GenerationSettings,
    onToken?: (token: string) => void
  ): Promise<InferenceResult> {
    const t0 = performance.now();
    let firstTokenTime: number | null = null;
    let output = "";
    let tokenCount = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelTier: this.modelTier,
        prompt,
        max_tokens: settings.max_new_tokens,
        temperature: settings.temperature,
        top_p: settings.top_p,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cloud API error (${response.status}): ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          if (parsed.content) {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
            }
            output += parsed.content;
            tokenCount++;
            onToken?.(parsed.content);
          }

          if (parsed.usage) {
            promptTokens = parsed.usage.prompt_tokens ?? 0;
            completionTokens = parsed.usage.completion_tokens ?? 0;
          }
        } catch {
          /* skip malformed chunks */
        }
      }
    }

    const tEnd = performance.now();
    const ttft = firstTokenTime !== null ? firstTokenTime - t0 : tEnd - t0;
    const totalLatency = tEnd - t0;
    const generationTime = firstTokenTime !== null ? tEnd - firstTokenTime : 0;
    const tps = generationTime > 0 ? (tokenCount / (generationTime / 1000)) : 0;

    const whitespaceTokens = output.split(/\s+/).filter(Boolean).length;
    const promptTokensEst = prompt.split(/\s+/).length;

    return {
      output: output.trim(),
      ttft_ms: Math.round(ttft * 100) / 100,
      tps: Math.round(tps * 100) / 100,
      total_latency_ms: Math.round(totalLatency * 100) / 100,
      tokens_generated: completionTokens || tokenCount,
      tokens_generated_whitespace: whitespaceTokens,
      prompt_tokens: promptTokens || promptTokensEst,
      memory_js_heap_mb: 0,
      model_size_mb: 0,
    };
  }
}
