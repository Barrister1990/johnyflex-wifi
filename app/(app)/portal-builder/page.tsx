"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Hotspot, PortalTheme } from "@/lib/types";

type FormState = {
  hotspotId: string | null;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
  backgroundImageUrl: string;
  termsText: string;
  showPackages: boolean;
  showVoucherRedeem: boolean;
};

const empty: FormState = {
  hotspotId: null,
  logoUrl: "",
  primaryColor: "#041a12",
  accentColor: "#c8f542",
  welcomeMessage: "Buy Wi‑Fi access and get online in seconds.",
  backgroundImageUrl: "",
  termsText:
    "By purchasing access you agree to fair-use of this network. Illegal activity is prohibited. Unused time is non-refundable.",
  showPackages: true,
  showVoucherRedeem: true,
};

export default function PortalBuilderPage() {
  const toast = useToast();
  const [themes, setThemes] = useState<PortalTheme[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [tRes, hRes] = await Promise.all([
      fetch("/api/portal-themes"),
      fetch("/api/hotspots"),
    ]);
    const tData = await tRes.json();
    const hData = await hRes.json();
    if (tRes.ok) {
      setThemes(tData.themes);
      const def =
        tData.themes.find((t: PortalTheme) => t.hotspotId == null) ?? null;
      if (def) {
        setForm({
          hotspotId: null,
          logoUrl: def.logoUrl ?? "",
          primaryColor: def.primaryColor,
          accentColor: def.accentColor,
          welcomeMessage: def.welcomeMessage,
          backgroundImageUrl: def.backgroundImageUrl ?? "",
          termsText: def.termsText,
          showPackages: def.showPackages,
          showVoucherRedeem: def.showVoucherRedeem,
        });
      } else if (tData.defaults) {
        setForm({
          ...empty,
          ...tData.defaults,
          logoUrl: tData.defaults.logoUrl ?? "",
          backgroundImageUrl: tData.defaults.backgroundImageUrl ?? "",
          hotspotId: null,
        });
      }
    }
    if (hRes.ok) setHotspots(hData.hotspots);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function selectScope(hotspotId: string | null) {
    const existing = themes.find((t) => (t.hotspotId ?? null) === hotspotId);
    if (existing) {
      setForm({
        hotspotId,
        logoUrl: existing.logoUrl ?? "",
        primaryColor: existing.primaryColor,
        accentColor: existing.accentColor,
        welcomeMessage: existing.welcomeMessage,
        backgroundImageUrl: existing.backgroundImageUrl ?? "",
        termsText: existing.termsText,
        showPackages: existing.showPackages,
        showVoucherRedeem: existing.showVoucherRedeem,
      });
      return;
    }
    setForm({ ...empty, hotspotId });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/portal-themes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotspotId: form.hotspotId,
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        welcomeMessage: form.welcomeMessage,
        backgroundImageUrl: form.backgroundImageUrl || null,
        termsText: form.termsText,
        showPackages: form.showPackages,
        showVoucherRedeem: form.showVoucherRedeem,
      }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not save theme", data.error);
    else {
      toast.success("Portal theme saved");
      await load();
      selectScope(form.hotspotId);
    }
    setSaving(false);
  }

  const previewHotspot = useMemo(
    () =>
      (form.hotspotId
        ? hotspots.find((h) => h.id === form.hotspotId)
        : hotspots[0]) ?? null,
    [form.hotspotId, hotspots],
  );

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-inset/70" />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
          Captive portal
        </p>
        <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
          Portal builder
        </h1>
        <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
          Customize logo, colors, welcome copy, packages, vouchers, and terms.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={onSave}
          className="space-y-3 rounded-xl border border-border bg-canvas p-3 md:rounded-2xl md:p-5"
        >
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium">Apply to</span>
            <select
              className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
              value={form.hotspotId ?? ""}
              onChange={(e) =>
                selectScope(e.target.value ? e.target.value : null)
              }
            >
              <option value="">All hotspots (default)</option>
              {hotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Welcome message"
            value={form.welcomeMessage}
            onChange={(e) =>
              setForm({ ...form, welcomeMessage: e.target.value })
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Primary color"
              value={form.primaryColor}
              onChange={(e) =>
                setForm({ ...form, primaryColor: e.target.value })
              }
              required
            />
            <Input
              label="Accent color"
              value={form.accentColor}
              onChange={(e) =>
                setForm({ ...form, accentColor: e.target.value })
              }
              required
            />
          </div>
          <Input
            label="Logo URL (optional)"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="https://…"
          />
          <Input
            label="Background image URL (optional)"
            value={form.backgroundImageUrl}
            onChange={(e) =>
              setForm({ ...form, backgroundImageUrl: e.target.value })
            }
            placeholder="https://…"
          />
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium">Terms & conditions</span>
            <textarea
              className="min-h-24 rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
              value={form.termsText}
              onChange={(e) =>
                setForm({ ...form, termsText: e.target.value })
              }
              required
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <span className="text-xs-tight font-medium">Show packages</span>
            <input
              type="checkbox"
              checked={form.showPackages}
              onChange={(e) =>
                setForm({ ...form, showPackages: e.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <span className="text-xs-tight font-medium">
              Show voucher redeem
            </span>
            <input
              type="checkbox"
              checked={form.showVoucherRedeem}
              onChange={(e) =>
                setForm({ ...form, showVoucherRedeem: e.target.checked })
              }
            />
          </label>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save theme"}
          </Button>
        </form>

        <div
          className="relative overflow-hidden rounded-xl border border-border p-4 md:rounded-2xl md:p-6"
          style={{
            backgroundColor: "#041a12",
            backgroundImage: form.backgroundImageUrl
              ? `linear-gradient(rgba(4,26,18,0.88), rgba(13,61,44,0.85)), url(${form.backgroundImageUrl})`
              : "radial-gradient(90% 70% at 10% -10%, rgba(200,245,66,0.22), transparent 55%), linear-gradient(180deg, #041a12 0%, #0d3d2c 100%)",
            backgroundSize: "cover",
          }}
        >
          <p className="text-2xs font-semibold uppercase tracking-wide text-brand/70">
            Live preview
          </p>
          <div className="mt-4 rounded-[1rem] border border-border bg-[#f3f6f3] p-4 shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)]">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoUrl}
                alt="Logo"
                className="mb-3 h-8 object-contain"
              />
            ) : (
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[10px] font-extrabold text-brand-ink">
                  JF
                </span>
                <p className="font-display text-[14px] font-bold tracking-[-0.03em] text-brand-ink">
                  JohnnyFlex
                </p>
              </div>
            )}
            <h2
              className="font-display text-xl font-bold tracking-tight"
              style={{ color: form.primaryColor }}
            >
              {previewHotspot?.name ?? "Your hotspot"}
            </h2>
            <p className="mt-2 text-sm text-secondary">{form.welcomeMessage}</p>
            {form.showPackages ? (
              <div className="mt-4 rounded-xl border border-border bg-white px-3 py-2 text-xs-tight">
                Sample package · GHS 5.00
              </div>
            ) : null}
            {form.showVoucherRedeem ? (
              <p className="mt-3 text-2xs text-muted">Voucher code entry on</p>
            ) : null}
            <button
              type="button"
              className="mt-4 w-full rounded-xl px-3 py-2 text-xs-tight font-medium text-white"
              style={{ backgroundColor: form.accentColor }}
            >
              Continue
            </button>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              {form.termsText.slice(0, 140)}
              {form.termsText.length > 140 ? "…" : ""}
            </p>
          </div>
          {previewHotspot ? (
            <Link
              href={previewHotspot.qrPayload || `/portal/${previewHotspot.slug}`}
              className="mt-3 inline-block text-2xs font-medium underline"
              target="_blank"
            >
              Open live portal
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
