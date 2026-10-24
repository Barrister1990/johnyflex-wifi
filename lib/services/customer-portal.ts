import { getHotspotBySlugOrId } from "@/lib/repositories/hotspots";
import { listEnabledPackagesByOwner } from "@/lib/repositories/packages";
import { findCustomerByEmail } from "@/lib/repositories/customers";
import { listDevicesByCustomerIds } from "@/lib/repositories/devices";
import { listPaymentsByEmailAndHotspot } from "@/lib/repositories/payments";
import { listSessionsByCustomerAndHotspot } from "@/lib/repositories/sessions";
import { packageVisibleAtHotspot } from "@/lib/packages/visibility";
import type { CustomerPortalAccount, Package } from "@/lib/types";

export async function getCustomerPortalAccount(
  slugOrId: string,
  email: string,
): Promise<CustomerPortalAccount> {
  const hotspot = await getHotspotBySlugOrId(slugOrId);
  if (!hotspot) throw new Error("Hotspot not found");

  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Valid email required");

  const packages = (await listEnabledPackagesByOwner(hotspot.ownerId)).filter(
    (p) => packageVisibleAtHotspot(p, hotspot.id),
  ) as Package[];

  const customer = await findCustomerByEmail(normalized);
  const now = Date.now();

  if (!customer) {
    return {
      email: normalized,
      hotspot,
      activeSessions: [],
      receipts: [],
      devices: [],
      packages,
    };
  }

  const devices = await listDevicesByCustomerIds([customer.id]);
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const sessions = await listSessionsByCustomerAndHotspot(
    customer.id,
    hotspot.id,
  );

  const activeSessions = sessions
    .filter(
      (s) => s.status === "active" && new Date(s.endsAt).getTime() > now,
    )
    .map((s) => {
      const pkg = packageMap.get(s.packageId);
      const device = deviceMap.get(s.deviceId);
      return {
        id: s.id,
        packageName: pkg?.name ?? "Package",
        speedProfile: pkg?.speedProfile ?? "—",
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        remainingMinutes: Math.max(
          0,
          Math.ceil((new Date(s.endsAt).getTime() - now) / 60_000),
        ),
        deviceName: device?.name ?? "Device",
      };
    });

  const receipts = (await listPaymentsByEmailAndHotspot(normalized, hotspot.id))
    .filter((p) => p.status === "success" || p.provider === "voucher")
    .slice(0, 20)
    .map((p) => ({
      id: p.id,
      reference: p.reference,
      packageName: packageMap.get(p.packageId)?.name ?? "Package",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      createdAt: p.createdAt,
    }));

  return {
    email: normalized,
    hotspot,
    activeSessions,
    receipts,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      macAddress: d.macAddress,
      phone: d.phone,
    })),
    packages,
  };
}
