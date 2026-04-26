import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { SummaryRow } from "../types";

interface Props {
  rows: SummaryRow[];
}

const Charts: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) return null;

  const chartData = rows.map((r) => ({
    system: r.system,
    "Avg TTFT (ms)": r.avg_ttft_ms,
    "Avg TPS": r.avg_tps,
    "Quality": parseFloat((r.avg_quality * 100).toFixed(1)),
    "VSI": parseFloat((r.VSI * 100).toFixed(1)),
  }));

  return (
    <div className="section">
      <h2>📈 Charts</h2>

      <div className="grid-2 mt-16">
        {/* TTFT Comparison */}
        <div className="card">
          <h3 className="mb-8">TTFT Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="system" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="Avg TTFT (ms)" fill="#4f8ff7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* TPS Comparison */}
        <div className="card">
          <h3 className="mb-8">TPS Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="system" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="Avg TPS" fill="#3dd68c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quality Comparison */}
        <div className="card">
          <h3 className="mb-8">Quality Score (%)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="system" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8b8fa8", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="Quality" fill="#a177f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Viability Score */}
        <div className="card">
          <h3 className="mb-8">Viability Score (×100)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e42" />
              <XAxis dataKey="system" tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8b8fa8", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="VSI" fill="#f7a94f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Charts;
