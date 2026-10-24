import { getDeviceById } from "@/lib/repositories/devices";
import { listActiveSessionsByHotspot } from "@/lib/repositories/sessions";
import type {
  ConnectedDevice,
  RouterAdapter,
  RouterDeviceInput,
  RouterSessionInput,
  RouterStatus,
  RouterTelemetryPoint,
} from "@/lib/router/types";

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mockTraffic(hotspotId: string, connected: number): RouterTelemetryPoint[] {
  const seed = hashSeed(hotspotId);
  const now = Date.now();
  const points: RouterTelemetryPoint[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const wobble = ((seed + i * 17) % 100) / 100;
    const baseDown = 8 + connected * 2.5 + wobble * 12;
    const baseUp = 2 + connected * 0.6 + wobble * 3;
    points.push({
      at: new Date(now - i * 5 * 60_000).toISOString(),
      downMbps: Math.round(baseDown * 10) / 10,
      upMbps: Math.round(baseUp * 10) / 10,
    });
  }
  return points;
}

/** Development router: database-backed mock, no hardware. */
export class MockRouterAdapter implements RouterAdapter {
  private authorized = new Map<string, ConnectedDevice>();

  async authorizeDevice(input: RouterDeviceInput): Promise<{ ok: true }> {
    this.authorized.set(`${input.hotspotId}:${input.macAddress}`, {
      macAddress: input.macAddress,
      sessionId: input.sessionId,
      authorized: true,
    });
    return { ok: true };
  }

  async revokeDevice(input: RouterDeviceInput): Promise<{ ok: true }> {
    this.authorized.delete(`${input.hotspotId}:${input.macAddress}`);
    return { ok: true };
  }

  async disconnectDevice(input: RouterDeviceInput): Promise<{ ok: true }> {
    this.authorized.delete(`${input.hotspotId}:${input.macAddress}`);
    return { ok: true };
  }

  async createSession(_input: RouterSessionInput): Promise<{ ok: true }> {
    return { ok: true };
  }

  async endSession(sessionId: string): Promise<{ ok: true }> {
    for (const [key, device] of this.authorized.entries()) {
      if (device.sessionId === sessionId) {
        this.authorized.delete(key);
      }
    }
    return { ok: true };
  }

  async applyBandwidthProfile(
    _macAddress: string,
    _speedProfile: string,
  ): Promise<{ ok: true }> {
    return { ok: true };
  }

  async getConnectedDevices(hotspotId: string): Promise<ConnectedDevice[]> {
    const devices: ConnectedDevice[] = [];
    for (const [key, device] of this.authorized.entries()) {
      if (key.startsWith(`${hotspotId}:`)) {
        devices.push(device);
      }
    }

    const sessions = await listActiveSessionsByHotspot(hotspotId);
    for (const session of sessions) {
      const device = await getDeviceById(session.deviceId);
      const mac = device?.macAddress ?? "unknown";
      if (!devices.some((d) => d.sessionId === session.id)) {
        devices.push({
          macAddress: mac,
          sessionId: session.id,
          authorized: true,
        });
      }
    }

    return devices;
  }

  async getRouterStatus(hotspotId: string): Promise<RouterStatus> {
    const connected = await this.getConnectedDevices(hotspotId);
    const count = connected.length;
    const seed = hashSeed(hotspotId);
    const traffic = mockTraffic(hotspotId, count);
    const last = traffic[traffic.length - 1];

    return {
      online: true,
      internetUp: true,
      adapter: "mock",
      connectedCount: count,
      message: "Mock router online — database only, no hardware.",
      bandwidthDownMbps: last?.downMbps ?? 0,
      bandwidthUpMbps: last?.upMbps ?? 0,
      cpuPercent: Math.min(92, 12 + count * 8 + (seed % 15)),
      memoryPercent: Math.min(88, 28 + count * 5 + (seed % 20)),
      traffic,
    };
  }
}
