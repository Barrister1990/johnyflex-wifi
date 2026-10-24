"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ROUTER_CATALOG } from "@/lib/routers/catalog";
import type { HotspotWithRouter } from "@/lib/types";

const STEPS = [
  { id: "gear", title: "Gear checklist" },
  { id: "cable", title: "Cable & power" },
  { id: "routeros", title: "RouterOS + REST" },
  { id: "vpn", title: "Remote access (VPN)" },
  { id: "hotspot", title: "Captive hotspot" },
  { id: "connect", title: "Connect JohnnyFlex" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type AccessMode = "local" | "cloud";

const MIKROTIK_MODELS = ROUTER_CATALOG.filter(
  (item) => item.adapterType === "mikrotik" && item.available,
);

function CopyBlock({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="rounded-xl border border-border bg-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <button
          type="button"
          className="text-2xs font-medium text-accent underline"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            toast.success("Copied", label);
          }}
        >
          Copy
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-primary">
        {value}
      </pre>
    </div>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-secondary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

export function MikroTikSetupWizard() {
  const toast = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [hotspots, setHotspots] = useState<HotspotWithRouter[]>([]);
  const [appUrl, setAppUrl] = useState("https://your-domain.com");
  const [wireguard, setWireguard] = useState({
    vpsPublicIp: "" as string,
    vpsPublicKey: "" as string,
    peerPrivateKey: "" as string,
    serverAddress: "10.8.0.1",
    peerAddress: "10.8.0.2",
    listenPort: 51820,
    scriptReady: false,
    present: {
      vpsPublicIp: false,
      vpsPublicKey: false,
      peerPrivateKey: false,
    },
    envCwd: "",
    envFilesLoaded: [] as string[],
  });
  const [loadingHotspots, setLoadingHotspots] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedRouterId, setSavedRouterId] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("local");
  const [linkStatus, setLinkStatus] = useState<{
    status: string;
    message?: string;
  } | null>(null);

  const [form, setForm] = useState({
    hotspotId: "",
    catalogId: MIKROTIK_MODELS[0]?.id ?? "mikrotik-hap-ax3",
    label: "",
    host: "192.168.88.1",
    port: "80",
    username: "admin",
    password: "",
    secure: false,
    notes: "",
  });

  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const portalHost = useMemo(() => {
    try {
      return new URL(appUrl).host;
    } catch {
      return "your-domain.com";
    }
  }, [appUrl]);

  const walledGardenScript = `/ip hotspot walled-garden
add dst-host=${portalHost} action=allow comment="JohnnyFlex portal"
add dst-host=*.paystack.com action=allow comment="Paystack"
add dst-host=*.paystack.co action=allow comment="Paystack CDN"`;

  const restEnableScript = `/ip service
set www disabled=no
set www-ssl disabled=no
# Prefer www-ssl (443) in production
/user
print
# Create a dedicated API user with full rights, not your personal login`;

  const wireguardScript = useMemo(() => {
    const vpsIp = wireguard.vpsPublicIp || "YOUR_VPS_IP";
    const vpsKey = wireguard.vpsPublicKey || "VPS_PUBLIC_KEY";
    const peerPriv = wireguard.peerPrivateKey || "MIKROTIK_PRIVATE_KEY";
    const server = wireguard.serverAddress || "10.8.0.1";
    const peer = wireguard.peerAddress || "10.8.0.2";
    const port = wireguard.listenPort || 51820;
    return `# PASTE THIS IN THE MIKROTIK TERMINAL ONLY
# (Winbox → New Terminal, or SSH into the router — NOT the VPS shell)
/interface wireguard
add listen-port=13231 mtu=1420 name=wg-johnnyflex private-key="${peerPriv}"
/interface wireguard peers
add name=vps allowed-address=${server}/32 endpoint-address=${vpsIp} endpoint-port=${port} \\
    interface=wg-johnnyflex public-key="${vpsKey}" persistent-keepalive=25s
/ip address
add address=${peer}/32 interface=wg-johnnyflex
# Required: without this route, handshake works but ping/REST to the VPS fail
/ip route
add dst-address=${server}/32 gateway=wg-johnnyflex comment="JohnnyFlex VPS via WG"
/interface list member
add list=LAN interface=wg-johnnyflex
/ip service
set www disabled=no

# After paste: WireGuard → wg-johnnyflex should show a handshake.
# From VPS: ping ${peer} && curl http://${peer}/rest/system/resource
# Then in JohnnyFlex use Host ${peer} with your REST API user/password.`;
  }, [wireguard]);

  const scriptReady = Boolean(
    wireguard.vpsPublicIp &&
      wireguard.vpsPublicKey &&
      wireguard.peerPrivateKey,
  );

  useEffect(() => {
    async function load() {
      setLoadingHotspots(true);
      const [hsRes, settingsRes] = await Promise.all([
        fetch("/api/hotspots"),
        fetch("/api/settings"),
      ]);
      const hsData = await hsRes.json();
      const settingsData = await settingsRes.json();
      if (hsRes.ok) {
        setHotspots(hsData.hotspots ?? []);
        if (!form.hotspotId && hsData.hotspots?.[0]?.id) {
          setForm((prev) => ({ ...prev, hotspotId: hsData.hotspots[0].id }));
        }
      }
      if (settingsRes.ok) {
        const runtime =
          settingsData.settings?.runtime ?? settingsData.runtime ?? null;
        if (runtime?.appUrl) {
          setAppUrl(runtime.appUrl);
        } else if (typeof window !== "undefined") {
          setAppUrl(window.location.origin);
        }
        const wg = runtime?.wireguard;
        if (wg) {
          setWireguard({
            vpsPublicIp: wg.vpsPublicIp ?? "",
            vpsPublicKey: wg.vpsPublicKey ?? "",
            peerPrivateKey: wg.peerPrivateKey ?? "",
            serverAddress: wg.serverAddress ?? "10.8.0.1",
            peerAddress: wg.peerAddress ?? "10.8.0.2",
            listenPort: wg.listenPort ?? 51820,
            scriptReady: Boolean(wg.scriptReady),
            present: {
              vpsPublicIp: Boolean(wg.present?.vpsPublicIp ?? wg.vpsPublicIp),
              vpsPublicKey: Boolean(wg.present?.vpsPublicKey ?? wg.vpsPublicKey),
              peerPrivateKey: Boolean(
                wg.present?.peerPrivateKey ?? wg.peerPrivateKey,
              ),
            },
            envCwd: wg.envCwd ?? "",
            envFilesLoaded: Array.isArray(wg.envFilesLoaded)
              ? wg.envFilesLoaded
              : [],
          });
          if (wg.peerAddress && !form.host) {
            setForm((prev) => ({
              ...prev,
              host: prev.host || wg.peerAddress,
            }));
          }
        }
      } else if (typeof window !== "undefined") {
        setAppUrl(window.location.origin);
      }
      setLoadingHotspots(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form.hotspotId) {
      toast.error("Select a hotspot", "Create a hotspot first if you have none.");
      return;
    }
    if (!form.host.trim()) {
      toast.error("Host required", "Enter the MikroTik VPN or LAN IP.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/routers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalogId: form.catalogId,
        hotspotId: form.hotspotId,
        label: form.label.trim() || undefined,
        host: form.host.trim(),
        port: Number(form.port) || (form.secure ? 443 : 80),
        username: form.username.trim() || "admin",
        password: form.password || null,
        notes:
          form.notes.trim() ||
          `MikroTik wizard · REST ${form.secure ? "https" : "http"}`,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save router", data.error);
      return;
    }
    setSavedRouterId(data.router.id);
    setLinkStatus({
      status: data.router.connectionStatus ?? "pending",
      message: "Saved. Click Test connection.",
    });
    toast.success(
      "MikroTik saved",
      "Credentials stored. Test the connection next.",
    );
  }

  async function onTest() {
    if (!savedRouterId) {
      toast.error("Save first", "Save the router before testing.");
      return;
    }
    setTesting(true);
    const res = await fetch(`/api/routers/${savedRouterId}/test`, {
      method: "POST",
    });
    const data = await res.json();
    setTesting(false);
    if (!res.ok) {
      toast.error("Connection test failed", data.error);
      setLinkStatus({ status: "error", message: data.error });
      return;
    }
    const status = data.router?.connectionStatus;
    const message = data.router?.message as string | undefined;
    setLinkStatus({ status: status ?? "unknown", message });
    if (status === "connected" || status === "mock") {
      toast.success("MikroTik connected", message ?? "RouterOS REST responded.");
    } else if (status === "error") {
      toast.error("MikroTik offline", message ?? "Could not reach REST API");
    } else if (status === "unconfigured") {
      toast.error("Not configured", message ?? "Add host and credentials first.");
    } else {
      toast.info("Check recorded", message ?? `Status: ${status ?? "unknown"}`);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">
            Installation
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            MikroTik setup wizard
          </h1>
          <p className="mt-1 max-w-xl text-sm text-secondary">
            Start on your laptop (same Wi‑Fi/LAN as the MikroTik). When unlock
            works locally, switch Host to the WireGuard IP and deploy on the
            VPS.
          </p>
        </div>
        <Link href="/router">
          <Button variant="secondary" size="sm">
            Router dashboard
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-canvas">
        <div className="border-b border-border bg-surface px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs font-semibold text-muted">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <p className="text-2xs font-medium text-primary">{step.title}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(i)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  i === stepIndex
                    ? "bg-primary text-white"
                    : i < stepIndex
                      ? "bg-success/10 text-success"
                      : "bg-inset text-muted"
                }`}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6">
          {step.id === "gear" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                What you need on site
              </h2>
              <p className="text-sm text-secondary">
                JohnnyFlex runs in the cloud. MikroTik controls who gets internet.
                Starlink only supplies the uplink.
              </p>
              <ul className="space-y-2 text-sm text-secondary">
                <li className="rounded-xl border border-border px-3 py-2">
                  <span className="font-semibold text-primary">Starlink</span> —
                  dish + router/PoE for internet into the building
                </li>
                <li className="rounded-xl border border-border px-3 py-2">
                  <span className="font-semibold text-primary">MikroTik</span> —
                  hAP ax³ / ac² or similar with RouterOS v7 (captive portal)
                </li>
                <li className="rounded-xl border border-border px-3 py-2">
                  <span className="font-semibold text-primary">JohnnyFlex cloud</span>{" "}
                  — already running (your company server). You only add the
                  router login in this wizard.
                </li>
                <li className="rounded-xl border border-border px-3 py-2">
                  <span className="font-semibold text-primary">Laptop once</span>{" "}
                  — Winbox for first-time MikroTik setup
                </li>
              </ul>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Customers join MikroTik Wi‑Fi → pay on JohnnyFlex → JohnnyFlex tells
                MikroTik to unlock that phone. Without MikroTik REST + VPN,
                payments cannot open the internet.
              </div>
            </div>
          ) : null}

          {step.id === "cable" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Cable Starlink into MikroTik
              </h2>
              <StepList
                items={[
                  "Mount and power Starlink until it shows online.",
                  "Connect Starlink LAN (or its router LAN port) to MikroTik WAN / ether1.",
                  "Connect your laptop to a MikroTik LAN port (or Wi‑Fi after first setup).",
                  "Power the MikroTik and wait ~1 minute for boot.",
                  "Default address is often 192.168.88.1 — open Winbox or http://192.168.88.1",
                ]}
              />
              <p className="text-sm text-secondary">
                Goal: Starlink = internet in; MikroTik = Wi‑Fi + billing control
                out to customers.
              </p>
            </div>
          ) : null}

          {step.id === "routeros" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Prepare RouterOS for JohnnyFlex
              </h2>
              <StepList
                items={[
                  "Login with Winbox (Neighbors tab finds the device on LAN).",
                  "Change the default admin password immediately.",
                  "System → Packages / Check for updates — use RouterOS v7+.",
                  "Enable WWW and WWW-SSL (REST API uses these, not the old 8728 API alone).",
                  "Create a dedicated user for JohnnyFlex (e.g. johnnyflex) with a strong password.",
                  "Note the IP JohnnyFlex will use later: LAN IP for testing, or WireGuard IP for production.",
                ]}
              />
              <CopyBlock label="Enable web / REST services" value={restEnableScript} />
              <p className="text-2xs text-muted">
                JohnnyFlex talks to{" "}
                <code className="rounded bg-inset px-1">/rest</code> with HTTP
                Basic auth. Prefer HTTPS (443) when possible.
              </p>
            </div>
          ) : null}

          {step.id === "vpn" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Remote access (optional for local testing)
              </h2>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessMode("local");
                    setForm((prev) => ({
                      ...prev,
                      host:
                        prev.host === wireguard.peerAddress ||
                        prev.host === "10.8.0.2"
                          ? "192.168.88.1"
                          : prev.host || "192.168.88.1",
                      notes: "Local LAN · REST http",
                    }));
                  }}
                  className={`rounded-full px-3 py-1.5 text-2xs font-semibold ${
                    accessMode === "local"
                      ? "bg-primary text-white"
                      : "bg-inset text-muted"
                  }`}
                >
                  Local LAN (now)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccessMode("cloud");
                    setForm((prev) => ({
                      ...prev,
                      host: wireguard.peerAddress || "10.8.0.2",
                      notes: "MikroTik wizard · REST http",
                    }));
                  }}
                  className={`rounded-full px-3 py-1.5 text-2xs font-semibold ${
                    accessMode === "cloud"
                      ? "bg-primary text-white"
                      : "bg-inset text-muted"
                  }`}
                >
                  Cloud / VPS (later)
                </button>
              </div>

              {accessMode === "local" ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                    Skip WireGuard for now. Put your laptop on the same network
                    as the MikroTik, then in the last step use the router’s LAN
                    IP (usually{" "}
                    <code className="rounded bg-white/50 px-1">192.168.88.1</code>
                    ).
                  </div>
                  <StepList
                    items={[
                      "Connect laptop Wi‑Fi/Ethernet to the MikroTik LAN (or café network).",
                      "In Winbox, note the MikroTik LAN IP (IP → Addresses).",
                      "Enable WWW (REST) if not already — previous step.",
                      "Continue to Connect JohnnyFlex and use that LAN IP as Host.",
                      "When local Test works, come back here and switch to Cloud / VPS.",
                    ]}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-secondary">
                    Your cloud already has WireGuard. On the café MikroTik, paste
                    the script below in Terminal (keys come from your server env),
                    then continue — no SSH on site.
                  </p>
                  <StepList
                    items={[
                      "On the café MikroTik only: Winbox → New Terminal. Do not paste this on the VPS.",
                      "Copy the script below and paste it into that MikroTik terminal.",
                      "Winbox → WireGuard → wg-johnnyflex: confirm last handshake updates.",
                      `In Connect JohnnyFlex: Host = ${wireguard.peerAddress || "10.8.0.2"} + REST user/password → Test.`,
                    ]}
                  />
                  {scriptReady ? (
                    <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                      Script is live for your VPS ({wireguard.vpsPublicIp}). Paste
                      on MikroTik, then test the link in the next step.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <p>
                        Cloud WireGuard env is incomplete. On the VPS put keys in{" "}
                        <code className="rounded bg-white/60 px-1">.env.local</code>
                        , then restart the JohnnyFlex app.
                      </p>
                      <ul className="mt-2 list-inside list-disc text-2xs">
                        <li>
                          WIREGUARD_VPS_PUBLIC_IP —{" "}
                          {wireguard.present.vpsPublicIp ? "ok" : "missing"}
                        </li>
                        <li>
                          WIREGUARD_VPS_PUBLIC_KEY —{" "}
                          {wireguard.present.vpsPublicKey ? "ok" : "missing"}
                        </li>
                        <li>
                          WIREGUARD_PEER_PRIVATE_KEY —{" "}
                          {wireguard.present.peerPrivateKey ? "ok" : "missing"}
                        </li>
                      </ul>
                    </div>
                  )}
                  <CopyBlock
                    label="Paste into MikroTik Terminal"
                    value={wireguardScript}
                  />
                </div>
              )}
            </div>
          ) : null}

          {step.id === "hotspot" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Captive portal + walled garden
              </h2>
              <StepList
                items={[
                  "Phase 1 (no separate AP): Hotspot Setup on the bridge/LAN that includes wifi1 — customers join MikroTik Wi‑Fi directly.",
                  "IP → Hotspot → Hotspot Setup — pick that bridge / wifi interface.",
                  "Set the local Hotspot address network (often 192.168.88.0/24).",
                  "SSID = JohnnyFlex WiFi (open). Match the SSID on the JohnnyFlex hotspot.",
                  "Trial = none. Unpaid phones must be blocked until JohnnyFlex unlocks them.",
                  "Replace hotspot/login.html so it redirects to JohnnyFlex (ngrok URL locally) with ?mac=$(mac).",
                  "Walled garden: allow your ngrok host (local) or production domain (+ Paystack).",
                  "Test: join MikroTik SSID on a phone — portal opens; internet stays closed until pay/voucher.",
                  "Phase 2 later: add Access Points in bridge mode; customers join AP SSID only.",
                ]}
              />
              <CopyBlock
                label="Portal URL pattern (local: use ngrok HTTPS)"
                value={`${appUrl}/portal/your-hotspot-slug?mac=$(mac)`}
              />
              <CopyBlock
                label="Walled garden (allow JohnnyFlex + Paystack)"
                value={walledGardenScript}
              />
              <p className="text-2xs text-muted">
                Full local checklist:{" "}
                <code className="rounded bg-inset px-1">
                  LOCAL_MIKROTIK_SETUP.md
                </code>
                . Always pass MAC (
                <code className="rounded bg-inset px-1">?mac=$(mac)</code>) so
                unlock targets the correct phone.
              </p>
            </div>
          ) : null}

          {step.id === "connect" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Add MikroTik in JohnnyFlex
              </h2>
              <p className="text-sm text-secondary">
                {accessMode === "local" ? (
                  <>
                    Local mode: Host must be the MikroTik{" "}
                    <strong>LAN IP</strong> (not 10.8.0.2). Username/password =
                    Winbox login. Your laptop must reach that IP.
                  </>
                ) : (
                  <>
                    Cloud mode: Host = WireGuard IP{" "}
                    <code className="rounded bg-inset px-1">
                      {wireguard.peerAddress || "10.8.0.2"}
                    </code>
                    . Username/password = Winbox / REST user.
                  </>
                )}
              </p>

              {loadingHotspots ? (
                <p className="text-sm text-muted">Loading hotspots…</p>
              ) : hotspots.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-4 text-sm">
                  <p className="font-semibold">No hotspot yet</p>
                  <p className="mt-1 text-secondary">
                    Create a site first, then return here to attach MikroTik.
                  </p>
                  <Link href="/hotspots" className="mt-3 inline-block">
                    <Button size="sm">Create hotspot</Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={onSave} className="space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-medium">Hotspot / site</span>
                    <select
                      className="rounded-xl border border-border bg-canvas px-3 py-2.5 text-sm outline-none focus:border-primary"
                      value={form.hotspotId}
                      onChange={(e) =>
                        setForm({ ...form, hotspotId: e.target.value })
                      }
                      required
                    >
                      {hotspots.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.ssid})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-medium">MikroTik model</span>
                    <select
                      className="rounded-xl border border-border bg-canvas px-3 py-2.5 text-sm outline-none focus:border-primary"
                      value={form.catalogId}
                      onChange={(e) =>
                        setForm({ ...form, catalogId: e.target.value })
                      }
                    >
                      {MIKROTIK_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.vendor} {m.model}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Input
                    label="Label"
                    value={form.label}
                    onChange={(e) =>
                      setForm({ ...form, label: e.target.value })
                    }
                    placeholder="Accra Café hAP ax³"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Host / IP"
                      value={form.host}
                      onChange={(e) =>
                        setForm({ ...form, host: e.target.value })
                      }
                      placeholder={
                        accessMode === "local"
                          ? "192.168.88.1"
                          : wireguard.peerAddress || "10.8.0.2"
                      }
                      required
                    />
                    <Input
                      label="REST port"
                      type="number"
                      value={form.port}
                      onChange={(e) =>
                        setForm({ ...form, port: e.target.value })
                      }
                      placeholder="80"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Username"
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      required
                    />
                    <Input
                      label="Password"
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      required
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input
                      type="checkbox"
                      checked={form.secure}
                      onChange={(e) => {
                        const secure = e.target.checked;
                        setForm({
                          ...form,
                          secure,
                          port: secure
                            ? "443"
                            : form.port === "443"
                              ? "80"
                              : form.port,
                        });
                      }}
                    />
                    Use HTTPS (www-ssl / port 443)
                  </label>

                  <Input
                    label="Notes (optional)"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Front counter AP"
                  />

                  {linkStatus ? (
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        linkStatus.status === "connected" ||
                        linkStatus.status === "mock"
                          ? "border-success/30 bg-success/10 text-success"
                          : linkStatus.status === "error"
                            ? "border-danger/30 bg-danger/10 text-danger"
                            : "border-border bg-surface text-secondary"
                      }`}
                    >
                      <p className="font-semibold">
                        {linkStatus.status === "connected"
                          ? "MikroTik successfully linked"
                          : linkStatus.status === "error"
                            ? "Link failed — Offline"
                            : linkStatus.status === "mock"
                              ? "Mock router ready"
                              : linkStatus.status}
                      </p>
                      {linkStatus.message ? (
                        <p className="mt-0.5 text-2xs opacity-90">
                          {linkStatus.message}
                        </p>
                      ) : null}
                      {linkStatus.status === "connected" ? (
                        <p className="mt-1.5 text-2xs opacity-90">
                          Shown as linked on Dashboard and Hotspots. Customers
                          can be unlocked after pay or voucher.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? "Saving…" : "Save MikroTik"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!savedRouterId || testing}
                      onClick={() => void onTest()}
                    >
                      {testing ? "Testing…" : "Test connection"}
                    </Button>
                    {savedRouterId ? (
                      <Link href="/hotspots">
                        <Button type="button" size="sm" variant="secondary">
                          Print portal QR
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 md:px-5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          {stepIndex < STEPS.length - 1 ? (
            <Button type="button" size="sm" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Link href="/router">
              <Button type="button" size="sm">
                Finish
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export type { StepId };
