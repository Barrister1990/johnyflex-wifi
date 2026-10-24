import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/payments";
import { portalPath } from "@/lib/hotspots/slug";
import { getHotspotById } from "@/lib/repositories/hotspots";
import { getPaymentByReference } from "@/lib/repositories/payments";
import { confirmPaymentByReference } from "@/lib/services/payments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference =
    url.searchParams.get("reference") || url.searchParams.get("trxref");

  if (!reference) {
    return NextResponse.redirect(`${getAppUrl()}/`);
  }

  try {
    const { payment, unlockOk, unlockError } = await confirmPaymentByReference(
      reference,
      {
        source: "callback",
        query: Object.fromEntries(url.searchParams),
      },
    );
    const hotspot = await getHotspotById(payment.hotspotId);
    const path = hotspot
      ? portalPath(hotspot, "/success")
      : `/portal/${payment.hotspotId}/success`;
    const dest = new URL(`${getAppUrl()}${path}`);
    dest.searchParams.set("reference", reference);
    if (!unlockOk) {
      dest.searchParams.set("unlock", "pending");
      if (unlockError) {
        dest.searchParams.set("note", unlockError.slice(0, 160));
      }
    }
    return NextResponse.redirect(dest.toString());
  } catch (error) {
    const payment = await getPaymentByReference(reference);
    const message =
      error instanceof Error ? error.message : "Payment could not be completed";

    // Paid in Supabase but fulfillment threw → still success UX
    if (payment?.status === "success") {
      const hotspot = await getHotspotById(payment.hotspotId);
      const path = hotspot
        ? portalPath(hotspot, "/success")
        : `/portal/${payment.hotspotId}/success`;
      const dest = new URL(`${getAppUrl()}${path}`);
      dest.searchParams.set("reference", reference);
      dest.searchParams.set("unlock", "pending");
      dest.searchParams.set("note", message.slice(0, 160));
      return NextResponse.redirect(dest.toString());
    }

    if (payment) {
      const hotspot = await getHotspotById(payment.hotspotId);
      const path = hotspot
        ? portalPath(hotspot, "/failed")
        : `/portal/${payment.hotspotId}/failed`;
      const dest = new URL(`${getAppUrl()}${path}`);
      dest.searchParams.set("reference", reference);
      dest.searchParams.set("reason", message.slice(0, 160));
      return NextResponse.redirect(dest.toString());
    }
    return NextResponse.redirect(`${getAppUrl()}/`);
  }
}
