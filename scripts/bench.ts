#!/usr/bin/env npx tsx
/* ──────────────────────────────────────────────────────
 *  CLI Benchmark Runner
 *
 *  Runs cloud model benchmarks against the backend server.
 *  Edge (browser) benchmarks must be run from the web UI.
 *
 *  Usage:
 *    npm run bench -- --runs 3 --out results/
 *    npx tsx scripts/bench.ts --runs 1 --systems cloud_small
 * ────────────────────────────────────────────────────── */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── Parse CLI args ─────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const NUM_RUNS = parseInt(getArg("runs", "3"), 10);
const OUT_DIR = path.resolve(ROOT, getArg("out", "results"));
const SERVER_URL = getArg("server", "http://localhost:3001");
const SYSTEMS = getArg("systems", "cloud_small,cloud_large").split(",") as Array<"cloud_small" | "cloud_large">;

// ── Load workload ──────────────────────────────
interface WorkloadItem {
  id: string;
  category: string;
  prompt: string;
  expected?: Record<string, unknown>;
  scoring: string;
  tolerance?: number;
  max_new_tokens?: number;
}

const workload: WorkloadItem[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, "benchmarks/workload.json"), "utf-8")
);

// ── Types ──────────────────────────────────────
interface PromptResult {
  promptId: string;
  system: string;
  model: string;
  output: string;
  ttft_ms: number;
  tps: number;
  total_latency_ms: number;
  tokens_generated: number;
  tokens_generated_whitespace: number;
  prompt_tokens: number;
  quality_score: number;
  scoring_method: string;
  timestamp: string;
}

interface RunResult {
  runIndex: number;
  device: Record<string, string>;
  results: PromptResult[];
  startedAt: string;
  completedAt: string;
}

// ── Helpers ────────────────────────────────────
async function chatStream(
  modelTier: "small" | "large",
  prompt: string,
  maxTokens: number
): Promise<{
  output: string;
  ttft_ms: number;
  tps: number;
  total_latency_ms: number;
  tokens_generated: number;
  prompt_tokens: number;
}> {
  const t0 = performance.now();
  let firstTokenTime: number | null = null;
  let output = "";
  let tokenCount = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  const res = await fetch(`${SERVER_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelTier,
      prompt,
      max_tokens: maxTokens,
      temperature: 0,
      top_p: 1,
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);

  const reader = res.body!.getReader();
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
          if (firstTokenTime === null) firstTokenTime = performance.now();
          output += parsed.content;
          tokenCount++;
        }
        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens ?? 0;
          completionTokens = parsed.usage.completion_tokens ?? 0;
        }
      } catch { /* skip */ }
    }
  }

  const tEnd = performance.now();
  const ttft = firstTokenTime !== null ? firstTokenTime - t0 : tEnd - t0;
  const totalLatency = tEnd - t0;
  const genTime = firstTokenTime !== null ? tEnd - firstTokenTime : 0;
  const tps = genTime > 0 ? tokenCount / (genTime / 1000) : 0;

  return {
    output: output.trim(),
    ttft_ms: Math.round(ttft * 100) / 100,
    tps: Math.round(tps * 100) / 100,
    total_latency_ms: Math.round(totalLatency * 100) / 100,
    tokens_generated: completionTokens || tokenCount,
    prompt_tokens: promptTokens || prompt.split(/\s+/).length,
  };
}

// ── Objective scoring ──────────────────────────
function scoreObjective(item: WorkloadItem, output: string): number {
  if (!item.expected) return -1;

  const trimmed = output.trim();

  switch (item.scoring) {
    case "exact":
      return trimmed === String(item.expected.value).trim() ? 1 : 0;

    case "numeric_tolerance": {
      const nums = trimmed.match(/-?\d+\.?\d*/g);
      if (!nums) return 0;
      const target = Number(item.expected.value);
      for (const n of nums) {
        if (Math.abs(Number(n) - target) <= (item.tolerance ?? 0)) return 1;
      }
      return 0;
    }

    case "json_schema": {
      try {
        const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, trimmed];
        const text = jsonMatch[1] || trimmed;
        const brace = text.indexOf("{");
        if (brace < 0) return 0;
        const parsed = JSON.parse(text.slice(brace));
        return deepEqual(parsed, item.expected) ? 1 : 0;
      } catch {
        return 0;
      }
    }

    case "regex": {
      const patterns: string[] = Array.isArray(item.expected.regex)
        ? (item.expected.regex as string[])
        : [String(item.expected.regex)];
      for (const p of patterns) {
        try {
          if (new RegExp(p).test(trimmed)) return 1;
        } catch { /* skip */ }
      }
      if (item.expected.value && trimmed === String(item.expected.value).trim()) return 1;
      return 0;
    }

    default:
      return -1;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    if (a.length > 0 && typeof a[0] === "object") {
      const bCopy = [...b];
      for (const item of a) {
        const idx = bCopy.findIndex((bi) => deepEqual(item, bi));
        if (idx < 0) return false;
        bCopy.splice(idx, 1);
      }
      return true;
    }
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).sort();
    const bk = Object.keys(bo).sort();
    if (ak.length !== bk.length) return false;
    return ak.every((k, i) => k === bk[i] && deepEqual(ao[k], bo[k]));
  }
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  return String(a) === String(b);
}

// ── Subjective scoring via server ──────────────
async function scoreSubjective(
  item: WorkloadItem,
  output: string,
  reference?: string
): Promise<{ score: number; method: string }> {
  if (item.scoring === "judge" || item.scoring === "embedding+judge") {
    try {
      const judgeRes = await fetch(`${SERVER_URL}/api/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: item.prompt, candidate: output, reference }),
      });
      if (judgeRes.ok) {
        const j = await judgeRes.json();
        let score = j.score ?? 0.5;

        if (item.scoring === "embedding+judge" && reference) {
          try {
            const [embA, embB] = await Promise.all([
              fetch(`${SERVER_URL}/api/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: output }),
              }).then((r) => r.json()),
              fetch(`${SERVER_URL}/api/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: reference }),
              }).then((r) => r.json()),
            ]);
            const embSim = cosineSim(embA.embedding, embB.embedding);
            score = 0.5 * embSim + 0.5 * j.score;
          } catch { /* use judge only */ }
        }

        return { score: Math.round(score * 1000) / 1000, method: item.scoring };
      }
    } catch { /* fallback */ }
  }
  return { score: 0.5, method: "fallback" };
}

