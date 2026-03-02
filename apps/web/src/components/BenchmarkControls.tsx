import React from "react";
import type { SystemId } from "../types";

interface Props {
  runs: number;
  onRunsChange: (n: number) => void;
  enabledSystems: Record<SystemId, boolean>;
  onToggleSystem: (s: SystemId) => void;
  onStart: () => void;
  onAbort: () => void;
  isRunning: boolean;
  edgeReady: boolean;
  serverHealthy: boolean;
}

const BenchmarkControls: React.FC<Props> = ({
  runs, onRunsChange, enabledSystems, onToggleSystem,
  onStart, onAbort, isRunning, edgeReady, serverHealthy,
}) => {
  return (
    <div className="card section">
      <h2>🧪 Benchmark Controls</h2>
      <div className="flex items-center gap-16 flex-wrap">
        <label className="flex items-center gap-8 text-sm">
          Runs:
          <input
            type="number"
            min={1}
            max={10}
            value={runs}
            onChange={(e) => onRunsChange(Math.max(1, Math.min(10, Number(e.target.value))))}
            style={{ width: 60 }}
            disabled={isRunning}
          />
        </label>

        <div className="flex items-center gap-12">
          <label className="flex items-center gap-8 text-sm" style={{ opacity: edgeReady ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={enabledSystems.edge}
              onChange={() => onToggleSystem("edge")}
              disabled={!edgeReady || isRunning}
            />
            <span className="badge badge-edge">Edge</span>
          </label>
          <label className="flex items-center gap-8 text-sm" style={{ opacity: serverHealthy ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={enabledSystems.cloud_small}
              onChange={() => onToggleSystem("cloud_small")}
              disabled={!serverHealthy || isRunning}
            />
            <span className="badge badge-cloud-small">Cloud Small</span>
          </label>
          <label className="flex items-center gap-8 text-sm" style={{ opacity: serverHealthy ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={enabledSystems.cloud_large}
              onChange={() => onToggleSystem("cloud_large")}
              disabled={!serverHealthy || isRunning}
            />
            <span className="badge badge-cloud-large">Cloud Large</span>
          </label>
        </div>

        {!isRunning ? (
          <button
            className="btn-primary"
            onClick={onStart}
            disabled={!Object.values(enabledSystems).some(Boolean)}
          >
            ▶ Start Benchmark
          </button>
        ) : (
          <button className="btn-danger" onClick={onAbort}>
            ✕ Abort
          </button>
        )}
      </div>

      {!edgeReady && (
        <div className="text-xs text-muted mt-8">
          ⚠ Edge model not loaded — load above to enable Edge benchmarks.
        </div>
      )}
      {!serverHealthy && (
        <div className="text-xs text-muted mt-4">
          ⚠ Backend server not responding — run <code className="mono">npm run server</code> to enable Cloud benchmarks.
        </div>
      )}
    </div>
  );
};

export default BenchmarkControls;
