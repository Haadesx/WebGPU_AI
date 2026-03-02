/* ──────────────────────────────────────────────
 *  Shared types for the Edge AI Benchmark app
 * ────────────────────────────────────────────── */

// ── Workload ───────────────────────────────────
export interface WorkloadItem {
  id: string;
  category: string;
  prompt: string;
  expected?: Record<string, unknown>;
  scoring: "exact" | "numeric_tolerance" | "json_schema" | "regex" | "judge" | "embedding+judge";
  tolerance?: number;
  max_new_tokens?: number;
}

// ── System identifiers ─────────────────────────
export type SystemId = "edge" | "cloud_small" | "cloud_large";

// ── Per-prompt result ──────────────────────────
export interface PromptResult {
  promptId: string;
  system: SystemId;
  model: string;
  output: string;
  ttft_ms: number;
  tps: number;
  total_latency_ms: number;
  tokens_generated: number;
  tokens_generated_whitespace: number;
  prompt_tokens: number;
  memory_js_heap_mb: number;
  model_size_mb: number;
  quality_score: number;
  scoring_details: ScoringDetails;
  generation_settings: GenerationSettings;
  timestamp: string;
}

export interface ScoringDetails {
  method: string;
  objective_score?: number;
  embedding_score?: number;
  judge_score?: number;
  judge_reasons?: string[];
  raw_expected?: unknown;
  raw_output?: string;
}

export interface GenerationSettings {
  temperature: number;
  top_p: number;
  max_new_tokens: number;
}

// ── Run result ─────────────────────────────────
export interface RunResult {
  runIndex: number;
  device: DeviceMetadata;
  systems: SystemId[];
  results: PromptResult[];
  startedAt: string;
  completedAt: string;
}

// ── Device metadata ────────────────────────────
export interface DeviceMetadata {
  userAgent: string;
  platform: string;
  webgpuAdapter: string;
  webgpuSupported: boolean;
  timestamp: string;
}

// ── Summary row ────────────────────────────────
export interface SummaryRow {
  device: string;
  system: SystemId;
  model: string;
  avg_ttft_ms: number;
  avg_tps: number;
  p50_ttft_ms: number;
  p95_ttft_ms: number;
  avg_quality: number;
  avg_penalty_vs_large: number;
  avg_memory_mb: number;
  PQR: number;
  PQR2: number;
  total_prompts: number;
  total_runs: number;
}

// ── Engine interface ───────────────────────────
export interface InferenceResult {
  output: string;
  ttft_ms: number;
  tps: number;
  total_latency_ms: number;
  tokens_generated: number;
  tokens_generated_whitespace: number;
  prompt_tokens: number;
  memory_js_heap_mb: number;
  model_size_mb: number;
}

export interface InferenceEngine {
  id: SystemId;
  name: string;
  isReady: boolean;
  generate(
    prompt: string,
    settings: GenerationSettings,
    onToken?: (token: string) => void
  ): Promise<InferenceResult>;
}

// ── Progress state ─────────────────────────────
export interface BenchmarkProgress {
  phase: "idle" | "warmup" | "running" | "scoring" | "done" | "error";
  currentRun: number;
  totalRuns: number;
  currentPrompt: number;
  totalPrompts: number;
  currentSystem: SystemId | "";
  message: string;
}

// ── Model option ───────────────────────────────
export interface EdgeModelOption {
  id: string;
  label: string;
  sizeHint: string;
}

// ── WebLLM load progress ───────────────────────
export interface ModelLoadProgress {
  progress: number; // 0-1
  text: string;
}
