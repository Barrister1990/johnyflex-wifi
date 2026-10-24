"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconHotspots, IconPayments } from "@/components/icons";
import { useLocationFilter } from "@/components/location-provider";
import { isAllLocations } from "@/lib/location-filter";
import { isMoneyPayment } from "@/lib/payments/revenue";
import type { PaymentListItem, PaymentStatus } from "@/lib/types";

type StatusFilter = "all" | PaymentStatus;

function statusStyles(status: PaymentStatus) {
  switch (status) {
    case "success":
      return "bg-success/10 text-success";
    case "failed":
      return "bg-danger/10 text-danger";
    default:
      return "bg-inset text-secondary";
  }
}

function statusLabel(status: PaymentStatus) {
  if (status === "success") return "Paid";
  if (status === "pending") return "Pending";
  return "Failed";
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(currency: string, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

function shortRef(ref: string) {
  if (ref.length <= 14) return ref;
  return `${ref.slice(0, 8)}…${ref.slice(-4)}`;
}

export default function PaymentsPage() {
  const toast = useToast();
  const { locationId } = useLocationFilter();
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PaymentListItem | null>(null);

  async function load(opts?: { silent?: boolean }) {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams();
    if (!isAllLocations(locationId)) params.set("hotspotId", locationId);
    const qs = params.toString();
    const res = await fetch(`/api/payments${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    if (res.ok) setPayments(data.payments);
    else toast.error("Could not load payments", data.error);

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const locationScoped = useMemo(() => payments, [payments]);

  const stats = useMemo(() => {
    const money = locationScoped.filter(isMoneyPayment);
    const pending = locationScoped.filter((p) => p.status === "pending").length;
    const failed = locationScoped.filter((p) => p.status === "failed").length;
    const revenue = money.reduce((sum, p) => sum + p.amount, 0);
    const currency =
      money[0]?.currency ?? locationScoped[0]?.currency ?? "GHS";
    return {
      revenue,
      currency,
      paid: money.length,
      pending,
      failed,
      total: locationScoped.length,
    };
  }, [locationScoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locationScoped.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.customerEmail.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.hotspotName.toLowerCase().includes(q) ||
        p.packageName.toLowerCase().includes(q) ||
        p.provider.toLowerCase().includes(q) ||
        (p.providerRef?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [locationScoped, filter, query]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Revenue
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Payments
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Customer checkout history across your hotspot portals.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || refreshing}
          onClick={() => void load({ silent: true })}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Collected
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.currency} {stats.revenue.toFixed(0)}
          </p>
        </div>
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Paid
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.paid}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Failed
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.failed}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "success", label: "Paid" },
              { id: "pending", label: "Pending" },
              { id: "failed", label: "Failed" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
                filter === opt.id
                  ? "bg-accent text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {opt.label}
              {opt.id === "pending" && stats.pending > 0 ? (
                <span className="ml-1 opacity-80">({stats.pending})</span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-2xs text-muted">
          {filtered.length} payment{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <Input
        label="Search"
        placeholder="Email, reference, hotspot, package…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-inset/70 md:rounded-2xl"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center md:rounded-2xl md:py-16">
          <div className="rounded-xl bg-inset p-3 text-secondary">
            <IconPayments className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs-tight font-semibold md:text-title">
            {payments.length === 0
              ? "No payments yet"
              : "No payments in this view"}
          </p>
          <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
            {payments.length === 0
              ? "Successful portal checkouts and voucher redemptions appear here. Live Paystack can be enabled later in settings."
              : "Try another status filter or clear your search."}
          </p>
          {payments.length === 0 ? (
            <Link
              href="/hotspots"
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs-tight font-medium text-white hover:bg-primary/90 md:rounded-[10px] md:px-4 md:py-2 md:text-body"
            >
              <IconHotspots className="h-3.5 w-3.5" />
              Open hotspots
            </Link>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full flex-col rounded-xl border border-border bg-canvas p-3 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-primary/25 hover:bg-surface/60 md:rounded-2xl md:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs-tight font-semibold md:text-title">
                      {p.customerEmail}
                    </p>
                    <p className="mt-0.5 truncate text-2xs text-muted md:text-xs-tight">
                      {p.hotspotName}
                      <span className="text-border"> · </span>
                      {p.packageName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs-tight font-bold tracking-tight md:text-title">
                      {formatMoney(p.currency, p.amount)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold md:text-2xs ${statusStyles(p.status)}`}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted">
                  <span className="capitalize">
                    {p.provider}
                    <span className="text-border"> · </span>
                    <span className="font-mono">{shortRef(p.reference)}</span>
                  </span>
                  <span>{formatWhen(p.createdAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        title="Payment detail"
        description="Checkout record from a customer portal purchase."
        size="md"
        footer={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSelected(null)}
          >
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xs text-muted">Amount</p>
                <p className="text-h2 font-bold tracking-tight">
                  {formatMoney(selected.currency, selected.amount)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${statusStyles(selected.status)}`}
              >
                {statusLabel(selected.status)}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["Customer", selected.customerEmail],
                  ["Hotspot", selected.hotspotName],
                  ["Package", selected.packageName],
                  ["Provider", selected.provider],
                  ["Reference", selected.reference],
                  ["Provider ref", selected.providerRef ?? "—"],
                  ["Created", formatWhen(selected.createdAt)],
                  ["Updated", formatWhen(selected.updatedAt)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0 sm:col-span-1">
                  <dt className="text-2xs text-muted">{label}</dt>
                  <dd
                    className={`mt-0.5 text-xs-tight font-medium ${
                      label === "Reference" || label === "Provider ref"
                        ? "break-all font-mono text-[11px]"
                        : "truncate"
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
