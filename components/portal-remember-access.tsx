"use client";

import { useEffect } from "react";
import { writePortalRoamCookieToDocument } from "@/lib/portal-roam-cookie";

/**
 * Persist a short-lived cookie after pay/redeem/roam so the guest can continue
 * remaining time at another site even if the phone uses a new private MAC.
 */
export function PortalRememberAccess({
  reference,
  ownerId,
  endsAt,
}: {
  reference: string;
  ownerId: string;
  endsAt: string;
}) {
  useEffect(() => {
    if (!reference || !ownerId || !endsAt) return;
    if (new Date(endsAt).getTime() <= Date.now()) return;
    writePortalRoamCookieToDocument({ reference, ownerId, endsAt });
  }, [reference, ownerId, endsAt]);

  return null;
}
