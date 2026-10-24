import { listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { listPackagesByOwner } from "@/lib/repositories/packages";
import { listPaymentsByHotspotIds } from "@/lib/repositories/payments";
import { listSessionsByHotspotIds } from "@/lib/repositories/sessions";
import { listSubscriptionsByOwner } from "@/lib/repositories/subscriptions";
import {
  isMoneyPayment,
  paymentRevenueAmount,
} from "@/lib/payments/revenue";
import { requireUser } from "@/lib/services/auth";
import type {
  AnalyticsRange,
  AnalyticsSummary,
  NamedRevenue,
  RevenueDay,
} from "@/lib/types";

const MAX_CUSTOM_DAYS = 366;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetweenInclusive(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

export type AnalyticsQuery = {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  /** When set to a hotspot uuid, scope metrics to that site. */
  hotspotId?: string | null;
};

function resolveWindow(query: AnalyticsQuery): {
  range: AnalyticsRange;
  from: Date;
  to: Date;
} {
  const today = startOfDay(new Date());

  if (query.range === "custom" || (query.from && query.to)) {
    let from = parseDateOnly(query.from);
    let to = parseDateOnly(query.to);

    if (!from || !to) {
      throw new Error("Custom range requires valid from and to dates (YYYY-MM-DD)");
    }

    if (from.getTime() > to.getTime()) {
      const swap = from;
      from = to;
      to = swap;
    }

    if (to.getTime() > today.getTime()) {
      to = today;
    }

    const span = daysBetweenInclusive(from, to);
    if (span > MAX_CUSTOM_DAYS) {
      throw new Error(`Custom range cannot exceed ${MAX_CUSTOM_DAYS} days`);
    }
    if (span < 1) {
      throw new Error("Invalid date range");
    }

    return { range: "custom", from: startOfDay(from), to: endOfDay(to) };
  }

  const range: AnalyticsRange = query.range === "30d" ? "30d" : "7d";
  const days = range === "30d" ? 30 : 7;
  const from = startOfDay(new Date(today));
  from.setDate(from.getDate() - (days - 1));
  return { range, from, to: endOfDay(today) };
}

export async function getOwnerAnalytics(
  query: AnalyticsQuery | string | null = {},
): Promise<AnalyticsSummary> {
  const normalized: AnalyticsQuery =
    typeof query === "string" || query === null
      ? { range: query }
      : query;

  const user = await requireUser();
  const { range, from, to } = resolveWindow(normalized);

  const allOwnerHotspots = await listHotspotsByOwner(user.id);
  const filterId = normalized.hotspotId?.trim() || null;
  const ownerHotspots =
    filterId && allOwnerHotspots.some((h) => h.id === filterId)
      ? allOwnerHotspots.filter((h) => h.id === filterId)
      : allOwnerHotspots;
  const hotspotIds = ownerHotspots.map((h) => h.id);
  const packages = await listPackagesByOwner(user.id);
  const packageMap = new Map(packages.map((p) => [p.id, p]));

  const fromMs = from.getTime();
  const toMs = to.getTime();

  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= fromMs && t <= toMs;
  };

  const allPayments = await listPaymentsByHotspotIds(hotspotIds);
  const rangePayments = allPayments.filter((p) => inWindow(p.createdAt));
  const packagePriceById = new Map(packages.map((p) => [p.id, p.price]));
  const moneyPayments = rangePayments.filter(isMoneyPayment);
  const failedPayments = rangePayments.filter((p) => p.status === "failed").length;
  const pendingPayments = rangePayments.filter(
    (p) => p.status === "pending",
  ).length;

  const revenue = moneyPayments.reduce(
    (sum, p) => sum + paymentRevenueAmount(p, packagePriceById),
    0,
  );
  const currency = moneyPayments[0]?.currency ?? "GHS";
  const avgTicket =
    moneyPayments.length > 0 ? revenue / moneyPayments.length : 0;
  const decided = moneyPayments.length + failedPayments;
  const successRate =
    decided > 0 ? (moneyPayments.length / decided) * 100 : 100;

  const ownerSessions = await listSessionsByHotspotIds(hotspotIds);
  const now = Date.now();
  const activeSessions = ownerSessions.filter(
    (s) => s.status === "active" && new Date(s.endsAt).getTime() > now,
  ).length;
  const sessionsInRange = ownerSessions.filter((s) => inWindow(s.createdAt));

  const dayCount = daysBetweenInclusive(from, to);
  const dayKeys: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    dayKeys.push(toDateKey(d));
  }

  const byDay = new Map<
    string,
    { revenue: number; payments: number; sessions: number }
  >();
  for (const key of dayKeys) {
    byDay.set(key, { revenue: 0, payments: 0, sessions: 0 });
  }
  for (const p of moneyPayments) {
    const key = p.createdAt.slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.revenue += paymentRevenueAmount(p, packagePriceById);
      bucket.payments += 1;
    }
  }
  for (const s of sessionsInRange) {
    const key = s.createdAt.slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.sessions += 1;
  }

  const revenueByDay: RevenueDay[] = dayKeys.map((date) => ({
    date,
    revenue: byDay.get(date)?.revenue ?? 0,
    payments: byDay.get(date)?.payments ?? 0,
    sessions: byDay.get(date)?.sessions ?? 0,
  }));

  const packageAgg = new Map<string, NamedRevenue>();
  for (const p of moneyPayments) {
    const pkg = packageMap.get(p.packageId);
    const id = p.packageId;
    const current = packageAgg.get(id) ?? {
      id,
      name: pkg?.name ?? "Unknown",
      revenue: 0,
      count: 0,
    };
    current.revenue += paymentRevenueAmount(p, packagePriceById);
    current.count += 1;
    packageAgg.set(id, current);
  }

  const hotspotAgg = new Map<string, NamedRevenue>();
  for (const p of moneyPayments) {
    const hs = ownerHotspots.find((h) => h.id === p.hotspotId);
    const id = p.hotspotId;
    const current = hotspotAgg.get(id) ?? {
      id,
      name: hs?.name ?? "Unknown",
      revenue: 0,
      count: 0,
    };
    current.revenue += paymentRevenueAmount(p, packagePriceById);
    current.count += 1;
    hotspotAgg.set(id, current);
  }

  const topPackages = [...packageAgg.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const byHotspot = [...hotspotAgg.values()].sort(
    (a, b) => b.revenue - a.revenue,
  );

  const peakHours: { hour: number; label: string; sessions: number; payments: number }[] =
    Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      sessions: 0,
      payments: 0,
    }));

  for (const s of sessionsInRange) {
    const hour = new Date(s.createdAt).getHours();
    peakHours[hour].sessions += 1;
  }
  for (const p of moneyPayments) {
    const hour = new Date(p.createdAt).getHours();
    peakHours[hour].payments += 1;
  }

  const usageByDay = new Map<string, { down: number; up: number }>();
  for (const key of dayKeys) {
    usageByDay.set(key, { down: 0, up: 0 });
  }
  let totalBytesDown = 0;
  let totalBytesUp = 0;
  for (const s of sessionsInRange) {
    totalBytesDown += s.bytesDown ?? 0;
    totalBytesUp += s.bytesUp ?? 0;
    const key = s.createdAt.slice(0, 10);
    const bucket = usageByDay.get(key);
    if (bucket) {
      bucket.down += s.bytesDown ?? 0;
      bucket.up += s.bytesUp ?? 0;
    }
  }
  const toGb = (bytes: number) =>
    Math.round((bytes / (1024 * 1024 * 1024)) * 1000) / 1000;
  const bandwidthByDay = dayKeys.map((date) => {
    const b = usageByDay.get(date) ?? { down: 0, up: 0 };
    return { date, downGb: toGb(b.down), upGb: toGb(b.up) };
  });

  const subscriptions = await listSubscriptionsByOwner(user.id);
  const activeSubscriptions = subscriptions.filter(
    (s) =>
      s.status === "active" &&
      new Date(s.currentPeriodEnd).getTime() > now,
  ).length;

  return {
    range,
    from: toDateKey(from),
    to: toDateKey(to),
    currency,
    revenue,
    successfulPayments: moneyPayments.length,
    failedPayments,
    pendingPayments,
    activeSessions,
    totalSessions: sessionsInRange.length,
    avgTicket,
    successRate,
    revenueByDay,
    topPackages,
    byHotspot,
    peakHours,
    bandwidthByDay,
    totalBytesDown,
    totalBytesUp,
    activeSubscriptions,
  };
}
