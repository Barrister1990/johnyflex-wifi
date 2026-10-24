"use client";

import { useEffect, useRef } from "react";

/**
 * After Free Mode (deferred unlock), nudge MikroTik once the success page loads.
 * Captive browsers often leave the checkout page before unlock finishes.
 */
export function PortalAutoUnlock({
  reference,
  macAddress,
}: {
  reference: string;
  macAddress?: string | null;
}) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !reference) return;
    ran.current = true;
    void fetch("/api/payments/ensure-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        ...(macAddress ? { macAddress } : {}),
      }),
    }).catch(() => undefined);
  }, [reference, macAddress]);

  return null;
}
