"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconDevices, IconHotspots } from "@/components/icons";
import { useLocationFilter } from "@/components/location-provider";
import { isAllLocations } from "@/lib/location-filter";
import type { DeviceListItem } from "@/lib/types";

type StatusFilter = "all" | "active" | "idle";

function formatRemaining(mins: number | null) {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function DevicesPage() {
  const toast = useToast();
  const { locationId } = useLocationFilter();
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DeviceListItem | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mac, setMac] = useState("");
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (!isAllLocations(locationId)) params.set("hotspotId", locationId);
    const qs = params.toString();
    const res = await fetch(`/api/devices${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    if (res.ok) setDevices(data.devices);
    else toast.error("Could not load devices", data.error);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const stats = useMemo(() => {
    const live = devices.filter((d) => d.sessionStatus === "active").length;
    return { total: devices.length, live, idle: devices.length - live };
  }, [devices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (filter === "active" && d.sessionStatus !== "active") return false;
      if (filter === "idle" && d.sessionStatus === "active") return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.customerEmail.toLowerCase().includes(q) ||
        (d.macAddress?.toLowerCase().includes(q) ?? false) ||
        (d.phone?.toLowerCase().includes(q) ?? false) ||
        (d.hotspotName?.toLowerCase().includes(q) ?? false) ||
        (d.packageName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [devices, filter, query]);

  function openEdit(d: DeviceListItem) {
    setEditing(d);
    setName(d.name);
    setPhone(d.phone ?? "");
    setMac(d.macAddress ?? "");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/devices/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: phone || null,
        macAddress: mac || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not save device", data.error);
    else {
      toast.success("Device updated", name);
      setEditing(null);
      await load();
    }
    setSaving(false);
  }

  async function revoke(d: DeviceListItem) {
    setRevokingId(d.id);
    const res = await fetch(`/api/devices/${d.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not revoke", data.error);
    else {
      toast.success("Session revoked", d.name);
      await load();
    }
    setRevokingId(null);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Access
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Devices
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Name, MAC, package, remaining time, and speed across your hotspots.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Online
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">{stats.live}</p>
        </div>
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Idle
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">{stats.idle}</p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Total
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.total}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-border bg-canvas p-0.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: "Online" },
              { id: "idle", label: "Idle" },
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
            </button>
          ))}
        </div>
        <p className="text-2xs text-muted">
          {filtered.length} device{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <Input
        label="Search"
        placeholder="Name, MAC, email, hotspot…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-inset/70"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center md:rounded-2xl md:py-16">
          <div className="rounded-xl bg-inset p-3 text-secondary">
            <IconDevices className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs-tight font-semibold md:text-title">
            {devices.length === 0 ? "No devices yet" : "No matches"}
          </p>
          <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
            Devices appear after a customer pays at a hotspot portal.
          </p>
          {devices.length === 0 ? (
            <Link
              href="/hotspots"
              className="mt-4 inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs-tight font-medium text-white"
            >
              <IconHotspots className="h-3.5 w-3.5" />
              Open hotspots
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xs-tight font-semibold md:text-title">
                      {d.name}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold md:text-2xs ${
                        d.sessionStatus === "active"
                          ? "bg-success/10 text-success"
                          : "bg-inset text-secondary"
                      }`}
                    >
                      {d.sessionStatus === "active" ? "Online" : "Idle"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-muted md:text-xs-tight">
                    {d.customerEmail}
                    {d.phone ? ` · ${d.phone}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted">
                    {d.macAddress ?? "No MAC"}
                  </p>
                </div>
                <div className="text-right text-2xs">
                  <p className="font-semibold text-primary">
                    {d.packageName ?? "No package"}
                  </p>
                  <p className="mt-0.5 text-muted">
                    {d.speedProfile ?? "—"} · {formatRemaining(d.remainingMinutes)}{" "}
                    left
                  </p>
                  <p className="mt-0.5 text-muted">{d.hotspotName ?? "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => openEdit(d)}
                >
                  Edit
                </Button>
                {d.sessionStatus === "active" ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-danger"
                    disabled={revokingId === d.id}
                    onClick={() => void revoke(d)}
                  >
                    {revokingId === d.id ? "Revoking…" : "Revoke access"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing != null}
        onClose={() => !saving && setEditing(null)}
        title="Edit device"
        description="Update display name, phone, or MAC address."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button type="submit" form="device-form" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="device-form" onSubmit={onSave} className="space-y-3">
          <Input
            label="Device name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 …"
          />
          <Input
            label="MAC address"
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            placeholder="02:wh:aa:bb:cc"
          />
        </form>
      </Modal>
    </div>
  );
}
