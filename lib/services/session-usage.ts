import { listDevicesByIds } from "@/lib/repositories/devices";
import { getPaymentById } from "@/lib/repositories/payments";
import {
  listAllActiveSessions,
  updateSessionTraffic,
} from "@/lib/repositories/sessions";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { mikrotikGetHotspotActive } from "@/lib/router/mikrotik-rest";
import { resolveMikroTikConfigForHotspot } from "@/lib/router/resolve-config";
import type { DeviceSession } from "@/lib/types";

async function resolveSessionMac(
  session: DeviceSession,
  deviceMac: string | null | undefined,
): Promise<string | null> {
  const fromDevice = normalizeMac(deviceMac);
  if (isUsableClientMac(fromDevice)) return fromDevice;
  try {
    const payment = await getPaymentById(session.paymentId);
    const fromPayment = normalizeMac(payment?.clientMac);
    if (isUsableClientMac(fromPayment)) return fromPayment;
  } catch {
    /* ignore */
  }
  return null;
}

function parseRouterBytes(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Apply MikroTik Hotspot Active counters to cumulative session totals.
 * Handles router counter resets (reconnect) by treating a drop as a new base.
 */
export function accumulateTraffic(
  session: DeviceSession,
  routerDown: number,
  routerUp: number,
): {
  bytesDown: number;
  bytesUp: number;
  routerBytesIn: number;
  routerBytesOut: number;
} {
  // routerBytesIn/Out columns store last download/upload router samples.
  const deltaDown =
    routerDown >= session.routerBytesIn
      ? routerDown - session.routerBytesIn
      : routerDown;
  const deltaUp =
    routerUp >= session.routerBytesOut
      ? routerUp - session.routerBytesOut
      : routerUp;
  return {
    bytesDown: session.bytesDown + deltaDown,
    bytesUp: session.bytesUp + deltaUp,
    routerBytesIn: routerDown,
    routerBytesOut: routerUp,
  };
}

/**
 * Sample live MikroTik Hotspot Active traffic into device_sessions.
 * No data-cap enforcement — tracking only.
 */
export async function syncActiveSessionUsage(
  hotspotIds?: string[],
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const sessions = await listAllActiveSessions(hotspotIds);
  if (!sessions.length) {
    return { updated: 0, skipped: 0, errors: [] };
  }

  const devices = await listDevicesByIds(sessions.map((s) => s.deviceId));
  const deviceById = new Map(devices.map((d) => [d.id, d]));

  const byHotspot = new Map<string, DeviceSession[]>();
  for (const s of sessions) {
    const list = byHotspot.get(s.hotspotId) ?? [];
    list.push(s);
    byHotspot.set(s.hotspotId, list);
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [hotspotId, group] of byHotspot) {
    const { config } = await resolveMikroTikConfigForHotspot(hotspotId);
    if (!config) {
      skipped += group.length;
      continue;
    }

    let active;
    try {
      active = await mikrotikGetHotspotActive(config, { timeoutMs: 10_000 });
    } catch (err) {
      errors.push(
        `${hotspotId.slice(0, 8)}: ${err instanceof Error ? err.message : "REST failed"}`,
      );
      skipped += group.length;
      continue;
    }

    // RouterOS Hotspot Active: bytes-out = sent to client (download),
    // bytes-in = received from client (upload).
    const byMac = new Map<string, { down: number; up: number }>();
    for (const row of active) {
      const mac = normalizeMac(row["mac-address"] ?? null);
      if (!mac || !isUsableClientMac(mac)) continue;
      byMac.set(mac, {
        down: parseRouterBytes(row["bytes-out"]),
        up: parseRouterBytes(row["bytes-in"]),
      });
    }

    for (const session of group) {
      const device = deviceById.get(session.deviceId);
      const mac = await resolveSessionMac(session, device?.macAddress);
      if (!mac) {
        skipped += 1;
        continue;
      }
      const sample = byMac.get(mac);
      if (!sample) {
        skipped += 1;
        continue;
      }
      if (sample.down === 0 && sample.up === 0) {
        skipped += 1;
        continue;
      }

      const next = accumulateTraffic(session, sample.down, sample.up);
      if (
        next.bytesDown === session.bytesDown &&
        next.bytesUp === session.bytesUp &&
        next.routerBytesIn === session.routerBytesIn &&
        next.routerBytesOut === session.routerBytesOut
      ) {
        skipped += 1;
        continue;
      }

      try {
        await updateSessionTraffic(session.id, next);
        updated += 1;
      } catch (err) {
        errors.push(
          `${session.id.slice(0, 8)}: ${err instanceof Error ? err.message : "update failed"}`,
        );
      }
    }
  }

  return { updated, skipped, errors };
}
