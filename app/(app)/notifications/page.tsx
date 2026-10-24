"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  IconBell,
  IconPayments,
  IconSessions,
  IconSettings,
} from "@/components/icons";
import type { Notification, NotificationType } from "@/lib/types";

type ReadFilter = "all" | "unread" | "read";
type TypeFilter = "all" | NotificationType;

function typeMeta(type: NotificationType) {
  switch (type) {
    case "payment_success":
      return {
        label: "Payment",
        icon: IconPayments,
        tint: "bg-land-yellow text-land-ink",
      };
    case "session_expired":
      return {
        label: "Session",
        icon: IconSessions,
        tint: "bg-land-blue text-land-ink",
      };
    default:
      return {
        label: "System",
        icon: IconSettings,
        tint: "bg-land-lavender text-land-ink",
      };
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  async function load(opts?: { silent?: boolean }) {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);

    const res = await fetch("/api/notifications");
    const data = await res.json();
    if (res.ok) {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } else {
      toast.error("Could not load notifications", data.error);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const payments = notifications.filter(
      (n) => n.type === "payment_success",
    ).length;
    const sessions = notifications.filter(
      (n) => n.type === "session_expired",
    ).length;
    return {
      unread: unreadCount,
      total: notifications.length,
      payments,
      sessions,
    };
  }, [notifications, unreadCount]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (readFilter === "unread" && n.read) return false;
      if (readFilter === "read" && !n.read) return false;
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, readFilter, typeFilter]);

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
    if (!res.ok) {
      toast.error("Could not mark as read");
      await load({ silent: true });
    }
  }

  async function markAll() {
    setMarkingAll(true);
    const res = await fetch("/api/notifications/read-all", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All caught up", "Every notification is marked read.");
    } else {
      toast.error("Could not mark all read", data.error);
    }
    setMarkingAll(false);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Alerts
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Payment and session alerts for your hotspot account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={loading || refreshing}
            onClick={() => void load({ silent: true })}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          {unreadCount > 0 ? (
            <Button
              size="sm"
              disabled={markingAll}
              onClick={() => void markAll()}
            >
              {markingAll ? "Marking…" : "Mark all read"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Unread
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.unread}
          </p>
        </div>
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Payments
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.payments}
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
                { id: "read", label: "Read" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setReadFilter(opt.id)}
                className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
                  readFilter === opt.id
                    ? "bg-accent text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {opt.label}
                {opt.id === "unread" && stats.unread > 0 ? (
                  <span className="ml-1 opacity-80">({stats.unread})</span>
                ) : null}
              </button>
            ))}
          </div>
          <p className="text-2xs text-muted">
            {filtered.length} alert{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5 self-start">
          {(
            [
              { id: "all", label: "Every type" },
              { id: "payment_success", label: "Payments" },
              { id: "session_expired", label: "Sessions" },
              { id: "system", label: "System" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTypeFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
                typeFilter === opt.id
                  ? "bg-accent text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
            <IconBell className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs-tight font-semibold md:text-title">
            {notifications.length === 0
              ? "No notifications yet"
              : "No alerts in this view"}
          </p>
          <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
            {notifications.length === 0
              ? "Successful payments and session events will show up here automatically."
              : "Try another filter to see more alerts."}
          </p>
          {notifications.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setReadFilter("all");
                setTypeFilter("all");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const meta = typeMeta(n.type);
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <article
                  className={`flex flex-col gap-3 rounded-xl border p-3 shadow-[var(--shadow-soft)] md:flex-row md:items-start md:justify-between md:rounded-2xl md:p-4 ${
                    n.read
                      ? "border-border bg-canvas"
                      : "border-primary/15 bg-surface/80"
                  }`}
                >
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!n.read ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        ) : null}
                        <h2 className="text-xs-tight font-semibold md:text-title">
                          {n.title}
                        </h2>
                        <span className="rounded-full bg-inset px-2 py-0.5 text-[9px] font-semibold text-secondary md:text-2xs">
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-2xs text-secondary md:text-xs-tight">
                        {n.body}
                      </p>
                      <p className="mt-1.5 text-2xs text-muted">
                        {formatWhen(n.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5 md:justify-end">
                    {n.href ? (
                      <Link
                        href={n.href}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-2xs font-medium text-primary hover:bg-surface md:rounded-[10px] md:px-3.5 md:py-2 md:text-xs-tight"
                        onClick={() => {
                          if (!n.read) void markRead(n.id);
                        }}
                      >
                        Open
                      </Link>
                    ) : null}
                    {!n.read ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => void markRead(n.id)}
                      >
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
