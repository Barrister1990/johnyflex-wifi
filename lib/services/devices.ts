import * as deviceRepo from "@/lib/repositories/devices";
import {
  listCustomersByHotspotIds,
  listCustomersByIds,
} from "@/lib/repositories/customers";
import { listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { listPackagesByOwner } from "@/lib/repositories/packages";
import {
  listSessionsByHotspotIds,
  updateSessionStatus,
} from "@/lib/repositories/sessions";
import { revokeSessionAccess } from "@/lib/router/session-access";
import { requireUser } from "@/lib/services/auth";
import type { DeviceListItem } from "@/lib/types";
import { z } from "zod";

const deviceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  macAddress: z.string().trim().max(40).nullable().optional(),
});

export async function listOwnerDevices(
  hotspotId?: string | null,
): Promise<DeviceListItem[]> {
  const user = await requireUser();
  const allOwnerHotspots = await listHotspotsByOwner(user.id);
  const ownerHotspots =
    hotspotId && allOwnerHotspots.some((h) => h.id === hotspotId)
      ? allOwnerHotspots.filter((h) => h.id === hotspotId)
      : allOwnerHotspots;
  const hotspotIds = ownerHotspots.map((h) => h.id);
  const hotspotIdSet = new Set(hotspotIds);
  const hotspotMap = new Map(ownerHotspots.map((h) => [h.id, h]));
  const packages = await listPackagesByOwner(user.id);
  const packageMap = new Map(packages.map((p) => [p.id, p]));

  const ownerCustomers = await listCustomersByHotspotIds(hotspotIds);
  const sessions = await listSessionsByHotspotIds(hotspotIds);
  const sessionCustomerIds = new Set(sessions.map((s) => s.customerId));
  const customerIds = [
    ...new Set([
      ...ownerCustomers.map((c) => c.id),
      ...sessionCustomerIds,
    ]),
  ];

  const devices = await deviceRepo.listDevicesByCustomerIds(customerIds);
  const customers = await listCustomersByIds(customerIds);
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const now = Date.now();

  return devices
    .map((device) => {
      const customer = customerMap.get(device.customerId);
      const deviceSessions = sessions
        .filter(
          (s) => s.deviceId === device.id && hotspotIdSet.has(s.hotspotId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const active =
        deviceSessions.find(
          (s) =>
            s.status === "active" && new Date(s.endsAt).getTime() > now,
        ) ?? null;
      const latest = active ?? deviceSessions[0] ?? null;
      const pkg = latest ? packageMap.get(latest.packageId) : null;
      const hotspot = latest ? hotspotMap.get(latest.hotspotId) : null;
      const remainingMinutes = active
        ? Math.max(
            0,
            Math.ceil((new Date(active.endsAt).getTime() - now) / 60_000),
          )
        : null;

      return {
        ...device,
        customerEmail: customer?.email ?? "Unknown",
        hotspotId: hotspot?.id ?? null,
        hotspotName: hotspot?.name ?? null,
        packageName: pkg?.name ?? null,
        speedProfile: pkg?.speedProfile ?? null,
        sessionId: latest?.id ?? null,
        sessionStatus: active
          ? ("active" as const)
          : (latest?.status ?? null),
        remainingMinutes,
        endsAt: latest?.endsAt ?? null,
      } satisfies DeviceListItem;
    })
    .sort((a, b) => {
      const aLive = a.sessionStatus === "active" ? 1 : 0;
      const bLive = b.sessionStatus === "active" ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export async function updateOwnerDevice(id: string, raw: unknown) {
  const devices = await listOwnerDevices();
  const owned = devices.find((d) => d.id === id);
  if (!owned) throw new Error("Device not found");

  const data = deviceUpdateSchema.parse(raw);
  const updated = await deviceRepo.updateDevice(id, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.macAddress !== undefined ? { macAddress: data.macAddress } : {}),
  });
  if (!updated) throw new Error("Device not found");
  return updated;
}

export async function revokeOwnerDevice(id: string) {
  const devices = await listOwnerDevices();
  const owned = devices.find((d) => d.id === id);
  if (!owned) throw new Error("Device not found");
  if (!owned.sessionId || owned.sessionStatus !== "active") {
    throw new Error("No active session to revoke");
  }

  const session = await updateSessionStatus(owned.sessionId, "revoked");
  if (!session) throw new Error("Session not found");

  await revokeSessionAccess({
    macAddress: owned.macAddress ?? "unknown",
    sessionId: owned.sessionId,
    hotspotId: owned.hotspotId ?? session.hotspotId,
  });

  return { ok: true, session };
}
