export type RouterDeviceInput = {
  macAddress: string;
  sessionId: string;
  hotspotId: string;
};

export type RouterSessionInput = {
  sessionId: string;
  hotspotId: string;
  macAddress: string;
  speedProfile: string;
  endsAt: string;
};

export type RouterTelemetryPoint = {
  at: string;
  downMbps: number;
  upMbps: number;
};

export type RouterStatus = {
  online: boolean;
  internetUp: boolean;
  adapter: string;
  connectedCount: number;
  message: string;
  bandwidthDownMbps: number;
  bandwidthUpMbps: number;
  cpuPercent: number;
  memoryPercent: number;
  traffic: RouterTelemetryPoint[];
};

export type ConnectedDevice = {
  macAddress: string;
  sessionId: string;
  authorized: boolean;
};

export interface RouterAdapter {
  authorizeDevice(input: RouterDeviceInput): Promise<{ ok: true }>;
  revokeDevice(input: RouterDeviceInput): Promise<{ ok: true }>;
  disconnectDevice(input: RouterDeviceInput): Promise<{ ok: true }>;
  createSession(input: RouterSessionInput): Promise<{ ok: true }>;
  endSession(sessionId: string): Promise<{ ok: true }>;
  applyBandwidthProfile(
    macAddress: string,
    speedProfile: string,
  ): Promise<{ ok: true }>;
  getConnectedDevices(hotspotId: string): Promise<ConnectedDevice[]>;
  getRouterStatus(hotspotId: string): Promise<RouterStatus>;
}
