"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Button } from "@/components/ui/button";

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

export default function PortalCheckTimePage({ params }: Props) {
  const { hotspotId } = use(params);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ref = reference.trim();
    if (!ref) {
      setError("Enter your payment or free-access reference");
      return;
    }
    setError("");
    window.location.href = `/portal/${hotspotId}/success?reference=${encodeURIComponent(ref)}`;
  }

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
              Session status
            </p>
            <h1 className="font-display mt-1 text-[1.65rem] leading-[1.05] tracking-tight text-brand-ink sm:text-[1.85rem]">
              Check time left
            </h1>
            <p className="mt-1.5 text-[12px] leading-snug text-secondary">
              Enter the reference from your success screen — paid, voucher, or
              free (for example{" "}
              <span className="font-mono text-[11px]">
                free_3a12ddd4_ae020234_…
              </span>
              ) — to see remaining Wi‑Fi time.
            </p>

            <form
              onSubmit={onSubmit}
              className="animate-fade-up-delay mt-4 space-y-2.5"
            >
              <PortalField
                label="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value.trim())}
                placeholder="free_… or pay_…"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono text-[12px]"
              />
              {error ? (
                <p className="text-[12px] text-danger">{error}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full rounded-xl py-2.5 text-[13px]"
              >
                Check time
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
              <Link
                href={`/portal/${hotspotId}`}
                className="text-[10px] font-medium text-secondary underline underline-offset-2"
              >
                ← Back to portal
              </Link>
              <Link
                href={`/portal/${hotspotId}/account`}
                className="text-[10px] font-medium text-secondary underline underline-offset-2"
              >
                My account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
