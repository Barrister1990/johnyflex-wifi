import { MockRouterAdapter } from "@/lib/router/mock";
import {
  getMikroTikConfigFromEnv,
  mikrotikAddIpBinding,
  mikrotikGetHotspotActive,
  mikrotikProbe,
  mikrotikRemoveIpBindingByMac,
  parseCpuPercent,
  parseMemoryPercent,
  type MikroTikConfig,
} from "@/lib/router/mikrotik-rest";
import { resolveMikroTikConfigForHotspot } from "@/lib/router/resolve-config";
import type {
  ConnectedDevice,
  RouterAdapter,
  RouterDeviceInput,
  RouterSessionInput,
  RouterStatus,
  RouterTelemetryPoint,
} from "@/lib/router/types";

/**
 * Single-company MikroTik adapter.
 * Prefer hotspot-linked router credentials; fall back to MIKROTIK_* env.
 * Payment unlock uses session-access.ts (fail-closed); this class serves the dashboard.
 */
export class MikroTikRouterAdapter implements RouterAdapter {
  private fallback = new MockRouterAdapter();
  private envCfg: MikroTikConfig | null;
  private lastTraffic: RouterTelemetryPoint[] = [];

  constructor() {
    this.envCfg = getMikroTikConfigFromEnv();
  }

  private async cfgFor(hotspotId: string): Promise<MikroTikConfig | null> {
    const resolved = await resolveMikroTikConfigForHotspot(hotspotId);
    return resolved.config ?? this.envCfg;
  }

  async authorizeDevice(input: RouterDeviceInput): Promise<{ ok: true }> {
    await this.fallback.authorizeDevice(input);
    const cfg = await this.cfgFor(input.hotspotId);
    if (cfg && input.macAddress !== "unknown") {
      try {
        await mikrotikAddIpBinding(cfg, {
          macAddress: input.macAddress,
          comment: `wifihub:${input.sessionId.slice(0, 8)}`,
          type: "bypassed",
        });
      } catch (error) {
        console.warn("[mikrotik] authorizeDevice", error);
      }
    }
    return { ok: true };
  }

  async revokeDevice(input: RouterDeviceInput): Promise<{ ok: true }> {
    await this.fallback.revokeDevice(input);
    const cfg = await this.cfgFor(input.hotspotId);
    if (cfg && input.macAddress !== "unknown") {
      try {
        await mikrotikRemoveIpBindingByMac(cfg, input.macAddress);
      } catch (error) {
        console.warn("[mikrotik] revokeDevice", error);
      }
    }
    return { ok: true };
  }

  async disconnectDevice(input: RouterDeviceInput): Promise<{ ok: true }> {
    return this.revokeDevice(input);
  }

  async createSession(input: RouterSessionInput): Promise<{ ok: true }> {
    await this.fallback.createSession(input);
    return { ok: true };
  }

  async endSession(sessionId: string): Promise<{ ok: true }> {
    await this.fallback.endSession(sessionId);
    return { ok: true };
  }

  async applyBandwidthProfile(
    macAddress: string,
    speedProfile: string,
  ): Promise<{ ok: true }> {
    await this.fallback.applyBandwidthProfile(macAddress, speedProfile);
    return { ok: true };
  }

  async getConnectedDevices(hotspotId: string): Promise<ConnectedDevice[]> {
    const fromDb = await this.fallback.getConnectedDevices(hotspotId);
    const cfg = await this.cfgFor(hotspotId);
    if (!cfg) return fromDb;

    try {
      const active = await mikrotikGetHotspotActive(cfg);
      const live: ConnectedDevice[] = active.map((row, i) => ({
        macAddress: row["mac-address"] ?? `unknown-${i}`,
        sessionId: fromDb[i]?.sessionId ?? `live-${i}`,
        authorized: true,
      }));
      const seen = new Set(fromDb.map((d) => d.macAddress.toLowerCase()));
      for (const d of live) {
        if (!seen.has(d.macAddress.toLowerCase())) fromDb.push(d);
      }
      return fromDb;
    } catch {
      return fromDb;
    }
  }

  async getRouterStatus(hotspotId: string): Promise<RouterStatus> {
    const mock = await this.fallback.getRouterStatus(hotspotId);
    const resolved = await resolveMikroTikConfigForHotspot(hotspotId);
    const cfg = resolved.config ?? this.envCfg;

    if (!cfg) {
      return {
        ...mock,
        adapter: "mikrotik-stub",
        message:
          "Attach MikroTik in the setup wizard (host, user, password), then Test.",
      };
    }

    const probe = await mikrotikProbe(cfg);
    if (!probe.ok || !probe.resource) {
      return {
        ...mock,
        online: false,
        internetUp: false,
        adapter: "mikrotik",
        message: `MikroTik unreachable (${resolved.source}): ${probe.message}`,
      };
    }

    const resource = probe.resource;
    const connected = await this.getConnectedDevices(hotspotId);
    const cpu = parseCpuPercent(resource);
    const memory = parseMemoryPercent(resource);
    const down = mock.bandwidthDownMbps;
    const up = mock.bandwidthUpMbps;
    const point: RouterTelemetryPoint = {
      at: new Date().toISOString(),
      downMbps: down,
      upMbps: up,
    };
    this.lastTraffic = [...this.lastTraffic.slice(-11), point];
    if (this.lastTraffic.length < 3) {
      this.lastTraffic = mock.traffic;
    }

    return {
      online: true,
      internetUp: true,
      adapter: "mikrotik",
      connectedCount: connected.length,
      message: `${probe.message} · via ${resolved.source}`,
      bandwidthDownMbps: down,
      bandwidthUpMbps: up,
      cpuPercent: cpu || mock.cpuPercent,
      memoryPercent: memory || mock.memoryPercent,
      traffic: this.lastTraffic,
    };
  }
}

export async function testMikroTikConnection() {
  const cfg = getMikroTikConfigFromEnv();
  if (!cfg) {
    return {
      ok: false,
      configured: false,
      message:
        "No MIKROTIK_* env. Prefer per-router credentials from the setup wizard; env is optional fallback.",
    };
  }
  const probe = await mikrotikProbe(cfg);
  return {
    ok: probe.ok,
    configured: true,
    host: cfg.host,
    message: probe.message,
    resource: probe.resource ?? null,
  };
}
