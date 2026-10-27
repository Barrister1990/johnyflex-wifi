"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  IconHotspots,
  IconLogout,
  IconPackages,
  IconPayments,
  IconSessions,
  IconSettings,
} from "@/components/icons";
import { LOCATION_ALL } from "@/lib/location-filter";
import type { SettingsPayload } from "@/lib/types";

type ProfileForm = {
  name: string;
  businessName: string;
  phone: string;
  supportEmail: string;
  currency: string;
  timezone: string;
  notifyPaymentSuccess: boolean;
  notifySessionExpired: boolean;
  notifySystem: boolean;
};

type FreeModeForm = {
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  packageId: string;
  /** `all` = owner-wide; uuid = per-site override. */
  hotspotId: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyProfile: ProfileForm = {
  name: "",
  businessName: "",
  phone: "",
  supportEmail: "",
  currency: "GHS",
  timezone: "Africa/Accra",
  notifyPaymentSuccess: true,
  notifySessionExpired: true,
  notifySystem: true,
};

const emptyFreeMode: FreeModeForm = {
  enabled: false,
  startsAt: "",
  endsAt: "",
  packageId: "",
  hotspotId: LOCATION_ALL,
};

/** datetime-local value from ISO (browser local). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInputFromDate(d: Date): string {
  return toLocalInput(d.toISOString());
}

const TIMEZONES = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Abidjan",
  "UTC",
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-canvas px-3 py-2.5 md:rounded-2xl md:px-4 md:py-3">
      <div className="min-w-0">
        <p className="text-xs-tight font-semibold">{label}</p>
        <p className="mt-0.5 text-2xs text-muted">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs-tight font-semibold md:text-title">{title}</h2>
          <p className="mt-0.5 text-2xs text-muted md:text-xs-tight">
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [freeMode, setFreeMode] = useState<FreeModeForm>(emptyFreeMode);
  const [password, setPassword] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFreeMode, setSavingFreeMode] = useState(false);
  const [savingPaystack, setSavingPaystack] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [testingMikroTik, setTestingMikroTik] = useState(false);
  const [hotspots, setHotspots] = useState<
    {
      id: string;
      name: string;
      freeModeEnabled: boolean;
      freeModeStartsAt: string | null;
      freeModeEndsAt: string | null;
      freeModePackageId: string | null;
      paystackEnabled: boolean;
    }[]
  >([]);
  const [paystackLocationId, setPaystackLocationId] = useState("");
  const [paystackEnabled, setPaystackEnabled] = useState(true);

  async function load() {
    setLoading(true);
    const [res, hRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/hotspots"),
    ]);
    const data = await res.json();
    const hData = await hRes.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Could not load settings", data.error);
      setLoading(false);
      return;
    }
    const s = data.settings as SettingsPayload;
    setSettings(s);
    if (hRes.ok && Array.isArray(hData.hotspots)) {
      const mapped = hData.hotspots.map(
        (h: {
          id: string;
          name: string;
          freeModeEnabled?: boolean;
          freeModeStartsAt?: string | null;
          freeModeEndsAt?: string | null;
          freeModePackageId?: string | null;
          paystackEnabled?: boolean;
        }) => ({
          id: h.id,
          name: h.name,
          freeModeEnabled: Boolean(h.freeModeEnabled),
          freeModeStartsAt: h.freeModeStartsAt ?? null,
          freeModeEndsAt: h.freeModeEndsAt ?? null,
          freeModePackageId: h.freeModePackageId ?? null,
          paystackEnabled: h.paystackEnabled !== false,
        }),
      );
      setHotspots(mapped);
      setPaystackLocationId((prev) => {
        const nextId =
          prev && mapped.some((h: { id: string }) => h.id === prev)
            ? prev
            : (mapped[0]?.id ?? "");
        const selected = mapped.find((h: { id: string }) => h.id === nextId);
        setPaystackEnabled(selected ? selected.paystackEnabled : true);
        return nextId;
      });
    }
    setProfile({
      name: s.profile.name,
      businessName: s.profile.businessName ?? "",
      phone: s.profile.phone ?? "",
      supportEmail: s.profile.supportEmail ?? "",
      currency: s.profile.currency,
      timezone: s.profile.timezone,
      notifyPaymentSuccess: s.profile.notifyPaymentSuccess,
      notifySessionExpired: s.profile.notifySessionExpired,
      notifySystem: s.profile.notifySystem,
    });
    setFreeMode((prev) => ({
      ...prev,
      enabled: s.freeMode?.enabled ?? s.profile.freeModeEnabled ?? false,
      startsAt: toLocalInput(
        s.freeMode?.startsAt ?? s.profile.freeModeStartsAt,
      ),
      endsAt: toLocalInput(s.freeMode?.endsAt ?? s.profile.freeModeEndsAt),
      packageId:
        s.freeMode?.packageId ?? s.profile.freeModePackageId ?? "",
      hotspotId: prev.hotspotId || LOCATION_ALL,
    }));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        businessName: profile.businessName || null,
        phone: profile.phone || null,
        supportEmail: profile.supportEmail || null,
        currency: profile.currency,
        timezone: profile.timezone,
        notifyPaymentSuccess: profile.notifyPaymentSuccess,
        notifySessionExpired: profile.notifySessionExpired,
        notifySystem: profile.notifySystem,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not save profile", data.error);
    } else {
      toast.success("Profile saved", "Your account settings were updated.");
      await load();
    }
    setSavingProfile(false);
  }

  function applyFreePreset(kind: "1h" | "3h" | "today" | "1d" | "weekend") {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    if (kind === "1h") {
      end = new Date(now.getTime() + 60 * 60_000);
    } else if (kind === "3h") {
      end = new Date(now.getTime() + 3 * 60 * 60_000);
    } else if (kind === "today") {
      end = new Date(now);
      end.setHours(23, 59, 0, 0);
    } else if (kind === "1d") {
      end = new Date(now.getTime() + 24 * 60 * 60_000);
    } else {
      // Next Sat 00:00 → Sun 23:59 (or this weekend if already Sat/Sun)
      const day = now.getDay();
      const daysToSat = day === 6 ? 0 : day === 0 ? -1 : (6 - day);
      start = new Date(now);
      start.setDate(now.getDate() + daysToSat);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setHours(23, 59, 0, 0);
    }
    setFreeMode((prev) => ({
      ...prev,
      enabled: true,
      startsAt: toLocalInputFromDate(start),
      endsAt: toLocalInputFromDate(end),
    }));
  }

  async function onSaveFreeMode(e: FormEvent) {
    e.preventDefault();
    setSavingFreeMode(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freeModeEnabled: freeMode.enabled,
        freeModeStartsAt: freeMode.startsAt
          ? new Date(freeMode.startsAt).toISOString()
          : null,
        freeModeEndsAt: freeMode.endsAt
          ? new Date(freeMode.endsAt).toISOString()
          : null,
        freeModePackageId: freeMode.packageId || null,
        hotspotId:
          freeMode.hotspotId === LOCATION_ALL ? null : freeMode.hotspotId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not save Free Mode", data.error);
    } else {
      toast.success(
        freeMode.enabled ? "Free Mode saved" : "Free Mode off",
        freeMode.hotspotId === LOCATION_ALL
          ? freeMode.enabled
            ? "Applies to all sites (unless a site has its own override)."
            : "Paid packages and vouchers are required again."
          : freeMode.enabled
            ? "Applies only to the selected location."
            : "This location falls back to All locations Free Mode.",
      );
      await load();
    }
    setSavingFreeMode(false);
  }

  function selectPaystackLocation(nextId: string) {
    setPaystackLocationId(nextId);
    const site = hotspots.find((h) => h.id === nextId);
    setPaystackEnabled(site ? site.paystackEnabled : true);
  }

  async function onSavePaystack(e: FormEvent) {
    e.preventDefault();
    if (!paystackLocationId) {
      toast.error("Select a location", "Choose which site to update.");
      return;
    }
    setSavingPaystack(true);
    const res = await fetch(`/api/hotspots/${paystackLocationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paystackEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Could not save Paystack setting", data.error);
    } else {
      toast.success(
        paystackEnabled ? "Paystack on" : "Paystack off",
        paystackEnabled
          ? "Package checkout is available on this portal."
          : "Package tab hidden — voucher redeem only.",
      );
      await load();
    }
    setSavingPaystack(false);
  }

  function selectFreeModeLocation(nextId: string) {
    if (nextId === LOCATION_ALL && settings) {
      setFreeMode({
        hotspotId: LOCATION_ALL,
        enabled:
          settings.freeMode?.enabled ??
          settings.profile.freeModeEnabled ??
          false,
        startsAt: toLocalInput(
          settings.freeMode?.startsAt ?? settings.profile.freeModeStartsAt,
        ),
        endsAt: toLocalInput(
          settings.freeMode?.endsAt ?? settings.profile.freeModeEndsAt,
        ),
        packageId:
          settings.freeMode?.packageId ??
          settings.profile.freeModePackageId ??
          "",
      });
      return;
    }
    const hs = hotspots.find((h) => h.id === nextId);
    if (!hs) {
      setFreeMode((prev) => ({ ...prev, hotspotId: nextId }));
      return;
    }
    setFreeMode({
      hotspotId: nextId,
      enabled: hs.freeModeEnabled,
      startsAt: toLocalInput(hs.freeModeStartsAt),
      endsAt: toLocalInput(hs.freeModeEndsAt),
      packageId: hs.freeModePackageId ?? "",
    });
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Password not changed", data.error);
    } else {
      toast.success("Password updated", "Use your new password next login.");
      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
    setSavingPassword(false);
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function testMikroTik() {
    setTestingMikroTik(true);
    const res = await fetch("/api/settings/mikrotik-test", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error("MikroTik test failed", data.error);
    } else if (data.ok) {
      toast.success("MikroTik connected", data.message);
    } else {
      toast.error("MikroTik not reachable", data.message);
    }
    setTestingMikroTik(false);
  }

  if (loading || !settings) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="h-16 animate-pulse rounded-xl bg-inset/70" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-inset/70"
            />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-inset/70" />
      </div>
    );
  }

  const { runtime, stats } = settings;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Account
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Single-company control center — profile, payments, MikroTik, and
            hotspot ops.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          <IconLogout className="h-3.5 w-3.5" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Hotspots
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.hotspots}
          </p>
        </div>
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Packages
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.packages}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Equipment
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.routers}
          </p>
        </div>
        <div className="rounded-xl bg-land-pink p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Live sessions
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.activeSessions}
          </p>
        </div>
      </div>

      <Section
        title="Profile"
        description="How you appear as the hotspot owner. Email is your login and cannot change here."
      >
        <form onSubmit={onSaveProfile} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Full name"
              value={profile.name}
              onChange={(e) =>
                setProfile({ ...profile, name: e.target.value })
              }
              required
            />
            <Input
              label="Login email"
              value={settings.profile.email}
              disabled
            />
            <Input
              label="Business / brand name"
              value={profile.businessName}
              onChange={(e) =>
                setProfile({ ...profile, businessName: e.target.value })
              }
              placeholder="Osu Café Wi‑Fi"
            />
            <Input
              label="Phone"
              value={profile.phone}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
              placeholder="+233 …"
            />
            <Input
              label="Support email"
              type="email"
              value={profile.supportEmail}
              onChange={(e) =>
                setProfile({ ...profile, supportEmail: e.target.value })
              }
              placeholder="help@yourbusiness.gh"
            />
            <Input
              label="Default currency"
              value={profile.currency}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  currency: e.target.value.toUpperCase().slice(0, 3),
                })
              }
              maxLength={3}
              required
            />
          </div>

          <label className="flex w-full flex-col gap-1 md:gap-1.5">
            <span className="text-2xs font-medium text-primary md:text-xs-tight">
              Timezone
            </span>
            <select
              className="rounded-xl border border-border bg-canvas px-2.5 py-2 text-xs-tight outline-none focus:border-primary md:rounded-[10px] md:px-3.5 md:py-2.5 md:text-sm"
              value={profile.timezone}
              onChange={(e) =>
                setProfile({ ...profile, timezone: e.target.value })
              }
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title="Free Mode"
        description="Complimentary Wi‑Fi for a holiday or promo. Choose All locations (default) or a single site override."
        action={
          settings.freeMode?.active && freeMode.hotspotId === LOCATION_ALL ? (
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-success">
              Live now
            </span>
          ) : freeMode.enabled ? (
            <span className="rounded-full bg-land-yellow px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-land-ink">
              Scheduled
            </span>
          ) : null
        }
      >
        <form onSubmit={onSaveFreeMode} className="space-y-3">
          <label className="flex w-full flex-col gap-1 md:gap-1.5">
            <span className="text-2xs font-medium text-primary md:text-xs-tight">
              Location
            </span>
            <select
              className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
              value={freeMode.hotspotId}
              onChange={(e) => selectFreeModeLocation(e.target.value)}
            >
              <option value={LOCATION_ALL}>All locations</option>
              {hotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.freeModeEnabled ? " (site override)" : ""}
                </option>
              ))}
            </select>
            <span className="text-2xs text-muted">
              Site override replaces All locations Free Mode for that portal only.
            </span>
          </label>

          <ToggleRow
            label="Enable Free Mode"
            description="When on and within the from/to window, portal visitors are unlocked for free."
            checked={freeMode.enabled}
            onChange={(next) => setFreeMode({ ...freeMode, enabled: next })}
          />

          <div>
            <p className="mb-1.5 text-2xs font-medium text-primary">
              Quick suggestions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "1h", label: "1 hour" },
                  { id: "3h", label: "3 hours" },
                  { id: "today", label: "Rest of today" },
                  { id: "1d", label: "1 day" },
                  { id: "weekend", label: "Weekend" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyFreePreset(p.id)}
                  className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[10px] font-medium text-secondary hover:border-primary hover:text-primary"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="From (date & time)"
              type="datetime-local"
              value={freeMode.startsAt}
              onChange={(e) =>
                setFreeMode({ ...freeMode, startsAt: e.target.value })
              }
              required={freeMode.enabled}
            />
            <Input
              label="To (date & time)"
              type="datetime-local"
              value={freeMode.endsAt}
              onChange={(e) =>
                setFreeMode({ ...freeMode, endsAt: e.target.value })
              }
              required={freeMode.enabled}
            />
          </div>

          <label className="flex w-full flex-col gap-1 md:gap-1.5">
            <span className="text-2xs font-medium text-primary md:text-xs-tight">
              Speed profile package (optional)
            </span>
            <select
              className="rounded-xl border border-border bg-canvas px-2.5 py-2 text-xs-tight outline-none focus:border-primary md:rounded-[10px] md:px-3.5 md:py-2.5 md:text-sm"
              value={freeMode.packageId}
              onChange={(e) =>
                setFreeMode({ ...freeMode, packageId: e.target.value })
              }
            >
              <option value="">First enabled package</option>
              {(settings.packages ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
            <span className="text-2xs text-muted">
              Access lasts until the Free Mode end time. The package only sets
              bandwidth / speed profile.
            </span>
          </label>

          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm" disabled={savingFreeMode}>
              {savingFreeMode ? "Saving…" : "Save Free Mode"}
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title="Notification preferences"
        description="Control which in-app alerts you receive. Saved with your profile."
      >
        <div className="space-y-2">
          <ToggleRow
            label="Payment success"
            description="Alert when a customer completes checkout."
            checked={profile.notifyPaymentSuccess}
            onChange={(v) =>
              setProfile({ ...profile, notifyPaymentSuccess: v })
            }
          />
          <ToggleRow
            label="Session expired"
            description="Alert when a live Wi‑Fi session ends."
            checked={profile.notifySessionExpired}
            onChange={(v) =>
              setProfile({ ...profile, notifySessionExpired: v })
            }
          />
          <ToggleRow
            label="System notices"
            description="Maintenance and platform messages."
            checked={profile.notifySystem}
            onChange={(v) => setProfile({ ...profile, notifySystem: v })}
          />
        </div>
        <p className="mt-2 text-2xs text-muted">
          Click <span className="font-medium text-secondary">Save profile</span>{" "}
          above to persist these toggles.
        </p>
      </Section>

      <Section
        title="Paystack packages"
        description="Per location: turn online package purchase on or off. Off hides the Packages tab — voucher redeem and Activate stay available."
        action={
          paystackEnabled ? (
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-success">
              Packages on
            </span>
          ) : (
            <span className="rounded-full bg-inset px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">
              Voucher only
            </span>
          )
        }
      >
        <form onSubmit={onSavePaystack} className="space-y-3">
          <label className="flex w-full flex-col gap-1 md:gap-1.5">
            <span className="text-2xs font-medium text-primary md:text-xs-tight">
              Location
            </span>
            <select
              className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
              value={paystackLocationId}
              onChange={(e) => selectPaystackLocation(e.target.value)}
              required
            >
              {hotspots.length === 0 ? (
                <option value="">No locations yet</option>
              ) : (
                hotspots.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.paystackEnabled ? "" : " (voucher only)"}
                  </option>
                ))
              )}
            </select>
          </label>

          <ToggleRow
            label="Enable Paystack packages"
            description="When off, visitors only see voucher redeem and Activate — no package list or Paystack checkout."
            checked={paystackEnabled}
            onChange={setPaystackEnabled}
          />

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={savingPaystack || !paystackLocationId}
            >
              {savingPaystack ? "Saving…" : "Save Paystack setting"}
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title="Payments"
        description="Checkout provider for customer portals. Secrets stay in environment variables."
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-2xs text-muted">Admin auth</dt>
            <dd className="mt-0.5 text-xs-tight font-semibold">
              Supabase
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Mode</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <span className="text-xs-tight font-semibold capitalize">
                {runtime.paymentMode}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  runtime.paymentMode === "paystack"
                    ? "bg-success/10 text-success"
                    : "bg-inset text-secondary"
                }`}
              >
                {runtime.paymentMode === "paystack"
                  ? "Live charges"
                  : "Test checkout (no live charges)"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Paystack keys</dt>
            <dd className="mt-0.5 text-xs-tight font-medium">
              {runtime.paystackConfigured ? "Configured" : "Not set"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-2xs text-muted">App URL</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-inset px-2 py-1 text-[11px]">
                {runtime.appUrl}
              </code>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={async () => {
                  await copyText(runtime.appUrl);
                  toast.success("Copied", "App URL copied to clipboard.");
                }}
              >
                Copy
              </Button>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-2xs text-muted">Webhook URL</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-inset px-2 py-1 text-[11px]">
                {runtime.webhookUrl}
              </code>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={async () => {
                  await copyText(runtime.webhookUrl);
                  toast.success("Copied", "Webhook URL copied.");
                }}
              >
                Copy
              </Button>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-2xs text-muted md:text-xs-tight">
          Set{" "}
          <code className="rounded bg-inset px-1">PAYMENT_MODE=paystack</code>{" "}
          plus{" "}
          <code className="rounded bg-inset px-1">PAYSTACK_SECRET_KEY</code>{" "}
          (and usually the same value for{" "}
          <code className="rounded bg-inset px-1">PAYSTACK_WEBHOOK_SECRET</code>
          ) in the VPS{" "}
          <code className="rounded bg-inset px-1">.env.local</code>, then
          restart the server. Point Paystack webhooks at the URL above. A
          successful charge always writes{" "}
          <code className="rounded bg-inset px-1">payments</code> +{" "}
          <code className="rounded bg-inset px-1">payment_callbacks</code> in
          Supabase before unlock; paid customers are never marked failed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-2xs font-medium hover:bg-surface md:text-xs-tight"
          >
            <IconPayments className="h-3.5 w-3.5" />
            View payments
          </Link>
        </div>
      </Section>

      <Section
        title="Router & equipment"
        description="One company, many sites. Attach gear per hotspot; MikroTik can be live via REST."
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-2xs text-muted">Adapter mode</dt>
            <dd className="mt-0.5 text-xs-tight font-semibold capitalize">
              {runtime.mikrotik.adapterMode}
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Linked equipment</dt>
            <dd className="mt-0.5 text-xs-tight font-semibold">
              {stats.routers} device{stats.routers === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">MikroTik in UI</dt>
            <dd className="mt-0.5 text-xs-tight font-medium">
              {runtime.mikrotik.routersConfigured > 0
                ? `${runtime.mikrotik.routersConfigured} configured`
                : "None yet — use setup wizard"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Deployment</dt>
            <dd className="mt-0.5 text-xs-tight font-semibold">
              Single company
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-2xs text-muted md:text-xs-tight">
          Enter host, username, and password in the MikroTik wizard — same as
          other billing platforms. Test until status shows Online. Unlock needs
          the customer MAC from the captive portal.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/router/setup">
            <Button type="button" size="sm">
              MikroTik setup wizard
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={testingMikroTik}
            onClick={() => void testMikroTik()}
          >
            {testingMikroTik ? "Testing…" : "Test MikroTik"}
          </Button>
          <Link
            href="/router"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-2xs font-medium hover:bg-surface md:text-xs-tight"
          >
            Router dashboard
          </Link>
          <Link
            href="/hotspots"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-2xs font-medium hover:bg-surface md:text-xs-tight"
          >
            <IconHotspots className="h-3.5 w-3.5" />
            Manage hotspots
          </Link>
          <Link
            href="/packages"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-2xs font-medium hover:bg-surface md:text-xs-tight"
          >
            <IconPackages className="h-3.5 w-3.5" />
            Packages
          </Link>
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-2xs font-medium hover:bg-surface md:text-xs-tight"
          >
            <IconSessions className="h-3.5 w-3.5" />
            Sessions
          </Link>
        </div>
      </Section>

      <Section
        title="Security"
        description="Change your password. You’ll stay signed in on this device."
      >
        <form onSubmit={onChangePassword} className="space-y-3">
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={password.currentPassword}
            onChange={(e) =>
              setPassword({ ...password, currentPassword: e.target.value })
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password.newPassword}
              onChange={(e) =>
                setPassword({ ...password, newPassword: e.target.value })
              }
              required
              minLength={8}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={password.confirmPassword}
              onChange={(e) =>
                setPassword({ ...password, confirmPassword: e.target.value })
              }
              required
              minLength={8}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={savingPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title="Account"
        description="Member since and session controls."
        action={
          <span className="rounded-full bg-inset px-2 py-0.5 text-[9px] font-semibold text-secondary md:text-2xs">
            Owner
          </span>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-2xs text-muted">Account created</dt>
            <dd className="mt-0.5 text-xs-tight font-medium">
              {new Date(settings.profile.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Last profile update</dt>
            <dd className="mt-0.5 text-xs-tight font-medium">
              {new Date(settings.profile.updatedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-border bg-surface/50 p-3">
          <IconSettings className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <p className="text-2xs text-muted md:text-xs-tight">
            Built for <strong>one company</strong>: one login runs all Accra /
            Kumasi / Takoradi (etc.) hotspots, packages, vouchers, and
            subscriptions. Not a multi-tenant SaaS marketplace.
          </p>
        </div>
      </Section>
    </div>
  );
}
