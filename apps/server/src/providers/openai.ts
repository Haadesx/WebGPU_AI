import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      defaultHeaders: {
        // OpenRouter recommends these for better rate limits
        "HTTP-Referer": "https://edge-ai-benchmark.local",
        "X-Title": "Edge AI Benchmark",
      },
    });
  }
  return client;
}

export interface ChatRequest {
  modelTier: "small" | "large";
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface EmbedRequest {
  text: string;
}

export interface JudgeRequest {
  prompt: string;
  candidate: string;
  reference?: string;
}

export function getModelName(tier: "small" | "large"): string {
  if (tier === "small") {
    return process.env.CLOUD_MODEL_SMALL || "gpt-4o-mini";
  }
  return process.env.CLOUD_MODEL_LARGE || "gpt-4o";
}

export function getEmbedModel(): string {
  return process.env.EMBED_MODEL || "text-embedding-3-small";
}

/** Sleep helper for retry backoff */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry wrapper with exponential backoff for rate-limited APIs */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 4,
  baseDelayMs = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status ?? 0;
      const isRetryable = status === 429 || status === 502 || status === 503;

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.log(
        `  ⏳ ${label}: ${status} rate-limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})…`
      );
      await sleep(delay);
    }
  }
  throw new Error("withRetry exhausted");
}

export async function chatCompletion(req: ChatRequest) {
  const client = getClient();
  const model = getModelName(req.modelTier);

  if (req.stream) {
    return withRetry(
      async () => {
        const stream = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: req.prompt }],
          max_tokens: req.max_tokens ?? 256,
          temperature: req.temperature ?? 0,
          top_p: req.top_p ?? 1,
          stream: true,
          // Note: stream_options not supported by all providers (e.g. OpenRouter)
          // so we omit it and estimate token counts from chunks instead
        });
        return stream;
      },
      `chat/${req.modelTier}`
    );
  }

  return withRetry(
    async () => {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: req.prompt }],
        max_tokens: req.max_tokens ?? 256,
        temperature: req.temperature ?? 0,
        top_p: req.top_p ?? 1,
      });
      return response;
    },
    `chat/${req.modelTier}`
  );
}

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const model = getEmbedModel();

  try {
    const response = await withRetry(
      () => client.embeddings.create({ model, input: text }),
      "embed"
    );
    return response.data[0].embedding;
  } catch (err: any) {
    // OpenRouter free tier may not support embeddings — return empty
    console.warn("  ⚠ Embedding not available:", err.message);
    return [];
  }
}

export async function judgeOutput(
  prompt: string,
  candidate: string,
  reference?: string
): Promise<{ score: number; reasons: string[] }> {
  const client = getClient();
  const model = getModelName("large");

  const referenceSection = reference
    ? `\n\nReference answer (from a stronger model):\n${reference}`
    : "";

  const judgePrompt = `You are an expert evaluator. Score the following LLM output on three criteria, each from 0 to 1:
1. correctness / factuality (0-1)
2. instruction following (0-1)
3. clarity / coherence (0-1)

Original prompt:
${prompt}
${referenceSection}

Candidate output:
${candidate}

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{"correctness": <0-1>, "instruction_following": <0-1>, "clarity": <0-1>, "reasons": ["reason1", "reason2"]}`;

  try {
    const response = await withRetry(
      () =>
        client.chat.completions.create({
          model,
          messages: [{ role: "user", content: judgePrompt }],
          max_tokens: 300,
          temperature: 0,
          top_p: 1,
        }),
      "judge"
    );

    const content = response.choices[0]?.message?.content ?? "{}";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    const score =
      ((parsed.correctness ?? 0) +
        (parsed.instruction_following ?? 0) +
        (parsed.clarity ?? 0)) /
      3;
    return {
      score: Math.round(score * 1000) / 1000,
      reasons: parsed.reasons ?? [],
    };
  } catch (err: any) {
    console.warn("  ⚠ Judge call failed:", err.message);
    return { score: 0.5, reasons: ["Judge API unavailable: " + err.message] };
  }
}
