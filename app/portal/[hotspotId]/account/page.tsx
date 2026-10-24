"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import type { CustomerPortalAccount } from "@/lib/types";

type Props = { params: Promise<{ hotspotId: string }> };

function PortalField({
  label,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1">
      {label ? (
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-secondary">
          {label}
        </span>
      ) : null}
      <input
        id={inputId}
        className={`portal-field rounded-xl border border-border/80 bg-white/90 px-3 py-2.5 text-primary outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(15,17,21,0.06)] ${className}`}
        {...props}
      />
    </label>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </h2>
  );
}

function printReceipt(
  r: CustomerPortalAccount["receipts"][number],
  site: string,
) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Receipt ${r.reference}</title>
    <style>body{font-family:system-ui;padding:24px;color:#111}h1{font-size:18px}p{font-size:13px;margin:6px 0}.muted{color:#666}</style>
    </head><body>
    <h1>JohnnyFlex receipt</h1>
    <p class="muted">${site}</p>
    <p><strong>Reference:</strong> ${r.reference}</p>
    <p><strong>Package:</strong> ${r.packageName}</p>
    <p><strong>Amount:</strong> ${r.currency} ${r.amount.toFixed(2)}</p>
    <p><strong>Provider:</strong> ${r.provider}</p>
    <p><strong>Status:</strong> ${r.status}</p>
    <p><strong>Date:</strong> ${new Date(r.createdAt).toLocaleString()}</p>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

export default function PortalAccountPage({ params }: Props) {
  const { hotspotId } = use(params);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<CustomerPortalAccount | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/portal/${hotspotId}/account?email=${encodeURIComponent(email)}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not load account");
      setAccount(null);
      return;
    }
    setAccount(data.account);
  }

  async function renew(packageId: string) {
    if (!account) return;
    setRenewingId(packageId);
    const res = await fetch("/api/payments/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotspotId,
        packageId,
        email: account.email,
      }),
    });
    const data = await res.json();
    setRenewingId(null);
    if (!res.ok) {
      setError(data.error ?? "Could not start renewal");
      return;
    }
    window.location.href = data.authorizationUrl;
  }

  const backHref = account
    ? `/portal/${account.hotspot.slug}`
    : `/portal/${hotspotId}`;

  return (
    <div className="portal-page relative flex min-h-[100vh] items-start justify-center px-3 pb-8 pt-6 sm:items-center sm:px-4 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(90% 70% at 10% -10%, rgba(200,245,66,0.22), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(13,61,44,0.85), transparent 55%), linear-gradient(180deg, #041a12 0%, #0d3d2c 55%, #041a12 100%)",
        }}
      />

      <div className="portal-shell w-full max-w-[22rem] sm:max-w-md">
        <div className="animate-fade-up rounded-[1rem] border border-border bg-[#f3f6f3] shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)]">
          <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="portal-brand-mark">JF</span>
              <p className="font-display text-[14px] font-bold tracking-[-0.03em] text-brand-ink">
                JohnnyFlex
              </p>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Self-service
            </p>
            <h1 className="font-display mt-1 text-[1.65rem] leading-[1.05] tracking-tight text-brand-ink sm:text-[1.85rem]">
              My Wi‑Fi account
            </h1>
            <p className="mt-1.5 text-[12px] leading-snug text-secondary">
              Usage, receipts, devices, and renew — lookup with your checkout
              email.
            </p>

            <form
              onSubmit={lookup}
              className="animate-fade-up-delay mt-4 space-y-2.5"
            >
              <PortalField
                label="Email used at checkout"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />
              <Button
                type="submit"
                className="w-full rounded-xl py-2.5 text-[13px]"
                disabled={loading}
              >
                {loading ? "Loading…" : "Look up"}
              </Button>
            </form>

            {error ? (
              <p className="mt-2.5 text-[12px] text-danger">{error}</p>
            ) : null}

            {account ? (
              <div className="animate-fade-up-delay-2 mt-4 space-y-4 border-t border-border/70 pt-4">
                <p className="text-[11px] leading-snug text-secondary">
                  Showing{" "}
                  <span className="font-medium text-primary">
                    {account.email}
                  </span>{" "}
                  at{" "}
                  <span className="font-medium text-primary">
                    {account.hotspot.name}
                  </span>
                </p>

                <section className="space-y-2">
                  <SectionTitle>Active usage</SectionTitle>
                  {account.activeSessions.length === 0 ? (
                    <p className="rounded-xl bg-inset/70 px-3 py-2.5 text-[11px] text-muted">
                      No live session.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {account.activeSessions.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-xl border border-border/80 bg-white/70 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-semibold tracking-tight">
                              {s.packageName}
                            </p>
                            <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-semibold text-success">
                              {s.remainingMinutes}m left
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-snug text-muted">
                            {s.speedProfile} · {s.deviceName}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            Ends {new Date(s.endsAt).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <SectionTitle>Devices</SectionTitle>
                  {account.devices.length === 0 ? (
                    <p className="rounded-xl bg-inset/70 px-3 py-2.5 text-[11px] text-muted">
                      No devices yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {account.devices.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-xl border border-border/80 bg-white/70 px-3 py-2.5"
                        >
                          <p className="text-[12px] font-semibold tracking-tight">
                            {d.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted">
                            {[d.macAddress, d.phone].filter(Boolean).join(" · ") ||
                              "No MAC / phone"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <SectionTitle>Receipts</SectionTitle>
                  {account.receipts.length === 0 ? (
                    <p className="rounded-xl bg-inset/70 px-3 py-2.5 text-[11px] text-muted">
                      No receipts yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {account.receipts.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-white/70 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold tracking-tight">
                              {r.packageName}
                            </p>
                            <p className="text-[11px] tabular-nums text-primary">
                              {r.currency} {r.amount.toFixed(2)}
                            </p>
                            <p className="truncate font-mono text-[9px] text-muted">
                              {r.reference}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            className="shrink-0 rounded-lg text-[10px]"
                            onClick={() =>
                              printReceipt(r, account.hotspot.name)
                            }
                          >
                            Print
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <SectionTitle>Renew package</SectionTitle>
                  {account.packages.length === 0 ? (
                    <p className="rounded-xl bg-inset/70 px-3 py-2.5 text-[11px] text-muted">
                      No packages available to renew.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {account.packages.map((pkg) => (
                        <li
                          key={pkg.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-white/70 px-3 py-2.5"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate text-[12px] font-semibold tracking-tight">
                              {pkg.name}
                            </p>
                            <p className="text-[10px] text-muted">
                              {pkg.currency} {pkg.price.toFixed(2)} ·{" "}
                              {pkg.speedProfile}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            className="shrink-0 rounded-lg text-[10px]"
                            disabled={renewingId === pkg.id}
                            onClick={() => void renew(pkg.id)}
                          >
                            {renewingId === pkg.id ? "…" : "Renew"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}

            <div className="mt-4 border-t border-border/70 pt-3">
              <Link
                href={backHref}
                className="text-[10px] font-medium text-secondary underline underline-offset-2"
              >
                ← Back to portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
