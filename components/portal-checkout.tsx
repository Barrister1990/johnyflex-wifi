"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
} from "react";
import { IconWifi } from "@/components/icons";
import {
  PortalWifiLoginModal,
  isWifiLoginMacError,
} from "@/components/portal-wifi-login-modal";
import { portalPath } from "@/lib/hotspots/slug";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { readPortalRoamCookieFromDocument } from "@/lib/portal-roam-cookie";
import type {
  Hotspot,
  Package,
  PortalFreeMode,
  PortalTheme,
  SubscriptionPlan,
} from "@/lib/types";

type Props = {
  hotspot: Hotspot;
  packages: Package[];
  subscriptionPlans: SubscriptionPlan[];
  theme: PortalTheme;
  initialMac?: string | null;
  initialError?: string | null;
  requireMac?: boolean;
  freeMode?: PortalFreeMode | null;
};

type Tab = "plans" | "voucher";

type PlanPick =
  | { kind: "package"; id: string }
  | { kind: "subscription"; id: string }
  | { kind: "free" };

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  if (minutes >= 43_200) return "1 month";
  return `${Math.round(minutes / 1440)} day`;
}

function PortalField({
  label,
  error,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}) {
  const inputId = id ?? props.name;
  return (
    <label className="portal-field-label flex w-full flex-col gap-1.5">
      {label ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
          {label}
        </span>
      ) : null}
      <input
        id={inputId}
        className={`portal-field min-h-12 w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-primary outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(15,17,21,0.08)] ${
          error ? "border-danger" : ""
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </label>
  );
}

function StatusPanel({
  status,
  hotspotName,
}: {
  status: Hotspot["status"];
  hotspotName: string;
}) {
  if (status === "active") return null;

  const isMaintenance = status === "maintenance";
  return (
    <div
      className={`rounded-2xl px-4 py-5 ${
        isMaintenance ? "bg-land-yellow text-land-ink" : "bg-inset text-primary"
      }`}
      role="status"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
        {isMaintenance ? "Maintenance" : "Closed"}
      </p>
      <p className="font-display mt-1 text-[1.4rem] leading-tight tracking-tight">
        {isMaintenance
          ? `${hotspotName} is under maintenance`
          : `${hotspotName} is temporarily closed`}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed opacity-80">
        {isMaintenance
          ? "Purchases and vouchers are paused. Come back shortly."
          : "This hotspot is not accepting new sessions right now."}
      </p>
    </div>
  );
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "Ending soon";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins} min left`;
}

function PlanRadio({
  name,
  value,
  checked,
  title,
  subtitle,
  price,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  title: string;
  subtitle: string;
  price: string;
  onChange?: () => void;
}) {
  return (
    <label
      className={`portal-plan ${checked ? "portal-plan-active" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        required
      />
      <span className="portal-plan-icon" aria-hidden>
        <IconWifi className="h-5 w-5" />
      </span>
      <span className="portal-plan-body">
        <span className="portal-plan-title">{title}</span>
        <span className="portal-plan-sub">{subtitle}</span>
      </span>
      <span className="portal-plan-price">{price}</span>
    </label>
  );
}

function HiddenPortalFields({
  intent,
  hotspotId,
  hotspotSlug,
  macAddress,
  connectedToWifi,
}: {
  intent: "pay" | "redeem" | "free";
  hotspotId: string;
  hotspotSlug: string;
  macAddress: string | null;
  connectedToWifi: boolean;
}) {
  return (
    <>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="hotspotId" value={hotspotId} />
      <input type="hidden" name="hotspotSlug" value={hotspotSlug} />
      {macAddress ? (
        <input type="hidden" name="macAddress" value={macAddress} />
      ) : null}
      {connectedToWifi ? (
        <input type="hidden" name="connectedToWifi" value="1" />
      ) : null}
    </>
  );
}

export function PortalCheckout({
  hotspot,
  packages,
  subscriptionPlans,
  theme,
  initialMac = null,
  initialError = null,
  requireMac = false,
  freeMode: freeModeProp = null,
}: Props) {
  const salesOpen = hotspot.status === "active";
  const [freeMode, setFreeMode] = useState<PortalFreeMode | null>(freeModeProp);
  const freeActive = Boolean(freeMode?.active);
  const showPlans =
    freeActive ||
    (theme.showPackages && packages.length > 0) ||
    subscriptionPlans.length > 0;
  const firstTab: Tab =
    showPlans || theme.showPackages || freeActive ? "plans" : "voucher";
  const [tab, setTab] = useState<Tab>(firstTab);
  const [pick, setPick] = useState<PlanPick | null>(() => {
    if (freeModeProp?.active) return { kind: "free" };
    if (theme.showPackages && packages[0]) {
      return { kind: "package", id: packages[0].id };
    }
    if (subscriptionPlans[0]) {
      return { kind: "subscription", id: subscriptionPlans[0].id };
    }
    return null;
  });
  const [voucherCode, setVoucherCode] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [jsReady, setJsReady] = useState(false);

  const clientMac = useMemo(() => {
    const n = normalizeMac(initialMac);
    return isUsableClientMac(n) ? n : null;
  }, [initialMac]);

  useEffect(() => {
    setJsReady(true);
  }, []);

  useEffect(() => {
    setFreeMode(freeModeProp);
  }, [freeModeProp]);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  // Clear loading overlay if navigation stalls (common in captive browsers).
  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setLoading(false), 45_000);
    return () => window.clearTimeout(id);
  }, [loading]);

  // Auto-roam: remaining time at another site of the same owner.
  // Uses MAC and/or continue cookie (private MAC often changes per SSID).
  useEffect(() => {
    if (!salesOpen) return;
    const continueRef = readPortalRoamCookieFromDocument();
    if (!clientMac && !continueRef) return;
    // Cookie from another operator must not be sent.
    if (continueRef && continueRef.ownerId !== hotspot.ownerId) return;

    let cancelled = false;
    async function tryRoam() {
      try {
        const res = await fetch("/api/portal/roam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hotspotId: hotspot.id,
            ...(clientMac ? { macAddress: clientMac } : {}),
            ...(continueRef ? { continueReference: continueRef.reference } : {}),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          roamed?: boolean;
          reference?: string;
          reason?: string;
        };
        if (cancelled || !data.roamed || !data.reference) {
          if (!cancelled && data.reason === "no_mac") {
            setShowWifiModal(true);
          }
          return;
        }
        window.location.replace(
          `${portalPath(hotspot, "/success")}?reference=${encodeURIComponent(data.reference)}`,
        );
      } catch {
        /* paywall stays */
      }
    }
    void tryRoam();
    return () => {
      cancelled = true;
    };
  }, [clientMac, hotspot, salesOpen]);

  useEffect(() => {
    let cancelled = false;
    async function refreshFreeMode() {
      try {
        const res = await fetch(`/api/portal/${hotspot.id}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          freeMode?: PortalFreeMode | null;
        };
        if (cancelled || !("freeMode" in data)) return;
        const next = data.freeMode?.active ? (data.freeMode ?? null) : null;
        setFreeMode(next);
        if (next?.active) {
          setPick({ kind: "free" });
          setTab("plans");
        }
      } catch {
        /* keep SSR freeMode */
      }
    }
    void refreshFreeMode();
    return () => {
      cancelled = true;
    };
  }, [hotspot.id]);

  useEffect(() => {
    if (!freeActive) return;
    setPick({ kind: "free" });
    setTab("plans");
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [freeActive]);

  const onNetworkDetected = Boolean(clientMac);
  const [connectedToWifi, setConnectedToWifi] = useState(onNetworkDetected);
  const networkReady = onNetworkDetected || connectedToWifi;

  const selectedPackage = useMemo(() => {
    if (pick?.kind !== "package") return null;
    return packages.find((p) => p.id === pick.id) ?? null;
  }, [packages, pick]);

  const selectedPlan = useMemo(() => {
    if (pick?.kind !== "subscription") return null;
    return subscriptionPlans.find((p) => p.id === pick.id) ?? null;
  }, [subscriptionPlans, pick]);

  const freeSelected = pick?.kind === "free";

  function macPayload() {
    return clientMac ? { macAddress: clientMac } : {};
  }

  function guardMac(): boolean {
    if (requireMac && !clientMac) {
      setShowWifiModal(true);
      setError("");
      return false;
    }
    return true;
  }

  function showApiError(message: string) {
    if (isWifiLoginMacError(message)) {
      setShowWifiModal(true);
      setError("");
      return;
    }
    setError(message);
  }

  function guardStatus(): boolean {
    if (!salesOpen) {
      setError(
        hotspot.status === "maintenance"
          ? "This hotspot is under maintenance."
          : "This hotspot is closed.",
      );
      return false;
    }
    return true;
  }

  async function claimFreeAccess() {
    if (!freeMode?.active || !guardStatus() || !guardMac()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotspotId: hotspot.id,
          ...macPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        showApiError(data.error ?? "Could not start free access");
        return;
      }
      window.location.replace(
        `${portalPath(hotspot, "/success")}?reference=${encodeURIComponent(data.reference)}`,
      );
    } catch {
      setLoading(false);
      setError("Could not start free access. Check your Wi‑Fi and try again.");
    }
  }

  async function onCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (freeSelected) {
      await claimFreeAccess();
      return;
    }
    if (!guardStatus() || !guardMac()) return;
    if (!selectedPackage && !selectedPlan) return;
    if (jsReady && !networkReady) {
      setError(`Join ${hotspot.ssid} first, then try again.`);
      return;
    }
    setLoading(true);
    setError("");
    const body = selectedPackage
      ? {
          hotspotId: hotspot.id,
          packageId: selectedPackage.id,
          ...macPayload(),
        }
      : {
          hotspotId: hotspot.id,
          subscriptionPlanId: selectedPlan!.id,
          ...macPayload(),
        };
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        showApiError(data.error ?? "Could not start payment");
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch {
      // Fall back to native form POST (captive browsers often break fetch).
      e.currentTarget.submit();
    }
  }

  async function onRedeem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!guardStatus() || !guardMac()) return;
    if (jsReady && !networkReady) {
      setError(`Join ${hotspot.ssid} first, then try again.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotspotId: hotspot.id,
          code: voucherCode,
          ...macPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        showApiError(data.error ?? "Could not redeem voucher");
        return;
      }
      window.location.replace(
        `${portalPath(hotspot, "/success")}?reference=${encodeURIComponent(data.reference)}`,
      );
    } catch {
      e.currentTarget.submit();
    }
  }

  const accent = theme.accentColor || "#c8f542";
  const onAccent =
    accent.toLowerCase() === "#c8f542" ? "#041a12" : "#ffffff";
  const freeCurrency = freeMode?.currency ?? "GHS";
  const payLabel = freeSelected
    ? "Connect free"
    : selectedPackage
      ? `Pay ${selectedPackage.currency} ${selectedPackage.price.toFixed(2)}`
      : selectedPlan
        ? `Subscribe ${selectedPlan.currency} ${selectedPlan.price}`
        : "Pay";
  const canPay = freeSelected
    ? Boolean(freeMode?.active)
    : Boolean(selectedPackage || selectedPlan);
  const freeRemaining =
    freeMode?.active
      ? formatRemaining(new Date(freeMode.endsAt).getTime() - nowTick)
      : "";

  const connectingLabel = freeActive
    ? "Connecting you…"
    : tab === "voucher"
      ? "Redeeming voucher…"
      : "Starting payment…";
  const connectingHint =
    freeActive || tab === "voucher"
      ? "Please wait — unlocking Wi‑Fi. Keep this screen open."
      : "Please wait — opening secure checkout.";

  const showPackageTab =
    !freeActive && (theme.showPackages || subscriptionPlans.length > 0);
  const showVoucherTab = !freeActive && theme.showVoucherRedeem;
  const hotspotSlug = hotspot.slug || hotspot.id;

  return (
    <div className="portal-shell w-full max-w-none sm:max-w-md">
      {loading ? (
        <div
          className="portal-connecting"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="portal-connecting-card">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: accent, color: onAccent }}
            >
              <IconWifi className="h-7 w-7 animate-pulse" />
            </div>
            <p className="font-display mt-4 text-[1.35rem] leading-tight tracking-tight">
              {connectingLabel}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-secondary">
              {connectingHint}
            </p>
            <div className="portal-progress-track">
              <div
                className="portal-progress"
                style={{ backgroundColor: accent }}
              />
            </div>
            <p className="mt-4 text-[12px] text-muted">
              Do not close this page or leave {hotspot.ssid}.
            </p>
          </div>
        </div>
      ) : null}

      <div
        className="portal-card rounded-none border-0 bg-[#f3f6f3] shadow-none sm:rounded-[1rem] sm:border sm:border-border sm:shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)]"
        style={{ borderTopColor: accent || "#c8f542", borderTopWidth: 3, borderTopStyle: "solid" }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt=""
                className="mb-2 h-8 max-w-[9rem] object-contain"
              />
            ) : (
              <div className="mb-2 flex items-center gap-2">
                <span className="portal-brand-mark">JF</span>
                <p
                  className="font-display text-[15px] font-bold tracking-[-0.03em]"
                  style={{ color: theme.primaryColor || "#041a12" }}
                >
                  JohnnyFlex
                </p>
              </div>
            )}
            <h1
              className="font-display mt-1 text-[1.75rem] leading-[1.05] tracking-tight break-words sm:text-[2rem]"
              style={{ color: theme.primaryColor || "#041a12" }}
            >
              {hotspot.name}
            </h1>
            <p className="mt-2 text-[13px] leading-snug text-secondary">
              {theme.welcomeMessage}
            </p>
          </div>
          <span
            className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              hotspot.status === "active"
                ? "bg-success/10 text-success"
                : hotspot.status === "maintenance"
                  ? "bg-land-yellow text-land-ink"
                  : "bg-inset text-muted"
            }`}
          >
            {hotspot.status}
          </span>
        </header>

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-secondary">
          <span className="text-muted">Network</span>
          <span className="rounded-lg bg-inset px-2 py-1 font-mono text-[12px] font-medium text-primary">
            {hotspot.ssid}
          </span>
        </p>

        {!salesOpen ? (
          <div className="mt-5">
            <StatusPanel status={hotspot.status} hotspotName={hotspot.name} />
          </div>
        ) : (
          <>
            <div className="portal-banner">
              {freeActive ? (
                <>
                  <p className="text-[13px] font-semibold tracking-tight">
                    Free Wi‑Fi is available
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed opacity-90">
                    Tap Connect to get online
                    {freeRemaining ? ` · ${freeRemaining}` : ""}.
                  </p>
                  {!onNetworkDetected ? (
                    <label className="mt-3 flex min-h-11 cursor-pointer flex-row items-center gap-3 border-t border-land-ink/10 pt-3 text-[13px] font-medium">
                      <input
                        type="checkbox"
                        name="connectedToWifiUi"
                        defaultChecked={connectedToWifi}
                        onChange={(event) =>
                          setConnectedToWifi(event.target.checked)
                        }
                        className="h-5 w-5 shrink-0 accent-current"
                      />
                      <span>I&apos;m on {hotspot.ssid}</span>
                    </label>
                  ) : null}
                </>
              ) : onNetworkDetected ? (
                <>
                  <p className="text-[13px] font-semibold tracking-tight">
                    Connected to {hotspot.ssid}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed opacity-90">
                    Pick a package or voucher to continue.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold tracking-tight">
                    Connect before you pay
                  </p>
                  <ol className="mt-2 space-y-1.5 text-[13px] leading-relaxed opacity-90">
                    <li>
                      1. Join{" "}
                      <span className="font-semibold">{hotspot.ssid}</span>
                    </li>
                    <li>2. Open this page from the Wi‑Fi login screen</li>
                    <li>3. Pick a package or enter a voucher</li>
                  </ol>
                  <label className="mt-3 flex min-h-11 cursor-pointer flex-row items-center gap-3 border-t border-land-ink/10 pt-3 text-[13px] font-medium">
                    <input
                      type="checkbox"
                      name="connectedToWifiUi"
                      defaultChecked={connectedToWifi}
                      onChange={(event) =>
                        setConnectedToWifi(event.target.checked)
                      }
                      className="h-5 w-5 shrink-0 accent-current"
                    />
                    <span>I&apos;m on {hotspot.ssid}</span>
                  </label>
                </>
              )}
            </div>

            {error ? (
              <p className="mt-4 text-[13px] text-danger" role="alert">
                {error}
              </p>
            ) : null}

            {freeActive && freeMode ? (
              <form
                action="/api/portal/action"
                method="POST"
                onSubmit={onCheckout}
                className="mt-5 space-y-3"
              >
                <HiddenPortalFields
                  intent="free"
                  hotspotId={hotspot.id}
                  hotspotSlug={hotspotSlug}
                  macAddress={clientMac}
                  connectedToWifi={connectedToWifi}
                />
                <div className="portal-plan portal-plan-active">
                  <span className="portal-plan-icon" aria-hidden>
                    <IconWifi className="h-5 w-5" />
                  </span>
                  <span className="portal-plan-body">
                    <span className="portal-plan-title">{freeMode.label}</span>
                    <span className="portal-plan-sub">
                      {freeMode.offer}
                      {freeRemaining ? ` · ${freeRemaining}` : ""}
                    </span>
                  </span>
                  <span className="portal-plan-price">
                    {freeCurrency} 0.00
                  </span>
                </div>
                <div className="portal-sticky">
                  <button
                    type="submit"
                    className="portal-cta"
                    disabled={
                      jsReady && (loading || !networkReady || !canPay)
                    }
                    style={{ backgroundColor: accent, color: onAccent }}
                  >
                    {loading ? "Connecting…" : "Connect free"}
                  </button>
                </div>
                <Link
                  href={portalPath(hotspot, "/check")}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-border/80 bg-white text-center text-[14px] font-medium text-primary"
                >
                  Already connected? Check time
                </Link>
              </form>
            ) : null}

            {!freeActive && (showPackageTab || showVoucherTab) ? (
              <div className="portal-tab-root relative">
                {showPackageTab ? (
                  <input
                    type="radio"
                    name="portalTab"
                    id="portal-tab-plans"
                    className="portal-tab-radio"
                    checked={tab === "plans"}
                    onChange={() => setTab("plans")}
                  />
                ) : null}
                {showVoucherTab ? (
                  <input
                    type="radio"
                    name="portalTab"
                    id="portal-tab-voucher"
                    className="portal-tab-radio"
                    checked={tab === "voucher"}
                    onChange={() => setTab("voucher")}
                  />
                ) : null}

                <div className="portal-tabs mt-5 flex gap-1 rounded-2xl bg-inset p-1">
                  {showPackageTab ? (
                    <label htmlFor="portal-tab-plans" className="portal-tab-label">
                      Packages
                    </label>
                  ) : null}
                  {showVoucherTab ? (
                    <label
                      htmlFor="portal-tab-voucher"
                      className="portal-tab-label"
                    >
                      Voucher
                    </label>
                  ) : null}
                </div>

                {showPackageTab ? (
                  <form
                    action="/api/portal/action"
                    method="POST"
                    onSubmit={onCheckout}
                    className="portal-panel-plans space-y-2.5"
                  >
                    <HiddenPortalFields
                      intent="pay"
                      hotspotId={hotspot.id}
                      hotspotSlug={hotspotSlug}
                      macAddress={clientMac}
                      connectedToWifi={connectedToWifi}
                    />
                    {theme.showPackages
                      ? packages.map((pkg) => {
                          const active =
                            pick?.kind === "package" && pick.id === pkg.id;
                          return (
                            <PlanRadio
                              key={pkg.id}
                              name="offer"
                              value={`package:${pkg.id}`}
                              checked={active}
                              title={pkg.name}
                              subtitle={`${formatDuration(pkg.durationMinutes)} · ${pkg.speedProfile}`}
                              price={`${pkg.currency} ${pkg.price.toFixed(2)}`}
                              onChange={() =>
                                setPick({ kind: "package", id: pkg.id })
                              }
                            />
                          );
                        })
                      : null}

                    {subscriptionPlans.map((plan) => {
                      const active =
                        pick?.kind === "subscription" && pick.id === plan.id;
                      return (
                        <PlanRadio
                          key={plan.id}
                          name="offer"
                          value={`subscription:${plan.id}`}
                          checked={active}
                          title={plan.name}
                          subtitle={`Monthly · ${plan.speedProfile}${plan.dataLimitMb == null ? " · Unlimited" : ""}`}
                          price={`${plan.currency} ${plan.price.toFixed(0)}/mo`}
                          onChange={() =>
                            setPick({ kind: "subscription", id: plan.id })
                          }
                        />
                      );
                    })}

                    {!showPlans && !(theme.showPackages && packages.length) ? (
                      <p className="text-[13px] text-muted">
                        No packages available here.
                      </p>
                    ) : null}

                    <div className="portal-sticky">
                      <button
                        type="submit"
                        className="portal-cta"
                        disabled={
                          jsReady && (loading || !networkReady || !canPay)
                        }
                        style={{ backgroundColor: accent, color: onAccent }}
                      >
                        {loading ? "Redirecting…" : payLabel}
                      </button>
                    </div>
                  </form>
                ) : null}

                {showVoucherTab ? (
                  <form
                    action="/api/portal/action"
                    method="POST"
                    onSubmit={onRedeem}
                    className="portal-panel-voucher space-y-3"
                  >
                    <HiddenPortalFields
                      intent="redeem"
                      hotspotId={hotspot.id}
                      hotspotSlug={hotspotSlug}
                      macAddress={clientMac}
                      connectedToWifi={connectedToWifi}
                    />
                    <PortalField
                      label="Voucher code"
                      name="code"
                      value={voucherCode}
                      onChange={(e) =>
                        setVoucherCode(e.target.value.toUpperCase())
                      }
                      placeholder="WF-83KD-22P9"
                      required
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <div className="portal-sticky">
                      <button
                        type="submit"
                        className="portal-cta"
                        disabled={
                          jsReady &&
                          (loading || !networkReady || !voucherCode.trim())
                        }
                        style={{ backgroundColor: accent, color: onAccent }}
                      >
                        {loading ? "Redeeming…" : "Redeem voucher"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <button
            type="button"
            className="portal-link min-h-10 text-[12px] text-muted underline underline-offset-2"
            onClick={() => setShowTerms((v) => !v)}
          >
            Terms
          </button>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={portalPath(hotspot, "/check")}
              className="portal-link min-h-10 text-[12px] font-semibold underline underline-offset-2"
              style={{ color: accent }}
            >
              Check time
            </Link>
            <Link
              href={portalPath(hotspot, "/account")}
              className="portal-link min-h-10 text-[12px] font-semibold underline underline-offset-2"
              style={{ color: accent }}
            >
              My account
            </Link>
          </div>
        </div>
        {showTerms ? (
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {theme.termsText}
          </p>
        ) : null}
      </div>

      <PortalWifiLoginModal
        open={showWifiModal}
        onClose={() => setShowWifiModal(false)}
        ssid={hotspot.ssid}
        accentColor={accent}
      />
    </div>
  );
}
