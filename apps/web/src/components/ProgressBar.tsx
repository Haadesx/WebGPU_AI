import React from "react";
import type { BenchmarkProgress } from "../types";

interface Props {
  progress: BenchmarkProgress;
}

const ProgressBar: React.FC<Props> = ({ progress }) => {
  if (progress.phase === "idle") return null;

  const total = progress.totalPrompts * progress.totalRuns;
  const done =
    (progress.currentRun - 1) * progress.totalPrompts + progress.currentPrompt;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const phaseLabel: Record<string, string> = {
    warmup: "🔥 Warming up…",
    running: "🏃 Running…",
    scoring: "📊 Scoring…",
    done: "✅ Complete",
    error: "❌ Error",
  };

  return (
    <div className="card section">
      <div className="flex justify-between items-center mb-8">
        <span className="text-sm">{phaseLabel[progress.phase] ?? progress.phase}</span>
        {progress.phase === "running" && (
          <span className="text-xs text-muted mono">{pct}%</span>
        )}
      </div>
      {progress.phase === "running" && (
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="text-xs text-secondary mt-4">{progress.message}</div>
    </div>
  );
};

export default ProgressBar;
