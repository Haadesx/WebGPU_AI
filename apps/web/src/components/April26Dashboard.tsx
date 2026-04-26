import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  april26CategoryRows,
  april26Meta,
  april26SummaryRows,
  type April26CategoryRow,
  type April26SummaryRow,
} from "../data/april26Results";

const edgeRows = april26SummaryRows
  .filter((row) => row.type === "edge")
  .sort((a, b) => b.vsi - a.vsi);

const cloudRows = april26SummaryRows.filter((row) => row.type === "cloud");

const colors: Record<string, string> = {
  "Qwen 2.5 1.5B": "#4f8ff7",
  "Llama 3.1 8B": "#3dd68c",
  "Phi 3.5 Mini": "#f7a94f",
  "TinyLlama 1.1B": "#f75f5f",
  "Cloud Small": "#8b8fa8",
  "Cloud Large": "#a177f7",
};

const categories: Array<{ key: keyof April26CategoryRow; label: string }> = [
  { key: "math", label: "Math" },
  { key: "json", label: "JSON" },
  { key: "extraction", label: "Extract" },
  { key: "code", label: "Code" },
  { key: "reasoning", label: "Reason" },
  { key: "instruction", label: "Follow" },
  { key: "summarization", label: "Summ." },
  { key: "factual", label: "Privacy" },
];

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function fmtMs(value: number) {
  return value >= 10000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function bestBy<K extends keyof April26SummaryRow>(key: K, lowerIsBetter = false) {
  return [...edgeRows].sort((a, b) => {
    const av = Number(a[key]);
    const bv = Number(b[key]);
    return lowerIsBetter ? av - bv : bv - av;
  })[0];
}

function HeatCell({ value }: { value: number }) {
  const hue = value >= 0.8 ? "green" : value >= 0.5 ? "orange" : "red";
  return (
    <td>
      <div className={`heat-cell heat-${hue}`} style={{ opacity: 0.35 + value * 0.65 }}>
        {pct(value)}
      </div>
    </td>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as April26SummaryRow;
  return (
    <div className="dash-tooltip">
      <strong>{row.system}</strong>
      <div>Quality: {row.quality.toFixed(3)}</div>
      <div>TTFT: {fmtMs(row.ttft)}</div>
      <div>TPS: {row.tps.toFixed(1)}</div>
      <div>VSI: {row.vsi.toFixed(3)}</div>
    </div>
  );
}

const April26Dashboard: React.FC = () => {
  const bestVsi = bestBy("vsi");
  const bestQuality = bestBy("quality");
  const fastest = bestBy("ttft", true);
  const fastestTps = bestBy("tps");
  const avgCloudQuality = cloudRows.reduce((s, r) => s + r.quality, 0) / cloudRows.length;
  const avgEdgeQuality = edgeRows.reduce((s, r) => s + r.quality, 0) / edgeRows.length;

  const tradeoffRows = edgeRows.map((row) => ({
    ...row,
    qualityPct: Number((row.quality * 100).toFixed(1)),
    vsiPct: Number((row.vsi * 100).toFixed(1)),
  }));

  const cloudComparisonRows = edgeRows.map((edge) => {
    const matchingCloud = april26SummaryRows
      .filter((row) => row.run === edge.run && row.type === "cloud")
      .sort((a, b) => b.quality - a.quality)[0];
    return {
      model: edge.system,
      Edge: Number((edge.vsi * 100).toFixed(1)),
      Cloud: matchingCloud ? Number((matchingCloud.vsi * 100).toFixed(1)) : 0,
    };
  });

  return (
    <div className="april-dashboard">
      <section className="dash-hero">
        <div>
          <div className="dash-eyebrow">April 26 benchmark snapshot</div>
          <h2>Are local WebGPU LLMs viable?</h2>
          <p>
            Local models win responsiveness. Cloud models still lead average quality.
            Qwen and Llama are the most practical edge candidates in this run.
          </p>
        </div>
        <div className="dash-hero-metrics">
          <div>
            <span>Best VSI</span>
            <strong>{bestVsi.system}</strong>
            <em>{bestVsi.vsi.toFixed(3)}</em>
          </div>
          <div>
            <span>Best Quality</span>
            <strong>{bestQuality.system}</strong>
            <em>{pct(bestQuality.quality)}</em>
          </div>
          <div>
            <span>Lowest TTFT</span>
            <strong>{fastest.system}</strong>
            <em>{fmtMs(fastest.ttft)}</em>
          </div>
        </div>
      </section>

      <section className="dash-kpi-grid">
        <div className="dash-kpi">
          <span>Edge Avg Quality</span>
          <strong>{pct(avgEdgeQuality)}</strong>
          <small>Across 4 local WebGPU models</small>
        </div>
        <div className="dash-kpi">
          <span>Cloud Avg Quality</span>
          <strong>{pct(avgCloudQuality)}</strong>
          <small>Across available cloud baselines</small>
        </div>
        <div className="dash-kpi">
          <span>Fastest Generation</span>
          <strong>{fastestTps.tps.toFixed(1)} TPS</strong>
          <small>{fastestTps.system}</small>
        </div>
        <div className="dash-kpi">
          <span>Test Shape</span>
          <strong>{april26Meta.promptCount} prompts</strong>
          <small>{april26Meta.date}</small>
        </div>
      </section>

      <section className="grid-2 section">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <h3>Edge Viability Ranking</h3>
            <span>VSI × 100</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tradeoffRows} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis type="category" dataKey="system" width={112} tick={{ fill: "#cdd1e6", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="vsiPct" radius={[0, 6, 6, 0]}>
                {tradeoffRows.map((row) => (
                  <Cell key={row.system} fill={colors[row.system]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <h3>Quality vs First Token</h3>
            <span>Upper-left is better</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="ttft" name="TTFT" unit="ms" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis dataKey="qualityPct" name="Quality" unit="%" domain={[0, 100]} tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={tradeoffRows}>
                {tradeoffRows.map((row) => (
                  <Cell key={row.system} fill={colors[row.system]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2 section">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <h3>Quality and Throughput</h3>
            <span>Bars: quality, line: TPS</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={tradeoffRows} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="system" tick={{ fill: "#8b8fa8", fontSize: 11 }} />
              <YAxis yAxisId="left" domain={[0, 100]} tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="qualityPct" radius={[6, 6, 0, 0]} fill="#3dd68c" />
              <Line yAxisId="right" type="monotone" dataKey="tps" stroke="#f7a94f" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <h3>Edge vs Cloud Practicality</h3>
            <span>VSI × 100 by run</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cloudComparisonRows} margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="model" tick={{ fill: "#8b8fa8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="Edge" fill="#4f8ff7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Cloud" fill="#a177f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dash-panel section">
        <div className="dash-panel-head">
          <h3>Edge Quality by Task Type</h3>
          <span>Higher is better</span>
        </div>
        <div className="heat-table-wrap">
          <table className="heat-table">
            <thead>
              <tr>
                <th>Model</th>
                {categories.map((category) => (
                  <th key={category.key}>{category.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {april26CategoryRows.map((row) => (
                <tr key={row.model}>
                  <td>{row.model}</td>
                  {categories.map((category) => (
                    <HeatCell key={category.key} value={Number(row[category.key])} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dash-panel section">
        <div className="dash-panel-head">
          <h3>Presentation Takeaway</h3>
          <span>{april26Meta.device}</span>
        </div>
        <div className="takeaway-grid">
          <div>
            <strong>Local is viable for lightweight private tasks.</strong>
            <p>Qwen reached the best edge VSI because it combined low TTFT with usable quality and throughput.</p>
          </div>
          <div>
            <strong>Cloud still wins on quality.</strong>
            <p>Cloud baselines averaged about {pct(avgCloudQuality)} quality, while edge averaged {pct(avgEdgeQuality)}.</p>
          </div>
          <div>
            <strong>Model choice matters.</strong>
            <p>Llama produced the highest edge quality, but Qwen offered the best quality-latency balance.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default April26Dashboard;
