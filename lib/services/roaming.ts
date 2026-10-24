import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { listHotspotsByOwner, getHotspotById } from "@/lib/repositories/hotspots";
import { listDevicesByMac } from "@/lib/repositories/devices";
import * as paymentRepo from "@/lib/repositories/payments";
import {
  getSessionByPaymentId,
  listActiveSessionsByCustomerId,
  listActiveSessionsByDeviceIds,
} from "@/lib/repositories/sessions";
import { resolvePortalEmail } from "@/lib/portal-guest-email";
import { hotspotHasLiveMikroTik } from "@/lib/router/session-access";
import { provisionAccessFromPayment } from "@/lib/services/payments";
import type { DeviceSession, Hotspot, Package, Payment } from "@/lib/types";
import { getPackageById } from "@/lib/repositories/packages";

export type RoamResult =
  | { ok: false; reason: "no_mac" | "no_session" | "same_site" | "inactive" }
  | {
      ok: true;
      payment: Payment;
      session: DeviceSession;
      hotspot: Hotspot;
      package: Package;
      sourceHotspotId: string;
      endsAt: string;
      unlockOk: boolean;
      unlockError?: string;
      alreadyGranted: boolean;
    };

function sortByEndsAtDesc(sessions: DeviceSession[]): DeviceSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
  );
}

async function collectActiveSessionsForMac(
  clientMac: string,
  ownerHotspotIds: string[],
): Promise<DeviceSession[]> {
  const devices = await listDevicesByMac(clientMac);
  const deviceIds = devices.map((d) => d.id);
  const activeByDevice = await listActiveSessionsByDeviceIds(
    deviceIds,
    ownerHotspotIds,
  );

  const macPayments = await paymentRepo.listSuccessPaymentsByClientMac(
    clientMac,
    ownerHotspotIds,
  );
  const sessionsFromPayments: DeviceSession[] = [];
  for (const p of macPayments.slice(0, 15)) {
    const s = await getSessionByPaymentId(p.id);
    if (
      s &&
      s.status === "active" &&
      new Date(s.endsAt).getTime() > Date.now() &&
      ownerHotspotIds.includes(s.hotspotId)
    ) {
      sessionsFromPayments.push(s);
    }
  }

  const byId = new Map<string, DeviceSession>();
  for (const s of [...activeByDevice, ...sessionsFromPayments]) {
    byId.set(s.id, s);
  }
  return sortByEndsAtDesc([...byId.values()]);
}

/**
 * Find remaining-time sessions from a prior payment reference (survives
 * per-SSID private MAC randomization when the guest returns with our cookie).
 */
async function collectActiveSessionsForContinueRef(
  continueReference: string,
  ownerId: string,
  ownerHotspotIds: string[],
): Promise<DeviceSession[]> {
  const payment = await paymentRepo.getPaymentByReference(continueReference);
  if (!payment || payment.status !== "success") return [];

  const paidHotspot = await getHotspotById(payment.hotspotId);
  if (!paidHotspot || paidHotspot.ownerId !== ownerId) return [];

  const byId = new Map<string, DeviceSession>();
  const linked = await getSessionByPaymentId(payment.id);
  if (
    linked &&
    linked.status === "active" &&
    new Date(linked.endsAt).getTime() > Date.now() &&
    ownerHotspotIds.includes(linked.hotspotId)
  ) {
    byId.set(linked.id, linked);
  }

  // Use customer even if this payment's session already ended (roam chain).
  if (linked?.customerId) {
    for (const s of await listActiveSessionsByCustomerId(
      linked.customerId,
      ownerHotspotIds,
    )) {
      byId.set(s.id, s);
    }
  }

  return sortByEndsAtDesc([...byId.values()]);
}

