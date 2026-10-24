"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconHotspots, IconPlus, IconRouter } from "@/components/icons";
import type { PublicRouter, RouterDashboardItem } from "@/lib/types";

function TrafficSpark({
  traffic,
}: {
  traffic: RouterDashboardItem["traffic"];
}) {
  const max = Math.max(1, ...traffic.map((p) => p.downMbps + p.upMbps));
  return (
    <div className="flex h-10 items-end gap-0.5">
      {traffic.map((p) => {
        const h = Math.max(8, ((p.downMbps + p.upMbps) / max) * 100);
        return (
          <div
            key={p.at}
            className="flex-1 rounded-sm bg-land-blue/80"
            style={{ height: `${h}%` }}
            title={`${p.downMbps}↓ / ${p.upMbps}↑ Mbps`}
          />
        );
      })}
    </div>
  );
}

function statusTone(status: string | null | undefined) {
  if (status === "connected" || status === "mock") {
    return "bg-success/10 text-success";
  }
  if (status === "error") return "bg-danger/10 text-danger";
  if (status === "pending") return "bg-land-blue text-land-ink";
  return "bg-inset text-muted";
}

function statusLabel(item: RouterDashboardItem) {
  if (item.connectionStatus === "connected" && item.online) {
    return "MikroTik linked";
  }
  if (item.connectionStatus === "connected") return "Linked";
  if (item.connectionStatus === "error") return "Offline";
  if (item.connectionStatus === "pending") return "Pending";
  if (item.connectionStatus === "mock") return "Mock";
  return item.connectionStatus ?? "Not configured";
}

