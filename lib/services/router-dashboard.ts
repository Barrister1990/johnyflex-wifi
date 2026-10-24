import { listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { listRoutersByOwner } from "@/lib/repositories/routers";
import { getRouterAdapterMode } from "@/lib/router";
import {
  mikrotikGetHotspotActive,
  mikrotikProbe,
  parseCpuPercent,
  parseMemoryPercent,
  type MikroTikConfig,
} from "@/lib/router/mikrotik-rest";
import { requireUser } from "@/lib/services/auth";
import type {
  Router,
  RouterDashboardItem,
  RouterTelemetryPoint,
} from "@/lib/types";

/** Keep dashboard snappy — unreachable hosts (e.g. old 10.8.0.2) fail fast. */
const DASHBOARD_PROBE_MS = 2_500;

function emptyTraffic(): RouterTelemetryPoint[] {
  return Array.from({ length: 12 }, (_, i) => ({
    at: new Date(Date.now() - (11 - i) * 300_000).toISOString(),
    downMbps: 0,
    upMbps: 0,
  }));
}

async function liveStatusForRouter(router: Router): Promise<{
  online: boolean;
  internetUp: boolean;
  connectedUsers: number;
  bandwidthDownMbps: number;
  bandwidthUpMbps: number;
  cpuPercent: number;
  memoryPercent: number;
  message: string;
  traffic: RouterTelemetryPoint[];
  connectionStatus: Router["connectionStatus"];
}> {
  const trafficBlank = emptyTraffic();

  if (router.adapterType === "mock") {
    return {
      online: true,
      internetUp: true,
      connectedUsers: 0,
      bandwidthDownMbps: 0,
      bandwidthUpMbps: 0,
      cpuPercent: 0,
      memoryPercent: 0,
      message: "Mock adapter — no live hardware.",
      traffic: trafficBlank,
      connectionStatus: "mock",
    };
  }

  if (router.adapterType === "mikrotik") {
    if (!router.host || !router.username) {
      return {
        online: false,
        internetUp: false,
        connectedUsers: 0,
        bandwidthDownMbps: 0,
        bandwidthUpMbps: 0,
        cpuPercent: 0,
        memoryPercent: 0,
        message: "Add host and username, then Test connection.",
        traffic: trafficBlank,
        connectionStatus: "unconfigured",
      };
    }

    const cfg: MikroTikConfig = {
      host: router.host,
      user: router.username,
      password: router.passwordStored ?? "",
      port: router.port ?? 80,
      secure: router.port === 443,
    };

    const probeOpts = { timeoutMs: DASHBOARD_PROBE_MS };
    const [probe, active] = await Promise.all([
      mikrotikProbe(cfg, probeOpts),
      mikrotikGetHotspotActive(cfg, probeOpts),
    ]);

    if (!probe.ok || !probe.resource) {
      return {
        online: false,
        internetUp: false,
        connectedUsers: 0,
        bandwidthDownMbps: 0,
        bandwidthUpMbps: 0,
        cpuPercent: 0,
        memoryPercent: 0,
        message: probe.message,
        traffic: trafficBlank,
        connectionStatus: "error",
      };
    }

    const cpu = parseCpuPercent(probe.resource);
    const memory = parseMemoryPercent(probe.resource);
    const traffic = trafficBlank.map((p, i) => ({
      ...p,
      downMbps:
        i === trafficBlank.length - 1
          ? Math.max(0.1, active.length * 0.4)
          : 0,
      upMbps:
        i === trafficBlank.length - 1
          ? Math.max(0.05, active.length * 0.1)
          : 0,
    }));

    return {
      online: true,
      internetUp: true,
      connectedUsers: active.length,
      bandwidthDownMbps: traffic[traffic.length - 1]?.downMbps ?? 0,
      bandwidthUpMbps: traffic[traffic.length - 1]?.upMbps ?? 0,
      cpuPercent: cpu,
      memoryPercent: memory,
      message: probe.message,
      traffic,
      connectionStatus: "connected",
    };
  }

  const configured = Boolean(router.host);
  return {
    online: router.connectionStatus === "connected",
    internetUp: router.connectionStatus === "connected",
    connectedUsers: 0,
    bandwidthDownMbps: 0,
    bandwidthUpMbps: 0,
    cpuPercent: 0,
    memoryPercent: 0,
    message: configured
      ? `${router.adapterType} attached — live telemetry not implemented yet. Use Test when available.`
      : `Add ${router.adapterType} connection details to continue.`,
    traffic: trafficBlank,
    connectionStatus: router.connectionStatus,
  };
}

/**
 * Dashboard is keyed by **saved equipment** (MikroTik etc.), with live REST
 * data when the adapter supports it — not only by hotspots.
 */
export async function getOwnerRouterDashboard(): Promise<{
  adapterMode: "mock" | "mikrotik";
  items: RouterDashboardItem[];
}> {
  const user = await requireUser();
  const [hotspots, routers] = await Promise.all([
    listHotspotsByOwner(user.id),
    listRoutersByOwner(user.id),
  ]);

  const hotspotById = new Map(hotspots.map((h) => [h.id, h]));
  const sorted = [...routers].sort((a, b) => a.label.localeCompare(b.label));

  // Probe every router in parallel (was sequential × 8s timeout each).
  const lives = await Promise.all(sorted.map((r) => liveStatusForRouter(r)));

  const items: RouterDashboardItem[] = sorted.map((router, i) => {
    const live = lives[i]!;
    const hs =
      (router.hotspotId ? hotspotById.get(router.hotspotId) : null) ??
      hotspots.find((h) => h.routerId === router.id) ??
      null;

    return {
      hotspotId: hs?.id ?? "",
      hotspotName: hs?.name ?? "Not linked to a hotspot",
      routerId: router.id,
      routerLabel: router.label,
      vendor: router.vendor,
      model: router.model,
      adapterType: router.adapterType,
      host: router.host,
      port: router.port,
      connectionStatus: live.connectionStatus,
      lastCheckedAt: router.lastCheckedAt,
      online: live.online,
      internetUp: live.internetUp,
      connectedUsers: live.connectedUsers,
      bandwidthDownMbps: live.bandwidthDownMbps,
      bandwidthUpMbps: live.bandwidthUpMbps,
      cpuPercent: live.cpuPercent,
      memoryPercent: live.memoryPercent,
      message: live.message,
      traffic: live.traffic,
    };
  });

  return { adapterMode: getRouterAdapterMode(), items };
}
