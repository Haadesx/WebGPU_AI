import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  RunResult, BenchmarkProgress, SystemId, SummaryRow,
  ModelLoadProgress, DeviceMetadata,
} from "./types";
import { detectWebGPU } from "./lib/webgpu";
import { EdgeEngine, EDGE_MODELS } from "./lib/edge-engine";
import { CloudEngine } from "./lib/cloud-engine";
import { BenchmarkRunner, computeSummary } from "./lib/benchmark-runner";
import { downloadJSON, downloadSummaryCSV, downloadPerPromptCSV } from "./lib/export";
import { collectDeviceMetadata } from "./lib/metrics";

import ModelSelector from "./components/ModelSelector";
import BenchmarkControls from "./components/BenchmarkControls";
import ProgressBar from "./components/ProgressBar";
import ResultsTable from "./components/ResultsTable";
import SummaryCards from "./components/SummaryCards";
import Charts from "./components/Charts";
import DeviceInfo from "./components/DeviceInfo";

const edgeEngine = new EdgeEngine();
const cloudSmall = new CloudEngine("small");
const cloudLarge = new CloudEngine("large");

export default function App() {
  /* ── WebGPU ── */
  const [gpuOk, setGpuOk] = useState<boolean | null>(null);
  const [gpuError, setGpuError] = useState("");

  /* ── Edge model ── */
  const [selectedModel, setSelectedModel] = useState(EDGE_MODELS[0].id);
  const [edgeLoaded, setEdgeLoaded] = useState(false);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<ModelLoadProgress | null>(null);

  /* ── Server health ── */
  const [serverHealthy, setServerHealthy] = useState(false);

  /* ── Benchmark ── */
  const [runs, setRuns] = useState(1);
  const [enabledSystems, setEnabledSystems] = useState<Record<SystemId, boolean>>({
    edge: false,
    cloud_small: true,
    cloud_large: false,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BenchmarkProgress>({
    phase: "idle", currentRun: 0, totalRuns: 0,
    currentPrompt: 0, totalPrompts: 0, currentSystem: "", message: "",
  });

  /* ── Results ── */
  const [allRuns, setAllRuns] = useState<RunResult[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [device, setDevice] = useState<DeviceMetadata | null>(null);

  /* ── Tabs ── */
  const [activeTab, setActiveTab] = useState<"results" | "summary" | "charts">("results");

  const runnerRef = useRef<BenchmarkRunner | null>(null);

  /* ── Init: detect WebGPU + check server ── */
  useEffect(() => {
    detectWebGPU().then((info) => {
      setGpuOk(info.supported);
      if (!info.supported) setGpuError(info.error || "WebGPU not supported");
    });

    collectDeviceMetadata().then(setDevice);

    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "ok" && d.apiKeyConfigured) setServerHealthy(true);
      })
      .catch(() => setServerHealthy(false));
  }, []);

  /* ── Edge model load/unload ── */
  const handleLoad = useCallback(async () => {
    setEdgeLoading(true);
    edgeEngine.setProgressCallback(setLoadProgress);
    try {
      await edgeEngine.load(selectedModel);
      setEdgeLoaded(true);
      setEnabledSystems((s) => ({ ...s, edge: true }));
    } catch (err: any) {
      alert(`Failed to load model: ${err.message}`);
    } finally {
      setEdgeLoading(false);
      setLoadProgress(null);
    }
  }, [selectedModel]);

  const handleUnload = useCallback(async () => {
    await edgeEngine.unload();
    setEdgeLoaded(false);
    setEnabledSystems((s) => ({ ...s, edge: false }));
  }, []);

  /* ── Toggle systems ── */
  const toggleSystem = useCallback((s: SystemId) => {
    setEnabledSystems((prev) => ({ ...prev, [s]: !prev[s] }));
  }, []);

  /* ── Run benchmark ── */
  const handleStart = useCallback(async () => {
    const systems = (Object.entries(enabledSystems) as [SystemId, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (systems.length === 0) return;

    const runner = new BenchmarkRunner();
    runner.registerEngine(edgeEngine);
    runner.registerEngine(cloudSmall);
    runner.registerEngine(cloudLarge);
    runner.setProgressCallback(setProgress);
    runnerRef.current = runner;

    setIsRunning(true);
    setAllRuns([]);
    setSummary([]);

    try {
      const results = await runner.run(systems, runs);
      setAllRuns(results);
      setSummary(computeSummary(results));
      setActiveTab("summary");
    } catch (err: any) {
      alert(`Benchmark error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [enabledSystems, runs]);

  const handleAbort = useCallback(() => {
    runnerRef.current?.abort();
    setIsRunning(false);
    setProgress((p) => ({ ...p, phase: "idle", message: "Aborted by user." }));
  }, []);

  /* ── Render ── */
  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="title-group">
          <h1>Edge AI Benchmark</h1>
          <div className="subtitle">
            WebGPU Quantized LLM vs Cloud — Latency · Throughput · Quality
          </div>
        </div>
        <div className="text-xs text-muted">
          Nguyen · Patel · Quadri
        </div>
      </header>

      {/* WebGPU status */}
      {gpuOk === true && (
        <div className="status-banner ok">✓ WebGPU detected — ready for in-browser inference</div>
      )}
      {gpuOk === false && (
        <div className="status-banner error">⚠ {gpuError}</div>
      )}

      {/* Model selector */}
      <ModelSelector
        models={EDGE_MODELS}
        selected={selectedModel}
        onSelect={setSelectedModel}
        onLoad={handleLoad}
        onUnload={handleUnload}
        isLoaded={edgeLoaded}
        isLoading={edgeLoading}
        loadProgress={loadProgress}
      />

      {/* Benchmark controls */}
      <BenchmarkControls
        runs={runs}
        onRunsChange={setRuns}
        enabledSystems={enabledSystems}
        onToggleSystem={toggleSystem}
        onStart={handleStart}
        onAbort={handleAbort}
        isRunning={isRunning}
        edgeReady={edgeLoaded}
        serverHealthy={serverHealthy}
      />

      {/* Progress */}
      {progress.phase !== "idle" && <ProgressBar progress={progress} />}

      {/* Device info */}
      <DeviceInfo device={device} />

      {/* Results area */}
      {allRuns.length > 0 && (
        <>
          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === "results" ? "active" : ""}`}
              onClick={() => setActiveTab("results")}
            >
              Per-Prompt Results
            </button>
            <button
              className={`tab ${activeTab === "summary" ? "active" : ""}`}
              onClick={() => setActiveTab("summary")}
            >
              Summary
            </button>
            <button
              className={`tab ${activeTab === "charts" ? "active" : ""}`}
              onClick={() => setActiveTab("charts")}
            >
              Charts
            </button>
          </div>

          {activeTab === "results" && <ResultsTable runs={allRuns} />}
          {activeTab === "summary" && <SummaryCards rows={summary} />}
          {activeTab === "charts" && <Charts rows={summary} />}

          {/* Export */}
          <div className="card section">
            <h2>💾 Export</h2>
            <div className="flex gap-12 flex-wrap">
              <button className="btn-secondary btn-sm" onClick={() => downloadJSON(allRuns)}>
                📥 Full Results (JSON)
              </button>
              <button className="btn-secondary btn-sm" onClick={() => downloadSummaryCSV(summary)}>
                📥 Summary (CSV)
              </button>
              <button className="btn-secondary btn-sm" onClick={() => downloadPerPromptCSV(allRuns)}>
                📥 Per-Prompt (CSV)
              </button>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {allRuns.length === 0 && !isRunning && (
        <div className="card text-center" style={{ padding: "60px 20px" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🧪</div>
          <div className="text-secondary">
            Configure your systems above and press <strong>Start Benchmark</strong> to begin.
          </div>
          <div className="text-xs text-muted mt-8">
            24 prompts × N runs × selected systems — results will appear here.
          </div>
        </div>
      )}
    </>
  );
}