export default function RouterDashboardPage() {
  const toast = useToast();
  const [items, setItems] = useState<RouterDashboardItem[]>([]);
  const [routers, setRouters] = useState<PublicRouter[]>([]);
  const [adapterMode, setAdapterMode] = useState<"mock" | "mikrotik">("mock");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouterDashboardItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);

    // Show equipment list immediately; live probe can take a moment.
    const listRes = await fetch("/api/routers");
    const list = await listRes.json();
    if (listRes.ok) {
      setRouters(list.routers ?? []);
      if (!silent && (list.routers?.length ?? 0) > 0) {
        setLoading(false);
      }
    }

    const dashRes = await fetch("/api/router/dashboard");
    const dash = await dashRes.json();
    if (dashRes.ok) {
      setItems(dash.items ?? []);
      setAdapterMode(dash.adapterMode);
      setSelectedId((prev) => {
        const ids = (dash.items as RouterDashboardItem[])
          .map((i) => i.routerId)
          .filter(Boolean) as string[];
        if (prev && ids.includes(prev)) return prev;
        return ids[0] ?? null;
      });
    } else {
      toast.error("Could not load router dashboard", dash.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 20_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => items.find((i) => i.routerId === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const totals = useMemo(() => {
    return {
      online: items.filter((i) => i.online).length,
      users: items.reduce((s, i) => s + i.connectedUsers, 0),
      sites: items.length,
    };
  }, [items]);

  async function reconnect(routerId: string) {
    setTestingId(routerId);
    const res = await fetch(`/api/routers/${routerId}/test`, {
      method: "POST",
    });
    const data = await res.json();
    setTestingId(null);
    if (!res.ok) {
      toast.error("Reconnect failed", data.error);
      await load();
      return;
    }
    const status = data.router?.connectionStatus as string | undefined;
    const message = data.router?.message as string | undefined;
    if (status === "connected") {
      toast.success("MikroTik linked", message ?? "Connection OK");
    } else if (status === "error") {
      toast.error("Still offline", message ?? "Could not reach REST API");
    } else {
      toast.success("Checked", message ?? status ?? "Done");
    }
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget?.routerId) return;
    setDeleting(true);
    const res = await fetch(`/api/routers/${deleteTarget.routerId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      toast.error("Delete failed", data.error);
      return;
    }
    toast.success(
      "Router removed",
      deleteTarget.routerLabel ?? "Equipment deleted",
    );
    setDeleteTarget(null);
    setSelectedId(null);
    await load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Operations
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Routers
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Equipment you added (MikroTik and others) — live status from the
            router when linked, plus reconnect or remove.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-inset px-2.5 py-1 text-2xs font-semibold capitalize text-secondary">
            Adapter: {adapterMode}
          </span>
          <Link href="/router/setup">
            <Button size="sm" className="gap-1">
              <IconPlus className="h-3.5 w-3.5" />
              Add / setup
            </Button>
          </Link>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Linked online
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {totals.online}/{totals.sites}
          </p>
        </div>
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Hotspot users
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {totals.users}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Equipment
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {routers.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-inset/70" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center">
          <div className="rounded-xl bg-inset p-3 text-secondary">
            <IconRouter className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs-tight font-semibold">No routers yet</p>
          <p className="mt-1 max-w-sm text-2xs text-muted">
            Run the MikroTik wizard to save a router. It will show here with
            live CPU, memory, and hotspot users from RouterOS.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/router/setup">
              <Button size="sm">MikroTik setup wizard</Button>
            </Link>
            <Link
              href="/hotspots"
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs-tight font-medium hover:bg-surface"
            >
              <IconHotspots className="h-3.5 w-3.5" />
              Hotspots
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-1 rounded-xl border border-border bg-canvas p-2 md:rounded-2xl md:p-3">
            <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted">
              Your equipment
            </p>
            {items.map((item) => (
              <button
                key={item.routerId ?? item.hotspotId}
                type="button"
                onClick={() => setSelectedId(item.routerId)}
                className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors ${
                  selected?.routerId === item.routerId
                    ? "bg-accent text-white"
                    : "hover:bg-surface"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs-tight font-medium">
                    {item.routerLabel ?? "Router"}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.online
                        ? selected?.routerId === item.routerId
                          ? "bg-white"
                          : "bg-success"
                        : "bg-danger"
                    }`}
                  />
                </span>
                <span
                  className={`mt-0.5 truncate text-[10px] ${
                    selected?.routerId === item.routerId
                      ? "text-white/75"
                      : "text-muted"
                  }`}
                >
                  {item.host ?? item.adapterType ?? "No host"} ·{" "}
                  {item.hotspotName}
                </span>
              </button>
            ))}
          </aside>

          {selected ? (
            <section className="space-y-3 rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-xs-tight font-semibold md:text-title">
                    {selected.routerLabel}
                  </h2>
                  <p className="mt-0.5 text-2xs text-muted">
                    {selected.vendor} {selected.model}
                    {selected.host
                      ? ` · ${selected.host}${selected.port ? `:${selected.port}` : ""}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-2xs text-secondary">
                    Hotspot: {selected.hotspotName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize md:text-2xs ${statusTone(selected.connectionStatus)}`}
                  >
                    {statusLabel(selected)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold md:text-2xs ${
                      selected.online
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    Live {selected.online ? "online" : "offline"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                {(
                  [
                    ["Users", String(selected.connectedUsers)],
                    [
                      "Down",
                      `${selected.bandwidthDownMbps.toFixed(1)} Mbps`,
                    ],
                    ["Up", `${selected.bandwidthUpMbps.toFixed(1)} Mbps`],
                    ["CPU", `${selected.cpuPercent}%`],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-surface px-3 py-2.5"
                  >
                    <p className="text-2xs text-muted">{label}</p>
                    <p className="mt-0.5 text-xs-tight font-bold md:text-title">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
                    Activity
                  </p>
                  <TrafficSpark traffic={selected.traffic} />
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
                    Memory
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-inset">
                    <div
                      className="h-full rounded-full bg-land-lavender"
                      style={{ width: `${selected.memoryPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs-tight font-semibold">
                    {selected.memoryPercent}% used
                  </p>
                  <p className="mt-2 text-2xs text-muted">{selected.message}</p>
                  {selected.lastCheckedAt ? (
                    <p className="mt-1 text-[10px] text-muted">
                      Last checked{" "}
                      {new Date(selected.lastCheckedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {selected.routerId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={testingId === selected.routerId}
                    onClick={() => void reconnect(selected.routerId!)}
                  >
                    {testingId === selected.routerId
                      ? "Testing…"
                      : "Reconnect / Test"}
                  </Button>
                ) : null}
                <Link href="/router/setup">
                  <Button size="sm" variant="secondary">
                    Edit in wizard
                  </Button>
                </Link>
                <Link href="/devices">
                  <Button size="sm" variant="secondary">
                    Devices
                  </Button>
                </Link>
                {selected.routerId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <p className="text-2xs text-muted">
        Live metrics (CPU, memory, hotspot users) come from RouterOS REST when
        MikroTik is linked. Other catalog adapters show saved state until their
        live probe is added.{" "}
        <Link href="/router/setup" className="text-accent underline">
          Setup wizard
        </Link>
      </p>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={() => void confirmDelete()}
        title="Delete router?"
        description={
          deleteTarget
            ? `“${deleteTarget.routerLabel}” will be removed. Re-run the wizard to add it again.`
            : ""
        }
        confirmLabel="Delete router"
        tone="danger"
        loading={deleting}
      />
    </div>
  );
}
