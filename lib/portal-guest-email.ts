import { randomBytes } from "crypto";
import { findDeviceByMac } from "@/lib/repositories/devices";
import { getCustomerById } from "@/lib/repositories/customers";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";

/** Stable guest email for a known MAC — same phone always maps to the same address. */
export function generateStableGuestEmail(macAddress: string): string {
  const mac = normalizeMac(macAddress);
  const tag = (mac ?? macAddress).replace(/[^0-9a-f]/gi, "").toLowerCase();
  return `guest.${tag || randomBytes(4).toString("hex")}@wifi.edumatetechnologies.com`;
}

/** One-off guest email when MAC is unknown. */
export function generateGuestEmail(macAddress?: string | null): string {
  const mac = normalizeMac(macAddress);
  if (mac && isUsableClientMac(mac)) return generateStableGuestEmail(mac);
  const tag = randomBytes(4).toString("hex");
  const stamp = Date.now().toString(36);
  return `guest.${tag}.${stamp}@wifi.edumatetechnologies.com`.toLowerCase();
}

/**
 * Prefer provided email → existing customer for this MAC → stable guest for MAC.
 * Attaches identity in DB when device+customer already exist for the MAC.
 */
export async function resolvePortalEmail(
  provided: string | null | undefined,
  macAddress?: string | null,
): Promise<string> {
  const trimmed = provided?.trim().toLowerCase() ?? "";
  if (trimmed.includes("@") && trimmed.length >= 5) return trimmed;

  const mac = normalizeMac(macAddress);
  if (mac && isUsableClientMac(mac)) {
    try {
      const device = await findDeviceByMac(mac);
      if (device) {
        const customer = await getCustomerById(device.customerId);
        if (customer?.email) return customer.email.toLowerCase();
      }
    } catch {
      /* fall through to stable guest */
    }
    return generateStableGuestEmail(mac);
  }

  return generateGuestEmail(null);
}

export function isGuestPortalEmail(email: string): boolean {
  return (
    /^guest\./i.test(email.trim()) &&
    email.includes("@wifi.edumatetechnologies.com")
  );
}
