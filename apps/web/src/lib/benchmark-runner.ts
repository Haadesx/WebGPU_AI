/* ──────────────────────────────────────────────
 *  Benchmark runner — orchestrates the full flow
 * ────────────────────────────────────────────── */

import type {
  WorkloadItem,
  PromptResult,
  RunResult,
  BenchmarkProgress,
  GenerationSettings,
  InferenceEngine,
  SystemId,
  SummaryRow,
} from "../types";
import { scoreItem } from "./scoring";
import { collectDeviceMetadata, mean, percentile } from "./metrics";

let _workload: WorkloadItem[] | null = null;

export async function getWorkload(): Promise<WorkloadItem[]> {
  if (_workload) return _workload;
  const res = await fetch("/workload.json");
  _workload = await res.json();
  return _workload!;
}

export { _workload as workload };

const DEFAULT_SETTINGS: GenerationSettings = {
  temperature: 0,
  top_p: 1,
  max_new_tokens: 256,
};

const WARMUP_PROMPTS = [
  "Return the word 'hello'.",
  "What is 2+2? Answer only the number.",
];

export class BenchmarkRunner {
  private engines: Map<SystemId, InferenceEngine> = new Map();
  private onProgress?: (p: BenchmarkProgress) => void;
  private aborted = false;

  registerEngine(engine: InferenceEngine) {
    this.engines.set(engine.id, engine);
  }

  setProgressCallback(cb: (p: BenchmarkProgress) => void) {
    this.onProgress = cb;
  }

  abort() {
    this.aborted = true;
  }

  private report(p: Partial<BenchmarkProgress>) {
    this.onProgress?.({
      phase: "idle",
      currentRun: 0,
      totalRuns: 0,
      currentPrompt: 0,
      totalPrompts: 0,
      currentSystem: "",
      message: "",
      ...p,
    });
  }

