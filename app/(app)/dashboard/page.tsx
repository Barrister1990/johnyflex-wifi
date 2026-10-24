import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconHotspots, IconPackages, IconPlus, IconQr } from "@/components/icons";
import { isAllLocations, locationLabel } from "@/lib/location-filter";
import { getOwnerAnalytics } from "@/lib/services/analytics";
import { getCurrentUser } from "@/lib/services/auth";
import { listHotspots } from "@/lib/services/hotspots";
import { listMyNotifications } from "@/lib/services/notifications";
import { listPackages } from "@/lib/services/packages";
import { listOwnerPayments } from "@/lib/services/payments";
import { listRouters } from "@/lib/services/routers";
import { listOwnerSessions } from "@/lib/services/sessions";
import {
  processExpiredSessions,
  processExpiredSubscriptions,
} from "@/lib/services/session-expiry";
import { resolveOwnerHotspotIds } from "@/lib/server-location";

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function dayLabel(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const allHotspots = await listHotspots();
  const allHotspotIds = allHotspots.map((h) => h.id);
  const { locationId, hotspotIds } = await resolveOwnerHotspotIds(allHotspotIds);
  const siteFilter = isAllLocations(locationId) ? null : locationId;
  const locationName = locationLabel(locationId, allHotspots);

  await processExpiredSessions(hotspotIds);
  await processExpiredSubscriptions(user!.id);

  const [packages, analytics, notifData, sessions, payments, routers] =
    await Promise.all([
      listPackages(),
      getOwnerAnalytics({ range: "7d", hotspotId: siteFilter }),
      listMyNotifications(),
      listOwnerSessions(siteFilter),
      listOwnerPayments(user!.id, siteFilter),
      listRouters(),
    ]);

  const hotspots = siteFilter
    ? allHotspots.filter((h) => h.id === siteFilter)
    : allHotspots;
  const activeHotspots = hotspots.filter((h) => h.status === "active").length;
  const activeSessions = sessions.filter((s) => s.status === "active");
  const linkedMikroTik = routers.filter(
    (r) => r.adapterType === "mikrotik" && r.connectionStatus === "connected",
  );
  const pendingMikroTik = routers.filter(
    (r) =>
      r.adapterType === "mikrotik" &&
      r.connectionStatus !== "connected" &&
      r.connectionStatus !== "mock",
  );
  const recentPayments = payments.slice(0, 6);
  const recentNotifs = notifData.notifications.slice(0, 5);
  const maxRevenue = Math.max(
    ...analytics.revenueByDay.map((d) => d.revenue),
    1,
  );

  const firstName = user?.name.split(" ")[0] ?? "there";
  const showByHotspot =
    isAllLocations(locationId) && analytics.byHotspot.length > 1;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Overview · {locationName}
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight text-primary">
            Good {greeting()}, {firstName}
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            {isAllLocations(locationId)
              ? "Your hotspots, packages, and live Wi‑Fi sales at a glance."
              : `Metrics for ${locationName}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href="/packages">
            <Button size="xs" variant="secondary" className="gap-1">
              <IconPackages className="h-3.5 w-3.5" />
              Package
            </Button>
          </Link>
          <Link href="/hotspots">
            <Button size="xs" className="gap-1">
              <IconPlus className="h-3.5 w-3.5" />
              Hotspot
            </Button>
          </Link>
        </div>
      </div>

      {linkedMikroTik.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/25 bg-success/10 px-3.5 py-3 md:rounded-2xl">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-success">
              MikroTik linked
            </p>
            <p className="mt-0.5 text-xs-tight font-medium text-primary md:text-sm">
              {linkedMikroTik.length === 1
                ? `${linkedMikroTik[0].label} is connected${
                    linkedMikroTik[0].host
                      ? ` · ${linkedMikroTik[0].host}`
                      : ""
                  }`
                : `${linkedMikroTik.length} routers successfully linked`}
            </p>
          </div>
          <Link href="/router">
            <Button size="xs" variant="secondary">
              Router status
            </Button>
          </Link>
        </div>
      ) : pendingMikroTik.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 md:rounded-2xl">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-amber-900">
              MikroTik not linked yet
            </p>
            <p className="mt-0.5 text-xs-tight text-amber-950 md:text-sm">
              Finish the wizard and run Test connection so unlock can work.
            </p>
          </div>
          <Link href="/router/setup">
            <Button size="xs">Open wizard</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 md:rounded-2xl">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted">
              No MikroTik yet
            </p>
            <p className="mt-0.5 text-xs-tight text-secondary md:text-sm">
              Link your café router to unlock customers after pay or voucher.
            </p>
          </div>
          <Link href="/router/setup">
            <Button size="xs">Link MikroTik</Button>
          </Link>
        </div>
      )}

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 md:gap-3">
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Revenue · 7d
          </p>
          <p className="mt-1 text-metric font-bold tracking-tight text-land-ink">
            {analytics.currency} {analytics.revenue.toFixed(0)}
          </p>
          <p className="mt-1 text-2xs text-land-ink/65">
            {analytics.successfulPayments} successful payments
          </p>
        </div>
        <div className="rounded-xl bg-land-pink p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Live sessions
          </p>
          <p className="mt-1 text-metric font-bold tracking-tight text-land-ink">
            {analytics.activeSessions}
          </p>
          <p className="mt-1 text-2xs text-land-ink/65">
            {activeSessions.length} currently authorized
          </p>
        </div>
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            {isAllLocations(locationId) ? "Hotspots" : "This location"}
          </p>
          <p className="mt-1 text-metric font-bold tracking-tight text-land-ink">
            {hotspots.length}
          </p>
          <p className="mt-1 text-2xs text-land-ink/65">
            {isAllLocations(locationId)
              ? `${activeHotspots} active sites`
              : hotspots[0]?.status === "active"
                ? "Active site"
                : hotspots[0]?.status ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Alerts
          </p>
          <p className="mt-1 text-metric font-bold tracking-tight text-land-ink">
            {notifData.unreadCount}
          </p>
          <p className="mt-1 text-2xs text-land-ink/65">
            {notifData.unreadCount === 0 ? "All caught up" : "Unread notifications"}
          </p>
        </div>
      </div>

      {showByHotspot ? (
        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4">
          <h2 className="mb-2 text-xs-tight font-semibold md:text-title">
            By location · 7d
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.byHotspot.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs-tight font-medium">{row.name}</p>
                  <p className="text-2xs text-muted">{row.count} payments</p>
                </div>
                <p className="shrink-0 text-xs-tight font-semibold">
                  {analytics.currency} {row.revenue.toFixed(0)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Chart + activity */}
      <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr] md:gap-3">
        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <div>
              <h2 className="text-xs-tight font-semibold md:text-title">
                Revenue trend
              </h2>
              <p className="text-2xs text-muted">Last 7 days</p>
            </div>
            <Link
              href="/analytics"
              className="text-2xs font-medium text-secondary hover:text-primary md:text-xs-tight"
            >
              Open analytics
            </Link>
          </div>

          {analytics.revenueByDay.every((d) => d.revenue === 0) ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl bg-surface md:h-44">
              <p className="text-xs-tight font-medium text-primary">
                No sales yet this week
              </p>
              <p className="mt-1 max-w-[220px] text-center text-2xs text-muted">
                Share a hotspot QR — payments will chart here instantly.
              </p>
              <Link href="/hotspots" className="mt-3">
                <Button size="xs" variant="secondary" className="gap-1">
                  <IconQr className="h-3.5 w-3.5" />
                  View QR codes
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex h-32 items-end gap-1 md:h-44 md:gap-1.5">
                {analytics.revenueByDay.map((d) => {
                  const h = Math.max(
                    (d.revenue / maxRevenue) * 100,
                    d.revenue > 0 ? 8 : 3,
                  );
                  return (
                    <div
                      key={d.date}
                      className="group flex flex-1 flex-col items-center justify-end gap-1"
                      title={`${d.date}: ${analytics.currency} ${d.revenue.toFixed(2)}`}
                    >
                      <span className="hidden text-[9px] text-muted opacity-0 transition-opacity group-hover:opacity-100 md:block">
                        {d.revenue > 0 ? d.revenue.toFixed(0) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-accent/85 transition-colors group-hover:bg-accent"
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[9px] text-muted md:text-2xs">
                        {dayLabel(d.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs-tight font-semibold md:text-title">
              Live sessions
            </h2>
            <Link
              href="/sessions"
              className="text-2xs font-medium text-secondary hover:text-primary md:text-xs-tight"
            >
              View all
            </Link>
          </div>
          {activeSessions.length === 0 ? (
            <p className="text-2xs text-muted md:text-xs-tight">
              No active sessions right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeSessions.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs-tight font-medium">
                      {s.customerEmail}
                    </p>
                    <p className="truncate text-2xs text-muted">
                      {s.hotspotName} · {s.packageName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-semibold text-success">
                    Live
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Packages / Hotspots / Payments / Alerts */}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 md:gap-3">
        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs-tight font-semibold">Packages</h2>
            <Link href="/packages" className="text-2xs text-muted hover:text-primary">
              All
            </Link>
          </div>
          {packages.length === 0 ? (
            <p className="text-2xs text-muted">Create your first plan.</p>
          ) : (
            <ul className="space-y-2">
              {packages.slice(0, 4).map((pkg) => (
                <li key={pkg.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs-tight font-medium">{pkg.name}</p>
                    <p className="text-2xs text-muted">
                      {formatDuration(pkg.durationMinutes)} · {pkg.speedProfile}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs-tight font-semibold">
                    {pkg.currency} {pkg.price}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs-tight font-semibold">Hotspots</h2>
            <Link href="/hotspots" className="text-2xs text-muted hover:text-primary">
              All
            </Link>
          </div>
          {hotspots.length === 0 ? (
            <p className="text-2xs text-muted">Add a site to generate QR.</p>
          ) : (
            <ul className="space-y-2">
              {hotspots.slice(0, 4).map((hs) => (
                <li key={hs.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs-tight font-medium">{hs.name}</p>
                    <p className="truncate font-mono text-2xs text-muted">
                      {hs.ssid}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${
                      hs.status === "active"
                        ? "bg-success/10 text-success"
                        : "bg-inset text-secondary"
                    }`}
                  >
                    {hs.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs-tight font-semibold">Payments</h2>
            <Link href="/payments" className="text-2xs text-muted hover:text-primary">
              All
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-2xs text-muted">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs-tight font-medium">
                      {p.customerEmail}
                    </p>
                    <p className="truncate font-mono text-2xs text-muted">
                      {p.reference.slice(0, 14)}…
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs-tight font-semibold">
                      {p.currency} {p.amount.toFixed(0)}
                    </p>
                    <p
                      className={`text-[9px] font-medium capitalize ${
                        p.status === "success"
                          ? "text-success"
                          : p.status === "failed"
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {p.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs-tight font-semibold">Activity</h2>
            <Link
              href="/notifications"
              className="text-2xs text-muted hover:text-primary"
            >
              All
            </Link>
          </div>
          {recentNotifs.length === 0 ? (
            <p className="text-2xs text-muted">
              Payments and session events show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentNotifs.map((n) => (
                <li key={n.id} className="flex gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      n.read ? "bg-border" : "bg-success"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs-tight font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-2xs text-muted">{n.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick start strip */}
      <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-canvas/60 p-3 sm:flex-row sm:items-center sm:justify-between md:rounded-2xl md:p-4">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 rounded-lg bg-inset p-1.5 text-secondary">
            <IconHotspots className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs-tight font-semibold">Ship a QR today</p>
            <p className="text-2xs text-muted">
              Create a hotspot, print the portal QR, and start collecting Paystack
              (or mock) payments.
            </p>
          </div>
        </div>
        <Link href="/hotspots">
          <Button size="sm" className="w-full sm:w-auto">
            Open hotspots
          </Button>
        </Link>
      </section>
    </div>
  );
}