async function grantRoamFromSource(input: {
  hotspot: Hotspot;
  source: DeviceSession;
  clientMac: string | null;
  alreadyLocal: boolean;
}): Promise<RoamResult> {
  const { hotspot, source, clientMac } = input;

  if (input.alreadyLocal) {
    let payment = await paymentRepo.getPaymentById(source.paymentId);
    const pkg = payment
      ? await getPackageById(payment.packageId, hotspot.ownerId)
      : null;
    if (!payment || !pkg) {
      return { ok: false, reason: "no_session" };
    }
    // Phone may present a new private MAC on this SSID — bind the current one.
    if (
      isUsableClientMac(clientMac) &&
      normalizeMac(payment.clientMac) !== clientMac
    ) {
      payment =
        (await paymentRepo.updatePaymentClientMac(
          payment.reference,
          clientMac!,
        )) ?? { ...payment, clientMac: clientMac! };
    }
    // Await unlock so this site's MikroTik actually gets the binding.
    const unlocked = await provisionAccessFromPayment(payment, undefined, {
      endsAt: source.endsAt,
      deferRouterUnlock: false,
    });
    return {
      ok: true,
      payment: unlocked.payment,
      session: unlocked.session,
      hotspot,
      package: pkg,
      sourceHotspotId: source.hotspotId,
      endsAt: source.endsAt,
      unlockOk: unlocked.unlockOk,
      unlockError: unlocked.unlockError,
      alreadyGranted: true,
    };
  }

  const sourcePayment = await paymentRepo.getPaymentById(source.paymentId);
  if (!sourcePayment) {
    return { ok: false, reason: "no_session" };
  }

  const pkg = await getPackageById(source.packageId, hotspot.ownerId);
  if (!pkg) {
    return { ok: false, reason: "no_session" };
  }

  const live = await hotspotHasLiveMikroTik(hotspot.id);
  if (live && !isUsableClientMac(clientMac)) {
    return { ok: false, reason: "no_mac" };
  }

  const macTag = (clientMac ?? "nomac").replace(/:/g, "").slice(-8);
  const email = await resolvePortalEmail(
    sourcePayment.customerEmail,
    clientMac,
  );

  const reference = `roam_${hotspot.id.slice(0, 8)}_${macTag}_${Date.now().toString(36)}`;
  const payment = await paymentRepo.createPayment({
    reference,
    hotspotId: hotspot.id,
    packageId: pkg.id,
    customerEmail: email,
    amount: 0,
    currency: pkg.currency,
    provider: "roam",
    status: "success",
    providerRef: `roam:${source.id}:${source.paymentId}`,
    clientMac: clientMac ?? null,
  });

  // Await unlock — deferred fire-and-forget often never reaches the new router.
  const { session, unlockOk, unlockError } = await provisionAccessFromPayment(
    payment,
    {
      notifyTitle: "Roaming unlock",
      notifyBody: `${email} continued access at ${hotspot.name} (remaining time from another site).`,
      href: "/sessions",
    },
    {
      endsAt: source.endsAt,
      deferRouterUnlock: false,
    },
  );

  return {
    ok: true,
    payment,
    session,
    hotspot,
    package: pkg,
    sourceHotspotId: source.hotspotId,
    endsAt: source.endsAt,
    unlockOk,
    unlockError,
    alreadyGranted: false,
  };
}

/**
 * If this guest has remaining time at another hotspot of the same owner,
 * grant access at the current site until the same endsAt (no second charge).
 *
 * Identity: device MAC and/or continueReference from the portal roam cookie
 * (needed when phones use a different private MAC per SSID).
 */
export async function tryRoamAccess(raw: {
  hotspotId: string;
  macAddress?: string | null;
  continueReference?: string | null;
}): Promise<RoamResult> {
  const clientMac = normalizeMac(raw.macAddress);
  const continueReference = raw.continueReference?.trim() || null;

  if (!isUsableClientMac(clientMac) && !continueReference) {
    return { ok: false, reason: "no_mac" };
  }

  const hotspot = await getHotspotById(raw.hotspotId);
  if (!hotspot || hotspot.status !== "active") {
    return { ok: false, reason: "inactive" };
  }

  const ownerHotspots = await listHotspotsByOwner(hotspot.ownerId);
  const ownerHotspotIds = ownerHotspots.map((h) => h.id);
  if (ownerHotspotIds.length < 2) {
    return { ok: false, reason: "no_session" };
  }

  const byId = new Map<string, DeviceSession>();
  if (isUsableClientMac(clientMac)) {
    for (const s of await collectActiveSessionsForMac(
      clientMac!,
      ownerHotspotIds,
    )) {
      byId.set(s.id, s);
    }
  }
  if (continueReference) {
    for (const s of await collectActiveSessionsForContinueRef(
      continueReference,
      hotspot.ownerId,
      ownerHotspotIds,
    )) {
      byId.set(s.id, s);
    }
  }

  const activeSessions = sortByEndsAtDesc([...byId.values()]);
  if (activeSessions.length === 0) {
    return { ok: false, reason: "no_session" };
  }

  const localActive = activeSessions.find((s) => s.hotspotId === hotspot.id);
  if (localActive) {
    if (
      (await hotspotHasLiveMikroTik(hotspot.id)) &&
      !isUsableClientMac(clientMac)
    ) {
      return { ok: false, reason: "no_mac" };
    }
    return grantRoamFromSource({
      hotspot,
      source: localActive,
      clientMac,
      alreadyLocal: true,
    });
  }

  const source = activeSessions.find((s) => s.hotspotId !== hotspot.id);
  if (!source) {
    return { ok: false, reason: "same_site" };
  }

  return grantRoamFromSource({
    hotspot,
    source,
    clientMac,
    alreadyLocal: false,
  });
}
