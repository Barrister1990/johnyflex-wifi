import { packageVisibleAtHotspot } from "@/lib/packages/visibility";
import {
  getHotspotById,
  getHotspotBySlugOrId,
  listHotspotsByOwner,
} from "@/lib/repositories/hotspots";
import {
  getPackageByIdPublic,
  listEnabledPackagesByOwner,
  listPackagesByOwner,
} from "@/lib/repositories/packages";
import { getCustomerById } from "@/lib/repositories/customers";
import { getPaymentByReference } from "@/lib/repositories/payments";
import { getDeviceById } from "@/lib/repositories/devices";
import {
  getSessionById,
  getSessionByPaymentId,
  listSessionsByHotspotIds,
  updateSessionStatus,
} from "@/lib/repositories/sessions";
import { requireUser } from "@/lib/services/auth";
import { getOwnerFreeModeForHotspot } from "@/lib/services/free-mode";
import { resolvePortalTheme } from "@/lib/services/portal-themes";
import { listPortalSubscriptionPlans } from "@/lib/services/subscriptions";
import { processExpiredSessions } from "@/lib/services/session-expiry";
import {
  hotspotHasLiveMikroTik,
  revokeSessionAccess,
} from "@/lib/router/session-access";
import type {
  Customer,
  DeviceSession,
  Hotspot,
  Package,
  Payment,
  PortalFreeMode,
  PortalTheme,
  SessionListItem,
  SubscriptionPlan,
} from "@/lib/types";

export async function listOwnerSessions(
  hotspotId?: string | null,
): Promise<SessionListItem[]> {
  const user = await requireUser();
  const allOwnerHotspots = await listHotspotsByOwner(user.id);
  const ownerHotspots =
    hotspotId && allOwnerHotspots.some((h) => h.id === hotspotId)
      ? allOwnerHotspots.filter((h) => h.id === hotspotId)
      : allOwnerHotspots;
  const hotspotIds = ownerHotspots.map((h) => h.id);
  // Cut off expired access on MikroTik (no auto-renew)
  await processExpiredSessions(hotspotIds);
  const sessions = await listSessionsByHotspotIds(hotspotIds);

  const hotspotMap = new Map(ownerHotspots.map((h) => [h.id, h]));
  const packages = await listPackagesByOwner(user.id);
  const packageMap = new Map(packages.map((p) => [p.id, p]));

  const customerIds = [
    ...new Set(sessions.map((s) => s.customerId).filter(Boolean)),
  ];
  const { listCustomersByIds } = await import("@/lib/repositories/customers");
  const customers = await listCustomersByIds(customerIds);
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return sessions.map((s) => ({
    ...s,
    hotspotName: hotspotMap.get(s.hotspotId)?.name ?? "Unknown",
    packageName: packageMap.get(s.packageId)?.name ?? "Unknown",
    customerEmail: customerMap.get(s.customerId)?.email ?? "Unknown",
  }));
}

/**
 * Cut off a live session in WiFiHub and on the site MikroTik
 * (works for phones on the AP — they still authenticate through that router).
 */
export async function revokeOwnerSession(sessionId: string) {
  const user = await requireUser();
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  const hotspot = await getHotspotById(session.hotspotId, user.id);
  if (!hotspot) throw new Error("Session not found");
  if (session.status !== "active") {
    throw new Error("Only live sessions can be revoked");
  }

  const updated = await updateSessionStatus(sessionId, "revoked");
  if (!updated) throw new Error("Could not update session");

  const device = await getDeviceById(session.deviceId);
  await revokeSessionAccess({
    hotspotId: session.hotspotId,
    sessionId,
    macAddress: device?.macAddress ?? null,
  });

  return { ok: true, session: updated };
}

/** Bulk revoke live sessions (max 100). Continues on per-session MikroTik errors. */
export async function revokeOwnerSessions(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) throw new Error("Select at least one session");
  if (unique.length > 100) throw new Error("Too many sessions (max 100)");

  let revoked = 0;
  const errors: string[] = [];
  for (const id of unique) {
    try {
      await revokeOwnerSession(id);
      revoked += 1;
    } catch (error) {
      errors.push(
        `${id.slice(0, 8)}: ${error instanceof Error ? error.message : "failed"}`,
      );
    }
  }

  if (!revoked && errors.length) {
    throw new Error(errors[0] ?? "Could not revoke sessions");
  }

  return {
    revoked,
    failed: errors.length,
    errors: errors.slice(0, 5),
  };
}

export async function getPortalData(slugOrId: string): Promise<{
  hotspot: Hotspot;
  packages: Package[];
  subscriptionPlans: SubscriptionPlan[];
  theme: PortalTheme;
  /** True when this site has MikroTik credentials — portal requires MAC. */
  liveMikroTik: boolean;
  freeMode: PortalFreeMode | null;
}> {
  const hotspot = await getHotspotBySlugOrId(slugOrId);
  if (!hotspot) {
    throw new Error("Hotspot not found");
  }

  const packages = (
    await listEnabledPackagesByOwner(hotspot.ownerId)
  ).filter((p) => packageVisibleAtHotspot(p, hotspot.id));

  const theme = await resolvePortalTheme(hotspot.ownerId, hotspot.id);
  const subscriptionPlans = await listPortalSubscriptionPlans(hotspot.id);
  const liveMikroTik = await hotspotHasLiveMikroTik(hotspot.id);
  const freeMode = await getOwnerFreeModeForHotspot(slugOrId);

  return { hotspot, packages, subscriptionPlans, theme, liveMikroTik, freeMode };
}

export async function getSuccessContext(reference: string): Promise<{
  payment: Payment;
  session: DeviceSession;
  hotspot: Hotspot;
  pkg: Package;
  customer: Customer | null;
  unlockOk: boolean;
  unlockError?: string;
} | null> {
  const payment = await getPaymentByReference(reference);
  if (!payment) return null;

  // Callback may race ahead of webhook; recover paid+session if needed.
  // Always re-ensure unlock for roam (and any existing session) so the
  // current site's MikroTik gets the binding, not a stale deferred job.
  let session = await getSessionByPaymentId(payment.id);
  let unlockOk = true;
  let unlockError: string | undefined;

  const needsEnsure =
    payment.status !== "success" ||
    !session ||
    payment.provider === "roam";

  if (needsEnsure) {
    try {
      const { ensureAccessForPayment } = await import(
        "@/lib/services/payments"
      );
      const result = await ensureAccessForPayment(
        reference,
        payment.clientMac ?? undefined,
      );
      session = result.session;
      unlockOk = result.unlockOk;
      unlockError = result.unlockError;
      if (result.payment.status !== "success") return null;
    } catch {
      if (payment.status !== "success" || !session) return null;
    }
  }

  if (!session) return null;

  const hotspot = await getHotspotById(payment.hotspotId);
  const pkg = await getPackageByIdPublic(payment.packageId);
  if (!hotspot || !pkg) return null;

  const customer = await getCustomerById(session.customerId);
  const freshPayment = await getPaymentByReference(reference);

  return {
    payment: freshPayment ?? payment,
    session,
    hotspot,
    pkg,
    customer,
    unlockOk,
    unlockError,
  };
}
