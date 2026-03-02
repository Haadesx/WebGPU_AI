/* ──────────────────────────────────────────────
 *  Device metadata + memory helpers
 * ────────────────────────────────────────────── */

import type { DeviceMetadata } from "../types";
import { detectWebGPU } from "./webgpu";

export async function collectDeviceMetadata(): Promise<DeviceMetadata> {
  const gpu = await detectWebGPU();

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || "unknown",
    webgpuAdapter: gpu.adapterName,
    webgpuSupported: gpu.supported,
    timestamp: new Date().toISOString(),
  };
}

export function getJSHeapMB(): number {
  const mem = (performance as any).memory;
  if (mem && typeof mem.usedJSHeapSize === "number") {
    return Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 100) / 100;
  }
  return 0;
}

export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
