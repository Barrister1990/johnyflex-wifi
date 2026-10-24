"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActivityComboChart,
  BandwidthChart,
  HotspotBarChart,
  MiniSparkline,
  PackageDonutChart,
  PeakHoursChart,
  RevenueAreaChart,
} from "@/components/analytics/charts";
import { useLocationFilter } from "@/components/location-provider";
import { formatDataBytes } from "@/lib/format-data";
import { isAllLocations } from "@/lib/location-filter";
import type { AnalyticsRange, AnalyticsSummary } from "@/lib/types";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatPeriodLabel(data: AnalyticsSummary) {
  if (data.range === "7d") return "Last 7 days";
  if (data.range === "30d") return "Last 30 days";
  return `${data.from} → ${data.to}`;
}

export default function AnalyticsPage() {
  const { locationId } = useLocationFilter();
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [customFrom, setCustomFrom] = useState(daysAgoKey(29));
  const [customTo, setCustomTo] = useState(todayKey());
  const [appliedFrom, setAppliedFrom] = useState(daysAgoKey(29));
  const [appliedTo, setAppliedTo] = useState(todayKey());
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (range === "custom") {
      params.set("range", "custom");
      params.set("from", appliedFrom);
      params.set("to", appliedTo);
    } else {
      params.set("range", range);
    }
    if (!isAllLocations(locationId)) {
      params.set("hotspotId", locationId);
    }

    const res = await fetch(`/api/analytics?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load analytics");
      setLoading(false);
      return;
    }
    setData(json.analytics);
    setLoading(false);
  }, [range, appliedFrom, appliedTo, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectPreset(next: AnalyticsRange) {
    if (next === "7d") {
      const from = daysAgoKey(6);
      const to = todayKey();
      setCustomFrom(from);
      setCustomTo(to);
      setRange("7d");
      return;
    }
    if (next === "30d") {
      const from = daysAgoKey(29);
      const to = todayKey();
      setCustomFrom(from);
      setCustomTo(to);
      setRange("30d");
      return;
    }
    // Custom: show pickers and load the dates currently in the fields
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
    setRange("custom");
  }

  function applyCustom() {
    if (!customFrom || !customTo) {
      setError("Select both from and to dates");
      return;
    }
    if (customFrom > customTo) {
      setError("From date must be on or before To date");
      return;
    }
    setError("");
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
    setRange("custom");
  }

  const sparkRevenue = useMemo(
    () => data?.revenueByDay.map((d) => d.revenue) ?? [],
    [data],
  );
  const sparkPayments = useMemo(
    () => data?.revenueByDay.map((d) => d.payments) ?? [],
    [data],
  );
  const sparkSessions = useMemo(
    () => data?.revenueByDay.map((d) => d.sessions) ?? [],
    [data],
  );

  const empty =
    data && data.successfulPayments === 0 && data.totalSessions === 0;

  const chartRange: AnalyticsRange = data?.range ?? range;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Insights
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Revenue, payments, and session performance
            {data ? ` · ${formatPeriodLabel(data)}` : ""}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
            {(
              [
                { id: "7d", label: "7 days" },
                { id: "30d", label: "30 days" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => selectPreset(opt.id)}
                className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:px-4 md:text-xs-tight ${
                  range === opt.id
                    ? "bg-accent text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {range === "custom" ? (
            <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-canvas p-2.5 sm:w-auto sm:flex-row sm:items-end md:rounded-2xl md:p-3">
              <div className="min-w-0 flex-1 sm:w-36">
                <Input
                  label="From"
                  type="date"
                  value={customFrom}
                  max={customTo || todayKey()}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1 sm:w-36">
                <Input
                  label="To"
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayKey()}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={applyCustom}
                className="sm:mb-0.5"
              >
                Apply
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs-tight text-danger">{error}</p> : null}

      {loading || !data ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 md:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-inset/80 md:h-28 md:rounded-2xl"
            />
          ))}
          <div className="col-span-full h-56 animate-pulse rounded-xl bg-inset/60 md:h-72 md:rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 md:gap-3">
            <KpiCard
              label="Revenue"
              value={`${data.currency} ${data.revenue.toFixed(2)}`}
              hint={`${data.successfulPayments} paid checkouts`}
              tone="bg-land-yellow"
              spark={sparkRevenue}
              sparkColor="#5B8DEF"
            />
            <KpiCard
              label="Avg ticket"
              value={`${data.currency} ${data.avgTicket.toFixed(2)}`}
              hint="Per successful payment"
              tone="bg-land-pink"
              spark={sparkPayments}
              sparkColor="#8B5CF6"
            />
            <KpiCard
              label="Success rate"
              value={`${data.successRate.toFixed(0)}%`}
              hint={`${data.failedPayments} failed · ${data.pendingPayments} pending`}
              tone="bg-land-blue"
              spark={sparkPayments}
              sparkColor="#2DD4BF"
            />
            <KpiCard
              label="Data used"
              value={formatDataBytes(
                (data.totalBytesDown ?? 0) + (data.totalBytesUp ?? 0),
              )}
              hint={`↓ ${formatDataBytes(data.totalBytesDown)} · ↑ ${formatDataBytes(data.totalBytesUp)} · ${data.totalSessions} sessions`}
              tone="bg-land-lavender"
              spark={sparkSessions}
              sparkColor="#F59E0B"
            />
          </div>

          {empty ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center md:rounded-2xl md:py-16">
              <p className="text-xs-tight font-semibold md:text-title">
                No activity in this period
              </p>
              <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
                Try another date range, or complete a portal checkout so charts
                have data to show.
              </p>
              <Link href="/hotspots" className="mt-4">
                <Button size="sm">Open hotspots & QR</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr] md:gap-3">
                <Panel
                  title="Revenue over time"
                  subtitle={`Daily earnings · ${formatPeriodLabel(data)}`}
                  action={
                    <Link
                      href={`/reports?from=${data.from}&to=${data.to}`}
                      className="text-2xs font-medium text-secondary hover:text-primary md:text-xs-tight"
                    >
                      Export CSV
                    </Link>
                  }
                >
                  <div className="h-52 md:h-72">
                    <RevenueAreaChart
                      days={data.revenueByDay}
                      currency={data.currency}
                      range={chartRange}
                    />
                  </div>
                </Panel>

                <Panel title="Package mix" subtitle="Revenue share by plan">
                  <div className="h-52 md:h-72">
                    <PackageDonutChart
                      packages={data.topPackages}
                      currency={data.currency}
                    />
                  </div>
                </Panel>
              </div>

              <div className="grid gap-2 lg:grid-cols-2 md:gap-3">
                <Panel
                  title="Payments & sessions"
                  subtitle="Bars = payments · line = new sessions"
                >
                  <div className="h-52 md:h-64">
                    <ActivityComboChart
                      days={data.revenueByDay}
                      currency={data.currency}
                      range={chartRange}
                    />
                  </div>
                </Panel>

                <Panel
                  title="Revenue by hotspot"
                  subtitle="Top performing sites"
                >
                  <div className="h-52 md:h-64">
                    <HotspotBarChart
                      hotspots={data.byHotspot}
                      currency={data.currency}
                    />
                  </div>
                </Panel>
              </div>

              <div className="grid gap-2 lg:grid-cols-2 md:gap-3">
                <Panel
                  title="Peak hours"
                  subtitle="When customers buy and connect"
                >
                  <div className="h-52 md:h-64">
                    <PeakHoursChart hours={data.peakHours} />
                  </div>
                </Panel>
                <Panel
                  title="Data usage"
                  subtitle="GB by session start day (from MikroTik)"
                >
                  <div className="h-52 md:h-64">
                    <BandwidthChart
                      days={data.bandwidthByDay}
                      range={chartRange}
                    />
                  </div>
                </Panel>
              </div>

              <div className="grid gap-2 md:grid-cols-2 md:gap-3">
                <Panel title="Top packages" subtitle="By revenue">
                  {data.topPackages.length === 0 ? (
                    <p className="text-2xs text-muted">No package sales.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.topPackages.map((pkg, i) => {
                        const max = data.topPackages[0]?.revenue || 1;
                        const pct = (pkg.revenue / max) * 100;
                        return (
                          <li key={pkg.id}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs-tight font-medium">
                                  <span className="mr-1.5 text-muted">
                                    {i + 1}.
                                  </span>
                                  {pkg.name}
                                </p>
                                <p className="text-2xs text-muted">
                                  {pkg.count} sale{pkg.count === 1 ? "" : "s"}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs-tight font-semibold">
                                {data.currency} {pkg.revenue.toFixed(2)}
                              </p>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-inset">
                              <div
                                className="h-full rounded-full bg-accent/80"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>

                <Panel title="Hotspot leaderboard" subtitle="By revenue">
                  {data.byHotspot.length === 0 ? (
                    <p className="text-2xs text-muted">No hotspot revenue.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.byHotspot.map((hs, i) => {
                        const max = data.byHotspot[0]?.revenue || 1;
                        const pct = (hs.revenue / max) * 100;
                        return (
                          <li key={hs.id}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs-tight font-medium">
                                  <span className="mr-1.5 text-muted">
                                    {i + 1}.
                                  </span>
                                  {hs.name}
                                </p>
                                <p className="text-2xs text-muted">
                                  {hs.count} payment
                                  {hs.count === 1 ? "" : "s"}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs-tight font-semibold">
                                {data.currency} {hs.revenue.toFixed(2)}
                              </p>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-inset">
                              <div
                                className="h-full rounded-full bg-[#5B8DEF]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  spark,
  sparkColor,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
  spark: number[];
  sparkColor: string;
}) {
  return (
    <div className={`rounded-xl p-3 md:rounded-2xl md:p-4 ${tone}`}>
      <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
        {label}
      </p>
      <p className="mt-1 text-metric font-bold tracking-tight text-land-ink">
        {value}
      </p>
      <p className="mt-0.5 text-2xs text-land-ink/65">{hint}</p>
      <div className="mt-2 -mx-1">
        <MiniSparkline values={spark} color={sparkColor} />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xs-tight font-semibold md:text-title">{title}</h2>
          {subtitle ? (
            <p className="text-2xs text-muted md:text-xs-tight">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
