"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  reference: string;
  macAddress?: string | null;
};

export function RetryUnlockButton({ reference, macAddress }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onRetry() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/ensure-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          ...(macAddress ? { macAddress } : {}),
        }),
      });
      const json = (await res.json()) as {
        unlockOk?: boolean;
        unlockError?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setMessage(json.error || "Could not retry unlock");
        return;
      }
      if (json.unlockOk) {
        window.location.href = `${window.location.pathname}?reference=${encodeURIComponent(reference)}`;
        return;
      }
      setMessage(
        json.unlockError ||
          "Still unlocking — stay on this Wi‑Fi and try again in a few seconds.",
      );
    } catch {
      setMessage("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <Button size="sm" disabled={busy} onClick={onRetry}>
        {busy ? "Retrying…" : "Retry Wi‑Fi unlock"}
      </Button>
      {message ? (
        <p className="text-[11px] leading-relaxed text-amber-900/90">{message}</p>
      ) : null}
    </div>
  );
}
