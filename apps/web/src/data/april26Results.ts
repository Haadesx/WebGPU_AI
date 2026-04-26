export interface April26SummaryRow {
  run: string;
  system: string;
  type: "edge" | "cloud";
  quality: number;
  ttft: number;
  p95: number;
  tps: number;
  latency: number;
  memory: number;
  modelSize: number;
  vsi: number;
  prompts: number;
}

export interface April26CategoryRow {
  model: string;
  math: number;
  json: number;
  extraction: number;
  code: number;
  reasoning: number;
  instruction: number;
  summarization: number;
  factual: number;
}

export const april26SummaryRows: April26SummaryRow[] = [
  { run: "TinyLlama 1.1B", system: "TinyLlama 1.1B", type: "edge", quality: 0.231, ttft: 90.6, p95: 110.5, tps: 59.8, latency: 971.5, memory: 126.6, modelSize: 591, vsi: 0.218, prompts: 16 },
  { run: "TinyLlama 1.1B", system: "Cloud Small", type: "cloud", quality: 0.940, ttft: 2397.8, p95: 7430.7, tps: 26.5, latency: 4390.0, memory: 0, modelSize: 0, vsi: 0.318, prompts: 16 },
  { run: "TinyLlama 1.1B", system: "Cloud Large", type: "cloud", quality: 0.902, ttft: 899.3, p95: 1208.2, tps: 26.4, latency: 2812.4, memory: 0, modelSize: 0, vsi: 0.452, prompts: 16 },
  { run: "Llama 3.1 8B", system: "Llama 3.1 8B", type: "edge", quality: 0.816, ttft: 309.6, p95: 353.4, tps: 23.8, latency: 2536.3, memory: 566.7, modelSize: 4309, vsi: 0.587, prompts: 16 },
  { run: "Llama 3.1 8B", system: "Cloud Small", type: "cloud", quality: 0.953, ttft: 38930.3, p95: 4435.1, tps: 38.5, latency: 40316.2, memory: 0, modelSize: 0, vsi: 0.302, prompts: 16 },
  { run: "Llama 3.1 8B", system: "Cloud Large", type: "cloud", quality: 0.885, ttft: 1019.4, p95: 1647.4, tps: 25.5, latency: 2710.6, memory: 0, modelSize: 0, vsi: 0.483, prompts: 16 },
  { run: "Qwen 2.5 1.5B", system: "Qwen 2.5 1.5B", type: "edge", quality: 0.645, ttft: 113.0, p95: 124.4, tps: 44.5, latency: 938.4, memory: 286.5, modelSize: 829, vsi: 0.599, prompts: 16 },
  { run: "Qwen 2.5 1.5B", system: "Cloud Small", type: "cloud", quality: 0.956, ttft: 1909.1, p95: 4150.8, tps: 26.8, latency: 3734.0, memory: 0, modelSize: 0, vsi: 0.403, prompts: 16 },
  { run: "Phi 3.5 Mini", system: "Phi 3.5 Mini", type: "edge", quality: 0.551, ttft: 183.8, p95: 212.1, tps: 40.2, latency: 1448.3, memory: 155.1, modelSize: 2051, vsi: 0.491, prompts: 16 },
  { run: "Phi 3.5 Mini", system: "Cloud Small", type: "cloud", quality: 0.900, ttft: 725.9, p95: 937.4, tps: 34.5, latency: 2258.0, memory: 0, modelSize: 0, vsi: 0.597, prompts: 16 },
];

export const april26CategoryRows: April26CategoryRow[] = [
  { model: "TinyLlama 1.1B", math: 0.000, json: 0.000, extraction: 0.500, code: 0.500, reasoning: 0.092, instruction: 0.500, summarization: 0.334, factual: 0.000 },
  { model: "Llama 3.1 8B", math: 1.000, json: 0.500, extraction: 1.000, code: 1.000, reasoning: 0.887, instruction: 0.500, summarization: 0.500, factual: 1.000 },
  { model: "Qwen 2.5 1.5B", math: 0.500, json: 1.000, extraction: 1.000, code: 0.500, reasoning: 0.492, instruction: 1.000, summarization: 0.350, factual: 0.000 },
  { model: "Phi 3.5 Mini", math: 0.500, json: 1.000, extraction: 1.000, code: 0.500, reasoning: 0.350, instruction: 0.500, summarization: 0.417, factual: 0.000 },
];

export const april26Meta = {
  date: "April 26, 2026",
  promptCount: 16,
  device: "Chrome 147, WebGPU adapter: apple, platform: MacIntel",
  files: [
    "results/Tiny_llama_26thApril.json",
    "results/Llama3,1-8B_26thApril.json",
    "results/Qwen2.5_26thApril.json",
    "results/Phi_26thApril.json",
  ],
};
