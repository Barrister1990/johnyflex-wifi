import { listCustomersByIds } from "@/lib/repositories/customers";
import { listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { listPackagesByOwner } from "@/lib/repositories/packages";
import { listPaymentsByHotspotIds } from "@/lib/repositories/payments";
import { listSessionsByHotspotIds } from "@/lib/repositories/sessions";
import { paymentRevenueAmount } from "@/lib/payments/revenue";
import { requireUser } from "@/lib/services/auth";

function escapeCsv(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseDateBound(raw: string | null, endOfDay: boolean): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function inRange(iso: string, from: Date | null, to: Date | null): boolean {
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export async function buildPaymentsCsv(query: {
  from?: string | null;
  to?: string | null;
  hotspotId?: string | null;
}): Promise<string> {
  const user = await requireUser();
  const from = parseDateBound(query.from ?? null, false);
  const to = parseDateBound(query.to ?? null, true);

  const allHotspots = await listHotspotsByOwner(user.id);
  const filterId = query.hotspotId?.trim() || null;
  const hotspots =
    filterId && allHotspots.some((h) => h.id === filterId)
      ? allHotspots.filter((h) => h.id === filterId)
      : allHotspots;
  const hotspotIds = hotspots.map((h) => h.id);
  const hotspotNames = new Map(hotspots.map((h) => [h.id, h.name] as const));
  const packages = await listPackagesByOwner(user.id);
  const packageNames = new Map(packages.map((p) => [p.id, p.name] as const));
  const packagePriceById = new Map(packages.map((p) => [p.id, p.price]));

  const rows = (await listPaymentsByHotspotIds(hotspotIds))
    .filter((p) => inRange(p.createdAt, from, to))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const header = [
    "reference",
    "email",
    "amount",
    "currency",
    "status",
    "provider",
    "hotspot",
    "package",
    "createdAt",
  ];

  const lines = [
    header.join(","),
    ...rows.map((p) =>
      [
        escapeCsv(p.reference),
        escapeCsv(p.customerEmail),
        escapeCsv(paymentRevenueAmount(p, packagePriceById)),
        escapeCsv(p.currency),
        escapeCsv(p.status),
        escapeCsv(p.provider),
        escapeCsv(hotspotNames.get(p.hotspotId) ?? ""),
        escapeCsv(packageNames.get(p.packageId) ?? ""),
        escapeCsv(p.createdAt),
      ].join(","),
    ),
  ];

  return lines.join("\n");
}

export async function buildSessionsCsv(query: {
  from?: string | null;
  to?: string | null;
  hotspotId?: string | null;
}): Promise<string> {
  const user = await requireUser();
  const from = parseDateBound(query.from ?? null, false);
  const to = parseDateBound(query.to ?? null, true);

  const allHotspots = await listHotspotsByOwner(user.id);
  const filterId = query.hotspotId?.trim() || null;
  const hotspots =
    filterId && allHotspots.some((h) => h.id === filterId)
      ? allHotspots.filter((h) => h.id === filterId)
      : allHotspots;
  const hotspotIds = hotspots.map((h) => h.id);
  const hotspotNames = new Map(hotspots.map((h) => [h.id, h.name] as const));
  const packages = await listPackagesByOwner(user.id);
  const packageNames = new Map(packages.map((p) => [p.id, p.name] as const));

  const sessions = (await listSessionsByHotspotIds(hotspotIds))
    .filter((s) => inRange(s.createdAt, from, to))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const customers = await listCustomersByIds([
    ...new Set(sessions.map((s) => s.customerId)),
  ]);
  const customerEmails = new Map(
    customers.map((c) => [c.id, c.email] as const),
  );

  const header = [
    "sessionId",
    "customerEmail",
    "hotspot",
    "package",
    "status",
    "startsAt",
    "endsAt",
    "createdAt",
  ];

  const lines = [
    header.join(","),
    ...sessions.map((s) =>
      [
        escapeCsv(s.id),
        escapeCsv(customerEmails.get(s.customerId) ?? ""),
        escapeCsv(hotspotNames.get(s.hotspotId) ?? ""),
        escapeCsv(packageNames.get(s.packageId) ?? ""),
        escapeCsv(s.status),
        escapeCsv(s.startsAt),
        escapeCsv(s.endsAt),
        escapeCsv(s.createdAt),
      ].join(","),
    ),
  ];

  return lines.join("\n");
}
