"use client";

import { useEffect, useId } from "react";
import { IconWifi } from "@/components/icons";

type Props = {
  open: boolean;
  onClose: () => void;
  ssid: string;
  accentColor?: string;
};

const STEPS = [
  {
    n: "1",
    title: "Join the Wi‑Fi",
    body: (ssid: string) => (
      <>
        Open phone Settings → Wi‑Fi and connect to{" "}
        <span className="font-semibold text-primary">{ssid}</span>.
      </>
    ),
  },
  {
    n: "2",
    title: "Use the login screen",
    body: () => (
      <>
        When the Wi‑Fi login / captive page opens, stay on that screen — don’t
        open this link in a normal browser tab.
      </>
    ),
  },
  {
    n: "3",
    title: "Then pay or redeem",
    body: () => (
      <>
        After this page loads from the login screen, pick a package or enter
        your voucher and continue.
      </>
    ),
  },
] as const;

export function PortalWifiLoginModal({
  open,
  onClose,
  ssid,
  accentColor = "#c8f542",
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="portal-wifi-modal fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="portal-wifi-backdrop"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[1.5rem] bg-white shadow-[0_-12px_40px_-12px_rgba(15,17,21,0.35)] sm:rounded-[1.5rem] sm:shadow-xl"
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />

        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex items-start gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: accentColor }}
            >
              <IconWifi className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Almost there
              </p>
              <h2
                id={titleId}
                className="font-display mt-1 text-[1.45rem] leading-tight tracking-tight text-primary sm:text-[1.6rem]"
              >
                Open from the Wi‑Fi login screen
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="portal-link -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-inset"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="mt-3 text-[14px] leading-relaxed text-secondary">
            We need your device on{" "}
            <span className="font-mono font-medium text-primary">{ssid}</span>{" "}
            so we can unlock the internet after you pay or redeem.
          </p>

          <ol className="mt-5 space-y-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="flex gap-3 rounded-2xl border border-border/80 bg-inset/60 px-3.5 py-3.5"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {step.n}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[14px] font-semibold text-primary">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-secondary">
                    {step.body(ssid)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-2xl bg-land-yellow/80 px-4 py-3.5 text-land-ink">
            <p className="text-[13px] font-semibold">Tip</p>
            <p className="mt-1 text-[13px] leading-relaxed opacity-90">
              On many phones a pop-up appears after joining Wi‑Fi — tap it, or
              open the notification that says “Sign in to network”.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="portal-cta mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/** True when an API / guard message is about missing captive-portal MAC. */
export function isWifiLoginMacError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("wi‑fi login") ||
    m.includes("wifi login") ||
    m.includes("login screen") ||
    m.includes("device mac") ||
    m.includes("captive") ||
    (m.includes("mac") && m.includes("connect"))
  );
}
