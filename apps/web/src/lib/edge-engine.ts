/* ──────────────────────────────────────────────
 *  Edge LLM engine — runs in-browser via WebLLM
 * ────────────────────────────────────────────── */

import {
  CreateMLCEngine,
  type MLCEngine,
  type InitProgressReport,
} from "@mlc-ai/web-llm";
import type {
  ChatMessage,
  InferenceEngine,
  InferenceResult,
  GenerationSettings,
  ModelLoadProgress,
  EdgeModelOption,
} from "../types";

/* Available models — update if WebLLM adds new ones */
export const EDGE_MODELS: EdgeModelOption[] = [
  {
    id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    label: "Llama 3.1 8B (4-bit)",
    sizeHint: "~4.3 GB",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi 3.5 Mini (4-bit)",
    sizeHint: "~2.2 GB",
  },
  {
    id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
    label: "TinyLlama 1.1B (4-bit)",
    sizeHint: "~0.6 GB",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 1.5B (4-bit)",
    sizeHint: "~0.9 GB",
  },
];

export class EdgeEngine implements InferenceEngine {
  id = "edge" as const;
  name = "Edge (WebGPU)";
  isReady = false;

  private engine: MLCEngine | null = null;
  private modelId: string = EDGE_MODELS[0].id;
  private modelSizeMB: number = 0;
  private onProgress?: (p: ModelLoadProgress) => void;

  setProgressCallback(cb: (p: ModelLoadProgress) => void) {
    this.onProgress = cb;
  }

  async load(modelId: string): Promise<void> {
    this.modelId = modelId;
    this.isReady = false;

    // Unload previous model if loaded
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch { /* ignore */ }
      this.engine = null;
    }

    const progressCb = (report: InitProgressReport) => {
      this.onProgress?.({
        progress: report.progress,
        text: report.text,
      });

      // Try to estimate model size from progress text
      const sizeMatch = report.text.match(/([\d.]+)\s*(MB|GB)/i);
      if (sizeMatch) {
        const val = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        this.modelSizeMB = unit === "GB" ? val * 1024 : val;
      }
    };

    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: progressCb,
    });

    this.isReady = true;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
    this.isReady = false;
  }

  async generate(
    prompt: string,
    settings: GenerationSettings,
    onToken?: (token: string) => void
  ): Promise<InferenceResult> {
    return this.chat([{ role: "user", content: prompt }], settings, onToken);
  }

  async chat(
    messages: ChatMessage[],
    settings: GenerationSettings,
    onToken?: (token: string) => void
  ): Promise<InferenceResult> {
    if (!this.engine) throw new Error("Edge engine not loaded");

    const memBefore = getJSHeapMB();
    const t0 = performance.now();
    let firstTokenTime: number | null = null;
    let output = "";
    let tokenCount = 0;

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: settings.temperature,
      top_p: settings.top_p,
      max_tokens: settings.max_new_tokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        if (firstTokenTime === null) {
          firstTokenTime = performance.now();
        }
        output += delta;
        tokenCount++;
        onToken?.(delta);
      }
    }

    const tEnd = performance.now();
    const ttft = firstTokenTime !== null ? firstTokenTime - t0 : tEnd - t0;
    const totalLatency = tEnd - t0;
    const generationTime = firstTokenTime !== null ? tEnd - firstTokenTime : 0;
    const tps = generationTime > 0 ? (tokenCount / (generationTime / 1000)) : 0;

    // Prompt token estimation (whitespace-split)
    const promptText = messages.map((message) => message.content).join(" ");
    const promptTokensEst = promptText.split(/\s+/).filter(Boolean).length;
    const whitespaceTokens = output.split(/\s+/).filter(Boolean).length;

    const memAfter = getJSHeapMB();

    return {
      output: output.trim(),
      ttft_ms: Math.round(ttft * 100) / 100,
      tps: Math.round(tps * 100) / 100,
      total_latency_ms: Math.round(totalLatency * 100) / 100,
      tokens_generated: tokenCount,
      tokens_generated_whitespace: whitespaceTokens,
      prompt_tokens: promptTokensEst,
      memory_js_heap_mb: Math.round(Math.max(memAfter, memBefore) * 100) / 100,
      model_size_mb: this.modelSizeMB,
    };
  }
}

function getJSHeapMB(): number {
  const mem = (performance as any).memory;
  if (mem && typeof mem.usedJSHeapSize === "number") {
    return mem.usedJSHeapSize / (1024 * 1024);
  }
  return 0;
}