  async run(
    systems: SystemId[],
    runs: number = 3
  ): Promise<RunResult[]> {
    this.aborted = false;
    const allRuns: RunResult[] = [];
    const device = await collectDeviceMetadata();

    // Filter to engines that are actually ready
    const activeSystems = systems.filter((s) => {
      const engine = this.engines.get(s);
      return engine && engine.isReady;
    });

    if (activeSystems.length === 0) {
      throw new Error("No engines are ready. Load at least one model first.");
    }

    // ── Warmup ──
    this.report({ phase: "warmup", message: "Running warmup prompts…" });
    for (const sys of activeSystems) {
      const engine = this.engines.get(sys)!;
      for (const wp of WARMUP_PROMPTS) {
        if (this.aborted) return allRuns;
        try {
          await engine.generate(wp, { ...DEFAULT_SETTINGS, max_new_tokens: 32 });
        } catch (e) {
          console.warn(`Warmup failed for ${sys}:`, e);
        }
      }
    }

    // ── Main benchmark loop ──
    const workload = await getWorkload();
    const totalPrompts = workload.length;

    for (let r = 0; r < runs; r++) {
      if (this.aborted) break;

      const runResults: PromptResult[] = [];
      const startedAt = new Date().toISOString();

      for (let p = 0; p < totalPrompts; p++) {
        if (this.aborted) break;
        const item = workload[p]!;
        const settings: GenerationSettings = {
          ...DEFAULT_SETTINGS,
          max_new_tokens: item.max_new_tokens ?? DEFAULT_SETTINGS.max_new_tokens,
        };

        for (const sys of activeSystems) {
          if (this.aborted) break;
          const engine = this.engines.get(sys)!;

          this.report({
            phase: "running",
            currentRun: r + 1,
            totalRuns: runs,
            currentPrompt: p + 1,
            totalPrompts,
            currentSystem: sys,
            message: `Run ${r + 1}/${runs} • Prompt ${p + 1}/${totalPrompts} (${item.id}) • ${engine.name}`,
          });

          try {
            const result = await engine.generate(item.prompt, settings);

            runResults.push({
              promptId: item.id,
              system: sys,
              model: engine.name,
              output: result.output,
              ttft_ms: result.ttft_ms,
              tps: result.tps,
              total_latency_ms: result.total_latency_ms,
              tokens_generated: result.tokens_generated,
              tokens_generated_whitespace: result.tokens_generated_whitespace,
              prompt_tokens: result.prompt_tokens,
              memory_js_heap_mb: result.memory_js_heap_mb,
              model_size_mb: result.model_size_mb,
              quality_score: 0, // filled in scoring phase
              scoring_details: { method: item.scoring },
              generation_settings: settings,
              timestamp: new Date().toISOString(),
            });
          } catch (err: any) {
            console.error(`Error on ${item.id} / ${sys}:`, err);
            runResults.push({
              promptId: item.id,
              system: sys,
              model: engine.name,
              output: `[ERROR] ${err.message}`,
              ttft_ms: 0,
              tps: 0,
              total_latency_ms: 0,
              tokens_generated: 0,
              tokens_generated_whitespace: 0,
              prompt_tokens: 0,
              memory_js_heap_mb: 0,
              model_size_mb: 0,
              quality_score: 0,
              scoring_details: { method: "error" },
              generation_settings: settings,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // ── Scoring phase ──
      this.report({ phase: "scoring", message: `Scoring run ${r + 1}…` });

      // Collect cloud_large outputs as references for subjective scoring
      const largeOutputs = new Map<string, string>();
      for (const res of runResults) {
        if (res.system === "cloud_large") {
          largeOutputs.set(res.promptId, res.output);
        }
      }

      for (const res of runResults) {
        if (this.aborted) break;
        const item = workload.find((w: WorkloadItem) => w.id === res.promptId);
        if (!item) continue;

        const reference = largeOutputs.get(res.promptId);
        try {
          const details = await scoreItem(item, res.output, reference);
          res.scoring_details = details;
          res.quality_score = details.objective_score ?? 0;
        } catch (e) {
          console.warn(`Scoring failed for ${res.promptId}:`, e);
        }
      }

      allRuns.push({
        runIndex: r,
        device,
        systems: activeSystems,
        results: runResults,
        startedAt,
        completedAt: new Date().toISOString(),
      });
    }

    this.report({ phase: "done", message: "Benchmark complete!" });
    return allRuns;
  }
}

// ── Summary computation ────────────────────────

export function computeSummary(runs: RunResult[]): SummaryRow[] {
  if (runs.length === 0) return [];

  const device = runs[0].device;
  const systemResults = new Map<SystemId, PromptResult[]>();

  for (const run of runs) {
    for (const r of run.results) {
      if (!systemResults.has(r.system)) systemResults.set(r.system, []);
      systemResults.get(r.system)!.push(r);
    }
  }

  const rows: SummaryRow[] = [];
  let maxTPS = 0;

  // First pass: compute per-system averages
  const systemStats = new Map<SystemId, { tps: number; quality: number; ttft: number; mem: number }>();

  for (const [sys, results] of systemResults) {
    const tpsArr = results.map((r) => r.tps);
    const qualArr = results.map((r) => r.quality_score);
    const ttftArr = results.map((r) => r.ttft_ms);
    const memArr = results.map((r) => r.memory_js_heap_mb);

    const avgTPS = mean(tpsArr);
    maxTPS = Math.max(maxTPS, avgTPS);

    systemStats.set(sys, {
      tps: avgTPS,
      quality: mean(qualArr),
      ttft: mean(ttftArr),
      mem: mean(memArr),
    });
  }

  // Get cloud_large quality for penalty calculation
  const largeQuality = systemStats.get("cloud_large")?.quality ?? 0;

  // Second pass: build summary rows
  for (const [sys, results] of systemResults) {
    const stats = systemStats.get(sys)!;
    const ttftArr = results.map((r) => r.ttft_ms);

    const normalizedTPS = maxTPS > 0 ? stats.tps / maxTPS : 0;
    const PQR = normalizedTPS * stats.quality;
    const PQR2 = stats.quality / (stats.ttft / 1000 + 1e-6);
    const responsiveness = 1 / (1 + stats.ttft / 1000);
    const VSI = stats.quality * (0.7 * responsiveness + 0.3 * normalizedTPS);

    rows.push({
      device: `${device.platform} (${device.webgpuAdapter})`,
      system: sys,
      model: results[0]?.model ?? sys,
      avg_ttft_ms: round2(stats.ttft),
      avg_tps: round2(stats.tps),
      p50_ttft_ms: round2(percentile(ttftArr, 50)),
      p95_ttft_ms: round2(percentile(ttftArr, 95)),
      avg_quality: round3(stats.quality),
      avg_penalty_vs_large: round3(largeQuality - stats.quality),
      avg_memory_mb: round2(stats.mem),
      PQR: round3(PQR),
      PQR2: round3(PQR2),
      VSI: round3(VSI),
      total_prompts: results.length,
      total_runs: runs.length,
    });
  }

  return rows;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
