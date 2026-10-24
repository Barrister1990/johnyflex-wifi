import { randomBytes } from "crypto";
import {
  getAppUrl,
  getPaymentMode,
  getPaymentProvider,
} from "@/lib/payments";
import { packageVisibleAtHotspot } from "@/lib/packages/visibility";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { findOrCreateCustomer } from "@/lib/repositories/customers";
import { findOrCreateDevice } from "@/lib/repositories/devices";
import * as paymentRepo from "@/lib/repositories/payments";
import { getHotspotById, listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { getPackageById, listPackagesByOwner } from "@/lib/repositories/packages";
import {
  createSession,
  getSessionByPaymentId,
} from "@/lib/repositories/sessions";
import { addUsageLog } from "@/lib/repositories/usage-logs";
import * as subRepo from "@/lib/repositories/subscriptions";
import {
  authorizeSessionAccess,
  hotspotHasLiveMikroTik,
} from "@/lib/router/session-access";
import { notifyOwner } from "@/lib/services/notifications";
import type { DeviceSession, Payment, PaymentListItem } from "@/lib/types";
import { resolvePortalEmail } from "@/lib/portal-guest-email";
import { initializePaymentSchema } from "@/lib/validations";

function makeReference() {
  return `wh_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export type ConfirmPaymentResult = {
  payment: Payment;
  session: DeviceSession;
  unlockOk: boolean;
  unlockError?: string;
};

async function requireClientMacForLiveRouter(
  _hotspotId: string,
  raw: string | undefined,
): Promise<string | null> {
  const mac = normalizeMac(raw);
  // Always require a real MAC before checkout — payments without Wi‑Fi
  // connection cannot be unlocked on MikroTik after Paystack returns.
  if (!isUsableClientMac(mac)) {
    throw new Error(
      "Connect to this hotspot’s Wi‑Fi first so your device MAC is known, then try again.",
    );
  }
  return mac;
}

function macFromMetadata(
  meta: Record<string, string> | undefined,
): string | null {
  if (!meta) return null;
  const raw = meta.clientMac || meta.client_mac || meta.mac || "";
  const mac = normalizeMac(raw);
  return isUsableClientMac(mac) ? mac : null;
}

async function mergeClientMacFromVerify(
  payment: Payment,
  metadata?: Record<string, string>,
): Promise<Payment> {
  if (isUsableClientMac(payment.clientMac)) return payment;
  const fromMeta = macFromMetadata(metadata);
  if (!fromMeta) return payment;
  const updated = await paymentRepo.updatePaymentClientMac(
    payment.reference,
    fromMeta,
  );
  return updated ?? { ...payment, clientMac: fromMeta };
}

export async function initializePayment(raw: unknown): Promise<{
  payment: Payment;
  authorizationUrl: string;
}> {
  const data = initializePaymentSchema.parse(raw);
  const hotspot = await getHotspotById(data.hotspotId);
  if (!hotspot || hotspot.status === "inactive") {
    throw new Error("Hotspot not found or inactive");
  }
  if (hotspot.status === "maintenance") {
    throw new Error(
      "This hotspot is under maintenance. Purchases are paused — try again shortly.",
    );
  }

  const clientMac = await requireClientMacForLiveRouter(
    hotspot.id,
    data.macAddress,
  );
  const email = await resolvePortalEmail(data.email, clientMac);

  let amount: number;
  let currency: string;
  let packageId: string;
  let subscriptionPlanId: string | null = null;

  if (data.subscriptionPlanId) {
    const plan = await subRepo.getPlanById(
      data.subscriptionPlanId,
      hotspot.ownerId,
    );
    if (!plan || !plan.enabled) {
      throw new Error("Subscription plan not found or disabled");
    }
    if (plan.hotspotId && plan.hotspotId !== hotspot.id) {
      throw new Error("Plan is not available at this hotspot");
    }
    amount = plan.price;
    currency = plan.currency;
    packageId = plan.linkedPackageId;
    subscriptionPlanId = plan.id;
  } else {
    if (!data.packageId) throw new Error("Package required");
    const pkg = await getPackageById(data.packageId, hotspot.ownerId);
    if (!pkg || !packageVisibleAtHotspot(pkg, hotspot.id)) {
      throw new Error("Package not found or disabled");
    }
    amount = pkg.price;
    currency = pkg.currency;
    packageId = pkg.id;
  }

  const provider = getPaymentProvider();
  const mode = getPaymentMode();
  const reference = makeReference();
  const payment = await paymentRepo.createPayment({
    reference,
    hotspotId: hotspot.id,
    packageId,
    subscriptionPlanId,
    customerEmail: email,
    amount,
    currency,
    provider: mode,
    clientMac,
  });

  const callbackUrl = `${getAppUrl()}/api/payments/callback`;
  const checkout = await provider.initialize({
    email,
    amount,
    currency,
    reference,
    callbackUrl,
    metadata: {
      hotspotId: hotspot.id,
      packageId,
      paymentId: payment.id,
      subscriptionPlanId: subscriptionPlanId ?? "",
      clientMac: clientMac ?? "",
    },
  });

  return { payment, authorizationUrl: checkout.authorizationUrl };
}

/**
 * Idempotent fulfillment after Paystack (or mock) confirms money moved.
 * Never demotes a Paystack-verified charge to failed — paid users always get
 * a success row + session; MikroTik unlock is best-effort with unlockOk.
 */
export async function confirmPaymentByReference(
  reference: string,
  rawPayload?: unknown,
): Promise<ConfirmPaymentResult> {
  let payment = await paymentRepo.getPaymentByReference(reference);
  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status === "success") {
    const existing = await getSessionByPaymentId(payment.id);
    if (existing) {
      const unlock = await tryUnlockSession(payment, existing);
      return {
        payment,
        session: existing,
        unlockOk: unlock.ok,
        unlockError: unlock.error,
      };
    }
    // Paid in DB but session missing (crash mid-fulfill) — re-provision.
    return fulfillSuccessfulPayment(payment, rawPayload ?? { recovered: true });
  }

  const provider = getPaymentProvider();
  const verified = await provider.verify(reference);

  await paymentRepo.addPaymentCallback({
    paymentId: payment.id,
    rawPayload: rawPayload ?? verified.raw,
    verified: verified.success,
  });

  if (!verified.success) {
    // Do not permanently fail a pending row on a single verify miss —
    // Paystack webhook/callback may arrive before settlement is queryable.
    // Only mark failed when provider explicitly reports a terminal failure.
    const terminal = ["failed", "abandoned", "reversed"].includes(
      (verified.providerStatus ?? "").toLowerCase(),
    );
    if (terminal && payment.status === "pending") {
      await paymentRepo.updatePaymentStatus(
        reference,
        "failed",
        verified.providerRef,
      );
    }
    throw new Error(
      verified.providerStatus
        ? `Payment not successful (${verified.providerStatus})`
        : "Payment verification failed",
    );
  }

  payment = await mergeClientMacFromVerify(payment, verified.metadata);

  if (
    payment.provider === "paystack" &&
    verified.amount > 0 &&
    Math.abs(verified.amount - payment.amount) > 0.01
  ) {
    const hotspot = await getHotspotById(payment.hotspotId);
    if (hotspot) {
      await notifyOwner({
        ownerId: hotspot.ownerId,
        type: "system",
        title: "Paystack amount mismatch",
        body: `Ref ${payment.reference}: expected ${payment.currency} ${payment.amount.toFixed(2)}, Paystack reported ${verified.currency} ${verified.amount.toFixed(2)}. Access still granted.`,
        href: "/payments",
      });
    }
    // Still fulfill — money was taken; never deny the customer.
  }

  const updated = await paymentRepo.markPaymentSuccess(
    reference,
    verified.providerRef,
  );
  if (!updated) throw new Error("Payment not found");

  return fulfillSuccessfulPayment(updated, rawPayload ?? verified.raw);
}

async function fulfillSuccessfulPayment(
  payment: Payment,
  _rawPayload?: unknown,
): Promise<ConfirmPaymentResult> {
  const raced = await getSessionByPaymentId(payment.id);
  if (raced) {
    const unlock = await tryUnlockSession(payment, raced);
    return {
      payment,
      session: raced,
      unlockOk: unlock.ok,
      unlockError: unlock.error,
    };
  }

  if (payment.subscriptionPlanId) {
    return activateSubscriptionPayment(payment);
  }

  return provisionAccessFromPayment(payment, {
    notifyTitle: "Payment received",
    notifyBody: `${payment.customerEmail} paid ${payment.currency} ${payment.amount.toFixed(2)}.`,
  });
}

async function activateSubscriptionPayment(
  payment: Payment,
): Promise<ConfirmPaymentResult> {
  const hotspot = await getHotspotById(payment.hotspotId);
  if (!hotspot) throw new Error("Hotspot not found");
  const plan = await subRepo.getPlanById(
    payment.subscriptionPlanId!,
    hotspot.ownerId,
  );
  if (!plan) throw new Error("Subscription plan not found");

  await subRepo.upsertActiveSubscription({
    ownerId: hotspot.ownerId,
    planId: plan.id,
    customerEmail: payment.customerEmail,
    hotspotId: hotspot.id,
    intervalDays: plan.intervalDays,
    paymentId: payment.id,
  });

  return provisionAccessFromPayment(payment, {
    notifyTitle: "Subscription started",
    notifyBody: `${payment.customerEmail} subscribed to ${plan.name} (${payment.currency} ${payment.amount.toFixed(2)}/${plan.intervalDays}d).`,
    href: "/packages",
  });
}

async function tryUnlockSession(
  payment: Payment,
  session: DeviceSession,
): Promise<{ ok: boolean; error?: string }> {
  const hotspot = await getHotspotById(payment.hotspotId);
  if (!hotspot) return { ok: false, error: "Hotspot not found" };

  const pkg = await getPackageById(payment.packageId, hotspot.ownerId);
  if (!pkg) return { ok: false, error: "Package not found" };

  const mac =
    normalizeMac(payment.clientMac) ??
    (isUsableClientMac(payment.clientMac) ? payment.clientMac : null);

  if (!(await hotspotHasLiveMikroTik(hotspot.id))) {
    try {
      await authorizeSessionAccess({
        hotspotId: hotspot.id,
        sessionId: session.id,
        macAddress: mac ?? "02:00:00:00:00:01",
        speedProfile: pkg.speedProfile,
        endsAt: session.endsAt,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unlock failed",
      };
    }
  }

  if (!isUsableClientMac(mac)) {
    return {
      ok: false,
      error:
        "Payment succeeded but Wi‑Fi unlock needs your device MAC. Rejoin the café Wi‑Fi and open the login page again.",
    };
  }

  const unlockMac = mac as string;

  try {
    await Promise.race([
      authorizeSessionAccess({
        hotspotId: hotspot.id,
        sessionId: session.id,
        macAddress: unlockMac,
        speedProfile: pkg.speedProfile,
        endsAt: session.endsAt,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Unlock timed out — tap retry if needed")),
          6_000,
        ),
      ),
    ]);
    return { ok: true };
  } catch (error) {
    void authorizeSessionAccess({
      hotspotId: hotspot.id,
      sessionId: session.id,
      macAddress: unlockMac,
      speedProfile: pkg.speedProfile,
      endsAt: session.endsAt,
    }).catch(() => undefined);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unlock failed",
    };
  }
}

export async function provisionAccessFromPayment(
  payment: Payment,
  notify?: { notifyTitle: string; notifyBody: string; href?: string },
  opts?: {
    endsAt?: string;
    /**
     * Free Mode / captive portal: return as soon as the session row exists.
     * MikroTik unlock + email run in the background so the phone can redirect
     * before the captive browser is killed by “internet is up”.
     */
    deferRouterUnlock?: boolean;
  },
): Promise<ConfirmPaymentResult> {
  const existing = await getSessionByPaymentId(payment.id);
  if (existing) {
    if (opts?.deferRouterUnlock) {
      void tryUnlockSession(payment, existing).catch(() => undefined);
      return { payment, session: existing, unlockOk: true };
    }
    const unlock = await tryUnlockSession(payment, existing);
    return {
      payment,
      session: existing,
      unlockOk: unlock.ok,
      unlockError: unlock.error,
    };
  }

  const hotspot = await getHotspotById(payment.hotspotId);
  if (!hotspot) throw new Error("Hotspot not found");

  const pkg = await getPackageById(payment.packageId, hotspot.ownerId);
  if (!pkg) throw new Error("Package not found");

  const customer = await findOrCreateCustomer({
    email: payment.customerEmail,
    hotspotId: hotspot.id,
  });
  const mac =
    normalizeMac(payment.clientMac) ??
    (isUsableClientMac(payment.clientMac) ? payment.clientMac : null);
  const device = await findOrCreateDevice({
    customerId: customer.id,
    ...(mac ? { macAddress: mac } : {}),
  });

  const unlockMac = mac ?? device.macAddress ?? null;

  const endsAt = opts?.endsAt;
  const durationMinutes = endsAt
    ? Math.max(
        1,
        Math.ceil((new Date(endsAt).getTime() - Date.now()) / 60_000),
      )
    : pkg.durationMinutes;

  const session = await createSession({
    hotspotId: hotspot.id,
    packageId: pkg.id,
    customerId: customer.id,
    deviceId: device.id,
    paymentId: payment.id,
    durationMinutes,
    ...(endsAt ? { endsAt } : {}),
  });

  const finishSideEffects = async () => {
    await addUsageLog({
      sessionId: session.id,
      hotspotId: hotspot.id,
      event: "session_started",
    });

    await notifyOwner({
      ownerId: hotspot.ownerId,
      type: "payment_success",
      title: notify?.notifyTitle ?? "Access granted",
      body:
        notify?.notifyBody ??
        `${payment.customerEmail} started ${pkg.name} at ${hotspot.name}.`,
      href: notify?.href ?? "/payments",
    });

    try {
      const { isGuestPortalEmail } = await import("@/lib/portal-guest-email");
      if (!isGuestPortalEmail(payment.customerEmail)) {
        const { sendReceiptEmail } = await import("@/lib/email/receipts");
        await sendReceiptEmail({
          to: payment.customerEmail,
          hotspotName: hotspot.name,
          packageName: pkg.name,
          amount: payment.amount,
          currency: payment.currency,
          reference: payment.reference,
          provider: payment.provider,
        });
      }
    } catch {
      // Receipt email is best-effort; portal print still works.
    }
  };

  let unlockOk = true;
  let unlockError: string | undefined;

  const runUnlock = async () => {
    if (!(await hotspotHasLiveMikroTik(hotspot.id))) {
      try {
        await authorizeSessionAccess({
          hotspotId: hotspot.id,
          sessionId: session.id,
          macAddress: unlockMac ?? "02:00:00:00:00:01",
          speedProfile: pkg.speedProfile,
          endsAt: session.endsAt,
        });
      } catch (error) {
        unlockOk = false;
        unlockError =
          error instanceof Error ? error.message : "Unlock adapter failed";
      }
      return;
    }

    if (!isUsableClientMac(unlockMac)) {
      unlockOk = false;
      unlockError =
        "Payment succeeded but Wi‑Fi unlock needs your device MAC. Rejoin the café Wi‑Fi and open the login page again, or contact the venue with your payment reference.";
      await notifyOwner({
        ownerId: hotspot.ownerId,
        type: "system",
        title: "Payment OK — unlock blocked",
        body: `${payment.customerEmail} paid but device MAC was missing. Ask them to open the captive portal on the café Wi‑Fi.`,
        href: "/payments",
      });
      return;
    }

    try {
      await Promise.race([
        authorizeSessionAccess({
          hotspotId: hotspot.id,
          sessionId: session.id,
          macAddress: unlockMac as string,
          speedProfile: pkg.speedProfile,
          endsAt: session.endsAt,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Wi‑Fi unlock is taking longer than usual — tap retry if you are not online yet.",
                ),
              ),
            6_000,
          ),
        ),
      ]);
    } catch (error) {
      unlockOk = false;
      unlockError =
        error instanceof Error ? error.message : "MikroTik unlock failed";
      void authorizeSessionAccess({
        hotspotId: hotspot.id,
        sessionId: session.id,
        macAddress: unlockMac as string,
        speedProfile: pkg.speedProfile,
        endsAt: session.endsAt,
      }).catch((err) => {
        console.warn(
          "[wifihub] delayed unlock",
          err instanceof Error ? err.message : err,
        );
      });
      await notifyOwner({
        ownerId: hotspot.ownerId,
        type: "system",
        title: "Payment OK — unlock pending",
        body: `${payment.customerEmail} paid (${payment.reference}) but MikroTik unlock is still pending: ${unlockError}`,
        href: "/payments",
      });
    }
  };

  if (opts?.deferRouterUnlock) {
    // Captive portal: respond now so the client can navigate; unlock after.
    void (async () => {
      try {
        await runUnlock();
      } finally {
        await finishSideEffects().catch(() => undefined);
      }
    })();
    return { payment, session, unlockOk: true };
  }

  await runUnlock();
  await finishSideEffects();

  return { payment, session, unlockOk, unlockError };
}

/**
 * Re-run MikroTik unlock for an already-successful payment (success page retry).
 */
export async function ensureAccessForPayment(
  reference: string,
  macAddress?: string,
): Promise<ConfirmPaymentResult> {
  let payment = await paymentRepo.getPaymentByReference(reference);
  if (!payment) throw new Error("Payment not found");

  if (payment.status !== "success") {
    return confirmPaymentByReference(reference, { source: "ensure-access" });
  }

  const mac = normalizeMac(macAddress);
  if (isUsableClientMac(mac) && !isUsableClientMac(payment.clientMac)) {
    payment =
      (await paymentRepo.updatePaymentClientMac(reference, mac!)) ?? payment;
  }

  return fulfillSuccessfulPayment(payment, { source: "ensure-access" });
}

export async function handlePaystackWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{
  ok: boolean;
  reference?: string;
  unlockOk?: boolean;
  recorded?: boolean;
}> {
  const provider = getPaymentProvider();
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    throw new Error("Invalid webhook signature");
  }

  const payload = JSON.parse(rawBody) as {
    event?: string;
    data?: {
      reference?: string;
      metadata?: Record<string, unknown>;
      status?: string;
    };
  };

  const reference = payload.data?.reference;
  if (!reference) {
    return { ok: true };
  }

  if (payload.event !== "charge.success") {
    // Still audit non-success events against known payments when possible.
    const payment = await paymentRepo.getPaymentByReference(reference);
    if (payment) {
      await paymentRepo.addPaymentCallback({
        paymentId: payment.id,
        rawPayload: payload,
        verified: false,
      });
    }
    return { ok: true, reference, recorded: Boolean(payment) };
  }

  // Prefer metadata MAC from webhook body before verify round-trip.
  const paymentBefore = await paymentRepo.getPaymentByReference(reference);
  if (paymentBefore && !isUsableClientMac(paymentBefore.clientMac)) {
    const meta = payload.data?.metadata as Record<string, string> | undefined;
    const fromMeta = macFromMetadata(meta);
    if (fromMeta) {
      await paymentRepo.updatePaymentClientMac(reference, fromMeta);
    }
  }

  const result = await confirmPaymentByReference(reference, payload);
  return {
    ok: true,
    reference,
    unlockOk: result.unlockOk,
    recorded: true,
  };
}

export async function listOwnerPayments(
  ownerId: string,
  hotspotId?: string | null,
): Promise<PaymentListItem[]> {
  const allOwnerHotspots = await listHotspotsByOwner(ownerId);
  const ownerHotspots =
    hotspotId && allOwnerHotspots.some((h) => h.id === hotspotId)
      ? allOwnerHotspots.filter((h) => h.id === hotspotId)
      : allOwnerHotspots;
  const hotspotIds = ownerHotspots.map((h) => h.id);
  const payments = await paymentRepo.listPaymentsByHotspotIds(hotspotIds);

  const hotspotMap = new Map(ownerHotspots.map((h) => [h.id, h]));
  const packages = await listPackagesByOwner(ownerId);
  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const packagePriceById = new Map(packages.map((p) => [p.id, p.price]));

  const { paymentRevenueAmount } = await import("@/lib/payments/revenue");

  return payments.map((p) => ({
    ...p,
    amount: paymentRevenueAmount(p, packagePriceById),
    hotspotName: hotspotMap.get(p.hotspotId)?.name ?? "Unknown",
    packageName: packageMap.get(p.packageId)?.name ?? "Unknown",
  }));
}
