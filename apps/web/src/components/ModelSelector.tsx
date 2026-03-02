import React from "react";
import type { EdgeModelOption, ModelLoadProgress } from "../types";

interface Props {
  models: EdgeModelOption[];
  selected: string;
  onSelect: (id: string) => void;
  onLoad: () => void;
  onUnload: () => void;
  isLoaded: boolean;
  isLoading: boolean;
  loadProgress: ModelLoadProgress | null;
}

const ModelSelector: React.FC<Props> = ({
  models, selected, onSelect, onLoad, onUnload,
  isLoaded, isLoading, loadProgress,
}) => {
  return (
    <div className="card section">
      <h2>⚡ Edge Model</h2>
      <div className="flex items-center gap-12 flex-wrap">
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          disabled={isLoading || isLoaded}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.sizeHint})
            </option>
          ))}
        </select>

        {!isLoaded ? (
          <button className="btn-primary" onClick={onLoad} disabled={isLoading}>
            {isLoading ? "Loading…" : "Load Model"}
          </button>
        ) : (
          <button className="btn-secondary" onClick={onUnload}>
            Unload
          </button>
        )}

        {isLoaded && (
          <span className="badge badge-ok">✓ Ready</span>
        )}
      </div>

      {isLoading && loadProgress && (
        <div className="mt-8">
          <div className="text-sm text-secondary">{loadProgress.text}</div>
          <div className="progress-container mt-4">
            <div
              className="progress-bar"
              style={{ width: `${Math.round(loadProgress.progress * 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-4">
            {Math.round(loadProgress.progress * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
