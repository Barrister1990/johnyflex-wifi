"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconHotspots, IconSessions } from "@/components/icons";
import { useLocationFilter } from "@/components/location-provider";
import { formatDataBytes } from "@/lib/format-data";
import { isAllLocations } from "@/lib/location-filter";
import type { SessionListItem, SessionStatus } from "@/lib/types";

type StatusFilter = "all" | SessionStatus;

function statusStyles(status: SessionStatus) {
  switch (status) {
    case "active":
      return "bg-success/10 text-success";
    case "revoked":
      return "bg-danger/10 text-danger";
    default:
      return "bg-inset text-secondary";
  }
}

function statusLabel(status: SessionStatus) {
  if (status === "active") return "Live";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function remainingLabel(endsAt: string, now: number) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Ended";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m left` : `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

function progressPct(startsAt: string, endsAt: string, now: number) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (end <= start) return 100;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, pct));
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function SessionsPage() {
  const toast = useToast();
  const { locationId } = useLocationFilter();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SessionListItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function load(opts?: { silent?: boolean; syncUsage?: boolean }) {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams();
    if (!isAllLocations(locationId)) params.set("hotspotId", locationId);
    const qs = params.toString();

    if (opts?.syncUsage) {
      await fetch(`/api/sessions/usage${qs ? `?${qs}` : ""}`, {
        method: "POST",
      }).catch(() => null);
    }

    const res = await fetch(`/api/sessions${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    if (res.ok) {
      setSessions(data.sessions);
      setChecked(new Set());
    } else toast.error("Could not load sessions", data.error);

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void load({ syncUsage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  async function revokeOne(session: SessionListItem) {
    if (session.status !== "active") return;
    const ok = window.confirm(
      `Cut off internet for ${session.customerEmail}? This ends the session in JohnnyFlex and on the MikroTik (including phones on the AP).`,
    );
    if (!ok) return;
    setRevoking(true);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const data = await res.json();
    setRevoking(false);
    if (!res.ok) {
      toast.error("Could not revoke", data.error);
      return;
    }
    toast.success("Access revoked", session.customerEmail);
    setSelected(null);
    await load({ silent: true });
  }

  async function revokeChecked() {
    const ids = [...checked].filter((id) => {
      const s = sessions.find((x) => x.id === id);
      return s?.status === "active";
    });
    if (!ids.length) {
      toast.error("Nothing to revoke", "Select live sessions only.");
      return;
    }
    const ok = window.confirm(
      `Revoke ${ids.length} live session${ids.length === 1 ? "" : "s"}? Internet will be cut on JohnnyFlex and the MikroTik for each.`,
    );
    if (!ok) return;
    setRevoking(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", ids }),
    });
    const data = await res.json();
    setRevoking(false);
    if (!res.ok) {
      toast.error("Could not revoke", data.error);
      return;
    }
    const failed = Number(data.failed) || 0;
    if (failed) {
      toast.info(
        `Revoked ${data.revoked}, ${failed} failed`,
        Array.isArray(data.errors) ? data.errors.join(" · ") : undefined,
      );
    } else {
      toast.success(
        "Access revoked",
        `${data.revoked} session${data.revoked === 1 ? "" : "s"} cut off.`,
      );
    }
    setSelected(null);
    await load({ silent: true });
  }

  useEffect(() => {
    const poll = window.setInterval(() => void load({ silent: true }), 45_000);
    return () => window.clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const stats = useMemo(() => {
    const live = sessions.filter((s) => s.status === "active").length;
    const expired = sessions.filter((s) => s.status === "expired").length;
    const revoked = sessions.filter((s) => s.status === "revoked").length;
    return { live, expired, revoked, total: sessions.length };
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!q) return true;
      return (
        s.customerEmail.toLowerCase().includes(q) ||
        s.hotspotName.toLowerCase().includes(q) ||
        s.packageName.toLowerCase().includes(q) ||
        s.deviceId.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [sessions, filter, query]);

  const liveFiltered = useMemo(
    () => filtered.filter((s) => s.status === "active"),
    [filtered],
  );

  const allLiveSelected =
    liveFiltered.length > 0 &&
    liveFiltered.every((s) => checked.has(s.id));

  const checkedLiveCount = useMemo(
    () =>
      [...checked].filter((id) =>
        sessions.some((s) => s.id === id && s.status === "active"),
      ).length,
    [checked, sessions],
  );

  function toggleOne(id: string, status: SessionStatus) {
    if (status !== "active") return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllLive() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allLiveSelected) {
        for (const s of liveFiltered) next.delete(s.id);
      } else {
        for (const s of liveFiltered) next.add(s.id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Access
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Sessions
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Live and past customer Wi‑Fi access across your hotspots.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || refreshing}
          onClick={() => void load({ silent: true, syncUsage: true })}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Live
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.live}
          </p>
        </div>
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Expired
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.expired}
          </p>
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
        <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: "Live" },
              { id: "expired", label: "Expired" },
              { id: "revoked", label: "Revoked" },
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
              {opt.id === "active" && stats.live > 0 ? (
                <span className="ml-1 opacity-80">({stats.live})</span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-2xs text-muted">
          {filtered.length} session{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <Input
        label="Search"
        placeholder="Customer, hotspot, package, device…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {checkedLiveCount > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas/95 px-3 py-2 shadow-sm backdrop-blur md:rounded-2xl">
          <p className="text-2xs font-medium text-secondary md:text-xs-tight">
            {checkedLiveCount} live selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              variant="danger"
              disabled={revoking}
              onClick={() => void revokeChecked()}
            >
              {revoking ? "Revoking…" : "Revoke selected"}
            </Button>
            <Button
              size="xs"
              variant="secondary"
              disabled={revoking}
              onClick={() => setChecked(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

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
            <IconSessions className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs-tight font-semibold md:text-title">
            {sessions.length === 0
              ? "No sessions yet"
              : "No sessions in this view"}
          </p>
          <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
            {sessions.length === 0
              ? "Customers appear here after they pay for a package via a hotspot portal QR."
              : "Try another status filter or clear your search."}
          </p>
          {sessions.length === 0 ? (
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
        <div className="overflow-hidden rounded-xl border border-border bg-canvas md:rounded-2xl">
          {liveFiltered.length > 0 ? (
            <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 md:px-4">
              <label className="flex cursor-pointer items-center gap-2 text-2xs text-secondary">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                  checked={allLiveSelected}
                  onChange={toggleAllLive}
                />
                Select all live ({liveFiltered.length})
              </label>
            </div>
          ) : null}
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const live = s.status === "active";
              const isOn = checked.has(s.id);
              const pct = live ? progressPct(s.startsAt, s.endsAt, now) : 100;
              return (
                <li
                  key={s.id}
                  className={`flex items-start gap-3 px-3 py-3 md:px-4 ${
                    isOn ? "bg-inset/60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent)] disabled:opacity-30"
                    checked={isOn}
                    disabled={!live}
                    onChange={() => toggleOne(s.id, s.status)}
                    aria-label={`Select ${s.customerEmail}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs-tight font-semibold md:text-title">
                          {s.customerEmail}
                        </p>
                        <p className="mt-0.5 truncate text-2xs text-muted md:text-xs-tight">
                          {s.hotspotName}
                          <span className="text-border"> · </span>
                          {s.packageName}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold md:text-2xs ${statusStyles(s.status)}`}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted">
                      <span>
                        {live
                          ? remainingLabel(s.endsAt, now)
                          : `Ended ${formatWhen(s.endsAt)}`}
                        <span className="text-border"> · </span>
                        ↓ {formatDataBytes(s.bytesDown)} · ↑{" "}
                        {formatDataBytes(s.bytesUp)}
                      </span>
                      <span className="font-mono text-[10px] opacity-70">
                        #{shortId(s.id)}
                      </span>
                    </div>

                    {live ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-inset">
                        <div
                          className="h-full rounded-full bg-success transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal
        open={selected != null}
        onClose={() => !revoking && setSelected(null)}
        title="Session detail"
        description="Customer access window for this hotspot visit."
        size="md"
        footer={
          <>
            {selected?.status === "active" ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={revoking}
                onClick={() => selected && void revokeOne(selected)}
              >
                {revoking ? "Revoking…" : "Revoke access"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={revoking}
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xs text-muted">Customer</p>
                <p className="truncate text-xs-tight font-semibold md:text-title">
                  {selected.customerEmail}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${statusStyles(selected.status)}`}
              >
                {statusLabel(selected.status)}
              </span>
            </div>

            {selected.status === "active" ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-2xs">
                  <span className="text-muted">Time used</span>
                  <span className="font-medium text-success">
                    {remainingLabel(selected.endsAt, now)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-inset">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{
                      width: `${progressPct(selected.startsAt, selected.endsAt, now)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["Hotspot", selected.hotspotName],
                  ["Package", selected.packageName],
                  ["Started", formatWhen(selected.startsAt)],
                  ["Ends", formatWhen(selected.endsAt)],
                  [
                    "Download",
                    formatDataBytes(selected.bytesDown),
                  ],
                  ["Upload", formatDataBytes(selected.bytesUp)],
                  [
                    "Last sampled",
                    selected.bytesSampledAt
                      ? formatWhen(selected.bytesSampledAt)
                      : "Not yet",
                  ],
                  ["Device", shortId(selected.deviceId)],
                  ["Payment", shortId(selected.paymentId)],
                  ["Session ID", selected.id],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-2xs text-muted">{label}</dt>
                  <dd className="mt-0.5 truncate text-xs-tight font-medium">
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
