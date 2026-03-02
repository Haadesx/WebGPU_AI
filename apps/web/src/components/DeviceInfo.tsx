import React from "react";
import type { DeviceMetadata } from "../types";

interface Props {
  device: DeviceMetadata | null;
}

const DeviceInfo: React.FC<Props> = ({ device }) => {
  if (!device) return null;

  return (
    <div className="card section">
      <h2>🖥 Device Info</h2>
      <div className="grid-2">
        <div>
          <div className="text-xs text-muted">Platform</div>
          <div className="text-sm mono">{device.platform}</div>
        </div>
        <div>
          <div className="text-xs text-muted">WebGPU Adapter</div>
          <div className="text-sm mono">{device.webgpuAdapter}</div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div className="text-xs text-muted">User Agent</div>
          <div className="text-xs mono" style={{ wordBreak: "break-all", color: "var(--text-secondary)" }}>
            {device.userAgent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceInfo;
