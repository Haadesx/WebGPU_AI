/* ──────────────────────────────────────────────
 *  WebGPU feature detection
 * ────────────────────────────────────────────── */

export interface WebGPUInfo {
  supported: boolean;
  adapterName: string;
  error?: string;
}

export async function detectWebGPU(): Promise<WebGPUInfo> {
  if (!("gpu" in navigator)) {
    return {
      supported: false,
      adapterName: "N/A",
      error: "WebGPU not available — navigator.gpu is undefined. Use Chrome/Edge with WebGPU enabled.",
    };
  }

  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        adapterName: "N/A",
        error: "WebGPU adapter request returned null. GPU may not meet requirements.",
      };
    }

    const info: any = adapter.info ?? (adapter as any).requestAdapterInfo?.() ?? {};
    const adapterName = info.device || info.description || info.vendor || "Unknown adapter";

    return {
      supported: true,
      adapterName: String(adapterName),
    };
  } catch (e: any) {
    return {
      supported: false,
      adapterName: "N/A",
      error: `WebGPU detection error: ${e.message}`,
    };
  }
}
