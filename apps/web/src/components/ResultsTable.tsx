import React, { useState } from "react";
import type { RunResult, SystemId } from "../types";

interface Props {
  runs: RunResult[];
}

const systemBadge = (s: SystemId) => {
  const cls: Record<SystemId, string> = {
    edge: "badge badge-edge",
    cloud_small: "badge badge-cloud-small",
    cloud_large: "badge badge-cloud-large",
  };
  const labels: Record<SystemId, string> = {
    edge: "Edge",
    cloud_small: "Cloud S",
    cloud_large: "Cloud L",
  };
  return <span className={cls[s]}>{labels[s]}</span>;
};

const qualBadge = (score: number) => {
  if (score >= 0.8) return "badge badge-ok";
  if (score >= 0.4) return "badge badge-warn";
  return "badge badge-fail";
};

const ResultsTable: React.FC<Props> = ({ runs }) => {
  const [selectedRun, setSelectedRun] = useState(0);

  if (runs.length === 0) {
    return (
      <div className="card section text-center text-muted" style={{ padding: 40 }}>
        No results yet. Run a benchmark to see per-prompt data.
      </div>
    );
  }

  const run = runs[selectedRun] ?? runs[0];
  if (!run) return null;

  // Group by promptId for side-by-side comparison
  const promptIds = [...new Set(run.results.map((r) => r.promptId))];

  return (
    <div className="section">
      <div className="flex justify-between items-center mb-16">
        <h2>📋 Per-Prompt Results</h2>
        {runs.length > 1 && (
          <select
            value={selectedRun}
            onChange={(e) => setSelectedRun(Number(e.target.value))}
          >
            {runs.map((_, i) => (
              <option key={i} value={i}>Run {i + 1}</option>
            ))}
          </select>
        )}
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Prompt</th>
              <th>System</th>
              <th>TTFT (ms)</th>
              <th>TPS</th>
              <th>Latency (ms)</th>
              <th>Tokens</th>
              <th>Quality</th>
              <th>Output (preview)</th>
            </tr>
          </thead>
          <tbody>
            {promptIds.map((pid) => {
              const items = run.results.filter((r) => r.promptId === pid);
              return items.map((r, i) => (
                <tr key={`${pid}-${r.system}-${i}`}>
                  {i === 0 ? (
                    <td rowSpan={items.length} style={{ fontWeight: 500, fontFamily: "var(--font-sans)" }}>
                      {pid}
                    </td>
                  ) : null}
                  <td>{systemBadge(r.system)}</td>
                  <td>{r.ttft_ms.toFixed(1)}</td>
                  <td>{r.tps.toFixed(1)}</td>
                  <td>{r.total_latency_ms.toFixed(0)}</td>
                  <td>{r.tokens_generated}</td>
                  <td>
                    <span className={qualBadge(r.quality_score)}>
                      {r.quality_score.toFixed(2)}
                    </span>
                  </td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.output.slice(0, 80)}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
