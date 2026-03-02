import React from "react";
import type { SummaryRow } from "../types";

interface Props {
  rows: SummaryRow[];
}

const SummaryCards: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) return null;

  return (
    <div className="section">
      <h2>📊 Summary</h2>

      {/* ── Stat cards for each system ── */}
      {rows.map((row) => (
        <div key={row.system} className="mb-16">
          <h3 className="mb-8 flex items-center gap-8">
            <span className={`badge badge-${row.system === "edge" ? "edge" : row.system === "cloud_small" ? "cloud-small" : "cloud-large"}`}>
              {row.system === "edge" ? "Edge" : row.system === "cloud_small" ? "Cloud Small" : "Cloud Large"}
            </span>
            <span className="text-xs text-muted">{row.model}</span>
          </h3>

          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-label">Avg TTFT</div>
              <div className="stat-value">{row.avg_ttft_ms.toFixed(0)}</div>
              <div className="stat-label">ms</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg TPS</div>
              <div className="stat-value">{row.avg_tps.toFixed(1)}</div>
              <div className="stat-label">tok/s</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Quality</div>
              <div className="stat-value" style={{
                color: row.avg_quality >= 0.7 ? "var(--accent-green)"
                     : row.avg_quality >= 0.4 ? "var(--accent-orange)"
                     : "var(--accent-red)"
              }}>
                {row.avg_quality.toFixed(3)}
              </div>
              <div className="stat-label">0–1</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">PQR</div>
              <div className="stat-value">{row.PQR.toFixed(3)}</div>
              <div className="stat-label">perf×qual</div>
            </div>
          </div>

          <div className="grid-4 mt-8">
            <div className="stat-card">
              <div className="stat-label">P50 TTFT</div>
              <div className="stat-value">{row.p50_ttft_ms.toFixed(0)}</div>
              <div className="stat-label">ms</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">P95 TTFT</div>
              <div className="stat-value">{row.p95_ttft_ms.toFixed(0)}</div>
              <div className="stat-label">ms</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Quality Penalty</div>
              <div className="stat-value" style={{
                color: row.avg_penalty_vs_large > 0.1 ? "var(--accent-red)"
                     : row.avg_penalty_vs_large > 0 ? "var(--accent-orange)"
                     : "var(--accent-green)"
              }}>
                {row.avg_penalty_vs_large > 0 ? "−" : ""}{Math.abs(row.avg_penalty_vs_large).toFixed(3)}
              </div>
              <div className="stat-label">vs large</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">PQR2</div>
              <div className="stat-value">{row.PQR2.toFixed(1)}</div>
              <div className="stat-label">qual/ttft</div>
            </div>
          </div>

          {row.avg_memory_mb > 0 && (
            <div className="grid-4 mt-8">
              <div className="stat-card">
                <div className="stat-label">Avg Memory</div>
                <div className="stat-value">{row.avg_memory_mb.toFixed(0)}</div>
                <div className="stat-label">MB (JS heap)</div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Summary table ── */}
      <div className="overflow-x mt-16">
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Avg TTFT</th>
              <th>Avg TPS</th>
              <th>P50 TTFT</th>
              <th>P95 TTFT</th>
              <th>Quality</th>
              <th>Penalty</th>
              <th>PQR</th>
              <th>PQR2</th>
              <th>Memory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.system}>
                <td style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>{r.system}</td>
                <td>{r.avg_ttft_ms.toFixed(1)}</td>
                <td>{r.avg_tps.toFixed(1)}</td>
                <td>{r.p50_ttft_ms.toFixed(1)}</td>
                <td>{r.p95_ttft_ms.toFixed(1)}</td>
                <td>{r.avg_quality.toFixed(3)}</td>
                <td>{r.avg_penalty_vs_large.toFixed(3)}</td>
                <td>{r.PQR.toFixed(3)}</td>
                <td>{r.PQR2.toFixed(1)}</td>
                <td>{r.avg_memory_mb > 0 ? `${r.avg_memory_mb.toFixed(0)} MB` : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SummaryCards;