function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i];
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb);
  return d === 0 ? 0 : (dot / d + 1) / 2;
}

// ── Main ───────────────────────────────────────
async function main() {
  console.log("\n  🧪 Edge AI Benchmark — CLI Runner");
  console.log("  ─────────────────────────────────");
  console.log(`  Server:  ${SERVER_URL}`);
  console.log(`  Runs:    ${NUM_RUNS}`);
  console.log(`  Systems: ${SYSTEMS.join(", ")}`);
  console.log(`  Output:  ${OUT_DIR}`);
  console.log();

  // Check server health
  try {
    const health = await fetch(`${SERVER_URL}/api/health`).then((r) => r.json());
    if (!health.apiKeyConfigured) {
      console.error("  ❌ API key not configured. Set OPENAI_API_KEY in .env and restart server.");
      process.exit(1);
    }
    console.log(`  ✅ Server healthy (small=${health.cloudModelSmall}, large=${health.cloudModelLarge})`);
  } catch {
    console.error("  ❌ Cannot reach server. Run 'npm run server' first.");
    process.exit(1);
  }

  // Warmup
  console.log("\n  🔥 Warmup…");
  for (const tier of SYSTEMS) {
    const modelTier = tier === "cloud_small" ? "small" : "large";
    try {
      await chatStream(modelTier as "small" | "large", "Return the word 'hello'.", 16);
      console.log(`     ${tier}: ok`);
    } catch (e: any) {
      console.warn(`     ${tier}: warmup failed — ${e.message}`);
    }
  }

  const allRuns: RunResult[] = [];

  for (let r = 0; r < NUM_RUNS; r++) {
    console.log(`\n  📝 Run ${r + 1}/${NUM_RUNS}`);
    const startedAt = new Date().toISOString();
    const results: PromptResult[] = [];

    for (let p = 0; p < workload.length; p++) {
      const item = workload[p];
      const maxTokens = item.max_new_tokens ?? 256;

      for (const sys of SYSTEMS) {
        const modelTier = sys === "cloud_small" ? "small" : "large";
        process.stdout.write(`     [${p + 1}/${workload.length}] ${item.id} → ${sys}… `);

        try {
          const res = await chatStream(modelTier as "small" | "large", item.prompt, maxTokens);
          results.push({
            promptId: item.id,
            system: sys,
            model: sys,
            output: res.output,
            ttft_ms: res.ttft_ms,
            tps: res.tps,
            total_latency_ms: res.total_latency_ms,
            tokens_generated: res.tokens_generated,
            tokens_generated_whitespace: res.output.split(/\s+/).filter(Boolean).length,
            prompt_tokens: res.prompt_tokens,
            quality_score: 0,
            scoring_method: item.scoring,
            timestamp: new Date().toISOString(),
          });
          console.log(`✓ ${res.ttft_ms.toFixed(0)}ms TTFT, ${res.tps.toFixed(1)} TPS`);
        } catch (e: any) {
          console.log(`✗ ${e.message}`);
          results.push({
            promptId: item.id,
            system: sys,
            model: sys,
            output: `[ERROR] ${e.message}`,
            ttft_ms: 0, tps: 0, total_latency_ms: 0,
            tokens_generated: 0, tokens_generated_whitespace: 0, prompt_tokens: 0,
            quality_score: 0, scoring_method: "error",
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Score
    console.log("     📊 Scoring…");
    const largeOutputs = new Map<string, string>();
    for (const r of results) {
      if (r.system === "cloud_large") largeOutputs.set(r.promptId, r.output);
    }

    for (const res of results) {
      const item = workload.find((w) => w.id === res.promptId);
      if (!item) continue;

      const objScore = scoreObjective(item, res.output);
      if (objScore >= 0) {
        res.quality_score = objScore;
        res.scoring_method = item.scoring;
      } else {
        const reference = largeOutputs.get(res.promptId);
        const subj = await scoreSubjective(item, res.output, reference);
        res.quality_score = subj.score;
        res.scoring_method = subj.method;
      }
    }

    allRuns.push({
      runIndex: r,
      device: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
      results,
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  // ── Write results ──────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // JSON
  const jsonPath = path.join(OUT_DIR, `run_${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(allRuns, null, 2));
  console.log(`\n  📁 ${jsonPath}`);

  // Summary CSV
  const summaryRows = computeSummaryCSV(allRuns);
  const csvHeaders = [
    "device", "system", "avg_ttft_ms", "avg_tps", "p50_ttft_ms", "p95_ttft_ms",
    "avg_quality", "avg_penalty_vs_large", "PQR", "PQR2",
  ];
  const csvLines = [csvHeaders.join(",")];
  for (const row of summaryRows) {
    csvLines.push(csvHeaders.map((h) => String((row as any)[h] ?? "")).join(","));
  }
  const csvPath = path.join(OUT_DIR, `summary_${ts}.csv`);
  fs.writeFileSync(csvPath, csvLines.join("\n"));
  console.log(`  📁 ${csvPath}`);

  console.log("\n  ✅ Done!\n");
}

function computeSummaryCSV(runs: RunResult[]) {
  const bySystem = new Map<string, PromptResult[]>();
  for (const run of runs) {
    for (const r of run.results) {
      if (!bySystem.has(r.system)) bySystem.set(r.system, []);
      bySystem.get(r.system)!.push(r);
    }
  }

  const rows = [];
  let maxTPS = 0;
  const stats = new Map<string, { tps: number; quality: number; ttft: number }>();

  for (const [sys, results] of bySystem) {
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
    const tpsArr = results.map((r) => r.tps);
    const avgTPS = avg(tpsArr);
    maxTPS = Math.max(maxTPS, avgTPS);
    stats.set(sys, {
      tps: avgTPS,
      quality: avg(results.map((r) => r.quality_score)),
      ttft: avg(results.map((r) => r.ttft_ms)),
    });
  }

  const largeQ = stats.get("cloud_large")?.quality ?? 0;

  for (const [sys, results] of bySystem) {
    const s = stats.get(sys)!;
    const ttftArr = results.map((r) => r.ttft_ms).sort((a, b) => a - b);
    const p50 = ttftArr[Math.floor(ttftArr.length * 0.5)] ?? 0;
    const p95 = ttftArr[Math.floor(ttftArr.length * 0.95)] ?? 0;
    const normTPS = maxTPS > 0 ? s.tps / maxTPS : 0;

    rows.push({
      device: process.platform,
      system: sys,
      avg_ttft_ms: s.ttft.toFixed(2),
      avg_tps: s.tps.toFixed(2),
      p50_ttft_ms: p50.toFixed(2),
      p95_ttft_ms: p95.toFixed(2),
      avg_quality: s.quality.toFixed(3),
      avg_penalty_vs_large: (largeQ - s.quality).toFixed(3),
      PQR: (normTPS * s.quality).toFixed(3),
      PQR2: (s.quality / (s.ttft / 1000 + 1e-6)).toFixed(3),
    });
  }

  return rows;
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
