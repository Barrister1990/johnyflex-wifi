import { NextResponse } from "next/server";
import { resolvePublicOrigin } from "@/lib/payments";
import { claimFreeAccess } from "@/lib/services/free-mode";
import { initializePayment } from "@/lib/services/payments";
import { redeemVoucher } from "@/lib/services/vouchers";

/**
 * Captive-portal form POST (no JS required).
 * Accepts application/x-www-form-urlencoded or multipart FormData and redirects.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "").trim();
  const hotspotId = String(form.get("hotspotId") ?? "").trim();
  const hotspotSlug = String(form.get("hotspotSlug") ?? hotspotId).trim();
  const macRaw = String(form.get("macAddress") ?? "").trim();
  const macAddress = macRaw || undefined;

  const portalBase = `${resolvePublicOrigin(request)}/portal/${encodeURIComponent(hotspotSlug)}`;
  const back = (message: string) =>
    NextResponse.redirect(
      `${portalBase}?error=${encodeURIComponent(message)}${
        macAddress ? `&mac=${encodeURIComponent(macAddress)}` : ""
      }`,
      303,
    );

  if (!hotspotId) return back("Hotspot missing. Reopen from the Wi‑Fi login screen.");

  try {
    if (intent === "pay") {
      const offer = String(form.get("offer") ?? "").trim();
      let packageId = String(form.get("packageId") ?? "").trim();
      let subscriptionPlanId = String(
        form.get("subscriptionPlanId") ?? "",
      ).trim();
      if (offer.startsWith("package:")) {
        packageId = offer.slice("package:".length);
        subscriptionPlanId = "";
      } else if (offer.startsWith("subscription:")) {
        subscriptionPlanId = offer.slice("subscription:".length);
        packageId = "";
      }
      if (!packageId && !subscriptionPlanId) {
        return back("Select a package first.");
      }
      const result = await initializePayment({
        hotspotId,
        ...(packageId ? { packageId } : {}),
        ...(subscriptionPlanId ? { subscriptionPlanId } : {}),
        ...(macAddress ? { macAddress } : {}),
      });
      return NextResponse.redirect(result.authorizationUrl, 303);
    }

    if (intent === "redeem") {
      const code = String(form.get("code") ?? "").trim();
      if (!code) return back("Enter a voucher code.");
      const result = await redeemVoucher({
        hotspotId,
        code,
        ...(macAddress ? { macAddress } : {}),
      });
      return NextResponse.redirect(
        `${portalBase}/success?reference=${encodeURIComponent(result.payment.reference)}`,
        303,
      );
    }

    if (intent === "free") {
      if (!macAddress) {
        return back("Join this Wi‑Fi first, then try again.");
      }
      const result = await claimFreeAccess({
        hotspotId,
        macAddress,
      });
      return NextResponse.redirect(
        `${portalBase}/success?reference=${encodeURIComponent(result.payment.reference)}`,
        303,
      );
    }

    return back("Unknown action.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong. Try again.";
    return back(message);
  }
}
