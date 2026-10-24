"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { IconAnalytics, IconPayments, IconReports, IconSessions } from "@/components/icons";
import { useLocationFilter } from "@/components/location-provider";
import { isAllLocations } from "@/lib/location-filter";
import type { AnalyticsSummary } from "@/lib/types";

type RangePreset = "7d" | "30d" | "custom";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function periodLabel(from: string, to: string) {
  return `${from} → ${to}`;
}

function ReportsForm() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { locationId } = useLocationFilter();

  const initialFrom = searchParams.get("from") || daysAgoKey(29);
  const initialTo = searchParams.get("to") || todayKey();

  const [preset, setPreset] = useState<RangePreset>("30d");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [preview, setPreview] = useState<AnalyticsSummary | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [downloading, setDownloading] = useState<"payments" | "sessions" | null>(
    null,
  );

  const loadPreview = useCallback(
    async (fromDate: string, toDate: string) => {
      setLoadingPreview(true);
      const params = new URLSearchParams({
        range: "custom",
        from: fromDate,
        to: toDate,
      });
      if (!isAllLocations(locationId)) params.set("hotspotId", locationId);
      const res = await fetch(`/api/analytics?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setPreview(data.analytics);
      else setPreview(null);
      setLoadingPreview(false);
    },
    [locationId],
  );

  useEffect(() => {
    void loadPreview(from, to);
  }, [from, to, loadPreview]);

  function selectPreset(next: RangePreset) {
    if (next === "7d") {
      setFrom(daysAgoKey(6));
      setTo(todayKey());
      setPreset("7d");
      return;
    }
    if (next === "30d") {
      setFrom(daysAgoKey(29));
      setTo(todayKey());
      setPreset("30d");
      return;
    }
    setPreset("custom");
  }

  function applyCustomDates(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setPreset("custom");
  }

  async function download(kind: "payments" | "sessions") {
    if (!from || !to) {
      toast.error("Pick a date range", "From and To are required.");
      return;
    }
    if (from > to) {
      toast.error("Invalid range", "From must be on or before To.");
      return;
    }

    setDownloading(kind);
    const params = new URLSearchParams({ from, to });
    if (!isAllLocations(locationId)) params.set("hotspotId", locationId);
    const url = `/api/reports/${kind}?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Export failed", data.error ?? "Could not build CSV.");
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `wifihub-${kind}-${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(
        "Download started",
        `${kind === "payments" ? "Payments" : "Sessions"} CSV for ${periodLabel(from, to)}.`,
      );
    } catch {
      toast.error("Export failed", "Network error while downloading.");
    } finally {
      setDownloading(null);
    }
  }

  const exports = useMemo(
    () =>
      [
        {
          id: "payments" as const,
          title: "Payments CSV",
          description:
            "References, emails, amounts, status, provider, hotspot, and package.",
          icon: IconPayments,
          tint: "bg-land-yellow",
        },
        {
          id: "sessions" as const,
          title: "Sessions CSV",
          description:
            "Customer access windows with hotspot, package, status, and end times.",
          icon: IconSessions,
          tint: "bg-land-blue",
        },
      ] as const,
    [],
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Exports
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Reports
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Download payment and session history as CSV for accounting or ops.
          </p>
        </div>
        <Link
          href="/analytics"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-canvas px-3 py-1.5 text-xs-tight font-medium text-primary hover:bg-surface md:rounded-[10px] md:px-4 md:py-2 md:text-body"
        >
          <IconAnalytics className="h-3.5 w-3.5" />
          View analytics
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Revenue
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {loadingPreview
              ? "—"
              : `${preview?.currency ?? "GHS"} ${(preview?.revenue ?? 0).toFixed(0)}`}
          </p>
        </div>
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Payments
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {loadingPreview ? "—" : (preview?.successfulPayments ?? 0)}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Sessions
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {loadingPreview ? "—" : (preview?.totalSessions ?? 0)}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xs-tight font-semibold md:text-title">
              Date range
            </h2>
            <p className="mt-0.5 text-2xs text-muted">
              Preview stats and exports use this window.
            </p>
          </div>
          <p className="text-2xs font-medium text-secondary">
            {periodLabel(from, to)}
          </p>
        </div>

        <div className="mt-3 inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
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
              className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
                preset === opt.id
                  ? "bg-accent text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:gap-3">
          <Input
            label="From"
            type="date"
            value={from}
            max={to}
            onChange={(e) => applyCustomDates(e.target.value, to)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            min={from}
            max={todayKey()}
            onChange={(e) => applyCustomDates(from, e.target.value)}
          />
        </div>
      </section>

      <div className="grid gap-2 md:grid-cols-2 md:gap-3">
        {exports.map((item) => {
          const Icon = item.icon;
          const busy = downloading === item.id;
          return (
            <article
              key={item.id}
              className="flex flex-col rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-xl p-2.5 text-land-ink ${item.tint}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs-tight font-semibold md:text-title">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-2xs text-muted md:text-xs-tight">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-2xs text-muted">
                  {item.id === "payments"
                    ? `${preview?.successfulPayments ?? 0} paid in range`
                    : `${preview?.totalSessions ?? 0} sessions in range`}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !!downloading}
                  onClick={() => void download(item.id)}
                >
                  {busy ? "Preparing…" : "Download CSV"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {paymentsEmptyHint(preview, loadingPreview)}
    </div>
  );
}

function paymentsEmptyHint(
  preview: AnalyticsSummary | null,
  loading: boolean,
) {
  if (loading || !preview) return null;
  if (preview.successfulPayments > 0 || preview.totalSessions > 0) return null;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-10 text-center md:rounded-2xl">
      <div className="rounded-xl bg-inset p-3 text-secondary">
        <IconReports className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs-tight font-semibold md:text-title">
        Nothing to export in this range
      </p>
      <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
        Widen the dates, or wait for customers to pay via a hotspot portal QR.
      </p>
      <Link
        href="/hotspots"
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-accent px-3 py-1.5 text-xs-tight font-medium text-white hover:bg-primary/90 md:rounded-[10px] md:px-4 md:py-2 md:text-body"
      >
        Open hotspots
      </Link>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 md:space-y-6">
          <div className="h-16 animate-pulse rounded-xl bg-inset/70" />
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-inset/70"
              />
            ))}
          </div>
        </div>
      }
    >
      <ReportsForm />
    </Suspense>
  );
}
