/* ──────────────────────────────────────────────
 *  Export results to JSON / CSV
 * ────────────────────────────────────────────── */

import type { RunResult, SummaryRow } from "../types";

export function exportRunJSON(runs: RunResult[]): string {
  return JSON.stringify(runs, null, 2);
}

export function exportSummaryCSV(rows: SummaryRow[]): string {
  if (rows.length === 0) return "";

  const headers = [
    "device", "system", "model",
    "avg_ttft_ms", "avg_tps", "p50_ttft_ms", "p95_ttft_ms",
    "avg_quality", "avg_penalty_vs_large", "avg_memory_mb",
    "PQR", "PQR2", "total_prompts", "total_runs",
  ];

  const csvRows = rows.map((r) =>
    headers.map((h) => {
      const val = (r as any)[h];
      if (typeof val === "string" && val.includes(",")) return `"${val}"`;
      return String(val ?? "");
    }).join(",")
  );

  return [headers.join(","), ...csvRows].join("\n");
}

export function exportPerPromptCSV(runs: RunResult[]): string {
  const headers = [
    "run", "promptId", "system", "model",
    "ttft_ms", "tps", "total_latency_ms",
    "tokens_generated", "prompt_tokens",
    "memory_js_heap_mb", "model_size_mb",
    "quality_score", "scoring_method",
    "output_preview", "timestamp",
  ];

  const rows: string[] = [headers.join(",")];

  for (const run of runs) {
    for (const r of run.results) {
      rows.push([
        run.runIndex,
        r.promptId,
        r.system,
        r.model,
        r.ttft_ms,
        r.tps,
        r.total_latency_ms,
        r.tokens_generated,
        r.prompt_tokens,
        r.memory_js_heap_mb,
        r.model_size_mb,
        r.quality_score,
        r.scoring_details.method,
        `"${r.output.slice(0, 80).replace(/"/g, '""')}"`,
        r.timestamp,
      ].join(","));
    }
  }

  return rows.join("\n");
}

export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJSON(runs: RunResult[]) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(exportRunJSON(runs), `run_${ts}.json`, "application/json");
}

export function downloadSummaryCSV(rows: SummaryRow[]) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(exportSummaryCSV(rows), `summary_${ts}.csv`, "text/csv");
}

export function downloadPerPromptCSV(runs: RunResult[]) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(exportPerPromptCSV(runs), `per_prompt_${ts}.csv`, "text/csv");
}
